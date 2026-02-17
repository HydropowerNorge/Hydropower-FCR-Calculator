// Battery arbitrage calculation engine
// Buy electricity when spot prices are low, sell when high

// Parse ENTSO-E CSV format (15-min resolution) and aggregate to hourly
// Columns: id,bidding_zone,timestamp,price_eur_mwh,created_at
function parseSpotPrices(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  // Parse all 15-min rows
  const quarterHourly = parsed.data
    .map(row => ({
      timestamp: new Date(row.timestamp),
      spotPrice: parseFloat(row.price_eur_mwh) || 0
    }))
    .filter(row => !isNaN(row.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Aggregate to hourly averages
  const hourMap = new Map();
  for (const row of quarterHourly) {
    const d = row.timestamp;
    const hourKey = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
    if (!hourMap.has(hourKey)) {
      hourMap.set(hourKey, { sum: 0, count: 0 });
    }
    const h = hourMap.get(hourKey);
    h.sum += row.spotPrice;
    h.count++;
  }

  return Array.from(hourMap.entries())
    .map(([ts, data]) => ({
      timestamp: new Date(ts),
      spotPrice: data.sum / data.count
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Filter spot data to the last N months from the most recent datapoint
function filterByPeriod(spotData, months) {
  if (spotData.length === 0) return spotData;
  const latest = spotData[spotData.length - 1].timestamp;
  const cutoff = new Date(latest);
  cutoff.setMonth(cutoff.getMonth() - months);
  return spotData.filter(row => row.timestamp >= cutoff);
}

function calculateDuration(powerMw, capacityMwh, socMin, socMax) {
  const usableEnergy = capacityMwh * (socMax - socMin);
  const duration = usableEnergy / powerMw;
  return Math.min(duration, 12); // Cap at 12 hours to prevent overlap
}

function simulateDay(hourlyPrices, powerMw, duration, efficiency) {
  const n = Math.floor(duration);
  if (n === 0 || hourlyPrices.length === 0) {
    return { revenue: 0, chargeCost: 0, dischargeRevenue: 0, chargeHours: [], dischargeHours: [] };
  }

  // Create indexed prices to track original hour positions
  const indexed = hourlyPrices.map((price, i) => ({ price, hour: i }));
  const sorted = [...indexed].sort((a, b) => a.price - b.price);

  // Cheapest N hours for charging, most expensive N for discharging
  const chargeHours = sorted.slice(0, n).map(h => h.hour).sort((a, b) => a - b);
  const dischargeHours = sorted.slice(-n).map(h => h.hour).sort((a, b) => a - b);

  // Ensure no overlap
  const chargeSet = new Set(chargeHours);
  const filteredDischarge = dischargeHours.filter(h => !chargeSet.has(h));

  const chargeCost = chargeHours.reduce((sum, h) => sum + hourlyPrices[h], 0) * powerMw;
  const dischargeRevenue = filteredDischarge.reduce((sum, h) => sum + hourlyPrices[h], 0) * powerMw;

  // Revenue = sell revenue - buy cost (adjusted for round-trip efficiency)
  const revenue = dischargeRevenue - (chargeCost / efficiency);

  return {
    revenue,
    chargeCost,
    dischargeRevenue,
    chargeHours,
    dischargeHours: filteredDischarge
  };
}

// Simple seeded hash for deterministic per-day decisions
function dayHash(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 4294967296;
}

function calculateArbitrage(spotData, powerMw, capacityMwh, efficiency, socMin, socMax) {
  const duration = calculateDuration(powerMw, capacityMwh, socMin, socMax);

  // Group spot data by day
  const dayMap = new Map();
  for (const row of spotData) {
    const dayKey = row.timestamp.toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey).push(row);
  }

  // Sort days chronologically for ramp-up
  const sortedDays = Array.from(dayMap.keys()).sort();
  const totalDayCount = sortedDays.length;

  const dailyResults = [];
  let totalRevenue = 0;
  let totalChargeCost = 0;
  let totalDischargeRevenue = 0;
  let totalCycles = 0;

  const hourlyDetail = [];

  // Average hourly profile (24 entries)
  const hourlyPriceSum = new Array(24).fill(0);
  const hourlyPriceCount = new Array(24).fill(0);
  const hourlyChargeCount = new Array(24).fill(0);
  const hourlyDischargeCount = new Array(24).fill(0);

  for (let dayIdx = 0; dayIdx < sortedDays.length; dayIdx++) {
    const dayKey = sortedDays[dayIdx];
    const rows = dayMap.get(dayKey);
    rows.sort((a, b) => a.timestamp - b.timestamp);
    const prices = rows.map(r => r.spotPrice);

    if (prices.length < 4) continue; // Skip incomplete days

    // ~5% of days not traded (maintenance, outages)
    const rnd = dayHash(dayKey);
    if (rnd < 0.05) {
      dailyResults.push({
        date: dayKey,
        revenue: 0, chargeCost: 0, dischargeRevenue: 0,
        avgPrice: prices.reduce((s, p) => s + p, 0) / prices.length,
        spread: Math.max(...prices) - Math.min(...prices)
      });
      continue;
    }

    // Capture rate: ramps from ~65% to ~91% over first 20 days, then stabilises
    const rampDays = 20;
    const minCapture = 0.65;
    const maxCapture = 0.91;
    const t = Math.min(dayIdx / rampDays, 1);
    const baseCapture = minCapture + (maxCapture - minCapture) * t;
    // Small daily variance (±4pp)
    const capture = baseCapture + (rnd - 0.5) * 0.08;

    const dayResult = simulateDay(prices, powerMw, duration, efficiency);
    const adjRevenue = dayResult.revenue * capture;
    const adjChargeCost = dayResult.chargeCost * capture;
    const adjDischargeRevenue = dayResult.dischargeRevenue * capture;

    totalRevenue += adjRevenue;
    totalChargeCost += adjChargeCost;
    totalDischargeRevenue += adjDischargeRevenue;
    if (dayResult.chargeHours.length > 0) totalCycles++;

    dailyResults.push({
      date: dayKey,
      revenue: adjRevenue,
      chargeCost: adjChargeCost,
      dischargeRevenue: adjDischargeRevenue,
      avgPrice: prices.reduce((s, p) => s + p, 0) / prices.length,
      spread: Math.max(...prices) - Math.min(...prices)
    });

    // Build hourly detail and profile data
    const chargeSet = new Set(dayResult.chargeHours);
    const dischargeSet = new Set(dayResult.dischargeHours);

    for (let i = 0; i < rows.length; i++) {
      const hour = rows[i].timestamp.getHours();
      let action = 'idle';
      if (chargeSet.has(i)) action = 'charge';
      else if (dischargeSet.has(i)) action = 'discharge';

      hourlyDetail.push({
        timestamp: rows[i].timestamp,
        spotPrice: rows[i].spotPrice,
        action
      });

      hourlyPriceSum[hour] += rows[i].spotPrice;
      hourlyPriceCount[hour]++;
      if (action === 'charge') hourlyChargeCount[hour]++;
      if (action === 'discharge') hourlyDischargeCount[hour]++;
    }
  }

  // Build average hourly profile
  const hourlyProfile = [];
  for (let h = 0; h < 24; h++) {
    const count = hourlyPriceCount[h] || 1;
    hourlyProfile.push({
      hour: h,
      avgPrice: hourlyPriceSum[h] / count,
      chargeFrequency: hourlyChargeCount[h] / (count || 1),
      dischargeFrequency: hourlyDischargeCount[h] / (count || 1)
    });
  }

  // Monthly aggregation
  const monthMap = new Map();
  for (const day of dailyResults) {
    const monthKey = day.date.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { revenue: 0, days: 0, chargeCost: 0, dischargeRevenue: 0 });
    }
    const m = monthMap.get(monthKey);
    m.revenue += day.revenue;
    m.days++;
    m.chargeCost += day.chargeCost;
    m.dischargeRevenue += day.dischargeRevenue;
  }

  const monthly = Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    days: data.days,
    chargeCost: data.chargeCost,
    dischargeRevenue: data.dischargeRevenue,
    avgDailyRevenue: data.revenue / data.days
  }));

  return {
    totalRevenue,
    totalChargeCost,
    totalDischargeRevenue,
    totalCycles,
    totalDays: dailyResults.length,
    avgDailyRevenue: dailyResults.length > 0 ? totalRevenue / dailyResults.length : 0,
    duration,
    dailyResults,
    monthly,
    hourlyDetail,
    hourlyProfile
  };
}

// Full theoretical potential — no skips, no ramp, 100% capture
function calculateFullPotential(spotData, powerMw, capacityMwh, efficiency, socMin, socMax) {
  const duration = calculateDuration(powerMw, capacityMwh, socMin, socMax);

  const dayMap = new Map();
  for (const row of spotData) {
    const dayKey = row.timestamp.toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
    dayMap.get(dayKey).push(row);
  }

  let totalRevenue = 0;
  let totalDays = 0;

  for (const [, rows] of dayMap) {
    rows.sort((a, b) => a.timestamp - b.timestamp);
    const prices = rows.map(r => r.spotPrice);
    if (prices.length < 4) continue;

    const dayResult = simulateDay(prices, powerMw, duration, efficiency);
    totalRevenue += dayResult.revenue;
    totalDays++;
  }

  return { totalRevenue, totalDays };
}

window.Arbitrage = {
  parseSpotPrices,
  filterByPeriod,
  calculateDuration,
  simulateDay,
  calculateArbitrage,
  calculateFullPotential
};
