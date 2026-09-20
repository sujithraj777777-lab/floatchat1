export type GradientObservation = {
  source_row: number;
  depth_m: number;
  temperature_c: number;
  salinity_psu: number;
};
export type GradientInterval = {
  shallow: GradientObservation;
  deep: GradientObservation;
  midpoint_m: number;
  separation_m: number;
  temperature_per_m: number;
  salinity_per_m: number;
};
export type GradientOptions = {
  minDepth: number;
  maxDepth: number;
  minSeparation: number;
  maxSeparation: number;
};

export function calculateGradients(
  observations: readonly GradientObservation[],
  options: GradientOptions,
) {
  if (!Object.values(options).every(Number.isFinite) || options.minDepth < 0 ||
    options.maxDepth <= options.minDepth || options.minSeparation <= 0 ||
    options.maxSeparation < options.minSeparation) {
    throw new Error("Invalid gradient analysis limits.");
  }
  const invalid = (row: GradientObservation) =>
    !Number.isInteger(row.source_row) || row.source_row < 0 ||
    !Number.isFinite(row.depth_m) || row.depth_m < 0 ||
    !Number.isFinite(row.temperature_c) || !Number.isFinite(row.salinity_psu);
  const valid = observations.filter((row) => !invalid(row))
    .slice().sort((a, b) => a.depth_m - b.depth_m || a.source_row - b.source_row);
  const depthCounts = new Map<number, number>();
  const rowCounts = new Map<number, number>();
  for (const row of valid) {
    depthCounts.set(row.depth_m, (depthCounts.get(row.depth_m) ?? 0) + 1);
    rowCounts.set(row.source_row, (rowCounts.get(row.source_row) ?? 0) + 1);
  }
  const skipped = { outsideWindow: 0, duplicate: 0, sourceGap: 0, tooClose: 0, tooFar: 0 };
  const intervals: GradientInterval[] = [];
  for (let i = 1; i < valid.length; i++) {
    const shallow = valid[i - 1];
    const deep = valid[i];
    if (shallow.depth_m < options.minDepth || deep.depth_m > options.maxDepth) {
      skipped.outsideWindow++; continue;
    }
    // Skip every interval touching an ambiguous duplicate; do not collapse duplicates.
    if ((depthCounts.get(shallow.depth_m) ?? 0) > 1 ||
      (depthCounts.get(deep.depth_m) ?? 0) > 1 ||
      (rowCounts.get(shallow.source_row) ?? 0) > 1 ||
      (rowCounts.get(deep.source_row) ?? 0) > 1) {
      skipped.duplicate++; continue;
    }
    // A conservative rule for this flattened single-profile export.
    if (Math.abs(deep.source_row - shallow.source_row) !== 1) {
      skipped.sourceGap++; continue;
    }
    const separation = deep.depth_m - shallow.depth_m;
    if (separation < options.minSeparation) { skipped.tooClose++; continue; }
    if (separation > options.maxSeparation) { skipped.tooFar++; continue; }
    intervals.push({ shallow, deep, separation_m: separation,
      midpoint_m: (shallow.depth_m + deep.depth_m) / 2,
      temperature_per_m: (deep.temperature_c - shallow.temperature_c) / separation,
      salinity_per_m: (deep.salinity_psu - shallow.salinity_psu) / separation,
    });
  }
  const strongestCooling = intervals.reduce<GradientInterval | null>((best, row) =>
    row.temperature_per_m < 0 && (!best || row.temperature_per_m < best.temperature_per_m)
      ? row : best, null);
  const strongestSalinity = intervals.reduce<GradientInterval | null>((best, row) =>
    row.salinity_per_m !== 0 && (!best || Math.abs(row.salinity_per_m) > Math.abs(best.salinity_per_m))
      ? row : best, null);
  return { intervals, strongestCooling, strongestSalinity, skipped, invalidLevels: observations.length - valid.length };
}
