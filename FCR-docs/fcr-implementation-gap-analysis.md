# FCR Prequalification Test System - Gap Analysis

**Date:** 2026-01-09
**Analyst:** Claude Code
**Reference Documents:**

- Test Program for Prequalification of FCR in the Nordic Synchronous Area (v2025-03-28)
- Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area
- Norsk støttedokument for FCR-kravene (v2024-01-05)

---

## Executive Summary

The FCR prequalification test system implementation is **approximately 70% complete**. The core architecture (simulator, logger, test runner, CSV exporter) is functional, but there are **critical issues with test sequences** that would cause prequalification failures if used as-is.

### Key Findings

| Category              | Status           | Impact                        |
| --------------------- | ---------------- | ----------------------------- |
| FCR-N Step Response   | ✅ Correct       | Ready for testing             |
| FCR-D Fast Ramp Tests | ❌ **Incorrect** | Will fail prequalification    |
| Sine Tests            | ✅ Correct       | Ready for testing             |
| Data Logging          | ⚠️ Incomplete    | Missing TSO-required fields   |
| CSV Export            | ⚠️ Incomplete    | Missing some required columns |
| 1-Hour Operation Test | ❌ Missing       | Required for prequalification |

---

## 1. FCR-D Fast Ramp Test Sequences (CRITICAL)

### Problem Description

The FCR-D upwards and downwards fast ramp test templates stored in `fcr_test_template` have incorrect frequency values and ramp rates that do not match the TSO specification.

### Reasoning

I compared the stored sequences against TSO Test Program Tables 6 and 9. The TSO specification is very precise about:

- **Ramp 1**: Must test activation performance with a specific steep ramp (0.14 Hz/s to 49.45/50.55 Hz)
- **Ramp 2**: Must test deactivation with a slower ramp (0.09 Hz/s)
- **Ramp 5**: Must test activation performance at MORE EXTREME frequencies (49.0/51.0 Hz, not 49.5/50.5 Hz)

The reason Ramp 5 goes to 49.0/51.0 Hz is to test the entity's response to frequencies outside the normal FCR-D activation band. This is labeled "Activation performance test 2" and verifies the response at extreme under-frequency/over-frequency conditions.

### FCR-D Upwards Fast Ramp Comparison

**TSO Table 6 Requirements:**

| Ramp | Start [s] | End [s] | Ramp Rate [Hz/s] | Frequency [Hz] | Purpose                       |
| ---- | --------- | ------- | ---------------- | -------------- | ----------------------------- |
| 0    | 0         | 30      | 0                | 49.9           | Stabilize                     |
| 1    | 30        | 33.1    | **0.14**         | **49.45**      | Activation test 1             |
| 2    | 34.9      | 39.9    | **0.09**         | 49.9           | Deactivation test 1           |
| 3    | 90        | 91.7    | 0.24             | 49.5           | Steady state full (300s/900s) |
| 4    | 390       | 391.7   | 0.24             | 49.9           | Steady state zero             |
| 5    | 690       | 693.8   | 0.24             | **49.0**       | Activation test 2             |
| 6    | 750       | 754.2   | 0.24             | 50.0           | Deactivation test 2           |

**Current Implementation:**

| Step | Time [s] | Ramp Rate [Hz/s] | Frequency [Hz] | Issue                              |
| ---- | -------- | ---------------- | -------------- | ---------------------------------- |
| 0    | 0        | 0                | 49.9           | ✅ OK                              |
| 1    | 30       | **0.1**          | **49.5**       | ❌ Should be 0.14 Hz/s to 49.45 Hz |
| 2    | 34       | **0.1**          | 49.9           | ❌ Should be 0.09 Hz/s             |
| 3    | 90       | 0.24             | 49.5           | ✅ OK                              |
| 4    | 390      | 0.24             | 49.9           | ✅ OK                              |
| 5    | 690      | 0.24             | **49.5**       | ❌ **CRITICAL: Should be 49.0 Hz** |
| 6    | 750      | 0.24             | 50.0           | ✅ OK                              |

### FCR-D Downwards Fast Ramp Comparison

**TSO Table 9 Requirements:**

| Ramp | Start [s] | End [s] | Ramp Rate [Hz/s] | Frequency [Hz] | Purpose                       |
| ---- | --------- | ------- | ---------------- | -------------- | ----------------------------- |
| 0    | 0         | 30      | 0                | 50.1           | Stabilize                     |
| 1    | 30        | 33.1    | **0.14**         | **50.55**      | Activation test 1             |
| 2    | 34.9      | 39.9    | **0.09**         | 50.1           | Deactivation test 1           |
| 3    | 90        | 91.7    | 0.24             | 50.5           | Steady state full (300s/900s) |
| 4    | 390       | 391.7   | 0.24             | 50.1           | Steady state zero             |
| 5    | 690       | 693.8   | 0.24             | **51.0**       | Activation test 2             |
| 6    | 750       | 754.2   | 0.24             | 50.0           | Deactivation test 2           |

**Current Implementation:**

| Step | Time [s] | Ramp Rate [Hz/s] | Frequency [Hz] | Issue                              |
| ---- | -------- | ---------------- | -------------- | ---------------------------------- |
| 0    | 0        | 0                | 50.1           | ✅ OK                              |
| 1    | 30       | **0.1**          | **50.5**       | ❌ Should be 0.14 Hz/s to 50.55 Hz |
| 2    | 34       | **0.1**          | 50.1           | ❌ Should be 0.09 Hz/s             |
| 3    | 90       | 0.24             | 50.5           | ✅ OK                              |
| 4    | 390      | 0.24             | 50.1           | ✅ OK                              |
| 5    | 690      | 0.24             | **50.5**       | ❌ **CRITICAL: Should be 51.0 Hz** |
| 6    | 750      | 0.24             | 50.0           | ✅ OK                              |

### Why This Matters

The TSO evaluates:

1. **Activation performance** (Ramps 1 and 5) - How quickly the entity responds to frequency deviations
2. **Deactivation performance** (Ramps 2 and 6) - How the entity returns to zero activation
3. **Steady state response** (Ramps 3 and 4) - Sustained power delivery accuracy

Using wrong frequencies means:

- Ramp 1: Testing at 49.5/50.5 Hz instead of 49.45/50.55 Hz misses the "just outside normal band" activation test
- Ramp 5: Testing at 49.5/50.5 Hz instead of 49.0/51.0 Hz completely misses the extreme frequency response test

---

## 2. FCR-N/FCR-D Combination Tests (Missing)

### Problem Description

TSO Tables 6 and 9 include Ramps 7 and 8 for testing combined FCR-N and FCR-D provision. These are completely absent from the current templates.

### Reasoning

From TSO Test Program Section 4.1:

> "Entities that are intended to sometimes provide both FCR-N and FCR-D upwards at the same time shall have FCR-N active during the high droop tests to test the combination of FCR-N and FCR-D upwards. The last two ramps (Ramp number 7 and 8) need to be included only when testing the combined provision of FCR-N and FCR-D upwards."

**Required additional ramps:**

| Ramp | FCR-D Up | FCR-D Down | Purpose                   |
| ---- | -------- | ---------- | ------------------------- |
| 7    | 49.7 Hz  | 50.3 Hz    | Combined FCR-N/FCR-D test |
| 8    | 49.89 Hz | 50.11 Hz   | Combined FCR-N/FCR-D test |

### Impact Assessment

If the battery will provide both FCR-N and FCR-D:

- **Required**: Must add Ramps 7 and 8
- **Duration**: Each 300 seconds at 0.24 Hz/s ramp rate

If the battery will only provide FCR-D (not combined with FCR-N):

- **Not required**: Can skip Ramps 7 and 8

**Recommendation:** Clarify operational intent and add combination test templates if needed.

---

## 3. Endurance Test Duration (Incorrect)

### Problem Description

The current fast ramp templates use 300s (5 minutes) for Ramp 3 steady state. For non-LER endurance testing, this should be 900s (15 minutes).

### Reasoning

From TSO Test Program Table 6 note:

> "The waiting time between ramp 3 and ramp 4 should be increased to 900 seconds when the endurance is tested (non-LER units only)."

The battery is classified as **Non-LER** (2080 kWh usable = exactly 2 hours × 1040 kW), so:

- Standard tests: 300s (5 min) at full activation ✅
- Endurance test: 900s (15 min) at full activation ❌ Missing

### Required Templates

Need to create endurance variants:

1. `FCR-D Up Fast Ramp (Endurance)` - Step 3 duration = 900s
2. `FCR-D Down Fast Ramp (Endurance)` - Step 3 duration = 900s

---

## 4. FCR-N Step Response Test (Correct)

### Verification

I compared the stored sequence against TSO Table 3:

**TSO Table 3:**

| Step | Start [min] | Duration [min] | Frequency [Hz] |
| ---- | ----------- | -------------- | -------------- |
| -    | 0           | 0.5            | 50.0           |
| Pre  | 0.5         | 0.5            | 49.95          |
| 0    | 1           | 5              | 50.0           |
| 1    | 6           | 5/15           | 49.9           |
| 2    | 11/21       | 5/15           | 50.1           |
| 3    | 16/36       | 5              | 50.0           |

**Current Implementation:**

| Step | Time [s] | Duration [s] | Frequency [Hz] | Status |
| ---- | -------- | ------------ | -------------- | ------ |
| 0    | 0        | 30           | 50.0           | ✅     |
| 1    | 30       | 30           | 49.95          | ✅     |
| 2    | 60       | 300          | 50.0           | ✅     |
| 3    | 360      | 300          | 49.9           | ✅     |
| 4    | 660      | 300          | 50.1           | ✅     |
| 5    | 960      | 300          | 50.0           | ✅     |

**Conclusion:** FCR-N Step Response is correctly implemented.

---

## 5. Sine Test Parameters (Correct)

### Verification

I verified all sine test parameters against TSO Tables 4, 7, and 10:

| Product    | Center Frequency | Amplitude | Status     |
| ---------- | ---------------- | --------- | ---------- |
| FCR-N      | 50.0 Hz          | ±0.1 Hz   | ✅ Correct |
| FCR-D Up   | 49.7 Hz          | ±0.1 Hz   | ✅ Correct |
| FCR-D Down | 50.3 Hz          | ±0.1 Hz   | ✅ Correct |

**Period coverage:**

| Period [s] | Total Periods | Stationary | Required        | Status |
| ---------- | ------------- | ---------- | --------------- | ------ |
| 10         | 20            | 5          | All             | ✅     |
| 15         | 15            | 5          | All             | ✅     |
| 25         | 10            | 5          | All             | ✅     |
| 40         | 7             | 5          | All             | ✅     |
| 50         | 7             | 5          | All             | ✅     |
| 60         | 7             | 5          | All             | ✅     |
| 70         | 7             | 5          | All             | ✅     |
| 90         | 7             | 5          | Mode shift only | ✅     |
| 150        | 4             | 3          | Mode shift only | ✅     |
| 300        | 3             | 2          | Mode shift only | ✅     |

**Note:** Periods 90, 150, 300s are only required for entities with mode shifting. If the battery doesn't use mode shifting, these can be skipped.

---

## 6. Data Logging Fields (Incomplete)

### Problem Description

The `fcr_measurement_raw` table is missing several fields required by TSO Table 19.

### Current Schema

```
fcr_measurement_raw:
- id (bigint)
- run_id (uuid)
- timestamp (timestamptz)
- power_kw (float)
- baseline_kw (float)
- frequency_hz (float)         -- Applied frequency
- grid_frequency_hz (float)    -- Measured grid frequency
- soc_percent (float)
- nem_active (boolean)
- aem_active (boolean)
- remaining_endurance_min (float)
- created_at (timestamptz)
```

### TSO Table 19 Requirements Analysis

| Signal                         | TSO Header        | Required For     | Current Status       |
| ------------------------------ | ----------------- | ---------------- | -------------------- |
| Instantaneous active power     | InsAcPow          | Test             | ✅ power_kw          |
| Measured grid frequency        | GridFreq          | Test             | ✅ grid_frequency_hz |
| Applied frequency              | ApplFreqSig       | Test             | ✅ frequency_hz      |
| Power baseline                 | CalcBaseline      | Test             | ✅ baseline_kw       |
| Control mode FCR-N             | ContMode_Fcrn     | Test             | ❌ Missing           |
| Control mode FCR-D up          | ContMode_FcrdUp   | Test             | ❌ Missing           |
| Control mode FCR-D down        | ContMode_FcrdDo   | Test             | ❌ Missing           |
| Maintained capacity FCR-N      | Cap_Fcrn          | Per test         | ❌ Missing           |
| Maintained capacity FCR-D up   | Cap_FcrdUp        | Per test         | ❌ Missing           |
| Maintained capacity FCR-D down | Cap_FcrdDo        | Per test         | ❌ Missing           |
| Status FCR-N                   | ContStatus_Fcrn   | Per test         | ❌ Missing           |
| Status FCR-D up                | ContStatus_FcrdUp | Per test         | ❌ Missing           |
| Status FCR-D down              | ContStatus_FcrdDo | Per test         | ❌ Missing           |
| Min power                      | Pmin              | Per test         | ❌ Missing           |
| Max power                      | Pmax              | Per test         | ❌ Missing           |
| Setpoint before FCR            | ContSetP          | Per test         | ❌ Missing           |
| SOC                            | SOC               | Test (batteries) | ✅ soc_percent       |
| Remaining endurance FCR-N      | ResSize_Fcrn      | LER only         | ⚠️ Generic only      |
| Remaining endurance FCR-D up   | ResSize_FcrdUp    | LER only         | ⚠️ Generic only      |
| Remaining endurance FCR-D down | ResSize_FcrdDo    | LER only         | ⚠️ Generic only      |
| NEM status FCR-N               | NEM_Fcrn          | LER only         | ⚠️ Generic only      |
| AEM status FCR-N               | AEM_Fcrn          | LER only         | ⚠️ Generic only      |
| Activated NEM power            | NEM*MW*\*         | LER only         | ❌ Missing           |

### Reasoning

The TSO requires per-product tracking because:

1. **Control mode**: Different parameter sets may be used for different products
2. **Capacity**: The maintained capacity varies per product and test
3. **Status**: Each product can be independently enabled/disabled
4. **LER fields**: Energy management operates independently per product

Since the battery is **Non-LER**, the LER-specific fields (NEM, AEM, endurance per product) are technically not required. However, having them provides flexibility for future use or reduced-capacity testing.

### Recommended Schema Additions

```sql
-- Per-test metadata (could be in fcr_test_run instead)
ALTER TABLE fcr_measurement_raw ADD COLUMN IF NOT EXISTS
    control_mode_id TEXT,           -- Current control mode/parameter set
    capacity_fcr_n_mw FLOAT,        -- Maintained FCR-N capacity
    capacity_fcr_d_up_mw FLOAT,     -- Maintained FCR-D up capacity
    capacity_fcr_d_down_mw FLOAT,   -- Maintained FCR-D down capacity
    status_fcr_n BOOLEAN,           -- FCR-N active
    status_fcr_d_up BOOLEAN,        -- FCR-D up active
    status_fcr_d_down BOOLEAN,      -- FCR-D down active
    pmin_mw FLOAT,                  -- Minimum power
    pmax_mw FLOAT,                  -- Maximum power
    setpoint_mw FLOAT;              -- Setpoint before FCR
```

---

## 7. Missing Test Types

### 7.1 One-Hour Active FCR Provision (Section 9.2)

**TSO Requirement:**

> "A set of one (1) hour of logged data... shall be submitted to the TSO. Data logging during this hour should then correspond to normal operation... The sampling rate shall be at least 1 Hz."

**Current Status:**

- Logger supports `--mode operation` which reads from battery only (no simulator)
- No template or workflow exists for this test
- No 1 Hz logging option (currently 10 Hz, which exceeds requirement)

**What's Needed:**

1. Create "1-Hour Operation" test template
2. Document workflow for running without simulator
3. Ensure CSV export works for operation data

### 7.2 Frequency Measurement Equipment Test (Section 9.1)

**TSO Requirement:**
If using internal frequency signal (which this system does), must document frequency measurement time constant via one of:

1. Separate test of measurement loop
2. Documentation from supplier
3. Reference to previous tests
4. Use default value T_FME = 1 second

**Current Status:** Not addressed

**Recommendation:** Document which option will be used. If option 1, need to create test procedure.

### 7.3 Linearity Tests (Sections 3.3, 4.3, 5.3)

**TSO Requirement:**
Required for entities with **non-continuous** response.

**FCR-N Linearity:** 20 mHz steps from 50.0 → 49.9 → 50.1 → 50.0 Hz
**FCR-D Linearity:** 100 mHz steps (49.9 → 49.5 for Up, 50.1 → 50.5 for Down)

**Current Status:** No templates exist

**Assessment:** Battery likely has continuous response, so linearity tests may not be required. Should confirm with TSO.

---

## 8. CSV Export Analysis

### Current Implementation Review

The CSV exporter (`csv_exporter.py`) produces:

- Correct datetime format: `YYYYMMDDThhmmss.nnn`
- Correct delimiter: comma
- Correct decimal: period
- Columns: DateTime, InsAcPow, GridFreq, ApplFreqSig, CalcBaseline, SOC

### Missing Elements

1. **Per-product columns for LER** (if applicable):
   - ResSize_Fcrn, ResSize_FcrdUp, ResSize_FcrdDo
   - NEM_Fcrn, NEM_FcrdUp, NEM_FcrdDo
   - AEM_Fcrn, AEM_FcrdUp, AEM_FcrdDo
   - NEM_MW_Fcrn, NEM_MW_FcrdUp, NEM_MW_FcrdDo

2. **Sine test file separation**: TSO Section 11.1 states:

   > "Regarding the data from sine wave tests, each sine sweep should be logged into a separate file."

   Current exporter creates one file per run. Should split sine tests into separate files per period.

3. **Filename format verification**: Current format appears correct but should verify:
   ```
   [Resource]_[Service]_[TestType]_[Area]_[Timezone]_[Interval]_[SamplingRate].csv
   ```

---

## 9. Operational Considerations

### 9.1 Four Operational Conditions

TSO requires testing at up to 4 operational conditions:

1. High load, high droop
2. High load, low droop
3. Low load, high droop
4. Low load, low droop

**Current Status:** No mechanism to track which condition is being tested.

**Battery Exception:** Per TSO Section 10:

> "For technologies where power setpoint does not influence the FCR provision capabilities, testing at a single power setpoint is sufficient for all tests, e.g. many types of batteries."

**Recommendation:** Confirm with TSO that battery qualifies for single-condition testing.

### 9.2 Battery Pre-conditioning

Some tests (especially LER energy management) require specific starting SOC. No mechanism exists to:

- Set battery to target SOC before test
- Verify SOC is within acceptable range
- Abort if pre-conditions not met

### 9.3 Test Abort Safety

Current implementation returns to 50.0 Hz on abort. Should verify:

- Battery handles sudden frequency changes gracefully
- No protection trips occur
- Power ramps down safely

---

## 10. Summary of Required Fixes

### Priority 1: Critical (Blocks Prequalification)

| Item                          | Description                        | Effort     |
| ----------------------------- | ---------------------------------- | ---------- |
| Fix FCR-D Up Fast Ramp        | Correct frequencies and ramp rates | SQL update |
| Fix FCR-D Down Fast Ramp      | Correct frequencies and ramp rates | SQL update |
| Add FCR-D Endurance templates | 900s duration on step 3            | SQL insert |
| Add 1-Hour Operation workflow | Template and documentation         | Medium     |

### Priority 2: Important (May Block Prequalification)

| Item                           | Description                            | Effort      |
| ------------------------------ | -------------------------------------- | ----------- |
| Add combination test templates | Ramps 7 & 8 if providing FCR-N + FCR-D | SQL insert  |
| Expand logging schema          | Add TSO Table 19 fields                | Migration   |
| Update CSV exporter            | Add missing columns                    | Code change |
| Sine file separation           | Split by period                        | Code change |

### Priority 3: Nice to Have

| Item                           | Description        | Effort      |
| ------------------------------ | ------------------ | ----------- |
| Add linearity test templates   | If required by TSO | SQL insert  |
| Operational condition tracking | Metadata per test  | Schema + UI |
| Battery pre-conditioning       | SOC targeting      | Code change |
| Frequency measurement test     | If using option 1  | New feature |

---

## Appendix A: Corrected FCR-D Fast Ramp Sequences

### FCR-D Upwards Fast Ramp (Corrected)

```json
[
  {
    "step": 0,
    "time_s": 0,
    "frequency_hz": 49.9,
    "duration_s": 30,
    "ramp_rate_hz_s": 0,
    "comment": "Wait until power is stable"
  },
  {
    "step": 1,
    "time_s": 30,
    "frequency_hz": 49.45,
    "duration_s": 4.9,
    "ramp_rate_hz_s": 0.14,
    "comment": "Activation performance test 1"
  },
  {
    "step": 2,
    "time_s": 34.9,
    "frequency_hz": 49.9,
    "duration_s": 55.1,
    "ramp_rate_hz_s": 0.09,
    "comment": "Deactivation test 1"
  },
  {
    "step": 3,
    "time_s": 90,
    "frequency_hz": 49.5,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state full activation"
  },
  {
    "step": 4,
    "time_s": 390,
    "frequency_hz": 49.9,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state zero activation"
  },
  {
    "step": 5,
    "time_s": 690,
    "frequency_hz": 49.0,
    "duration_s": 60,
    "ramp_rate_hz_s": 0.24,
    "comment": "Activation performance test 2"
  },
  {
    "step": 6,
    "time_s": 750,
    "frequency_hz": 50.0,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Deactivation test 2"
  }
]
```

### FCR-D Downwards Fast Ramp (Corrected)

```json
[
  {
    "step": 0,
    "time_s": 0,
    "frequency_hz": 50.1,
    "duration_s": 30,
    "ramp_rate_hz_s": 0,
    "comment": "Wait until power is stable"
  },
  {
    "step": 1,
    "time_s": 30,
    "frequency_hz": 50.55,
    "duration_s": 4.9,
    "ramp_rate_hz_s": 0.14,
    "comment": "Activation performance test 1"
  },
  {
    "step": 2,
    "time_s": 34.9,
    "frequency_hz": 50.1,
    "duration_s": 55.1,
    "ramp_rate_hz_s": 0.09,
    "comment": "Deactivation test 1"
  },
  {
    "step": 3,
    "time_s": 90,
    "frequency_hz": 50.5,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state full activation"
  },
  {
    "step": 4,
    "time_s": 390,
    "frequency_hz": 50.1,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state zero activation"
  },
  {
    "step": 5,
    "time_s": 690,
    "frequency_hz": 51.0,
    "duration_s": 60,
    "ramp_rate_hz_s": 0.24,
    "comment": "Activation performance test 2"
  },
  {
    "step": 6,
    "time_s": 750,
    "frequency_hz": 50.0,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Deactivation test 2"
  }
]
```

### FCR-D Upwards Fast Ramp (Endurance - 900s)

```json
[
  {
    "step": 0,
    "time_s": 0,
    "frequency_hz": 49.9,
    "duration_s": 30,
    "ramp_rate_hz_s": 0,
    "comment": "Wait until power is stable"
  },
  {
    "step": 1,
    "time_s": 30,
    "frequency_hz": 49.45,
    "duration_s": 4.9,
    "ramp_rate_hz_s": 0.14,
    "comment": "Activation performance test 1"
  },
  {
    "step": 2,
    "time_s": 34.9,
    "frequency_hz": 49.9,
    "duration_s": 55.1,
    "ramp_rate_hz_s": 0.09,
    "comment": "Deactivation test 1"
  },
  {
    "step": 3,
    "time_s": 90,
    "frequency_hz": 49.5,
    "duration_s": 900,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state full - 15 min ENDURANCE"
  },
  {
    "step": 4,
    "time_s": 990,
    "frequency_hz": 49.9,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Steady state zero activation"
  },
  {
    "step": 5,
    "time_s": 1290,
    "frequency_hz": 49.0,
    "duration_s": 60,
    "ramp_rate_hz_s": 0.24,
    "comment": "Activation performance test 2"
  },
  {
    "step": 6,
    "time_s": 1350,
    "frequency_hz": 50.0,
    "duration_s": 300,
    "ramp_rate_hz_s": 0.24,
    "comment": "Deactivation test 2"
  }
]
```

---

## Appendix B: SQL Fixes

See separate file: `fcr-template-fixes.sql` (to be generated on request)

---

_End of Gap Analysis_
