import { DepartureSession } from "@/components/departure-session";
import { PixelHeading } from "@/components/pixel-heading";
import { getAllPhraseCards, getAllWordCards, getSceneSummaries } from "@/lib/content";

export default function DeparturePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="出发模式"
        title="出发前只冲刺最需要带走的句子。"
        description="这里不是全库随机练习，而是收藏句、核心句和近期高错句的临行冲刺。"
      />
      <DepartureSession
        scenes={getSceneSummaries()}
        phraseCards={getAllPhraseCards()}
        wordCards={getAllWordCards()}
      />
    </div>
  );
}
