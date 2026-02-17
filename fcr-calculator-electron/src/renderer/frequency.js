// Frequency profiles based on real Nordic grid data (Oct 2025 - Jan 2026)
// Analyzed from 6.4 million 1-second samples
const FREQUENCY_PROFILES = {
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

function getProfile(profileName) {
  return FREQUENCY_PROFILES[profileName] || FREQUENCY_PROFILES.medium;
}

// Seeded random number generator (simple LCG)
function createRng(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function normalRandom(rng, mean = 0, std = 1) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Exponential distribution
function exponentialRandom(rng, lambda) {
  return -Math.log(1 - rng()) / lambda;
}

// Poisson distribution
function poissonRandom(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// Simulate realistic Nordic grid frequency based on profile statistics
function simulateFrequency(startTime, hours, resolutionSeconds = 1, seed = 42, profileName = 'medium') {
  const rng = createRng(seed);

  const totalSeconds = hours * 3600;
  const nSamples = Math.floor(totalSeconds / resolutionSeconds);

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
    // Clamp to realistic range (±0.05 Hz)
    deviation = Math.max(-0.05, Math.min(0.05, deviation));
    frequencies[i] += deviation;
  }

  // Add excursion events
  const expectedEvents = Math.round(eventsPerHour * hours);
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

    // Determine if under or over frequency
    const isUnder = rng() < underRatio;

    // Event magnitude (how far outside the band)
    let magnitude = exponentialRandom(rng, 1 / 0.03) + 0.1;
    magnitude = Math.min(magnitude, 0.5);

    let eventFreq;
    if (isUnder) {
      eventFreq = Math.max(49.0, 49.9 - magnitude);
    } else {
      eventFreq = Math.min(51.0, 50.1 + magnitude);
    }

    // Apply event with smooth ramp in/out
    const rampSamples = Math.min(5, Math.floor(durationSamples / 3));
    for (let i = eventStart; i < eventEnd; i++) {
      const posInEvent = i - eventStart;
      let factor;
      if (posInEvent < rampSamples) {
        factor = posInEvent / rampSamples;
      } else if (posInEvent > (eventEnd - eventStart - rampSamples)) {
        factor = (eventEnd - eventStart - posInEvent) / rampSamples;
      } else {
        factor = 1.0;
      }
      frequencies[i] = frequencies[i] * (1 - factor) + eventFreq * factor;
    }
  }

  // Add HF noise and compute summary stats in single pass
  const histMin = 49.5;
  const histMax = 50.5;
  const binCount = 100;
  const binWidth = (histMax - histMin) / binCount;
  const histogram = new Array(binCount).fill(0);

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
    if (f < 49.9) { underBand++; outsideBand++; }
    else if (f > 50.1) { overBand++; outsideBand++; }

    const binIndex = Math.max(0, Math.min(binCount - 1, Math.floor((f - histMin) / binWidth)));
    histogram[binIndex]++;
  }

  const meanHz = sum / nSamples;

  // Build histogram labels
  const histogramLabels = [];
  for (let i = 0; i < binCount; i++) {
    histogramLabels.push((histMin + i * binWidth + binWidth / 2).toFixed(3));
  }

  const summary = {
    meanHz,
    minHz,
    maxHz,
    pctOutsideBand: (outsideBand / nSamples) * 100,
    pctUnder: (underBand / nSamples) * 100,
    pctOver: (overBand / nSamples) * 100,
    histogram,
    histogramLabels
  };

  return { frequencies, summary, startTime, hours };
}

// Export for use in app.js
window.FrequencySimulator = {
  FREQUENCY_PROFILES,
  getProfile,
  simulateFrequency
};
