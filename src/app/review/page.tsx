import { PixelHeading } from "@/components/pixel-heading";
import { ReviewSession } from "@/components/review-session";
import { getAllPhraseCards } from "@/lib/content";

export default function ReviewPage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="Phase 3 / SRS"
        title="Review what is due today."
        description="Again resets to 1 day, hard keeps the interval, and good doubles it. Two consecutive misses trigger strict reinforcement input."
      />
      <ReviewSession cards={getAllPhraseCards()} />
    </div>
  );
}
