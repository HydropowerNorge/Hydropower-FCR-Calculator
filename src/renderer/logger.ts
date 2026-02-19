/**
 * Client-side logger that POSTs structured events to /api/log.
 * Fire-and-forget, batched flush every 2 seconds or on beforeunload.
 */

interface LogEntry {
  level: 'info' | 'error';
  module: string;
  event: string;
  data?: unknown;
}

const FLUSH_INTERVAL_MS = 2000;
const ENDPOINT = '/api/log';

let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flush(): void {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        body: blob,
        keepalive: true,
      }).catch(() => { /* fire-and-forget */ });
    }
  } catch {
    /* never throw */
  }
}

function enqueue(entry: LogEntry): void {
  buffer.push(entry);
}

function startFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  window.addEventListener('beforeunload', flush);
}

export function logInfo(module: string, event: string, data?: unknown): void {
  startFlushTimer();
  enqueue({ level: 'info', module, event, ...(data !== undefined ? { data } : {}) });
}

export function logError(module: string, event: string, data?: unknown): void {
  startFlushTimer();
  enqueue({ level: 'error', module, event, ...(data !== undefined ? { data } : {}) });
}
