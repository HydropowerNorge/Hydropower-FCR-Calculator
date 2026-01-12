import pandas as pd
import numpy as np
from dataclasses import dataclass


@dataclass
class BatteryConfig:
    power_mw: float
    capacity_mwh: float
    efficiency: float = 0.90
    soc_min: float = 0.20
    soc_max: float = 0.80


@dataclass
class SimulationResult:
    hourly_df: pd.DataFrame
    total_revenue_eur: float
    available_hours: int
    total_hours: int
    availability_pct: float
    avg_price_eur: float


def calculate_fcr_n_activation(frequency: float, power_mw: float) -> float:
    """
    Calculate FCR-N power activation based on frequency.

    FCR-N activates linearly in 49.9-50.1 Hz band:
    - At 49.9 Hz: full discharge (+power_mw)
    - At 50.0 Hz: zero activation
    - At 50.1 Hz: full charge (-power_mw)

    Returns power in MW (positive = discharge, negative = charge).
    """
    if frequency <= 49.9:
        return power_mw
    elif frequency >= 50.1:
        return -power_mw
    else:
        return (50.0 - frequency) / 0.1 * power_mw


def simulate_soc_hourly(
    freq_df: pd.DataFrame,
    config: BatteryConfig,
    start_soc: float = 0.5
) -> pd.DataFrame:
    """
    Simulate battery SOC evolution using 1-second frequency data.

    Returns DataFrame with hourly SOC statistics and availability.
    """
    freq_df = freq_df.copy()
    freq_df["hour"] = freq_df["timestamp"].dt.floor("h")

    usable_capacity = config.capacity_mwh * (config.soc_max - config.soc_min)
    min_energy = config.capacity_mwh * config.soc_min
    max_energy = config.capacity_mwh * config.soc_max

    results = []
    current_energy = config.capacity_mwh * start_soc

    for hour, group in freq_df.groupby("hour"):
        hour_start_energy = current_energy
        unavailable_seconds = 0

        for _, row in group.iterrows():
            freq = row["grid_frequency"]
            power = calculate_fcr_n_activation(freq, config.power_mw)

            # Energy change per second (power in MW, time in hours)
            delta_energy = power / 3600  # MWh per second

            # Apply efficiency loss
            if delta_energy > 0:  # Discharging
                delta_energy /= np.sqrt(config.efficiency)
            else:  # Charging
                delta_energy *= np.sqrt(config.efficiency)

            new_energy = current_energy - delta_energy

            # Check SOC limits
            if new_energy < min_energy or new_energy > max_energy:
                unavailable_seconds += 1
                # Clamp to limits
                new_energy = np.clip(new_energy, min_energy, max_energy)

            current_energy = new_energy

        hour_end_energy = current_energy
        available = unavailable_seconds < 60  # Available if <1 minute at limits

        results.append({
            "hour": hour,
            "soc_start": hour_start_energy / config.capacity_mwh,
            "soc_end": hour_end_energy / config.capacity_mwh,
            "soc_change": (hour_end_energy - hour_start_energy) / config.capacity_mwh,
            "unavailable_seconds": unavailable_seconds,
            "available": available
        })

    return pd.DataFrame(results)


def calculate_revenue(
    price_df: pd.DataFrame,
    soc_df: pd.DataFrame,
    config: BatteryConfig
) -> SimulationResult:
    """
    Calculate revenue by combining price data with availability from SOC simulation.
    """
    # Merge price and SOC data
    merged = price_df.merge(
        soc_df,
        left_on=price_df["timestamp"].dt.floor("h"),
        right_on="hour",
        how="left"
    )

    # If no frequency data for an hour, assume available
    merged["available"] = merged["available"].fillna(True)

    # Calculate hourly revenue
    merged["revenue_eur"] = merged.apply(
        lambda row: config.power_mw * row["FCR-N Price EUR/MW"] if row["available"] else 0,
        axis=1
    )

    total_revenue = merged["revenue_eur"].sum()
    available_hours = merged["available"].sum()
    total_hours = len(merged)
    availability_pct = available_hours / total_hours * 100 if total_hours > 0 else 0
    avg_price = merged["FCR-N Price EUR/MW"].mean()

    result_df = merged[[
        "timestamp", "FCR-N Price EUR/MW", "available", "revenue_eur",
        "soc_start", "soc_end"
    ]].copy()

    return SimulationResult(
        hourly_df=result_df,
        total_revenue_eur=total_revenue,
        available_hours=int(available_hours),
        total_hours=total_hours,
        availability_pct=availability_pct,
        avg_price_eur=avg_price
    )


def calculate_simple_revenue(
    price_df: pd.DataFrame,
    power_mw: float,
    availability_pct: float = 100.0
) -> SimulationResult:
    """
    Calculate revenue without SOC simulation (simple availability factor).
    """
    df = price_df.copy()
    factor = availability_pct / 100.0

    df["available"] = True
    df["revenue_eur"] = power_mw * df["FCR-N Price EUR/MW"] * factor

    total_revenue = df["revenue_eur"].sum()
    total_hours = len(df)

    return SimulationResult(
        hourly_df=df[["timestamp", "FCR-N Price EUR/MW", "available", "revenue_eur"]],
        total_revenue_eur=total_revenue,
        available_hours=int(total_hours * factor),
        total_hours=total_hours,
        availability_pct=availability_pct,
        avg_price_eur=df["FCR-N Price EUR/MW"].mean()
    )
