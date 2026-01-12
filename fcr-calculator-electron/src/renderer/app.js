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

// Initialize app
async function init() {
  // Set up slider value displays
  setupSliders();

  // Load available years
  const years = await window.electronAPI.getAvailableYears();
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    elements.year.appendChild(option);
  });

  // Select latest year
  if (years.length > 0) {
    elements.year.value = years[years.length - 1];
    await loadPriceData(years[years.length - 1]);
  }

  // Event listeners
  elements.year.addEventListener('change', async () => {
    await loadPriceData(parseInt(elements.year.value));
  });

  document.getElementById('calculateBtn').addEventListener('click', calculate);
  document.getElementById('exportBtn').addEventListener('click', exportData);
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

  const csvText = await window.electronAPI.loadPriceFile(year);
  if (!csvText) {
    showStatus(`Prisfil ikke funnet for ${year}`, 'warning');
    return;
  }

  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  // Filter for NO1 area and parse
  priceData = parsed.data
    .filter(row => row.Area === 'NO1')
    .map(row => ({
      timestamp: parseTimestamp(row['Time(Local)']),
      hourNumber: parseInt(row.Hournumber),
      price: parseFloat(row['FCR-N Price EUR/MW']) || 0,
      volume: parseFloat(row['FCR-N Volume MW']) || 0
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  elements.loadingState.style.display = 'none';
  elements.resultsContainer.style.display = 'block';

  showStatus(`Lastet ${priceData.length.toLocaleString()} timer med prisdata for ${year}`, 'success');
}

function parseTimestamp(str) {
  // Format: "01.01.2024 00:00:00 +01:00"
  const parts = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)\s+([+-]\d+):(\d+)/);
  if (!parts) return new Date(str);

  const [, day, month, year, hour, min, sec, tzHour, tzMin] = parts;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour) - parseInt(tzHour),
    parseInt(min) - parseInt(tzMin),
    parseInt(sec)
  ));
  return date;
}

async function calculate() {
  const config = new Calculator.BatteryConfig(
    parseFloat(elements.powerMw.value),
    parseFloat(elements.capacityMwh.value),
    parseInt(elements.efficiency.value) / 100,
    parseInt(elements.socMin.value) / 100,
    parseInt(elements.socMax.value) / 100
  );

  const profileName = document.querySelector('input[name="profile"]').value;
  const hours = parseInt(elements.simHours.value);
  const seed = parseInt(elements.seed.value);
  const year = parseInt(elements.year.value);

  // Generate frequency data
  const startTime = new Date(Date.UTC(year, 0, 1)); // Jan 1st
  const totalSamples = hours * 3600;

  console.log('[Calc] ═══════════════════════════════════════');
  console.log(`[Calc] Battery: ${config.powerMw} MW / ${config.capacityMwh} MWh (${config.capacityMwh/config.powerMw}h duration)`);
  console.log(`[Calc] Efficiency: ${(config.efficiency * 100).toFixed(0)}%, SOC limits: ${(config.socMin * 100).toFixed(0)}%-${(config.socMax * 100).toFixed(0)}%`);
  console.log(`[Calc] Simulation: ${hours} hours, seed=${seed}, profile=${profileName}`);
  console.log('[Calc] ═══════════════════════════════════════');
  showStatus(`Simulerer ${hours} timer med frekvensdata (${totalSamples.toLocaleString()} samples)...`, 'info');
  await new Promise(r => setTimeout(r, 10)); // Allow UI to update

  console.time('frequencySimulation');
  freqData = FrequencySimulator.simulateFrequency(startTime, hours, 1, seed, profileName);
  console.timeEnd('frequencySimulation');
  console.log(`[Calc] Generated ${freqData.frequencies.length} frequency samples`);

  showStatus('Simulerer batteri-SOC...', 'info');
  await new Promise(r => setTimeout(r, 10));

  // Simulate SOC
  console.log('[Calc] Starting SOC simulation...');
  console.time('socSimulation');
  const socData = Calculator.simulateSocHourly(freqData, config);
  console.timeEnd('socSimulation');
  console.log(`[Calc] SOC simulation done, ${socData.length} hours`);

  showStatus('Beregner inntekt...', 'info');
  await new Promise(r => setTimeout(r, 10));

  console.log('[Calc] Calculating revenue...');
  console.time('revenueCalc');
  const result = Calculator.calculateRevenue(priceData, socData, config);
  console.timeEnd('revenueCalc');

  // Summary is now computed during frequency generation (memory efficient)
  const summary = freqData.summary;

  // Log results
  console.log('[Results] ═══════════════════════════════════════');
  console.log(`[Results] Total Revenue: €${result.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
  console.log(`[Results] Available Hours: ${result.availableHours} / ${result.totalHours} (${result.availabilityPct.toFixed(1)}%)`);
  console.log(`[Results] Avg Price: €${result.avgPrice.toFixed(2)}/MW`);
  console.log(`[Results] Frequency: ${summary.pctOutsideBand.toFixed(2)}% outside band (${summary.pctUnder.toFixed(2)}% under, ${summary.pctOver.toFixed(2)}% over)`);
  console.log('[Results] ═══════════════════════════════════════');
  showStatus(
    `Simulert ${freqData.frequencies.length.toLocaleString()} samples | ` +
    `${summary.pctOutsideBand.toFixed(2)}% utenfor båndet`,
    'success'
  );

  currentResult = result;
  currentResult.freqSummary = summary;
  displayResults(result, true, true);
}

function displayResults(result, showSoc, showFreq) {
  console.log('[Display] Updating UI...');
  // Update metrics
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
      showStatus(`⚠️ ${unavailableHours} timer utilgjengelig pga. SOC-grenser`, 'warning');
    }
  }

  // Frequency chart
  elements.freqSection.style.display = showFreq ? 'block' : 'none';
  if (showFreq && result.freqSummary) {
    updateFreqChart(result.freqSummary);
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
}

function updatePriceChart(hourlyData) {
  const ctx = document.getElementById('priceChart').getContext('2d');

  // Create histogram bins
  const prices = hourlyData.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binCount = 50;
  const binWidth = (max - min) / binCount;

  const bins = new Array(binCount).fill(0);
  for (const price of prices) {
    const binIndex = Math.min(Math.floor((price - min) / binWidth), binCount - 1);
    bins[binIndex]++;
  }

  const labels = bins.map((_, i) => (min + i * binWidth + binWidth / 2).toFixed(0));

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
}

function updateSocChart(hourlyData) {
  const ctx = document.getElementById('socChart').getContext('2d');

  const dataWithSoc = hourlyData.filter(h => h.socStart !== null);
  if (dataWithSoc.length === 0) return;

  if (charts.soc) charts.soc.destroy();

  const socMin = parseInt(elements.socMin.value);
  const socMax = parseInt(elements.socMax.value);

  charts.soc = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataWithSoc.map(h => new Date(h.timestamp).toLocaleString()),
      datasets: [{
        label: 'SOC (%)',
        data: dataWithSoc.map(h => h.socStart * 100),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        fill: true,
        tension: 0.2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            minLine: {
              type: 'line',
              yMin: socMin,
              yMax: socMin,
              borderColor: '#e94560',
              borderDash: [5, 5]
            },
            maxLine: {
              type: 'line',
              yMin: socMax,
              yMax: socMax,
              borderColor: '#e94560',
              borderDash: [5, 5]
            }
          }
        }
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
}

function updateFreqChart(summary) {
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
}

function updateSummaryTable(monthly) {
  elements.summaryTable.innerHTML = monthly.map(m => `
    <tr>
      <td>${m.month}</td>
      <td>€${m.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
      <td>${m.hours}</td>
      <td>€${m.avgPrice.toFixed(0)}</td>
    </tr>
  `).join('');
}

async function exportData() {
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

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
}

// Start app
init();
