export interface AfrrCalculationParams {
  year: number;
  afrrRows: AfrrInputRow[];
  spotRows: SpotInputRow[];
  solarRows: SolarInputRow[];
  direction?: 'up' | 'down';
  minBidMw?: number;
  excludeZeroVolume?: boolean;
  limitToMarketVolume?: boolean;
}

interface AfrrInputRow {
  timestamp?: number;
  marketPriceEurMw?: number;
  contractedPriceEurMw?: number;
  marketVolumeMw?: number;
  marketActivatedVolumeMw?: number;
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
  afrrCapacityMw: number;
  afrrPriceEurMw: number;
  spotPriceEurMwh: number;
  spotIncomeEur: number;
  afrrIncomeEur: number;
  activationCostEur: number;
  totalIncomeEur: number;
  activatedCapacityMw: number;
  marketVolumeMw: number;
  hasBid: boolean;
}

export interface AfrrMonthlyRow {
  month: string;
  totalIncomeEur: number;
  spotIncomeEur: number;
  afrrIncomeEur: number;
  activationCostEur: number;
  bidHours: number;
  hours: number;
  avgAfrrPriceEurMw: number;
}

export interface AfrrYearlyResult {
  year: number;
  totalHours: number;
  bidHours: number;
  totalIncomeEur: number;
  totalSpotIncomeEur: number;
  totalAfrrIncomeEur: number;
  totalActivationCostEur: number;
  avgBidCapacityMw: number;
  avgAfrrPriceEurMw: number;
  hourlyData: AfrrHourlyRow[];
  monthly: AfrrMonthlyRow[];
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHoursInYear(year: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  return isLeapYear ? 8784 : 8760;
}

/** Sort solar rows by timestamp and extract production values positionally. */
function buildSolarProfile(solarRows: SolarInputRow[], totalHours: number): number[] {
  if (!Array.isArray(solarRows) || solarRows.length === 0) {
    return new Array(totalHours).fill(0);
  }

  const sorted = solarRows
    .slice()
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
    .map((row) => {
      const v = toFiniteNumber(row.production);
      return v !== null && v > 0 ? v : 0;
    });

  return Array.from({ length: totalHours }, (_, i) => {
    const idx = Math.min(Math.floor((i * sorted.length) / totalHours), sorted.length - 1);
    return sorted[idx];
  });
}

function aggregateMonthly(hourlyData: AfrrHourlyRow[]): AfrrMonthlyRow[] {
  const byMonth = new Map<string, AfrrMonthlyRow>();

  for (const row of hourlyData) {
    const month = new Date(row.timestamp).toISOString().slice(0, 7);
    let item = byMonth.get(month);
    if (!item) {
      item = {
        month,
        totalIncomeEur: 0,
        spotIncomeEur: 0,
        afrrIncomeEur: 0,
        activationCostEur: 0,
        bidHours: 0,
        hours: 0,
        avgAfrrPriceEurMw: 0,
      };
      byMonth.set(month, item);
    }

    item.totalIncomeEur += row.totalIncomeEur;
    item.spotIncomeEur += row.spotIncomeEur;
    item.afrrIncomeEur += row.afrrIncomeEur;
    item.activationCostEur += row.activationCostEur;
    item.hours += 1;

    if (row.hasBid) {
      item.bidHours += 1;
      item.avgAfrrPriceEurMw += row.afrrPriceEurMw;
    }
  }

  for (const item of byMonth.values()) {
    item.avgAfrrPriceEurMw = item.bidHours > 0 ? item.avgAfrrPriceEurMw / item.bidHours : 0;
  }

  return Array.from(byMonth.values());
}

function buildTimestampLookup<T>(
  rows: T[],
  getTimestamp: (row: T) => number | null,
): Map<number, T> {
  const lookup = new Map<number, T>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const ts = getTimestamp(row);
    if (ts !== null) lookup.set(ts, row);
  }
  return lookup;
}

export function calculateAfrrYearlyRevenue({
  year,
  afrrRows,
  spotRows,
  solarRows,
  direction = 'down',
  minBidMw = 1,
  excludeZeroVolume = true,
  limitToMarketVolume = true,
}: AfrrCalculationParams): AfrrYearlyResult {
  const safeYear = Number(year);
  const safeMinBidMw = Math.max(1, Number(minBidMw) || 1);
  const isDown = direction !== 'up';

  if (!Number.isInteger(safeYear)) throw new Error('Invalid simulation year');

  const totalHours = getHoursInYear(safeYear);
  const startTs = Date.UTC(safeYear, 0, 1, 0, 0, 0, 0);

  const afrrByHour = buildTimestampLookup(afrrRows, (r) => toFiniteNumber(r.timestamp));
  const spotByHour = buildTimestampLookup(spotRows, (r) => toFiniteNumber(r.timestamp));
  const solarProfile = buildSolarProfile(solarRows, totalHours);

  const hourlyData: AfrrHourlyRow[] = [];
  let totalSpotIncomeEur = 0;
  let totalAfrrIncomeEur = 0;
  let totalActivationCostEur = 0;
  let totalBidCapacityMw = 0;
  let bidHours = 0;
  let afrrPriceSum = 0;

  for (let i = 0; i < totalHours; i += 1) {
    const timestamp = startTs + i * 3_600_000;
    const afrr = afrrByHour.get(timestamp);
    const spotPriceEurMwh = toFiniteNumber(spotByHour.get(timestamp)?.spotPriceEurMwh) ?? 0;
    const solarMw = solarProfile[i];

    // aFRR capacity price (EUR/MW)
    const mktPrice = toFiniteNumber(afrr?.marketPriceEurMw);
    const ctrPrice = toFiniteNumber(afrr?.contractedPriceEurMw);
    const afrrPriceEurMw = (mktPrice !== null && mktPrice > 0) ? mktPrice
      : (ctrPrice !== null && ctrPrice > 0) ? ctrPrice : 0;

    const marketVolumeMw = toFiniteNumber(afrr?.marketVolumeMw) ?? 0;
    const marketActivatedMw = toFiniteNumber(afrr?.marketActivatedVolumeMw) ?? 0;

    // Bid sizing
    let capacityMw = 0;
    if (!(excludeZeroVolume && marketVolumeMw <= 0)) {
      const raw = Math.floor(solarMw / safeMinBidMw) * safeMinBidMw;
      if (raw >= safeMinBidMw) capacityMw = raw;
    }
    if (limitToMarketVolume && capacityMw > 0 && marketVolumeMw > 0) {
      capacityMw = Math.min(capacityMw, marketVolumeMw);
    }

    const hasBid = capacityMw > 0;

    // Activation from real market data
    let activatedMw = 0;
    if (hasBid && marketVolumeMw > 0) {
      activatedMw = capacityMw * (marketActivatedMw / marketVolumeMw);
    }

    // Income — activation settled at spot price
    let spotIncomeEur: number;
    let activationCostEur: number;

    if (isDown) {
      // DOWN: sell all production at spot, when activated pay back at spot
      spotIncomeEur = solarMw * spotPriceEurMwh;
      activationCostEur = activatedMw * spotPriceEurMwh;
    } else {
      // UP: reserve capacity (don't sell at spot), when activated earn spot
      spotIncomeEur = (solarMw - Math.min(capacityMw, solarMw)) * spotPriceEurMwh;
      activationCostEur = -(activatedMw * spotPriceEurMwh);
    }

    const afrrIncomeEur = hasBid ? capacityMw * afrrPriceEurMw : 0;
    const totalIncomeEur = spotIncomeEur + afrrIncomeEur - activationCostEur;

    // Log first bid hour for verification
    if (hasBid && bidHours === 0) {
      const ts = new Date(timestamp).toISOString();
      console.info(
        `[aFRR] First bid hour ${ts}:\n` +
        `  Solar production: ${solarMw.toFixed(2)} MW\n` +
        `  Spot price: ${spotPriceEurMwh.toFixed(2)} EUR/MWh\n` +
        `  aFRR capacity price: ${afrrPriceEurMw.toFixed(2)} EUR/MW\n` +
        `  Market volume: ${marketVolumeMw.toFixed(2)} MW | Activated: ${marketActivatedMw.toFixed(2)} MW\n` +
        `  Bid capacity: ${capacityMw.toFixed(2)} MW\n` +
        `  Activated capacity: ${activatedMw.toFixed(2)} MW (${marketVolumeMw > 0 ? ((marketActivatedMw / marketVolumeMw) * 100).toFixed(1) : 0}%)\n` +
        `  Spot income: ${spotIncomeEur.toFixed(2)} EUR (${solarMw.toFixed(2)} MW × ${spotPriceEurMwh.toFixed(2)} EUR/MWh)\n` +
        `  aFRR income: ${afrrIncomeEur.toFixed(2)} EUR (${capacityMw.toFixed(2)} MW × ${afrrPriceEurMw.toFixed(2)} EUR/MW)\n` +
        `  Activation cost: ${activationCostEur.toFixed(2)} EUR (${activatedMw.toFixed(2)} MW × ${spotPriceEurMwh.toFixed(2)} EUR/MWh)\n` +
        `  Total income: ${totalIncomeEur.toFixed(2)} EUR`,
      );
    }

    totalSpotIncomeEur += spotIncomeEur;
    totalAfrrIncomeEur += afrrIncomeEur;
    totalActivationCostEur += activationCostEur;

    if (hasBid) {
      bidHours += 1;
      totalBidCapacityMw += capacityMw;
      afrrPriceSum += afrrPriceEurMw;
    }

    hourlyData.push({
      timestamp,
      solarProductionMw: solarMw,
      afrrCapacityMw: capacityMw,
      afrrPriceEurMw,
      spotPriceEurMwh,
      spotIncomeEur,
      afrrIncomeEur,
      activationCostEur,
      totalIncomeEur,
      activatedCapacityMw: activatedMw,
      marketVolumeMw,
      hasBid,
    });
  }

  return {
    year: safeYear,
    totalHours,
    bidHours,
    totalIncomeEur: totalSpotIncomeEur + totalAfrrIncomeEur - totalActivationCostEur,
    totalSpotIncomeEur,
    totalAfrrIncomeEur,
    totalActivationCostEur,
    avgBidCapacityMw: bidHours > 0 ? totalBidCapacityMw / bidHours : 0,
    avgAfrrPriceEurMw: bidHours > 0 ? afrrPriceSum / bidHours : 0,
    hourlyData,
    monthly: aggregateMonthly(hourlyData),
  };
}
