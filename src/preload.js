const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data, defaultName) => ipcRenderer.invoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => ipcRenderer.invoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => ipcRenderer.invoke('file:savePdf', pdfData, defaultName),
  loadPriceData: (year, area = 'NO1') => ipcRenderer.invoke('data:loadPriceData', year, area),
  getAvailableYears: (area = 'NO1') => ipcRenderer.invoke('data:getAvailableYears', area),
  loadSpotData: (biddingZone = 'NO1') => ipcRenderer.invoke('data:loadSpotData', biddingZone),
  loadNodeTenders: (filters = {}) => ipcRenderer.invoke('data:loadNodeTenders', filters),
  getNodeTenderFilters: (dataset = 'nodes_2026_pilot') => ipcRenderer.invoke('data:getNodeTenderFilters', dataset)
});
