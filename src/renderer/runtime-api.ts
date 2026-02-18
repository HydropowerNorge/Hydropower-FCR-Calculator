import { ConvexHttpClient } from 'convex/browser';
import type {
  AfrrFilters,
  ElectronAPI,
  NodeTenderFilterOptions,
  NodeTenderFilters,
  NodeTenderRow,
  PdfExportData,
} from '../shared/electron-api';

interface PaginatedResult<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string;
}

type ConvexArgs = Record<string, unknown>;

const DEFAULT_NODES_DATASET = 'nodes_2026_pilot';
const WEB_RUNTIME_VERSION_LABEL = 'web';

let webClient: ConvexHttpClient | null = null;
let cachedConvexUrl: string | null = null;
let usageRegistrationStarted = false;

function getWebConvexUrl(): string {
  const envUrl = typeof import.meta.env.VITE_CONVEX_URL === 'string'
    ? import.meta.env.VITE_CONVEX_URL.trim()
    : '';
  if (envUrl.length > 0) {
    return envUrl;
  }
  throw new Error('Mangler VITE_CONVEX_URL i web-modus.');
}

function getWebClient(): ConvexHttpClient {
  const convexUrl = getWebConvexUrl();
  if (!webClient || cachedConvexUrl !== convexUrl) {
    webClient = new ConvexHttpClient(convexUrl);
    cachedConvexUrl = convexUrl;
  }
  return webClient;
}

async function runConvexQuery<T = unknown>(functionName: string, args: ConvexArgs = {}): Promise<T> {
  const client = getWebClient();
  return client.query(functionName as never, args as never) as Promise<T>;
}

async function runConvexMutation<T = unknown>(functionName: string, args: ConvexArgs = {}): Promise<T> {
  const client = getWebClient();
  return client.mutation(functionName as never, args as never) as Promise<T>;
}

async function runPaginatedConvexQuery<T = unknown>(
  functionName: string,
  args: ConvexArgs = {},
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;

  while (true) {
    const result: PaginatedResult<T> = await runConvexQuery<PaginatedResult<T>>(functionName, {
      ...args,
      paginationOpts: {
        numItems: pageSize,
        cursor,
      },
    });

    rows.push(...(Array.isArray(result?.page) ? result.page : []));
    if (result?.isDone) {
      return rows;
    }
    cursor = result?.continueCursor || null;
  }
}

function createBrowserDownload(bytes: BlobPart, mimeType: string, defaultName: string): string {
  const blob = new Blob([bytes], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = defaultName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
  return defaultName;
}

function getOrCreateBrowserHardwareId(): string {
  const storageKey = 'hydropower_web_hardware_id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const random = crypto.getRandomValues(new Uint8Array(16));
  const suffix = Array.from(random).map((v) => v.toString(16).padStart(2, '0')).join('');
  const hardwareId = `web_${suffix}`;
  window.localStorage.setItem(storageKey, hardwareId);
  return hardwareId;
}

function registerWebOpenUsage(): void {
  if (usageRegistrationStarted) return;
  usageRegistrationStarted = true;

  void runConvexMutation('usage:registerOpen', {
    hardwareId: getOrCreateBrowserHardwareId(),
    openedAtTs: Date.now(),
  }).catch((error: unknown) => {
    console.warn('[web-runtime] usage:registerOpen failed:', error);
  });
}

function createDefaultNodeTenderFilterOptions(): NodeTenderFilterOptions {
  return {
    gridNodes: [],
    markets: [],
    statuses: [],
    total: 0,
  };
}

function createWebApi(): ElectronAPI {
  return {
    async getAppVersion(): Promise<string> {
      return WEB_RUNTIME_VERSION_LABEL;
    },
    async saveFile(data: string, defaultName: string): Promise<string | null> {
      return createBrowserDownload(data, 'text/csv;charset=utf-8', defaultName);
    },
    async saveExcel(data: number[], defaultName: string): Promise<string | null> {
      const bytes = Uint8Array.from(Array.isArray(data) ? data : []);
      return createBrowserDownload(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', defaultName);
    },
    async savePdf(_pdfData: PdfExportData, _defaultName: string): Promise<string | null> {
      return null;
    },
    async loadPriceData(year: number, area = 'NO1') {
      return runPaginatedConvexQuery('prices:getPriceDataPage', { year, area });
    },
    async getAvailableYears(area = 'NO1') {
      return runConvexQuery<number[]>('prices:getAvailableYears', { area });
    },
    async loadSpotData(biddingZone = 'NO1', year: number | null = null) {
      const args: ConvexArgs = { biddingZone };
      if (Number.isInteger(year)) {
        args.year = year;
      }
      return runPaginatedConvexQuery('spot:getSpotDataPage', args);
    },
    async loadAfrrData(year: number, filters: AfrrFilters = {}) {
      return runPaginatedConvexQuery('afrr:getAfrrDataPage', {
        year,
        biddingZone: filters.biddingZone ?? 'NO1',
        direction: filters.direction ?? 'down',
        reserveType: filters.reserveType ?? 'afrr',
        resolutionMin: filters.resolutionMin ?? 60,
      });
    },
    async getAfrrAvailableYears(filters: AfrrFilters = {}) {
      return runConvexQuery<number[]>('afrr:getAvailableYears', {
        biddingZone: filters.biddingZone ?? 'NO1',
        direction: filters.direction ?? 'down',
        reserveType: filters.reserveType ?? 'afrr',
        resolutionMin: filters.resolutionMin ?? 60,
      });
    },
    async loadSolarData(year: number, resolutionMinutes = 60) {
      return runPaginatedConvexQuery('solar:getSolarDataPage', {
        year,
        resolutionMinutes,
      });
    },
    async getSolarAvailableYears(resolutionMinutes = 60) {
      return runConvexQuery<number[]>('solar:getAvailableYears', { resolutionMinutes });
    },
    async loadNodeTenders(filters: NodeTenderFilters = {}) {
      const args: ConvexArgs = {
        dataset: filters.dataset || DEFAULT_NODES_DATASET,
      };
      if (filters.gridNode) {
        args.gridNode = filters.gridNode;
      }
      if (filters.market) {
        args.market = filters.market;
      }
      return runPaginatedConvexQuery<NodeTenderRow>('nodes:getNodeTendersPage', args);
    },
    async getNodeTenderFilters(dataset = DEFAULT_NODES_DATASET) {
      try {
        return await runConvexQuery<NodeTenderFilterOptions>('nodes:getNodeFilterOptions', { dataset });
      } catch {
        return createDefaultNodeTenderFilterOptions();
      }
    },
  };
}

export function ensureRuntimeApi(): void {
  if (window.electronAPI) {
    return;
  }
  window.electronAPI = createWebApi();
  registerWebOpenUsage();
}

export function isElectronRuntime(): boolean {
  return navigator.userAgent.includes('Electron');
}
