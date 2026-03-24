import {
  createCatalogSeededStorageState,
  mergeCatalogIntoStorageState
} from "@/lib/storage/catalog";
import type { AppStorageState } from "@/lib/types/storage";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/types/storage";

const LEGACY_STORAGE_KEYS = ["nihongo-go/storage/v1"] as const;
type StorageMigrationInput = Partial<Omit<AppStorageState, "version">> & {
  version?: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readPersistedStorage(): { key: string | null; raw: string | null } {
  if (!canUseStorage()) {
    return {
      key: null,
      raw: null
    };
  }

  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);

    if (raw) {
      return {
        key,
        raw
      };
    }
  }

  return {
    key: null,
    raw: null
  };
}

export function readStorageState(): AppStorageState {
  const fallback = createCatalogSeededStorageState();

  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const persisted = readPersistedStorage();
    const raw = persisted.raw;

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateStorage(parsed);

    if (!migrated) {
      return fallback;
    }

    const normalized = mergeCatalogIntoStorageState(migrated);

    if (persisted.key !== STORAGE_KEY || normalized.version !== STORAGE_VERSION) {
      writeStorageState(normalized);
    }

    return normalized;
  } catch {
    return fallback;
  }
}

export function migrateStorage(raw: unknown): AppStorageState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as StorageMigrationInput;

  switch (parsed.version) {
    case 1:
      return normalizeStoredState({
        ...parsed,
        version: STORAGE_VERSION,
        lastMigratedAt: new Date().toISOString()
      } as Partial<AppStorageState>);
    case STORAGE_VERSION:
      return normalizeStoredState(parsed as Partial<AppStorageState>);
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

  const normalized = {
    ...mergeCatalogIntoStorageState(state),
    version: STORAGE_VERSION
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalized)
  );

  for (const key of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
