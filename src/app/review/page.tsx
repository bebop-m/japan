import { PixelHeading } from "@/components/pixel-heading";
import { ReviewSession } from "@/components/review-session";
import { getAllPhraseCards } from "@/lib/content";

interface ReviewPageProps {
  searchParams?: {
    focus?: string;
  };
}

export default function ReviewPage({ searchParams }: ReviewPageProps) {
  const isFocusMode = searchParams?.focus === "1";

  return (
    <div className="page-stack">
      <PixelHeading
        kicker={isFocusMode ? "专项复习" : "SRS 间隔复习"}
        title={isFocusMode ? "优先回炉近期反复出错的句子。" : "复习今天到期的句子。"}
        description={
          isFocusMode
            ? "这些句子会在普通复习队列中优先出现。专项复习同样会更新 SRS 间隔。"
            : "再来 重置为1天，模糊 保持间隔，认识 间隔翻倍。连续两次再来触发强化输入。"
        }
      />
      <ReviewSession cards={getAllPhraseCards()} mode={isFocusMode ? "focus" : "due"} />
    </div>
  );
}
