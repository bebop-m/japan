"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
import { RubyText } from "@/components/ruby-text";
import {
  buildDeparturePool,
  pickDeparturePrompts,
  type DeparturePrompt
} from "@/lib/departure/session";
import { useJapaneseInput } from "@/lib/ime/use-japanese-input";
import { buildDiffTokens, isStrictMatch } from "@/lib/learn/answers";
import { getNextAvailableLesson } from "@/lib/review/srs";
import { cloneStorageState } from "@/lib/storage/clone";
import {
  getDepartureReadyReviewItems,
  getFavoritedReviewItems
} from "@/lib/storage/favorites";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { PhraseCard, SceneId, SceneSummary, WordCard } from "@/lib/types/content";
import type { AppStorageState } from "@/lib/types/storage";

interface DepartureSessionProps {
  scenes: SceneSummary[];
  phraseCards: PhraseCard[];
  wordCards: WordCard[];
}

type DeparturePhase = "setup" | "active" | "done";

interface ResolvedPrompt {
  passed: boolean;
  diffPreview: string[];
}

const quantityOptions = [8, 12, 20] as const;
const sceneNameMap: Record<SceneId, string> = {
  airport: "机场",
  hotel: "酒店",
  izakaya: "居酒屋",
  shopping: "购物"
};
const promptLabelMap: Record<string, string> = {
  "YOU SAY": "你说",
  "PARTNER SAYS": "对方说",
  "WORD BANK": "单词库"
};

export function DepartureSession({
  scenes,
  phraseCards,
  wordCards
}: DepartureSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [phase, setPhase] = useState<DeparturePhase>("setup");
  const [quantityMode, setQuantityMode] = useState<number | "all">(8);
  const [queue, setQueue] = useState<DeparturePrompt[]>([]);
  const [roundMistakes, setRoundMistakes] = useState<DeparturePrompt[]>([]);
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [resolvedPrompt, setResolvedPrompt] = useState<ResolvedPrompt | null>(null);
  const [feedback, setFeedback] = useState(
    "本轮仅使用收藏句和核心句，答错循环重练直到全部正确。"
  );
  const [seedCount, setSeedCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const input = useJapaneseInput();

  const sceneLabelMap = useMemo(
    () =>
      Object.fromEntries(
        scenes.map((scene) => [scene.id, `${scene.icon} ${sceneNameMap[scene.id]}`])
      ) as Record<SceneId, string>,
    [scenes]
  );
  const readyItems = useMemo(() => getDepartureReadyReviewItems(storage), [storage]);
  const favoriteItems = useMemo(
    () =>
      getFavoritedReviewItems(storage).filter((item) => Boolean(item.stepState.verifyCompletedAt)),
    [storage]
  );
  const favoriteOnlyItems = useMemo(
    () => favoriteItems.filter((item) => !item.isCore),
    [favoriteItems]
  );
  const coreOnlyItems = useMemo(
    () => readyItems.filter((item) => item.isCore && !item.isFavorited),
    [readyItems]
  );
  const pool = useMemo(
    () => buildDeparturePool(storage, phraseCards, wordCards),
    [storage, phraseCards, wordCards]
  );
  const nextLesson = getNextAvailableLesson(storage);
  const currentPrompt = queue[index];
  const progressBlocksTotal = Math.min(Math.max(queue.length, 1), 10);
  const progressBlocksCurrent =
    queue.length === 0
      ? 0
      : Math.min(
          progressBlocksTotal,
          Math.round((((resolvedPrompt ? index + 1 : index) || 0) / queue.length) * progressBlocksTotal)
        );
  const requestedCount = quantityMode === "all" ? pool.length : quantityMode;

  useEffect(() => {
    writeStorageState(storage);
  }, [storage]);

  function updateStorage(mutator: (draft: AppStorageState) => void) {
    setStorage((current) => {
      const draft = cloneStorageState(current);
      mutator(draft);
      return draft;
    });
  }

  function resetSession(nextFeedback: string) {
    setPhase("setup");
    setQueue([]);
    setRoundMistakes([]);
    setRound(1);
    setIndex(0);
    setResolvedPrompt(null);
    setSeedCount(0);
    setAttemptCount(0);
    setMistakeCount(0);
    setFeedback(nextFeedback);
    input.reset();
  }

  function startDeparture() {
    const nextQueue = pickDeparturePrompts(pool, requestedCount);

    if (nextQueue.length === 0) {
      setFeedback("暂无出发题目。请先完成核心卡片的第五步，或在课程/复习中收藏句子。");
      return;
    }

    updateStorage((draft) => {
      draft.session.activeSceneId = null;
      draft.session.activeLessonId = null;
      draft.session.lastRoute = "/departure";
    });

    setPhase("active");
    setQueue(nextQueue);
    setRoundMistakes([]);
    setRound(1);
    setIndex(0);
    setResolvedPrompt(null);
    setSeedCount(nextQueue.length);
    setAttemptCount(0);
    setMistakeCount(0);
    setFeedback("仅中文提示，请完整输入日文答案。");
    input.reset();
  }

  function resolvePrompt() {
    if (!currentPrompt || resolvedPrompt) {
      return;
    }

    const committedValue = input.committedValue;
    const passed = isStrictMatch(committedValue, currentPrompt.answerJa);
    const now = new Date().toISOString();

    setResolvedPrompt({
      passed,
      diffPreview: buildDiffTokens(committedValue, currentPrompt.answerJa).map(
        (token) => `${token.status}:${token.char}`
      )
    });
    setAttemptCount((current) => current + 1);

    if (!passed) {
      setRoundMistakes((current) => [...current, currentPrompt]);
      setMistakeCount((current) => current + 1);
    }

    updateStorage((draft) => {
      const item = draft.reviewItems[currentPrompt.sourceId];

      if (!item) {
        return;
      }

      item.lastStudiedAt = now;
      item.lastReviewedAt = now;
      item.lastReviewMode = "departure";
      item.lastResult = passed ? "good" : "again";
      item.lastInput = committedValue;

      if (passed) {
        item.correctCount += 1;
      } else {
        item.mistakeCount += 1;
      }

      draft.session.activeSceneId = currentPrompt.sceneId;
      draft.session.activeLessonId = currentPrompt.lessonId;
      draft.session.lastRoute = "/departure";
    });

    setFeedback(
      passed
        ? "完全匹配，进入下一题。"
        : "不完全匹配，已加入重练轮。"
    );
  }

  function moveNext() {
    if (!resolvedPrompt) {
      return;
    }

    const isLastPrompt = index === queue.length - 1;

    input.reset();
    setResolvedPrompt(null);

    if (!isLastPrompt) {
      setIndex((current) => current + 1);
      setFeedback("下一题已准备好，请继续完整输入。");
      return;
    }

    if (roundMistakes.length > 0) {
      setQueue(roundMistakes);
      setRoundMistakes([]);
      setRound((current) => current + 1);
      setIndex(0);
      setFeedback("重练轮开始，仅包含此前答错的题。");
      return;
    }

    setPhase("done");
    setFeedback("出发完成，所有题目已全部答对。");
  }

  if (phase === "done") {
    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">出发完成</span>
              <span className="badge success">准备登机</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              收藏句和核心句已全部答对，SRS间隔未受影响。
            </p>
          </div>

          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">初始题数</span>
              <strong className="stat-value">{seedCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">总尝试次数</span>
              <strong className="stat-value">{attemptCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">已纠正错误</span>
              <strong className="stat-value">{mistakeCount}</strong>
            </div>
          </div>

          <div className="split-actions">
            <PixelButton onClick={() => resetSession("已重置，可开始新一轮冲刺。")}>
              再来一轮
            </PixelButton>
            <PixelButton href="/" variant="secondary">
              返回首页
            </PixelButton>
          </div>
        </div>
      </PixelCard>
    );
  }

  if (phase === "active" && currentPrompt) {
    const sceneLabel = sceneLabelMap[currentPrompt.sceneId];
    const primaryActionLabel =
      index === queue.length - 1
        ? roundMistakes.length > 0
          ? `开始第 ${round + 1} 轮`
          : "结束冲刺"
        : "下一题";

    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">出发模式</span>
              <span className="badge success">第 {round} 轮</span>
            </div>
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                题目 {index + 1} / {queue.length}
              </span>
              <ProgressBlocks current={progressBlocksCurrent} total={progressBlocksTotal} />
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {feedback}
            </p>
          </div>

          <div className="meta-row">
            <span className="badge">{sceneLabel}</span>
            <span className="badge">
              {currentPrompt.isFavorited ? "收藏" : "核心"}
            </span>
            <span className="badge">
              {currentPrompt.contentType === "phrase" ? "句子" : "单词"}
            </span>
            <span className="badge">{promptLabelMap[currentPrompt.label] ?? currentPrompt.label}</span>
          </div>

          <div className="turn">
            <div className="turn-role">中文提示</div>
            <div className="turn-zh">{currentPrompt.promptZh}</div>
          </div>

          <textarea
            aria-label="出发输入框"
            className="pixel-textarea"
            placeholder="在此输入日文"
            {...input.bind}
          />

          {resolvedPrompt ? (
            <div className="page-stack" style={{ gap: 12 }}>
              <div className="turn">
                <div className="turn-role">答案</div>
                <div className="turn-ja">
                  <RubyText tokens={currentPrompt.ruby} />
                </div>
                <div className="turn-kana">{currentPrompt.kana}</div>
              </div>

              <div className="meta-row">
                <span className={`badge ${resolvedPrompt.passed ? "success" : "danger"}`.trim()}>
                  {resolvedPrompt.passed ? "完全匹配" : "稍后重试"}
                </span>
              </div>

              <div className="diff-row">
                {resolvedPrompt.diffPreview.map((token, diffIndex) => {
                  const [status, char] = token.split(":");

                  return (
                    <span key={`${token}-${diffIndex}`} className={`diff-token ${status}`.trim()}>
                      {char || "_"}
                    </span>
                  );
                })}
              </div>

              <div className="split-actions">
                <PixelButton onClick={moveNext}>{primaryActionLabel}</PixelButton>
              </div>
            </div>
          ) : (
            <div className="split-actions">
              <PixelButton onClick={resolvePrompt}>提交答案</PixelButton>
              <PixelButton variant="ghost" onClick={input.reset}>
                清空
              </PixelButton>
            </div>
          )}
        </div>
      </PixelCard>
    );
  }

  return (
    <PixelCard>
      <div className="page-stack">
        <div className="hero" style={{ gap: 12 }}>
          <div className="hero-title">
            <span className="display">出发模式</span>
            <span className="badge success">待开始</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            本轮仅使用收藏句和核心句，答错循环重练直到全部正确。
          </p>
        </div>

        <div className="stat-grid">
          <div className="stat-box">
            <span className="stat-label">可用卡片</span>
            <strong className="stat-value">{readyItems.length}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">收藏</span>
            <strong className="stat-value">{favoriteItems.length}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">核心备份</span>
            <strong className="stat-value">{coreOnlyItems.length}</strong>
          </div>
        </div>

        <div className="summary-box">
          <div className="meta-row">
            <span className="badge">仅收藏卡片：{favoriteOnlyItems.length}</span>
            <span className="badge">可用题目：{pool.length}</span>
            <span className="badge">已选：{requestedCount}</span>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {feedback}
          </p>
        </div>

        <div className="field-stack">
          <h2 className="section-title">队列大小</h2>
          <div className="choice-grid option-grid">
            {quantityOptions.map((value) => (
              <button
                key={value}
                type="button"
                className={`choice-button ${quantityMode === value ? "active" : ""}`.trim()}
                onClick={() => setQuantityMode(value)}
              >
                <strong>{value}</strong>
                <div className="muted">冲刺题数</div>
              </button>
            ))}
            <button
              type="button"
              className={`choice-button ${quantityMode === "all" ? "active" : ""}`.trim()}
              onClick={() => setQuantityMode("all")}
            >
              <strong>全部</strong>
              <div className="muted">使用全部</div>
            </button>
          </div>
        </div>

        <div className="split-actions">
          <PixelButton onClick={startDeparture} aria-disabled={pool.length === 0}>
            开始出发
          </PixelButton>
          {nextLesson ? (
            <PixelButton
              href={`/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`}
              variant="secondary"
            >
              继续课程
            </PixelButton>
          ) : (
            <PixelButton href="/review" variant="secondary">
              去复习
            </PixelButton>
          )}
        </div>
      </div>
    </PixelCard>
  );
}
