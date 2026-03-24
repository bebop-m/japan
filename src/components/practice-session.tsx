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
    "Practice only pulls from verified items and never changes SRS intervals."
  );
  const [seedCount, setSeedCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const input = useJapaneseInput();

  const sceneLabelMap = useMemo(
    () =>
      Object.fromEntries(
        scenes.map((scene) => [scene.id, `${scene.icon} ${scene.shortLabel}`])
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
          ? "No learned word cards are available yet. Finish word lessons first, or switch to sentence mode."
          : "No verified items are available yet. Finish a lesson through STEP 5 first."
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
    setFeedback("Chinese prompt only. Type the full Japanese answer exactly.");
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
        ? "Exact match. Move to the next prompt."
        : "Not exact. This prompt has been added to the retry round."
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
      setFeedback("Next prompt ready. Keep the answer exact.");
      return;
    }

    if (roundMistakes.length > 0) {
      setQueue(roundMistakes);
      setRoundMistakes([]);
      setRound((current) => current + 1);
      setIndex(0);
      setFeedback("Retry round started. Only previous mistakes remain.");
      return;
    }

    setPhase("done");
    setFeedback("Practice clear. Every queued prompt now matches exactly.");
  }

  if (phase === "done") {
    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">PRACTICE CLEAR</span>
              <span className="badge success">ALL EXACT</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Wrong answers looped until clean, and your SRS intervals were left untouched.
            </p>
          </div>

          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">Initial Queue</span>
              <strong className="stat-value">{seedCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Total Attempts</span>
              <strong className="stat-value">{attemptCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Mistakes Cleared</span>
              <strong className="stat-value">{mistakeCount}</strong>
            </div>
          </div>

          <div className="split-actions">
            <PixelButton onClick={() => resetSession("Setup reset. You can launch another practice run.")}>
              PRACTICE AGAIN
            </PixelButton>
            <PixelButton href="/" variant="secondary">
              BACK HOME
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
          ? `START ROUND ${round + 1}`
          : "FINISH PRACTICE"
        : "NEXT PROMPT";

    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">PRACTICE MODE</span>
              <span className="badge success">ROUND {round}</span>
            </div>
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                Prompt {index + 1} / {queue.length}
              </span>
              <ProgressBlocks current={roundProgressCurrent} total={roundProgressTotal} />
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {feedback}
            </p>
          </div>

          <div className="meta-row">
            <span className="badge">{sceneLabel}</span>
            <span className="badge">
              {currentPrompt.contentType === "phrase" ? "SENTENCE" : "WORD"}
            </span>
            <span className="badge">{currentPrompt.label}</span>
            <span className="badge">{currentPrompt.lessonId ?? "SCENE BANK"}</span>
          </div>

          <div className="turn">
            <div className="turn-role">ZH PROMPT</div>
            <div className="turn-zh">{currentPrompt.promptZh}</div>
          </div>

          <textarea
            aria-label="Practice input"
            className="pixel-textarea"
            placeholder="Type the full Japanese answer here"
            {...input.bind}
          />

          {resolvedPrompt ? (
            <div className="page-stack" style={{ gap: 12 }}>
              <div className="turn">
                <div className="turn-role">ANSWER</div>
                <div className="turn-ja">
                  <RubyText tokens={currentPrompt.ruby} />
                </div>
                <div className="turn-kana">{currentPrompt.kana}</div>
              </div>

              <div className="meta-row">
                <span className={`badge ${resolvedPrompt.passed ? "success" : "danger"}`.trim()}>
                  {resolvedPrompt.passed ? "EXACT MATCH" : "RETRY LATER"}
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
              <PixelButton onClick={resolvePrompt}>SUBMIT EXACT MATCH</PixelButton>
              <PixelButton variant="ghost" onClick={input.reset}>
                CLEAR INPUT
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
            <span className="display">PRACTICE MODE</span>
            <span className="badge success">READY</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Build output speed with Chinese prompts, strict exact-match checking, and automatic retry rounds.
          </p>
        </div>

        <div className="page-stack" style={{ gap: 16 }}>
          <div className="field-stack">
            <h2 className="section-title">1. Scope</h2>
            <div className="choice-grid option-grid">
              <button
                type="button"
                className={`choice-button ${scope === "all" ? "active" : ""}`.trim()}
                onClick={() => setScope("all")}
              >
                <strong>ALL</strong>
                <div className="muted">All learned scenes</div>
              </button>
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`choice-button ${scope === scene.id ? "active" : ""}`.trim()}
                  onClick={() => setScope(scene.id)}
                >
                  <strong>
                    {scene.icon} {scene.shortLabel}
                  </strong>
                  <div className="muted">{scene.code}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field-stack">
            <h2 className="section-title">2. Prompt Type</h2>
            <div className="choice-grid option-grid">
              <button
                type="button"
                className={`choice-button ${practiceType === "sentence" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("sentence")}
              >
                <strong>Sentence</strong>
                <div className="muted">{sentencePool.length} available now</div>
              </button>
              <button
                type="button"
                className={`choice-button ${practiceType === "word" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("word")}
              >
                <strong>Word</strong>
                <div className="muted">{wordPool.length} available now</div>
              </button>
              <button
                type="button"
                className={`choice-button ${practiceType === "mixed" ? "active" : ""}`.trim()}
                onClick={() => setPracticeType("mixed")}
              >
                <strong>Mixed</strong>
                <div className="muted">{mixedPool.length} available now</div>
              </button>
            </div>
          </div>

          <div className="field-stack">
            <h2 className="section-title">3. Queue Size</h2>
            <div className="choice-grid option-grid">
              {quantityOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-button ${quantityMode === value ? "active" : ""}`.trim()}
                  onClick={() => setQuantityMode(value)}
                >
                  <strong>{value}</strong>
                  <div className="muted">Exact prompts</div>
                </button>
              ))}
              <button
                type="button"
                className={`choice-button ${quantityMode === "custom" ? "active" : ""}`.trim()}
                onClick={() => setQuantityMode("custom")}
              >
                <strong>Custom</strong>
                <div className="muted">Choose any size</div>
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
            <span className="badge">Available now: {availableCount}</span>
            <span className="badge">Requested: {requestedCount}</span>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {feedback}
          </p>
          {practiceType !== "sentence" && wordPool.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Word prompts will appear automatically once learned word review items are seeded into storage.
            </p>
          ) : null}
        </div>

        <div className="split-actions">
          <PixelButton onClick={startPractice} aria-disabled={availableCount === 0}>
            START PRACTICE
          </PixelButton>
          {nextLesson ? (
            <PixelButton
              href={`/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`}
              variant="secondary"
            >
              CONTINUE LESSON
            </PixelButton>
          ) : (
            <PixelButton href="/" variant="secondary">
              BACK HOME
            </PixelButton>
          )}
        </div>
      </div>
    </PixelCard>
  );
}
