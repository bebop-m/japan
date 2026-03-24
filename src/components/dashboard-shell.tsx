"use client";

import { useMemo } from "react";

import { PixelButton } from "@/components/pixel-button";
import { getScene } from "@/lib/content";
import { getCurrentBookSceneId, getSceneBookAvailableCount } from "@/lib/books";
import {
  resolveCurriculumCompletion,
  resolveDepartureCountdown
} from "@/lib/dashboard/home";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";
import { getDueReviewItems, getMasteredSentenceCount, getPhraseReviewItemCount, getSpotlightReviewItems } from "@/lib/review/srs";
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

function getCountdownLabel(countdown: ReturnType<typeof resolveDepartureCountdown>): string {
  if (countdown.kind === "unset") {
    return "未设出发日期";
  }

  if (countdown.kind === "today") {
    return "今天出发";
  }

  if (countdown.kind === "past") {
    return "已过期";
  }

  return `${countdown.daysUntil ?? "--"} 天`;
}

function hasStartedBook(storage: AppStorageState, sceneId: SceneSummary["id"]): boolean {
  return Object.values(storage.reviewItems).some((item) => {
    if (item.sceneId !== sceneId || item.contentType !== "phrase") {
      return false;
    }

    return Boolean(item.lastStudiedAt || item.stepState.currentStep > 0 || item.completedAt);
  });
}

function getFilledHearts(current: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(3, Math.max(0, Math.ceil((current / total) * 3)));
}

interface TitleMenuItem {
  href: string;
  label: string;
  value: string;
  variant?: "primary" | "secondary" | "ghost";
}

interface PanelState {
  kicker: string;
  title: string;
  label: string;
  href: string;
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
  const currentBookScene = getScene(currentBookSceneId);
  const currentBookLabel = sceneNameMap[currentBookSceneId];
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
  const heartsFilled = completion.isCurriculumComplete
    ? 3
    : getFilledHearts(masteredSentenceCount, Math.max(totalReviewItems, 1));

  let panel: PanelState;

  if (completion.isCurriculumComplete) {
    if (dueReviewCount > 0) {
      panel = {
        kicker: "CLEAR",
        title: "通关后清复习",
        label: "继续复习",
        href: "/review"
      };
    } else if (departureReadyCount > 0) {
      panel = {
        kicker: "CLEAR",
        title: "全句本已通关",
        label: "出发冲刺",
        href: "/departure"
      };
    } else {
      panel = {
        kicker: "CLEAR",
        title: "全句本已通关",
        label: "自由练习",
        href: "/practice"
      };
    }
  } else if (countdown.kind === "today") {
    panel = {
      kicker: "TODAY",
      title: "开始出发冲刺",
      label: "立刻开始",
      href: "/departure"
    };
  } else if (dueReviewCount > 0) {
    panel = {
      kicker: "TODAY",
      title: "开始今日复习",
      label: "立即开始",
      href: "/review"
    };
  } else {
    panel = {
      kicker: "BOOK",
      title: `${currentBookStarted ? "继续" : "开始"}${currentBookLabel}句本`,
      label: currentBookStarted ? "继续学习" : "开始学习",
      href: currentBookHref
    };
  }

  const menuCandidates: TitleMenuItem[] = [
    ...(completion.isCurriculumComplete
      ? []
      : [
          {
            href: currentBookHref,
            label: "旅行句本",
            value: currentBookLabel,
            variant: "secondary" as const
          }
        ]),
    {
      href: "/review",
      label: "今日复习",
      value: `${dueReviewCount}`,
      variant: dueReviewCount > 0 ? "secondary" : "ghost"
    },
    ...(spotlightCount > 0
      ? [
          {
            href: "/review?focus=1",
            label: "重点回炉",
            value: `${spotlightCount}`,
            variant: "secondary" as const
          }
        ]
      : []),
    {
      href: "/departure",
      label: "出发冲刺",
      value: departureReadyCount > 0 ? `${departureReadyCount}` : "--",
      variant: departureReadyCount > 0 ? "secondary" : "ghost"
    },
    {
      href: "/practice",
      label: "速度练习",
      value: "PLAY",
      variant: "ghost"
    }
  ];

  const menuItems = menuCandidates.filter((item) => item.href !== panel.href).slice(0, 3);
  const screenVariant = completion.isCurriculumComplete ? "clear" : currentBookSceneId;
  const footerStats = completion.isCurriculumComplete
    ? [
        { label: "场景", value: `${completion.completedSceneCount}` },
        { label: "句本", value: `${completion.completedBookCount}` },
        { label: "已学", value: `${masteredSentenceCount}` }
      ]
    : [
        { label: "待复习", value: `${dueReviewCount}` },
        { label: "新句", value: `${newSentenceCount}` },
        { label: "已学", value: `${masteredSentenceCount}` }
      ];

  return (
    <div className="titleboy-home">
      <div className={`titleboy-screen-shell titleboy-screen-shell--${screenVariant}`}>
        <div className="titleboy-screen-top">
          <div className="titleboy-logo">NIHONGO.GO</div>
          <PixelButton href="/settings" variant="ghost" className="titleboy-settings">
            {countdownLabel}
          </PixelButton>
        </div>

        <div className={`titleboy-scene titleboy-scene--${screenVariant}`}>
          <span className="titleboy-cloud titleboy-cloud--1" />
          <span className="titleboy-cloud titleboy-cloud--2" />
          <span className="titleboy-hill titleboy-hill--back" />
          <span className="titleboy-hill titleboy-hill--front" />
          <span className="titleboy-object titleboy-object--main" />
          <span className="titleboy-object titleboy-object--alt" />
          <span className="titleboy-mascot" />
          <span className="titleboy-scene-caption">
            {completion.isCurriculumComplete ? "CLEAR MODE" : `${currentBookLabel}句本`}
          </span>
        </div>

        <div className="titleboy-primary-panel">
          <div className="titleboy-primary-kicker">{panel.kicker}</div>
          <div className="titleboy-primary-title">{panel.title}</div>
          <PixelButton href={panel.href} className="titleboy-primary-button">
            {panel.label}
          </PixelButton>
        </div>

        <div className="titleboy-menu-list">
          {menuItems.map((item) => (
            <PixelButton
              key={`${item.href}-${item.label}`}
              href={item.href}
              variant={item.variant ?? "ghost"}
              className="titleboy-menu-item"
            >
              <span className="titleboy-menu-left">▶ {item.label}</span>
              <span className="titleboy-menu-right">{item.value}</span>
            </PixelButton>
          ))}
        </div>
      </div>

      <div className="titleboy-footer">
        <div className="titleboy-footer-row">
          <span className="titleboy-footer-title">
            {completion.isCurriculumComplete ? "全句本通关" : `${currentBookLabel}句本`}
          </span>
          <div className="titleboy-heart-row">
            {Array.from({ length: 3 }).map((_, index) => (
              <span
                key={index}
                className={`titleboy-heart ${index < heartsFilled ? "filled" : ""}`.trim()}
              >
                ♥
              </span>
            ))}
          </div>
        </div>

        <div className="titleboy-footer-stats">
          {footerStats.map((stat) => (
            <div key={stat.label} className="titleboy-footer-stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
