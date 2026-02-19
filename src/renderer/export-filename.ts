function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pad3(value: number): string {
  return String(value).padStart(3, '0');
}

export function createExportTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  const millis = pad3(date.getMilliseconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}_${millis}`;
}

export function withExportTimestamp(filename: string, date: Date = new Date()): string {
  const safeName = String(filename || '').trim();
  const timestamp = createExportTimestamp(date);

  if (!safeName) {
    return `export_${timestamp}`;
  }

  const dotIndex = safeName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === safeName.length - 1) {
    return `${safeName}_${timestamp}`;
  }

  const base = safeName.slice(0, dotIndex);
  const extension = safeName.slice(dotIndex);
  return `${base}_${timestamp}${extension}`;
}
