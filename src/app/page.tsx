import { DashboardShell } from "@/components/dashboard-shell";
import { getSceneSummaries } from "@/lib/content";

export default function HomePage() {
  return <DashboardShell scenes={getSceneSummaries()} />;
}
