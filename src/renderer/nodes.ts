export interface NodeIncomeParams {
  reservationPriceNokMwH: number;
  quantityMw: number;
  periodStartTs: number;
  periodEndTs: number;
  activeDays: string[];
  activeWindows: { start: string; end: string }[];
}

export interface NodeMonthlyRow {
  month: string;
  eligibleHours: number;
  incomeNok: number;
}

export interface NodeYearlyResult {
  totalIncomeNok: number;
  totalEligibleHours: number;
  priceNokMwH: number;
  quantityMw: number;
  monthly: NodeMonthlyRow[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

function parseHourMinute(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function isHourInWindows(hourOfDay: number, windows: { start: string; end: string }[]): boolean {
  const minuteOfDay = hourOfDay * 60;
  for (const w of windows) {
    const startMin = parseHourMinute(w.start);
    const endMin = parseHourMinute(w.end);
    if (minuteOfDay >= startMin && minuteOfDay < endMin) return true;
  }
  return false;
}

/**
 * Format a Date in Europe/Oslo timezone and extract day name + hour.
 * Uses Intl to handle DST correctly.
 */
function getOsloComponents(date: Date): { dayName: string; hour: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
    month: 'numeric',
  }).formatToParts(date);

  let dayName = '';
  let hour = 0;
  let monthIndex = 0;

  for (const part of parts) {
    if (part.type === 'weekday') dayName = part.value;
    if (part.type === 'hour') hour = Number(part.value);
    if (part.type === 'month') monthIndex = Number(part.value) - 1;
  }

  // Intl hour12:false can return 24 for midnight in some implementations
  if (hour === 24) hour = 0;

  return { dayName, hour, monthIndex };
}

export function calculateNodeYearlyIncome(params: NodeIncomeParams): NodeYearlyResult {
  const { reservationPriceNokMwH, quantityMw, periodStartTs, periodEndTs, activeDays, activeWindows } = params;

  const hourlyIncome = reservationPriceNokMwH * quantityMw;
  const hasDayFilter = activeDays.length > 0;
  const hasWindowFilter = activeWindows.length > 0;

  // Build monthly buckets
  const monthlyHours = new Array<number>(12).fill(0);
  const monthlyIncome = new Array<number>(12).fill(0);

  // Iterate hour-by-hour
  const oneHourMs = 3_600_000;
  let ts = periodStartTs;

  while (ts < periodEndTs) {
    const date = new Date(ts);
    const { dayName, hour, monthIndex } = getOsloComponents(date);

    const matchesDayFilter = !hasDayFilter || activeDays.includes(dayName);
    const matchesWindowFilter = !hasWindowFilter || isHourInWindows(hour, activeWindows);
    const eligible = matchesDayFilter && matchesWindowFilter;

    if (eligible) {
      monthlyHours[monthIndex] += 1;
      monthlyIncome[monthIndex] += hourlyIncome;
    }

    ts += oneHourMs;
  }

  const monthly: NodeMonthlyRow[] = [];
  let totalEligibleHours = 0;
  let totalIncomeNok = 0;

  for (let i = 0; i < 12; i++) {
    if (monthlyHours[i] > 0) {
      monthly.push({
        month: MONTH_LABELS[i],
        eligibleHours: monthlyHours[i],
        incomeNok: monthlyIncome[i],
      });
      totalEligibleHours += monthlyHours[i];
      totalIncomeNok += monthlyIncome[i];
    }
  }

  return {
    totalIncomeNok,
    totalEligibleHours,
    priceNokMwH: reservationPriceNokMwH,
    quantityMw,
    monthly,
  };
}
