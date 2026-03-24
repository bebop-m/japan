import airport from "@/content/scenes/airport.json";
import hotel from "@/content/scenes/hotel.json";
import izakaya from "@/content/scenes/izakaya.json";
import shopping from "@/content/scenes/shopping.json";
import type {
  LessonDefinition,
  PhraseCard,
  SceneDefinition,
  SceneId,
  SceneSummary,
  WordCard
} from "@/lib/types/content";

const airportScene = airport as unknown as SceneDefinition;
const hotelScene = hotel as unknown as SceneDefinition;
const izakayaScene = izakaya as unknown as SceneDefinition;
const shoppingScene = shopping as unknown as SceneDefinition;

const scenes = [airportScene, hotelScene, izakayaScene, shoppingScene];

export const sceneMap: Record<SceneId, SceneDefinition> = {
  airport: airportScene,
  hotel: hotelScene,
  izakaya: izakayaScene,
  shopping: shoppingScene
};

export function getSceneSummaries(): SceneSummary[] {
  return scenes.map((scene) => ({
    id: scene.id,
    code: scene.code,
    label: scene.label,
    shortLabel: scene.shortLabel,
    icon: scene.icon,
    description: scene.description,
    lessonCount: scene.lessonCount,
    cardCount: scene.lessons.reduce((total, lesson) => total + lesson.cards.length, 0),
    sentenceCount: scene.sentenceCount
  }));
}

export function getAllScenes(): SceneDefinition[] {
  return scenes;
}

export function getScene(sceneId: SceneId): SceneDefinition {
  return sceneMap[sceneId];
}

export function getLesson(sceneId: SceneId, lessonId: string): LessonDefinition | null {
  return sceneMap[sceneId].lessons.find((lesson) => lesson.id === lessonId) ?? null;
}

export function getAllPhraseCards(): PhraseCard[] {
  return scenes.flatMap((scene) => scene.lessons.flatMap((lesson) => lesson.cards));
}

export function getPhraseCardById(contentId: string): PhraseCard | null {
  return getAllPhraseCards().find((card) => card.id === contentId) ?? null;
}

export function getAllWordCards(): WordCard[] {
  const wordMap = new Map<string, WordCard>();

  for (const scene of scenes) {
    for (const card of scene.wordBank) {
      wordMap.set(card.id, card);
    }

    for (const lesson of scene.lessons) {
      for (const card of lesson.wordBank) {
        wordMap.set(card.id, card);
      }
    }
  }

  return [...wordMap.values()];
}
