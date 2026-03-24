import { DepartureSession } from "@/components/departure-session";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function DeparturePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="Phase 6 / Departure"
        title="Sprint the lines you actually need before takeoff."
        description="Departure mode only pulls from favorited lines and isCore travel sentences, keeps the prompt fixed at Chinese to Japanese, and loops every miss back until the round is clean."
      />
      <DepartureSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
