import type { AppStorageState, ReviewItem } from "@/lib/types/storage";

function sortByContentId(left: ReviewItem, right: ReviewItem): number {
  return left.contentId.localeCompare(right.contentId);
}

export function isFavoritedReviewItem(item: ReviewItem): boolean {
  return item.isFavorited;
}

export function isDepartureEligibleReviewItem(item: ReviewItem): boolean {
  return item.isFavorited || item.isCore;
}

export function isDepartureReadyReviewItem(item: ReviewItem): boolean {
  return Boolean(item.stepState.verifyCompletedAt) && isDepartureEligibleReviewItem(item);
}

export function getFavoritedReviewItems(storage: AppStorageState): ReviewItem[] {
  return Object.values(storage.reviewItems)
    .filter(isFavoritedReviewItem)
    .sort(sortByContentId);
}

export function getDepartureReadyReviewItems(storage: AppStorageState): ReviewItem[] {
  return Object.values(storage.reviewItems)
    .filter(isDepartureReadyReviewItem)
    .sort(sortByContentId);
}

export function toggleFavoriteReviewItem(
  draft: AppStorageState,
  contentId: string
): boolean {
  const item = draft.reviewItems[contentId];

  if (!item) {
    return false;
  }

  item.isFavorited = !item.isFavorited;
  return item.isFavorited;
}
