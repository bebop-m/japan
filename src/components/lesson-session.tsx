"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
import { RubyText } from "@/components/ruby-text";
import { useJapaneseInput } from "@/lib/ime/use-japanese-input";
import { buildDiffTokens, isStrictMatch } from "@/lib/learn/answers";
import { buildDailyCheckQuestions, type DailyCheckQuestion } from "@/lib/learn/daily-check";
import { getPreferredRecordingMimeType, transcodeRecordedBlobToWav } from "@/lib/speech/audio";
import { assessPronunciation, fetchSpeechProxyStatus } from "@/lib/speech/client";
import type {
  PronunciationAssessmentResponse,
  SpeechProxyStatus
} from "@/lib/speech/types";
import { normalizeLessonUnlocks } from "@/lib/storage/catalog";
import { cloneStorageState } from "@/lib/storage/clone";
import { toggleFavoriteReviewItem } from "@/lib/storage/favorites";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { LessonDefinition, SceneId } from "@/lib/types/content";
import type { AppStorageState, ReviewItem } from "@/lib/types/storage";

type SessionPhase = "preview" | "study" | "daily-check" | "complete";

interface LessonSessionProps {
  sceneId: SceneId;
  lesson: LessonDefinition;
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

function getReviewItemsForLesson(storage: AppStorageState, lesson: LessonDefinition): ReviewItem[] {
  return lesson.cards.map((card) => storage.reviewItems[card.id]);
}

function getLessonPhase(storage: AppStorageState, lesson: LessonDefinition): SessionPhase {
  const items = getReviewItemsForLesson(storage, lesson);
  const lessonProgress = storage.lessonProgress[lesson.id];
  const started =
    lessonProgress?.status === "in_progress" ||
    lessonProgress?.status === "completed" ||
    items.some(
      (item) => item.stepState.currentStep > 0 || item.completedAt || item.lastStudiedAt
    );
  const allVerified = items.every((item) => item.stepState.verifyCompletedAt);
  const allChecked = allVerified && items.every((item) => item.dailyCheckScore !== null);

  if (!started) {
    return "preview";
  }

  if (!allVerified) {
    return "study";
  }

  if (!allChecked) {
    return "daily-check";
  }

  return "complete";
}

export function LessonSession({ sceneId, lesson }: LessonSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [feedback, setFeedback] = useState<StepFeedback>({
    tone: "neutral",
    message: "先点 START LESSON，之后流程会严格按五步推进。"
  });
  const [diffPreview, setDiffPreview] = useState<string[]>([]);
  const [dailyQuestions, setDailyQuestions] = useState<DailyCheckQuestion[]>([]);
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

  const phase = useMemo(() => getLessonPhase(storage, lesson), [lesson, storage]);
  const lessonItems = useMemo(
    () => getReviewItemsForLesson(storage, lesson),
    [lesson, storage]
  );
  const lessonProgress = storage.lessonProgress[lesson.id];
  const completedCards = lessonItems.filter((item) => item.stepState.verifyCompletedAt).length;
  const currentCardIndex = Math.max(
    lessonItems.findIndex((item) => !item.stepState.verifyCompletedAt),
    0
  );
  const currentCard = lesson.cards[currentCardIndex];
  const currentItem = lessonItems[currentCardIndex];
  const activeStep = currentItem?.stepState.currentStep === 0 ? 1 : currentItem?.stepState.currentStep ?? 1;
  const latestDailyScore = lessonItems[0]?.dailyCheckScore;
  const dailyPassed = latestDailyScore !== null ? latestDailyScore >= 80 : false;
  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;
  const speechProxyReady = speechProxyStatus?.configured ?? false;

  useEffect(() => {
    writeStorageState(storage);
  }, [storage]);

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
          message:
            error instanceof Error ? error.message : "Speech proxy status unavailable."
        });
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

  useEffect(() => {
    if (phase === "daily-check" && dailyQuestions.length === 0) {
      setDailyQuestions(buildDailyCheckQuestions(lesson));
      setDailyIndex(0);
      setDailyResults([]);
      setFeedback({
        tone: "neutral",
        message: "Daily Check 已开始，题型会混合听音、翻译输入和对话补全。"
      });
      input.reset();
      setDiffPreview([]);
    }
  }, [dailyQuestions.length, input, lesson, phase]);

  useEffect(() => {
    if (phase === "preview") {
      setFeedback({
        tone: "neutral",
        message: "Start the lesson to enter the five-step loop."
      });
    }
  }, [phase]);

  function updateStorage(mutator: (draft: AppStorageState) => void) {
    setStorage((current) => {
      const draft = cloneStorageState(current);
      mutator(draft);
      return draft;
    });
  }

  function updateSpeechLabSnapshot(
    mutator: (draft: AppStorageState["speechLab"]) => void
  ) {
    updateStorage((draft) => {
      mutator(draft.speechLab);
    });
  }

  function applySpeechAttempt({ passed, mode, score }: SpeechAttemptInput) {
    if (!currentCard || !currentItem) {
      return;
    }

    const now = new Date().toISOString();

    updateStorage((draft) => {
      const item = draft.reviewItems[currentCard.id];
      const progress = draft.lessonProgress[lesson.id];

      progress.status = "in_progress";
      progress.startedAt = progress.startedAt ?? now;
      progress.lastVisitedAt = now;
      draft.session.activeSceneId = sceneId;
      draft.session.activeLessonId = lesson.id;
      draft.session.lastRoute = `/scene/${sceneId}/lesson/${lesson.id}`;
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

  function startLesson() {
    const now = new Date().toISOString();

    updateStorage((draft) => {
      const progress = draft.lessonProgress[lesson.id];
      progress.status = "in_progress";
      progress.startedAt = progress.startedAt ?? now;
      progress.lastVisitedAt = now;
      draft.session.activeSceneId = sceneId;
      draft.session.activeLessonId = lesson.id;
      draft.session.lastRoute = `/scene/${sceneId}/lesson/${lesson.id}`;

      for (const card of lesson.cards) {
        draft.reviewItems[card.id].isUnlocked = true;
      }

      const firstItem = draft.reviewItems[lesson.cards[0].id];
      firstItem.isUnlocked = true;
      firstItem.introducedAt = firstItem.introducedAt ?? now;
      firstItem.lastStudiedAt = now;
      firstItem.stepState.currentStep = Math.max(firstItem.stepState.currentStep, 1) as 1 | 2 | 3 | 4 | 5;
    });

    setFeedback({
      tone: "neutral",
      message: "STEP 1 从听开始，只看中文，不提前暴露日文。"
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
    if (!recordingBlob || !currentCard) {
      setRecordingError("Record your line before requesting Azure scoring.");
      return;
    }

    setIsScoringSpeech(true);
    setRecordingError(null);

    try {
      const wav = await transcodeRecordedBlobToWav(recordingBlob);
      const assessment = await assessPronunciation({
        audio: wav,
        referenceText: currentCard.turns[0].ja
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
          ? `Azure score ${Math.round(score)} passed. Move on to reading.`
          : `Azure score ${Math.round(score)} is below ${SPEECH_PASS_SCORE}. Replay or use manual pass after review.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Azure scoring is unavailable right now.";
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
        message: "Azure scoring failed. The manual playback confirmation fallback is still available."
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
      message: "Manual confirmation accepted. Move on to reading."
    });
  }

  function applyStepTransition(step: 1 | 2 | 3 | 4 | 5, isPassed: boolean) {
    if (!currentCard || !currentItem) {
      return;
    }

    const now = new Date().toISOString();
    const learnerTurn = currentCard.turns[0];

    updateStorage((draft) => {
      const item = draft.reviewItems[currentCard.id];
      const progress = draft.lessonProgress[lesson.id];

      progress.status = "in_progress";
      progress.startedAt = progress.startedAt ?? now;
      progress.lastVisitedAt = now;
      draft.session.activeSceneId = sceneId;
      draft.session.activeLessonId = lesson.id;
      draft.session.lastRoute = `/scene/${sceneId}/lesson/${lesson.id}`;
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

          const verifiedCount = lesson.cards.filter(
            (card) =>
              card.id === currentCard.id
                ? true
                : Boolean(draft.reviewItems[card.id].stepState.verifyCompletedAt)
          ).length;

          if (verifiedCount === lesson.cards.length) {
            progress.status = "completed";
            progress.completedAt = progress.completedAt ?? now;
            normalizeLessonUnlocks(draft.lessonProgress);
          } else {
            const nextCard = lesson.cards[verifiedCount];
            const nextItem = draft.reviewItems[nextCard.id];
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
    if (!currentCard) {
      return;
    }

    const expected = currentCard.turns[0].ja;
    const passed = isStrictMatch(input.committedValue, expected);

    setDiffPreview(buildDiffTokens(input.committedValue, expected).map((token) => `${token.status}:${token.char}`));
    applyStepTransition(step, passed);

    if (passed) {
      input.reset();
      setFeedback({
        tone: "success",
        message:
          step === 4
            ? "写这一步已过，进入无提示验证。"
            : currentCardIndex === lesson.cards.length - 1
              ? "本课五步已全部完成，马上进入 Daily Check。"
              : "这张卡通过验证，已切到下一张。"
      });
      return;
    }

    setFeedback({
      tone: "danger",
      message:
        step === 4
          ? "写这一步还没对上，继续看差异后重试。"
          : "验证失败，按方案回到 STEP 4 重写。"
    });
  }

  function finishDailyCheck(results: boolean[]) {
    const score = Math.round((results.filter(Boolean).length / results.length) * 100);
    const passed = score >= 80;
    const now = new Date().toISOString();
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);

    updateStorage((draft) => {
      const progress = draft.lessonProgress[lesson.id];

      for (const card of lesson.cards) {
        const item = draft.reviewItems[card.id];
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

      progress.masteredCount = passed ? lesson.cards.length : 0;
      progress.lastVisitedAt = now;
      normalizeLessonUnlocks(draft.lessonProgress);
    });

    setFeedback({
      tone: passed ? "success" : "danger",
      message: passed
        ? `Daily Check ${score}% 通过，本课已进入已掌握。`
        : `Daily Check ${score}% 未过，本课标记为待复习。`
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
      message: passed ? "这题通过，继续下一题。" : "这题没过，继续完成本轮检查。"
    });
  }

  function restartDailyCheck() {
    setDailyQuestions(buildDailyCheckQuestions(lesson));
    setDailyIndex(0);
    setDailyResults([]);
    input.reset();
    setDiffPreview([]);

    updateStorage((draft) => {
      for (const card of lesson.cards) {
        draft.reviewItems[card.id].dailyCheckScore = null;
      }
    });

    setFeedback({
      tone: "neutral",
      message: "Daily Check 已重开。"
    });
  }

  const currentQuestion = dailyQuestions[dailyIndex];
  const writeHint = currentCard ? getHint(currentCard.turns[0].kana, storage.userSettings.kanaHintStyle) : null;
  const currentFavorited = Boolean(currentItem?.isFavorited);

  function toggleCurrentFavorite() {
    if (!currentCard) {
      return;
    }

    updateStorage((draft) => {
      toggleFavoriteReviewItem(draft, currentCard.id);
    });
  }

  return (
    <PixelCard>
      <div className="page-stack" style={{ gap: 16 }}>
        <div className="hero" style={{ gap: 12 }}>
          <div className="hero-title">
            <span className="display">LESSON LOOP</span>
            <span className={`badge ${feedback.tone === "success" ? "success" : feedback.tone === "danger" ? "danger" : ""}`.trim()}>
              {phase === "preview"
                ? "READY"
                : phase === "study"
                  ? "LEARNING"
                  : phase === "daily-check"
                    ? "DAILY CHECK"
                    : "SUMMARY"}
            </span>
          </div>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">课程进度</span>
              <strong className="stat-value">
                {completedCards} / {lesson.cards.length}
              </strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">当前阶段</span>
              <strong className="stat-value" style={{ fontSize: "1rem" }}>
                {phase === "study" ? `STEP ${activeStep}` : phase.toUpperCase()}
              </strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">小课状态</span>
              <strong className="stat-value" style={{ fontSize: "1rem" }}>
                {lessonProgress.status}
              </strong>
            </div>
          </div>
          <div className="meta-row" style={{ justifyContent: "space-between" }}>
            <span className="badge">{feedback.message}</span>
            <ProgressBlocks current={completedCards} total={lesson.cards.length} />
          </div>
        </div>

        {phase === "preview" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="placeholder-note">
              This lesson enforces the full sequence: listen, speak, read, write, then verify. After every card clears Step 5, Daily Check starts automatically.
            </div>
            <div className="placeholder-note" style={{ display: "none" }}>
              这课会严格走 `听 → 说 → 读 → 写 → 验证`，全部卡片完成后自动进入 Daily Check。
            </div>
            <div className="split-actions">
              <PixelButton
                onClick={() => {
                  startLesson();
                  setFeedback({
                    tone: "neutral",
                    message: "Step 1 starts with audio only. Listen first before revealing Japanese."
                  });
                }}
              >
                START LESSON
              </PixelButton>
              <PixelButton variant="ghost" onClick={() => playJapaneseSequence(lesson.cards[0].turns.map((turn) => turn.ja))}>
                PLAY FIRST SAMPLE
              </PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "study" && currentCard ? (
          <div className="page-stack" style={{ gap: 14 }}>
            <div className="step-strip">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`step-pill ${activeStep === step ? "active" : ""} ${activeStep > step || (step === 5 && currentItem.stepState.verifyCompletedAt) ? "done" : ""}`.trim()}
                >
                  STEP {step}
                </div>
              ))}
            </div>

            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <div className="meta-row">
                <span className="badge">{currentCard.id}</span>
                {currentCard.tags.map((tag) => (
                  <span key={tag} className="badge">
                    {tag}
                  </span>
                ))}
              </div>
              <PixelButton
                type="button"
                variant={currentFavorited ? "secondary" : "ghost"}
                onClick={toggleCurrentFavorite}
                aria-pressed={currentFavorited}
              >
                {currentFavorited ? "★ FAVORITED" : "☆ SAVE TO DEPARTURE"}
              </PixelButton>
            </div>

            {activeStep === 1 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn-list">
                  {currentCard.turns.map((turn) => (
                    <div key={turn.id} className="turn">
                      <div className="turn-role">{turn.role === "learner" ? "YOU SAY / 中文提示" : "PARTNER / 中文提示"}</div>
                      <div className="turn-zh">{turn.zh}</div>
                    </div>
                  ))}
                </div>
                <div className="split-actions">
                  <PixelButton onClick={() => {
                    const played = playJapaneseSequence(currentCard.turns.map((turn) => turn.ja));
                    setFeedback({
                      tone: played ? "neutral" : "danger",
                      message: played ? "示例音频已播放，可以重复听。" : "当前设备不支持 TTS 播放。"
                    });
                  }}>
                    PLAY AUDIO
                  </PixelButton>
                  <PixelButton variant="secondary" onClick={() => applyStepTransition(1, true)}>
                    NEXT: SPEAK
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn-list">
                  {currentCard.turns.map((turn) => (
                    <div key={turn.id} className="turn">
                      <div className="turn-role">{turn.role === "learner" ? "YOU SAY / かな" : "PARTNER / かな"}</div>
                      <div className="turn-kana">{turn.kana}</div>
                    </div>
                  ))}
                </div>
                <div className="summary-box">
                  <div className="meta-row">
                    <span className={`badge ${speechProxyReady ? "success" : ""}`.trim()}>
                      {speechProxyReady ? "AZURE READY" : "MANUAL FALLBACK"}
                    </span>
                    <span className="badge">Pass Score: {SPEECH_PASS_SCORE}</span>
                    {speechProxyStatus?.region ? (
                      <span className="badge">{speechProxyStatus.region}</span>
                    ) : null}
                  </div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Azure scoring runs first when the Edge proxy is configured. If it is unavailable, playback plus manual confirmation still unlocks the next step.
                  </p>
                </div>
                <div className="placeholder-note" style={{ display: "none" }}>
                  Azure 发音评分要到 Phase 5 才接入；当前走“录音回放 + 手动确认”降级路径。
                </div>
                <div className="split-actions">
                  {recordStatus !== "recording" ? (
                    <PixelButton onClick={() => void startRecording()}>
                      {canRecord ? "START RECORD" : "MANUAL ONLY"}
                    </PixelButton>
                  ) : (
                    <PixelButton onClick={stopRecording}>STOP RECORD</PixelButton>
                  )}
                  <PixelButton variant="ghost" onClick={playBackRecording}>
                    PLAY BACK
                  </PixelButton>
                  <PixelButton
                    variant="secondary"
                    onClick={() => void scoreSpeechWithAzure()}
                    aria-disabled={!recordingBlob || isScoringSpeech || !speechProxyReady}
                  >
                    {isScoringSpeech ? "SCORING..." : "SCORE WITH AZURE"}
                  </PixelButton>
                  <PixelButton variant="secondary" style={{ display: "none" }} onClick={() => {
                    applyStepTransition(2, true);
                    setRecordStatus("idle");
                    setFeedback({
                      tone: "success",
                      message: "说这一步已手动确认通过，进入阅读。"
                    });
                  }}>
                    MANUAL PASS
                  </PixelButton>
                </div>
                <div className="split-actions">
                  <PixelButton variant="secondary" onClick={passSpeechManually}>
                    MANUAL PASS
                  </PixelButton>
                </div>
                {speechResult ? (
                  <div className="page-stack" style={{ gap: 12 }}>
                    <div className="stat-grid">
                      <div className="stat-box">
                        <span className="stat-label">Pronunciation</span>
                        <strong className="stat-value">
                          {speechResult.scores.pronunciation ?? speechResult.scores.accuracy ?? "--"}
                        </strong>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">Accuracy</span>
                        <strong className="stat-value">
                          {speechResult.scores.accuracy ?? "--"}
                        </strong>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">Fluency</span>
                        <strong className="stat-value">
                          {speechResult.scores.fluency ?? "--"}
                        </strong>
                      </div>
                    </div>
                    <div className="turn">
                      <div className="turn-role">AZURE RESULT</div>
                      <div className="turn-zh">
                        Recognized: {speechResult.recognizedText || "No text returned"}
                      </div>
                      <div className="diff-row">
                        {speechResult.words.map((word, index) => (
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
                {recordingError ? (
                  <div className="badge danger">
                    {recordingError}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn-list">
                  {currentCard.turns.map((turn) => (
                    <div key={turn.id} className="turn">
                      <div className="turn-role">{turn.role === "learner" ? "YOU SAY" : "PARTNER SAYS"}</div>
                      <div className="turn-ja">
                        <RubyText tokens={turn.ruby} />
                      </div>
                      <div className="turn-kana">{turn.kana}</div>
                      <div className="turn-zh">{turn.zh}</div>
                    </div>
                  ))}
                </div>
                {currentCard.coachNote ? (
                  <div className="placeholder-note">{currentCard.coachNote}</div>
                ) : null}
                <div className="split-actions">
                  <PixelButton variant="secondary" onClick={() => applyStepTransition(3, true)}>
                    NEXT: WRITE
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {(activeStep === 4 || activeStep === 5) && currentCard ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">
                    {activeStep === 4 ? "STEP 4 / 写" : "STEP 5 / 验证"}
                  </div>
                  <div className="turn-zh">{currentCard.turns[0].zh}</div>
                  {activeStep === 4 && writeHint ? (
                    <div className="turn-kana">提示: {writeHint}</div>
                  ) : null}
                </div>
                <div className="input-lab">
                  <textarea
                    aria-label={activeStep === 4 ? "Write answer" : "Verify answer"}
                    className="pixel-textarea"
                    placeholder="ここに日本語を入力してください"
                    {...input.bind}
                  />
                </div>
                {diffPreview.length > 0 ? (
                  <div className="diff-row">
                    {diffPreview.map((token, index) => {
                      const [status, char] = token.split(":");
                      return (
                        <span key={`${token}-${index}`} className={`diff-token ${status}`.trim()}>
                          {char || "∅"}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                <div className="split-actions">
                  <PixelButton onClick={() => submitWrite(activeStep as 4 | 5)}>
                    {activeStep === 4 ? "CHECK WRITE" : "VERIFY"}
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
                QUESTION {dailyIndex + 1} / {dailyQuestions.length}
              </span>
              <span className="badge">{currentQuestion.type}</span>
            </div>

            {currentQuestion.type === "listen-choice" ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">听音选义</div>
                  <div className="turn-zh">{currentQuestion.prompt}</div>
                </div>
                <div className="split-actions">
                  <PixelButton onClick={() => playJapaneseSequence([currentQuestion.audioText])}>
                    PLAY PROMPT
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
                  <div className="turn-role">中译日输入</div>
                  <div className="turn-zh">{currentQuestion.prompt}</div>
                  {currentQuestion.hint ? (
                    <div className="turn-kana">{currentQuestion.hint}</div>
                  ) : null}
                </div>
                <textarea
                  aria-label="Daily check translate input"
                  className="pixel-textarea"
                  placeholder="ここに日本語を入力してください"
                  {...input.bind}
                />
                <div className="split-actions">
                  <PixelButton onClick={() => submitDailyQuestion()}>SUBMIT</PixelButton>
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
                  aria-label="Daily check reply input"
                  className="pixel-textarea"
                  placeholder="次の一文を入力してください"
                  {...input.bind}
                />
                <div className="split-actions">
                  <PixelButton onClick={() => submitDailyQuestion()}>SUBMIT</PixelButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "complete" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="summary-box">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Lesson Summary
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {latestDailyScore === null
                  ? "本课五步已完成，等待 Daily Check。"
                  : dailyPassed
                    ? `Daily Check ${latestDailyScore}% 通过，已进入已掌握。`
                    : `Daily Check ${latestDailyScore}% 未通过，当前为待复习状态。`}
              </p>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="stat-label">已完成卡片</span>
                <strong className="stat-value">{lesson.cards.length}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Daily Check</span>
                <strong className="stat-value">
                  {latestDailyScore === null ? "Pending" : `${latestDailyScore}%`}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">掌握状态</span>
                <strong className="stat-value" style={{ fontSize: "1rem" }}>
                  {dailyPassed ? "mastered" : "studied"}
                </strong>
              </div>
            </div>
            <div className="split-actions">
              {!dailyPassed ? (
                <PixelButton onClick={restartDailyCheck}>RETAKE DAILY CHECK</PixelButton>
              ) : null}
              <PixelButton href={`/scene/${sceneId}`} variant="secondary">
                BACK TO SCENE
              </PixelButton>
            </div>
          </div>
        ) : null}
      </div>
    </PixelCard>
  );
}
