import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Cpu } from 'lucide-react';
import { VoiceConfig } from './VoicePanel';
import { MasterConfig } from './MasterPanel';
import { ArpConfig } from './ArpeggiatorPanel';
import { WaveType, CustomWavePatch, BusFXPatch, GlobalDSPPatch, BitDepth } from '../audio/types';
import { transposeCentiHz } from '../audio/notes';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceConfig: VoiceConfig;
  masterConfig: MasterConfig;
  arpConfig?: ArpConfig;
  customWavetable?: number[];
  wavetableDepth?: BitDepth;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  isOpen,
  onClose,
  voiceConfig,
  masterConfig,
  arpConfig,
  customWavetable,
  wavetableDepth = BitDepth.BITS_16,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate Arduino C++ sketch matching Danilo Gabriel's ESP32Synth.h
  const getWaveTypeMacro = (wt: WaveType): string => {
    switch (wt) {
      case WaveType.WAVE_SAW: return 'WAVE_SAW';
      case WaveType.WAVE_PULSE: return 'WAVE_PULSE';
      case WaveType.WAVE_SINE: return 'WAVE_SINE';
      case WaveType.WAVE_TRIANGLE: return 'WAVE_TRIANGLE';
      case WaveType.WAVE_NOISE: return 'WAVE_NOISE';
      case WaveType.WAVE_WAVETABLE: return 'WAVE_WAVETABLE';
      default: return 'WAVE_SAW';
    }
  };

  const getCustomPatchCode = (p: CustomWavePatch): string => {
    switch (p) {
      case CustomWavePatch.AA_SAW: return 'ESP32Patches::AA_Saw';
      case CustomWavePatch.AA_PULSE: return 'ESP32Patches::AA_Pulse';
      case CustomWavePatch.DSP_BIQUAD_FAST: return 'ESP32Patches::DSP_BiquadOscFast';
      case CustomWavePatch.DSP_BIQUAD: return 'ESP32Patches::DSP_BiquadOsc';
      case CustomWavePatch.FM_CUSTOM: return 'ESP32Patches::FM_Custom';
      case CustomWavePatch.HAMMOND_B3: return 'ESP32Patches::HammondB3';
      case CustomWavePatch.EKS_GUITAR: return 'ESP32Patches::EKS_Guitar';
      default: return '';
    }
  };

  const getGlobalDSPCode = (dsp: GlobalDSPPatch): string => {
    switch (dsp) {
      case GlobalDSPPatch.DSP_HAMMOND_LESLIE: return 'ESP32Patches::DSP_HammondLeslie';
      case GlobalDSPPatch.DSP_PEDALBOARD: return 'ESP32Patches::DSP_Pedalboard';
      default: return '';
    }
  };

  const getBusFXCode = (fx: BusFXPatch): string => {
    switch (fx) {
      case BusFXPatch.FX_BIQUAD_FILTER: return 'ESP32Patches::FX_BiquadFilter';
      case BusFXPatch.FX_BIQUAD_FILTER_FAST: return 'ESP32Patches::FX_BiquadFilterFast';
      default: return '';
    }
  };

  const isCustomPatch = voiceConfig.customPatch !== CustomWavePatch.BASIC;
  const isWavetable = !isCustomPatch && voiceConfig.waveType === WaveType.WAVE_WAVETABLE;
  const customPatchName = getCustomPatchCode(voiceConfig.customPatch);
  const busFXName = getBusFXCode(masterConfig.bus1FXPatch);
  const globalDSPName = getGlobalDSPCode(masterConfig.globalDSPPatch);

  const bitDepthMacro =
    wavetableDepth === BitDepth.BITS_4 ? 'BITS_4' :
    wavetableDepth === BitDepth.BITS_8 ? 'BITS_8' : 'BITS_16';

  // Format custom wavetable in rows of 16 values
  let wavetableCode = '';
  if (isWavetable && customWavetable && customWavetable.length > 0) {
    const tableSize = customWavetable.length;
    const lines: string[] = [];
    for (let i = 0; i < tableSize; i += 16) {
      const slice = customWavetable.slice(i, i + 16);
      lines.push('  ' + slice.map((v) => String(v).padStart(6, ' ')).join(', '));
    }
    wavetableCode = `// ----------------------------------------------------------------------------
// Custom Wavetable Baked in PROGMEM (256 samples, ${bitDepthMacro})
// ----------------------------------------------------------------------------
const int16_t customWavetable[${tableSize}] PROGMEM = {
${lines.join(',\n')}
};
`;
  }

  // Generate arpeggio note list if enabled
  let arpSetupCode = '';
  if (arpConfig && arpConfig.enabled) {
    const rootC4 = 26163; // NOTE_C4 in CentiHz
    const stepCount = Math.min(16, arpConfig.stepCount);
    const freqs: string[] = [];
    for (let i = 0; i < stepCount; i++) {
      if (arpConfig.activeSteps[i]) {
        const cHz = transposeCentiHz(rootC4, arpConfig.steps[i] ?? 0);
        freqs.push(`${cHz}UL`);
      } else {
        freqs.push('0UL'); // 0 = Rhythmic Rest / Gate Pause
      }
    }
    arpSetupCode = `
  // Hardware Arpeggiator (${stepCount} Steps, ${arpConfig.durationMs}ms per step)
  // Step frequencies in CentiHz (0 = Musical Rest / Gate Off)
  synth.setArpeggio(0, ${arpConfig.durationMs}, ${freqs.join(', ')});
`;
  }

  // Portamento code snippet
  const portamentoDemoCode = voiceConfig.portamentoMs > 0
    ? `  // Hardware Pitch Glide Demo (Portamento: ${voiceConfig.portamentoMs}ms)
  synth.slideFreqTo(0, NOTE_G4, ${voiceConfig.portamentoMs});
  delay(${Math.max(1200, voiceConfig.portamentoMs * 2 + 300)});
  synth.slideFreqTo(0, NOTE_C4, ${voiceConfig.portamentoMs});
  delay(${Math.max(1200, voiceConfig.portamentoMs * 2 + 300)});`
    : `  delay(10);`;

  const sketchCode = `/**
 * ESP32Synth Timbre Configuration Sketch
 * Generated by ESP32Synth WebAssembly Studio
 * Target Hardware: ESP32 / ESP32-S3 (ESP-IDF / Arduino Framework)
 * Original Library: Danilo Gabriel (github.com/danilogcrf2-oss/ESP32Synth)
 */

#include <Arduino.h>
#include "ESP32Synth.h"
#include "ESP32Synth_Patches.hpp"
#include "ESP32SynthNotes.h"

// I2S DAC Pinout (PCM5102A / MAX98357A)
#define I2S_BCK_PIN  26
#define I2S_WS_PIN   25
#define I2S_DOUT_PIN 22

ESP32Synth synth;
${wavetableCode}
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Starting ESP32Synth Engine...");

  // 1. Initialize Hardware I2S (48 kHz default, 16-bit)
  synth.begin(I2S_BCK_PIN, I2S_WS_PIN, I2S_DOUT_PIN, I2S_16BIT);

  // 2. Master Output & Control Rates
  synth.setMasterVolume(${masterConfig.masterVol});       // 0 - 255
  synth.setControlRateHz(${masterConfig.controlRateHz});  // Default: 100 Hz
${masterConfig.bitcrush > 0 ? `  synth.setMasterBitcrush(${masterConfig.bitcrush});    // Lo-Fi DAC bitcrush\n` : ''}
  // 3. Configure Polyphonic Voices (${voiceConfig.polyphony} Voices)
  for (int v = 0; v < ${voiceConfig.polyphony}; v++) {
${isCustomPatch ? `    synth.setCustomWave(v, ${customPatchName});\n` : isWavetable ? `    synth.setWavetable(v, customWavetable, 256, ${bitDepthMacro});\n` : `    synth.setWave(v, ${getWaveTypeMacro(voiceConfig.waveType)});\n`}    synth.setEnv(v, ${voiceConfig.attackMs}, ${voiceConfig.decayMs}, ${voiceConfig.sustain8Bit}, ${voiceConfig.releaseMs});
    synth.setSmoothEnv(v, ${voiceConfig.smoothEnv ? 'true' : 'false'});
    synth.setPulseWidth(v, ${voiceConfig.pulseWidth8Bit});
    synth.setStartPhase(v, ${voiceConfig.startPhaseDeg});
${voiceConfig.vibratoDepthCentiHz > 0 ? `    synth.setVibrato(v, ${voiceConfig.vibratoRateCentiHz}, ${voiceConfig.vibratoDepthCentiHz});\n` : ''}${voiceConfig.tremoloDepth8Bit > 0 ? `    synth.setTremolo(v, ${voiceConfig.tremoloRateCentiHz}, ${voiceConfig.tremoloDepth8Bit});\n` : ''}${voiceConfig.targetBus > 0 ? `    synth.setVoiceBus(v, ${voiceConfig.targetBus});\n` : ''}${isCustomPatch ? `    synth.setCustomParam(v, 0, ${voiceConfig.customParam0}); // cp[0]\n    synth.setCustomParam(v, 1, ${voiceConfig.customParam1}); // cp[1]\n    synth.setCustomParam(v, 2, ${voiceConfig.customParam2 ?? 0}); // cp[2]\n    synth.setCustomParam(v, 3, ${voiceConfig.customParam3 ?? 0}); // cp[3]\n` : ''}  }
${masterConfig.bus1FXPatch !== BusFXPatch.NONE ? `
  // 4. Modular Bus 1 Resonant Filter Setup (ep[0..4])
  synth.setBusFX(1, 0, FX_CUSTOM, ${busFXName});
  synth.setBusFXParam(1, 0, 0, ${masterConfig.bus1CutoffHz});      // ep[0]: Cutoff Hz
  synth.setBusFXParam(1, 0, 1, ${masterConfig.bus1FilterMode});    // ep[1]: Mode (0:LPF, 1:HPF, 2:BPF, 3:Notch)
  synth.setBusFXParam(1, 0, 2, ${masterConfig.bus1ResonanceQ});    // ep[2]: Q*100 or BW Hz
  synth.setBusFXParam(1, 0, 3, ${masterConfig.bus1BwMode ?? 0});   // ep[3]: Unit Mode (0:Q, 1:BW Hz)
  synth.setBusFXParam(1, 0, 4, ${masterConfig.bus1WetMix});        // ep[4]: Dry/Wet Mix (1-255)
  synth.setBusMix(1, ${masterConfig.bus1MixLevel});                // Bus 1 Output Level
` : ''}${masterConfig.globalDSPPatch !== GlobalDSPPatch.NONE ? `
  // 5. Global Master DSP FX
  synth.setCustomDSP(${globalDSPName});
  synth.setDSPParam(0, ${masterConfig.dspParam0}); // dp[0]
  synth.setDSPParam(1, ${masterConfig.dspParam1}); // dp[1]
  synth.setDSPParam(2, ${masterConfig.dspParam2}); // dp[2]
` : ''}${arpSetupCode}
  // Trigger test chord (Cm7)
  synth.noteOn(0, NOTE_C4, 220);
  synth.noteOn(1, NOTE_DS4, 220);
  synth.noteOn(2, NOTE_G4, 220);
  synth.noteOn(3, NOTE_AS4, 220);
}

void loop() {
${portamentoDemoCode}
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sketchCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-mono font-bold text-slate-200">
              Export C++ Arduino Sketch (.ino)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-950/40 border-b border-emerald-900/50 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Ready to compile in Arduino IDE or PlatformIO on ESP32 / ESP32-S3</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Sketch</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-300">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">
            <code>{sketchCode}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Uses real Danilo Gabriel ESP32Synth API calls (no wrappers required).</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
