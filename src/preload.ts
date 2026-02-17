import { contextBridge, ipcRenderer } from 'electron';
import type {
  AfrrFilters,
  ElectronAPI,
  NodeTenderFilterOptions,
  NodeTenderFilters,
  NodeTenderRow,
} from './shared/electron-api';

console.log('[preload] Preload script starting');

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

async function invokeWithFallback<T>(
  channel: string,
  fallbackFactory: () => T,
  ...args: unknown[]
): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/No handler registered/i.test(message)) {
      console.warn(`[preload] Missing IPC handler for ${channel}; using fallback value.`);
      return fallbackFactory();
    }
    console.error(`[preload] IPC invoke failed for ${channel}:`, error);
    throw error;
  }
}

async function tracedInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const logArgs = args.length > 0 ? args : undefined;
  console.log(`[preload] IPC invoke: ${channel}`, logArgs);
  const start = Date.now();
  try {
    const result = (await ipcRenderer.invoke(channel, ...args)) as T;
    const resultSummary = Array.isArray(result) ? result.length : typeof result;
    console.log(`[preload] IPC result: ${channel} -> ${resultSummary} (${Date.now() - start}ms)`);
    return result;
  } catch (error) {
    console.error(`[preload] IPC error: ${channel} (${Date.now() - start}ms):`, error);
    throw error;
  }
}

const api: ElectronAPI = {
  saveFile(data: string, defaultName: string): Promise<string | null> {
    return tracedInvoke<string | null>('file:save', data, defaultName);
  },
  saveXlsx(exportData, defaultName): Promise<string | null> {
    return tracedInvoke<string | null>('file:saveXlsx', exportData, defaultName);
  },
  savePdf(pdfData, defaultName): Promise<string | null> {
    return tracedInvoke<string | null>('file:savePdf', pdfData, defaultName);
  },
  loadPriceData(year: number, area = 'NO1') {
    return tracedInvoke('data:loadPriceData', year, area);
  },
  getAvailableYears(area = 'NO1') {
    return tracedInvoke('data:getAvailableYears', area);
  },
  loadSpotData(biddingZone = 'NO1', year: number | null = null) {
    return tracedInvoke('data:loadSpotData', biddingZone, year);
  },
  loadAfrrData(year: number, filters: AfrrFilters = {}) {
    return tracedInvoke('data:loadAfrrData', year, filters);
  },
  getAfrrAvailableYears(filters: AfrrFilters = {}) {
    return tracedInvoke('data:getAfrrAvailableYears', filters);
  },
  loadSolarData(year: number, resolutionMinutes = 60) {
    return tracedInvoke('data:loadSolarData', year, resolutionMinutes);
  },
  getSolarAvailableYears(resolutionMinutes = 60) {
    return tracedInvoke('data:getSolarAvailableYears', resolutionMinutes);
  },
  loadNodeTenders(filters: NodeTenderFilters = {}) {
    return invokeWithFallback('data:loadNodeTenders', createEmptyNodeTenderRows, filters);
  },
  getNodeTenderFilters(dataset = 'nodes_2026_pilot') {
    return invokeWithFallback(
      'data:getNodeTenderFilters',
      createDefaultNodeTenderFilterOptions,
      dataset,
    );
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] electronAPI exposed to renderer');
