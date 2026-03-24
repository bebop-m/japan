"use client";

import { useMemo } from "react";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import { getDueReviewItems, getMasteredSentenceCount, getPhraseReviewItemCount } from "@/lib/review/srs";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";

export function SettingsLaunchPanel() {
  const storage = useMemo(() => readStorageState(), []);
  const totalCount = getPhraseReviewItemCount(storage);
  const reviewCount = getMasteredSentenceCount(storage);
  const dueCount = getDueReviewItems(storage).length;
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;

  return (
    <ModeLaunchPanel
      modeLabel="SYSTEM MENU"
      badge="SAVE DATA"
      art="settings"
      title="SETTINGS"
      subtitle="系统与备份"
      dialogTitle="MODE BRIEF"
      dialogLines={[
        "这里先做成系统入口页，把备份、日期、诊断工具统一收口。",
        "如果模板方向成立，下一轮再加主题切换、音量和更多系统选项。"
      ]}
      stats={[
        { label: "总句数", value: `${totalCount}` },
        { label: "已入复习", value: `${reviewCount}` },
        { label: "可冲刺", value: `${departureReadyCount}` }
      ]}
      primaryAction={{
        href: "/settings?manage=1",
        label: "打开系统设置"
      }}
      secondaryActions={[
        {
          href: "/speech-lab",
          label: "发音实验室",
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
          href: "/settings?manage=1",
          label: "备份数据",
          value: "JSON",
          variant: "secondary"
        },
        {
          href: "/settings?manage=1",
          label: "出发日期",
          value: storage.userSettings.departureDateISO ?? "--",
          variant: "ghost"
        },
        {
          href: "/review",
          label: "待复习",
          value: `${dueCount}`,
          variant: dueCount > 0 ? "secondary" : "ghost"
        }
      ]}
      footerNote="设置页现在的任务也是验证入口框架，不急着把所有表单直接堆在第一层。"
    />
  );
}
