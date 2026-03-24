import { DashboardShell } from "@/components/dashboard-shell";
import { getAllScenes, getSceneSummaries } from "@/lib/content";

export default function HomePage() {
  const lessonTitleMap = Object.fromEntries(
    getAllScenes().flatMap((scene) => scene.lessons.map((lesson) => [lesson.id, lesson.title]))
  );

  return <DashboardShell scenes={getSceneSummaries()} lessonTitleMap={lessonTitleMap} />;
}
