/** Random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Sold 9–69; reviews ≤ sold; rating 4.0–5.0 (min 4 stars). */
export function randomProductStats(): { sold: number; reviews: number; rating: number } {
  const sold = randomInt(9, 69);
  const reviews = randomInt(Math.min(3, sold), sold);
  const rating = Math.round((4 + Math.random()) * 10) / 10;
  return { sold, reviews, rating };
}

/** Star distribution (5→1) for aggregate rating + review count — no per-review rows. */
export function synthesizeRatingDistribution(
  avgRating: number,
  reviewCount: number,
): { star: number; count: number; pct: number }[] {
  if (reviewCount <= 0) {
    return [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 }));
  }

  const clamped = Math.min(5, Math.max(4, avgRating));
  const weights = [5, 4, 3, 2, 1].map((star) => {
    const distance = Math.abs(star - clamped);
    return Math.max(0.05, 1.6 - distance * 0.75);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const counts = weights.map((w) => Math.floor((w / totalWeight) * reviewCount));
  let remainder = reviewCount - counts.reduce((sum, c) => sum + c, 0);
  const order = [4, 5, 3, 2, 1];
  let i = 0;
  while (remainder > 0) {
    counts[5 - order[i % order.length]] += 1;
    remainder -= 1;
    i += 1;
  }

  return [5, 4, 3, 2, 1].map((star, idx) => {
    const count = counts[5 - star];
    return {
      star,
      count,
      pct: Math.round((count / reviewCount) * 100),
    };
  });
}
