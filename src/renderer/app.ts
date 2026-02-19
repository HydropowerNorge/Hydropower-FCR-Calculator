import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import * as Calculator from './calculator';
import type { FrequencySummary, HourlyRevenueRow, RevenueResult } from './calculator';
import * as FrequencySimulator from './frequency';
import { calculateAfrrYearlyRevenue } from './afrr';
import { calculateNodeHourlyIncome, calculateNodeYearlyIncome } from './nodes';
import { createAfrrUI } from './afrr-ui';
import { createNodesUI } from './nodes-ui';
import { showStatusMessage } from './status-message';
import { buildExcelFileBytes } from './excel-export';
import { withExportTimestamp } from './export-filename';
import { roundValuesToTarget } from './rounding';
import {
  EXPORT_RESOLUTIONS,
  EXPORT_RESOLUTION_FILENAME_SUFFIX,
  EXPORT_RESOLUTION_LABELS_NB,
  parseExportResolution,
} from './export-resolution';
import type { ExportResolution } from './export-resolution';
import { ensureRuntimeApi, isElectronRuntime } from './runtime-api';
import { logInfo, logError } from './logger';

ensureRuntimeApi();

interface MonthlyAggregate {
  month: string;
  revenue: number;
  hours: number;
  avgPrice: number;
}

interface FcrMonthlyCsvAggregate {
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  availableHours: number;
  unavailableHours: number;
  avgPriceEurMw: number;
  revenueEur: number;
}

interface FcrResolutionAggregate {
  periodKey: string;
  periodLabel: string;
  totalHours: number;
  availableHours: number;
  avgPriceEurMw: number;
  revenueEur: number;
}

interface WorkerPayload {
  result: RevenueResult;
  summary: FrequencySummary;
  totalSamples: number;
}

interface PriceDataRow {
  timestamp: Date;
  price: number;
  hourNumber: number;
  volume: number;
}

type CombinedMarket = 'aFRR' | 'FCR-N' | 'Nodes';

interface CombinedPriorityRow {
  block: string;
  market: CombinedMarket;
  valueEurMwHour: number;
  reason: string;
  consequence: string;
}

interface YearlyCombinedMonthlyRow {
  month: string;
  fcrEur: number;
  afrrEur: number;
  nodesNok: number;
  nodesEur: number;
  totalEur: number;
}

interface YearlyCombinedResult {
  totalEur: number;
  fcrEur: number;
  afrrEur: number;
  nodesNok: number;
  nodesEur: number;
  fcrYear: number;
  afrrYear: number;
  nodesTenderName: string;
  monthly: YearlyCombinedMonthlyRow[];
  hourly: YearlyCombinedHourlyRow[];
}

interface YearlyCombinedHourlyRow {
  timestamp: number;
  fcrEur: number;
  afrrEur: number;
  nodesNok: number;
  nodesEur: number;
  totalEur: number;
}

interface YearlyCombinedEurHourlyInputRow {
  timestamp: number;
  valueEur: number;
}

interface YearlyCombinedNokHourlyInputRow {
  timestamp: number;
  valueNok: number;
}

let priceData: PriceDataRow[] = [];
let currentResult: (RevenueResult & { freqSummary?: FrequencySummary }) | null = null;
const afrrUI = createAfrrUI({ onStateChange: () => updateSidebarCsvExportState() });
const nodesUI = createNodesUI({ onStateChange: () => updateSidebarCsvExportState() });
const charts: {
  monthly: Chart | null;
  price: Chart | null;
  soc: Chart | null;
  freq: Chart | null;
  combinedPriority: Chart | null;
  combinedRatio: Chart | null;
  yearlyCombinedMonthly: Chart | null;
} = {
  monthly: null,
  price: null,
  soc: null,
  freq: null,
  combinedPriority: null,
  combinedRatio: null,
  yearlyCombinedMonthly: null
};

const elements = {
  appVersion: document.getElementById('appVersion') as HTMLElement | null,
  sidebarPanel: document.getElementById('sidebarPanel') as HTMLElement | null,
  mobileSidebarToggle: document.getElementById('mobileSidebarToggle') as HTMLButtonElement | null,
  mobileSidebarClose: document.getElementById('mobileSidebarClose') as HTMLButtonElement | null,
  mobileSidebarBackdrop: document.getElementById('mobileSidebarBackdrop') as HTMLButtonElement | null,
  powerMw: document.getElementById('powerMw') as HTMLInputElement,
  capacityMwh: document.getElementById('capacityMwh') as HTMLInputElement,
  efficiency: document.getElementById('efficiency') as HTMLInputElement,
  efficiencyValue: document.getElementById('efficiencyValue')!,
  socMin: document.getElementById('socMin') as HTMLInputElement,
  socMinValue: document.getElementById('socMinValue')!,
  socMax: document.getElementById('socMax') as HTMLInputElement,
  socMaxValue: document.getElementById('socMaxValue')!,
  batteryConfigSection: document.getElementById('batteryConfigSection') as HTMLElement | null,
  solarConfigSection: document.getElementById('solarConfigSection') as HTMLElement | null,
  infrastructureConfigSection: document.getElementById('infrastructureConfigSection') as HTMLElement | null,
  year: document.getElementById('year') as HTMLSelectElement,
  yearLoadingIndicator: document.getElementById('yearLoadingIndicator') as HTMLElement | null,
  simHours: document.getElementById('simHours') as HTMLInputElement,
  seed: document.getElementById('seed') as HTMLInputElement,
  yearlyCombinedYear: document.getElementById('yearlyCombinedYear') as HTMLSelectElement,
  yearlyCombinedYearLoadingIndicator: document.getElementById('yearlyCombinedYearLoadingIndicator') as HTMLElement | null,

  loadingState: document.getElementById('loadingState')!,
  resultsContainer: document.getElementById('resultsContainer')!,
  statusMessage: document.getElementById('statusMessage')!,
  totalRevenue: document.getElementById('totalRevenue')!,
  availableHours: document.getElementById('availableHours')!,
  availability: document.getElementById('availability')!,
  avgPrice: document.getElementById('avgPrice')!,
  annualizedNote: document.getElementById('annualizedNote') as HTMLElement,
  heroTitle: document.getElementById('heroTitle'),
  heroDescription: document.getElementById('heroDescription'),
  socSection: document.getElementById('socSection') as HTMLElement,
  freqSection: document.getElementById('freqSection') as HTMLElement,
  summaryTable: document.getElementById('summaryTable')!.querySelector('tbody') as HTMLTableSectionElement,
  combinedReserveTotal: document.getElementById('combinedReserveTotal')!,
  combinedAfrrRevenue: document.getElementById('combinedAfrrRevenue')!,
  combinedFcrRevenue: document.getElementById('combinedFcrRevenue')!,
  combinedNodesRevenue: document.getElementById('combinedNodesRevenue')!,
  combinedDifferenceText: document.getElementById('combinedDifferenceText')!,
  combinedPriorityTable: document.getElementById('combinedPriorityTable')!.querySelector('tbody') as HTMLTableSectionElement,
  combinedAfrrShare: document.getElementById('combinedAfrrShare') as HTMLInputElement,
  combinedAfrrShareValue: document.getElementById('combinedAfrrShareValue')!,
  combinedRatioTotal: document.getElementById('combinedRatioTotal')!,
  combinedRatioAfrr: document.getElementById('combinedRatioAfrr')!,
  combinedRatioFcr: document.getElementById('combinedRatioFcr')!,
  combinedRatioNodes: document.getElementById('combinedRatioNodes')!,
  yearlyCombinedStatusMessage: document.getElementById('yearlyCombinedStatusMessage')!,
  yearlyCombinedMeta: document.getElementById('yearlyCombinedMeta')!,
  yearlyCombinedTotalEur: document.getElementById('yearlyCombinedTotalEur')!,
  yearlyCombinedFcrEur: document.getElementById('yearlyCombinedFcrEur')!,
  yearlyCombinedAfrrEur: document.getElementById('yearlyCombinedAfrrEur')!,
  yearlyCombinedNodesEur: document.getElementById('yearlyCombinedNodesEur')!,
  yearlyCombinedNodesCard: document.getElementById('yearlyCombinedNodesCard') as HTMLElement | null,
  yearlyCombinedSummaryTable: document.getElementById('yearlyCombinedSummaryTable')!.querySelector('tbody') as HTMLTableSectionElement,
  sidebarExportResolutionSection: document.getElementById('sidebarExportResolutionSection') as HTMLElement | null,
  sidebarExportResolutionMonth: document.getElementById('sidebarExportResolutionMonth') as HTMLInputElement | null,
  sidebarExportResolutionDay: document.getElementById('sidebarExportResolutionDay') as HTMLInputElement | null,
  sidebarExportResolutionHour: document.getElementById('sidebarExportResolutionHour') as HTMLInputElement | null,
  sidebarExportCsvBtn: document.getElementById('sidebarExportCsvBtn') as HTMLButtonElement | null,
  sidebarExportExcelBtn: document.getElementById('sidebarExportExcelBtn') as HTMLButtonElement | null,
};

Chart.defaults.color = '#aaa';
Chart.defaults.borderColor = '#2a2a4a';

let activeSimulationWorker: Worker | null = null;
let isCalculating = false;
let isYearlyCombinedCalculating = false;
let currentYearlyCombinedResult: YearlyCombinedResult | null = null;

const combinedAnnualRevenue = {
  afrrEur: 200_737,
  fcrCombinedEur: 52_000,
  nodesEur: 15_145,
  fcrStandaloneEur: 165_000,
};

const COMBINED_MARKET_COLORS: Record<CombinedMarket, string> = {
  aFRR: '#4fcb73',
  'FCR-N': '#f3c640',
  Nodes: '#60a5fa'
};

const MONTH_LABELS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES_NB_FULL = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
const NODES_NOK_PER_EUR = 11.5;
const HIDDEN_YEARS = new Set<number>([2021, 2026]);
const CONSERVATIVE_TOTAL_EUR = combinedAnnualRevenue.afrrEur
  + combinedAnnualRevenue.fcrCombinedEur
  + combinedAnnualRevenue.nodesEur;

const combinedPriorityRows: CombinedPriorityRow[] = [
  {
    block: '00:00-06:00',
    market: 'FCR-N',
    valueEurMwHour: 22,
    reason: 'Stabil nattdrift og konservativ FCR-N-prising gir best forventet verdi.',
    consequence: 'Kapasitet bindes i FCR-N i denne blokken.'
  },
  {
    block: '06:00-12:00',
    market: 'aFRR',
    valueEurMwHour: 45,
    reason: 'Høyere kapasitetsbetaling gjør aFRR mer lønnsomt enn FCR-N.',
    consequence: 'Samme MW kan ikke samtidig brukes i FCR-N.'
  },
  {
    block: '12:00-18:00',
    market: 'aFRR',
    valueEurMwHour: 38,
    reason: 'aFRR holder høyest verdi i denne perioden.',
    consequence: 'Kapasitet prioriteres til aFRR.'
  },
  {
    block: '18:00-22:00',
    market: 'Nodes',
    valueEurMwHour: 52,
    reason: 'Lokal flaskehals kan gi høy fleksibilitetsverdi i enkeltperioder.',
    consequence: 'Når Nodes er best, må FCR-N/aFRR vike for samme kapasitet.'
  },
  {
    block: '22:00-24:00',
    market: 'FCR-N',
    valueEurMwHour: 24,
    reason: 'Tilbake til FCR-N når relative priser i øvrige markeder faller.',
    consequence: 'Ny allokering per timeblokk, fortsatt uten dobbelbooking.'
  }
];

function getHoursInCalendarYear(year: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  return isLeapYear ? 8784 : 8760;
}

function trimPriceDataToYearHours(rows: PriceDataRow[], year: number): PriceDataRow[] {
  const expectedHours = getHoursInCalendarYear(year);
  if (!Array.isArray(rows) || rows.length <= expectedHours) {
    return rows;
  }
  logInfo('app', 'price_rows_trimmed', { year, rowsBefore: rows.length, expectedHours });
  return rows.slice(0, expectedHours);
}

function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 980px)').matches;
}

function setMobileSidebarOpen(isOpen: boolean): void {
  const shouldOpen = isOpen && isMobileViewport();
  document.body.classList.toggle('mobile-sidebar-open', shouldOpen);
  if (elements.mobileSidebarToggle) {
    elements.mobileSidebarToggle.setAttribute('aria-expanded', String(shouldOpen));
  }
}

function setupMobileSidebar(): void {
  if (!elements.mobileSidebarToggle) return;

  const closeSidebar = (): void => setMobileSidebarOpen(false);

  elements.mobileSidebarToggle.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('mobile-sidebar-open');
    setMobileSidebarOpen(!isOpen);
  });

  elements.mobileSidebarClose?.addEventListener('click', closeSidebar);
  elements.mobileSidebarBackdrop?.addEventListener('click', closeSidebar);

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeSidebar();
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobileViewport()) {
      closeSidebar();
    }
  });

  closeSidebar();
}

async function loadAppVersionLabel(): Promise<void> {
  if (!elements.appVersion) return;
  try {
    const version = await window.electronAPI.getAppVersion();
    elements.appVersion.textContent = `Versjon ${version}`;
  } catch {
    elements.appVersion.textContent = 'Versjon ukjent';
  }
}

function formatEuro(value: number): string {
  return `€${value.toLocaleString('nb-NO', { maximumFractionDigits: 0 })}`;
}

function toTenderTimestampMs(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 1_000_000_000_000 ? Math.round(numeric * 1000) : Math.round(numeric);
}

function parseYearMonthToIndex(value: string): number | null {
  const match = String(value).match(/^\d{4}-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month - 1 : null;
}

function formatYearMonthLabelNb(value: string): string {
  const match = String(value).match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex >= MONTH_NAMES_NB_FULL.length) {
    return value;
  }
  return `${MONTH_NAMES_NB_FULL[monthIndex]} ${year}`;
}

function formatShortMonthLabelNb(value: string): string {
  const index = MONTH_LABELS_NB.indexOf(value);
  if (index < 0 || index >= MONTH_NAMES_NB_FULL.length) return value;
  return MONTH_NAMES_NB_FULL[index];
}

function formatDayLabelNb(value: string): string {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatHourLabelNb(value: string): string {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):00$/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]} ${match[4]}:00`;
}

function appendResolutionSuffix(filename: string, resolution: ExportResolution): string {
  if (resolution === 'month') return filename;
  const suffix = EXPORT_RESOLUTION_FILENAME_SUFFIX[resolution];
  return filename.replace(/(\.[^.]+)$/, `_${suffix}$1`);
}

function setYearlyCombinedVisualStates(state: string, message: string): void {
  setChartState('yearlyCombinedMonthlyChart', state, message);
  setTableState('yearlyCombinedSummaryTable', state, message);
}

function showYearlyCombinedStatus(
  message: string,
  type = 'info',
  options: { autoHide?: boolean } = { autoHide: false }
): void {
  showStatusMessage(elements.yearlyCombinedStatusMessage, message, type, options);
}

function isYearlyCombinedNodesIncluded(): boolean {
  return false;
}

function applyYearlyCombinedNodesVisualState(includeNodes: boolean): void {
  const panel = document.getElementById('yearlyCombinedContent');
  if (!panel) return;
  panel.classList.toggle('nodes-optional-off', !includeNodes);
}

function getActiveMainTab(): string {
  return document.querySelector<HTMLButtonElement>('.tab-btn.active')?.dataset.tab || '';
}

type ExportableMainTab = 'fcr' | 'afrr' | 'nodes' | 'yearlyCombined';

interface SidebarExportConfig {
  csvLabel: string;
  excelLabel: string;
  supportedResolutions: ExportResolution[];
  canExport: () => boolean;
  exportCsv: (resolution: ExportResolution) => Promise<void>;
  exportExcel: (resolution: ExportResolution) => Promise<void>;
}

const SIDEBAR_EXPORT_CONFIGS: Record<ExportableMainTab, SidebarExportConfig> = {
  fcr: {
    csvLabel: 'Eksporter CSV (FCR-N)',
    excelLabel: 'Eksporter Excel (FCR-N)',
    supportedResolutions: EXPORT_RESOLUTIONS,
    canExport: (): boolean => currentResult !== null,
    exportCsv,
    exportExcel,
  },
  afrr: {
    csvLabel: 'Eksporter CSV (aFRR)',
    excelLabel: 'Eksporter Excel (aFRR)',
    supportedResolutions: EXPORT_RESOLUTIONS,
    canExport: (): boolean => afrrUI.hasResult(),
    exportCsv: (resolution: ExportResolution): Promise<void> => afrrUI.exportCsv(resolution),
    exportExcel: (resolution: ExportResolution): Promise<void> => afrrUI.exportExcel(resolution),
  },
  nodes: {
    csvLabel: 'Eksporter CSV (Nodes)',
    excelLabel: 'Eksporter Excel (Nodes)',
    supportedResolutions: EXPORT_RESOLUTIONS,
    canExport: (): boolean => nodesUI.hasResult(),
    exportCsv: (resolution: ExportResolution): Promise<void> => nodesUI.exportCsv(resolution),
    exportExcel: (resolution: ExportResolution): Promise<void> => nodesUI.exportExcel(resolution),
  },
  yearlyCombined: {
    csvLabel: 'Eksporter CSV (Årskalkyle)',
    excelLabel: 'Eksporter Excel (Årskalkyle)',
    supportedResolutions: ['month'],
    canExport: (): boolean => currentYearlyCombinedResult !== null,
    exportCsv: exportYearlyCombinedCsv,
    exportExcel: exportYearlyCombinedExcel,
  },
};

function getSidebarExportConfig(tab: string): SidebarExportConfig | null {
  if (tab in SIDEBAR_EXPORT_CONFIGS) {
    return SIDEBAR_EXPORT_CONFIGS[tab as ExportableMainTab];
  }
  return null;
}

function setSidebarExportButtonsDisabled(disabled: boolean): void {
  if (elements.sidebarExportCsvBtn) {
    elements.sidebarExportCsvBtn.disabled = disabled;
  }
  if (elements.sidebarExportExcelBtn) {
    elements.sidebarExportExcelBtn.disabled = disabled;
  }
}

function getSidebarResolutionInputs(): Record<ExportResolution, HTMLInputElement | null> {
  return {
    month: elements.sidebarExportResolutionMonth,
    day: elements.sidebarExportResolutionDay,
    hour: elements.sidebarExportResolutionHour,
  };
}

function setSidebarResolutionEnabledState(enabledResolutions: ExportResolution[]): void {
  const inputs = getSidebarResolutionInputs();
  EXPORT_RESOLUTIONS.forEach((resolution) => {
    const input = inputs[resolution];
    if (!input) return;
    input.disabled = !enabledResolutions.includes(resolution);
  });
}

function ensureSidebarResolutionSelection(enabledResolutions: ExportResolution[]): ExportResolution {
  const inputs = getSidebarResolutionInputs();
  const selectedResolution = EXPORT_RESOLUTIONS.find((resolution) => inputs[resolution]?.checked);
  const parsedSelected = parseExportResolution(selectedResolution);

  if (enabledResolutions.includes(parsedSelected)) {
    return parsedSelected;
  }

  const fallback = enabledResolutions[0] ?? 'month';
  const fallbackInput = inputs[fallback];
  if (fallbackInput) {
    fallbackInput.checked = true;
  }
  return fallback;
}

function updateSidebarCsvExportState(): void {
  const csvButton = elements.sidebarExportCsvBtn;
  const excelButton = elements.sidebarExportExcelBtn;
  if (!csvButton && !excelButton) return;

  const activeTab = getActiveMainTab();
  const exportConfig = getSidebarExportConfig(activeTab);
  const anchorButton = csvButton || excelButton;
  const exportSection = anchorButton?.closest('.sidebar-export') as HTMLElement | null;
  if (exportSection) {
    exportSection.style.display = exportConfig ? '' : 'none';
  }
  if (!exportConfig) {
    setSidebarResolutionEnabledState([]);
    if (elements.sidebarExportResolutionSection) {
      elements.sidebarExportResolutionSection.style.display = 'none';
    }
    return;
  }

  if (elements.sidebarExportResolutionSection) {
    elements.sidebarExportResolutionSection.style.display = exportConfig.supportedResolutions.length > 1 ? '' : 'none';
  }
  setSidebarResolutionEnabledState(exportConfig.supportedResolutions);
  ensureSidebarResolutionSelection(exportConfig.supportedResolutions);

  const canExport = exportConfig.canExport();
  if (csvButton) {
    csvButton.textContent = exportConfig.csvLabel;
    csvButton.disabled = !canExport;
  }
  if (excelButton) {
    excelButton.textContent = exportConfig.excelLabel;
    excelButton.disabled = !canExport;
  }
}

async function runSidebarExport(
  button: HTMLButtonElement,
  busyLabel: string,
  fallbackIdleLabel: string,
  action: () => Promise<void>,
): Promise<void> {
  const previousLabel = button.textContent;
  setSidebarExportButtonsDisabled(true);
  button.textContent = busyLabel;
  try {
    await action();
  } catch (error) {
    logError('export', 'export_failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    button.textContent = previousLabel || fallbackIdleLabel;
    updateSidebarCsvExportState();
  }
}

async function exportCsvForActiveTab(): Promise<void> {
  const csvButton = elements.sidebarExportCsvBtn;
  if (!csvButton || csvButton.disabled) return;

  const exportConfig = getSidebarExportConfig(getActiveMainTab());
  if (!exportConfig) return;

  const resolution = ensureSidebarResolutionSelection(exportConfig.supportedResolutions);
  const busyLabel = `Eksporterer CSV (${EXPORT_RESOLUTION_LABELS_NB[resolution].toLowerCase()})...`;
  await runSidebarExport(csvButton, busyLabel, 'Eksporter CSV', () => exportConfig.exportCsv(resolution));
}

async function exportExcelForActiveTab(): Promise<void> {
  const excelButton = elements.sidebarExportExcelBtn;
  if (!excelButton || excelButton.disabled) return;

  const exportConfig = getSidebarExportConfig(getActiveMainTab());
  if (!exportConfig) return;

  const resolution = ensureSidebarResolutionSelection(exportConfig.supportedResolutions);
  const busyLabel = `Eksporterer Excel (${EXPORT_RESOLUTION_LABELS_NB[resolution].toLowerCase()})...`;
  await runSidebarExport(excelButton, busyLabel, 'Eksporter Excel', () => exportConfig.exportExcel(resolution));
}

async function runFcrSimulationInWorker(payload: Record<string, unknown>): Promise<WorkerPayload> {
  if (typeof Worker === 'undefined') {
    throw new Error('Worker API is not available');
  }

  if (activeSimulationWorker) {
    activeSimulationWorker.terminate();
    activeSimulationWorker = null;
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./simulation-worker.ts', import.meta.url),
      { type: 'module' },
    );
    activeSimulationWorker = worker;

    const cleanup = () => {
      if (activeSimulationWorker === worker) {
        activeSimulationWorker = null;
      }
      worker.terminate();
    };

    worker.addEventListener('message', (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'progress') {
        showStatus(message.message, 'info', { autoHide: !isCalculating });
        return;
      }

      if (message.type === 'result') {
        cleanup();
        resolve(message.payload);
        return;
      }

      if (message.type === 'error') {
        cleanup();
        reject(new Error(message.error || 'Simulation worker failed'));
      }
    });

    worker.addEventListener('error', (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'Simulation worker crashed'));
    });

    worker.postMessage({
      type: 'simulate-fcr',
      payload
    });
  });
}

function ensureVisualState(container: HTMLElement): HTMLElement | null {
  if (!container) return null;
  let stateEl = container.querySelector<HTMLElement>('.visual-state');
  if (!stateEl) {
    stateEl = document.createElement('div');
    stateEl.className = 'visual-state';
    container.appendChild(stateEl);
  }
  return stateEl;
}

function setContainerState(container: HTMLElement | null, state: string, message: string): void {
  if (!container) return;
  const nextState = state || 'ready';
  container.dataset.state = nextState;
  const stateEl = ensureVisualState(container);
  if (stateEl) {
    stateEl.textContent = message || '';
  }
}

function setChartState(chartId: string, state: string, message: string): void {
  const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const container = canvas.closest<HTMLElement>('.chart-container');
  if (!container) return;
  setContainerState(container, state, message);
  canvas.style.opacity = state === 'ready' ? '1' : '0.18';
}

function setTableState(tableId: string, state: string, message: string): void {
  const table = document.getElementById(tableId);
  if (!table) return;
  const container = table.closest<HTMLElement>('.table-container');
  if (!container) return;
  setContainerState(container, state, message);
  table.style.opacity = state === 'ready' ? '1' : '0.35';
}

function setFcrVisualStates(state: string, message: string): void {
  setChartState('monthlyChart', state, message);
  setChartState('priceChart', state, message);
  setChartState('socChart', state, message);
  setChartState('freqChart', state, message);
  setTableState('summaryTable', state, message);
}

function setFcrResultContainerVisible(visible: boolean): void {
  elements.loadingState.style.display = visible ? 'none' : 'flex';
  elements.resultsContainer.style.display = visible ? 'block' : 'none';
}

function setBatteryConfigLocked(locked: boolean): void {
  const batteryInputs = [
    elements.powerMw,
    elements.capacityMwh,
    elements.efficiency,
    elements.socMin,
    elements.socMax
  ];

  batteryInputs.forEach((input) => {
    input.disabled = locked;
    input.setAttribute('aria-disabled', String(locked));
  });

  if (elements.batteryConfigSection) {
    elements.batteryConfigSection.classList.toggle('is-locked', locked);
  }
}

function updateConfigSectionsVisibility(tab: string): void {
  const isAfrrTab = tab === 'afrr';
  const isNodesTab = tab === 'nodes';
  const isCombinedTab = tab === 'combined';
  const isYearlyCombinedTab = tab === 'yearlyCombined';

  if (elements.batteryConfigSection) {
    elements.batteryConfigSection.style.display = (isAfrrTab || isNodesTab || isCombinedTab) ? 'none' : '';
  }

  if (elements.solarConfigSection) {
    elements.solarConfigSection.style.display = (isAfrrTab || isYearlyCombinedTab) ? '' : 'none';
  }

  if (elements.infrastructureConfigSection) {
    elements.infrastructureConfigSection.style.display = isNodesTab ? '' : 'none';
  }
}

function setupTabs(): void {
  const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
  const tabContents = Array.from(document.querySelectorAll<HTMLElement>('.tab-content'));
  const tabConfigs = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-config]'));

  function applyHeroCopy(tab: string): void {
    const activeBtn = tabBtns.find(btn => btn.dataset.tab === tab);
    if (!activeBtn) return;

    if (elements.heroTitle && activeBtn.dataset.heroTitle) {
      elements.heroTitle.textContent = activeBtn.dataset.heroTitle;
    }

    if (elements.heroDescription && activeBtn.dataset.heroDescription) {
      elements.heroDescription.textContent = activeBtn.dataset.heroDescription;
    }
  }

  function activateTab(tab: string): void {
    logInfo('app', 'tab_switch', { tab });
    tabBtns.forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    tabContents.forEach(content => {
      const isActive = content.dataset.tabPanel === tab;
      content.classList.toggle('active', isActive);
      content.setAttribute('aria-hidden', String(!isActive));
    });

    tabConfigs.forEach(config => {
      config.style.display = config.dataset.tabConfig === tab ? '' : 'none';
    });

    updateConfigSectionsVisibility(tab);
    setBatteryConfigLocked(tab === 'fcr' || tab === 'yearlyCombined');
    applyHeroCopy(tab);
    updateSidebarCsvExportState();
    if (isMobileViewport()) {
      setMobileSidebarOpen(false);
    }
  }

  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab!);
    });

    btn.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + tabBtns.length) % tabBtns.length;
      const nextBtn = tabBtns[nextIndex];
      if (!nextBtn) return;
      nextBtn.focus();
      activateTab(nextBtn.dataset.tab!);
    });
  });

  const initialTab = tabBtns.find(btn => btn.classList.contains('active'))?.dataset.tab
    || tabBtns[0]?.dataset.tab;
  if (initialTab) {
    activateTab(initialTab);
  }
}

function populateYearSelect(selectEl: HTMLSelectElement, years: number[]): void {
  selectEl.innerHTML = '';
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    selectEl.appendChild(option);
  });
}

function setYearSelectorLoading(
  selectEl: HTMLSelectElement,
  indicatorEl: HTMLElement | null,
  isLoading: boolean,
): void {
  selectEl.disabled = isLoading;
  if (indicatorEl) {
    indicatorEl.hidden = !isLoading;
  }
}

async function init(): Promise<void> {
  logInfo('app', 'init_start');
  await loadAppVersionLabel();
  setupTabs();
  setupMobileSidebar();

  await afrrUI.init();

  setFcrVisualStates('loading', 'Laster visualiseringer...');
  setupSliders();

  let defaultYear: number | null = null;
  setYearSelectorLoading(elements.year, elements.yearLoadingIndicator, true);
  setYearSelectorLoading(
    elements.yearlyCombinedYear,
    elements.yearlyCombinedYearLoadingIndicator,
    true,
  );
  try {
    const years = (await window.electronAPI.getAvailableYears('NO1'))
      .map(y => Number(y))
      .filter(y => Number.isFinite(y) && !HIDDEN_YEARS.has(y))
      .sort((a, b) => a - b);

    populateYearSelect(elements.year, years);
    populateYearSelect(elements.yearlyCombinedYear, years);
    applyYearlyCombinedNodesVisualState(false);

    if (years.length > 0) {
      const preferredYear = 2025;
      defaultYear = years.includes(preferredYear)
        ? preferredYear
        : years[years.length - 1];
      elements.year.value = String(defaultYear);
      elements.yearlyCombinedYear.value = String(defaultYear);
      await loadPriceData(defaultYear);
      setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
    } else {
      setFcrResultContainerVisible(true);
      showStatus('Ingen prisdata funnet i Convex for NO1.', 'warning');
      setFcrVisualStates('empty', 'Ingen data tilgjengelig for visualisering.');
    }
  } catch (error) {
    logError('app', 'available_years_failed', { error: error instanceof Error ? error.message : String(error) });
    setFcrResultContainerVisible(true);
    showStatus('Kunne ikke laste årsliste fra datakilden.', 'warning');
    setFcrVisualStates('empty', 'Ingen data tilgjengelig for visualisering.');
  } finally {
    setYearSelectorLoading(elements.year, elements.yearLoadingIndicator, false);
    setYearSelectorLoading(
      elements.yearlyCombinedYear,
      elements.yearlyCombinedYearLoadingIndicator,
      false,
    );
  }

  await nodesUI.init();
  initCombinedView();
  setYearlyCombinedVisualStates('empty', 'Trykk "Beregn årlig total".');
  if (defaultYear !== null) {
    showYearlyCombinedStatus(`Klar for ${defaultYear}. Trykk "Beregn årlig total".`, 'info');
  } else {
    showYearlyCombinedStatus('Ingen år tilgjengelig for årskalkyle.', 'warning');
  }

  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn')!.addEventListener('click', calculate);
  const exportPdfBtn = document.getElementById('exportPdfBtn') as HTMLButtonElement | null;
  if (exportPdfBtn) {
    if (isElectronRuntime()) {
      exportPdfBtn.addEventListener('click', exportPdf);
    } else {
      exportPdfBtn.style.display = 'none';
    }
  }
  document.getElementById('calculateYearlyCombinedBtn')?.addEventListener('click', calculateYearlyCombined);
  elements.sidebarExportCsvBtn?.addEventListener('click', exportCsvForActiveTab);
  elements.sidebarExportExcelBtn?.addEventListener('click', exportExcelForActiveTab);
  updateSidebarCsvExportState();
}

function setupSliders(): void {
  const sliders = [
    { input: elements.efficiency, display: elements.efficiencyValue },
    { input: elements.socMin, display: elements.socMinValue },
    { input: elements.socMax, display: elements.socMaxValue }
  ];

  sliders.forEach(({ input, display }) => {
    input.addEventListener('input', () => {
      display.textContent = input.value;
    });
  });
}

function initCombinedView(): void {
  setupCombinedInnerTabs();
  renderCombinedMetrics();
  renderCombinedPriorityTable();
  updateCombinedPriorityChart();
  initCombinedRatioSimulator();
}

function setupCombinedInnerTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.combined-inner-tab-btn'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.combined-inner-panel'));
  if (tabButtons.length === 0 || panels.length === 0) return;

  const activate = (tab: string): void => {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.combinedTab === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.combinedPanel === tab;
      panel.classList.toggle('active', isActive);
      panel.setAttribute('aria-hidden', String(!isActive));
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.combinedTab;
      if (!tab) return;
      activate(tab);
    });
  });

  const initialTab = tabButtons.find((button) => button.classList.contains('active'))?.dataset.combinedTab
    || tabButtons[0]?.dataset.combinedTab;
  if (initialTab) {
    activate(initialTab);
  }
}

function renderCombinedMetrics(): void {
  elements.combinedReserveTotal.textContent = 'Høyest verdi vinner';
  elements.combinedAfrrRevenue.textContent = 'Flytt til aFRR';
  elements.combinedFcrRevenue.textContent = 'Flytt til FCR-N';
  elements.combinedNodesRevenue.textContent = 'Flytt til Nodes';
  elements.combinedDifferenceText.textContent = 'Lavere andel i ett marked kan være riktig når totalen øker.';
}

function renderCombinedPriorityTable(): void {
  elements.combinedPriorityTable.innerHTML = combinedPriorityRows.map((row) => `
    <tr>
      <td>${row.block}</td>
      <td>${row.market}</td>
      <td>${row.reason}</td>
      <td>${row.consequence}</td>
    </tr>
  `).join('');
}

function getCombinedReserveTotal(): number {
  return combinedAnnualRevenue.afrrEur + combinedAnnualRevenue.fcrCombinedEur + combinedAnnualRevenue.nodesEur;
}

function initCombinedRatioSimulator(): void {
  const total = getCombinedReserveTotal();
  const defaultAfrrShare = Math.round((combinedAnnualRevenue.afrrEur / total) * 100);
  elements.combinedAfrrShare.value = String(defaultAfrrShare);
  updateCombinedRatioSimulator(defaultAfrrShare);

  elements.combinedAfrrShare.addEventListener('input', () => {
    const nextShare = Number(elements.combinedAfrrShare.value);
    updateCombinedRatioSimulator(nextShare);
  });
}

function updateCombinedRatioSimulator(afrrSharePct: number): void {
  const total = getCombinedReserveTotal();
  const minShare = Number(elements.combinedAfrrShare.min) || 0;
  const maxShare = Number(elements.combinedAfrrShare.max) || 100;
  const safeSharePct = Math.max(minShare, Math.min(maxShare, Math.round(afrrSharePct)));

  const afrrValue = Math.round(total * (safeSharePct / 100));
  const remainingValue = total - afrrValue;
  const baseResidual = combinedAnnualRevenue.fcrCombinedEur + combinedAnnualRevenue.nodesEur;
  const fcrValue = Math.round(remainingValue * (combinedAnnualRevenue.fcrCombinedEur / baseResidual));
  const fcrSharePct = Math.round((fcrValue / total) * 100);
  const nodesSharePct = Math.max(0, 100 - safeSharePct - fcrSharePct);

  elements.combinedAfrrShareValue.textContent = `${safeSharePct}%`;
  elements.combinedRatioTotal.textContent = 'Robust';
  elements.combinedRatioAfrr.textContent = `${safeSharePct}%`;
  elements.combinedRatioFcr.textContent = `${fcrSharePct}%`;
  elements.combinedRatioNodes.textContent = `${nodesSharePct}%`;

  updateCombinedRatioChart(safeSharePct, fcrSharePct, nodesSharePct);
}

function updateCombinedRatioChart(afrrPct: number, fcrPct: number, nodesPct: number): void {
  const chartCanvas = document.getElementById('combinedRatioChart') as HTMLCanvasElement | null;
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext('2d');
  if (!ctx) return;

  if (charts.combinedRatio) {
    charts.combinedRatio.data.datasets[0].data = [afrrPct];
    charts.combinedRatio.data.datasets[1].data = [fcrPct];
    charts.combinedRatio.data.datasets[2].data = [nodesPct];
    charts.combinedRatio.update();
    return;
  }

  charts.combinedRatio = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Fordeling nå'],
      datasets: [
        {
          label: 'aFRR',
          data: [afrrPct],
          backgroundColor: COMBINED_MARKET_COLORS.aFRR,
          borderRadius: 6,
          borderSkipped: false,
          stack: 'distribution'
        },
        {
          label: 'FCR-N',
          data: [fcrPct],
          backgroundColor: COMBINED_MARKET_COLORS['FCR-N'],
          borderRadius: 6,
          borderSkipped: false,
          stack: 'distribution'
        },
        {
          label: 'Nodes',
          data: [nodesPct],
          backgroundColor: COMBINED_MARKET_COLORS.Nodes,
          borderRadius: 6,
          borderSkipped: false,
          stack: 'distribution'
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Andel av kapasitet (%)'
          },
          ticks: {
            callback: (value) => `${Number(value)}%`
          }
        },
        y: {
          stacked: true,
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = Number(context.raw) || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      }
    }
  });
}

function updateCombinedPriorityChart(): void {
  const chartCanvas = document.getElementById('combinedPriorityChart') as HTMLCanvasElement | null;
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext('2d');
  if (!ctx) return;

  if (charts.combinedPriority) {
    charts.combinedPriority.destroy();
  }

  const labels = combinedPriorityRows.map(row => row.block);
  const valueData = combinedPriorityRows.map((row) => row.valueEurMwHour);
  const colorData = combinedPriorityRows.map((row) => COMBINED_MARKET_COLORS[row.market]);

  charts.combinedPriority = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Valgt marked per blokk',
          data: valueData,
          backgroundColor: colorData,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Forventet verdiindeks (høyere er bedre)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Timeblokker'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = items[0];
              if (!first) return '';
              const row = combinedPriorityRows[first.dataIndex];
              if (!row) return first.label;
              return `${row.block} - ${row.market}`;
            },
            label: (context) => `Verdiindeks: ${Number(context.raw)}`,
            afterLabel: (context) => {
              const row = combinedPriorityRows[context.dataIndex];
              if (!row) return '';
              return `Hvorfor: ${row.reason}`;
            },
            footer: (items) => {
              const first = items[0];
              if (!first) return '';
              const row = combinedPriorityRows[first.dataIndex];
              if (!row) return '';
              return `Konsekvens: ${row.consequence}`;
            }
          }
        }
      }
    }
  });
}

interface BatteryConfigValues {
  powerMw: number;
  capacityMwh: number;
  efficiency: number;
  socMin: number;
  socMax: number;
}

function getBatteryConfigValuesFromInputs(): BatteryConfigValues {
  return {
    powerMw: parseFloat(elements.powerMw.value),
    capacityMwh: parseFloat(elements.capacityMwh.value),
    efficiency: parseInt(elements.efficiency.value, 10) / 100,
    socMin: parseInt(elements.socMin.value, 10) / 100,
    socMax: parseInt(elements.socMax.value, 10) / 100,
  };
}

function createBatteryConfigFromInputs(): Calculator.BatteryConfig {
  const values = getBatteryConfigValuesFromInputs();
  return new Calculator.BatteryConfig(
    values.powerMw,
    values.capacityMwh,
    values.efficiency,
    values.socMin,
    values.socMax
  );
}

async function calculateFcrYearlyForCombined(year: number): Promise<{
  totalEur: number;
  monthlyByMonth: number[];
  hourlyRows: YearlyCombinedEurHourlyInputRow[];
}> {
  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
  const localPriceDataRaw = (Array.isArray(rows) ? rows : [])
    .map(row => ({
      timestamp: new Date(row.timestamp),
      hourNumber: Number(row.hourNumber) || 0,
      price: Number(row.priceEurMw) || 0,
      volume: Number(row.volumeMw) || 0
    }))
    .filter(row => !Number.isNaN(row.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const localPriceData = trimPriceDataToYearHours(localPriceDataRaw, year);

  if (localPriceData.length === 0) {
    logError('calc', 'fcr_yearly_no_data', { year });
    throw new Error(`Ingen FCR-prisdata funnet for ${year}`);
  }

  const configValues = getBatteryConfigValuesFromInputs();
  const config = createBatteryConfigFromInputs();

  const profileName = (document.querySelector('input[name="profile"]') as HTMLInputElement).value;
  const hours = parseInt(elements.simHours.value, 10);
  const seed = parseInt(elements.seed.value, 10);

  let workerResult: WorkerPayload;
  try {
    workerResult = await runFcrSimulationInWorker({
      year,
      hours,
      startTimestamp: localPriceData.length > 0 ? new Date(localPriceData[0].timestamp).getTime() : Date.UTC(year, 0, 1),
      seed,
      profileName,
      config: configValues,
      priceData: localPriceData.map((row) => ({
        timestamp: new Date(row.timestamp).getTime(),
        price: row.price
      }))
    });
  } catch {
    logInfo('calc', 'fcr_worker_fallback', { year });
    const startTime = localPriceData.length > 0
      ? new Date(localPriceData[0].timestamp)
      : new Date(Date.UTC(year, 0, 1));
    const localFreqData = FrequencySimulator.simulateFrequency(startTime, hours, 1, seed, profileName);
    const socData = Calculator.simulateSocHourly(localFreqData, config);
    const result = Calculator.calculateRevenue(localPriceData, socData, config);
    workerResult = {
      result,
      summary: localFreqData.summary,
      totalSamples: localFreqData.frequencies.length
    };
  }

  const monthlyByMonth = new Array<number>(12).fill(0);
  const hourlyRows: YearlyCombinedEurHourlyInputRow[] = [];
  for (const row of workerResult.result.hourlyData) {
    const monthIndex = new Date(row.timestamp).getUTCMonth();
    if (monthIndex >= 0 && monthIndex < 12) {
      monthlyByMonth[monthIndex] += row.revenue;
    }
    hourlyRows.push({
      timestamp: new Date(row.timestamp).getTime(),
      valueEur: row.revenue,
    });
  }

  return {
    totalEur: workerResult.result.totalRevenue,
    monthlyByMonth,
    hourlyRows,
  };
}

async function calculateAfrrYearlyForCombined(afrrYear: number): Promise<{
  totalEur: number;
  monthlyByMonth: number[];
  hourlyRows: YearlyCombinedEurHourlyInputRow[];
}> {
  const minBidMw = 1;
  const hasMarketVolume = afrrYear <= 2023;
  const excludeZeroVolume = hasMarketVolume;
  const limitToMarketVolume = hasMarketVolume;

  const solarYears = (await window.electronAPI.getSolarAvailableYears(60))
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);

  const solarYear = solarYears.length > 0 ? solarYears[solarYears.length - 1] : null;
  if (solarYear === null) {
    logError('calc', 'afrr_yearly_no_solar', { afrrYear });
    throw new Error('Ingen solprofil tilgjengelig for aFRR-beregning');
  }

  const [afrrRowsRaw, solarRowsRaw, spotRowsRaw] = await Promise.all([
    window.electronAPI.loadAfrrData(afrrYear, {
      biddingZone: 'NO1',
      direction: 'down',
      reserveType: 'afrr',
      resolutionMin: 60,
    }),
    window.electronAPI.loadSolarData(solarYear, 60),
    window.electronAPI.loadSpotData('NO1', afrrYear),
  ]);

  const afrrRows = Array.isArray(afrrRowsRaw) ? afrrRowsRaw : [];
  const solarRows = Array.isArray(solarRowsRaw) ? solarRowsRaw : [];
  const spotRows = Array.isArray(spotRowsRaw) ? spotRowsRaw : [];
  logInfo('calc', 'afrr_yearly_data_loaded', { afrrYear, afrrRows: afrrRows.length, solarRows: solarRows.length, spotRows: spotRows.length });

  const afrrResult = calculateAfrrYearlyRevenue({
    year: afrrYear,
    afrrRows,
    solarRows,
    spotRows,
    direction: 'down',
    minBidMw,
    excludeZeroVolume,
    limitToMarketVolume,
  });

  const monthlyByMonth = new Array<number>(12).fill(0);
  afrrResult.monthly.forEach((row) => {
    const index = parseYearMonthToIndex(row.month);
    if (index !== null) {
      monthlyByMonth[index] = row.afrrIncomeEur;
    }
  });

  return {
    totalEur: afrrResult.totalAfrrIncomeEur,
    monthlyByMonth,
    hourlyRows: afrrResult.hourlyData.map((row) => ({
      timestamp: row.timestamp,
      valueEur: row.afrrIncomeEur,
    })),
  };
}

async function calculateNodesYearlyForCombined(quantityMw: number): Promise<{
  totalNok: number;
  monthlyByMonth: number[];
  tenderName: string;
  hourlyRows: YearlyCombinedNokHourlyInputRow[];
}> {
  const tenders = await window.electronAPI.loadNodeTenders({});
  const tenderRows = Array.isArray(tenders) ? tenders : [];
  if (tenderRows.length === 0) {
    throw new Error('Ingen Nodes-tendere tilgjengelig');
  }

  const tenderSelect = document.getElementById('nodesTender') as HTMLSelectElement | null;
  const selectedIndex = Number(tenderSelect?.value);
  const tender = tenderRows[selectedIndex] || tenderRows[0];
  if (!tender) {
    throw new Error('Kunne ikke velge en gyldig Nodes-tender');
  }

  const reservationPrice = Number(tender.reservationPriceNokMwH);
  const periodStartTs = toTenderTimestampMs(tender.periodStartTs);
  const periodEndTs = toTenderTimestampMs(tender.periodEndTs);
  if (!Number.isFinite(reservationPrice) || reservationPrice <= 0) {
    throw new Error('Nodes tender mangler gyldig reservasjonspris');
  }
  if (!periodStartTs || !periodEndTs || periodStartTs >= periodEndTs) {
    throw new Error('Nodes tender mangler gyldig periode');
  }

  const activeDays = Array.isArray(tender.activeDays) ? tender.activeDays : [];
  const activeWindows = Array.isArray(tender.activeWindows) ? tender.activeWindows : [];

  const nodesResult = calculateNodeYearlyIncome({
    reservationPriceNokMwH: reservationPrice,
    quantityMw,
    periodStartTs,
    periodEndTs,
    activeDays,
    activeWindows,
  });

  const nodesHourlyRows = calculateNodeHourlyIncome({
    reservationPriceNokMwH: reservationPrice,
    quantityMw,
    periodStartTs,
    periodEndTs,
    activeDays,
    activeWindows,
  }).map((row) => ({
    timestamp: row.timestamp,
    valueNok: row.incomeNok,
  }));

  const monthlyByMonth = new Array<number>(12).fill(0);
  nodesResult.monthly.forEach((row) => {
    const index = MONTH_LABELS_NB.indexOf(row.month);
    if (index >= 0) {
      monthlyByMonth[index] = row.incomeNok;
    }
  });

  return {
    totalNok: nodesResult.totalIncomeNok,
    monthlyByMonth,
    tenderName: tender.name || 'Nodes-tender',
    hourlyRows: nodesHourlyRows,
  };
}

function buildYearlyCombinedHourlyRows(
  fcrRows: YearlyCombinedEurHourlyInputRow[],
  afrrRows: YearlyCombinedEurHourlyInputRow[],
  nodesRows: YearlyCombinedNokHourlyInputRow[],
): YearlyCombinedHourlyRow[] {
  const byTimestamp = new Map<number, YearlyCombinedHourlyRow>();

  const ensureRow = (timestamp: number): YearlyCombinedHourlyRow => {
    const existing = byTimestamp.get(timestamp);
    if (existing) return existing;
    const created: YearlyCombinedHourlyRow = {
      timestamp,
      fcrEur: 0,
      afrrEur: 0,
      nodesNok: 0,
      nodesEur: 0,
      totalEur: 0,
    };
    byTimestamp.set(timestamp, created);
    return created;
  };

  fcrRows.forEach((row) => {
    const item = ensureRow(row.timestamp);
    item.fcrEur += row.valueEur;
  });

  afrrRows.forEach((row) => {
    const item = ensureRow(row.timestamp);
    item.afrrEur += row.valueEur;
  });

  nodesRows.forEach((row) => {
    const item = ensureRow(row.timestamp);
    item.nodesNok += row.valueNok;
  });

  return Array.from(byTimestamp.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((row) => {
      const nodesEur = row.nodesNok / NODES_NOK_PER_EUR;
      return {
        ...row,
        nodesEur,
        totalEur: row.fcrEur + row.afrrEur + nodesEur,
      };
    });
}

function updateYearlyCombinedMonthlyChart(monthly: YearlyCombinedMonthlyRow[], includeNodes: boolean): void {
  if (!Array.isArray(monthly) || monthly.length === 0) {
    if (charts.yearlyCombinedMonthly) {
      charts.yearlyCombinedMonthly.destroy();
      charts.yearlyCombinedMonthly = null;
    }
    setChartState('yearlyCombinedMonthlyChart', 'empty', 'Ingen månedlige data.');
    return;
  }

  const ctx = (document.getElementById('yearlyCombinedMonthlyChart') as HTMLCanvasElement).getContext('2d')!;
  if (charts.yearlyCombinedMonthly) {
    charts.yearlyCombinedMonthly.destroy();
  }

  charts.yearlyCombinedMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthly.map((row) => row.month),
      datasets: [
        {
          label: 'FCR-N (EUR)',
          data: monthly.map((row) => row.fcrEur),
          backgroundColor: '#f3c640',
          borderRadius: 4,
          stack: 'core'
        },
        {
          label: 'aFRR (EUR)',
          data: monthly.map((row) => row.afrrEur),
          backgroundColor: '#4fcb73',
          borderRadius: 4,
          stack: 'core'
        },
        {
          label: includeNodes ? 'Nodes (EUR)' : 'Nodes (opsjonell, EUR)',
          data: monthly.map((row) => row.nodesEur),
          backgroundColor: includeNodes ? '#60a5fa' : 'rgba(96, 165, 250, 0.35)',
          borderColor: includeNodes ? '#60a5fa' : 'rgba(96, 165, 250, 0.65)',
          borderWidth: 1,
          borderRadius: 4,
          stack: includeNodes ? 'core' : 'optional'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: (value) => `€${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 0 })}`
          }
        }
      }
    }
  });
  setChartState('yearlyCombinedMonthlyChart', 'ready', '');
}

function updateYearlyCombinedSummaryTable(monthly: YearlyCombinedMonthlyRow[]): void {
  const includeNodes = isYearlyCombinedNodesIncluded();
  if (!Array.isArray(monthly) || monthly.length === 0) {
    elements.yearlyCombinedSummaryTable.innerHTML = '';
    setTableState('yearlyCombinedSummaryTable', 'empty', 'Ingen månedlige rader.');
    return;
  }

  elements.yearlyCombinedSummaryTable.innerHTML = monthly.map((row) => `
    <tr>
      <td>${row.month}</td>
      <td>${formatEuro(Math.round(row.fcrEur))}</td>
      <td>${formatEuro(Math.round(row.afrrEur))}</td>
      <td class="yearly-nodes-col">${formatEuro(Math.round(row.nodesEur))}</td>
      <td>${formatEuro(Math.round(row.fcrEur + row.afrrEur + (includeNodes ? row.nodesEur : 0)))}</td>
    </tr>
  `).join('');
  setTableState('yearlyCombinedSummaryTable', 'ready', '');
}

function renderYearlyCombinedResult(result: YearlyCombinedResult): void {
  const includeNodes = isYearlyCombinedNodesIncluded();
  applyYearlyCombinedNodesVisualState(includeNodes);
  const effectiveTotalEur = result.fcrEur + result.afrrEur + (includeNodes ? result.nodesEur : 0);

  elements.yearlyCombinedTotalEur.textContent = formatEuro(Math.round(effectiveTotalEur));
  elements.yearlyCombinedFcrEur.textContent = formatEuro(Math.round(result.fcrEur));
  elements.yearlyCombinedAfrrEur.textContent = formatEuro(Math.round(result.afrrEur));
  elements.yearlyCombinedNodesEur.textContent = formatEuro(Math.round(result.nodesEur));
  const deltaVsConservative = effectiveTotalEur - CONSERVATIVE_TOTAL_EUR;
  const deltaAbsText = formatEuro(Math.abs(Math.round(deltaVsConservative)));
  if (deltaVsConservative >= 0) {
    elements.yearlyCombinedMeta.textContent = `Årskalkylen for ${result.fcrYear} ligger ${deltaAbsText} over vårt konservative estimat, før optimalisering og uten bidrag fra Nodes og andre markeder vi jobber med.`;
  } else {
    elements.yearlyCombinedMeta.textContent = `Årskalkylen for ${result.fcrYear} ligger ${deltaAbsText} under vårt konservative estimat, før optimalisering og uten bidrag fra Nodes og andre markeder vi jobber med.`;
  }

  updateYearlyCombinedMonthlyChart(result.monthly, includeNodes);
  updateYearlyCombinedSummaryTable(result.monthly);
}

async function calculateYearlyCombined(): Promise<void> {
  if (isYearlyCombinedCalculating) return;
  isYearlyCombinedCalculating = true;
  const combinedStartMs = performance.now();

  const calculateButton = document.getElementById('calculateYearlyCombinedBtn') as HTMLButtonElement | null;
  if (calculateButton) calculateButton.disabled = true;

  try {
    const fcrYear = Number(elements.yearlyCombinedYear.value);
    logInfo('calc', 'yearly_combined_start', { year: fcrYear });
    if (!Number.isInteger(fcrYear)) {
      throw new Error('Velg et gyldig år for årskalkylen.');
    }
    const afrrYear = fcrYear;
    const quantityMw = Number(elements.powerMw.value);
    if (!Number.isFinite(quantityMw) || quantityMw <= 0) {
      throw new Error('Ugyldig MW i batterikonfigurasjon.');
    }

    currentYearlyCombinedResult = null;
    updateSidebarCsvExportState();
    setYearlyCombinedVisualStates('loading', 'Beregner årlig kalkyle...');
    showYearlyCombinedStatus('Beregner FCR-N (1/3)...', 'info');
    const fcrResult = await calculateFcrYearlyForCombined(fcrYear);

    showYearlyCombinedStatus('Beregner aFRR (2/3)...', 'info');
    const afrrResult = await calculateAfrrYearlyForCombined(afrrYear);

    showYearlyCombinedStatus('Beregner Nodes (3/3)...', 'info');
    const nodesResult = await calculateNodesYearlyForCombined(quantityMw);

    const monthly: YearlyCombinedMonthlyRow[] = MONTH_LABELS_NB.map((month, index) => {
      const fcrEur = fcrResult.monthlyByMonth[index] || 0;
      const afrrEur = afrrResult.monthlyByMonth[index] || 0;
      const nodesNok = nodesResult.monthlyByMonth[index] || 0;
      const nodesEur = nodesNok / NODES_NOK_PER_EUR;
      return {
        month,
        fcrEur,
        afrrEur,
        nodesNok,
        nodesEur,
        totalEur: fcrEur + afrrEur + nodesEur
      };
    });
    const hourly = buildYearlyCombinedHourlyRows(
      fcrResult.hourlyRows,
      afrrResult.hourlyRows,
      nodesResult.hourlyRows,
    );

    const nodesEur = nodesResult.totalNok / NODES_NOK_PER_EUR;
    currentYearlyCombinedResult = {
      totalEur: fcrResult.totalEur + afrrResult.totalEur + nodesEur,
      fcrEur: fcrResult.totalEur,
      afrrEur: afrrResult.totalEur,
      nodesNok: nodesResult.totalNok,
      nodesEur,
      fcrYear,
      afrrYear,
      nodesTenderName: nodesResult.tenderName,
      monthly,
      hourly,
    };
    updateSidebarCsvExportState();

    renderYearlyCombinedResult(currentYearlyCombinedResult);
    logInfo('calc', 'yearly_combined_finish', { durationMs: Math.round(performance.now() - combinedStartMs), totalEur: currentYearlyCombinedResult.totalEur });
    if (isYearlyCombinedNodesIncluded()) {
      showYearlyCombinedStatus('Fullført (3/3). Nodes er inkludert i total.', 'success', { autoHide: true });
    } else {
      showYearlyCombinedStatus('Fullført (3/3).', 'success', { autoHide: true });
    }
  } catch (error) {
    logError('calc', 'yearly_combined_error', { error: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - combinedStartMs) });
    const message = error instanceof Error ? error.message : 'Årskalkyle feilet.';
    showYearlyCombinedStatus(message, 'warning');
    setYearlyCombinedVisualStates('empty', 'Kunne ikke beregne årlig kalkyle.');
  } finally {
    isYearlyCombinedCalculating = false;
    if (calculateButton) calculateButton.disabled = false;
    updateSidebarCsvExportState();
  }
}

interface YearlyCombinedResolutionAggregate {
  periodKey: string;
  periodLabel: string;
  fcrEur: number;
  afrrEur: number;
  nodesEur: number;
}

function toUtcDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUtcHourKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:00`;
}

function aggregateYearlyCombinedByResolution(
  result: YearlyCombinedResult,
  resolution: Exclude<ExportResolution, 'month'>,
): YearlyCombinedResolutionAggregate[] {
  const byPeriod = new Map<string, { fcrEur: number; afrrEur: number; nodesEur: number }>();

  result.hourly.forEach((row) => {
    const periodKey = resolution === 'day'
      ? toUtcDayKey(row.timestamp)
      : toUtcHourKey(row.timestamp);
    const current = byPeriod.get(periodKey) || { fcrEur: 0, afrrEur: 0, nodesEur: 0 };
    current.fcrEur += row.fcrEur;
    current.afrrEur += row.afrrEur;
    current.nodesEur += row.nodesEur;
    byPeriod.set(periodKey, current);
  });

  return Array.from(byPeriod.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, values]) => ({
      periodKey,
      periodLabel: resolution === 'day' ? formatDayLabelNb(periodKey) : formatHourLabelNb(periodKey),
      fcrEur: values.fcrEur,
      afrrEur: values.afrrEur,
      nodesEur: values.nodesEur,
    }));
}

function buildYearlyCombinedExportRows(
  result: YearlyCombinedResult,
  includeNodes: boolean,
  resolution: ExportResolution,
): Array<Record<string, string | number>> {
  if (resolution === 'month') {
    const roundedFcr = roundValuesToTarget(
      result.monthly.map((row) => row.fcrEur),
      result.fcrEur,
    );
    const roundedAfrr = roundValuesToTarget(
      result.monthly.map((row) => row.afrrEur),
      result.afrrEur,
    );
    const roundedNodes = roundValuesToTarget(
      result.monthly.map((row) => row.nodesEur),
      result.nodesEur,
    );

    let accumulatedTotalEur = 0;
    return result.monthly.map((row, index) => {
      const effectiveTotalEur = roundedFcr[index] + roundedAfrr[index] + (includeNodes ? roundedNodes[index] : 0);
      accumulatedTotalEur += effectiveTotalEur;
      return {
        'Måned': formatShortMonthLabelNb(row.month),
        'FCR-N (EUR)': roundedFcr[index],
        'aFRR (EUR)': roundedAfrr[index],
        'Nodes/Euroflex (EUR)': roundedNodes[index],
        'Sum reservemarkeder (EUR)': effectiveTotalEur,
        'Akkumulert sum (EUR)': accumulatedTotalEur,
        'År (FCR/aFRR)': result.fcrYear,
      };
    });
  }

  const periodRows = aggregateYearlyCombinedByResolution(result, resolution);
  const roundedFcr = roundValuesToTarget(
    periodRows.map((row) => row.fcrEur),
    result.fcrEur,
  );
  const roundedAfrr = roundValuesToTarget(
    periodRows.map((row) => row.afrrEur),
    result.afrrEur,
  );
  const roundedNodes = roundValuesToTarget(
    periodRows.map((row) => row.nodesEur),
    result.nodesEur,
  );

  let accumulatedTotalEur = 0;
  if (resolution === 'day') {
    return periodRows.map((row, index) => {
      const effectiveTotalEur = roundedFcr[index] + roundedAfrr[index] + (includeNodes ? roundedNodes[index] : 0);
      accumulatedTotalEur += effectiveTotalEur;
      return {
        'Dag': row.periodLabel,
        'FCR-N (EUR)': roundedFcr[index],
        'aFRR (EUR)': roundedAfrr[index],
        'Nodes/Euroflex (EUR)': roundedNodes[index],
        'Sum reservemarkeder (EUR)': effectiveTotalEur,
        'Akkumulert sum (EUR)': accumulatedTotalEur,
      };
    });
  }

  return periodRows.map((row, index) => {
    const effectiveTotalEur = roundedFcr[index] + roundedAfrr[index] + (includeNodes ? roundedNodes[index] : 0);
    accumulatedTotalEur += effectiveTotalEur;
    return {
      'Time': row.periodLabel,
      'FCR-N (EUR)': roundedFcr[index],
      'aFRR (EUR)': roundedAfrr[index],
      'Nodes/Euroflex (EUR)': roundedNodes[index],
      'Sum reservemarkeder (EUR)': effectiveTotalEur,
      'Akkumulert sum (EUR)': accumulatedTotalEur,
    };
  });
}

async function exportYearlyCombinedCsv(resolution: ExportResolution = 'month'): Promise<void> {
  if (!currentYearlyCombinedResult) {
    showYearlyCombinedStatus('Beregn årlig total før eksport.', 'warning');
    return;
  }

  const result = currentYearlyCombinedResult;
  const includeNodes = isYearlyCombinedNodesIncluded();
  const rows = buildYearlyCombinedExportRows(result, includeNodes, resolution);
  const csvContent = Papa.unparse(rows);

  const yearSuffix = result.fcrYear === result.afrrYear
    ? `${result.fcrYear}`
    : `${result.fcrYear}_${result.afrrYear}`;
  const defaultName = appendResolutionSuffix(`aarskalkyle_kombinert_${yearSuffix}.csv`, resolution);
  await window.electronAPI.saveFile(csvContent, withExportTimestamp(defaultName));
}

async function exportYearlyCombinedExcel(resolution: ExportResolution = 'month'): Promise<void> {
  if (!currentYearlyCombinedResult) {
    showYearlyCombinedStatus('Beregn årlig total før eksport.', 'warning');
    return;
  }

  const result = currentYearlyCombinedResult;
  const includeNodes = isYearlyCombinedNodesIncluded();
  const rows = buildYearlyCombinedExportRows(result, includeNodes, resolution);
  const excelBytes = buildExcelFileBytes(rows, 'Årskalkyle');
  const yearSuffix = result.fcrYear === result.afrrYear
    ? `${result.fcrYear}`
    : `${result.fcrYear}_${result.afrrYear}`;
  const defaultName = appendResolutionSuffix(`aarskalkyle_kombinert_${yearSuffix}.xlsx`, resolution);
  await window.electronAPI.saveExcel(excelBytes, withExportTimestamp(defaultName));
}

async function loadPriceData(year: number): Promise<void> {
  logInfo('app', 'year_loading', { year });
  currentResult = null;
  updateSidebarCsvExportState();
  setFcrResultContainerVisible(false);
  setFcrVisualStates('loading', 'Laster prisdata...');
  showStatus(`Laster prisdata for ${year}...`, 'info');

  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
  logInfo('app', 'year_loaded', { year, rows: rows?.length || 0 });
  if (!rows || rows.length === 0) {
    setFcrResultContainerVisible(true);
    showStatus(`Ingen Convex-prisdata funnet for ${year}`, 'warning');
    setFcrVisualStates('empty', `Ingen prisdata for ${year}.`);
    return;
  }

  const loadedPriceData = rows
    .map(row => ({
      timestamp: new Date(row.timestamp),
      hourNumber: Number(row.hourNumber) || 0,
      price: Number(row.priceEurMw) || 0,
      volume: Number(row.volumeMw) || 0
    }))
    .filter(row => !Number.isNaN(row.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  priceData = trimPriceDataToYearHours(loadedPriceData, year);

  setFcrResultContainerVisible(true);

  showStatus(`Prisdata for ${year} lastet. Trykk "Beregn inntekt".`, 'info');
  setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
}

async function calculate(): Promise<void> {
  if (isCalculating) return;
  isCalculating = true;
  const calcStartMs = performance.now();
  const calculateBtn = document.getElementById('calculateBtn') as HTMLButtonElement | null;
  if (calculateBtn) calculateBtn.disabled = true;

  try {
    const configValues = getBatteryConfigValuesFromInputs();
    const config = createBatteryConfigFromInputs();

    const profileName = (document.querySelector('input[name="profile"]') as HTMLInputElement).value;
    const hours = parseInt(elements.simHours.value);
    const seed = parseInt(elements.seed.value);
    const year = parseInt(elements.year.value);
    logInfo('calc', 'calc_start', { year, hours, seed, profile: profileName });
    setFcrVisualStates('loading', 'Beregner visualiseringer...');

    showStatus('Simulerer frekvens', 'info', { autoHide: false });
    await new Promise(r => setTimeout(r, 10));

    let workerResult: WorkerPayload;
    try {
      workerResult = await runFcrSimulationInWorker({
        year,
        hours,
        startTimestamp: priceData.length > 0 ? new Date(priceData[0].timestamp).getTime() : Date.UTC(year, 0, 1),
        seed,
        profileName,
        config: configValues,
        priceData: priceData.map((row) => ({
          timestamp: new Date(row.timestamp).getTime(),
          price: row.price
        }))
      });
    } catch {
      logInfo('calc', 'worker_fallback', { year });
      const startTime = priceData.length > 0
        ? new Date(priceData[0].timestamp)
        : new Date(Date.UTC(year, 0, 1));
      showStatus('Simulerer batteri', 'info', { autoHide: false });
      await new Promise(r => setTimeout(r, 10));

      const localFreqData = FrequencySimulator.simulateFrequency(startTime, hours, 1, seed, profileName);

      showStatus('Beregner inntekt', 'info', { autoHide: false });
      await new Promise(r => setTimeout(r, 10));

      const socData = Calculator.simulateSocHourly(localFreqData, config);
      const result = Calculator.calculateRevenue(priceData, socData, config);

      workerResult = {
        result,
        summary: localFreqData.summary,
        totalSamples: localFreqData.frequencies.length
      };
    }

    const result: RevenueResult & { freqSummary?: FrequencySummary } = workerResult.result;
    result.freqSummary = workerResult.summary;

    showStatus('Simulering fullført', 'success', { autoHide: false });
    logInfo('calc', 'calc_finish', { durationMs: Math.round(performance.now() - calcStartMs), totalRevenue: result.totalRevenue });

    currentResult = result;
    updateSidebarCsvExportState();
    displayResults(result, true, true);
  } catch (err) {
    logError('calc', 'calc_error', { error: err instanceof Error ? err.message : String(err), durationMs: Math.round(performance.now() - calcStartMs) });
    showStatus('Beregning feilet. Prøv igjen.', 'warning', { autoHide: false });
    setFcrVisualStates('empty', 'Kunne ikke generere visualiseringer.');
  } finally {
    isCalculating = false;
    if (calculateBtn) calculateBtn.disabled = false;
    updateSidebarCsvExportState();
  }
}

function displayResults(result: RevenueResult & { freqSummary?: FrequencySummary }, showSoc: boolean, showFreq: boolean): void {
  elements.totalRevenue.textContent = `€${result.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  elements.availableHours.textContent = `${result.availableHours.toLocaleString()} / ${result.totalHours.toLocaleString()}`;
  elements.availability.textContent = `${result.availabilityPct.toFixed(1)}%`;
  elements.avgPrice.textContent = `€${result.avgPrice.toFixed(0)}/MW`;

  elements.annualizedNote.style.display = 'none';

  const monthly = aggregateMonthly(result.hourlyData);
  updateMonthlyChart(monthly);
  updateSummaryTable(monthly);

  updatePriceChart(result.hourlyData);

  elements.socSection.style.display = showSoc ? 'block' : 'none';
  if (showSoc) {
    updateSocChart(result.hourlyData);

    const unavailableHours = result.hourlyData.filter(h => !h.available).length;
    if (unavailableHours > 0) {
      showStatus(`${unavailableHours} timer utilgjengelig pga. SOC-grenser`, 'warning');
    }
  } else {
    setChartState('socChart', 'empty', 'SOC-visualisering er ikke aktiv.');
  }

  elements.freqSection.style.display = showFreq ? 'block' : 'none';
  if (showFreq && result.freqSummary) {
    updateFreqChart(result.freqSummary);
  } else {
    setChartState('freqChart', 'empty', 'Frekvens-visualisering er ikke aktiv.');
  }
}

function aggregateMonthly(hourlyData: HourlyRevenueRow[]): MonthlyAggregate[] {
  const byMonth = new Map<string, { revenue: number; hours: number; priceSum: number }>();

  for (const row of hourlyData) {
    const date = new Date(row.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { revenue: 0, hours: 0, priceSum: 0 });
    }

    const m = byMonth.get(monthKey)!;
    m.revenue += row.revenue;
    m.hours++;
    m.priceSum += row.price;
  }

  return Array.from(byMonth.entries()).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    hours: data.hours,
    avgPrice: data.priceSum / data.hours
  }));
}

function aggregateFcrMonthlyForCsv(hourlyData: HourlyRevenueRow[]): FcrMonthlyCsvAggregate[] {
  const byMonth = new Map<string, { revenue: number; totalHours: number; availableHours: number; priceSum: number }>();

  for (const row of hourlyData) {
    const date = new Date(row.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, {
        revenue: 0,
        totalHours: 0,
        availableHours: 0,
        priceSum: 0,
      });
    }

    const month = byMonth.get(monthKey)!;
    month.revenue += row.revenue;
    month.totalHours += 1;
    month.availableHours += row.available ? 1 : 0;
    month.priceSum += row.price;
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, values]) => ({
      monthKey,
      monthLabel: formatYearMonthLabelNb(monthKey),
      totalHours: values.totalHours,
      availableHours: values.availableHours,
      unavailableHours: Math.max(0, values.totalHours - values.availableHours),
      avgPriceEurMw: values.totalHours > 0 ? values.priceSum / values.totalHours : 0,
      revenueEur: values.revenue,
    }));
}

function updateMonthlyChart(monthly: MonthlyAggregate[]): void {
  if (!Array.isArray(monthly) || monthly.length === 0) {
    if (charts.monthly) {
      charts.monthly.destroy();
      charts.monthly = null;
    }
    setChartState('monthlyChart', 'empty', 'Ingen månedlige data å vise.');
    return;
  }

  const ctx = (document.getElementById('monthlyChart') as HTMLCanvasElement).getContext('2d')!;
  if (charts.monthly) charts.monthly.destroy();

  charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthly.map(m => m.month),
      datasets: [{
        label: 'Inntekt (EUR)',
        data: monthly.map(m => m.revenue),
        backgroundColor: '#e94560',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => `€${(v as number).toLocaleString()}`
          }
        }
      }
    }
  });
  setChartState('monthlyChart', 'ready', '');
}

function updatePriceChart(hourlyData: HourlyRevenueRow[]): void {
  const prices = hourlyData.map(h => h.price);
  if (prices.length === 0) {
    if (charts.price) {
      charts.price.destroy();
      charts.price = null;
    }
    setChartState('priceChart', 'empty', 'Ingen prisdata å vise.');
    return;
  }

  const ctx = (document.getElementById('priceChart') as HTMLCanvasElement).getContext('2d')!;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binCount = 50;
  const bins = new Array<number>(binCount).fill(0);
  let labels: string[];

  if (max === min) {
    bins[0] = prices.length;
    labels = bins.map((_, i) => (i === 0 ? min.toFixed(0) : ''));
  } else {
    const binWidth = (max - min) / binCount;
    for (const price of prices) {
      const rawIndex = Math.floor((price - min) / binWidth);
      const binIndex = Math.max(0, Math.min(rawIndex, binCount - 1));
      bins[binIndex]++;
    }
    labels = bins.map((_, i) => (min + i * binWidth + binWidth / 2).toFixed(0));
  }

  if (charts.price) charts.price.destroy();

  charts.price = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Antall',
        data: bins,
        backgroundColor: '#4ade80',
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: 'Pris (EUR/MW)' }
        },
        y: {
          title: { display: true, text: 'Timer' }
        }
      }
    }
  });
  setChartState('priceChart', 'ready', '');
}

function updateSocChart(hourlyData: HourlyRevenueRow[]): void {
  const dataWithSoc = hourlyData.filter(h => h.socStart !== null);
  if (dataWithSoc.length === 0) {
    if (charts.soc) {
      charts.soc.destroy();
      charts.soc = null;
    }
    setChartState('socChart', 'empty', 'Ingen SOC-data å vise.');
    return;
  }

  const ctx = (document.getElementById('socChart') as HTMLCanvasElement).getContext('2d')!;
  if (charts.soc) charts.soc.destroy();

  const socMin = parseInt(elements.socMin.value);
  const socMax = parseInt(elements.socMax.value);

  charts.soc = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataWithSoc.map(h => new Date(h.timestamp).toLocaleString()),
      datasets: [
        {
          label: 'SOC (%)',
          data: dataWithSoc.map(h => h.socStart! * 100),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Min SOC',
          data: dataWithSoc.map(() => socMin),
          borderColor: '#e94560',
          borderDash: [5, 5],
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Maks SOC',
          data: dataWithSoc.map(() => socMax),
          borderColor: '#e94560',
          borderDash: [5, 5],
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: false },
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'SOC (%)' }
        }
      }
    }
  });
  setChartState('socChart', 'ready', '');
}

function updateFreqChart(summary: FrequencySummary): void {
  if (!summary || !Array.isArray(summary.histogramLabels) || !Array.isArray(summary.histogram) || summary.histogram.length === 0) {
    if (charts.freq) {
      charts.freq.destroy();
      charts.freq = null;
    }
    setChartState('freqChart', 'empty', 'Ingen frekvensdata å vise.');
    return;
  }

  const ctx = (document.getElementById('freqChart') as HTMLCanvasElement).getContext('2d')!;
  const labels = summary.histogramLabels;
  const bins = summary.histogram;

  const normalBandColors = labels.map(l => {
    const f = parseFloat(l);
    return (f >= 49.9 && f <= 50.1) ? '#4ade80' : '#e94560';
  });

  if (charts.freq) charts.freq.destroy();

  charts.freq = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Antall',
        data: bins,
        backgroundColor: normalBandColors,
        borderRadius: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: 'Frekvens (Hz)' },
          ticks: {
            maxTicksLimit: 10
          }
        },
        y: {
          title: { display: true, text: 'Samples' }
        }
      }
    }
  });
  setChartState('freqChart', 'ready', '');
}

function updateSummaryTable(monthly: MonthlyAggregate[]): void {
  if (!Array.isArray(monthly) || monthly.length === 0) {
    elements.summaryTable.innerHTML = '';
    setTableState('summaryTable', 'empty', 'Ingen rader å vise.');
    return;
  }

  elements.summaryTable.innerHTML = monthly.map(m => `
    <tr>
      <td>${m.month}</td>
      <td>€${m.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
      <td>${m.hours}</td>
      <td>€${m.avgPrice.toFixed(0)}</td>
    </tr>
  `).join('');
  setTableState('summaryTable', 'ready', '');
}

function aggregateFcrByResolution(
  hourlyData: HourlyRevenueRow[],
  resolution: Exclude<ExportResolution, 'month'>,
): FcrResolutionAggregate[] {
  const byPeriod = new Map<string, { totalHours: number; availableHours: number; priceSum: number; revenueEur: number }>();

  for (const row of hourlyData) {
    const date = new Date(row.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const periodKey = resolution === 'day'
      ? `${year}-${month}-${day}`
      : `${year}-${month}-${day} ${String(date.getHours()).padStart(2, '0')}:00`;

    const existing = byPeriod.get(periodKey) || {
      totalHours: 0,
      availableHours: 0,
      priceSum: 0,
      revenueEur: 0,
    };
    existing.totalHours += 1;
    existing.availableHours += row.available ? 1 : 0;
    existing.priceSum += row.price;
    existing.revenueEur += row.revenue;
    byPeriod.set(periodKey, existing);
  }

  return Array.from(byPeriod.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, values]) => ({
      periodKey,
      periodLabel: resolution === 'day' ? formatDayLabelNb(periodKey) : formatHourLabelNb(periodKey),
      totalHours: values.totalHours,
      availableHours: values.availableHours,
      avgPriceEurMw: values.totalHours > 0 ? values.priceSum / values.totalHours : 0,
      revenueEur: values.revenueEur,
    }));
}

interface FcrExportMetaValues {
  market: string;
  powerMw: number;
  capacityMwh: number;
}

function getFcrExportMetaValues(): FcrExportMetaValues {
  const powerMw = parseFloat(elements.powerMw.value);
  const capacityMwh = parseFloat(elements.capacityMwh.value);
  const safePowerMw = Number.isFinite(powerMw) ? powerMw : 0;
  const safeCapacityMwh = Number.isFinite(capacityMwh) ? capacityMwh : 0;

  return {
    market: 'FCR-N',
    powerMw: safePowerMw,
    capacityMwh: safeCapacityMwh,
  };
}

function calculateFcrFormulaPriceEurMw(
  revenueEur: number,
  powerMw: number,
  participatingHours: number,
): number {
  if (!Number.isFinite(revenueEur) || !Number.isFinite(powerMw) || !Number.isFinite(participatingHours)) {
    return 0;
  }
  if (powerMw <= 0 || participatingHours <= 0) return 0;
  return revenueEur / (powerMw * participatingHours);
}

function roundToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildFcrVerificationColumns(
  meta: FcrExportMetaValues,
  revenueEur: number,
  participatingHours: number,
  options: { fcrPriceEurMw?: number; hoursInPeriod?: number; hoursLabel?: string } = {},
): Record<string, string | number> {
  const formulaPrice = Number.isFinite(options.fcrPriceEurMw)
    ? Number(options.fcrPriceEurMw)
    : calculateFcrFormulaPriceEurMw(revenueEur, meta.powerMw, participatingHours);
  const columns: Record<string, string | number> = {
    'Marked': meta.market,
    'Effekt (MW)': meta.powerMw,
    'Kapasitet (MWh)': meta.capacityMwh,
    'FCR-pris (EUR/MW)': roundToTwoDecimals(formulaPrice),
  };
  if (Number.isFinite(options.hoursInPeriod)) {
    const hoursLabel = options.hoursLabel || 'Timer i perioden';
    columns[hoursLabel] = Number(options.hoursInPeriod);
  }
  columns['Inntekt FCR-N (EUR)'] = roundToTwoDecimals(revenueEur);
  return columns;
}

function buildFcrExportRows(
  result: RevenueResult,
  resolution: ExportResolution,
): Array<Record<string, string | number>> {
  const meta = getFcrExportMetaValues();

  if (resolution === 'month') {
    const monthlyRows = aggregateFcrMonthlyForCsv(result.hourlyData);
    const exportRevenue = monthlyRows.map((row) => roundToTwoDecimals(row.revenueEur));
    return monthlyRows.map((row, index) => ({
      'Måned': row.monthLabel,
      ...buildFcrVerificationColumns(meta, exportRevenue[index], row.availableHours, {
        hoursInPeriod: row.totalHours,
        hoursLabel: 'Timer i måneden',
      }),
    }));
  }

  if (resolution === 'hour') {
    const hourlyRows = result.hourlyData
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const exportRevenue = hourlyRows.map((row) => roundToTwoDecimals(row.revenue));

    return hourlyRows.map((row, index) => {
      const date = new Date(row.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const hourLabel = formatHourLabelNb(`${year}-${month}-${day} ${hour}:00`);
      const participatingHours = row.available ? 1 : 0;

      return {
        'Time': hourLabel,
        ...buildFcrVerificationColumns(meta, exportRevenue[index], participatingHours, {
          fcrPriceEurMw: row.price,
        }),
        'SOC start (%)': row.socStart === null ? '' : Number((row.socStart * 100).toFixed(3)),
        'SOC slutt (%)': row.socEnd === null ? '' : Number((row.socEnd * 100).toFixed(3)),
      };
    });
  }

  const periodRows = aggregateFcrByResolution(result.hourlyData, resolution);
  const exportRevenue = periodRows.map((row) => roundToTwoDecimals(row.revenueEur));

  if (resolution === 'day') {
    return periodRows.map((row, index) => ({
      'Dag': row.periodLabel,
      ...buildFcrVerificationColumns(meta, exportRevenue[index], row.availableHours, {
        fcrPriceEurMw: row.avgPriceEurMw,
        hoursInPeriod: row.totalHours,
        hoursLabel: 'Timer i døgnet',
      }),
    }));
  }

  return periodRows.map((row, index) => ({
    'Time': row.periodLabel,
    ...buildFcrVerificationColumns(meta, exportRevenue[index], row.availableHours),
  }));
}

async function exportCsv(resolution: ExportResolution = 'month'): Promise<void> {
  if (!currentResult) return;
  const result = currentResult;

  const rows = buildFcrExportRows(result, resolution);
  const csvContent = Papa.unparse(rows);

  const year = elements.year.value;
  const defaultName = appendResolutionSuffix(`fcr_inntekt_${year}.csv`, resolution);
  await window.electronAPI.saveFile(csvContent, withExportTimestamp(defaultName));
}

async function exportExcel(resolution: ExportResolution = 'month'): Promise<void> {
  if (!currentResult) return;
  const result = currentResult;

  const rows = buildFcrExportRows(result, resolution);
  const excelBytes = buildExcelFileBytes(rows, `FCR-N ${elements.year.value}`);
  const year = elements.year.value;
  const defaultName = appendResolutionSuffix(`fcr_inntekt_${year}.xlsx`, resolution);
  await window.electronAPI.saveExcel(excelBytes, withExportTimestamp(defaultName));
}

async function exportPdf(): Promise<void> {
  if (!currentResult) return;

  showStatus('Genererer PDF...', 'info');

  const year = elements.year.value;
  const monthly = aggregateMonthly(currentResult.hourlyData);

  const chartImages = {
    monthly: charts.monthly ? charts.monthly.toBase64Image() : null,
    price: charts.price ? charts.price.toBase64Image() : null,
    soc: charts.soc ? charts.soc.toBase64Image() : null,
    freq: charts.freq ? charts.freq.toBase64Image() : null
  };

  const pdfData = {
    chartImages,
    monthly,
    config: {
      powerMw: parseFloat(elements.powerMw.value),
      capacityMwh: parseFloat(elements.capacityMwh.value),
      efficiency: parseInt(elements.efficiency.value),
      socMin: parseInt(elements.socMin.value),
      socMax: parseInt(elements.socMax.value),
      year: parseInt(year)
    },
    metrics: {
      totalRevenue: elements.totalRevenue.textContent || '',
      availableHours: elements.availableHours.textContent || '',
      availability: elements.availability.textContent || '',
      avgPrice: elements.avgPrice.textContent || ''
    }
  };

  const pdfName = withExportTimestamp(`FCR-N_Rapport_${year}.pdf`);
  const result = await window.electronAPI.savePdf(pdfData, pdfName);
  if (result) {
    showStatus('PDF eksportert!', 'success');
  } else {
    showStatus('PDF-eksport avbrutt', 'warning');
  }
}

function showStatus(
  message: string,
  type: string,
  options: { autoHide?: boolean } = {}
): void {
  showStatusMessage(elements.statusMessage, message, type, options);
}

const popoverEl = document.getElementById('popover')!;
let activePopoverBtn: HTMLElement | null = null;

function showPopover(btn: HTMLElement): void {
  const helpId = 'help-' + (btn as HTMLElement & { dataset: { help: string } }).dataset.help;
  const helpEl = document.getElementById(helpId);
  if (!helpEl) return;

  popoverEl.textContent = helpEl.textContent;
  popoverEl.classList.add('visible');

  const btnRect = btn.getBoundingClientRect();
  const gap = 8;

  popoverEl.style.left = '0px';
  popoverEl.style.top = '0px';
  const popRect = popoverEl.getBoundingClientRect();

  const spaceAbove = btnRect.top;
  const placeAbove = spaceAbove >= popRect.height + gap;

  let top: number;
  if (placeAbove) {
    top = btnRect.top - popRect.height - gap;
    popoverEl.classList.remove('arrow-top');
    popoverEl.classList.add('arrow-bottom');
  } else {
    top = btnRect.bottom + gap;
    popoverEl.classList.remove('arrow-bottom');
    popoverEl.classList.add('arrow-top');
  }

  const btnCenter = btnRect.left + btnRect.width / 2;
  let left = btnCenter - popRect.width / 2;
  const margin = 8;
  left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

  const arrowLeft = Math.max(12, Math.min(btnCenter - left, popRect.width - 12));
  popoverEl.style.setProperty('--arrow-left', arrowLeft + 'px');

  popoverEl.style.top = top + 'px';
  popoverEl.style.left = left + 'px';
  activePopoverBtn = btn;
}

function hidePopover(): void {
  popoverEl.classList.remove('visible', 'arrow-top', 'arrow-bottom');
  activePopoverBtn = null;
}

document.querySelectorAll<HTMLButtonElement>('.info-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePopoverBtn === btn) {
      hidePopover();
    } else {
      showPopover(btn);
    }
  });
});

document.addEventListener('click', (e) => {
  if (activePopoverBtn && !popoverEl.contains(e.target as Node) && !(e.target as HTMLElement).classList.contains('info-btn')) {
    hidePopover();
  }
});

window.addEventListener('scroll', hidePopover, true);
window.addEventListener('resize', hidePopover);

document.querySelectorAll<HTMLButtonElement>('.collapsible-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const section = btn.closest('.config-section.collapsible');
    if (section) section.classList.toggle('open');
  });
});

init().then(() => {
  logInfo('app', 'init_complete');
}).catch((error) => {
  logError('app', 'init_error', { error: error instanceof Error ? error.message : String(error) });
});
