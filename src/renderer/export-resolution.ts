export type ExportResolution = 'month' | 'day' | 'hour';

export const EXPORT_RESOLUTIONS: ExportResolution[] = ['month', 'day', 'hour'];

export const EXPORT_RESOLUTION_LABELS_NB: Record<ExportResolution, string> = {
  month: 'Måned',
  day: 'Dag',
  hour: 'Time',
};

export const EXPORT_RESOLUTION_FILENAME_SUFFIX: Record<ExportResolution, string> = {
  month: 'maaned',
  day: 'dag',
  hour: 'time',
};

export function parseExportResolution(value: unknown): ExportResolution {
  if (value === 'day' || value === 'hour') return value;
  return 'month';
}
