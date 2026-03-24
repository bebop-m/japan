import { DepartureSession } from "@/components/departure-session";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function DeparturePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="出发模式"
        title="出发前冲刺演练最需要的句子。"
        description="仅使用收藏句和核心句，中文提示日文回答，答错循环重练直到全部正确。"
      />
      <DepartureSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
