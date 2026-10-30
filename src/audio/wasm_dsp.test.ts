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

