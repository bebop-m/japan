import type { LessonDefinition, PhraseCard, SceneId, WordCard } from "@/lib/types/content";
import type {
  AppStorageState,
  BookProgress,
  LessonSeed,
  LessonProgress,
  ReviewSeed,
  ReviewItem,
  SpeechLabSnapshot
} from "@/lib/types/storage";
import { STORAGE_VERSION } from "@/lib/types/storage";

export function createDefaultSpeechLab(): SpeechLabSnapshot {
  return {
    supported: false,
    mediaRecorderSupported: false,
    permissionState: "unknown",
    requiresGesture: true,
    lastCheckedAt: null,
    lastError: null
  };
}

export function createDefaultReviewItem(content: PhraseCard | WordCard): ReviewItem {
  return {
    ...createDefaultReviewItemFromSeed({
      contentId: content.id,
      contentType: content.type === "dialogue" ? "phrase" : "word",
      sceneId: content.sceneId,
      lessonId: "lessonId" in content ? content.lessonId : null,
      isCore: content.type === "dialogue" ? content.isCore : false
    })
  };
}

export function createDefaultReviewItemFromSeed(seed: ReviewSeed): ReviewItem {
  return {
    contentId: seed.contentId,
    contentType: seed.contentType,
    sceneId: seed.sceneId,
    lessonId: seed.lessonId,
    status: "unseen",
    isUnlocked: false,
    introducedAt: null,
    lastStudiedAt: null,
    completedAt: null,
    dailyCheckEligibleAt: null,
    dailyCheckScore: null,
    dailyCheckPassedAt: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    intervalDays: 1,
    streak: 0,
    correctCount: 0,
    mistakeCount: 0,
    isFavorited: false,
    isCore: seed.isCore,
    lastResult: "none",
    lastReviewMode: "none",
    lastInput: null,
    lastAudioScore: null,
    stepState: {
      currentStep: 0,
      listenCompletedAt: null,
      speakCompletedAt: null,
      readCompletedAt: null,
      writeCompletedAt: null,
      verifyCompletedAt: null,
      speakAttempts: 0,
      writeAttempts: 0,
      verifyAttempts: 0,
      manualSpeechPasses: 0
    }
  };
}

export function createLessonProgress(
  sceneId: SceneId,
  lesson: LessonDefinition
): LessonProgress {
  return createLessonProgressFromSeed({
    lessonId: lesson.id,
    sceneId,
    order: lesson.order,
    cardCount: lesson.cards.length
  });
}

export function createLessonProgressFromSeed(seed: LessonSeed): LessonProgress {
  return {
    lessonId: seed.lessonId,
    sceneId: seed.sceneId,
    order: seed.order,
    status: seed.order === 1 ? "available" : "locked",
    unlockedAt: seed.order === 1 ? new Date(0).toISOString() : null,
    startedAt: null,
    completedAt: null,
    masteredCount: 0,
    cardCount: seed.cardCount,
    lastVisitedAt: null
  };
}

export function createBookProgress(sceneId: SceneId): BookProgress {
  return {
    sceneId,
    currentIndex: 0,
    currentWordIndex: 0,
    currentMixedIndex: 0,
    lastBatchType: "sentence",
    lastBatchSize: 0,
    updatedAt: null
  };
}

export function createDefaultStorageState(): AppStorageState {
  return {
    version: STORAGE_VERSION,
    lastMigratedAt: new Date().toISOString(),
    reviewItems: {},
    lessonProgress: {},
    bookProgressByScene: {},
    userSettings: {
      audioMode: "tts",
      speechScoringMode: "manual",
      hintsEnabled: true,
      reducedMotion: false,
      kanaHintStyle: "first-word",
      departureDateISO: null
    },
    speechLab: createDefaultSpeechLab(),
    session: {
      activeSceneId: null,
      activeLessonId: null,
      lastRoute: "/"
    }
  };
}
