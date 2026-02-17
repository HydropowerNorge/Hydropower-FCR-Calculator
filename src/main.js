const { app, BrowserWindow, Menu, autoUpdater, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');
const dotenv = require('dotenv');
const { ConvexHttpClient } = require('convex/browser');

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
      dotenv.config({ path: envLocalPath, quiet: true });
    }

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, quiet: true });
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
let autoUpdateSourceReference = null;
let autoUpdateConfigurationIssue = null;
let lastAutoUpdateErrorMessage = null;

function isAutoUpdateSupportedPlatform() {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function getActiveWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function showMessageBoxWithWindow(options) {
  const activeWindow = getActiveWindow();
  if (activeWindow) {
    return dialog.showMessageBox(activeWindow, options);
  }

  return dialog.showMessageBox(options);
}

function buildAutoUpdateErrorDetail(rawMessage) {
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

function createCheckForUpdatesMenuItem() {
  return {
    id: UPDATE_MENU_ITEM_ID,
    label: manualUpdateCheckInProgress ? 'Checking for updates...' : 'Check for updates...',
    enabled: !manualUpdateCheckInProgress,
    click: () => {
      void checkForUpdatesFromMenu();
    }
  };
}

function buildApplicationMenuTemplate() {
  const isMac = process.platform === 'darwin';

  return [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
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

function setManualUpdateCheckInProgress(inProgress) {
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

  autoUpdater.on('error', (error) => {
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

    // Poll GitHub Releases through update.electronjs.org.
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

function sanitizeAreaCode(value, fallback = 'NO1') {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SAFE_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

function sanitizeLookupValue(value, maxLength = 120) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
}

function sanitizeDirection(value, fallback = 'down') {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'up' || normalized === 'down') return normalized;
  return fallback;
}

function sanitizeReserveType(value, fallback = 'afrr') {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (/^[a-z0-9_-]{2,20}$/.test(normalized)) return normalized;
  return fallback;
}

function sanitizeResolutionMinutes(value, fallback = 60) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 240) return fallback;
  return parsed;
}

function sanitizeDefaultName(defaultName, fallbackName) {
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

// IPC handlers
ipcMain.handle('file:save', async (event, data, defaultName) => {
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

ipcMain.handle('file:saveXlsx', async (event, exportData, defaultName) => {
  if (!exportData || typeof exportData !== 'object') {
    return null;
  }

  const safeDefaultName = sanitizeDefaultName(defaultName, 'export.xlsx');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return null;

  const workbook = new ExcelJS.Workbook();
  const hourlyData = Array.isArray(exportData.hourlyData) ? exportData.hourlyData : [];
  const monthly = Array.isArray(exportData.monthly) ? exportData.monthly : [];
  const config = exportData.config && typeof exportData.config === 'object' ? exportData.config : {};

  // Hourly Data sheet
  const hourlySheet = workbook.addWorksheet('Timedata');
  hourlySheet.getCell('A1').value = `FCR-N Inntektsanalyse - ${config.year} - ${config.powerMw} MW Batteri`;
  hourlySheet.getCell('A1').font = { bold: true, size: 14 };

  hourlySheet.getRow(2).values = ['Tidspunkt', 'FCR-N Pris (EUR/MW)', 'Tilgjengelig', 'Inntekt (EUR)', 'SOC Start (%)', 'SOC Slutt (%)'];
  hourlySheet.getRow(2).font = { bold: true };

  hourlyData.forEach((row, i) => {
    hourlySheet.getRow(i + 3).values = [
      new Date(row.timestamp),
      row.price,
      row.available ? 'Ja' : 'Nei',
      row.revenue,
      row.socStart !== null ? row.socStart * 100 : null,
      row.socEnd !== null ? row.socEnd * 100 : null
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

  monthly.forEach((row, i) => {
    monthlySheet.getRow(i + 3).values = [row.month, row.revenue, row.hours, row.avgPrice];
  });

  const totalRow = monthly.length + 3;
  monthlySheet.getCell(`A${totalRow}`).value = 'TOTAL';
  monthlySheet.getCell(`A${totalRow}`).font = { bold: true };
  monthlySheet.getCell(`B${totalRow}`).value = { formula: `SUM(B3:B${totalRow - 1})` };
  monthlySheet.getCell(`C${totalRow}`).value = { formula: `SUM(C3:C${totalRow - 1})` };
  monthlySheet.getCell(`D${totalRow}`).value = { formula: `AVERAGE(D3:D${totalRow - 1})` };

  monthlySheet.getColumn(2).numFmt = '#,##0.00';
  monthlySheet.getColumn(4).numFmt = '#,##0.00';

  // Configuration sheet
  const configSheet = workbook.addWorksheet('Konfigurasjon');
  configSheet.getCell('A1').value = 'Batterikonfigurasjon';
  configSheet.getCell('A1').font = { bold: true, size: 14 };

  const configRows = [
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
    configSheet.getRow(i + 3).values = row;
  });

  configSheet.getColumn(1).width = 25;
  configSheet.getColumn(2).width = 15;

  await workbook.xlsx.writeFile(filePath);
  return filePath;
});

ipcMain.handle('file:savePdf', async (event, pdfData, defaultName) => {
  if (!pdfData || typeof pdfData !== 'object') {
    return null;
  }

  const safeDefaultName = sanitizeDefaultName(defaultName, 'report.pdf');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safeDefaultName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;

  const html = buildPdfHtml(pdfData);
  let pdfWindow = null;

  try {
    // Create hidden BrowserWindow to render HTML
    pdfWindow = new BrowserWindow({
      width: 1123,  // A4 landscape at 96dpi
      height: 794,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    // Wait for images to load before rendering to PDF.
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

function buildArbitragePage2(data, monthly, totalRevenue, totalHours, avgPrice, monthlyRows, now) {
  const f = data.financials || {};
  const config = data.config;

  const arbMonthlyRows = monthly.map(m => `
    <tr>
      <td>${m.month}</td>
      <td style="text-align:right">${euroFmt(m.revenue)}</td>
      <td style="text-align:right">${euroFmt(m.chargeCost || 0)}</td>
      <td style="text-align:right">${euroFmt(m.dischargeRevenue || 0)}</td>
      <td style="text-align:right">${m.hours}</td>
      <td style="text-align:right">${euroFmt(m.avgPrice)}</td>
    </tr>
  `).join('');

  const totalCharge = monthly.reduce((s, m) => s + (m.chargeCost || 0), 0);
  const totalDischarge = monthly.reduce((s, m) => s + (m.dischargeRevenue || 0), 0);
  const pctPositive = f.totalDays > 0 ? ((f.positiveDays / f.totalDays) * 100).toFixed(0) : 0;

  return `
  <div class="table-section">
    <div class="page2-header">
      <h2>Finansiell oppsummering</h2>
      <div class="meta">Prisområde: NO1 &middot; Periode: ${config.year} &middot; ${now}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-value accent">${euroFmt(f.expectedMonthly)}</span>
        <span class="kpi-label">Forventet månedsinntekt</span>
        <span class="kpi-sub">Snitt siste hele måneder</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-value">${euroFmt(f.expectedYearly)}</span>
        <span class="kpi-label">Forventet årsinntekt</span>
        <span class="kpi-sub">${euroFmt(f.expectedYearlyPerMw)}/MW &middot; ${config.powerMw} MW</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-value green">${pctPositive}%</span>
        <span class="kpi-label">Lønnsomme dager</span>
        <span class="kpi-sub">${f.positiveDays} av ${f.totalDays} dager med positiv inntekt</span>
      </div>
    </div>

    <div class="two-col">
      <div class="summary-box">
        <h3>Nøkkeltall</h3>
        <div class="summary-row">
          <span class="sr-label">Total nettoinntekt</span>
          <span class="sr-value">${euroFmt(f.totalRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Total ladekostnad</span>
          <span class="sr-value">${euroFmt(f.totalChargeCost)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Total utladeinntekt</span>
          <span class="sr-value">${euroFmt(f.totalDischargeRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Inntekt per MW (periode)</span>
          <span class="sr-value">${euroFmt(f.revenuePerMw)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Sykluser per MW per dag</span>
          <span class="sr-value">${f.duration.toFixed(1)}h</span>
        </div>
      </div>
      <div class="summary-box">
        <h3>Daglig inntektsfordeling</h3>
        <div class="summary-row">
          <span class="sr-label">Gjennomsnitt per dag</span>
          <span class="sr-value">${euroFmt(f.avgDailyRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Median per dag</span>
          <span class="sr-value">${euroFmt(f.medianDailyRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Beste dag</span>
          <span class="sr-value">${euroFmt(f.maxDailyRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Svakeste dag</span>
          <span class="sr-value">${euroFmt(f.minDailyRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="sr-label">Beste måned</span>
          <span class="sr-value">${f.bestMonth} (${euroFmt(f.bestMonthRevenue)})</span>
        </div>
      </div>
    </div>

    <h2 style="font-size:13px; margin-bottom:8px;">Månedlig oppsummering</h2>
    <table>
      <thead>
        <tr>
          <th>Måned</th>
          <th>Nettoinntekt</th>
          <th>Ladekostnad</th>
          <th>Utladeinntekt</th>
          <th>Dager</th>
          <th>Snitt/dag</th>
        </tr>
      </thead>
      <tbody>
        ${arbMonthlyRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align:right">${euroFmt(totalRevenue)}</td>
          <td style="text-align:right">${euroFmt(totalCharge)}</td>
          <td style="text-align:right">${euroFmt(totalDischarge)}</td>
          <td style="text-align:right">${totalHours}</td>
          <td style="text-align:right">${euroFmt(avgPrice)}</td>
        </tr>
      </tbody>
    </table>

    <div class="disclaimer">
      Tallene er basert på faktiske driftsdata fra vår batteriinstallasjon i prisområde NO1 over de siste månedene.
      Inntekten reflekterer reell handel mot spotmarkedet, inkludert dager uten drift grunnet testing og klargjøring i oppstartsperioden.
      Virkningsgrad (${config.efficiency}%) er medregnet.
    </div>
  </div>

  <div class="footer">
    Konfidensielt &middot; Basert på driftsdata ${config.year} &middot; Prisområde NO1
  </div>`;
}

function buildPdfHtml(data) {
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

  const chartSection = (title, base64) => {
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
  .page2-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 3px solid #e94560;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .page2-header h2 { font-size: 16px; color: #1a1a2e; }
  .page2-header .meta { font-size: 10px; color: #666; }
  .kpi-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .kpi-card {
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .kpi-card .kpi-value {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
    display: block;
    margin-bottom: 2px;
  }
  .kpi-card .kpi-value.accent { color: #e94560; }
  .kpi-card .kpi-value.green { color: #16a34a; }
  .kpi-card .kpi-label {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .kpi-card .kpi-sub {
    font-size: 9px;
    color: #999;
    margin-top: 4px;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 18px;
  }
  .summary-box {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
  }
  .summary-box h3 {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 12px;
    background: #f5f5f5;
    color: #333;
    border-bottom: 1px solid #e0e0e0;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    font-size: 10px;
    border-bottom: 1px solid #f0f0f0;
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-row .sr-label { color: #666; }
  .summary-row .sr-value { font-weight: 600; color: #1a1a2e; }
  .disclaimer {
    margin-top: 14px;
    padding: 10px 14px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    font-size: 9px;
    color: #92400e;
    line-height: 1.5;
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
    <h1>${config.reportType === 'arbitrage' ? 'Arbitrasje Inntektsrapport' : 'FCR-N Inntektsrapport'}</h1>
    <div class="meta">
      Generert: ${now}<br>
      ${config.reportType === 'arbitrage' ? 'Driftsperiode' : 'Prisdata'}: ${config.year}
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
      <span class="label">${config.reportType === 'arbitrage' ? 'Antall dager' : 'Tilgjengelige timer'}</span>
    </div>
    <div class="metric-box">
      <span class="value">${metrics.availability}</span>
      <span class="label">${config.reportType === 'arbitrage' ? 'Sykluser' : 'Tilgjengelighet'}</span>
    </div>
    <div class="metric-box">
      <span class="value">${metrics.avgPrice}</span>
      <span class="label">${config.reportType === 'arbitrage' ? 'Snitt per dag' : 'Snittpris'}</span>
    </div>
  </div>

  <div class="charts-grid">
    ${config.reportType === 'arbitrage'
      ? `${chartSection('Månedlig inntekt', chartImages.monthly)}
         ${chartSection('Daglig profitt', chartImages.price)}
         ${chartSection('Typisk dagsprofil', chartImages.soc)}
         ${chartSection('Kumulativ inntekt', chartImages.freq)}`
      : `${chartSection('Månedlig inntekt', chartImages.monthly)}
         ${chartSection('Prisfordeling', chartImages.price)}
         ${chartSection('SOC-utvikling', chartImages.soc)}
         ${chartSection('Frekvensfordeling', chartImages.freq)}`
    }
  </div>

  ${config.reportType === 'arbitrage' ? buildArbitragePage2(data, monthly, totalRevenue, totalHours, avgPrice, monthlyRows, now) : `
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
  `}
</div>
</body>
</html>`;
}

function euroFmt(value) {
  return '€' + Math.round(value).toLocaleString('nb-NO');
}

let convexClient = null;
let convexUrl = null;

function getConvexClient() {
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

async function runConvexQuery(functionName, args = {}) {
  const client = getConvexClient();
  return client.query(functionName, args);
}

async function runPaginatedConvexQuery(functionName, args = {}, pageSize = 1000) {
  const allRows = [];
  let cursor = null;

  while (true) {
    const pageResult = await runConvexQuery(functionName, {
      ...args,
      paginationOpts: {
        numItems: pageSize,
        cursor,
      },
    });

    allRows.push(...pageResult.page);

    if (pageResult.isDone) {
      break;
    }

    cursor = pageResult.continueCursor;
  }

  return allRows;
}

ipcMain.handle('data:loadPriceData', async (event, year, area = 'NO1') => {
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

ipcMain.handle('data:getAvailableYears', async (event, area = 'NO1') => {
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

ipcMain.handle('data:loadSpotData', async (event, biddingZone = 'NO1') => {
  const safeBiddingZone = sanitizeAreaCode(biddingZone, 'NO1');
  try {
    return await runPaginatedConvexQuery('spot:getSpotDataPage', {
      biddingZone: safeBiddingZone,
    });
  } catch (err) {
    console.error('Failed to load spot data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:loadAfrrData', async (event, year, filters = {}) => {
  const safeYear = sanitizeYear(year);
  if (safeYear === null) {
    return [];
  }

  const safeBiddingZone = sanitizeAreaCode(filters?.biddingZone, 'NO1');
  const safeDirection = sanitizeDirection(filters?.direction, 'down');
  const safeReserveType = sanitizeReserveType(filters?.reserveType, 'afrr');
  const safeResolutionMin = sanitizeResolutionMinutes(filters?.resolutionMin, 60);

  try {
    return await runPaginatedConvexQuery('afrr:getAfrrDataPage', {
      year: safeYear,
      biddingZone: safeBiddingZone,
      direction: safeDirection,
      reserveType: safeReserveType,
      resolutionMin: safeResolutionMin,
    });
  } catch (err) {
    console.error('Failed to load aFRR data from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:getAfrrAvailableYears', async (event, filters = {}) => {
  const safeBiddingZone = sanitizeAreaCode(filters?.biddingZone, 'NO1');
  const safeDirection = sanitizeDirection(filters?.direction, 'down');
  const safeReserveType = sanitizeReserveType(filters?.reserveType, 'afrr');
  const safeResolutionMin = sanitizeResolutionMinutes(filters?.resolutionMin, 60);

  try {
    return await runConvexQuery('afrr:getAvailableYears', {
      biddingZone: safeBiddingZone,
      direction: safeDirection,
      reserveType: safeReserveType,
      resolutionMin: safeResolutionMin,
    });
  } catch (err) {
    console.error('Failed to fetch aFRR years from Convex:', err);
    return [];
  }
});

ipcMain.handle('data:loadSolarData', async (event, year, resolutionMinutes = 60) => {
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

ipcMain.handle('data:getSolarAvailableYears', async (event, resolutionMinutes = 60) => {
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

ipcMain.handle('data:loadNodeTenders', async (event, filters = {}) => {
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

ipcMain.handle('data:getNodeTenderFilters', async (event, dataset = 'nodes_2026_pilot') => {
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
