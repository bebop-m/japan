"use client";

import { useMemo } from "react";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import { getSceneBookAvailableCount, getSceneSentenceProgress } from "@/lib/books";
import { getLessonUnlockState } from "@/lib/lessons/unlock";
import { getDueReviewItems } from "@/lib/review/srs";
import { readStorageState } from "@/lib/storage/local";
import type { SceneDefinition } from "@/lib/types/content";

interface SceneGatewayPanelProps {
  scene: SceneDefinition;
}

export function SceneGatewayPanel({ scene }: SceneGatewayPanelProps) {
  const storage = useMemo(() => readStorageState(), []);
  const unlocks = getLessonUnlockState(scene, storage.lessonProgress);
  const nextLesson =
    unlocks.find((entry) => entry.status === "in_progress" || entry.status === "available") ?? null;
  const completedCount = unlocks.filter((entry) => entry.status === "completed").length;
  const dueCount = getDueReviewItems(storage).filter((item) => item.sceneId === scene.id).length;
  const sentenceAvailableCount = getSceneBookAvailableCount(scene, storage, "sentence");
  const progress = getSceneSentenceProgress(scene, storage);

  return (
    <ModeLaunchPanel
      modeLabel={`${scene.code} GATE`}
      badge={nextLesson ? nextLesson.lesson.code : "CLEAR"}
      art={scene.id}
      title={scene.label}
      subtitle={nextLesson ? nextLesson.lesson.title : "场景主线已打通"}
      dialogTitle="SCENE BRIEF"
      dialogLines={[
        scene.description,
        nextLesson
          ? `建议先从 ${nextLesson.lesson.code} 进入，入口先收敛成单一主动作。`
          : "这个场景的后续入口可以继续保留速刷和词本，但默认先把主线突出。"
      ]}
      stats={[
        { label: "课程", value: `${completedCount}/${scene.lessons.length}` },
        { label: "待复习", value: `${dueCount}` },
        { label: "可学句", value: `${Math.max(sentenceAvailableCount, 0)}` }
      ]}
      primaryAction={{
        href: nextLesson
          ? `/scene/${scene.id}/lesson/${nextLesson.lesson.id}`
          : `/scene/${scene.id}/study?type=sentence&count=5`,
        label: nextLesson ? `继续 ${nextLesson.lesson.code}` : "开始速刷词本"
      }}
      secondaryActions={[
        {
          href: `/scene/${scene.id}/study?type=sentence&count=5`,
          label: "打开场景词本",
          variant: "secondary"
        },
        {
          href: "/",
          label: "返回主菜单",
          variant: "ghost"
        }
      ]}
      menuItems={unlocks.slice(0, 4).map((entry) => ({
        href: entry.isUnlocked ? `/scene/${scene.id}/lesson/${entry.lesson.id}` : `/scene/${scene.id}`,
        label: entry.lesson.code,
        value: entry.isUnlocked ? entry.lesson.title : "LOCK",
        variant:
          entry.status === "completed"
            ? "secondary"
            : entry.isUnlocked
              ? "primary"
              : "ghost"
      }))}
      footerNote={`当前进度 ${progress.current}/${progress.total}。这页先展示入口模板，复杂的词本配置先降到下一层。`}
    />
  );
}
