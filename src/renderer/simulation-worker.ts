import { BatteryConfig, calculateRevenue, simulateSocHourly } from './calculator';
import type { FrequencySummary, RevenueResult } from './calculator';
import { simulateFrequency } from './frequency';

interface SimulatePayload {
  year: number;
  hours: number;
  seed: number;
  profileName: string;
  config: {
    powerMw: number;
    capacityMwh: number;
    efficiency: number;
    socMin: number;
    socMax: number;
  };
  priceData: { timestamp: number; price: number }[];
}

interface SimulateMessage {
  type: 'simulate-fcr';
  payload: SimulatePayload;
}

interface WorkerResultMessage {
  type: 'result';
  payload: {
    result: RevenueResult;
    summary: FrequencySummary;
    totalSamples: number;
  };
}

interface WorkerProgressMessage {
  type: 'progress';
  message: string;
}

interface WorkerErrorMessage {
  type: 'error';
  error: string;
}

type WorkerOutgoingMessage = WorkerResultMessage | WorkerProgressMessage | WorkerErrorMessage;

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceData(priceData: unknown): { timestamp: number; price: number }[] {
  if (!Array.isArray(priceData)) return [];

  return priceData
    .map((row: Record<string, unknown>) => {
      const timestamp = toFiniteNumber(row?.timestamp, NaN);
      const price = toFiniteNumber(row?.price, 0);
      return { timestamp, price };
    })
    .filter((row) => Number.isFinite(row.timestamp));
}

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', (event: MessageEvent<SimulateMessage>) => {
  const message = event.data;
  if (!message || message.type !== 'simulate-fcr') return;

  try {
    const payload = message.payload || ({} as SimulatePayload);
    const year = toFiniteNumber(payload.year, new Date().getUTCFullYear());
    const hours = Math.max(0, Math.floor(toFiniteNumber(payload.hours, 0)));
    const seed = Math.floor(toFiniteNumber(payload.seed, 42));
    const profileName = typeof payload.profileName === 'string' ? payload.profileName : 'medium';
    const priceData = normalizePriceData(payload.priceData);

    const configValues = payload.config || { powerMw: 1, capacityMwh: 2, efficiency: 0.9, socMin: 0.2, socMax: 0.8 };
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
    } satisfies WorkerOutgoingMessage);

    const startTime = new Date(Date.UTC(year, 0, 1));
    const freqData = simulateFrequency(startTime, hours, 1, seed, profileName);

    self.postMessage({ type: 'progress', message: 'Simulerer batteri' } satisfies WorkerOutgoingMessage);
    const socData = simulateSocHourly(freqData, config);

    self.postMessage({ type: 'progress', message: 'Beregner inntekt' } satisfies WorkerOutgoingMessage);
    const priceDataWithDates = priceData.map(row => ({ timestamp: new Date(row.timestamp), price: row.price }));
    const result = calculateRevenue(priceDataWithDates, socData, config);

    self.postMessage({
      type: 'result',
      payload: {
        result,
        summary: freqData.summary,
        totalSamples: freqData.frequencies.length
      }
    } satisfies WorkerOutgoingMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    } satisfies WorkerOutgoingMessage);
  }
});
