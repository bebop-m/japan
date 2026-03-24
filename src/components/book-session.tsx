"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { RubyText } from "@/components/ruby-text";
import {
  buildBookDailyCheckQuestions,
  getSceneBookBatch,
  markBookBatchProgress,
  type PhraseBookEntry,
  type SceneBookEntry
} from "@/lib/books";
import { useJapaneseInput } from "@/lib/ime/use-japanese-input";
import { buildDiffTokens, isStrictMatch } from "@/lib/learn/answers";
import { getPreferredRecordingMimeType, transcodeRecordedBlobToWav } from "@/lib/speech/audio";
import { assessPronunciation, fetchSpeechProxyStatus } from "@/lib/speech/client";
import type {
  PronunciationAssessmentResponse,
  SpeechProxyStatus
} from "@/lib/speech/types";
import { cloneStorageState } from "@/lib/storage/clone";
import { toggleFavoriteReviewItem } from "@/lib/storage/favorites";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { SceneDefinition } from "@/lib/types/content";
import type { AppStorageState, BookStudyType } from "@/lib/types/storage";

type SessionPhase = "study" | "daily-check" | "complete";

interface BookSessionProps {
  scene: SceneDefinition;
  bookType: BookStudyType;
  count: number;
}

interface StepFeedback {
  tone: "neutral" | "success" | "danger";
  message: string;
}

interface SpeechAttemptInput {
  passed: boolean;
  mode: "azure" | "manual";
  score: number | null;
}

const SPEECH_PASS_SCORE = 75;
const dailyQuestionTypeLabelMap = {
  "listen-choice": "听音选义",
  "translate-input": "中译日输入",
  "reply-input": "对话补全"
} as const;
const bookTypeLabelMap: Record<BookStudyType, string> = {
  sentence: "句",
  word: "词",
  mixed: "混合"
};

function playJapaneseSequence(lines: string[]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  const queue = [...lines];
  window.speechSynthesis.cancel();

  const speakNext = () => {
    const nextLine = queue.shift();

    if (!nextLine) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(nextLine);
    utterance.lang = "ja-JP";
    utterance.rate = 0.95;
    utterance.onend = speakNext;
    window.speechSynthesis.speak(utterance);
  };

  speakNext();
  return true;
}

function getHint(kana: string, mode: AppStorageState["userSettings"]["kanaHintStyle"]): string | null {
  if (mode === "hidden") {
    return null;
  }

  if (mode === "full") {
    return kana;
  }

  const firstToken = kana.split(/[、。？！\s]/).find(Boolean);
  return firstToken ?? null;
}

function isPhraseEntry(entry: SceneBookEntry): entry is PhraseBookEntry {
  return entry.kind === "phrase";
}

function getSessionPhase(storage: AppStorageState, entries: SceneBookEntry[]): SessionPhase {
  const allVerified = entries.every((entry) =>
    Boolean(storage.reviewItems[entry.id]?.stepState.verifyCompletedAt)
  );
  const allChecked = entries.every((entry) => storage.reviewItems[entry.id]?.dailyCheckScore !== null);

  if (!allVerified) {
    return "study";
  }

  if (!allChecked) {
    return "daily-check";
  }

  return "complete";
}

function getEntryAudioLines(entry: SceneBookEntry): string[] {
  return isPhraseEntry(entry)
    ? [entry.learnerTurn.ja, entry.partnerTurn.ja]
    : [entry.answerJa];
}

export function BookSession({ scene, bookType, count }: BookSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [batchEntries] = useState<SceneBookEntry[]>(() =>
    getSceneBookBatch(scene, readStorageState(), bookType, count)
  );
  const [feedback, setFeedback] = useState<StepFeedback>({
    tone: "neutral",
    message: "按顺序完成听、说、读、写、验证，然后进入每日检验。"
  });
  const [diffPreview, setDiffPreview] = useState<string[]>([]);
  const [dailyQuestions, setDailyQuestions] = useState(() => buildBookDailyCheckQuestions(batchEntries));
  const [dailyIndex, setDailyIndex] = useState(0);
  const [dailyResults, setDailyResults] = useState<boolean[]>([]);
  const [recordStatus, setRecordStatus] = useState<"idle" | "recording" | "ready">("idle");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [speechProxyStatus, setSpeechProxyStatus] = useState<SpeechProxyStatus | null>(null);
  const [speechResult, setSpeechResult] = useState<PronunciationAssessmentResponse | null>(null);
  const [isScoringSpeech, setIsScoringSpeech] = useState(false);
  const input = useJapaneseInput();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const initializedRef = useRef(false);

  const phase = useMemo(() => getSessionPhase(storage, batchEntries), [batchEntries, storage]);
  const completedEntriesCount = batchEntries.filter((entry) =>
    Boolean(storage.reviewItems[entry.id]?.stepState.verifyCompletedAt)
  ).length;
  const currentEntryIndex = Math.max(
    batchEntries.findIndex((entry) => !storage.reviewItems[entry.id]?.stepState.verifyCompletedAt),
    0
  );
  const currentEntry = batchEntries[currentEntryIndex];
  const currentItem = currentEntry ? storage.reviewItems[currentEntry.id] : null;
  const activeStep =
    currentItem?.stepState.currentStep === 0 ? 1 : currentItem?.stepState.currentStep ?? 1;
  const latestDailyScore =
    batchEntries.length > 0 ? storage.reviewItems[batchEntries[0].id]?.dailyCheckScore ?? null : null;
  const dailyPassed = latestDailyScore !== null ? latestDailyScore >= 80 : false;
  const currentFavorited = Boolean(currentItem?.isFavorited && currentEntry && isPhraseEntry(currentEntry));
  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;
  const speechProxyReady = speechProxyStatus?.configured ?? false;
  const writeHint = currentEntry ? getHint(currentEntry.kana, storage.userSettings.kanaHintStyle) : null;
  const studyRoute = `/scene/${scene.id}/study?type=${bookType}&count=${count}`;

  const updateStorage = useCallback((mutator: (draft: AppStorageState) => void) => {
    setStorage((current) => {
      const draft = cloneStorageState(current);
      mutator(draft);
      return draft;
    });
  }, []);

  function updateSpeechLabSnapshot(
    mutator: (draft: AppStorageState["speechLab"]) => void
  ) {
    updateStorage((draft) => {
      mutator(draft.speechLab);
    });
  }

  const startBatch = useCallback(() => {
    if (batchEntries.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    updateStorage((draft) => {
      draft.session.activeSceneId = scene.id;
      draft.session.activeLessonId = batchEntries[0].lessonId;
      draft.session.lastRoute = studyRoute;

      for (const [index, entry] of batchEntries.entries()) {
        const item = draft.reviewItems[entry.id];
        item.isUnlocked = true;

        if (index === 0) {
          item.introducedAt = item.introducedAt ?? now;
          item.lastStudiedAt = now;
          item.stepState.currentStep = Math.max(item.stepState.currentStep, 1) as 1 | 2 | 3 | 4 | 5;
        }
      }
    });
  }, [batchEntries, scene.id, studyRoute, updateStorage]);

  useEffect(() => {
    writeStorageState(storage);
  }, [storage]);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  useEffect(() => {
    if (initializedRef.current || batchEntries.length === 0) {
      return;
    }

    initializedRef.current = true;
    startBatch();
  }, [batchEntries.length, startBatch]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchSpeechProxyStatus();
        setSpeechProxyStatus(status);
      } catch (error) {
        setSpeechProxyStatus({
          ok: false,
          runtime: "edge",
          configured: false,
          region: null,
          message: error instanceof Error ? error.message : "Speech proxy status unavailable."
        });
      }
    })();
  }, []);

  function toggleCurrentFavorite() {
    if (!currentEntry || !isPhraseEntry(currentEntry)) {
      return;
    }

    updateStorage((draft) => {
      toggleFavoriteReviewItem(draft, currentEntry.id);
    });
  }

  function applySpeechAttempt({ passed, mode, score }: SpeechAttemptInput) {
    if (!currentEntry) {
      return;
    }

    const now = new Date().toISOString();

    updateStorage((draft) => {
      const item = draft.reviewItems[currentEntry.id];
      draft.session.activeSceneId = scene.id;
      draft.session.activeLessonId = currentEntry.lessonId;
      draft.session.lastRoute = studyRoute;
      draft.userSettings.speechScoringMode = mode;

      item.isUnlocked = true;
      item.introducedAt = item.introducedAt ?? now;
      item.lastStudiedAt = now;
      item.lastReviewMode = "learn";
      item.lastResult = passed ? "good" : "again";
      item.lastAudioScore = score;
      item.stepState.speakAttempts += 1;

      if (passed) {
        item.stepState.currentStep = 3;
        item.stepState.speakCompletedAt = now;

        if (mode === "manual") {
          item.stepState.manualSpeechPasses += 1;
        }

        return;
      }

      item.mistakeCount += 1;
    });
  }

  async function startRecording() {
    if (!canRecord) {
      setRecordingError("当前环境不支持录音，先用手动确认继续。");
      return;
    }

    setRecordingError(null);
    setSpeechResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;

      updateSpeechLabSnapshot((snapshot) => {
        snapshot.supported = true;
        snapshot.mediaRecorderSupported = canRecord;
        snapshot.permissionState = "granted";
        snapshot.requiresGesture = true;
        snapshot.lastCheckedAt = new Date().toISOString();
        snapshot.lastError = null;
      });

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
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordStatus("recording");
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "录音失败");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function playBackRecording() {
    if (!recordingUrl) {
      return;
    }

    const audio = new Audio(recordingUrl);
    void audio.play();
  }

  async function scoreSpeechWithAzure() {
    if (!recordingBlob || !currentEntry) {
      setRecordingError("请先录音再请求评分。");
      return;
    }

    setIsScoringSpeech(true);
    setRecordingError(null);

    try {
      const wav = await transcodeRecordedBlobToWav(recordingBlob);
      const assessment = await assessPronunciation({
        audio: wav,
        referenceText: currentEntry.answerJa
      });
      const score = assessment.scores.pronunciation ?? assessment.scores.accuracy ?? 0;
      const passed =
        assessment.recognitionStatus === "Success" && score >= SPEECH_PASS_SCORE;

      setSpeechResult(assessment);
      applySpeechAttempt({
        passed,
        mode: "azure",
        score
      });
      setFeedback({
        tone: passed ? "success" : "danger",
        message: passed
          ? `发音评分 ${Math.round(score)} 通过。`
          : `评分 ${Math.round(score)} 未达标，可重录或手动通过。`
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? "发音评分暂不可用。"
          : "发音评分暂不可用。";
      setRecordingError(message);
      updateSpeechLabSnapshot((snapshot) => {
        snapshot.lastCheckedAt = new Date().toISOString();
        snapshot.lastError = message;
      });
      updateStorage((draft) => {
        draft.userSettings.speechScoringMode = "manual";
      });
      setFeedback({
        tone: "danger",
        message: "评分失败，可用手动确认继续。"
      });
    } finally {
      setIsScoringSpeech(false);
    }
  }

  function passSpeechManually() {
    applySpeechAttempt({
      passed: true,
      mode: "manual",
      score: null
    });
    setRecordStatus("idle");
    setFeedback({
      tone: "success",
      message: "手动确认通过。"
    });
  }

  function applyStepTransition(step: 1 | 2 | 3 | 4 | 5, isPassed: boolean) {
    if (!currentEntry || !currentItem) {
      return;
    }

    const now = new Date().toISOString();

    updateStorage((draft) => {
      const item = draft.reviewItems[currentEntry.id];
      draft.session.activeSceneId = scene.id;
      draft.session.activeLessonId = currentEntry.lessonId;
      draft.session.lastRoute = studyRoute;
      item.isUnlocked = true;
      item.introducedAt = item.introducedAt ?? now;
      item.lastStudiedAt = now;

      if (step === 1 && isPassed) {
        item.stepState.currentStep = 2;
        item.stepState.listenCompletedAt = now;
      }

      if (step === 2 && isPassed) {
        item.stepState.currentStep = 3;
        item.stepState.speakCompletedAt = now;
        item.stepState.speakAttempts += 1;
        item.stepState.manualSpeechPasses += 1;
      }

      if (step === 3 && isPassed) {
        item.stepState.currentStep = 4;
        item.stepState.readCompletedAt = now;
      }

      if (step === 4) {
        item.stepState.writeAttempts += 1;
        item.lastInput = input.committedValue;

        if (isPassed) {
          item.stepState.currentStep = 5;
          item.stepState.writeCompletedAt = now;
          item.correctCount += 1;
        } else {
          item.mistakeCount += 1;
          item.lastResult = "again";
        }
      }

      if (step === 5) {
        item.stepState.verifyAttempts += 1;
        item.lastInput = input.committedValue;

        if (isPassed) {
          item.stepState.currentStep = 5;
          item.stepState.verifyCompletedAt = now;
          item.completedAt = now;
          item.status = "studied";
          item.dailyCheckEligibleAt = now;
          item.lastResult = "good";
          item.lastReviewMode = "learn";
          item.correctCount += 1;

          const nextEntry = batchEntries.find(
            (entry) =>
              entry.id !== currentEntry.id &&
              !Boolean(draft.reviewItems[entry.id].stepState.verifyCompletedAt)
          );

          if (nextEntry) {
            const nextItem = draft.reviewItems[nextEntry.id];
            nextItem.isUnlocked = true;
            nextItem.introducedAt = nextItem.introducedAt ?? now;
            nextItem.stepState.currentStep =
              (nextItem.stepState.currentStep === 0 ? 1 : nextItem.stepState.currentStep) as
                | 1
                | 2
                | 3
                | 4
                | 5;
          }
        } else {
          item.mistakeCount += 1;
          item.lastResult = "again";
          item.stepState.currentStep = 4;
        }
      }
    });
  }

  function submitWrite(step: 4 | 5) {
    if (!currentEntry) {
      return;
    }

    const passed = isStrictMatch(input.committedValue, currentEntry.answerJa);

    setDiffPreview(
      buildDiffTokens(input.committedValue, currentEntry.answerJa).map(
        (token) => `${token.status}:${token.char}`
      )
    );
    applyStepTransition(step, passed);

    if (passed) {
      input.reset();
      setFeedback({
        tone: "success",
        message:
          step === 4
            ? "写这一关已过，进入验证。"
            : currentEntryIndex === batchEntries.length - 1
              ? "本轮五步已完成，进入每日检验。"
              : "这一条已通过，切到下一条。"
      });
      return;
    }

    setFeedback({
      tone: "danger",
      message: step === 4 ? "还没对上，继续重写。" : "验证失败，回到第四步。"
    });
  }

  function finishDailyCheck(results: boolean[]) {
    const score = Math.round((results.filter(Boolean).length / Math.max(results.length, 1)) * 100);
    const passed = score >= 80;
    const now = new Date().toISOString();
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);

    updateStorage((draft) => {
      for (const entry of batchEntries) {
        const item = draft.reviewItems[entry.id];
        item.dailyCheckScore = score;
        item.lastReviewedAt = now;
        item.lastReviewMode = "daily-check";

        if (passed) {
          item.status = "mastered";
          item.dailyCheckPassedAt = now;
          item.nextReviewAt = nextReview.toISOString();
          item.intervalDays = 1;
          item.streak = Math.max(item.streak, 1);
          item.lastResult = "good";
        } else {
          item.status = "studied";
          item.dailyCheckPassedAt = null;
          item.nextReviewAt = null;
          item.lastResult = score === 0 ? "again" : "hard";
        }
      }

      const progressed = markBookBatchProgress(draft, scene.id, bookType, batchEntries.length);
      draft.bookProgressByScene = progressed.bookProgressByScene;
      draft.session.activeSceneId = scene.id;
      draft.session.activeLessonId = null;
      draft.session.lastRoute = `/scene/${scene.id}`;
    });

    setFeedback({
      tone: passed ? "success" : "danger",
      message: passed
        ? `每日检验 ${score}% 通过。`
        : `每日检验 ${score}% 未通过。`
    });
  }

  function submitDailyQuestion(selectedOption?: string) {
    const question = dailyQuestions[dailyIndex];

    if (!question) {
      return;
    }

    let passed = false;

    if (question.type === "listen-choice") {
      passed = selectedOption === question.answer;
    } else {
      passed = isStrictMatch(input.committedValue, question.answer);
    }

    const nextResults = [...dailyResults, passed];
    setDailyResults(nextResults);
    input.reset();
    setDiffPreview([]);

    if (dailyIndex === dailyQuestions.length - 1) {
      finishDailyCheck(nextResults);
      return;
    }

    setDailyIndex((current) => current + 1);
    setFeedback({
      tone: passed ? "success" : "danger",
      message: passed ? "这一题通过。" : "这一题没过。"
    });
  }

  function restartDailyCheck() {
    setDailyQuestions(buildBookDailyCheckQuestions(batchEntries));
    setDailyIndex(0);
    setDailyResults([]);
    input.reset();
    setDiffPreview([]);

    updateStorage((draft) => {
      for (const entry of batchEntries) {
        draft.reviewItems[entry.id].dailyCheckScore = null;
      }
      draft.bookProgressByScene = markBookBatchProgress(
        draft,
        scene.id,
        bookType,
        batchEntries.length
      ).bookProgressByScene;
    });

    setFeedback({
      tone: "neutral",
      message: "每日检验已重开。"
    });
  }

  const currentQuestion = dailyQuestions[dailyIndex];

  if (batchEntries.length === 0) {
    return (
      <PixelCard className="machine-card">
        <div className="page-stack">
          <div className="summary-box">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              这一页已经刷完
            </h2>
          </div>
          <div className="split-actions">
            <PixelButton href={`/scene/${scene.id}`}>返回句本</PixelButton>
            <PixelButton href="/" variant="secondary">
              返回首页
            </PixelButton>
          </div>
        </div>
      </PixelCard>
    );
  }

  return (
    <PixelCard className="machine-card">
      <div className="page-stack" style={{ gap: 16 }}>
        <div className="hero" style={{ gap: 8 }}>
          <div className="meta-row" style={{ justifyContent: "space-between" }}>
            <span className="display" style={{ fontSize: "0.9rem" }}>
              {scene.label} / {bookTypeLabelMap[bookType]}
            </span>
            <span
              className={`badge ${feedback.tone === "success" ? "success" : feedback.tone === "danger" ? "danger" : ""}`.trim()}
            >
              {phase === "complete" ? "完成" : `${completedEntriesCount} / ${batchEntries.length}`}
            </span>
          </div>
          <span className="badge">{feedback.message}</span>
        </div>

        {phase === "study" && currentEntry ? (
          <div className="page-stack" style={{ gap: 14 }}>
            <div className="step-strip">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`step-pill ${activeStep === step ? "active" : ""} ${activeStep > step || (step === 5 && currentItem?.stepState.verifyCompletedAt) ? "done" : ""}`.trim()}
                >
                  第{step}步
                </div>
              ))}
            </div>

            <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="meta-row">
                <span className="badge">
                  {currentEntryIndex + 1} / {batchEntries.length}
                </span>
                <span className="badge">{isPhraseEntry(currentEntry) ? "句" : "词"}</span>
              </div>
              {isPhraseEntry(currentEntry) ? (
                <PixelButton
                  type="button"
                  variant={currentFavorited ? "secondary" : "ghost"}
                  onClick={toggleCurrentFavorite}
                  aria-pressed={currentFavorited}
                >
                  {currentFavorited ? "★ 已收藏" : "☆ 加入出发"}
                </PixelButton>
              ) : null}
            </div>

            {activeStep === 1 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                {isPhraseEntry(currentEntry) ? (
                  <div className="turn-list">
                    <div className="turn">
                      <div className="turn-role">你说 / 中文</div>
                      <div className="turn-zh">{currentEntry.learnerTurn.zh}</div>
                    </div>
                    <div className="turn">
                      <div className="turn-role">对方 / 中文</div>
                      <div className="turn-zh">{currentEntry.partnerTurn.zh}</div>
                    </div>
                  </div>
                ) : (
                  <div className="turn">
                    <div className="turn-role">中文</div>
                    <div className="turn-zh">{currentEntry.promptZh}</div>
                  </div>
                )}
                <div className="split-actions">
                  <PixelButton
                    onClick={() => {
                      const played = playJapaneseSequence(getEntryAudioLines(currentEntry));
                      setFeedback({
                        tone: played ? "neutral" : "danger",
                        message: played ? "示例已播放。" : "当前设备不支持语音播放。"
                      });
                    }}
                  >
                    播放
                  </PixelButton>
                  <PixelButton variant="secondary" onClick={() => applyStepTransition(1, true)}>
                    下一步
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">跟读</div>
                  <div className="turn-kana">{currentEntry.kana}</div>
                </div>
                <div className="meta-row">
                  <span className={`badge ${speechProxyReady ? "success" : ""}`.trim()}>
                    {speechProxyReady ? "发音评分就绪" : "手动确认模式"}
                  </span>
                </div>
                <div className="split-actions">
                  {recordStatus !== "recording" ? (
                    <PixelButton onClick={() => void startRecording()}>
                      {canRecord ? "开始录音" : "仅手动确认"}
                    </PixelButton>
                  ) : (
                    <PixelButton onClick={stopRecording}>停止录音</PixelButton>
                  )}
                  <PixelButton variant="ghost" onClick={playBackRecording}>
                    回放
                  </PixelButton>
                  <PixelButton
                    variant="secondary"
                    onClick={() => void scoreSpeechWithAzure()}
                    aria-disabled={!recordingBlob || isScoringSpeech || !speechProxyReady}
                  >
                    {isScoringSpeech ? "评分中..." : "Azure 评分"}
                  </PixelButton>
                  <PixelButton variant="secondary" onClick={passSpeechManually}>
                    手动通过
                  </PixelButton>
                </div>
                {speechResult ? (
                  <div className="stat-grid">
                    <div className="stat-box">
                      <span className="stat-label">发音</span>
                      <strong className="stat-value">
                        {speechResult.scores.pronunciation ?? speechResult.scores.accuracy ?? "--"}
                      </strong>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">准确</span>
                      <strong className="stat-value">
                        {speechResult.scores.accuracy ?? "--"}
                      </strong>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">流利</span>
                      <strong className="stat-value">
                        {speechResult.scores.fluency ?? "--"}
                      </strong>
                    </div>
                  </div>
                ) : null}
                {recordingError ? <div className="badge danger">{recordingError}</div> : null}
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                {isPhraseEntry(currentEntry) ? (
                  <div className="turn-list">
                    <div className="turn">
                      <div className="turn-role">你说</div>
                      <div className="turn-ja">
                        <RubyText tokens={currentEntry.learnerTurn.ruby} />
                      </div>
                      <div className="turn-kana">{currentEntry.learnerTurn.kana}</div>
                      <div className="turn-zh">{currentEntry.learnerTurn.zh}</div>
                    </div>
                    <div className="turn">
                      <div className="turn-role">对方说</div>
                      <div className="turn-ja">
                        <RubyText tokens={currentEntry.partnerTurn.ruby} />
                      </div>
                      <div className="turn-kana">{currentEntry.partnerTurn.kana}</div>
                      <div className="turn-zh">{currentEntry.partnerTurn.zh}</div>
                    </div>
                  </div>
                ) : (
                  <div className="turn">
                    <div className="turn-role">词条</div>
                    <div className="turn-ja">
                      <RubyText tokens={currentEntry.ruby} />
                    </div>
                    <div className="turn-kana">{currentEntry.kana}</div>
                    <div className="turn-zh">{currentEntry.promptZh}</div>
                  </div>
                )}
                <div className="split-actions">
                  <PixelButton variant="secondary" onClick={() => applyStepTransition(3, true)}>
                    下一步
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {(activeStep === 4 || activeStep === 5) ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">{activeStep === 4 ? "写" : "验证"}</div>
                  <div className="turn-zh">{currentEntry.promptZh}</div>
                  {activeStep === 4 && writeHint ? (
                    <div className="turn-kana">提示: {writeHint}</div>
                  ) : null}
                </div>
                <textarea
                  aria-label={activeStep === 4 ? "书写输入框" : "验证输入框"}
                  className="pixel-textarea"
                  placeholder="在此输入日文"
                  {...input.bind}
                />
                {diffPreview.length > 0 ? (
                  <div className="diff-row">
                    {diffPreview.map((token, index) => {
                      const [status, char] = token.split(":");
                      return (
                        <span key={`${token}-${index}`} className={`diff-token ${status}`.trim()}>
                          {char || "_"}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                <div className="split-actions">
                  <PixelButton onClick={() => submitWrite(activeStep as 4 | 5)}>
                    {activeStep === 4 ? "检查" : "验证"}
                  </PixelButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "daily-check" && currentQuestion ? (
          <div className="page-stack" style={{ gap: 14 }}>
            <div className="meta-row">
              <span className="badge">
                题目 {dailyIndex + 1} / {dailyQuestions.length}
              </span>
              <span className="badge">{dailyQuestionTypeLabelMap[currentQuestion.type]}</span>
            </div>

            {currentQuestion.type === "listen-choice" ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">听音选义</div>
                  <div className="turn-zh">{currentQuestion.prompt}</div>
                </div>
                <div className="split-actions">
                  <PixelButton onClick={() => playJapaneseSequence([currentQuestion.audioText])}>
                    播放
                  </PixelButton>
                </div>
                <div className="choice-grid">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="choice-button"
                      onClick={() => submitDailyQuestion(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {currentQuestion.type === "translate-input" ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">中译日</div>
                  <div className="turn-zh">{currentQuestion.prompt}</div>
                  {currentQuestion.hint ? (
                    <div className="turn-kana">{currentQuestion.hint}</div>
                  ) : null}
                </div>
                <textarea
                  aria-label="每日检验输入框"
                  className="pixel-textarea"
                  placeholder="在此输入日文"
                  {...input.bind}
                />
                <div className="split-actions">
                  <PixelButton onClick={() => submitDailyQuestion()}>提交</PixelButton>
                </div>
              </div>
            ) : null}

            {currentQuestion.type === "reply-input" ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">对话补全</div>
                  <div className="turn-ja">{currentQuestion.prompt}</div>
                  <div className="turn-kana">{currentQuestion.promptKana}</div>
                  <div className="turn-zh">{currentQuestion.promptZh}</div>
                </div>
                <textarea
                  aria-label="每日检验对话输入框"
                  className="pixel-textarea"
                  placeholder="在此输入日文"
                  {...input.bind}
                />
                <div className="split-actions">
                  <PixelButton onClick={() => submitDailyQuestion()}>提交</PixelButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "complete" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="stat-label">本轮</span>
                <strong className="stat-value">{batchEntries.length}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">检验</span>
                <strong className="stat-value">
                  {latestDailyScore === null ? "--" : `${latestDailyScore}%`}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">状态</span>
                <strong className="stat-value" style={{ fontSize: "1rem" }}>
                  {dailyPassed ? "已入复习" : "待复习"}
                </strong>
              </div>
            </div>
            <div className="split-actions">
              {dailyPassed ? (
                <>
                  <PixelButton href={`/scene/${scene.id}`}>返回句本</PixelButton>
                  <PixelButton href="/review" variant="secondary">
                    立即复习
                  </PixelButton>
                </>
              ) : (
                <>
                  <PixelButton onClick={restartDailyCheck}>重做每日检验</PixelButton>
                  <PixelButton href={`/scene/${scene.id}`} variant="secondary">
                    返回句本
                  </PixelButton>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </PixelCard>
  );
}
