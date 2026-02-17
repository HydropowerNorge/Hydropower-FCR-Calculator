import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, AfrrFilters, NodeTenderFilters, NodeTenderFilterOptions } from './shared/electron-api';

console.log('[preload] Preload script starting');

async function invokeWithFallback<T>(channel: string, fallbackValue: T, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/No handler registered/i.test(message)) {
      console.warn(`[preload] Missing IPC handler for ${channel}; using fallback value.`);
      return fallbackValue;
    }
    console.error(`[preload] IPC invoke failed for ${channel}:`, error);
    throw error;
  }
}

function tracedInvoke(channel: string, ...args: unknown[]) {
  console.log(`[preload] IPC invoke: ${channel}`, args.length > 0 ? args : '');
  const start = Date.now();
  return ipcRenderer.invoke(channel, ...args).then(
    (result) => {
      const rows = Array.isArray(result) ? result.length : typeof result;
      console.log(`[preload] IPC result: ${channel} -> ${rows} (${Date.now() - start}ms)`);
      return result;
    },
    (error) => {
      console.error(`[preload] IPC error: ${channel} (${Date.now() - start}ms):`, error);
      throw error;
    }
  );
}

const api: ElectronAPI = {
  saveFile: (data: string, defaultName: string) => tracedInvoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => tracedInvoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => tracedInvoke('file:savePdf', pdfData, defaultName),
  loadPriceData: (year: number, area = 'NO1') => tracedInvoke('data:loadPriceData', year, area),
  getAvailableYears: (area = 'NO1') => tracedInvoke('data:getAvailableYears', area),
  loadSpotData: (biddingZone = 'NO1', year: number | null = null) => tracedInvoke('data:loadSpotData', biddingZone, year),
  loadAfrrData: (year: number, filters: AfrrFilters = {}) => tracedInvoke('data:loadAfrrData', year, filters),
  getAfrrAvailableYears: (filters: AfrrFilters = {}) => tracedInvoke('data:getAfrrAvailableYears', filters),
  loadSolarData: (year: number, resolutionMinutes = 60) => tracedInvoke('data:loadSolarData', year, resolutionMinutes),
  getSolarAvailableYears: (resolutionMinutes = 60) => tracedInvoke('data:getSolarAvailableYears', resolutionMinutes),
  loadNodeTenders: (filters: NodeTenderFilters = {}) => invokeWithFallback('data:loadNodeTenders', [] as never[], filters),
  getNodeTenderFilters: (dataset = 'nodes_2026_pilot') => invokeWithFallback<NodeTenderFilterOptions>('data:getNodeTenderFilters', {
    gridNodes: [],
    markets: [],
    statuses: [],
    total: 0,
  }, dataset),
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] electronAPI exposed to renderer');
