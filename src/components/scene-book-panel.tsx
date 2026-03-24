"use client";

import { useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import {
  getSceneBookAvailableCount,
  getSceneSentenceProgress
} from "@/lib/books";
import { getDueReviewItems } from "@/lib/review/srs";
import { readStorageState } from "@/lib/storage/local";
import type { SceneDefinition } from "@/lib/types/content";
import type { BookStudyType } from "@/lib/types/storage";

interface SceneBookPanelProps {
  scene: SceneDefinition;
}

const quantityOptions = [5, 10, 20] as const;
const typeLabelMap: Record<BookStudyType, string> = {
  sentence: "句",
  word: "词",
  mixed: "混合"
};

export function SceneBookPanel({ scene }: SceneBookPanelProps) {
  const storage = useMemo(() => readStorageState(), []);
  const [bookType, setBookType] = useState<BookStudyType>("sentence");
  const [count, setCount] = useState<(typeof quantityOptions)[number]>(5);
  const dueCount = getDueReviewItems(storage).filter((item) => item.sceneId === scene.id).length;
  const sentenceProgress = getSceneSentenceProgress(scene, storage);
  const sentenceAvailableCount = getSceneBookAvailableCount(scene, storage, "sentence");
  const wordAvailableCount = getSceneBookAvailableCount(scene, storage, "word");
  const mixedAvailableCount = getSceneBookAvailableCount(scene, storage, "mixed");
  const selectedAvailableCount =
    bookType === "sentence"
      ? sentenceAvailableCount
      : bookType === "word"
        ? wordAvailableCount
        : mixedAvailableCount;
  const startHref = `/scene/${scene.id}/study?type=${bookType}&count=${count}`;

  return (
    <PixelCard>
      <div className="page-stack">
        <div className="hero" style={{ gap: 12 }}>
          <div className="hero-title">
            <span className="display">
              {scene.icon} {scene.label}
            </span>
          </div>
        </div>

        <div className="page-stack" style={{ gap: 12 }}>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">待复习</span>
              <strong className="stat-value">{dueCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">可学</span>
              <strong className="stat-value">{selectedAvailableCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">已学</span>
              <strong className="stat-value">
                {sentenceProgress.current} / {sentenceProgress.total}
              </strong>
            </div>
          </div>

          <div className="field-stack">
            <div className="choice-grid option-grid">
              {(Object.keys(typeLabelMap) as BookStudyType[]).map((type) => {
                const availableCount =
                  type === "sentence"
                    ? sentenceAvailableCount
                    : type === "word"
                      ? wordAvailableCount
                      : mixedAvailableCount;

                return (
                  <button
                    key={type}
                    type="button"
                    className={`choice-button ${bookType === type ? "active" : ""}`.trim()}
                    onClick={() => setBookType(type)}
                  >
                    <strong>{typeLabelMap[type]}</strong>
                    <div className="muted">{availableCount}</div>
                  </button>
                );
              })}
            </div>

            <div className="choice-grid option-grid">
              {quantityOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-button ${count === value ? "active" : ""}`.trim()}
                  onClick={() => setCount(value)}
                >
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
          </div>

          <PixelButton
            href={startHref}
            aria-disabled={selectedAvailableCount === 0}
            style={{ width: "100%" }}
          >
            开始本轮
          </PixelButton>
        </div>

        <div className="split-actions">
          <PixelButton href="/" variant="ghost">
            返回首页
          </PixelButton>
          <PixelButton href="/review" variant={dueCount > 0 ? "secondary" : "ghost"}>
            复习
          </PixelButton>
        </div>
      </div>
    </PixelCard>
  );
}
