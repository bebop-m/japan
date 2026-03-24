import { getAllScenes } from "@/lib/content";
import type { DailyCheckQuestion } from "@/lib/learn/daily-check";
import { createBookProgress } from "@/lib/storage/defaults";
import type {
  DialogueTurn,
  PhraseCard,
  RubyToken,
  SceneDefinition,
  SceneId,
  WordCard
} from "@/lib/types/content";
import type {
  AppStorageState,
  BookProgress,
  BookStudyType,
  ReviewItem
} from "@/lib/types/storage";

export interface PhraseBookEntry {
  id: string;
  kind: "phrase";
  sceneId: SceneId;
  lessonId: string;
  promptZh: string;
  answerJa: string;
  kana: string;
  ruby: RubyToken[];
  isCore: boolean;
  learnerTurn: DialogueTurn;
  partnerTurn: DialogueTurn;
}

export interface WordBookEntry {
  id: string;
  kind: "word";
  sceneId: SceneId;
  lessonId: string | null;
  promptZh: string;
  answerJa: string;
  kana: string;
  ruby: RubyToken[];
  tags: string[];
}

export type SceneBookEntry = PhraseBookEntry | WordBookEntry;

function createPhraseEntry(card: PhraseCard): PhraseBookEntry {
  return {
    id: card.id,
    kind: "phrase",
    sceneId: card.sceneId,
    lessonId: card.lessonId,
    promptZh: card.turns[0].zh,
    answerJa: card.turns[0].ja,
    kana: card.turns[0].kana,
    ruby: card.turns[0].ruby,
    isCore: card.isCore,
    learnerTurn: card.turns[0],
    partnerTurn: card.turns[1]
  };
}

function createWordEntry(card: WordCard): WordBookEntry {
  return {
    id: card.id,
    kind: "word",
    sceneId: card.sceneId,
    lessonId: card.lessonId,
    promptZh: card.zh,
    answerJa: card.ja,
    kana: card.kana,
    ruby: card.ruby,
    tags: card.tags
  };
}

export function getSceneSentenceEntries(scene: SceneDefinition): PhraseBookEntry[] {
  return scene.lessons.flatMap((lesson) => lesson.cards.map((card) => createPhraseEntry(card)));
}

export function getSceneWordEntries(scene: SceneDefinition): WordBookEntry[] {
  return [
    ...scene.lessons.flatMap((lesson) => lesson.wordBank.map((card) => createWordEntry(card))),
    ...scene.wordBank.map((card) => createWordEntry(card))
  ];
}

export function getSceneMixedEntries(scene: SceneDefinition): SceneBookEntry[] {
  const entries: SceneBookEntry[] = [];

  for (const lesson of scene.lessons) {
    entries.push(...lesson.cards.map((card) => createPhraseEntry(card)));
    entries.push(...lesson.wordBank.map((card) => createWordEntry(card)));
  }

  entries.push(...scene.wordBank.map((card) => createWordEntry(card)));

  return entries;
}

export function getSceneBookEntries(
  scene: SceneDefinition,
  type: BookStudyType
): SceneBookEntry[] {
  if (type === "sentence") {
    return getSceneSentenceEntries(scene);
  }

  if (type === "word") {
    return getSceneWordEntries(scene);
  }

  return getSceneMixedEntries(scene);
}

function isCheckedReviewItem(item: ReviewItem | undefined): boolean {
  return Boolean(item && item.dailyCheckScore !== null);
}

function findLeadingCheckedCount(
  entries: SceneBookEntry[],
  storage: AppStorageState
): number {
  let cursor = 0;

  while (cursor < entries.length) {
    const item = storage.reviewItems[entries[cursor].id];

    if (!isCheckedReviewItem(item)) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

export function getBookCursor(progress: BookProgress, type: BookStudyType): number {
  if (type === "sentence") {
    return progress.currentIndex;
  }

  if (type === "word") {
    return progress.currentWordIndex;
  }

  return progress.currentMixedIndex;
}

export function getSceneBookProgress(
  storage: AppStorageState,
  sceneId: SceneId
): BookProgress {
  return storage.bookProgressByScene[sceneId] ?? createBookProgress(sceneId);
}

export function getSceneBookAvailableCount(
  scene: SceneDefinition,
  storage: AppStorageState,
  type: BookStudyType
): number {
  const entries = getSceneBookEntries(scene, type);
  const progress = getSceneBookProgress(storage, scene.id);

  return Math.max(entries.length - getBookCursor(progress, type), 0);
}

export function getSceneSentenceProgress(scene: SceneDefinition, storage: AppStorageState): {
  current: number;
  total: number;
} {
  const entries = getSceneSentenceEntries(scene);
  const progress = getSceneBookProgress(storage, scene.id);

  return {
    current: progress.currentIndex,
    total: entries.length
  };
}

export function getSceneBookBatch(
  scene: SceneDefinition,
  storage: AppStorageState,
  type: BookStudyType,
  count: number
): SceneBookEntry[] {
  const entries = getSceneBookEntries(scene, type);
  const progress = getSceneBookProgress(storage, scene.id);
  const cursor = getBookCursor(progress, type);

  return entries.slice(cursor, cursor + count);
}

export function syncBookProgressWithReviewItems(state: AppStorageState): AppStorageState {
  const next: AppStorageState = {
    ...state,
    bookProgressByScene: {
      ...state.bookProgressByScene
    }
  };

  for (const scene of getAllScenes()) {
    const previous = next.bookProgressByScene[scene.id] ?? createBookProgress(scene.id);
    const currentIndex = findLeadingCheckedCount(getSceneSentenceEntries(scene), next);
    const currentWordIndex = findLeadingCheckedCount(getSceneWordEntries(scene), next);
    const currentMixedIndex = findLeadingCheckedCount(getSceneMixedEntries(scene), next);

    next.bookProgressByScene[scene.id] = {
      ...previous,
      sceneId: scene.id,
      currentIndex,
      currentWordIndex,
      currentMixedIndex
    };
  }

  return next;
}

export function markBookBatchProgress(
  state: AppStorageState,
  sceneId: SceneId,
  type: BookStudyType,
  count: number
): AppStorageState {
  const synced = syncBookProgressWithReviewItems(state);
  const progress = synced.bookProgressByScene[sceneId] ?? createBookProgress(sceneId);

  return {
    ...synced,
    bookProgressByScene: {
      ...synced.bookProgressByScene,
      [sceneId]: {
        ...progress,
        lastBatchType: type,
        lastBatchSize: count,
        updatedAt: new Date().toISOString()
      }
    }
  };
}

export function getCurrentBookSceneId(
  storage: AppStorageState,
  scenes: Pick<SceneDefinition, "id">[]
): SceneId {
  const unfinished = getAllScenes().find((scene) => {
    const progress = getSceneBookProgress(storage, scene.id);

    return progress.currentIndex < getSceneSentenceEntries(scene).length;
  });

  if (unfinished) {
    return unfinished.id;
  }

  return storage.session.activeSceneId ?? scenes[0]?.id ?? "airport";
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function pickOptions(values: string[], answer: string): string[] {
  const unique = Array.from(new Set(values.filter((value) => value !== answer)));
  const distractors = shuffle(unique).slice(0, 3);

  return shuffle([answer, ...distractors]);
}

function getKanaHint(entry: SceneBookEntry): string | null {
  const firstToken = entry.kana.split(/[、。？！\s]/).find(Boolean);

  return firstToken ?? null;
}

export function buildBookDailyCheckQuestions(entries: SceneBookEntry[]): DailyCheckQuestion[] {
  const sample = shuffle(entries).slice(0, Math.min(8, entries.length));
  const allTranslations = entries.map((entry) => entry.promptZh);

  return sample.map((entry, index) => {
    const pattern = index % 3;

    if (pattern === 0) {
      return {
        id: `${entry.id}-listen`,
        type: "listen-choice",
        prompt: "听音选义",
        audioText: entry.answerJa,
        options: pickOptions(allTranslations, entry.promptZh),
        answer: entry.promptZh
      };
    }

    if (entry.kind === "word" || pattern === 1) {
      return {
        id: `${entry.id}-translate`,
        type: "translate-input",
        prompt: entry.promptZh,
        answer: entry.answerJa,
        hint: getKanaHint(entry)
      };
    }

    return {
      id: `${entry.id}-reply`,
      type: "reply-input",
      prompt: entry.learnerTurn.ja,
      promptKana: entry.learnerTurn.kana,
      promptZh: entry.learnerTurn.zh,
      answer: entry.partnerTurn.ja,
      answerZh: entry.partnerTurn.zh
    };
  });
}
