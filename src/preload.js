const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (data, defaultName) => ipcRenderer.invoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => ipcRenderer.invoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => ipcRenderer.invoke('file:savePdf', pdfData, defaultName),
  loadPriceData: (year, area = 'NO1') => ipcRenderer.invoke('data:loadPriceData', year, area),
  getAvailableYears: (area = 'NO1') => ipcRenderer.invoke('data:getAvailableYears', area),
  loadSpotData: (biddingZone = 'NO1') => ipcRenderer.invoke('data:loadSpotData', biddingZone)
});
