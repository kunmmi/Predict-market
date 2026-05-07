export const SHORT_DURATION_CUTOFF_SECONDS = 15;
export const SHORT_DURATION_HEAVY_REDUCTION_SECONDS = 30;

export type PredictionDirection = "up" | "down";
export type PredictionOutcome = PredictionDirection | "flat";
export type PredictionWarningLevel = "none" | "medium" | "high" | "closed";

export type RewardPreviewInput = {
  closesAt: string | number | Date;
  cutoffAt?: string | number | Date | null;
  now?: number;
  direction: PredictionDirection;
  confidencePrice?: number | null;
  currentSpotPrice?: number | null;
  openingSpotPrice?: number | null;
};

export type RewardPreview = {
  isClosed: boolean;
  secondsRemaining: number;
  cutoffSecondsRemaining: number;
  multiplier: number;
  warningLevel: PredictionWarningLevel;
  timeFactor: number;
  confidenceFactor: number;
  distanceFactor: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toEpochMs(value: string | number | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function roundMultiplier(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function getPredictionDirectionFromTradeSide(side: "yes" | "no"): PredictionDirection {
  return side === "yes" ? "up" : "down";
}

export function getShortDurationCutoffAt(closeAt: string | number | Date): Date {
  return new Date(toEpochMs(closeAt) - SHORT_DURATION_CUTOFF_SECONDS * 1_000);
}

function getTimeFactor(secondsRemaining: number): number {
  if (secondsRemaining <= SHORT_DURATION_CUTOFF_SECONDS) return 0;
  if (secondsRemaining <= SHORT_DURATION_HEAVY_REDUCTION_SECONDS) return 0.12;
  if (secondsRemaining <= 60) return 0.35;
  if (secondsRemaining <= 180) return 0.68;
  return 1;
}

function getConfidenceFactor(confidencePrice?: number | null): number {
  if (confidencePrice == null || !Number.isFinite(confidencePrice)) return 1;

  const confidence = clamp(confidencePrice, 0, 1);
  const obviousness = clamp((confidence - 0.5) / 0.5, 0, 1);

  return clamp(1 - obviousness * 0.72, 0.28, 1);
}

function getDistanceFactor(
  direction: PredictionDirection,
  currentSpotPrice?: number | null,
  openingSpotPrice?: number | null,
): number {
  if (
    currentSpotPrice == null ||
    openingSpotPrice == null ||
    !Number.isFinite(currentSpotPrice) ||
    !Number.isFinite(openingSpotPrice) ||
    openingSpotPrice <= 0
  ) {
    return 1;
  }

  const moveRatio =
    direction === "up"
      ? (currentSpotPrice - openingSpotPrice) / openingSpotPrice
      : (openingSpotPrice - currentSpotPrice) / openingSpotPrice;

  const obviousMove = Math.max(0, moveRatio);
  const normalizedMove = clamp(obviousMove / 0.01, 0, 1);

  return clamp(1 - normalizedMove * 0.55, 0.45, 1);
}

export function getRewardPreview(input: RewardPreviewInput): RewardPreview {
  const now = input.now ?? Date.now();
  const closesAtMs = toEpochMs(input.closesAt);
  const cutoffAtMs = input.cutoffAt ? toEpochMs(input.cutoffAt) : closesAtMs - SHORT_DURATION_CUTOFF_SECONDS * 1_000;

  const secondsRemaining = Math.max(0, Math.floor((closesAtMs - now) / 1_000));
  const cutoffSecondsRemaining = Math.max(0, Math.floor((cutoffAtMs - now) / 1_000));
  const isClosed = cutoffSecondsRemaining <= 0;

  const timeFactor = getTimeFactor(secondsRemaining);
  const confidenceFactor = getConfidenceFactor(input.confidencePrice);
  const distanceFactor = getDistanceFactor(
    input.direction,
    input.currentSpotPrice,
    input.openingSpotPrice,
  );

  const multiplier = isClosed ? 0 : roundMultiplier(timeFactor * confidenceFactor * distanceFactor);

  let warningLevel: PredictionWarningLevel = "none";
  if (isClosed) {
    warningLevel = "closed";
  } else if (secondsRemaining <= SHORT_DURATION_HEAVY_REDUCTION_SECONDS || multiplier <= 0.2) {
    warningLevel = "high";
  } else if (secondsRemaining <= 60 || multiplier <= 0.5) {
    warningLevel = "medium";
  }

  return {
    isClosed,
    secondsRemaining,
    cutoffSecondsRemaining,
    multiplier,
    warningLevel,
    timeFactor,
    confidenceFactor,
    distanceFactor,
  };
}
