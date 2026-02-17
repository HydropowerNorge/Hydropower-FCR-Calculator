import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import * as Calculator from './calculator.js';
import * as FrequencySimulator from './frequency.js';
import { createAfrrUI } from './afrr-ui.js';

let priceData = [];
let currentResult = null;
let nodeTenderRows = [];
const afrrUI = createAfrrUI();
let charts = {
  monthly: null,
  price: null,
  soc: null,
  freq: null
};

const elements = {
  powerMw: document.getElementById('powerMw'),
  capacityMwh: document.getElementById('capacityMwh'),
  efficiency: document.getElementById('efficiency'),
  efficiencyValue: document.getElementById('efficiencyValue'),
  socMin: document.getElementById('socMin'),
  socMinValue: document.getElementById('socMinValue'),
  socMax: document.getElementById('socMax'),
  socMaxValue: document.getElementById('socMaxValue'),
  year: document.getElementById('year'),
  simHours: document.getElementById('simHours'),
  seed: document.getElementById('seed'),

  loadingState: document.getElementById('loadingState'),
  resultsContainer: document.getElementById('resultsContainer'),
  statusMessage: document.getElementById('statusMessage'),
  totalRevenue: document.getElementById('totalRevenue'),
  availableHours: document.getElementById('availableHours'),
  availability: document.getElementById('availability'),
  avgPrice: document.getElementById('avgPrice'),
  annualizedNote: document.getElementById('annualizedNote'),
  heroTitle: document.getElementById('heroTitle'),
  heroDescription: document.getElementById('heroDescription'),
  socSection: document.getElementById('socSection'),
  freqSection: document.getElementById('freqSection'),
  summaryTable: document.getElementById('summaryTable').querySelector('tbody'),

  nodesDataset: document.getElementById('nodesDataset'),
  nodesGridNode: document.getElementById('nodesGridNode'),
  nodesMarket: document.getElementById('nodesMarket'),
  refreshNodesBtn: document.getElementById('refreshNodesBtn'),
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

let activeSimulationWorker = null;
let isCalculating = false;

async function runFcrSimulationInWorker(payload) {
  if (typeof Worker === 'undefined') {
    throw new Error('Worker API is not available');
  }

  if (activeSimulationWorker) {
    activeSimulationWorker.terminate();
    activeSimulationWorker = null;
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' });
    activeSimulationWorker = worker;

    const cleanup = () => {
      if (activeSimulationWorker === worker) {
        activeSimulationWorker = null;
      }
      worker.terminate();
    };

    worker.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'progress') {
        showStatus(message.message, 'info');
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

    worker.addEventListener('error', (event) => {
      cleanup();
      reject(new Error(event.message || 'Simulation worker crashed'));
    });

    worker.postMessage({
      type: 'simulate-fcr',
      payload
    });
  });
}

function ensureVisualState(container) {
  if (!container) return null;
  let stateEl = container.querySelector('.visual-state');
  if (!stateEl) {
    stateEl = document.createElement('div');
    stateEl.className = 'visual-state';
    container.appendChild(stateEl);
  }
  return stateEl;
}

function setContainerState(container, state, message) {
  if (!container) return;
  const nextState = state || 'ready';
  container.dataset.state = nextState;
  const stateEl = ensureVisualState(container);
  if (stateEl) {
    stateEl.textContent = message || '';
  }
}

function setChartState(chartId, state, message) {
  const canvas = document.getElementById(chartId);
  if (!canvas) return;
  const container = canvas.closest('.chart-container');
  if (!container) return;
  setContainerState(container, state, message);
  canvas.style.opacity = state === 'ready' ? '1' : '0.18';
}

function setTableState(tableId, state, message) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const container = table.closest('.table-container');
  if (!container) return;
  setContainerState(container, state, message);
  table.style.opacity = state === 'ready' ? '1' : '0.35';
}

function setFcrVisualStates(state, message) {
  setChartState('monthlyChart', state, message);
  setChartState('priceChart', state, message);
  setChartState('socChart', state, message);
  setChartState('freqChart', state, message);
  setTableState('summaryTable', state, message);
}

function showNodesStatus(message, type = 'info') {
  if (!elements.nodesStatusMessage) return;
  elements.nodesStatusMessage.textContent = message;
  elements.nodesStatusMessage.className = `status-message ${type}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateRange(startTs, endTs) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return '-';
  const start = new Date(startTs).toLocaleDateString('nb-NO');
  const end = new Date(endTs).toLocaleDateString('nb-NO');
  return `${start} - ${end}`;
}

function formatNokValue(value) {
  if (!Number.isFinite(value)) return '-';
  return `NOK ${Math.round(value).toLocaleString('nb-NO')}`;
}

function formatSchedule(activeDays, activeWindows) {
  const days = Array.isArray(activeDays) && activeDays.length > 0
    ? activeDays.join(', ')
    : 'Ingen dager';
  const windows = Array.isArray(activeWindows) && activeWindows.length > 0
    ? activeWindows
      .map((window) => `${window.start}-${window.end}`)
      .join(', ')
    : 'Ingen vindu';
  return `${days} | ${windows}`;
}

function setSelectOptions(selectElement, values, placeholderLabel = 'Alle', preserveSelection = true) {
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

function buildNodeFilterOptionsFromRows(rows) {
  const gridNodes = new Set();
  const markets = new Set();
  const statuses = new Set();

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

function updateNodesMetrics(rows) {
  const totalTenders = rows.length;
  const totalMw = rows.reduce((sum, row) => sum + (Number(row.quantityMw) || 0), 0);

  const reservationRows = rows.filter((row) => Number.isFinite(row.reservationPriceNokMwH));
  const activationRows = rows.filter((row) => Number.isFinite(row.activationPriceNokMwH));
  const avgReservation = reservationRows.length > 0
    ? reservationRows.reduce((sum, row) => sum + row.reservationPriceNokMwH, 0) / reservationRows.length
    : null;
  const avgActivation = activationRows.length > 0
    ? activationRows.reduce((sum, row) => sum + row.activationPriceNokMwH, 0) / activationRows.length
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

function renderNodesTable(rows) {
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

async function loadNodeFilterOptions(dataset, keepSelections = true) {
  if (!window.electronAPI?.loadNodeTenders) return;

  let result = {
    gridNodes: [],
    markets: [],
    statuses: [],
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

function normalizeNodeTenderRow(row) {
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
  if (!window.electronAPI?.loadNodeTenders) return;

  const dataset = elements.nodesDataset?.value || 'nodes_2026_pilot';
  const gridNode = elements.nodesGridNode?.value || '';
  const market = elements.nodesMarket?.value || '';

  showNodesStatus('Laster nodetenderer...', 'info');
  setTableState('nodesTable', 'loading', 'Laster nodetenderer...');

  try {
    const rows = await window.electronAPI.loadNodeTenders({
      dataset,
      ...(gridNode ? { gridNode } : {}),
      ...(market ? { market } : {}),
    });

    nodeTenderRows = (Array.isArray(rows) ? rows : []).map(normalizeNodeTenderRow);
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
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  const tabContents = Array.from(document.querySelectorAll('.tab-content'));
  const tabConfigs = Array.from(document.querySelectorAll('[data-tab-config]'));

  function applyHeroCopy(tab) {
    const activeBtn = tabBtns.find(btn => btn.dataset.tab === tab);
    if (!activeBtn) return;

    if (elements.heroTitle && activeBtn.dataset.heroTitle) {
      elements.heroTitle.textContent = activeBtn.dataset.heroTitle;
    }

    if (elements.heroDescription && activeBtn.dataset.heroDescription) {
      elements.heroDescription.textContent = activeBtn.dataset.heroDescription;
    }
  }

  function activateTab(tab) {
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
      activateTab(btn.dataset.tab);
    });

    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + tabBtns.length) % tabBtns.length;
      const nextBtn = tabBtns[nextIndex];
      if (!nextBtn) return;
      nextBtn.focus();
      activateTab(nextBtn.dataset.tab);
    });
  });

  const initialTab = tabBtns.find(btn => btn.classList.contains('active'))?.dataset.tab
    || tabBtns[0]?.dataset.tab;
  if (initialTab) {
    activateTab(initialTab);
  }
}

async function init() {
  setupTabs();
  await afrrUI.init();
  setFcrVisualStates('loading', 'Laster visualiseringer...');
  setupSliders();

  const years = (await window.electronAPI.getAvailableYears('NO1'))
    .map(y => Number(y))
    .filter(y => Number.isFinite(y))
    .sort((a, b) => a - b);

  elements.year.innerHTML = '';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    elements.year.appendChild(option);
  });

  if (years.length > 0) {
    const preferredYear = 2025;
    const defaultYear = years.includes(preferredYear)
      ? preferredYear
      : years[years.length - 1];
    elements.year.value = defaultYear;
    await loadPriceData(defaultYear);
    setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
  } else {
    elements.loadingState.style.display = 'none';
    elements.resultsContainer.style.display = 'block';
    showStatus('Ingen prisdata funnet i Convex for NO1.', 'warning');
    setFcrVisualStates('empty', 'Ingen data tilgjengelig for visualisering.');
  }

  await initializeNodesModule();

  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn').addEventListener('click', calculate);
  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  document.getElementById('exportXlsxBtn').addEventListener('click', exportXlsx);
  document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

  if (elements.nodesDataset) {
    elements.nodesDataset.addEventListener('change', async () => {
      try {
        await loadNodeFilterOptions(elements.nodesDataset.value, false);
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

async function loadPriceData(year) {
  elements.loadingState.style.display = 'flex';
  elements.resultsContainer.style.display = 'none';
  setFcrVisualStates('loading', 'Laster prisdata...');

  const rows = await window.electronAPI.loadPriceData(year, 'NO1');
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
    .sort((a, b) => a.timestamp - b.timestamp);

  elements.loadingState.style.display = 'none';
  elements.resultsContainer.style.display = 'block';

  showStatus('Prisdata lastet', 'success');
  setFcrVisualStates('empty', 'Trykk "Beregn inntekt" for å vise visualiseringer.');
}

async function calculate() {
  if (isCalculating) return;
  isCalculating = true;
  const calculateBtn = document.getElementById('calculateBtn');
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

    const profileName = document.querySelector('input[name="profile"]').value;
    const hours = parseInt(elements.simHours.value);
    const seed = parseInt(elements.seed.value);
    const year = parseInt(elements.year.value);
    setFcrVisualStates('loading', 'Beregner visualiseringer...');

    showStatus('Simulerer frekvens', 'info');
    await new Promise(r => setTimeout(r, 10));

    let workerResult;
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

    const result = workerResult.result;
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

function displayResults(result, showSoc, showFreq) {
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

function aggregateMonthly(hourlyData) {
  const byMonth = new Map();

  for (const row of hourlyData) {
    const date = new Date(row.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { revenue: 0, hours: 0, priceSum: 0 });
    }

    const m = byMonth.get(monthKey);
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

function updateMonthlyChart(monthly) {
  if (!Array.isArray(monthly) || monthly.length === 0) {
    if (charts.monthly) {
      charts.monthly.destroy();
      charts.monthly = null;
    }
    setChartState('monthlyChart', 'empty', 'Ingen månedlige data å vise.');
    return;
  }

  const ctx = document.getElementById('monthlyChart').getContext('2d');
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
            callback: v => `€${v.toLocaleString()}`
          }
        }
      }
    }
  });
  setChartState('monthlyChart', 'ready', '');
}

function updatePriceChart(hourlyData) {
  const prices = hourlyData.map(h => h.price);
  if (prices.length === 0) {
    if (charts.price) {
      charts.price.destroy();
      charts.price = null;
    }
    setChartState('priceChart', 'empty', 'Ingen prisdata å vise.');
    return;
  }

  const ctx = document.getElementById('priceChart').getContext('2d');
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binCount = 50;
  const bins = new Array(binCount).fill(0);
  let labels = [];

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

function updateSocChart(hourlyData) {
  const dataWithSoc = hourlyData.filter(h => h.socStart !== null);
  if (dataWithSoc.length === 0) {
    if (charts.soc) {
      charts.soc.destroy();
      charts.soc = null;
    }
    setChartState('socChart', 'empty', 'Ingen SOC-data å vise.');
    return;
  }

  const ctx = document.getElementById('socChart').getContext('2d');
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
          data: dataWithSoc.map(h => h.socStart * 100),
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

function updateFreqChart(summary) {
  if (!summary || !Array.isArray(summary.histogramLabels) || !Array.isArray(summary.histogram) || summary.histogram.length === 0) {
    if (charts.freq) {
      charts.freq.destroy();
      charts.freq = null;
    }
    setChartState('freqChart', 'empty', 'Ingen frekvensdata å vise.');
    return;
  }

  const ctx = document.getElementById('freqChart').getContext('2d');
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

function updateSummaryTable(monthly) {
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
      totalRevenue: elements.totalRevenue.textContent,
      availableHours: elements.availableHours.textContent,
      availability: elements.availability.textContent,
      avgPrice: elements.avgPrice.textContent
    }
  };

  const result = await window.electronAPI.savePdf(pdfData, `FCR-N_Rapport_${year}.pdf`);
  if (result) {
    showStatus('PDF eksportert!', 'success');
  } else {
    showStatus('PDF-eksport avbrutt', 'warning');
  }
}

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
}

const popoverEl = document.getElementById('popover');
let activePopoverBtn = null;

function showPopover(btn) {
  const helpId = 'help-' + btn.dataset.help;
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

  let top;
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

document.querySelectorAll('.info-btn').forEach(btn => {
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
  if (activePopoverBtn && !popoverEl.contains(e.target) && !e.target.classList.contains('info-btn')) {
    hidePopover();
  }
});

window.addEventListener('scroll', hidePopover, true);
window.addEventListener('resize', hidePopover);

init();
