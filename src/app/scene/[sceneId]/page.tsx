import { notFound } from "next/navigation";
import { LessonList } from "@/components/lesson-list";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllScenes, getScene } from "@/lib/content";
import type { SceneId } from "@/lib/types/content";

interface ScenePageProps {
  params: {
    sceneId: string;
  };
}

export function generateStaticParams() {
  return getAllScenes().map((scene) => ({
    sceneId: scene.id
  }));
}

export default function ScenePage({ params }: ScenePageProps) {
  const sceneId = params.sceneId as SceneId;

  if (!["airport", "hotel", "izakaya", "shopping"].includes(sceneId)) {
    notFound();
  }

  const scene = getScene(sceneId);

  return (
    <div className="page-stack">
      <PixelHeading
        kicker={`${scene.code} / ${scene.shortLabel}`}
        title={`${scene.icon} ${scene.label}`}
        description={scene.description}
      />

      <PixelCard>
        <div className="stat-grid">
          <div className="stat-box">
            <span className="stat-label">Lessons</span>
            <strong className="stat-value">{scene.lessonCount}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Sentences</span>
            <strong className="stat-value">{scene.sentenceCount}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Word Bank</span>
            <strong className="stat-value">{scene.wordBank.length}</strong>
          </div>
        </div>
      </PixelCard>

      <section className="page-stack">
        <div className="split-actions">
          <PixelButton href="/">BACK HOME</PixelButton>
          <PixelButton href="/speech-lab" variant="secondary">
            TEST SPEECH PATH
          </PixelButton>
        </div>
        <LessonList scene={scene} />
      </section>
    </div>
  );
}
