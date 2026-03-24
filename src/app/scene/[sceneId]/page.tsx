import { notFound } from "next/navigation";
import { LessonList } from "@/components/lesson-list";
import { PixelButton } from "@/components/pixel-button";
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
      <div className="page-stack" style={{ gap: 6 }}>
        <h2 className="section-title">
          {scene.icon} {sceneNameMap[sceneId]}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {scene.description}
        </p>
      </div>

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
