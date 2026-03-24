import type { PhraseCard } from "@/lib/types/content";
import type { AppStorageState, ReviewItem, ReviewStatus } from "@/lib/types/storage";

export type SrsRating = "again" | "hard" | "good";

export type ReviewDirection = "zh-to-ja" | "ja-to-zh";

export interface ReviewQueueEntry {
  contentId: string;
  direction: ReviewDirection;
}

export function isReviewStatus(status: ReviewStatus): boolean {
  return status === "mastered" || status === "familiar" || status === "reinforced";
}

export function isDueReviewItem(item: ReviewItem, now = new Date()): boolean {
  if (!isReviewStatus(item.status) || !item.nextReviewAt) {
    return false;
  }

  return new Date(item.nextReviewAt).getTime() <= now.getTime();
}

export function getDueReviewItems(
  storage: AppStorageState,
  now = new Date()
): ReviewItem[] {
  return Object.values(storage.reviewItems)
    .filter((item) => item.contentType === "phrase" && isDueReviewItem(item, now))
    .sort((left, right) => {
      const leftTime = left.nextReviewAt ? new Date(left.nextReviewAt).getTime() : 0;
      const rightTime = right.nextReviewAt ? new Date(right.nextReviewAt).getTime() : 0;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.contentId.localeCompare(right.contentId);
    });
}

export function buildReviewQueue(items: ReviewItem[]): ReviewQueueEntry[] {
  return items.map((item, index) => ({
    contentId: item.contentId,
    direction: index % 2 === 0 ? "zh-to-ja" : "ja-to-zh"
  }));
}

export function getNextAvailableLesson(
  storage: AppStorageState
): AppStorageState["lessonProgress"][string] | null {
  const lessons = Object.values(storage.lessonProgress).sort((left, right) => {
    if (left.sceneId === right.sceneId) {
      return left.order - right.order;
    }

    return left.sceneId.localeCompare(right.sceneId);
  });

  return (
    lessons.find((lesson) => lesson.status === "in_progress" || lesson.status === "available") ??
    null
  );
}

export function getNewSentenceCount(
  storage: AppStorageState
): number {
  const nextLesson = getNextAvailableLesson(storage);

  return nextLesson ? nextLesson.cardCount * 2 : 0;
}

export function getMasteredSentenceCount(storage: AppStorageState): number {
  const masteredCards = Object.values(storage.reviewItems).filter((item) =>
    isReviewStatus(item.status)
  ).length;

  return masteredCards * 2;
}

export function getStudiedSentenceCount(storage: AppStorageState): number {
  return Object.values(storage.reviewItems).filter((item) => item.status === "studied").length * 2;
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function getStatusFromInterval(intervalDays: number, streak: number): ReviewStatus {
  if (intervalDays >= 8) {
    return "reinforced";
  }

  if (streak >= 2) {
    return "familiar";
  }

  return "mastered";
}

export function applySrsRating(
  item: ReviewItem,
  rating: SrsRating,
  now = new Date()
): ReviewItem {
  const next = {
    ...item,
    lastReviewedAt: now.toISOString(),
    lastReviewMode: "srs" as const,
    lastResult: rating,
    stepState: {
      ...item.stepState
    }
  };

  if (rating === "again") {
    next.intervalDays = 1;
    next.streak = 0;
    next.nextReviewAt = addDays(now, 1);
    next.status = "mastered";
    next.mistakeCount += 1;
    return next;
  }

  if (rating === "hard") {
    next.intervalDays = Math.max(1, item.intervalDays);
    next.streak = 0;
    next.nextReviewAt = addDays(now, next.intervalDays);
    next.status = getStatusFromInterval(next.intervalDays, next.streak);
    return next;
  }

  next.intervalDays = Math.min(16, Math.max(1, item.intervalDays) * 2);
  next.streak = item.streak + 1;
  next.nextReviewAt = addDays(now, next.intervalDays);
  next.status = getStatusFromInterval(next.intervalDays, next.streak);
  next.correctCount += 1;
  return next;
}

export function buildPhraseCardMap(cards: PhraseCard[]): Record<string, PhraseCard> {
  return Object.fromEntries(cards.map((card) => [card.id, card]));
}
