// Battery configuration
export class BatteryConfig {
  constructor(powerMw, capacityMwh, efficiency = 0.90, socMin = 0.20, socMax = 0.80) {
    this.powerMw = powerMw;
    this.capacityMwh = capacityMwh;
    this.efficiency = efficiency;
    this.socMin = socMin;
    this.socMax = socMax;
  }
}

// Calculate FCR-N power activation based on frequency
// FCR-N activates linearly in 49.9-50.1 Hz band:
// - At 49.9 Hz: full discharge (+powerMw)
// - At 50.0 Hz: zero activation
// - At 50.1 Hz: full charge (-powerMw)
export function calculateFcrActivation(frequency, powerMw) {
  if (frequency <= 49.9) return powerMw;
  if (frequency >= 50.1) return -powerMw;
  return (50.0 - frequency) / 0.1 * powerMw;
}

// Simulate battery SOC evolution using 1-second frequency data with NEM.
// NEM (Normal State Energy Management) adds power offset to restore SOC
// while still participating in FCR when frequency is in normal band.
export function simulateSocHourly(freqData, config, startSoc = 0.5) {
  const minEnergy = config.capacityMwh * config.socMin;
  const maxEnergy = config.capacityMwh * config.socMax;

  // NEM parameters
  const NEM_POWER_RATIO = 0.34;
  const NEM_WINDOW_SECONDS = 120;

  // NEM SOC thresholds - relative to user's SOC limits with 25% buffer
  const socRange = config.socMax - config.socMin;
  const nemBuffer = socRange * 0.25;
  const nemEnableLower = config.socMin + nemBuffer;
  const nemDisableLower = config.socMin + socRange * 0.5;
  const nemEnableUpper = config.socMax - nemBuffer;
  const nemDisableUpper = config.socMax - socRange * 0.5;

  const frequencies = freqData.frequencies;
  const nSamples = frequencies.length;
  const nHours = Math.floor(nSamples / 3600);
  const startTimeMs = freqData.startTime.getTime();

  const results = [];
  let currentEnergy = config.capacityMwh * startSoc;
  const sqrtEfficiency = Math.sqrt(config.efficiency);

  // NEM state tracking
  const nemAllowedHistory = new Float64Array(NEM_WINDOW_SECONDS);
  let nemHistoryCount = 0;
  let nemHistoryIndex = 0;
  let nemAllowedSum = 0;
  let nemActiveLow = false;
  let nemActiveHigh = false;

  for (let h = 0; h < nHours; h++) {
    const hourStartEnergy = currentEnergy;
    const hourTimestamp = new Date(startTimeMs + h * 3600000);
    let unavailableSeconds = 0;

    // Process 3600 samples for this hour
    const hourStart = h * 3600;
    const hourEnd = hourStart + 3600;
    for (let i = hourStart; i < hourEnd; i++) {
      const freq = frequencies[i];
      const soc = currentEnergy / config.capacityMwh;
      const inNormalBand = freq > 49.9 && freq < 50.1;

      // Calculate NEM_Allowed based on SOC and frequency band
      let nemAllowed = 0;
      if (inNormalBand) {
        // Low SOC - need to charge (nemAllowed = -1)
        if (soc < nemEnableLower) {
          nemActiveLow = true;
        } else if (soc >= nemDisableLower) {
          nemActiveLow = false;
        }

        // High SOC - need to discharge (nemAllowed = +1)
        if (soc > nemEnableUpper) {
          nemActiveHigh = true;
        } else if (soc <= nemDisableUpper) {
          nemActiveHigh = false;
        }

        if (nemActiveLow) {
          nemAllowed = -1; // Charge to restore SOC
        } else if (nemActiveHigh) {
          nemAllowed = 1; // Discharge to restore SOC
        }
      }

      // Rolling 2-min average for NEM_current
      if (nemHistoryCount < NEM_WINDOW_SECONDS) {
        nemHistoryCount++;
      } else {
        nemAllowedSum -= nemAllowedHistory[nemHistoryIndex];
      }
      nemAllowedHistory[nemHistoryIndex] = nemAllowed;
      nemAllowedSum += nemAllowed;
      nemHistoryIndex = (nemHistoryIndex + 1) % NEM_WINDOW_SECONDS;
      const nemCurrent = nemAllowedSum / nemHistoryCount;

      // FCR power response
      const fcrPower = calculateFcrActivation(freq, config.powerMw);

      // NEM power offset (adds to FCR)
      const nemPower = NEM_POWER_RATIO * config.powerMw * nemCurrent;

      // Total power = FCR + NEM
      const totalPower = fcrPower + nemPower;

      // Energy change per second
      let deltaEnergy = totalPower / 3600;

      // Apply efficiency
      if (deltaEnergy > 0) {
        deltaEnergy /= sqrtEfficiency;
      } else {
        deltaEnergy *= sqrtEfficiency;
      }

      let newEnergy = currentEnergy - deltaEnergy;

      // Check hard SOC limits
      if (newEnergy < minEnergy || newEnergy > maxEnergy) {
        unavailableSeconds++;
        newEnergy = Math.max(minEnergy, Math.min(maxEnergy, newEnergy));
      }

      currentEnergy = newEnergy;
    }

    const hourEndEnergy = currentEnergy;
    const available = unavailableSeconds < 60;

    results.push({
      hour: hourTimestamp,
      socStart: hourStartEnergy / config.capacityMwh,
      socEnd: hourEndEnergy / config.capacityMwh,
      socChange: (hourEndEnergy - hourStartEnergy) / config.capacityMwh,
      unavailableSeconds,
      available
    });
  }

  return results;
}

// Calculate revenue by combining price data with availability from SOC simulation
export function calculateRevenue(priceData, socData, config) {
  // Create lookup map for SOC data by hour
  const socByHour = new Map();
  for (const row of socData) {
    socByHour.set(row.hour.getTime(), row);
  }

  const hourlyResults = [];
  let totalRevenue = 0;
  let availableHours = 0;

  for (const priceRow of priceData) {
    const hourKey = new Date(priceRow.timestamp).setMinutes(0, 0, 0);
    const socRow = socByHour.get(hourKey);

    const available = socRow ? socRow.available : true;
    const revenue = available ? config.powerMw * priceRow.price : 0;

    totalRevenue += revenue;
    if (available) availableHours++;

    hourlyResults.push({
      timestamp: priceRow.timestamp,
      price: priceRow.price,
      available,
      revenue,
      socStart: socRow?.socStart ?? null,
      socEnd: socRow?.socEnd ?? null
    });
  }

  const totalHours = priceData.length;
  const avgPrice = totalHours > 0
    ? priceData.reduce((sum, r) => sum + r.price, 0) / totalHours
    : 0;

  return {
    hourlyData: hourlyResults,
    totalRevenue,
    availableHours,
    totalHours,
    availabilityPct: totalHours > 0 ? (availableHours / totalHours) * 100 : 0,
    avgPrice
  };
}

// Calculate revenue without SOC simulation (simple availability factor)
export function calculateSimpleRevenue(priceData, powerMw, availabilityPct = 100) {
  const factor = availabilityPct / 100;

  const hourlyResults = [];
  let totalRevenue = 0;

  for (const row of priceData) {
    const revenue = powerMw * row.price * factor;
    totalRevenue += revenue;

    hourlyResults.push({
      timestamp: row.timestamp,
      price: row.price,
      available: true,
      revenue
    });
  }

  const totalHours = priceData.length;
  const avgPrice = totalHours > 0
    ? priceData.reduce((sum, r) => sum + r.price, 0) / totalHours
    : 0;

  return {
    hourlyData: hourlyResults,
    totalRevenue,
    availableHours: Math.round(totalHours * factor),
    totalHours,
    availabilityPct,
    avgPrice
  };
}

export const Calculator = {
  BatteryConfig,
  calculateFcrActivation,
  simulateSocHourly,
  calculateRevenue,
  calculateSimpleRevenue
};
