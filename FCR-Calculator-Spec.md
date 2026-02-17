# FCR-N Battery Revenue Calculator - Technical Specification

Recreation guide for the FCR battery income calculator. Focus on logic, calculations, and data flow.

---

## Overview

Estimates annual revenue for a battery participating in the **FCR-N** (Frequency Containment Reserve - Normal) market in **NO1** (Oslo/Southeast Norway).

**Core flow:**
1. Load historical hourly FCR-N prices
2. Simulate realistic grid frequency (1-second resolution)
3. Simulate battery SOC evolution with frequency response + energy management
4. Calculate revenue based on hourly availability

---

## 1. Battery Parameters

| Parameter | Default | Range | Unit |
|-----------|---------|-------|------|
| Power capacity | 1.0 | 0.1-100 | MW |
| Energy capacity | 2.0 | 0.1-500 | MWh |
| Round-trip efficiency | 90% | 70-99% | % |
| Min SOC | 20% | 0-50% | % |
| Max SOC | 80% | 50-100% | % |

---

## 2. Core Calculations

### 2.1 FCR-N Activation (Frequency Response)

Linear droop within 49.9-50.1 Hz band:

```
if frequency <= 49.9:
    activation = +powerMw          # Full discharge
elif frequency >= 50.1:
    activation = -powerMw          # Full charge
else:
    activation = (50.0 - frequency) / 0.1 * powerMw
```

| Frequency | Activation |
|-----------|------------|
| 49.9 Hz | +100% (discharge) |
| 50.0 Hz | 0% (idle) |
| 50.1 Hz | -100% (charge) |

### 2.2 NEM (Normal Energy Management)

Restores SOC to operational range when frequency is in normal band (49.9-50.1 Hz).

**Constants:**
```
NEM_POWER_RATIO = 0.34        # 34% of power capacity
NEM_WINDOW_SECONDS = 120      # 2-minute rolling average
```

**SOC thresholds:**
```
socRange = socMax - socMin
nemBuffer = socRange * 0.25

nemEnableLower   = socMin + nemBuffer              # Start charging when low
nemDisableLower  = socMin + socRange * 0.5         # Stop at midpoint
nemEnableUpper   = socMax - nemBuffer              # Start discharging when high
nemDisableUpper  = socMax - socRange * 0.5         # Stop at midpoint
```

**Algorithm:**
```
nemAllowed = 0
if soc < nemEnableLower AND frequency in [49.9, 50.1]:
    nemAllowed = -1    # Request charging
if soc > nemEnableUpper AND frequency in [49.9, 50.1]:
    nemAllowed = +1    # Request discharging

# Apply hysteresis
if nemAllowed == -1 AND soc >= nemDisableLower:
    nemAllowed = 0
if nemAllowed == +1 AND soc <= nemDisableUpper:
    nemAllowed = 0

# Rolling 2-minute average
nemCurrent = average(last 120 nemAllowed values)
nemPower = NEM_POWER_RATIO * powerMw * nemCurrent
```

### 2.3 Energy Change (Per Second)

```
fcrPower = calculateFcrActivation(frequency, powerMw)
nemPower = NEM_POWER_RATIO * powerMw * nemCurrent
totalPower = fcrPower + nemPower

# Convert MW to MWh per second
deltaEnergy = totalPower / 3600

# Apply efficiency (sqrt for half of round-trip)
if deltaEnergy > 0:    # Charging
    deltaEnergy = deltaEnergy / sqrt(efficiency)
else:                  # Discharging
    deltaEnergy = deltaEnergy * sqrt(efficiency)

newEnergy = currentEnergy - deltaEnergy

# Hard limits
if newEnergy < minEnergy OR newEnergy > maxEnergy:
    mark_second_as_unavailable()
    newEnergy = clamp(newEnergy, minEnergy, maxEnergy)
```

### 2.4 Hourly Aggregation

```
for each hour (3600 seconds):
    socStart = energy / capacityMwh

    for each second:
        apply FCR + NEM
        track unavailable seconds

    socEnd = energy / capacityMwh
    available = (unavailableSeconds < 60)
```

An hour is **available** if the battery hits hard SOC limits for less than 60 seconds.

### 2.5 Revenue Calculation

```
for each hour:
    if available:
        revenue = powerMw * priceEurPerMw
        availableHours++
    else:
        revenue = 0

    totalRevenue += revenue

availabilityPct = availableHours / totalHours * 100
```

---

## 3. Frequency Simulation

Generates realistic 1-second Nordic grid frequency data.

### 3.1 Profiles (Based on Real Data)

| Profile | % Outside Band | Events/Hour | Avg Duration |
|---------|----------------|-------------|--------------|
| high | 0.86% | 5.4 | 5.7s |
| medium | 0.50% | 2.0 | 8.6s |
| low | 0.24% | 1.3 | 6.9s |

### 3.2 Algorithm

```
# Initialize at 50.0 Hz
frequency[0] = 50.0

for each second:
    # Mean-reversion (Ornstein-Uhlenbeck)
    meanReversionCoef = 0.002
    volatility = 0.003

    deviation = -meanReversionCoef * (frequency[i-1] - 50.0)
    noise = randomNormal(0, volatility)
    frequency[i] = frequency[i-1] + clamp(deviation + noise, -0.05, 0.05)

# Add excursion events
numEvents = poissonRandom(eventsPerHour * hours)
for each event:
    startTime = uniformRandom(0, totalSeconds)
    duration = exponentialRandom(avgEventDuration)
    magnitude = min(0.5, exponentialRandom(0.03) + 0.1)
    direction = (random() < 0.55) ? -1 : +1   # 55% under-frequency

    # Smooth ramp in/out (5 samples)
    apply event with ramping

# Add high-frequency noise
for each second:
    frequency[i] += randomNormal(0, 0.005)
    frequency[i] = clamp(frequency[i], 49.0, 51.0)
```

---

## 4. Price Data Format

**Source:** Nordic TSO (Statnett) historical data

**CSV structure:**
```
Time(Local),Hournumber,Area,FCR-N Price EUR/MW,FCR-N Volume MW,FCR-D Price EUR/MW,FCR-D Volume MW
01.01.2024 00:00:00 +01:00,1,NO1,29.4,11,15.2,8
```

**Parsing:**
```
filter rows where Area == "NO1"
parse timestamp: "DD.MM.YYYY HH:MM:SS +HH:MM" → Date
extract: price = "FCR-N Price EUR/MW"
sort by timestamp ascending
```

---

## 5. Data Flow

```
┌─────────────────────┐
│   Battery Config    │
│  MW, MWh, eff, SOC  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Load Price CSV    │     │ Generate Frequency  │
│   Filter NO1 area   │     │ 31.5M samples/year  │
│   ~8760 hourly      │     │ 1-second resolution │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          │     ┌─────────────────────┤
          │     │                     │
          ▼     ▼                     │
┌─────────────────────┐               │
│   Simulate SOC      │◄──────────────┘
│   Per-second loop:  │
│   - FCR activation  │
│   - NEM management  │
│   - Efficiency loss │
│   - Limit checking  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Calculate Revenue  │
│  price × MW × avail │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│      Results        │
│  - Total EUR        │
│  - Availability %   │
│  - Hourly breakdown │
└─────────────────────┘
```

---

## 6. Output Data Structure

### 6.1 Hourly Record
```javascript
{
  timestamp: Date,
  price: number,           // EUR/MW
  available: boolean,
  revenue: number,         // EUR
  socStart: number,        // 0-1
  socEnd: number           // 0-1
}
```

### 6.2 Monthly Summary
```javascript
{
  month: "2024-01",
  revenue: number,         // Sum EUR
  hours: number,           // Available hours
  avgPrice: number         // Avg EUR/MW
}
```

### 6.3 Frequency Summary
```javascript
{
  pctOutsideBand: number,  // % time outside 49.9-50.1
  pctUnder: number,        // % time under 49.9
  pctOver: number,         // % time over 50.1
  histogram: number[],     // Distribution counts
  histogramLabels: string[]
}
```

---

## 7. Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| FCR-N band | 49.9-50.1 Hz | Activation range |
| NEM power | 34% | Energy management power budget |
| NEM window | 120s | Rolling average duration |
| NEM buffer | 25% | SOC hysteresis buffer |
| Start SOC | 50% | Initial state |
| Unavailable threshold | 60s | Max seconds at limits per hour |

---

## 8. Assumptions

1. Battery participates in every available hour (100% bid)
2. Only FCR-N product (no FCR-D)
3. Only NO1 price area (Oslo/Southeast Norway)
4. Price unit is EUR/MW for 1 hour
5. NEM uses 34% power budget (industry standard)
6. Square root efficiency model (splits round-trip loss)
7. Frequency simulation seed = 42 (reproducible)

---

## 9. Implementation Notes

### Efficiency Model
Round-trip efficiency is split using square root:
- 90% round-trip → 94.87% each direction
- Charge: `deltaEnergy / sqrt(0.90)`
- Discharge: `deltaEnergy * sqrt(0.90)`

### Memory Consideration
Full year at 1-second = 31,536,000 samples.
Use Float64Array for frequency data (~252 MB).

### Availability Logic
Conservative: if battery hits limits for >60 seconds in an hour, that hour earns no revenue. This accounts for market requirements around continuous service.

### NEM Hysteresis
The two-threshold system (enable at 25%/75%, disable at 50%) prevents rapid cycling between charge/discharge states.

---

## 10. Formulas Summary

| Calculation | Formula |
|-------------|---------|
| FCR activation | `(50 - freq) / 0.1 × MW` |
| NEM power | `0.34 × MW × nemSignal` |
| Energy change | `totalPower / 3600` per second |
| Charge loss | `delta / sqrt(eff)` |
| Discharge loss | `delta × sqrt(eff)` |
| Hour available | `unavailSeconds < 60` |
| Revenue | `MW × price × available` |
| Availability % | `availHours / totalHours × 100` |

---

## 11. File Structure (Reference)

```
project/
├── main.js              # Electron main process, file I/O
├── preload.js           # IPC bridge
└── renderer/
    ├── app.js           # UI orchestration, data loading
    ├── calculator.js    # SOC simulation, revenue calc
    ├── frequency.js     # Grid frequency simulation
    └── index.html       # UI structure
```

---

## 12. Price Data Requirements

**Files needed:**
- `PrimaryReservesD-1-YYYY.csv` per year

**Required columns:**
- `Time(Local)` - Timestamp with timezone
- `Area` - Price area (filter for NO1)
- `FCR-N Price EUR/MW` - Hourly price

**Row count:** ~8760 per year (hourly)
