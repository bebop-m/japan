import type { AppStorageState } from "@/lib/types/storage";

export function cloneStorageState(current: AppStorageState): AppStorageState {
  return {
    ...current,
    reviewItems: Object.fromEntries(
      Object.entries(current.reviewItems).map(([key, item]) => [
        key,
        {
          ...item,
          stepState: {
            ...item.stepState
          }
        }
      ])
    ),
    lessonProgress: Object.fromEntries(
      Object.entries(current.lessonProgress).map(([key, progress]) => [
        key,
        {
          ...progress
        }
      ])
    ),
    bookProgressByScene: Object.fromEntries(
      Object.entries(current.bookProgressByScene).map(([key, progress]) => [
        key,
        {
          ...progress
        }
      ])
    ),
    userSettings: {
      ...current.userSettings
    },
    speechLab: {
      ...current.speechLab
    },
    session: {
      ...current.session
    }
  };
}
