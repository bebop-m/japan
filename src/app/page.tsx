import { DashboardShell } from "@/components/dashboard-shell";
import { PixelHeading } from "@/components/pixel-heading";
import { getSceneSummaries } from "@/lib/content";

export default function HomePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="Solo Trip Pixel PWA"
        title="Build the travel mouth muscle."
        description="Phase 6 adds Departure mode and favorites, while home keeps surfacing live review, next lesson, mastery, and sprint-ready counts."
      />
      <DashboardShell scenes={getSceneSummaries()} />
    </div>
  );
}
