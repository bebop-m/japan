"use client";

import { useMemo } from "react";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import {
  getDueReviewItems,
  getMasteredSentenceCount,
  getSpotlightReviewItems
} from "@/lib/review/srs";
import { readStorageState } from "@/lib/storage/local";

export function ReviewLaunchPanel() {
  const storage = useMemo(() => readStorageState(), []);
  const dueCount = getDueReviewItems(storage).length;
  const spotlightCount = getSpotlightReviewItems(storage).length;
  const masteredCount = getMasteredSentenceCount(storage);
  const hasDue = dueCount > 0;
  const hasSpotlight = spotlightCount > 0;

  return (
    <ModeLaunchPanel
      modeLabel="REVIEW HUB"
      badge={hasDue ? `DUE ${dueCount}` : hasSpotlight ? `HOT ${spotlightCount}` : "CLEAR"}
      art="review"
      title="REVIEW"
      subtitle={hasDue ? "今日先清空到期队列" : hasSpotlight ? "先回炉高错句" : "当前没有到期复习"}
      dialogTitle="MODE BRIEF"
      dialogLines={
        hasDue
          ? [
              `现在有 ${dueCount} 句到期内容，先做这一项最符合你的主任务节奏。`,
              hasSpotlight
                ? `其中 ${spotlightCount} 句近期反复出错，做完可以直接切重点回炉。`
                : "这版先保留现有 SRS 内核，只把入口层做成掌机式。"
            ]
          : hasSpotlight
            ? [
                `到期队列已清空，但还有 ${spotlightCount} 句值得集中加固。`,
                "这里先做成模式入口页，确认方向后再把小游戏和动画补进去。"
              ]
            : [
                "当前复习池是空的，你可以先继续课程，再回来测试这套入口模板。",
                "这页现在的目标是验证结构、文案和掌机感。"
              ]
      }
      stats={[
        { label: "待复习", value: `${dueCount}` },
        { label: "重点", value: `${spotlightCount}` },
        { label: "已入复习", value: `${masteredCount}` }
      ]}
      primaryAction={{
        href: hasDue ? "/review?play=1" : hasSpotlight ? "/review?play=1&focus=1" : "/practice",
        label: hasDue ? "进入今日复习" : hasSpotlight ? "进入重点回炉" : "去练习模式"
      }}
      secondaryActions={[
        {
          href: "/",
          label: "返回主菜单",
          variant: "secondary"
        },
        {
          href: hasSpotlight ? "/review?play=1&focus=1" : "/settings",
          label: hasSpotlight ? "只看错题" : "打开设置",
          variant: "ghost"
        }
      ]}
      menuItems={[
        {
          href: "/review?play=1",
          label: "标准队列",
          value: hasDue ? `${dueCount}` : "--",
          variant: hasDue ? "secondary" : "ghost"
        },
        {
          href: "/review?play=1&focus=1",
          label: "重点回炉",
          value: hasSpotlight ? `${spotlightCount}` : "--",
          variant: hasSpotlight ? "secondary" : "ghost"
        },
        {
          href: "/practice",
          label: "速度热身",
          value: "OPEN",
          variant: "ghost"
        }
      ]}
      footerNote="先确认入口结构，再决定要不要把复习改成 4 选 1 / 限时冲刺小游戏。"
    />
  );
}
