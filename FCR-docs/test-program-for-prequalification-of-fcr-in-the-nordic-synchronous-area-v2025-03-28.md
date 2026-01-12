# **Test Program for Prequalification of FCR in the Nordic Synchronous Area**

28 March 2025

## **Introduction**

This document describes the tests that shall be performed for prequalifying providing entities in the Nordic power system, for FCR-N, dynamic FCR-D upwards/downwards and static FCR-D upwards/downwards respectively. The document contains a step-by-step instruction on how to perform the testing.

- Section 1 contains a summary of the process to plan for prequalification. This process is recommended to initiate well in advance of the prequalification testing.
- Section 2 describes preparations to perform just prior to performing the tests.
- Section 3 specifies the tests to perform for FCR-N, if applicable.
- Section 4 specifies the tests to perform for dynamic FCR-D upwards, if applicable.
- Section 5 specifies the tests to perform for dynamic FCR-D downwards, if applicable.
- Section 6 specifies the tests to perform for static FCR-D upwards, if applicable.
- Section 7 specifies the tests to perform for static FCR-D downwards, if applicable.
- Section 8 specifies the additional energy management tests to perform for entities with LER.
- Section 9 specifies the tests to be performed once for all prequalifying entities.
- Section 10 outlines situations where certain tests can be omitted and where test results can be reused.
- Section 11 indicates tasks to perform after the testing, to handle the test results and to prepare for the formal application.

For a description of the technical requirements, how the results will be evaluated, etc., please refer to the document _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area_. All tests must be accepted, and all applicable tests are required.

## **1. Planning for prequalification**

Prior to performing the prequalification tests, the applying reserve provider should ensure compliance with the following items. Contact with the reserve connecting TSO should be established well in advance.

| ❑   | Take note of the current regulations and technical requirements.                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❑   | Ensure that all documents used for reference are the most recent provided by the relevant TSO.                                                                                                                                                                                                                                                                                                                                    |
| ❑   | Perform analysis of the ability of the entity to be prequalified to comply with the technical requirements and aim to find suitable controller parameters.                                                                                                                                                                                                                                                                        |
| ❑   | Consider if the parameter settings are such that the dynamic behaviour of the controller is scaled linearly with the gain (1/e<sub>p</sub>).                                                                                                                                                                                                                                                                                      |
| ❑   | Ensure that the TSO provided IT-tool, where the provider chooses to use it, is the latest version.                                                                                                                                                                                                                                                                                                                                |
| ❑   | Ensure that uncertainties and/or possible derogations/exceptions from testing are approved by the relevant TSO.                                                                                                                                                                                                                                                                                                                   |
| ❑   | Ensure that the relevant TSO is informed about the testing according to established processes for prequalification.                                                                                                                                                                                                                                                                                                               |
| ❑   | Plan which operational ranges the entity is to be qualified for, and associated range for capacity/droop. This determines the operational conditions where the tests have to be performed.                                                                                                                                                                                                                                        |
| ❑   | Ensure that the measurement system complies with the requirements for accuracy and resolution, summarized in Table 1.                                                                                                                                                                                                                                                                                                             |
| ❑   | Ensure that the sampling rate of the measurements in Table 1 is high enough to achieve the required measurement accuracy and measurement resolution and to supply the controller with a suitable update interval. The sampling rate for data logging during the tests shall be at least 10 Hz for FCR-D and at least 5 Hz for FCR-N, or logging thresholds of 0.01 MW for active power and 5 mHz for frequency shall be used[^1]. |

**Table 1: Minimum requirements for data logging.**

| Measured quantity | Category | Rated power[^2]    | Accuracy[^3] | Resolution            |
| ----------------- | -------- | ------------------ | ------------ | --------------------- |
| Active power      | A        | P < 1.5 MW         | ± 5 %        | 0.01 MW or 0.025%[^4] |
|                   | B        | 1.5 MW ≤ P < 10 MW | ± 1 %        |                       |
|                   | C+D      | P ≥ 10 MW          | ± 0.5 %[^5]  |                       |
| Grid frequency    | N/A      | N/A                | ± 10 mHz     | 5 mHz                 |
| Applied frequency | N/A      | N/A                | ± 10 mHz     | 5 mHz                 |

[1] In cases where the data logging requirement during test is prohibitive, the reserve connecting TSO may grant an exception to use a sampling rate for data logging of at least 1 Hz. This exception only applies in cases where the higher data rate is not needed for the evaluation, i.e. the response is fast, stable and with low noise levels.

[2] Rated power of the resource being measured.

[3] The value shall include the total inaccuracy of instrument (measurement) transformer, measurement transducer and any other equipment in the measurement system.

[4] For new installations it is recommended to use a 16-bit transducer and thus have a resolution of 0.0015%.

[5] If prequalified for the first time prior to the end of 2023, ± 1 % is allowed. This exemption shall continue to apply only until the next substantial change of the equipment.

| ❑   | Ensure that the logged data and real-time telemetry (if required by the TSO) can be provided during FCR provision.                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ❑   | Investigate the need for performing additional tests due to special considerations. This may when applicable include: Separate frequency measurement loop when using internal governor software for testing. |
| ❑   | Become familiar with the tasks to perform after the testing in Section 11.                                                                                                                                   |

### **1.1. Operational conditions**

Since the tests cannot be performed for all possible operational situations, the required test conditions are limited to the following 4 operational conditions, and corresponding controller parameter sets.

- 1. _High load, high droop_: The tests shall be carried out with the highest droop (i.e. lowest regulating strength or gain) and the highest load (i.e. highest active power output) **at which the entity will provide FCR**. Applies to FCR-N sine tests, FCR-N step tests and FCR-D ramp tests (including combination of FCR-N/FCR-D test).
- 2. _High load, low droop_: The tests shall be carried out with the lowest droop (i.e. highest regulating strength or gain) and the highest load (i.e. highest active power output) **at which the entity will provide FCR**. Applies to FCR-D sine tests, FCR-N step tests (including endurance test), FCR-D ramp tests (including endurance test) and FCR-N and FCR-D linearity test for non-continuously controlled entities.

_Regarding both high load cases (1-2)_: The provider can decide on a suitable **margin between the highest possible load and the highest load where FCR will be delivered**. This margin shall then be applied both when testing and when providing FCR. If ambient conditions limit the maximum load during the test, the test shall be carried out at the highest possible load (applying the selected margin).

- 3. _Low load, high droop_: The tests shall be carried out with the highest droop (i.e. lowest regulating strength or gain) and the lowest load (i.e. lowest active power output) **at which the entity will provide FCR**. Applies to FCR-N step tests, FCR-D ramp tests (including combination of FCR-N/FCR-D test) and FCR-N and FCR-D linearity test for non-continuously controlled entities.
- 4. _Low load, low droop_: The tests shall be carried out with the lowest droop (i.e. highest regulating strength or gain) and the lowest load (i.e. lowest active power output) **at which the entity will provide FCR**. Applies to FCR-N step tests and FCR-D ramp tests.

_Regarding both low load cases (3-4):_ The provider can decide on a suitable **margin between the lowest possible load and the lowest load where FCR will be delivered**. This margin shall then be applied both when testing and when providing FCR. If ambient conditions limit the minimum load during the test, the test shall be carried out at the lowest possible load (applying the selected margin).

Providers are allowed to include additional testing at other operational conditions in the prequalification, for example if it is not suitable to perform linear interpolation of the capacity using only the above stated operational conditions. See subsection [10]() for possible test exemptions.

## **2. Preparations for testing**

Prior to performing tests, the following points should be checked.

| ❑   | The entity should be set up such that normal frequency measurement input is replaced by an artificial frequency source. |
| --- | ----------------------------------------------------------------------------------------------------------------------- |
| ❑   | Ensure that the data outlined below is logged.                                                                          |
| ❑   | Ensure that logging equipment is correctly time synchronized (if applicable).                                           |
| ❑   | Ensure that logged data can be formatted and reported after the test as required in Section [11.1.]()                   |

The testing shall preferably be performed by using external equipment as the artificial frequency source, connected to the frequency measurement equipment. If an external signal is not feasible, an internal signal may be generated in software, but then additional testing of the frequency measurement loop has to be performed as described in Subsection [9.1.]()

#### **Signals to be continuously logged during the tests:**

- Instantaneous active power in [MW]
- Measured grid frequency in [Hz]
- Applied frequency in [Hz]
- Power baseline[^6] [MW]
- Control mode (parameter set) [id], per FCR product
- For LER entities only:
  - Remaining endurance [min], for FCR product
  - Activated NEM power [MW]
  - AEM status [on/off]

In addition, it is recommended that important states affecting the FCR response are logged as well. Such data includes but is not limited to:

- For all entities
  - Controller output signal
- For hydro entities
  - Guide vane opening [% or deg]
  - Runner blade angle (Kaplan entities) [% or deg]
  - Upstream water level above sea level [m.a.s.l]
  - Downstream water level above sea level [m.a.s.l]
- For thermal entities
  - Turbine control valve opening [%]
- For wind entities
  - Wind speed [m/s]
- For solar entities
  - Solar irradiation [W/m<sup>2</sup>]
- For batteries
  - State of charge [%]

[6] The power baseline can either be the power setpoint of the entity, or, if there is no power setpoint, a calculated value corresponding to the expected power output if frequency control was inactive.

#### **Signals to be noted once per test sequence:**

It must be designated which FCR product is tested for:

- Status on the specific FCR product (FCR-N, FCR-D up, FCR-D down) [on/off]
- Maintained capacity for the specific FCR product (FCR-N, FCR-D up, FCR-D down) in [MW]

In addition, following important states affecting the FCR response must be noted:

- For all entities
  - Minimum power in [MW]
  - Maximum power in [MW]
  - Setpoint before FCR in [%] or [MW]
- For thermal entities
  - Ambient temperature [degC]
  - Cooling water temperature [degC]

## **3. FCR–N prequalification tests**

This section contains specifications of the tests to be performed to prequalify an entity for FCR-N provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 2.]()

**Table 2: Prequalification tests for FCR-N and at which operational conditions the tests are to be performed.**

| FCR-N prequalification tests                                               | Operational conditions                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Step response test (for all entities)                                      | • High load, low droop; high load, high droop; low load, low droop; low load, high droop |
| Sine response test (for all entities)                                      | • High load, high droop[^7]                                                              |
| Linearity test (additional test for entities with non-continuous response) | • High load, low droop; low load, high droop                                             |
| Energy management test (additional test for LER entities)                  | • High load, low droop                                                                   |

In addition to the tests listed in this section, the tests described in Section [9)() must be completed once for each tested entity.

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **3.1. Step response test**

The step response test shall be performed for all FCR-N providing entities. The test is executed by performing a frequency step-response as shown in [Figure 1.)() The step sequence is described in detail in [Table 3.)()

[7] The sine tests shall be performed at the operational condition with the most challenging loading level, which is typically the high loading and high droop setting.

**Figure 1: FCR-N step response sequence.**

**Table 3: FCR-N step test sequence.**

| Step number | Start time [min] | Start time endurance test for non-LER [min] | Duration [min] | Frequency [Hz] | Comment                       |
| ----------- | ---------------- | ------------------------------------------- | -------------- | -------------- | ----------------------------- |
|             | 0                | 0                                           | 0.5            | 50.0           | Starting point                |
| Pre-step    | 0.5              | 0.5                                         | 0.5            | 49.95          | Small step to handle backlash |
| 0           | 1                | 1                                           | 5              | 50.0           | Step to f₀, P₀                |
| 1           | 6                | 6                                           | 5 / 15         | 49.9           | Step to f₁, P₁                |
| 2           | 11               | 21                                          | 5 / 15         | 50.1           | Step to f₂, P₂                |
| 3           | 16               | 36                                          | 5              | 50.0           | Step to f₃, P₃                |
|             | 21               | 41                                          |                |                | End of test                   |

The step response sequence shall be performed at the four operational conditions listed in [Table 2.]() For the test sequence at operational condition with the most challenging combination of droop and loading from an endurance point of view, the steps to 49.9 Hz and 50.1 Hz (Step number 1 and 2) shall be maintained for longer than 5 minutes, thus 15 minutes. Endurance and energy management of entities with LER is tested with the step sequence described in Subsection [8.1.)()

### **3.2. Sine response test**

The sine response test shall be performed for all FCR-N providing entities. The test is executed by performing a sine response testing as shown in [Figure 2.)() A sinusoidal frequency disturbance shall be applied varying between 49.9 Hz and 50.1 Hz. The sine response test is to be performed for a range of different periods, listed in [Table 4)() along with required stationary periods. The number of periods needed to achieve the required stationary periods may vary depending on the type of reserve.

**Figure 2: FCR-N sine response testing.**

**Table 4: Specification of input signals for the sine response tests for FCR-N.**

| Period, T [s] | No. of stationary periods (Recommended total No. of periods) |
| ------------- | ------------------------------------------------------------ |
| 10            | 5 (20)                                                       |
| 15            | 5 (15)                                                       |
| 25            | 5 (10)                                                       |
| 40            | 5 (7)                                                        |
| 50            | 5 (7)                                                        |
| 60            | 5 (7)                                                        |
| 70            | 5 (7)                                                        |
| 90            | 5 (7)                                                        |
| 150           | 3 (4)                                                        |
| 300           | 2 (3)                                                        |

The sine tests need only to be carried out at one operational condition. This shall be the operational condition with the most challenging loading level, which is typically the high loading and high droop setting.

### **3.3. Linearity test**

The linearity test is an additional test that shall be performed for FCR-N providing entities **with a non-continuous** response. The test is performed by applying a sequence of frequency steps of 20 mHz per step as shown in [Figure 3.)() The test sequence will start at 50 Hz, move step wise down to 49.9 Hz, then up step wise to 50.1 Hz, and then back down to 50 Hz again. Each step shall be maintained for a duration of at least 120 seconds. The first 60 seconds allows the response to reach steady state and then the next 60 seconds are used for evaluation of the steady state response. If steady state is not reached within the first 60 seconds, the provider is allowed to wait longer (up to 4 minutes).

**Figure 3: FCR-N linearity test sequence.**

The linearity test shall be performed at two operating conditions. This shall be the operational conditions with the high load and low droop setting and the low load and high droop setting.

## **4. Dynamic FCR–D upwards prequalification tests**

This section contains specifications of the tests to be performed to prequalify an entity for dynamic FCR-D upwards provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 5.]()10-0)

**Table 5: Prequalification tests for dynamic FCR-D upwards and at which operational conditions the tests are to be performed.**

| FCR-D upwards prequalification tests                                       | Operational conditions                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Fast ramp test sequence (for all entities)                                 | • High load, low droop; high load, high droop; low load, low droop; low load, high droop |
| Sine response sequence (for all entities)                                  | • High load, low droop[^8]                                                               |
| Linearity test (additional test for entities with non-continuous response) | • High load, low droop; low load, high droop                                             |
| Energy management test (additional test for LER entities)                  | • High load, low droop                                                                   |

In addition to the tests listed in this section, the tests described in Section [9)() must be completed once for each tested entity.

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **4.1. Fast ramp test**

The fast ramp test shall be performed for all dynamic FCR-D upwards providing entities. The test is executed by performing a series of frequency input ramp signals as shown in [Figure 4.)() The ramp signals are described in [Table 6.]()11-1)

[8] The sine tests shall be performed at the operational condition with the most challenging loading level, which is typically the high loading and low droop setting.

**Figure 4: FCR-D upwards fast ramp test. In this illustration FCR-N is inactive and therefore P8 = P6.**

**Table 6: FCR-D upwards fast ramp test.**  
_The waiting time between ramp 3 and ramp 4 should be increased to 900 seconds when the endurance is tested (non-LER units only)._

| Ramp no. | Start time [s] | End time ramp [s] | End time test [s] | Ramp speed [Hz/s] | Test duration [s] | Frequency [Hz] | Comment                                                                           | Mode shift notes                    |
| -------- | -------------- | ----------------- | ----------------- | ----------------- | ----------------- | -------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
|          | 0              | 0                 | 30                | 0                 | 30                | 49.9           | Wait until power is stable                                                        |                                     |
| 1        | 30             | 33.1              | 34.9              | 0.14              | 4.9               | 49.45          | Activation performance test 1                                                     | Shift to high performance mode      |
| 2        | 34.9           | 39.9              | 90                | 0.09              | 55.1              | 49.9           | Deactivation test 1                                                               | Return to stability mode and block  |
| 3        | 90             | 91.7              | 390               | 0.24              | 300/900\*         | 49.5           | Steady state response at full activation. \*Duration 900 s when testing endurance | Performance mode blocked            |
| 4        | 390            | 391.7             | 690               | 0.24              | min 300           | 49.9           | Steady state response at zero activation                                          | Maintain until mode shift unblocked |
| 5        | 690            | 693.8             | 750               | 0.24              | 60                | 49             | Activation performance test 2                                                     | Shift to high performance mode      |
| 6        | 750            | 754.2             | 1050              | 0.24              | min 300           | 50             | Deactivation test 2                                                               | High stability mode (blocked)       |
| 7        | 1050           | 1050.8            | 1350              | 0.24              | 300               | 49.7           | FCR-N/FCR-D combination test                                                      |                                     |
| 8        | 1350           | 1350.4            | 1650              | 0.24              | 300               | 49.89          | FCR-N/FCR-D combination test                                                      |                                     |

The sequence shall be performed at the four operational conditions listed in [Table 5.)() Entities that are intended to sometimes provide both FCR-N and FCR-D upwards at the same time shall have FCR-N active during the high droop tests to test the combination of FCR-N and FCR-D upwards. The last two ramps (Ramp number 7 and 8) need to be included only when testing the combined provision of FCR-N and FCR-D upwards. Entities with LFSM controllers shall have LFSM active during the fast ramp test.

For the test sequence at operational condition with the most challenging combination of droop and load, from an endurance point of view, the level after the ramp to 49.5 Hz (Ramp number 3) shall be maintained for a longer time to test endurance of non-LER entities. Endurance and energy management of **entities with LER** is tested with the step sequence described in Subsection [8.2.]()26-0)

### **4.2. Sine response test**

The sine response test shall be performed for all dynamic FCR-D upwards providing entities. The test is executed by performing a sine response testing as shown in [Figure 5.)() A sinusoidal frequency disturbance shall be injected, oscillating around 49.7 Hz with an amplitude of ± 100 mHz. If the same parameters are used for FCR-N and the high stability mode of FCR-D, the sine test for FCR-D can be replaced by sine tests of FCR-N with droop corresponding to the lowest FCR-D droop in order to avoid mode shifting during the sines. The sine response test is to be performed for a range of different periods, listed in [Table 7)() along with the required number of stationary periods. The number of periods needed to achieve the required stationary periods may vary depending on the type of reserve.

**Figure 5: FCR-D upwards sine response test.**

**Table 7: Specification of sine response tests for dynamic FCR-D upwards. The sines with 90, 150 and 300 second periods only need to be performed for entities that utilize mode shifting.**

| Period, T [s] | Number of stationary periods (Recommended total No. of periods) |
| ------------- | --------------------------------------------------------------- |
| 10            | 5 (20)                                                          |
| 15            | 5 (15)                                                          |
| 25            | 5 (10)                                                          |
| 40            | 5 (7)                                                           |
| 50            | 5 (7)                                                           |
| 60            | 5 (7)                                                           |
| 70            | 5 (7)                                                           |
| _90_          | _5 (7)_                                                         |
| _150_         | _3 (4)_                                                         |
| _300_         | _2 (3)_                                                         |

The sine tests need only to be carried out at one operational condition. This shall be the operational condition with the most challenging loading level, which is typically the high loading and low droop setting. The sines with 90, 150 and 300 second periods only need to be performed for the high stability mode for entities that utilize mode shifting. However, the FCR provider may choose to perform tests at more periods than required to investigate transfer function values in the areas otherwise interpolated.

If the same parameter set is utilized for both FCR-D upwards and FCR-D downwards provision it is sufficient to do the sine tests for either FCR-D upwards or FCR-D downwards and let the result represent both reserves.

### **4.3. Linearity test**

The linearity test is an additional test that shall be performed for dynamic FCR-D upwards providing entities **with a non-continuous** response. The test is performed by applying a sequence of frequency steps as shown in [Figure 6.)() The test signal is a sequence of grid frequency steps of 100 mHz per step where the last step is slightly larger so that the frequency enters the normal band, i.e. from 49.90 Hz → 49.80 Hz → 49.70 Hz → 49.60 Hz → 49.50 Hz, and back to 49.91 Hz. Each step shall be maintained for a duration of 60 seconds to allow the response to reach steady state and then another 60 seconds where the steady state response is evaluated. Thus, the steady state must be reached within 60 seconds.

**Figure 6: FCR-D upwards linearity test sequence.**

The linearity test shall be performed at two operating conditions. This shall be the operational conditions with the high load and low droop setting and the low load and high droop setting.

## **5. Dynamic FCR–D downwards prequalification tests**

This section contains specifications of the tests to be performed to prequalify an entity for dynamic FCR-D downwards provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 8.]()14-0)

**Table 8: Prequalification tests for dynamic FCR-D downwards and at which operational conditions the tests are to be performed.**

| FCR-D downwards prequalification tests                                     | Operational conditions                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Fast ramp test sequence (for all entities)                                 | • High load, low droop; high load, high droop; low load, low droop; low load, high droop |
| Sine response sequence (for all entities)                                  | • High load, low droop[^9]                                                               |
| Linearity test (additional test for entities with non-continuous response) | • High load, low droop; low load, high droop                                             |
| Energy management test (additional test for LER entities)                  | • High load, low droop                                                                   |

In addition to the tests listed in this section, the tests described in Section [9)() must be completed once for each tested entity.

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **5.1. Fast ramp test**

The fast ramp test shall be performed for all dynamic FCR-D downwards providing entities. The test is executed by performing a series of frequency input ramp signals as shown in [Figure 7.)() The ramp signals are described in [Table 9.]()15-1)

[9] The sine tests shall be performed at the operational condition with the most challenging loading level, which is typically the high loading and high droop setting.

**Figure 7: Dynamic FCR-D downwards fast ramp test. In this illustration FCR-N is inactive and therefore P8 = P6.**

**Table 9: Dynamic FCR-D downwards fast ramp test.**  
_The waiting time between ramp 3 and ramp 4 should be increased to 900 seconds when the endurance is tested (non-LER units only)._

| Ramp no. | Start time [s] | End time ramp [s] | End time test [s] | Ramp speed [Hz/s] | Test duration [s] | Frequency [Hz] | Comment                                                                           | Mode shift notes                    |
| -------- | -------------- | ----------------- | ----------------- | ----------------- | ----------------- | -------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
|          | 0              | 0                 | 30                | 0                 | 30                | 50.1           | Wait until power is stable                                                        |                                     |
| 1        | 30             | 33.1              | 34.9              | 0.14              | 4.9               | 50.55          | Activation performance test 1                                                     | Shift to high performance mode      |
| 2        | 34.9           | 39.9              | 90                | 0.09              | 55.1              | 50.1           | Deactivation test 1                                                               | Return to stability mode and block  |
| 3        | 90             | 91.7              | 390               | 0.24              | 300/900\*         | 50.5           | Steady state response at full activation. \*Duration 900 s when testing endurance | Performance mode blocked            |
| 4        | 390            | 391.7             | 690               | 0.24              | min 300           | 50.1           | Steady state response at zero activation                                          | Maintain until mode shift unblocked |
| 5        | 690            | 693.8             | 750               | 0.24              | 60                | 51             | Activation performance test 2                                                     | Shift to high performance mode      |
| 6        | 750            | 754.2             | 1050              | 0.24              | min 300           | 50             | Deactivation test 2                                                               | High stability mode (blocked)       |
| 7        | 1050           | 1050.8            | 1350              | 0.24              | 300               | 50.3           | FCR-N/FCR-D combination test                                                      |                                     |
| 8        | 1350           | 1350.4            | 1650              | 0.24              | 300               | 50.11          | FCR-N/FCR-D combination test                                                      |                                     |

The sequence shall be performed at the four operational conditions listed in [Table 8.)() Entities that are intended to sometimes provide both FCR-N and FCR-D downwards at the same time shall have FCR-N active during the high droop tests to test the combination of FCR-N and FCR-D downwards. The last two ramps (Ramp number 7 and 8) need to be included only when testing the combined provision of FCR-N and FCR-D downwards. Entities with LFSM controllers shall have LFSM active during the fast ramp test.

For the test sequence at operational condition with the most challenging combination of droop and loading, from an endurance point of view, the level after the ramp to 50.5 Hz (Ramp number 3) shall be maintained for a longer time to test endurance of non-LER entities. Endurance and energy management of **entities with LER** is tested with the step sequence described in Subsection [8.3.]()26-1)

### **5.2. Sine response test**

The sine response test shall be performed for all dynamic FCR-D downwards providing entities. The test is executed by performing a sine response testing as shown in [Figure 8.)() A sinusoidal frequency disturbance shall be injected, oscillating around 50.3 Hz with an amplitude of ±100 mHz. The sine response test is to be performed for a range of different periods, listed in [Table 10)() along with the required number of stationary periods. If the same parameters are used for FCR-N and the high stability mode of FCR-D, the sine test for FCR-D can be replaced by sine tests of FCR-N with droop corresponding to the lowest FCR-D droop in order to avoid mode shifting during the sines. The number of periods needed to achieve the required stationary periods may vary depending on the type of reserve.

**Figure 8: Dynamic FCR-D downwards sine response test.**

**Table 10: Specification of the sine response tests for dynamic FCR-D downwards. The sines with 90, 150 and 300 second periods only need to be performed for entities that utilize mode shifting.**

| Period, T [s] | Number of stationary periods (Recommended total No. of periods) |
| ------------- | --------------------------------------------------------------- |
| 10            | 5 (20)                                                          |
| 15            | 5 (15)                                                          |
| 25            | 5 (10)                                                          |
| 40            | 5 (7)                                                           |
| 50            | 5 (7)                                                           |
| 60            | 5 (7)                                                           |
| 70            | 5 (7)                                                           |
| _90_          | _5 (7)_                                                         |
| _150_         | _3 (4)_                                                         |
| _300_         | _2 (3)_                                                         |

The sine tests need only to be carried out at one operational condition. This shall be the operational condition with the most challenging loading level, which is typically the high loading, and the low droop setting. The sines with 90, 150 and 300 second periods only need to be performed for the high stability mode for entities that utilize mode shifting. However, the FCR provider may choose to perform tests at more time periods than required to investigate transfer function values in the areas otherwise interpolated.

If the same parameter set is utilized for both FCR-D upwards and FCR-D downwards provision it is sufficient to do the sine test for either FCR-D upwards or FCR-D downwards and let the result represent both reserves.

### **5.3. Linearity test**

The linearity test is an additional test that shall be performed for dynamic FCR-D downwards providing entities **with a non-continuous** response. The test is performed by applying a sequence of frequency steps as shown in [Figure 9.)() The test signal is a sequence of grid frequency steps of 100 mHz per step where the last step is slightly larger so that the frequency enters the normal band, i.e. from 50.10 Hz → 50.20 Hz → 50.30 Hz → 50.40 Hz → 50.50 Hz, and back to 50.09 Hz. Each step shall be maintained for a duration of 60 seconds to allow the response to reach steady state and then another 60 seconds where the steady state response is evaluated.

**Figure 9: FCR-D downwards linearity test sequence.**

The linearity test shall be performed at two operating conditions. This shall be the operational conditions with the high loading and low droop setting and the low loading and high droop setting.

## **6. Static FCR-D upwards prequalification tests**

This section contains specifications of the tests to be performed to prequalify an entity for static FCR-D upwards provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 11.]()19-0)

**Table 11: Prequalification tests for static FCR-D upwards and at which operational conditions the tests are to be performed.**

| FCR-D upwards prequalification tests                      | Operational conditions                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ramp static test                                          | • High load, low droop; high load, high droop; low load, low droop; low load, high droop |
| Linearity test                                            | • High load, low droop; low load, high droop                                             |
| Energy management test (additional test for LER entities) | • High load, low droop                                                                   |

In addition to the tests listed in this section, the tests described in Section [9)() must be completed once for each tested entity.

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **6.1. Ramp static test**

The ramp static test shall be performed for all static FCR-D upwards providing entities. The test is executed by performing a series of frequency input ramp signals as shown in [Figure 10.)() The ramp signals are described in [Table 12.]()20-0)

**Figure 10: Static FCR-D upwards ramp static test.**

**Table 12: Static FCR-D upwards ramp static test.**  
_Endurance must be tested at least with one operational condition during ramp number 1. The duration of the endurance test is dependent on the type of the entity. For non-LER entities, the endurance test shall have duration of 900 seconds, for LER-entities, the endurance test shall have duration of 1800 seconds._

| Ramp number | Start time [s] | Start time (endurance) non-LER [s] | Start time (endurance) LER [s] | Duration [s]      | Frequency [Hz] | Comment                       |
| ----------- | -------------- | ---------------------------------- | ------------------------------ | ----------------- | -------------- | ----------------------------- |
|             | 0              | 0                                  | 0                              | 180               | 49.9           | Wait until power is stable    |
| 1           | 180            | 180                                | 180                            | 60 / 900 / 1800\* | 49.5           | Activation performance test 1 |
| 2           | 240            | 1080                               | 1980                           | 1200              | 49.9           | Deactivation test 1           |
|             | 1440           | 2280                               | 3180                           |                   |                | End of test                   |

The endurance is tested by maintaining the frequency deviation of ramp 1 for 15 minutes (30 minutes for LER-resources) during the test with the most challenging combination of load and droop from an endurance point of view. During tests with other combinations of load and droop the frequency deviation shall be maintained for at least 1 minute. In addition, energy management of **entities with LER** is tested with the step sequence described in Subsection [8.2.]()26-0)

### **6.2. Linearity test**

The linearity test shall be performed for static FCR-D upwards providing entities, independent of continuity capability. The test is performed by applying a sequence of frequency steps as shown in [Figure 11.)() The test signal is a sequence of grid frequency steps of 100 mHz per step where the last step is slightly larger so that the frequency enters the normal band, i.e. from 49.90 Hz → 49.80 Hz → 49.70 Hz → 49.60 Hz → 49.50 Hz, and back to 49.91 Hz. Each step shall be maintained for a duration of 60 seconds to allow the response to reach steady state and then another 60 seconds where the steady state response is evaluated.

**Figure 11: Static FCR-D upwards linearity test sequence.**

The linearity test shall be performed at two operating conditions. This shall be the operational conditions with the high loading and low droop setting and the low loading and high droop setting.

## **7. Static FCR-D downwards Prequalification tests**

This section contains specifications of the tests to be performed to prequalify an entity for static FCR-D downwards provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 13.]()22-0)

**Table 13: Prequalification tests for static FCR-D downwards and at which operational conditions the tests are to be performed.**

| FCR-D downwards prequalification tests                    | Operational conditions                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ramp static test                                          | • High load, low droop; high load, high droop; low load, low droop; low load, high droop |
| Linearity test                                            | • High load, low droop; low load, high droop                                             |
| Energy management test (additional test for LER entities) | • High load, low droop                                                                   |

In addition to the tests listed in this section, the tests described in Section [9)() must be completed once for each tested entity.

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **7.1. Ramp static test**

The ramp static test shall be performed for all static FCR-D downwards providing entities. The test is executed by performing a series of frequency input ramp signals as shown in [Figure 12.)() The ramp signals are described in [Table 14.]()23-0)

**Figure 12: Static FCR-D downwards ramp static test.**

**Table 14: Static FCR-D downwards ramp static test.**  
_Endurance must be tested at least with one operational condition during ramp number 1. The duration of the endurance test is dependent on the type of the entity. For non-LER entities, the endurance test shall have duration of 900 seconds, for LER-entities, the endurance test shall have duration of 1800 seconds._

| Ramp number | Start time [s] | Start time (endurance) non-LER [s] | Start time (endurance) LER [s] | Duration [s]      | Frequency [Hz] | Comment                       |
| ----------- | -------------- | ---------------------------------- | ------------------------------ | ----------------- | -------------- | ----------------------------- |
|             | 0              | 0                                  | 0                              | 180               | 50.1           | Wait until power is stable    |
| 1           | 180            | 180                                | 180                            | 60 / 900 / 1800\* | 50.5           | Activation performance test 1 |
| 2           | 240            | 1080                               | 1980                           | 1200              | 50.1           | Deactivation test 1           |
|             | 1440           | 2280                               | 3180                           |                   |                | End of test                   |

The endurance is tested by maintaining the frequency deviation of ramp 1 for 15 minutes (30 minutes for LER-resources) during the test with the most challenging combination of load and droop from an endurance point of view. During tests with other combinations of load and droop the frequency deviation shall be maintained for at least 1 minute. In addition, energy management of **entities with LER** is tested with the step sequence described in Subsection [8.3.]()26-1)

### **7.2. Linearity test**

The linearity test shall be performed for static FCR-D downwards providing entities, independent of continuity capability. The test is performed by applying a sequence of frequency steps as shown in [Figure 13.)() The test signal is a sequence of grid frequency steps of 100 mHz per step where the last step is slightly larger so that the frequency enters the normal band, i.e. from 50.10 Hz → 50.20 Hz → 50.30 Hz → 50.40 Hz → 50.50 Hz, and back to 50.09 Hz. Each step shall be maintained for a duration of 60 seconds to allow the response to reach steady state and then another 60 seconds where the steady state response is evaluated.

**Figure 13: Static FCR-D downwards linearity test sequence.**

The linearity test shall be performed at two operating conditions. This shall be the operational conditions with the high loading and low droop setting and the low loading and high droop setting.

## **8. Energy management tests for entities with LER**

This section describes the energy management tests that must be performed for entities with LER in addition to the other prequalification tests. Entities with an energy reservoir that is smaller than the equivalent of a continuous full activation of the prequalified FCR capacity for two hours are classified as LER units (Limited Energy Reservoir). The energy management test requires the implementation of a Normal State Energy Management (NEM) Scheme and an Alert State Energy Management (AEM) mode. Thorough explanations on NEM and AEM specifics are provided in the document _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area_.

### **8.1. Energy management test for FCR-N**

[Table 15)() describes the energy management test that must be performed for all LER entities providing FCR-N. The test sequence covers enabling and disabling of NEM and AEM at low and high state of charge. The durations given in the table are minimum durations. The actual durations may vary depending on reservoir size and initial state of charge, and they must be adjusted to meet the objectives stated in the table.

**Table 15: Energy management test for FCR-N.**

| Step number | Start time [min] | Minimum duration [min] | Frequency [Hz] | NEM      | AEM | Comment                                                                                                                                              |
| ----------- | ---------------- | ---------------------- | -------------- | -------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
|             | 0                | 2                      | 50             | Off      | Off |                                                                                                                                                      |
| 1           | 2                | 28                     | 50.09          | On       | Off | This step must be held until NEM has been fully activated for at least one minute (due to SOC enabling it to).                                       |
| 2           | 30               | 6                      | 50.11          | Off      | Off | NEM should turn off when the frequency exceeds 50.1 [Hz]                                                                                             |
| 3           | 36               | 2.5                    | 50.09          | On       | Off | NEM should turn on when the frequency drops below 50.1 [Hz]                                                                                          |
| 4           | 38.5             | 7.5                    | 50.11          | Off      | On  | This step must be held 5 min after AEM turns on. AEM turns on due to high SOC value.                                                                 |
| 5           | 46               | 10                     | 50.09          | On       | On  | FCR response activation with NEM and AEM on.                                                                                                         |
| 6           | 56               | 60                     | 49.91          | Off / On | Off | This step must be held until NEM and AEM first turn off, and then NEM will have been fully activated again for at least one minute (due to low SOC). |
| 7           | 116              | 5                      | 49.89          | Off      | Off | NEM should turn off when the frequency drops below 49.9 [Hz]                                                                                         |
| 8           | 121              | 2.5                    | 49.91          | On       | Off | NEM should turn on when the frequency exceeds 49.9 [Hz]                                                                                              |
| 9           | 123.5            | 10                     | 49.89          | Off      | On  | This step must be held 5 min after AEM turns on. AEM turns on due to low SOC value.                                                                  |
| 10          | 133.5            | 10                     | 49.91          | On       | On  | FCR response activation with NEM and AEM on.                                                                                                         |
| 11          | 143.5            | 30                     | 50.0           | Off      | Off | This step must be held until NEM and AEM turn off.                                                                                                   |

### **8.2. Energy management test for FCR-D upwards**

[Table 16)() describes the energy management test that must be performed for all LER entities providing FCR-D upwards. The durations given in the tables are minimum durations. The actual durations may vary depending on reservoir size and initial state of charge, and they must be adjusted to meet the objectives stated in the table.

**Table 16: Energy management test for FCR-D upwards.**

| Step number | Start time [min] | Minimum duration [min] | Frequency [Hz] | NEM      | AEM | Comment                                                                                                               |
| ----------- | ---------------- | ---------------------- | -------------- | -------- | --- | --------------------------------------------------------------------------------------------------------------------- |
|             | 0                | 0.5                    | 49.91          | Off      | Off |                                                                                                                       |
| 1           | 0.5              | 10                     | 49.5           | Off      | Off | This step must be held until NEM turns on when going into normal frequency band (Step 2)                              |
| 2           | 10.5             | 2.5                    | 49.91          | On       | Off | NEM turns on due to entering of normal frequency band.                                                                |
| 3           | 13               | 15                     | 49.5           | Off      | On  | This step must be held 5 min after AEM turns on                                                                       |
| 4           | 28               | 15                     | 49.91          | On / Off | Off | NEM must be turned on when stepping into the normal frequency band. The step must be held until NEM and AEM turns off |

### **8.3. Energy management test for FCR-D downwards**

[Table 17)() describes the energy management test that must be performed for all LER entities providing FCR-D downwards. The durations given in the tables are minimum durations. The actual durations may vary depending on reservoir size and initial state of charge, and they must be adjusted to meet the objectives stated in the table.

**Table 17: Energy management test for FCR-D downwards.**

| Step number | Start time [min] | Minimum duration [min] | Frequency [Hz] | NEM      | AEM | Comment                                                                                                               |
| ----------- | ---------------- | ---------------------- | -------------- | -------- | --- | --------------------------------------------------------------------------------------------------------------------- |
|             | 0                | 0.5                    | 50.09          | Off      | Off |                                                                                                                       |
| 1           | 0.5              | 10                     | 50.5           | Off      | Off | This step must be held until NEM turns on when going into normal frequency band (Step 2)                              |
| 2           | 10.5             | 2.5                    | 50.09          | On       | Off | NEM turns on due to entering of normal frequency band.                                                                |
| 3           | 13               | 15                     | 50.5           | Off      | On  | This step must be held 5 min after AEM turns on                                                                       |
| 4           | 28               | 15                     | 50.09          | On / Off | Off | NEM must be turned on when stepping into the normal frequency band. The step must be held until NEM and AEM turns off |

## **9. Prequalification tests for all entities regardless of FCR product**

This section contains specifications of the tests to be performed once per tested entity that are to prequalify for FCR provision. The tests and the specific operational conditions the tests are to be performed at are listed in [Table 18]()27-2).

**Table 18: Tests to be performed once per tested entity and at which operational conditions the tests are to be performed.**

| Prequalification tests to be performed once per entity                                              | Operational conditions                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1 test of the frequency measurement equipment, for entities tested with internal frequency signals. | Provider's choice                                 |
| 1 hour of active FCR provision, using measured grid frequency.                                      | Low droop (high load preferable but not required) |

Results from the tests shall be summarised in an overall test report that are to be attached to the application along with logged test data. The test results are evaluated by utilising the IT-Tool provided by the TSOs.

### **9.1. Test of the frequency measurement equipment**

If the frequency measurement equipment is omitted from the test process by e.g. applying an internal frequency signal to the controller, an approximate time constant, T<sub>FME</sub>, of the frequency measurement equipment needs to be separately determined using one of the below four options;

- 1. Separate test of the frequency measurement loop, by inserting an externally generated frequency step response to measure the time constant of the response. The test is shown in Figure 14.
- 2. Documentation from supplier of the equipment.
- 3. References to previous tests of equal equipment.
- 4. Using the default value provided by the TSOs, T<sub>FME</sub> = 1 second[^10].

**Figure 14: Test of frequency measurement equipment.**

[10] The default value is purposefully set to a high value to ensure a margin.

### **9.2. Active FCR provision**

For each providing entity tested, an overall test report shall be put together that summarizes the outcome of the tests. The test report shall be accompanied by the logged data specified for each product tested.

In addition to the test report, a set of **one (1) hour of logged data**, in accordance with Subsection [11.1,)() shall be submitted to the TSO. Data logging during this hour should then correspond to normal operation, which differs from data logging of prequalification tests. The sampling rate shall be at least 1 Hz. During this hour, FCR-N shall be enabled and set to maximal capacity if the application concerns FCR-N. If the application regards FCR-D and the full allowed operating range of the entity is not utilized by FCR-N, FCR-D shall be enabled and set to the maximal capacity allowed by the allowed operating range.

## **10. Test exemptions**

With reference to the operational conditions stated in Section 1.1, the following exemptions are given:

- If the entity is planned to deliver FCR at a single power setpoint, the tests 3) and 4) can be omitted.
- If the entity is planned to deliver FCR at a single droop setting, the tests 2) and 4) can be omitted.

Further exemptions that are subject to TSO approval prior to testing:

- For technologies where power setpoint does not influence the FCR provision capabilities, testing at a single power setpoint is sufficient for all tests, e.g. many types of batteries.
- The reserve connecting TSO can give additional exemptions for testing requirements where compliance can be confirmed by the general knowledge of the technology, either from previous tests of similar entities or other documentation. The potential FCR provider is responsible for clarifying this prior to testing.

## **11. Tasks to perform after the tests**

This section contains a description of tasks to be performed after the testing has been concluded, and prior to sending in the prequalification application.

### **11.1. Data logging and analysis**

The file format for data delivery is the European standard csv-file, character encoding in ASCII where values are delimited by comma (,), decimal separator is point (.) and record delimiter is carriage return (↵ ASCII/CRLF=0x0D 0x0A). Date and time formats are in accordance with ISO 8601 and are specified below.

In accordance with Section 6.2 of the document _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area_, the test data shall be provided to the reserve connecting TSO in a set of files for the various tests and named on the format:

[Resource]\_[Service]\_[TestType]\_[Area]\_[Timezone]\_ [Interval]\_ [SamplingRate].csv, where;

- [Resource] = Identifier for the resource agreed with reserve connecting TSO e.g. FCPG1
- [Service] = Type of service, i.e. Fcrn, FcrdUp or FcrdDo.
- [TestType] = The type of test identified with the test ID, see Appendix 2 in _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area._ Data logged from normal operation the test type is Operation.
- [Area] = The bidding area where the resource is located e.g. SE1, FI, NO5, DK2
- [Timezone] = The time zone used for logging, e.g. CET or UTC.
- [Interval] = The time interval for which data is delivered in format YYYYMMDDThhmm-YYYYMMDDThhmm e.g. 20160101T0000-20160114T2359
- [SamplingRate] = Nominal time difference between samples given in seconds. If the time difference between samples is less than 1 second, it is specified in milliseconds. E.g. 0.05s is written as 50ms.

Data records are provided in the following format: [DateTime],[record1],[record2],…,[recordX].

• [DateTime] = Date and time in format YYYYMMDDThhmmss.nnn where n are decimal fractions of a second e.g. 20160330T093702.012

Regarding the data from sine wave tests, each sine sweep should be logged into a separate file. Additionally, the period should be written in the file name with [TestType] as well as in the headers of the columns of the file. Example of the headers would be DateTime40, InsAcPow40, GridFreq40 for a sine sweep with a period of 40 seconds.

**There are three types of data that the reserve connecting TSO require from the provider: test data from prequalification tests, real-time telemetry during delivery (if required by the TSO) and data logged by the provider during operation that should be delivered to the TSO upon request.**

[Table 19)() lists the signals covered by each type of data exchange. The table may not be comprehensive and there may be differences in the required signals for each TSO. Check specific details of the required signals from each respective TSO.

**Table 19: Data exchange.**  
_The "X" marks data that shall be delivered, "recom." marks data that is recommended and "per test" marks data that should be included in the test report but does not have to be logged continuously during the test, only noted at the beginning of the test. "Real time" column applies if requested by the TSO. Doubles should be given with at least three decimals._

| Signal                                                            | Header              | Test                                               | Operation | Real time | Type                                    |
| ----------------------------------------------------------------- | ------------------- | -------------------------------------------------- | --------- | --------- | --------------------------------------- |
| Instantaneous active power injection (negative for absorbed) [MW] | [InsAcPow]          | X                                                  | X         | X         | Double, e.g. 120.532                    |
| Measured grid frequency [Hz]                                      | [GridFreq]          | X                                                  | X         |           | Double, e.g. 49.320                     |
| Applied frequency (during test) [Hz]                              | [ApplFreqSig]       | X                                                  |           |           | Double, e.g. 49.320                     |
| Control mode (parameter set) FCR-N [id]                           | [ContMode_Fcrn]     | X                                                  | recom.    |           | alphanumeric identifier, e.g. FCRN4     |
| Control mode (parameter set) FCR-D up [id]                        | [ContMode_FcrdUp]   | X                                                  | recom.    |           | alphanumeric identifier, e.g. FCRDUP4   |
| Control mode (parameter set) FCR-D down [id]                      | [ContMode_FcrdDo]   | X                                                  | recom.    |           | Alphanumeric identifier, e.g. FCRDDOWN4 |
| Maintained capacity FCR-N [MW]                                    | [Cap_Fcrn]          | per test                                           | X         | X         | Double, e.g. 20.100                     |
| Maintained capacity FCR-D up [MW]                                 | [Cap_FcrdUp]        | per test                                           | X         | X         | Double, e.g. 20.100                     |
| Maintained capacity FCR-D down [MW]                               | [Cap_FcrdDo]        | per test                                           | X         | X         | Double, e.g. 20.100                     |
| Status FCR-N [on/off]                                             | [ContStatus_Fcrn]   | per test                                           | X         | X         | Binary, e.g. 0                          |
| Status FCR-D up [on/off]                                          | [ContStatus_FcrdUp] | per test                                           | X         | X         | Binary, e.g. 0                          |
| Status FCR-D down [on/off]                                        | [ContStatus_FcrdDo] | per test                                           | X         | X         | Binary, e.g. 0                          |
| Regulating strength FCR-N [MW/Hz]                                 | [RegStr_Fcrn]       |                                                    | X         | X         | Double, e.g. 20.000                     |
| Regulating strength FCR-D up [MW/Hz]                              | [RegStr_FcrdUp]     |                                                    | X         | X         | Double, e.g. 20.000                     |
| Regulating strength FCR-D down [MW/Hz]                            | [RegStr_FcrdDo]     |                                                    | X         | X         | Double, e.g. 20.000                     |
| Minimum power [MW]                                                | [Pmin]              | per test (if constant) or continuous (if variable) | X         | X         | Double, e.g. 10.000                     |
| Maximum power [MW]                                                | [Pmax]              | per test (if constant) or continuous (if variable) | X         | X         | Double, e.g. 120.532                    |
| Power baseline [MW]                                               | [CalcBaseline]      | X                                                  | X         | X         | Double, e.g. 80.029                     |
| Controller output signal                                          | [ContOutSig]        | recom.                                             | recom.    |           | Double, e.g. 0.300                      |
| Setpoint before FCR [% or MW]                                     | [ContSetP]          | per test                                           | recom.    |           | Double, e.g. 67.500                     |
| Activated FCR-N [MW]                                              | [Activated_Fcrn]    |                                                    | X         |           | Double, e.g. 5.500                      |
| Activated FCR-D up [MW]                                           | [Activated_FcrdUp]  |                                                    | X         |           | Double, e.g. 5.500                      |
| Activated FCR-D down [MW]                                         | [Activated_FcrdDo]  |                                                    | X         |           | Double, e.g. 5.500                      |
| **For LER entities**                                              |                     |                                                    |           |           |                                         |
| Remaining endurance FCR-N [minutes]                               | [ResSize_Fcrn]      | X                                                  | X         | X         | Double, e.g. 55.000                     |
| Remaining endurance FCR-D up [minutes]                            | [ResSize_FcrdUp]    | X                                                  | X         | X         | Double, e.g. 10.000                     |
| Remaining endurance FCR-D down [minutes]                          | [ResSize_FcrdDo]    | X                                                  | X         | X         | Double, e.g. 10.000                     |
| Activated FCR-N NEM power [MW]                                    | [NEM_MW_Fcrn]       | X                                                  | X         | recom.    | Double, e.g. 1.100                      |
| Activated FCR-D up NEM power [MW]                                 | [NEM_MW_FcrdUp]     | X                                                  | X         | recom.    | Double, e.g. 1.100                      |
| Activated FCR-D down NEM power [MW]                               | [NEM_MW_FcrdDo]     | X                                                  | X         | recom.    | Double, e.g. 1.100                      |
| FCR-N NEM [on/off]                                                | [NEM_Fcrn]          | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| FCR-D up NEM [on/off]                                             | [NEM_FcrdUp]        | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| FCR-D down NEM [on/off]                                           | [NEM_FcrdDo]        | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| FCR-N AEM [on/off]                                                | [AEM_Fcrn]          | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| FCR-D up AEM [on/off]                                             | [AEM_FcrdUp]        | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| FCR-D down AEM [on/off]                                           | [AEM_FcrdDo]        | X                                                  | X         | recom.    | Binary, e.g. 1                          |
| **For batteries**                                                 |                     |                                                    |           |           |                                         |
| State of charge [%]                                               | [SOC]               | X                                                  | recom.    |           | Double, e.g. 48.090                     |
| **For hydro entities**                                            |                     |                                                    |           |           |                                         |
| Guide vane opening [% or deg]                                     | [GuideVane]         | recom.                                             | recom.    |           | Double, e.g. 17.500                     |
| Runner blade angle [% or deg]                                     | [BladeAng]          | recom.                                             | recom.    |           | Double, e.g. 5.301                      |
| Upstream water level [m.a.s.l.]                                   | [UppWatLev]         | recom.                                             | recom.    |           | Double, e.g. 103.500                    |
| Downstream water level [m.a.s.l.]                                 | [LowWatLev]         | recom.                                             | recom.    |           | Double, e.g. 45.600                     |
| **For thermal entities**                                          |                     |                                                    |           |           |                                         |
| Turbine valve [%]                                                 |                     | recom.                                             | recom.    |           | Double, e.g. 55.100                     |
| Ambient temp [degC]                                               | [AmbTemp]           | per test                                           | recom.    |           | Double, e.g. -5.120                     |
| Cooling water temp [degC]                                         | [CoolTemp]          | per test                                           | recom.    |           | Double, e.g. 4.120                      |
| **For wind entities**                                             |                     |                                                    |           |           |                                         |
| Wind speed [m/s]                                                  | [WindSpeed]         | recom.                                             | recom.    |           | Double, e.g. 5.356                      |
| **For solar entities**                                            |                     |                                                    |           |           |                                         |
| Solar irradiation [W/m²]                                          | [SolarIrr]          | recom.                                             | recom.    |           | Double, e.g. 125.040                    |
| **For entities with codependent power output**                    |                     |                                                    |           |           |                                         |
| Station active power injection (negative for absorbed) [MW]       | [InsAcPow_station]  | recom.                                             | recom.    |           | Double, e.g. 120.532                    |

### **11.2. Reporting**

For each providing entity tested, an overall test report shall be put together that summarizes the outcome of the tests. The test report shall be accompanied by the logged data specified for each product tested.

### **11.3. Calculation of capacity and compliance**

Please refer to Section 3.9 of the document 'Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area'.
