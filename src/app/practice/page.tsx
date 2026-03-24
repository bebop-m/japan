import { PixelHeading } from "@/components/pixel-heading";
import { PracticeSession } from "@/components/practice-session";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function PracticePage() {
  return (
    <div className="page-stack">
      <PixelHeading kicker="练习" title="速度训练" />
      <PracticeSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
