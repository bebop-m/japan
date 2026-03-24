import fs from "node:fs/promises";
import path from "node:path";

const sceneIds = ["airport", "hotel", "izakaya", "shopping"];

async function main() {
  const baseDir = path.join(process.cwd(), "src", "content", "scenes");
  let totalSentences = 0;
  let totalCards = 0;

  for (const sceneId of sceneIds) {
    const raw = await fs.readFile(path.join(baseDir, `${sceneId}.json`), "utf8");
    const scene = JSON.parse(raw);
    const lessonCount = scene.lessons.length;
    const cardCount = scene.lessons.reduce((sum, lesson) => sum + lesson.cards.length, 0);
    const sentenceCount = scene.lessons.reduce(
      (sum, lesson) => sum + lesson.cards.reduce((inner, card) => inner + card.turns.length, 0),
      0
    );

    if (lessonCount !== 6) {
      throw new Error(`${sceneId} should have 6 lessons, got ${lessonCount}`);
    }

    if (sentenceCount !== 80) {
      throw new Error(`${sceneId} should have 80 sentences, got ${sentenceCount}`);
    }

    totalSentences += sentenceCount;
    totalCards += cardCount;
  }

  if (totalSentences !== 320) {
    throw new Error(`Expected 320 sentences total, got ${totalSentences}`);
  }

  console.log(`Validated ${sceneIds.length} scene files, ${totalCards} dialogue cards, ${totalSentences} sentences.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
