import {
  createCatalogSeededStorageState,
  mergeCatalogIntoStorageState
} from "@/lib/storage/catalog";
import type { AppStorageState } from "@/lib/types/storage";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/types/storage";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function readStorageState(): AppStorageState {
  const fallback = createCatalogSeededStorageState();

  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateStorage(parsed);

    if (!migrated) {
      return fallback;
    }

    return mergeCatalogIntoStorageState(migrated);
  } catch {
    return fallback;
  }
}

export function migrateStorage(raw: unknown): AppStorageState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as Partial<AppStorageState>;

  switch (parsed.version) {
    case STORAGE_VERSION:
      return normalizeStoredState(parsed);
    default:
      // Future storage migrations must be implemented here before bumping STORAGE_VERSION.
      // Returning null falls back to the seeded default state; do not rely on that once
      // real users have progress data in production.
      return null;
  }
}

function normalizeStoredState(parsed: Partial<AppStorageState>): AppStorageState {
  const fallback = createCatalogSeededStorageState();

  return {
    ...fallback,
    ...parsed,
    reviewItems: parsed.reviewItems ?? fallback.reviewItems,
    lessonProgress: parsed.lessonProgress ?? fallback.lessonProgress,
    userSettings: {
      ...fallback.userSettings,
      ...parsed.userSettings
    },
    speechLab: {
      ...fallback.speechLab,
      ...parsed.speechLab
    },
    session: {
      ...fallback.session,
      ...parsed.session
    }
  };
}

export function writeStorageState(state: AppStorageState): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...mergeCatalogIntoStorageState(state),
      version: STORAGE_VERSION
    })
  );
}
