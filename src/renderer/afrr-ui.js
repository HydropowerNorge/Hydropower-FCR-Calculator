import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import { calculateAfrrYearlyRevenue } from './afrr.js';

function formatNok(value, digits = 0) {
  if (!Number.isFinite(value)) return 'NOK 0';
  return `NOK ${value.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function createAfrrUI() {
  const charts = {
    monthly: null,
    activation: null,
    cumulative: null,
  };

  const el = {};
  let currentResult = null;
  let isCalculating = false;

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
    container.dataset.state = state || 'ready';
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

  function setTableState(state, message) {
    const table = document.getElementById('afrrSummaryTable');
    if (!table) return;
    const container = table.closest('.table-container');
    if (!container) return;
    setContainerState(container, state, message);
    table.style.opacity = state === 'ready' ? '1' : '0.35';
  }

  function setAllVisualStates(state, message) {
    setChartState('afrrMonthlyChart', state, message);
    setChartState('afrrActivationChart', state, message);
    setChartState('afrrCumulativeChart', state, message);
    setTableState(state, message);
  }

  function showStatus(message, type = 'info') {
    if (!el.statusMessage) return;
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message ${type}`;
  }

  async function timedFetch(label, fetcher) {
    const startedAt = performance.now();
    const result = await fetcher();
    const durationMs = Math.round(performance.now() - startedAt);
    const rowCount = Array.isArray(result) ? result.length : 0;
    console.info(`[aFRR UI] ${label}: ${rowCount} rows fetched in ${durationMs}ms`);
    return result;
  }

  function populateSelect(selectEl, values) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      selectEl.appendChild(option);
    });
  }

  async function loadStaticInputs() {
    const [afrrYearsRaw, solarYearsRaw] = await Promise.all([
      window.electronAPI.getAfrrAvailableYears({
        biddingZone: 'NO1',
        direction: 'down',
        reserveType: 'afrr',
        resolutionMin: 60,
      }),
      window.electronAPI.getSolarAvailableYears(60),
    ]);

    const afrrYears = (Array.isArray(afrrYearsRaw) ? afrrYearsRaw : [])
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year))
      .sort((a, b) => a - b);

    const solarYears = (Array.isArray(solarYearsRaw) ? solarYearsRaw : [])
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year))
      .sort((a, b) => a - b);

    populateSelect(el.year, afrrYears);
    populateSelect(el.solarYear, solarYears);

    if (afrrYears.length > 0) {
      el.year.value = String(afrrYears[afrrYears.length - 1]);
    }
    if (solarYears.length > 0) {
      el.solarYear.value = String(solarYears[solarYears.length - 1]);
    }

    if (el.dataStatus) {
      el.dataStatus.textContent = `aFRR år: ${afrrYears.join(', ') || 'ingen'} | Solprofil: ${solarYears.join(', ') || 'ingen'} | Spot: hentes for valgt aFRR-år`;
    }
  }

  function updateMonthlyChart(monthly) {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      if (charts.monthly) {
        charts.monthly.destroy();
        charts.monthly = null;
      }
      setChartState('afrrMonthlyChart', 'empty', 'Ingen månedlige data.');
      return;
    }

    const ctx = document.getElementById('afrrMonthlyChart').getContext('2d');
    if (charts.monthly) charts.monthly.destroy();

    charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthly.map((m) => m.month),
        datasets: [{
          label: 'Total inntekt (NOK)',
          data: monthly.map((m) => m.totalRevenueNok),
          backgroundColor: '#4fcb73',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (value) => formatNok(Number(value)),
            },
          },
        },
      },
    });
    setChartState('afrrMonthlyChart', 'ready', '');
  }

  function updateActivationChart(hourlyData) {
    const bidRows = (Array.isArray(hourlyData) ? hourlyData : []).filter((row) => row.hasBid);
    if (bidRows.length === 0) {
      if (charts.activation) {
        charts.activation.destroy();
        charts.activation = null;
      }
      setChartState('afrrActivationChart', 'empty', 'Ingen budtimer å vise.');
      return;
    }

    const bins = new Array(10).fill(0);
    bidRows.forEach((row) => {
      const pct = Number(row.activationPct) || 0;
      const index = Math.min(9, Math.max(0, Math.floor(pct / 10)));
      bins[index] += 1;
    });

    const ctx = document.getElementById('afrrActivationChart').getContext('2d');
    if (charts.activation) charts.activation.destroy();

    charts.activation = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['0-10%', '10-20%', '20-30%', '30-40%', '40-50%', '50-60%', '60-70%', '70-80%', '80-90%', '90-100%'],
        datasets: [{
          label: 'Timer',
          data: bins,
          backgroundColor: '#f3c640',
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
    setChartState('afrrActivationChart', 'ready', '');
  }

  function updateCumulativeChart(hourlyData) {
    if (!Array.isArray(hourlyData) || hourlyData.length === 0) {
      if (charts.cumulative) {
        charts.cumulative.destroy();
        charts.cumulative = null;
      }
      setChartState('afrrCumulativeChart', 'empty', 'Ingen tidsserie å vise.');
      return;
    }

    let cumulative = 0;
    const points = hourlyData.map((row) => {
      cumulative += row.totalRevenueNok;
      return cumulative;
    });

    const ctx = document.getElementById('afrrCumulativeChart').getContext('2d');
    if (charts.cumulative) charts.cumulative.destroy();

    charts.cumulative = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hourlyData.map((row) => new Date(row.timestamp).toISOString()),
        datasets: [{
          label: 'Kumulativ inntekt (NOK)',
          data: points,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            ticks: {
              callback: (value) => formatNok(Number(value)),
            },
          },
        },
      },
    });
    setChartState('afrrCumulativeChart', 'ready', '');
  }

  function updateSummaryTable(monthly) {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      el.summaryTable.innerHTML = '';
      setTableState('empty', 'Ingen månedlige rader.');
      return;
    }

    el.summaryTable.innerHTML = monthly.map((row) => `
      <tr>
        <td>${row.month}</td>
        <td>${formatNok(Math.round(row.totalRevenueNok))}</td>
        <td>${formatNok(Math.round(row.afrrRevenueNok))}</td>
        <td>${row.bidHours.toLocaleString('nb-NO')}</td>
        <td>${formatNok(Math.round(row.avgAfrrPriceNokMw))}</td>
      </tr>
    `).join('');

    setTableState('ready', '');
  }

  function displayResults(result) {
    el.totalRevenue.textContent = formatNok(Math.round(result.totalRevenueNok));
    el.afrrRevenue.textContent = formatNok(Math.round(result.totalAfrrRevenueNok));
    el.bidHours.textContent = `${result.bidHours.toLocaleString('nb-NO')} / ${result.totalHours.toLocaleString('nb-NO')}`;
    el.avgPrice.textContent = `${formatNok(Math.round(result.avgAfrrPriceNokMw))}/MW`;

    updateMonthlyChart(result.monthly);
    updateActivationChart(result.hourlyData);
    updateCumulativeChart(result.hourlyData);
    updateSummaryTable(result.monthly);
  }

  async function calculate() {
    if (isCalculating) return;
    isCalculating = true;
    if (el.calculateBtn) el.calculateBtn.disabled = true;

    try {
      const selectedYear = Number(el.year.value);
      const selectedSolarYear = Number(el.solarYear.value);
      if (!Number.isInteger(selectedYear)) {
        showStatus('Velg et gyldig aFRR-år.', 'warning');
        setAllVisualStates('empty', 'Manglende årsvalg.');
        return;
      }
      if (!Number.isInteger(selectedSolarYear)) {
        showStatus('Velg et gyldig år for solprofil.', 'warning');
        setAllVisualStates('empty', 'Manglende solprofil.');
        return;
      }

      const powerMw = Number(document.getElementById('powerMw')?.value || 0);
      const eurToNok = Number(el.eurToNok.value);
      const minBidMw = Number(el.minBidMw.value);
      const activationMaxPct = Number(el.activationMaxPct.value);
      const seed = Number(el.seed.value);

      showStatus('Laster aFRR-, sol- og spotdata for valgt år...', 'info');
      setAllVisualStates('loading', 'Beregner aFRR-inntekt...');
      console.info(`[aFRR UI] Calculation started for aFRR year ${selectedYear}, solar year ${selectedSolarYear}`);

      const [afrrRowsRaw, solarRowsRaw, spotRowsRaw] = await Promise.all([
        timedFetch(`aFRR ${selectedYear}`, () => window.electronAPI.loadAfrrData(selectedYear, {
          biddingZone: 'NO1',
          direction: 'down',
          reserveType: 'afrr',
          resolutionMin: 60,
        })),
        timedFetch(`Solar ${selectedSolarYear}`, () => window.electronAPI.loadSolarData(selectedSolarYear, 60)),
        timedFetch(`Spot NO1 ${selectedYear}`, () => window.electronAPI.loadSpotData('NO1', selectedYear)),
      ]);

      const afrrRows = Array.isArray(afrrRowsRaw) ? afrrRowsRaw : [];
      const solarRows = Array.isArray(solarRowsRaw) ? solarRowsRaw : [];
      const spotRowsForYear = Array.isArray(spotRowsRaw) ? spotRowsRaw : [];

      currentResult = calculateAfrrYearlyRevenue({
        year: selectedYear,
        afrrRows,
        spotRows: spotRowsForYear,
        solarRows,
        powerMw,
        eurToNok,
        minBidMw,
        activationMinPct: 0,
        activationMaxPct,
        seed,
      });

      displayResults(currentResult);
      console.info(`[aFRR UI] Calculation completed for ${selectedYear}`);
      showStatus('aFRR-beregning fullført for hele året.', 'success');
    } catch (error) {
      console.error('aFRR calculation failed:', error);
      showStatus('aFRR-beregning feilet. Se konsoll for detaljer.', 'warning');
      setAllVisualStates('empty', 'Kunne ikke beregne aFRR-resultater.');
    } finally {
      isCalculating = false;
      if (el.calculateBtn) el.calculateBtn.disabled = false;
    }
  }

  async function exportCsv() {
    if (!currentResult) return;

    const csvContent = Papa.unparse(currentResult.hourlyData.map((row) => ({
      timestamp_utc: new Date(row.timestamp).toISOString(),
      solar_production_mw: row.solarProductionMw.toFixed(4),
      bid_volume_mw: row.bidVolumeMw.toFixed(0),
      afrr_price_eur_mw: row.afrrPriceEurMw.toFixed(4),
      spot_price_eur_mwh: row.spotPriceEurMwh.toFixed(4),
      activation_pct: row.activationPct.toFixed(2),
      solar_revenue_nok: row.solarRevenueNok.toFixed(2),
      afrr_revenue_nok: row.afrrRevenueNok.toFixed(2),
      total_revenue_nok: row.totalRevenueNok.toFixed(2),
    })));

    await window.electronAPI.saveFile(csvContent, `afrr_inntekt_${currentResult.year}.csv`);
  }

  async function init() {
    el.statusMessage = document.getElementById('afrrStatusMessage');
    el.totalRevenue = document.getElementById('afrrTotalRevenue');
    el.afrrRevenue = document.getElementById('afrrAfrrRevenue');
    el.bidHours = document.getElementById('afrrBidHours');
    el.avgPrice = document.getElementById('afrrAvgPrice');
    el.summaryTable = document.getElementById('afrrSummaryTable').querySelector('tbody');

    el.year = document.getElementById('afrrYear');
    el.solarYear = document.getElementById('afrrSolarYear');
    el.eurToNok = document.getElementById('afrrEurToNok');
    el.minBidMw = document.getElementById('afrrMinBidMw');
    el.activationMaxPct = document.getElementById('afrrActivationMaxPct');
    el.seed = document.getElementById('afrrSeed');
    el.dataStatus = document.getElementById('afrrDataStatus');
    el.calculateBtn = document.getElementById('calculateAfrrBtn');
    el.exportCsvBtn = document.getElementById('afrrExportCsvBtn');

    setAllVisualStates('loading', 'Laster aFRR-data...');
    await loadStaticInputs();
    setAllVisualStates('empty', 'Trykk "Beregn aFRR".');

    if (el.calculateBtn) {
      el.calculateBtn.addEventListener('click', calculate);
    }
    if (el.exportCsvBtn) {
      el.exportCsvBtn.addEventListener('click', exportCsv);
    }
  }

  return { init };
}
