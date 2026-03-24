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
const lessonPhaseLabelMap = {
  preview: "待开始",
  study: "学习中",
  "daily-check": "每日检验",
  complete: "总结"
} as const;
const lessonStatusLabelMap = {
  locked: "未解锁",
  available: "可开始",
  in_progress: "进行中",
  completed: "已完成"
} as const;
const dailyQuestionTypeLabelMap = {
  "listen-choice": "听音选义",
  "translate-input": "中译日输入",
  "reply-input": "对话补全"
} as const;

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
    message: "先点开始课程，之后流程会严格按五步推进。"
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
        message: "每日检验已开始，题型会混合听音、翻译输入和对话补全。"
      });
      input.reset();
      setDiffPreview([]);
    }
  }, [dailyQuestions.length, input, lesson, phase]);

  useEffect(() => {
    if (phase === "preview") {
      setFeedback({
        tone: "neutral",
        message: "开始课程后，将依次进入听、说、读、写、验证五步。"
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
      message: "第一步从听开始，只看中文，不提前暴露日文。"
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
      setRecordingError("请先录音再请求评分。");
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
          ? `发音评分 ${Math.round(score)} 通过，进入阅读步骤。`
          : `评分 ${Math.round(score)} 未达标（${SPEECH_PASS_SCORE}分），可重录或手动通过。`
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
        message: "评分失败，可使用手动确认继续。"
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
      message: "手动确认通过，进入阅读步骤。"
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
              ? "本课五步已全部完成，马上进入每日检验。"
              : "这张卡通过验证，已切到下一张。"
      });
      return;
    }

    setFeedback({
      tone: "danger",
      message:
        step === 4
          ? "写这一步还没对上，继续看差异后重试。"
          : "验证失败，按方案回到第4步重写。"
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
        ? `每日检验 ${score}% 通过，本课已进入已掌握。`
        : `每日检验 ${score}% 未过，本课标记为待复习。`
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
      message: "每日检验已重开。"
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
            <span className="display">课程学习</span>
            <span className={`badge ${feedback.tone === "success" ? "success" : feedback.tone === "danger" ? "danger" : ""}`.trim()}>
              {lessonPhaseLabelMap[phase]}
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
                {phase === "study" ? `第${activeStep}步` : lessonPhaseLabelMap[phase]}
              </strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">小课状态</span>
              <strong className="stat-value" style={{ fontSize: "1rem" }}>
                {lessonStatusLabelMap[lessonProgress.status]}
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
              本课按听、说、读、写、验证五步顺序推进。全部卡片完成第五步后，自动进入每日检验。
            </div>
            <div className="placeholder-note" style={{ display: "none" }}>
              这课会严格走 `听 → 说 → 读 → 写 → 验证`，全部卡片完成后自动进入每日检验。
            </div>
            <div className="split-actions">
              <PixelButton
                onClick={() => {
                  startLesson();
                  setFeedback({
                    tone: "neutral",
                    message: "第一步只听音，先听再看日文。"
                  });
                }}
              >
                开始课程
              </PixelButton>
              <PixelButton variant="ghost" onClick={() => playJapaneseSequence(lesson.cards[0].turns.map((turn) => turn.ja))}>
                播放示例
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
                  第{step}步
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
                {currentFavorited ? "★ 已收藏" : "☆ 加入出发"}
              </PixelButton>
            </div>

            {activeStep === 1 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn-list">
                  {currentCard.turns.map((turn) => (
                    <div key={turn.id} className="turn">
                      <div className="turn-role">{turn.role === "learner" ? "你说 / 中文提示" : "对方 / 中文提示"}</div>
                      <div className="turn-zh">{turn.zh}</div>
                    </div>
                  ))}
                </div>
                <div className="split-actions">
                  <PixelButton onClick={() => {
                    const played = playJapaneseSequence(currentCard.turns.map((turn) => turn.ja));
                    setFeedback({
                      tone: played ? "neutral" : "danger",
                      message: played ? "示例音频已播放，可以重复听。" : "当前设备不支持语音播放。"
                    });
                  }}>
                    播放音频
                  </PixelButton>
                  <PixelButton variant="secondary" onClick={() => applyStepTransition(1, true)}>
                    下一步：跟读
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn-list">
                  {currentCard.turns.map((turn) => (
                    <div key={turn.id} className="turn">
                      <div className="turn-role">{turn.role === "learner" ? "你说 / 假名" : "对方 / 假名"}</div>
                      <div className="turn-kana">{turn.kana}</div>
                    </div>
                  ))}
                </div>
                <div className="summary-box">
                  <div className="meta-row">
                    <span className={`badge ${speechProxyReady ? "success" : ""}`.trim()}>
                      {speechProxyReady ? "发音评分就绪" : "手动确认模式"}
                    </span>
                    <span className="badge">通过分数：{SPEECH_PASS_SCORE}</span>
                    {speechProxyStatus?.region ? (
                      <span className="badge">{speechProxyStatus.region}</span>
                    ) : null}
                  </div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    优先使用 Azure 发音评分；如果代理不可用，仍可通过回放加手动确认进入下一步。
                  </p>
                </div>
                <div className="placeholder-note" style={{ display: "none" }}>
                  Azure 发音评分通过代理接入；当前仍保留“录音回放 + 手动确认”降级路径。
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
                  <PixelButton variant="secondary" style={{ display: "none" }} onClick={() => {
                    applyStepTransition(2, true);
                    setRecordStatus("idle");
                    setFeedback({
                      tone: "success",
                      message: "说这一步已手动确认通过，进入阅读。"
                    });
                  }}>
                    手动通过
                  </PixelButton>
                </div>
                <div className="split-actions">
                  <PixelButton variant="secondary" onClick={passSpeechManually}>
                    手动通过
                  </PixelButton>
                </div>
                {speechResult ? (
                  <div className="page-stack" style={{ gap: 12 }}>
                    <div className="stat-grid">
                      <div className="stat-box">
                        <span className="stat-label">发音</span>
                        <strong className="stat-value">
                          {speechResult.scores.pronunciation ?? speechResult.scores.accuracy ?? "--"}
                        </strong>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">准确度</span>
                        <strong className="stat-value">
                          {speechResult.scores.accuracy ?? "--"}
                        </strong>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">流利度</span>
                        <strong className="stat-value">
                          {speechResult.scores.fluency ?? "--"}
                        </strong>
                      </div>
                    </div>
                    <div className="turn">
                      <div className="turn-role">评分结果</div>
                      <div className="turn-zh">
                        识别内容：{speechResult.recognizedText || "无识别内容"}
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
                      <div className="turn-role">{turn.role === "learner" ? "你说" : "对方说"}</div>
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
                    下一步：书写
                  </PixelButton>
                </div>
              </div>
            ) : null}

            {(activeStep === 4 || activeStep === 5) && currentCard ? (
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="turn">
                  <div className="turn-role">
                    {activeStep === 4 ? "第4步 / 写" : "第5步 / 验证"}
                  </div>
                  <div className="turn-zh">{currentCard.turns[0].zh}</div>
                  {activeStep === 4 && writeHint ? (
                    <div className="turn-kana">提示: {writeHint}</div>
                  ) : null}
                </div>
                <div className="input-lab">
                  <textarea
                    aria-label={activeStep === 4 ? "书写输入框" : "验证输入框"}
                    className="pixel-textarea"
                    placeholder="在此输入日文"
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
                    {activeStep === 4 ? "检查书写" : "验证答案"}
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
                    播放题目
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
                  aria-label="每日检验翻译输入框"
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
            <div className="summary-box">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                课程总结
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {latestDailyScore === null
                  ? "本课五步已完成，等待每日检验。"
                  : dailyPassed
                    ? `每日检验 ${latestDailyScore}% 通过，已进入已掌握。`
                    : `每日检验 ${latestDailyScore}% 未通过，当前为待复习状态。`}
              </p>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="stat-label">已完成卡片</span>
                <strong className="stat-value">{lesson.cards.length}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">每日检验</span>
                <strong className="stat-value">
                  {latestDailyScore === null ? "待检验" : `${latestDailyScore}%`}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">掌握状态</span>
                <strong className="stat-value" style={{ fontSize: "1rem" }}>
                  {dailyPassed ? "已掌握" : "待复习"}
                </strong>
              </div>
            </div>
            <div className="split-actions">
              {!dailyPassed ? (
                <PixelButton onClick={restartDailyCheck}>重做每日检验</PixelButton>
              ) : null}
              <PixelButton href={`/scene/${sceneId}`} variant="secondary">
                返回场景
              </PixelButton>
            </div>
          </div>
        ) : null}
      </div>
    </PixelCard>
  );
}
