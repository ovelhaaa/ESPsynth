import React, { useState } from 'react';
import { VoiceTelemetry, EnvState, WaveType } from '../audio/types';
import { centiHzToNoteName } from '../audio/notes';
import { Activity, Layers } from 'lucide-react';

interface VoiceTelemetryGridProps {
  telemetryVoices: VoiceTelemetry[];
  maxVoicesToShow?: number;
}

const ENV_STATE_NAMES: Record<EnvState, { name: string; color: string; badge: string }> = {
  [EnvState.ENV_IDLE]: {
    name: 'IDLE',
    color: 'text-slate-500 bg-slate-900 border-slate-800',
    badge: 'bg-slate-800 text-slate-500',
  },
  [EnvState.ENV_ATTACK]: {
    name: 'ATTACK',
    color: 'text-amber-400 bg-amber-950/70 border-amber-800/80',
    badge: 'bg-amber-500 text-slate-950 font-black',
  },
  [EnvState.ENV_DECAY]: {
    name: 'DECAY',
    color: 'text-blue-400 bg-blue-950/70 border-blue-800/80',
    badge: 'bg-blue-500 text-slate-950 font-black',
  },
  [EnvState.ENV_SUSTAIN]: {
    name: 'SUSTAIN',
    color: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80',
    badge: 'bg-emerald-500 text-slate-950 font-black',
  },
  [EnvState.ENV_RELEASE]: {
    name: 'RELEASE',
    color: 'text-purple-400 bg-purple-950/70 border-purple-800/80',
    badge: 'bg-purple-500 text-slate-950 font-black',
  },
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
  maxVoicesToShow = 16,
}) => {
  const [viewCount, setViewCount] = useState<number>(16);

  const voiceMap = new Map<number, VoiceTelemetry>();
  telemetryVoices.forEach((v) => voiceMap.set(v.voice, v));

  const voices = Array.from({ length: viewCount }, (_, i) => {
    return (
      voiceMap.get(i) || {
        voice: i,
        active: false,
        freqCentiHz: 0,
        env8Bit: 0,
        output8Bit: 0,
        envState: EnvState.ENV_IDLE,
        waveType: WaveType.WAVE_SINE,
      }
    );
  });

  const activeCount = telemetryVoices.filter((v) => v.active).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            16-Voice C++ Hardware Matrix Telemetry
            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
              {activeCount} / {viewCount} Active
            </span>
          </h3>
        </div>

        {/* 8 vs 16 Voices View Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px] font-mono">
          <button
            onClick={() => setViewCount(8)}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-bold ${
              viewCount === 8
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            8 Voices
          </button>
          <button
            onClick={() => setViewCount(16)}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-bold ${
              viewCount === 16
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            16 Voices (Full)
          </button>
        </div>
      </div>

      {/* Grid of 16 voices */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
        {voices.map((v) => {
          const stateInfo = ENV_STATE_NAMES[v.envState] || ENV_STATE_NAMES[EnvState.ENV_IDLE];
          const waveLabel = WAVE_TYPE_NAMES[v.waveType] || 'WAVE';
          const meterPercent = Math.min(100, Math.round((v.output8Bit / 255) * 100));

          return (
            <div
              key={v.voice}
              className={`p-2 rounded-lg border font-mono transition-all duration-75 flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                v.active
                  ? 'bg-slate-950 border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/50 border-slate-800/70 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-bold ${v.active ? 'text-emerald-300' : 'text-slate-500'}`}>
                  V{v.voice}
                </span>
                <span className={`text-[8px] px-1 py-0.2 rounded font-semibold ${stateInfo.color}`}>
                  {stateInfo.name}
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-slate-200 truncate">
                  {v.active && v.freqCentiHz > 0 ? (
                    <>
                      <span className="text-emerald-300 font-extrabold">{centiHzToNoteName(v.freqCentiHz)}</span>
                      <span className="text-[9px] text-slate-400 ml-1 font-normal font-mono">
                        {v.freqCentiHz}c
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">---</span>
                  )}
                </div>

                <div className="text-[9px] text-slate-400 flex justify-between">
                  <span>{waveLabel}</span>
                  <span>Env:{v.env8Bit}</span>
                </div>
              </div>

              {/* Mini audio level meter bar */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-75 ${
                    v.active ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' : 'bg-slate-800'
                  }`}
                  style={{ width: `${meterPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
