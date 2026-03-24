"use client";

import { useMemo } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { getScene } from "@/lib/content";
import {
  getCurrentBookSceneId,
  getSceneBookAvailableCount
} from "@/lib/books";
import {
  resolveCurriculumCompletion,
  resolveDepartureCountdown,
  resolvePrimaryAction
} from "@/lib/dashboard/home";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";
import {
  getDueReviewItems,
  getMasteredSentenceCount,
  getPhraseReviewItemCount,
  getSpotlightReviewItems
} from "@/lib/review/srs";
import type { SceneSummary } from "@/lib/types/content";
import type { AppStorageState } from "@/lib/types/storage";

interface DashboardShellProps {
  scenes: SceneSummary[];
}

const sceneNameMap: Record<SceneSummary["id"], string> = {
  airport: "机场",
  hotel: "酒店",
  izakaya: "居酒屋",
  shopping: "购物"
};

interface DashboardAction {
  href: string;
  label: string;
  variant: "secondary" | "ghost";
}

function getToneBadgeClass(tone: "neutral" | "success" | "danger") {
  if (tone === "success") {
    return "badge success";
  }

  if (tone === "danger") {
    return "badge danger";
  }

  return "badge";
}

function getCountdownLabel(countdown: ReturnType<typeof resolveDepartureCountdown>) {
  if (countdown.kind === "unset") {
    return "出发日期未设置";
  }

  if (countdown.kind === "today") {
    return "今天出发";
  }

  if (countdown.kind === "past") {
    return "出发日期已过";
  }

  return `倒计时 ${countdown.daysUntil} 天`;
}

function hasStartedBook(storage: AppStorageState, sceneId: SceneSummary["id"]) {
  return Object.values(storage.reviewItems).some(
    (item) =>
      item.sceneId === sceneId &&
      (item.stepState.currentStep > 0 || Boolean(item.completedAt) || Boolean(item.lastStudiedAt))
  );
}

export function DashboardShell({ scenes }: DashboardShellProps) {
  const storage = useMemo(() => readStorageState(), []);
  const totalReviewItems = getPhraseReviewItemCount(storage);
  const dueReviewCount = getDueReviewItems(storage).length;
  const masteredSentenceCount = getMasteredSentenceCount(storage);
  const spotlightCount = getSpotlightReviewItems(storage).length;
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;
  const completion = resolveCurriculumCompletion({
    bookProgressByScene: storage.bookProgressByScene,
    scenes
  });
  const currentBookSceneId = getCurrentBookSceneId(storage, scenes);
  const currentBookLabel = sceneNameMap[currentBookSceneId];
  const currentBookScene = getScene(currentBookSceneId);
  const currentBookHref = `/scene/${currentBookSceneId}`;
  const currentBookStarted = hasStartedBook(storage, currentBookSceneId);
  const newSentenceCount = currentBookScene
    ? Math.min(20, getSceneBookAvailableCount(currentBookScene, storage, "sentence"))
    : 0;
  const countdown = resolveDepartureCountdown({
    departureDateISO: storage.userSettings.departureDateISO,
    totalReviewItems,
    masteredSentenceCount,
    departureReadyCount
  });
  const countdownLabel = getCountdownLabel(countdown);
  const countdownBadgeClass = getToneBadgeClass(countdown.tone);
  const primaryAction = resolvePrimaryAction({
    countdown,
    dueReviewCount,
    nextLesson: null,
    departureReadyCount
  });
  const actionButtons: DashboardAction[] = [
    {
      href: "/review",
      label: "复习",
      variant: dueReviewCount > 0 || spotlightCount > 0 ? "secondary" : "ghost"
    },
    {
      href: "/departure",
      label: "出发",
      variant:
        departureReadyCount > 0 || countdown.kind === "urgent" || countdown.kind === "today"
          ? "secondary"
          : "ghost"
    },
    {
      href: "/practice",
      label: "练习",
      variant: "secondary"
    }
  ];

  if (completion.isCurriculumComplete) {
    return (
      <div className="page-stack">
        <PixelCard>
          <div className="hero">
            <div className="hero-title">
              <span className="display">NIHONGO.GO</span>
            </div>
            <div className="summary-box">
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge success">全部通关</span>
                </div>
                <div className="stat-grid">
                  <div className="stat-box">
                    <span className="stat-label">场景</span>
                    <strong className="stat-value">
                      {completion.completedSceneCount} / {completion.totalSceneCount}
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">句本</span>
                    <strong className="stat-value">
                      {completion.completedBookCount} / {completion.totalBookCount}
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">已学</span>
                    <strong className="stat-value">
                      {masteredSentenceCount} / {totalReviewItems}
                    </strong>
                  </div>
                </div>
                <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span className={countdownBadgeClass}>{countdownLabel}</span>
                  <PixelButton href="/settings" variant="ghost">
                    设置
                  </PixelButton>
                </div>
                <PixelButton href={primaryAction.href} style={{ width: "100%" }}>
                  {primaryAction.label}
                </PixelButton>
              </div>
            </div>
            {spotlightCount > 0 ? (
              <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge danger">重点巩固 {spotlightCount}</span>
                <PixelButton href="/review?focus=1" variant="secondary">
                  回炉
                </PixelButton>
              </div>
            ) : null}
            <div className="split-actions">
              {actionButtons.map((action) => (
                <PixelButton key={action.href} href={action.href} variant={action.variant}>
                  {action.label}
                </PixelButton>
              ))}
            </div>
          </div>
        </PixelCard>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PixelCard>
        <div className="hero">
          <div className="hero-title">
            <span className="display">NIHONGO.GO</span>
          </div>
          <div className="summary-box">
            <div className="page-stack" style={{ gap: 12 }}>
              <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge">当前句本：{currentBookLabel}</span>
              </div>
              <div className="stat-grid">
                <div className="stat-box">
                  <span className="stat-label">待复习</span>
                  <strong className="stat-value">{dueReviewCount}</strong>
                </div>
                <div className="stat-box">
                  <span className="stat-label">今日新句</span>
                  <strong className="stat-value">{newSentenceCount}</strong>
                </div>
                <div className="stat-box">
                  <span className="stat-label">已学</span>
                  <strong className="stat-value">
                    {masteredSentenceCount} / {totalReviewItems}
                  </strong>
                </div>
              </div>
              <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className={countdownBadgeClass}>{countdownLabel}</span>
                <PixelButton href="/settings" variant="ghost">
                  设置
                </PixelButton>
              </div>
              <PixelButton href={currentBookHref} style={{ width: "100%" }}>
                {currentBookStarted ? "继续" : "开始"}
              </PixelButton>
            </div>
          </div>
          {spotlightCount > 0 ? (
            <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="badge danger">重点巩固 {spotlightCount}</span>
              <PixelButton href="/review?focus=1" variant="secondary">
                回炉
              </PixelButton>
            </div>
          ) : null}
          <div className="split-actions">
            {actionButtons.map((action) => (
              <PixelButton key={action.href} href={action.href} variant={action.variant}>
                {action.label}
              </PixelButton>
            ))}
          </div>
        </div>
      </PixelCard>
    </div>
  );
}
