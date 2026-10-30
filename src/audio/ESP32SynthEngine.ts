/**
 * ESP32SynthEngine - Web Audio API & AudioWorklet interface to ESP32Synth WebAssembly
 * Respects original units: 8-bit (0-255) for volume/PW/wet, CentiHz (1Hz = 100cHz) for frequencies.
 */

import { WaveType, CustomWavePatch, BusFXPatch, GlobalDSPPatch, EngineTelemetry } from './types';
import { WASM_BASE64 } from './wasm_binary';
import { WORKLET_CODE } from './worklet_source';

function getEmbeddedWasmBytes(): ArrayBuffer {
  const binaryString = atob(WASM_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function isValidWasm(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  const h = new Uint8Array(buffer, 0, 4);
  return h[0] === 0x00 && h[1] === 0x61 && h[2] === 0x73 && h[3] === 0x6d;
}

export class ESP32SynthEngine {
  private static instance: ESP32SynthEngine | null = null;
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private fallbackInstance: WebAssembly.Instance | null = null;
  private isInitialized = false;
  private isWorkletRunning = false;
  private telemetryCallbacks: Set<(t: EngineTelemetry) => void> = new Set();
  
  // Voice allocation tracking for polyphonic mode
  private polyphonyVoices = 8;
  private activeNoteVoices: Map<number, number> = new Map(); // midiNote -> voice index
  private nextVoiceIdx = 0;

  // Analyser node for oscilloscope and spectrum visualization
  private analyser: AnalyserNode | null = null;

  public static getInstance(): ESP32SynthEngine {
    if (!ESP32SynthEngine.instance) {
      ESP32SynthEngine.instance = new ESP32SynthEngine();
    }
    return ESP32SynthEngine.instance;
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.audioCtx && this.audioCtx.state === 'running') {
      return true;
    }

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass({ sampleRate: 48000 });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Fetch or decode the WebAssembly binary (with magic word validation)
      let wasmBytes: ArrayBuffer | null = null;
      try {
        const wasmResponse = await fetch('/esp32synth.wasm');
        if (wasmResponse.ok) {
          const candidateBytes = await wasmResponse.arrayBuffer();
          if (isValidWasm(candidateBytes)) {
            wasmBytes = candidateBytes;
          } else {
            console.warn('Network /esp32synth.wasm did not return valid WASM magic bytes, falling back to embedded binary.');
          }
        }
      } catch (fetchErr) {
        console.warn('Network fetch for /esp32synth.wasm failed, falling back to embedded binary:', fetchErr);
      }

      if (!wasmBytes) {
        wasmBytes = getEmbeddedWasmBytes();
      }

      this.wasmModule = new WebAssembly.Module(wasmBytes);

      // Create AnalyserNode for audio visualization
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.audioCtx.destination);

      // Try AudioWorklet first using Blob URL to bypass network routing/proxy issues
      let workletLoaded = false;
      if (this.audioCtx.audioWorklet) {
        try {
          let workletUrl = '/esp32synth-worklet.js';
          try {
            const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
            workletUrl = URL.createObjectURL(blob);
          } catch {
            workletUrl = '/esp32synth-worklet.js';
          }

          try {
            await this.audioCtx.audioWorklet.addModule(workletUrl);
          } catch (blobErr) {
            // Fallback to static path if Blob URL was blocked
            await this.audioCtx.audioWorklet.addModule('/esp32synth-worklet.js');
          }

          this.workletNode = new AudioWorkletNode(this.audioCtx, 'esp32synth-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
          });

          this.workletNode.port.onmessage = (e) => {
            if (e.data.type === 'TELEMETRY') {
              this.telemetryCallbacks.forEach(cb => cb(e.data));
            } else if (e.data.type === 'WASM_READY') {
              this.isWorkletRunning = true;
            }
          };

          this.workletNode.port.postMessage({
            type: 'INIT_WASM',
            wasmBytes,
            sampleRate: this.audioCtx.sampleRate,
            masterVolume: 200,
          });

          this.workletNode.connect(this.analyser);
          workletLoaded = true;
          this.isWorkletRunning = true;
        } catch (workletErr) {
          console.warn('AudioWorklet failed, falling back to ScriptProcessor:', workletErr);
        }
      }

      // Fallback path using ScriptProcessorNode if worklet failed
      if (!workletLoaded) {
        this.fallbackInstance = new WebAssembly.Instance(this.wasmModule, {});
        const exp = this.fallbackInstance.exports as any;
        exp.synth_init(this.audioCtx.sampleRate);
        exp.synth_setMasterVolume(200);

        this.scriptNode = this.audioCtx.createScriptProcessor(512, 0, 2);
        this.scriptNode.onaudioprocess = (audioEvent) => {
          const outL = audioEvent.outputBuffer.getChannelData(0);
          const outR = audioEvent.outputBuffer.getChannelData(1);
          const numFrames = outL.length;
          
          const ptr = exp.synth_renderStereo(numFrames);
          const mem = new Int16Array(exp.memory.buffer, ptr, numFrames * 2);

          let peak = 0;
          for (let i = 0; i < numFrames; i++) {
            const l = mem[i * 2] / 32768.0;
            const r = mem[i * 2 + 1] / 32768.0;
            outL[i] = l;
            outR[i] = r;
            const a = Math.abs(l);
            if (a > peak) peak = a;
          }

          // Telemetry
          const activeVoices: import('./types').VoiceTelemetry[] = [];
          for (let v = 0; v < 16; v++) {
            if (exp.synth_isVoiceActive(v)) {
              activeVoices.push({
                voice: v,
                active: true,
                freqCentiHz: exp.synth_getFrequencyCentiHz(v),
                env8Bit: exp.synth_getEnv8Bit(v),
                output8Bit: exp.synth_getOutput8Bit(v),
                envState: exp.synth_getEnvState(v),
                waveType: exp.synth_getWaveType(v),
              });
            }
          }

          this.telemetryCallbacks.forEach(cb => cb({
            activeVoices,
            cpuLoad: exp.synth_getCPULoad(),
            peak,
            masterVol: exp.synth_getMasterVolume(),
          }));
        };

        this.scriptNode.connect(this.analyser);
      }

      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('Failed to initialize ESP32SynthEngine:', err);
      return false;
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public subscribeTelemetry(callback: (t: EngineTelemetry) => void): () => void {
    this.telemetryCallbacks.add(callback);
    return () => this.telemetryCallbacks.delete(callback);
  }

  private sendCommand(msg: any) {
    if (this.workletNode && this.isWorkletRunning) {
      this.workletNode.port.postMessage(msg);
    } else if (this.fallbackInstance) {
      const exp = this.fallbackInstance.exports as any;
      switch (msg.type) {
        case 'NOTE_ON': exp.synth_noteOn(msg.voice, msg.freqCentiHz, msg.volume); break;
        case 'NOTE_OFF': exp.synth_noteOff(msg.voice); break;
        case 'SET_FREQ': exp.synth_setFrequency(msg.voice, msg.freqCentiHz); break;
        case 'SET_VOL': exp.synth_setVolume(msg.voice, msg.volume); break;
        case 'SET_WAVE': exp.synth_setWave(msg.voice, msg.waveType); break;
        case 'SET_PATCH': exp.synth_setCustomWavePatch(msg.voice, msg.patchId); break;
        case 'SET_PW_BITS': exp.synth_setPulseWidthBitDepth(msg.bits); break;
        case 'SET_PW': exp.synth_setPulseWidth(msg.voice, msg.width); break;
        case 'SET_ENV': exp.synth_setEnv(msg.voice, msg.attack, msg.decay, msg.sustain, msg.release); break;
        case 'SET_SMOOTH_ENV': exp.synth_setSmoothEnv(msg.voice, msg.enable ? 1 : 0); break;
        case 'SET_START_PHASE': exp.synth_setStartPhase(msg.voice, msg.degrees); break;
        case 'SET_CURRENT_PHASE': exp.synth_setCurrentPhase(msg.voice, msg.degrees); break;
        case 'SET_VIBRATO': exp.synth_setVibrato(msg.voice, msg.rateCentiHz, msg.depthCentiHz); break;
        case 'SET_VIBRATO_PHASE': exp.synth_setVibratoPhase(msg.voice, msg.degrees); break;
        case 'SET_TREMOLO': exp.synth_setTremolo(msg.voice, msg.rateCentiHz, msg.depth); break;
        case 'SET_TREMOLO_PHASE': exp.synth_setTremoloPhase(msg.voice, msg.degrees); break;
        case 'SLIDE_FREQ': exp.synth_slideFreq(msg.voice, msg.startFreqCentiHz, msg.endFreqCentiHz, msg.durationMs); break;
        case 'SLIDE_FREQ_TO': exp.synth_slideFreqTo(msg.voice, msg.endFreqCentiHz, msg.durationMs); break;
        case 'SLIDE_VOL': exp.synth_slideVol(msg.voice, msg.startVol, msg.endVol, msg.durationMs); break;
        case 'SLIDE_VOL_TO': exp.synth_slideVolTo(msg.voice, msg.endVol, msg.durationMs); break;
        case 'SET_MASTER_VOL': exp.synth_setMasterVolume(msg.volume); break;
        case 'SET_MASTER_BITCRUSH': exp.synth_setMasterBitcrush(msg.bits); break;
        case 'SET_CTRL_RATE': exp.synth_setControlRateHz(msg.hz); break;
        case 'SET_VOICE_BUS': exp.synth_setVoiceBus(msg.voice, msg.busId); break;
        case 'SET_BUS_FX_PATCH': exp.synth_setBusFXPatch(msg.busId, msg.slotId, msg.fxPatchId); break;
        case 'SET_BUS_FX_PARAM': exp.synth_setBusFXParam(msg.busId, msg.slotId, msg.paramId, msg.value); break;
        case 'SET_BUS_MIX': exp.synth_setBusMix(msg.busId, msg.volume); break;
        case 'SET_GLOBAL_DSP_PATCH': exp.synth_setCustomDSPPatch(msg.dspPatchId); break;
        case 'SET_DSP_PARAM': exp.synth_setDSPParam(msg.paramId, msg.value); break;
        case 'SET_CUSTOM_PARAM': exp.synth_setCustomParam(msg.voice, msg.paramId, msg.value); break;
        case 'STOP_ALL':
          for (let v = 0; v < 80; v++) {
            if (exp.synth_isVoiceActive(v)) exp.synth_noteOff(v);
          }
          break;
      }
    }
  }

  // --- Polyphonic Note Triggering ---
  public playMidiNote(midiNote: number, freqCentiHz: number, volume8Bit: number = 255): number {
    const voice = this.nextVoiceIdx;
    this.nextVoiceIdx = (this.nextVoiceIdx + 1) % this.polyphonyVoices;
    this.activeNoteVoices.set(midiNote, voice);

    this.sendCommand({
      type: 'NOTE_ON',
      voice,
      freqCentiHz,
      volume: volume8Bit,
    });

    return voice;
  }

  public releaseMidiNote(midiNote: number) {
    const voice = this.activeNoteVoices.get(midiNote);
    if (voice !== undefined) {
      this.sendCommand({
        type: 'NOTE_OFF',
        voice,
      });
      this.activeNoteVoices.delete(midiNote);
    }
  }

  // --- Direct 1:1 Voice API ---
  public noteOn(voice: number, freqCentiHz: number, volume8Bit: number) {
    this.sendCommand({ type: 'NOTE_ON', voice, freqCentiHz, volume: volume8Bit });
  }

  public noteOff(voice: number) {
    this.sendCommand({ type: 'NOTE_OFF', voice });
  }

  public setFrequency(voice: number, freqCentiHz: number) {
    this.sendCommand({ type: 'SET_FREQ', voice, freqCentiHz });
  }

  public setVolume(voice: number, volume8Bit: number) {
    this.sendCommand({ type: 'SET_VOL', voice, volume: volume8Bit });
  }

  public setWave(voice: number, waveType: WaveType) {
    this.sendCommand({ type: 'SET_WAVE', voice, waveType });
  }

  public setCustomWavePatch(voice: number, patchId: CustomWavePatch) {
    this.sendCommand({ type: 'SET_PATCH', voice, patchId });
  }

  public setPulseWidthBitDepth(bits: number) {
    this.sendCommand({ type: 'SET_PW_BITS', bits });
  }

  public setPulseWidth(voice: number, width: number) {
    this.sendCommand({ type: 'SET_PW', voice, width });
  }

  public setEnv(voice: number, a: number, d: number, s: number, r: number) {
    this.sendCommand({ type: 'SET_ENV', voice, attack: a, decay: d, sustain: s, release: r });
  }

  public setSmoothEnv(voice: number, enable: boolean) {
    this.sendCommand({ type: 'SET_SMOOTH_ENV', voice, enable });
  }

  public setStartPhase(voice: number, degrees: number) {
    this.sendCommand({ type: 'SET_START_PHASE', voice, degrees });
  }

  public setCurrentPhase(voice: number, degrees: number) {
    this.sendCommand({ type: 'SET_CURRENT_PHASE', voice, degrees });
  }

  public setVibrato(voice: number, rateCentiHz: number, depthCentiHz: number) {
    this.sendCommand({ type: 'SET_VIBRATO', voice, rateCentiHz, depthCentiHz });
  }

  public setVibratoPhase(voice: number, degrees: number) {
    this.sendCommand({ type: 'SET_VIBRATO_PHASE', voice, degrees });
  }

  public setTremolo(voice: number, rateCentiHz: number, depth8Bit: number) {
    this.sendCommand({ type: 'SET_TREMOLO', voice, rateCentiHz, depth: depth8Bit });
  }

  public setTremoloPhase(voice: number, degrees: number) {
    this.sendCommand({ type: 'SET_TREMOLO_PHASE', voice, degrees });
  }

  public slideFreq(voice: number, startFreqCentiHz: number, endFreqCentiHz: number, durationMs: number) {
    this.sendCommand({ type: 'SLIDE_FREQ', voice, startFreqCentiHz, endFreqCentiHz, durationMs });
  }

  public slideFreqTo(voice: number, endFreqCentiHz: number, durationMs: number) {
    this.sendCommand({ type: 'SLIDE_FREQ_TO', voice, endFreqCentiHz, durationMs });
  }

  public slideVol(voice: number, startVol: number, endVol: number, durationMs: number) {
    this.sendCommand({ type: 'SLIDE_VOL', voice, startVol, endVol, durationMs });
  }

  public slideVolTo(voice: number, endVol: number, durationMs: number) {
    this.sendCommand({ type: 'SLIDE_VOL_TO', voice, endVol, durationMs });
  }

  public setMasterVolume(volume8Bit: number) {
    this.sendCommand({ type: 'SET_MASTER_VOL', volume: volume8Bit });
  }

  public setMasterBitcrush(bits: number) {
    this.sendCommand({ type: 'SET_MASTER_BITCRUSH', bits });
  }

  public setControlRateHz(hz: number) {
    this.sendCommand({ type: 'SET_CTRL_RATE', hz });
  }

  public setVoiceBus(voice: number, busId: number) {
    this.sendCommand({ type: 'SET_VOICE_BUS', voice, busId });
  }

  public setBusFXPatch(busId: number, slotId: number, fxPatchId: BusFXPatch) {
    this.sendCommand({ type: 'SET_BUS_FX_PATCH', busId, slotId, fxPatchId });
  }

  public setBusFXParam(busId: number, slotId: number, paramId: number, value: number) {
    this.sendCommand({ type: 'SET_BUS_FX_PARAM', busId, slotId, paramId, value });
  }

  public setBusMix(busId: number, volume8Bit: number) {
    this.sendCommand({ type: 'SET_BUS_MIX', busId, volume: volume8Bit });
  }

  public setCustomDSPPatch(dspPatchId: GlobalDSPPatch) {
    this.sendCommand({ type: 'SET_GLOBAL_DSP_PATCH', dspPatchId });
  }

  public setDSPParam(paramId: number, value: number) {
    this.sendCommand({ type: 'SET_DSP_PARAM', paramId, value });
  }

  public setCustomParam(voice: number, paramId: number, value: number) {
    this.sendCommand({ type: 'SET_CUSTOM_PARAM', voice, paramId, value });
  }

  public setArpeggio(voice: number, durationMs: number, notesCentiHz: number[]) {
    this.sendCommand({ type: 'SET_ARPEGGIO', voice, durationMs, notes: notesCentiHz });
  }

  public detachArpeggio(voice: number) {
    this.sendCommand({ type: 'DETACH_ARPEGGIO', voice });
  }

  public stopAllVoices() {
    this.activeNoteVoices.clear();
    this.sendCommand({ type: 'STOP_ALL' });
  }

  public setPolyphonyCount(count: number) {
    this.polyphonyVoices = Math.max(1, Math.min(16, count));
  }
}
