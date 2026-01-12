import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent


def load_price_data(year: int, area: str = "NO1") -> pd.DataFrame:
    """Load FCR price data for a given year and area."""
    file_path = DATA_DIR / f"PrimaryReservesD-1-{year}.csv"

    df = pd.read_csv(file_path)
    df = df[df["Area"] == area].copy()

    df["timestamp"] = pd.to_datetime(df["Time(Local)"], format="%d.%m.%Y %H:%M:%S %z")
    df = df.sort_values("timestamp").reset_index(drop=True)

    return df[["timestamp", "Hournumber", "FCR-N Price EUR/MW", "FCR-N Volume MW"]]


def load_frequency_data(file_path: str | Path) -> pd.DataFrame:
    """Load frequency data from CSV (1-second resolution)."""
    df = pd.read_csv(file_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def aggregate_frequency_to_hourly(freq_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate 1-second frequency data to hourly statistics."""
    freq_df = freq_df.copy()
    freq_df["hour"] = freq_df["timestamp"].dt.floor("h")

    hourly = freq_df.groupby("hour").agg(
        freq_mean=("grid_frequency", "mean"),
        freq_std=("grid_frequency", "std"),
        freq_min=("grid_frequency", "min"),
        freq_max=("grid_frequency", "max"),
        sample_count=("grid_frequency", "count")
    ).reset_index()

    return hourly


def get_available_years() -> list[int]:
    """Return list of years with available price data."""
    years = []
    for year in [2024, 2025, 2026]:
        if (DATA_DIR / f"PrimaryReservesD-1-{year}.csv").exists():
            years.append(year)
    return years
