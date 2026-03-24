"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getLessonUnlockState } from "@/lib/lessons/unlock";
import { readStorageState } from "@/lib/storage/local";
import type { SceneDefinition } from "@/lib/types/content";

export function LessonList({ scene }: { scene: SceneDefinition }) {
  const storage = useMemo(() => readStorageState(), []);
  const lessons = getLessonUnlockState(scene, storage.lessonProgress);

  return (
    <div className="pixel-card">
      <div className="lesson-compact-list">
      {lessons.map(({ lesson, status, isUnlocked }) => (
        <Link
          key={lesson.id}
          href={isUnlocked ? `/scene/${scene.id}/lesson/${lesson.id}` : "#"}
          className={`lesson-compact-row ${status}`.trim()}
          aria-disabled={!isUnlocked}
        >
          <span className="lesson-dot" />
          <span className="lesson-compact-title">{lesson.title}</span>
          {status === "completed" ? <span className="lesson-compact-check">✓</span> : null}
        </Link>
      ))}
      </div>
    </div>
  );
}
