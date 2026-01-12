# FCR Pre-Qualification Plan

## Overview

Planning document for FCR pre-qualification in the Nordic synchronous area.

**Logging**: All test data and results stored in Supabase at 10Hz.

## Reference Documents

- [Test Program (v2025-03-28)](test-program-for-prequalification-of-fcr-in-the-nordic-synchronous-area-v2025-03-28.md)
- [Technical Requirements](technical-requirements-for-frequency-containment-reserve-provision-in-the-nordic-synchronous-area.md)
- [Norwegian Requirements (v2024-01-05)](norsk-stottedokument-for-fcr-kravene-v2024-01-05.md)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  test_plan   │  │  test_log    │  │  fcr_measurement_raw     │   │
│  │  (schedule)  │  │  (results)   │  │  (10Hz power+freq+soc)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                        ▲
         │ read plan                              │ insert 10Hz
         │                                        │
┌────────┴────────┐                    ┌──────────┴──────────┐
│  Test Runner    │ ──set freq──────▶  │  WM20 Simulator     │
│  Service        │                    │  (Modbus TCP)       │
└─────────────────┘                    └─────────────────────┘
                                                 │
                                       freq via Modbus TCP
                                                 │
                                                 ▼
                              ┌──────────────────────────────┐
                              │  Battery Controller          │
                              │  192.168.8.119               │
                              │  (reads freq, responds)      │
                              └──────────────────────────────┘
                                                 │
                                       power response
                                                 │
                                                 ▼
                              ┌──────────────────────────────┐
                              │  10Hz Logger Service         │
                              │  (reads power+SOC from batt) │
                              │  (reads freq from simulator) │
                              └──────────────────────────────┘
```

---

## Components to Build

### 1. WM20 Modbus Simulator

- Serves frequency values over Modbus TCP (port 502)
- Exposes same registers as real WM20 meter (0x0088 for frequency)
- Frequency controlled via local API or shared state
- Must support: steps, ramps, sine waves

### 2. 10Hz Logger Service

- Reads from battery (power, SOC) via Modbus TCP
- Reads applied frequency from simulator
- Inserts to Supabase every 100ms (10Hz)
- CSV format compatible with TSO requirements

### 3. Supabase Tables

- `fcr_test_plan`: Test schedule definition (frequencies, durations, ramp rates)
- `fcr_test_run`: Active/completed test runs
- `fcr_measurement_raw`: 10Hz measurement data (timestamp, power, freq, soc)

### 4. Test Runner Service

- Reads test plan from Supabase
- Controls simulator frequency according to plan
- Tracks test progress and timing
- Handles step/ramp/sine generation

---

## Test Sequences Required

### FCR-N Tests (49.9-50.1 Hz band)

**Step Response Test** (4 operational conditions):

```
Time    Freq      Duration
0:00    50.0 Hz   30s (stabilize)
0:30    49.95 Hz  30s (pre-step, handle backlash)
1:00    50.0 Hz   5 min
6:00    49.9 Hz   5 min (or 15 min for endurance)
11:00   50.1 Hz   5 min (or 15 min for endurance)
16:00   50.0 Hz   5 min
```

**Sine Response Tests** (high load, high droop):
| Period | Stationary Periods | Center | Amplitude |
|--------|-------------------|--------|-----------|
| 10s | 5 (20 total) | 50.0 | ±100 mHz |
| 15s | 5 (15 total) | 50.0 | ±100 mHz |
| 25s | 5 (10 total) | 50.0 | ±100 mHz |
| 40s | 5 (7 total) | 50.0 | ±100 mHz |
| 50s | 5 (7 total) | 50.0 | ±100 mHz |
| 60s | 5 (7 total) | 50.0 | ±100 mHz |
| 70s | 5 (7 total) | 50.0 | ±100 mHz |
| 90s | 5 (7 total) | 50.0 | ±100 mHz |
| 150s | 3 (4 total) | 50.0 | ±100 mHz |
| 300s | 2 (3 total) | 50.0 | ±100 mHz |

### FCR-D Upwards Tests (49.5-49.9 Hz band)

**Fast Ramp Test** (4 operational conditions):

```
Ramp  Start    End      Speed      Freq    Duration   Purpose
-     0s       30s      -          49.9    30s        Stabilize
1     30s      33.1s    0.14 Hz/s  49.45   4.9s       Activation test 1
2     34.9s    39.9s    0.09 Hz/s  49.9    55.1s      Deactivation test 1
3     90s      91.7s    0.24 Hz/s  49.5    300s/900s* Steady state full
4     390s     391.7s   0.24 Hz/s  49.9    ≥300s      Steady state zero
5     690s     693.8s   0.24 Hz/s  49.0    60s        Activation test 2
6     750s     754.2s   0.24 Hz/s  50.0    ≥300s      Deactivation test 2
7**   1050s    1050.8s  0.24 Hz/s  49.7    300s       FCR-N/D combo
8**   1350s    1350.4s  0.24 Hz/s  49.89   300s       FCR-N/D combo
```

\*900s for endurance test
\*\*Only when testing FCR-N + FCR-D combination

**Sine Response Tests** (high load, low droop):
Same periods as FCR-N, but centered at 49.7 Hz

### LER Energy Management Tests

**NEM/AEM Test for FCR-D Upwards**:

```
Step  Time      Freq    Duration   NEM  AEM  Purpose
-     0:00      49.91   30s        Off  Off  Stabilize
1     0:30      49.5    10 min     Off  Off  Deplete until NEM threshold
2     10:30     49.91   2.5 min    On   Off  NEM activates in normal band
3     13:00     49.5    15 min     Off  On   Hold 5 min after AEM activates
4     28:00     49.91   15 min     On→Off Off Hold until both deactivate
```

---

## Measurement Requirements

| Signal         | Accuracy | Resolution | Sample Rate |
| -------------- | -------- | ---------- | ----------- |
| Power (≥10 MW) | ±0.5%    | 0.01 MW    | 10 Hz       |
| Frequency      | ±10 mHz  | 5 mHz      | 10 Hz       |
| SOC            | -        | -          | 10 Hz       |

---

## Data Format (TSO Compatible CSV)

Filename: `[Resource]_[Service]_[TestType]_[Area]_[Timezone]_[Interval]_[SamplingRate].csv`

Example: `BESS01_FcrdUp_FastRamp_NO5_UTC_20260105T1000-20260105T1200_100ms.csv`

Columns:

```
DateTime,InsAcPow,GridFreq,ApplFreqSig,CalcBaseline,SOC
20260105T100000.000,0.500,49.900,49.900,0.000,50.000
20260105T100000.100,0.520,49.850,49.850,0.000,49.998
...
```

---

## Tasks

- [ ] WM20 Modbus simulator (serves frequency values over Modbus TCP)
- [ ] 10Hz logger service (reads frequency + battery power + SOC, uploads to Supabase)
- [ ] Supabase tables for test plan/schedule
- [ ] Local service that reads plan from Supabase and adjusts simulator Hz

---

## Notes

- Battery is LER (Limited Energy Reservoir) since <2 hour full activation endurance
- Must implement NEM (Normal Energy Management) at 20 min remaining
- Must implement AEM (Alert Energy Management) at 5 min remaining
- For batteries, TSO may grant exemption to test at single power setpoint only
- Sampling rate 1 Hz acceptable if TSO grants exception for fast/stable response

---

_Last updated: 2026-01-05_
