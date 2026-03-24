import { DepartureSession } from "@/components/departure-session";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function DeparturePage() {
  return (
    <div className="page-stack">
      <PixelHeading kicker="出发" title="临行冲刺" />
      <DepartureSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
