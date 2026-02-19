import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import { calculateAfrrYearlyRevenue } from './afrr';
import type { AfrrYearlyResult, AfrrMonthlyRow } from './afrr';
import { showStatusMessage } from './status-message';
import { buildExcelFileBytes } from './excel-export';
import { roundValuesToTarget } from './rounding';
import { logInfo, logError } from './logger';

const MONTH_NAMES_NB_FULL = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
const HIDDEN_YEARS = new Set<number>([2021, 2026]);

function formatEur(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return 'EUR 0';
  return `EUR ${value.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
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

interface AfrrElements {
  statusMessage: HTMLElement | null;
  afrrRevenue: HTMLElement | null;
  bidHours: HTMLElement | null;
  avgPrice: HTMLElement | null;
  summaryTable: HTMLTableSectionElement | null;
  year: HTMLSelectElement | null;
  yearLoadingIndicator: HTMLElement | null;
  calculateBtn: HTMLButtonElement | null;
  exportCsvBtn: HTMLButtonElement | null;
}

interface AfrrUIOptions {
  onStateChange?: () => void;
}

function normalizeYearList(values: unknown): number[] {
  return (Array.isArray(values) ? values : [])
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);
}

export function createAfrrUI(options: AfrrUIOptions = {}): {
  init: () => Promise<void>;
  exportCsv: () => Promise<void>;
  exportExcel: () => Promise<void>;
  hasResult: () => boolean;
} {
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
    yearLoadingIndicator: null,
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
    showStatusMessage(el.statusMessage, message, type);
  }

  async function timedFetch<T>(label: string, fetcher: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    const result = await fetcher();
    const durationMs = Math.round(performance.now() - startedAt);
    return result;
  }

  const INCOMPLETE_YEARS: Record<number, string> = {};

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

  function setYearLoadingState(isLoading: boolean): void {
    if (el.year) {
      el.year.disabled = isLoading;
    }
    if (el.yearLoadingIndicator) {
      el.yearLoadingIndicator.hidden = !isLoading;
    }
  }

  async function loadStaticInputs(): Promise<void> {
    const [afrrYearsRaw, solarYearsRaw] = await Promise.all([
      window.electronAPI.getAfrrAvailableYears({
        biddingZone: 'NO1',
        direction: 'down',
        reserveType: 'afrr',
        resolutionMin: 60,
      }),
      window.electronAPI.getSolarAvailableYears(60),
    ]);

    const afrrYears = normalizeYearList(afrrYearsRaw)
      .filter((year) => !HIDDEN_YEARS.has(year));
    const solarYears = normalizeYearList(solarYearsRaw);

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

      const minBidMw = 1;
      // 2022/2023 have market volume data; 2025 uses contracted data without volume info
      const hasMarketVolume = selectedYear <= 2023;
      const excludeZeroVolume = hasMarketVolume;
      const limitToMarketVolume = hasMarketVolume;

      showStatus('Laster aFRR-, sol- og spotdata for valgt år...', 'info');
      setAllVisualStates('loading', 'Beregner aFRR-inntekt...');
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
      logInfo('afrr', 'data_loaded', { year: selectedYear, afrrRows: afrrRows.length, solarRows: solarRows.length, spotRows: spotRowsForYear.length });

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
      options.onStateChange?.();
      logInfo('afrr', 'calc_finish', { year: selectedYear, totalIncomeEur: currentResult.totalIncomeEur });
      showStatus('aFRR-beregning fullført for hele året.', 'success');
    } catch (error) {
      logError('afrr', 'calc_failed', { error: error instanceof Error ? error.message : String(error) });
      showStatus('aFRR-beregning feilet.', 'warning');
      setAllVisualStates('empty', 'Kunne ikke beregne aFRR-resultater.');
    } finally {
      isCalculating = false;
      if (el.calculateBtn) el.calculateBtn.disabled = false;
      options.onStateChange?.();
    }
  }

  interface AfrrExportRow {
    month: string;
    totalHours: number;
    bidHours: number;
    avgAfrrPriceEurMw: number;
    afrrCapacityIncomeEur: number;
    totalIncomeEur: number;
  }

  function buildAfrrExportRows(result: AfrrYearlyResult): AfrrExportRow[] {
    const sortedRows = result.monthly
      .slice()
      .sort((a, b) => a.month.localeCompare(b.month));

    return sortedRows.map((row) => ({
      month: formatYearMonthLabelNb(row.month),
      totalHours: row.hours,
      bidHours: row.bidHours,
      avgAfrrPriceEurMw: row.avgAfrrPriceEurMw,
      afrrCapacityIncomeEur: row.afrrIncomeEur,
      totalIncomeEur: row.totalIncomeEur,
    }));
  }

  async function exportCsv(): Promise<void> {
    if (!currentResult) return;
    const result = currentResult;
    const monthlyRows = buildAfrrExportRows(result);
    const roundedCapacityIncome = roundValuesToTarget(
      monthlyRows.map((row) => row.afrrCapacityIncomeEur),
      result.totalAfrrIncomeEur,
    );
    const roundedTotalIncome = roundValuesToTarget(
      monthlyRows.map((row) => row.totalIncomeEur),
      result.totalIncomeEur,
    );

    const exportRows = monthlyRows.map((row, index) => ({
      'Måned': row.month,
      'Timer totalt': row.totalHours,
      'Budtimer': row.bidHours,
      'Snitt aFRR-pris (EUR/MW)': Math.round(row.avgAfrrPriceEurMw),
      'aFRR kapasitetsinntekt (EUR)': roundedCapacityIncome[index],
      'Sum inntekt (EUR)': roundedTotalIncome[index],
    }));

    const csvContent = Papa.unparse(exportRows);
    await window.electronAPI.saveFile(csvContent, `afrr_inntekt_${result.year}.csv`);
  }

  async function exportExcel(): Promise<void> {
    if (!currentResult) return;
    const result = currentResult;
    const monthlyRows = buildAfrrExportRows(result);
    const roundedCapacityIncome = roundValuesToTarget(
      monthlyRows.map((row) => row.afrrCapacityIncomeEur),
      result.totalAfrrIncomeEur,
    );
    const roundedTotalIncome = roundValuesToTarget(
      monthlyRows.map((row) => row.totalIncomeEur),
      result.totalIncomeEur,
    );

    const excelRows = monthlyRows.map((row, index) => ({
      'Måned': row.month,
      'Timer totalt': row.totalHours,
      'Budtimer': row.bidHours,
      'Snitt aFRR-pris (EUR/MW)': Math.round(row.avgAfrrPriceEurMw),
      'aFRR kapasitetsinntekt (EUR)': roundedCapacityIncome[index],
      'Sum inntekt (EUR)': roundedTotalIncome[index],
    }));

    const excelBytes = buildExcelFileBytes(excelRows, `aFRR ${result.year}`);
    await window.electronAPI.saveExcel(excelBytes, `afrr_inntekt_${result.year}.xlsx`);
  }

  async function init(): Promise<void> {
    el.statusMessage = document.getElementById('afrrStatusMessage');
    el.afrrRevenue = document.getElementById('afrrRevenue');
    el.bidHours = document.getElementById('afrrBidHours');
    el.avgPrice = document.getElementById('afrrAvgPrice');
    el.summaryTable = document.getElementById('afrrSummaryTable')?.querySelector('tbody') ?? null;

    el.year = document.getElementById('afrrYear') as HTMLSelectElement | null;
    el.yearLoadingIndicator = document.getElementById('afrrYearLoadingIndicator');
    el.calculateBtn = document.getElementById('calculateAfrrBtn') as HTMLButtonElement | null;
    el.exportCsvBtn = document.getElementById('afrrExportCsvBtn') as HTMLButtonElement | null;

    setAllVisualStates('loading', 'Laster aFRR-data...');
    setYearLoadingState(true);
    let staticInputsLoaded = false;
    try {
      await loadStaticInputs();
      staticInputsLoaded = true;
    } catch (error) {
      logError('afrr', 'init_load_failed', { error: error instanceof Error ? error.message : String(error) });
      showStatus('Kunne ikke laste årsliste for aFRR.', 'warning');
      setAllVisualStates('empty', 'Ingen aFRR-data tilgjengelig.');
    } finally {
      setYearLoadingState(false);
    }
    if (!staticInputsLoaded) {
      options.onStateChange?.();
      return;
    }

    if (!el.year || el.year.options.length === 0) {
      showStatus('Ingen aFRR-år tilgjengelig.', 'warning');
      setAllVisualStates('empty', 'Ingen aFRR-data tilgjengelig.');
    } else if (resolvedSolarYear === null) {
      showStatus('Ingen solprofil tilgjengelig.', 'warning');
      setAllVisualStates('empty', 'Manglende solprofil.');
    } else {
      showStatus('Klar. Velg år og trykk "Beregn aFRR".', 'info');
      setAllVisualStates('empty', 'Trykk "Beregn aFRR".');
    }
    if (el.calculateBtn) {
      el.calculateBtn.addEventListener('click', calculate);
    }
    if (el.exportCsvBtn) {
      el.exportCsvBtn.addEventListener('click', exportCsv);
    }
    options.onStateChange?.();
  }

  return {
    init,
    exportCsv,
    exportExcel,
    hasResult: () => currentResult !== null,
  };
}
