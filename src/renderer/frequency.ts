import type { FrequencyData, FrequencySummary } from './calculator';

export interface FrequencyProfile {
  name: string;
  pctOutside: number;
  eventsPerHour: number;
  avgEventDuration: number;
  underRatio: number;
}

// Frequency profiles based on real Nordic grid data (Oct 2025 - Jan 2026)
// Analyzed from 6.4 million 1-second samples
export const FREQUENCY_PROFILES: Record<string, FrequencyProfile> = {
  high: {
    name: 'High (Volatile)',
    pctOutside: 0.86,
    eventsPerHour: 5.4,
    avgEventDuration: 5.7,
    underRatio: 0.55
  },
  medium: {
    name: 'Medium (Typical)',
    pctOutside: 0.50,
    eventsPerHour: 2.0,
    avgEventDuration: 8.6,
    underRatio: 0.55
  },
  low: {
    name: 'Low (Calm)',
    pctOutside: 0.24,
    eventsPerHour: 1.3,
    avgEventDuration: 6.9,
    underRatio: 0.55
  }
};

export function getProfile(profileName: string): FrequencyProfile {
  return FREQUENCY_PROFILES[profileName] || FREQUENCY_PROFILES.medium;
}

// Seeded random number generator (simple LCG)
function createRng(seed: number): () => number {
  let s = seed;
  return function nextRandom(): number {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function normalRandom(rng: () => number, mean = 0, std = 1): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Exponential distribution
function exponentialRandom(rng: () => number, lambda: number): number {
  return -Math.log(1 - rng()) / lambda;
}

// Poisson distribution
function poissonRandom(rng: () => number, lambda: number): number {
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;

  // Knuth's exact method is accurate for small lambdas.
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng();
    } while (p > L);
    return k - 1;
  }

  // Normal approximation keeps large-lambda draws numerically stable.
  const draw = Math.round(normalRandom(rng, lambda, Math.sqrt(lambda)));
  return Math.max(0, draw);
}

function safePct(part: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

function calculateRampFactor(posInEvent: number, eventLength: number, rampSamples: number): number {
  if (rampSamples <= 0) {
    return 1;
  }

  if (posInEvent < rampSamples) {
    return posInEvent / rampSamples;
  }

  if (posInEvent > (eventLength - rampSamples)) {
    return (eventLength - posInEvent) / rampSamples;
  }

  return 1;
}

function buildHistogramLabels(histMin: number, binWidth: number, binCount: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < binCount; i++) {
    labels.push((histMin + i * binWidth + binWidth / 2).toFixed(3));
  }
  return labels;
}

// Simulate realistic Nordic grid frequency based on profile statistics
export function simulateFrequency(
  startTime: Date,
  hours: number,
  resolutionSeconds = 1,
  seed = 42,
  profileName = 'medium',
): FrequencyData {
  const rng = createRng(seed);

  const totalSeconds = hours * 3600;
  const nSamples = Math.floor(totalSeconds / resolutionSeconds);
  if (nSamples <= 0) {
    return {
      frequencies: new Float64Array(0),
      summary: {
        meanHz: 50,
        minHz: 50,
        maxHz: 50,
        pctOutsideBand: 0,
        pctUnder: 0,
        pctOver: 0,
        histogram: [],
        histogramLabels: []
      },
      startTime,
      hours
    };
  }

  // Get profile stats
  const profile = getProfile(profileName);

  // Event parameters from profile
  const avgEventDurationSec = profile.avgEventDuration;
  const eventsPerHour = profile.eventsPerHour;

  // Initialize frequency array
  const frequencies = new Float64Array(nSamples).fill(50.0);

  // Add base noise using mean-reverting process (Ornstein-Uhlenbeck style)
  // Real grid frequency is actively controlled and stays close to 50 Hz
  const meanReversion = 0.002; // Pull back toward 50 Hz each second
  const volatility = 0.003;
  let deviation = 0;
  for (let i = 0; i < nSamples; i++) {
    // Mean-revert toward 0, add random noise
    deviation = deviation * (1 - meanReversion) + normalRandom(rng, 0, volatility);
    // Clamp to realistic range (+/-0.05 Hz)
    deviation = Math.max(-0.05, Math.min(0.05, deviation));
    frequencies[i] += deviation;
  }

  // Add excursion events
  const expectedEvents = eventsPerHour * hours;
  const nEvents = poissonRandom(rng, expectedEvents);

  // Ratio of under vs over frequency events
  const underRatio = profile.underRatio;

  for (let e = 0; e < nEvents; e++) {
    // Random event start time
    const eventStart = Math.floor(rng() * nSamples);

    // Event duration (exponential distribution around average)
    const durationSec = exponentialRandom(rng, 1 / avgEventDurationSec);
    const durationSamples = Math.max(1, Math.floor(durationSec / resolutionSeconds));
    const eventEnd = Math.min(eventStart + durationSamples, nSamples);
    const eventLength = eventEnd - eventStart;

    // Determine if under or over frequency
    const isUnder = rng() < underRatio;

    // Event magnitude (how far outside the band)
    let magnitude = exponentialRandom(rng, 1 / 0.03) + 0.1;
    magnitude = Math.min(magnitude, 0.5);

    let eventFreq: number;
    if (isUnder) {
      eventFreq = Math.max(49.0, 49.9 - magnitude);
    } else {
      eventFreq = Math.min(51.0, 50.1 + magnitude);
    }

    // Apply event with smooth ramp in/out
    const rampSamples = Math.min(5, Math.floor(durationSamples / 3));
    for (let i = eventStart; i < eventEnd; i++) {
      const posInEvent = i - eventStart;
      const factor = calculateRampFactor(posInEvent, eventLength, rampSamples);
      frequencies[i] = frequencies[i] * (1 - factor) + eventFreq * factor;
    }
  }

  // Add HF noise and compute summary stats in single pass
  const histMin = 49.5;
  const histMax = 50.5;
  const binCount = 100;
  const binWidth = (histMax - histMin) / binCount;
  const histogram = new Array<number>(binCount).fill(0);

  let sum = 0;
  let minHz = Infinity;
  let maxHz = -Infinity;
  let outsideBand = 0;
  let underBand = 0;
  let overBand = 0;

  for (let i = 0; i < nSamples; i++) {
    frequencies[i] += normalRandom(rng, 0, 0.005);
    frequencies[i] = Math.max(49.0, Math.min(51.0, frequencies[i]));

    const f = frequencies[i];
    sum += f;
    if (f < minHz) minHz = f;
    if (f > maxHz) maxHz = f;
    if (f < 49.9) {
      underBand++;
      outsideBand++;
    } else if (f > 50.1) {
      overBand++;
      outsideBand++;
    }

    const binIndex = Math.max(0, Math.min(binCount - 1, Math.floor((f - histMin) / binWidth)));
    histogram[binIndex]++;
  }

  const meanHz = sum / nSamples;

  const histogramLabels = buildHistogramLabels(histMin, binWidth, binCount);

  const summary: FrequencySummary = {
    meanHz,
    minHz,
    maxHz,
    pctOutsideBand: safePct(outsideBand, nSamples),
    pctUnder: safePct(underBand, nSamples),
    pctOver: safePct(overBand, nSamples),
    histogram,
    histogramLabels
  };

  return { frequencies, summary, startTime, hours };
}
