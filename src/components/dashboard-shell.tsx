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
    return "未设出发日期";
  }

  if (countdown.kind === "today") {
    return "今天出发";
  }

  if (countdown.kind === "past") {
    return "已过期";
  }

  return `${countdown.daysUntil} 天`;
}

function hasStartedBook(storage: AppStorageState, sceneId: SceneSummary["id"]) {
  return Object.values(storage.reviewItems).some(
    (item) =>
      item.sceneId === sceneId &&
      (item.stepState.currentStep > 0 || Boolean(item.completedAt) || Boolean(item.lastStudiedAt))
  );
}

interface HomeScreenProps {
  headline: string;
  spotlightCount: number;
  countdownLabel: string;
  stat1Label: string;
  stat1Value: string | number;
  stat2Label: string;
  stat2Value: string | number;
  stat3Label: string;
  stat3Value: string | number;
}

function HomeScreen({
  headline,
  spotlightCount,
  countdownLabel,
  stat1Label,
  stat1Value,
  stat2Label,
  stat2Value,
  stat3Label,
  stat3Value
}: HomeScreenProps) {
  return (
    <div className="gameboy-screen">
      <div className="hero-title">
        <span className="display" style={{ fontSize: "1.08rem" }}>
          NIHONGO.GO
        </span>
      </div>

      <div className="gameboy-book-row">
        <div className="gameboy-book-meta">
          <span className="gameboy-book-label">{headline}</span>
          {spotlightCount > 0 ? <span className="badge danger">回炉 {spotlightCount}</span> : null}
        </div>
        <PixelButton href="/settings" variant="ghost" className="gameboy-countdown">
          {countdownLabel}
        </PixelButton>
      </div>

      <div className="gameboy-hud">
        <div className="gameboy-stat">
          <span className="gameboy-stat-label">{stat1Label}</span>
          <strong className="gameboy-stat-value">{stat1Value}</strong>
        </div>
        <div className="gameboy-stat">
          <span className="gameboy-stat-label">{stat2Label}</span>
          <strong className="gameboy-stat-value">{stat2Value}</strong>
        </div>
        <div className="gameboy-stat">
          <span className="gameboy-stat-label">{stat3Label}</span>
          <strong className="gameboy-stat-value compact">{stat3Value}</strong>
        </div>
      </div>
    </div>
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
        <HomeScreen
          headline="全部通关"
          spotlightCount={spotlightCount}
          countdownLabel={countdownLabel}
          stat1Label="场景"
          stat1Value={`${completion.completedSceneCount}/${completion.totalSceneCount}`}
          stat2Label="句本"
          stat2Value={`${completion.completedBookCount}/${completion.totalBookCount}`}
          stat3Label="已学"
          stat3Value={`${masteredSentenceCount}/${totalReviewItems}`}
        />

        <div className="gameboy-controls">
          <PixelButton href={primaryAction.href} style={{ width: "100%", minHeight: 56, fontSize: "1rem" }}>
            {primaryAction.label}
          </PixelButton>
          <div className="gameboy-action-row">
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
      <HomeScreen
        headline={currentBookLabel}
        spotlightCount={spotlightCount}
        countdownLabel={countdownLabel}
        stat1Label="待复习"
        stat1Value={dueReviewCount}
        stat2Label="今日新句"
        stat2Value={newSentenceCount}
        stat3Label="已学"
        stat3Value={`${masteredSentenceCount}/${totalReviewItems}`}
      />

      <div className="gameboy-controls">
        <PixelButton href={currentBookHref} style={{ width: "100%", minHeight: 56, fontSize: "1rem" }}>
          {currentBookStarted ? "继续" : "开始"}
        </PixelButton>
        <div className="gameboy-action-row">
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
