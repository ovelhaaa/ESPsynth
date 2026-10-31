import React from 'react';
import { Volume2, VolumeX, Cpu, Radio, Activity, Cable, PlugZap } from 'lucide-react';

interface MidiStatusInfo {
  isConnected: boolean;
  deviceName: string | null;
  hasActivity: boolean;
  isSupported: boolean;
}

interface HeaderProps {
  isRunning: boolean;
  sampleRate: number;
  masterVol: number;
  cpuLoad: number;
  onToggleAudio: () => void;
  midiState?: MidiStatusInfo;
  onRequestMidi?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRunning,
  sampleRate,
  masterVol,
  cpuLoad,
  onToggleAudio,
  midiState,
  onRequestMidi,
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

      {/* Hardware Telemetry & Web MIDI Badges */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        {/* Web MIDI Status Badge */}
        {midiState && (
          <button
            onClick={onRequestMidi}
            title={
              midiState.isConnected
                ? `Connected to: ${midiState.deviceName || 'USB MIDI'}`
                : midiState.isSupported
                ? 'Web MIDI active. Click to scan for USB MIDI keyboards'
                : 'Web MIDI API not supported in this browser'
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer ${
              midiState.isConnected
                ? midiState.hasActivity
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.4)] scale-[1.02]'
                  : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : midiState.isSupported
                ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                : 'bg-slate-950 border-slate-900 text-slate-600 opacity-60'
            }`}
          >
            {midiState.isConnected ? (
              <PlugZap className={`w-3.5 h-3.5 ${midiState.hasActivity ? 'text-emerald-300 animate-bounce' : 'text-emerald-400'}`} />
            ) : (
              <Cable className="w-3.5 h-3.5 text-slate-500" />
            )}

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full transition-all ${
                midiState.isConnected
                  ? midiState.hasActivity
                    ? 'bg-emerald-300 shadow-[0_0_8px_#6ee7b7] scale-125'
                    : 'bg-emerald-500'
                  : 'bg-slate-600'
              }`} />
              <span className="font-semibold max-w-[130px] sm:max-w-[180px] truncate">
                {midiState.isConnected
                  ? `MIDI: ${midiState.deviceName || 'Connected'}`
                  : midiState.isSupported
                  ? 'MIDI: Scan'
                  : 'MIDI: N/A'}
              </span>
            </div>
          </button>
        )}

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
