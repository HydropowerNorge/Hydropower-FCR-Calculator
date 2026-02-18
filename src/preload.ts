import { contextBridge, ipcRenderer } from 'electron';
import type {
  AfrrFilters,
  ElectronAPI,
  NodeTenderFilterOptions,
  NodeTenderFilters,
  NodeTenderRow,
} from './shared/electron-api';

console.log('[preload] Preload script starting');

interface InvokeOptions<T> {
  fallbackFactory?: () => T;
}

function createEmptyNodeTenderRows(): NodeTenderRow[] {
  return [];
}

function createDefaultNodeTenderFilterOptions(): NodeTenderFilterOptions {
  return {
    gridNodes: [],
    markets: [],
    statuses: [],
    total: 0,
  };
}

function isMissingIpcHandlerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /No handler registered/i.test(message);
}

async function invokeRenderer<T>(
  channel: string,
  args: unknown[] = [],
  options: InvokeOptions<T> = {},
): Promise<T> {
  const logArgs = args.length > 0 ? args : undefined;
  console.log(`[preload] IPC invoke: ${channel}`, logArgs);
  const start = Date.now();

  try {
    const result = (await ipcRenderer.invoke(channel, ...args)) as T;
    const resultSummary = Array.isArray(result) ? result.length : typeof result;
    console.log(`[preload] IPC result: ${channel} -> ${resultSummary} (${Date.now() - start}ms)`);
    return result;
  } catch (error) {
    if (options.fallbackFactory && isMissingIpcHandlerError(error)) {
      console.warn(`[preload] Missing IPC handler for ${channel}; using fallback value.`);
      return options.fallbackFactory();
    }

    console.error(`[preload] IPC error: ${channel} (${Date.now() - start}ms):`, error);
    throw error;
  }
}

const api: ElectronAPI = {
  getAppVersion(): Promise<string> {
    return invokeRenderer<string>('app:getVersion');
  },
  saveFile(data: string, defaultName: string): Promise<string | null> {
    return invokeRenderer<string | null>('file:save', [data, defaultName]);
  },
  saveExcel(data: number[], defaultName: string): Promise<string | null> {
    return invokeRenderer<string | null>('file:saveExcel', [data, defaultName]);
  },
  savePdf(pdfData, defaultName): Promise<string | null> {
    return invokeRenderer<string | null>('file:savePdf', [pdfData, defaultName]);
  },
  loadPriceData(year: number, area = 'NO1') {
    return invokeRenderer('data:loadPriceData', [year, area]);
  },
  getAvailableYears(area = 'NO1') {
    return invokeRenderer('data:getAvailableYears', [area]);
  },
  loadSpotData(biddingZone = 'NO1', year: number | null = null) {
    return invokeRenderer('data:loadSpotData', [biddingZone, year]);
  },
  loadAfrrData(year: number, filters: AfrrFilters = {}) {
    return invokeRenderer('data:loadAfrrData', [year, filters]);
  },
  getAfrrAvailableYears(filters: AfrrFilters = {}) {
    return invokeRenderer('data:getAfrrAvailableYears', [filters]);
  },
  loadSolarData(year: number, resolutionMinutes = 60) {
    return invokeRenderer('data:loadSolarData', [year, resolutionMinutes]);
  },
  getSolarAvailableYears(resolutionMinutes = 60) {
    return invokeRenderer('data:getSolarAvailableYears', [resolutionMinutes]);
  },
  loadNodeTenders(filters: NodeTenderFilters = {}) {
    return invokeRenderer('data:loadNodeTenders', [filters], {
      fallbackFactory: createEmptyNodeTenderRows,
    });
  },
  getNodeTenderFilters(dataset = 'nodes_2026_pilot') {
    return invokeRenderer('data:getNodeTenderFilters', [dataset], {
      fallbackFactory: createDefaultNodeTenderFilterOptions,
    });
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] electronAPI exposed to renderer');
