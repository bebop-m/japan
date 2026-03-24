export type SceneId = "airport" | "hotel" | "izakaya" | "shopping";

export type SceneCode = "S1" | "S2" | "S3" | "S4";

export type ContentType = "phrase" | "word";

export type DialogueRole = "learner" | "partner";

export type RubyToken =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "ruby";
      base: string;
      reading: string;
    };

export interface DialogueTurn {
  id: string;
  role: DialogueRole;
  ja: string;
  kana: string;
  ruby: RubyToken[];
  zh: string;
  audioKey: string | null;
}

export interface PhraseCard {
  id: string;
  sceneId: SceneId;
  lessonId: string;
  type: "dialogue";
  isCore: boolean;
  coachNote: string | null;
  tags: string[];
  turns: [DialogueTurn, DialogueTurn];
}

export interface WordCard {
  id: string;
  sceneId: SceneId;
  lessonId: string | null;
  type: "word";
  ja: string;
  kana: string;
  ruby: RubyToken[];
  zh: string;
  tags: string[];
}

export interface LessonDefinition {
  id: string;
  code: string;
  title: string;
  order: number;
  overview: string;
  cards: PhraseCard[];
  wordBank: WordCard[];
}

export interface SceneDefinition {
  id: SceneId;
  code: SceneCode;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  lessonCount: number;
  sentenceCount: number;
  lessons: LessonDefinition[];
  wordBank: WordCard[];
}

export interface SceneSummary {
  id: SceneId;
  code: SceneCode;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  lessonCount: number;
  cardCount: number;
  sentenceCount: number;
}
