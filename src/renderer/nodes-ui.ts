import Papa from 'papaparse';
import { calculateNodeHourlyIncome, calculateNodeYearlyIncome } from './nodes';
import type { NodeYearlyResult } from './nodes';
import type { NodeTenderRow } from '../shared/electron-api';
import { showStatusMessage } from './status-message';
import { buildExcelFileBytes } from './excel-export';
import { withExportTimestamp } from './export-filename';
import { EXPORT_RESOLUTION_FILENAME_SUFFIX } from './export-resolution';
import type { ExportResolution } from './export-resolution';
import { roundValuesToTarget } from './rounding';
import { logInfo, logError } from './logger';

interface NodesElements {
  statusMessage: HTMLElement | null;
  totalIncome: HTMLElement | null;
  eligibleHours: HTMLElement | null;
  priceNokMwH: HTMLElement | null;
  tenderSummary: HTMLElement | null;
  tenderName: HTMLElement | null;
  tenderMarket: HTMLElement | null;
  tenderPeriod: HTMLElement | null;
  tenderSchedule: HTMLElement | null;
  tenderPrice: HTMLElement | null;
  tenderVolume: HTMLElement | null;
  tenderHours: HTMLElement | null;
  summaryTable: HTMLTableSectionElement | null;
  tenderSelect: HTMLSelectElement | null;
  calculateBtn: HTMLButtonElement | null;
  exportCsvBtn: HTMLButtonElement | null;
}

interface NodesUIOptions {
  onStateChange?: () => void;
}

const DAY_LABELS: Record<string, string> = {
  Monday: 'Man',
  Tuesday: 'Tir',
  Wednesday: 'Ons',
  Thursday: 'Tor',
  Friday: 'Fre',
  Saturday: 'Lør',
  Sunday: 'Søn',
};

const MONTH_SEQUENCE: Array<{ key: string; label: string }> = [
  { key: 'Jan', label: 'Januar' },
  { key: 'Feb', label: 'Februar' },
  { key: 'Mar', label: 'Mars' },
  { key: 'Apr', label: 'April' },
  { key: 'Mai', label: 'Mai' },
  { key: 'Jun', label: 'Juni' },
  { key: 'Jul', label: 'Juli' },
  { key: 'Aug', label: 'August' },
  { key: 'Sep', label: 'September' },
  { key: 'Okt', label: 'Oktober' },
  { key: 'Nov', label: 'November' },
  { key: 'Des', label: 'Desember' },
];

function formatNok(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return 'NOK 0';
  return `NOK ${value.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatMw(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${value.toLocaleString('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} MW`;
}

function normalizeTimestamp(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 1_000_000_000_000 ? Math.round(numeric * 1000) : Math.round(numeric);
}

function getTenderYearSuffix(tender: NodeTenderRow | null): string {
  const startTs = normalizeTimestamp(tender?.periodStartTs);
  const endTs = normalizeTimestamp(tender?.periodEndTs);
  if (!startTs || !endTs || startTs >= endTs) return 'ukjent_aar';

  const startYear = new Date(startTs).getUTCFullYear();
  const endYear = new Date(endTs - 1).getUTCFullYear();

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return 'ukjent_aar';
  return startYear === endYear ? String(startYear) : `${startYear}_${endYear}`;
}

function formatDateTime(ts: number | null): string {
  if (!ts) return 'Ikke oppgitt';
  return new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

function formatDays(activeDays: string[]): string {
  if (activeDays.length === 0) return 'Alle dager';
  const weekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (weekday.every((day) => activeDays.includes(day)) && activeDays.length === 5) {
    return 'Mandag-fredag';
  }
  if (activeDays.length === 7) {
    return 'Alle dager';
  }
  return activeDays
    .map((day) => DAY_LABELS[day] || day)
    .join(', ');
}

function formatWindows(activeWindows: { start: string; end: string }[]): string {
  if (activeWindows.length === 0) return 'Hele døgnet';
  return activeWindows
    .map((window) => `${window.start}-${window.end}`)
    .join(', ');
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

const OSLO_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const OSLO_HOUR_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

function getFormattedPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value || '';
}

function toOsloDayKey(timestamp: number): string {
  const parts = OSLO_DAY_FORMATTER.formatToParts(new Date(timestamp));
  const year = getFormattedPart(parts, 'year');
  const month = getFormattedPart(parts, 'month');
  const day = getFormattedPart(parts, 'day');
  return `${year}-${month}-${day}`;
}

function toOsloHourKey(timestamp: number): string {
  const parts = OSLO_HOUR_FORMATTER.formatToParts(new Date(timestamp));
  const year = getFormattedPart(parts, 'year');
  const month = getFormattedPart(parts, 'month');
  const day = getFormattedPart(parts, 'day');
  const rawHour = Number(getFormattedPart(parts, 'hour'));
  const hour = Number.isFinite(rawHour) ? (rawHour === 24 ? 0 : rawHour) : 0;
  return `${year}-${month}-${day} ${String(hour).padStart(2, '0')}:00`;
}

function estimateTenderHours(tender: NodeTenderRow): { eligible: number; total: number } {
  const periodStartTs = normalizeTimestamp(tender.periodStartTs);
  const periodEndTs = normalizeTimestamp(tender.periodEndTs);
  if (!periodStartTs || !periodEndTs || periodStartTs >= periodEndTs) {
    return { eligible: 0, total: 0 };
  }

  let totalHours = 0;
  for (let ts = periodStartTs; ts < periodEndTs; ts += 3_600_000) {
    totalHours += 1;
  }

  try {
    const preview = calculateNodeYearlyIncome({
      reservationPriceNokMwH: 1,
      quantityMw: 1,
      periodStartTs,
      periodEndTs,
      activeDays: Array.isArray(tender.activeDays) ? tender.activeDays : [],
      activeWindows: Array.isArray(tender.activeWindows) ? tender.activeWindows : [],
    });
    return {
      eligible: preview.totalEligibleHours,
      total: totalHours,
    };
  } catch {
    return { eligible: 0, total: totalHours };
  }
}

export function createNodesUI(options: NodesUIOptions = {}): {
  init: () => Promise<void>;
  exportCsv: (resolution?: ExportResolution) => Promise<void>;
  exportExcel: (resolution?: ExportResolution) => Promise<void>;
  hasResult: () => boolean;
} {
  const el: NodesElements = {
    statusMessage: null,
    totalIncome: null,
    eligibleHours: null,
    priceNokMwH: null,
    tenderSummary: null,
    tenderName: null,
    tenderMarket: null,
    tenderPeriod: null,
    tenderSchedule: null,
    tenderPrice: null,
    tenderVolume: null,
    tenderHours: null,
    summaryTable: null,
    tenderSelect: null,
    calculateBtn: null,
    exportCsvBtn: null,
  };

  let currentResult: NodeYearlyResult | null = null;
  let resultTender: NodeTenderRow | null = null;
  let isCalculating = false;
  let allTenders: NodeTenderRow[] = [];

  function getSelectedTender(): NodeTenderRow | null {
    if (!el.tenderSelect) return null;
    const selectedIndex = Number(el.tenderSelect.value);
    return allTenders[selectedIndex] || null;
  }

  function renderTenderInfo(tender: NodeTenderRow | null): void {
    if (!tender) {
      if (el.tenderSummary) el.tenderSummary.textContent = 'Velg en tender for å se vilkår, volum og estimert inntekt.';
      if (el.tenderName) el.tenderName.textContent = '-';
      if (el.tenderMarket) el.tenderMarket.textContent = '-';
      if (el.tenderPeriod) el.tenderPeriod.textContent = '-';
      if (el.tenderSchedule) el.tenderSchedule.textContent = '-';
      if (el.tenderPrice) el.tenderPrice.textContent = '-';
      if (el.tenderVolume) el.tenderVolume.textContent = '-';
      if (el.tenderHours) el.tenderHours.textContent = '-';
      return;
    }

    const periodStartTs = normalizeTimestamp(tender.periodStartTs);
    const periodEndTs = normalizeTimestamp(tender.periodEndTs);
    const activeDays = Array.isArray(tender.activeDays) ? tender.activeDays : [];
    const activeWindows = Array.isArray(tender.activeWindows) ? tender.activeWindows : [];
    const marketText = [tender.market, tender.gridNode].filter(Boolean).join(' / ') || 'Ikke oppgitt';
    const reservationPrice = Number(tender.reservationPriceNokMwH);
    const activationPrice = Number(tender.activationPriceNokMwH);
    const tenderMw = Number(tender.quantityMw);
    const powerMwInput = document.getElementById('powerMw') as HTMLInputElement | null;
    const batteryMw = Number(powerMwInput?.value);
    const hours = estimateTenderHours(tender);

    if (el.tenderName) {
      el.tenderName.textContent = tender.name || 'Uten navn';
    }
    if (el.tenderMarket) {
      el.tenderMarket.textContent = marketText;
    }
    if (el.tenderPeriod) {
      el.tenderPeriod.textContent = `${formatDateTime(periodStartTs)} til ${formatDateTime(periodEndTs)}`;
    }
    if (el.tenderSchedule) {
      el.tenderSchedule.textContent = `${formatDays(activeDays)}, ${formatWindows(activeWindows)}`;
    }
    if (el.tenderPrice) {
      const reservationText = Number.isFinite(reservationPrice) && reservationPrice > 0
        ? `Reservasjonspris: ${formatNok(reservationPrice)}/MW/h`
        : 'Reservasjonspris: ikke oppgitt';
      const activationText = Number.isFinite(activationPrice) && activationPrice > 0
        ? ` | Aktiveringspris: ${formatNok(activationPrice)}/MW/h`
        : '';
      el.tenderPrice.textContent = `${reservationText}${activationText}`;
    }
    if (el.tenderVolume) {
      el.tenderVolume.textContent = `Tilbudt volum: ${formatMw(tenderMw)} | Brukt i kalkyle: ${formatMw(batteryMw)}`;
    }
    if (el.tenderHours) {
      el.tenderHours.textContent = hours.total > 0
        ? `${hours.eligible.toLocaleString('nb-NO')} av ${hours.total.toLocaleString('nb-NO')} timer`
        : 'Ikke beregnbart';
    }

    if (el.tenderSummary) {
      const summaryPrefix = hours.total > 0
        ? `${hours.eligible.toLocaleString('nb-NO')} av ${hours.total.toLocaleString('nb-NO')} timer kvalifiserer.`
        : 'Timer beregnes fra periode, dager og tidsvinduer.';
      el.tenderSummary.textContent = `${summaryPrefix} Estimat: reservasjonspris × volum × kvalifiserte timer.`;
    }
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
    container.dataset.state = state || 'ready';
    const stateEl = ensureVisualState(container);
    if (stateEl) {
      stateEl.textContent = message || '';
    }
  }

  function setTableState(state: string, message: string): void {
    const table = document.getElementById('nodesTable');
    if (!table) return;
    const container = table.closest<HTMLElement>('.table-container');
    if (!container) return;
    setContainerState(container, state, message);
    table.style.opacity = state === 'ready' ? '1' : '0.35';
  }

  function showStatus(message: string, type = 'info'): void {
    showStatusMessage(el.statusMessage, message, type);
  }

  function populateTenderSelect(): void {
    if (!el.tenderSelect) return;
    el.tenderSelect.innerHTML = '';

    if (allTenders.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Ingen tendere tilgjengelig';
      el.tenderSelect.appendChild(option);
      return;
    }

    const selectEl = el.tenderSelect;
    allTenders.forEach((tender, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = tender.name || `Tender ${index + 1}`;
      selectEl.appendChild(option);
    });
  }

  function displayResults(result: NodeYearlyResult): void {
    if (el.totalIncome) el.totalIncome.textContent = formatNok(Math.round(result.totalIncomeNok));
    if (el.eligibleHours) el.eligibleHours.textContent = result.totalEligibleHours.toLocaleString('nb-NO');
    if (el.priceNokMwH) el.priceNokMwH.textContent = formatNok(result.priceNokMwH);

    updateSummaryTable(result.monthly);
  }

  function updateSummaryTable(monthly: NodeYearlyResult['monthly']): void {
    if (!Array.isArray(monthly) || monthly.length === 0) {
      if (el.summaryTable) el.summaryTable.innerHTML = '';
      setTableState('empty', 'Ingen månedlige rader.');
      return;
    }

    if (el.summaryTable) {
      el.summaryTable.innerHTML = monthly.map((row) => `
        <tr>
          <td>${row.month}</td>
          <td>${row.eligibleHours.toLocaleString('nb-NO')}</td>
          <td>${formatNok(Math.round(row.incomeNok))}</td>
        </tr>
      `).join('');
    }

    setTableState('ready', '');
  }

  function calculate(): void {
    if (isCalculating) return;
    const tender = getSelectedTender();
    if (!tender) {
      showStatus('Velg en tender fra listen.', 'warning');
      return;
    }

    const reservationPrice = Number(tender.reservationPriceNokMwH);
    const powerMwInput = document.getElementById('powerMw') as HTMLInputElement | null;
    const quantityMw = parseFloat(powerMwInput?.value || '0');
    const periodStartTs = normalizeTimestamp(tender.periodStartTs);
    const periodEndTs = normalizeTimestamp(tender.periodEndTs);

    if (!Number.isFinite(reservationPrice) || reservationPrice <= 0) {
      showStatus('Valgt tender mangler reservasjonspris.', 'warning');
      return;
    }
    if (!Number.isFinite(quantityMw) || quantityMw <= 0) {
      showStatus('Valgt tender mangler MW-mengde.', 'warning');
      return;
    }
    if (!periodStartTs || !periodEndTs || periodStartTs >= periodEndTs) {
      showStatus('Valgt tender har ugyldig periode.', 'warning');
      return;
    }

    isCalculating = true;
    if (el.calculateBtn) el.calculateBtn.disabled = true;
    setTableState('loading', 'Beregner inntekt...');
    showStatus('Beregner inntekt...', 'info');

    try {
      currentResult = calculateNodeYearlyIncome({
        reservationPriceNokMwH: reservationPrice,
        quantityMw,
        periodStartTs,
        periodEndTs,
        activeDays: Array.isArray(tender.activeDays) ? tender.activeDays : [],
        activeWindows: Array.isArray(tender.activeWindows) ? tender.activeWindows : [],
      });
      resultTender = tender;

      displayResults(currentResult);
      logInfo('nodes', 'calc_finish', { totalIncomeNok: currentResult.totalIncomeNok, tender: tender.name });
      showStatus('Beregning fullført.', 'success');
      options.onStateChange?.();
    } catch (error) {
      logError('nodes', 'calc_failed', { error: error instanceof Error ? error.message : String(error), tender: tender?.name });
      showStatus('Beregning feilet.', 'warning');
      setTableState('empty', 'Kunne ikke beregne inntekt.');
    } finally {
      isCalculating = false;
      if (el.calculateBtn) el.calculateBtn.disabled = false;
      options.onStateChange?.();
    }
  }

  interface NodesMonthlyExportRow {
    monthLabel: string;
    totalHours: number;
    eligibleHours: number;
    reservationPriceNokMwH: number;
    quantityMw: number;
    hourlyIncomeNok: number;
    incomeNok: number;
  }

  function buildNodesMonthlyExportRows(result: NodeYearlyResult): NodesMonthlyExportRow[] {
    const rowsByMonth = new Map(result.monthly.map((row) => [row.month, row]));
    const hourlyIncomeNok = result.priceNokMwH * result.quantityMw;

    return MONTH_SEQUENCE.map((month) => {
      const row = rowsByMonth.get(month.key);
      const eligibleHours = row?.eligibleHours ?? 0;
      const incomeNok = row?.incomeNok ?? 0;

      return {
        monthLabel: month.label,
        totalHours: 0,
        eligibleHours,
        reservationPriceNokMwH: result.priceNokMwH,
        quantityMw: result.quantityMw,
        hourlyIncomeNok,
        incomeNok,
      };
    });
  }

  interface NodesResolutionExportRow extends NodesMonthlyExportRow {
    periodLabel: string;
  }

  function buildNodesByResolution(
    result: NodeYearlyResult,
    tender: NodeTenderRow | null,
    resolution: Exclude<ExportResolution, 'month'>,
  ): NodesResolutionExportRow[] {
    const periodStartTs = normalizeTimestamp(tender?.periodStartTs);
    const periodEndTs = normalizeTimestamp(tender?.periodEndTs);
    if (!periodStartTs || !periodEndTs || periodStartTs >= periodEndTs) {
      return [];
    }

    const activeDays = Array.isArray(tender?.activeDays) ? tender.activeDays : [];
    const activeWindows = Array.isArray(tender?.activeWindows) ? tender.activeWindows : [];
    const hourlyIncomeNok = result.priceNokMwH * result.quantityMw;

    const timeline = calculateNodeHourlyIncome({
      reservationPriceNokMwH: result.priceNokMwH,
      quantityMw: result.quantityMw,
      periodStartTs,
      periodEndTs,
      activeDays,
      activeWindows,
    });

    const byPeriod = new Map<string, { totalHours: number; eligibleHours: number; incomeNok: number }>();
    timeline.forEach((row) => {
      const periodKey = resolution === 'day' ? toOsloDayKey(row.timestamp) : toOsloHourKey(row.timestamp);
      const current = byPeriod.get(periodKey) || { totalHours: 0, eligibleHours: 0, incomeNok: 0 };
      current.totalHours += 1;
      current.eligibleHours += row.eligible ? 1 : 0;
      current.incomeNok += row.incomeNok;
      byPeriod.set(periodKey, current);
    });

    return Array.from(byPeriod.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodKey, values]) => ({
        periodLabel: resolution === 'day' ? formatDayLabelNb(periodKey) : formatHourLabelNb(periodKey),
        monthLabel: '',
        totalHours: values.totalHours,
        eligibleHours: values.eligibleHours,
        reservationPriceNokMwH: result.priceNokMwH,
        quantityMw: result.quantityMw,
        hourlyIncomeNok,
        incomeNok: values.incomeNok,
      }));
  }

  function buildNodesExportRows(
    result: NodeYearlyResult,
    resolution: ExportResolution,
  ): Array<Record<string, string | number>> {
    const tender = resultTender || getSelectedTender();

    if (resolution === 'month') {
      const monthlyRows = buildNodesMonthlyExportRows(result);
      const roundedIncome = roundValuesToTarget(
        monthlyRows.map((row) => row.incomeNok),
        result.totalIncomeNok,
      );
      return monthlyRows.map((row, index) => {
        return {
          'Måned': row.monthLabel,
          'Kvalifiserte timer': row.eligibleHours,
          'Reservasjonspris (NOK/MW/h)': Math.round(row.reservationPriceNokMwH),
          'Volum (MW)': Math.round(row.quantityMw),
          'Inntekt Nodes (NOK)': roundedIncome[index],
        };
      });
    }

    const rows = buildNodesByResolution(result, tender, resolution);
    const roundedIncome = roundValuesToTarget(
      rows.map((row) => row.incomeNok),
      result.totalIncomeNok,
    );
    const periodColumn = resolution === 'day' ? 'Dag' : 'Time';

    return rows.map((row, index) => {
      return {
        [periodColumn]: row.periodLabel,
        'Timer totalt': row.totalHours,
        'Kvalifiserte timer': row.eligibleHours,
        'Reservasjonspris (NOK/MW/h)': Math.round(row.reservationPriceNokMwH),
        'Volum (MW)': Math.round(row.quantityMw),
        'Inntekt Nodes (NOK)': roundedIncome[index],
      };
    });
  }

  async function exportCsv(resolution: ExportResolution = 'month'): Promise<void> {
    if (!currentResult) return;
    const result = currentResult;
    const exportRows = buildNodesExportRows(result, resolution);
    if (exportRows.length === 0) {
      showStatus('Ingen data tilgjengelig for valgt eksportoppløsning.', 'warning');
      return;
    }

    const csvContent = Papa.unparse(exportRows);
    const tender = resultTender || getSelectedTender();
    const yearSuffix = getTenderYearSuffix(tender);
    const defaultName = appendResolutionSuffix(`nodes_inntekt_${yearSuffix}.csv`, resolution);
    await window.electronAPI.saveFile(csvContent, withExportTimestamp(defaultName));
  }

  async function exportExcel(resolution: ExportResolution = 'month'): Promise<void> {
    if (!currentResult) return;
    const result = currentResult;
    const excelRows = buildNodesExportRows(result, resolution);
    if (excelRows.length === 0) {
      showStatus('Ingen data tilgjengelig for valgt eksportoppløsning.', 'warning');
      return;
    }

    const tender = resultTender || getSelectedTender();
    const yearSuffix = getTenderYearSuffix(tender);
    const excelBytes = buildExcelFileBytes(excelRows, 'Nodes');
    const defaultName = appendResolutionSuffix(`nodes_inntekt_${yearSuffix}.xlsx`, resolution);
    await window.electronAPI.saveExcel(excelBytes, withExportTimestamp(defaultName));
  }

  async function init(): Promise<void> {
    el.statusMessage = document.getElementById('nodesStatusMessage');
    el.totalIncome = document.getElementById('nodesTotalIncome');
    el.eligibleHours = document.getElementById('nodesEligibleHours');
    el.priceNokMwH = document.getElementById('nodesPriceNokMwH');
    el.tenderSummary = document.getElementById('nodesTenderSummary');
    el.tenderName = document.getElementById('nodesTenderName');
    el.tenderMarket = document.getElementById('nodesTenderMarket');
    el.tenderPeriod = document.getElementById('nodesTenderPeriod');
    el.tenderSchedule = document.getElementById('nodesTenderSchedule');
    el.tenderPrice = document.getElementById('nodesTenderPrice');
    el.tenderVolume = document.getElementById('nodesTenderVolume');
    el.tenderHours = document.getElementById('nodesTenderHours');
    el.summaryTable = document.getElementById('nodesTable')?.querySelector('tbody') ?? null;
    el.tenderSelect = document.getElementById('nodesTender') as HTMLSelectElement | null;
    el.calculateBtn = document.getElementById('calculateNodesBtn') as HTMLButtonElement | null;
    el.exportCsvBtn = document.getElementById('nodesExportCsvBtn') as HTMLButtonElement | null;

    setTableState('loading', 'Laster tendere...');
    showStatus('Laster tendere fra Convex...', 'info');

    try {
      const rows = await window.electronAPI.loadNodeTenders({});
      allTenders = Array.isArray(rows) ? rows : [];

      populateTenderSelect();

      if (allTenders.length === 0) {
        showStatus('Ingen tendere funnet i Convex.', 'warning');
        setTableState('empty', 'Ingen tendere tilgjengelig.');
        renderTenderInfo(null);
      } else {
        if (el.tenderSelect) {
          el.tenderSelect.value = '0';
        }
        renderTenderInfo(getSelectedTender());
        showStatus(`${allTenders.length} tender(e) lastet. Velg en og trykk "Beregn inntekt".`, 'info');
        setTableState('empty', 'Trykk "Beregn inntekt" for å vise resultater.');
      }
    } catch (error) {
      logError('nodes', 'init_load_failed', { error: error instanceof Error ? error.message : String(error) });
      showStatus('Kunne ikke laste tendere fra Convex.', 'warning');
      setTableState('empty', 'Kunne ikke laste data.');
      renderTenderInfo(null);
    }

    if (el.tenderSelect) {
      el.tenderSelect.addEventListener('change', () => {
        renderTenderInfo(getSelectedTender());
      });
    }
    const powerMwInput = document.getElementById('powerMw') as HTMLInputElement | null;
    if (powerMwInput) {
      powerMwInput.addEventListener('input', () => {
        renderTenderInfo(getSelectedTender());
      });
    }
    if (el.calculateBtn) {
      el.calculateBtn.addEventListener('click', calculate);
    }
    if (el.exportCsvBtn) {
      el.exportCsvBtn.addEventListener('click', () => {
        void exportCsv();
      });
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
