import React, { useState, useEffect } from 'react';
import { BusFXPatch, GlobalDSPPatch } from '../audio/types';
import {
  Volume2,
  Disc,
  Filter,
  Sparkles,
  Power,
  RotateCw,
  Zap,
  ArrowRight,
} from 'lucide-react';

export interface MasterConfig {
  masterVol: number;
  bitcrush: number;
  controlRateHz: number;
  bus1FXPatch: BusFXPatch;
  bus1CutoffHz: number;   // ep[0]
  bus1FilterMode: number; // ep[1]
  bus1ResonanceQ: number; // ep[2]
  bus1BwMode: number;     // ep[3]: 0 = Q*100 mode, 1 = Bandwidth Hz mode
  bus1WetMix: number;     // ep[4]
  bus1MixLevel: number;
  globalDSPPatch: GlobalDSPPatch;
  dspParam0: number; // Leslie: SpeedState (0=Stop, 1=Slow, 2=Fast) | Pedalboard: Distortion (0/1)
  dspParam1: number; // Leslie: Reverb Mix (0..255)                 | Pedalboard: Chorus (0/1)
  dspParam2: number; // Pedalboard: Delay (0/1)
  dspParam3: number;
}

interface MasterPanelProps {
  config: MasterConfig;
  onChange: (updated: Partial<MasterConfig>) => void;
}

export const MasterPanel: React.FC<MasterPanelProps> = ({ config, onChange }) => {
  const [rotorAngle, setRotorAngle] = useState<number>(0);

  // Animated rotor rotation for Leslie visualizer
  useEffect(() => {
    if (config.globalDSPPatch === GlobalDSPPatch.DSP_HAMMOND_LESLIE && config.dspParam0 > 0) {
      const speedMultiplier = config.dspParam0 === 2 ? 14 : 2.5; // Fast (tremolo) vs Slow (chorale)
      const interval = setInterval(() => {
        setRotorAngle((prev) => (prev + speedMultiplier) % 360);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [config.globalDSPPatch, config.dspParam0]);

  const handleGlobalDSPSelect = (patch: GlobalDSPPatch) => {
    if (patch === GlobalDSPPatch.DSP_HAMMOND_LESLIE) {
      onChange({ globalDSPPatch: patch, dspParam0: 2, dspParam1: 140 }); // Fast rotor + 140 reverb
    } else if (patch === GlobalDSPPatch.DSP_PEDALBOARD) {
      onChange({ globalDSPPatch: patch, dspParam0: 1, dspParam1: 1, dspParam2: 1 }); // All 3 pedals ON
    } else {
      onChange({ globalDSPPatch: patch });
    }
  };

  // Switch between Q mode (0) and Bandwidth Hz mode (1)
  const handleUnitModeToggle = (mode: number) => {
    if (mode === 1) {
      onChange({
        bus1BwMode: 1,
        bus1ResonanceQ: config.bus1BwMode === 1 ? config.bus1ResonanceQ : 200,
      });
    } else {
      onChange({
        bus1BwMode: 0,
        bus1ResonanceQ: config.bus1BwMode === 0 ? config.bus1ResonanceQ : 250,
      });
    }
  };

  // Generate SVG points for dynamic filter response curve
  const renderFilterCurve = () => {
    const points: string[] = [];
    const width = 280;
    const height = 90;
    const fc = Math.max(20, Math.min(16000, config.bus1CutoffHz));
    const mode = config.bus1FilterMode;
    const isBw = config.bus1BwMode === 1;
    const qOrBw = config.bus1ResonanceQ || (isBw ? 200 : 100);

    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    const normalizedFc = (Math.log10(fc) - logMin) / (logMax - logMin);
    const fcX = Math.round(normalizedFc * width);

    for (let i = 0; i <= 35; i++) {
      const frac = i / 35;
      const freq = Math.pow(10, logMin + frac * (logMax - logMin));
      const x = frac * width;

      let gainDb = 0;
      const ratio = freq / fc;

      if (mode === 0) {
        if (freq < fc) {
          gainDb = 0;
        } else {
          gainDb = -24 * Math.log2(ratio);
        }
        const dist = Math.abs(Math.log2(ratio));
        if (dist < 0.6) {
          const qVal = isBw ? Math.max(0.5, fc / qOrBw) : qOrBw / 100;
          const peakDb = Math.min(18, Math.max(0, (qVal - 0.707) * 4));
          gainDb += peakDb * (1 - dist / 0.6);
        }
      } else if (mode === 1) {
        if (freq > fc) {
          gainDb = 0;
        } else {
          gainDb = 24 * Math.log2(ratio);
        }
        const dist = Math.abs(Math.log2(ratio));
        if (dist < 0.6) {
          const qVal = isBw ? Math.max(0.5, fc / qOrBw) : qOrBw / 100;
          const peakDb = Math.min(18, Math.max(0, (qVal - 0.707) * 4));
          gainDb += peakDb * (1 - dist / 0.6);
        }
      } else if (mode === 2) {
        const dist = Math.abs(Math.log2(ratio));
        const widthFactor = isBw ? Math.max(0.2, (qOrBw / fc) * 1.5) : Math.max(0.2, 2.5 / (qOrBw / 100));
        gainDb = -Math.min(32, Math.pow(dist / widthFactor, 2) * 16);
      } else {
        const dist = Math.abs(Math.log2(ratio));
        const widthFactor = isBw ? Math.max(0.1, (qOrBw / fc) * 0.8) : Math.max(0.1, 1.2 / (qOrBw / 100));
        if (dist < widthFactor) {
          gainDb = -28 * (1 - dist / widthFactor);
        } else {
          gainDb = 0;
        }
      }

      const y = Math.max(4, Math.min(height - 4, 30 - gainDb * 1.6));
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return { pathString: `M ${points.join(' L ')}`, fcX };
  };

  const { pathString, fcX } = renderFilterCurve();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Disc className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
              Master DSP Rack, Stompbox Pedalboard & Modular Bus FX
            </h2>
            <span className="text-[11px] font-mono text-slate-500 block">
              Global Master Filters • Stompbox FX Chain (dp[0..2]) • Rotary Leslie 122 (dp[0..1])
            </span>
          </div>
        </div>

        {/* Global DSP Patch Selector Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[
            { id: GlobalDSPPatch.NONE, label: 'Clean Master' },
            { id: GlobalDSPPatch.DSP_PEDALBOARD, label: 'Pedalboard Rack' },
            { id: GlobalDSPPatch.DSP_HAMMOND_LESLIE, label: 'Leslie 122 Rotary' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleGlobalDSPSelect(mode.id)}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                config.globalDSPPatch === mode.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Section 1: Master Controls */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            1. Master Hardware Output (Bus 0)
          </h3>

          <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Master Volume (setMasterVolume)</span>
                <span className="text-emerald-400 font-bold">
                  {config.masterVol} <span className="text-slate-500">/ 255</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={config.masterVol}
                onChange={(e) => onChange({ masterVol: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="h-2 bg-slate-900 rounded-full border border-slate-800 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${(config.masterVol / 255) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Hardware Bitcrush (setMasterBitcrush)</span>
                <span className={`font-bold ${config.bitcrush > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {config.bitcrush === 0 ? '16-bit (Clean DAC)' : `${config.bitcrush} Bits (Lo-Fi)`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                value={config.bitcrush}
                onChange={(e) => onChange({ bitcrush: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Control Rate (setControlRateHz)</span>
                <span className="text-slate-300 font-bold">{config.controlRateHz} Hz</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={config.controlRateHz}
                onChange={(e) => onChange({ controlRateHz: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                Cadência de envelopes ADSR e osciladores LFO (taxa de 50 Hz a 200 Hz).
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Modular Bus 1 Filter FX (ep[0..4]) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              2. Bus 1: Resonant Filter FX (ep[0..4])
            </h3>

            <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
              {config.bus1FXPatch === BusFXPatch.NONE ? 'Bypassed' : 'Active FX'}
            </span>
          </div>

          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            {/* Slot Patch Selector */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Filter FX Slot 0 (setBusFXPatch)
              </label>
              <select
                value={config.bus1FXPatch}
                onChange={(e) => onChange({ bus1FXPatch: Number(e.target.value) as BusFXPatch })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-blue-400 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={BusFXPatch.NONE}>FX_NONE (Bypass Bus 1 Filter)</option>
                <option value={BusFXPatch.FX_BIQUAD_FILTER}>ESP32Patches::FX_BiquadFilter (TDF-II Q28 Studio)</option>
                <option value={BusFXPatch.FX_BIQUAD_FILTER_FAST}>ESP32Patches::FX_BiquadFilterFast (DF-I Fast)</option>
              </select>
            </div>

            {/* Real-time SVG Frequency Response Graph */}
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Curva de Resposta de Frequência</span>
                <span className="text-blue-300 font-bold">
                  {config.bus1CutoffHz} Hz • {config.bus1FilterMode === 0 ? 'LPF' : config.bus1FilterMode === 1 ? 'HPF' : config.bus1FilterMode === 2 ? 'BPF' : 'Notch'}
                </span>
              </div>

              <div className="relative h-24 w-full bg-slate-900/80 rounded border border-slate-800 overflow-hidden flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="280" y2="30" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="70" y1="0" x2="70" y2="90" stroke="#1e293b" strokeDasharray="2,2" />
                  <line x1="140" y1="0" x2="140" y2="90" stroke="#1e293b" strokeDasharray="2,2" />
                  <line x1="210" y1="0" x2="210" y2="90" stroke="#1e293b" strokeDasharray="2,2" />

                  <path d={pathString} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

                  <line x1={fcX} y1="0" x2={fcX} y2="90" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="2,2" />
                  <circle cx={fcX} cy="30" r="3.5" fill="#60a5fa" />
                </svg>

                <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[8px] font-mono text-slate-500 pointer-events-none">
                  <span>20Hz</span>
                  <span>100Hz</span>
                  <span>1kHz</span>
                  <span>10kHz</span>
                  <span>20kHz</span>
                </div>
              </div>
            </div>

            {/* Filter Mode Selector (ep[1]) */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 mb-1 block">
                Filter Mode (ep[1]: LPF / HPF / BPF / Notch)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { mode: 0, label: '0: LPF', sub: 'Low Pass' },
                  { mode: 1, label: '1: HPF', sub: 'High Pass' },
                  { mode: 2, label: '2: BPF', sub: 'Band Pass' },
                  { mode: 3, label: '3: Notch', sub: 'Band Stop' },
                ].map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => onChange({ bus1FilterMode: m.mode })}
                    className={`py-1 text-center rounded border transition text-xs font-mono font-bold cursor-pointer ${
                      config.bus1FilterMode === m.mode
                        ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cutoff Frequency (ep[0]) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>ep[0]: Cutoff Frequency</span>
                <span className="text-blue-400 font-bold">{config.bus1CutoffHz} Hz</span>
              </div>
              <input
                type="range"
                min="20"
                max="16000"
                step="25"
                value={config.bus1CutoffHz}
                onChange={(e) => onChange({ bus1CutoffHz: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Unit Mode Selector (ep[3]) & Dynamic Resonance/Bandwidth (ep[2]) */}
            <div className="p-3 bg-blue-950/20 border border-blue-900/60 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-300 font-bold uppercase">
                  Unit Mode (ep[3]):
                </span>
                <div className="flex bg-slate-950 p-0.5 rounded border border-blue-800/60">
                  <button
                    onClick={() => handleUnitModeToggle(0)}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                      (config.bus1BwMode ?? 0) === 0
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    0: Q Factor (Q*100)
                  </button>
                  <button
                    onClick={() => handleUnitModeToggle(1)}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                      (config.bus1BwMode ?? 0) === 1
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1: Bandwidth (Hz)
                  </button>
                </div>
              </div>

              {/* Dynamic ep[2] Parameter Slider */}
              {(config.bus1BwMode ?? 0) === 0 ? (
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-blue-200 mb-1">
                    <span>ep[2]: Resonance Q Factor</span>
                    <span className="font-bold">
                      {config.bus1ResonanceQ} (Q = {(config.bus1ResonanceQ / 100).toFixed(2)})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="5"
                    value={config.bus1ResonanceQ}
                    onChange={(e) => onChange({ bus1ResonanceQ: Number(e.target.value) })}
                    className="w-full accent-blue-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                    Q = 70 (0.707 plano Butterworth) a 1000 (10.0 ressonância com ringing).
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-blue-200 mb-1">
                    <span>ep[2]: Filter Bandwidth in Hz</span>
                    <span className="font-bold">{config.bus1ResonanceQ} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="6000"
                    step="20"
                    value={config.bus1ResonanceQ}
                    onChange={(e) => onChange({ bus1ResonanceQ: Number(e.target.value) })}
                    className="w-full accent-blue-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                    Largura de banda entre as frequências de corte de -3dB em Hertz.
                  </span>
                </div>
              )}
            </div>

            {/* Wet Mix & Bus Mix Level */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>ep[4]: Wet (1-255)</span>
                  <span className="text-blue-300 font-bold">{config.bus1WetMix}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="255"
                  value={config.bus1WetMix}
                  onChange={(e) => onChange({ bus1WetMix: Number(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>Bus 1 Mix Level</span>
                  <span className="text-blue-300 font-bold">{config.bus1MixLevel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={config.bus1MixLevel}
                  onChange={(e) => onChange({ bus1MixLevel: Number(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Global Master DSP Rack (Pedalboard & Leslie) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              3. Global Master DSP Hardware Rack
            </h3>

            <span className="text-[10px] font-mono text-purple-300">
              {config.globalDSPPatch === GlobalDSPPatch.DSP_PEDALBOARD
                ? 'Pedalboard Active'
                : config.globalDSPPatch === GlobalDSPPatch.DSP_HAMMOND_LESLIE
                ? 'Leslie Active'
                : 'Clean Direct'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            {/* Case 1: Modular Stompbox Pedalboard (3 Pedals) */}
            {config.globalDSPPatch === GlobalDSPPatch.DSP_PEDALBOARD && (
              <div className="space-y-3.5">
                {/* Pedalboard Flow Line */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">VOICES</span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className={config.dspParam0 > 0 ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                    [DRIVE/CAB]
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className={config.dspParam1 > 0 ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                    [CHORUS]
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className={config.dspParam2 > 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                    [DELAY]
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className="text-slate-300">DAC OUT</span>
                </div>

                {/* Stompboxes Enclosure Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Stompbox 1: Overdrive & Speaker Cab (dp[0]) */}
                  {(() => {
                    const isOn = (config.dspParam0 ?? 0) > 0;
                    return (
                      <div
                        onClick={() => onChange({ dspParam0: isOn ? 0 : 1 })}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all duration-200 select-none relative group ${
                          isOn
                            ? 'bg-gradient-to-b from-amber-950/90 via-amber-900/40 to-slate-950 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                            : 'bg-slate-900/90 border-slate-800 opacity-70 hover:opacity-90'
                        }`}
                      >
                        {/* Metallic Screws */}
                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>

                        {/* Dome Jewel LED indicator */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-amber-300">
                            DRIVE / CAB
                          </span>
                          <div className="relative flex items-center justify-center">
                            {isOn && (
                              <div className="absolute w-6 h-6 rounded-full bg-red-500/40 animate-ping" />
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 shadow-md ${
                                isOn
                                  ? 'bg-red-500 border-red-200 shadow-[0_0_15px_#ef4444]'
                                  : 'bg-red-950 border-red-900/80'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Top Decorative Knobs */}
                        <div className="flex justify-around py-1">
                          {['DRIVE', 'TONE', 'LEVEL'].map((knob, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center relative shadow-inner">
                                <div className={`w-0.5 h-2 rounded-full ${isOn ? 'bg-amber-400' : 'bg-slate-600'}`} />
                              </div>
                              <span className="text-[7px] font-mono text-slate-400">{knob}</span>
                            </div>
                          ))}
                        </div>

                        {/* Pedal Label & Specs */}
                        <div className="text-center">
                          <div className="text-xs font-mono font-extrabold text-amber-300 tracking-wider">
                            VINTAGE OD
                          </div>
                          <div className="text-[8px] text-slate-400 font-mono mt-0.5">
                            3-Stage Drive + Cab LPF
                          </div>
                        </div>

                        {/* Chrome Stomp Footswitch */}
                        <div className="flex flex-col items-center pt-1">
                          <div
                            className={`w-12 h-8 rounded-lg border-2 shadow-inner flex items-center justify-center transition-all duration-100 active:scale-90 active:translate-y-1 ${
                              isOn
                                ? 'bg-gradient-to-b from-slate-200 to-slate-400 border-white text-slate-900 shadow-amber-900/60'
                                : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 text-slate-400'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[9px] font-mono font-bold mt-1.5 px-2 py-0.5 rounded border transition-all ${
                              isOn
                                ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {isOn ? '● ACTIVE (dp[0]=1)' : '○ BYPASS (dp[0]=0)'}
                          </span>
                        </div>

                        {/* Bottom Screws */}
                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stompbox 2: Stereo Chorus (dp[1]) */}
                  {(() => {
                    const isOn = (config.dspParam1 ?? 0) > 0;
                    return (
                      <div
                        onClick={() => onChange({ dspParam1: isOn ? 0 : 1 })}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all duration-200 select-none relative group ${
                          isOn
                            ? 'bg-gradient-to-b from-cyan-950/90 via-cyan-900/40 to-slate-950 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                            : 'bg-slate-900/90 border-slate-800 opacity-70 hover:opacity-90'
                        }`}
                      >
                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-cyan-300">
                            MODULATION
                          </span>
                          <div className="relative flex items-center justify-center">
                            {isOn && (
                              <div className="absolute w-6 h-6 rounded-full bg-cyan-400/40 animate-ping" />
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 shadow-md ${
                                isOn
                                  ? 'bg-cyan-400 border-cyan-200 shadow-[0_0_15px_#22d3ee]'
                                  : 'bg-cyan-950 border-cyan-900/80'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Top Knobs */}
                        <div className="flex justify-around py-1">
                          {['SPEED', 'DEPTH', 'MIX'].map((knob, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center relative shadow-inner">
                                <div className={`w-0.5 h-2 rounded-full ${isOn ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                              </div>
                              <span className="text-[7px] font-mono text-slate-400">{knob}</span>
                            </div>
                          ))}
                        </div>

                        <div className="text-center">
                          <div className="text-xs font-mono font-extrabold text-cyan-300 tracking-wider">
                            BBD CHORUS
                          </div>
                          <div className="text-[8px] text-slate-400 font-mono mt-0.5">
                            2048-Sample Delay Line
                          </div>
                        </div>

                        <div className="flex flex-col items-center pt-1">
                          <div
                            className={`w-12 h-8 rounded-lg border-2 shadow-inner flex items-center justify-center transition-all duration-100 active:scale-90 active:translate-y-1 ${
                              isOn
                                ? 'bg-gradient-to-b from-slate-200 to-slate-400 border-white text-slate-900 shadow-cyan-900/60'
                                : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 text-slate-400'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[9px] font-mono font-bold mt-1.5 px-2 py-0.5 rounded border transition-all ${
                              isOn
                                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {isOn ? '● ACTIVE (dp[1]=1)' : '○ BYPASS (dp[1]=0)'}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stompbox 3: Slapback Delay (dp[2]) */}
                  {(() => {
                    const isOn = (config.dspParam2 ?? 0) > 0;
                    return (
                      <div
                        onClick={() => onChange({ dspParam2: isOn ? 0 : 1 })}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all duration-200 select-none relative group ${
                          isOn
                            ? 'bg-gradient-to-b from-emerald-950/90 via-emerald-900/40 to-slate-950 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
                            : 'bg-slate-900/90 border-slate-800 opacity-70 hover:opacity-90'
                        }`}
                      >
                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-300">
                            ECHO BUFFER
                          </span>
                          <div className="relative flex items-center justify-center">
                            {isOn && (
                              <div className="absolute w-6 h-6 rounded-full bg-emerald-400/40 animate-ping" />
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 shadow-md ${
                                isOn
                                  ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_15px_#34d399]'
                                  : 'bg-emerald-950 border-emerald-900/80'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Top Knobs */}
                        <div className="flex justify-around py-1">
                          {['TIME', 'REPEAT', 'LEVEL'].map((knob, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center relative shadow-inner">
                                <div className={`w-0.5 h-2 rounded-full ${isOn ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                              </div>
                              <span className="text-[7px] font-mono text-slate-400">{knob}</span>
                            </div>
                          ))}
                        </div>

                        <div className="text-center">
                          <div className="text-xs font-mono font-extrabold text-emerald-300 tracking-wider">
                            16K DELAY
                          </div>
                          <div className="text-[8px] text-slate-400 font-mono mt-0.5">
                            Slapback Echo Loop
                          </div>
                        </div>

                        <div className="flex flex-col items-center pt-1">
                          <div
                            className={`w-12 h-8 rounded-lg border-2 shadow-inner flex items-center justify-center transition-all duration-100 active:scale-90 active:translate-y-1 ${
                              isOn
                                ? 'bg-gradient-to-b from-slate-200 to-slate-400 border-white text-slate-900 shadow-emerald-900/60'
                                : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 text-slate-400'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[9px] font-mono font-bold mt-1.5 px-2 py-0.5 rounded border transition-all ${
                              isOn
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {isOn ? '● ACTIVE (dp[2]=1)' : '○ BYPASS (dp[2]=0)'}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-600 text-[8px] font-mono leading-none">
                          <span>&#10010;</span>
                          <span>&#10010;</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Case 2: Vintage Leslie 122 Rotary Cabinet */}
            {config.globalDSPPatch === GlobalDSPPatch.DSP_HAMMOND_LESLIE && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <RotateCw
                      className="w-4 h-4 text-purple-400 animate-spin"
                      style={{ animationDuration: config.dspParam0 === 2 ? '0.6s' : '2.5s' }}
                    />
                    <span className="text-xs font-mono font-bold text-purple-300 uppercase">
                      Leslie 122 Rotary Speaker
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/40">
                    {config.dspParam0 === 2 ? 'Fast Tremolo' : config.dspParam0 === 1 ? 'Slow Chorale' : 'Brake (Stop)'}
                  </span>
                </div>

                {/* Animated Rotating Horn & Drum Graphic */}
                <div className="bg-slate-900 p-3 rounded-lg border border-purple-900/50 flex items-center justify-around gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full border-2 border-purple-500/60 bg-slate-950 flex items-center justify-center relative overflow-hidden shadow-inner">
                      <div
                        className="w-8 h-2 bg-purple-400 rounded-full transition-transform"
                        style={{ transform: `rotate(${rotorAngle}deg)` }}
                      />
                      <div className="w-2 h-2 rounded-full bg-purple-200 z-10" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">Treble Horn</span>
                  </div>

                  <div className="text-center">
                    <div className="text-xs font-mono font-bold text-purple-200">
                      {config.dspParam0 === 2 ? '690 cHz Rotor' : config.dspParam0 === 1 ? '80 cHz Rotor' : 'Rotor Stopped'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Crossover LP + Doppler Mod
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full border-2 border-amber-600/60 bg-slate-950 flex items-center justify-center relative overflow-hidden shadow-inner">
                      <div
                        className="w-10 h-3 bg-amber-500/80 rounded transition-transform"
                        style={{ transform: `rotate(${rotorAngle * 0.8}deg)` }}
                      />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-200 z-10" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">Bass Drum</span>
                  </div>
                </div>

                {/* 3 Dedicated Speed State Stomp Buttons */}
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    Rotor Speed Switch (dp[0]: 0 = Stop, 1 = Chorale, 2 = Tremolo)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 0, label: '0: STOP', sub: 'Brake Off' },
                      { val: 1, label: '1: CHORALE', sub: 'Slow Swirl' },
                      { val: 2, label: '2: TREMOLO', sub: 'Fast Rotary' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        onClick={() => onChange({ dspParam0: s.val })}
                        className={`py-2 px-1 rounded-lg border text-center transition cursor-pointer ${
                          config.dspParam0 === s.val
                            ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold">{s.label}</div>
                        <div className="text-[9px] opacity-80">{s.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reverb Slider (dp[1]) */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-purple-200 mb-1">
                    <span>dp[1]: Spring & Room Reverb Mix (1-255)</span>
                    <span className="font-bold">{config.dspParam1 || 140}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="255"
                    value={config.dspParam1 || 140}
                    onChange={(e) => onChange({ dspParam1: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="h-2 bg-slate-900 rounded-full border border-slate-800 mt-1 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-75"
                      style={{ width: `${((config.dspParam1 || 140) / 255) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Case 3: Clean Bypass */}
            {config.globalDSPPatch === GlobalDSPPatch.NONE && (
              <div className="py-4 text-center space-y-2">
                <p className="text-xs text-slate-400 font-mono">
                  Sinal direto e limpo direto dos mixers de voz para a simulação do DAC de 16-bit.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => handleGlobalDSPSelect(GlobalDSPPatch.DSP_PEDALBOARD)}
                    className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-mono font-bold rounded-lg transition cursor-pointer shadow-sm"
                  >
                    Ativar Pedalboard FX
                  </button>
                  <button
                    onClick={() => handleGlobalDSPSelect(GlobalDSPPatch.DSP_HAMMOND_LESLIE)}
                    className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-lg transition cursor-pointer shadow-sm"
                  >
                    Ativar Leslie 122
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
