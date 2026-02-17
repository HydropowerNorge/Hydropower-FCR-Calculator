import { BatteryConfig, calculateRevenue, simulateSocHourly } from './calculator.js';
import { simulateFrequency } from './frequency.js';

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceData(priceData) {
  if (!Array.isArray(priceData)) return [];

  return priceData
    .map((row) => {
      const timestamp = toFiniteNumber(row?.timestamp, NaN);
      const price = toFiniteNumber(row?.price, 0);
      return { timestamp, price };
    })
    .filter((row) => Number.isFinite(row.timestamp));
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.type !== 'simulate-fcr') return;

  try {
    const payload = message.payload || {};
    const year = toFiniteNumber(payload.year, new Date().getUTCFullYear());
    const hours = Math.max(0, Math.floor(toFiniteNumber(payload.hours, 0)));
    const seed = Math.floor(toFiniteNumber(payload.seed, 42));
    const profileName = typeof payload.profileName === 'string' ? payload.profileName : 'medium';
    const priceData = normalizePriceData(payload.priceData);

    const configValues = payload.config || {};
    const config = new BatteryConfig(
      toFiniteNumber(configValues.powerMw, 1),
      toFiniteNumber(configValues.capacityMwh, 2),
      toFiniteNumber(configValues.efficiency, 0.9),
      toFiniteNumber(configValues.socMin, 0.2),
      toFiniteNumber(configValues.socMax, 0.8)
    );

    self.postMessage({
      type: 'progress',
      message: 'Simulerer frekvens'
    });

    const startTime = new Date(Date.UTC(year, 0, 1));
    const freqData = simulateFrequency(startTime, hours, 1, seed, profileName);

    self.postMessage({ type: 'progress', message: 'Simulerer batteri' });
    const socData = simulateSocHourly(freqData, config);

    self.postMessage({ type: 'progress', message: 'Beregner inntekt' });
    const result = calculateRevenue(priceData, socData, config);

    self.postMessage({
      type: 'result',
      payload: {
        result,
        summary: freqData.summary,
        totalSamples: freqData.frequencies.length
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
