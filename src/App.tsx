/**
 * ESP32Synth WebAssembly Studio
 * 1:1 Mirror of Danilo Gabriel's ESP32Synth C++ Library
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ESP32SynthEngine } from './audio/ESP32SynthEngine';
import { WaveType, CustomWavePatch, BusFXPatch, GlobalDSPPatch, VoiceTelemetry } from './audio/types';
import { NOTES } from './audio/notes';
import { Header } from './components/Header';
import { PresetsBar, PresetDef } from './components/PresetsBar';
import { Oscilloscope } from './components/Oscilloscope';
import { VoicePanel, VoiceConfig } from './components/VoicePanel';
import { MasterPanel, MasterConfig } from './components/MasterPanel';
import { VoiceTelemetryGrid } from './components/VoiceTelemetryGrid';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { CodeExportModal } from './components/CodeExportModal';

export default function App() {
  const engine = ESP32SynthEngine.getInstance();
  const [isAudioRunning, setIsAudioRunning] = useState<boolean>(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [peakLevel, setPeakLevel] = useState<number>(0);
  const [cpuLoad, setCpuLoad] = useState<number>(0);
  const [telemetryVoices, setTelemetryVoices] = useState<VoiceTelemetry[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('poly_chords');
  const [isPlayingDemo, setIsPlayingDemo] = useState<boolean>(false);
  const [isCodeExportOpen, setIsCodeExportOpen] = useState<boolean>(false);
  const demoIntervalRef = useRef<number | null>(null);

  // Master Configuration State
  const [masterConfig, setMasterConfig] = useState<MasterConfig>({
    masterVol: 200,
    bitcrush: 0,
    controlRateHz: 100,
    bus1FXPatch: BusFXPatch.NONE,
    bus1CutoffHz: 1600,
    bus1FilterMode: 0,
    bus1ResonanceQ: 200,
    bus1WetMix: 255,
    bus1MixLevel: 255,
    globalDSPPatch: GlobalDSPPatch.NONE,
    dspParam0: 100,
    dspParam1: 200,
    dspParam2: 120,
    dspParam3: 150,
  });

  // Voice Configuration State
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
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
    polyphony: 8,
    customParam0: 100,
    customParam1: 200,
  });

  // Start / Toggle Audio Engine
  const toggleAudio = useCallback(async () => {
    if (!isAudioRunning) {
      const ok = await engine.init();
      if (ok) {
        setIsAudioRunning(true);
        setAnalyser(engine.getAnalyser());
        applyFullConfig(voiceConfig, masterConfig);
      }
    } else {
      engine.stopAllVoices();
      setIsAudioRunning(false);
      stopDemo();
    }
  }, [isAudioRunning, voiceConfig, masterConfig]);

  // Telemetry updates subscription
  useEffect(() => {
    const unsubscribe = engine.subscribeTelemetry((t) => {
      setTelemetryVoices(t.activeVoices);
      setPeakLevel(t.peak);
      setCpuLoad(t.cpuLoad);
    });
    return unsubscribe;
  }, []);

  // Sync Voice Configuration changes to C++ Engine
  const applyVoiceConfig = useCallback((cfg: VoiceConfig) => {
    engine.setPolyphonyCount(cfg.polyphony);

    // Update all polyphonic voice slots (0 to 15)
    for (let v = 0; v < 16; v++) {
      if (cfg.customPatch !== CustomWavePatch.BASIC) {
        engine.setCustomWavePatch(v, cfg.customPatch);
      } else {
        engine.setCustomWavePatch(v, CustomWavePatch.BASIC);
        engine.setWave(v, cfg.waveType);
      }

      engine.setEnv(v, cfg.attackMs, cfg.decayMs, cfg.sustain8Bit, cfg.releaseMs);
      engine.setSmoothEnv(v, cfg.smoothEnv);
      engine.setPulseWidth(v, cfg.pulseWidth8Bit);
      engine.setStartPhase(v, cfg.startPhaseDeg);
      engine.setVibrato(v, cfg.vibratoRateCentiHz, cfg.vibratoDepthCentiHz);
      engine.setTremolo(v, cfg.tremoloRateCentiHz, cfg.tremoloDepth8Bit);
      engine.setVoiceBus(v, cfg.targetBus);

      // Custom parameters (cp[0], cp[1], cp[2], cp[3])
      engine.setCustomParam(v, 0, cfg.customParam0);
      engine.setCustomParam(v, 1, cfg.customParam1);
      engine.setCustomParam(v, 2, cfg.customParam2 ?? 0);
      engine.setCustomParam(v, 3, cfg.customParam3 ?? 0);
    }
  }, []);

  // Sync Master Configuration changes to C++ Engine
  const applyMasterConfig = useCallback((cfg: MasterConfig) => {
    engine.setMasterVolume(cfg.masterVol);
    engine.setMasterBitcrush(cfg.bitcrush);
    engine.setControlRateHz(cfg.controlRateHz);

    // Bus 1 FX
    engine.setBusFXPatch(1, 0, cfg.bus1FXPatch);
    engine.setBusFXParam(1, 0, 0, cfg.bus1CutoffHz);
    engine.setBusFXParam(1, 0, 1, cfg.bus1FilterMode);
    engine.setBusFXParam(1, 0, 2, cfg.bus1ResonanceQ);
    engine.setBusFXParam(1, 0, 4, cfg.bus1WetMix);
    engine.setBusMix(1, cfg.bus1MixLevel);

    // Global Master DSP
    engine.setCustomDSPPatch(cfg.globalDSPPatch);
    engine.setDSPParam(0, cfg.dspParam0);
    engine.setDSPParam(1, cfg.dspParam1);
    engine.setDSPParam(2, cfg.dspParam2);
    engine.setDSPParam(3, cfg.dspParam3);
  }, []);

  const applyFullConfig = (vCfg: VoiceConfig, mCfg: MasterConfig) => {
    applyMasterConfig(mCfg);
    applyVoiceConfig(vCfg);
  };

  const handleVoiceChange = (updated: Partial<VoiceConfig>) => {
    const newCfg = { ...voiceConfig, ...updated };
    setVoiceConfig(newCfg);
    if (isAudioRunning) {
      applyVoiceConfig(newCfg);
    }
  };

  const handleMasterChange = (updated: Partial<MasterConfig>) => {
    const newCfg = { ...masterConfig, ...updated };
    setMasterConfig(newCfg);
    if (isAudioRunning) {
      applyMasterConfig(newCfg);
    }
  };

  // Keyboard Note Events
  const handleNoteOn = useCallback((midiNote: number, freqCentiHz: number) => {
    if (!isAudioRunning) {
      toggleAudio();
    }
    if (voiceConfig.portamentoMs > 0) {
      // Trigger with slide
      const v = 0;
      engine.slideFreqTo(v, freqCentiHz, voiceConfig.portamentoMs);
      engine.noteOn(v, freqCentiHz, 255);
    } else {
      engine.playMidiNote(midiNote, freqCentiHz, 255);
    }
  }, [isAudioRunning, voiceConfig.portamentoMs, toggleAudio]);

  const handleNoteOff = useCallback((midiNote: number) => {
    engine.releaseMidiNote(midiNote);
  }, []);

  // Stop Demo Playback
  const stopDemo = useCallback(() => {
    if (demoIntervalRef.current !== null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setIsPlayingDemo(false);
    engine.stopAllVoices();
  }, []);

  // Load Preset
  const handleSelectPreset = useCallback((preset: PresetDef) => {
    stopDemo();
    setCurrentPresetId(preset.id);

    let newVoice = { ...voiceConfig };
    let newMaster = { ...masterConfig };

    if (preset.category === 'user' && preset.voiceConfig) {
      newVoice = { ...newVoice, ...preset.voiceConfig };
      if (preset.masterConfig) {
        newMaster = { ...newMaster, ...preset.masterConfig };
      }
    } else {
      switch (preset.id) {
        case 'poly_chords':
        newVoice = {
          ...newVoice,
          waveType: WaveType.WAVE_SAW,
          customPatch: CustomWavePatch.BASIC,
          attackMs: 60,
          decayMs: 100,
          sustain8Bit: 180,
          releaseMs: 250,
          smoothEnv: false,
          targetBus: 0,
          polyphony: 8,
          portamentoMs: 0,
        };
        newMaster = {
          ...newMaster,
          masterVol: 190,
          bitcrush: 0,
          bus1FXPatch: BusFXPatch.NONE,
          globalDSPPatch: GlobalDSPPatch.NONE,
        };
        break;

      case 'arp_bass':
        newVoice = {
          ...newVoice,
          customPatch: CustomWavePatch.AA_SAW,
          attackMs: 10,
          decayMs: 80,
          sustain8Bit: 150,
          releaseMs: 120,
          vibratoDepthCentiHz: 50,
          targetBus: 0,
          portamentoMs: 40,
        };
        newMaster = {
          ...newMaster,
          masterVol: 210,
          bitcrush: 0,
          bus1FXPatch: BusFXPatch.NONE,
          globalDSPPatch: GlobalDSPPatch.NONE,
        };
        break;

      case 'moog_lead':
        newVoice = {
          ...newVoice,
          customPatch: CustomWavePatch.AA_SAW,
          attackMs: 15,
          decayMs: 60,
          sustain8Bit: 200,
          releaseMs: 120,
          targetBus: 1, // Route to Bus 1
          portamentoMs: 60,
        };
        newMaster = {
          ...newMaster,
          masterVol: 210,
          bus1FXPatch: BusFXPatch.FX_BIQUAD_FILTER,
          bus1CutoffHz: 1600,
          bus1FilterMode: 0, // LPF
          bus1ResonanceQ: 280, // Q = 2.8
          bus1WetMix: 255,
          bus1MixLevel: 255,
          globalDSPPatch: GlobalDSPPatch.NONE,
        };
        break;

      case 'hammond_leslie':
        newVoice = {
          ...newVoice,
          customPatch: CustomWavePatch.HAMMOND_B3,
          attackMs: 5,
          decayMs: 40,
          sustain8Bit: 255,
          releaseMs: 60,
          targetBus: 0,
          portamentoMs: 0,
        };
        newMaster = {
          ...newMaster,
          masterVol: 190,
          globalDSPPatch: GlobalDSPPatch.DSP_HAMMOND_LESLIE,
          dspParam0: 80, // Speed
          dspParam1: 150, // Depth
        };
        break;

      case 'eks_guitar':
        newVoice = {
          ...newVoice,
          customPatch: CustomWavePatch.EKS_GUITAR,
          attackMs: 0,
          decayMs: 500,
          sustain8Bit: 50,
          releaseMs: 300,
          targetBus: 0,
          portamentoMs: 0,
        };
        newMaster = {
          ...newMaster,
          masterVol: 200,
          globalDSPPatch: GlobalDSPPatch.DSP_PEDALBOARD,
          dspParam0: 120, // Drive
          dspParam1: 180, // Delay time
          dspParam2: 100, // Delay feedback
          dspParam3: 160, // Tone
        };
        break;

      case 'fm_synth':
        newVoice = {
          ...newVoice,
          customPatch: CustomWavePatch.FM_CUSTOM,
          attackMs: 20,
          decayMs: 200,
          sustain8Bit: 120,
          releaseMs: 200,
          customParam0: 200, // Ratio
          customParam1: 350, // Mod index
          targetBus: 0,
          portamentoMs: 0,
        };
        newMaster = {
          ...newMaster,
          masterVol: 200,
          bus1FXPatch: BusFXPatch.NONE,
          globalDSPPatch: GlobalDSPPatch.NONE,
        };
        break;

      case 'chiptune':
        newVoice = {
          ...newVoice,
          waveType: WaveType.WAVE_PULSE,
          customPatch: CustomWavePatch.BASIC,
          pulseWidth8Bit: 32, // 12.5% duty
          attackMs: 5,
          decayMs: 120,
          sustain8Bit: 80,
          releaseMs: 80,
          targetBus: 0,
          portamentoMs: 0,
        };
        newMaster = {
          ...newMaster,
          masterVol: 220,
          bitcrush: 6, // 6-bit hardware bitcrush
          bus1FXPatch: BusFXPatch.NONE,
          globalDSPPatch: GlobalDSPPatch.NONE,
        };
        break;
      }
    }

    setVoiceConfig(newVoice);
    setMasterConfig(newMaster);
    if (isAudioRunning) {
      applyFullConfig(newVoice, newMaster);
    }
  }, [voiceConfig, masterConfig, isAudioRunning, stopDemo]);

  // Demo Player Loop
  const toggleDemoPlayback = useCallback(async () => {
    if (isPlayingDemo) {
      stopDemo();
      return;
    }

    if (!isAudioRunning) {
      await toggleAudio();
    }

    setIsPlayingDemo(true);
    let step = 0;

    // Chord progressions definition from 01_PolyphonicChords.ino
    const progressionChords = [
      [NOTES.C4, NOTES.DS4, NOTES.G4, NOTES.AS4],  // Cm7
      [NOTES.GS3, NOTES.C4, NOTES.DS4, NOTES.G4],  // Abmaj7
      [NOTES.AS3, NOTES.D4, NOTES.F4, NOTES.AS4],  // Bb
      [NOTES.G3, NOTES.AS3, NOTES.D4, NOTES.F4],   // Gm7
    ];

    // Funk Riff from 03_MoogLead_ModularFX.ino
    const riffNotes = [NOTES.C3, NOTES.DS3, NOTES.F3, NOTES.FS3, NOTES.G3, NOTES.AS3, NOTES.C4];

    demoIntervalRef.current = window.setInterval(() => {
      if (currentPresetId === 'poly_chords') {
        const chordIdx = step % progressionChords.length;
        const chord = progressionChords[chordIdx];
        // Release previous
        for (let v = 0; v < 4; v++) engine.noteOff(v);

        // Play chord
        setTimeout(() => {
          for (let v = 0; v < 4; v++) {
            engine.noteOn(v, chord[v], 70);
          }
        }, 50);

        step++;
      } else if (currentPresetId === 'moog_lead') {
        const noteIdx = step % riffNotes.length;
        const baseFreq = riffNotes[noteIdx];
        engine.noteOff(0);
        engine.noteOff(1);

        // Detuned dual lead
        engine.noteOn(0, baseFreq, 90);
        engine.noteOn(1, baseFreq + 25, 90); // +25 CentiHz

        // Dynamic filter sweep
        const dynamicCutoff = 800 + (noteIdx * 350);
        engine.setBusFXParam(1, 0, 0, dynamicCutoff);

        step++;
      } else {
        // Melodic sequence for other presets
        const noteIdx = step % riffNotes.length;
        const freq = riffNotes[noteIdx];
        engine.noteOff(0);
        setTimeout(() => {
          engine.noteOn(0, freq, 180);
        }, 30);
        step++;
      }
    }, currentPresetId === 'poly_chords' ? 1200 : 220);
  }, [isPlayingDemo, isAudioRunning, currentPresetId, toggleAudio, stopDemo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDemo();
    };
  }, [stopDemo]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header */}
      <Header
        isRunning={isAudioRunning}
        sampleRate={48000}
        masterVol={masterConfig.masterVol}
        cpuLoad={cpuLoad}
        onToggleAudio={toggleAudio}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Presets and Demo Bar */}
        <PresetsBar
          currentPresetId={currentPresetId}
          isPlayingDemo={isPlayingDemo}
          currentVoiceConfig={voiceConfig}
          currentMasterConfig={masterConfig}
          onSelectPreset={handleSelectPreset}
          onToggleDemo={toggleDemoPlayback}
        />

        {/* Real-time Oscilloscope & Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <Oscilloscope analyser={analyser} peak={peakLevel} />
          </div>
          <div className="lg:col-span-2">
            <VoiceTelemetryGrid telemetryVoices={telemetryVoices} maxVoicesToShow={8} />
          </div>
        </div>

        {/* Voice and Master Synthesizer Controls */}
        <div className="space-y-6">
          <VoicePanel
            config={voiceConfig}
            onChange={handleVoiceChange}
            activeEnvLevel={telemetryVoices.find((v) => v.active && v.env8Bit > 0)?.env8Bit || 0}
            onOpenCodeExport={() => setIsCodeExportOpen(true)}
          />
          <MasterPanel config={masterConfig} onChange={handleMasterChange} />
        </div>

        {/* Virtual Keyboard & Pitch Controls */}
        <VirtualKeyboard
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          activeVoicesMidiNotes={[]}
        />
      </main>

      {/* C++ Arduino Code Export Modal */}
      <CodeExportModal
        isOpen={isCodeExportOpen}
        onClose={() => setIsCodeExportOpen(false)}
        voiceConfig={voiceConfig}
        masterConfig={masterConfig}
      />

      {/* Technical Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-4 text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span>ESP32Synth by Danilo Gabriel &bull; WebAssembly Port 1:1</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Pure C++ AudioWorklet</span>
          <span>Zero-Branch PolyBLEP</span>
          <span>Q28 Fixed-Point ADSR</span>
          <span>CentiHz Tuning</span>
        </div>
      </footer>
    </div>
  );
}
