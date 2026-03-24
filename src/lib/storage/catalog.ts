import storageCatalog from "@/content/storage-catalog.json";
import { syncBookProgressWithReviewItems } from "@/lib/books";
import {
  createBookProgress,
  createDefaultStorageState,
  createLessonProgressFromSeed,
  createDefaultReviewItemFromSeed
} from "@/lib/storage/defaults";
import type {
  AppStorageState,
  BookProgress,
  LessonProgress,
  LessonSeed,
  ReviewItem,
  StorageCatalog
} from "@/lib/types/storage";

const catalog = storageCatalog as StorageCatalog;

function cloneReviewItem(item: ReviewItem): ReviewItem {
  return {
    ...item,
    stepState: {
      ...item.stepState
    }
  };
}

function cloneLessonProgress(progress: LessonProgress): LessonProgress {
  return {
    ...progress
  };
}

function cloneBookProgress(progress: BookProgress): BookProgress {
  return {
    ...progress
  };
}

function sortLessonSeeds(seeds: LessonSeed[]): LessonSeed[] {
  return [...seeds].sort((left, right) => {
    if (left.sceneId === right.sceneId) {
      return left.order - right.order;
    }

    return left.sceneId.localeCompare(right.sceneId);
  });
}

export function getStorageCatalog(): StorageCatalog {
  return catalog;
}

export function createCatalogSeededStorageState(): AppStorageState {
  return mergeCatalogIntoStorageState(createDefaultStorageState());
}

export function mergeCatalogIntoStorageState(state: AppStorageState): AppStorageState {
  const next: AppStorageState = {
    ...state,
    reviewItems: Object.fromEntries(
      Object.entries(state.reviewItems).map(([key, value]) => [key, cloneReviewItem(value)])
    ),
    lessonProgress: Object.fromEntries(
      Object.entries(state.lessonProgress).map(([key, value]) => [key, cloneLessonProgress(value)])
    ),
    bookProgressByScene: Object.fromEntries(
      Object.entries(state.bookProgressByScene).map(([key, value]) => [key, cloneBookProgress(value)])
    )
  };

  for (const lessonSeed of sortLessonSeeds(catalog.lessonSeeds)) {
    const existing = next.lessonProgress[lessonSeed.lessonId];

    if (!existing) {
      next.lessonProgress[lessonSeed.lessonId] = createLessonProgressFromSeed(lessonSeed);
      continue;
    }

    next.lessonProgress[lessonSeed.lessonId] = {
      ...existing,
      sceneId: lessonSeed.sceneId,
      order: lessonSeed.order,
      cardCount: lessonSeed.cardCount
    };
  }

  normalizeLessonUnlocks(next.lessonProgress);

  for (const reviewSeed of catalog.reviewSeeds) {
    const lessonStatus = reviewSeed.lessonId
      ? next.lessonProgress[reviewSeed.lessonId]?.status ?? "locked"
      : "available";
    const existing = next.reviewItems[reviewSeed.contentId];

    if (!existing) {
      next.reviewItems[reviewSeed.contentId] = {
        ...createDefaultReviewItemFromSeed(reviewSeed),
        isUnlocked: lessonStatus !== "locked"
      };
      continue;
    }

    next.reviewItems[reviewSeed.contentId] = {
      ...existing,
      contentType: reviewSeed.contentType,
      sceneId: reviewSeed.sceneId,
      lessonId: reviewSeed.lessonId,
      isCore: reviewSeed.isCore,
      isUnlocked: lessonStatus !== "locked" || existing.status !== "unseen"
    };
  }

  for (const reviewSeed of catalog.reviewSeeds) {
    if (!next.bookProgressByScene[reviewSeed.sceneId]) {
      next.bookProgressByScene[reviewSeed.sceneId] = createBookProgress(reviewSeed.sceneId);
    }
  }

  return syncBookProgressWithReviewItems(next);
}

export function normalizeLessonUnlocks(
  lessonProgress: Record<string, LessonProgress>
): Record<string, LessonProgress> {
  const sceneGroups = new Map<string, LessonProgress[]>();

  for (const progress of Object.values(lessonProgress)) {
    const group = sceneGroups.get(progress.sceneId) ?? [];
    group.push(progress);
    sceneGroups.set(progress.sceneId, group);
  }

  for (const group of sceneGroups.values()) {
    group.sort((left, right) => left.order - right.order);

    group.forEach((progress, index) => {
      if (index === 0) {
        if (progress.status === "locked") {
          progress.status = "available";
        }

        if (!progress.unlockedAt) {
          progress.unlockedAt = new Date(0).toISOString();
        }

        return;
      }

      const previous = group[index - 1];

      if (
        previous.status === "completed" &&
        progress.status === "locked"
      ) {
        progress.status = "available";
        progress.unlockedAt = progress.unlockedAt ?? new Date().toISOString();
      }
    });
  }

  return lessonProgress;
}
