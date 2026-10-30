import React from 'react';
import { BusFXPatch, GlobalDSPPatch } from '../audio/types';
import { Volume2, Disc, Filter, Sparkles } from 'lucide-react';

export interface MasterConfig {
  masterVol: number;
  bitcrush: number;
  controlRateHz: number;
  bus1FXPatch: BusFXPatch;
  bus1CutoffHz: number;
  bus1FilterMode: number;
  bus1ResonanceQ: number;
  bus1WetMix: number;
  bus1MixLevel: number;
  globalDSPPatch: GlobalDSPPatch;
  dspParam0: number; // e.g. Leslie speed / Pedal drive
  dspParam1: number; // e.g. Leslie depth / Delay time
  dspParam2: number; // e.g. Delay feedback
  dspParam3: number; // e.g. Tone
}

interface MasterPanelProps {
  config: MasterConfig;
  onChange: (updated: Partial<MasterConfig>) => void;
}

export const MasterPanel: React.FC<MasterPanelProps> = ({ config, onChange }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Disc className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
          Master Output, Modular Bus FX & Global DSP
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Section 1: Master Controls */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            Master Hardware Bus 0
          </h3>

          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            {/* Master Volume (0-255) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Master Volume (0-255)</span>
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
            </div>

            {/* Master Bitcrush (0-32 bits) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Master Bitcrush (Bits)</span>
                <span className={`font-bold ${config.bitcrush > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {config.bitcrush === 0 ? 'Disabled (16-bit DAC)' : `${config.bitcrush} Bits`}
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
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Hardware bitwise mask (0 = off, 4-8 = retro chiptune)
              </span>
            </div>

            {/* Control Rate Hz */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Control Rate Hz</span>
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
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                LFO, Arpeggio, and Slide tick evaluation rate
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Modular Bus 1 Filter FX */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            Bus 1: Resonant Filter FX
          </h3>

          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Filter FX Slot 0
              </label>
              <select
                value={config.bus1FXPatch}
                onChange={(e) => onChange({ bus1FXPatch: Number(e.target.value) as BusFXPatch })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-blue-400 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value={BusFXPatch.NONE}>FX_NONE (Bypass)</option>
                <option value={BusFXPatch.FX_BIQUAD_FILTER}>ESP32Patches::FX_BiquadFilter (Standard)</option>
                <option value={BusFXPatch.FX_BIQUAD_FILTER_FAST}>ESP32Patches::FX_BiquadFilterFast (Direct Form I)</option>
              </select>
            </div>

            {/* Cutoff Frequency */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Cutoff Frequency</span>
                <span className="text-blue-400 font-bold">{config.bus1CutoffHz} Hz</span>
              </div>
              <input
                type="range"
                min="50"
                max="10000"
                step="25"
                value={config.bus1CutoffHz}
                onChange={(e) => onChange({ bus1CutoffHz: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Filter Mode */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 mb-1 block">Mode</label>
                <select
                  value={config.bus1FilterMode}
                  onChange={(e) => onChange({ bus1FilterMode: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                >
                  <option value={0}>0: Low Pass (LPF)</option>
                  <option value={1}>1: High Pass (HPF)</option>
                  <option value={2}>2: Band Pass (BPF)</option>
                  <option value={3}>3: Notch Filter</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 mb-1 block">Resonance Q</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  value={config.bus1ResonanceQ}
                  onChange={(e) => onChange({ bus1ResonanceQ: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
            </div>

            {/* Wet Mix & Bus Mix */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>Wet (0-255)</span>
                  <span className="text-blue-300 font-bold">{config.bus1WetMix}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={config.bus1WetMix}
                  onChange={(e) => onChange({ bus1WetMix: Number(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>Bus Level</span>
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

        {/* Section 3: Global Master DSP */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Global Master DSP Callback
          </h3>

          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Master DSP Algorithm
              </label>
              <select
                value={config.globalDSPPatch}
                onChange={(e) => onChange({ globalDSPPatch: Number(e.target.value) as GlobalDSPPatch })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-purple-400 font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value={GlobalDSPPatch.NONE}>Disabled (Clean Output)</option>
                <option value={GlobalDSPPatch.DSP_HAMMOND_LESLIE}>ESP32Patches::DSP_HammondLeslie (Rotary Speaker)</option>
                <option value={GlobalDSPPatch.DSP_PEDALBOARD}>ESP32Patches::DSP_Pedalboard (Overdrive + Delay)</option>
              </select>
            </div>

            {config.globalDSPPatch !== GlobalDSPPatch.NONE ? (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <span className="text-[10px] font-mono text-purple-300 font-bold block uppercase">
                  Global Parameters (dp[0] .. dp[3])
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">dp[0] (Drive / Speed)</label>
                    <input
                      type="number"
                      value={config.dspParam0}
                      onChange={(e) => onChange({ dspParam0: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">dp[1] (Depth / Time)</label>
                    <input
                      type="number"
                      value={config.dspParam1}
                      onChange={(e) => onChange({ dspParam1: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">dp[2] (Feedback)</label>
                    <input
                      type="number"
                      value={config.dspParam2}
                      onChange={(e) => onChange({ dspParam2: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">dp[3] (Tone)</label>
                    <input
                      type="number"
                      value={config.dspParam3}
                      onChange={(e) => onChange({ dspParam3: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono py-2">
                Pure dry C++ mixer output straight into hardware DAC simulation.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
