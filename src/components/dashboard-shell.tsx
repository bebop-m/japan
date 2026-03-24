"use client";

import { useMemo } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState } from "@/lib/storage/local";
import {
  getDueReviewItems,
  getMasteredSentenceCount,
  getNewSentenceCount,
  getNextAvailableLesson,
  getPhraseReviewItemCount,
  getStudiedSentenceCount
} from "@/lib/review/srs";
import type { SceneSummary } from "@/lib/types/content";

interface DashboardShellProps {
  scenes: SceneSummary[];
}

const sceneNameMap: Record<SceneSummary["id"], string> = {
  airport: "机场",
  hotel: "酒店",
  izakaya: "居酒屋",
  shopping: "购物"
};

export function DashboardShell({ scenes }: DashboardShellProps) {
  const storage = useMemo(() => readStorageState(), []);
  const totalReviewItems = getPhraseReviewItemCount(storage);
  const dueReviewCount = getDueReviewItems(storage).length;
  const newSentenceCount = getNewSentenceCount(storage);
  const masteredSentenceCount = getMasteredSentenceCount(storage);
  const studiedSentenceCount = getStudiedSentenceCount(storage);
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;
  const nextLesson = getNextAvailableLesson(storage);
  const continueLabel = nextLesson
    ? `${sceneNameMap[nextLesson.sceneId]} / ${nextLesson.lessonId}`
    : "全部课程已解锁";
  const continueHref = nextLesson
    ? `/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`
    : "/";
  const progressBlocks = Math.min(
    10,
    Math.floor((masteredSentenceCount / Math.max(totalReviewItems, 1)) * 10)
  );

  return (
    <div className="page-stack">
      <PixelCard>
        <div className="hero">
          <div className="hero-title">
            <span className="display">NIHONGO.GO</span>
            <span className="badge success">间隔复习</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            完成每日检验后句子自动进入间隔复习，收藏句和核心句进入出发模式。
          </p>
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
            <PixelButton href="/review" style={{ width: "100%" }}>
              立即复习
            </PixelButton>
            <PixelButton
              href="/departure"
              variant={departureReadyCount > 0 ? "secondary" : "ghost"}
              style={{ width: "100%" }}
            >
              出发模式
            </PixelButton>
            <PixelButton href="/practice" variant="secondary" style={{ width: "100%" }}>
              练习模式
            </PixelButton>
            <PixelButton href={continueHref} variant="secondary" style={{ width: "100%" }}>
              继续课程
            </PixelButton>
            <PixelButton href="/speech-lab" variant="ghost" style={{ width: "100%" }}>
              发音测试
            </PixelButton>
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
