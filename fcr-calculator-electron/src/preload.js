const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (data, defaultName) => ipcRenderer.invoke('file:save', data, defaultName),
  saveXlsx: (exportData, defaultName) => ipcRenderer.invoke('file:saveXlsx', exportData, defaultName),
  savePdf: (pdfData, defaultName) => ipcRenderer.invoke('file:savePdf', pdfData, defaultName),
  loadPriceFile: (year) => ipcRenderer.invoke('data:loadPriceFile', year),
  getAvailableYears: () => ipcRenderer.invoke('data:getAvailableYears'),
  loadSpotData: () => ipcRenderer.invoke('data:loadSpotData')
});
