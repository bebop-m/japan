import { PixelHeading } from "@/components/pixel-heading";
import { PracticeSession } from "@/components/practice-session";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function PracticePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="练习模式"
        title="用全场景随机抽题拉高输出速度。"
        description="这里是速度训练场：对已学句子做严格匹配，答错自动重练，但不改 SRS 间隔。"
      />
      <PracticeSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
