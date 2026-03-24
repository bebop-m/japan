import type { PhraseCard, RubyToken, SceneId, WordCard } from "@/lib/types/content";
import type { AppStorageState, ReviewItem } from "@/lib/types/storage";

export type PracticeScope = "all" | SceneId;
export type PracticeType = "sentence" | "word" | "mixed";

export interface PracticePrompt {
  id: string;
  sourceId: string;
  contentType: "phrase" | "word";
  sceneId: SceneId;
  lessonId: string | null;
  promptZh: string;
  answerJa: string;
  kana: string;
  ruby: RubyToken[];
  label: string;
}

function isEligiblePracticeItem(item: ReviewItem): boolean {
  return Boolean(item.stepState.verifyCompletedAt);
}

function matchesScope(item: ReviewItem, scope: PracticeScope): boolean {
  return scope === "all" || item.sceneId === scope;
}

function buildPhrasePrompts(storage: AppStorageState, phraseCards: PhraseCard[], scope: PracticeScope) {
  const cardMap = Object.fromEntries(phraseCards.map((card) => [card.id, card]));

  return Object.values(storage.reviewItems)
    .filter(
      (item) =>
        item.contentType === "phrase" && isEligiblePracticeItem(item) && matchesScope(item, scope)
    )
    .sort((left, right) => left.contentId.localeCompare(right.contentId))
    .flatMap((item) => {
      const card = cardMap[item.contentId];

      if (!card) {
        return [];
      }

      return card.turns.map((turn, index) => ({
        id: `${card.id}:turn-${index + 1}`,
        sourceId: card.id,
        contentType: "phrase" as const,
        sceneId: card.sceneId,
        lessonId: card.lessonId,
        promptZh: turn.zh,
        answerJa: turn.ja,
        kana: turn.kana,
        ruby: turn.ruby,
        label: turn.role === "learner" ? "YOU SAY" : "PARTNER SAYS"
      }));
    });
}

function buildWordPrompts(storage: AppStorageState, wordCards: WordCard[], scope: PracticeScope) {
  const cardMap = Object.fromEntries(wordCards.map((card) => [card.id, card]));

  return Object.values(storage.reviewItems)
    .filter(
      (item) =>
        item.contentType === "word" && isEligiblePracticeItem(item) && matchesScope(item, scope)
    )
    .sort((left, right) => left.contentId.localeCompare(right.contentId))
    .flatMap((item) => {
      const card = cardMap[item.contentId];

      if (!card) {
        return [];
      }

      return [
        {
          id: card.id,
          sourceId: card.id,
          contentType: "word" as const,
          sceneId: card.sceneId,
          lessonId: card.lessonId,
          promptZh: card.zh,
          answerJa: card.ja,
          kana: card.kana,
          ruby: card.ruby,
          label: "WORD BANK"
        }
      ];
    });
}

export function buildPracticePool(
  storage: AppStorageState,
  phraseCards: PhraseCard[],
  wordCards: WordCard[],
  scope: PracticeScope,
  type: PracticeType
): PracticePrompt[] {
  const sentencePrompts = buildPhrasePrompts(storage, phraseCards, scope);
  const wordPrompts = buildWordPrompts(storage, wordCards, scope);

  if (type === "sentence") {
    return sentencePrompts;
  }

  if (type === "word") {
    return wordPrompts;
  }

  return [...sentencePrompts, ...wordPrompts];
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}

export function pickPracticePrompts(pool: PracticePrompt[], count: number): PracticePrompt[] {
  if (pool.length === 0 || count <= 0) {
    return [];
  }

  return shuffle(pool).slice(0, Math.min(count, pool.length));
}
