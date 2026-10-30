import React, { useEffect, useRef } from 'react';

interface OscilloscopeProps {
  analyser: AnalyserNode | null;
  peak: number;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({ analyser, peak }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 256);
    const timeData = new Uint8Array(analyser ? analyser.fftSize : 512);

    const render = () => {
      animationId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      // Dark background with technical grid lines
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 32) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 24) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Center line
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!analyser) return;

      // Draw frequency spectrum bars in background
      analyser.getByteFrequencyData(dataArray);
      const barCount = 48;
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * 2] / 255.0;
        const barHeight = val * (height * 0.6);
        ctx.fillStyle = `rgba(16, 185, 129, ${0.1 + val * 0.3})`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      // Draw real-time waveform line
      analyser.getByteTimeDomainData(timeData);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const sliceWidth = width / timeData.length;
      let x = 0;

      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          DSP STEREO OSCILLOSCOPE & SPECTRUM
        </span>
        <div className="flex items-center gap-2">
          <span>PEAK:</span>
          <div className="w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                peak > 0.9 ? 'bg-rose-500' : peak > 0.6 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.round(peak * 100))}%` }}
            />
          </div>
          <span className="text-slate-300 w-9 text-right font-bold">{Math.round(peak * 100)}%</span>
        </div>
      </div>

      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          width={640}
          height={128}
          className="w-full h-full block"
        />
        <div className="absolute top-2 right-2 text-[10px] font-mono text-emerald-400/60 pointer-events-none">
          48000 Hz / 16-bit
        </div>
      </div>
    </div>
  );
};
