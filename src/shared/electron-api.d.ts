export interface FcrPriceRow {
  timestamp: number;
  hourNumber: number;
  priceEurMw: number;
  volumeMw: number;
}

export interface SpotPriceRow {
  timestamp: number;
  spotPriceEurMwh: number;
}

export interface AfrrMarketRow {
  timestamp: number;
  marketPriceEurMw?: number;
  contractedPriceEurMw?: number;
  contractedQuantityMw?: number;
  activationPriceEurMwh?: number;
  marketVolumeMw?: number;
  marketActivatedVolumeMw?: number;
  marketGotActivated?: boolean;
}

export interface SolarProductionRow {
  timestamp: number;
  production: number;
}

export interface NodeTenderRow {
  name: string;
  status?: string;
  gridNode?: string;
  market?: string;
  quantityMw?: number;
  reservationPriceNokMwH?: number;
  activationPriceNokMwH?: number;
  periodStartTs?: number;
  periodEndTs?: number;
  activeDays?: string[];
  activeWindows?: { start: string; end: string }[];
}

export interface NodeTenderFilterOptions {
  gridNodes: string[];
  markets: string[];
  statuses: string[];
  total: number;
}

export interface AfrrFilters {
  biddingZone?: string;
  direction?: string;
  reserveType?: string;
  resolutionMin?: number;
}

export interface NodeTenderFilters {
  dataset?: string;
  gridNode?: string;
  market?: string;
}

export interface MonthlySummaryRow {
  month: string;
  revenue: number;
  hours: number;
  avgPrice: number;
}

export interface PdfExportData {
  chartImages: {
    monthly: string | null;
    price: string | null;
    soc: string | null;
    freq: string | null;
  };
  monthly: MonthlySummaryRow[];
  config: {
    powerMw: number;
    capacityMwh: number;
    efficiency: number;
    socMin: number;
    socMax: number;
    year: number;
  };
  metrics: {
    totalRevenue: string;
    availableHours: string;
    availability: string;
    avgPrice: string;
  };
}

export interface ElectronAPI {
  getAppVersion(): Promise<string>;
  saveFile(data: string, defaultName: string): Promise<string | null>;
  saveExcel(data: number[], defaultName: string): Promise<string | null>;
  savePdf(pdfData: PdfExportData, defaultName: string): Promise<string | null>;
  loadPriceData(year: number, area?: string): Promise<FcrPriceRow[]>;
  getAvailableYears(area?: string): Promise<number[]>;
  loadSpotData(biddingZone?: string, year?: number | null): Promise<SpotPriceRow[]>;
  loadAfrrData(year: number, filters?: AfrrFilters): Promise<AfrrMarketRow[]>;
  getAfrrAvailableYears(filters?: AfrrFilters): Promise<number[]>;
  loadSolarData(year: number, resolutionMinutes?: number): Promise<SolarProductionRow[]>;
  getSolarAvailableYears(resolutionMinutes?: number): Promise<number[]>;
  loadNodeTenders(filters?: NodeTenderFilters): Promise<NodeTenderRow[]>;
  getNodeTenderFilters(dataset?: string): Promise<NodeTenderFilterOptions>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
