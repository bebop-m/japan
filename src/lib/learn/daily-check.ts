import type { DialogueTurn, LessonDefinition } from "@/lib/types/content";

export type DailyCheckQuestion =
  | {
      id: string;
      type: "listen-choice";
      prompt: string;
      audioText: string;
      options: string[];
      answer: string;
    }
  | {
      id: string;
      type: "translate-input";
      prompt: string;
      answer: string;
      hint: string | null;
    }
  | {
      id: string;
      type: "reply-input";
      prompt: string;
      promptKana: string;
      promptZh: string;
      answer: string;
      answerZh: string;
    };

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

function getHint(turn: DialogueTurn): string | null {
  const firstWord = turn.kana.split(/[、。？！\s]/).find(Boolean);
  return firstWord ? `First word hint: ${firstWord}` : null;
}

export function buildDailyCheckQuestions(lesson: LessonDefinition): DailyCheckQuestion[] {
  const cards = shuffle(lesson.cards).slice(0, Math.min(8, lesson.cards.length));
  const allTranslations = lesson.cards.flatMap((card) => card.turns.map((turn) => turn.zh));

  return cards.map((card, index) => {
    const learnerTurn = card.turns[0];
    const partnerTurn = card.turns[1];
    const pattern = index % 3;

    if (pattern === 0) {
      const target = index % 2 === 0 ? learnerTurn : partnerTurn;

      return {
        id: `${card.id}-listen`,
        type: "listen-choice",
        prompt: "Listen to the audio and choose the correct Chinese meaning.",
        audioText: target.ja,
        options: pickOptions(allTranslations, target.zh),
        answer: target.zh
      };
    }

    if (pattern === 1) {
      return {
        id: `${card.id}-translate`,
        type: "translate-input",
        prompt: learnerTurn.zh,
        answer: learnerTurn.ja,
        hint: getHint(learnerTurn)
      };
    }

    return {
      id: `${card.id}-reply`,
      type: "reply-input",
      prompt: learnerTurn.ja,
      promptKana: learnerTurn.kana,
      promptZh: learnerTurn.zh,
      answer: partnerTurn.ja,
      answerZh: partnerTurn.zh
    };
  });
}
