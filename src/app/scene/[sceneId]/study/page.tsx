import { notFound } from "next/navigation";
import { BookSession } from "@/components/book-session";
import { getAllScenes, getScene } from "@/lib/content";
import type { BookStudyType } from "@/lib/types/storage";
import type { SceneId } from "@/lib/types/content";

interface SceneStudyPageProps {
  params: {
    sceneId: string;
  };
  searchParams?: {
    type?: string;
    count?: string;
  };
}

const validTypes: BookStudyType[] = ["sentence", "word", "mixed"];
const validCounts = [5, 10, 20];

export function generateStaticParams() {
  return getAllScenes().map((scene) => ({
    sceneId: scene.id
  }));
}

export default function SceneStudyPage({ params, searchParams }: SceneStudyPageProps) {
  const sceneId = params.sceneId as SceneId;

  if (!["airport", "hotel", "izakaya", "shopping"].includes(sceneId)) {
    notFound();
  }

  const type = validTypes.includes((searchParams?.type ?? "") as BookStudyType)
    ? (searchParams?.type as BookStudyType)
    : "sentence";
  const countValue = Number.parseInt(searchParams?.count ?? "5", 10);
  const count = validCounts.includes(countValue) ? countValue : 5;
  const scene = getScene(sceneId);

  return <BookSession scene={scene} bookType={type} count={count} />;
}
