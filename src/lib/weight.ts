const DAY_MS = 86_400_000;

export type WeightEntry = {
  weight: number;
  createdAt: Date;
};

export function getRollingWeightAverage(
  logs: WeightEntry[],
  index: number,
  windowSize = 3,
) {
  const start = Math.max(0, index - windowSize + 1);
  const entries = logs.slice(start, index + 1);

  return entries.reduce((total, entry) => total + entry.weight, 0) / entries.length;
}

export function findClosestWeightLog({
  logs,
  latest,
  daysAgo,
  toleranceDays,
}: {
  logs: WeightEntry[];
  latest: WeightEntry;
  daysAgo: number;
  toleranceDays: number;
}) {
  const targetTime = latest.createdAt.getTime() - daysAgo * DAY_MS;
  const toleranceMs = toleranceDays * DAY_MS;

  return logs.slice(1).reduce<WeightEntry | null>((closest, log) => {
    const currentDistance = Math.abs(log.createdAt.getTime() - targetTime);

    if (currentDistance > toleranceMs) {
      return closest;
    }

    if (!closest) {
      return log;
    }

    const closestDistance = Math.abs(closest.createdAt.getTime() - targetTime);

    return currentDistance < closestDistance ? log : closest;
  }, null);
}

export function formatWeightChange(change: number | null, period: string) {
  if (change === null) {
    return null;
  }

  if (Math.abs(change) < 0.05) {
    return `No change ${period}`;
  }

  const direction = change < 0 ? "Down" : "Up";

  return `${direction} ${Math.abs(change).toFixed(1)} kg ${period}`;
}

export function getGoalProgress({
  startWeight,
  currentWeight,
  targetWeight,
}: {
  startWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
}) {
  if (
    startWeight === null ||
    currentWeight === null ||
    targetWeight === null ||
    Math.abs(startWeight - targetWeight) < 0.05
  ) {
    return null;
  }

  const totalDistance = Math.abs(startWeight - targetWeight);
  const completedDistance =
    startWeight > targetWeight
      ? startWeight - currentWeight
      : currentWeight - startWeight;
  const progress = Math.max(
    0,
    Math.min(100, (completedDistance / totalDistance) * 100),
  );
  const remaining = Math.max(0, Math.abs(currentWeight - targetWeight));

  return {
    progress,
    remaining,
    reached: remaining < 0.05,
  };
}
