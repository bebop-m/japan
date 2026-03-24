import { PixelHeading } from "@/components/pixel-heading";
import { PracticeSession } from "@/components/practice-session";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function PracticePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="练习模式"
        title="对已学句子进行精准练习。"
        description="仅练习已完成第五步的句子，严格匹配日文，答错自动进入重练轮，不影响SRS间隔。"
      />
      <PracticeSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
