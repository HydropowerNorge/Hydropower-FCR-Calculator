export function roundValuesToTarget(values: number[], targetTotal?: number): number[] {
  const safeValues = values.map((value) => (Number.isFinite(value) ? value : 0));
  const rounded = safeValues.map((value) => Math.round(value));
  const roundedSum = rounded.reduce((sum, value) => sum + value, 0);
  const safeTarget = Number.isFinite(targetTotal)
    ? Math.round(Number(targetTotal))
    : Math.round(safeValues.reduce((sum, value) => sum + value, 0));

  let diff = safeTarget - roundedSum;
  if (diff === 0 || rounded.length === 0) return rounded;

  const direction = diff > 0 ? 1 : -1;
  const candidates = safeValues
    .map((value, index) => ({
      index,
      // Positive means value was rounded down, negative means rounded up.
      delta: value - rounded[index],
    }))
    .sort((a, b) => (direction > 0
      ? (b.delta - a.delta) || (a.index - b.index)
      : (a.delta - b.delta) || (a.index - b.index)));

  let step = 0;
  while (diff !== 0) {
    const candidate = candidates[step % candidates.length];
    rounded[candidate.index] += direction;
    diff -= direction;
    step += 1;
  }

  return rounded;
}
