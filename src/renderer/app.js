// App state
let priceData = [];
let freqData = null;
let currentResult = null;
let charts = {
  monthly: null,
  price: null,
  soc: null,
  freq: null
};

// DOM elements
const elements = {
  // Inputs
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

  // Results
  loadingState: document.getElementById('loadingState'),
  resultsContainer: document.getElementById('resultsContainer'),
  statusMessage: document.getElementById('statusMessage'),
  totalRevenue: document.getElementById('totalRevenue'),
  availableHours: document.getElementById('availableHours'),
  availability: document.getElementById('availability'),
  avgPrice: document.getElementById('avgPrice'),
  annualizedNote: document.getElementById('annualizedNote'),
  socSection: document.getElementById('socSection'),
  freqSection: document.getElementById('freqSection'),
  summaryTable: document.getElementById('summaryTable').querySelector('tbody')
};

// Chart.js default colors
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
    const worker = new Worker('simulation-worker.js');
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

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabConfigs = document.querySelectorAll('[data-tab-config]');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update active button
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle main content
      tabContents.forEach(c => c.classList.remove('active'));
      const targetContent = document.getElementById(tab === 'fcr' ? 'fcrContent' : 'arbitrageContent');
      if (targetContent) targetContent.classList.add('active');

      // Toggle sidebar config sections
      tabConfigs.forEach(c => {
        c.style.display = c.dataset.tabConfig === tab ? '' : 'none';
      });
    });
  });
}

// Initialize app
async function init() {
  // Set up tabs
  setupTabs();
  ArbitrageUI.init();
  setFcrVisualStates('loading', 'Laster visualiseringer...');

  // Set up slider value displays
  setupSliders();

  // Load available years
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

  // Prefer 2025 as default year
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

  // Event listeners
  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn').addEventListener('click', calculate);
  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  document.getElementById('exportXlsxBtn').addEventListener('click', exportXlsx);
  document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
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

      const startTime = new Date(Date.UTC(year, 0, 1)); // Jan 1st
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
    const summary = workerResult.summary;
    freqData = { summary };

    showStatus('Simulering fullført', 'success');

    currentResult = result;
    currentResult.freqSummary = summary;
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

  // Hide annualized note - we always simulate full year now
  elements.annualizedNote.style.display = 'none';

  // Monthly aggregation
  const monthly = aggregateMonthly(result.hourlyData);
  updateMonthlyChart(monthly);
  updateSummaryTable(monthly);

  // Price histogram
  updatePriceChart(result.hourlyData);

  // SOC chart
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

  // Frequency chart
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
  // Create histogram bins
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

  // Mark 49.9 and 50.1 Hz bins - green for normal band, red for outside
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

  // Capture chart images as base64 PNG
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

// Info button toggle
document.querySelectorAll('.info-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const helpId = 'help-' + btn.dataset.help;
    const helpEl = document.getElementById(helpId);
    if (helpEl) {
      helpEl.classList.toggle('visible');
    }
  });
});

// Start app
init();
