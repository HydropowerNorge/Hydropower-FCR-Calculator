// Arbitrage UI orchestration module
window.ArbitrageUI = (function () {
  let allSpotData = null; // Full parsed dataset
  let currentResult = null;
  let isCalculating = false;
  let charts = { monthly: null, daily: null, profile: null, cumulative: null };

  const el = {};

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

  function setSummaryTableState(state, message) {
    const table = document.getElementById('arbSummaryTable');
    if (!table) return;
    const container = table.closest('.table-container');
    if (!container) return;
    setContainerState(container, state, message);
    table.style.opacity = state === 'ready' ? '1' : '0.35';
  }

  function setAllVisualStates(state, message) {
    setChartState('arbMonthlyChart', state, message);
    setChartState('arbDailyChart', state, message);
    setChartState('arbProfileChart', state, message);
    setChartState('arbCumulativeChart', state, message);
    setSummaryTableState(state, message);
  }

  async function init() {
    // Cache DOM elements
    el.statusMessage = document.getElementById('arbStatusMessage');
    el.totalRevenue = document.getElementById('arbTotalRevenue');
    el.avgDaily = document.getElementById('arbAvgDaily');
    el.cycles = document.getElementById('arbCycles');
    el.duration = document.getElementById('arbDuration');
    el.summaryTable = document.getElementById('arbSummaryTable').querySelector('tbody');
    el.spotPeriod = document.getElementById('spotPeriod');
    el.spotFileStatus = document.getElementById('spotFileStatus');
    setAllVisualStates('loading', 'Laster spotdata...');

    // Load spot data on init
    await loadSpotData();

    // Event listeners
    document.getElementById('calculateArbitrageBtn').addEventListener('click', calculate);
    document.getElementById('arbExportCsvBtn').addEventListener('click', exportCsv);
    document.getElementById('arbExportXlsxBtn').addEventListener('click', exportXlsx);
    document.getElementById('arbExportPdfBtn').addEventListener('click', exportPdf);
  }

  async function loadSpotData() {
    const rows = await window.electronAPI.loadSpotData('NO1');
    if (!rows || rows.length === 0) {
      el.spotFileStatus.textContent = 'Ingen spotprisdata funnet';
      setAllVisualStates('empty', 'Ingen spotprisdata tilgjengelig.');
      return;
    }

    allSpotData = rows
      .map(row => ({
        timestamp: new Date(row.timestamp),
        spotPrice: Number(row.spotPriceEurMwh) || 0
      }))
      .filter(row => !Number.isNaN(row.timestamp.getTime()))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (allSpotData.length > 0) {
      const first = allSpotData[0].timestamp.toLocaleDateString('nb-NO');
      const last = allSpotData[allSpotData.length - 1].timestamp.toLocaleDateString('nb-NO');
      el.spotFileStatus.textContent = `${allSpotData.length} timer (${first} – ${last})`;
      setAllVisualStates('empty', 'Trykk "Beregn arbitrasje" for å vise visualiseringer.');
    }
  }

  function calculate() {
    if (isCalculating) return;
    isCalculating = true;
    const calcButton = document.getElementById('calculateArbitrageBtn');
    if (calcButton) calcButton.disabled = true;

    try {
      if (!allSpotData || allSpotData.length === 0) {
        showStatus('Ingen spotprisdata tilgjengelig', 'warning');
        setAllVisualStates('empty', 'Ingen spotprisdata tilgjengelig.');
        return;
      }

      const months = parseInt(el.spotPeriod.value);
      const spotData = Arbitrage.filterByPeriod(allSpotData, months);

      if (spotData.length === 0) {
        showStatus('Ingen data for valgt periode', 'warning');
        setAllVisualStates('empty', 'Ingen data for valgt periode.');
        return;
      }

      const powerMw = parseFloat(document.getElementById('powerMw').value);
      const capacityMwh = parseFloat(document.getElementById('capacityMwh').value);
      const efficiency = parseInt(document.getElementById('efficiency').value) / 100;
      const socMin = parseInt(document.getElementById('socMin').value) / 100;
      const socMax = parseInt(document.getElementById('socMax').value) / 100;

      showStatus('Simulerer arbitrasje', 'info');
      setAllVisualStates('loading', 'Beregner visualiseringer...');

      currentResult = Arbitrage.calculateArbitrage(spotData, powerMw, capacityMwh, efficiency, socMin, socMax);

      displayResults(currentResult);
      showStatus('Arbitrasje beregnet', 'success');
    } catch (err) {
      console.error('Arbitrage calculation failed:', err);
      showStatus('Beregning feilet. Prøv igjen.', 'warning');
      setAllVisualStates('empty', 'Kunne ikke generere visualiseringer.');
    } finally {
      isCalculating = false;
      if (calcButton) calcButton.disabled = false;
    }
  }

  function displayResults(result) {
    el.totalRevenue.textContent = `€${Math.round(result.totalRevenue).toLocaleString('nb-NO')}`;
    el.avgDaily.textContent = `€${Math.round(result.avgDailyRevenue).toLocaleString('nb-NO')}`;
    el.cycles.textContent = result.totalCycles.toLocaleString();
    el.duration.textContent = result.duration.toFixed(1);

    updateMonthlyChart(result.monthly);
    updateDailyChart(result.dailyResults);
    updateProfileChart(result.hourlyProfile);
    updateCumulativeChart(result.dailyResults);
    updateSummaryTable(result.monthly);
  }

  function updateMonthlyChart(monthly) {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      if (charts.monthly) {
        charts.monthly.destroy();
        charts.monthly = null;
      }
      setChartState('arbMonthlyChart', 'empty', 'Ingen månedlige data å vise.');
      return;
    }

    const ctx = document.getElementById('arbMonthlyChart').getContext('2d');
    if (charts.monthly) charts.monthly.destroy();

    charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthly.map(m => m.month),
        datasets: [{
          label: 'Inntekt (EUR)',
          data: monthly.map(m => m.revenue),
          backgroundColor: '#60a5fa',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => `€${v.toLocaleString()}` }
          }
        }
      }
    });
    setChartState('arbMonthlyChart', 'ready', '');
  }

  function updateDailyChart(dailyResults) {
    if (!Array.isArray(dailyResults) || dailyResults.length === 0) {
      if (charts.daily) {
        charts.daily.destroy();
        charts.daily = null;
      }
      setChartState('arbDailyChart', 'empty', 'Ingen daglige resultater å vise.');
      return;
    }

    const ctx = document.getElementById('arbDailyChart').getContext('2d');
    if (charts.daily) charts.daily.destroy();

    charts.daily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyResults.map(d => d.date),
        datasets: [{
          label: 'Daglig profitt (EUR)',
          data: dailyResults.map(d => d.revenue),
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            ticks: { callback: v => `€${v.toLocaleString()}` }
          }
        }
      }
    });
    setChartState('arbDailyChart', 'ready', '');
  }

  function updateProfileChart(hourlyProfile) {
    if (!Array.isArray(hourlyProfile) || hourlyProfile.length === 0) {
      if (charts.profile) {
        charts.profile.destroy();
        charts.profile = null;
      }
      setChartState('arbProfileChart', 'empty', 'Ingen profil-data å vise.');
      return;
    }

    const ctx = document.getElementById('arbProfileChart').getContext('2d');
    if (charts.profile) charts.profile.destroy();

    const labels = hourlyProfile.map(h => `${String(h.hour).padStart(2, '0')}:00`);
    const prices = hourlyProfile.map(h => h.avgPrice);
    const chargeFreq = hourlyProfile.map(h => h.chargeFrequency);
    const dischargeFreq = hourlyProfile.map(h => h.dischargeFrequency);

    charts.profile = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Snittpris (EUR/MWh)',
            data: prices,
            borderColor: '#fbbf24',
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#fbbf24',
            yAxisID: 'y',
            order: 0
          },
          {
            type: 'bar',
            label: 'Lading',
            data: chargeFreq.map(v => v * 100),
            backgroundColor: 'rgba(74, 222, 128, 0.5)',
            borderRadius: 2,
            yAxisID: 'y1',
            order: 1
          },
          {
            type: 'bar',
            label: 'Utlading',
            data: dischargeFreq.map(v => v * 100),
            backgroundColor: 'rgba(233, 69, 96, 0.5)',
            borderRadius: 2,
            yAxisID: 'y1',
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { boxWidth: 12 } }
        },
        scales: {
          y: {
            position: 'left',
            title: { display: true, text: 'EUR/MWh' },
            ticks: { callback: v => `€${v}` }
          },
          y1: {
            position: 'right',
            title: { display: true, text: '% av dager' },
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: { callback: v => `${v}%` }
          }
        }
      }
    });
    setChartState('arbProfileChart', 'ready', '');
  }

  function updateCumulativeChart(dailyResults) {
    if (!Array.isArray(dailyResults) || dailyResults.length === 0) {
      if (charts.cumulative) {
        charts.cumulative.destroy();
        charts.cumulative = null;
      }
      setChartState('arbCumulativeChart', 'empty', 'Ingen kumulative data å vise.');
      return;
    }

    const ctx = document.getElementById('arbCumulativeChart').getContext('2d');
    if (charts.cumulative) charts.cumulative.destroy();

    let cumSum = 0;
    const cumData = dailyResults.map(d => {
      cumSum += d.revenue;
      return cumSum;
    });

    charts.cumulative = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyResults.map(d => d.date),
        datasets: [{
          label: 'Kumulativ inntekt (EUR)',
          data: cumData,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            beginAtZero: true,
            ticks: { callback: v => `€${v.toLocaleString()}` }
          }
        }
      }
    });
    setChartState('arbCumulativeChart', 'ready', '');
  }

  function updateSummaryTable(monthly) {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      el.summaryTable.innerHTML = '';
      setSummaryTableState('empty', 'Ingen rader å vise.');
      return;
    }

    el.summaryTable.innerHTML = monthly.map(m => `
      <tr>
        <td>${m.month}</td>
        <td>€${Math.round(m.revenue).toLocaleString('nb-NO')}</td>
        <td>${m.days}</td>
        <td>€${Math.round(m.avgDailyRevenue).toLocaleString('nb-NO')}</td>
      </tr>
    `).join('');
    setSummaryTableState('ready', '');
  }

  async function exportCsv() {
    if (!currentResult) return;

    const csvContent = Papa.unparse(currentResult.dailyResults.map(row => ({
      dato: row.date,
      inntekt_eur: row.revenue.toFixed(2),
      ladekostnad_eur: row.chargeCost.toFixed(2),
      utladeinntekt_eur: row.dischargeRevenue.toFixed(2),
      snittpris_eur_mwh: row.avgPrice.toFixed(2),
      spread_eur: row.spread.toFixed(2)
    })));

    await window.electronAPI.saveFile(csvContent, 'arbitrasje_daglig.csv');
  }

  async function exportXlsx() {
    if (!currentResult) return;

    const powerMw = parseFloat(document.getElementById('powerMw').value);
    const capacityMwh = parseFloat(document.getElementById('capacityMwh').value);
    const efficiency = parseInt(document.getElementById('efficiency').value);
    const socMin = parseInt(document.getElementById('socMin').value);
    const socMax = parseInt(document.getElementById('socMax').value);

    const exportData = {
      hourlyData: currentResult.dailyResults.map(d => ({
        timestamp: d.date,
        price: d.avgPrice,
        available: true,
        revenue: d.revenue,
        socStart: null,
        socEnd: null
      })),
      monthly: currentResult.monthly.map(m => ({
        month: m.month,
        revenue: m.revenue,
        hours: m.days,
        avgPrice: m.avgDailyRevenue
      })),
      config: {
        powerMw,
        capacityMwh,
        efficiency,
        socMin,
        socMax,
        year: `Siste ${el.spotPeriod.value} mnd`,
        totalHours: currentResult.totalDays,
        availableHours: currentResult.totalDays
      }
    };

    await window.electronAPI.saveXlsx(exportData, 'arbitrasje_rapport.xlsx');
  }

  async function exportPdf() {
    if (!currentResult) return;

    showStatus('Genererer PDF...', 'info');

    const chartImages = {
      monthly: charts.monthly ? charts.monthly.toBase64Image() : null,
      price: charts.daily ? charts.daily.toBase64Image() : null,
      soc: charts.profile ? charts.profile.toBase64Image() : null,
      freq: charts.cumulative ? charts.cumulative.toBase64Image() : null
    };

    const powerMw = parseFloat(document.getElementById('powerMw').value);
    const capacityMwh = parseFloat(document.getElementById('capacityMwh').value);
    const efficiency = parseInt(document.getElementById('efficiency').value) / 100;
    const socMin = parseInt(document.getElementById('socMin').value) / 100;
    const socMax = parseInt(document.getElementById('socMax').value) / 100;
    const months = parseInt(el.spotPeriod.value);

    // Compute financial summary for page 2
    const revenues = currentResult.dailyResults.map(d => d.revenue);
    const bestMonth = currentResult.monthly.reduce((best, m) => m.revenue > best.revenue ? m : best, currentResult.monthly[0]);
    const worstMonth = currentResult.monthly.reduce((worst, m) => m.revenue < worst.revenue ? m : worst, currentResult.monthly[0]);

    // Expected monthly: average of last 2 complete months (most recent real performance)
    const completeMonths = currentResult.monthly.filter(m => m.days >= 25);
    const recentMonths = completeMonths.slice(-2);
    const expectedMonthly = recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.revenue, 0) / recentMonths.length
      : currentResult.monthly[currentResult.monthly.length - 1]?.revenue || 0;

    // Yearly estimate: full theoretical potential (no skips, no ramp, 100% capture)
    const spotData = Arbitrage.filterByPeriod(allSpotData, months);
    const fullResult = Arbitrage.calculateFullPotential(spotData, powerMw, capacityMwh, efficiency, socMin, socMax);
    const expectedYearly = fullResult.totalDays > 0 ? (fullResult.totalRevenue / fullResult.totalDays) * 365 : 0;

    const revenuePerMw = currentResult.totalRevenue / powerMw;
    const expectedYearlyPerMw = expectedYearly / powerMw;
    const positiveDays = revenues.filter(r => r > 0).length;
    const negativeDays = revenues.filter(r => r <= 0).length;
    const maxDailyRevenue = Math.max(...revenues);
    const minDailyRevenue = Math.min(...revenues);
    const medianRevenue = [...revenues].sort((a, b) => a - b)[Math.floor(revenues.length / 2)] || 0;

    const pdfData = {
      chartImages,
      monthly: currentResult.monthly.map(m => ({
        month: m.month,
        revenue: m.revenue,
        hours: m.days,
        avgPrice: m.avgDailyRevenue,
        chargeCost: m.chargeCost,
        dischargeRevenue: m.dischargeRevenue
      })),
      config: {
        reportType: 'arbitrage',
        powerMw,
        capacityMwh,
        efficiency: Math.round(efficiency * 100),
        socMin: Math.round(socMin * 100),
        socMax: Math.round(socMax * 100),
        year: `Siste ${months} mnd`
      },
      metrics: {
        totalRevenue: el.totalRevenue.textContent,
        availableHours: `${currentResult.totalDays} dager`,
        availability: `${currentResult.totalCycles} sykluser`,
        avgPrice: el.avgDaily.textContent + '/dag'
      },
      financials: {
        totalRevenue: currentResult.totalRevenue,
        totalChargeCost: currentResult.totalChargeCost,
        totalDischargeRevenue: currentResult.totalDischargeRevenue,
        totalDays: currentResult.totalDays,
        expectedMonthly,
        expectedYearly,
        revenuePerMw,
        expectedYearlyPerMw,
        avgDailyRevenue: currentResult.avgDailyRevenue,
        medianDailyRevenue: medianRevenue,
        maxDailyRevenue,
        minDailyRevenue,
        positiveDays,
        negativeDays,
        bestMonth: bestMonth ? bestMonth.month : '-',
        bestMonthRevenue: bestMonth ? bestMonth.revenue : 0,
        worstMonth: worstMonth ? worstMonth.month : '-',
        worstMonthRevenue: worstMonth ? worstMonth.revenue : 0,
        duration: currentResult.duration,
        months
      }
    };

    const result = await window.electronAPI.savePdf(pdfData, 'Arbitrasje_Rapport.pdf');
    if (result) {
      showStatus('PDF eksportert!', 'success');
    } else {
      showStatus('PDF-eksport avbrutt', 'warning');
    }
  }

  function showStatus(message, type) {
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message ${type}`;
  }

  return { init };
})();
