"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { getPreferredRecordingMimeType, transcodeRecordedBlobToWav } from "@/lib/speech/audio";
import { assessPronunciation, fetchSpeechProxyStatus } from "@/lib/speech/client";
import type {
  PronunciationAssessmentResponse,
  SpeechProxyStatus
} from "@/lib/speech/types";

function nowLabel(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour12: false
  });
}

const defaultReference = "すみません、搭乗ゲートはどこですか？";

export function SpeechLabClient() {
  const [logs, setLogs] = useState<string[]>([
    "Tap a button to test the iOS speech path. Microphone access must always be triggered by user gesture."
  ]);
  const [referenceText, setReferenceText] = useState(defaultReference);
  const [proxyStatus, setProxyStatus] = useState<SpeechProxyStatus | null>(null);
  const [recordStatus, setRecordStatus] = useState<"idle" | "recording" | "ready">("idle");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [result, setResult] = useState<PronunciationAssessmentResponse | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const supportInfo = useMemo(
    () => ({
      mediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
      mediaRecorder: typeof window !== "undefined" && "MediaRecorder" in window,
      speechSynthesis: typeof window !== "undefined" && "speechSynthesis" in window
    }),
    []
  );
  const logOutput = useMemo(() => logs.join("\n"), [logs]);

  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchSpeechProxyStatus();
        setProxyStatus(status);
        appendLog(
          status.configured
            ? `Azure proxy is ready in ${status.region}.`
            : "Azure proxy is not configured yet. Manual fallback remains available."
        );
      } catch (statusError) {
        appendLog(
          `Proxy status check failed: ${statusError instanceof Error ? statusError.message : "unknown error"}`
        );
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  function appendLog(message: string) {
    setLogs((current) => [`[${nowLabel()}] ${message}`, ...current].slice(0, 24));
  }

  async function refreshProxyStatus() {
    try {
      const status = await fetchSpeechProxyStatus();
      setProxyStatus(status);
      appendLog(
        status.configured
          ? `Azure proxy is ready in ${status.region}.`
          : "Azure proxy is not configured yet. Manual fallback remains available."
      );
    } catch (statusError) {
      appendLog(
        `Proxy status check failed: ${statusError instanceof Error ? statusError.message : "unknown error"}`
      );
    }
  }

  async function testMicrophone() {
    appendLog("Requesting microphone permission.");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      appendLog("Microphone permission granted.");
      stream.getTracks().forEach((track) => track.stop());
    } catch (microphoneError) {
      const message =
        microphoneError instanceof Error ? microphoneError.message : "unknown error";
      setError(message);
      appendLog(`Microphone request failed: ${message}`);
    }
  }

  function testSpeechSynthesis() {
    if (!("speechSynthesis" in window)) {
      appendLog("speechSynthesis is not available in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(defaultReference);
    utterance.lang = "ja-JP";
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    appendLog("Played Japanese TTS sample.");
  }

  async function startRecording() {
    setError(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordingUrl) {
          URL.revokeObjectURL(recordingUrl);
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordStatus("ready");
        appendLog(`Captured ${(blob.size / 1024).toFixed(1)} KB of speech audio.`);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordStatus("recording");
      appendLog(`Recording started (${(mimeType ?? recorder.mimeType) || "default mime"}).`);
    } catch (recordError) {
      const message = recordError instanceof Error ? recordError.message : "recording failed";
      setError(message);
      appendLog(`Recording failed: ${message}`);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecordStatus("idle");
    appendLog("Recording stopped.");
  }

  function playBackRecording() {
    if (!recordingUrl) {
      appendLog("No recording is available yet.");
      return;
    }

    const audio = new Audio(recordingUrl);
    void audio.play();
    appendLog("Playing recorded audio.");
  }

  async function scoreRecording() {
    if (!recordingBlob) {
      appendLog("Record a sample before calling Azure scoring.");
      return;
    }

    setIsScoring(true);
    setError(null);

    try {
      appendLog("Transcoding recording to 16 kHz mono WAV.");
      const wav = await transcodeRecordedBlobToWav(recordingBlob);
      appendLog("Submitting audio to the Edge proxy.");
      const assessment = await assessPronunciation({
        audio: wav,
        referenceText
      });
      setResult(assessment);
      appendLog(
        `Azure score received. Pronunciation ${assessment.scores.pronunciation ?? assessment.scores.accuracy ?? 0}.`
      );
    } catch (scoreError) {
      const message = scoreError instanceof Error ? scoreError.message : "scoring failed";
      setError(message);
      appendLog(`Azure scoring failed: ${message}`);
    } finally {
      setIsScoring(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <div className="stat-box">
          <span className="stat-label">getUserMedia</span>
          <strong className="stat-value">{supportInfo.mediaDevices ? "YES" : "NO"}</strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">MediaRecorder</span>
          <strong className="stat-value">{supportInfo.mediaRecorder ? "YES" : "NO"}</strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">Azure Proxy</span>
          <strong className="stat-value">
            {proxyStatus?.configured ? "READY" : proxyStatus ? "MANUAL" : "CHECKING"}
          </strong>
        </div>
      </div>

      <div className="field-stack">
        <label className="section-title" htmlFor="speech-lab-reference">
          Reference Text
        </label>
        <textarea
          id="speech-lab-reference"
          aria-label="Reference text"
          className="pixel-textarea"
          value={referenceText}
          onChange={(event) => setReferenceText(event.currentTarget.value)}
        />
      </div>

      <div className="split-actions">
        <PixelButton onClick={() => void testMicrophone()}>TEST MIC PATH</PixelButton>
        <PixelButton variant="secondary" onClick={testSpeechSynthesis}>
          PLAY TTS
        </PixelButton>
        <PixelButton variant="ghost" onClick={() => void refreshProxyStatus()}>
          CHECK PROXY
        </PixelButton>
      </div>

      <div className="split-actions">
        {recordStatus !== "recording" ? (
          <PixelButton onClick={() => void startRecording()}>START RECORD</PixelButton>
        ) : (
          <PixelButton onClick={stopRecording}>STOP RECORD</PixelButton>
        )}
        <PixelButton variant="secondary" onClick={playBackRecording}>
          PLAY BACK
        </PixelButton>
        <PixelButton
          onClick={() => void scoreRecording()}
          aria-disabled={!recordingBlob || isScoring}
        >
          {isScoring ? "SCORING..." : "SCORE WITH AZURE"}
        </PixelButton>
      </div>

      {result ? (
        <div className="page-stack" style={{ gap: 12 }}>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">Pronunciation</span>
              <strong className="stat-value">{result.scores.pronunciation ?? "--"}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Accuracy</span>
              <strong className="stat-value">{result.scores.accuracy ?? "--"}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Fluency</span>
              <strong className="stat-value">{result.scores.fluency ?? "--"}</strong>
            </div>
          </div>

          <div className="summary-box">
            <div className="meta-row">
              <span className="badge">{result.recognitionStatus}</span>
              <span className="badge">{result.locale}</span>
            </div>
            <p className="muted" style={{ marginBottom: 8 }}>
              Recognized: {result.recognizedText || "No text returned"}
            </p>
            <div className="diff-row">
              {result.words.map((word, index) => (
                <span
                  key={`${word.word}-${index}`}
                  className={`diff-token ${word.errorType && word.errorType !== "None" ? "wrong" : "correct"}`.trim()}
                >
                  {word.word || "∅"}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="badge danger">{error}</div> : null}

      <div className="log-box">
        <pre>{logOutput}</pre>
      </div>
    </div>
  );
}
