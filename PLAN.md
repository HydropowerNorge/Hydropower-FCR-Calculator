# FCR-N Battery Income Calculator - Plan

## Overview
Streamlit app to estimate battery revenue from FCR-N market participation in NO1.

## Inputs
- **Power capacity (MW)**: Battery power rating
- **Energy capacity (MWh)**: Battery storage size
- **Round-trip efficiency (%)**: Default 90%
- **SOC operating range**: Default 20-80%
- **Year selection**: 2024, 2025, or 2026

## Core Logic

### Revenue Model
```
Hourly revenue = capacity_MW * FCR-N_price_EUR * availability_factor
```

### Availability Model
FCR-N requires symmetric response (charge + discharge). Battery must maintain ~50% SOC.

**Constraints:**
1. Usable energy = capacity_MWh * (max_SOC - min_SOC)
2. For FCR-N: need headroom = power_MW * 1 hour both directions
3. Available if: usable_energy >= 2 * power_MW

## SOC Simulation (using historical frequency)

For each timestamp with frequency data:
1. Calculate activation: `(50.0 - freq) / 0.1 * capacity_MW` (positive = discharge)
2. Update SOC based on power flow and efficiency
3. If SOC hits limits → mark hour as unavailable
4. Track rebalancing needs

### Recharge Cost (optional)
- Estimate cost to rebalance SOC using spot prices
- Deduct from gross revenue

## Output
- **Summary**: Annual/monthly revenue totals
- **Charts**: Revenue by month, price distribution
- **Export**: Hourly CSV with revenue per hour

## Files

```
fcr-calculator/
├── app.py              # Streamlit app
├── calculator.py       # Revenue calculation logic
├── data_loader.py      # Load and filter CSV data
└── requirements.txt    # pandas, streamlit, plotly
```

## Data Sources

### Price Data
- `PrimaryReservesD-1-{year}.csv` filtered for Area=NO1
- Use FCR-N Price EUR/MW column

### Frequency Data (user-provided)
- Historical Nordic grid frequency CSV (1-second resolution)
- Format: `timestamp,grid_frequency` (e.g., `2025-12-01T00:00:00.000Z,49.985`)
- Used to simulate actual SOC movement
- FCR-N activation: linear response in 49.9-50.1 Hz band
