import React from 'react';
import { VoiceTelemetry, EnvState, WaveType } from '../audio/types';
import { centiHzToNoteName } from '../audio/notes';

interface VoiceTelemetryGridProps {
  telemetryVoices: VoiceTelemetry[];
  maxVoicesToShow?: number;
}

const ENV_STATE_NAMES: Record<EnvState, { name: string; color: string }> = {
  [EnvState.ENV_IDLE]: { name: 'IDLE', color: 'text-slate-500 bg-slate-900 border-slate-800' },
  [EnvState.ENV_ATTACK]: { name: 'ATTACK', color: 'text-amber-400 bg-amber-950/60 border-amber-800/60' },
  [EnvState.ENV_DECAY]: { name: 'DECAY', color: 'text-blue-400 bg-blue-950/60 border-blue-800/60' },
  [EnvState.ENV_SUSTAIN]: { name: 'SUSTAIN', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' },
  [EnvState.ENV_RELEASE]: { name: 'RELEASE', color: 'text-purple-400 bg-purple-950/60 border-purple-800/60' },
};

const WAVE_TYPE_NAMES: Record<number, string> = {
  [WaveType.WAVE_SINE]: 'SINE',
  [WaveType.WAVE_TRIANGLE]: 'TRI',
  [WaveType.WAVE_SAW]: 'SAW',
  [WaveType.WAVE_PULSE]: 'PULSE',
  [WaveType.WAVE_NOISE]: 'NOISE',
  [WaveType.WAVE_CUSTOM]: 'CUSTOM',
  [WaveType.WAVE_WAVETABLE]: 'WTABLE',
  [WaveType.WAVE_SAMPLE]: 'SAMPLE',
};

export const VoiceTelemetryGrid: React.FC<VoiceTelemetryGridProps> = ({
  telemetryVoices,
  maxVoicesToShow = 8,
}) => {
  const voiceMap = new Map<number, VoiceTelemetry>();
  telemetryVoices.forEach(v => voiceMap.set(v.voice, v));

  const voices = Array.from({ length: maxVoicesToShow }, (_, i) => {
    return voiceMap.get(i) || {
      voice: i,
      active: false,
      freqCentiHz: 0,
      env8Bit: 0,
      output8Bit: 0,
      envState: EnvState.ENV_IDLE,
      waveType: WaveType.WAVE_SINE,
    };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          Voice Engine Telemetry (C++ Internal State)
        </h3>
        <span className="text-[11px] font-mono text-slate-500">
          Showing voices 0 &ndash; {maxVoicesToShow - 1}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
        {voices.map((v) => {
          const stateInfo = ENV_STATE_NAMES[v.envState] || ENV_STATE_NAMES[EnvState.ENV_IDLE];
          const waveLabel = WAVE_TYPE_NAMES[v.waveType] || 'WAVE';

          return (
            <div
              key={v.voice}
              className={`p-2.5 rounded-lg border font-mono transition-all duration-75 flex flex-col justify-between gap-1.5 ${
                v.active
                  ? 'bg-slate-950 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-bold ${v.active ? 'text-emerald-300' : 'text-slate-500'}`}>
                  V{v.voice}
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${stateInfo.color}`}>
                  {stateInfo.name}
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200 truncate">
                  {v.active && v.freqCentiHz > 0 ? (
                    <>
                      <span>{centiHzToNoteName(v.freqCentiHz)}</span>
                      <span className="text-[10px] text-slate-400 ml-1 font-normal">
                        ({v.freqCentiHz} cHz)
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">---</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>{waveLabel}</span>
                  <span>Env: {v.env8Bit}</span>
                </div>
              </div>

              {/* Mini level bar */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round((v.output8Bit / 255) * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
