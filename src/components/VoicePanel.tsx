import React, { useState } from 'react';
import { WaveType, CustomWavePatch, EnvState, BitDepth } from '../audio/types';
import { WavetableEditor } from './WavetableEditor';
import {
  Sliders,
  Zap,
  Waves,
  Activity,
  Sparkles,
  Code2,
  RotateCcw,
  Radio,
  Flame,
  Gauge,
  Music,
  Square,
  TrendingUp,
  Volume2,
  CheckCircle2,
  Lightbulb,
  Info,
} from 'lucide-react';
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
  customParam0: number; // Biquad: Wave(0..2) | FM: RatioInt | Hammond: Preset(0..4)
  customParam1: number; // Biquad: Cutoff Hz  | FM: RatioFrac(0..99)
  customParam2: number; // Biquad: Q * 100    | FM: ModIndexBase
  customParam3: number; // Biquad: Mode(0..3) | FM: ModDecay
}

interface VoicePanelProps {
  config: VoiceConfig;
  onChange: (updated: Partial<VoiceConfig>) => void;
  activeEnvLevel?: number;
  activeEnvState?: EnvState;
  onOpenCodeExport?: () => void;
  customWavetable?: number[];
  wavetableDepth?: BitDepth;
  onWavetableChange?: (samples: number[], depth: BitDepth) => void;
}

interface AlgorithmCardDef {
  id: CustomWavePatch;
  name: string;
  cppSymbol: string;
  cpuTag: string;
  charTag: string;
  description: string;
  usageTip: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderActive: string;
}

const ALGORITHM_CARDS: AlgorithmCardDef[] = [
  {
    id: CustomWavePatch.BASIC,
    name: 'Basic Hardware Osc',
    cppSymbol: 'synth.setWave(v, type)',
    cpuTag: '~0.8% CPU',
    charTag: 'Raw Integer',
    description: 'Osciladores nativos de 16-bit com formas de onda inteiras básicas.',
    usageTip: 'Dica: Ideal para jogos retro 8-bit, chiptunes e uso com menor sobrecarga na CPU do ESP32.',
    icon: Waves,
    accentColor: 'text-slate-300',
    borderActive: 'border-slate-400 bg-slate-900 shadow-slate-900/50',
  },
  {
    id: CustomWavePatch.AA_SAW,
    name: 'AA_Saw (PolyBLEP)',
    cppSymbol: 'ESP32Patches::AA_Saw',
    cpuTag: '~1.2% CPU',
    charTag: 'Anti-Aliased',
    description: 'Dente de serra com suavização PolyBLEP em ponto fixo Q15 nas descontinuidades.',
    usageTip: 'Dica: Perfeito para leads cortantes e acordes sem chiado digital mesmo em notas ultra agudas.',
    icon: TrendingUp,
    accentColor: 'text-emerald-400',
    borderActive: 'border-emerald-400 bg-emerald-950/40 shadow-emerald-900/40',
  },
  {
    id: CustomWavePatch.AA_PULSE,
    name: 'AA_Pulse (PolyBLEP)',
    cppSymbol: 'ESP32Patches::AA_Pulse',
    cpuTag: '~1.4% CPU',
    charTag: 'PWM Anti-Aliased',
    description: 'Onda pulso com bordas PolyBLEP duplas e modulação de largura de pulso de 8-bit.',
    usageTip: 'Dica: Excelente para baixos encorpados e timbres com PWM clássicos de sintetizadores analógicos.',
    icon: Square,
    accentColor: 'text-emerald-400',
    borderActive: 'border-emerald-400 bg-emerald-950/40 shadow-emerald-900/40',
  },
  {
    id: CustomWavePatch.DSP_BIQUAD_FAST,
    name: 'BiquadOsc (Fast DF-I)',
    cppSymbol: 'ESP32Patches::DSP_BiquadOscFast',
    cpuTag: '~3.45% CPU',
    charTag: 'Direct Form I',
    description: 'Filtro biquad ressonante aplicado diretamente no oscilador com coeficientes LUT inteiros.',
    usageTip: 'Dica: Melhor para polifonia mais alta exigindo filtro passa-baixas e ressonância calculada rápida.',
    icon: Gauge,
    accentColor: 'text-amber-400',
    borderActive: 'border-amber-400 bg-amber-950/40 shadow-amber-900/40',
  },
  {
    id: CustomWavePatch.DSP_BIQUAD,
    name: 'BiquadOsc Studio (HQ)',
    cppSymbol: 'ESP32Patches::DSP_BiquadOsc',
    cpuTag: '~4.35% CPU',
    charTag: 'TDF-II Q28 64-bit',
    description: 'Filtro Transposed Direct Form II com acumuladores de 64 bits e drift zero em graves.',
    usageTip: 'Dica: Máxima fidelidade analógica para basslines ácidas com ressonância alta sem clipping.',
    icon: Flame,
    accentColor: 'text-orange-400',
    borderActive: 'border-orange-400 bg-orange-950/40 shadow-orange-900/40',
  },
  {
    id: CustomWavePatch.FM_CUSTOM,
    name: 'FM_Custom (2-Op FM)',
    cppSymbol: 'ESP32Patches::FM_Custom',
    cpuTag: '~3.90% CPU',
    charTag: 'Síntese FM',
    description: 'Síntese FM de 2 operadores senoidais com razão harmônica e envelope decay dedicado.',
    usageTip: 'Dica: Ideal para sinos metálicos, pianos elétricos clássicos estilo DX7 e baixos FM percussivos.',
    icon: Radio,
    accentColor: 'text-purple-400',
    borderActive: 'border-purple-400 bg-purple-950/40 shadow-purple-900/40',
  },
  {
    id: CustomWavePatch.HAMMOND_B3,
    name: 'HammondB3 (Tonewheel)',
    cppSymbol: 'ESP32Patches::HammondB3',
    cpuTag: '~4.80% CPU',
    charTag: '9 Drawbars Aditivos',
    description: 'Síntese aditiva somando 9 harmônicos senoidais com proteção de overflow de 32-bit.',
    usageTip: 'Dica: Autêntico som de órgão gospel e rock. Combine com o patch Global DSP_HammondLeslie.',
    icon: Music,
    accentColor: 'text-amber-400',
    borderActive: 'border-amber-400 bg-amber-950/40 shadow-amber-900/40',
  },
  {
    id: CustomWavePatch.EKS_GUITAR,
    name: 'EKS_Guitar (Karplus)',
    cppSymbol: 'ESP32Patches::EKS_Guitar',
    cpuTag: '~4.10% CPU',
    charTag: 'Corda Ressonante',
    description: 'Modelo físico Karplus-Strong estendido com delay lines dedicadas para cordas dedilhadas.',
    usageTip: 'Dica: Simulação realista de violão e guitarra elétrica. Combine com o efeito DSP_Pedalboard.',
    icon: Volume2,
    accentColor: 'text-cyan-400',
    borderActive: 'border-cyan-400 bg-cyan-950/40 shadow-cyan-900/40',
  },
];

const HAMMOND_PRESET_NAMES = [
  { val: 0, label: '0: 88 8000 000 (Warm Jazz Organ)', bars: [8, 8, 8, 0, 0, 0, 0, 0, 0] },
  { val: 1, label: '1: 88 8400 000 (Jimmy Smith Gospel)', bars: [8, 8, 8, 4, 0, 0, 0, 0, 0] },
  { val: 2, label: '2: 88 8888 888 (Full Rock / Jon Lord)', bars: [8, 8, 8, 8, 8, 8, 8, 8, 8] },
  { val: 3, label: '3: 00 0008 888 (High Whistle Flutes)', bars: [0, 0, 0, 0, 0, 8, 8, 8, 8] },
  { val: 4, label: '4: 88 8000 008 (Bright Percussive)', bars: [8, 8, 8, 0, 0, 0, 0, 0, 8] },
];

export const VoicePanel: React.FC<VoicePanelProps> = ({
  config,
  onChange,
  activeEnvLevel,
  activeEnvState,
  onOpenCodeExport,
  customWavetable,
  wavetableDepth,
  onWavetableChange,
}) => {
  const [mutateCategory, setMutateCategory] = useState<'any' | 'lead' | 'bass' | 'pad' | 'fm' | 'chiptune'>('any');

  const handlePatchSelect = (newPatch: CustomWavePatch) => {
    if (newPatch === CustomWavePatch.DSP_BIQUAD || newPatch === CustomWavePatch.DSP_BIQUAD_FAST) {
      onChange({
        customPatch: newPatch,
        customParam0: config.customParam0 !== undefined ? config.customParam0 : 0,    // cp[0]: 0 = Saw
        customParam1: config.customParam1 || 1800, // cp[1]: Cutoff Hz
        customParam2: config.customParam2 || 250,  // cp[2]: Q * 100 (2.50)
        customParam3: config.customParam3 !== undefined ? config.customParam3 : 0,    // cp[3]: 0 = LPF
      });
    } else if (newPatch === CustomWavePatch.FM_CUSTOM) {
      onChange({
        customPatch: newPatch,
        customParam0: config.customParam0 || 2,  // cp[0]: Ratio Int
        customParam1: config.customParam1 || 0,  // cp[1]: Ratio Frac
        customParam2: config.customParam2 || 45, // cp[2]: Mod Index Base
        customParam3: config.customParam3 !== undefined ? config.customParam3 : 5,  // cp[3]: Mod Decay
      });
    } else if (newPatch === CustomWavePatch.HAMMOND_B3) {
      onChange({
        customPatch: newPatch,
        customParam0: config.customParam0 || 0, // cp[0]: Drawbar registration 0..4
      });
    } else {
      onChange({ customPatch: newPatch });
    }
  };

  const handleMutateSound = () => {
    let newPatch: Partial<VoiceConfig> = {};

    switch (mutateCategory) {
      case 'bass':
        newPatch = {
          waveType: Math.random() > 0.5 ? WaveType.WAVE_SAW : WaveType.WAVE_PULSE,
          customPatch: Math.random() > 0.4 ? CustomWavePatch.DSP_BIQUAD_FAST : CustomWavePatch.AA_SAW,
          attackMs: Math.floor(Math.random() * 15) + 2,
          decayMs: Math.floor(Math.random() * 250) + 80,
          sustain8Bit: Math.floor(Math.random() * 100) + 40,
          releaseMs: Math.floor(Math.random() * 150) + 60,
          smoothEnv: true,
          pulseWidth8Bit: Math.floor(Math.random() * 80) + 40,
          vibratoDepthCentiHz: 0,
          tremoloDepth8Bit: 0,
          portamentoMs: Math.random() > 0.5 ? 55 : 0,
          targetBus: 1,
          customParam0: Math.random() > 0.5 ? 0 : 1, // Saw or Pulse
          customParam1: Math.floor(Math.random() * 900) + 250, // Cutoff Hz
          customParam2: Math.floor(Math.random() * 300) + 120, // Q * 100
          customParam3: 0, // LPF
        };
        break;

      case 'lead':
        newPatch = {
          waveType: WaveType.WAVE_SAW,
          customPatch: Math.random() > 0.5 ? CustomWavePatch.AA_SAW : CustomWavePatch.DSP_BIQUAD,
          attackMs: Math.floor(Math.random() * 35) + 5,
          decayMs: Math.floor(Math.random() * 300) + 100,
          sustain8Bit: Math.floor(Math.random() * 80) + 160,
          releaseMs: Math.floor(Math.random() * 350) + 120,
          smoothEnv: true,
          vibratoRateCentiHz: 550,
          vibratoDepthCentiHz: Math.floor(Math.random() * 180) + 60,
          portamentoMs: Math.floor(Math.random() * 70) + 30,
          customParam0: 0, // Saw
          customParam1: Math.floor(Math.random() * 3500) + 1200, // Cutoff Hz
          customParam2: Math.floor(Math.random() * 250) + 100,  // Q * 100
          customParam3: 0, // LPF
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
          tremoloDepth8Bit: 35,
          portamentoMs: 0,
          polyphony: 8,
        };
        break;

      case 'fm':
        newPatch = {
          customPatch: CustomWavePatch.FM_CUSTOM,
          attackMs: Math.floor(Math.random() * 25) + 5,
          decayMs: Math.floor(Math.random() * 400) + 100,
          sustain8Bit: Math.floor(Math.random() * 120) + 50,
          releaseMs: Math.floor(Math.random() * 400) + 150,
          smoothEnv: true,
          customParam0: [1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 6)], // cp[0]: Ratio Int
          customParam1: Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0, // cp[1]: Ratio Frac
          customParam2: Math.floor(Math.random() * 75) + 15, // cp[2]: Mod Index Base
          customParam3: Math.floor(Math.random() * 25),      // cp[3]: Mod Decay
        };
        break;

      case 'chiptune':
        newPatch = {
          waveType: WaveType.WAVE_PULSE,
          customPatch: CustomWavePatch.BASIC,
          attackMs: 0,
          decayMs: Math.floor(Math.random() * 150) + 40,
          sustain8Bit: Math.floor(Math.random() * 150) + 50,
          releaseMs: Math.floor(Math.random() * 100) + 20,
          smoothEnv: false,
          pulseWidth8Bit: [32, 64, 128, 192][Math.floor(Math.random() * 4)],
          portamentoMs: 0,
        };
        break;

      default:
        newPatch = {
          attackMs: Math.floor(Math.random() * 200) + 10,
          decayMs: Math.floor(Math.random() * 400) + 50,
          sustain8Bit: Math.floor(Math.random() * 200) + 40,
          releaseMs: Math.floor(Math.random() * 500) + 50,
          smoothEnv: Math.random() > 0.5,
          vibratoDepthCentiHz: Math.random() > 0.6 ? Math.floor(Math.random() * 200) : 0,
          tremoloDepth8Bit: Math.random() > 0.6 ? Math.floor(Math.random() * 80) : 0,
        };
        break;
    }

    onChange(newPatch);
  };

  const handleResetSound = () => {
    onChange({
      waveType: WaveType.WAVE_SAW,
      customPatch: CustomWavePatch.BASIC,
      attackMs: 60,
      decayMs: 100,
      sustain8Bit: 180,
      releaseMs: 250,
      smoothEnv: false,
      pulseWidth8Bit: 128,
      startPhaseDeg: 0,
      vibratoRateCentiHz: 500,
      vibratoDepthCentiHz: 0,
      tremoloRateCentiHz: 500,
      tremoloDepth8Bit: 0,
      portamentoMs: 0,
      targetBus: 0,
      customParam0: 0,
      customParam1: 1800,
      customParam2: 200,
      customParam3: 0,
    });
  };

  const pulseDutyPercent = ((config.pulseWidth8Bit / 255) * 100).toFixed(1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Panel Bar */}
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

        <div className="flex flex-wrap items-center gap-2">
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
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mutate</span>
            </button>
          </div>

          <button
            onClick={handleResetSound}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono flex items-center transition cursor-pointer"
            title="Reset to Init Preset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onOpenCodeExport && (
            <button
              onClick={onOpenCodeExport}
              className="px-3 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Export .ino</span>
            </button>
          )}

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

      {/* 1. Visual Algorithm Selector Cards Grid (ESP32Synth_Patches.hpp) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            1. Core Synthesis Algorithm Selector (ESP32Synth_Patches.hpp)
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            Clique no card para ativar o algoritmo e carregar seus parâmetros dinâmicos (cp[0..3])
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {ALGORITHM_CARDS.map((card) => {
            const isSelected = config.customPatch === card.id;
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => handlePatchSelect(card.id)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                  isSelected
                    ? `${card.borderActive} shadow-lg ring-1 ring-emerald-400/50`
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 group-hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-white leading-tight">
                        {card.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
                        {card.cppSymbol}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-in fade-in" />
                  )}
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans line-clamp-2">
                  {card.description}
                </p>

                {/* Dica rápida de uso */}
                <div className="bg-slate-900/90 rounded p-1.5 border border-slate-800/80 text-[10px] font-sans text-slate-300 flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{card.usageTip}</span>
                </div>

                {/* Badges footer */}
                <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-slate-800/80">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
                    {card.charTag}
                  </span>
                  <span className={`font-bold ${card.cpuTag.includes('~4.') ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {card.cpuTag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Controls 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
        {/* Column 1: Basic Waveform & Bus Routing */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
            <Waves className="w-3.5 h-3.5 text-emerald-400" />
            2. Oscillator Carrier & Routing
          </h3>

          <div className="space-y-3.5 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            {config.customPatch === CustomWavePatch.BASIC ? (
              <>
                <div>
                  <label className="text-[11px] font-mono text-slate-300 font-semibold mb-1 block">
                    Hardware Integer Waveform (WaveType)
                  </label>
                  <select
                    value={config.waveType}
                    onChange={(e) => {
                      const val = Number(e.target.value) as WaveType;
                      onChange({ waveType: val, customPatch: CustomWavePatch.BASIC });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={WaveType.WAVE_SAW}>WAVE_SAW (-3) - Raw Sawtooth</option>
                    <option value={WaveType.WAVE_PULSE}>WAVE_PULSE (-4) - Pulse / Square Wave</option>
                    <option value={WaveType.WAVE_SINE}>WAVE_SINE (-1) - Interpolated Sine LUT</option>
                    <option value={WaveType.WAVE_TRIANGLE}>WAVE_TRIANGLE (-2) - Triangle Wave</option>
                    <option value={WaveType.WAVE_NOISE}>WAVE_NOISE (-5) - Linear PRNG Noise</option>
                    <option value={WaveType.WAVE_WAVETABLE}>WAVE_WAVETABLE (1) - Custom Wavetable Draw Studio</option>
                  </select>
                </div>
                {config.waveType === WaveType.WAVE_WAVETABLE && (
                  <WavetableEditor
                    samples={customWavetable || []}
                    bitDepth={wavetableDepth ?? BitDepth.BITS_16}
                    onChange={onWavetableChange || (() => {})}
                  />
                )}
              </>
            ) : (
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
                <span className="text-[11px] font-mono text-emerald-300 font-bold block mb-1">
                  Active Algorithm Override:
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {ALGORITHM_CARDS.find((c) => c.id === config.customPatch)?.name}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Using custom DSP function pointer from ESP32Synth_Patches.hpp.
                </p>
              </div>
            )}

            {/* Pulse Width Duty Cycle */}
            {(config.waveType === WaveType.WAVE_PULSE ||
              config.customPatch === CustomWavePatch.AA_PULSE ||
              ((config.customPatch === CustomWavePatch.DSP_BIQUAD ||
                config.customPatch === CustomWavePatch.DSP_BIQUAD_FAST) &&
                config.customParam0 === 1)) && (
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Pulse Width (setPulseWidth)</span>
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
                <div className="h-4 bg-slate-900 rounded border border-slate-800 mt-1.5 flex items-center px-1 overflow-hidden">
                  <div
                    className="h-2.5 bg-emerald-500/80 rounded-sm transition-all duration-75"
                    style={{ width: `${pulseDutyPercent}%` }}
                  />
                  <div className="h-0.5 flex-1 bg-slate-700" />
                </div>
              </div>
            )}

            {/* Initial Phase Angle */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Phase Angle (setStartPhase)</span>
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

            {/* Target Audio Bus */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 mb-1.5 block">
                Target Audio Bus (setVoiceBus)
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
                    {busId === 0 ? 'Bus 0 (Clean)' : `Bus ${busId}`}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                Bus 1 is routed directly into the Biquad Filter FX Rack.
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: ADSR Envelope */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              3. Q28 ADSR Envelope (setEnv)
            </h3>

            <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.smoothEnv}
                onChange={(e) => onChange({ smoothEnv: e.target.checked })}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              Smooth Env (RC)
            </label>
          </div>

          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <EnvelopeVisualizer
              attackMs={config.attackMs}
              decayMs={config.decayMs}
              sustain8Bit={config.sustain8Bit}
              releaseMs={config.releaseMs}
              smoothEnv={config.smoothEnv}
              activeEnvLevel={activeEnvLevel}
              activeEnvState={activeEnvState}
            />

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
          </div>
        </div>

        {/* Column 3: Dynamic Contextual Parameters cp[0..3] & LFOs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              4. Contextual Parameters (cp[0..3])
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              {config.customPatch === CustomWavePatch.FM_CUSTOM
                ? 'FM Mode'
                : config.customPatch === CustomWavePatch.DSP_BIQUAD || config.customPatch === CustomWavePatch.DSP_BIQUAD_FAST
                ? 'Biquad Mode'
                : config.customPatch === CustomWavePatch.HAMMOND_B3
                ? 'Organ Mode'
                : config.customPatch === CustomWavePatch.EKS_GUITAR
                ? 'String Model'
                : 'Direct Mode'}
            </span>
          </div>

          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            {/* Dynamic Context Parameters (cp[0..3]) based on Selected Patch */}
            {config.customPatch === CustomWavePatch.FM_CUSTOM && (
              <div className="p-3.5 bg-purple-950/30 border border-purple-800/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-purple-300 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-purple-400" />
                    <span>2-Operator FM Parameters</span>
                  </div>
                  <span className="text-[10px] bg-purple-900/60 px-2 py-0.5 rounded text-purple-200">
                    Ratio {config.customParam0 || 1}.{String(config.customParam1 || 0).padStart(2, '0')}:1
                  </span>
                </div>

                {/* cp[0]: Harmonic Ratio */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200 mb-1">
                    <span className="font-semibold text-purple-300">cp[0]: Harmonic Ratio (Integer)</span>
                    <span className="font-bold text-white bg-purple-900 px-1.5 py-0.2 rounded">
                      {config.customParam0 || 1}:1
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={config.customParam0 || 1}
                    onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Multiplicador harmônico inteiro da frequência moduladora.
                  </span>
                </div>

                {/* cp[1]: Fine Ratio */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200 mb-1">
                    <span className="font-semibold text-purple-300">cp[1]: Fine Ratio (Fractional %)</span>
                    <span className="font-bold text-white bg-purple-900 px-1.5 py-0.2 rounded">
                      .{String(config.customParam1 || 0).padStart(2, '0')}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="99"
                    value={config.customParam1 || 0}
                    onChange={(e) => onChange({ customParam1: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Deslocamento fino fracionário (0.00 a 0.99) para batimento harmônico.
                  </span>
                </div>

                {/* cp[2]: Mod Index */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200 mb-1">
                    <span className="font-semibold text-purple-300">cp[2]: Mod Index (Brightness)</span>
                    <span className="font-bold text-white bg-purple-900 px-1.5 py-0.2 rounded">
                      {config.customParam2 ?? 45} idx
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={config.customParam2 ?? 45}
                    onChange={(e) => onChange({ customParam2: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Profundidade base de modulação de fase e dispersão de bandas laterais.
                  </span>
                </div>

                {/* cp[3]: Modulator Decay */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-purple-200 mb-1">
                    <span className="font-semibold text-purple-300">cp[3]: Modulator Env Decay Rate</span>
                    <span className="font-bold text-white bg-purple-900 px-1.5 py-0.2 rounded">
                      {config.customParam3 ?? 5} decay
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.customParam3 ?? 5}
                    onChange={(e) => onChange({ customParam3: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Queda dinâmica do brilho metálico ao longo do tempo por frame de áudio.
                  </span>
                </div>
              </div>
            )}

            {/* Biquad Resonant Oscillator Controls */}
            {(config.customPatch === CustomWavePatch.DSP_BIQUAD ||
              config.customPatch === CustomWavePatch.DSP_BIQUAD_FAST) && (
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-emerald-300 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>BiquadOsc Context Parameters</span>
                  </div>
                  <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
                    {config.customPatch === CustomWavePatch.DSP_BIQUAD ? 'TDF-II Q28' : 'DF-I Fast'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-emerald-300 font-semibold block mb-1">
                      cp[0]: Osc Waveform
                    </label>
                    <select
                      value={config.customParam0 || 0}
                      onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-emerald-700/60 rounded px-2 py-1 text-xs font-mono text-emerald-200 cursor-pointer"
                    >
                      <option value={0}>0: PolyBLEP Saw</option>
                      <option value={1}>1: PolyBLEP Pulse</option>
                      <option value={2}>2: Triangle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-emerald-300 font-semibold block mb-1">
                      cp[3]: Filter Mode
                    </label>
                    <select
                      value={config.customParam3 ?? 0}
                      onChange={(e) => onChange({ customParam3: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-emerald-700/60 rounded px-2 py-1 text-xs font-mono text-emerald-200 cursor-pointer"
                    >
                      <option value={0}>0: Low Pass (LPF)</option>
                      <option value={1}>1: High Pass (HPF)</option>
                      <option value={2}>2: Band Pass (BPF)</option>
                      <option value={3}>3: Notch (Band Stop)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono text-emerald-200 mb-1">
                    <span className="font-semibold text-emerald-300">cp[1]: Cutoff Hz</span>
                    <span className="font-bold text-white bg-emerald-900 px-1.5 py-0.2 rounded">
                      {config.customParam1 || 1800} Hz
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="16000"
                    step="25"
                    value={config.customParam1 || 1800}
                    onChange={(e) => onChange({ customParam1: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Frequência de corte do filtro interno biquad de 20 Hz a 16 kHz.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono text-emerald-200 mb-1">
                    <span className="font-semibold text-emerald-300">cp[2]: Resonance Q Factor</span>
                    <span className="font-bold text-white bg-emerald-900 px-1.5 py-0.2 rounded">
                      Q = {((config.customParam2 ?? 250) / 100).toFixed(2)} ({config.customParam2 ?? 250})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    value={config.customParam2 ?? 250}
                    onChange={(e) => onChange({ customParam2: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                    Ponto fixo Q*100. 70 = 0.707 (plano), 250 = 2.50 (pico), 800+ = alta ressonância.
                  </span>
                </div>
              </div>
            )}

            {/* Hammond B3 Tonewheel Controls */}
            {config.customPatch === CustomWavePatch.HAMMOND_B3 && (
              <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 font-bold">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>cp[0]: Hammond B3 Drawbars</span>
                </div>

                <select
                  value={config.customParam0 || 0}
                  onChange={(e) => onChange({ customParam0: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-amber-700/60 rounded p-1.5 text-xs font-mono text-amber-200 cursor-pointer"
                >
                  {HAMMOND_PRESET_NAMES.map((h) => (
                    <option key={h.val} value={h.val}>
                      {h.label}
                    </option>
                  ))}
                </select>

                {/* Visual 9 Drawbar Bars */}
                <div className="pt-2">
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-1">
                    <span>16&apos;</span>
                    <span>5&#8531;&apos;</span>
                    <span>8&apos;</span>
                    <span>4&apos;</span>
                    <span>2&#8532;&apos;</span>
                    <span>2&apos;</span>
                    <span>1&#8543;&apos;</span>
                    <span>1&#8531;&apos;</span>
                    <span>1&apos;</span>
                  </div>
                  <div className="flex items-end justify-between h-12 bg-slate-950 p-1.5 rounded border border-amber-900/60 gap-1">
                    {(HAMMOND_PRESET_NAMES[config.customParam0 || 0]?.bars || [8, 8, 8, 0, 0, 0, 0, 0, 0]).map(
                      (b, idx) => (
                        <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full">
                          <div
                            className={`w-full rounded-t transition-all ${
                              idx < 2 ? 'bg-amber-600' : idx < 5 ? 'bg-amber-400' : 'bg-amber-200'
                            }`}
                            style={{ height: `${(b / 8) * 100}%` }}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* EKS Guitar Controls */}
            {config.customPatch === CustomWavePatch.EKS_GUITAR && (
              <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/60 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 font-bold">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Karplus-Strong String Resonator</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  Buffer de delay em anel de 2048 amostras com excitação por ruído pseudo-aleatório (PRNG) e amortecimento passa-baixas.
                </p>
                <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 p-2 rounded border border-cyan-800/40">
                  cp[0..3] gerenciados internamente pelo simulador de tensão de corda e decaimento acústico.
                </div>
              </div>
            )}

            {/* Basic / AA_Saw / AA_Pulse contextual info */}
            {(config.customPatch === CustomWavePatch.BASIC ||
              config.customPatch === CustomWavePatch.AA_SAW ||
              config.customPatch === CustomWavePatch.AA_PULSE) && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Parâmetros de LFO e Modulação</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans">
                  Neste algoritmo, o sinal primário opera via oscilador direto em ponto fixo Q28. Utilize os controles de Vibrato e Tremolo abaixo.
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
