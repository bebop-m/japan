"use client";

import { useMemo } from "react";

import { BootSequence } from "@/components/boot-sequence";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import { getCurrentBookSceneId } from "@/lib/books";
import { resolveCurriculumCompletion, resolveDepartureCountdown } from "@/lib/dashboard/home";
import {
  getDueReviewItems,
  getMasteredSentenceCount,
  getNextAvailableLesson,
  getPhraseReviewItemCount,
  getSpotlightReviewItems
} from "@/lib/review/srs";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";
import type { SceneSummary } from "@/lib/types/content";

interface DashboardShellProps {
  scenes: SceneSummary[];
}

function getCountdownBadge(countdown: ReturnType<typeof resolveDepartureCountdown>) {
  if (countdown.kind === "today") {
    return "TODAY";
  }

  if (countdown.kind === "past") {
    return "PAST";
  }

  if (countdown.daysUntil === null) {
    return "DATE ?";
  }

  return `D-${countdown.daysUntil}`;
}

export function DashboardShell({ scenes }: DashboardShellProps) {
  const storage = useMemo(() => readStorageState(), []);
  const totalReviewItems = getPhraseReviewItemCount(storage);
  const dueReviewCount = getDueReviewItems(storage).length;
  const spotlightCount = getSpotlightReviewItems(storage).length;
  const masteredSentenceCount = getMasteredSentenceCount(storage);
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;
  const nextLesson = getNextAvailableLesson(storage);
  const currentSceneId = nextLesson?.sceneId ?? getCurrentBookSceneId(storage, scenes);
  const currentScene = scenes.find((scene) => scene.id === currentSceneId) ?? scenes[0];
  const completion = resolveCurriculumCompletion({
    bookProgressByScene: storage.bookProgressByScene,
    scenes
  });
  const countdown = resolveDepartureCountdown({
    departureDateISO: storage.userSettings.departureDateISO,
    totalReviewItems,
    masteredSentenceCount,
    departureReadyCount
  });

  const title = "NIHONGO.GO";
  let subtitle = "单主任务驱动";
  let dialogLines = [
    "首页先只保留一个最该按的大按钮，其余功能全部收进下方菜单。",
    "这一版只验证视觉和入口逻辑，不急着把复杂内容塞满。"
  ];
  let primaryAction = {
    href: "/practice",
    label: "开始自由练习"
  };

  if (countdown.kind === "today") {
    subtitle = "今天先做出发冲刺";
    dialogLines = [
      countdown.description,
      "出发当天会优先把首页主任务切到冲刺模式，避免你再做无关动作。"
    ];
    primaryAction = {
      href: "/departure",
      label: "进入出发冲刺"
    };
  } else if (dueReviewCount > 0) {
    subtitle = "今天先清空复习队列";
    dialogLines = [
      `现在有 ${dueReviewCount} 句到期内容，优先做这件事最顺。`,
      spotlightCount > 0
        ? `其中 ${spotlightCount} 句属于重点回炉句，下一轮可以单独做成小游戏入口。`
        : "这里先把主任务和小菜单的层级关系跑通。"
    ];
    primaryAction = {
      href: "/review",
      label: "进入今日复习"
    };
  } else if (nextLesson && currentScene) {
    subtitle = `继续 ${currentScene.label} / ${nextLesson.lessonId}`;
    dialogLines = [
      `当前最自然的路径是回到 ${currentScene.label}，继续下一课。`,
      "场景页现在先做成关卡入口，不在这一轮塞进复杂的词本配置。"
    ];
    primaryAction = {
      href: `/scene/${nextLesson.sceneId}`,
      label: "打开场景入口"
    };
  } else if (departureReadyCount > 0) {
    subtitle = "切到出发前冲刺";
    dialogLines = [
      `你已经准备好了 ${departureReadyCount} 句可带走的句子。`,
      "如果这套首页模板成立，下一轮就能接旅行手册和日记页。"
    ];
    primaryAction = {
      href: "/departure",
      label: "进入出发模式"
    };
  }

  return (
    <div className="page-stack">
      <BootSequence />
      <ModeLaunchPanel
        modeLabel="MAIN MENU"
        badge={getCountdownBadge(countdown)}
        art={currentScene?.id ?? "home"}
        title={title}
        subtitle={subtitle}
        dialogTitle="TODAY MISSION"
        dialogLines={dialogLines}
        stats={[
          { label: "待复习", value: `${dueReviewCount}` },
          { label: "已入复习", value: `${masteredSentenceCount}` },
          {
            label: "场景完成",
            value: `${completion.completedSceneCount}/${completion.totalSceneCount}`
          }
        ]}
        primaryAction={primaryAction}
        secondaryActions={[
          {
            href: currentScene ? `/scene/${currentScene.id}` : "/practice",
            label: currentScene ? `打开 ${currentScene.label}` : "进入练习",
            variant: "secondary"
          },
          {
            href: "/settings",
            label: "系统设置",
            variant: "ghost"
          }
        ]}
        menuItems={[
          {
            href: currentScene ? `/scene/${currentScene.id}` : "/practice",
            label: "场景入口",
            value: currentScene?.label ?? "OPEN",
            variant: "secondary"
          },
          {
            href: "/review",
            label: "今日复习",
            value: dueReviewCount > 0 ? `${dueReviewCount}` : "--",
            variant: dueReviewCount > 0 ? "secondary" : "ghost"
          },
          {
            href: "/departure",
            label: "出发冲刺",
            value: departureReadyCount > 0 ? `${departureReadyCount}` : "--",
            variant: departureReadyCount > 0 ? "secondary" : "ghost"
          },
          {
            href: "/practice",
            label: "练习模式",
            value: spotlightCount > 0 ? `HOT ${spotlightCount}` : "PLAY",
            variant: spotlightCount > 0 ? "secondary" : "ghost"
          }
        ]}
        footerNote="现在先看首页模板值不值得继续。复杂课程内容和小游戏玩法可以留到下一轮。"
      />
    </div>
  );
}
