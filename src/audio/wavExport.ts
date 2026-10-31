/**
 * wavExport.ts
 * High-fidelity 16-bit PCM Stereo WAV Encoder and File Downloader for 48kHz Audio
 */

/**
 * Encodes stereo Float32Array audio channels into a standard RIFF WAVE (16-bit PCM, 48kHz) Blob
 */
export function encodeWAV(left: Float32Array, right: Float32Array, sampleRate: number = 48000): Blob {
  const numFrames = left.length;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit PCM = 2 bytes
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings into DataView
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // --- RIFF Header ---
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // Total file size minus 8
  writeString(8, 'WAVE');

  // --- "fmt " Subchunk ---
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);             // Subchunk1Size for PCM
  view.setUint16(20, 1, true);              // AudioFormat: 1 = PCM (linear)
  view.setUint16(22, numChannels, true);    // NumChannels: 2 (Stereo)
  view.setUint32(24, sampleRate, true);     // SampleRate (e.g. 48000 Hz)
  view.setUint32(28, byteRate, true);       // ByteRate: SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, blockAlign, true);     // BlockAlign: NumChannels * BitsPerSample/8
  view.setUint16(34, 16, true);             // BitsPerSample: 16-bit

  // --- "data" Subchunk ---
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);       // Subchunk2Size

  // Interleave and quantize Left / Right Float32 (-1.0 to +1.0) into 16-bit signed PCM
  let writeOffset = 44;
  for (let i = 0; i < numFrames; i++) {
    // Left channel sample
    let sampleL = left[i];
    // Clamp to [-1.0, 1.0]
    sampleL = Math.max(-1, Math.min(1, sampleL));
    // Scale to signed 16-bit int: -32768 to 32767
    const intSampleL = sampleL < 0 ? Math.round(sampleL * 32768) : Math.round(sampleL * 32767);
    view.setInt16(writeOffset, intSampleL, true);
    writeOffset += 2;

    // Right channel sample
    let sampleR = right[i];
    sampleR = Math.max(-1, Math.min(1, sampleR));
    const intSampleR = sampleR < 0 ? Math.round(sampleR * 32768) : Math.round(sampleR * 32767);
    view.setInt16(writeOffset, intSampleR, true);
    writeOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Triggers a browser download of a WAV Blob with an optional filename
 */
export function downloadWAVBlob(blob: Blob, filename?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = filename || `esp32synth-48khz-${timestamp}.wav`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();

  window.setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
