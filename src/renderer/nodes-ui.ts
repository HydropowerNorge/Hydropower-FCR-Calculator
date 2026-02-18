import Papa from 'papaparse';
import { calculateNodeYearlyIncome } from './nodes';
import type { NodeYearlyResult } from './nodes';
import type { NodeTenderRow } from '../shared/electron-api';

interface NodesElements {
  statusMessage: HTMLElement | null;
  totalIncome: HTMLElement | null;
  eligibleHours: HTMLElement | null;
  priceNokMwH: HTMLElement | null;
  summaryTable: HTMLTableSectionElement | null;
  tenderSelect: HTMLSelectElement | null;
  calculateBtn: HTMLButtonElement | null;
  exportCsvBtn: HTMLButtonElement | null;
}

function formatNok(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return 'NOK 0';
  return `NOK ${value.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function createNodesUI(): { init: () => Promise<void> } {
  const el: NodesElements = {
    statusMessage: null,
    totalIncome: null,
    eligibleHours: null,
    priceNokMwH: null,
    summaryTable: null,
    tenderSelect: null,
    calculateBtn: null,
    exportCsvBtn: null,
  };

  let currentResult: NodeYearlyResult | null = null;
  let isCalculating = false;
  let allTenders: NodeTenderRow[] = [];

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
    if (!el.statusMessage) return;
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message ${type}`;
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
    if (!el.tenderSelect) return;

    const selectedIndex = Number(el.tenderSelect.value);
    const tender = allTenders[selectedIndex];
    if (!tender) {
      showStatus('Velg en tender fra listen.', 'warning');
      return;
    }

    const reservationPrice = Number(tender.reservationPriceNokMwH);
    const powerMwInput = document.getElementById('powerMw') as HTMLInputElement | null;
    const quantityMw = parseFloat(powerMwInput?.value || '0');
    const periodStartTs = Number(tender.periodStartTs);
    const periodEndTs = Number(tender.periodEndTs);

    if (!Number.isFinite(reservationPrice) || reservationPrice <= 0) {
      showStatus('Valgt tender mangler reservasjonspris.', 'warning');
      return;
    }
    if (!Number.isFinite(quantityMw) || quantityMw <= 0) {
      showStatus('Valgt tender mangler MW-mengde.', 'warning');
      return;
    }
    if (!Number.isFinite(periodStartTs) || !Number.isFinite(periodEndTs) || periodStartTs >= periodEndTs) {
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

    const csvContent = Papa.unparse(currentResult.monthly.map((row) => ({
      month: row.month,
      eligible_hours: row.eligibleHours,
      income_nok: row.incomeNok.toFixed(2),
    })));

    const tender = allTenders[Number(el.tenderSelect?.value)];
    const tenderName = (tender?.name || 'nodes').replace(/\s+/g, '_');
    await window.electronAPI.saveFile(csvContent, `nodes_inntekt_${tenderName}.csv`);
  }

  async function init(): Promise<void> {
    console.log('[nodes-ui] init() starting');
    el.statusMessage = document.getElementById('nodesStatusMessage');
    el.totalIncome = document.getElementById('nodesTotalIncome');
    el.eligibleHours = document.getElementById('nodesEligibleHours');
    el.priceNokMwH = document.getElementById('nodesPriceNokMwH');
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
      } else {
        showStatus(`${allTenders.length} tender(e) lastet. Velg en og trykk "Beregn inntekt".`, 'success');
        setTableState('empty', 'Trykk "Beregn inntekt" for å vise resultater.');
      }
    } catch (error) {
      console.error('Failed to load node tenders:', error);
      showStatus('Kunne ikke laste tendere fra Convex.', 'warning');
      setTableState('empty', 'Kunne ikke laste data.');
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
