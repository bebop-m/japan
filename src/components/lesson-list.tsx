"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getLessonUnlockState } from "@/lib/lessons/unlock";
import { readStorageState } from "@/lib/storage/local";
import type { SceneDefinition } from "@/lib/types/content";

const statusLabel = {
  locked: "未解锁",
  available: "可开始",
  in_progress: "进行中",
  completed: "已完成"
} as const;

export function LessonList({ scene }: { scene: SceneDefinition }) {
  const storage = useMemo(() => readStorageState(), []);
  const lessons = getLessonUnlockState(scene, storage.lessonProgress);

  return (
    <div className="lesson-list">
      {lessons.map(({ lesson, status, isUnlocked }) => (
        <article key={lesson.id} className="pixel-card lesson-card">
          <div className="meta-row">
            <span className={`lesson-status ${status}`}>{statusLabel[status]}</span>
            <span className="badge">{lesson.code}</span>
            <span className="badge">{lesson.cards.length} 句型卡</span>
          </div>
          <div className="page-stack" style={{ gap: 10 }}>
            <h3>{lesson.title}</h3>
            <p className="muted">{lesson.overview}</p>
          </div>
          <div className="split-actions">
            <Link
              href={isUnlocked ? `/scene/${scene.id}/lesson/${lesson.id}` : "#"}
              className={`pixel-button ${isUnlocked ? "" : "ghost"}`.trim()}
              aria-disabled={!isUnlocked}
            >
              进入课程
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
