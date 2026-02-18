const STATUS_AUTO_HIDE_MS = 3200;
const STATUS_FADE_MS = 220;

interface StatusTimerState {
  fadeTimerId?: number;
  hideTimerId?: number;
}

export interface StatusMessageOptions {
  autoHide?: boolean;
}

const timersByElement = new WeakMap<HTMLElement, StatusTimerState>();

function clearStatusTimers(target: HTMLElement): void {
  const timers = timersByElement.get(target);
  if (!timers) return;
  if (timers.fadeTimerId !== undefined) {
    window.clearTimeout(timers.fadeTimerId);
  }
  if (timers.hideTimerId !== undefined) {
    window.clearTimeout(timers.hideTimerId);
  }
  timersByElement.delete(target);
}

export function showStatusMessage(
  target: HTMLElement | null,
  message: string,
  type = 'info',
  options: StatusMessageOptions = {}
): void {
  if (!target) return;

  clearStatusTimers(target);
  target.classList.remove('is-fade-out', 'is-hidden');
  target.textContent = message;
  target.className = `status-message ${type}`;

  const shouldAutoHide = options.autoHide ?? (type === 'info' || type === 'success');
  if (!shouldAutoHide) return;

  const timerState: StatusTimerState = {};
  timerState.fadeTimerId = window.setTimeout(() => {
    target.classList.add('is-fade-out');
    timerState.hideTimerId = window.setTimeout(() => {
      target.classList.add('is-hidden');
      target.textContent = '';
      timersByElement.delete(target);
    }, STATUS_FADE_MS);
  }, STATUS_AUTO_HIDE_MS);

  timersByElement.set(target, timerState);
}
