import React from 'react';
import { Volume2, VolumeX, Cpu, Radio, Activity } from 'lucide-react';

interface HeaderProps {
  isRunning: boolean;
  sampleRate: number;
  masterVol: number;
  cpuLoad: number;
  onToggleAudio: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRunning,
  sampleRate,
  masterVol,
  cpuLoad,
  onToggleAudio,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight font-mono">
              ESP32Synth <span className="text-emerald-400 text-sm font-normal px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">WASM 1:1</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Fixed-Point Q28 DSP &bull; Zero-Branch PolyBLEP &bull; 8-bit / CentiHz Architecture
          </p>
        </div>
      </div>

      {/* Hardware Telemetry Badges */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
          <Radio className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-500">SR:</span>
          <span className="text-blue-300 font-semibold">{sampleRate} Hz</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-500">Master:</span>
          <span className="text-emerald-300 font-semibold">{masterVol} <span className="text-slate-500">/ 255</span></span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-500">DSP Load:</span>
          <span className={`font-semibold ${cpuLoad > 80 ? 'text-rose-400' : cpuLoad > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {cpuLoad.toFixed(1)}%
          </span>
        </div>

        {/* Audio Power Button */}
        <button
          onClick={onToggleAudio}
          className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
            isRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 border border-emerald-400/30'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 border border-rose-400/50 hover:scale-[1.02]'
          }`}
          aria-label={isRunning ? 'Audio Active - Click to Stop' : 'Audio Suspended - Click to Start'}
        >
          {isRunning ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Audio Active</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span>Start Audio Engine</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
