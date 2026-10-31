/**
 * ESP32Synth WebAssembly Studio
 * 1:1 Mirror of Danilo Gabriel's ESP32Synth C++ Library
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ESP32SynthEngine } from './audio/ESP32SynthEngine';
import { WaveType, CustomWavePatch, BusFXPatch, GlobalDSPPatch, VoiceTelemetry } from './audio/types';
import { NOTES, midiToCentiHz, transposeCentiHz } from './audio/notes';
import { useWebMidi } from './audio/useWebMidi';
import { Header } from './components/Header';
import { PresetsBar, PresetDef } from './components/PresetsBar';
import { Oscilloscope } from './components/Oscilloscope';
import { VoicePanel, VoiceConfig } from './components/VoicePanel';
import { MasterPanel, MasterConfig } from './components/MasterPanel';
import { ArpeggiatorPanel, ArpConfig } from './components/ArpeggiatorPanel';
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
  const [isAuditioningArp, setIsAuditioningArp] = useState<boolean>(false);
  const demoIntervalRef = useRef<number | null>(null);
  const lastFreqRef = useRef<number>(NOTES.C4);

  // Master Configuration State
  const [masterConfig, setMasterConfig] = useState<MasterConfig>({
    masterVol: 200,
    bitcrush: 0,
    controlRateHz: 100,
    bus1FXPatch: BusFXPatch.NONE,
    bus1CutoffHz: 1600,
    bus1FilterMode: 0,
    bus1ResonanceQ: 200,
    bus1BwMode: 0,
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
    customParam0: 0,
    customParam1: 1800,
    customParam2: 200,
    customParam3: 0,
  });

  // Hardware Arpeggiator & Tracker State (synth.setArpeggio)
  const [arpConfig, setArpConfig] = useState<ArpConfig>({
    enabled: false,
    durationMs: 125,
    steps: [0, 4, 7, 12, 16, 12, 7, 4],
    stepCount: 4,
    activeSteps: [true, true, true, true, true, true, true, true],
  });

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

    // Bus 1 FX (ep[0..4])
    engine.setBusFXPatch(1, 0, cfg.bus1FXPatch);
    engine.setBusFXParam(1, 0, 0, cfg.bus1CutoffHz);
    engine.setBusFXParam(1, 0, 1, cfg.bus1FilterMode);
    engine.setBusFXParam(1, 0, 2, cfg.bus1ResonanceQ);
    engine.setBusFXParam(1, 0, 3, cfg.bus1BwMode ?? 0);
    engine.setBusFXParam(1, 0, 4, cfg.bus1WetMix);
    engine.setBusMix(1, cfg.bus1MixLevel);

    // Global Master DSP (dp[0..3])
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

  // Note Triggering (Keyboard & Web MIDI)
  const handleNoteOn = useCallback((midiNote: number, freqCentiHz: number, velocity: number = 255) => {
    if (!isAudioRunning) {
      toggleAudio();
    }
    const v = engine.playMidiNote(midiNote, freqCentiHz, velocity);

    // Portamento frequency slide (slideFreq)
    if (voiceConfig.portamentoMs > 0) {
      engine.slideFreq(v, lastFreqRef.current, freqCentiHz, voiceConfig.portamentoMs);
    }
    lastFreqRef.current = freqCentiHz;

    // Hardware Arpeggiator integration (setArpeggio)
    if (arpConfig.enabled) {
      const activeStepsWithFreqs = arpConfig.steps
        .slice(0, arpConfig.stepCount)
        .map((st, i) => (arpConfig.activeSteps[i] ? transposeCentiHz(freqCentiHz, st) : freqCentiHz));

      if (activeStepsWithFreqs.length > 0) {
        engine.setArpeggio(v, arpConfig.durationMs, activeStepsWithFreqs);
      }
    } else {
      engine.detachArpeggio(v);
    }
  }, [isAudioRunning, voiceConfig.portamentoMs, arpConfig, toggleAudio]);

  const handleNoteOff = useCallback((midiNote: number) => {
    engine.releaseMidiNote(midiNote);
  }, []);

  // Web MIDI API connection hook
  const {
    isSupported: isMidiSupported,
    isConnected: isMidiConnected,
    deviceName: midiDeviceName,
    hasActivity: hasMidiActivity,
    requestMidi,
  } = useWebMidi({
    onNoteOn: (note, velocity) => {
      const cHz = midiToCentiHz(note);
      handleNoteOn(note, cHz, Math.round((velocity / 127) * 255));
    },
    onNoteOff: (note) => {
      handleNoteOff(note);
    },
  });

  // Hardware Arpeggiator Audition loop
  const handleAuditionArp = useCallback((active: boolean) => {
    setIsAuditioningArp(active);
    if (active) {
      if (!isAudioRunning) {
        toggleAudio();
      }
      const baseFreq = NOTES.C3;
      engine.noteOn(0, baseFreq, 220);
      const activeStepsWithFreqs = arpConfig.steps
        .slice(0, arpConfig.stepCount)
        .map((st, i) => (arpConfig.activeSteps[i] ? transposeCentiHz(baseFreq, st) : baseFreq));
      engine.setArpeggio(0, arpConfig.durationMs, activeStepsWithFreqs);
    } else {
      engine.detachArpeggio(0);
      engine.noteOff(0);
    }
  }, [isAudioRunning, arpConfig, toggleAudio]);

  const handleArpChange = (updated: Partial<ArpConfig>) => {
    const newCfg = { ...arpConfig, ...updated };
    setArpConfig(newCfg);

    // If currently auditioning, update arpeggio on voice 0 in real-time
    if (isAuditioningArp) {
      const baseFreq = NOTES.C3;
      const activeStepsWithFreqs = newCfg.steps
        .slice(0, newCfg.stepCount)
        .map((st, i) => (newCfg.activeSteps[i] ? transposeCentiHz(baseFreq, st) : baseFreq));
      engine.setArpeggio(0, newCfg.durationMs, activeStepsWithFreqs);
    }
  };

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
    let newArp = { ...arpConfig, enabled: false };

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
          newArp = { ...newArp, enabled: false };
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
          newArp = {
            enabled: true,
            durationMs: 125,
            steps: [0, 12, 0, 12, 0, 12, 0, 12],
            stepCount: 4,
            activeSteps: [true, true, true, true, true, true, true, true],
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
            targetBus: 1, // Route to Bus 1 for resonant biquad filtering
            portamentoMs: 60,
          };
          newMaster = {
            ...newMaster,
            masterVol: 210,
            bus1FXPatch: BusFXPatch.FX_BIQUAD_FILTER,
            bus1CutoffHz: 1600,
            bus1FilterMode: 0, // LPF
            bus1ResonanceQ: 280, // Q = 2.80
            bus1BwMode: 0,
            bus1WetMix: 255,
            bus1MixLevel: 255,
            globalDSPPatch: GlobalDSPPatch.NONE,
          };
          newArp = { ...newArp, enabled: false };
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
            customParam0: 0, // 88 8000 000 Warm Jazz Organ
          };
          newMaster = {
            ...newMaster,
            masterVol: 190,
            globalDSPPatch: GlobalDSPPatch.DSP_HAMMOND_LESLIE,
            dspParam0: 2, // Tremolo Fast Rotor
            dspParam1: 140, // Spring/Room Reverb Mix
          };
          newArp = { ...newArp, enabled: false };
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
            dspParam0: 1, // Distortion ON
            dspParam1: 1, // Chorus ON
            dspParam2: 1, // Delay ON
            dspParam3: 0,
          };
          newArp = { ...newArp, enabled: false };
          break;

        case 'fm_synth':
          newVoice = {
            ...newVoice,
            customPatch: CustomWavePatch.FM_CUSTOM,
            attackMs: 20,
            decayMs: 200,
            sustain8Bit: 120,
            releaseMs: 200,
            customParam0: 2,  // Ratio Int (2:1)
            customParam1: 0,  // Ratio Frac (.00)
            customParam2: 45, // Mod Index Base
            customParam3: 8,  // Mod Decay
            targetBus: 0,
            portamentoMs: 0,
          };
          newMaster = {
            ...newMaster,
            masterVol: 200,
            bus1FXPatch: BusFXPatch.NONE,
            globalDSPPatch: GlobalDSPPatch.NONE,
          };
          newArp = { ...newArp, enabled: false };
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
          newArp = { ...newArp, enabled: false };
          break;
      }
    }

    setVoiceConfig(newVoice);
    setMasterConfig(newMaster);
    setArpConfig(newArp);
    if (isAudioRunning) {
      applyFullConfig(newVoice, newMaster);
    }
  }, [voiceConfig, masterConfig, arpConfig, isAudioRunning, stopDemo]);

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

    const progressionChords = [
      [NOTES.C4, NOTES.DS4, NOTES.G4, NOTES.AS4],  // Cm7
      [NOTES.GS3, NOTES.C4, NOTES.DS4, NOTES.G4],  // Abmaj7
      [NOTES.AS3, NOTES.D4, NOTES.F4, NOTES.AS4],  // Bb
      [NOTES.G3, NOTES.AS3, NOTES.D4, NOTES.F4],   // Gm7
    ];

    const riffNotes = [NOTES.C3, NOTES.DS3, NOTES.F3, NOTES.FS3, NOTES.G3, NOTES.AS3, NOTES.C4];

    demoIntervalRef.current = window.setInterval(() => {
      if (currentPresetId === 'poly_chords') {
        const chordIdx = step % progressionChords.length;
        const chord = progressionChords[chordIdx];
        for (let v = 0; v < 4; v++) engine.noteOff(v);

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

        engine.noteOn(0, baseFreq, 90);
        engine.noteOn(1, baseFreq + 25, 90);

        const dynamicCutoff = 800 + (noteIdx * 350);
        engine.setBusFXParam(1, 0, 0, dynamicCutoff);

        step++;
      } else {
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

  // Active midi notes from telemetry for virtual keyboard feedback
  const activeMidiNotes = telemetryVoices
    .filter((v) => v.active && v.freqCentiHz > 0)
    .map((v) => Math.round(69 + 12 * Math.log2(v.freqCentiHz / 100 / 440)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header with Web MIDI Status Indicator */}
      <Header
        isRunning={isAudioRunning}
        sampleRate={48000}
        masterVol={masterConfig.masterVol}
        cpuLoad={cpuLoad}
        onToggleAudio={toggleAudio}
        midiState={{
          isSupported: isMidiSupported,
          isConnected: isMidiConnected,
          deviceName: midiDeviceName,
          hasActivity: hasMidiActivity,
        }}
        onRequestMidi={requestMidi}
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

        {/* Real-time Oscilloscope & 16-Voice Matrix Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <Oscilloscope analyser={analyser} peak={peakLevel} />
          </div>
          <div className="lg:col-span-2">
            <VoiceTelemetryGrid telemetryVoices={telemetryVoices} maxVoicesToShow={16} />
          </div>
        </div>

        {/* 1. Core Synthesis Algorithm Selector & Voice Timbre Studio */}
        <VoicePanel
          config={voiceConfig}
          onChange={handleVoiceChange}
          activeEnvLevel={telemetryVoices.find((v) => v.active && v.env8Bit > 0)?.env8Bit || 0}
          onOpenCodeExport={() => setIsCodeExportOpen(true)}
        />

        {/* 2. Hardware Arpeggiator & Tracker Step Sequencer */}
        <ArpeggiatorPanel
          arpConfig={arpConfig}
          onArpChange={handleArpChange}
          portamentoMs={voiceConfig.portamentoMs}
          onPortamentoChange={(ms) => handleVoiceChange({ portamentoMs: ms })}
          onAuditionArp={handleAuditionArp}
          isAuditioning={isAuditioningArp}
        />

        {/* 3. Master Hardware Output, Modular Bus 1 Filter & Stompbox Pedalboard */}
        <MasterPanel config={masterConfig} onChange={handleMasterChange} />

        {/* 4. Virtual Keyboard & Pitch Controls */}
        <VirtualKeyboard
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          activeVoicesMidiNotes={activeMidiNotes}
          midiConnectedDevice={midiDeviceName}
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
          <span>Web MIDI Enabled</span>
        </div>
      </footer>
    </div>
  );
}
