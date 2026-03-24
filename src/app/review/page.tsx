import { PixelHeading } from "@/components/pixel-heading";
import { ReviewSession } from "@/components/review-session";
import { getAllPhraseCards } from "@/lib/content";

export default function ReviewPage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="SRS 间隔复习"
        title="复习今天到期的句子。"
        description="再来 重置为1天，模糊 保持间隔，认识 间隔翻倍。连续两次再来触发强化输入。"
      />
      <ReviewSession cards={getAllPhraseCards()} />
    </div>
  );
}
