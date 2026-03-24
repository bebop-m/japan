import { ReviewLaunchPanel } from "@/components/review-launch-panel";
import { PixelHeading } from "@/components/pixel-heading";
import { ReviewSession } from "@/components/review-session";
import { getAllPhraseCards } from "@/lib/content";

interface ReviewPageProps {
  searchParams?: {
    focus?: string;
    play?: string;
  };
}

export default function ReviewPage({ searchParams }: ReviewPageProps) {
  const isFocusMode = searchParams?.focus === "1";
  const isPlaying = searchParams?.play === "1";

  if (!isPlaying) {
    return (
      <div className="compact-page">
        <ReviewLaunchPanel />
      </div>
    );
  }

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
