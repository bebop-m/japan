"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
import { RubyText } from "@/components/ruby-text";
import { useJapaneseInput } from "@/lib/ime/use-japanese-input";
import { buildDiffTokens, isStrictMatch } from "@/lib/learn/answers";
import {
  buildPracticePool,
  pickPracticePrompts,
  type PracticePrompt,
  type PracticeScope,
  type PracticeType
} from "@/lib/practice/session";
import { getNextAvailableLesson } from "@/lib/review/srs";
import { cloneStorageState } from "@/lib/storage/clone";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { PhraseCard, SceneId, SceneSummary, WordCard } from "@/lib/types/content";
import type { AppStorageState } from "@/lib/types/storage";

interface PracticeSessionProps {
  scenes: SceneSummary[];
  phraseCards: PhraseCard[];
  wordCards: WordCard[];
}

type PracticePhase = "setup" | "active" | "done";

interface ResolvedPrompt {
  passed: boolean;
  diffPreview: string[];
}

const quantityOptions = [5, 10, 20] as const;
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

export function PracticeSession({
  scenes,
  phraseCards,
  wordCards
}: PracticeSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const [scope, setScope] = useState<PracticeScope>("all");
  const [practiceType, setPracticeType] = useState<PracticeType>("sentence");
  const [quantityMode, setQuantityMode] = useState<number | "custom">(5);
  const [customCount, setCustomCount] = useState("8");
  const [queue, setQueue] = useState<PracticePrompt[]>([]);
  const [roundMistakes, setRoundMistakes] = useState<PracticePrompt[]>([]);
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [resolvedPrompt, setResolvedPrompt] = useState<ResolvedPrompt | null>(null);
  const [feedback, setFeedback] = useState(
    "随机抽取已学句子，训练日文输出速度，答错自动重练，不影响SRS间隔。"
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

  const sentencePool = useMemo(
    () => buildPracticePool(storage, phraseCards, wordCards, scope, "sentence"),
    [storage, phraseCards, scope, wordCards]
  );
  const wordPool = useMemo(
    () => buildPracticePool(storage, phraseCards, wordCards, scope, "word"),
    [storage, phraseCards, scope, wordCards]
  );
  const mixedPool = useMemo(
    () => buildPracticePool(storage, phraseCards, wordCards, scope, "mixed"),
    [storage, phraseCards, scope, wordCards]
  );
  const availableCount =
    practiceType === "sentence"
      ? sentencePool.length
      : practiceType === "word"
        ? wordPool.length
        : mixedPool.length;
  const nextLesson = getNextAvailableLesson(storage);
  const currentPrompt = queue[index];
  const roundProgressTotal = Math.min(Math.max(queue.length, 1), 10);
  const roundProgressCurrent =
    queue.length === 0
      ? 0
      : Math.min(
          roundProgressTotal,
          Math.round((((resolvedPrompt ? index + 1 : index) || 0) / queue.length) * roundProgressTotal)
        );
  const requestedCount =
    quantityMode === "custom"
      ? Math.max(1, Number.parseInt(customCount || "1", 10) || 1)
      : quantityMode;

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

  function startPractice() {
    const basePool =
      practiceType === "sentence"
        ? sentencePool
        : practiceType === "word"
          ? wordPool
          : mixedPool;
    const nextQueue = pickPracticePrompts(basePool, requestedCount);

    if (nextQueue.length === 0) {
      setFeedback(
        practiceType === "word"
          ? "暂无可练习的单词，请先完成相关课程，或切换到句子模式。"
          : "暂无已验证的句子，请先完成课程第五步。"
      );
      return;
    }

    updateStorage((draft) => {
      draft.session.activeSceneId = scope === "all" ? null : scope;
      draft.session.activeLessonId = null;
      draft.session.lastRoute = "/practice";
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
    setFeedback("这是速度训练：仅看中文提示，尽快完整输出日文。");
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
      item.lastReviewMode = "practice";
      item.lastResult = passed ? "good" : "again";
      item.lastInput = committedValue;

      if (passed) {
        item.correctCount += 1;
      } else {
        item.mistakeCount += 1;
      }

      draft.session.activeSceneId = currentPrompt.sceneId;
      draft.session.activeLessonId = currentPrompt.lessonId;
      draft.session.lastRoute = "/practice";
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
    setFeedback("速度训练完成，所有题目已全部答对。");
  }

  if (phase === "done") {
    return (
      <PixelCard className="machine-card">
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">练习完成</span>
              <span className="badge success">全部答对</span>
            </div>
            <div className="machine-feedback">
              这是速度训练回合，目标是扩大输出速度，SRS间隔未受影响。
            </div>
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
            <PixelButton onClick={() => resetSession("已重置，可开始新一轮练习。")}>
              再练一轮
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
          : "结束练习"
        : "下一题";

    return (
      <PixelCard className="machine-card">
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">练习模式</span>
              <span className="badge success">第 {round} 轮</span>
            </div>
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                题目 {index + 1} / {queue.length}
              </span>
              <ProgressBlocks current={roundProgressCurrent} total={roundProgressTotal} />
            </div>
            <div className="machine-feedback">
              {feedback}
            </div>
          </div>

          <div className="meta-row">
            <span className="badge">{sceneLabel}</span>
            <span className="badge">
              {currentPrompt.contentType === "phrase" ? "句子" : "单词"}
            </span>
            <span className="badge">{promptLabelMap[currentPrompt.label] ?? currentPrompt.label}</span>
            <span className="badge">{currentPrompt.lessonId ?? "场景词库"}</span>
          </div>

          <div className="turn">
            <div className="turn-role">中文提示</div>
            <div className="turn-zh">{currentPrompt.promptZh}</div>
          </div>

          <textarea
            aria-label="练习输入框"
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
                      {char || "∅"}
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
    <PixelCard className="machine-card">
      <div className="page-stack">
        <div className="hero" style={{ gap: 12 }}>
          <div className="hero-title">
            <span className="display">练习模式</span>
            <span className="badge success">待开始</span>
          </div>
          <div className="machine-feedback">
            面向全场景做随机抽题，专门拉高日文输出速度和稳定度。
          </div>
        </div>

        <div className="page-stack" style={{ gap: 16 }}>
          <div className="field-stack">
            <h2 className="section-title">1. 范围</h2>
            <div className="choice-grid option-grid">
              <button
                type="button"
                className={`choice-button ${scope === "all" ? "active" : ""}`.trim()}
                onClick={() => setScope("all")}
              >
                <strong>全部</strong>
                <div className="muted">全部已学场景</div>
              </button>
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`choice-button ${scope === scene.id ? "active" : ""}`.trim()}
                  onClick={() => setScope(scene.id)}
                >
                  <strong>
                    {scene.icon} {sceneNameMap[scene.id]}
                  </strong>
                  <div className="muted">{scene.code}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field-stack">
            <h2 className="section-title">2. 题型</h2>
            <div className="choice-grid option-grid">
              <button
                type="button"
                className={`choice-button ${practiceType === "sentence" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("sentence")}
              >
                <strong>句子</strong>
                <div className="muted">{sentencePool.length} 题可用</div>
              </button>
              <button
                type="button"
                className={`choice-button ${practiceType === "word" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("word")}
              >
                <strong>单词</strong>
                <div className="muted">{wordPool.length} 题可用</div>
              </button>
              <button
                type="button"
                className={`choice-button ${practiceType === "mixed" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("mixed")}
              >
                <strong>混合</strong>
                <div className="muted">{mixedPool.length} 题可用</div>
              </button>
            </div>
          </div>

          <div className="field-stack">
            <h2 className="section-title">3. 题目数量</h2>
            <div className="choice-grid option-grid">
              {quantityOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-button ${quantityMode === value ? "active" : ""}`.trim()}
                  onClick={() => setQuantityMode(value)}
                >
                  <strong>{value}</strong>
                  <div className="muted">固定数量</div>
                </button>
              ))}
              <button
                type="button"
                className={`choice-button ${quantityMode === "custom" ? "active" : ""}`.trim()}
                onClick={() => setQuantityMode("custom")}
              >
                <strong>自定义</strong>
                <div className="muted">自选数量</div>
              </button>
            </div>
            {quantityMode === "custom" ? (
              <input
                type="number"
                min={1}
                max={99}
                className="pixel-input"
                value={customCount}
                onChange={(event) => setCustomCount(event.target.value)}
              />
            ) : null}
          </div>
        </div>

        <div className="summary-box">
          <div className="meta-row">
            <span className="badge">当前可用：{availableCount}</span>
            <span className="badge">已选：{requestedCount}</span>
          </div>
          <div className="machine-feedback">
            {feedback}
          </div>
          {practiceType !== "sentence" && wordPool.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              单词题会在 word review item 接入后自动出现。
            </p>
          ) : null}
          <p className="muted" style={{ marginBottom: 0 }}>
            这是全库速度训练，不挑收藏句，也不改变 SRS 间隔。
          </p>
        </div>

        <div className="split-actions">
          <PixelButton onClick={startPractice} aria-disabled={availableCount === 0}>
            开始练习
          </PixelButton>
          {nextLesson ? (
            <PixelButton
              href={`/scene/${nextLesson.sceneId}`}
              variant="secondary"
            >
              继续句本
            </PixelButton>
          ) : (
            <PixelButton href="/" variant="secondary">
              返回首页
            </PixelButton>
          )}
        </div>
      </div>
    </PixelCard>
  );
}
