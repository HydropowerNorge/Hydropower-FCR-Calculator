import * as XLSX from 'xlsx';

export type ExcelCellValue = string | number | boolean | null | undefined;
export type ExcelRow = Record<string, ExcelCellValue>;

const MIN_COL_WIDTH = 12;
const MAX_COL_WIDTH = 44;

function sanitizeSheetName(name: string): string {
  const cleaned = String(name || '')
    .replace(/[\\/?*:[\]]/g, '')
    .trim();
  if (cleaned.length === 0) return 'Data';
  return cleaned.slice(0, 31);
}

function asCellText(value: ExcelCellValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function calculateColumnWidth(header: string, rows: ExcelRow[]): number {
  let maxLength = String(header).length;
  for (const row of rows) {
    const length = asCellText(row[header]).length;
    if (length > maxLength) maxLength = length;
  }
  return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, maxLength + 2));
}

export function buildExcelFileBytes(rows: ExcelRow[], sheetName: string): number[] {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  if (headers.length > 0) {
    const lastCol = XLSX.utils.encode_col(headers.length - 1);
    const lastRow = Math.max(2, rows.length + 1);
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` };
    worksheet['!cols'] = headers.map((header) => ({ wch: calculateColumnWidth(header, rows) }));
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));

  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;

  return Array.from(new Uint8Array(buffer));
}
