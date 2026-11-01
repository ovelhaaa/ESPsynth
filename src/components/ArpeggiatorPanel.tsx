import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, FastForward, Music, Zap, Gauge, Sparkles, Clock, Volume2, VolumeX, Plus, Minus, RotateCcw } from 'lucide-react';
import { NOTES, transposeCentiHz, centiHzToNoteName } from '../audio/notes';

export interface ArpConfig {
  enabled: boolean;
  durationMs: number;
  steps: number[]; // semitone offsets from root (-12 to +12)
  stepCount: number; // 8 to 16
  activeSteps: boolean[]; // gate on/off per step
}

interface ArpeggiatorPanelProps {
  arpConfig: ArpConfig;
  onArpChange: (updated: Partial<ArpConfig>) => void;
  controlRateHz?: number; // from masterConfig (default 100)
  portamentoMs: number;
  onPortamentoChange: (ms: number) => void;
  onAuditionArp?: (active: boolean) => void;
  isAuditioning?: boolean;
  onSimulateGlide?: () => void;
}

const CHIPTUNE_PRESETS = [
  {
    name: 'C64 Fast Triad',
    count: 8,
    ticks: 2,
    steps: [0, 4, 7, 12, 7, 4, 0, 12],
    gates: [true, true, true, true, true, true, true, true],
  },
  {
    name: 'Game Boy Minor',
    count: 8,
    ticks: 4,
    steps: [0, 3, 7, 10, 12, 10, 7, 3],
    gates: [true, true, true, true, true, true, true, true],
  },
  {
    name: 'NES 16-Step Riff',
    count: 16,
    ticks: 6,
    steps: [0, 12, 0, 7, 10, 7, 12, 0, 3, 7, 12, 7, 0, -12, 0, 12],
    gates: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
  },
  {
    name: 'Cyber Tracker',
    count: 16,
    ticks: 8,
    steps: [0, 0, 7, 7, 12, 12, 10, 7, 0, 0, 3, 3, 7, 7, -12, 0],
    gates: [true, false, true, true, true, false, true, true, true, false, true, true, true, false, true, true],
  },
  {
    name: 'Octave Bassline',
    count: 8,
    ticks: 12,
    steps: [0, 12, 0, 12, 0, 12, -12, 0],
    gates: [true, true, true, true, true, true, true, true],
  },
  {
    name: 'Amiga Acid 16',
    count: 16,
    ticks: 6,
    steps: [0, 3, 7, 12, 0, 7, 10, 12, -12, 0, 3, 7, 12, 10, 7, 3],
    gates: [true, true, false, true, true, false, true, true, true, true, false, true, true, true, false, true],
  },
];

export const ArpeggiatorPanel: React.FC<ArpeggiatorPanelProps> = ({
  arpConfig,
  onArpChange,
  controlRateHz = 100,
  portamentoMs,
  onPortamentoChange,
  onAuditionArp,
  isAuditioning = false,
  onSimulateGlide,
}) => {
  const [playheadStep, setPlayheadStep] = useState<number>(0);
  const [isGlidingTest, setIsGlidingTest] = useState<boolean>(false);
  const playheadIntervalRef = useRef<number | null>(null);

  // Calculate tick period from synthesizer control rate
  const tickPeriodMs = Math.max(1, Math.round(1000 / Math.max(10, controlRateHz)));

  // Rhythmic divisions synchronized to controlRateHz clock
  const RHYTHMIC_DIVISIONS = [
    { label: '1 Tick (Ultra)', ticks: 1, ms: Math.max(10, tickPeriodMs * 1) },
    { label: '2 Ticks (C64)', ticks: 2, ms: Math.max(15, tickPeriodMs * 2) },
    { label: '4 Ticks (Chip)', ticks: 4, ms: Math.max(25, tickPeriodMs * 4) },
    { label: '1/32 (6 Ticks)', ticks: 6, ms: Math.max(40, tickPeriodMs * 6) },
    { label: '1/16 (12 Ticks)', ticks: 12, ms: Math.max(60, tickPeriodMs * 12) },
    { label: '1/8 (25 Ticks)', ticks: 25, ms: Math.max(100, tickPeriodMs * 25) },
    { label: '1/4 (50 Ticks)', ticks: 50, ms: Math.max(200, tickPeriodMs * 50) },
  ];

  // Visual playhead animation synced with durationMs
  useEffect(() => {
    if (arpConfig.enabled || isAuditioning) {
      if (playheadIntervalRef.current !== null) {
        window.clearInterval(playheadIntervalRef.current);
      }
      playheadIntervalRef.current = window.setInterval(() => {
        setPlayheadStep((prev) => (prev + 1) % Math.max(1, arpConfig.stepCount));
      }, Math.max(20, arpConfig.durationMs));
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

  // Adjust semitone within range [-12, +12]
  const handleStepValueChange = (index: number, val: number) => {
    const clamped = Math.max(-12, Math.min(12, val));
    const nextSteps = [...arpConfig.steps];
    // Ensure array is large enough
    while (nextSteps.length < 16) nextSteps.push(0);
    nextSteps[index] = clamped;
    onArpChange({ steps: nextSteps });
  };

  const handleStepToggle = (index: number) => {
    const nextActive = [...arpConfig.activeSteps];
    while (nextActive.length < 16) nextActive.push(true);
    nextActive[index] = !nextActive[index];
    onArpChange({ activeSteps: nextActive });
  };

  const handleApplyPreset = (p: typeof CHIPTUNE_PRESETS[0]) => {
    const newSteps = [...p.steps];
    while (newSteps.length < 16) newSteps.push(0);
    const newActive = [...p.gates];
    while (newActive.length < 16) newActive.push(true);

    const calculatedMs = Math.round(p.ticks * (1000 / controlRateHz));

    onArpChange({
      steps: newSteps,
      stepCount: p.count,
      activeSteps: newActive,
      durationMs: Math.max(20, calculatedMs),
    });
  };

  const handleSetAllGates = (state: boolean) => {
    onArpChange({ activeSteps: Array(16).fill(state) });
  };

  const handleResetSteps = () => {
    onArpChange({
      steps: Array(16).fill(0),
      activeSteps: Array(16).fill(true),
    });
  };

  const triggerGlideTest = useCallback(() => {
    setIsGlidingTest(true);
    if (onSimulateGlide) {
      onSimulateGlide();
    }
    setTimeout(() => {
      setIsGlidingTest(false);
    }, Math.max(300, portamentoMs + 100));
  }, [portamentoMs, onSimulateGlide]);

  // Current division label
  const currentTicks = Math.round(arpConfig.durationMs / tickPeriodMs);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              Arpeggiator Matrix & Chiptune Tracker
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/80 text-cyan-300">
                16-Step WASM Buffer
              </span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400 block">
              Direct Danilo Gabriel WASM Buffer &bull; {controlRateHz}Hz DSP Control Clock Sync &bull; Range: -12st to +12st
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Step Sequencer Tracker Matrix (2 Columns wide) */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tracker Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Step Matrix ({arpConfig.stepCount} Steps)
              </span>

              {/* Step Count Buttons (8 to 16) */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[8, 10, 12, 14, 16].map((count) => (
                  <button
                    key={count}
                    onClick={() => onArpChange({ stepCount: count })}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition cursor-pointer ${
                      arpConfig.stepCount === count
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Gate Helpers & Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-1">
                <button
                  onClick={() => handleSetAllGates(true)}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-emerald-400"
                  title="Enable all step gates"
                >
                  All Gates ON
                </button>
                <button
                  onClick={handleResetSteps}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-slate-200"
                  title="Reset steps to root (0st)"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              <span className="text-[10px] font-mono text-slate-500">Riffs:</span>
              {CHIPTUNE_PRESETS.map((p) => (
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

          {/* Interactive Step Matrix Grid (8 to 16 Steps) */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-8 xl:grid-cols-8 gap-2">
              {Array.from({ length: arpConfig.stepCount }, (_, i) => {
                const semitone = arpConfig.steps[i] ?? 0;
                const isActive = arpConfig.activeSteps[i] ?? true;
                const isCurrent = (arpConfig.enabled || isAuditioning) && playheadStep === i;
                const isQuarterBeat = i % 4 === 0;

                const noteName = centiHzToNoteName(transposeCentiHz(NOTES.C3, semitone));
                const semitoneLabel = semitone === 0 ? 'Root' : semitone > 0 ? `+${semitone}` : `${semitone}`;

                // Calculate visual bipolar height (-12 to +12)
                const normHeight = Math.abs(semitone) / 12; // 0 to 1
                const isPositive = semitone >= 0;

                return (
                  <div
                    key={i}
                    className={`p-2 rounded-lg border font-mono flex flex-col justify-between items-center gap-2 transition-all duration-75 relative select-none ${
                      isCurrent
                        ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-[1.03] z-10'
                        : isActive
                        ? isQuarterBeat
                          ? 'bg-slate-900/90 border-cyan-900/50 text-slate-200'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-50'
                    }`}
                  >
                    {/* Step Index & Gate Toggle Button */}
                    <div className="flex items-center justify-between w-full text-[10px]">
                      <span className={`font-bold ${isCurrent ? 'text-cyan-300' : isQuarterBeat ? 'text-cyan-400' : 'text-slate-400'}`}>
                        #{i + 1}
                      </span>
                      <button
                        onClick={() => handleStepToggle(i)}
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer ${
                          isActive
                            ? isCurrent
                              ? 'bg-cyan-400 border-white text-slate-950 shadow-[0_0_8px_#22d3ee]'
                              : 'bg-emerald-500/80 border-emerald-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}
                        title={isActive ? 'Step Gate Active (Click to mute)' : 'Step Gate Muted (Click to enable)'}
                        aria-label={`Step ${i + 1} Gate`}
                      >
                        {isActive ? <Volume2 className="w-2.5 h-2.5" /> : <VolumeX className="w-2.5 h-2.5" />}
                      </button>
                    </div>

                    {/* Note & Semitone Display */}
                    <div className="text-center py-0.5">
                      <div className={`text-xs font-bold leading-none ${isCurrent ? 'text-cyan-200' : isActive ? 'text-white' : 'text-slate-500'}`}>
                        {isActive ? noteName : 'REST'}
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 leading-none ${semitone === 0 ? 'text-slate-400' : isPositive ? 'text-cyan-400' : 'text-amber-400'}`}>
                        {isActive ? `${semitoneLabel}st` : '---'}
                      </div>
                    </div>

                    {/* Bipolar Visual Semitone Column Display */}
                    <div className="w-full h-10 bg-slate-950 rounded flex flex-col justify-center items-center relative overflow-hidden border border-slate-800/80 my-0.5">
                      {/* Zero center guideline */}
                      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-700/60 z-0" />
                      {/* Bar indicator */}
                      {isActive && (
                        <div
                          className={`w-3 rounded transition-all z-10 ${
                            semitone === 0
                              ? 'h-[2px] bg-slate-400'
                              : isPositive
                              ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                              : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                          }`}
                          style={{
                            height: semitone === 0 ? '2px' : `${Math.max(4, normHeight * 18)}px`,
                            transform: isPositive ? 'translateY(-50%)' : 'translateY(50%)',
                          }}
                        />
                      )}
                    </div>

                    {/* Step Increment / Decrement & Quick Buttons */}
                    <div className="w-full flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleStepValueChange(i, semitone - 1)}
                        disabled={!isActive || semitone <= -12}
                        className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 rounded flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                        title="-1 Semitone"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => handleStepValueChange(i, 0)}
                        disabled={!isActive || semitone === 0}
                        className="px-1 py-0.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 rounded text-[9px] text-slate-400 hover:text-white cursor-pointer"
                        title="Reset to 0 (Root)"
                      >
                        0
                      </button>
                      <button
                        onClick={() => handleStepValueChange(i, semitone + 1)}
                        disabled={!isActive || semitone >= 12}
                        className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 rounded flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                        title="+1 Semitone"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Range slider for smooth dragging */}
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={semitone}
                      onChange={(e) => handleStepValueChange(i, Number(e.target.value))}
                      disabled={!isActive}
                      className="w-full accent-cyan-400 h-1 cursor-pointer disabled:opacity-20"
                      title={`Step ${i + 1}: ${semitoneLabel} semitones`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Rhythmic Division & Clock Sync Controls */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold">DSP Control Clock Division:</span>
                  <span className="text-cyan-300">
                    {arpConfig.durationMs} ms ({currentTicks} ticks @ {controlRateHz} Hz)
                  </span>
                </div>
                <span className="text-slate-500 text-[10px]">
                  Formula: durationMs = round(ticks &times; 1000 / controlRateHz)
                </span>
              </div>

              {/* Rhythmic Division Quick Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {RHYTHMIC_DIVISIONS.map((rd) => {
                  const isSelected = Math.abs(arpConfig.durationMs - rd.ms) <= 5;
                  return (
                    <button
                      key={rd.label}
                      onClick={() => onArpChange({ durationMs: rd.ms })}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm shadow-cyan-900/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div>{rd.label}</div>
                      <div className="text-[9px] opacity-75">{rd.ms} ms</div>
                    </button>
                  );
                })}
              </div>

              {/* Continuous Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Fine Step Duration (ms)</span>
                  <span className="text-cyan-400 font-bold">{arpConfig.durationMs} ms</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="600"
                  step="5"
                  value={arpConfig.durationMs}
                  onChange={(e) => onArpChange({ durationMs: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Portamento Glide & Fixed-Point Pitch Sweep */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase">
              Portamento Pitch Glide (slideFreqTo)
            </h3>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-4">
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
                {[0, 30, 60, 120, 240, 480].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => onPortamentoChange(ms)}
                    className={`flex-1 text-[9px] font-mono py-1 rounded border transition cursor-pointer text-center ${
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
                <span>Fixed-Point Pitch Sweep</span>
                <span className="text-blue-400 font-bold">Q28 Frequency Ramp</span>
              </div>

              <div className="relative h-24 w-full bg-slate-950 rounded border border-slate-800/80 overflow-hidden flex items-center justify-center p-2">
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
