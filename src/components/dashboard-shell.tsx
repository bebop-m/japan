"use client";

import { useMemo } from "react";
import { PixelButton } from "@/components/pixel-button";
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
      <div className="gameboy-layout">
        <div className="gameboy-screen">
          <div className="hero-title">
            <span className="display">NIHONGO.GO</span>
          </div>

          <div className="meta-row" style={{ alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem" }}>全部通关</span>
            {spotlightCount > 0 ? (
              <span className="badge danger">回炉 {spotlightCount}</span>
            ) : null}
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

          <div>
            <PixelButton href="/settings" variant="ghost">
              {countdownLabel}
            </PixelButton>
          </div>
        </div>

        <div className="gameboy-controls">
          <PixelButton href={primaryAction.href} style={{ width: "100%" }}>
            {primaryAction.label}
          </PixelButton>
          <div className="split-actions">
            {actionButtons.map((action) => (
              <PixelButton key={action.href} href={action.href} variant={action.variant}>
                {action.label}
              </PixelButton>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gameboy-layout">
      <div className="gameboy-screen">
        <div className="hero-title">
          <span className="display">NIHONGO.GO</span>
        </div>

        <div className="meta-row" style={{ alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem" }}>
            {currentBookLabel}
          </span>
          {spotlightCount > 0 ? (
            <span className="badge danger">回炉 {spotlightCount}</span>
          ) : null}
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

        <div>
          <PixelButton href="/settings" variant="ghost">
            {countdownLabel}
          </PixelButton>
        </div>
      </div>

      <div className="gameboy-controls">
        <PixelButton href={currentBookHref} style={{ width: "100%" }}>
          {currentBookStarted ? "继续" : "开始"}
        </PixelButton>
        <div className="split-actions">
          {actionButtons.map((action) => (
            <PixelButton key={action.href} href={action.href} variant={action.variant}>
              {action.label}
            </PixelButton>
          ))}
        </div>
      </div>
    </div>
  );
}
