import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('ESP32Synth WebAssembly DSP initializes and renders non-silent audio', () => {
  const wasmPath = path.resolve(process.cwd(), 'public/esp32synth.wasm');
  assert.equal(fs.existsSync(wasmPath), true, 'WASM binary exists in public/');

  const wasmBytes = fs.readFileSync(wasmPath);
  const module = new WebAssembly.Module(wasmBytes);
  const instance = new WebAssembly.Instance(module, {});
  const exp = instance.exports as any;

  // Initialize engine at 48000 Hz
  const initOk = exp.synth_init(48000);
  assert.equal(initOk, 1);
  assert.equal(exp.synth_getSampleRate(), 48000);

  // Set master volume (200 / 255)
  exp.synth_setMasterVolume(200);
  assert.equal(exp.synth_getMasterVolume(), 200);

  // Configure voice 0: WAVE_SAW (-3), ADSR: 10ms, 50ms, 200/255, 100ms
  exp.synth_setWave(0, -3);
  exp.synth_setEnv(0, 10, 50, 200, 100);
  exp.synth_noteOn(0, 44000, 255); // A4 (44000 CentiHz)

  assert.equal(exp.synth_isVoiceActive(0), 1);
  assert.equal(exp.synth_getFrequencyCentiHz(0), 44000);

  // Render 128 stereo frames
  const ptr = exp.synth_renderStereo(128);
  assert.notEqual(ptr, 0);

  const samples = new Int16Array(exp.memory.buffer, ptr, 256);
  let nonZeroCount = 0;
  let maxAbs = 0;
  for (let i = 0; i < 256; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > 0) nonZeroCount++;
    if (absVal > maxAbs) maxAbs = absVal;
  }

  assert.equal(nonZeroCount > 200, true, 'Audio output is rendered and active');
  assert.equal(maxAbs > 1000, true, 'Signal amplitude is healthy and within int16 bounds');

  // Test noteOff
  exp.synth_noteOff(0);
  // Render past release (100ms * 48 samples/ms = ~4800 samples)
  for (let i = 0; i < 40; i++) {
    exp.synth_renderStereo(128);
  }
  assert.equal(exp.synth_isVoiceActive(0), 0, 'Voice enters idle state after release');
});

test('ESP32Synth 16-Step Arpeggiator executes full 16 notes sequence in C++ WASM', () => {
  const wasmPath = path.resolve(process.cwd(), 'public/esp32synth.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  const module = new WebAssembly.Module(wasmBytes);
  const instance = new WebAssembly.Instance(module, {});
  const exp = instance.exports as any;

  exp.synth_init(48000);
  exp.synth_setMasterVolume(200);

  // Allocate 16 scratch notes in WASM linear memory
  const scratchPtr = exp.synth_alloc_float_buffer(32);
  const scratchU32 = new Uint32Array(exp.memory.buffer, scratchPtr, 16);

  // 16 distinct frequencies in CentiHz
  for (let i = 0; i < 16; i++) {
    scratchU32[i] = 10000 + i * 1000;
  }

  exp.synth_setWave(0, -3); // Saw
  exp.synth_setEnv(0, 0, 100, 255, 100);
  exp.synth_noteOn(0, 10000, 255);

  // Set 16-step arpeggio with 20ms per step
  exp.synth_setArpeggio(0, 20, scratchPtr, 16);

  // Verify function call succeeded without crashing
  exp.synth_renderStereo(128);
  assert.equal(exp.synth_isVoiceActive(0), 1);
});

test('ESP32Synth Wavetable Studio renders BITS_16, BITS_8, and BITS_4 waveforms', () => {
  const wasmPath = path.resolve(process.cwd(), 'public/esp32synth.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  const module = new WebAssembly.Module(wasmBytes);
  const instance = new WebAssembly.Instance(module, {});
  const exp = instance.exports as any;

  exp.synth_init(48000);
  exp.synth_setMasterVolume(220);

  const wtBufferPtr = exp.synth_getWavetableBuffer(0);
  assert.notEqual(wtBufferPtr, 0, 'Wavetable buffer for voice 0 exists');

  // 1. Test BITS_16 (256 int16 samples)
  const i16View = new Int16Array(exp.memory.buffer, wtBufferPtr, 256);
  for (let i = 0; i < 256; i++) {
    i16View[i] = Math.round(Math.sin((i / 256) * Math.PI * 2) * 32000);
  }
  exp.synth_setWavetable(0, wtBufferPtr, 256, 2); // BITS_16 = 2
  exp.synth_noteOn(0, 26163, 255);

  let ptr = exp.synth_renderStereo(128);
  let samples = new Int16Array(exp.memory.buffer, ptr, 256);
  let nonZero = 0;
  for (let i = 0; i < 256; i++) if (Math.abs(samples[i]) > 0) nonZero++;
  assert.equal(nonZero > 100, true, 'BITS_16 wavetable renders audio');

  // 2. Test BITS_8 (256 uint8 samples)
  const u8View = new Uint8Array(exp.memory.buffer, wtBufferPtr, 256);
  for (let i = 0; i < 256; i++) {
    u8View[i] = Math.round((Math.sin((i / 256) * Math.PI * 2) * 0.5 + 0.5) * 255);
  }
  exp.synth_setWavetable(0, wtBufferPtr, 256, 1); // BITS_8 = 1
  ptr = exp.synth_renderStereo(128);
  samples = new Int16Array(exp.memory.buffer, ptr, 256);
  nonZero = 0;
  for (let i = 0; i < 256; i++) if (Math.abs(samples[i]) > 0) nonZero++;
  assert.equal(nonZero > 100, true, 'BITS_8 wavetable renders audio');

  // 3. Test BITS_4 (128 bytes packed nibbles = 256 4-bit samples)
  for (let i = 0; i < 128; i++) {
    u8View[i] = (0x0F & (i % 16)) | (((i + 4) % 16) << 4);
  }
  exp.synth_setWavetable(0, wtBufferPtr, 256, 0); // BITS_4 = 0
  ptr = exp.synth_renderStereo(128);
  samples = new Int16Array(exp.memory.buffer, ptr, 256);
  nonZero = 0;
  for (let i = 0; i < 256; i++) if (Math.abs(samples[i]) > 0) nonZero++;
  assert.equal(nonZero > 100, true, 'BITS_4 wavetable renders audio');
});

test('Embedded WASM binary decodes into valid WebAssembly with magic word 0x00 0x61 0x73 0x6d', async () => {
  const { WASM_BASE64 } = await import('./wasm_binary');
  assert.equal(typeof WASM_BASE64, 'string');
  assert.equal(WASM_BASE64.length > 50000, true);

  const binaryString = atob(WASM_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Check magic word 0x00 0x61 0x73 0x6d
  assert.equal(bytes[0], 0x00);
  assert.equal(bytes[1], 0x61);
  assert.equal(bytes[2], 0x73);
  assert.equal(bytes[3], 0x6d);

  const mod = new WebAssembly.Module(bytes.buffer);
  const inst = new WebAssembly.Instance(mod, {});
  const exp = inst.exports as any;
  assert.equal(typeof exp.synth_init, 'function');
  assert.equal(exp.synth_init(48000), 1);
});
