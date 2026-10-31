/**
 * esp32synth-worklet.js
 * ESP32Synth AudioWorkletProcessor
 * Pure WebAssembly fixed-point DSP runner calling process_audio_block
 * 1:1 Mirror of Danilo Gabriel's ESP32Synth
 */

class ESP32SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmInstance = null;
    this.exports = null;
    this.isReady = false;
    this.sampleRate = 48000;
    this.telemetryCounter = 0;

    // Linear memory pointers for 128-frame audio quantum
    this.leftBufferPtr = 0;
    this.rightBufferPtr = 0;
    this.scratchNotesPtr = 0;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(msg) {
    if (msg.type === 'INIT_WASM') {
      try {
        const module = new WebAssembly.Module(msg.wasmBytes);
        this.wasmInstance = new WebAssembly.Instance(module, {});
        this.exports = this.wasmInstance.exports;
        this.sampleRate = msg.sampleRate || 48000;
        
        // Initialize ESP32Synth C++ engine
        if (typeof this.exports.synth_init === 'function') {
          this.exports.synth_init(this.sampleRate);
        }

        // Allocate audio output float buffers (128 frames each = 512 bytes)
        const numFrames = 128;
        if (typeof this.exports.synth_alloc_float_buffer === 'function') {
          this.leftBufferPtr = this.exports.synth_alloc_float_buffer(numFrames);
          this.rightBufferPtr = this.exports.synth_alloc_float_buffer(numFrames);
          this.scratchNotesPtr = this.exports.synth_alloc_float_buffer(32);
        } else if (typeof this.exports.malloc === 'function') {
          this.leftBufferPtr = this.exports.malloc(numFrames * 4);
          this.rightBufferPtr = this.exports.malloc(numFrames * 4);
          this.scratchNotesPtr = this.exports.malloc(32 * 4);
        }

        if (typeof this.exports.synth_setMasterVolume === 'function') {
          this.exports.synth_setMasterVolume(msg.masterVolume !== undefined ? msg.masterVolume : 200);
        }

        this.isReady = true;

        this.port.postMessage({
          type: 'WASM_READY',
          sampleRate: this.exports.synth_getSampleRate ? this.exports.synth_getSampleRate() : this.sampleRate,
          masterVolume: this.exports.synth_getMasterVolume ? this.exports.synth_getMasterVolume() : 200,
        });
      } catch (err) {
        this.port.postMessage({ type: 'ERROR', error: String(err) });
      }
      return;
    }

    if (!this.isReady || !this.exports) return;

    const e = this.exports;
    switch (msg.type) {
      case 'NOTE_ON':
        e.synth_noteOn(msg.voice, msg.freqCentiHz, msg.volume);
        break;
      case 'NOTE_OFF':
        e.synth_noteOff(msg.voice);
        break;
      case 'SET_FREQ':
        e.synth_setFrequency(msg.voice, msg.freqCentiHz);
        break;
      case 'SET_VOL':
        e.synth_setVolume(msg.voice, msg.volume);
        break;
      case 'SET_WAVE':
        e.synth_setWave(msg.voice, msg.waveType);
        break;
      case 'SET_PATCH':
        e.synth_setCustomWavePatch(msg.voice, msg.patchId);
        break;
      case 'SET_PW_BITS':
        e.synth_setPulseWidthBitDepth(msg.bits);
        break;
      case 'SET_PW':
        e.synth_setPulseWidth(msg.voice, msg.width);
        break;
      case 'SET_ENV':
        e.synth_setEnv(msg.voice, msg.attack, msg.decay, msg.sustain, msg.release);
        break;
      case 'SET_SMOOTH_ENV':
        e.synth_setSmoothEnv(msg.voice, msg.enable ? 1 : 0);
        break;
      case 'SET_START_PHASE':
        e.synth_setStartPhase(msg.voice, msg.degrees);
        break;
      case 'SET_CURRENT_PHASE':
        e.synth_setCurrentPhase(msg.voice, msg.degrees);
        break;
      case 'SET_VIBRATO':
        e.synth_setVibrato(msg.voice, msg.rateCentiHz, msg.depthCentiHz);
        break;
      case 'SET_VIBRATO_PHASE':
        e.synth_setVibratoPhase(msg.voice, msg.degrees);
        break;
      case 'SET_TREMOLO':
        e.synth_setTremolo(msg.voice, msg.rateCentiHz, msg.depth);
        break;
      case 'SET_TREMOLO_PHASE':
        e.synth_setTremoloPhase(msg.voice, msg.degrees);
        break;
      case 'SLIDE_FREQ':
        e.synth_slideFreq(msg.voice, msg.startFreqCentiHz, msg.endFreqCentiHz, msg.durationMs);
        break;
      case 'SLIDE_FREQ_TO':
        e.synth_slideFreqTo(msg.voice, msg.endFreqCentiHz, msg.durationMs);
        break;
      case 'SLIDE_VOL':
        e.synth_slideVol(msg.voice, msg.startVol, msg.endVol, msg.durationMs);
        break;
      case 'SLIDE_VOL_TO':
        e.synth_slideVolTo(msg.voice, msg.endVol, msg.durationMs);
        break;
      case 'SET_MASTER_VOL':
        e.synth_setMasterVolume(msg.volume);
        break;
      case 'SET_MASTER_BITCRUSH':
        e.synth_setMasterBitcrush(msg.bits);
        break;
      case 'SET_CTRL_RATE':
        e.synth_setControlRateHz(msg.hz);
        break;
      case 'SET_VOICE_BUS':
        e.synth_setVoiceBus(msg.voice, msg.busId);
        break;
      case 'SET_BUS_FX_PATCH':
        e.synth_setBusFXPatch(msg.busId, msg.slotId, msg.fxPatchId);
        break;
      case 'SET_BUS_FX_PARAM':
        e.synth_setBusFXParam(msg.busId, msg.slotId, msg.paramId, msg.value);
        break;
      case 'SET_BUS_MIX':
        e.synth_setBusMix(msg.busId, msg.volume);
        break;
      case 'SET_GLOBAL_DSP_PATCH':
        e.synth_setCustomDSPPatch(msg.dspPatchId);
        break;
      case 'SET_DSP_PARAM':
        e.synth_setDSPParam(msg.paramId, msg.value);
        break;
      case 'SET_CUSTOM_PARAM':
        e.synth_setCustomParam(msg.voice, msg.paramId, msg.value);
        break;
      case 'SET_ARPEGGIO':
        if (Array.isArray(msg.notes) && msg.notes.length > 0 && this.scratchNotesPtr) {
          const notesLen = Math.min(msg.notes.length, 16);
          const u32 = new Uint32Array(e.memory.buffer, this.scratchNotesPtr, notesLen);
          for (let i = 0; i < notesLen; i++) u32[i] = msg.notes[i];
          e.synth_setArpeggio(msg.voice, msg.durationMs, this.scratchNotesPtr, notesLen);
        }
        break;
      case 'DETACH_ARPEGGIO':
        e.synth_detachArpeggio(msg.voice);
        break;
      case 'STOP_ALL':
        for (let v = 0; v < 80; v++) {
          if (e.synth_isVoiceActive && e.synth_isVoiceActive(v)) {
            e.synth_noteOff(v);
          }
        }
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const left = output[0];
    const right = output[1] || left;
    const numFrames = left.length; // usually 128

    if (!this.isReady || !this.exports) {
      left.fill(0);
      if (right !== left) right.fill(0);
      return true;
    }

    const e = this.exports;

    // Use direct C++ block rendering if available:
    if (typeof e.process_audio_block === 'function' && this.leftBufferPtr && this.rightBufferPtr) {
      e.process_audio_block(this.leftBufferPtr, this.rightBufferPtr, numFrames);

      const heapF32 = new Float32Array(e.memory.buffer);
      const lOffset = this.leftBufferPtr >> 2;
      const rOffset = this.rightBufferPtr >> 2;

      let peak = 0;
      for (let i = 0; i < numFrames; i++) {
        const l = heapF32[lOffset + i];
        const r = heapF32[rOffset + i];
        left[i] = l;
        right[i] = r;

        const absL = Math.abs(l);
        if (absL > peak) peak = absL;
      }
      this.emitTelemetry(peak);
    } else {
      // Fallback to synth_renderStereo
      const ptr = e.synth_renderStereo(numFrames);
      const int16Samples = new Int16Array(e.memory.buffer, ptr, numFrames * 2);

      let peak = 0;
      for (let i = 0; i < numFrames; i++) {
        const l = int16Samples[i * 2] / 32768.0;
        const r = int16Samples[i * 2 + 1] / 32768.0;
        left[i] = l;
        right[i] = r;

        const absL = Math.abs(l);
        if (absL > peak) peak = absL;
      }
      this.emitTelemetry(peak);
    }

    return true;
  }

  emitTelemetry(peak) {
    this.telemetryCounter++;
    // Emit telemetry every 6 quanta (~16ms = ~60 FPS update rate)
    if (this.telemetryCounter % 6 === 0) {
      const e = this.exports;
      const activeVoices = [];
      for (let v = 0; v < 16; v++) {
        if (e.synth_isVoiceActive(v)) {
          activeVoices.push({
            voice: v,
            active: true,
            freqCentiHz: e.synth_getFrequencyCentiHz(v),
            env8Bit: e.synth_getEnv8Bit(v),
            output8Bit: e.synth_getOutput8Bit(v),
            envState: e.synth_getEnvState(v),
            waveType: e.synth_getWaveType(v),
          });
        }
      }

      this.port.postMessage({
        type: 'TELEMETRY',
        activeVoices,
        cpuLoad: e.synth_getCPULoad ? e.synth_getCPULoad() : 0,
        peak,
        masterVol: e.synth_getMasterVolume ? e.synth_getMasterVolume() : 200,
      });
    }
  }
}

registerProcessor('esp32synth-processor', ESP32SynthProcessor);
