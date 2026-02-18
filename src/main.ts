/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, Menu, autoUpdater, ipcMain, dialog } from 'electron';
import type {
  IpcMainInvokeEvent,
  MessageBoxOptions,
  MessageBoxReturnValue,
  MenuItemConstructorOptions,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import type { PdfExportData } from './shared/electron-api';

console.log('[main] Process starting', {
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  pid: process.pid,
  execPath: process.execPath,
  cwd: process.cwd(),
  __dirname,
  resourcesPath: process.resourcesPath,
  isPackaged: app.isPackaged,
  appPath: app.getAppPath(),
  appVersion: app.getVersion(),
  appName: app.getName(),
});

if (require('electron-squirrel-startup')) {
  console.log('[main] Squirrel startup detected, quitting');
  app.quit();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function tryLoadEnvFile(root: string, fileName: '.env.local' | '.env'): void {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  console.log(`[main] Found ${fileName} at:`, filePath);
  dotenv.config({ path: filePath });
}

function loadDotEnvFiles(): void {
  const candidateRoots = new Set([
    app.getAppPath(),
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..')
  ]);

  console.log('[main] Loading .env files from candidate roots:', Array.from(candidateRoots));

  for (const root of candidateRoots) {
    tryLoadEnvFile(root, '.env.local');
    tryLoadEnvFile(root, '.env');
  }

  console.log('[main] CONVEX_URL configured:', !!process.env.CONVEX_URL);
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

function showMessageBoxWithWindow(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
  const activeWindow = getActiveWindow();
  if (activeWindow) {
    return dialog.showMessageBox(activeWindow, options);
  }

  return dialog.showMessageBox(options);
}

async function showUpdateCheckInfo(message: string): Promise<void> {
  await showMessageBoxWithWindow({
    type: 'info',
    title: 'Update check',
    message,
  });
}

async function showUpdateCheckFailure(message: string, detail?: string): Promise<void> {
  await showMessageBoxWithWindow({
    type: 'error',
    title: 'Update check failed',
    message,
    ...(detail ? { detail } : {}),
  });
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

function attachAutoUpdateFeedbackHandlers(): void {
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
    const rawMessage = toErrorMessage(error);
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

async function checkForUpdatesFromMenu(): Promise<void> {
  if (manualUpdateCheckInProgress) {
    await showUpdateCheckInfo('An update check is already in progress.');
    return;
  }

  if (!app.isPackaged) {
    await showUpdateCheckInfo('Update checks are only available in installed builds.');
    return;
  }

  if (!isAutoUpdateSupportedPlatform()) {
    await showUpdateCheckInfo('Auto-updates are only supported on macOS and Windows.');
    return;
  }

  if (process.env.ELECTRON_DISABLE_AUTO_UPDATE === '1') {
    await showUpdateCheckInfo('Auto-update is disabled for this build.');
    return;
  }

  if (!autoUpdatesConfigured) {
    const detail = autoUpdateConfigurationIssue
      ?? (lastAutoUpdateErrorMessage
        ? buildAutoUpdateErrorDetail(lastAutoUpdateErrorMessage)
        : undefined);
    await showUpdateCheckFailure('Auto-update is not configured correctly for this app.', detail);
    return;
  }

  try {
    setManualUpdateCheckInProgress(true);
    autoUpdater.checkForUpdates();
  } catch (error) {
    setManualUpdateCheckInProgress(false);
    await showUpdateCheckFailure('Could not start checking for updates.', toErrorMessage(error));
  }
}

function resolveGitHubUpdateSource() {
  const repo = (process.env.ELECTRON_AUTO_UPDATE_REPO || DEFAULT_AUTO_UPDATE_REPO).trim();
  const host = (process.env.ELECTRON_AUTO_UPDATE_HOST || DEFAULT_AUTO_UPDATE_HOST)
    .trim()
    .replace(/\/+$/, '');

  return { repo, host };
}

function getAutoUpdateSkipReason(): string | null {
  if (!app.isPackaged) {
    return 'not packaged';
  }

  if (process.env.ELECTRON_DISABLE_AUTO_UPDATE === '1') {
    return 'disabled by env';
  }

  if (!isAutoUpdateSupportedPlatform()) {
    return 'unsupported platform';
  }

  return null;
}

function initializeAutoUpdates(): void {
  console.log('[main] Initializing auto-updates', {
    isPackaged: app.isPackaged,
    platform: process.platform,
    disableEnv: process.env.ELECTRON_DISABLE_AUTO_UPDATE,
  });
  autoUpdatesConfigured = false;
  autoUpdateSourceReference = null;
  autoUpdateConfigurationIssue = null;
  lastAutoUpdateErrorMessage = null;

  const skipReason = getAutoUpdateSkipReason();
  if (skipReason) {
    console.log('[main] Auto-update skipped:', skipReason);
    return;
  }

  try {
    const source = resolveGitHubUpdateSource();
    autoUpdateSourceReference = `${source.host}/${source.repo}/${process.platform}-${process.arch}/${app.getVersion()}`;
    console.log('[main] Auto-update source:', autoUpdateSourceReference);

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
    const rawMessage = toErrorMessage(error);
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

function normalizeByteArray(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (!Array.isArray(data)) return null;

  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const value = Number(data[i]);
    if (!Number.isFinite(value)) return null;
    bytes[i] = Math.max(0, Math.min(255, Math.round(value)));
  }
  return bytes;
}

function logRendererDiagnostics(rendererPath: string): void {
  console.log('[main] Loading renderer file:', rendererPath);
  console.log('[main] Renderer file exists:', fs.existsSync(rendererPath));

  try {
    const parentDir = path.join(__dirname, '..');
    const siblings = fs.readdirSync(parentDir);
    console.log('[main] Contents of', parentDir, ':', siblings);

    const rendererDir = path.join(__dirname, '../renderer');
    if (fs.existsSync(rendererDir)) {
      const rendererContents = fs.readdirSync(rendererDir);
      console.log('[main] Contents of renderer dir:', rendererContents);

      const windowDir = path.join(rendererDir, MAIN_WINDOW_VITE_NAME);
      if (fs.existsSync(windowDir)) {
        const windowContents = fs.readdirSync(windowDir);
        console.log('[main] Contents of window dir:', windowContents);
      } else {
        console.warn('[main] Window dir does not exist:', windowDir);
      }
    } else {
      console.warn('[main] Renderer dir does not exist:', rendererDir);
    }
  } catch (err) {
    console.warn('[main] Could not list directory contents:', err);
  }
}

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[main] Creating main window', {
    __dirname,
    preloadPath,
    preloadExists: fs.existsSync(preloadPath),
    MAIN_WINDOW_VITE_DEV_SERVER_URL: MAIN_WINDOW_VITE_DEV_SERVER_URL || '(not set)',
    MAIN_WINDOW_VITE_NAME: MAIN_WINDOW_VITE_NAME || '(not set)',
  });

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] Window failed to load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] Window finished loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[main] Window DOM ready');
  });

  mainWindow.webContents.on('console-message', (details) => {
    console.log(`[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[main] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    logRendererDiagnostics(rendererPath);
    mainWindow.loadFile(rendererPath);
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

ipcMain.handle('file:saveExcel', async (_event: IpcMainInvokeEvent, data: unknown, defaultName: unknown) => {
  const safeDefaultName = sanitizeDefaultName(defaultName, 'export.xlsx');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });

  if (!canceled && filePath) {
    const bytes = normalizeByteArray(data);
    if (!bytes) return null;
    await fs.promises.writeFile(filePath, Buffer.from(bytes));
    return filePath;
  }

  return null;
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

  console.log('[main] Building PDF HTML');
  const html = buildPdfHtml(pdfData as PdfExportData);
  let pdfWindow: BrowserWindow | null = null;

  try {
    console.log('[main] Creating PDF window');
    pdfWindow = new BrowserWindow({
      width: 1123,

      height: 794,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    console.log('[main] Loading PDF data URL');
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
    console.error('[main] CONVEX_URL is not set in environment');
    throw new Error(
      'Missing CONVEX_URL. Run `npx convex dev --once` and `npm run convex:seed`, or set CONVEX_URL for your deployment.',
    );
  }

  if (!convexClient || convexUrl !== configuredUrl) {
    console.log('[main] Creating Convex client for URL:', configuredUrl);
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
  console.log('[main] App ready event fired');
  initializeAutoUpdates();
  installApplicationMenu();
  createWindow();

  app.on('activate', () => {
    console.log('[main] App activate event fired, open windows:', BrowserWindow.getAllWindows().length);
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[main] All windows closed, platform:', process.platform);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  console.log('[main] App will-quit event fired');
});

process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});
