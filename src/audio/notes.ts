/**
 * Frequencies in CentiHz (1 Hz = 100 CentiHz)
 * Direct 1:1 reproduction of ESP32SynthNotes.h
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiToCentiHz(midiNote: number): number {
  return Math.round(44000 * Math.pow(2, (midiNote - 69) / 12));
}

export function centiHzToHz(centiHz: number): number {
  return centiHz / 100;
}

export function transposeCentiHz(baseCentiHz: number, semitones: number): number {
  return Math.round(baseCentiHz * Math.pow(2, semitones / 12));
}

export function centiHzToNoteName(centiHz: number): string {
  if (centiHz <= 0) return '---';
  const hz = centiHz / 100;
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  if (midi < 0 || midi > 127) return `${hz.toFixed(1)} Hz`;
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Built-in note constants matching ESP32SynthNotes.h
export const NOTES = {
  // Octave 2
  C2: 6541,
  CS2: 6930,
  D2: 7342,
  DS2: 7778,
  E2: 8241,
  F2: 8731,
  FS2: 9250,
  G2: 9800,
  GS2: 10383,
  A2: 11000,
  AS2: 11654,
  B2: 12347,

  // Octave 3
  C3: 13081,
  CS3: 13859,
  D3: 14683,
  DS3: 15556,
  E3: 16481,
  F3: 17461,
  FS3: 18500,
  G3: 19600,
  GS3: 20765,
  A3: 22000,
  AS3: 23308,
  B3: 24694,

  // Octave 4
  C4: 26163,
  CS4: 27718,
  D4: 29366,
  DS4: 31113,
  E4: 32963,
  F4: 34923,
  FS4: 36999,
  G4: 39200,
  GS4: 41530,
  A4: 44000,
  AS4: 46616,
  B4: 49388,

  // Octave 5
  C5: 52325,
  CS5: 55437,
  D5: 58733,
  DS5: 62225,
  E5: 65925,
  F5: 69846,
  FS5: 73999,
  G5: 78399,
  GS5: 83061,
  A5: 88000,
  AS5: 93233,
  B5: 98777,
} as const;
