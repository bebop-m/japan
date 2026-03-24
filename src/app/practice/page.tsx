import { PixelHeading } from "@/components/pixel-heading";
import { PracticeLaunchPanel } from "@/components/practice-launch-panel";
import { PracticeSession } from "@/components/practice-session";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

interface PracticePageProps {
  searchParams?: {
    play?: string;
  };
}

export default function PracticePage({ searchParams }: PracticePageProps) {
  const isPlaying = searchParams?.play === "1";

  if (!isPlaying) {
    return (
      <div className="compact-page">
        <PracticeLaunchPanel
          phraseCards={getAllPhraseCards()}
          wordCards={getAllWordCards()}
        />
      </div>
    );
  }

  return (
    <div className="compact-page">
      <PixelHeading kicker="练习" title="速度训练" />
      <PracticeSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
