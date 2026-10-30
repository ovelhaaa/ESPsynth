import React from 'react';

interface EnvelopeVisualizerProps {
  attackMs: number;
  decayMs: number;
  sustain8Bit: number; // 0 - 255
  releaseMs: number;
  smoothEnv: boolean;
  activeEnvLevel?: number; // 0 - 255 (from active voice telemetry)
}

export const EnvelopeVisualizer: React.FC<EnvelopeVisualizerProps> = ({
  attackMs,
  decayMs,
  sustain8Bit,
  releaseMs,
  smoothEnv,
  activeEnvLevel,
}) => {
  const width = 400;
  const height = 110;
  const paddingX = 16;
  const paddingTop = 12;
  const paddingBottom = 22;
  const usableHeight = height - paddingTop - paddingBottom;
  const usableWidth = width - paddingX * 2;

  // Normalized time proportions (fixed visual proportion so short attacks remain clearly visible)
  // Total nominal visual duration: 5000 ms
  const totalMs = Math.max(800, attackMs + decayMs + 600 + releaseMs);
  const sustainVisualMs = 500;
  const normTotal = attackMs + decayMs + sustainVisualMs + releaseMs;

  const wAttack = Math.max(12, (attackMs / normTotal) * usableWidth);
  const wDecay = Math.max(12, (decayMs / normTotal) * usableWidth);
  const wSustain = Math.max(20, (sustainVisualMs / normTotal) * usableWidth);
  const wRelease = Math.max(12, (releaseMs / normTotal) * usableWidth);

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

  // Active voice current envelope level marker
  let activeDotX: number | null = null;
  let activeDotY: number | null = null;
  if (activeEnvLevel !== undefined && activeEnvLevel > 0) {
    const norm = activeEnvLevel / 255;
    activeDotY = paddingTop + usableHeight * (1 - norm);
    activeDotX = x2 + (x3 - x2) * 0.5; // default position in sustain zone
  }

  return (
    <div className="bg-slate-950/80 rounded-lg border border-slate-800/80 p-2.5 relative flex flex-col gap-1 overflow-hidden">
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Interactive Q28 Envelope Curve
        </span>
        <span className="text-slate-500">
          Total: {attackMs + decayMs + releaseMs} ms {smoothEnv && '• Smooth RC Lowpass'}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible select-none">
        <defs>
          <linearGradient id="envGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#0d9488" stopOpacity="0.12" />
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
          strokeOpacity="0.6"
        />

        {/* Filled Envelope Area */}
        <path d={areaD} fill="url(#envGrad)" />

        {/* Envelope Contour Line */}
        <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Stage Transition Markers */}
        <circle cx={x1} cy={yPeak} r="3" fill="#10b981" />
        <circle cx={x2} cy={ySustain} r="3" fill="#14b8a6" />
        <circle cx={x3} cy={ySustain} r="3" fill="#14b8a6" />
        <circle cx={x4} cy={yBase} r="3" fill="#047857" />

        {/* Active Voice Playing Dot Indicator */}
        {activeDotX !== null && activeDotY !== null && (
          <g>
            <circle cx={activeDotX} cy={activeDotY} r="5" fill="#38bdf8" className="animate-ping opacity-75" />
            <circle cx={activeDotX} cy={activeDotY} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
          </g>
        )}

        {/* Stage Labels at Bottom */}
        <text x={(x0 + x1) / 2} y={height - 5} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          A: {attackMs}ms
        </text>
        <text x={(x1 + x2) / 2} y={height - 5} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          D: {decayMs}ms
        </text>
        <text x={(x2 + x3) / 2} y={height - 5} fill="#34d399" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
          S: {Math.round(sustainRatio * 100)}%
        </text>
        <text x={(x3 + x4) / 2} y={height - 5} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
          R: {releaseMs}ms
        </text>
      </svg>
    </div>
  );
};
