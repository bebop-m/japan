import fs from "node:fs/promises";
import path from "node:path";
import airport from "./content-source/airport.mjs";
import hotel from "./content-source/hotel.mjs";
import izakaya from "./content-source/izakaya.mjs";
import shopping from "./content-source/shopping.mjs";

const scenes = [airport, hotel, izakaya, shopping];

function parseRubyLine(line) {
  const pattern = /\[([^|\]]+)\|([^\]]+)\]/g;
  const ruby = [];
  let cursor = 0;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const [raw, base, reading] = match;
    const start = match.index;

    if (start > cursor) {
      ruby.push({
        type: "text",
        text: line.slice(cursor, start)
      });
    }

    ruby.push({
      type: "ruby",
      base,
      reading
    });

    cursor = start + raw.length;
  }

  if (cursor < line.length) {
    ruby.push({
      type: "text",
      text: line.slice(cursor)
    });
  }

  const ja = line.replace(pattern, (_, base) => base);
  const kana = line.replace(pattern, (_, __, reading) => reading);

  return {
    ja,
    kana,
    ruby
  };
}

function buildWord(sceneId, lessonId, source) {
  const parsed = parseRubyLine(source.line);

  return {
    id: source.id,
    sceneId,
    lessonId,
    type: "word",
    ...parsed,
    zh: source.zh,
    tags: source.tags
  };
}

function buildScene(scene) {
  const lessons = scene.lessons.map((lesson, index) => {
    const cards = lesson.cards.map((entry) => ({
      id: entry.id,
      sceneId: scene.id,
      lessonId: lesson.id,
      type: "dialogue",
      isCore: entry.isCore,
      coachNote: entry.coachNote,
      tags: entry.tags,
      turns: entry.turns.map((turn, turnIndex) => {
        const parsed = parseRubyLine(turn.line);

        return {
          id: `${entry.id}-T${turnIndex + 1}`,
          role: turn.role,
          ...parsed,
          zh: turn.zh,
          audioKey: `${entry.id.toLowerCase()}-t${turnIndex + 1}`
        };
      })
    }));

    return {
      id: lesson.id,
      code: lesson.code,
      title: lesson.title,
      order: index + 1,
      overview: lesson.overview,
      cards,
      wordBank: lesson.wordBank.map((word) => buildWord(scene.id, lesson.id, word))
    };
  });

  const sceneWordBank = scene.wordBank.map((word) => buildWord(scene.id, null, word));
  const sentenceCount = lessons.reduce(
    (total, lesson) => total + lesson.cards.reduce((sum, card) => sum + card.turns.length, 0),
    0
  );

  return {
    id: scene.id,
    code: scene.code,
    label: scene.label,
    shortLabel: scene.shortLabel,
    icon: scene.icon,
    description: scene.description,
    lessonCount: lessons.length,
    sentenceCount,
    lessons,
    wordBank: sceneWordBank
  };
}

async function main() {
  const outputDir = path.join(process.cwd(), "src", "content", "scenes");
  const catalogPath = path.join(process.cwd(), "src", "content", "storage-catalog.json");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });

  const catalog = {
    version: 1,
    reviewSeeds: [],
    lessonSeeds: []
  };

  for (const scene of scenes) {
    const built = buildScene(scene);
    const filePath = path.join(outputDir, `${scene.id}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(built, null, 2)}\n`, "utf8");

    for (const lesson of built.lessons) {
      catalog.lessonSeeds.push({
        lessonId: lesson.id,
        sceneId: built.id,
        order: lesson.order,
        cardCount: lesson.cards.length
      });

      for (const card of lesson.cards) {
        catalog.reviewSeeds.push({
          contentId: card.id,
          contentType: "phrase",
          sceneId: built.id,
          lessonId: lesson.id,
          isCore: card.isCore
        });
      }
    }
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
