import { notFound } from "next/navigation";
import { LessonList } from "@/components/lesson-list";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllScenes, getScene } from "@/lib/content";
import type { SceneId } from "@/lib/types/content";

const sceneNameMap: Record<SceneId, string> = {
  airport: "机场",
  hotel: "酒店",
  izakaya: "居酒屋",
  shopping: "购物"
};

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
        kicker={`${scene.code} / ${sceneNameMap[sceneId]}`}
        title={`${scene.icon} ${sceneNameMap[sceneId]}`}
        description={scene.description}
      />

      <PixelCard>
        <div className="stat-grid">
          <div className="stat-box">
            <span className="stat-label">课</span>
            <strong className="stat-value">{scene.lessonCount}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">句</span>
            <strong className="stat-value">{scene.sentenceCount}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">单词库</span>
            <strong className="stat-value">{scene.wordBank.length}</strong>
          </div>
        </div>
      </PixelCard>

      <section className="page-stack">
        <div className="split-actions">
          <PixelButton href="/">返回首页</PixelButton>
          <PixelButton href="/speech-lab" variant="secondary">
            发音测试
          </PixelButton>
        </div>
        <LessonList scene={scene} />
      </section>
    </div>
  );
}
