console.log('[app] Renderer script loading');

import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import * as Calculator from './calculator';
import type { FrequencySummary, HourlyRevenueRow, RevenueResult } from './calculator';
import * as FrequencySimulator from './frequency';
import { calculateAfrrYearlyRevenue } from './afrr';
import { calculateNodeYearlyIncome } from './nodes';
import { createAfrrUI } from './afrr-ui';
import { createNodesUI } from './nodes-ui';

console.log('[app] Modules imported successfully');
console.log('[app] electronAPI available:', !!window.electronAPI);
console.log('[app] electronAPI methods:', window.electronAPI ? Object.keys(window.electronAPI) : 'N/A');

interface MonthlyAggregate {
  month: string;
  revenue: number;
  hours: number;
  avgPrice: number;
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

type CombinedMarket = 'aFRR' | 'FCR-N' | 'NODES/Euroflex';

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
}

let priceData: PriceDataRow[] = [];
let currentResult: (RevenueResult & { freqSummary?: FrequencySummary }) | null = null;
const afrrUI = createAfrrUI();
const nodesUI = createNodesUI();
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
  simHours: document.getElementById('simHours') as HTMLInputElement,
  seed: document.getElementById('seed') as HTMLInputElement,
  yearlyCombinedYear: document.getElementById('yearlyCombinedYear') as HTMLSelectElement,

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
  yearlyCombinedSummaryTable: document.getElementById('yearlyCombinedSummaryTable')!.querySelector('tbody') as HTMLTableSectionElement,
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

const MONTH_LABELS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
const NODES_NOK_PER_EUR = 11.5;
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
    market: 'NODES/Euroflex',
    valueEurMwHour: 52,
    reason: 'Lokal flaskehals kan gi høy fleksibilitetsverdi i enkeltperioder.',
    consequence: 'Når NODES er best, må FCR-N/aFRR vike for samme kapasitet.'
  },
  {
    block: '22:00-24:00',
    market: 'FCR-N',
    valueEurMwHour: 24,
    reason: 'Tilbake til FCR-N når relative priser i øvrige markeder faller.',
    consequence: 'Ny allokering per timeblokk, fortsatt uten dobbelbooking.'
  }
];

function formatEuro(value: number): string {
  return `€${value.toLocaleString('nb-NO', { maximumFractionDigits: 0 })}`;
}

function formatSignedEuro(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toLocaleString('nb-NO', { maximumFractionDigits: 0 });
  return `${sign}€${abs}`;
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

function setYearlyCombinedVisualStates(state: string, message: string): void {
  setChartState('yearlyCombinedMonthlyChart', state, message);
  setTableState('yearlyCombinedSummaryTable', state, message);
}

function showYearlyCombinedStatus(message: string, type = 'info'): void {
  elements.yearlyCombinedStatusMessage.textContent = message;
  elements.yearlyCombinedStatusMessage.className = `status-message ${type}`;
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
    const workerUrl = new URL('./simulation-worker.ts', import.meta.url);
    console.log('[app] Creating Web Worker from URL:', workerUrl.href);
    const worker = new Worker(workerUrl, { type: 'module' });
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
        console.log('[app] Worker progress:', message.message);
        showStatus(message.message, 'info');
        return;
      }

      if (message.type === 'result') {
        console.log('[app] Worker returned result');
        cleanup();
        resolve(message.payload);
        return;
      }

      if (message.type === 'error') {
        console.error('[app] Worker error:', message.error);
        cleanup();
        reject(new Error(message.error || 'Simulation worker failed'));
      }
    });

    worker.addEventListener('error', (event: ErrorEvent) => {
      console.error('[app] Worker crashed:', event.message, event.filename, event.lineno);
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
  const isYearlyCombinedTab = tab === 'yearlyCombined';

  if (elements.batteryConfigSection) {
    elements.batteryConfigSection.style.display = (isAfrrTab || isNodesTab) ? 'none' : '';
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

async function init(): Promise<void> {
  console.log('[app] init() starting');
  setupTabs();
  console.log('[app] Tabs set up');

  console.log('[app] Initializing aFRR UI');
  await afrrUI.init();
  console.log('[app] aFRR UI initialized');

  setFcrVisualStates('loading', 'Laster visualiseringer...');
  setupSliders();

  console.log('[app] Fetching available years from Convex');
  const years = (await window.electronAPI.getAvailableYears('NO1'))
    .map(y => Number(y))
    .filter(y => Number.isFinite(y))
    .sort((a, b) => a - b);
  console.log('[app] Available years:', years);

  populateYearSelect(elements.year, years);
  populateYearSelect(elements.yearlyCombinedYear, years);

  if (years.length > 0) {
    const preferredYear = 2025;
    const defaultYear = years.includes(preferredYear)
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

  console.log('[app] Initializing nodes module');
  await nodesUI.init();
  console.log('[app] Nodes module initialized');
  initCombinedView();
  setYearlyCombinedVisualStates('empty', 'Trykk "Beregn årlig total".');

  console.log('[app] init() complete — attaching event listeners');
  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn')!.addEventListener('click', calculate);
  document.getElementById('exportBtn')!.addEventListener('click', exportCsv);
  document.getElementById('exportXlsxBtn')!.addEventListener('click', exportXlsx);
  document.getElementById('exportPdfBtn')!.addEventListener('click', exportPdf);
  document.getElementById('calculateYearlyCombinedBtn')?.addEventListener('click', calculateYearlyCombined);
  document.getElementById('yearlyCombinedExportCsvBtn')?.addEventListener('click', exportYearlyCombinedCsv);
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
  const reserveTotal = combinedAnnualRevenue.afrrEur + combinedAnnualRevenue.fcrCombinedEur + combinedAnnualRevenue.nodesEur;
  const fcrDifference = combinedAnnualRevenue.fcrStandaloneEur - combinedAnnualRevenue.fcrCombinedEur;

  elements.combinedReserveTotal.textContent = `>= ${formatEuro(reserveTotal)}`;
  elements.combinedAfrrRevenue.textContent = formatEuro(combinedAnnualRevenue.afrrEur);
  elements.combinedFcrRevenue.textContent = formatEuro(combinedAnnualRevenue.fcrCombinedEur);
  elements.combinedNodesRevenue.textContent = formatEuro(combinedAnnualRevenue.nodesEur);
  elements.combinedDifferenceText.textContent = `Differanse: ${formatEuro(fcrDifference)} (fra ${formatEuro(combinedAnnualRevenue.fcrStandaloneEur)} til ${formatEuro(combinedAnnualRevenue.fcrCombinedEur)} i kombinert modell).`;
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
  const nodesValue = total - afrrValue - fcrValue;

  elements.combinedAfrrShareValue.textContent = `${safeSharePct}%`;
  elements.combinedRatioTotal.textContent = formatEuro(total);
  elements.combinedRatioAfrr.textContent = formatEuro(afrrValue);
  elements.combinedRatioFcr.textContent = formatEuro(fcrValue);
  elements.combinedRatioNodes.textContent = formatEuro(nodesValue);

  updateCombinedRatioChart(afrrValue, fcrValue, nodesValue);
}

function updateCombinedRatioChart(afrrValue: number, fcrValue: number, nodesValue: number): void {
  const chartCanvas = document.getElementById('combinedRatioChart') as HTMLCanvasElement | null;
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext('2d');
  if (!ctx) return;

  const dataset = [afrrValue, fcrValue, nodesValue];

  if (charts.combinedRatio) {
    charts.combinedRatio.data.datasets[0].data = dataset;
    charts.combinedRatio.update();
    return;
  }

  charts.combinedRatio = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['aFRR', 'FCR-N', 'NODES/Euroflex'],
      datasets: [{
        data: dataset,
        backgroundColor: ['#4fcb73', '#f3c640', '#60a5fa'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 14
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
  const aFRRData = combinedPriorityRows.map(row => row.market === 'aFRR' ? row.valueEurMwHour : null);
  const fcrData = combinedPriorityRows.map(row => row.market === 'FCR-N' ? row.valueEurMwHour : null);
  const nodesData = combinedPriorityRows.map(row => row.market === 'NODES/Euroflex' ? row.valueEurMwHour : null);

  charts.combinedPriority = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'aFRR valgt',
          data: aFRRData,
          backgroundColor: '#4fcb73',
          borderRadius: 4
        },
        {
          label: 'FCR-N valgt',
          data: fcrData,
          backgroundColor: '#f3c640',
          borderRadius: 4
        },
        {
          label: 'NODES/Euroflex valgt',
          data: nodesData,
          backgroundColor: '#60a5fa',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Indikativ verdi (EUR/MW/h)'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            footer: (items) => {
              const first = items[0];
              if (!first) return '';
              const row = combinedPriorityRows[first.dataIndex];
              if (!row) return '';
              return 'Samme kapasitet kan ikke dobbelbookes i denne blokken.';
            }
          }
        }
      }
    }
  });
}

async function calculateFcrYearlyForCombined(year: number): Promise<{ totalEur: number; monthlyByMonth: number[] }> {
  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
  const localPriceData = (Array.isArray(rows) ? rows : [])
    .map(row => ({
      timestamp: new Date(row.timestamp),
      hourNumber: Number(row.hourNumber) || 0,
      price: Number(row.priceEurMw) || 0,
      volume: Number(row.volumeMw) || 0
    }))
    .filter(row => !Number.isNaN(row.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (localPriceData.length === 0) {
    throw new Error(`Ingen FCR-prisdata funnet for ${year}`);
  }

  const configValues = {
    powerMw: parseFloat(elements.powerMw.value),
    capacityMwh: parseFloat(elements.capacityMwh.value),
    efficiency: parseInt(elements.efficiency.value, 10) / 100,
    socMin: parseInt(elements.socMin.value, 10) / 100,
    socMax: parseInt(elements.socMax.value, 10) / 100
  };
  const config = new Calculator.BatteryConfig(
    configValues.powerMw,
    configValues.capacityMwh,
    configValues.efficiency,
    configValues.socMin,
    configValues.socMax
  );

  const profileName = (document.querySelector('input[name="profile"]') as HTMLInputElement).value;
  const hours = parseInt(elements.simHours.value, 10);
  const seed = parseInt(elements.seed.value, 10);

  let workerResult: WorkerPayload;
  try {
    workerResult = await runFcrSimulationInWorker({
      year,
      hours,
      seed,
      profileName,
      config: configValues,
      priceData: localPriceData.map((row) => ({
        timestamp: new Date(row.timestamp).getTime(),
        price: row.price
      }))
    });
  } catch (error) {
    console.warn('[combined-yearly] Worker unavailable, using main thread fallback', error);
    const startTime = new Date(Date.UTC(year, 0, 1));
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
  const monthly = aggregateMonthly(workerResult.result.hourlyData);
  monthly.forEach((row) => {
    const index = parseYearMonthToIndex(row.month);
    if (index !== null) {
      monthlyByMonth[index] = row.revenue;
    }
  });

  return {
    totalEur: workerResult.result.totalRevenue,
    monthlyByMonth
  };
}

async function calculateAfrrYearlyForCombined(afrrYear: number): Promise<{ totalEur: number; monthlyByMonth: number[] }> {
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

  const afrrResult = calculateAfrrYearlyRevenue({
    year: afrrYear,
    afrrRows: Array.isArray(afrrRowsRaw) ? afrrRowsRaw : [],
    solarRows: Array.isArray(solarRowsRaw) ? solarRowsRaw : [],
    spotRows: Array.isArray(spotRowsRaw) ? spotRowsRaw : [],
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
    monthlyByMonth
  };
}

async function calculateNodesYearlyForCombined(quantityMw: number): Promise<{
  totalNok: number;
  monthlyByMonth: number[];
  tenderName: string;
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

  const nodesResult = calculateNodeYearlyIncome({
    reservationPriceNokMwH: reservationPrice,
    quantityMw,
    periodStartTs,
    periodEndTs,
    activeDays: Array.isArray(tender.activeDays) ? tender.activeDays : [],
    activeWindows: Array.isArray(tender.activeWindows) ? tender.activeWindows : [],
  });

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
    tenderName: tender.name || 'Nodes-tender'
  };
}

function updateYearlyCombinedMonthlyChart(monthly: YearlyCombinedMonthlyRow[]): void {
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
          borderRadius: 4
        },
        {
          label: 'aFRR (EUR)',
          data: monthly.map((row) => row.afrrEur),
          backgroundColor: '#4fcb73',
          borderRadius: 4
        },
        {
          label: 'Nodes (EUR)',
          data: monthly.map((row) => row.nodesEur),
          backgroundColor: '#60a5fa',
          borderRadius: 4
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
      <td>${formatEuro(Math.round(row.nodesEur))}</td>
      <td>${formatEuro(Math.round(row.totalEur))}</td>
    </tr>
  `).join('');
  setTableState('yearlyCombinedSummaryTable', 'ready', '');
}

function renderYearlyCombinedResult(result: YearlyCombinedResult): void {
  elements.yearlyCombinedTotalEur.textContent = formatEuro(Math.round(result.totalEur));
  elements.yearlyCombinedFcrEur.textContent = formatEuro(Math.round(result.fcrEur));
  elements.yearlyCombinedAfrrEur.textContent = formatEuro(Math.round(result.afrrEur));
  elements.yearlyCombinedNodesEur.textContent = formatEuro(Math.round(result.nodesEur));
  const deltaVsConservative = result.totalEur - CONSERVATIVE_TOTAL_EUR;
  elements.yearlyCombinedMeta.textContent = `År ${result.fcrYear} for FCR-N/aFRR. Nodes: "${result.nodesTenderName}" (uendret på tvers av år). Konservativ referanse ${formatEuro(CONSERVATIVE_TOTAL_EUR)}. Avvik: ${formatSignedEuro(deltaVsConservative)}.`;

  updateYearlyCombinedMonthlyChart(result.monthly);
  updateYearlyCombinedSummaryTable(result.monthly);
}

async function calculateYearlyCombined(): Promise<void> {
  if (isYearlyCombinedCalculating) return;
  isYearlyCombinedCalculating = true;

  const calculateButton = document.getElementById('calculateYearlyCombinedBtn') as HTMLButtonElement | null;
  if (calculateButton) calculateButton.disabled = true;

  try {
    const fcrYear = Number(elements.yearlyCombinedYear.value);
    if (!Number.isInteger(fcrYear)) {
      throw new Error('Velg et gyldig år for årskalkylen.');
    }
    const afrrYear = fcrYear;
    const quantityMw = Number(elements.powerMw.value);
    if (!Number.isFinite(quantityMw) || quantityMw <= 0) {
      throw new Error('Ugyldig MW i batterikonfigurasjon.');
    }

    currentYearlyCombinedResult = null;
    setYearlyCombinedVisualStates('loading', 'Beregner årlig kalkyle...');
    showYearlyCombinedStatus('Beregner FCR-N...', 'info');
    const fcrResult = await calculateFcrYearlyForCombined(fcrYear);

    showYearlyCombinedStatus('Beregner aFRR...', 'info');
    const afrrResult = await calculateAfrrYearlyForCombined(afrrYear);

    showYearlyCombinedStatus('Beregner Nodes...', 'info');
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
      monthly
    };

    renderYearlyCombinedResult(currentYearlyCombinedResult);
    showYearlyCombinedStatus('Årskalkyle fullført (rå beregning, uten normalisering).', 'success');
  } catch (error) {
    console.error('[combined-yearly] Calculation failed:', error);
    const message = error instanceof Error ? error.message : 'Årskalkyle feilet.';
    showYearlyCombinedStatus(message, 'warning');
    setYearlyCombinedVisualStates('empty', 'Kunne ikke beregne årlig kalkyle.');
  } finally {
    isYearlyCombinedCalculating = false;
    if (calculateButton) calculateButton.disabled = false;
  }
}

async function exportYearlyCombinedCsv(): Promise<void> {
  if (!currentYearlyCombinedResult) {
    showYearlyCombinedStatus('Beregn årlig total før eksport.', 'warning');
    return;
  }

  const result = currentYearlyCombinedResult;
  const csvContent = Papa.unparse(result.monthly.map((row) => ({
    maaned: row.month,
    fcr_eur: row.fcrEur.toFixed(2),
    afrr_eur: row.afrrEur.toFixed(2),
    nodes_eur: row.nodesEur.toFixed(2),
    total_eur: row.totalEur.toFixed(2),
    aarlig_total_eur: result.totalEur.toFixed(2),
    konservativ_referanse_eur: CONSERVATIVE_TOTAL_EUR.toFixed(2),
    avvik_mot_referanse_eur: (result.totalEur - CONSERVATIVE_TOTAL_EUR).toFixed(2),
  })));

  await window.electronAPI.saveFile(csvContent, `aarskalkyle_kombinert_${result.fcrYear}.csv`);
}

async function loadPriceData(year: number): Promise<void> {
  console.log('[app] loadPriceData() called for year:', year);
  setFcrResultContainerVisible(false);
  setFcrVisualStates('loading', 'Laster prisdata...');

  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
  console.log('[app] Price data received:', rows?.length || 0, 'rows');
  if (!rows || rows.length === 0) {
    setFcrResultContainerVisible(true);
    showStatus(`Ingen Convex-prisdata funnet for ${year}`, 'warning');
    setFcrVisualStates('empty', `Ingen prisdata for ${year}.`);
    return;
  }

  priceData = rows
    .map(row => ({
      timestamp: new Date(row.timestamp),
      hourNumber: Number(row.hourNumber) || 0,
      price: Number(row.priceEurMw) || 0,
      volume: Number(row.volumeMw) || 0
    }))
    .filter(row => !Number.isNaN(row.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  setFcrResultContainerVisible(true);

  showStatus('Prisdata lastet', 'success');
  setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
}

async function calculate(): Promise<void> {
  console.log('[app] calculate() called');
  if (isCalculating) { console.log('[app] Calculation already in progress, skipping'); return; }
  isCalculating = true;
  const calculateBtn = document.getElementById('calculateBtn') as HTMLButtonElement | null;
  if (calculateBtn) calculateBtn.disabled = true;

  try {
    const configValues = {
      powerMw: parseFloat(elements.powerMw.value),
      capacityMwh: parseFloat(elements.capacityMwh.value),
      efficiency: parseInt(elements.efficiency.value) / 100,
      socMin: parseInt(elements.socMin.value) / 100,
      socMax: parseInt(elements.socMax.value) / 100
    };

    const config = new Calculator.BatteryConfig(
      configValues.powerMw,
      configValues.capacityMwh,
      configValues.efficiency,
      configValues.socMin,
      configValues.socMax
    );

    const profileName = (document.querySelector('input[name="profile"]') as HTMLInputElement).value;
    const hours = parseInt(elements.simHours.value);
    const seed = parseInt(elements.seed.value);
    const year = parseInt(elements.year.value);
    setFcrVisualStates('loading', 'Beregner visualiseringer...');

    showStatus('Simulerer frekvens', 'info');
    await new Promise(r => setTimeout(r, 10));

    let workerResult: WorkerPayload;
    try {
      workerResult = await runFcrSimulationInWorker({
        year,
        hours,
        seed,
        profileName,
        config: configValues,
        priceData: priceData.map((row) => ({
          timestamp: new Date(row.timestamp).getTime(),
          price: row.price
        }))
      });
    } catch (err) {
      console.warn('Worker simulation unavailable, falling back to main thread simulation:', err);

      const startTime = new Date(Date.UTC(year, 0, 1));
      showStatus('Simulerer batteri', 'info');
      await new Promise(r => setTimeout(r, 10));

      const localFreqData = FrequencySimulator.simulateFrequency(startTime, hours, 1, seed, profileName);

      showStatus('Beregner inntekt', 'info');
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

    showStatus('Simulering fullført', 'success');

    currentResult = result;
    displayResults(result, true, true);
  } catch (err) {
    console.error('Calculation failed:', err);
    showStatus('Beregning feilet. Prøv igjen.', 'warning');
    setFcrVisualStates('empty', 'Kunne ikke generere visualiseringer.');
  } finally {
    isCalculating = false;
    if (calculateBtn) calculateBtn.disabled = false;
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

async function exportCsv(): Promise<void> {
  if (!currentResult) return;

  const csvContent = Papa.unparse(currentResult.hourlyData.map(row => ({
    tidspunkt: new Date(row.timestamp).toISOString(),
    pris_eur_mw: row.price.toFixed(2),
    tilgjengelig: row.available ? 1 : 0,
    inntekt_eur: row.revenue.toFixed(2),
    soc_start: row.socStart !== null ? row.socStart.toFixed(4) : '',
    soc_slutt: row.socEnd !== null ? row.socEnd.toFixed(4) : ''
  })));

  const year = elements.year.value;
  await window.electronAPI.saveFile(csvContent, `fcr_inntekt_${year}.csv`);
}

async function exportXlsx(): Promise<void> {
  if (!currentResult) return;

  const year = elements.year.value;
  const monthly = aggregateMonthly(currentResult.hourlyData);

  const exportData = {
    hourlyData: currentResult.hourlyData,
    monthly,
    config: {
      powerMw: parseFloat(elements.powerMw.value),
      capacityMwh: parseFloat(elements.capacityMwh.value),
      efficiency: parseInt(elements.efficiency.value),
      socMin: parseInt(elements.socMin.value),
      socMax: parseInt(elements.socMax.value),
      year: parseInt(year),
      totalHours: currentResult.totalHours,
      availableHours: currentResult.availableHours
    }
  };

  await window.electronAPI.saveXlsx(exportData, `fcr_inntekt_${year}.xlsx`);
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

  const result = await window.electronAPI.savePdf(pdfData, `FCR-N_Rapport_${year}.pdf`);
  if (result) {
    showStatus('PDF eksportert!', 'success');
  } else {
    showStatus('PDF-eksport avbrutt', 'warning');
  }
}

function showStatus(message: string, type: string): void {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
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

console.log('[app] Calling init()');
init().then(() => {
  console.log('[app] init() resolved successfully');
}).catch((error) => {
  console.error('[app] init() failed:', error);
});
