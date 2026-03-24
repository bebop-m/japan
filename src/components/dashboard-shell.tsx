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
  getStudiedSentenceCount
} from "@/lib/review/srs";
import type { SceneSummary } from "@/lib/types/content";

interface DashboardShellProps {
  scenes: SceneSummary[];
}

export function DashboardShell({ scenes }: DashboardShellProps) {
  const storage = useMemo(() => readStorageState(), []);
  const totalSentences = scenes.reduce((total, scene) => total + scene.sentenceCount, 0);
  const dueReviewCount = getDueReviewItems(storage).length * 2;
  const newSentenceCount = getNewSentenceCount(storage);
  const masteredSentenceCount = getMasteredSentenceCount(storage);
  const studiedSentenceCount = getStudiedSentenceCount(storage);
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;
  const nextLesson = getNextAvailableLesson(storage);
  const continueLabel = nextLesson
    ? `${nextLesson.sceneId.toUpperCase()} / ${nextLesson.lessonId}`
    : "All lessons opened";
  const continueHref = nextLesson
    ? `/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`
    : "/";
  const progressBlocks = Math.min(
    10,
    Math.floor((masteredSentenceCount / Math.max(totalSentences, 1)) * 10)
  );

  return (
    <div className="page-stack">
      <PixelCard>
        <div className="hero">
          <div className="hero-title">
            <span className="display">NIHONGO.GO</span>
            <span className="badge success">SRS ACTIVE</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Daily Check graduates now flow into SRS automatically, and Departure mode now pulls from your favorited lines plus core travel sentences.
          </p>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">Today Review</span>
              <strong className="stat-value">{dueReviewCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Today New</span>
              <strong className="stat-value">{newSentenceCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Mastered</span>
              <strong className="stat-value">
                {masteredSentenceCount} / {totalSentences}
              </strong>
            </div>
          </div>
          <div className="meta-row">
            <span className="badge">Continue: {continueLabel}</span>
            <span className="badge">Need revisit: {studiedSentenceCount}</span>
          </div>
          <div className="meta-row" style={{ justifyContent: "space-between" }}>
            <span className="badge">PIXEL BOARD</span>
            <ProgressBlocks current={progressBlocks} total={10} />
          </div>
          <div className="meta-row">
            <span className="badge">Departure Ready: {departureReadyCount}</span>
          </div>
          <div className="split-actions">
            <PixelButton href="/review">REVIEW TODAY</PixelButton>
            <PixelButton href="/departure" variant="secondary">
              DEPARTURE MODE
            </PixelButton>
            <PixelButton href="/practice" variant="secondary">
              PRACTICE MODE
            </PixelButton>
            <PixelButton href={continueHref} variant="secondary">
              CONTINUE LESSON
            </PixelButton>
            <PixelButton href="/speech-lab" variant="ghost">
              IOS SPEECH LAB
            </PixelButton>
          </div>
        </div>
      </PixelCard>

      <section className="page-stack">
        <div>
          <h2 className="section-title">Scene Map</h2>
          <p className="muted" style={{ margin: 0 }}>
            Lessons still unlock scene by scene, while review and practice stay in their own dedicated queues.
          </p>
        </div>
        <div className="scene-grid">
          {scenes.map((scene) => (
            <PixelCard key={scene.id}>
              <div className="scene-card">
                <div className="meta-row">
                  <span className="badge">{scene.code}</span>
                  <span className="badge">{scene.lessonCount} lessons</span>
                  <span className="badge">{scene.sentenceCount} sentences</span>
                </div>
                <h3>
                  {scene.icon} {scene.label}
                </h3>
                <p className="muted">{scene.description}</p>
                <div className="split-actions">
                  <PixelButton href={`/scene/${scene.id}`}>OPEN {scene.shortLabel}</PixelButton>
                </div>
              </div>
            </PixelCard>
          ))}
        </div>
      </section>
    </div>
  );
}
