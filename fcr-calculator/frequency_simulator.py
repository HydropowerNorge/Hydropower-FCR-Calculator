"""
Frequency simulator based on Nordic grid statistics.

Data source: Fingrid (Finnish grid) January & June 2024
From thesis analysis of frequency quality in the Nordic synchronous area.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class FrequencyStats:
    """Statistics for frequency deviations outside normal band (49.9-50.1 Hz)."""
    name: str
    total_minutes_outside: float
    pct_outside: float
    events_count: int
    under_minutes: float  # Below 49.9 Hz
    over_minutes: float   # Above 50.1 Hz
    under_events: int
    over_events: int


# Nordic grid statistics from Fingrid 2024
WINTER_STATS = FrequencyStats(
    name="Winter (January)",
    total_minutes_outside=759,
    pct_outside=1.69,
    events_count=2125,
    under_minutes=335,
    over_minutes=424,
    under_events=955,
    over_events=1170
)

SUMMER_STATS = FrequencyStats(
    name="Summer (June)",
    total_minutes_outside=555,
    pct_outside=1.33,
    events_count=2129,
    under_minutes=233,
    over_minutes=322,
    under_events=967,
    over_events=1162
)


def get_seasonal_stats(month: int) -> FrequencyStats:
    """Get frequency statistics based on month (winter vs summer pattern)."""
    # Winter months: Nov-Mar, Summer months: Apr-Oct
    if month in [11, 12, 1, 2, 3]:
        return WINTER_STATS
    else:
        return SUMMER_STATS


def simulate_frequency(
    start_time: pd.Timestamp,
    hours: int,
    resolution_seconds: int = 1,
    seed: int | None = None
) -> pd.DataFrame:
    """
    Simulate realistic Nordic grid frequency based on historical statistics.

    The simulation models:
    - Base frequency at 50.0 Hz with small random walk
    - Occasional excursions outside the 49.9-50.1 Hz band
    - Seasonal patterns (winter: longer events, summer: more frequent but shorter)

    Args:
        start_time: Start timestamp
        hours: Number of hours to simulate
        resolution_seconds: Time resolution (default 1 second)
        seed: Random seed for reproducibility

    Returns:
        DataFrame with timestamp and grid_frequency columns
    """
    if seed is not None:
        np.random.seed(seed)

    total_seconds = hours * 3600
    n_samples = total_seconds // resolution_seconds

    timestamps = pd.date_range(start_time, periods=n_samples, freq=f"{resolution_seconds}s")

    # Get seasonal stats based on start month
    stats = get_seasonal_stats(start_time.month)

    # Calculate event parameters
    avg_event_duration_sec = (stats.total_minutes_outside * 60) / stats.events_count
    events_per_hour = stats.events_count / (30 * 24)  # Assuming monthly data

    # Initialize frequency array
    frequencies = np.full(n_samples, 50.0)

    # Add base noise (small fluctuations within normal band)
    # Standard deviation ~0.02 Hz keeps most values in 49.95-50.05 range
    base_noise = np.cumsum(np.random.normal(0, 0.002, n_samples))
    base_noise = base_noise - np.mean(base_noise)  # Center around 0
    base_noise = np.clip(base_noise, -0.08, 0.08)  # Keep within band mostly
    frequencies += base_noise

    # Add excursion events
    expected_events = int(events_per_hour * hours)
    n_events = np.random.poisson(expected_events)

    # Ratio of under vs over frequency events
    under_ratio = stats.under_events / stats.events_count

    for _ in range(n_events):
        # Random event start time
        event_start = np.random.randint(0, n_samples)

        # Event duration (exponential distribution around average)
        duration_sec = int(np.random.exponential(avg_event_duration_sec))
        duration_samples = max(1, duration_sec // resolution_seconds)
        event_end = min(event_start + duration_samples, n_samples)

        # Determine if under or over frequency
        is_under = np.random.random() < under_ratio

        # Event magnitude (how far outside the band)
        # Most events are small (just outside band), few are large
        magnitude = np.random.exponential(0.03) + 0.1  # 0.1-0.3 Hz typical
        magnitude = min(magnitude, 0.5)  # Cap at 49.5/50.5 Hz

        if is_under:
            # Under frequency: go below 49.9 Hz
            event_freq = 49.9 - magnitude
            event_freq = max(event_freq, 49.0)  # Floor at 49.0 Hz
        else:
            # Over frequency: go above 50.1 Hz
            event_freq = 50.1 + magnitude
            event_freq = min(event_freq, 51.0)  # Cap at 51.0 Hz

        # Apply event with smooth ramp in/out
        ramp_samples = min(5, duration_samples // 3)
        for i in range(event_start, event_end):
            # Ramp factor (0 to 1 to 0)
            pos_in_event = i - event_start
            if pos_in_event < ramp_samples:
                factor = pos_in_event / ramp_samples
            elif pos_in_event > (event_end - event_start - ramp_samples):
                factor = (event_end - event_start - pos_in_event) / ramp_samples
            else:
                factor = 1.0

            # Blend current frequency toward event frequency
            frequencies[i] = frequencies[i] * (1 - factor) + event_freq * factor

    # Add small high-frequency noise
    hf_noise = np.random.normal(0, 0.005, n_samples)
    frequencies += hf_noise

    # Final clamp to realistic range
    frequencies = np.clip(frequencies, 49.0, 51.0)

    return pd.DataFrame({
        "timestamp": timestamps,
        "grid_frequency": frequencies
    })


def simulate_frequency_for_year(year: int, seed: int | None = None) -> pd.DataFrame:
    """
    Simulate a full year of frequency data with seasonal variations.

    Note: This generates a LOT of data (31.5M rows at 1-second resolution).
    Consider using hourly aggregation for the calculator.
    """
    if seed is not None:
        np.random.seed(seed)

    # Simulate month by month to capture seasonal patterns
    monthly_dfs = []

    for month in range(1, 13):
        month_start = pd.Timestamp(f"{year}-{month:02d}-01", tz="UTC")
        if month == 12:
            next_month = pd.Timestamp(f"{year + 1}-01-01", tz="UTC")
        else:
            next_month = pd.Timestamp(f"{year}-{month + 1:02d}-01", tz="UTC")

        hours_in_month = int((next_month - month_start).total_seconds() / 3600)

        # Use different seed per month for variety
        month_seed = seed + month if seed else None

        df = simulate_frequency(month_start, hours_in_month, seed=month_seed)
        monthly_dfs.append(df)

    return pd.concat(monthly_dfs, ignore_index=True)


def get_frequency_summary(freq_df: pd.DataFrame) -> dict:
    """Calculate summary statistics for frequency data."""
    freq = freq_df["grid_frequency"]

    outside_band = (freq < 49.9) | (freq > 50.1)
    under_band = freq < 49.9
    over_band = freq > 50.1

    total_samples = len(freq)

    return {
        "mean_hz": freq.mean(),
        "std_hz": freq.std(),
        "min_hz": freq.min(),
        "max_hz": freq.max(),
        "pct_outside_band": outside_band.sum() / total_samples * 100,
        "pct_under": under_band.sum() / total_samples * 100,
        "pct_over": over_band.sum() / total_samples * 100,
    }
