import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, AfrrFilters, NodeTenderFilters, NodeTenderFilterOptions } from './shared/electron-api';

async function invokeWithFallback<T>(channel: string, fallbackValue: T, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/No handler registered/i.test(message)) {
      console.warn(`Missing IPC handler for ${channel}; using fallback value.`);
      return fallbackValue;
    }
    throw error;
  }
}

const api: ElectronAPI = {
  saveFile: (data: string, defaultName: string) => ipcRenderer.invoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => ipcRenderer.invoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => ipcRenderer.invoke('file:savePdf', pdfData, defaultName),
  loadPriceData: (year: number, area = 'NO1') => ipcRenderer.invoke('data:loadPriceData', year, area),
  getAvailableYears: (area = 'NO1') => ipcRenderer.invoke('data:getAvailableYears', area),
  loadSpotData: (biddingZone = 'NO1', year: number | null = null) => ipcRenderer.invoke('data:loadSpotData', biddingZone, year),
  loadAfrrData: (year: number, filters: AfrrFilters = {}) => ipcRenderer.invoke('data:loadAfrrData', year, filters),
  getAfrrAvailableYears: (filters: AfrrFilters = {}) => ipcRenderer.invoke('data:getAfrrAvailableYears', filters),
  loadSolarData: (year: number, resolutionMinutes = 60) => ipcRenderer.invoke('data:loadSolarData', year, resolutionMinutes),
  getSolarAvailableYears: (resolutionMinutes = 60) => ipcRenderer.invoke('data:getSolarAvailableYears', resolutionMinutes),
  loadNodeTenders: (filters: NodeTenderFilters = {}) => invokeWithFallback('data:loadNodeTenders', [] as never[], filters),
  getNodeTenderFilters: (dataset = 'nodes_2026_pilot') => invokeWithFallback<NodeTenderFilterOptions>('data:getNodeTenderFilters', {
    gridNodes: [],
    markets: [],
    statuses: [],
    total: 0,
  }, dataset),
};

contextBridge.exposeInMainWorld('electronAPI', api);
