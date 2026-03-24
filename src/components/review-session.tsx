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
  getSpotlightReviewItems,
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
  mode?: "due" | "focus";
}

type ReviewPhase = "prompt" | "reveal" | "reinforce" | "done";

export function ReviewSession({ cards, mode = "due" }: ReviewSessionProps) {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [queue] = useState<ReviewQueueEntry[]>(() =>
    buildReviewQueue(
      mode === "focus"
        ? getSpotlightReviewItems(readStorageState())
        : getDueReviewItems(readStorageState())
    )
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>(() => (queue.length > 0 ? "prompt" : "done"));
  const [pendingRating, setPendingRating] = useState<SrsRating | null>(null);
  const [feedback, setFeedback] = useState(
    mode === "focus" ? "这些句子近期反复出错，先集中回炉。" : "翻开答案，然后自评。"
  );
  const [diffPreview, setDiffPreview] = useState<string[]>([]);
  const input = useJapaneseInput();
  const isFocusMode = mode === "focus";

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
      setFeedback("该卡片连续两次未答对，请完整打出日文答案再继续。");
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
        ? "已标记认识，间隔翻倍。"
        : rating === "hard"
          ? "已标记模糊，间隔不变。"
          : "已标记再来，明天重新复习。"
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
      setFeedback("还不完全正确，继续输入直到完全匹配。");
      return;
    }

    updateStorage((draft) => {
      draft.reviewItems[currentEntry.contentId] = applySrsRating(
        draft.reviewItems[currentEntry.contentId],
        pendingRating
      );
    });

    moveNext("强化完成，该卡片保持1天间隔。");
  }

  if (!currentEntry || !currentCard || !currentItem || !currentTurn || !partnerTurn) {
    return (
      <PixelCard>
        <div className="page-stack">
          <div className="summary-box">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {isFocusMode ? "当前没有重点巩固句" : "复习队列为空"}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {isFocusMode
                  ? "最近 3 天没有反复出错的句子。正常去做课程、复习或练习就好。"
                  : "当前没有到期的复习。完成课程并通过每日检验后再来。"}
              </p>
            </div>
          <div className="split-actions">
            <PixelButton href="/" variant="secondary">
              返回首页
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
            <span className="display">{isFocusMode ? "专项复习" : "SRS 复习"}</span>
            <span className="badge success">
              {phase === "done" ? "完成" : `${index + 1} / ${queue.length}`}
            </span>
          </div>
          {phase !== "done" ? (
            <div className="meta-row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                {currentEntry.direction === "zh-to-ja" ? "中→日" : "日→中"}
              </span>
              <PixelButton
                type="button"
                variant={currentFavorited ? "secondary" : "ghost"}
                onClick={toggleCurrentFavorite}
                aria-pressed={currentFavorited}
              >
                {currentFavorited ? "★ 已收藏" : "☆ 加入出发"}
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
                {currentEntry.direction === "zh-to-ja" ? "中→日" : "日→中"}
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
                  setFeedback("已翻开，请自评记忆程度。");
                }}
              >
                翻开答案
              </PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "reveal" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="turn-list">
              <div className="turn">
                <div className="turn-role">你说</div>
                <div className="turn-ja">
                  <RubyText tokens={currentTurn.ruby} />
                </div>
                <div className="turn-kana">{currentTurn.kana}</div>
                <div className="turn-zh">{currentTurn.zh}</div>
              </div>
              <div className="turn">
                <div className="turn-role">对方说</div>
                <div className="turn-ja">
                  <RubyText tokens={partnerTurn.ruby} />
                </div>
                <div className="turn-kana">{partnerTurn.kana}</div>
                <div className="turn-zh">{partnerTurn.zh}</div>
              </div>
            </div>
            <div className="split-actions">
              <PixelButton variant="ghost" onClick={() => applyRating("again")}>
                再来
              </PixelButton>
              <PixelButton variant="secondary" onClick={() => applyRating("hard")}>
                模糊
              </PixelButton>
              <PixelButton onClick={() => applyRating("good")}>认识</PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "reinforce" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="turn">
              <div className="turn-role">强化输入</div>
              <div className="turn-zh">{currentTurn.zh}</div>
              <div className="turn-kana">请完整输入日文答案</div>
            </div>
            <textarea
              aria-label="强化输入框"
              className="pixel-textarea"
              placeholder="在此输入日文"
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
              <PixelButton onClick={submitReinforce}>提交强化输入</PixelButton>
            </div>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="page-stack" style={{ gap: 12 }}>
            <div className="summary-box">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {isFocusMode ? "专项复习完成" : "复习完成"}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {isFocusMode
                  ? "重点句已完成一轮回炉，返回首页继续今天的主任务。"
                  : "今日复习队列已完成，返回首页查看更新后的数据。"}
              </p>
            </div>
            <div className="split-actions">
              <PixelButton href="/" variant="secondary">
                返回首页
              </PixelButton>
            </div>
          </div>
        ) : null}
      </div>
    </PixelCard>
  );
}
