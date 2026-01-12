# FCR-kalk-bank

Battery income calculator for the Nordic FCR (Frequency Containment Reserve) market.

## Goal

Estimate realistic annual revenue for a battery with:
- **X MW** power capacity
- **Y MWh** energy capacity

Focus area: **NO1** (Oslo/Southeast Norway)

## Data

### Market Price Data
- `PrimaryReservesD-1-2024.csv` - Full year 2024 (43,791 rows)
- `PrimaryReservesD-1-2025.csv` - Full year 2025 (43,794 rows)
- `PrimaryReservesD-1-2026.csv` - Partial 2026 (1,320 rows)

**Columns:**
| Column | Description |
|--------|-------------|
| Time(Local) | Timestamp with timezone |
| Hournumber | Hour of day (1-24) |
| Area | Price area (NO1-NO5) |
| FCR-N Price EUR/MW | FCR-N hourly price |
| FCR-N Volume MW | Procured volume |
| FCR-D Price EUR/MW | FCR-D hourly price |
| FCR-D Volume MW | Procured volume |

### FCR Products
- **FCR-N**: Normal frequency regulation (49.9-50.1 Hz)
- **FCR-D**: Disturbance reserves (activated at 49.5/50.5 Hz)

## Technical Docs

`FCR-docs/` contains Nordic TSO requirements for:
- Prequalification testing
- Technical requirements
- LER (Limited Energy Reservoir) rules for batteries

## Revenue Calculation

Battery revenue = `capacity_MW * price_EUR_per_MW * hours_available`

Key considerations:
- LER batteries need energy management (NEM/AEM)
- Availability depends on SOC and bidding strategy
- FCR-N and FCR-D can be combined or bid separately
