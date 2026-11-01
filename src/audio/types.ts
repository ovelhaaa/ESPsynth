/**
 * Enums and types matching 1:1 with ESP32Synth.h & ESP32Synth_Patches.hpp
 */

export enum WaveType {
  WAVE_SINE = -1,
  WAVE_TRIANGLE = -2,
  WAVE_SAW = -3,
  WAVE_PULSE = -4,
  WAVE_NOISE = -5,
  WAVE_WAVETABLE = 1,
  WAVE_SAMPLE = 2,
  WAVE_STREAM = 3,
  WAVE_CUSTOM = 4,
}

export enum BitDepth {
  BITS_4 = 0,
  BITS_8 = 1,
  BITS_16 = 2,
}

export enum EnvState {
  ENV_IDLE = 0,
  ENV_ATTACK = 1,
  ENV_DECAY = 2,
  ENV_SUSTAIN = 3,
  ENV_RELEASE = 4,
}

export enum CustomWavePatch {
  BASIC = 0,
  AA_SAW = 1,
  AA_PULSE = 2,
  DSP_BIQUAD_FAST = 3,
  DSP_BIQUAD = 4,
  FM_CUSTOM = 5,
  HAMMOND_B3 = 6,
  EKS_GUITAR = 7,
}

export enum BusFXPatch {
  NONE = 0,
  FX_BIQUAD_FILTER = 1,
  FX_BIQUAD_FILTER_FAST = 2,
}

export enum GlobalDSPPatch {
  NONE = 0,
  DSP_HAMMOND_LESLIE = 1,
  DSP_PEDALBOARD = 2,
}

export interface VoiceTelemetry {
  voice: number;
  active: boolean;
  freqCentiHz: number;
  env8Bit: number;
  output8Bit: number;
  envState: EnvState;
  waveType: WaveType;
}

export interface EngineTelemetry {
  activeVoices: VoiceTelemetry[];
  cpuLoad: number;
  peak: number;
  masterVol: number;
}
