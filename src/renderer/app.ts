console.log('[app] Renderer script loading');

import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import * as Calculator from './calculator';
import type { FrequencySummary, HourlyRevenueRow, RevenueResult } from './calculator';
import * as FrequencySimulator from './frequency';
import { createAfrrUI } from './afrr-ui';

console.log('[app] Modules imported successfully');
console.log('[app] electronAPI available:', !!window.electronAPI);
console.log('[app] electronAPI methods:', window.electronAPI ? Object.keys(window.electronAPI) : 'N/A');

interface NormalizedNodeTenderRow {
  name: string;
  status?: string;
  gridNode?: string;
  market?: string;
  quantityMw: number;
  reservationPriceNokMwH: number | null;
  activationPriceNokMwH: number | null;
  periodStartTs: number | null;
  periodEndTs: number | null;
  activeDays: string[];
  activeWindows: { start: string; end: string }[];
}

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

let priceData: { timestamp: Date; price: number; hourNumber: number; volume: number }[] = [];
let currentResult: (RevenueResult & { freqSummary?: FrequencySummary }) | null = null;
let nodeTenderRows: NormalizedNodeTenderRow[] = [];
const afrrUI = createAfrrUI();
const charts: {
  monthly: Chart | null;
  price: Chart | null;
  soc: Chart | null;
  freq: Chart | null;
} = {
  monthly: null,
  price: null,
  soc: null,
  freq: null
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
  year: document.getElementById('year') as HTMLSelectElement,
  simHours: document.getElementById('simHours') as HTMLInputElement,
  seed: document.getElementById('seed') as HTMLInputElement,

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

  nodesDataset: document.getElementById('nodesDataset') as HTMLSelectElement | null,
  nodesGridNode: document.getElementById('nodesGridNode') as HTMLSelectElement | null,
  nodesMarket: document.getElementById('nodesMarket') as HTMLSelectElement | null,
  refreshNodesBtn: document.getElementById('refreshNodesBtn') as HTMLButtonElement | null,
  nodesFilterInfo: document.getElementById('nodesFilterInfo'),

  nodesStatusMessage: document.getElementById('nodesStatusMessage'),
  nodesTenderCount: document.getElementById('nodesTenderCount'),
  nodesTotalMw: document.getElementById('nodesTotalMw'),
  nodesAvgReservation: document.getElementById('nodesAvgReservation'),
  nodesAvgActivation: document.getElementById('nodesAvgActivation'),
  nodesTableBody: document.getElementById('nodesTableBody')
};

Chart.defaults.color = '#aaa';
Chart.defaults.borderColor = '#2a2a4a';

let activeSimulationWorker: Worker | null = null;
let isCalculating = false;

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

function setContainerState(container: HTMLElement | null, state: string, message: string) {
  if (!container) return;
  const nextState = state || 'ready';
  container.dataset.state = nextState;
  const stateEl = ensureVisualState(container);
  if (stateEl) {
    stateEl.textContent = message || '';
  }
}

function setChartState(chartId: string, state: string, message: string) {
  const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const container = canvas.closest<HTMLElement>('.chart-container');
  if (!container) return;
  setContainerState(container, state, message);
  canvas.style.opacity = state === 'ready' ? '1' : '0.18';
}

function setTableState(tableId: string, state: string, message: string) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const container = table.closest<HTMLElement>('.table-container');
  if (!container) return;
  setContainerState(container, state, message);
  table.style.opacity = state === 'ready' ? '1' : '0.35';
}

function setFcrVisualStates(state: string, message: string) {
  setChartState('monthlyChart', state, message);
  setChartState('priceChart', state, message);
  setChartState('socChart', state, message);
  setChartState('freqChart', state, message);
  setTableState('summaryTable', state, message);
}

function showNodesStatus(message: string, type = 'info') {
  if (!elements.nodesStatusMessage) return;
  elements.nodesStatusMessage.textContent = message;
  elements.nodesStatusMessage.className = `status-message ${type}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateRange(startTs: number | null, endTs: number | null): string {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return '-';
  const start = new Date(startTs!).toLocaleDateString('nb-NO');
  const end = new Date(endTs!).toLocaleDateString('nb-NO');
  return `${start} - ${end}`;
}

function formatNokValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `NOK ${Math.round(value).toLocaleString('nb-NO')}`;
}

function formatSchedule(activeDays: string[], activeWindows: { start: string; end: string }[]): string {
  const days = Array.isArray(activeDays) && activeDays.length > 0
    ? activeDays.join(', ')
    : 'Ingen dager';
  const windows = Array.isArray(activeWindows) && activeWindows.length > 0
    ? activeWindows
      .map((w) => `${w.start}-${w.end}`)
      .join(', ')
    : 'Ingen vindu';
  return `${days} | ${windows}`;
}

function setSelectOptions(selectElement: HTMLSelectElement | null, values: string[], placeholderLabel = 'Alle', preserveSelection = true) {
  if (!selectElement) return;
  const previousValue = selectElement.value;
  selectElement.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = placeholderLabel;
  selectElement.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });

  if (preserveSelection && previousValue && values.includes(previousValue)) {
    selectElement.value = previousValue;
  }
}

function buildNodeFilterOptionsFromRows(rows: NormalizedNodeTenderRow[]) {
  const gridNodes = new Set<string>();
  const markets = new Set<string>();
  const statuses = new Set<string>();

  rows.forEach((row) => {
    if (row?.gridNode) gridNodes.add(String(row.gridNode));
    if (row?.market) markets.add(String(row.market));
    if (row?.status) statuses.add(String(row.status));
  });

  return {
    gridNodes: Array.from(gridNodes).sort((a, b) => a.localeCompare(b)),
    markets: Array.from(markets).sort((a, b) => a.localeCompare(b)),
    statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b)),
    total: rows.length,
  };
}

function updateNodesMetrics(rows: NormalizedNodeTenderRow[]) {
  const totalTenders = rows.length;
  const totalMw = rows.reduce((sum, row) => sum + (Number(row.quantityMw) || 0), 0);

  const reservationRows = rows.filter((row) => Number.isFinite(row.reservationPriceNokMwH));
  const activationRows = rows.filter((row) => Number.isFinite(row.activationPriceNokMwH));
  const avgReservation = reservationRows.length > 0
    ? reservationRows.reduce((sum, row) => sum + row.reservationPriceNokMwH!, 0) / reservationRows.length
    : null;
  const avgActivation = activationRows.length > 0
    ? activationRows.reduce((sum, row) => sum + row.activationPriceNokMwH!, 0) / activationRows.length
    : null;

  if (elements.nodesTenderCount) {
    elements.nodesTenderCount.textContent = totalTenders.toLocaleString('nb-NO');
  }
  if (elements.nodesTotalMw) {
    elements.nodesTotalMw.textContent = `${totalMw.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} MW`;
  }
  if (elements.nodesAvgReservation) {
    elements.nodesAvgReservation.textContent = formatNokValue(avgReservation);
  }
  if (elements.nodesAvgActivation) {
    elements.nodesAvgActivation.textContent = formatNokValue(avgActivation);
  }
}

function renderNodesTable(rows: NormalizedNodeTenderRow[]) {
  if (!elements.nodesTableBody) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    elements.nodesTableBody.innerHTML = '';
    setTableState('nodesTable', 'empty', 'Ingen nodetenderer for valgt filter.');
    return;
  }

  const sortedRows = [...rows].sort((a, b) => (a.periodStartTs || 0) - (b.periodStartTs || 0));
  elements.nodesTableBody.innerHTML = sortedRows.map((row) => {
    const priceSummary = [
      `Res: ${formatNokValue(row.reservationPriceNokMwH)}`,
      `Akt: ${formatNokValue(row.activationPriceNokMwH)}`,
    ].join('<br>');

    return `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.status || '-')}</td>
        <td>${escapeHtml(row.gridNode || '-')}</td>
        <td>${escapeHtml(row.market || '-')}</td>
        <td>${escapeHtml(formatDateRange(row.periodStartTs, row.periodEndTs))}</td>
        <td>${escapeHtml(formatSchedule(row.activeDays, row.activeWindows))}</td>
        <td class="nodes-price-cell">${priceSummary}</td>
        <td>${escapeHtml((Number(row.quantityMw) || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 }))}</td>
      </tr>
    `;
  }).join('');

  setTableState('nodesTable', 'ready', '');
}

async function loadNodeFilterOptions(dataset: string, keepSelections = true) {
  if (!window.electronAPI?.loadNodeTenders) return;

  let result = {
    gridNodes: [] as string[],
    markets: [] as string[],
    statuses: [] as string[],
    total: 0,
  };

  try {
    const rows = await window.electronAPI.loadNodeTenders({ dataset });
    const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeNodeTenderRow);
    result = buildNodeFilterOptionsFromRows(normalizedRows);
  } catch (error) {
    console.warn('Could not derive node filters from tenders:', error);
  }

  setSelectOptions(elements.nodesGridNode, result.gridNodes, 'Alle', keepSelections);
  setSelectOptions(elements.nodesMarket, result.markets, 'Alle', keepSelections);

  if (elements.nodesFilterInfo) {
    const total = result.total || 0;
    elements.nodesFilterInfo.textContent = `${total.toLocaleString('nb-NO')} tender(er) i datasettet`;
  }
}

function normalizeNodeTenderRow(row: import('../shared/electron-api').NodeTenderRow): NormalizedNodeTenderRow {
  const quantityMw = Number(row?.quantityMw);
  const reservationPriceNokMwH = Number(row?.reservationPriceNokMwH);
  const activationPriceNokMwH = Number(row?.activationPriceNokMwH);
  const periodStartTs = Number(row?.periodStartTs);
  const periodEndTs = Number(row?.periodEndTs);

  return {
    ...row,
    quantityMw: Number.isFinite(quantityMw) ? quantityMw : 0,
    reservationPriceNokMwH: Number.isFinite(reservationPriceNokMwH) ? reservationPriceNokMwH : null,
    activationPriceNokMwH: Number.isFinite(activationPriceNokMwH) ? activationPriceNokMwH : null,
    periodStartTs: Number.isFinite(periodStartTs) ? periodStartTs : null,
    periodEndTs: Number.isFinite(periodEndTs) ? periodEndTs : null,
    activeDays: Array.isArray(row?.activeDays) ? row.activeDays : [],
    activeWindows: Array.isArray(row?.activeWindows) ? row.activeWindows : [],
  };
}

async function loadNodeTenderData() {
  if (!window.electronAPI?.loadNodeTenders) { console.log('[app] loadNodeTenders not available, skipping'); return; }

  const dataset = elements.nodesDataset?.value || 'nodes_2026_pilot';
  const gridNode = elements.nodesGridNode?.value || '';
  const market = elements.nodesMarket?.value || '';

  console.log('[app] Loading node tender data:', { dataset, gridNode, market });
  showNodesStatus('Laster nodetenderer...', 'info');
  setTableState('nodesTable', 'loading', 'Laster nodetenderer...');

  try {
    const rows = await window.electronAPI.loadNodeTenders({
      dataset,
      ...(gridNode ? { gridNode } : {}),
      ...(market ? { market } : {}),
    });

    nodeTenderRows = (Array.isArray(rows) ? rows : []).map(normalizeNodeTenderRow);
    console.log('[app] Node tenders loaded:', nodeTenderRows.length, 'rows');
    updateNodesMetrics(nodeTenderRows);
    renderNodesTable(nodeTenderRows);

    if (nodeTenderRows.length === 0) {
      showNodesStatus('Ingen nodetenderer funnet for valgt filter.', 'warning');
    } else {
      showNodesStatus(`Viser ${nodeTenderRows.length.toLocaleString('nb-NO')} nodetender(er).`, 'success');
    }
  } catch (error) {
    console.error('Failed to load node tenders:', error);
    nodeTenderRows = [];
    updateNodesMetrics(nodeTenderRows);
    renderNodesTable(nodeTenderRows);
    showNodesStatus('Kunne ikke laste nodetenderer fra Convex.', 'warning');
  }
}

async function initializeNodesModule() {
  if (!elements.nodesDataset) return;

  try {
    await loadNodeFilterOptions(elements.nodesDataset.value, false);
    await loadNodeTenderData();
  } catch (error) {
    console.error('Failed to initialize nodes module:', error);
    showNodesStatus('Kunne ikke laste nodetenderer fra Convex.', 'warning');
    setTableState('nodesTable', 'empty', 'Kunne ikke laste data.');
    updateNodesMetrics([]);
  }
}

function setupTabs() {
  const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
  const tabContents = Array.from(document.querySelectorAll<HTMLElement>('.tab-content'));
  const tabConfigs = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-config]'));

  function applyHeroCopy(tab: string) {
    const activeBtn = tabBtns.find(btn => btn.dataset.tab === tab);
    if (!activeBtn) return;

    if (elements.heroTitle && activeBtn.dataset.heroTitle) {
      elements.heroTitle.textContent = activeBtn.dataset.heroTitle;
    }

    if (elements.heroDescription && activeBtn.dataset.heroDescription) {
      elements.heroDescription.textContent = activeBtn.dataset.heroDescription;
    }
  }

  function activateTab(tab: string) {
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

async function init() {
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

  elements.year.innerHTML = '';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    elements.year.appendChild(option);
  });

  if (years.length > 0) {
    const preferredYear = 2025;
    const defaultYear = years.includes(preferredYear)
      ? preferredYear
      : years[years.length - 1];
    elements.year.value = String(defaultYear);
    await loadPriceData(defaultYear);
    setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
  } else {
    elements.loadingState.style.display = 'none';
    elements.resultsContainer.style.display = 'block';
    showStatus('Ingen prisdata funnet i Convex for NO1.', 'warning');
    setFcrVisualStates('empty', 'Ingen data tilgjengelig for visualisering.');
  }

  console.log('[app] Initializing nodes module');
  await initializeNodesModule();
  console.log('[app] Nodes module initialized');

  console.log('[app] init() complete — attaching event listeners');
  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn')!.addEventListener('click', calculate);
  document.getElementById('exportBtn')!.addEventListener('click', exportCsv);
  document.getElementById('exportXlsxBtn')!.addEventListener('click', exportXlsx);
  document.getElementById('exportPdfBtn')!.addEventListener('click', exportPdf);

  if (elements.nodesDataset) {
    elements.nodesDataset.addEventListener('change', async () => {
      try {
        await loadNodeFilterOptions(elements.nodesDataset!.value, false);
        await loadNodeTenderData();
      } catch (error) {
        console.error('Failed to refresh nodes dataset selection:', error);
        showNodesStatus('Kunne ikke laste nodetenderer for valgt datasett.', 'warning');
      }
    });
  }

  if (elements.nodesGridNode) {
    elements.nodesGridNode.addEventListener('change', async () => {
      await loadNodeTenderData();
    });
  }

  if (elements.nodesMarket) {
    elements.nodesMarket.addEventListener('change', async () => {
      await loadNodeTenderData();
    });
  }

  if (elements.refreshNodesBtn) {
    elements.refreshNodesBtn.addEventListener('click', async () => {
      try {
        await loadNodeFilterOptions(elements.nodesDataset?.value || 'nodes_2026_pilot', true);
        await loadNodeTenderData();
      } catch (error) {
        console.error('Failed to refresh node tender data:', error);
        showNodesStatus('Kunne ikke oppdatere nodetenderer.', 'warning');
      }
    });
  }
}

function setupSliders() {
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

async function loadPriceData(year: number) {
  console.log('[app] loadPriceData() called for year:', year);
  elements.loadingState.style.display = 'flex';
  elements.resultsContainer.style.display = 'none';
  setFcrVisualStates('loading', 'Laster prisdata...');

  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
  console.log('[app] Price data received:', rows?.length || 0, 'rows');
  if (!rows || rows.length === 0) {
    elements.loadingState.style.display = 'none';
    elements.resultsContainer.style.display = 'block';
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

  elements.loadingState.style.display = 'none';
  elements.resultsContainer.style.display = 'block';

  showStatus('Prisdata lastet', 'success');
  setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
}

async function calculate() {
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

function displayResults(result: RevenueResult & { freqSummary?: FrequencySummary }, showSoc: boolean, showFreq: boolean) {
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

function updateMonthlyChart(monthly: MonthlyAggregate[]) {
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

function updatePriceChart(hourlyData: HourlyRevenueRow[]) {
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

function updateSocChart(hourlyData: HourlyRevenueRow[]) {
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

function updateFreqChart(summary: FrequencySummary) {
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

function updateSummaryTable(monthly: MonthlyAggregate[]) {
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

async function exportCsv() {
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

async function exportXlsx() {
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

async function exportPdf() {
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

function showStatus(message: string, type: string) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
}

const popoverEl = document.getElementById('popover')!;
let activePopoverBtn: HTMLElement | null = null;

function showPopover(btn: HTMLElement) {
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

function hidePopover() {
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

console.log('[app] Calling init()');
init().then(() => {
  console.log('[app] init() resolved successfully');
}).catch((error) => {
  console.error('[app] init() failed:', error);
});
