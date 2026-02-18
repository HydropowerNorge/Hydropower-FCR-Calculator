import Papa from 'papaparse';
import { calculateNodeYearlyIncome } from './nodes';
import type { NodeYearlyResult } from './nodes';
import type { NodeTenderRow } from '../shared/electron-api';
import { showStatusMessage } from './status-message';

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

export function createNodesUI(): { init: () => Promise<void> } {
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
  let isCalculating = false;
  let allTenders: NodeTenderRow[] = [];

  function getSelectedTender(): NodeTenderRow | null {
    if (!el.tenderSelect) return null;
    const selectedIndex = Number(el.tenderSelect.value);
    return allTenders[selectedIndex] || null;
  }

  function renderTenderInfo(tender: NodeTenderRow | null): void {
    if (!tender) {
      if (el.tenderSummary) el.tenderSummary.textContent = 'Velg en tender for å se hva den betyr i praksis.';
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
        ? `Reservasjon ${formatNok(reservationPrice)}/MW/h`
        : 'Reservasjonspris ikke oppgitt';
      const activationText = Number.isFinite(activationPrice) && activationPrice > 0
        ? ` | Aktivering ${formatNok(activationPrice)}/MW/h`
        : '';
      el.tenderPrice.textContent = `${reservationText}${activationText}`;
    }
    if (el.tenderVolume) {
      el.tenderVolume.textContent = `Tender ${formatMw(tenderMw)} | Beregning ${formatMw(batteryMw)}`;
    }
    if (el.tenderHours) {
      el.tenderHours.textContent = hours.total > 0
        ? `${hours.eligible.toLocaleString('nb-NO')} av ${hours.total.toLocaleString('nb-NO')} timer`
        : 'Ikke beregnbart';
    }

    if (el.tenderSummary) {
      const summaryPrefix = hours.total > 0
        ? `${hours.eligible.toLocaleString('nb-NO')} av ${hours.total.toLocaleString('nb-NO')} timer er kvalifisert`
        : 'Kvalifiserte timer beregnes fra periode, dager og tidsvinduer';
      el.tenderSummary.textContent = `${summaryPrefix}. Inntekt = reservasjonspris × valgt MW × kvalifiserte timer.`;
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
      option.textContent = 'Ingen tenderer tilgjengelig';
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

      displayResults(currentResult);
      showStatus('Beregning fullført.', 'success');
    } catch (error) {
      console.error('Node income calculation failed:', error);
      showStatus('Beregning feilet. Se konsoll for detaljer.', 'warning');
      setTableState('empty', 'Kunne ikke beregne inntekt.');
    } finally {
      isCalculating = false;
      if (el.calculateBtn) el.calculateBtn.disabled = false;
    }
  }

  async function exportCsv(): Promise<void> {
    if (!currentResult) return;
    const result = currentResult;

    const rowsByMonth = new Map(result.monthly.map((row) => [row.month, row]));
    const hourlyIncomeNok = result.priceNokMwH * result.quantityMw;
    let accumulatedIncomeNok = 0;

    const csvContent = Papa.unparse(MONTH_SEQUENCE.map((month) => {
      const row = rowsByMonth.get(month.key);
      const eligibleHours = row?.eligibleHours ?? 0;
      const incomeNok = row?.incomeNok ?? 0;
      accumulatedIncomeNok += incomeNok;
      return {
        'Måned': month.label,
        'Kvalifiserte timer': eligibleHours,
        'Reservasjonspris (NOK/MW/h)': result.priceNokMwH.toFixed(4),
        'Volum (MW)': result.quantityMw.toFixed(4),
        'Timeinntekt (NOK/h)': hourlyIncomeNok.toFixed(4),
        'Inntekt Nodes (NOK)': incomeNok.toFixed(2),
        'Akkumulert Nodes (NOK)': accumulatedIncomeNok.toFixed(2),
        'Årssum Nodes (NOK)': result.totalIncomeNok.toFixed(2),
      };
    }));

    const tender = getSelectedTender();
    const yearSuffix = getTenderYearSuffix(tender);
    await window.electronAPI.saveFile(csvContent, `nodes_inntekt_${yearSuffix}.csv`);
  }

  async function init(): Promise<void> {
    console.log('[nodes-ui] init() starting');
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
      console.log('[nodes-ui] Loaded', allTenders.length, 'tenders');

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
      console.error('Failed to load node tenders:', error);
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
      el.exportCsvBtn.addEventListener('click', exportCsv);
    }

    console.log('[nodes-ui] init() complete');
  }

  return { init };
}
