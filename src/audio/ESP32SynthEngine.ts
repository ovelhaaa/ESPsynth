/**
 * ESP32SynthEngine - Web Audio API & AudioWorklet interface to ESP32Synth WebAssembly
 * Respects original units: 8-bit (0-255) for volume/PW/wet, CentiHz (1Hz = 100cHz) for frequencies.
 * Includes complete MIDI Pitch Bend & Mod Wheel tracking, optimized telemetry decoding, and 48kHz PCM WAV export.
 */

import { WaveType, EnvState, CustomWavePatch, BusFXPatch, GlobalDSPPatch, VoiceTelemetry, EngineTelemetry } from './types';
import { WASM_BASE64 } from './wasm_binary';
import { WORKLET_CODE } from './worklet_source';
import { encodeWAV, downloadWAVBlob } from './wavExport';

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

interface VoiceSlotInfo {
  voice: number;
  midiNote: number;
  baseFreqCentiHz: number;
  volume: number;
  vibratoRateCentiHz: number;
  vibratoDepthCentiHz: number;
}

export class ESP32SynthEngine {
  private static instance: ESP32SynthEngine | null = null;
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private fallbackInstance: WebAssembly.Instance | null = null;
  private fallbackScratchNotesPtr: number = 0;
  private isInitialized = false;
  private isWorkletRunning = false;
  private telemetryCallbacks: Set<(t: EngineTelemetry) => void> = new Set();
  
  // Voice allocation & MIDI modulation tracking
  private polyphonyVoices = 8;
  private activeNoteVoices: Map<number, number> = new Map(); // midiNote -> voice index
  private voiceSlots: Map<number, VoiceSlotInfo> = new Map();  // voice index -> details
  private nextVoiceIdx = 0;

  // Real-time MIDI Parameters
  private currentPitchBendNorm: number = 0; // -1.0 to +1.0
  private pitchBendRangeSemitones: number = 2; // +/- 2 semitones default
  private currentModWheelValue: number = 0; // 0 to 127
  private defaultVibratoRateCentiHz: number = 500;
  private defaultVibratoDepthCentiHz: number = 0;

  // Analyser node for oscilloscope and spectrum visualization
  private analyser: AnalyserNode | null = null;

  // Real-time 48kHz WAV PCM Recording
  private isRecording: boolean = false;
  private recordingNode: ScriptProcessorNode | null = null;
  private recordingSilentGain: GainNode | null = null;
  private recordedBuffersL: Float32Array[] = [];
  private recordedBuffersR: Float32Array[] = [];
  private totalRecordedFrames: number = 0;
  private recordingStartTime: number = 0;
  private recordingTimerId: number | null = null;
  private recordingListeners: Set<(isRec: boolean, durationMs: number) => void> = new Set();
  private lastRecordedBlob: Blob | null = null;

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
          } catch {
            // Fallback to static path if Blob URL was blocked
            await this.audioCtx.audioWorklet.addModule('/esp32synth-worklet.js');
          }

          this.workletNode = new AudioWorkletNode(this.audioCtx, 'esp32synth-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
          });

          this.workletNode.port.onmessage = (e) => {
            if (e.data.type === 'TELEMETRY_PACKED') {
              // High-speed decoding of flat Int32 packed telemetry
              const packed = e.data.packedData as number[];
              const count = e.data.count || 0;
              const activeVoices: VoiceTelemetry[] = [];
              for (let i = 0; i < count; i++) {
                const base = i * 6;
                activeVoices.push({
                  voice: packed[base],
                  active: true,
                  freqCentiHz: packed[base + 1],
                  env8Bit: packed[base + 2],
                  output8Bit: packed[base + 3],
                  envState: packed[base + 4] as EnvState,
                  waveType: packed[base + 5] as WaveType,
                });
              }

              const telemetry: EngineTelemetry = {
                activeVoices,
                cpuLoad: e.data.cpuLoad,
                peak: e.data.peak,
                masterVol: e.data.masterVol,
              };
              this.telemetryCallbacks.forEach(cb => cb(telemetry));
            } else if (e.data.type === 'TELEMETRY') {
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

        if (typeof exp.synth_alloc_float_buffer === 'function') {
          this.fallbackScratchNotesPtr = exp.synth_alloc_float_buffer(32);
        } else if (typeof exp.malloc === 'function') {
          this.fallbackScratchNotesPtr = exp.malloc(32 * 4);
        }

        let cachedMemBuffer: ArrayBuffer | null = null;
        let cachedHeapI16: Int16Array | null = null;
        let fallbackTelemetryCounter = 0;

        this.scriptNode = this.audioCtx.createScriptProcessor(512, 0, 2);
        this.scriptNode.onaudioprocess = (audioEvent) => {
          const outL = audioEvent.outputBuffer.getChannelData(0);
          const outR = audioEvent.outputBuffer.getChannelData(1);
          const numFrames = outL.length;
          
          if (cachedMemBuffer !== exp.memory.buffer) {
            cachedMemBuffer = exp.memory.buffer;
            cachedHeapI16 = new Int16Array(cachedMemBuffer!);
          }

          const ptr = exp.synth_renderStereo(numFrames);
          const mem = cachedHeapI16!;
          const offset = ptr >> 1;

          let peak = 0;
          for (let i = 0; i < numFrames; i++) {
            const l = mem[offset + i * 2] / 32768.0;
            const r = mem[offset + i * 2 + 1] / 32768.0;
            outL[i] = l;
            outR[i] = r;
            const a = Math.abs(l);
            if (a > peak) peak = a;
          }

          // Telemetry decimation
          fallbackTelemetryCounter++;
          if (fallbackTelemetryCounter % 8 === 0) {
            const activeVoices: VoiceTelemetry[] = [];
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
          }
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

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
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
        case 'SET_ARPEGGIO':
          if (Array.isArray(msg.notes) && msg.notes.length > 0 && this.fallbackScratchNotesPtr) {
            const notesLen = Math.min(msg.notes.length, 16);
            const u32 = new Uint32Array(exp.memory.buffer, this.fallbackScratchNotesPtr, notesLen);
            for (let i = 0; i < notesLen; i++) u32[i] = msg.notes[i];
            exp.synth_setArpeggio(msg.voice, msg.durationMs, this.fallbackScratchNotesPtr, notesLen);
          }
          break;
        case 'DETACH_ARPEGGIO':
          exp.synth_detachArpeggio(msg.voice);
          break;
        case 'STOP_ALL':
          for (let v = 0; v < 80; v++) {
            if (exp.synth_isVoiceActive(v)) exp.synth_noteOff(v);
          }
          break;
      }
    }
  }

  // --- MIDI Modulation & Pitch Bend Calculations ---
  public calculateBentFrequency(baseFreqCentiHz: number, bendNorm: number, rangeSemitones = this.pitchBendRangeSemitones): number {
    if (Math.abs(bendNorm) < 0.0001) return baseFreqCentiHz;
    const semitones = bendNorm * rangeSemitones;
    return Math.round(baseFreqCentiHz * Math.pow(2, semitones / 12));
  }

  /**
   * Applies smooth Pitch Bend in CentiHz to all active polyphonic voices in real time
   * @param normalized Pitch bend between -1.0 and +1.0
   * @param rangeSemitones Bend range in semitones (default +/- 2 semitones)
   */
  public setPitchBend(normalized: number, rangeSemitones: number = 2) {
    this.pitchBendRangeSemitones = rangeSemitones;
    this.currentPitchBendNorm = Math.max(-1, Math.min(1, normalized));

    for (const [voice, slot] of this.voiceSlots.entries()) {
      const bentFreq = this.calculateBentFrequency(slot.baseFreqCentiHz, this.currentPitchBendNorm);
      this.sendCommand({
        type: 'SET_FREQ',
        voice,
        freqCentiHz: bentFreq,
      });
    }
  }

  public getPitchBend(): number {
    return this.currentPitchBendNorm;
  }

  /**
   * Applies Modulation Wheel (CC #1) dynamically controlling Vibrato Depth (setVibrato) on all active voices
   * @param value7Bit Modulation value 0 to 127
   */
  public setModulationWheel(value7Bit: number) {
    this.currentModWheelValue = Math.max(0, Math.min(127, value7Bit));
    // Maps 0..127 to 0..400 CentiHz vibrato depth
    const depthCentiHz = Math.round((this.currentModWheelValue / 127) * 400);

    for (const [voice, slot] of this.voiceSlots.entries()) {
      slot.vibratoDepthCentiHz = depthCentiHz;
      this.sendCommand({
        type: 'SET_VIBRATO',
        voice,
        rateCentiHz: slot.vibratoRateCentiHz || this.defaultVibratoRateCentiHz,
        depthCentiHz,
      });
    }
  }

  public getModulationWheel(): number {
    return this.currentModWheelValue;
  }

  public setDefaultVibrato(rateCentiHz: number, depthCentiHz: number) {
    this.defaultVibratoRateCentiHz = rateCentiHz;
    this.defaultVibratoDepthCentiHz = depthCentiHz;
  }

  // --- Polyphonic Note Triggering ---
  public playMidiNote(midiNote: number, freqCentiHz: number, volume8Bit: number = 255): number {
    const voice = this.nextVoiceIdx;
    this.nextVoiceIdx = (this.nextVoiceIdx + 1) % this.polyphonyVoices;
    this.activeNoteVoices.set(midiNote, voice);

    // Apply real-time pitch bend offset immediately
    const effectiveFreq = this.calculateBentFrequency(freqCentiHz, this.currentPitchBendNorm);
    const effectiveVibratoDepth = this.currentModWheelValue > 0
      ? Math.round((this.currentModWheelValue / 127) * 400)
      : this.defaultVibratoDepthCentiHz;

    this.voiceSlots.set(voice, {
      voice,
      midiNote,
      baseFreqCentiHz: freqCentiHz,
      volume: volume8Bit,
      vibratoRateCentiHz: this.defaultVibratoRateCentiHz,
      vibratoDepthCentiHz: effectiveVibratoDepth,
    });

    this.sendCommand({
      type: 'NOTE_ON',
      voice,
      freqCentiHz: effectiveFreq,
      volume: volume8Bit,
    });

    if (effectiveVibratoDepth > 0) {
      this.sendCommand({
        type: 'SET_VIBRATO',
        voice,
        rateCentiHz: this.defaultVibratoRateCentiHz,
        depthCentiHz: effectiveVibratoDepth,
      });
    }

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
      this.voiceSlots.delete(voice);
    }
  }

  // --- Direct 1:1 Voice API ---
  public noteOn(voice: number, freqCentiHz: number, volume8Bit: number) {
    const effectiveFreq = this.calculateBentFrequency(freqCentiHz, this.currentPitchBendNorm);
    this.voiceSlots.set(voice, {
      voice,
      midiNote: 0,
      baseFreqCentiHz: freqCentiHz,
      volume: volume8Bit,
      vibratoRateCentiHz: this.defaultVibratoRateCentiHz,
      vibratoDepthCentiHz: this.defaultVibratoDepthCentiHz,
    });
    this.sendCommand({ type: 'NOTE_ON', voice, freqCentiHz: effectiveFreq, volume: volume8Bit });
  }

  public noteOff(voice: number) {
    this.voiceSlots.delete(voice);
    this.sendCommand({ type: 'NOTE_OFF', voice });
  }

  public setFrequency(voice: number, freqCentiHz: number) {
    const slot = this.voiceSlots.get(voice);
    if (slot) slot.baseFreqCentiHz = freqCentiHz;
    const effectiveFreq = this.calculateBentFrequency(freqCentiHz, this.currentPitchBendNorm);
    this.sendCommand({ type: 'SET_FREQ', voice, freqCentiHz: effectiveFreq });
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
    this.defaultVibratoRateCentiHz = rateCentiHz;
    this.defaultVibratoDepthCentiHz = depthCentiHz;
    const slot = this.voiceSlots.get(voice);
    if (slot) {
      slot.vibratoRateCentiHz = rateCentiHz;
      slot.vibratoDepthCentiHz = depthCentiHz;
    }
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
    this.voiceSlots.clear();
    this.sendCommand({ type: 'STOP_ALL' });
  }

  public setPolyphonyCount(count: number) {
    this.polyphonyVoices = Math.max(1, Math.min(16, count));
  }

  // --- Real-Time 48kHz Stereo WAV Audio Recording ---
  public startRecording(): boolean {
    if (this.isRecording || !this.audioCtx) return false;

    const sourceNode = this.workletNode || this.scriptNode;
    if (!sourceNode) return false;

    this.recordedBuffersL = [];
    this.recordedBuffersR = [];
    this.totalRecordedFrames = 0;
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    // Tap synthesizer PCM audio using ScriptProcessor
    this.recordingNode = this.audioCtx.createScriptProcessor(4096, 2, 2);
    this.recordingNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const ch0 = e.inputBuffer.getChannelData(0);
      const ch1 = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : ch0;

      this.recordedBuffersL.push(new Float32Array(ch0));
      this.recordedBuffersR.push(new Float32Array(ch1));
      this.totalRecordedFrames += ch0.length;
    };

    // Parallel connection to prevent any audio path interruption
    sourceNode.connect(this.recordingNode);
    this.recordingSilentGain = this.audioCtx.createGain();
    this.recordingSilentGain.gain.value = 0;
    this.recordingNode.connect(this.recordingSilentGain);
    this.recordingSilentGain.connect(this.audioCtx.destination);

    if (this.recordingTimerId !== null) window.clearInterval(this.recordingTimerId);
    this.recordingTimerId = window.setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      this.recordingListeners.forEach(cb => cb(true, elapsed));
    }, 200);

    this.recordingListeners.forEach(cb => cb(true, 0));
    return true;
  }

  public stopRecording(): Blob | null {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.recordingTimerId !== null) {
      window.clearInterval(this.recordingTimerId);
      this.recordingTimerId = null;
    }

    if (this.recordingNode) {
      try {
        this.recordingNode.disconnect();
      } catch {}
      this.recordingNode = null;
    }

    if (this.recordingSilentGain) {
      try {
        this.recordingSilentGain.disconnect();
      } catch {}
      this.recordingSilentGain = null;
    }

    if (this.totalRecordedFrames === 0) {
      this.recordingListeners.forEach(cb => cb(false, 0));
      return null;
    }

    // Concatenate chunks
    const mergedL = new Float32Array(this.totalRecordedFrames);
    const mergedR = new Float32Array(this.totalRecordedFrames);
    let offset = 0;
    for (let i = 0; i < this.recordedBuffersL.length; i++) {
      mergedL.set(this.recordedBuffersL[i], offset);
      mergedR.set(this.recordedBuffersR[i], offset);
      offset += this.recordedBuffersL[i].length;
    }

    const sampleRate = this.audioCtx?.sampleRate || 48000;
    const wavBlob = encodeWAV(mergedL, mergedR, sampleRate);
    this.lastRecordedBlob = wavBlob;

    this.recordedBuffersL = [];
    this.recordedBuffersR = [];
    this.totalRecordedFrames = 0;

    this.recordingListeners.forEach(cb => cb(false, 0));
    return wavBlob;
  }

  public isRecordingAudio(): boolean {
    return this.isRecording;
  }

  public getLastRecordedBlob(): Blob | null {
    return this.lastRecordedBlob;
  }

  public downloadWAV(blob?: Blob, filename?: string) {
    const target = blob || this.lastRecordedBlob;
    if (target) {
      downloadWAVBlob(target, filename);
    }
  }

  public subscribeRecording(callback: (isRec: boolean, durationMs: number) => void): () => void {
    this.recordingListeners.add(callback);
    return () => this.recordingListeners.delete(callback);
  }
}
