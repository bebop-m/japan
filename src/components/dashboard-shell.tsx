"use client";

import { useMemo } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
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
  getNewSentenceCount,
  getNextAvailableLesson,
  getPhraseReviewItemCount,
  getSpotlightReviewItems,
  getStudiedSentenceCount
} from "@/lib/review/srs";
import type { SceneSummary } from "@/lib/types/content";

interface DashboardShellProps {
  scenes: SceneSummary[];
  lessonTitleMap: Record<string, string>;
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

export function DashboardShell({ scenes, lessonTitleMap }: DashboardShellProps) {
  const storage = useMemo(() => readStorageState(), []);
  const totalReviewItems = getPhraseReviewItemCount(storage);
  const dueReviewCount = getDueReviewItems(storage).length;
  const newSentenceCount = getNewSentenceCount(storage);
  const masteredSentenceCount = getMasteredSentenceCount(storage);
  const spotlightCount = getSpotlightReviewItems(storage).length;
  const studiedSentenceCount = getStudiedSentenceCount(storage);
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;
  const nextLesson = getNextAvailableLesson(storage);
  const completion = resolveCurriculumCompletion({
    lessonProgress: storage.lessonProgress,
    scenes
  });
  const nextLessonInfo = nextLesson
    ? {
        ...nextLesson,
        title: lessonTitleMap[nextLesson.lessonId] ?? nextLesson.lessonId,
        href: `/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`,
        sceneLabel: sceneNameMap[nextLesson.sceneId]
      }
    : null;
  const continueLabel = nextLessonInfo
    ? `${nextLessonInfo.sceneLabel} / ${nextLessonInfo.title}`
    : "主线课程已清空";
  const progressBlocks = Math.min(
    10,
    Math.floor((masteredSentenceCount / Math.max(totalReviewItems, 1)) * 10)
  );
  const sceneCompletionRows = scenes.map((scene) => {
    const completedLessons = Object.values(storage.lessonProgress).filter(
      (lesson) => lesson.sceneId === scene.id && lesson.status === "completed"
    ).length;

    return {
      ...scene,
      completedLessons
    };
  });
  const countdown = resolveDepartureCountdown({
    departureDateISO: storage.userSettings.departureDateISO,
    totalReviewItems,
    masteredSentenceCount,
    departureReadyCount
  });
  const primaryAction = resolvePrimaryAction({
    countdown,
    dueReviewCount,
    nextLesson: nextLessonInfo,
    departureReadyCount
  });
  const secondaryActions = [
    primaryAction.key !== "review"
      ? {
          href: "/review",
          label: "复习队列",
          variant: "secondary" as const
        }
      : null,
    primaryAction.key !== "lesson" && nextLessonInfo
      ? {
          href: nextLessonInfo.href,
          label: `继续：${nextLessonInfo.title}`,
          variant: "secondary" as const
        }
      : null,
    primaryAction.key !== "departure"
      ? {
          href: "/departure",
          label: "出发模式",
          variant:
            departureReadyCount > 0 || countdown.kind === "urgent" || countdown.kind === "today"
              ? ("secondary" as const)
              : ("ghost" as const)
        }
      : null,
    primaryAction.key !== "practice"
      ? {
          href: "/practice",
          label: "练习模式",
          variant: "secondary" as const
        }
      : null
  ].filter((action): action is DashboardAction => Boolean(action));
  const countdownBadgeClass = getToneBadgeClass(countdown.tone);
  const graduationActions = [
    ...secondaryActions,
    {
      href: "/settings",
      label: "设置与备份",
      variant: "ghost" as const
    }
  ];

  if (completion.isCurriculumComplete) {
    return (
      <div className="page-stack">
        <PixelCard>
          <div className="hero">
            <div className="hero-title">
              <span className="display">NIHONGO.GO</span>
              <span className="badge success">全课程通关</span>
            </div>
            <div>
              <h2 className="section-title">四个场景已经全部打通</h2>
              <p className="muted" style={{ margin: 0 }}>
                五步学习和每日检验都已完成，主线课程正式毕业。接下来重点放在复习巩固、出发冲刺和高错句回炉。
              </p>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="stat-label">已完成场景</span>
                <strong className="stat-value">
                  {completion.completedSceneCount} / {completion.totalSceneCount}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">已完成课程</span>
                <strong className="stat-value">
                  {completion.completedLessonCount} / {completion.totalLessonCount}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">已入复习</span>
                <strong className="stat-value">
                  {masteredSentenceCount} / {totalReviewItems}
                </strong>
              </div>
            </div>
            <div className="summary-box">
              <div className="page-stack" style={{ gap: 12 }}>
                <div
                  className="meta-row"
                  style={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <span className="badge success">毕业后下一步</span>
                  <span className={countdownBadgeClass}>{countdown.title}</span>
                </div>
                <div>
                  <h2 className="section-title">{primaryAction.title}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {primaryAction.description}
                  </p>
                </div>
                {countdown.daysUntil !== null ? (
                  <span className="badge">
                    {countdown.daysUntil === 0 ? "今天出发" : `倒计时：${countdown.daysUntil} 天`}
                  </span>
                ) : null}
                <PixelButton href={primaryAction.href} style={{ width: "100%" }}>
                  {primaryAction.label}
                </PixelButton>
              </div>
            </div>
            {spotlightCount > 0 ? (
              <div className="summary-box">
                <div className="page-stack" style={{ gap: 12 }}>
                  <div
                    className="meta-row"
                    style={{ justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span className="badge danger">重点巩固</span>
                    <span className="badge">{spotlightCount} 句待回炉</span>
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    这些句子最近反复出错，已经在普通复习队列中前置，也可以直接进入专项复习。
                  </p>
                  <PixelButton href="/review?focus=1" variant="secondary" style={{ width: "100%" }}>
                    专项复习
                  </PixelButton>
                </div>
              </div>
            ) : null}
            {departureReadyCount > 0 || dueReviewCount > 0 ? (
              <div className="meta-row">
                {departureReadyCount > 0 ? (
                  <span className="badge">出发储备：{departureReadyCount}</span>
                ) : null}
                {dueReviewCount > 0 ? (
                  <span className="badge">今日复习：{dueReviewCount}</span>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                你已经完成主线课程。接下来可以在课程或复习里继续收藏句子，逐步建立出发储备。
              </p>
            )}
            <div className="page-stack" style={{ gap: 12 }}>
              <div>
                <h2 className="section-title">通关地图</h2>
                <p className="muted" style={{ margin: 0 }}>
                  四个场景都已完成，现在可以按需要回看、复习和冲刺。
                </p>
              </div>
              <div className="scene-grid">
                {sceneCompletionRows.map((scene) => (
                  <div key={scene.id} className="summary-box">
                    <div
                      className="meta-row"
                      style={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span className="badge success">已完成</span>
                      <span className="badge">
                        {scene.completedLessons} / {scene.lessonCount} 课
                      </span>
                    </div>
                    <h3 style={{ margin: "0 0 8px" }}>
                      {scene.icon} {sceneNameMap[scene.id]}
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {scene.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="split-actions">
              {graduationActions.map((action) => (
                <PixelButton
                  key={action.href}
                  href={action.href}
                  variant={action.variant}
                  style={{ width: "100%" }}
                >
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
            <span className="badge success">今日主任务</span>
          </div>
          <div className="summary-box">
            <div className="page-stack" style={{ gap: 12 }}>
              <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge success">{primaryAction.badge}</span>
                {primaryAction.key === "lesson" && nextLessonInfo ? (
                  <span className="badge">{`${nextLessonInfo.sceneLabel} / ${nextLessonInfo.title}`}</span>
                ) : null}
              </div>
              <div>
                <h2 className="section-title">{primaryAction.title}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {primaryAction.description}
                </p>
              </div>
              <PixelButton href={primaryAction.href} style={{ width: "100%" }}>
                {primaryAction.label}
              </PixelButton>
            </div>
          </div>
          <div className="summary-box">
            <div className="page-stack" style={{ gap: 12 }}>
              <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className={countdownBadgeClass}>
                  {countdown.title}
                </span>
                <PixelButton href="/settings" variant="ghost">
                  设置与备份
                </PixelButton>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {countdown.description}
              </p>
              {countdown.daysUntil !== null ? (
                <span className="badge">
                  {countdown.daysUntil === 0 ? "今天出发" : `倒计时：${countdown.daysUntil} 天`}
                </span>
              ) : null}
            </div>
          </div>
          {spotlightCount > 0 ? (
            <div className="summary-box">
              <div className="page-stack" style={{ gap: 12 }}>
                <div className="meta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge danger">重点巩固</span>
                  <span className="badge">{spotlightCount} 句待回炉</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  这些句子最近反复出错，已经在普通复习队列中前置，也可以直接进入专项复习。
                </p>
                <PixelButton href="/review?focus=1" variant="secondary" style={{ width: "100%" }}>
                  专项复习
                </PixelButton>
              </div>
            </div>
          ) : null}
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">今日复习</span>
              <strong className="stat-value">{dueReviewCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">今日新句</span>
              <strong className="stat-value">{newSentenceCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">已入复习</span>
              <strong className="stat-value">
                {masteredSentenceCount} / {totalReviewItems}
              </strong>
            </div>
          </div>
          <div className="meta-row">
            <span className="badge">继续：{continueLabel}</span>
            <span className="badge">待复习：{studiedSentenceCount}</span>
          </div>
          <div className="meta-row" style={{ alignItems: "center", gap: 10 }}>
            <span className="badge">学习进度</span>
            <ProgressBlocks current={progressBlocks} total={10} />
          </div>
          {departureReadyCount > 0 ? (
            <div className="meta-row">
              <span className="badge">出发储备：{departureReadyCount}</span>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              在课程或复习中收藏句子，出发模式即可使用。
            </p>
          )}
          <div className="split-actions">
            {secondaryActions.map((action) => (
              <PixelButton
                key={action.href}
                href={action.href}
                variant={action.variant}
                style={{ width: "100%" }}
              >
                {action.label}
              </PixelButton>
            ))}
          </div>
        </div>
      </PixelCard>

      <section className="page-stack">
        <div>
          <h2 className="section-title">场景地图</h2>
          <p className="muted" style={{ margin: 0 }}>
            场景按顺序解锁，复习和练习在独立队列中进行。
          </p>
        </div>
        <div className="scene-grid">
          {scenes.map((scene) => (
            <PixelCard key={scene.id}>
              <div className="scene-card">
                <div className="meta-row">
                  <span className="badge">{scene.code}</span>
                  <span className="badge">{scene.lessonCount} 课</span>
                  <span className="badge">{scene.sentenceCount} 句</span>
                </div>
                <h3>
                  {scene.icon} {sceneNameMap[scene.id]}
                </h3>
                <p className="muted">{scene.description}</p>
                <div className="split-actions">
                  <PixelButton href={`/scene/${scene.id}`}>进入{sceneNameMap[scene.id]}</PixelButton>
                </div>
              </div>
            </PixelCard>
          ))}
        </div>
      </section>
    </div>
  );
}
