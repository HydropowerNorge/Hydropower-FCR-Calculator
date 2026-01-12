Version 1.1

28 March 2025

# Contents

- [Definitions](#definitions)
- [1 Introduction](#1-introduction)
- [2 The prequalification process](#2-the-prequalification-process)
  - [2.1 The prequalification process for the first time](#21-the-prequalification-process-for-the-first-time)
  - [2.2 Reassessment of the prequalification](#22-reassessment-of-the-prequalification)
  - [2.3 Prequalification application](#23-prequalification-application)
  - [2.4 Approval](#24-approval)
- [3 Technical requirements for the FCR-products](#3-technical-requirements-for-the-fcr-products)
  - [3.1 Steady state response, endurance and time domain dynamic performance](#31-steady-state-response-endurance-and-time-domain-dynamic-performance)
    - [3.1.1 FCR-N](#311-fcr-n)
    - [3.1.2 FCR-D](#312-fcr-d)
    - [3.1.3 Static FCR-D](#313-static-fcr-d)
  - [3.2 Frequency domain stability requirements](#32-frequency-domain-stability-requirements)
  - [3.3 Frequency domain performance requirements](#33-frequency-domain-performance-requirements)
  - [3.4 Linearity requirements](#34-linearity-requirements)
    - [3.4.1 Dynamic linearity requirement](#341-dynamic-linearity-requirement)
    - [3.4.2 Linearity requirement for static or non-continuously controlled resources](#342-linearity-requirement-for-static-or-non-continuously-controlled-resources)
  - [3.5 Endurance and limited energy reservoirs, LER](#35-endurance-and-limited-energy-reservoirs-ler)
    - [3.5.1 Normal State Energy Management (NEM)](#351-normal-state-energy-management-nem)
    - [3.5.2 Alert State Energy Management (AEM)](#352-alert-state-energy-management-aem)
    - [3.5.3 Energy Management Test Sequence](#353-energy-management-test-sequence)
    - [3.5.4 Endurance calculation with LER](#354-endurance-calculation-with-ler)
  - [3.6 Simultaneous delivery of several reserves or functions](#36-simultaneous-delivery-of-several-reserves-or-functions)
    - [3.6.1 Combination of FCR-N and FCR-D](#361-combination-of-fcr-n-and-fcr-d)
    - [3.6.2 FCR-D with and without LFSM](#362-fcr-d-with-and-without-lfsm)
  - [3.7 Start and end of FCR provision during a frequency disturbance](#37-start-and-end-of-fcr-provision-during-a-frequency-disturbance)
    - [3.7.1 FCR-N](#371-fcr-n)
    - [3.7.2 FCR-D](#372-fcr-d)
  - [3.8 Baseline methodology](#38-baseline-methodology)
  - [3.9 Capacity calculation](#39-capacity-calculation)
    - [3.9.1 Maintained capacity (real time data)](#391-maintained-capacity-real-time-data)
  - [3.10 Capacity determination for uncertain or varying processes](#310-capacity-determination-for-uncertain-or-varying-processes)
  - [3.11 Provision from aggregated resources](#311-provision-from-aggregated-resources)
    - [3.11.1 Flexible prequalification](#3111-flexible-prequalification)
    - [3.11.2 Flexible operation](#3112-flexible-operation)
    - [3.11.3 Removal of units](#3113-removal-of-units)
  - [3.12 Provision from centrally controlled FCR providing entities](#312-provision-from-centrally-controlled-fcr-providing-entities)
- [4 Requirements on the measurement system](#4-requirements-on-the-measurement-system)
  - [4.1 Accuracy](#41-accuracy)
  - [4.2 Resolution](#42-resolution)
  - [4.3 Sampling rate](#43-sampling-rate)
  - [4.4 Test of frequency measurement equipment](#44-test-of-frequency-measurement-equipment)
- [5 Testing requirements](#5-testing-requirements)
  - [5.1 Operational test conditions](#51-operational-test-conditions)
    - [5.1.1 Scaling of controller parameters](#511-scaling-of-controller-parameters)
  - [5.2 Ambient test conditions](#52-ambient-test-conditions)
  - [5.3 Test data to be logged](#53-test-data-to-be-logged)
  - [5.4 Test reports](#54-test-reports)
- [6 Data](#6-data)
  - [6.1 Real-time telemetry](#61-real-time-telemetry)
  - [6.2 Data logging during operation](#62-data-logging-during-operation)
    - [6.2.1 File format for logged data delivery](#621-file-format-for-logged-data-delivery)
- [7 Validity and exceptions](#7-validity-and-exceptions)
- [Appendix 1: Examples of capacity calculation methods](#appendix-1-examples-of-capacity-calculation-methods)
- [Appendix 2: Determination of operational conditions to perform tests](#appendix-2-determination-of-operational-conditions-to-perform-tests)

**Activated capacity** Part of the active power output caused by FCR activation

**AEM** Alert state Energy Management mode

**aFRR** Automatic Frequency Restoration Reserve

**Backlash** General denotation of mechanical dead-band / insensitivities

**Baseline** Part of the active power output that does not include FCR activation

**Connection Point** The interface at which the providing entity is connected to a transmission system, or distribution system, as identified in the connection agreement

**Controller parameter set** A set of preselected parameter values, selectable with a single signal, e.g. a certain parameter set for island operation and another one for FCR-N

**Droop** The ratio of a steady-state change of frequency to the resulting steady-state change in active power output, expressed in percentage terms. The change in frequency is expressed as a ratio to nominal frequency and the change in active power expressed as a ratio to maximum power.

**ENTSO-E** European Network of Transmission System Operators for Electricity

**FCP** Frequency Containment Process **FCR** Frequency Containment Reserve

**FCR-D** Frequency Containment Reserve for Disturbances

**FCR-N** Frequency Containment Reserve for Normal operation

**FCR-X** FCR-X is used in common term and can be read as FCR-N, FCR-D upwards or FCR-D downwards

**FCR provider** Legal entity providing FCR services from at least one FCR providing unit or group

**FSM** Frequency Sensitive Mode, operating mode where active power is increased/decreased in response to a change in system frequency. Required for some units through grid code specifications.

**Grace period** The grace period is the recovery time for static FCR-D after activation.

**LER** Limited Energy Reservoir, FCR providing entity with limited activation endurance.

**LFSM** Limited Frequency Sensitive Mode, operating mode where active power is increased/decreased in response to a change in system frequency below/above a certain value. Required for some units through grid code specifications.

**Maintained capacity** The amount of prequalified reserve in MW that will be utilized at full activation, FCR-N 50±0.1Hz, at 49.5 Hz for FCR-D upwards, and at 50.5 Hz for FCR-D downwards

**NEM** Normal state Energy Management mode

**Power system stabiliser (PSS)** An additional functionality of the Automatic Voltage Regulator of a synchronous power-generating module whose purpose is to damp power oscillations

**Prequalification** Prequalification means the process to verify the compliance of an FCR providing unit or an FCR providing group with the requirements set by the _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area_ and national terms and conditions.

**Providing entity** FCR Providing Unit or FCR Providing Group

**Providing group** FCR Providing Group means an aggregation of Power Generating Modules, Demand Entities and/or Reserve Providing Units and/or Energy storages connected to more than one Connection Point fulfilling the requirements for FCR

**Providing unit** FCR Providing Unit means a single or an aggregation of Power Generating Modules and/or Demand Entities and/or Energy storages connected to a common Connection Point fulfilling the requirements for FCR

**SOC** State of Charge (of e.g. a battery)

**TSO** Transmission System Operator

These _Technical Requirements for Frequency Containment Reserve Provision in the Nordic Synchronous Area_ specify formal technical requirements for Frequency Containment Reserve (FCR) providers as well as requirements for compliance verification and information exchange. The requirements are based on the European guidelines from the European Commission (SO GL)^1^, with proper adjustments to be suitable for the Nordic conditions. The requirements have been developed in cooperation between the Nordic TSOs: Energinet, Fingrid, Statnett and Svenska kraftnät.

To participate in the FCR markets, it is necessary for FCR providing units and FCR providing groups, jointly referred to as FCR providing entities^2^, to be prequalified. The prequalification process ensures that FCR providers have the ability to deliver the specified product required by the TSO and that all necessary technical requirements are fulfilled. The TSOs provide an IT tool that performs the necessary calculations and evaluates compliance from the test results with the technical requirements.^3^ Further, the TSOs provides a tuning guideline, which describes how providers can tune their units in order to prequalify. The prequalification shall be performed before a provider can deliver the products FCR-N (Frequency Containment Reserve for Normal operation) and FCR-D (Frequency Containment Reserve for Disturbances), and shall consist of documentation showing that the provider can deliver the specified product as agreed with the TSO. The technical requirements, the specific documentation required and the process for prequalification testing are described in this document. The process to validate the requirements includes:

- 1. Verification of the properties of the FCR providing entity.
- 2. Accomplishment of prequalification tests.
- 3. Setting up telemetry data to be sent to the reserve connecting TSO in real-time if requested, and data logging for off-line validation purposes.

Three FCR products are defined, which can be provided independently:

- FCR-N, in the range of 49.9-50.1 Hz
- FCR-D upwards, in the range of 49.9-49.5 Hz
- FCR-D downwards, in the range of 50.1-50.5 Hz

Each product can be provided either as a linear function of the frequency deviation or as an approximation of a linear function.

The requirements addressed in this document apply to FCR providing entities providing FCR-N and/or FCR-D services. Each product offered must comply with the requirements specified in this document.

The main requirements in this document are written in bold text within a box, as shown below:

**Requirement X:**

An overview of the main requirements is presented in Table 2 in Section 3.

The prequalification process shall ensure that the FCR provider can provide FCR in accordance with the requirements from the TSO. The prequalification process is harmonized between the Nordic TSOs, and it is based on the requirements given to the TSOs through SO GL. The process shall also ensure that the respective TSO has all the necessary documentation for the FCR providing entities. Furthermore, the process must ensure that the correct communication links are established and that the required telemetry is received. The required tests, documentation and data are described in this document. Further information about the practicalities can be obtained from the reserve connecting TSO.

## **2.1 The prequalification process for the first time**

The prequalification process starts with a notification of the tests from the potential FCR provider to the reserve connecting TSO. After successful completion of the tests, a formal application has to be submitted. The application shall contain all relevant information required by the TSO, including the information listed in this document. Within 8 weeks the TSO shall confirm if the application is complete or request additional information from the provider. Additional information shall be provided within 4 weeks, otherwise the application is deemed withdrawn. When the application is complete, the TSO shall within 3 months either prequalify or deny the FCR providing entity to provide the service. The test results included in an application must not be older than 1 year.

The FCR provider is responsible for the safe operation of their entities. Any risks related to performing the prequalification tests and/or providing FCR should be considered when planning for prequalification. In particular, the risk for surge or other waterway dynamics should be considered for hydropower units.

## **2.2 Reassessment of the prequalification**

The prequalification shall be re-assessed:

- once every five years,
- in case the equipment has changed or substantial change of the requirements, and
- in case of modernisation of the equipment related to FCR activation.

To maintain continuous validity of the prequalification, the FCR provider is responsible for initiating the reassessment process well in advance of the expiration of the previous prequalification. If a full prequalification procedure was performed less than 5 years ago, and no changes to the entity have occurred that can be expected to affect the fulfilment of the requirements, a simplified reassessment can be performed. The tests described in Section 3.1.1 should be performed for FCR-N and the tests described in Section 3.1.2 and 3.1.3 should be performed for FCR-D. The tests in Section 3.4.2 shall be performed, if applicable. If the test results are in line with the most recent full prequalification test results, the FCR providing entity is considered prequalified for another period of 5 years. If not, a full prequalification procedure is to be performed.

In case of any change that has a significant impact on the FCR provision for an already prequalified entity, a full prequalification is required. Such a change could e.g. be a new turbine governor or changed turbine governor settings.

## **2.3 Prequalification application**

The FCR provider shall perform the required tests, gather the required documentation and send this information to the reserve connecting TSO in the requested format. The respective TSO will specify how, and to where, the application should be sent.

#### **The application shall contain, as a minimum, the following documentation:**

- 1. Formal application cover letter including the reason for the application (first time, 5-year periodic reassessment, or substantial change)
- 2. General description of the providing entity
  - o Including block diagram of the controller
  - o Including description of limitations for FCR capability, if applicable
- 3. Description of how the steady state response for FCR is calculated (if and how it depends on parameter settings, load or ambient conditions)
- 4. Description of how the power baseline is calculated
- 5. Test report and test data with respect to performance and stability, in a format specified in Section 6.2.1 for (when applicable)
  - o FCR-N
  - o FCR-D upwards
  - o FCR-D downwards
- 6. Documentation of the real-time telemetry data performance and accuracy, as requested
- 7. Documentation of the data logging system performance and accuracy, as requested

#### **In addition, the application shall contain, as a minimum, the following documentation:**

#### Generation based resources

- o Generator: Rated apparent power [MVA]
- o Turbine: Rated power [MW]
- o Maximum power [MW]
- o Minimum power [MW]

- o Hydro power entities: Water starting time constant T^w^ [s] at rated head [m] and at rated turbine power, using the rated turbine power as base power
- o Wind power entities: Rated wind speed [m/s]
- o Turbine governor: Type, settings and block diagram

#### Load based resources

- o Information on the type of the load
- o Technical description of the controller, including controller settings

#### Energy storage-based resources

- o Rated apparent power [MVA]
- o Rated energy capacity of the energy storage [MWh]
- o Energy storage maximum and minimum state of charge [MWh]
- o Technical description of the controller, including controller settings
- o Description of energy management

For other types of resources, corresponding data describing the properties of the entity have to be documented. The specification of such data has to be agreed with the reserve connecting TSO.

For aggregated resources, a high-level technical description of the aggregation system shall be included. For entities without a predefined setpoint, a description of the method for forecasting available FCR capacity shall be included.

If the entity has been verified for compliance with grid connection requirements prior to the prequalification process, any changes that are made for FCR provision must be documented, if they are relevant for compliance and verification of grid connection requirements.

## **2.4 Approval**

Upon approval, the FCR provider shall receive a notification from the reserve connecting TSO that the FCR providing entity is qualified to provide the stated FCR products. The notification shall confirm the qualified FCR capacities at the tested operating points. The notification shall also state the validity of the prequalification and when reassessment is due. The validity period of 5 years starts from the day of approval.

Each FCR providing entity must meet a number of technical requirements. The purpose of these technical requirements is to guarantee that the resources taking part in frequency control:

- have sufficient static and dynamic performance and
- do not destabilise the power system.

The requirements are the same irrespective of the providing entity, i.e. generating entities, load entities and energy storage entities should be tested in a similar way to ensure the fulfilment of the performance and stability requirements.

There are three FCR products: FCR-N, FCR-D upwards and FCR-D downwards. They are activated in separate grid frequency bands according to Table 1 and the activation shall in steady state be close to proportional to the frequency control error. FCR shall remain activated for as long as the frequency deviation persists^4^.

| Product        | 100 % negative<br>activation | 0 % activation | 100 % positive<br>activation |
| -------------- | ---------------------------- | -------------- | ---------------------------- |
| FCR-D upward   | N.A.                         | $f ≥ 49.9 Hz$  | $f ≤ 49.5 Hz$                |
| FCR-N          | $f ≥ 50.1 Hz$                | $f = 50 Hz$    | $f ≤ 49.9 Hz$                |
| FCR-D downward | $f ≥ 50.5 Hz$                | $f ≤ 50.1 Hz$  | N.A.                         |

Entities providing FCR-D are allowed to continue to linearly increase their activation beyond the frequencies of 49.5 Hz and 50.5 Hz, respectively. Each provider of FCR must have a method to calculate the steady state response of each delivered FCR product given the controller settings (droop) and other relevant conditions (load, ambient conditions). The steady state response calculation method shall be verified by the prequalification test results and approved by the TSO. The method shall be an unbiased estimation of the steady state response. Examples of steady state response calculation methods are given in Appendix 1. After prequalification, the steady state response calculation method in combination with any reduction factors determined by the results from the prequalification tests shall be used to calculate the capacity of FCR that can be sold from the entity. Synchronous and asynchronous machines that are directly connected to the grid (i.e. not connected with power converters) are recommended to not use fast power feedback in the controller, since this will counteract the inertial response of the unit.

The maximal provision per single point of failure is limited to 5 % of the nominal reference incident in the Nordic power system. Currently the maximal provision of FCR-N or FCR-D per single point of failure is 70 MW in the upwards direction and 70 MW in the downwards direction. In addition, when providing both FCR-N and FCR-D at the same time, the combined maximal provision is 100 MW in the upwards direction and 100 MW in the downwards direction.

The FCR response shall not be artificially delayed and shall begin as soon as possible after a frequency deviation. FCR providers shall disable their FCR contribution when not procured.^5^ Voltage control using frequency-voltage droop is allowed. The technical requirements that are subject to testing are listed in Table 2. The tests are to be performed at different operating conditions, which are defined in Section 5.1.

**Table 2. Requirements and corresponding tests.**

**Symbol explanations:**

- N = The requirement/test applies to FCR-N
- Du = The requirement/test applies to FCR-D upwards
- Dd = The requirement/test applies to FCR-D downwards
- SDu = The requirement/test applies to Static FCR-D upwards
- SDd = The requirement/test applies to Static FCR-D downwards
- \* = If FCR-D upwards and FCR-D downwards have the same parameters, one sine test of FCR-D is enough
- \*\* = The test is only needed for reserves with a non-continuous controller, and/or Static FCR-D
- \*\*\* = Test of endurance should be included in the test at the operating point that is most challenging from an endurance point of view. For non-LER entities prequalifying for multiple products, it is sufficient to include the test for one product only
- \*\*\*\* = The tests apply to LER units only and are performed instead of the other endurance tests
- \*\*\*\*\* = The frequency measurement equipment test can be carried out at any operating point

| #   | Requirement/Test                                       | FCR Type/Test Method                                                                                                                          | Section Reference   |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Steady state response (1b for combination of reserves) | N (Step sequence), Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                           | 3.1.1, 3.1.2, 3.1.3 |
| 2   | Power after 7.5 s                                      | Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                                              | 3.1.2               |
| 3   | Energy from 0 to 7.5 s                                 | Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                                              | 3.1.2               |
| 4   | Deactivation                                           | Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                                              | 3.1.2, 3.1.3        |
| 5   | Activation Static FCR-D                                | SDu (Ramp test), SDd (Ramp test)                                                                                                              |                     |
| 6   | Re-activation Static FCR-D                             | SDu (Ramp test), SDd (Ramp test)                                                                                                              |                     |
| 7   | Deactivation rate Static FCR-D                         | SDu (Ramp test), SDd (Ramp test)                                                                                                              |                     |
| 8   | Frequency domain stability                             | N (Sine @ 50.0 Hz), Du\* (Sine @ 49.7 Hz), Dd\* (Sine @ 50.3 Hz), Normal operation                                                            | 3.2, 4.4            |
| 9   | Frequency domain performance                           | N (Sine @ 50.0 Hz), Du\* (Sine @ 49.7 Hz), Dd\* (Sine @ 50.3 Hz), Normal operation                                                            | 3.3, 4.4            |
| 10  | Dynamic linearity                                      | N (Sine @ 50.0 Hz), Du\* (Sine @ 49.7 Hz), Dd\* (Sine @ 50.3 Hz)                                                                              | 3.4.1               |
| 11  | Linearity (non-continuous)                             | N\*\* (Linearity step sequence), SDu\*\* (Ramp test), SDd\*\* (Ramp test), Du\*\* (Linearity step sequence), Dd\*\* (Linearity step sequence) | 3.4.2               |
| 12  | Endurance                                              | N (Step sequence), Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test), LER\*\*\*\* (Energy Management)                          | 3.1.1, 3.1.2, 3.5.3 |
| 13  | Mode shifting                                          | Du (Fast ramp), Dd (Fast ramp)                                                                                                                | 3.1.2               |

**Table 2b. Test conditions for requirements.**

| Operating Condition   | Applicable Requirements/Tests                                                                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High load, low droop  | Du\* (Sine @ 49.7 Hz), Dd\* (Sine @ 50.3 Hz), N\*\* (Step sequence), N\*\* (Linearity step sequence), Du\*\*\* (Fast ramp), Dd\*\*\* (Fast ramp), SDu (Ramp test), SDd (Ramp test), Du\*\* (Linearity step sequence), Dd\*\* (Linearity step sequence), LER\*\*\* (Energy Management), 1 hour Normal operation, 1 test\*\*\*\*\* (Frequency measurement) |
| High load, high droop | N (Sine @ 50.0 Hz), N (Step sequence), Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                                                                                                                                                                                                                  |
| Low load, low droop   | N (Step sequence), Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test)                                                                                                                                                                                                                                                                      |
| Low load, high droop  | N (Step sequence), N\*\* (Linearity step sequence), Du (Fast ramp), Dd (Fast ramp), SDu (Ramp test), SDd (Ramp test), Du\*\* (Linearity step sequence), Dd\*\* (Linearity step sequence)                                                                                                                                                                 |

## **3.1 Steady state response, endurance and time domain dynamic performance**

The FCR reserves contribute to the control of the frequency of the power system. Although a single FCR providing entity typically has little impact on the overall grid frequency, it is crucial that the sum of the behaviour of all the FCR providing entities ensures sufficient dynamic performance to contain the frequency within the allowed limits. To ensure the dynamic performance of the system regardless of which entities provide FCR, it is required that every FCR providing entity has a sufficient dynamic performance.

The steady state response of FCR-N is tested with the step sequence described in Table 3. The input frequency signal is changed in steps. The first step ensures a starting point where the effect from any backlash in the regulating mechanism will have the same impact on the two following steps. After the initial preparatory step, the power shall be allowed to settle at 50.0 Hz for 5 minutes before proceeding to the next step.

The steps at 49.9 Hz and 50.1 Hz shall be maintained for at least 5 minutes, except for the endurance test for **entities without a limited energy reservoir (LER)**. In the endurance test the steps shall be maintained for at least 15 minutes. The endurance test is included in the test with the most challenging combination of load and droop, from an endurance point of view. Endurance and energy management of **entities with LER** is tested with the step sequence described in section 3.5.3.

| Step number | Start time [min] | Start time endurance test for non-LER [min] | Duration [min] | Frequency [Hz] | Comment                       |
| ----------- | ---------------- | ------------------------------------------- | -------------- | -------------- | ----------------------------- |
|             | 0                | 0                                           | 0.5            | 50.0           | Starting point                |
| Pre-step    | 0.5              | 0.5                                         | 0.5            | 49.95          | Small step to handle backlash |
| 0           | 1                | 1                                           | 5              | 50.0           | Step to $f_{0}$, $P_{0}$      |
| 1           | 6                | 6                                           | 5 / 15         | 49.9           | Step to $f_{1}$, $P_{1}$      |
| 2           | 11               | 21                                          | 5 / 15         | 50.1           | Step to $f_{2}$, $P_{2}$      |
| 3           | 16               | 36                                          | 5              | 50.0           | Step to $f_{3}$, $P_{3}$      |
|             | 21               | 41                                          |                |                | End of test                   |

The steady state response in the upwards direction is calculated as

$$\Delta P_{ss,1} = P_{ss,1} - \frac{1}{2} (P_{ss,0} + P_{ss,3}) \tag{1}$$

and the steady state response in the downwards direction is calculated as

$$\Delta P_{ss,2} = P_{ss,2} - \frac{1}{2} (P_{ss,0} + P_{ss,3}) \tag{2}$$

where ,0 is the steady state power at _f0_=50 Hz before step 1 and ,3 is the steady state power at _f3_=50.0 Hz after step 3, ,1 is the steady state power at _f1_=49.9 Hz and ,2 is the steady state power at _f2_=50.1 Hz.

The steady state response must not differ too much from the theoretical steady state response. Underdelivery means that the power system might not have enough reserves to contain the frequency, while over-delivery might lead to decreased stability margins, oscillatory behaviour and overshoots. The maximal allowed under-delivery in the test result is 5 % and over-delivery 20 %. The requirement on the step with upwards regulation is:

**Requirement 1 upwards**:
$$-0.05 \le \frac{\Delta P_{SS,1} - |\Delta P_{SS,theoretical}|}{|\Delta P_{SS,theoretical}|} \le 0.2$$

The requirement on the step with downwards regulation, noting that ∆,2 is a negative value, is:

Requirement 1 downwards:
$$-0.2 \le \frac{\Delta P_{SS,2} + |\Delta P_{SS,theoretical}|}{|\Delta P_{SS,theoretical}|} \le 0.05$$

where ∆,ℎ is the steady state response to a frequency deviation of 0.1 Hz in upwards or downwards direction calculated with the provider's capacity calculation method. The provider can choose to use either the average or the minimum response.

FCR-N must stay activated as long as the frequency deviation persists. For non-LER entities, the endurance is tested by maintaining the frequency deviation of steps 1 and 2 for 15 minutes each during the test with the most challenging combination of load and droop from an endurance point of view.

**Requirement 12**: The response must stay activated as long as the frequency deviation persists.

**Requirement 1 with reduction factor, upwards**: −0.05 ≤ ∆,1−,∙|∆,ℎ| ,∙|∆,ℎ| ≤ 0.2

**Requirement 1 with reduction factor, downwards:** −0.2 ≤ ∆,2+,∙|∆,ℎ| ,∙|∆,ℎ| ≤ 0.05

Note that failure to fulfil the dynamic performance criteria also can be mitigated by introducing another capacity reduction factor, K_red,dyn (see section 3.3). If any capacity reduction factors are determined, the capacity of the entity should be reduced with the minimum of the steady state reduction factor and the dynamic reduction factor. The capacity is then:

$$C_{FCR-N} = \min(K_{red,ss}, K_{red,dyn}) \cdot |\Delta P_{ss,theoretical}|$$
(3)

If the needed reduction factor is smaller than 0.9, the unit fails the prequalification for FCR-N.

The provider can choose either to use one reduction factor for all operating points for load and droop, or to calculate a separate reduction factor for each load and droop, in which case the value of the reduction factor shall be interpolated for loads and droops in between the ones tested.

The steady state response, endurance and time domain dynamic performance, including deactivation performance of FCR-D, is tested with a ramp sequence. The aim of the dynamic performance requirements for FCR-D is to limit the frequency deviation during the first swing after a large disturbance, and the aim of the deactivation requirement is to limit the frequency deviation of the second swing (in the opposite direction) after a moderate disturbance. The frequency input signal for the test is given in Table 4. Entities with LFSM controllers shall have the LFSM controller active during the test.

The level after ramp 3 (at 49.5 Hz and 50.5 Hz respectively) shall be maintained for at least 5 minutes, except for the endurance test for **entities without a limited energy reservoir (LER)**. In the endurance test the level shall be maintained for at least 15 minutes. The endurance test is included in the test with the most challenging combination of load and droop, from an endurance point of view. Endurance and energy management of **entities with LER** is tested with the step sequence described in section 3.5.3.

For entities that at times will deliver both FCR-N and FCR-D, FCR-N shall be active during the high droop tests to test the combination of FCR-N and FCR-D. The last two ramps (7 and 8) only need to be included when the combination of FCR-N and FCR-D is tested.

**Table 4. FCR-D fast ramp test.**

_Note: The waiting time between ramp 3 and ramp 4 should be increased to 900 seconds when the endurance is tested (non-LER units only). The endurance shall be tested once at the most challenging combination of load and droop from an endurance perspective._

| Ramp | Start time [s] | Ramp end [s] | Test end [s] | Ramp speed [Hz/s] | Duration [s] | Frequency [Hz] (Up/Down) | Purpose                                  | Mode shift notes                    |
| ---- | -------------- | ------------ | ------------ | ----------------- | ------------ | ------------------------ | ---------------------------------------- | ----------------------------------- |
|      | 0              | -            | 30           | 0                 | 30           | 49.9/50.1                | Stabilization period                     | -                                   |
| 1    | 30             | 33.1         | 34.9         | 0.14              | 4.9          | 49.45/50.55              | Activation test 1                        | Shift to high performance mode      |
| 2    | 34.9           | 39.9         | 90           | 0.09              | 55.1         | 49.9/50.1                | Deactivation test 1                      | Return to stability mode and block  |
| 3    | 90             | 91.7         | 390          | 0.24              | 300/900\*    | 49.5/50.5                | Steady state response at full activation | Performance mode blocked            |
| 4    | 390            | 391.7        | 690          | 0.24              | ≥300         | 49.9/50.1                | Steady state response at zero activation | Maintain until mode shift unblocked |
| 5    | 690            | 693.8        | 750          | 0.24              | 60           | 49.0/51.0                | Activation test 2                        | Shift to high performance mode      |
| 6    | 750            | 754.2        | 1050         | 0.24              | ≥300         | 50.0/50.0                | Deactivation test 2                      | High stability mode (blocked)       |
| 7    | 1050           | 1050.8       | 1350         | 0.24              | 300          | 49.7/50.3                | FCR-N/FCR-D combination test             | -                                   |
| 8    | 1350           | 1350.4       | 1650         | 0.24              | 300          | 49.89/50.11              | FCR-N/FCR-D combination test             | -                                   |

_Duration = 900 s when testing endurance (non-LER units only)_

The steady state response of FCR-D is calculated as the difference between the steady state response of ramp 3 (ending at 49.5 Hz for FCR-D upwards and 50.5 Hz for FCR-D downwards) and ramp 4 (ending at 49.9 Hz for FCR-D upwards and 50.1 Hz for FCR-D downwards. The steady state response must not differ more than 5 % from the theoretical steady state response in the direction of under-delivery and 20 % in the direction of over-delivery:

| **Requirement 1 for FCR-D upwards:** | $-0.05 \le \frac{P_{ss,3} - P_{ss,4} - \Delta P_{ss,theoretical}}{\Delta P_{ss,theoretical}} \le 0.2$ |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |

**Requirement 1 for FCR-D downwards:** $-0.2 \le \frac{P_{ss,3} - P_{ss,4} + |\Delta P_{ss,theoretical}|}{|\Delta P_{ss,theoretical}|} \le 0.05$

#### Where:

|∆,ℎ| (MW) is the steady state response to a frequency change from 49.9 Hz to 49.5 Hz for FCR-D upwards or a frequency change from 50.1 Hz to 50.5 Hz for FCR-D downwards, calculated with the provider's steady state response calculation method,

,3 is the steady state power after ramp number 3 and

,4 is the steady state power after ramp number 4.

FCR-D must stay activated as long as the frequency deviation persists. For non-LER entities, the endurance is tested by maintaining the frequency deviation after ramp 3 for 15 minutes during the test with the most challenging combination of load and droop from an endurance point of view.

#### **Requirement 12**: The response shall stay activated as long as the frequency deviation persists.

Using the values as illustrated in Figure 4, the following requirements shall be fulfilled for the responses to ramp 5 (to 49.0 Hz for FCR-D upwards and to 51.0 Hz for FCR-D downwards):

| **Requirement 2:** | $\Delta P_{7.5s} \geq 0.86 \cdot \Delta P_{ss,theoretical}$ |
| ------------------ | ----------------------------------------------------------- |
| **Requirement 3:** | $E_{7.5s} \geq 3.2s \cdot \Delta P_{ss,theoretical}$        |

#### Where:

|∆,ℎ| (MW) is the steady state response to a frequency change from 49.9 Hz to 49.5 Hz for FCR-D upwards or a frequency change from 50.1 Hz to 50.5 Hz for FCR-D downwards, calculated with the provider's steady state response calculation method,

∆7.5s (MW) is the activated power 7.5 seconds after the start of the ramp,

7.5s (MWs) is the activated energy from the start of the ramp to 7.5 seconds after the start of the ramp, that is

$$E_{7.5s} = \int_{t}^{t+7.5s} \Delta P(t) dt. \tag{4}$$

After the time instant where requirements 2 and 3 are evaluated, the activated power shall not be decreased below the power at 7.5 seconds at any point in time until start of ramp 6 (back to 50.0 Hz). Small oscillations in the response are accepted, if they are well-damped and caused by inherent properties of the reserve providing entity (e.g. waterway dynamics).

Deactivation is defined as decreasing the FCR response when the frequency deviation decreases. FCR-D providing entities shall behave similarly for deactivation as for activation. Furthermore, in case of frequency deviations smaller than full activation and/or continuously changing frequency deviations, the performance of the FCR-D response should behave in a similar way. For entities utilizing the high performance and high stability modes, the behaviour of the modes may be different, but within the same mode the response shall behave as stated in the preceding sentences. The activation-deactivation performance is tested by ramp 1 and 2.

For a low frequency event, the energy overshoot after the frequency nadir contributes to overshoot in frequency. The deactivation test frequency profile is an approximation of the frequency after an incident which is half the reference incident (i.e. half of the FCR-D capacity). In this case, the frequency nadir (or zenith for a high frequency event) occurs 4.4 seconds after the start of the ramp. The requirement for deactivation is that the energy exceeding the power delivered at the time of nadir or half of the steady state response for full activation must not exceed the steady state response for full activation multiplied by 2.5 seconds at any time after the nadir (evaluated for at least 40 seconds). The requirement is illustrated in Figure 5.

$$\max_{k=t_{nadir} \to t_{nadir+40}} \int_{t_{nadir}}^{t=k} \left( \Delta P(t) - \min \left( |\Delta P_{nadir}|, 0.5 \cdot |\Delta P_{ss,theo}| \right) \right) dt \leq 2.5s \cdot |\Delta P_{ss,theo}|$$

#### Requirement 4 (FCR-D down):

$$\max_{k=t_{zenith} \rightarrow t_{zenith+40}} \int_{t_{zenith}}^{t=k} \left( -\Delta P(t) - \min \left( |\Delta P_{zenith}|, 0.5 \cdot \left| \Delta P_{ss,theo} \right| \right) \right) dt \leq 2.5s \cdot \left| \Delta P_{ss,theo} \right|$$

#### Reduced capacity

If the steady state response requirement is not fulfilled, the provider is allowed to introduce a capacity reduction factor, $K_{red,ss}$ , on the theoretical capacity so that the requirement is fulfilled. The reduction factor has to be a value between 0.75 and $1^6$ . The requirement is then expressed as:

#### Requirement 1 for FCR-D upwards with reduction factor:

$$-0.05 \le \frac{P_{ss,3} - P_{ss,4} - K_{red,ss} \left| \Delta P_{ss,theoretical} \right|}{K_{red,ss} \left| \Delta P_{ss,theoretical} \right|} \le 0.2$$

Requirement 1 for FCR-D downwards with reduction factor:

$$-0.2 \le \frac{P_{ss,3} - P_{ss,4} + K_{red,ss} \left| \Delta P_{ss,theoretical} \right|}{K_{red,ss} \left| \Delta P_{ss,theoretical} \right|} \le 0.05$$

A capacity reduction factor with a value between 0.75 and 1 can also be used if the FCR-D providing entity does not fulfil the performance requirement^6^. The requirements are then expressed as:

**Requirement 2 with reduction factor:**
$$|\Delta P_{7.5s}| \ge 0.86 \cdot K_{red,dyn} |\Delta P_{ss,theoretical}|$$

#### **Requirement 3 with reduction factor:**

**Requirement 3 with reduction factor:** |7.5s| ≥ 3.2 ∙ ,|∆,ℎ|

If a capacity reduction factor is determined, the capacity of the entity shall be reduced with the minimum of the steady state reduction factor and the dynamic reduction factor. The capacity is then

$$C_{FCR-Dx} = \min(K_{red,ss}, K_{red,dyn}) \cdot \Delta P_{ss,theoretical}$$
(5)

The provider can choose either to use one reduction factor for all loads and droops or to calculate a separate reduction factor for each load and droop, in which case the value of the reduction factor shall be interpolated for loads and droops in between the ones tested.

#### _Combination of FCR-N and FCR-D_

If the entity will at times provide both FCR-N and FCR-D, the fast ramp test with high droop should be carried out with both FCR-N and FCR-D active, while the ramp test with low droop should be carried out with only FCR-D active. With the test sequence **where FCR-N is active**, it is ensured that FCR-N steady state response is unaffected by the activation of FCR-D. The difference between the steady state response after ramp 6 and ramp 8 should fulfil the steady state response requirement for FCR-N with a small correction. Similar assessment is done for ramps 6 and 7 to check that the combined response is within allowed limits. General requirements related to combination of FCR-N and FCR-D are described in 3.6.1.

#### **Requirement 1b, combination upwards**:

$$-0.05 \leq \frac{\left(P_{SS,X} - P_{SS,6}\right) - \left|\Delta P_{FCR-N,SS,theoretical}\right| - \left(\frac{|\Delta f_{X} - 0.1|}{0.4}\right) \left|\Delta P_{FCR-D,up,SS,theoretical}\right|}{\left|\Delta P_{FCR-N,SS,theoretical}\right| + \left(\frac{|\Delta f_{X} - 0.1|}{0.4}\right) \left|\Delta P_{FCR-D,up,SS,theoretical}\right|} \leq 0.2$$

or

#### **Requirement 1b, combination downwards**:

$$-0.2 \leq \frac{P_{SS,X} - P_{SS,6} + \left| \Delta P_{FCR-N,SS,theoretical} \right| + (\frac{\left| \Delta f_{X} - 0.1 \right|}{0.4}) \left| \Delta P_{FCR-D,down,SS,theoretical} \right|}{\left| \Delta P_{FCR-N,SS,theoretical} \right| + (\frac{\left| \Delta f_{X} - 0.1 \right|}{0.4}) \left| \Delta P_{FCR-D,down,SS,theoretical} \right|} \leq 0.05$$

Where:

∆−,,ℎ is the steady state response of FCR-N calculated with the provider's capacity calculation method.

, is the steady state response after ramp 8 when calculating the requirement 1b for ramps 6 and 8. Whereas, it is the steady state response after ramp 7 when calculating the requirement 1b for ramps 6 and 7.

∆ is the frequency change from the end of ramp number 6 to end of ramp number 8, when calculating the requirement 1b for ramps 6 and 8. Whereas, it is the frequency change from end of ramp number 6 to end of ramp number 7 when calculating the requirement 1b for ramps 6 and 7.

#### _Mode shifting_

Since it is required of an FCR-D providing entity to change its power quickly after a disturbance, some entities may have difficulty in fulfilling the performance requirements and the stability requirements (section 3.2) at the same time. Such units are allowed to use mode shifting in the controller to achieve high performance for a short period of time after a disturbance. If mode shifting is used, the controller shall have a _high-performance mode_ and a _high stability mode_, and the shifting between these modes shall be tested during the FCR-D ramp sequence test. The high stability mode must comply with the stability requirement 8 for FCR-D described in Section 3.2 and the performance requirement 9 described in Section 3.3. In practice, it is recommended to use FCR-N parameters in high stability mode, assuming that the same droop is used for FCR-N and FCR-D.

The following rules apply for activating/deactivating the high-performance mode:

- The entity may activate the high-performance mode at a grid frequency equal to or lower than 49.8 Hz for FCR-D upwards, and at a frequency equal to or higher than 50.2 Hz for FCRD downwards.
- Regardless of the frequency activation threshold, the entity must deactivate the high-performance mode within 10 seconds after the activation instant.
- After deactivation, the high-performance mode must be blocked from reactivating for 5- 15 minutes (recommended value: 5 minutes), in case the high-performance- mode does not comply with stability requirement 8 described in Section 3.2. The block shall apply separately for FCR-D upwards and FCR-D downwards.

**Requirement 13:** For entities that utilises **mode shifting** from high stability mode to high performance mode, the ramp test sequence should verify the following:

- 1. The high-performance mode is activated during ramp 1 and then deactivated within 10 seconds and blocked.
- 2. The high stability mode is active during ramp 3 and ramp 4 (the high-performance mode is blocked from activation).
- 3. The high-performance mode is active during ramp 5 and then blocked.
- 4. The high stability mode is active during ramp 6.
- 5. The deactivation of the high-performance mode must be smooth and bump-less (the controller should not jump to a new value at the time of shifting in a way that causes a significant bump in the power output, especially not a bump in the wrong direction).

### **3.1.3 Static FCR-D**

Entities that have difficulties to comply with the dynamic requirements, e.g. activation/deactivation performance and dynamic stability can provide a variant of FCR-D called _Static FCR-D_. The technical requirements and tests of Static FCR-D are described in this section. The main difference from regular FCR-D (referred to as Dynamic FCR-D in this section) is a grace period of 15 minutes where the entities are not required to deactivate and/or to be able to perform a second activation.

Static FCR-D is tested by a ramp response test specified in Table 5. The ramps shall be at a rate of 0.24 Hz/s. The requirements on the ramp response test are illustrated in Figure 6.

| Ramp number | Start time [s] | Start time (endurance test) [s] |      | Duration [s]  | Frequency for FCR-D upwards [Hz] | Frequency for FCR-D downwards [Hz] | Comment                       |
| ----------- | -------------- | ------------------------------- | ---- | ------------- | -------------------------------- | ---------------------------------- | ----------------------------- |
|             |                | non-LER                         | LER  |               |                                  |                                    |                               |
|             | 0              | 0                               | 0    | 180           | 49.9                             | 50.1                               | Wait until power is stable    |
| 1           | 180            | 180                             | 180  | 60/900/1800\* | 49.5                             | 50.5                               | Activation performance test 1 |
| 2           | 240            | 1080                            | 1980 | 1200          | 49.9                             | 50.1                               | Deactivation test 1           |
|             | 1440           | 2280                            | 3180 |               |                                  |                                    | End of test                   |

\* Duration: 60s (general), 900s (non-LER endurance), 1800s (LER endurance)

The steady state response of Static FCR-D is calculated as the difference between the steady state response of ramp 1 (ending at 49.5 Hz for FCR-D upwards and 50.5 Hz for FCR-D downwards) and before ramp 1, i.e. at 49.9 Hz for FCR-D upwards or 50.1 Hz for FCR-D downwards. The steady state response must not differ more than 5 % from the theoretical steady state response in the direction of under-delivery and 10 % in the direction of over-delivery:

| **Requirement 1 for Static FCR-D upwards:**   | $-0.05 \leq \frac{P_{ss,1} - P_{ss,0} - \Delta P_{ss,theoretical}}{\Delta P_{ss,theoretical}} \leq 0.1$ |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Requirement 1 for Static FCR-D downwards:** | $-0.1 \leq \frac{P_{ss,1} - P_{ss,0} + \Delta P_{ss,theoretical}}{\Delta P_{ss,theoretical}} \leq 0.05$ |

#### Where:

|∆,ℎ| (MW) is the steady state response to a frequency change from 49.9 Hz to 49.5 Hz for FCR-D upwards or a frequency change from 50.1 Hz to 50.5 Hz for FCR-D downwards, calculated with the provider's steady state response calculation method,

,1 is the steady state power after ramp number 1 has settled,

,0 is the steady state power before ramp number 1.

Referring to Figure 4 in the section about Dynamic FCR-D, the same requirements shall be fulfilled for Static FCR-D for the responses to ramp 1:

| **Requirement 2:** | $\Delta P_{7.5s} \geq 0.86 \cdot \Delta P_{ss,theoretical}$ |
| ------------------ | ----------------------------------------------------------- |
| **Requirement 3:** | $E_{7.5s} \geq 3.2s \cdot \Delta P_{ss,theoretical}$        |

#### Where:

∆7.5s (MW) is the activated power 7.5 seconds after the start of the ramp,

7.5s (MWs) is the activated energy from the start of the ramp to 7.5 seconds after the start of the ramp (see Equation 4.

A capacity reduction factor *K*red,dyn with a value between 0.84 and 1 can be used if the Static FCR-D providing entity does not fulfil the performance requirement. The requirements are then expressed as:

**Requirement 2 with reduction factor:** |∆7.5s| ≥ 0.86 ∙ ,|∆,ℎ| **Requirement 3 with reduction factor:** |7.5s| ≥ 3.2 ∙ ,|∆,ℎ|

After the time instant where requirements 2 and 3 are evaluated, the activated power shall not be decreased below the power at 7.5 seconds at any point in time until start of ramp 2. Small oscillations in the response are accepted, if they are well-damped and caused by inherent properties of the reserve providing entity.

The overshoot in the power response to ramp 1 must not exceed 20 %. In addition, the delay before the response is initiated shall not exceed 2.5 seconds. However, the activation of FCR shall not be artificially delayed, but begin as soon as possible after a frequency deviation.

**Requirement 5a:** |∆max| ≤ 1.2 ∙ |∆,ℎ| **Requirement 5b:** |∆t>2.5s| > 0

The Static FCR-D response must remain active until the frequency is restored. The endurance is tested by maintaining the frequency deviation of ramp 1 (see the static FCR-D ramp test) for 15 minutes (30 minutes for LER-resources) during the test with the most challenging combination of load and droop from an endurance point of view. During tests with other combinations of load and droop the frequency deviation shall be maintained for at least 1 minute.

#### **Requirement 12**: The response shall stay activated as long as the frequency deviation persists.

The Static FCR-D up shall initiate deactivation when the frequency has been continuously above 49.9 Hz for 60 seconds. Similarly, static FCR-D down shall start deactivation when the frequency has been continuously below 50.1 Hz for 60 seconds. The Static FCR-D must be deactivated and ready to perform the next activation within 15 minutes. The 15 minutes are counted from 60 seconds after the return of the frequency into the range where deactivation is allowed. If during deactivation of static FCR-D up the frequency decreases to 49.8 Hz or lower, the deactivation shall be paused, if technically possible. Whereas, if during the deactivation of static FCR-D down, the frequency increases to 50.2 Hz or higher, the deactivation shall be paused, if technically possible. The grace period is prolonged with the same duration the deactivation is paused. If FCR-D is only partially activated, the remaining FCR-D volume shall be ready for activation immediately, even within the grace period when the previously activated volume is unavailable.

| **Requirement 6:** | The Static FCR-D must be deactivated and ready to perform the next activation within 15 minutes counted from 60 seconds after the return of the frequency into the range where deactivation is allowed. The utilised grace period shall be as short as possible and motivated on a technical basis. |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

The rate of deactivation is limited to maximum 2.5% of the theoretical steady state response to a full frequency deviation per second, as a moving average with a window of 10 seconds and with no single step larger than 20%.

| **Requirement 7:** | $P(t-10) - P(t) \leq 0.025 \Delta P_{ss,theoretical} \cdot 10$ |
| ------------------ | -------------------------------------------------------------- |
|                    | $P(t-1) - P(t) \leq 0.2 \Delta P_{ss,theoretical}$             |

#### Where:

() is the power at the evaluated time during deactivation,

( − 10) is the power ten seconds before the evaluated time ,

( − 1) is the power one second before the evaluated time .

Illustration of behaviour of Static FCR-D when there is a frequency deviation during the grace period is shown in Figure 7. In this example, the second frequency deviation is larger than the one that activated the grace period. Therefore, the capacity that was not activated during the first deviation, activates during the grace period. The capacity that was already activated, pauses its deactivation.

## **3.2 Frequency domain stability requirements**

The FCR reserves contribute to the feedback control of the frequency of the power system. Although a single FCR providing entity typically has little impact on the overall grid frequency, it is crucial that the sum of the behaviour of all the FCR providing entities gives a stable feedback loop, see Figure 8. To ensure stability regardless of which entities provide FCR, it is required that every FCR providing entity has a stabilizing impact on the system, such that if the whole FCR volume was provided by entities identical to a specific entity, the system would be stable with a certain stability margin.

The frequency domain stability requirement is tested through sine tests, where the applied nominal 50 Hz frequency signal is to be superimposed with a sinusoidal test signal with different periods ranging from 10 to 300 seconds, resulting in a sinusoidal power output.

The required tests are listed in Table 6. A number of stationary periods are needed to evaluate the test results. The sines should be centred around 50 Hz when testing FCR-N and around 49.7 Hz and 50.3 Hz when testing FCR-D upwards and downwards respectively. If FCR-D upwards and downwards are using the same parameter settings it is sufficient to do the sine test for either FCR-D upwards or FCR-D downwards and let the result represent both reserves. The test shall then be performed at the set point where the requirements are hardest to fulfil. If mode shifting is used for FCR-D, care should be taken so that the mode shifting is blocked during the stationary sine periods that are used for evaluation of the requirements. If the same parameters are used for FCR-N and the high stability mode of FCR-D, the sine test for FCR-D can replaced by sine tests of FCR-N with droop corresponding to the lowest FCR-D droop in order to avoid mode shifting during the sines. When testing FCR-N, FCR-D should be disabled and vice versa. The tests should be carried out at the most challenging load level, which is typically high load. The choice of the operating point must be motivated by prior knowledge and approved by the TSO.

The highest droop setting should be used when testing FCR-N and the lowest droop setting should be used when testing FCR-D. The reason for testing FCR-N with high droop is that the small signal behaviour is central for this reserve. High droop leads to small regulations which might be slow or imprecise due to backlash or dead bands in mechanical parts or valves. It is therefore important that FCR-N is not operated with too high droop. The reason for testing FCR-D with low droop is that FCR-D is aimed at handling large disturbances. Low droop leads to large regulations which may be limited by the maximal ramp rate of servos or other equipment. Therefore, low droop is typically more challenging for FCR-D.

| Period T [s] | Stationary periods (recommended total) | FCR-N (50 Hz center, ±100 mHz, high droop) | FCR-D Up\* (49.7 Hz center, ±100 mHz, low droop) | FCR-D Down\* (50.3 Hz center, ±100 mHz, low droop) |
| ------------ | -------------------------------------- | ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------- |
| 10           | 5 (20)                                 | ✓                                          | ✓                                                | ✓                                                  |
| 15           | 5 (15)                                 | ✓                                          | ✓                                                | ✓                                                  |
| 25           | 5 (10)                                 | ✓                                          | ✓                                                | ✓                                                  |
| 40           | 5 (7)                                  | ✓                                          | ✓                                                | ✓                                                  |
| 50           | 5 (7)                                  | ✓                                          | ✓                                                | ✓                                                  |
| 60           | 5 (7)                                  | ✓                                          | ✓                                                | ✓                                                  |
| 70           | 5 (7)                                  | ✓                                          | ✓                                                | ✓                                                  |
| 90           | 5 (7)                                  | ✓                                          | ✓\*\*                                            | ✓\*\*                                              |
| 150          | 3 (4)                                  | ✓                                          | ✓\*\*                                            | ✓\*\*                                              |
| 300          | 2 (3)                                  | ✓                                          | ✓\*\*                                            | ✓\*\*                                              |

\* If same parameters for up/down, test either one  
\*\* Only for entities with mode shifting

**For each sine test, 2-5 periods with stationary sine power response should be used to calculate the gain and phase shift from the frequency input signal to the power output signal, as illustrated in**

Figure 9

The angular frequency, _ω_, of the sine with period _T_ seconds is:

$$\omega = \frac{2\pi}{T}.\tag{6}$$

The normalised gain of the transfer function from frequency control error to power output signal, **F**(_jω_), is calculated as

$$|F(j\omega)| = \frac{A_P(\omega)}{A_f(\omega)} \frac{|\Delta f_{FCR-X}|}{|\Delta P_{FCR-X,ss,theoretical}|}$$
(7)

Where:

() is the amplitude of the power response in MW from test with sine frequency _ω_,

() is the amplitude of the frequency control error in Hz from the test with sine frequency _ω,_

∆− is the one-sided frequency band (in Hz) for the reserve, i.e. 0.1 Hz for FCR-N and 0.4 Hz for FCR-D, and

∆−,,ℎ is the steady state response of the reserve (in MW) calculated with the provider's steady state response calculation method.

The phase shift in degrees from frequency control error to active power output is calculated as:

$$\varphi = \operatorname{Arg}(F(j\omega)) = \Delta t(\omega) \frac{360^{\circ}}{T} = (t_{peakf} - t_{peakP}) \frac{360^{\circ}}{T}$$
(8)

Where:

_T_ is the period of the sine frequency _ω_ and

**Δ\***t***(***ω**\*) is the time difference in seconds between the frequency control error and the power output from the test with sine frequency ω (see example in**

Figure 9. The phase shift is negative when the power is lagging the frequency control error.

The normalised transfer function from frequency control error to power is then:

$$F(j\omega) = |F(j\omega)|\cos(\varphi(\omega)) + |F(j\omega)| j\sin(\varphi(\omega)) . \tag{9}$$

If the frequency test signal is generated inside the controller and not applied from an external source, the expression on the right hand side in Equation 9 is multiplied with a transfer function approximating the dynamics of the frequency measurement equipment, (), derived according to Section 4.4.

To evaluate the stability criterion of FCR-N and FCR-D, the normalized transfer function of the FCR entity, **F**(jω), is multiplied with the transfer function of the power system, **G**(_iω_), to form the transfer function of the open loop system, (),

$$G_0(j\omega) = \mathbf{F}(j\omega)\mathbf{G}(j\omega). \tag{10}$$

The power system model, with parameters according to Table 7, is:

$$\boldsymbol{G}(j\omega) = \frac{\Delta P_{FCR-X}}{\Delta f_{FCR-X}} \frac{f_0}{S_{n,}} \frac{1}{2H j\omega + K_f \cdot f_0} [\text{p.u.}]. \tag{11}$$

| Parameter               | Description                    | FCR-N performance (Section 3.3) | FCR-N stability              | FCR-D performance (Section 3.3) | FCR-D stability              |
| ----------------------- | ------------------------------ | ------------------------------- | ---------------------------- | ------------------------------- | ---------------------------- |
| $\Delta P_{FCR-X}$ [MW] | FCR-X volume                   | 600 MW                          | 600 MW                       | 1450 MW                         | 1450 MW                      |
| $\Delta f_{FCR-X}$ [Hz] | FCR-X one-sided frequency band | 0.1 Hz                          | 0.1 Hz                       | 0.4 Hz                          | 0.4 Hz                       |
| $f_0$ [Hz]              | Nominal frequency              | 50 Hz                           | 50 Hz                        | 50 Hz                           | 50 Hz                        |
| $S_n$ [MW]              | Nominal power                  | 42 000 MW                       | 23 000 MW                    | 42 000 MW                       | 23 000 MW                    |
| $H$ [s]                 | Inertia constant               | 190 000 MWs/$S_n$ = 4.5238 s    | 120 000 MWs/$S_n$ = 5.2174 s | 190 000 MWs/$S_n$ = 4.5238 s    | 120 000 MWs/$S_n$ = 5.2174 s |
| $K_f$ [p.u./Hz]         | Load frequency dependence      | 0.01                            | 0.01                         | 0.01                            | 0.01                         |

The Nyquist curve of the open loop system can now be examined by plotting the open loop system, (), in the complex plane, see Figure 10. The curve between the measured data points shall be constructed by interpolation. The FCR provider may choose to perform tests at intermediate sine frequencies to investigate transfer function values in the area otherwise interpolated. The system is stable if the Nyquist curve passes on the right side of and does not encircle the point (-1,0j). The stability margin of the system is visualized as the radius of a circle around the point (-1, 0j) which the Nyquist curve is not allowed to enter.

| **Requirement 8:** | The Nyquist curve of the normalized open loop system $\mathbf{G_0}(j\omega) = -\mathbf{F}(j\omega)\mathbf{G}(j\omega)$, shall pass on the right side of a circle with radius 0.43 around the point (-1,0j) in the complex plane, see Figure 10. A 95 % margin on this requirement is allowed, so that a curve that only just crosses over the circle will be accepted as long as it stays out of the circle with radius 0.43 · 0.95. $\mathbf{F}(j\omega)$ and $\mathbf{G}(j\omega)$ shall be calculated separately for FCR-N, FCR-D upwards and FCR-D downwards (parameters for $\mathbf{G}(j\omega)$ are given in Table 7). |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

Entities that cannot fulfil the stability requirement for FCR-N with 95 % margin can ask the connecting TSO for an exemption to fulfil the FCR-N requirement within a 75 % margin. To get such an exemption the provider must show by simulation and/or tests that they have tried to tune the governor to fulfil the requirement before asking for the exemption.

## **3.3 Frequency domain performance requirements**

FCR-N and FCR-D shall also fulfil a frequency domain performance requirement for the closed loop system from power disturbance to frequency including the normalized entity transfer function _F_(j*ω*) (Equation 9) and disturbance profile () = 1 70+1 .

Requirement 9:
$$G_c(s) = K_{margin} \left| \frac{G_{FCR-X perf}(s)}{1+F(s)G_{FCR-X perf}(s)} \right| < \left| \frac{1}{D(s)} \right|$$

The parameter = 0.95 is a scaling factor which allows the provider a 5 % margin on the requirement. If the provider is unable to fulfil the frequency domain performance requirement even with the 5 % margin, the provider is allowed to introduce a capacity reduction factor, _Kred,dyn_ on the transfer function so that the requirement is fulfilled. The reduction factor must not be smaller than 0.9 for FCR-N and 0.75 for FCR-D. The requirement then becomes

Requirement 9, with reduction factor:
$$G_c(s) = K_{margin} \left| \frac{G_{FCR-X \, perf}(s)}{\left(1 + \frac{F(s)}{K_{red,dyn}} G_{FCR-X \, perf}(s)\right)} \right| < \left| \frac{1}{D(s)} \right|$$

The capacity of the entity is then reduced with the minimum of the reduction factor calculated here and the reduction factor (if any) calculated for the steady state performance in section 3.1.1 (FCR-N) or section 3.1.2 (FCR-D).

The frequency domain performance requirement is illustrated in Figure 11. The magnitude of the closed loop transfer function from power disturbance to frequency shall stay below the magnitude of the disturbance profile _D_(j*ω*), i.e. the requirement curve. For the sine waves with short time periods, the entity is not expected to have a large power response, whereas more response is needed when the time period increases.

## **3.4 Linearity requirements**

The activation and deactivation of FCR should follow a droop curve, where the power output increases with decreasing grid frequency, and decreases with increasing grid frequency. For loads, the power consumption should increase with increasing grid frequency and decrease with decreasing grid frequency. In steady state, the change in power output shall be close to proportional to the control error,

$$\Delta P_{FCR} = \frac{1}{e_p} e = \frac{1}{e_p} (f_{ref} - f)$$
, (12)

where *e*ₚ is the permanent droop of the controller.

### 3.4.1 Dynamic linearity requirement

The performance and stability requirements on FCR are based on the assumption that the system and the reserves are linear enough to be analysed with linear theory. The frequency domain requirements are only relevant if the reserve responds in a sufficiently linear way to a frequency disturbance, i.e. that the sinusoidal test signal results in a sinusoidal response with the same period as the input signal. FCR-D providing entities that are unable to dynamically respond linearly to the sine test are classified as "Static FCR-D" and should perform the static linearity test and fulfil the static linearity requirement instead of the dynamic linearity requirement. For FCR-N all entities are required to provide a dynamic response.

The dynamic linearity requirement is evaluated with the sine test. For each tested period of the input signal, a sine with the same period is fitted to the power response data using the least squares method. The baseline power should be subtracted from the measured power, so that the fitted sine is centred on zero. An example is given in Figure 12.

In the frequency domain analysis described in sections 3.2-3.3, the amplitude and phase of the fitted sine are compared to the amplitude and phase of the input signal. To evaluate fulfilment of the linearity requirement, the fitted sine, $P_{est}$ , is compared to the measured power, $P_{mv}$ , for each period separately. The root mean square error of the fitted sine compared to the measured power, normalized with the standard deviation of the fitted sine, should be smaller than one.

Requirement 10:
$$\frac{\sqrt{\sum_{t=1}^{N} |P_{mv}(t) - P_{est}(t)|^2}}{\sqrt{\sum_{t=1}^{N} \left|P_{est}(t) - \frac{1}{N} \sum_{t=1}^{N} P_{est}(t)\right|^2}} < 1$$

If the output signal of the controller is close to zero for the sine tests with shorter periods, the reserve connecting TSO may grant an exemption to the above requirement for those periods. This applies in cases where the output signal can be shown to be close to zero, per design and in actual measurement. The design of the controller has to be deemed reasonable, especially with regards to linearity, and not endangering the purpose of the technical requirements.

### **3.4.2 Linearity requirement for static or non-continuously controlled resources**

Resources that cannot be continuously controlled, such as relay connected resources, shall activate their FCR contribution based on a monotonic piecewise linear power-frequency characteristic with a steady state response that deviates maximally 5% in the direction of underdelivery and 10% in the direction of overdelivery, i.e. the blue area in Figure 13 and Figure 16 respectively. For FCR-N this means that the number of steps has to be at least 14 (7 in each direction), and for FCR-D least 7 steps for each direction. This requirement and the tests described in this section apply to all entities that are non-continuously controlled (FCR-D and FCR-N), and all Static FCR-D independent of if they are continuously controlled or not. Entities providing FCR-D are allowed to continue to linearly increase their activation beyond the frequencies of 49.5 Hz and 50.5 Hz, respectively, as previously mentioned. In such a case the behaviour must be reported in the prequalification documentation.

#### **FCR-N linearity**

Piecewise linear FCR-N resources have to activate their contribution within the blue area in Figure 13 below. For stepwise activated resources this means that the number of steps has to be at least 14. The black line in the figure indicates the mandatory steady state target response for the controller. The controller shall aim to be as close and centred as possible to the target response. Deviations from the target response are allowed if caused by uncertainties in the response, natural variations in production/consumption, or due to fixed step sizes of the resources connected to the relay.

The coordinates for the corners of the blue area in Figure 13 are provided in Table 8 below. The coordinates are given clockwise starting from the minimum activation at 50.1 Hz. The full requirement is calculated via linear interpolation of the provided coordinates.

| Frequency [Hz] | Response [%] |
| -------------- | ------------ |
| 50.10          | -110         |
| 50.00          | -10          |
| 50.00          | -5           |
| 49.90          | 95           |
| 49.90          | 110          |
| 50.00          | 10           |
| 50.00          | 5            |
| 50.10          | -95          |
| 50.10          | -110         |

Resources with non-continuous response shall perform a linearity test to show that they stay in the allowed response area for the steady state response. The test signal is a sequence of frequency steps of 20 mHz per step, i.e. from 50.00 Hz → 49.98 Hz → 49.96 Hz → 49.94 Hz → 49.92 Hz → 49.90 Hz, and up to 50.1 Hz and back to 50.0 Hz, as shown in Figure 14.

When the FCR response has reached steady state, it must stay close to a proportional response to the frequency deviation. For upwards regulation (frequency below 50 Hz) the requirement is +10 % and -5 % referring to Δ,ℎ. For downwards regulation (frequency above 50 Hz) the requirement is +5 % and -10 % referring to Δ,ℎ. To avoid including very short variations in the FCR response, a 10 second moving average of the FCR response is assessed for 60 seconds, starting 60 seconds after a step in the frequency. The provider is allowed to wait longer (up to 4 minutes) if steady state is not reached in 60 seconds, and the moving average is then assessed during the last 60 seconds. The minimum sampling rate is described in Subsection 4.3.

Figure 15 depicts the allowed response area for the moving average, for the frequency steps from 49.92 Hz → 49.90 Hz → 49.92 Hz. The same principles apply for all the steps.

**Requirement 11 upwards:**
$$-0.05 \le \frac{\Delta \bar{P} - |\Delta P_{ss,theoretical}| \frac{|\Delta f|}{0.1}}{|\Delta P_{ss,theoretical}|} \le 0.1$$

Requirement 11 downwards:
$$-0.1 \le \frac{\Delta \bar{P} - |\Delta P_{ss,theoretical}| \frac{|\Delta f|}{0.1}}{|\Delta P_{ss,theoretical}|} \le 0.05$$

#### Where:

$\Delta P_{ss,theoretical}$ is the steady state FCR activation for a full response calculated with the provider's steady state response calculation method. For frequencies below 50 Hz it is positive and for frequencies above 50 Hz it is negative for production units, and vice versa for consumption.

$\Delta f$ is the frequency deviation from 50 Hz for the evaluated step

$\Delta \bar{P}$ is the moving average of the provided FCR for the evaluated step n at time t, calculated as:

$$\Delta \bar{P}(t) = \frac{1}{k} \sum_{i=n-k+1}^{n} \Delta P_{FCR,i}$$
(13)

#### Where

k is the width of the moving average, equal to 10 seconds. Hence, the number of values depends on the sampling rate. The minimum sampling rate is described in Subsection 4.3. $\Delta P_{FCR}$ is the delivered FCR

The moving average $\Delta \bar{P}(t)$ must stay within the required limits from t = 60 seconds to t = 120 seconds after the step, for all frequency steps.

#### **FCR-D** linearity

FCR-D resources have to contribute within the blue area in Figure 16. For stepwise activated resources this means that the number of steps in the controller has to be at least 7 in each direction. The black line in the figure indicates the mandatory target response for the controller. The controller shall aim to be as close and centred as possible to the target response. Deviations from the target response are allowed if caused by uncertainties in the response, natural variations in production/consumption, or due to step sizes of the resources connected to the relay.

The coordinates for the corners of the blue areas in Figure 16 are provided in Table 9 below. The coordinates are given clockwise starting from the minimum activation at 49.88 Hz and 50.12 Hz respectively. The full requirement is calculated via linear interpolation of the provided coordinates.

| Frequency [Hz] | Response [%] | Frequency [Hz] | Response [%] |
| -------------- | ------------ | -------------- | ------------ |
| 49.88          | 0            | 50.12          | 0            |
| 49.50          | 95           | 50.50          | -95          |
| 49.50          | 110          | 50.50          | -110         |
| 49.90          | 10           | 50.10          | -10          |
| 49.90          | 0            | 50.10          | 0            |
| 49.88          | 0            | 50.12          | 0            |

Resources with a non-continuous response and/or providing static FCR-D shall perform a linearity test to show that they stay in the allowed response area for the steady state response. The test sequence for FCR-D upwards is plotted in Figure 17 and FCR-D downwards in Figure 18. The test signal is a sequence of grid frequency steps of 100 mHz per step where the last step is slightly larger so that the frequency enters the normal band, i.e. for FCR-D upwards from 49.90 Hz → 49.80 Hz → 49.70 Hz → 49.60 Hz → 49.50 Hz, and back to 49.91 Hz and for FCR-D downwards from 50.10 Hz → 50.20 Hz → 50.30 Hz → 50.40 Hz → 50.50 Hz, and back to 50.09 Hz.

When the FCR response has reached steady state, it must stay close to a proportional response to the frequency deviation. For upward regulation (frequency below 50 Hz) the requirement is +10 % and -5 % referring to ∆,ℎ for a full activation. For downward regulation (frequency above 50 Hz) the requirement is +5 % and -10 % referring to ∆,ℎ for a full activation. To avoid including very short variations in the FCR response, a 10 second moving average of the FCR response is assessed 60 seconds after a step in the frequency. The moving average is assessed for 60 seconds, hence there has to be 120 seconds between the steps. The minimum sampling rate is described in Subsection 4.3.

Figure 19 depicts the allowed response area for the moving average, for the frequency steps from 49.6 Hz → 49.5 Hz → 49.6 Hz. The same principles apply for all the steps.

**Requirement 11 upwards:**
$$-0.05 \le \frac{\Delta \bar{P} - |\Delta P_{ss,theoretical}| \frac{|\Delta f|}{0.4}}{|\Delta P_{ss,theoretical}|} \le 0.1$$

**Requirement 11 downwards:**
$$-0.1 \le \frac{\Delta \bar{P} - |\Delta P_{ss,theoretical}| \frac{|\Delta f|}{0.4}}{|\Delta P_{ss,theoretical}|} \le 0.05$$

#### Where:

∆,ℎ is the steady state FCR activation for a full response calculated with the provider's steady state response calculation method. For frequencies below 50 Hz it is positive and for frequencies above 50 Hz it is negative for production units, and vice versa for consumption,

∆ is the frequency deviation from 49.9 Hz for FCR-D upwards and from 50.1 Hz for FCR-D downwards to the evaluated step,

∆̅ is the moving average of the provided FCR for the evaluated step at time _t_, calculated as in Equation 13.

## **3.5 Endurance and limited energy reservoirs, LER**

The FCR response shall remain activated as long as the frequency deviation persists.^8^ This is required also of FCR providing entities with a limited energy reservoir.

The FCR provider shall in the application document the limitations of the energy reservoir in accordance with instructions from the reserve connecting TSO. The application shall also describe the implementation of an energy management solution, including the recovery process, to be approved by the TSO. Use of energy management functions shall not interfere with the ability to provide FCR.

FCR providing entities with an energy reservoir that is smaller than the equivalent of a continuous full activation of the prequalified FCR capacity for two hours are classified as LER (limited energy reservoir) and must implement energy management solutions as described in section 3.5.1 and 3.5.2. Such entities must reserve power in both directions (activation and deactivation direction) for energy management as described in Table 10 below. It is recommended to trade the energy used for energy management for example on the intra-day market. The required power reservation for energy management can be used according to the trades, in addition to activating the required energy management solutions.

FCR providing entities with an energy reservoir where the endurance for full activation exceeds two hours may implement the same energy management solutions, or during prequalification propose other solutions of similar effect, to be approved by the reserve connecting TSO.

FCR providing entities classified as LER which have an energy reservoir that is not replenished from the power grid may suggest an alternative energy management solution with similar effect, to be approved by the TSO. Specifically for entities that cannot reverse power direction, e.g. one-directional chargers, NEM is not applicable. Instead, such entities need to ensure their pool of individual resources is large enough to maintain full activation for at least two hours.

**Note.** The requirements described in this section are valid for the time being. However, the requirements on power and energy (Table 10) and the thresholds for NEM and AEM (Table 11) will be re-evaluated regularly and updated if needed. For the required energy in FCR-N the foreseen range for evaluation is 1-1.5 h per direction. The design of the energy management functions NEM and AEM will also be revisited.

|                                 | FCR-N              | FCR-D upwards             | FCR-D downwards             |
| ------------------------------- | ------------------ | ------------------------- | --------------------------- |
| Required power upwards [MW]     | +1.34 · C\_{FCR-N} | +C\_{FCR-Dupwards}        | +0.20 · C\_{FCR-Ddownwards} |
| Required power downwards [MW]   | −1.34 · C\_{FCR-N} | −0.20 · C\_{FCR-Dupwards} | −C\_{FCR-Ddownwards}        |
| Required energy upwards [MWh]   | 1 h · C\_{FCR-N}   | 1/3 h · C\_{FCR-Dupwards} | 0                           |
| Required energy downwards [MWh] | 1 h · C\_{FCR-N}   | 0                         | 1/3 h · C\_{FCR-Ddownwards} |

FCR-N provision from an FCR providing entity with a limited energy reservoir (LER) shall be continuously available during the whole contractually agreed delivery period, currently increments of 1 hour. The endurance requirement for full activation of FCR-N is minimum 60 minutes in both directions ( = 60 min). Recharging and discharging of FCR-N is mainly handled by natural frequency deviations, as FCR-N is a symmetric product. Normal state energy management shall be applied in accordance with section 3.5.1, if the natural frequency deviations are not such that the energy content of the response is close to zero.

FCR-D provision from an FCR providing entity with limited energy reservoirs (LER) shall be continuously available when the power system is in normal state. As of triggering of power system alert state9 and during the power system alert state, each FCR-D providing entity with limited energy reservoirs shall be able to fully activate FCR continuously for a time period of 15 minutes10 (, = 15 min). As FCR-D may be fully activated both when the power system is in both normal state and alert state, the total endurance requirement for FCR-D thus becomes minimum 20 minutes ( = 20 min).

The power and energy capacity reservations apply separately for FCR-N, FCR-D upwards and FCR-D downwards, in case of simultaneous provision of several products. For example, if both FCR-D upwards and FCR-D downwards are provided at the same time, the two corresponding columns of Table 10 shall be summed to get the total power and energy reservation. The implementation of the energy management functions (see sections 3.5.1 and 3.5.2 shall consider all provided products and ensure the respective energy reservations per product during operation as closely as possible. For example, FCR-N activation must never lead to depletion of FCR-D. The implementation of simultaneous provision of several products shall be described in the application and is subject to approval by the TSO.

When providing symmetric reserves from LER entities it is suggested that the SOC is close to 50 % at the start of a period. For asymmetric reserves the SOC should be close to 0 % or 100 % depending on the provision direction.

### **3.5.1 Normal State Energy Management (NEM)**

FCR-N and FCR-D providing entities with limited energy reservoirs shall implement a Normal State Energy Management (NEM) scheme. The purpose of NEM is to ensure that there is enough energy available in the reservoir to activate FCR, and to minimize any imbalances caused by the State of Charge (SOC) management.

The NEM is allowed to change the baseline (setpoint) of the entity providing FCR-N or FCR-D to restore the SOC. NEM is only allowed to activate in normal state, i.e. when the frequency is within the standard frequency range (±100 mHz of the nominal frequency, "the normal band"). When the frequency is outside the standard frequency range for a longer time, and thus in alert state, the NEM mode shall be disabled (_PNEM_ shall ramp back to zero). If the entity is close to full depletion during a long-lasting frequency deviation in alert state, the entity must switch on _Alert state Energy Management_ (AEM) mode (see 3.5.2.

The FCR providing entity shall enter NEM when the frequency is within the standard frequency range and the SOC of the entity is outside of the NEM enable thresholds (see Table 11). The NEM should be disabled when the entity reaches a state of charge within the NEM disable thresholds (see Table 11) or if the frequency leaves the standard frequency range. The SOC is defined as the energy currently in the storage over the maximal energy the storage can hold, i.e. E/E_max. Note that here only the energy available for FCR provision is considered. It may be less than the total energy in the reservoir.

For FCR-D, NEM should be enabled as soon as the remaining endurance is less than 20 minutes in upwards direction for FCR-D upwards or in the downwards direction for FCR-D downwards, if the frequency is within the standard frequency range. NEM should be disabled when the remaining endurance is 20 minutes, or higher for a storage with larger energy capacity than the minimum requirement. For FCR-N, NEM should be enabled when the remaining endurance is less than 30 minutes if the frequency is within the standard frequency range. NEM should be disabled when the remaining endurance is 57.5 minutes, or higher for a storage with larger energy capacity than the minimum requirement. For both reserve products, NEM should always be disabled when the frequency leaves the standard frequency range. The SOC thresholds for enabling and disabling NEM are given in Table 11. It is recommended to implement the thresholds of Table 11 in the controller in such a way that they can be easily adjusted if needed. The disable thresholds can be changed if agreed with the TSO.

| SOC Threshold            | FCR-N                                   | FCR-D Upwards                     | FCR-D Downwards                       |
| ------------------------ | --------------------------------------- | --------------------------------- | ------------------------------------- |
| SOC enable AEM, upper    | $1 - C_{FCR-N} \cdot \frac{5/60}{E}$    | N.A.                              | $1 - C_{FCR-D} \cdot \frac{5/60}{E}$  |
| SOC disable AEM, upper   | $1 - C_{FCR-N} \cdot \frac{10/60}{E}$   | N.A.                              | $1 - C_{FCR-D} \cdot \frac{10/60}{E}$ |
| SOC enable NEM, upper    | $1 - C_{FCR-N} \cdot \frac{30/60}{E}$   | N.A.                              | $1 - C_{FCR-D} \cdot \frac{20/60}{E}$ |
| SOC disable NEM, upper\* | $1 - C_{FCR-N} \cdot \frac{57.5/60}{E}$ | N.A.                              | $1 - C_{FCR-D} \cdot \frac{20/60}{E}$ |
| SOC disable NEM, lower\* | $C_{FCR-N} \cdot \frac{57.5/60}{E}$     | $C_{FCR-D} \cdot \frac{20/60}{E}$ | N.A.                                  |
| SOC enable NEM, lower    | $C_{FCR-N} \cdot \frac{30/60}{E}$       | $C_{FCR-D} \cdot \frac{20/60}{E}$ | N.A.                                  |
| SOC disable AEM, lower   | $C_{FCR-N} \cdot \frac{10/60}{E}$       | $C_{FCR-D} \cdot \frac{10/60}{E}$ | N.A.                                  |
| SOC enable AEM, lower    | $C_{FCR-N} \cdot \frac{5/60}{E}$        | $C_{FCR-D} \cdot \frac{5/60}{E}$  | N.A.                                  |

\* For storages with larger energy capacity than minimum requirement

The storage, E, that is available for reserve provision is referring to the operational range of the storage that the provider will utilise to provide the reserve. Hence, not the nominal capacity of the storage.

When entering or leaving the conditions where NEM is allowed, the current value for the amount of energy management shall be calculated from a rolling mean of the $NEM_{Allowed}$ over the last 5 minutes, with 1 second resolution.

| $NEM_{Allowed} = \begin{cases} -1, & \text{if } 49.9 < f < 50.1 \text{ and } SOC < SOC_{NEM,lower,enable/disable} \\ 1, & \text{if } 49.9 < f < 50.1 \text{ and } SOC > SOC_{NEM,upper,enable/disable} \\ 0, & \text{otherwise} \end{cases}$ | (14) |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |

$$NEM_{Current}(t_i) = \frac{1}{N} \sum_{n=1}^{N=300} NEM_{Allowed}(t_{i-n})$$
(15)

For FCR-N, when $NEM_{Current}(t_i) \neq 0$ , the entity should change its power setpoint $P_{tot}^{FCR-N}$ , such that the SOC will be restored:

$$P_{tot}^{FCR-N} = P_{FCR-N} + P_{NEM}^{FCR-N} = P_{FCR-N} + 0.34 \cdot C_{FCR-N} \cdot NEM_{current} . \tag{16}$$

When NEM is fully activated, i.e. $NEM_{Current}(t_i) = \pm 1$ , the power setpoint will be changed such that $P_{tot}$ either reduce the rate of which SOC is approaching its limit or reverses the direction, depending on the current FCR-N contribution $P_{FCR-N}$ . This way, the available energy in the limiting direction will be increased compared to the reference, ensuring that the dynamic FCR-N performance of the entity will be conserved and continuously available in normal state. To be able to achieve this, the FCR-N providing entity with LER has to reserve a power capacity equal to 34 % of the FCR-N provision, which cannot be

utilised for other purposes (see requirement in Table 10). The provider may choose a higher recharging/discharging rate, up to a maximum of 50 %.

FCR-D providing entities with partially or fully depleted energy reservoirs shall restore full nominal capacity within 120 minutes of the allowed start of recovery. Hence, the FCR-D NEM requires that at least 20 % of the FCR provision is reserved in the opposite direction (see requirement in Table 10). For FCR-D, when $NEM_{Current}(t_i) \neq 0$ , the entity should change its power setpoint, $P_{tot,FCR-D}$ , such that the SOC will be restored:

$$P_{tot}^{FCR-D} = P_{FCR-D} + P_{NEM}^{FCR-D} = P_{FCR-D} + 0.20 \cdot C_{FCR-D} \cdot NEM_{current} . \tag{17}$$

### 3.5.2 Alert State Energy Management (AEM)

In addition to NEM, FCR-N and FCR-D providing entities with limited energy reservoirs shall implement an Alert State Energy Management (AEM) scheme. The purpose of AEM is to ensure that the FCR response does not fully and suddenly cease when the energy reservoir is close to a full depletion. When entity reaches AEM state, it is no longer maintaining the reserve and is hence seen as not available. The conditions for activation and deactivation of AEM are given in Table 11. NEM and AEM schemes can be active simultaneously.

The AEM function changes the frequency reference for the entity providing FCR-N or FCR-D to reach a state of energy exhaustion in a controlled manner. The activated power for each FCR product shall be calculated from the difference between the reference frequency and the measured frequency. The frequency reference shall be calculated as a rolling mean of the $f_{AEM}$ over the last 5 minutes, with 1 second resolution.

$$f_{ref}^{FCR-X} = \frac{1}{N} \sum_{n=1}^{N=300} f_{AEM}^{FCR-X}.$$
(18)

The frequency $f_{AEM}^{FCR-X}$ is defined separately for each FCR product as

$$f_{AEM}^{FCR-X} = \begin{cases} f_0, & \text{if AEM is not activated} \\ f_{measured}^{FCR-X}(t), & \text{if AEM is activated.} \end{cases}$$
(19)

where the parameter $f_0$ is taken to be

$f_0 = 50.0 \text{ Hz for FCR-N}$

$f_0 = 49.9$ Hz for FCR-D upwards

and $f_0 = 50.1$ Hz FCR-D downwards.

The signal $f_{measured}^{FCR-X}$ is a saturated version of the measured frequency $f_{measured}$ which varies for the different FCR products as follows

$$f_{measured}^{FCR-N}(t) = \begin{cases} 50.1 \text{ Hz} & \text{if } f_{measured}(t) > 50.1 \text{ Hz} \\ 49.9 \text{ Hz} & \text{if } f_{measured}(t) < 49.9 \text{ Hz} \\ f_{measured}(t) & \text{otherwise,} \end{cases} \hfill (20)$$

$$f_{measured}^{FCR-D up}(t) = \begin{cases} 49.9 \text{ Hz} & \text{if } f_{measured}(t) > 49.9 \text{ Hz} \\ f_{measured}(t) & \text{otherwise,} \end{cases}$$
(21)

$$f_{measured}^{FCR-D\ down}(t) = \begin{cases} 50.1\ \text{Hz} & \text{if } f_{measured}(t) < 50.1\ \text{Hz} \\ f_{measured}(t) & \text{otherwise.} \end{cases}$$
(22)

Equations 20-22 may need to be adapted depending on controller implementation. The adaption may be allowed, subject to approval from the reserve connecting TSO, if equivalent behaviour is achieved.

$$P_{FCR-X}(t) = \frac{c_{FCR-X}}{\Delta f_{max}} \cdot \Delta f_{FCR-X}(t) = \frac{c_{FCR-X}}{\Delta f_{max}} \cdot \left( f_{ref}^{FCR-X} - f_{measured}^{FCR-X}(t) \right), \tag{23}$$

where $\Delta f_{max}$ is the frequency change that results in full FCR activation, equating 0.1 Hz for FCR-N and 0.4 Hz for FCR-D. Note that $f_{ref}^{FCR-X}$ and $f_{measured}^{FCR-X}(t)$ in this equation are different for the different products.

For FCR-D up, the output power in downward direction shall be limited to the power reserved for NEM for FCR-D up, i.e. the FCR-D down power shall not be used by FCR-D up. Similarly, for FCR-D down, the output power in upward direction shall be limited to the power reserved for NEM for FCR-D down. For FCR-N, the power output in each direction should be limited to the power reserved for FCR-N and its NEM, i.e. the FCR-N shall not use power reserved for FCR-D.

$$-\left(C_{FCR-N} + P_{NEM,max}^{FCR-N}\right) \le P_{tot}^{FCR-N}(t) \le C_{FCR-N} + P_{NEM,max}^{FCR-N} \tag{24}$$

$$-P_{NEM,max}^{FCR-D\,up} \le P_{tot}^{FCR-D\,up}(t) \tag{25}$$

$$P_{tot}^{FCR-D\ down}(t) \le P_{NEM\ max}^{FCR-D\ down} \tag{26}$$

The following test sequences aim to test the endurance of FCR providing LER entities and that they can correctly activate and deactivate energy management functions (NEM and AEM). In the following sections the test sequences for FCR-N and FCR-D are described. The following requirement shall be fulfilled for each provided product:

| **Requirement 12 (for LER):** | The response shall stay activated as long as the frequency deviation persists. NEM and AEM shall behave according to the specifications given in sections 3.5.1 and 3.5.2. |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

#### FCR-N

In Table 12 the energy management test for FCR-N is described. The test sequence covers enabling and disabling of NEM and AEM in an upwards situation

The durations and start times in the table work as an example. Actual durations may vary depending on reservoir size and initial state of charge, and they must be adjusted to meet the objectives for AEM/NEM deactivation and activation stated in the table.

To reduce testing time, initial SOC at the beginning of the test is allowed to be close to the threshold for NEM activation.

| Step | Start time [min] | Duration [min] | Frequency [Hz] | NEM    | AEM | Purpose                                                       |
| ---- | ---------------- | -------------- | -------------- | ------ | --- | ------------------------------------------------------------- |
| -    | 0                | 2              | 50.0           | Off    | Off | Initial stabilization                                         |
| 1    | 2                | 28             | 50.09          | On     | Off | Hold until NEM activates (SOC threshold reached)              |
| 2    | 30               | 6              | 50.11          | Off    | Off | NEM deactivates when frequency exceeds 50.1 Hz                |
| 3    | 36               | 2.5            | 50.09          | On     | Off | NEM reactivates when frequency drops below 50.1 Hz            |
| 4    | 38.5             | 7.5            | 50.11          | Off    | On  | Hold 5 min after AEM activates (high SOC threshold)           |
| 5    | 46               | 10             | 50.09          | On     | On  | FCR response with both NEM and AEM active                     |
| 6    | 56               | 60             | 49.91          | Off/On | Off | Hold until NEM/AEM deactivate, then NEM reactivates (low SOC) |
| 7    | 116              | 5              | 49.89          | Off    | Off | NEM deactivates when frequency drops below 49.9 Hz            |
| 8    | 121              | 2.5            | 49.91          | On     | Off | NEM reactivates when frequency exceeds 49.9 Hz                |
| 9    | 123.5            | 10             | 49.89          | Off    | On  | Hold 5 min after AEM activates (low SOC threshold)            |
| 10   | 133.5            | 10             | 49.91          | On     | On  | FCR response with both NEM and AEM active                     |
| 11   | 143.5            | 30             | 50.0           | Off    | Off | Hold until both NEM and AEM deactivate                        |

Figure 20 illustrates the first half of the energy management test for FCR-N (steps 1 to 6). The second half of the test is mirrored but otherwise similar. The figure shows the NEM/AEM thresholds, SOC, power, input frequency and reference frequency for the example case.

### **FCR-D upwards and downwards**

The energy management test is described in Table 13 and Figure 21 for FCR-D up- and downwards. The durations and start times in the table and figure works as an example. Actual durations may vary depending on reservoir size and initial state of charge, and they must be adjusted to meet the objectives for AEM/NEM deactivation and activation stated in the table.

To reduce testing time, Initial SOC at the beginning of the test is allowed to be close to the threshold for NEM activation.

| Step | Start time [min] | Duration [min] | Frequency [Hz] (Up/Down) | NEM    | AEM | Purpose                                                       |
| ---- | ---------------- | -------------- | ------------------------ | ------ | --- | ------------------------------------------------------------- |
| -    | 0                | 0.5            | 49.91/50.09              | Off    | Off | Initial stabilization                                         |
| 1    | 0.5              | 10             | 49.5/50.5                | Off    | Off | Hold until NEM activates (entering normal band in step 2)     |
| 2    | 10.5             | 2.5            | 49.91/50.09              | On     | Off | NEM activates upon entering normal frequency band             |
| 3    | 13               | 15             | 49.5/50.5                | Off    | On  | Hold 5 min after AEM activates                                |
| 4    | 28               | 15             | 49.91/50.09              | On/Off | Off | Hold until NEM activates in normal band, then both deactivate |

Figure 21 illustrates the test for FCR-D downwards. The test for FCR-D upwards is mirrored but otherwise similar. The figure shows the input frequency, state of charge and the NEM and AEM thresholds of the LER unit in the example test case. It further shows the active power output (% of FCR-D capacity) and the reference frequency. The reference frequency affects the active power output as shown in the figure.

Entities with a limited activation capability shall, in real time, calculate and report the endurance of the FCR reserve, if required by the relevant TSO. The endurance of FCR-N is the minimum of the upwards and downwards endurance. The endurance of FCR-D upwards is the upwards endurance and the endurance of FCR-D downwards is the downwards endurance.

The upwards endurance of FCR-X (the time until an entity providing FCR-X is limited) is calculated as

$$L_{FCR-X\ endurance,upwards} = \left| \frac{E_{current\ reservoir} - E_{reservoir\ min}}{P_{setpoint} + C_{FCR-X\ upwards}(sp,ep) - P_{reservoir\ inflow}} \right| \cdot 60\ [minutes] \quad (27)$$

and the downwards endurance of FCR-X is calculated as

$$L_{FCR-X\ endurance,downwards} = \left| \frac{E_{reservoir\ max} - E_{current\ reservoir}}{P_{reservoir\ inflow} - P_{setpoint} + C\ FCR-X\ downwards}(sp,ep)} \right| \cdot 60\ [minutes] \quad (28)$$

with the notation

is the reservoir current maximum storage threshold/limit [MWh],

is the reservoir current minimum storage threshold/limit [MWh],

is the current reservoir level [MWh],

is the current power setpoint (negative for absorbed power) [MW],

is the current reservoir inflow if applicable [MW],

− is the current endurance [minutes].

− (, ) is the provided FCR-X in the upwards direction at the current setpoint (load) and droop, and

− (, ) is the provided FCR-X in the downwards direction (with positive sign) at the current setpoint (load) and droop.

Note that the factor 60 in the equations is used to convert from hours to minutes.

Note that entering the Normal State Energy Management (NEM) mode changes the power setpoint. If the FCR providing entity is in the Alert State Energy Management (AEM) mode, the reported endurance should be set to zero in the respective direction.

For FCR providing entities, limited due to something other than reservoir restrictions, the calculations shall be performed in a similar fashion but with the applicable modifications to the procedure, to be approved by the TSO.

## **3.6 Simultaneous delivery of several reserves or functions**

An entity providing several reserves (e.g. FCR, FRR, FFR, and LFSM) at the same time shall always activate each of these reserves according to their individual prequalification/specification, and the total power of the entity should reflect the sum of the reserves. The baseline of the entity must allow full activation of all the contracted reserves at the same time.

In steady state, an entity providing both FCR-N and FCR-D shall activate the sum of FCR-N and FCR-D at any frequency deviation, see Figure 22. For entities with one controller that switches the control parameters between the products, this implies that the droop setting must be the same in both parameter sets.

It is recommended that the controller structure is implemented such that all three FCR products are individually controllable, i.e. delivered from separate controllers for each product. If the entity has another implementation, for example only one controller that switches between FCR-N and FCR-D control parameters, it must switch from FCR-N parameters to FCR-D parameters when the frequency crosses 49.9 Hz or 50.1 Hz without intentional delay^11^. For switching back from FCR-D to FCR-N there can be a

delay after the frequency has returned within the 49.9-50.1 Hz band. The delay may be up to 30 seconds, but the recommended value is 15 seconds.

The switching of the parameters can be done in an arbitrary way, given that the behaviour complies with all other requirements. The TSO has the right to ask for additional testing and/or simulations, if there is reason to believe that the controller configuration and/or parameter settings have any unforeseen dynamic that is disadvantageous for the power system stability.

The combination of FCR-N and FCR-D is tested with the FCR-D ramp sequence described in section 3.1.2.

FSM and LFSM are defined in the Commission regulation (EU) 2016/631, Requirements for Generators. The FSM function is typically utilised to provide FCR-D in the Nordic system, whereas LSFM is a function for frequency regulation outside the FCR frequency band.

FCR-D providing entities **without separate** LFSM controllers **are not allowed** to have a saturation limit on the frequency measurement input to the FCR-D controller, i.e. for upwards regulation there should be no lower limit for the frequency input and for downwards regulation there should be no upper limit for the frequency input. The controller parameters of the FCR-D controller must not be changed when the frequency enters the LFSM frequency band. If the entity **is not required** to deliver LFSM through grid connection requirements, the FCR-D controller output is allowed to saturate at the sold FCR-D volume. If the entity **is required** to deliver LFSM, the FCR-D controller output is not allowed to saturate before the entity reaches its maximum or minimum power output.

Entities **with a separate** LFSM controller **are allowed** to have a saturation limit on the frequency measurement input to the FCR-D controller. The saturation limit should be 49.5 Hz for FCR-D upwards and 50.5 Hz for FCR-D downwards. The LFSM controller is recommended to utilise the same parameters as the FCR-D controller.

The combination of FCR-D and LFSM is tested with the FCR-D ramp sequence described in section 3.1.2. In steady state, an entity providing both FCR-D and LFSM shall activate the sum of FCR-D and LFSM at any frequency deviation, similarly as described for the combination of FCR-N and FCR-D in section 3.6.1.

## **3.7 Start and end of FCR provision during a frequency disturbance**

The following rules shall apply when the system frequency does not equal 50.0 Hz during a change in FCR provision from an entity. They apply regardless of the size of the frequency deviation and the system state.

### **3.7.1 FCR-N**

When FCR-N provision is initiated from an FCR-N providing entity the frequency input shall be changed from 50.0 Hz (= zero activation) to the currently measured system frequency. The stepwise change in input frequency shall lead to an FCR-N response in line with both the performance requirements of FCR-N, and the typical response of the entity. This shall ensure a smooth activation response.

When FCR-N provision is scheduled to end from an FCR-N providing entity the frequency input shall be changed from the currently measured system frequency to 50.0 Hz (= zero activation). The stepwise change in input frequency shall lead to an FCR-N response in line with both the performance requirements of FCR-N, and the typical response of the entity. This shall ensure a smooth deactivation response. When the FCR-N response has naturally ceased, the FCR-N provision may be ended.

If manually modifying the frequency input is not feasible, the applying provider may propose an alternative implementation. The proposal shall achieve the same effect as stated above and be approved by the TSO. The implementation may be on portfolio level.

When the amount of FCR-N provision changes during a frequency disturbance, FCR-N provision should be changed to correspond to the bid for the second market time unit. This applies to a situation where provider has sold different amounts of reserve for consecutive market time units and frequency disturbance occurs during change of the market time unit. The change in droop shall lead to an FCR-N response in line with both the performance requirements of FCR-N, and the typical response of the entity.

### **3.7.2 FCR-D**

When FCR-D provision is initiated from an FCR-D providing entity the frequency input shall be changed from a frequency with zero activation (f > 49.9 Hz for FCR-D upwards and f<50.1 Hz for FCR-D downwards) to the currently measured system frequency. The stepwise change in input frequency shall lead to an FCR-D response in line with both the performance requirements of FCR-D, and the typical response of the entity. This shall ensure a smooth activation response.

When FCR-D provision is scheduled to end from an FCR-D providing entity with a current FCR-D response, the FCR-D provision shall continue until the frequency deviation enters the standardized frequency interval ("normal band", ± 100 mHz) and the FCR-D response naturally ceases. If the frequency deviation is long-lasting, the FCR-D response may start to ramp down after 15 minutes after the scheduled end. The ramp must be over a period of 5 minutes.

If no FCR-D response is being provided at the time for the scheduled end of provision, the provision may be ended immediately.

If manually modifying the frequency input is not feasible, the applying provider may propose an alternative implementation. The proposal shall achieve the same effect as stated above and be approved by the TSO. The implementation may be on portfolio level.

When the amount of FCR-D provision changes during a frequency disturbance, FCR-D provision should be changed to correspond to the bid for the second market time unit. This applies to a situation where provider has sold different amounts of reserve for consecutive market time units and frequency disturbance occurs during change of the market time unit. When providing static FCR-D, the magnitude of FCR-D response is calculated from the frequency from the start of the second market time unit, if technically possible. The change in droop and disturbance frequency shall lead to an FCR-D response in line with both the performance requirements of FCR-D, and the typical response of the entity.

## **3.8 Baseline methodology**

FCR providing entities must calculate the reference power or baseline, as the FCR response is calculated as the difference between the active power output after the activation and the active power output that would have occurred if the entity had remained not activated (the baseline).

FCR providing entities with a controllable and predetermined production or consumption can use the setpoint as reference power or baseline. Other entities must present a method for baseline calculation to the relevant TSO for approval. Similarly, the available FCR capacity should be forecasted at the time of bidding for FCR. This calculation must also be approved as required by the relevant TSO.

## **3.9 Capacity calculation**

A provider needs to calculate the FCR capacity that can be offered to the market and also the maintained capacity in real-time during delivery of FCR. This section describes how these capacities are calculated.

Steps for calculating the capacity that can be offered to the market

- 1. Determine the steady state response. Examples of methods for calculating the steady state response are given in Appendix 1.
- 2. Apply reduction factors, if any. If all the requirements were fulfilled without reduction factors, this step can be skipped. If a reserve was prequalified with a reduction factor, the capacity is the steady state response times the reduction factor. If the reserve was prequalified with different reduction factors at high and low load or at high and low droop, the provider can either use the lowest reduction factor for all cases or interpolate the reduction factor with regards to the load and droop at the time of delivery, see Figure 23 and Figure 24
- 3. Check headroom taking other reserves into account. The sum of the sold capacities of all reserves in upwards and downwards direction respectively needs to be possible to activate within the operating range of the entity. As a general rule the provider is not allowed to use a droop that will cause saturation of the response at a smaller frequency deviation than the maximum frequency deviation defined for each reserve. An exception from this rule is made for FCR-D when the entity has a capacity reduction factor, in which headroom is needed only for the sold capacity of FCR-D. For FCR-N however the provider needs to reserve headroom for the full steady state response so that the response is linear in the whole FCR-N frequency band and so that FCR-N does not appropriate capacity from FCR-D.

### 3.9.1 Maintained capacity (real time data)

Providers of FCR must report their maintained FCR capacity to the TSO in real time, if required by the relevant TSO. The maintained capacity is the FCR capacity that in practice is available and would be activated if the maximal frequency deviation occurred. The maintained capacity should be equal to or larger than the sold capacity. Operational limits of the FCR providing entities should be taken into account in the calculation of the maintained capacity. The maintained capacity is calculated as

$$C_{FCR-N,maintained} = \min \left( P_{max} - P_{baseline} - C_{FRR} , P_{baseline} - C_{FRR} - P_{min} , C_{FCR-N} \right), \tag{29}$$

$$C_{FCR-D,upwards,maintained} = \max \left[ \min \left( P_{max} - P_{baseline} - C_{FRR+FFR} - \left| \Delta P_{ss,FCR-N,up} \right|, C_{FCR-D,upwards} \right), 0 \right]$$
(30)

and
$$C_{FCR-D,downwards,maintained} = \max[\min(P_{baseline} - C_{FRR} - |\Delta P_{SS,FCR-N,down}| - P_{min}, C_{FCR-D,downwards}), 0].$$
(31)

$P_{max}$ is the current maximum power output,

$P_{min}$ is the current minimum power output,

$P_{baseline}$ is the current power baseline (the setpoint or the calculated power without frequency control),

$|\Delta P_{ss,FCR-N,up}|$ is the steady state response of FCR-N at 49.9 Hz,

$|\Delta P_{SS,FCR-N,down}|$ is the steady state response of FCR-N at 50.1 Hz,

$C_{FRR+FFR}$ is the sold capacity of FRR and FFR in the relevant direction and

$C_{FCR-X}$ is the capacity of the reserve, i.e. the steady state response of the reserve at full activation scaled with the capacity reduction factor (if any), see Eq. 3 and Eq. 5.

$C_{FCR-X}$ is zero when the frequency control is inactive. The value of $C_{FCR-N}$ is set to zero for an entity delivering only FCR-D.

Figure 25 illustrates how the capacities of different reserves are added when providing multiple products at the same time. It does not indicate which reserves have the highest priority for the power system nor how a coordinated control of several reserves is to be implemented in case of insufficient capacity. Instead, it describes a typical behaviour of a reserve providing entity when the control is active for all sold reserves. If there is not enough headroom for all the sold capacities, the maintained FCR-D capacity is limited first, then the FFR capacity, then FCR-N, then FRR. The reasoning behind this is that FRR and FCR-N can be fully activated when a disturbance that activates FCR-D and FFR occurs. When the disturbance occurs,

FFR will activate faster than FCR-D, and therefore it is FCR-D that will not be delivered fully. With regards to FCR-N and FRR, any of these reserves can be activated before the other. However, since FCR-N is typically located after FRR in the control chain (FCR works as a difference to the setpoint including FRR), the FRR reserve takes priority over the FCR-N.

## **3.10 Capacity determination for uncertain or varying processes**

The delivered response from an FCR providing entity may be partly uncertain, due to e.g. stochastic or periodic consumption of the entity. The delivered response shall then be calculated as the difference between the active power output after the activation, and the active power output that would have occurred if the entity had remained not activated. This is illustrated for two types of varying loads in Figure 26 and Figure 27.

Figure 26 illustrates a situation where the load variations are independent of if the entity has been activated or not. If it is possible to determine that the variations are independent of activation, they will be considered part of the baseline variations during prequalification and operation. To do this assessment the application has to include suitable data and documentation.

Figure 27 illustrates a situation where the variations are not independent of the delivery. In such a case the capacity shall be determined from the response that is ensured, i.e. the minimum of the response curve after activation.

## **3.11 Provision from aggregated resources**

FCR can be provided using an aggregated group of resources forming a reserve providing entity. The reserve providing entity as a whole must always provide a response that meets the technical requirements, while the individual resources on their own do not necessarily have to.

Some providers using aggregated groups may desire some flexibility within the group, e.g. that they may want to add or remove resources after initial prequalification, or that not all resources in the group are able to participate in provision all the time. These two different kinds of flexibility are denoted as _flexible prequalification_ and _flexible operation_, respectively. The two concepts, flexible prequalification and flexible operation, may be combined. The combinations are illustrated in Figure 28 and explained in Table 14 below.

The response after use of flexibility is required to be within the technical requirements. Flexibility is allowed only to the extent that is possible without endangering the general purpose and intent of the technical requirements. During initial testing the group should be tested according to normal procedures. Periodic reassessment shall be made according to normal procedures.

In the prequalification application the provider shall state what kind of flexibility they apply for: flexible operation, flexible prequalification and/or type approval. The provider shall describe how they will ensure compliance under that flexibility. The description shall be assessed and approved by the reserve connecting TSO. The TSO will allow the flexibility if it does not endanger the intent of the technical requirements and may set additional limits on the flexibility if necessary to ensure compliance with the technical requirements. If approved, the provider may then add additional entities to the group and/or

operate flexible within the approved limits. Further changes outside of the stated limits will require a new prequalification.

|                           | Constant operation                                                                              | Flexible operation                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Constant prequalification | The group is tested the same as if<br>it were a single unit                                     | The whole group is tested at the<br>same time, but the subgroup of<br>members participating is<br>changed during operation. |
| Flexible prequalification | Resources enter and/or leave the<br>group, but during operation the<br>whole group participates | Resources enter and/or leave<br>the group, the subgroup of<br>members participating is<br>changed during operation          |

|                           | Constant operation                                                                                                                | Flexible operation                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constant prequalification | [3 blue dots] Initial prequalification<br>[3 blue dots] Current prequalification<br>[3 blue dots] Operation                       | [2 blue dots, 1 yellow dot] Initial prequalification<br>[2 blue dots, 1 yellow dot] Current prequalification<br>[2 blue dots] Operation                       |
| Flexible prequalification | [3 blue dots] Initial prequalification<br>[3 blue dots, 1 red dot] Current prequalification<br>[3 blue dots, 1 red dot] Operation | [2 blue dots, 1 yellow dot] Initial prequalification<br>[2 blue dots, 1 yellow dot, 1 red dot] Current prequalification<br>[2 blue dots, 1 red dot] Operation |

Flexible prequalification means that an initial set of units forming a group has been prequalified and checked for fulfilment of the technical requirements per the usual process. The approval constitutes the _initial prequalification_. Afterwards the provider is allowed to extend the group with additional resources without performing a full new prequalification of the whole group. Thus, the original prequalification within some limits will remain valid and extended to the new resources, hence the nomenclature _flexible prequalification_.

Flexible prequalification does not extend the validity date of the prequalification, which remains the same as for the initial prequalification. The reserve connecting TSO has the right to use the logged data during operation to monitor the performance of the group and demand a new prequalification sooner, if the actual performance is not in line with the original prequalification.

The following cases are examples of flexible prequalification, but they are not an exhaustive list that will cover all possible configurations of aggregated portfolios. If several cases apply for a unit, the provider may choose which of the options to utilise.

#### **Stand-alone units**

The case of stand-alone units refers to resources that meet the technical requirements but are aggregated typically due to the small size of an individual unit. If the added unit is able to fulfil all the requirements by itself (e.g. is linear and stable) the provider may extend the capacity and number of participants of the group without restriction of the initial capacity.

The added unit shall be tested as described in earlier sections of this document, including determination of capacity. Note that one unit cannot be added to several groups.

#### **Type qualification**

Units that are standardised, small, and aggregated in large numbers may receive type qualification during initial prequalification. To be type qualified all units of a specific type shall be practically identical with regard to active power, FCR capacity, response during activation and deactivation, and any other factors relevant for that type of unit. To be allowed type qualification the FCR capacity of the unit can be maximum 100 kW.

The provider is allowed to extend the number of participants of a group indefinitely with units that are type qualified for that group, without any additional testing. The provider is allowed to extend the prequalified capacity of a group by 25 % of initial prequalification, or 1 MW, whichever is higher. The maximal extension is however limited to 3 MW. The TSO shall be notified prior to the extension of the capacity. However, no additional testing is required. If the maximal extension is reached and further extension is requested new full testing is required. Note that one unit cannot be added to several groups.

#### **Simplified extension of static FCR-D groups**

The provider is allowed to extend the capacity of a group providing static FCR-D by 25% compared to the respective configuration that was tested during initial prequalification. Groups smaller than 20 MW may however extend the capacity by 5 MW or 50%, whichever is the smallest. If the maximal extension is reached and further extension is requested new full testing is required. Alternatively, a separate group may be formed with the additional units since initial prequalification. A separate second group may however not participate in flexible operation together with the first group.

Each unit added using this rule shall be tested with the test sequence for Static FCR-D in section 3.1.3. The response of the additional unit shall be reasonable, and the combined response with the aggregated group using the stated methodology shall be compliant with the technical requirements, to be assessed by the reserve connecting TSO. Note that one unit cannot be added to several groups.

Flexible operation means that the whole group does not need to participate in provision at all times, i.e. the provider is allowed to choose a subset of the prequalified group to use during delivery. Flexible operation is only allowed within a prequalified group, not between groups.

The following cases are examples of flexible operation but are not an exhaustive list that will cover all possible configurations of aggregated portfolios.

#### **General case**

Flexible operation in the general case requires assessments and documentation that is dependent on the resources of the relevant group, as the potential properties of the resources in the group may vary. The requirements on flexible operation thus need to be determined on a case by case basis, in close cooperation between the provider and the reserve-connecting TSO during the application phase. The TSOs

will not allow wider flexibility than described in the following paragraphs but may apply additional restrictions when deemed as necessary.

The provider is allowed to operate each tested configuration of a group at any capacity within the range tested for that specific configuration. Additionally, the provider is potentially allowed to operate a group at a level of 80-100% of the capacity of one of the tested configurations (initial prequalification or extended), i.e. by omitting units from one of the tested configurations. The group may however not be operated at a capacity which is lower than the minimum capacity from the initial prequalification.

The subgroup of participating units may be chosen from one of the respective configurations that was tested: during initial prequalification or as extended by flexible prequalification.

#### **Stand-alone units**

Units added in a separate prequalification may be freely omitted from operation.

In case of a group consisting both of stand-alone units and general units the additional stand-alone units shall be excluded from the limit of 20 % applicable for the general units, as compared to the initial prequalification.

#### **Type qualification**

The provider is free to operate the type qualified units between the maximal capacity (after extension or from initial prequalification) and the minimal capacity (from initial prequalification) of the type qualified units.

In case of a group consisting both of type qualified units and general units the type qualified units shall be excluded from the limit of 20 % applicable for the general units, as compared to initial prequalification. The exclusion only applies to the number of type qualified units exceeding the number in the original prequalification.

Some units that have been prequalified as part of an aggregated group may after a while no longer be available for provision, and thus in need of removal from the group. Such units may be removed by using flexible operation. However, units that have been added through flexible prequalification may be removed from a group freely. A unit may also be removed from a group by performing a "reversed" flexible prequalification of the unit to be removed. The removed capacity shall in this case be counted towards the limit for flexible prequalification.

Type qualified units may be removed freely until reaching the minimum capacity from the initial prequalification. The TSO shall be notified prior to removal of units, if the capacity of the group is affected.

## **3.12 Provision from centrally controlled FCR providing entities**

An entity is defined to be centrally controlled if during operation it is dependent on a centralised function. Examples of such functions are central frequency measurements and central control systems not located together with the providing entity, by e.g. using (third party) communication links. An entity that is not dependent on centralised functions is denoted as locally controlled. An entity may be regarded as locally controlled even if it is dependent on central functions prior to the operation phase and actual provision, e.g. for scheduling of the resource. It is in such cases required that the communication between the control centre and the resource has high security and reliability, and that any centralised signals are sent well in advance of the contractually agreed delivery period. Alternatively, the signal may be sent closer to provision if the provider is able to manually verify from a manned control centre that the entity has received and accepted the signal. Local control shall always be implemented whenever feasible from a technical and economical point of view. The use of central control must be agreed with the reserve connecting TSO. It is the provider's responsibility to contact the TSO to determine if the control configuration is acceptable and if it is regarded as local or central.

Central frequency measurements may only be used to control resources in the same LFC (Load-Frequency Control) area12 in which the measurements were made.

The maximal provision behind a single point of failure is limited to 5 % of the nominal reference incident in the Nordic power system. This limit may apply to central controllers depending on how they are implemented. Currently the maximal provision per single point of failure is 70 MW in the upwards direction and 70 MW in the downwards direction. In addition, when providing FCR-N and FCR-D at the same time, the combined maximal provision is 100 MW in the upwards direction and 100 MW in the downwards direction.

The implemented solution shall be designed to guarantee an availability of the central functions of at least 99.95 %. The solution shall be robust against unavailability of the central functions, and hence the provider shall implement one of the following methods:

- Redundancy for the central functions, to be evaluated and approved by the reserve connecting TSO
- Alternatively, a local fall-back solution. The reserve connecting TSO may allow the local fall-back to be slightly less accurate than otherwise stated by the requirements, if motivated on a technical basis.
- Single point of failures shall be allowed if deemed unfeasible to avert by redundancy or local fallback, if the availability requirement can still be met.

# **4 Requirements on the measurement system**

An FCR providing entity shall be able to respond to relatively small variations in the measured quantities. The measurement system shall fulfil the requirements on accuracy, resolution and sample rate stated in this section. The active power measurement shall be such, that it covers all active power changes as a result of the FCR activation. The point of power measurement shall be at the grid connection point, or at another suitable point (such as at the generator) agreed with the reserve connecting TSO.

## **4.1 Accuracy**

The measurement accuracy for active power and frequency shall achieve the values stated in Table 15, or better. The value shall include the total inaccuracy of instrument (measurement) transformer, measurement transducer and any other equipment in the measurement system.

| Measured quantity | Category | Rated power13        | Accuracy  |
| ----------------- | -------- | -------------------- | --------- |
| Active power      | A        | $P < 1.5 MW$         | ± 5 %     |
|                   | B        | $1.5 MW ≤ P < 10 MW$ | ±1 %      |
|                   | C+D      | $P ≥ 10 MW$          | ± 0.5 %14 |
| Grid frequency    | N/A      | N/A                  | ± 10 mHz  |
| Applied frequency | N/A      | N/A                  | ±10 mHz   |

The active power accuracy shall be achieved when full active power is being measured. When the active power is lower than the rated power a slightly worse accuracy is accepted. Assuming that the error sources are uncorrelated, the total error can be calculated as the square root of the sum of the squared errors of the various error sources:

$$e_{tot} = \sqrt{e_1^2 + e_2^2} \tag{32}$$

## 4.2 Resolution

The measurement resolution for active power and frequency shall achieve the values stated in Table 16, or better. The resolution is limited by e.g. the number of bits in the measurement system. For a 16-bit system $2^{16} = 65536$ number of levels is possible to report. If the measured interval corresponds to 0-100 % the resolution becomes 100/65536 = 0.0015 %.

| Measured quantity | Resolution           |
| ----------------- | -------------------- |
| Active power      | 0.01 MW or 0.025 %15 |
| Grid frequency    | 5 mHz                |
| Applied frequency | 5 mHz                |

## 4.3 Sampling rate

The sampling rate shall be high enough to achieve the above stated requirement for measurement accuracy and measurement resolution, and to supply the controller with a suitable update interval.

The sampling rate for data logging during the tests shall be at least 10 Hz for FCR-D and at least 5 Hz for FCR-N, or logging thresholds of 0.01 MW for active power and 5 mHz for frequency shall be used^16^. The sampling rate for operational data according to section 6.2 shall be at least 1 Hz for measured active power, measured frequency and, for entities with varying or uncertain processes, the power baseline. The sampling rate for the other operational data signals according to section 6.2 shall be at least 0.1 Hz. The sampling rate for real-time telemetry according to section 6.1 shall be at least 0.1 Hz or according to the requirement stated by the connecting TSO.

## 4.4 Test of frequency measurement equipment

For providers choosing to use an internal software for generating the required test signals, i.e. steps, ramps and sinusoidal signals, the frequency measurement equipment must be taken into account by including its dynamics. This can be done by including a first order transfer function, $F_{FME}(s)$ , with a time constant, $T_{FME}$ , that approximates the frequency measurement equipment dynamics,

$$F_{FME}(s) = \frac{1}{T_{FME}s + 1}. (33)$$

There are four options for determining the time constant:

- 1. Separate test of the frequency measurement equipment, by inserting an externally generated frequency step response to measure the time constant of the response.
- 2. Documentation from supplier of the equipment.
- 3. References to previous tests of equal equipment.
- 4. Using the default value provided by the TSOs, T_FME = 1 second^17^.

The transfer function for the frequency measurement equipment is used in the evaluation of the frequency domain requirements in section 3.2 and 3.3.

**Figure 29. Example response (orange) from a separate test of frequency measurement loop, by applying a step frequency change (blue)**

The tests required to verify compliance to the technical requirements are listed in Table 2 in Section 3. The results should be evaluated using the IT-tool provided by the TSOs. The three products FCR-N, FCR-D upwards and FCR-D downwards can be tested and prequalified separately. For entities that will deliver more than one product the combined delivery of those reserves must also be tested (Section 3.6.

During the tests, the frequency input signal is replaced by a synthetic signal while the entity is still synchronized to the grid, see Figure 30. The synthetic signal shall preferably be generated using an external signal source (signal generator) connected to the frequency measurement device. If an internal signal is used, the impact of the frequency measurement must be accounted for (see Section 4.4). If the FCR providing entity being tested is equipped with a Power System Stabilizer (PSS), the PSS status/settings shall be the same as when the entity is in normal operation. During testing, supplementary active power controls like aFRR shall be disabled so that the setpoint remains unchanged. Voltage control using frequency-voltage droop is allowed when it acts on the applied frequency signal, or if it is not sensitive to frequencies within the tested frequency band.

## **5.1 Operational test conditions**

Since the tests cannot be performed for all possible operational situations, the required test conditions are limited to the following 4 operational conditions, and corresponding controller parameter sets (an example is given in Appendix 2).

- 1. _High load, high droop_: The tests shall be carried out with the highest droop (i.e. lowest regulating strength or gain) and the highest load (i.e. highest active power output) **at which the entity will provide FCR**. Applies to FCR-N sine tests, FCR-N step tests and FCR-D ramp tests (including combination of FCR-N/FCR-D test).
- 2. _High load, low droop_: The tests shall be carried out with the lowest droop (i.e. highest regulating strength or gain) and the highest load (i.e. highest active power output) **at which the entity will provide FCR**. Applies to FCR-D sine tests, FCR-N step tests (including endurance test), FCR-D ramp tests (including endurance test) and FCR-N and FCR-D linearity test for non-continuously controlled entities.

Regarding both high load cases (1-2): The provider can decide on a suitable margin between the highest possible load and the highest load where FCR will be delivered. This margin shall then be applied both when testing and when providing FCR. If ambient conditions limit the maximum load during the test, the test shall be carried out at the highest possible load (applying the selected margin).

- 3. Low load, high droop: The tests shall be carried out with the highest droop (i.e. lowest regulating strength or gain) and the lowest load (i.e. lowest active power output) at which the entity will provide FCR. Applies to FCR-N step tests, FCR-D ramp tests (including combination of FCR-N/FCR-D test) and FCR-N and FCR-D linearity test for non-continuously controlled entities.
- 4. Low load, low droop: The tests shall be carried out with the lowest droop (i.e. highest regulating strength or gain) and the lowest load (i.e. lowest active power output) at which the entity will provide FCR. Applies to FCR-N step tests and FCR-D ramp tests.

Regarding both low load cases (3-4): The provider can decide on a suitable margin between the lowest possible load and the lowest load where FCR will be delivered. This margin shall then be applied both when testing and when providing FCR. If ambient conditions limit the minimum load during the test, the test shall be carried out at the lowest possible load (applying the selected margin).

Providers are allowed to include additional testing at other operational conditions in the prequalification, for example if it is not suitable to perform linear interpolation of the capacity using only the above stated operational conditions, in accordance with Appendix 1.

If the above stated conditions are not applicable or representative for the FCR providing entity, the test conditions shall be agreed with the TSO prior to performing the tests. The following exemptions are given:

- If the entity is planned to deliver FCR at a single power setpoint, the tests 3) and 4) can be omitted.
- If the entity is planned to deliver FCR at a single droop setting, the tests 2) and 4) can be omitted.

Further exemptions that are subject to TSO approval prior to testing:

- For technologies where power setpoint does not influence the FCR provision capabilities, testing at a single power setpoint is sufficient for all tests, e.g. many types of batteries.
- The reserve connecting TSO can give additional exemptions for testing requirements where compliance can be confirmed by the general knowledge of the technology, either from previous tests of similar entities or other documentation. The potential FCR provider is responsible for clarifying this prior to testing.

### 5.1.1 Scaling of controller parameters

If the controller used for FCR has different parameter sets that can be enabled, all of these parameter sets should be tested. However, if the parameters are set in such a way that the dynamic behaviour of the controller is scaling linearly with the static gain of the controller $(^{1}/_{e_p})$ , only the parameter sets corresponding to maximum and minimum droop needs to be tested. In that case, the provider should demonstrate the linear scaling to the TSO in the application.

Linear scaling of the dynamic behaviour with the static gain, $^{1}/_{e_{p}}$ , means that the controller, C, should be such that that $2C(e_{p}) = C\left(\frac{e_{p}}{2}\right)$ . For example, the typical PI controller with droop depicted in Figure 31, which has the transfer function

$$C(s) = \frac{K_p s + K_i}{(K_p e_p + 1)s + K_i e_p}, \tag{34}$$

scales linearly with $\frac{1}{e_p}$ if $K_p = \frac{K}{e_p}$ and $K_i = 1/(T * e_p)$ . An example with K=0.2 and T=60 is given in Table 17.

**Figure 31. PI controller with droop.**

| Regulating strength [%/Hz] | Ep [pu/pu] | Kp  | Ki   | Ti=1/Ki |
| -------------------------- | ---------- | --- | ---- | ------- |
| 20                         | 0.1        | 2   | 0.17 | 6       |
| 50                         | 0.04       | 5   | 0.42 | 2.4     |
| 100                        | 0.02       | 10  | 0.83 | 1.2     |

## **5.2 Ambient test conditions**

The testing aims at verifying that the entity tested fulfils the technical requirements specified in Section 3 and 4 under foreseeable operational conditions. For FCR providing entities, tests must be performed in such a way that the results are representative of all foreseeable operational conditions. Hydro entities with a joint penstock can be tested individually. The operational conditions at the time for the test must not be optimized for the purpose of the testing.

If the steady state response of the entity depends on some ambient condition which with sufficient accuracy can be taken into account in the steady state response calculation method, the provider is allowed to extend the range of the prequalified capacity with up to 25 % in each direction if this is motivated by expected variations in the ambient conditions.

Similarly, if the steady state response depends on the load of the unit in such a way that the maximum and minimum response is not captured by the tests at high and low load, and the load dependence with sufficient accuracy is taken into account in the steady state response calculation method, the provider is allowed to extend the range of the prequalified capacity accordingly with up to 25 % in each direction. The provider can also choose to make additional capacity tests at other loads to verify a larger (or smaller) capacity by tests, in which case the 25 % limit is not applied.

The range of the prequalified capacity must not be extended more than 25 % in each direction in total compared to the tested capacities. All extensions are subject to assessment and approval by the reserve connecting TSO.

## **5.3 Test data to be logged**

Data logged during tests shall be provided to the reserve connecting TSO and should as a minimum include the quantities listed under "Test" in Table 18 which are to be provided in the format described in Subsection 6.2.1. The logged test data shall preferably be time-stamped and with high accuracy synchronised to CET, alternatively a running number of seconds may be used.

## **5.4 Test reports**

For each providing entity tested, an overall test report shall be put together that summarizes the outcome of the tests. The test report shall be accompanied by the logged data specified for each product tested.

In addition to the test report, a set of **one (1) hour of logged data**, in accordance with Subsection 6.2, shall be submitted to the TSO. Data logging during this hour should then correspond to normal operation, which differs from data logging of prequalification tests. During this hour, FCR-N shall be enabled and set to maximal capacity if the application concerns FCR-N. If the application regards FCR-D and the full allowed operating range of the entity is not utilized by FCR-N, FCR-D shall be enabled and set to the maximal capacity allowed by the allowed operating range.

There are three types of data that the reserve connecting TSO can require from the provider: Test data from prequalification tests (mandatory), real-time telemetry during delivery and data logged by the provider during operation that should be delivered to the TSO upon request. Table 18 lists the signals covered by each type of data exchange. The table may not be comprehensive and there may be differences in the required signals for each TSO. Check specific details of the required signals from each respective TSO.

| Signal                                                            | Header              | Test       | Operation | Real-time | Type         |
| ----------------------------------------------------------------- | ------------------- | ---------- | --------- | --------- | ------------ |
| **Core signals**                                                  |                     |            |           |           |              |
| Instantaneous active power injection (negative for absorbed) [MW] | [InsAcPow]          | X          | X         | X         | Double       |
| Measured grid frequency [Hz]                                      | [GridFreq]          | X          | X         |           | Double       |
| Applied frequency (during test) [Hz]                              | [ApplFreqSig]       | X          |           |           | Double       |
| Power baseline [MW]                                               | [CalcBaseline]      | X          | X         | X         | Double       |
| **Control modes**                                                 |                     |            |           |           |              |
| Control mode FCR-N [id]                                           | [ContMode_Fcrn]     | X          | recom.    |           | alphanumeric |
| Control mode FCR-D up [id]                                        | [ContMode_FcrdUp]   | X          | recom.    |           | alphanumeric |
| Control mode FCR-D down [id]                                      | [ContMode_FcrdDo]   | X          | recom.    |           | alphanumeric |
| **Capacities**                                                    |                     |            |           |           |              |
| Maintained capacity FCR-N [MW]                                    | [Cap_Fcrn]          | per test   | X         | X         | Double       |
| Maintained capacity FCR-D up [MW]                                 | [Cap_FcrdUp]        | per test   | X         | X         | Double       |
| Maintained capacity FCR-D down [MW]                               | [Cap_FcrdDo]        | per test   | X         | X         | Double       |
| **Status**                                                        |                     |            |           |           |              |
| Status FCR-N [on/off]                                             | [ContStatus_Fcrn]   | per test   | X         | X         | Binary       |
| Status FCR-D up [on/off]                                          | [ContStatus_FcrdUp] | per test   | X         | X         | Binary       |
| Status FCR-D down [on/off]                                        | [ContStatus_FcrdDo] | per test   | X         | X         | Binary       |
| **Regulating strength**                                           |                     |            |           |           |              |
| Regulating strength FCR-N [MW/Hz]                                 | [RegStr_Fcrn]       |            | X         | X         | Double       |
| Regulating strength FCR-D up [MW/Hz]                              | [RegStr_FcrdUp]     |            | X         | X         | Double       |
| Regulating strength FCR-D down [MW/Hz]                            | [RegStr_FcrdDo]     |            | X         | X         | Double       |
| **Power limits**                                                  |                     |            |           |           |              |
| Minimum power [MW]                                                | [Pmin]              | per test\* | X         | X         | Double       |
| Maximum power [MW]                                                | [Pmax]              | per test\* | X         | X         | Double       |
| **Controller signals**                                            |                     |            |           |           |              |
| Controller output signal                                          | [ContOutSig]        | recom.     | recom.    |           | Double       |
| Setpoint before FCR [% or MW]                                     | [ContSetP]          | per test   | recom.    |           | Double       |
| **Activated power**                                               |                     |            |           |           |              |
| Activated FCR-N [MW]                                              | [Activated_Fcrn]    |            | X         |           | Double       |
| Activated FCR-D up [MW]                                           | [Activated_FcrdUp]  |            | X         |           | Double       |
| Activated FCR-D down [MW]                                         | [Activated_FcrdDo]  |            | X         |           | Double       |
| **LER entities**                                                  |                     |            |           |           |              |
| Remaining endurance FCR-N [minutes]                               | [ResSize_Fcrn]      | X          | X         | X         | Double       |
| Remaining endurance FCR-D up [minutes]                            | [ResSize_FcrdUp]    | X          | X         | X         | Double       |
| Remaining endurance FCR-D down [minutes]                          | [ResSize_FcrdDo]    | X          | X         | X         | Double       |
| Activated FCR-N NEM power [MW]                                    | [NEM_MW_Fcrn]       | X          | X         | recom.    | Double       |
| Activated FCR-D up NEM power [MW]                                 | [NEM_MW_FcrdUp]     | X          | X         | recom.    | Double       |
| Activated FCR-D down NEM power [MW]                               | [NEM_MW_FcrdDo]     | X          | X         | recom.    | Double       |
| FCR-N NEM [on/off]                                                | [NEM_Fcrn]          | X          | X         | recom.    | Binary       |
| FCR-D up NEM [on/off]                                             | [NEM_FcrdUp]        | X          | X         | recom.    | Binary       |
| FCR-D down NEM [on/off]                                           | [NEM_FcrdDo]        | X          | X         | recom.    | Binary       |
| FCR-N AEM [on/off]                                                | [AEM_Fcrn]          | X          | X         | recom.    | Binary       |
| FCR-D up AEM [on/off]                                             | [AEM_FcrdUp]        | X          | X         | recom.    | Binary       |
| FCR-D down AEM [on/off]                                           | [AEM_FcrdDo]        | X          | X         | recom.    | Binary       |
| **Technology-specific signals**                                   |                     |            |           |           |              |
| **Batteries**                                                     |                     |            |           |           |              |
| State of charge [%]                                               | [SOC]               | X          | recom.    |           | Double       |
| **Hydro entities**                                                |                     |            |           |           |              |
| Guide vane opening [% or deg]                                     | [GuideVane]         | recom.     | recom.    |           | Double       |
| Runner blade angle [% or deg]                                     | [BladeAng]          | recom.     | recom.    |           | Double       |
| Upstream water level [m.a.s.l.]                                   | [UppWatLev]         | recom.     | recom.    |           | Double       |
| Downstream water level [m.a.s.l.]                                 | [LowWatLev]         | recom.     | recom.    |           | Double       |
| **Thermal entities**                                              |                     |            |           |           |              |
| Turbine valve [%]                                                 |                     | recom.     | recom.    |           | Double       |
| Ambient temp [degC]                                               | [AmbTemp]           | per test   | recom.    |           | Double       |
| Cooling water temp [degC]                                         | [CoolTemp]          | per test   | recom.    |           | Double       |
| **Wind entities**                                                 |                     |            |           |           |              |
| Wind speed [m/s]                                                  | [WindSpeed]         | recom.     | recom.    |           | Double       |
| **Solar entities**                                                |                     |            |           |           |              |
| Solar irradiation [W/m²]                                          | [SolarIrr]          | recom.     | recom.    |           | Double       |
| **Station-level signals**                                         |                     |            |           |           |              |
| Station active power injection [MW]                               | [InsAcPow_station]  | recom.     | recom.    |           | Double       |

\* per test if constant, continuous if variable

## **6.1 Real-time telemetry**

Each TSO may require FCR providers to deliver the real-time telemetry listed under "real-time" in Table 18, with an update interval defined by the TSO, for each of their FCR providing entities. Calculations are to be performed on an entity level by the provider and to be reported to the reserve connecting TSO.

In addition to the data provided per entity, the TSO may require reserve providers to deliver the following real-time telemetry aggregated on portfolio level:

- Total maintained capacity reserve of FCR-N, FCR-D upwards and FCR-D downwards respectively [MW] (including static, dynamic, LER, non-LER capacity).
- Maintained capacity with limited energy reserve of FCR-N, FCR-D upwards and FCR-D downwards respectively [MW].
- Maintained capacity of static FCR-D upwards and static FCR-D downwards respectively [MW]

The maintained FCR-N and FCR-D capacity includes both contracted and non-contracted capacity. The resolution and accuracy of the instantaneous active power and frequency shall at least meet the criteria specified in section 4. Calculation of the maintained capacities are described in section 3.9.1.

## **6.2 Data logging during operation**

Each FCR provider shall log and store the data specified in Table 18 under "Operation" for each of its FCR providing entities for at least 14 days. The data may be stored in any format suitable for the provider. The data shall be made available in csv-format for the TSO within five working days from request in the file format specified in Subsection 6.2.1. The data file shall have a time resolution less than or equal to 1 second and time stamps synchronized to CET or UTC with high accuracy. The sampling rate, resolution and accuracy of the instantaneous active power and frequency shall at least meet the criteria specified in section 4. TSOs may also be stricter on national level on data logging.

The data sent to the TSO shall also include a calculation of the _activated_ FCR-N, FCR-D upwards and FCR-D downwards in MW.

The file format for data delivery is the European standard csv-file, character encoding in ASCII where values are delimited by comma (,), decimal separator is point (.) and record delimiter is carriage return (↵ ASCII/CRLF=0x0D 0x0A). Date and time formats are in accordance with ISO 8601 and are specified below.

Naming format for the file is [Resource]\_[Service]\_[TestType]\_[Area]\_[Timezone]\_ [Interval]\_ [SamplingRate]\_[Date].csv.

- [Resource] = Identifier for the resource agreed with reserve connecting TSO e.g. FCPG1
- [Service] = Type of service, i.e. Fcrn, FcrdUp or FcrdDo.
- [TestType] = The type of test identified with the test ID given in the test program. Data logged from normal operation the test type is Operation. For sine tests, the test type information should include the period of the sine waves logged.
- [Area] = The bidding area where the resource is located e.g. SE1, FI, NO5, DK2
- [Timezone] = The time zone used for logging, e.g. CET or UTC.
- [Interval] = The time interval for which data is delivered in format YYYYMMDDThhmm-YYYYMMDDThhmm e.g. 20160101T0000-20160114T2359

- [SamplingRate] = Nominal time difference between samples given in milliseconds. E.g. 0.05s is written as 50ms.

Data records are provided in the following format: [DateTime],[record1],[record2],…,[recordX].

- [DateTime] = Date and time in format YYYYMMDDThhmmss.nnn where n are decimal fractions of a second e.g. 20160330T093702.012

The data records to be provided are listed in Table 18. If the data record is non-applicable it should be left blank.

Regarding the data from sine wave tests, each sine sweep should be logged into a separate file. Additionally, the period should be written in the file name with [TestType] as well as in the headers of the columns of the file. Example of the headers would be DateTime40, InsAcPow40, GridFreq40 for a sine sweep with a period of 40 seconds.

These technical requirements for frequency containment reserve provision in the Nordic synchronous area are in their original formulation valid from 2023-09-01. This document was updated on 2025-03-28.

If a specific requirement turns out to be difficult to fulfil, due to technical or significant economic reasons, the FCR provider may from the reserve connecting TSO request an exception from the specific requirement. The reserve connecting TSO may approve such an exception, if the exception has no impact on the FCR provision from that specific FCR providing entity, and no significant impact on the stability of the interconnected power system or the FCR markets.

Any dispute between a reserve provider and the connecting TSO should be forwarded to the national regulator, for a recommendation to the TSO involved on how to handle the dispute.

## **Steady state response calculation, example 1**

A general example of a process _Gunit_ controlled by a controller _Cgov_, where the input signal is the control error and the output signal is the power deviation, is depicted in Figure 32.

$$f_{ref} - f$$
$C_{gov}(s)G_{unit}(s)$
$AP$

If the steady state response of ()() to a frequency change depends only on one controller parameter, the droop, _ep_, the steady state response calculation is simply

$$\Delta P_{SS}(\Delta f_{max}) = \frac{1}{e_p} \Delta f_{max}$$
(35)

where ∆ is the maximum one-sided frequency change, i.e. 0.1 Hz for FCR-N and 0.4 Hz for FCR-D.

## **Steady state response calculation, example 2**

In this example, the entity has a controller structure according to Figure 33 where the controlled signal is ∆ (for example guide vane opening in a hydropower unit) and the relation between the controlled signal ∆ and the power output ∆ varies with the operating point Y₀ and/or with ambient conditions.

The steady state response of the controlled signal, _Y_, depends on the droop and can be calculated as

$$\Delta Y_{SS}(\Delta f_{max}) = \frac{1}{e_p} \Delta f_{max}.$$
(36)

Here, ep should have the unit Hz/%. In other cases, ep might be expressed in pu/pu, % or Hz/MW. If the steady state power output as a function of the controlled variable and some ambient condition (e.g. head for a hydropower unit) is known, the steady state power response for each reserve at a certain ambient condition and a certain setpoint for the controlled variable, , can be calculated as

$$\Delta P_{SS,FCR-N} = \frac{P(Y=Y_{Sp}+0.1/e_p) - P(Y=Y_{Sp}-0.1/e_p)}{2}$$
(37)

$$\Delta P_{ss,FCR-Dup} = P(Y = Y_{sp} + 0.5/e_p) - P(Y = Y_{sp} + 0.1/e_p)$$
(38)

$$\Delta P_{SS,FCR-Ddown} = P(Y = Y_{sp} - 0.1/e_p) - P(Y = Y_{sp} - 0.5/e_p)$$
(39)

This is illustrated in Figure 34, where the steady state relation between power and the controlled variable at a certain ambient condition is drawn as a black line. Here, , is 60 % and the static gain, 1⁄, is 50 %/Hz. For FCR-N, the steady state power response is 5.7 MW (the mean of 5.6 MW upwards and 5.8 MW downwards), and is illustrated by blue arrows. The FCR-D upwards and downwards steady state power responses are 15.3 MW and 28.9 MW respectively, illustrated by green arrows.

If the steady state relation between the controlled variable and the power output is not known, linear interpolation between steady state power response measured in the step tests (FCR-N) and ramp tests (FCR-D) should be used to determine ∆.

## **Steady state response calculation, example 3**

For an entity with controller _Cgov(s)_ and process _Gunit(s)_ as depicted in Figure 35, where the steady state gain of _Cgov_ from the frequency control error, e, to the controlled variable, ∆, is a known constant, , and the gain of _G_ is uncertain but varies with the operating point, the steady state response measured during testing can be utilized in the steady state response calculation.

**Figure 35. Generalized controller Cgov(s) which controls the process Gunit(s). The input to the controller is the frequency control error and the output of the process is the power deviation (FCR-response).**

- 1. For each steady state response test (FCR-N steps and FCR-D ramps), calculate the steady state response of the controlled variable, ∆ = ∙ , and if the controlled signal is logged, check the result against the logged value.
- 2. Use the measured steady state values of the power response to calculate the static gain of _Gunit(s)_, i.e. = ∆ ∆ for each test.
- 3. Use the values from the high load test and the low load tests respectively to calculate an average at high load and an average at low load, see [Figure 36.](#page-71-1) For loads between the high and low load points, the value of should be interpolated using linear interpolation.
- 4. The theoretical steady state gain can then be calculated as ∆,ℎ = ∙ ∆ ∙ (), where () is the value interpolated for the actual load.

This appendix contains an example on how to choose the setpoints in order to maximise the prequalified interval of operational conditions for a specific entity. Generally, it is required to complete one test set at a minimum of four operational conditions for FCR-N, FCR-D upwards and FCR-D downwards, see details in Section [5.1:](#page-60-1)

- 1. _High load, high droop_
- 2. _High load, low droop_
- 3. _Low load, high droop_
- 4. _Low load, low droop_

The entity is then allowed to deliver also for setpoint in-between the tested setpoint interval, and for droop levels within the tested droop interval.

Below follows an example based on a production entity that shall prequalify for FCR-N, FCR-D upwards and FCR-D downwards. The entity is able to individually control each product and the aim is to maximise the interval for which the entity is qualified to operate within.

**Table 19. Properties of the example production entity.**

| Property  | Quantity | Entity |
| --------- | -------- | ------ |
| $P_{max}$ | 50.0     | MW     |
| $P_{min}$ | 5.0      | MW     |

**Table 20. Expected capacities for the example entity, prior to testing.**

| **Capacity**      | **Max** | **Min** |
| ----------------- | ------- | ------- |
| $C_{FCR-N}$       | 5 MW    | 1 MW    |
| $C_{FCR-D\ Up}$   | 10 MW   | 4 MW    |
| $C_{FCR-D\ Down}$ | 10 MW   | 4 MW    |

The operational test points to apply during the test are given in [Table 21.](#page-73-0) The table gives the setpoints that corresponds to testing at maximum and minimum load. The provider is allowed to introduce a margin towards maximum and minimum load in the tests, i.e. shift the setpoints slightly compared to the example in [Table 21.](#page-73-0)

**Table 21. Operating points for tests on an example unit.**

| Test ID                   | Test Type                       | Conditions            | Response [MW] | Setpoint [MW] | Power Range [MW] | Notes                                                        |
| ------------------------- | ------------------------------- | --------------------- | ------------- | ------------- | ---------------- | ------------------------------------------------------------ |
| **FCR-N Steps**           |                                 |                       |               |               |                  |                                                              |
| 1.1                       | FCR-N steps                     | High droop, High load | ±1            | 49            | 48-50            |                                                              |
| 1.2                       | FCR-N steps                     | Low droop, High load  | ±5            | 45            | 40-50            |                                                              |
| 1.3                       | FCR-N steps                     | High droop, Low load  | ±1            | 6             | 5-7              |                                                              |
| 1.4                       | FCR-N steps                     | Low droop, Low load   | ±5            | 10            | 5-15             |                                                              |
| **FCR-D Upwards Ramps**   |                                 |                       |               |               |                  |                                                              |
| 2.1                       | FCR-D upwards ramps             | High droop, High load | 4             | 45            | 45-50            | FCR-N enabled (high droop, 1 MW), FCR-D test starts at 46 MW |
| 2.2                       | FCR-D upwards ramps             | Low droop, High load  | 10            | 40            | 40-50            |                                                              |
| 2.3                       | FCR-D upwards ramps             | High droop, Low load  | 4             | 5             | 5-10             | FCR-N enabled (high droop, 1 MW), FCR-D test starts at 6 MW  |
| 2.4                       | FCR-D upwards ramps             | Low droop, Low load   | 10            | 5             | 5-15             |                                                              |
| **FCR-D Downwards Ramps** |                                 |                       |               |               |                  |                                                              |
| 3.1                       | FCR-D downwards ramps           | High droop, High load | -4            | 50            | 45-50            | FCR-N enabled (high droop, 1 MW), FCR-D test starts at 49 MW |
| 3.2                       | FCR-D downwards ramps           | Low droop, High load  | -10           | 50            | 40-50            |                                                              |
| 3.3                       | FCR-D downwards ramps           | High droop, Low load  | -4            | 10            | 5-10             | FCR-N enabled (high droop, 1 MW), FCR-D test starts at 9 MW  |
| 3.4                       | FCR-D downwards ramps           | Low droop, Low load   | -10           | 15            | 5-15             |                                                              |
| **Sine Tests**            |                                 |                       |               |               |                  |                                                              |
| 4.1                       | Sine FCR-N                      | High droop, High load | ±1            | 49            | 48-50            |                                                              |
| 4.2                       | Sine FCR-D upwards              | Low droop, High load  | 10            | 40            | 42.5-47.5        | P max at 49.5 Hz (full FCR-D activation)                     |
| 4.3                       | Sine FCR-D downwards            | Low droop, High load  | -10           | 50            | 42.5-47.5        | P max at 50.1 Hz (no FCR-D activation)                       |
| **Linearity Tests**       |                                 |                       |               |               |                  |                                                              |
| 5.1                       | Linearity steps FCR-N           | Low droop, High load  | ±5            | 45            | 40-50            |                                                              |
| 5.2                       | Linearity steps FCR-N           | High droop, Low load  | ±1            | 6             | 5-7              |                                                              |
| 6.1                       | Linearity steps FCR-D upwards   | Low droop, High load  | 10            | 40            | 40-50            |                                                              |
| 6.2                       | Linearity steps FCR-D upwards   | High droop, Low load  | 4             | 5             | 5-9              |                                                              |
| 7.1                       | Linearity steps FCR-D downwards | Low droop, High load  | -10           | 50            | 40-50            |                                                              |
| 7.2                       | Linearity steps FCR-D downwards | High droop, Low load  | -4            | 9             | 5-9              |                                                              |
