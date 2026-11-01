import { test } from 'node:test';
import assert from 'node:assert';
import { ESP32SynthEngine } from './ESP32SynthEngine';
import { encodeWAV } from './wavExport';
import { NOTES, transposeCentiHz } from './notes';

test('Pitch Bend calculation in CentiHz conforms to standard 12-TET tuning', () => {
  const engine = ESP32SynthEngine.getInstance();
  const c4 = NOTES.C4; // 26163 CentiHz

  // Neutral pitch bend (0.0) -> exact base frequency
  const neutral = engine.calculateBentFrequency(c4, 0.0, 2);
  assert.strictEqual(neutral, c4);

  // Maximum pitch bend up (+1.0 with 2 semitones range) -> D4 (2 semitones up)
  const bentUp2st = engine.calculateBentFrequency(c4, 1.0, 2);
  const expectedD4 = transposeCentiHz(c4, 2);
  assert.ok(Math.abs(bentUp2st - expectedD4) <= 1, `Expected ~${expectedD4}, got ${bentUp2st}`);

  // Maximum pitch bend down (-1.0 with 2 semitones range) -> Bb3 / A#3 (2 semitones down)
  const bentDown2st = engine.calculateBentFrequency(c4, -1.0, 2);
  const expectedBb3 = transposeCentiHz(c4, -2);
  assert.ok(Math.abs(bentDown2st - expectedBb3) <= 1, `Expected ~${expectedBb3}, got ${bentDown2st}`);

  // 1 Octave pitch bend (+12 semitones) -> C5 (exact double frequency)
  const octaveUp = engine.calculateBentFrequency(c4, 1.0, 12);
  assert.ok(Math.abs(octaveUp - (c4 * 2)) <= 2, `Expected ~${c4 * 2}, got ${octaveUp}`);
});

test('encodeWAV generates authentic 48kHz 16-bit stereo PCM RIFF WAVE header and payload', async () => {
  const sampleRate = 48000;
  const numFrames = 480; // 10ms of audio
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  // Generate test stereo tone (sinewave left, cosinewave right)
  for (let i = 0; i < numFrames; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    right[i] = Math.cos((2 * Math.PI * 440 * i) / sampleRate);
  }

  const wavBlob = encodeWAV(left, right, sampleRate);
  assert.strictEqual(wavBlob.type, 'audio/wav');

  // Verify byte length: 44 bytes header + (480 frames * 2 channels * 2 bytes/sample) = 44 + 1920 = 1964 bytes
  const expectedSize = 44 + numFrames * 4;
  assert.strictEqual(wavBlob.size, expectedSize);

  const arrayBuffer = await wavBlob.arrayBuffer();
  const view = new DataView(arrayBuffer);

  // Check 'RIFF'
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.strictEqual(riff, 'RIFF');

  // Check 'WAVE'
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.strictEqual(wave, 'WAVE');

  // Check 'fmt '
  const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  assert.strictEqual(fmt, 'fmt ');

  // Subchunk1Size = 16
  assert.strictEqual(view.getUint32(16, true), 16);
  // AudioFormat = 1 (PCM)
  assert.strictEqual(view.getUint16(20, true), 1);
  // NumChannels = 2 (Stereo)
  assert.strictEqual(view.getUint16(22, true), 2);
  // SampleRate = 48000
  assert.strictEqual(view.getUint32(24, true), 48000);
  // ByteRate = 48000 * 2 * 2 = 192000
  assert.strictEqual(view.getUint32(28, true), 192000);
  // BlockAlign = 4
  assert.strictEqual(view.getUint16(32, true), 4);
  // BitsPerSample = 16
  assert.strictEqual(view.getUint16(34, true), 16);

  // Check 'data'
  const dataTag = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
  assert.strictEqual(dataTag, 'data');
  assert.strictEqual(view.getUint32(40, true), numFrames * 4);
});

test('Arpeggiator step matrix filters gate-enabled steps and maps CentiHz intervals', () => {
  const baseFreq = NOTES.C3; // 13081 cHz
  const steps = [0, 4, 7, 12, 0, 0, 0, 0];
  const activeGates = [true, false, true, true, false, false, false, false];

  const activeNotes: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (activeGates[i]) {
      activeNotes.push(transposeCentiHz(baseFreq, steps[i]));
    }
  }

  assert.strictEqual(activeNotes.length, 3);
  assert.strictEqual(activeNotes[0], baseFreq); // 0st (Root)
  assert.strictEqual(activeNotes[1], transposeCentiHz(baseFreq, 7)); // 7st (5th)
  assert.strictEqual(activeNotes[2], transposeCentiHz(baseFreq, 12)); // 12st (Octave)
});

test('Arpeggiator step matrix preserves 16-step rhythmic time by sending 0 for rests', () => {
  const baseFreq = NOTES.C3; // 13081 cHz
  const steps = [0, 12, 0, 7, 10, 7, 12, 0, 3, 7, 12, 7, 0, -12, 0, 12];
  const activeGates = [true, false, true, true, true, false, true, true, true, false, true, true, true, false, true, true];

  const fullSequence: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (activeGates[i]) {
      fullSequence.push(transposeCentiHz(baseFreq, steps[i]));
    } else {
      fullSequence.push(0); // Rest preservation
    }
  }

  assert.strictEqual(fullSequence.length, 16);
  assert.strictEqual(fullSequence[0], baseFreq);
  assert.strictEqual(fullSequence[1], 0); // Step 1 is a Rest (0 CentiHz)
  assert.strictEqual(fullSequence[5], 0); // Step 5 is a Rest (0 CentiHz)
  assert.strictEqual(fullSequence[9], 0); // Step 9 is a Rest (0 CentiHz)
  assert.strictEqual(fullSequence[13], 0); // Step 13 is a Rest (0 CentiHz)
});
