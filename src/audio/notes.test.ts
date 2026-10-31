import test from 'node:test';
import assert from 'node:assert/strict';
import { midiToCentiHz, centiHzToHz, centiHzToNoteName, transposeCentiHz, NOTES } from './notes';

test('CentiHz conversions accurately mirror ESP32SynthNotes.h', () => {
  // A4 should be 440.00 Hz = 44000 CentiHz
  assert.equal(midiToCentiHz(69), 44000);
  assert.equal(NOTES.A4, 44000);

  // C4 should be ~261.63 Hz = 26163 CentiHz
  assert.equal(NOTES.C4, 26163);
  assert.equal(Math.abs(midiToCentiHz(60) - 26163) <= 1, true);

  // C3, C5
  assert.equal(NOTES.C3, 13081);
  assert.equal(NOTES.C5, 52325);
});

test('centiHzToHz converts accurately', () => {
  assert.equal(centiHzToHz(44000), 440);
  assert.equal(centiHzToHz(26163), 261.63);
});

test('centiHzToNoteName returns proper pitch label', () => {
  assert.equal(centiHzToNoteName(44000), 'A4');
  assert.equal(centiHzToNoteName(26163), 'C4');
  assert.equal(centiHzToNoteName(52325), 'C5');
});

test('transposeCentiHz calculates exact musical intervals', () => {
  // +12 semitones is exactly double frequency (1 octave up)
  const a4 = 44000;
  const a5 = transposeCentiHz(a4, 12);
  assert.equal(a5, 88000);

  // -12 semitones is half frequency (1 octave down)
  const a3 = transposeCentiHz(a4, -12);
  assert.equal(a3, 22000);

  // 0 semitones preserves frequency
  assert.equal(transposeCentiHz(a4, 0), 44000);

  // Major triad intervals from C3 (13081 cHz)
  const root = NOTES.C3;
  const third = transposeCentiHz(root, 4);  // E3
  const fifth = transposeCentiHz(root, 7);  // G3
  const octave = transposeCentiHz(root, 12); // C4

  assert.equal(centiHzToNoteName(root), 'C3');
  assert.equal(centiHzToNoteName(third), 'E3');
  assert.equal(centiHzToNoteName(fifth), 'G3');
  assert.equal(centiHzToNoteName(octave), 'C4');
});
