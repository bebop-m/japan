import { notFound } from "next/navigation";
import { SceneGatewayPanel } from "@/components/scene-gateway-panel";
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
    <div className="compact-page">
      <SceneGatewayPanel scene={scene} />
    </div>
  );
}
