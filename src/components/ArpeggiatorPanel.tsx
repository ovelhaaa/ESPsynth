import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, FastForward, Sliders, Music, Zap, Gauge, Sparkles } from 'lucide-react';
import { NOTES, transposeCentiHz, centiHzToNoteName } from '../audio/notes';

export interface ArpConfig {
  enabled: boolean;
  durationMs: number;
  steps: number[]; // semitone offsets from root (e.g. [0, 4, 7, 12])
  stepCount: number; // 2 to 8
  activeSteps: boolean[];
}

interface ArpeggiatorPanelProps {
  arpConfig: ArpConfig;
  onArpChange: (updated: Partial<ArpConfig>) => void;
  portamentoMs: number;
  onPortamentoChange: (ms: number) => void;
  onAuditionArp?: (active: boolean) => void;
  isAuditioning?: boolean;
}

const PRESET_PATTERNS = [
  { name: 'Major Triad', steps: [0, 4, 7, 12], count: 4 },
  { name: 'Minor Triad', steps: [0, 3, 7, 12], count: 4 },
  { name: 'Dominant 7th', steps: [0, 4, 7, 10], count: 4 },
  { name: 'Octave Bass', steps: [0, 12, 0, 12], count: 4 },
  { name: 'Synthwave 5th', steps: [0, 7, 12, 7], count: 4 },
  { name: 'Minor 8-Step Run', steps: [0, 3, 7, 10, 12, 10, 7, 3], count: 8 },
  { name: 'Pentatonic Rise', steps: [0, 3, 5, 7, 10, 12, 15, 12], count: 8 },
  { name: 'Disco Octaves', steps: [0, 12, 24, 12], count: 4 },
];

const SPEED_PRESETS = [
  { label: '1/32 (62ms)', ms: 62 },
  { label: '1/16 (125ms)', ms: 125 },
  { label: '1/8 (250ms)', ms: 250 },
  { label: '1/4 (500ms)', ms: 500 },
];

export const ArpeggiatorPanel: React.FC<ArpeggiatorPanelProps> = ({
  arpConfig,
  onArpChange,
  portamentoMs,
  onPortamentoChange,
  onAuditionArp,
  isAuditioning = false,
}) => {
  const [playheadStep, setPlayheadStep] = useState<number>(0);
  const [isGlidingTest, setIsGlidingTest] = useState<boolean>(false);
  const playheadIntervalRef = useRef<number | null>(null);

  // Synchronize visual playhead animation when arp is active
  useEffect(() => {
    if (arpConfig.enabled || isAuditioning) {
      if (playheadIntervalRef.current !== null) {
        window.clearInterval(playheadIntervalRef.current);
      }
      playheadIntervalRef.current = window.setInterval(() => {
        setPlayheadStep((prev) => (prev + 1) % arpConfig.stepCount);
      }, Math.max(30, arpConfig.durationMs));
    } else {
      if (playheadIntervalRef.current !== null) {
        window.clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
      setPlayheadStep(0);
    }

    return () => {
      if (playheadIntervalRef.current !== null) {
        window.clearInterval(playheadIntervalRef.current);
      }
    };
  }, [arpConfig.enabled, isAuditioning, arpConfig.stepCount, arpConfig.durationMs]);

  const handleStepValueChange = (index: number, val: number) => {
    const nextSteps = [...arpConfig.steps];
    nextSteps[index] = val;
    onArpChange({ steps: nextSteps });
  };

  const handleStepToggle = (index: number) => {
    const nextActive = [...arpConfig.activeSteps];
    nextActive[index] = !nextActive[index];
    onArpChange({ activeSteps: nextActive });
  };

  const handleApplyPreset = (p: typeof PRESET_PATTERNS[0]) => {
    const newSteps = [...p.steps];
    while (newSteps.length < 8) newSteps.push(0);
    const newActive = Array(8).fill(false);
    for (let i = 0; i < p.count; i++) newActive[i] = true;

    onArpChange({
      steps: newSteps,
      stepCount: p.count,
      activeSteps: newActive,
    });
  };

  // Portamento Test Glide routine
  const triggerGlideTest = useCallback(() => {
    setIsGlidingTest(true);
    setTimeout(() => {
      setIsGlidingTest(false);
    }, Math.max(300, portamentoMs + 100));
  }, [portamentoMs]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              Hardware Arpeggiator & Tracker FX
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                synth.setArpeggio
              </span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500 block">
              1:1 C++ Hardware Arp Buffer • Real-Time CentiHz Interval Transposition
            </span>
          </div>
        </div>

        {/* Master Arp Toggle & Audition Button */}
        <div className="flex items-center gap-3">
          {onAuditionArp && (
            <button
              onClick={() => onAuditionArp(!isAuditioning)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer border shadow-sm ${
                isAuditioning
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              {isAuditioning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{isAuditioning ? 'Stop Audition' : 'Audition Arp'}</span>
            </button>
          )}

          <button
            onClick={() => onArpChange({ enabled: !arpConfig.enabled })}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer border shadow-md ${
              arpConfig.enabled
                ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400 text-white shadow-cyan-950/40'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${arpConfig.enabled ? 'bg-white animate-ping' : 'bg-slate-600'}`} />
            <span>{arpConfig.enabled ? 'ARP ACTIVE' : 'ARP BYPASS'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Step Sequencer Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              1. Hardware Step Sequencer ({arpConfig.stepCount} Steps)
            </h3>

            {/* Pattern Presets */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-mono text-slate-500 mr-1">Riffs:</span>
              {PRESET_PATTERNS.slice(0, 4).map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleApplyPreset(p)}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-cyan-300 transition cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            {/* Step Controls Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {Array.from({ length: arpConfig.stepCount }, (_, i) => {
                const semitone = arpConfig.steps[i] ?? 0;
                const isActive = arpConfig.activeSteps[i] ?? true;
                const isCurrent = (arpConfig.enabled || isAuditioning) && playheadStep === i;
                const noteOffsetName = semitone === 0 ? 'Root (0)' : semitone > 0 ? `+${semitone}st` : `${semitone}st`;
                const approxNote = centiHzToNoteName(transposeCentiHz(NOTES.C3, semitone));

                return (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border font-mono flex flex-col justify-between items-center gap-2 transition-all duration-75 relative ${
                      isCurrent
                        ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105 z-10'
                        : isActive
                        ? 'bg-slate-900 border-slate-700/80 text-slate-200'
                        : 'bg-slate-950/60 border-slate-900 text-slate-600 opacity-60'
                    }`}
                  >
                    {/* Step indicator LED */}
                    <div className="flex items-center justify-between w-full text-[10px]">
                      <span className="font-bold text-slate-400">#{i + 1}</span>
                      <button
                        onClick={() => handleStepToggle(i)}
                        className={`w-3.5 h-3.5 rounded-full border transition cursor-pointer ${
                          isActive
                            ? isCurrent
                              ? 'bg-cyan-300 border-white shadow-[0_0_6px_#67e8f9]'
                              : 'bg-cyan-600 border-cyan-400'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                        title={isActive ? 'Disable Step (Rest)' : 'Enable Step'}
                      />
                    </div>

                    {/* Semitone display */}
                    <div className="text-center">
                      <div className={`text-xs font-bold ${isCurrent ? 'text-cyan-200' : 'text-slate-200'}`}>
                        {approxNote}
                      </div>
                      <div className="text-[10px] text-cyan-400/90 font-semibold">{noteOffsetName}</div>
                    </div>

                    {/* Step Semitone Slider (-12 to +24 semitones) */}
                    <div className="w-full flex flex-col items-center">
                      <input
                        type="range"
                        min="-12"
                        max="24"
                        step="1"
                        value={semitone}
                        onChange={(e) => handleStepValueChange(i, Number(e.target.value))}
                        disabled={!isActive}
                        className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                      />
                      <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all"
                          style={{
                            width: `${Math.max(5, Math.min(100, ((semitone + 12) / 36) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pattern Settings & Duration Slider */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Step Speed (durationMs)</span>
                  <span className="text-cyan-300 font-bold">{arpConfig.durationMs} ms</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="500"
                  step="5"
                  value={arpConfig.durationMs}
                  onChange={(e) => onArpChange({ durationMs: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between gap-1 mt-1.5">
                  {SPEED_PRESETS.map((sp) => (
                    <button
                      key={sp.label}
                      onClick={() => onArpChange({ durationMs: sp.ms })}
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition cursor-pointer ${
                        arpConfig.durationMs === sp.ms
                          ? 'bg-cyan-900 border-cyan-500 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Sequence Length</span>
                  <span className="text-cyan-300 font-bold">{arpConfig.stepCount} Steps</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <button
                      key={c}
                      onClick={() => onArpChange({ stepCount: c })}
                      className={`py-1 text-xs font-mono font-bold rounded border transition cursor-pointer ${
                        arpConfig.stepCount === c
                          ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Portamento (Glide) & Visual Pitch Transition */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            2. Portamento Pitch Glide (slideFreqTo)
          </h3>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Glide Duration (ms)</span>
                <span className={`font-bold ${portamentoMs > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                  {portamentoMs === 0 ? 'Off (Instantaneous)' : `${portamentoMs} ms`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="10"
                value={portamentoMs}
                onChange={(e) => onPortamentoChange(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex gap-1.5 mt-1.5">
                {[0, 40, 80, 160, 320].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => onPortamentoChange(ms)}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                      portamentoMs === ms
                        ? 'bg-blue-900 border-blue-500 text-blue-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ms === 0 ? 'Off' : `${ms}ms`}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Frequency Transition Graphic (SVG) */}
            <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Pitch Glide Trajectory</span>
                <span className="text-blue-400 font-bold">Q28 Fixed-Point Linear Sweep</span>
              </div>

              <div className="relative h-20 w-full bg-slate-950 rounded border border-slate-800/80 overflow-hidden flex items-center justify-center p-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="50" x2="200" y2="50" stroke="#1e293b" strokeDasharray="2,2" />
                  <line x1="0" y1="10" x2="200" y2="10" stroke="#1e293b" strokeDasharray="2,2" />

                  {/* Transition curve */}
                  {portamentoMs > 0 ? (
                    <path
                      d={`M 15 50 C ${15 + Math.min(100, portamentoMs / 5)} 50, ${185 - Math.min(80, portamentoMs / 6)} 10, 185 10`}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  ) : (
                    <polyline points="15,50 15,10 185,10" fill="none" stroke="#64748b" strokeWidth="2" />
                  )}

                  {/* Frequency Labels */}
                  <circle cx="15" cy="50" r="3.5" fill="#3b82f6" />
                  <text x="18" y="58" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                    f1: C3 (130 Hz)
                  </text>

                  <circle cx="185" cy="10" r="3.5" fill={isGlidingTest ? '#38bdf8' : '#3b82f6'} />
                  <text x="120" y="16" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                    f2: C4 (261 Hz)
                  </text>

                  {/* Animated gliding dot when testing */}
                  {isGlidingTest && (
                    <circle cx="100" cy="30" r="5" fill="#38bdf8">
                      <animate
                        attributeName="cx"
                        from="15"
                        to="185"
                        dur={`${Math.max(0.2, portamentoMs / 1000)}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="cy"
                        from="50"
                        to="10"
                        dur={`${Math.max(0.2, portamentoMs / 1000)}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </svg>
              </div>

              <button
                onClick={triggerGlideTest}
                className="w-full py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Simulate Pitch Glide</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
