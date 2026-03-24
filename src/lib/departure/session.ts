import type { PhraseCard, RubyToken, WordCard } from "@/lib/types/content";
import { isSpotlightReviewItem } from "@/lib/review/srs";
import { isDepartureReadyReviewItem } from "@/lib/storage/favorites";
import type { AppStorageState, ReviewItem } from "@/lib/types/storage";

export interface DeparturePrompt {
  id: string;
  sourceId: string;
  contentType: "phrase" | "word";
  sceneId: ReviewItem["sceneId"];
  lessonId: string | null;
  promptZh: string;
  answerJa: string;
  kana: string;
  ruby: RubyToken[];
  label: string;
  isFavorited: boolean;
  isCore: boolean;
  isSpotlight: boolean;
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

function sortByPriority(left: ReviewItem, right: ReviewItem): number {
  if (left.isFavorited !== right.isFavorited) {
    return left.isFavorited ? -1 : 1;
  }

  if (left.isCore !== right.isCore) {
    return left.isCore ? -1 : 1;
  }

  const leftSpotlight = isSpotlightReviewItem(left);
  const rightSpotlight = isSpotlightReviewItem(right);

  if (leftSpotlight !== rightSpotlight) {
    return leftSpotlight ? -1 : 1;
  }

  return left.contentId.localeCompare(right.contentId);
}

function buildPhrasePrompts(storage: AppStorageState, phraseCards: PhraseCard[]): DeparturePrompt[] {
  const cardMap = Object.fromEntries(phraseCards.map((card) => [card.id, card]));

  return Object.values(storage.reviewItems)
    .filter(
      (item) =>
        item.contentType === "phrase" &&
        (isDepartureReadyReviewItem(item) || isSpotlightReviewItem(item))
    )
    .sort(sortByPriority)
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
        label: turn.role === "learner" ? "YOU SAY" : "PARTNER SAYS",
        isFavorited: item.isFavorited,
        isCore: item.isCore,
        isSpotlight: isSpotlightReviewItem(item)
      }));
    });
}

function buildWordPrompts(storage: AppStorageState, wordCards: WordCard[]): DeparturePrompt[] {
  const cardMap = Object.fromEntries(wordCards.map((card) => [card.id, card]));

  return Object.values(storage.reviewItems)
    .filter((item) => item.contentType === "word" && isDepartureReadyReviewItem(item))
    .sort(sortByPriority)
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
          label: "WORD BANK",
          isFavorited: item.isFavorited,
          isCore: item.isCore,
          isSpotlight: false
        }
      ];
    });
}

export function buildDeparturePool(
  storage: AppStorageState,
  phraseCards: PhraseCard[],
  wordCards: WordCard[]
): DeparturePrompt[] {
  return [
    ...buildPhrasePrompts(storage, phraseCards),
    ...buildWordPrompts(storage, wordCards)
  ];
}

export function pickDeparturePrompts(
  pool: DeparturePrompt[],
  count: number
): DeparturePrompt[] {
  if (pool.length === 0 || count <= 0) {
    return [];
  }

  const safeCount = Math.min(count, pool.length);
  const phrases = shuffle(pool.filter((prompt) => prompt.contentType === "phrase"));
  const words = shuffle(pool.filter((prompt) => prompt.contentType === "word"));

  if (phrases.length === 0) {
    return words.slice(0, safeCount);
  }

  const maxWordCount = Math.min(words.length, Math.floor(safeCount / 4));
  const selectedWords = words.slice(0, maxWordCount);
  const selectedPhrases = phrases.slice(0, Math.min(phrases.length, safeCount - selectedWords.length));
  const remaining = safeCount - selectedPhrases.length - selectedWords.length;

  if (remaining <= 0) {
    return shuffle([...selectedPhrases, ...selectedWords]);
  }

  const leftovers = shuffle([
    ...phrases.slice(selectedPhrases.length),
    ...words.slice(selectedWords.length)
  ]);

  return shuffle([...selectedPhrases, ...selectedWords, ...leftovers.slice(0, remaining)]);
}
