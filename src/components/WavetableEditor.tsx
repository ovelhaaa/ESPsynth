import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Waves,
  Sparkles,
  Sliders,
  Volume2,
  RefreshCw,
  Cpu,
  Layers,
  Wand2,
  Activity,
  Zap,
} from 'lucide-react';
import { BitDepth } from '../audio/types';

interface WavetableEditorProps {
  samples: number[]; // 256 signed 16-bit integers (-32768 to 32767)
  bitDepth: BitDepth;
  onChange: (samples: number[], depth: BitDepth) => void;
}

const TABLE_SIZE = 256;

export const WavetableEditor: React.FC<WavetableEditorProps> = ({
  samples,
  bitDepth,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastCoordRef = useRef<{ x: number; y: number } | null>(null);

  // Quantize a 16-bit sample (-32768..32767) to target BitDepth and back to 16-bit representation
  const quantizeSample = useCallback((val: number, depth: BitDepth): number => {
    val = Math.max(-32768, Math.min(32767, val));
    if (depth === BitDepth.BITS_4) {
      // 4-bit unsigned: 0..15 centered at 8. Step = 4096.
      // (val + 32768) maps 0..65535 to 0..15
      const u4 = Math.max(0, Math.min(15, Math.round((val + 32768) / 4369)));
      return (u4 - 8) * 4096;
    } else if (depth === BitDepth.BITS_8) {
      // 8-bit unsigned: 0..255 centered at 128. Step = 256.
      const u8 = Math.max(0, Math.min(255, Math.round((val + 32768) / 257)));
      return (u8 - 128) * 256;
    }
    // BITS_16: Full resolution
    return Math.round(val);
  }, []);

  // Redraw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Horizontal grid (mid line, +0.5, -0.5)
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    // Vertical quarter marks
    ctx.beginPath();
    for (let q = 1; q < 4; q++) {
      const qx = (width * q) / 4;
      ctx.moveTo(qx, 0);
      ctx.lineTo(qx, height);
    }
    ctx.stroke();

    // Center line highlight
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Waveform path
    const numSamples = samples.length;
    const dx = width / (numSamples - 1);

    // Gradient fill under waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (bitDepth === BitDepth.BITS_4) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)'); // Red crunch
      gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.05)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.25)');
    } else if (bitDepth === BitDepth.BITS_8) {
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.25)'); // Amber vintage
      gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.05)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0.25)');
    } else {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)'); // Emerald Hi-Fi
      gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
    }

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < numSamples; i++) {
      const x = i * dx;
      const qVal = quantizeSample(samples[i], bitDepth);
      const normY = qVal / 32768; // -1 to +1
      const y = midY - normY * (midY - 8);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, midY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Waveform stroke line
    ctx.beginPath();
    ctx.lineWidth = 2;
    if (bitDepth === BitDepth.BITS_4) {
      ctx.strokeStyle = '#f87171'; // Red-400
    } else if (bitDepth === BitDepth.BITS_8) {
      ctx.strokeStyle = '#fbbf24'; // Amber-400
    } else {
      ctx.strokeStyle = '#34d399'; // Emerald-400
    }

    for (let i = 0; i < numSamples; i++) {
      const x = i * dx;
      const qVal = quantizeSample(samples[i], bitDepth);
      const normY = qVal / 32768;
      const y = midY - normY * (midY - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [samples, bitDepth, quantizeSample]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle Mouse / Touch Drawing on the Canvas
  const handlePointerAction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = Math.max(0, Math.min(rect.width, clientX - rect.width - rect.left + rect.width));
    const currentY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const sampleIdx = Math.max(0, Math.min(TABLE_SIZE - 1, Math.round((currentX / rect.width) * (TABLE_SIZE - 1))));
    const normVal = (rect.height / 2 - currentY) / (rect.height / 2 - 8);
    const clampedVal = Math.max(-32768, Math.min(32767, Math.round(normVal * 32767)));

    const newSamples = [...samples];

    // Interpolate from last coordinate to prevent gaps during fast drags
    if (lastCoordRef.current !== null) {
      const prevIdx = lastCoordRef.current.x;
      const prevVal = lastCoordRef.current.y;
      const minI = Math.min(prevIdx, sampleIdx);
      const maxI = Math.max(prevIdx, sampleIdx);
      const stepCount = maxI - minI;

      if (stepCount > 0) {
        for (let i = minI; i <= maxI; i++) {
          const t = (i - prevIdx) / (sampleIdx - prevIdx || 1);
          const interpVal = Math.round(prevVal + t * (clampedVal - prevVal));
          newSamples[i] = quantizeSample(interpVal, bitDepth);
        }
      } else {
        newSamples[sampleIdx] = quantizeSample(clampedVal, bitDepth);
      }
    } else {
      newSamples[sampleIdx] = quantizeSample(clampedVal, bitDepth);
    }

    lastCoordRef.current = { x: sampleIdx, y: clampedVal };
    onChange(newSamples, bitDepth);
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    lastCoordRef.current = null;
    handlePointerAction(e);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    handlePointerAction(e);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastCoordRef.current = null;
  };

  // Quick Waveform Generators
  const generateWave = (type: 'additive' | 'sinc' | 'formant' | 'folded' | 'saw' | 'tri' | 'pulse') => {
    const arr = new Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) {
      const phase = (i / TABLE_SIZE) * 2 * Math.PI;
      const x = i / TABLE_SIZE; // 0 to 1
      let v = 0;

      switch (type) {
        case 'additive': {
          // Odd harmonics (1st, 3rd, 5th, 7th) with organ-like rolloff
          v = Math.sin(phase) +
              0.55 * Math.sin(3 * phase) +
              0.35 * Math.sin(5 * phase) +
              0.22 * Math.sin(7 * phase) +
              0.12 * Math.sin(9 * phase);
          v /= 2.24;
          break;
        }
        case 'sinc': {
          // Cardinal Sine centered around middle
          const sx = (x - 0.5) * 12 * Math.PI;
          v = sx === 0 ? 1 : Math.sin(sx) / sx;
          break;
        }
        case 'formant': {
          // Vocal resonant formant pulse
          const formantFreq = 11;
          const envelope = Math.exp(-4.5 * x);
          v = Math.sin(formantFreq * 2 * Math.PI * x) * envelope * 1.5;
          break;
        }
        case 'folded': {
          // Wavefolded sine (distortion / West Coast synthesis)
          const raw = Math.sin(phase) * 3.2;
          // Fold between -1 and 1
          let folded = raw;
          while (folded > 1 || folded < -1) {
            if (folded > 1) folded = 2 - folded;
            if (folded < -1) folded = -2 - folded;
          }
          v = folded;
          break;
        }
        case 'saw': {
          v = 1.0 - 2.0 * x;
          break;
        }
        case 'tri': {
          v = x < 0.5 ? 4.0 * x - 1.0 : 3.0 - 4.0 * x;
          break;
        }
        case 'pulse': {
          v = x < 0.5 ? 0.95 : -0.95;
          break;
        }
      }

      arr[i] = quantizeSample(Math.round(v * 32760), bitDepth);
    }
    onChange(arr, bitDepth);
  };

  // Modify Operations (Smooth, Invert, Normalize, Randomize)
  const applyOperation = (op: 'smooth' | 'invert' | 'normalize' | 'random') => {
    let arr = [...samples];
    switch (op) {
      case 'smooth': {
        const smoothed = new Array(TABLE_SIZE);
        for (let i = 0; i < TABLE_SIZE; i++) {
          const prev = arr[(i - 1 + TABLE_SIZE) % TABLE_SIZE];
          const curr = arr[i];
          const next = arr[(i + 1) % TABLE_SIZE];
          smoothed[i] = quantizeSample(Math.round((prev + 2 * curr + next) / 4), bitDepth);
        }
        arr = smoothed;
        break;
      }
      case 'invert': {
        arr = arr.map((v) => quantizeSample(-v, bitDepth));
        break;
      }
      case 'normalize': {
        let maxAbs = 0;
        for (let i = 0; i < TABLE_SIZE; i++) {
          const a = Math.abs(arr[i]);
          if (a > maxAbs) maxAbs = a;
        }
        if (maxAbs > 0) {
          const scale = 32760 / maxAbs;
          arr = arr.map((v) => quantizeSample(Math.round(v * scale), bitDepth));
        }
        break;
      }
      case 'random': {
        arr = arr.map(() => quantizeSample(Math.round((Math.random() * 2 - 1) * 32760), bitDepth));
        break;
      }
    }
    onChange(arr, bitDepth);
  };

  const handleBitDepthChange = (newDepth: BitDepth) => {
    const reQuantized = samples.map((s) => quantizeSample(s, newDepth));
    onChange(reQuantized, newDepth);
  };

  return (
    <div className="bg-slate-950/80 border border-emerald-900/60 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              Wavetable Draw Studio &bull; 256 Samples
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Interactive Single-Cycle Waveform Canvas &amp; Fixed-Point Exporter
            </span>
          </div>
        </div>

        {/* Bit-Depth Selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 px-2 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-500" /> Resolution:
          </span>
          {[
            { depth: BitDepth.BITS_16, label: '16-BIT', sub: 'Hi-Fi', color: 'text-emerald-400 border-emerald-500/50' },
            { depth: BitDepth.BITS_8, label: '8-BIT', sub: 'Vintage', color: 'text-amber-400 border-amber-500/50' },
            { depth: BitDepth.BITS_4, label: '4-BIT', sub: 'Crunch', color: 'text-red-400 border-red-500/50' },
          ].map((b) => (
            <button
              key={b.depth}
              type="button"
              onClick={() => handleBitDepthChange(b.depth)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                bitDepth === b.depth
                  ? `bg-slate-800 ${b.color} border shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>{b.label}</span>
              <span className="text-[8px] opacity-70">({b.sub})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Draw Canvas */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Click and drag mouse or finger across canvas to sculpt waveform</span>
          <span className="text-emerald-400 font-bold">
            {bitDepth === BitDepth.BITS_4
              ? '4-Bit Chiptune Nibbles (16 Levels)'
              : bitDepth === BitDepth.BITS_8
              ? '8-Bit PCM Byte (256 Levels)'
              : '16-Bit Studio Signed PCM'}
          </span>
        </div>

        <div className="relative border border-slate-700/80 rounded-lg overflow-hidden shadow-inner cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={512}
            height={140}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            className="w-full h-36 block select-none"
          />
        </div>
      </div>

      {/* Quick Generators & Waveform Operations */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-850 text-xs">
        {/* Generators */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 mr-1 flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" /> Generators:
          </span>
          {[
            { id: 'additive', label: 'Harmônicos Aditivos' },
            { id: 'sinc', label: 'Sinc' },
            { id: 'formant', label: 'Formant' },
            { id: 'folded', label: 'Folded Sine' },
            { id: 'saw', label: 'Saw' },
            { id: 'tri', label: 'Tri' },
            { id: 'pulse', label: 'Pulse' },
          ].map((gen) => (
            <button
              key={gen.id}
              type="button"
              onClick={() => generateWave(gen.id as any)}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 hover:border-slate-600 rounded text-[10px] font-mono transition cursor-pointer"
            >
              {gen.label}
            </button>
          ))}
        </div>

        {/* Sculpt Operations */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Transform:
          </span>
          <button
            type="button"
            onClick={() => applyOperation('smooth')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-600 rounded text-[10px] font-mono transition cursor-pointer"
            title="Filter moving average smoothing"
          >
            Smooth
          </button>
          <button
            type="button"
            onClick={() => applyOperation('normalize')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-600 rounded text-[10px] font-mono transition cursor-pointer"
            title="Normalize to maximum peak +/-32767"
          >
            Normalize
          </button>
          <button
            type="button"
            onClick={() => applyOperation('invert')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-600 rounded text-[10px] font-mono transition cursor-pointer"
            title="Invert phase 180 degrees"
          >
            Invert
          </button>
          <button
            type="button"
            onClick={() => applyOperation('random')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-600 rounded text-[10px] font-mono transition cursor-pointer"
            title="Generate random points"
          >
            Random
          </button>
        </div>
      </div>
    </div>
  );
};
