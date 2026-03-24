import type { LessonDefinition, SceneDefinition } from "@/lib/types/content";
import type { LessonProgress, LessonStatus } from "@/lib/types/storage";

export interface LessonUnlockView {
  lesson: LessonDefinition;
  status: LessonStatus;
  isUnlocked: boolean;
}

export function getLessonStatus(
  lesson: LessonDefinition,
  lessonProgress: Record<string, LessonProgress>
): LessonStatus {
  return lessonProgress[lesson.id]?.status ?? (lesson.order === 1 ? "available" : "locked");
}

export function getLessonUnlockState(
  scene: SceneDefinition,
  lessonProgress: Record<string, LessonProgress>
): LessonUnlockView[] {
  return scene.lessons.map((lesson, index) => {
    const explicitStatus = lessonProgress[lesson.id]?.status;
    const previousLesson = scene.lessons[index - 1];
    const previousStatus = previousLesson
      ? lessonProgress[previousLesson.id]?.status ??
        (previousLesson.order === 1 ? "available" : "locked")
      : "completed";

    const derivedStatus =
      explicitStatus ??
      (lesson.order === 1 || previousStatus === "completed" ? "available" : "locked");

    return {
      lesson,
      status: derivedStatus,
      isUnlocked: derivedStatus !== "locked"
    };
  });
}

export function getNextLessonId(
  scene: SceneDefinition,
  lessonProgress: Record<string, LessonProgress>
): string | null {
  const unlocks = getLessonUnlockState(scene, lessonProgress);
  const candidate = unlocks.find(
    (entry) => entry.status === "available" || entry.status === "in_progress"
  );

  return candidate?.lesson.id ?? null;
}
