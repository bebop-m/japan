"use client";

function getAudioContextConstructor() {
  const windowWithWebkit = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };

  return window.AudioContext ?? windowWithWebkit.webkitAudioContext;
}

function getOfflineAudioContextConstructor() {
  const windowWithWebkit = window as typeof window & {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };

  return window.OfflineAudioContext ?? windowWithWebkit.webkitOfflineAudioContext;
}

function interleaveMonoChannel(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  );
  const mono = new Float32Array(buffer.length);

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    let sum = 0;

    for (const channel of channelData) {
      sum += channel[sampleIndex] ?? 0;
    }

    mono[sampleIndex] = sum / buffer.numberOfChannels;
  }

  return mono;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;

  for (const sample of samples) {
    const normalized = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], {
    type: "audio/wav"
  });
}

export function getPreferredRecordingMimeType(): string | undefined {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) {
    return undefined;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export async function transcodeRecordedBlobToWav(
  source: Blob,
  targetSampleRate = 16000
): Promise<Blob> {
  const AudioContextConstructor = getAudioContextConstructor();
  const OfflineAudioContextConstructor = getOfflineAudioContextConstructor();

  if (!AudioContextConstructor || !OfflineAudioContextConstructor) {
    throw new Error("AudioContext is not available in this browser.");
  }

  const audioContext = new AudioContextConstructor();

  try {
    const sourceBuffer = await source.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const offlineContext = new OfflineAudioContextConstructor(
      1,
      Math.ceil(decoded.duration * targetSampleRate),
      targetSampleRate
    );
    const sourceNode = offlineContext.createBufferSource();
    sourceNode.buffer = decoded;
    sourceNode.connect(offlineContext.destination);
    sourceNode.start(0);
    const rendered = await offlineContext.startRendering();
    const monoSamples = interleaveMonoChannel(rendered);

    return encodeWav(monoSamples, targetSampleRate);
  } finally {
    await audioContext.close();
  }
}
