import React, { useState } from 'react';
import { WaveType, CustomWavePatch } from '../audio/types';
import { Sliders, Zap, Waves, Activity, Sparkles, Code2, RotateCcw, Radio, Info } from 'lucide-react';
import { EnvelopeVisualizer } from './EnvelopeVisualizer';

export interface VoiceConfig {
  waveType: WaveType;
  customPatch: CustomWavePatch;
  attackMs: number;
  decayMs: number;
  sustain8Bit: number;
  releaseMs: number;
  smoothEnv: boolean;
  pulseWidth8Bit: number;
  startPhaseDeg: number;
  vibratoRateCentiHz: number;
  vibratoDepthCentiHz: number;
  tremoloRateCentiHz: number;
  tremoloDepth8Bit: number;
  portamentoMs: number;
  targetBus: number;
  polyphony: number;
  customParam0: number; // e.g. Cutoff / Ratio Int
  customParam1: number; // e.g. Q / Ratio Frac / Mod Index
  customParam2?: number; // e.g. Filter mode / Mod Index Base
  customParam3?: number; // e.g. Hammond preset / Mod Decay
}

interface VoicePanelProps {
  config: VoiceConfig;
  onChange: (updated: Partial<VoiceConfig>) => void;
  activeEnvLevel?: number;
  onOpenCodeExport?: () => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  config,
  onChange,
  activeEnvLevel,
  onOpenCodeExport,
}) => {
  const [mutateCategory, setMutateCategory] = useState<'any' | 'lead' | 'bass' | 'pad' | 'fm' | 'chiptune'>('any');

  // Smart Musical Randomizer / Sound Mutator
  const handleMutateSound = () => {
    let newPatch: Partial<VoiceConfig> = {};

    switch (mutateCategory) {
      case 'bass':
        newPatch = {
          waveType: Math.random() > 0.5 ? WaveType.WAVE_SAW : WaveType.WAVE_PULSE,
          customPatch: Math.random() > 0.6 ? CustomWavePatch.AA_SAW : CustomWavePatch.BASIC,
          attackMs: Math.floor(Math.random() * 20) + 2,
          decayMs: Math.floor(Math.random() * 250) + 80,
          sustain8Bit: Math.floor(Math.random() * 100) + 40,
          releaseMs: Math.floor(Math.random() * 150) + 60,
          smoothEnv: true,
          pulseWidth8Bit: Math.floor(Math.random() * 80) + 30,
          vibratoDepthCentiHz: 0,
          tremoloDepth8Bit: 0,
          portamentoMs: Math.random() > 0.5 ? 60 : 0,
          targetBus: 1, // route to filter bus
        };
        break;

      case 'lead':
        newPatch = {
          waveType: WaveType.WAVE_SAW,
          customPatch: Math.random() > 0.5 ? CustomWavePatch.AA_SAW : CustomWavePatch.DSP_BIQUAD_FAST,
          attackMs: Math.floor(Math.random() * 40) + 5,
          decayMs: Math.floor(Math.random() * 300) + 100,
          sustain8Bit: Math.floor(Math.random() * 80) + 160,
          releaseMs: Math.floor(Math.random() * 400) + 120,
          smoothEnv: true,
          vibratoRateCentiHz: 550,
          vibratoDepthCentiHz: Math.floor(Math.random() * 200) + 80,
          portamentoMs: Math.floor(Math.random() * 80) + 40,
          customParam0: Math.floor(Math.random() * 4000) + 1500, // Cutoff
          customParam1: Math.floor(Math.random() * 200) + 100,  // Q
        };
        break;

      case 'pad':
        newPatch = {
          waveType: WaveType.WAVE_SAW,
          customPatch: CustomWavePatch.AA_SAW,
          attackMs: Math.floor(Math.random() * 600) + 300,
          decayMs: Math.floor(Math.random() * 800) + 400,
          sustain8Bit: Math.floor(Math.random() * 60) + 180,
          releaseMs: Math.floor(Math.random() * 1200) + 600,
          smoothEnv: true,
          vibratoRateCentiHz: 450,
          vibratoDepthCentiHz: 60,
          tremoloRateCentiHz: 300,
          tremoloDepth8Bit: 40,
          portamentoMs: 0,
          polyphony: 8,
        };
        break;

      case 'fm':
        newPatch = {
          customPatch: CustomWavePatch.FM_CUSTOM,
          attackMs: Math.floor(Math.random() * 30) + 5,
          decayMs: Math.floor(Math.random() * 400) + 100,
          sustain8Bit: Math.floor(Math.random() * 120) + 40,
          releaseMs: Math.floor(Math.random() * 400) + 150,
          smoothEnv: true,
          customParam0: [1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 6)], // Harmonic ratio
          customParam1: Math.floor(Math.random() * 50),
          customParam2: Math.floor(Math.random() * 80) + 20, // Mod index
          customParam3: Math.floor(Math.random() * 150),     // Mod decay
        };
        break;

      case 'chiptune':
        newPatch = {
          waveType: WaveType.WAVE_PULSE,
          customPatch: CustomWavePatch.BASIC,
          attackMs: 0,
          decayMs: Math.floor(Math.random() * 150) + 40,
          sustain8Bit: Math.floor(Math.random() * 150) + 50,
          releaseMs: Math.floor(Math.random() * 120) + 20,
          smoothEnv: false,
          pulseWidth8Bit: [32, 64, 128, 192][Math.floor(Math.random() * 4)],
          vibratoRateCentiHz: 800,
          vibratoDepthCentiHz: Math.random() > 0.5 ? 150 : 0,
          portamentoMs: Math.random() > 0.7 ? 50 : 0,
        };
        break;

      default:
        // Any / Eclectic Sound
        newPatch = {
          waveType: [WaveType.WAVE_SAW, WaveType.WAVE_PULSE, WaveType.WAVE_TRIANGLE, WaveType.WAVE_SINE][Math.floor(Math.random() * 4)],
          customPatch: [CustomWavePatch.BASIC, CustomWavePatch.AA_SAW, CustomWavePatch.AA_PULSE, CustomWavePatch.DSP_BIQUAD_FAST, CustomWavePatch.FM_CUSTOM][Math.floor(Math.random() * 5)],
          attackMs: Math.floor(Math.random() * 350) + 10,
          decayMs: Math.floor(Math.random() * 450) + 50,
          sustain8Bit: Math.floor(Math.random() * 180) + 40,
          releaseMs: Math.floor(Math.random() * 600) + 100,
          smoothEnv: Math.random() > 0.3,
          pulseWidth8Bit: Math.floor(Math.random() * 200) + 25,
          vibratoRateCentiHz: Math.floor(Math.random() * 600) + 200,
          vibratoDepthCentiHz: Math.random() > 0.6 ? Math.floor(Math.random() * 200) + 50 : 0,
        };
        break;
    }

    onChange(newPatch);
  };

  const handleResetSound = () => {
    onChange({
      waveType: WaveType.WAVE_SAW,
      customPatch: CustomWavePatch.AA_SAW,
      attackMs: 15,
      decayMs: 80,
      sustain8Bit: 200,
      releaseMs: 200,
      smoothEnv: true,
      pulseWidth8Bit: 128,
      startPhaseDeg: 0,
      vibratoRateCentiHz: 500,
      vibratoDepthCentiHz: 0,
      tremoloRateCentiHz: 500,
      tremoloDepth8Bit: 0,
      portamentoMs: 0,
      targetBus: 0,
      customParam0: 1600,
      customParam1: 200,
      customParam2: 0,
      customParam3: 0,
    });
  };

  const pulseDutyPercent = ((config.pulseWidth8Bit / 255) * 100).toFixed(1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Sound Design Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
              Voice Generator & Timbre Design Studio
            </h2>
            <span className="text-[11px] font-mono text-slate-500 block">
              Danilo Gabriel ESP32Synth C++ Core • Fixed-Point Q28 DSP
            </span>
          </div>
        </div>

        {/* Timbre Generation Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Mutator Tool */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
            <select
              value={mutateCategory}
              onChange={(e) => setMutateCategory(e.target.value as any)}
              className="bg-transparent text-[11px] font-mono text-slate-300 px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="any">🎲 Any Style</option>
              <option value="lead">⚡ Lead Solo</option>
              <option value="bass">🎸 Deep Bass</option>
              <option value="pad">🌌 Lush Pad</option>
              <option value="fm">🔮 2-Op FM</option>
              <option value="chiptune">👾 8-Bit Retro</option>
            </select>
            <button
              onClick={handleMutateSound}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
              title="Generate new sound parameters"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mutate</span>
            </button>
          </div>

          {/* Reset Baseline */}
          <button
            onClick={handleResetSound}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono flex items-center transition cursor-pointer"
            title="Reset to Init Preset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Export C++ Arduino Sketch */}
          {onOpenCodeExport && (
            <button
              onClick={onOpenCodeExport}
              className="px-3 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Export C++ Arduino sketch for ESP32 board"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Export .ino</span>
            </button>
          )}

          {/* Polyphony Selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono pl-2 border-l border-slate-800">
            <span className="text-slate-500">Poly:</span>
            <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
              {[1, 4, 8, 16].map((count) => (
                <button
                  key={count}
                  onClick={() => onChange({ polyphony: count })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    config.polyphony === count
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}V
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Column 1: Waveform & Patch Engine */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            1. Oscillator Core & Synthesis Patches
          </h3>

          <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Basic Fixed-Point Waveform
              </label>
              <select
                value={config.waveType}
                onChange={(e) => {
                  const val = Number(e.target.value) as WaveType;
                  onChange({ waveType: val, customPatch: CustomWavePatch.BASIC });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={WaveType.WAVE_SAW}>WAVE_SAW (-3) - Raw Sawtooth (Fixed-Point)</option>
                <option value={WaveType.WAVE_PULSE}>WAVE_PULSE (-4) - Pulse / Square Wave</option>
                <option value={WaveType.WAVE_SINE}>WAVE_SINE (-1) - Interpolated Sine LUT</option>
                <option value={WaveType.WAVE_TRIANGLE}>WAVE_TRIANGLE (-2) - Triangle Wave</option>
                <option value={WaveType.WAVE_NOISE}>WAVE_NOISE (-5) - Linear PRNG Noise</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-emerald-400 font-bold mb-1 flex items-center justify-between">
                <span>Advanced C++ DSP Patch Algorithm</span>
                <span className="text-[10px] text-slate-500 font-normal">ESP32Synth_Patches.hpp</span>
              </label>
              <select
                value={config.customPatch}
                onChange={(e) => onChange({ customPatch: Number(e.target.value) as CustomWavePatch })}
                className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 font-semibold focus:outline-none focus:border-emerald-500"
              >
                <option value={CustomWavePatch.BASIC}>[None - Use Basic Waveform Above]</option>
                <option value={CustomWavePatch.AA_SAW}>ESP32Patches::AA_Saw (PolyBLEP Anti-Aliased Saw)</option>
                <option value={CustomWavePatch.AA_PULSE}>ESP32Patches::AA_Pulse (PolyBLEP Anti-Aliased Pulse)</option>
                <option value={CustomWavePatch.DSP_BIQUAD_FAST}>ESP32Patches::DSP_BiquadOscFast (Direct Form I Filtered Osc)</option>
                <option value={CustomWavePatch.DSP_BIQUAD}>ESP32Patches::DSP_BiquadOsc (64-bit High-Precision Osc)</option>
                <option value={CustomWavePatch.FM_CUSTOM}>ESP32Patches::FM_Custom (2-Op FM Synthesis)</option>
                <option value={CustomWavePatch.HAMMOND_B3}>ESP32Patches::HammondB3 (9-Drawbar Tonewheel Organ)</option>
                <option value={CustomWavePatch.EKS_GUITAR}>ESP32Patches::EKS_Guitar (Karplus-Strong Plucked String)</option>
              </select>
            </div>

            {/* Pulse Width Slider with Duty Cycle Mini-Visualizer */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Pulse Width (Duty Cycle)</span>
                <span className="text-emerald-400 font-bold">
                  {config.pulseWidth8Bit} / 255 ({pulseDutyPercent}%)
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="253"
                value={config.pulseWidth8Bit}
                onChange={(e) => onChange({ pulseWidth8Bit: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />

              {/* Duty Cycle Mini-Waveform Display */}
              <div className="h-4 bg-slate-900 rounded border border-slate-800 mt-1.5 flex items-center px-1 overflow-hidden">
                <div
                  className="h-2.5 bg-emerald-500/80 rounded-sm transition-all duration-75"
                  style={{ width: `${pulseDutyPercent}%` }}
                />
                <div className="h-0.5 flex-1 bg-slate-700" />
              </div>
            </div>

            {/* Start Phase Angle */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Initial Phase Angle</span>
                <span className="text-slate-300 font-bold">{config.startPhaseDeg}&deg;</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                value={config.startPhaseDeg}
                onChange={(e) => onChange({ startPhaseDeg: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Voice Audio Bus Routing */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                Target Audio Bus (Bus Routing)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((busId) => (
                  <button
                    key={busId}
                    onClick={() => onChange({ targetBus: busId })}
                    className={`py-1.5 text-xs font-mono font-bold rounded border transition-all cursor-pointer ${
                      config.targetBus === busId
                        ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {busId === 0 ? 'Bus 0 (Dry)' : `Bus ${busId}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: ADSR Envelope (Interactive Visualizer + Q28 Sub-Block Math) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              2. Q28 Sub-Block ADSR Envelope
            </h3>

            <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.smoothEnv}
                onChange={(e) => onChange({ smoothEnv: e.target.checked })}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              Smooth Env (RC Filter)
            </label>
          </div>

          <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800">
            {/* Real SVG Visual Envelope Curve */}
            <EnvelopeVisualizer
              attackMs={config.attackMs}
              decayMs={config.decayMs}
              sustain8Bit={config.sustain8Bit}
              releaseMs={config.releaseMs}
              smoothEnv={config.smoothEnv}
              activeEnvLevel={activeEnvLevel}
            />

            {/* Attack Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Attack Time (ms)</span>
                <span className="text-emerald-400 font-bold">{config.attackMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="5"
                value={config.attackMs}
                onChange={(e) => onChange({ attackMs: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Decay Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Decay Time (ms)</span>
                <span className="text-emerald-400 font-bold">{config.decayMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="5"
                value={config.decayMs}
                onChange={(e) => onChange({ decayMs: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Sustain Level Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Sustain Level (0 - 255)</span>
                <span className="text-emerald-400 font-bold">
                  {config.sustain8Bit} / 255 ({((config.sustain8Bit / 255) * 100).toFixed(0)}%)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={config.sustain8Bit}
                onChange={(e) => onChange({ sustain8Bit: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Release Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Release Time (ms)</span>
                <span className="text-emerald-400 font-bold">{config.releaseMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="4000"
                step="10"
                value={config.releaseMs}
                onChange={(e) => onChange({ releaseMs: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Portamento Glide Slider */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Portamento Pitch Glide (slideFreqTo)</span>
                <span className="text-blue-400 font-bold">{config.portamentoMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="10"
                value={config.portamentoMs}
                onChange={(e) => onChange({ portamentoMs: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Specialized Sound Design Parameters & LFOs */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            3. Patch Sound Design & Modulation
          </h3>

          <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800">
            {/* CONTEXT-SENSITIVE SOUND DESIGN EDITORS */}
            {config.customPatch === CustomWavePatch.FM_CUSTOM && (
              <div className="p-3 bg-purple-950/30 border border-purple-800/60 rounded-lg space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 font-bold">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  2-Operator FM Synthesis Designer
                </div>

                {/* Carrier / Modulator Ratio */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200">
                    <span>Harmonic Ratio (C:M)</span>
                    <span className="font-bold">{config.customParam0 || 1}:1</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={config.customParam0 || 1}
                    onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>1:1 Organ</span>
                    <span>2:1 Rhodes</span>
                    <span>3:1 Bell</span>
                    <span>5:1 Brass</span>
                  </div>
                </div>

                {/* Modulation Index */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200">
                    <span>Modulation Index (Brightness)</span>
                    <span className="font-bold">{config.customParam1 || 30}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.customParam1 || 30}
                    onChange={(e) => onChange({ customParam1: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {(config.customPatch === CustomWavePatch.DSP_BIQUAD ||
              config.customPatch === CustomWavePatch.DSP_BIQUAD_FAST) && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-lg space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-300 font-bold">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Resonant Oscillator Filter (Biquad)
                </div>

                {/* Cutoff Frequency */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-emerald-200">
                    <span>Oscillator Cutoff Frequency</span>
                    <span className="font-bold">{config.customParam0 || 1600} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="12000"
                    step="50"
                    value={config.customParam0 || 1600}
                    onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* Resonance Q */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-emerald-200">
                    <span>Resonance Q</span>
                    <span className="font-bold">{((config.customParam1 || 200) / 100).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="800"
                    step="10"
                    value={config.customParam1 || 200}
                    onChange={(e) => onChange({ customParam1: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {config.customPatch === CustomWavePatch.HAMMOND_B3 && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 font-bold">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Hammond B3 Tonewheel Drawbars
                </div>
                <div className="text-[10px] font-mono text-slate-400">Preset Registration:</div>
                <select
                  value={config.customParam0 || 0}
                  onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-amber-700/60 rounded p-1.5 text-xs font-mono text-amber-200"
                >
                  <option value={0}>88 8000 000 (Warm Jazz Organ)</option>
                  <option value={1}>88 8400 000 (Jimmy Smith Gospel)</option>
                  <option value={2}>88 8888 888 (Full Rock / Jon Lord)</option>
                  <option value={3}>00 0008 888 (High Whistle Flutes)</option>
                  <option value={4}>88 8000 008 (Bright Percussive Staccato)</option>
                </select>
                <div className="flex justify-between text-[9px] font-mono text-amber-400/80 pt-1">
                  <span>16'</span>
                  <span>5⅓'</span>
                  <span>8'</span>
                  <span>4'</span>
                  <span>2⅔'</span>
                  <span>2'</span>
                  <span>1⅗'</span>
                  <span>1⅓'</span>
                  <span>1'</span>
                </div>
              </div>
            )}

            {config.customPatch === CustomWavePatch.EKS_GUITAR && (
              <div className="p-3 bg-orange-950/30 border border-orange-800/60 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-orange-300 font-bold">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                  Karplus-Strong Plucked String
                </div>
                <p className="text-[10px] font-mono text-slate-400 leading-tight">
                  Simulates physical string vibration with acoustic pick impulse and internal feedback loop. Best played staccato or with arpeggio.
                </p>
              </div>
            )}

            {/* Vibrato LFO Controls */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Vibrato Rate (CentiHz)</span>
                <span className="text-blue-300 font-bold">
                  {config.vibratoRateCentiHz} cHz ({(config.vibratoRateCentiHz / 100).toFixed(1)} Hz)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={config.vibratoRateCentiHz}
                onChange={(e) => onChange({ vibratoRateCentiHz: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Vibrato Depth (CentiHz)</span>
                <span className="text-blue-300 font-bold">
                  {config.vibratoDepthCentiHz} cHz (&plusmn;{(config.vibratoDepthCentiHz / 100).toFixed(1)} Hz)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={config.vibratoDepthCentiHz}
                onChange={(e) => onChange({ vibratoDepthCentiHz: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Tremolo LFO Controls */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Tremolo Rate (CentiHz)</span>
                <span className="text-amber-300 font-bold">
                  {config.tremoloRateCentiHz} cHz ({(config.tremoloRateCentiHz / 100).toFixed(1)} Hz)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={config.tremoloRateCentiHz}
                onChange={(e) => onChange({ tremoloRateCentiHz: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Tremolo Depth (0 - 255)</span>
                <span className="text-amber-300 font-bold">{config.tremoloDepth8Bit}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={config.tremoloDepth8Bit}
                onChange={(e) => onChange({ tremoloDepth8Bit: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
