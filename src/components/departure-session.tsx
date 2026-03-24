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
    "Departure mode only drills favorited and core lines, with strict exact-match retry rounds."
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
      setFeedback(
        "No departure prompts are ready yet. Finish STEP 5 on core cards or favorite lines in lesson and review first."
      );
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
        ? "Exact match. Move to the next departure prompt."
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
      setFeedback("Next departure prompt ready. Keep the answer exact.");
      return;
    }

    if (roundMistakes.length > 0) {
      setQueue(roundMistakes);
      setRoundMistakes([]);
      setRound((current) => current + 1);
      setIndex(0);
      setFeedback("Retry round started. Only previous misses remain.");
      return;
    }

    setPhase("done");
    setFeedback("Departure sprint clear. Every queued prompt now matches exactly.");
  }

  if (phase === "done") {
    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">DEPARTURE CLEAR</span>
              <span className="badge success">BOARDING READY</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Favorites and core lines were drilled until clean, without changing your SRS intervals.
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
            <PixelButton onClick={() => resetSession("Setup reset. You can launch another departure sprint.")}>
              RUN AGAIN
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
          : "FINISH SPRINT"
        : "NEXT PROMPT";

    return (
      <PixelCard>
        <div className="page-stack">
          <div className="hero" style={{ gap: 12 }}>
            <div className="hero-title">
              <span className="display">DEPARTURE MODE</span>
              <span className="badge success">ROUND {round}</span>
            </div>
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                Prompt {index + 1} / {queue.length}
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
              {currentPrompt.isFavorited ? "FAVORITE" : "CORE"}
            </span>
            <span className="badge">
              {currentPrompt.contentType === "phrase" ? "SENTENCE" : "WORD"}
            </span>
            <span className="badge">{currentPrompt.label}</span>
          </div>

          <div className="turn">
            <div className="turn-role">ZH PROMPT</div>
            <div className="turn-zh">{currentPrompt.promptZh}</div>
          </div>

          <textarea
            aria-label="Departure input"
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
            <span className="display">DEPARTURE MODE</span>
            <span className="badge success">READY</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            This sprint only uses favorited lines plus core travel sentences, and every miss loops back until clean.
          </p>
        </div>

        <div className="stat-grid">
          <div className="stat-box">
            <span className="stat-label">Ready Cards</span>
            <strong className="stat-value">{readyItems.length}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Favorites</span>
            <strong className="stat-value">{favoriteItems.length}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Core Backup</span>
            <strong className="stat-value">{coreOnlyItems.length}</strong>
          </div>
        </div>

        <div className="summary-box">
          <div className="meta-row">
            <span className="badge">Favorite-only cards: {favoriteOnlyItems.length}</span>
            <span className="badge">Prompts available: {pool.length}</span>
            <span className="badge">Requested: {requestedCount}</span>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {feedback}
          </p>
        </div>

        <div className="field-stack">
          <h2 className="section-title">Queue Size</h2>
          <div className="choice-grid option-grid">
            {quantityOptions.map((value) => (
              <button
                key={value}
                type="button"
                className={`choice-button ${quantityMode === value ? "active" : ""}`.trim()}
                onClick={() => setQuantityMode(value)}
              >
                <strong>{value}</strong>
                <div className="muted">Sprint prompts</div>
              </button>
            ))}
            <button
              type="button"
              className={`choice-button ${quantityMode === "all" ? "active" : ""}`.trim()}
              onClick={() => setQuantityMode("all")}
            >
              <strong>All</strong>
              <div className="muted">Use the full pool</div>
            </button>
          </div>
        </div>

        <div className="split-actions">
          <PixelButton onClick={startDeparture} aria-disabled={pool.length === 0}>
            START DEPARTURE
          </PixelButton>
          {nextLesson ? (
            <PixelButton
              href={`/scene/${nextLesson.sceneId}/lesson/${nextLesson.lessonId}`}
              variant="secondary"
            >
              CONTINUE LESSON
            </PixelButton>
          ) : (
            <PixelButton href="/review" variant="secondary">
              OPEN REVIEW
            </PixelButton>
          )}
        </div>
      </div>
    </PixelCard>
  );
}
