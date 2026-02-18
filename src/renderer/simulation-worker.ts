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

function createDefaultConfigValues(): SimulatePayload['config'] {
  return {
    powerMw: 1,
    capacityMwh: 2,
    efficiency: 0.9,
    socMin: 0.2,
    socMax: 0.8,
  };
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

function toPriceDataWithDates(priceData: { timestamp: number; price: number }[]): { timestamp: Date; price: number }[] {
  return priceData.map((row) => ({
    timestamp: new Date(row.timestamp),
    price: row.price,
  }));
}

function postWorkerMessage(message: WorkerOutgoingMessage): void {
  self.postMessage(message);
}

function postProgress(message: string): void {
  postWorkerMessage({ type: 'progress', message } satisfies WorkerOutgoingMessage);
}

function normalizeSimulationPayload(payload: Partial<SimulatePayload>): {
  year: number;
  hours: number;
  seed: number;
  profileName: string;
  priceData: { timestamp: number; price: number }[];
  config: SimulatePayload['config'];
} {
  const configValues = payload.config || createDefaultConfigValues();

  return {
    year: toFiniteNumber(payload.year, new Date().getUTCFullYear()),
    hours: Math.max(0, Math.floor(toFiniteNumber(payload.hours, 0))),
    seed: Math.floor(toFiniteNumber(payload.seed, 42)),
    profileName: typeof payload.profileName === 'string' ? payload.profileName : 'medium',
    priceData: normalizePriceData(payload.priceData),
    config: {
      powerMw: toFiniteNumber(configValues.powerMw, 1),
      capacityMwh: toFiniteNumber(configValues.capacityMwh, 2),
      efficiency: toFiniteNumber(configValues.efficiency, 0.9),
      socMin: toFiniteNumber(configValues.socMin, 0.2),
      socMax: toFiniteNumber(configValues.socMax, 0.8),
    },
  };
}

declare const self: DedicatedWorkerGlobalScope;

console.log('[worker] Simulation worker loaded');

self.addEventListener('message', (event: MessageEvent<SimulateMessage>) => {
  const message = event.data;
  console.log('[worker] Received message:', message?.type);
  if (!message || message.type !== 'simulate-fcr') return;

  try {
    const payload = normalizeSimulationPayload(message.payload || {});
    const { year, hours, seed, profileName, priceData } = payload;
    console.log('[worker] Simulation params:', { year, hours, seed, profileName, priceRows: priceData.length });

    const configValues = payload.config;
    const config = new BatteryConfig(
      configValues.powerMw,
      configValues.capacityMwh,
      configValues.efficiency,
      configValues.socMin,
      configValues.socMax
    );

    postProgress('Simulerer frekvens');

    const startTime = new Date(Date.UTC(year, 0, 1));
    const freqData = simulateFrequency(startTime, hours, 1, seed, profileName);

    postProgress('Simulerer batteri');
    const socData = simulateSocHourly(freqData, config);

    postProgress('Beregner inntekt');
    const priceDataWithDates = toPriceDataWithDates(priceData);
    const result = calculateRevenue(priceDataWithDates, socData, config);

    console.log('[worker] Simulation complete, posting result');
    postWorkerMessage({
      type: 'result',
      payload: {
        result,
        summary: freqData.summary,
        totalSamples: freqData.frequencies.length
      }
    } satisfies WorkerOutgoingMessage);
  } catch (error) {
    console.error('[worker] Simulation failed:', error);
    postWorkerMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    } satisfies WorkerOutgoingMessage);
  }
});
