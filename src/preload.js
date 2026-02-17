const { contextBridge, ipcRenderer } = require('electron');

async function invokeWithFallback(channel, fallbackValue, ...args) {
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

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data, defaultName) => ipcRenderer.invoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => ipcRenderer.invoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => ipcRenderer.invoke('file:savePdf', pdfData, defaultName),
  loadPriceData: (year, area = 'NO1') => ipcRenderer.invoke('data:loadPriceData', year, area),
  getAvailableYears: (area = 'NO1') => ipcRenderer.invoke('data:getAvailableYears', area),
  loadSpotData: (biddingZone = 'NO1') => ipcRenderer.invoke('data:loadSpotData', biddingZone),
  loadNodeTenders: (filters = {}) => invokeWithFallback('data:loadNodeTenders', [], filters),
  getNodeTenderFilters: (dataset = 'nodes_2026_pilot') => invokeWithFallback('data:getNodeTenderFilters', {
    gridNodes: [],
    markets: [],
    statuses: [],
    total: 0,
  }, dataset)
});
