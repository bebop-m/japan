import type { ContentType, SceneId } from "@/lib/types/content";

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "nihongo-go/storage/v1";

export type ReviewStatus =
  | "unseen"
  | "studied"
  | "mastered"
  | "familiar"
  | "reinforced";

export type ReviewResult = "none" | "again" | "hard" | "good";

export type ReviewMode =
  | "none"
  | "learn"
  | "daily-check"
  | "srs"
  | "practice"
  | "departure";

export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

export interface ReviewStepState {
  currentStep: 0 | 1 | 2 | 3 | 4 | 5;
  listenCompletedAt: string | null;
  speakCompletedAt: string | null;
  readCompletedAt: string | null;
  writeCompletedAt: string | null;
  verifyCompletedAt: string | null;
  speakAttempts: number;
  writeAttempts: number;
  verifyAttempts: number;
  manualSpeechPasses: number;
}

export interface ReviewItem {
  contentId: string;
  contentType: ContentType;
  sceneId: SceneId;
  lessonId: string | null;
  status: ReviewStatus;
  isUnlocked: boolean;
  introducedAt: string | null;
  lastStudiedAt: string | null;
  completedAt: string | null;
  dailyCheckEligibleAt: string | null;
  dailyCheckScore: number | null;
  dailyCheckPassedAt: string | null;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  intervalDays: number;
  streak: number;
  correctCount: number;
  mistakeCount: number;
  isFavorited: boolean;
  isCore: boolean;
  lastResult: ReviewResult;
  lastReviewMode: ReviewMode;
  lastInput: string | null;
  lastAudioScore: number | null;
  stepState: ReviewStepState;
}

export interface LessonProgress {
  lessonId: string;
  sceneId: SceneId;
  order: number;
  status: LessonStatus;
  unlockedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  masteredCount: number;
  cardCount: number;
  lastVisitedAt: string | null;
}

export interface UserSettings {
  audioMode: "tts" | "recorded";
  speechScoringMode: "azure" | "manual";
  hintsEnabled: boolean;
  reducedMotion: boolean;
  kanaHintStyle: "hidden" | "first-word" | "full";
}

export interface SpeechLabSnapshot {
  supported: boolean;
  mediaRecorderSupported: boolean;
  permissionState: "unknown" | "prompt" | "granted" | "denied" | "unsupported";
  requiresGesture: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface SessionSnapshot {
  activeSceneId: SceneId | null;
  activeLessonId: string | null;
  lastRoute: string;
}

export interface ReviewSeed {
  contentId: string;
  contentType: ContentType;
  sceneId: SceneId;
  lessonId: string | null;
  isCore: boolean;
}

export interface LessonSeed {
  lessonId: string;
  sceneId: SceneId;
  order: number;
  cardCount: number;
}

export interface StorageCatalog {
  version: typeof STORAGE_VERSION;
  reviewSeeds: ReviewSeed[];
  lessonSeeds: LessonSeed[];
}

export interface AppStorageState {
  version: typeof STORAGE_VERSION;
  lastMigratedAt: string;
  reviewItems: Record<string, ReviewItem>;
  lessonProgress: Record<string, LessonProgress>;
  userSettings: UserSettings;
  speechLab: SpeechLabSnapshot;
  session: SessionSnapshot;
}
