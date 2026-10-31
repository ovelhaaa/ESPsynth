import React from 'react';
import { EnvState } from '../audio/types';

interface EnvelopeVisualizerProps {
  attackMs: number;
  decayMs: number;
  sustain8Bit: number; // 0 - 255
  releaseMs: number;
  smoothEnv: boolean;
  activeEnvLevel?: number; // 0 - 255 (from active voice telemetry)
  activeEnvState?: EnvState; // ENV_IDLE(0), ENV_ATTACK(1), ENV_DECAY(2), ENV_SUSTAIN(3), ENV_RELEASE(4)
}

export const EnvelopeVisualizer: React.FC<EnvelopeVisualizerProps> = ({
  attackMs,
  decayMs,
  sustain8Bit,
  releaseMs,
  smoothEnv,
  activeEnvLevel = 0,
  activeEnvState = EnvState.ENV_IDLE,
}) => {
  const width = 420;
  const height = 120;
  const paddingX = 16;
  const paddingTop = 14;
  const paddingBottom = 24;
  const usableHeight = height - paddingTop - paddingBottom;
  const usableWidth = width - paddingX * 2;

  // Normalized time proportions (fixed visual proportion so short attacks remain clearly visible)
  const sustainVisualMs = 500;
  const normTotal = attackMs + decayMs + sustainVisualMs + releaseMs;

  const wAttack = Math.max(16, (attackMs / normTotal) * usableWidth);
  const wDecay = Math.max(16, (decayMs / normTotal) * usableWidth);
  const wSustain = Math.max(24, (sustainVisualMs / normTotal) * usableWidth);
  const wRelease = Math.max(16, (releaseMs / normTotal) * usableWidth);

  // Rescale to fit exactly into usableWidth
  const sumW = wAttack + wDecay + wSustain + wRelease;
  const scale = usableWidth / sumW;

  const x0 = paddingX;
  const x1 = x0 + wAttack * scale;
  const x2 = x1 + wDecay * scale;
  const x3 = x2 + wSustain * scale;
  const x4 = x3 + wRelease * scale;

  const yBase = paddingTop + usableHeight;
  const yPeak = paddingTop;
  const sustainRatio = Math.max(0, Math.min(1, sustain8Bit / 255));
  const ySustain = paddingTop + usableHeight * (1 - sustainRatio);

  // SVG Path with subtle smooth cubic bezier if smoothEnv is on
  const pathD = smoothEnv
    ? `M ${x0} ${yBase} Q ${(x0 + x1) / 2} ${yPeak} ${x1} ${yPeak} Q ${(x1 + x2) / 2} ${ySustain} ${x2} ${ySustain} L ${x3} ${ySustain} Q ${(x3 + x4) / 2} ${yBase} ${x4} ${yBase}`
    : `M ${x0} ${yBase} L ${x1} ${yPeak} L ${x2} ${ySustain} L ${x3} ${ySustain} L ${x4} ${yBase}`;

  const areaD = `${pathD} L ${x4} ${yBase} L ${x0} ${yBase} Z`;

  // Calculate real-time animated ADSR indicator dot coordinates from telemetry
  let activeDotX: number | null = null;
  let activeDotY: number | null = null;
  const isPlaying = activeEnvLevel > 0 && activeEnvState !== EnvState.ENV_IDLE;

  if (isPlaying) {
    const levelNorm = Math.min(1, Math.max(0, activeEnvLevel / 255));
    activeDotY = paddingTop + usableHeight * (1 - levelNorm);

    switch (activeEnvState) {
      case EnvState.ENV_ATTACK: {
        // Attack: level climbs from 0 to 255
        const progress = Math.min(1, Math.max(0, activeEnvLevel / 255));
        activeDotX = x0 + progress * (x1 - x0);
        break;
      }
      case EnvState.ENV_DECAY: {
        // Decay: level drops from 255 down to sustain8Bit
        const decaySpan = Math.max(1, 255 - sustain8Bit);
        const progress = Math.min(1, Math.max(0, (255 - activeEnvLevel) / decaySpan));
        activeDotX = x1 + progress * (x2 - x1);
        break;
      }
      case EnvState.ENV_SUSTAIN: {
        // Sustain: level holds at sustain8Bit
        activeDotX = x2 + (x3 - x2) * 0.5;
        break;
      }
      case EnvState.ENV_RELEASE: {
        // Release: level drops from sustain8Bit down to 0
        const releaseSpan = Math.max(1, sustain8Bit);
        const progress = Math.min(1, Math.max(0, (sustain8Bit - activeEnvLevel) / releaseSpan));
        activeDotX = x3 + progress * (x4 - x3);
        break;
      }
      default: {
        activeDotX = x2 + (x3 - x2) * 0.5;
        break;
      }
    }
  }

  // Stage helper metadata for UI badges
  const stateMeta = {
    [EnvState.ENV_IDLE]: { label: 'IDLE', color: 'text-slate-500 bg-slate-900 border-slate-800' },
    [EnvState.ENV_ATTACK]: { label: 'ATTACK (Subindo)', color: 'text-cyan-300 bg-cyan-950/80 border-cyan-700/80' },
    [EnvState.ENV_DECAY]: { label: 'DECAY (Decaimento)', color: 'text-amber-300 bg-amber-950/80 border-amber-700/80' },
    [EnvState.ENV_SUSTAIN]: { label: 'SUSTAIN (Sustentação)', color: 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80' },
    [EnvState.ENV_RELEASE]: { label: 'RELEASE (Liberação)', color: 'text-purple-300 bg-purple-950/80 border-purple-700/80' },
  }[activeEnvState] || { label: 'IDLE', color: 'text-slate-500 bg-slate-900 border-slate-800' };

  return (
    <div className="bg-slate-950/90 rounded-lg border border-slate-800/80 p-3 relative flex flex-col gap-1.5 overflow-hidden shadow-inner">
      {/* Header with Real-Time Stage and Level Badges */}
      <div className="flex items-center justify-between text-[11px] font-mono px-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            Fixed-Point Q28 Envelope
          </span>
          {/* Active Voice Stage Badge */}
          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${stateMeta.color}`}>
            {stateMeta.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPlaying && (
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              Level: {activeEnvLevel} / 255 ({Math.round((activeEnvLevel / 255) * 100)}%)
            </span>
          )}
          <span className="text-slate-500 text-[10px] hidden sm:inline">
            Total: {attackMs + decayMs + releaseMs} ms {smoothEnv && '• Smooth RC Lowpass'}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible select-none">
        <defs>
          <linearGradient id="envGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#0d9488" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
          </linearGradient>
          <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Grid Background */}
        <rect x={paddingX} y={paddingTop} width={usableWidth} height={usableHeight} fill="url(#gridPattern)" />

        {/* Baseline */}
        <line x1={x0} y1={yBase} x2={x4} y2={yBase} stroke="#334155" strokeWidth="1" />

        {/* Sustain Guideline */}
        <line
          x1={x0}
          y1={ySustain}
          x2={x4}
          y2={ySustain}
          stroke="#059669"
          strokeWidth="0.75"
          strokeDasharray="3 3"
          strokeOpacity="0.7"
        />

        {/* Filled Envelope Area */}
        <path d={areaD} fill="url(#envGrad)" />

        {/* Envelope Contour Line */}
        <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Stage Transition Markers */}
        <circle cx={x1} cy={yPeak} r="3" fill="#10b981" />
        <circle cx={x2} cy={ySustain} r="3" fill="#14b8a6" />
        <circle cx={x3} cy={ySustain} r="3" fill="#14b8a6" />
        <circle cx={x4} cy={yBase} r="3" fill="#047857" />

        {/* Active Voice Playing Dot Indicator & Crosshairs */}
        {activeDotX !== null && activeDotY !== null && (
          <g>
            {/* Vertical crosshair line dropping to baseline */}
            <line
              x1={activeDotX}
              y1={activeDotY}
              x2={activeDotX}
              y2={yBase}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeOpacity="0.7"
            />
            {/* Glowing ripple aura */}
            <circle cx={activeDotX} cy={activeDotY} r="9" fill="#38bdf8" fillOpacity="0.25">
              <animate attributeName="r" from="4" to="14" dur="0.9s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.9" to="0" dur="0.9s" repeatCount="indefinite" />
            </circle>
            {/* Outer halo */}
            <circle cx={activeDotX} cy={activeDotY} r="6" fill="#38bdf8" className="opacity-75" />
            {/* Solid core indicator */}
            <circle cx={activeDotX} cy={activeDotY} r="4" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {/* Stage Labels at Bottom */}
        <text x={(x0 + x1) / 2} y={height - 6} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          A: {attackMs}ms
        </text>
        <text x={(x1 + x2) / 2} y={height - 6} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          D: {decayMs}ms
        </text>
        <text x={(x2 + x3) / 2} y={height - 6} fill="#34d399" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
          S: {Math.round(sustainRatio * 100)}%
        </text>
        <text x={(x3 + x4) / 2} y={height - 6} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          R: {releaseMs}ms
        </text>
      </svg>
    </div>
  );
};
