/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, Menu, autoUpdater, ipcMain, dialog } from 'electron';
import type { IpcMainInvokeEvent, MessageBoxOptions, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import type { PdfExportData } from './shared/electron-api';

if (require('electron-squirrel-startup')) {
  app.quit();
}

function loadDotEnvFiles() {
  const candidateRoots = new Set([
    app.getAppPath(),
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..')
  ]);

  for (const root of candidateRoots) {
    const envLocalPath = path.join(root, '.env.local');
    const envPath = path.join(root, '.env');

    if (fs.existsSync(envLocalPath)) {
      dotenv.config({ path: envLocalPath });
    }

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
}

loadDotEnvFiles();

const SAFE_CODE_PATTERN = /^[A-Z0-9_-]{2,12}$/;
const UPDATE_MENU_ITEM_ID = 'check-for-updates';
const DEFAULT_AUTO_UPDATE_REPO = 'HydropowerNorge/Hydropower-FCR-Calculator';
const DEFAULT_AUTO_UPDATE_HOST = 'https://update.electronjs.org';

let autoUpdatesConfigured = false;
let autoUpdateListenersAttached = false;
let manualUpdateCheckInProgress = false;
let autoUpdateSourceReference: string | null = null;
let autoUpdateConfigurationIssue: string | null = null;
let lastAutoUpdateErrorMessage: string | null = null;

function isAutoUpdateSupportedPlatform(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function showMessageBoxWithWindow(options: MessageBoxOptions) {
  const activeWindow = getActiveWindow();
  if (activeWindow) {
    return dialog.showMessageBox(activeWindow, options);
  }

  return dialog.showMessageBox(options);
}

function buildAutoUpdateErrorDetail(rawMessage: string): string {
  const message = typeof rawMessage === 'string' && rawMessage.trim().length > 0
    ? rawMessage.trim()
    : 'Unknown error';

  if (/invalid response|404|cannot find channel/i.test(message) && autoUpdateSourceReference) {
    return `${message}\n\nGitHub update endpoint:\n${autoUpdateSourceReference}\n\nVerify the repository is public and that release artifacts exist for this platform.`;
  }

  if (/403|401|forbidden|unauthorized|rate limit/i.test(message)) {
    return `${message}\n\nVerify GitHub release access is public and not blocked by API limits.`;
  }

  return message;
}

function createCheckForUpdatesMenuItem(): MenuItemConstructorOptions {
  return {
    id: UPDATE_MENU_ITEM_ID,
    label: manualUpdateCheckInProgress ? 'Checking for updates...' : 'Check for updates...',
    enabled: !manualUpdateCheckInProgress,
    click: () => {
      void checkForUpdatesFromMenu();
    }
  };
}

function buildApplicationMenuTemplate(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  return [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [createCheckForUpdatesMenuItem()]
    }
  ];
}

function installApplicationMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate()));
}

function setManualUpdateCheckInProgress(inProgress: boolean) {
  manualUpdateCheckInProgress = inProgress;
  installApplicationMenu();
}

function attachAutoUpdateFeedbackHandlers() {
  if (autoUpdateListenersAttached) {
    return;
  }

  autoUpdater.on('update-available', () => {
    if (!manualUpdateCheckInProgress) {
      return;
    }

    setManualUpdateCheckInProgress(false);
    void showMessageBoxWithWindow({
      type: 'info',
      title: 'Update available',
      message: 'A new update is available.',
      detail: 'Hydropower is downloading it in the background. You will be prompted to restart when it is ready.'
    });
  });

  autoUpdater.on('update-not-available', () => {
    if (!manualUpdateCheckInProgress) {
      return;
    }

    setManualUpdateCheckInProgress(false);
    void showMessageBoxWithWindow({
      type: 'info',
      title: 'Up to date',
      message: 'You are already using the latest version of Hydropower.'
    });
  });

  autoUpdater.on('error', (error: Error) => {
    const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    lastAutoUpdateErrorMessage = rawMessage;

    if (!manualUpdateCheckInProgress) {
      return;
    }

    setManualUpdateCheckInProgress(false);
    void showMessageBoxWithWindow({
      type: 'error',
      title: 'Update check failed',
      message: 'Could not check for updates.',
      detail: buildAutoUpdateErrorDetail(rawMessage)
    });
  });

  autoUpdater.on('update-downloaded', () => {
    if (manualUpdateCheckInProgress) {
      setManualUpdateCheckInProgress(false);
    }
  });

  autoUpdateListenersAttached = true;
}

async function checkForUpdatesFromMenu() {
  if (manualUpdateCheckInProgress) {
    await showMessageBoxWithWindow({
      type: 'info',
      title: 'Update check',
      message: 'An update check is already in progress.'
    });
    return;
  }

  if (!app.isPackaged) {
    await showMessageBoxWithWindow({
      type: 'info',
      title: 'Update check',
      message: 'Update checks are only available in installed builds.'
    });
    return;
  }

  if (!isAutoUpdateSupportedPlatform()) {
    await showMessageBoxWithWindow({
      type: 'info',
      title: 'Update check',
      message: 'Auto-updates are only supported on macOS and Windows.'
    });
    return;
  }

  if (process.env.ELECTRON_DISABLE_AUTO_UPDATE === '1') {
    await showMessageBoxWithWindow({
      type: 'info',
      title: 'Update check',
      message: 'Auto-update is disabled for this build.'
    });
    return;
  }

  if (!autoUpdatesConfigured) {
    const detail = autoUpdateConfigurationIssue || (lastAutoUpdateErrorMessage
      ? buildAutoUpdateErrorDetail(lastAutoUpdateErrorMessage)
      : undefined);
    await showMessageBoxWithWindow({
      type: 'error',
      title: 'Update check failed',
      message: 'Auto-update is not configured correctly for this app.',
      ...(detail ? { detail } : {})
    });
    return;
  }

  try {
    setManualUpdateCheckInProgress(true);
    autoUpdater.checkForUpdates();
  } catch (error) {
    setManualUpdateCheckInProgress(false);
    await showMessageBoxWithWindow({
      type: 'error',
      title: 'Update check failed',
      message: 'Could not start checking for updates.',
      detail: error instanceof Error ? error.message : String(error ?? 'Unknown error')
    });
  }
}

function resolveGitHubUpdateSource() {
  const repo = (process.env.ELECTRON_AUTO_UPDATE_REPO || DEFAULT_AUTO_UPDATE_REPO).trim();
  const host = (process.env.ELECTRON_AUTO_UPDATE_HOST || DEFAULT_AUTO_UPDATE_HOST)
    .trim()
    .replace(/\/+$/, '');

  return { repo, host };
}

function initializeAutoUpdates() {
  autoUpdatesConfigured = false;
  autoUpdateSourceReference = null;
  autoUpdateConfigurationIssue = null;
  lastAutoUpdateErrorMessage = null;
  if (!app.isPackaged) return;
  if (process.env.ELECTRON_DISABLE_AUTO_UPDATE === '1') return;
  if (!isAutoUpdateSupportedPlatform()) return;

  try {
    const source = resolveGitHubUpdateSource();
    autoUpdateSourceReference = `${source.host}/${source.repo}/${process.platform}-${process.arch}/${app.getVersion()}`;

    if (!source.repo.includes('/')) {
      autoUpdateConfigurationIssue = `ELECTRON_AUTO_UPDATE_REPO must be in "owner/repo" format. Current value: ${source.repo}`;
      return;
    }

    if (!source.host.startsWith('https://')) {
      console.warn(`Auto-update skipped: update host must be HTTPS. Got: ${source.host}`);
      autoUpdateConfigurationIssue = `Update host must start with HTTPS. Current value: ${source.host}`;
      return;
    }

    const { updateElectronApp, UpdateSourceType } = require('update-electron-app');
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: source.repo,
        host: source.host
      },
      logger: console
    });
    attachAutoUpdateFeedbackHandlers();
    autoUpdatesConfigured = true;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    autoUpdateConfigurationIssue = buildAutoUpdateErrorDetail(rawMessage);
    console.error('Failed to initialize auto-update:', error);
  }
}

function sanitizeAreaCode(value: unknown, fallback = 'NO1'): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SAFE_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

function sanitizeLookupValue(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeYear(value: unknown): number | null {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
}

function sanitizeDirection(value: unknown, fallback = 'down'): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'up' || normalized === 'down') return normalized;
  return fallback;
}

function sanitizeReserveType(value: unknown, fallback = 'afrr'): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (/^[a-z0-9_-]{2,20}$/.test(normalized)) return normalized;
  return fallback;
}

function sanitizeResolutionMinutes(value: unknown, fallback = 60): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 240) return fallback;
  return parsed;
}

function sanitizeDefaultName(defaultName: unknown, fallbackName: string): string {
  if (typeof defaultName !== 'string' || defaultName.trim().length === 0) {
    return fallbackName;
  }
  return path.basename(defaultName.trim());
}

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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

ipcMain.handle('file:save', async (_event: IpcMainInvokeEvent, data: unknown, defaultName: unknown) => {
  const safeDefaultName = sanitizeDefaultName(defaultName, 'export.csv');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!canceled && filePath) {
    const csvContent = typeof data === 'string' ? data : String(data ?? '');
    await fs.promises.writeFile(filePath, csvContent, 'utf-8');
    return filePath;
  }
  return null;
});

ipcMain.handle('file:saveXlsx', async (_event: IpcMainInvokeEvent, exportData: unknown, defaultName: unknown) => {
  if (!exportData || typeof exportData !== 'object') {
    return null;
  }

  const safeDefaultName = sanitizeDefaultName(defaultName, 'export.xlsx');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return null;

  const data = exportData as Record<string, unknown>;
  const workbook = new ExcelJS.Workbook();
  const hourlyData = Array.isArray(data.hourlyData) ? data.hourlyData : [];
  const monthly = Array.isArray(data.monthly) ? data.monthly : [];
  const config = data.config && typeof data.config === 'object' ? data.config as Record<string, unknown> : {};

  // Hourly Data sheet
  const hourlySheet = workbook.addWorksheet('Timedata');
  hourlySheet.getCell('A1').value = `FCR-N Inntektsanalyse - ${config.year} - ${config.powerMw} MW Batteri`;
  hourlySheet.getCell('A1').font = { bold: true, size: 14 };

  hourlySheet.getRow(2).values = ['Tidspunkt', 'FCR-N Pris (EUR/MW)', 'Tilgjengelig', 'Inntekt (EUR)', 'SOC Start (%)', 'SOC Slutt (%)'];
  hourlySheet.getRow(2).font = { bold: true };

  hourlyData.forEach((row: Record<string, unknown>, i: number) => {
    hourlySheet.getRow(i + 3).values = [
      new Date(row.timestamp as number),
      row.price as number,
      (row.available as boolean) ? 'Ja' : 'Nei',
      row.revenue as number,
      (row.socStart as number | null) !== null ? (row.socStart as number) * 100 : null,
      (row.socEnd as number | null) !== null ? (row.socEnd as number) * 100 : null
    ];
  });

  hourlySheet.getColumn(1).width = 20;
  hourlySheet.getColumn(2).width = 18;
  hourlySheet.getColumn(3).width = 14;
  hourlySheet.getColumn(4).width = 14;
  hourlySheet.getColumn(4).numFmt = '#,##0.00';
  hourlySheet.getColumn(5).width = 14;
  hourlySheet.getColumn(5).numFmt = '0.00';
  hourlySheet.getColumn(6).width = 14;
  hourlySheet.getColumn(6).numFmt = '0.00';

  // Monthly Summary sheet
  const monthlySheet = workbook.addWorksheet('Månedlig Oppsummering');
  monthlySheet.getCell('A1').value = 'Månedlig Oppsummering';
  monthlySheet.getCell('A1').font = { bold: true, size: 14 };

  monthlySheet.getRow(2).values = ['Måned', 'Inntekt (EUR)', 'Timer', 'Snittpris (EUR/MW)'];
  monthlySheet.getRow(2).font = { bold: true };

  monthly.forEach((row: Record<string, unknown>, i: number) => {
    monthlySheet.getRow(i + 3).values = [row.month as string, row.revenue as number, row.hours as number, row.avgPrice as number];
  });

  const totalRow = monthly.length + 3;
  monthlySheet.getCell(`A${totalRow}`).value = 'TOTAL';
  monthlySheet.getCell(`A${totalRow}`).font = { bold: true };
  monthlySheet.getCell(`B${totalRow}`).value = { formula: `SUM(B3:B${totalRow - 1})` } as unknown as ExcelJS.CellFormulaValue;
  monthlySheet.getCell(`C${totalRow}`).value = { formula: `SUM(C3:C${totalRow - 1})` } as unknown as ExcelJS.CellFormulaValue;
  monthlySheet.getCell(`D${totalRow}`).value = { formula: `AVERAGE(D3:D${totalRow - 1})` } as unknown as ExcelJS.CellFormulaValue;

  monthlySheet.getColumn(2).numFmt = '#,##0.00';
  monthlySheet.getColumn(4).numFmt = '#,##0.00';

  // Configuration sheet
  const configSheet = workbook.addWorksheet('Konfigurasjon');
  configSheet.getCell('A1').value = 'Batterikonfigurasjon';
  configSheet.getCell('A1').font = { bold: true, size: 14 };

  const configRows: [string, unknown][] = [
    ['Effektkapasitet (MW)', config.powerMw],
    ['Energikapasitet (MWh)', config.capacityMwh],
    ['Virkningsgrad (%)', config.efficiency],
    ['Min SOC (%)', config.socMin],
    ['Maks SOC (%)', config.socMax],
    ['År', config.year],
    ['Total Inntekt (EUR)', { formula: `'Månedlig Oppsummering'!B${totalRow}` }],
    ['Totalt Antall Timer', config.totalHours],
    ['Tilgjengelige Timer', config.availableHours],
    ['Tilgjengelighet (%)', { formula: 'B10/B9*100' }]
  ];

  configRows.forEach((row, i) => {
    configSheet.getRow(i + 3).values = row as ExcelJS.CellValue[];
  });

  configSheet.getColumn(1).width = 25;
  configSheet.getColumn(2).width = 15;

  await workbook.xlsx.writeFile(filePath);
  return filePath;
});

ipcMain.handle('file:savePdf', async (_event: IpcMainInvokeEvent, pdfData: unknown, defaultName: unknown) => {
  if (!pdfData || typeof pdfData !== 'object') {
    return null;
  }

  const safeDefaultName = sanitizeDefaultName(defaultName, 'report.pdf');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;

  const html = buildPdfHtml(pdfData as PdfExportData);
  let pdfWindow: BrowserWindow | null = null;

  try {
    pdfWindow = new BrowserWindow({
      width: 1123,

      height: 794,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    await pdfWindow.webContents.executeJavaScript(`
      new Promise(resolve => {
        const imgs = document.querySelectorAll('img');
        if (imgs.length === 0) return resolve();
        let loaded = 0;
        imgs.forEach(img => {
          if (img.complete) { loaded++; if (loaded === imgs.length) resolve(); }
          else { img.onload = img.onerror = () => { loaded++; if (loaded === imgs.length) resolve(); }; }
        });
      });
    `);

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      landscape: true,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });

    await fs.promises.writeFile(filePath, pdfBuffer);
    return filePath;
  } catch (err) {
    console.error('Failed to save PDF:', err);
    return null;
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
  }
});

function buildPdfHtml(data: PdfExportData): string {
  const { chartImages, monthly, config, metrics } = data;
  const now = new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' });
  const duration = (config.capacityMwh / config.powerMw).toFixed(1);

  const monthlyRows = monthly.map(m => `
    <tr>
      <td>${m.month}</td>
      <td style="text-align:right">${euroFmt(m.revenue)}</td>
      <td style="text-align:right">${m.hours}</td>
      <td style="text-align:right">€${m.avgPrice.toFixed(0)}</td>
    </tr>
  `).join('');

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalHours = monthly.reduce((s, m) => s + m.hours, 0);
  const avgPrice = totalHours > 0 ? monthly.reduce((s, m) => s + m.avgPrice * m.hours, 0) / totalHours : 0;

  const chartSection = (title: string, base64: string | null) => {
    if (!base64) return '';
    return `
      <div class="chart-box">
        <h3>${title}</h3>
        <img src="${base64}" />
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.4;
  }
  .page { padding: 24px 32px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 3px solid #e94560;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header h1 { font-size: 20px; color: #1a1a2e; }
  .header .meta { font-size: 10px; color: #666; text-align: right; }
  .config-bar {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    background: #f5f5f5;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 10px;
  }
  .config-bar span { color: #666; }
  .config-bar strong { color: #1a1a2e; }
  .metrics-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }
  .metric-box {
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px;
    text-align: center;
  }
  .metric-box .value {
    font-size: 18px;
    font-weight: 700;
    color: #e94560;
    display: block;
    margin-bottom: 2px;
  }
  .metric-box .label {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 18px;
  }
  .chart-box {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .chart-box h3 {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #1a1a2e;
    letter-spacing: 0.3px;
  }
  .chart-box img {
    width: 100%;
    height: auto;
    min-height: 160px;
    display: block;
  }
  .table-section { margin-bottom: 16px; page-break-before: always; }
  .table-section h2 {
    font-size: 13px;
    margin-bottom: 8px;
    color: #1a1a2e;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  th {
    background: #1a1a2e;
    color: #fff;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  th:nth-child(n+2) { text-align: right; }
  td {
    padding: 5px 10px;
    border-bottom: 1px solid #eee;
  }
  tr:nth-child(even) td { background: #fafafa; }
  tr.total-row td {
    font-weight: 700;
    border-top: 2px solid #1a1a2e;
    background: #f0f0f0;
  }
  .footer {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 9px;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>FCR-N Inntektsrapport</h1>
    <div class="meta">
      Generert: ${now}<br>
      Prisdata: ${config.year}
    </div>
  </div>

  <div class="config-bar">
    <div><span>Effekt:</span> <strong>${config.powerMw} MW</strong></div>
    <div><span>Energi:</span> <strong>${config.capacityMwh} MWh</strong></div>
    <div><span>Varighet:</span> <strong>${duration}h</strong></div>
    <div><span>Virkningsgrad:</span> <strong>${config.efficiency}%</strong></div>
    <div><span>SOC:</span> <strong>${config.socMin}%–${config.socMax}%</strong></div>
    <div><span>Prisområde:</span> <strong>NO1</strong></div>
  </div>

  <div class="metrics-row">
    <div class="metric-box">
      <span class="value">${metrics.totalRevenue}</span>
      <span class="label">Total inntekt</span>
    </div>
    <div class="metric-box">
      <span class="value">${metrics.availableHours}</span>
      <span class="label">Tilgjengelige timer</span>
    </div>
    <div class="metric-box">
      <span class="value">${metrics.availability}</span>
      <span class="label">Tilgjengelighet</span>
    </div>
    <div class="metric-box">
      <span class="value">${metrics.avgPrice}</span>
      <span class="label">Snittpris</span>
    </div>
  </div>

  <div class="charts-grid">
    ${chartSection('Månedlig inntekt', chartImages.monthly)}
    ${chartSection('Prisfordeling', chartImages.price)}
    ${chartSection('SOC-utvikling', chartImages.soc)}
    ${chartSection('Frekvensfordeling', chartImages.freq)}
  </div>

  <div class="table-section">
    <h2>Månedlig oppsummering</h2>
    <table>
      <thead>
        <tr>
          <th>Måned</th>
          <th>Inntekt (EUR)</th>
          <th>Timer</th>
          <th>Snittpris (EUR/MW)</th>
        </tr>
      </thead>
      <tbody>
        ${monthlyRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align:right">${euroFmt(totalRevenue)}</td>
          <td style="text-align:right">${totalHours}</td>
          <td style="text-align:right">€${avgPrice.toFixed(0)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    Denne rapporten er generert basert på historiske FCR-N priser for ${config.year} (NO1).
  </div>
</div>
</body>
</html>`;
}

function euroFmt(value: number): string {
  return '€' + Math.round(value).toLocaleString('nb-NO');
}

let convexClient: ConvexHttpClient | null = null;
let convexUrl: string | null = null;

function getConvexClient(): ConvexHttpClient {
  const configuredUrl = process.env.CONVEX_URL;
  if (!configuredUrl) {
    throw new Error(
      'Missing CONVEX_URL. Run `npx convex dev --once` and `npm run convex:seed`, or set CONVEX_URL for your deployment.',
    );
  }

  if (!convexClient || convexUrl !== configuredUrl) {
    convexClient = new ConvexHttpClient(configuredUrl);
    convexUrl = configuredUrl;
  }

  return convexClient;
}

interface PaginatedResult {
  page: unknown[];
  isDone: boolean;
  continueCursor: string;
}

interface PaginationOptions {
  traceLabel?: string;
  logEveryPage?: boolean;
}

async function runConvexQuery(functionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const client = getConvexClient();
  return client.query(functionName as never, args as never);
}

async function runPaginatedConvexQuery(
  functionName: string,
  args: Record<string, unknown> = {},
  pageSize = 1000,
  options: PaginationOptions = {},
): Promise<unknown[]> {
  const traceLabel = typeof options.traceLabel === 'string' && options.traceLabel.trim()
    ? options.traceLabel.trim()
    : null;
  const logEveryPage = options.logEveryPage === true;
  const startedAt = Date.now();
  const allRows: unknown[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  try {
    while (true) {
      const pageStartedAt = Date.now();
      const pageResult = await runConvexQuery(functionName, {
        ...args,
        paginationOpts: {
          numItems: pageSize,
          cursor,
        },
      }) as PaginatedResult;
      pageCount += 1;

      const pageRows = Array.isArray(pageResult?.page) ? pageResult.page.length : 0;
      allRows.push(...(Array.isArray(pageResult?.page) ? pageResult.page : []));

      if (
        traceLabel
        && (logEveryPage || pageCount === 1 || pageResult.isDone)
      ) {
        console.info(
          `[${traceLabel}] page ${pageCount}: ${pageRows} rows `
          + `(${allRows.length} total) in ${Date.now() - pageStartedAt}ms`,
        );
      }

      if (pageResult.isDone) {
        break;
      }

      cursor = pageResult.continueCursor;
    }

    if (traceLabel) {
      console.info(
        `[${traceLabel}] complete: ${allRows.length} rows `
        + `across ${pageCount} pages in ${Date.now() - startedAt}ms`,
      );
    }

    return allRows;
  } catch (error) {
    if (traceLabel) {
      console.error(
        `[${traceLabel}] failed after ${Date.now() - startedAt}ms `
        + `(${allRows.length} rows, ${pageCount} pages):`,
        error,
      );
    }
    throw error;
  }
}

ipcMain.handle('data:loadPriceData', async (_event: IpcMainInvokeEvent, year: unknown, area: unknown = 'NO1') => {
  const safeYear = sanitizeYear(year);
  if (safeYear === null) {
    return [];
  }

  const safeArea = sanitizeAreaCode(area, 'NO1');
  try {
    return await runPaginatedConvexQuery('prices:getPriceDataPage', {
      year: safeYear,
      area: safeArea,
    });
  } catch (err) {
    console.error('Failed to load price data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:getAvailableYears', async (_event: IpcMainInvokeEvent, area: unknown = 'NO1') => {
  const safeArea = sanitizeAreaCode(area, 'NO1');
  try {
    return await runConvexQuery('prices:getAvailableYears', {
      area: safeArea,
    });
  } catch (err) {
    console.error('Failed to fetch available years from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:loadSpotData', async (_event: IpcMainInvokeEvent, biddingZone: unknown = 'NO1', year: unknown = null) => {
  const safeBiddingZone = sanitizeAreaCode(biddingZone, 'NO1');
  const safeYear = sanitizeYear(year);
  try {
    return await runPaginatedConvexQuery('spot:getSpotDataPage', {
      biddingZone: safeBiddingZone,
      ...(safeYear !== null ? { year: safeYear } : {}),
    });
  } catch (err) {
    console.error('Failed to load spot data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:loadAfrrData', async (_event: IpcMainInvokeEvent, year: unknown, filters: Record<string, unknown> = {}) => {
  const safeYear = sanitizeYear(year);
  if (safeYear === null) {
    return [];
  }

  const safeBiddingZone = sanitizeAreaCode(filters?.biddingZone, 'NO1');
  const safeDirection = sanitizeDirection(filters?.direction, 'down');
  const safeReserveType = sanitizeReserveType(filters?.reserveType, 'afrr');
  const safeResolutionMin = sanitizeResolutionMinutes(filters?.resolutionMin, 60);
  const traceLabel = `aFRR fetch ${safeBiddingZone}/${safeDirection}/${safeReserveType}/${safeResolutionMin}m/${safeYear}`;
  const startedAt = Date.now();

  try {
    console.info(`[${traceLabel}] start`);
    const rows = await runPaginatedConvexQuery('afrr:getAfrrDataPage', {
      year: safeYear,
      biddingZone: safeBiddingZone,
      direction: safeDirection,
      reserveType: safeReserveType,
      resolutionMin: safeResolutionMin,
    }, 1000, {
      traceLabel,
      logEveryPage: true,
    });
    console.info(`[${traceLabel}] success in ${Date.now() - startedAt}ms`);
    return rows;
  } catch (err) {
    console.error(`[${traceLabel}] failed in ${Date.now() - startedAt}ms:`, err);
    return [];
  }
});

ipcMain.handle('data:getAfrrAvailableYears', async (_event: IpcMainInvokeEvent, filters: Record<string, unknown> = {}) => {
  const safeBiddingZone = sanitizeAreaCode(filters?.biddingZone, 'NO1');
  const safeDirection = sanitizeDirection(filters?.direction, 'down');
  const safeReserveType = sanitizeReserveType(filters?.reserveType, 'afrr');
  const safeResolutionMin = sanitizeResolutionMinutes(filters?.resolutionMin, 60);
  const startedAt = Date.now();
  const traceLabel = `aFRR years ${safeBiddingZone}/${safeDirection}/${safeReserveType}/${safeResolutionMin}m`;

  try {
    console.info(`[${traceLabel}] start`);
    const years = await runConvexQuery('afrr:getAvailableYears', {
      biddingZone: safeBiddingZone,
      direction: safeDirection,
      reserveType: safeReserveType,
      resolutionMin: safeResolutionMin,
    }) as number[];
    console.info(`[${traceLabel}] fetched ${years.length} years in ${Date.now() - startedAt}ms`);
    return years;
  } catch (err) {
    console.error(`[${traceLabel}] failed in ${Date.now() - startedAt}ms:`, err);
    return [];
  }
});

ipcMain.handle('data:loadSolarData', async (_event: IpcMainInvokeEvent, year: unknown, resolutionMinutes: unknown = 60) => {
  const safeYear = sanitizeYear(year);
  if (safeYear === null) {
    return [];
  }

  const safeResolutionMinutes = sanitizeResolutionMinutes(resolutionMinutes, 60);
  try {
    return await runPaginatedConvexQuery('solar:getSolarDataPage', {
      year: safeYear,
      resolutionMinutes: safeResolutionMinutes,
    });
  } catch (err) {
    console.error('Failed to load solar data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:getSolarAvailableYears', async (_event: IpcMainInvokeEvent, resolutionMinutes: unknown = 60) => {
  const safeResolutionMinutes = sanitizeResolutionMinutes(resolutionMinutes, 60);
  try {
    return await runConvexQuery('solar:getAvailableYears', {
      resolutionMinutes: safeResolutionMinutes,
    });
  } catch (err) {
    console.error('Failed to fetch solar years from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:loadNodeTenders', async (_event: IpcMainInvokeEvent, filters: Record<string, unknown> = {}) => {
  const dataset = sanitizeLookupValue(filters?.dataset, 80) || 'nodes_2026_pilot';
  const gridNode = sanitizeLookupValue(filters?.gridNode, 120);
  const market = sanitizeLookupValue(filters?.market, 120);

  try {
    return await runPaginatedConvexQuery('nodes:getNodeTendersPage', {
      dataset,
      ...(gridNode ? { gridNode } : {}),
      ...(market ? { market } : {}),
    });
  } catch (err) {
    console.error('Failed to load node tender data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:getNodeTenderFilters', async (_event: IpcMainInvokeEvent, dataset: unknown = 'nodes_2026_pilot') => {
  const safeDataset = sanitizeLookupValue(dataset, 80) || 'nodes_2026_pilot';
  try {
    return await runConvexQuery('nodes:getNodeFilterOptions', {
      dataset: safeDataset,
    });
  } catch (err) {
    console.error('Failed to load node tender filter options from Convex:', err);
    return {
      gridNodes: [],
      markets: [],
      statuses: [],
      total: 0,
    };
  }
});

app.whenReady().then(() => {
  initializeAutoUpdates();
  installApplicationMenu();
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
