import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import { calculateAfrrYearlyRevenue } from './afrr';
import type { AfrrYearlyResult, AfrrMonthlyRow } from './afrr';

function formatEur(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return 'EUR 0';
  return `EUR ${value.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

interface AfrrElements {
  statusMessage: HTMLElement | null;
  afrrRevenue: HTMLElement | null;
  bidHours: HTMLElement | null;
  avgPrice: HTMLElement | null;
  summaryTable: HTMLTableSectionElement | null;
  year: HTMLSelectElement | null;
  minBidMw: HTMLInputElement | null;
  excludeZeroVolume: HTMLInputElement | null;
  limitToMarketVolume: HTMLInputElement | null;
  calculateBtn: HTMLButtonElement | null;
  exportCsvBtn: HTMLButtonElement | null;
}

function normalizeYearList(values: unknown): number[] {
  return (Array.isArray(values) ? values : [])
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);
}

export function createAfrrUI(): { init: () => Promise<void> } {
  const charts: {
    monthly: Chart | null;
  } = {
    monthly: null,
  };

  const el: AfrrElements = {
    statusMessage: null,
    afrrRevenue: null,
    bidHours: null,
    avgPrice: null,
    summaryTable: null,
    year: null,
    minBidMw: null,
    excludeZeroVolume: null,
    limitToMarketVolume: null,
    calculateBtn: null,
    exportCsvBtn: null,
  };

  let currentResult: AfrrYearlyResult | null = null;
  let isCalculating = false;
  let resolvedSolarYear: number | null = null;

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
    container.dataset.state = state || 'ready';
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

  function setTableState(state: string, message: string): void {
    const table = document.getElementById('afrrSummaryTable');
    if (!table) return;
    const container = table.closest<HTMLElement>('.table-container');
    if (!container) return;
    setContainerState(container, state, message);
    table.style.opacity = state === 'ready' ? '1' : '0.35';
  }

  function setAllVisualStates(state: string, message: string): void {
    setChartState('afrrMonthlyChart', state, message);
    setTableState(state, message);
  }

  function showStatus(message: string, type = 'info'): void {
    if (!el.statusMessage) return;
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message ${type}`;
  }

  async function timedFetch<T>(label: string, fetcher: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    const result = await fetcher();
    const durationMs = Math.round(performance.now() - startedAt);
    const rowCount = Array.isArray(result) ? result.length : 0;
    console.info(`[aFRR UI] ${label}: ${rowCount} rows fetched in ${durationMs}ms`);
    return result;
  }

  const INCOMPLETE_YEARS: Record<number, string> = {
    2024: 'Ufullstendige data',
  };

  function populateSelect(selectEl: HTMLSelectElement | null, values: number[]): void {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      const note = INCOMPLETE_YEARS[value];
      if (note) {
        option.textContent = `${value} — ${note}`;
        option.disabled = true;
      } else {
        option.textContent = String(value);
      }
      selectEl.appendChild(option);
    });
  }

  async function loadStaticInputs(): Promise<void> {
    console.log('[afrr-ui] Loading static inputs (aFRR years + solar years)');
    const [afrrYearsRaw, solarYearsRaw] = await Promise.all([
      window.electronAPI.getAfrrAvailableYears({
        biddingZone: 'NO1',
        direction: 'down',
        reserveType: 'afrr',
        resolutionMin: 60,
      }),
      window.electronAPI.getSolarAvailableYears(60),
    ]);

    const afrrYears = normalizeYearList(afrrYearsRaw);
    const solarYears = normalizeYearList(solarYearsRaw);

    console.log('[afrr-ui] aFRR years:', afrrYears, 'Solar years:', solarYears);

    populateSelect(el.year, afrrYears);

    if (afrrYears.length > 0 && el.year) {
      const defaultYear = afrrYears.filter((y) => !INCOMPLETE_YEARS[y]).pop() ?? afrrYears[afrrYears.length - 1];
      el.year.value = String(defaultYear);
    }

    resolvedSolarYear = solarYears.length > 0 ? solarYears[solarYears.length - 1] : null;
  }

  function updateMonthlyChart(monthly: AfrrMonthlyRow[]): void {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      if (charts.monthly) {
        charts.monthly.destroy();
        charts.monthly = null;
      }
      setChartState('afrrMonthlyChart', 'empty', 'Ingen månedlige data.');
      return;
    }

    const ctx = (document.getElementById('afrrMonthlyChart') as HTMLCanvasElement).getContext('2d')!;
    if (charts.monthly) charts.monthly.destroy();

    charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthly.map((m) => m.month),
        datasets: [{
          label: 'aFRR-inntekt (EUR)',
          data: monthly.map((m) => m.afrrIncomeEur),
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
              callback: (value) => formatEur(Number(value)),
            },
          },
        },
      },
    });
    setChartState('afrrMonthlyChart', 'ready', '');
  }


  function updateSummaryTable(monthly: AfrrMonthlyRow[]): void {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      if (el.summaryTable) el.summaryTable.innerHTML = '';
      setTableState('empty', 'Ingen månedlige rader.');
      return;
    }

    if (el.summaryTable) {
      el.summaryTable.innerHTML = monthly.map((row) => `
        <tr>
          <td>${row.month}</td>
          <td>${formatEur(Math.round(row.afrrIncomeEur))}</td>
          <td>${row.bidHours.toLocaleString('nb-NO')}</td>
          <td>${formatEur(Math.round(row.avgAfrrPriceEurMw))}</td>
        </tr>
      `).join('');
    }

    setTableState('ready', '');
  }

  function displayResults(result: AfrrYearlyResult): void {
    if (el.afrrRevenue) el.afrrRevenue.textContent = formatEur(Math.round(result.totalAfrrIncomeEur));
    if (el.bidHours) el.bidHours.textContent = `${result.bidHours.toLocaleString('nb-NO')} / ${result.totalHours.toLocaleString('nb-NO')}`;
    if (el.avgPrice) el.avgPrice.textContent = `${formatEur(Math.round(result.avgAfrrPriceEurMw))}/MW`;

    updateMonthlyChart(result.monthly);
    updateSummaryTable(result.monthly);
  }

  async function calculate(): Promise<void> {
    if (isCalculating) return;
    isCalculating = true;
    if (el.calculateBtn) el.calculateBtn.disabled = true;

    try {
      const selectedYear = Number(el.year?.value);
      if (!Number.isInteger(selectedYear)) {
        showStatus('Velg et gyldig aFRR-år.', 'warning');
        setAllVisualStates('empty', 'Manglende årsvalg.');
        return;
      }
      if (resolvedSolarYear === null) {
        showStatus('Ingen solprofil tilgjengelig.', 'warning');
        setAllVisualStates('empty', 'Manglende solprofil.');
        return;
      }

      const minBidMw = Number(el.minBidMw?.value) || 1;
      const excludeZeroVolume = el.excludeZeroVolume?.checked ?? true;
      const limitToMarketVolume = el.limitToMarketVolume?.checked ?? true;

      showStatus('Laster aFRR-, sol- og spotdata for valgt år...', 'info');
      setAllVisualStates('loading', 'Beregner aFRR-inntekt...');
      console.log(`[afrr-ui] Calculation started: aFRR year=${selectedYear}, solar year=${resolvedSolarYear}, minBidMw=${minBidMw}`);

      const [afrrRowsRaw, solarRowsRaw, spotRowsRaw] = await Promise.all([
        timedFetch(`aFRR ${selectedYear}`, () => window.electronAPI.loadAfrrData(selectedYear, {
          biddingZone: 'NO1',
          direction: 'down',
          reserveType: 'afrr',
          resolutionMin: 60,
        })),
        timedFetch(`Solar ${resolvedSolarYear}`, () => window.electronAPI.loadSolarData(resolvedSolarYear!, 60)),
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
        direction: 'down',
        minBidMw,
        excludeZeroVolume,
        limitToMarketVolume,
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

  async function exportCsv(): Promise<void> {
    if (!currentResult) return;

    const csvContent = Papa.unparse(currentResult.hourlyData.map((row) => ({
      timestamp_utc: new Date(row.timestamp).toISOString(),
      solar_production_mw: row.solarProductionMw.toFixed(4),
      afrr_capacity_mw: row.afrrCapacityMw.toFixed(0),
      afrr_price_eur_mw: row.afrrPriceEurMw.toFixed(4),
      spot_price_eur_mwh: row.spotPriceEurMwh.toFixed(4),
      activated_capacity_mw: row.activatedCapacityMw.toFixed(4),
      market_volume_mw: row.marketVolumeMw.toFixed(4),
      spot_income_eur: row.spotIncomeEur.toFixed(2),
      afrr_income_eur: row.afrrIncomeEur.toFixed(2),
      activation_cost_eur: row.activationCostEur.toFixed(2),
      total_income_eur: row.totalIncomeEur.toFixed(2),
    })));

    await window.electronAPI.saveFile(csvContent, `afrr_inntekt_${currentResult.year}.csv`);
  }

  async function init(): Promise<void> {
    console.log('[afrr-ui] init() starting');
    el.statusMessage = document.getElementById('afrrStatusMessage');
    el.afrrRevenue = document.getElementById('afrrRevenue');
    el.bidHours = document.getElementById('afrrBidHours');
    el.avgPrice = document.getElementById('afrrAvgPrice');
    el.summaryTable = document.getElementById('afrrSummaryTable')?.querySelector('tbody') ?? null;

    el.year = document.getElementById('afrrYear') as HTMLSelectElement | null;
    el.minBidMw = document.getElementById('afrrMinBidMw') as HTMLInputElement | null;
    el.excludeZeroVolume = document.getElementById('afrrExcludeZeroVolume') as HTMLInputElement | null;
    el.limitToMarketVolume = document.getElementById('afrrLimitToMarketVolume') as HTMLInputElement | null;
    el.calculateBtn = document.getElementById('calculateAfrrBtn') as HTMLButtonElement | null;
    el.exportCsvBtn = document.getElementById('afrrExportCsvBtn') as HTMLButtonElement | null;

    setAllVisualStates('loading', 'Laster aFRR-data...');
    await loadStaticInputs();
    setAllVisualStates('empty', 'Trykk "Beregn aFRR".');
    console.log('[afrr-ui] init() complete');

    if (el.calculateBtn) {
      el.calculateBtn.addEventListener('click', calculate);
    }
    if (el.exportCsvBtn) {
      el.exportCsvBtn.addEventListener('click', exportCsv);
    }
  }

  return { init };
}
