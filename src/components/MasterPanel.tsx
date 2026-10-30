import React from 'react';
import { BusFXPatch, GlobalDSPPatch } from '../audio/types';
import { Volume2, Disc, Filter, Sparkles } from 'lucide-react';

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
  const handleGlobalDSPSelect = (patch: GlobalDSPPatch) => {
    if (patch === GlobalDSPPatch.DSP_HAMMOND_LESLIE) {
      onChange({ globalDSPPatch: patch, dspParam0: 2, dspParam1: 140 }); // Fast rotor + 140 reverb
    } else if (patch === GlobalDSPPatch.DSP_PEDALBOARD) {
      onChange({ globalDSPPatch: patch, dspParam0: 1, dspParam1: 1, dspParam2: 1 }); // All 3 pedals ON
    } else {
      onChange({ globalDSPPatch: patch });
    }
  };

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
            </div>

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
            </div>
          </div>
        </div>

        {/* Section 2: Modular Bus 1 Filter FX (ep[0..4]) */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            Bus 1: Resonant Filter FX (ep[0..4])
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
                <option value={BusFXPatch.FX_BIQUAD_FILTER}>ESP32Patches::FX_BiquadFilter (TDF-II Q28)</option>
                <option value={BusFXPatch.FX_BIQUAD_FILTER_FAST}>ESP32Patches::FX_BiquadFilterFast (DF-I)</option>
              </select>
            </div>

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

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 mb-1 block">ep[1]: Mode</label>
                <select
                  value={config.bus1FilterMode}
                  onChange={(e) => onChange({ bus1FilterMode: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-slate-200"
                >
                  <option value={0}>0: LPF</option>
                  <option value={1}>1: HPF</option>
                  <option value={2}>2: BPF</option>
                  <option value={3}>3: Notch</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 mb-1 block">ep[3]: Unit</label>
                <select
                  value={config.bus1BwMode ?? 0}
                  onChange={(e) => onChange({ bus1BwMode: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-slate-200"
                >
                  <option value={0}>0: Q * 100</option>
                  <option value={1}>1: BW (Hz)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 mb-1 block">
                  ep[2]: {(config.bus1BwMode ?? 0) === 1 ? 'BW Hz' : 'Q*100'}
                </label>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  step="10"
                  value={config.bus1ResonanceQ}
                  onChange={(e) => onChange({ bus1ResonanceQ: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
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
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>Bus Mix Level</span>
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

        {/* Section 3: Global Master DSP (1:1 dp[]) */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Global Master DSP Callback
          </h3>

          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Master DSP Algorithm (setCustomDSP)
              </label>
              <select
                value={config.globalDSPPatch}
                onChange={(e) => handleGlobalDSPSelect(Number(e.target.value) as GlobalDSPPatch)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-purple-400 font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value={GlobalDSPPatch.NONE}>Disabled (Clean Output)</option>
                <option value={GlobalDSPPatch.DSP_HAMMOND_LESLIE}>ESP32Patches::DSP_HammondLeslie (Rotary + Reverb)</option>
                <option value={GlobalDSPPatch.DSP_PEDALBOARD}>ESP32Patches::DSP_Pedalboard (Comp/OD + Chorus + Delay)</option>
              </select>
            </div>

            {config.globalDSPPatch === GlobalDSPPatch.DSP_HAMMOND_LESLIE && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[10px] font-mono text-purple-300 block mb-1">
                    dp[0]: Leslie Rotor Speed State
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { val: 0, label: '0: Stop' },
                      { val: 1, label: '1: Chorale' },
                      { val: 2, label: '2: Tremolo' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        onClick={() => onChange({ dspParam0: s.val })}
                        className={`py-1.5 text-xs font-mono font-bold rounded border cursor-pointer ${
                          config.dspParam0 === s.val
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200 mb-1">
                    <span>dp[1]: Spring/Room Reverb Mix (1-255)</span>
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
                </div>
              </div>
            )}

            {config.globalDSPPatch === GlobalDSPPatch.DSP_PEDALBOARD && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-purple-300 font-bold block uppercase">
                  Stompbox Chain (dp[0..2] Boolean Switches)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'dspParam0' as const, label: 'dp[0]: Overdrive', sub: 'Comp+Drive+Cab' },
                    { key: 'dspParam1' as const, label: 'dp[1]: Chorus', sub: 'Mod Delay' },
                    { key: 'dspParam2' as const, label: 'dp[2]: Delay', sub: '16k Slapback' },
                  ].map((pedal) => {
                    const isOn = (config[pedal.key] ?? 0) > 0;
                    return (
                      <button
                        key={pedal.key}
                        onClick={() => onChange({ [pedal.key]: isOn ? 0 : 1 })}
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          isOn
                            ? 'bg-purple-950/60 border-purple-400 text-purple-200'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="text-[11px] font-mono font-bold">{pedal.label}</div>
                        <div className="text-[9px] font-mono opacity-80">{pedal.sub}</div>
                        <div className={`mt-1 text-[10px] font-mono font-bold ${isOn ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isOn ? '● ACTIVE (1)' : '○ BYPASS (0)'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {config.globalDSPPatch === GlobalDSPPatch.NONE && (
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
