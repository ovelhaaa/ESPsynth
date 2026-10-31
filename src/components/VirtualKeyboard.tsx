import React, { useState, useEffect, useCallback } from 'react';
import { midiToCentiHz, NOTE_NAMES } from '../audio/notes';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';

interface VirtualKeyboardProps {
  onNoteOn: (midiNote: number, freqCentiHz: number) => void;
  onNoteOff: (midiNote: number) => void;
  activeVoicesMidiNotes?: number[];
  midiConnectedDevice?: string | null;
}

// Computer keyboard mapping
const KEY_MAP: Record<string, number> = {
  a: 0,  // C
  w: 1,  // C#
  s: 2,  // D
  e: 3,  // D#
  d: 4,  // E
  f: 5,  // F
  t: 6,  // F#
  g: 7,  // G
  y: 8,  // G#
  h: 9,  // A
  u: 10, // A#
  j: 11, // B
  k: 12, // C+1
  o: 13, // C#+1
  l: 14, // D+1
  p: 15, // D#+1
  ';': 16, // E+1
};

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  onNoteOn,
  onNoteOff,
  activeVoicesMidiNotes = [],
  midiConnectedDevice,
}) => {
  const [baseOctave, setBaseOctave] = useState<number>(4);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(new Set());

  // Trigger note on
  const handleNoteDown = useCallback((midiNote: number) => {
    setPressedNotes((prev) => {
      const next = new Set(prev);
      next.add(midiNote);
      return next;
    });
    const cHz = midiToCentiHz(midiNote);
    onNoteOn(midiNote, cHz);
  }, [onNoteOn]);

  // Trigger note off
  const handleNoteUp = useCallback((midiNote: number) => {
    setPressedNotes((prev) => {
      const next = new Set(prev);
      next.delete(midiNote);
      return next;
    });
    onNoteOff(midiNote);
  }, [onNoteOff]);

  // Keyboard events listener
  useEffect(() => {
    const activeKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key in KEY_MAP && !activeKeys.has(key)) {
        activeKeys.add(key);
        const offset = KEY_MAP[key];
        const midi = (baseOctave + 1) * 12 + offset;
        handleNoteDown(midi);
      } else if (key === 'z') {
        setBaseOctave((o) => Math.max(1, o - 1));
      } else if (key === 'x') {
        setBaseOctave((o) => Math.min(7, o + 1));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in KEY_MAP) {
        activeKeys.delete(key);
        const offset = KEY_MAP[key];
        const midi = (baseOctave + 1) * 12 + offset;
        handleNoteUp(midi);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [baseOctave, handleNoteDown, handleNoteUp]);

  // Generate 25 keys (2 octaves + 1 note)
  const startMidi = (baseOctave + 1) * 12; // Octave C
  const totalKeys = 25;
  const keys = Array.from({ length: totalKeys }, (_, i) => {
    const midi = startMidi + i;
    const noteInOct = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(noteInOct);
    const noteName = NOTE_NAMES[noteInOct];
    const octave = Math.floor(midi / 12) - 1;
    const centiHz = midiToCentiHz(midi);
    return { midi, isBlack, noteName, octave, centiHz };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
      {/* Octave Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
            Virtual Keyboard (CentiHz Pitch Trigger)
          </h2>
          {midiConnectedDevice && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              MIDI: {midiConnectedDevice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Octave:</span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setBaseOctave((o) => Math.max(1, o - 1))}
              disabled={baseOctave <= 1}
              className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              aria-label="Octave Down"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono font-bold text-emerald-400">
              C{baseOctave} &ndash; C{baseOctave + 2}
            </span>
            <button
              onClick={() => setBaseOctave((o) => Math.min(6, o + 1))}
              disabled={baseOctave >= 6}
              className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              aria-label="Octave Up"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            (Keys: A-K, Z/X to shift)
          </span>
        </div>
      </div>

      {/* Keyboard Bed */}
      <div className="relative h-44 bg-slate-950 rounded-lg border border-slate-800 p-2 overflow-hidden shadow-inner select-none">
        <div className="relative w-full h-full flex">
          {keys.map((k) => {
            const isPressed = pressedNotes.has(k.midi) || activeVoicesMidiNotes.includes(k.midi);

            if (!k.isBlack) {
              return (
                <button
                  key={k.midi}
                  onMouseDown={() => handleNoteDown(k.midi)}
                  onMouseUp={() => handleNoteUp(k.midi)}
                  onMouseLeave={() => {
                    if (pressedNotes.has(k.midi)) handleNoteUp(k.midi);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleNoteDown(k.midi);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNoteUp(k.midi);
                  }}
                  className={`flex-1 h-full rounded-b-md border transition-colors cursor-pointer flex flex-col justify-end items-center pb-2 relative z-0 ${
                    isPressed
                      ? 'bg-emerald-400 border-emerald-300 text-slate-950 font-bold shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                  aria-label={`${k.noteName}${k.octave} (${k.centiHz} cHz)`}
                >
                  <span className="text-[11px] font-bold font-mono leading-none">
                    {k.noteName}{k.octave}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 mt-0.5 leading-none">
                    {k.centiHz}
                  </span>
                </button>
              );
            } else {
              return (
                <button
                  key={k.midi}
                  onMouseDown={() => handleNoteDown(k.midi)}
                  onMouseUp={() => handleNoteUp(k.midi)}
                  onMouseLeave={() => {
                    if (pressedNotes.has(k.midi)) handleNoteUp(k.midi);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleNoteDown(k.midi);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNoteUp(k.midi);
                  }}
                  className={`w-[4.2%] h-[60%] rounded-b-md border transition-colors cursor-pointer flex flex-col justify-end items-center pb-1.5 absolute z-10 ${
                    isPressed
                      ? 'bg-emerald-500 border-emerald-400 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.9)]'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  style={{
                    left: `${getBlackKeyOffsetPercentage(k.midi, startMidi)}%`,
                  }}
                  aria-label={`${k.noteName}${k.octave} (${k.centiHz} cHz)`}
                >
                  <span className="text-[9px] font-mono font-bold leading-none">
                    {k.noteName}
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400/80 leading-none">
                    {k.centiHz}
                  </span>
                </button>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
};

// Helper for aligning black keys on top of white keys
function getBlackKeyOffsetPercentage(midi: number, startMidi: number): number {
  let whiteCountBefore = 0;
  for (let m = startMidi; m < midi; m++) {
    const isBlack = [1, 3, 6, 8, 10].includes(m % 12);
    if (!isBlack) whiteCountBefore++;
  }
  const totalWhite = 15;
  const whiteKeyWidthPercent = 100 / totalWhite;
  return (whiteCountBefore * whiteKeyWidthPercent) - (whiteKeyWidthPercent * 0.28);
}
