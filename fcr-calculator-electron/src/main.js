const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// IPC handlers
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error('Failed to read file:', err);
    return null;
  }
});

ipcMain.handle('file:save', async (event, data, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, data, 'utf-8');
    return filePath;
  }
  return null;
});

ipcMain.handle('data:loadPriceFile', async (event, year) => {
  const dataPath = path.join(__dirname, '..', '..', `PrimaryReservesD-1-${year}.csv`);
  try {
    return fs.readFileSync(dataPath, 'utf-8');
  } catch (err) {
    console.error('Failed to load price data:', err);
    return null;
  }
});

ipcMain.handle('data:getAvailableYears', async () => {
  const years = [];
  const baseDir = path.join(__dirname, '..', '..');
  for (const year of [2024, 2025]) {
    const filePath = path.join(baseDir, `PrimaryReservesD-1-${year}.csv`);
    if (fs.existsSync(filePath)) {
      years.push(year);
    }
  }
  return years;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
