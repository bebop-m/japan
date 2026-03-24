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
    <div className="compact-page">
      <PixelHeading
        kicker={isFocusMode ? "回炉" : "复习"}
        title={isFocusMode ? "重点强化" : "今日到期"}
      />
      <ReviewSession cards={getAllPhraseCards()} mode={isFocusMode ? "focus" : "due"} />
    </div>
  );
}
