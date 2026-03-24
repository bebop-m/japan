import { PixelHeading } from "@/components/pixel-heading";
import { PracticeSession } from "@/components/practice-session";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function PracticePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="Phase 4 / Practice"
        title="Drill learned lines until they are exact."
        description="Practice runs on learned items only, uses strict Japanese input matching, and loops every mistake back until the round is clean."
      />
      <PracticeSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
