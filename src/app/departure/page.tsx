import { DepartureLaunchPanel } from "@/components/departure-launch-panel";
import { DepartureSession } from "@/components/departure-session";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

interface DeparturePageProps {
  searchParams?: {
    play?: string;
  };
}

export default function DeparturePage({ searchParams }: DeparturePageProps) {
  const isPlaying = searchParams?.play === "1";

  if (!isPlaying) {
    return (
      <div className="compact-page">
        <DepartureLaunchPanel />
      </div>
    );
  }

  return (
    <div className="compact-page">
      <PixelHeading kicker="出发" title="临行冲刺" />
      <DepartureSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
