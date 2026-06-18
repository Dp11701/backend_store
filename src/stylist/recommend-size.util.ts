export interface MeasurementInput {
  height: number;
  bust: number;
  waist: number;
  hip: number;
}

export interface SizeChartRowInput {
  size: string;
  bust: number;
  waist: number;
  hip: number;
  heightMin: number;
  heightMax: number;
}

export type SizeConfidence = 'high' | 'medium' | 'low';

export interface SizeRecommendationResult {
  recommendedSize: string;
  alternateSize?: string;
  confidence: SizeConfidence;
  /** Khoảng cách điểm so với size thứ hai (càng lớn càng chắc) */
  scoreGap: number;
  scores: { size: string; score: number }[];
}

function heightPenalty(height: number, min: number, max: number): number {
  if (height < min) return (min - height) * 0.6;
  if (height > max) return (height - max) * 0.6;
  return 0;
}

/** Điểm càng thấp càng khớp */
export function scoreSizeRow(measurements: MeasurementInput, row: SizeChartRowInput): number {
  return (
    Math.abs(measurements.bust - row.bust) * 1.2 +
    Math.abs(measurements.waist - row.waist) * 1.0 +
    Math.abs(measurements.hip - row.hip) * 1.1 +
    heightPenalty(measurements.height, row.heightMin, row.heightMax)
  );
}

export function recommendSize(
  measurements: MeasurementInput,
  chartRows: SizeChartRowInput[],
  availableSizes: string[],
): SizeRecommendationResult {
  const allowed = new Set(availableSizes.map((s) => s.trim().toUpperCase()));
  const candidates = chartRows.filter((row) => {
    if (allowed.size === 0) return true;
    return allowed.has(row.size.trim().toUpperCase());
  });

  if (candidates.length === 0) {
    throw new Error('no_size_candidates');
  }

  const scored = candidates
    .map((row) => ({ size: row.size, score: scoreSizeRow(measurements, row) }))
    .sort((a, b) => a.score - b.score);

  const best = scored[0];
  const second = scored[1];
  const scoreGap = second ? second.score - best.score : 99;

  let confidence: SizeConfidence = 'low';
  if (best.score <= 8 && scoreGap >= 6) confidence = 'high';
  else if (best.score <= 14 && scoreGap >= 3) confidence = 'medium';

  return {
    recommendedSize: best.size,
    alternateSize: second && scoreGap < 6 ? second.size : undefined,
    confidence,
    scoreGap,
    scores: scored,
  };
}

export function buildFallbackAdvice(
  productTitle: string,
  measurements: MeasurementInput,
  result: SizeRecommendationResult,
): string {
  const alt = result.alternateSize
    ? ` Nếu bạn thích ôm hơn, có thể thử size ${result.alternateSize}.`
    : '';
  return (
    `Với số đo cao ${measurements.height}cm, ngực ${measurements.bust}cm, eo ${measurements.waist}cm, hông ${measurements.hip}cm, ` +
    `size ${result.recommendedSize} phù hợp nhất cho "${productTitle}".${alt} ` +
    `Đây là gợi ý tham khảo — bạn vẫn nên xem bảng size trước khi đặt hàng.`
  );
}
