"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { ProgressBlocks } from "@/components/progress-blocks";
import { RubyText } from "@/components/ruby-text";
import { useJapaneseInput } from "@/lib/ime/use-japanese-input";
import { buildDiffTokens, isStrictMatch } from "@/lib/learn/answers";
import {
  applySrsRating,
  buildPhraseCardMap,
  buildReviewQueue,
  getDueReviewItems,
  type ReviewQueueEntry,
  type SrsRating
} from "@/lib/review/srs";
import { cloneStorageState } from "@/lib/storage/clone";
import { toggleFavoriteReviewItem } from "@/lib/storage/favorites";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { PhraseCard } from "@/lib/types/content";
import type { AppStorageState } from "@/lib/types/storage";

interface ReviewSessionProps {
  cards: PhraseCard[];
}

type ReviewPhase = "prompt" | "reveal" | "reinforce" | "done";

export function ReviewSession({ cards }: ReviewSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [queue] = useState<ReviewQueueEntry[]>(() =>
    buildReviewQueue(getDueReviewItems(readStorageState()))
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>(() => (queue.length > 0 ? "prompt" : "done"));
  const [pendingRating, setPendingRating] = useState<SrsRating | null>(null);
  const [feedback, setFeedback] = useState("Reveal the answer, then self-rate.");
  const [diffPreview, setDiffPreview] = useState<string[]>([]);
  const input = useJapaneseInput();

  const cardMap = useMemo(() => buildPhraseCardMap(cards), [cards]);
  const currentEntry = queue[index];
  const currentCard = currentEntry ? cardMap[currentEntry.contentId] : null;
  const currentItem = currentEntry ? storage.reviewItems[currentEntry.contentId] : null;
  const progressCount = phase === "done" ? queue.length : Math.min(index, queue.length);
  const progressBlocksTotal = Math.min(Math.max(queue.length, 1), 10);
  const progressBlocksCurrent =
    queue.length === 0
      ? 0
      : Math.min(
          progressBlocksTotal,
          Math.round((progressCount / queue.length) * progressBlocksTotal)
        );
  const currentTurn = currentCard?.turns[0];
  const partnerTurn = currentCard?.turns[1];
  const currentFavorited = Boolean(currentItem?.isFavorited);

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

  function moveNext(message: string) {
    input.reset();
    setDiffPreview([]);
    setPendingRating(null);

    if (index === queue.length - 1) {
      setPhase("done");
      setFeedback(message);
      return;
    }

    setIndex((current) => current + 1);
    setPhase("prompt");
    setFeedback(message);
  }

  function applyRating(rating: SrsRating) {
    if (!currentItem || !currentEntry) {
      return;
    }

    if (
      rating === "again" &&
      currentItem.lastReviewMode === "srs" &&
      currentItem.lastResult === "again"
    ) {
      setPendingRating(rating);
      setPhase("reinforce");
      setFeedback(
        "This card has been missed twice in a row. Type the full Japanese answer before moving on."
      );
      return;
    }

    updateStorage((draft) => {
      draft.reviewItems[currentEntry.contentId] = applySrsRating(
        draft.reviewItems[currentEntry.contentId],
        rating
      );
    });

    moveNext(
      rating === "good"
        ? "Marked as know. Interval doubled."
        : rating === "hard"
          ? "Marked as fuzzy. Interval unchanged."
          : "Marked as again. This card will come back tomorrow."
    );
  }

  function toggleCurrentFavorite() {
    if (!currentEntry) {
      return;
    }

    updateStorage((draft) => {
      toggleFavoriteReviewItem(draft, currentEntry.contentId);
    });
  }

  function submitReinforce() {
    if (!currentCard || !currentEntry || !pendingRating) {
      return;
    }

    const expected = currentCard.turns[0].ja;
    const passed = isStrictMatch(input.committedValue, expected);

    setDiffPreview(
      buildDiffTokens(input.committedValue, expected).map(
        (token) => `${token.status}:${token.char}`
      )
    );

    if (!passed) {
      setFeedback("Still not exact. Keep typing until the answer matches exactly.");
      return;
    }

    updateStorage((draft) => {
      draft.reviewItems[currentEntry.contentId] = applySrsRating(
        draft.reviewItems[currentEntry.contentId],
        pendingRating
      );
    });

    moveNext("Reinforcement complete. The item stays on a 1-day interval.");
  }

  if (!currentEntry || !currentCard || !currentItem || !currentTurn || !partnerTurn) {
    return (
      <PixelCard>
        <div className="page-stack">
          <div className="summary-box">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Review Queue Empty
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              No SRS reviews are due right now. Finish a lesson and pass Daily Check, then come back here.
            </p>
          </div>
          <div className="split-actions">
            <PixelButton href="/" variant="secondary">
              BACK HOME
            </PixelButton>
          </div>
        </div>
      </PixelCard>
    );
  }

  return (
    <PixelCard>
      <div className="page-stack" style={{ gap: 16 }}>
        <div className="hero" style={{ gap: 12 }}>
          <div className="hero-title">
            <span className="display">SRS REVIEW</span>
            <span className="badge success">
              {phase === "done" ? "DONE" : `${index + 1} / ${queue.length}`}
            </span>
          </div>
          {phase !== "done" ? (
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                {currentEntry.direction === "zh-to-ja" ? "ZH TO JA" : "JA TO ZH"}
              </span>
              <PixelButton
                type="button"
                variant={currentFavorited ? "secondary" : "ghost"}
                onClick={toggleCurrentFavorite}
                aria-pressed={currentFavorited}
              >
                {currentFavorited ? "★ FAVORITED" : "☆ SAVE TO DEPARTURE"}
              </PixelButton>
            </div>
          ) : null}
          <div className="meta-row" style={{ justifyContent: "space-between" }}>
            <span className="badge">{feedback}</span>
            <ProgressBlocks current={progressBlocksCurrent} total={progressBlocksTotal} />
          </div>
        </div>

        {phase === "prompt" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="turn">
              <div className="turn-role">
                {currentEntry.direction === "zh-to-ja" ? "ZH TO JA" : "JA TO ZH"}
              </div>
              {currentEntry.direction === "zh-to-ja" ? (
                <div className="turn-zh">{currentTurn.zh}</div>
              ) : (
                <>
                  <div className="turn-ja">
                    <RubyText tokens={currentTurn.ruby} />
                  </div>
                  <div className="turn-kana">{currentTurn.kana}</div>
                </>
              )}
            </div>
            <div className="split-actions">
              <PixelButton
                onClick={() => {
                  setPhase("reveal");
                  setFeedback("Reveal complete. Rate how well you recalled it.");
                }}
              >
                REVEAL ANSWER
              </PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "reveal" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="turn-list">
              <div className="turn">
                <div className="turn-role">YOU SAY</div>
                <div className="turn-ja">
                  <RubyText tokens={currentTurn.ruby} />
                </div>
                <div className="turn-kana">{currentTurn.kana}</div>
                <div className="turn-zh">{currentTurn.zh}</div>
              </div>
              <div className="turn">
                <div className="turn-role">PARTNER SAYS</div>
                <div className="turn-ja">
                  <RubyText tokens={partnerTurn.ruby} />
                </div>
                <div className="turn-kana">{partnerTurn.kana}</div>
                <div className="turn-zh">{partnerTurn.zh}</div>
              </div>
            </div>
            <div className="split-actions">
              <PixelButton variant="ghost" onClick={() => applyRating("again")}>
                AGAIN
              </PixelButton>
              <PixelButton variant="secondary" onClick={() => applyRating("hard")}>
                HARD
              </PixelButton>
              <PixelButton onClick={() => applyRating("good")}>GOOD</PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "reinforce" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="turn">
              <div className="turn-role">REINFORCE</div>
              <div className="turn-zh">{currentTurn.zh}</div>
              <div className="turn-kana">Type the full Japanese answer exactly.</div>
            </div>
            <textarea
              aria-label="Reinforce input"
              className="pixel-textarea"
              placeholder="Type Japanese exactly here"
              {...input.bind}
            />
            {diffPreview.length > 0 ? (
              <div className="diff-row">
                {diffPreview.map((token, diffIndex) => {
                  const [status, char] = token.split(":");

                  return (
                    <span key={`${token}-${diffIndex}`} className={`diff-token ${status}`.trim()}>
                      {char || "∅"}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <div className="split-actions">
              <PixelButton onClick={submitReinforce}>SUBMIT REINFORCE</PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="summary-box">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Review Complete
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Today&apos;s due review queue is done. Home will now show the updated counts and next lesson.
              </p>
            </div>
            <div className="split-actions">
              <PixelButton href="/" variant="secondary">
                BACK HOME
              </PixelButton>
            </div>
          </div>
        ) : null}
      </div>
    </PixelCard>
  );
}
