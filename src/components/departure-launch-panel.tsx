"use client";

import { useMemo } from "react";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import { resolveDepartureCountdown } from "@/lib/dashboard/home";
import { getMasteredSentenceCount, getPhraseReviewItemCount, getSpotlightReviewItems } from "@/lib/review/srs";
import { getDepartureReadyReviewItems, getFavoritedReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";

function getCountdownBadge(kind: ReturnType<typeof resolveDepartureCountdown>["kind"], days: number | null) {
  if (kind === "today") {
    return "TODAY";
  }

  if (kind === "past") {
    return "PAST";
  }

  if (days === null) {
    return "DATE ?";
  }

  return `D-${days}`;
}

export function DepartureLaunchPanel() {
  const storage = useMemo(() => readStorageState(), []);
  const totalCount = getPhraseReviewItemCount(storage);
  const masteredCount = getMasteredSentenceCount(storage);
  const readyCount = getDepartureReadyReviewItems(storage).length;
  const favoriteCount = getFavoritedReviewItems(storage).filter((item) =>
    Boolean(item.stepState.verifyCompletedAt)
  ).length;
  const spotlightCount = getSpotlightReviewItems(storage).length;
  const countdown = resolveDepartureCountdown({
    departureDateISO: storage.userSettings.departureDateISO,
    totalReviewItems: totalCount,
    masteredSentenceCount: masteredCount,
    departureReadyCount: readyCount
  });

  return (
    <ModeLaunchPanel
      modeLabel="TRIP MODE"
      badge={getCountdownBadge(countdown.kind, countdown.daysUntil)}
      art="departure"
      title="DEPARTURE"
      subtitle={readyCount > 0 ? "出发前只刷关键句" : "先把要带走的句子收起来"}
      dialogTitle="MODE BRIEF"
      dialogLines={[
        countdown.title,
        readyCount > 0
          ? `当前已有 ${readyCount} 句可以直接拿来冲刺，收藏句和高错句会优先出现。`
          : "现在还没有可冲刺的句子，这页先展示模板，后续再扩成旅行日记和手册。"
      ]}
      stats={[
        { label: "可冲刺", value: `${readyCount}` },
        { label: "已收藏", value: `${favoriteCount}` },
        { label: "高错句", value: `${spotlightCount}` }
      ]}
      primaryAction={{
        href: readyCount > 0 ? "/departure?play=1" : "/review",
        label: readyCount > 0 ? "进入出发冲刺" : "先去整理句子"
      }}
      secondaryActions={[
        {
          href: "/settings",
          label: "设置出发日",
          variant: "secondary"
        },
        {
          href: "/",
          label: "返回主菜单",
          variant: "ghost"
        }
      ]}
      menuItems={[
        {
          href: "/departure?play=1",
          label: "旅行手册",
          value: readyCount > 0 ? `${readyCount}` : "--",
          variant: readyCount > 0 ? "secondary" : "ghost"
        },
        {
          href: "/review?play=1&focus=1",
          label: "高错回炉",
          value: spotlightCount > 0 ? `${spotlightCount}` : "--",
          variant: spotlightCount > 0 ? "secondary" : "ghost"
        },
        {
          href: "/settings",
          label: "倒计时",
          value: countdown.daysUntil === null ? "--" : `${countdown.daysUntil}`,
          variant: "ghost"
        }
      ]}
      footerNote="这页现在先验证“出发行前冲刺模式”的角色是否成立，旅行日记和拖拽手册可以放下一轮。"
    />
  );
}
