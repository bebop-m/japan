import { mergeCatalogIntoStorageState } from "@/lib/storage/catalog";
import { migrateStorage } from "@/lib/storage/local";
import type { AppStorageState } from "@/lib/types/storage";
import { STORAGE_VERSION } from "@/lib/types/storage";

interface StorageBackupDocument {
  app: "nihongo-go";
  exportedAt: string;
  version: number;
  state: AppStorageState;
}

export function createStorageBackup(state: AppStorageState): StorageBackupDocument {
  return {
    app: "nihongo-go",
    exportedAt: new Date().toISOString(),
    version: STORAGE_VERSION,
    state: mergeCatalogIntoStorageState(state)
  };
}

export function parseStorageBackup(raw: string): AppStorageState | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate =
      parsed &&
      typeof parsed === "object" &&
      "state" in parsed &&
      parsed.state
        ? parsed.state
        : parsed;
    const migrated = migrateStorage(candidate);

    return migrated ? mergeCatalogIntoStorageState(migrated) : null;
  } catch {
    return null;
  }
}

export function getStorageBackupFileName(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `nihongo-backup-${year}${month}${day}.json`;
}
