export interface AfrrCalculationParams {
  year: number;
  afrrRows: AfrrInputRow[];
  spotRows: SpotInputRow[];
  solarRows: SolarInputRow[];
  powerMw: number;
  eurToNok?: number;
  minBidMw?: number;
  activationMinPct?: number;
  activationMaxPct?: number;
  seed?: number;
}

interface AfrrInputRow {
  timestamp?: number;
  marketPriceEurMw?: number;
  contractedPriceEurMw?: number;
  activationPriceEurMwh?: number;
}

interface SpotInputRow {
  timestamp?: number;
  spotPriceEurMwh?: number;
}

interface SolarInputRow {
  timestamp?: number;
  production?: number;
}

export interface AfrrHourlyRow {
  timestamp: number;
  solarProductionMw: number;
  bidVolumeMw: number;
  afrrPriceEurMw: number;
  afrrPriceNokMw: number;
  spotPriceEurMwh: number;
  spotPriceNokMwh: number;
  activationPct: number;
  activatedEnergyMwh: number;
  solarCurtailmentMwh: number;
  solarRevenueNok: number;
  capacityRevenueNok: number;
  curtailmentCostNok: number;
  afrrRevenueNok: number;
  totalRevenueNok: number;
  hasBid: boolean;
}

export interface AfrrMonthlyRow {
  month: string;
  totalRevenueNok: number;
  solarRevenueNok: number;
  afrrRevenueNok: number;
  capacityRevenueNok: number;
  curtailmentCostNok: number;
  bidHours: number;
  hours: number;
  afrrPriceSumNokMw: number;
  avgAfrrPriceNokMw: number;
}

export interface AfrrYearlyResult {
  year: number;
  totalHours: number;
  bidHours: number;
  totalRevenueNok: number;
  totalSolarRevenueNok: number;
  totalAfrrRevenueNok: number;
  totalCapacityRevenueNok: number;
  totalCurtailmentCostNok: number;
  avgBidVolumeMw: number;
  avgActivationPct: number;
  avgAfrrPriceNokMw: number;
  hourlyData: AfrrHourlyRow[];
  monthly: AfrrMonthlyRow[];
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createRng(seed: number): () => number {
  let state = Number.isFinite(seed) ? Math.floor(seed) : 42;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function getFirstPositiveNumber(values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (Number.isFinite(value) && Number(value) > 0) {
      return Number(value);
    }
  }
  return 0;
}

function getHoursInYear(year: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  return isLeapYear ? 8784 : 8760;
}

function buildSolarCapacityFactors(solarRows: SolarInputRow[], totalHours: number): number[] {
  if (!Array.isArray(solarRows) || solarRows.length === 0 || totalHours <= 0) {
    return new Array(totalHours).fill(0);
  }

  const production = solarRows
    .map((row) => toFiniteNumber(row.production))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const maxProduction = production.length > 0 ? production[production.length - 1] : 0;
  if (!Number.isFinite(maxProduction) || maxProduction <= 0) {
    return new Array(totalHours).fill(0);
  }

  const normalizedProfile = solarRows
    .slice()
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
    .map((row) => {
      const productionValue = toFiniteNumber(row.production);
      if (productionValue === null || productionValue <= 0) return 0;
      return Math.min(1, productionValue / maxProduction);
    });

  return Array.from({ length: totalHours }, (_, index) => {
    const profileIndex = Math.floor((index * normalizedProfile.length) / totalHours);
    return normalizedProfile[Math.min(profileIndex, normalizedProfile.length - 1)] || 0;
  });
}

function aggregateMonthly(hourlyData: AfrrHourlyRow[]): AfrrMonthlyRow[] {
  const byMonth = new Map<string, AfrrMonthlyRow>();

  for (const row of hourlyData) {
    const month = new Date(row.timestamp).toISOString().slice(0, 7);
    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        totalRevenueNok: 0,
        solarRevenueNok: 0,
        afrrRevenueNok: 0,
        capacityRevenueNok: 0,
        curtailmentCostNok: 0,
        bidHours: 0,
        hours: 0,
        afrrPriceSumNokMw: 0,
        avgAfrrPriceNokMw: 0,
      });
    }

    const item = byMonth.get(month)!;
    item.totalRevenueNok += row.totalRevenueNok;
    item.solarRevenueNok += row.solarRevenueNok;
    item.afrrRevenueNok += row.afrrRevenueNok;
    item.capacityRevenueNok += row.capacityRevenueNok;
    item.curtailmentCostNok += row.curtailmentCostNok;
    item.hours += 1;

    if (row.bidVolumeMw > 0) {
      item.bidHours += 1;
      item.afrrPriceSumNokMw += row.afrrPriceNokMw;
    }
  }

  return Array.from(byMonth.values()).map((month) => ({
    ...month,
    avgAfrrPriceNokMw: month.bidHours > 0 ? month.afrrPriceSumNokMw / month.bidHours : 0,
  }));
}

function resolveAfrrPriceEurMw(row: AfrrInputRow | null): number {
  return getFirstPositiveNumber([
    toFiniteNumber(row?.marketPriceEurMw),
    toFiniteNumber(row?.contractedPriceEurMw),
  ]);
}

function resolveSpotPriceEurMwh(row: AfrrInputRow | null, explicitSpotPrice?: number): number {
  return getFirstPositiveNumber([
    Number.isFinite(explicitSpotPrice) ? explicitSpotPrice : null,
    toFiniteNumber(row?.activationPriceEurMwh),
  ]);
}

function buildAfrrLookup(rows: AfrrInputRow[]): Map<number, AfrrInputRow> {
  const lookup = new Map<number, AfrrInputRow>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const timestamp = toFiniteNumber(row.timestamp);
    if (timestamp === null) continue;
    lookup.set(timestamp, row);
  }
  return lookup;
}

function buildSpotLookup(rows: SpotInputRow[]): Map<number, number> {
  const lookup = new Map<number, number>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const timestamp = toFiniteNumber(row.timestamp);
    const spotPriceEurMwh = toFiniteNumber(row.spotPriceEurMwh);
    if (timestamp === null || spotPriceEurMwh === null) continue;
    lookup.set(timestamp, spotPriceEurMwh);
  }
  return lookup;
}

function calculateActivationPct(
  hasBid: boolean,
  minPct: number,
  maxPct: number,
  rng: () => number,
): number {
  if (!hasBid) {
    return 0;
  }

  return minPct + rng() * (maxPct - minPct);
}

export function calculateAfrrYearlyRevenue({
  year,
  afrrRows,
  spotRows,
  solarRows,
  powerMw,
  eurToNok = 11,
  minBidMw = 1,
  activationMinPct = 0,
  activationMaxPct = 100,
  seed = 42,
}: AfrrCalculationParams): AfrrYearlyResult {
  const safeYear = Number(year);
  const safePowerMw = Number(powerMw);
  const safeEurToNok = Number(eurToNok);
  const safeMinBidMw = Number(minBidMw);

  if (!Number.isInteger(safeYear)) {
    throw new Error('Invalid simulation year');
  }
  if (!Number.isFinite(safePowerMw) || safePowerMw <= 0) {
    throw new Error('Invalid power input');
  }
  if (!Number.isFinite(safeEurToNok) || safeEurToNok <= 0) {
    throw new Error('Invalid EUR/NOK conversion rate');
  }
  if (!Number.isFinite(safeMinBidMw) || safeMinBidMw < 1) {
    throw new Error('Minimum bid size must be at least 1 MW');
  }

  const safeActivationMinPct = Math.max(0, Math.min(100, Number(activationMinPct)));
  const safeActivationMaxPct = Math.max(
    safeActivationMinPct,
    Math.min(100, Number(activationMaxPct)),
  );

  const totalHours = getHoursInYear(safeYear);
  const startTs = Date.UTC(safeYear, 0, 1, 0, 0, 0, 0);
  const afrrByHour = buildAfrrLookup(afrrRows);
  const spotByHour = buildSpotLookup(spotRows);
  const rng = createRng(Number(seed) || 42);

  const solarCapacityFactors = buildSolarCapacityFactors(solarRows, totalHours);
  const hourlyData: AfrrHourlyRow[] = [];

  let totalSolarRevenueNok = 0;
  let totalAfrrRevenueNok = 0;
  let totalCapacityRevenueNok = 0;
  let totalCurtailmentCostNok = 0;
  let totalBidVolumeMw = 0;
  let totalActivationPct = 0;
  let bidHours = 0;
  let afrrPriceSumNokMw = 0;

  for (let i = 0; i < totalHours; i += 1) {
    const timestamp = startTs + i * 60 * 60 * 1000;
    const afrrRow = afrrByHour.get(timestamp) || null;
    const afrrPriceEurMw = resolveAfrrPriceEurMw(afrrRow);
    const spotPriceEurMwh = resolveSpotPriceEurMwh(afrrRow, spotByHour.get(timestamp));

    const solarProductionMw = safePowerMw * (solarCapacityFactors[i] || 0);
    const floorVolumeMw = Math.floor(solarProductionMw);
    const bidVolumeMw = floorVolumeMw >= safeMinBidMw ? floorVolumeMw : 0;
    const hasBid = bidVolumeMw > 0;

    const activationPct = calculateActivationPct(
      hasBid,
      safeActivationMinPct,
      safeActivationMaxPct,
      rng,
    );

    const activatedEnergyMwh = hasBid ? bidVolumeMw * (activationPct / 100) : 0;
    const solarCurtailmentMwh = Math.min(activatedEnergyMwh, solarProductionMw);

    const afrrPriceNokMw = afrrPriceEurMw * safeEurToNok;
    const spotPriceNokMwh = spotPriceEurMwh * safeEurToNok;

    const solarRevenueNok = solarProductionMw * spotPriceNokMwh;
    const capacityRevenueNok = hasBid ? bidVolumeMw * afrrPriceNokMw : 0;
    const curtailmentCostNok = solarCurtailmentMwh * spotPriceNokMwh;
    const afrrRevenueNok = capacityRevenueNok - curtailmentCostNok;
    const totalRevenueNok = solarRevenueNok + afrrRevenueNok;

    totalSolarRevenueNok += solarRevenueNok;
    totalAfrrRevenueNok += afrrRevenueNok;
    totalCapacityRevenueNok += capacityRevenueNok;
    totalCurtailmentCostNok += curtailmentCostNok;

    if (hasBid) {
      bidHours += 1;
      totalBidVolumeMw += bidVolumeMw;
      totalActivationPct += activationPct;
      afrrPriceSumNokMw += afrrPriceNokMw;
    }

    hourlyData.push({
      timestamp,
      solarProductionMw,
      bidVolumeMw,
      afrrPriceEurMw,
      afrrPriceNokMw,
      spotPriceEurMwh,
      spotPriceNokMwh,
      activationPct,
      activatedEnergyMwh,
      solarCurtailmentMwh,
      solarRevenueNok,
      capacityRevenueNok,
      curtailmentCostNok,
      afrrRevenueNok,
      totalRevenueNok,
      hasBid,
    });
  }

  const totalRevenueNok = totalSolarRevenueNok + totalAfrrRevenueNok;
  const avgBidVolumeMw = bidHours > 0 ? totalBidVolumeMw / bidHours : 0;
  const avgActivationPct = bidHours > 0 ? totalActivationPct / bidHours : 0;
  const avgAfrrPriceNokMw = bidHours > 0 ? afrrPriceSumNokMw / bidHours : 0;

  return {
    year: safeYear,
    totalHours,
    bidHours,
    totalRevenueNok,
    totalSolarRevenueNok,
    totalAfrrRevenueNok,
    totalCapacityRevenueNok,
    totalCurtailmentCostNok,
    avgBidVolumeMw,
    avgActivationPct,
    avgAfrrPriceNokMw,
    hourlyData,
    monthly: aggregateMonthly(hourlyData),
  };
}
