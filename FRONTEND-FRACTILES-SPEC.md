# BTM Acoustic Processing — Frontend Specification

## 1. Purpose

Extend the existing **BTM LAeq processing** interface so that one processing can generate:

- energy-based `LAeq`;
- statistical noise indices such as `L10`, `L50`, `L90` and `L95`;
- a custom exceedance index between `L1` and `L99`.

The production interface must use acoustic variables already stored in the BTM database. CSV upload exists only in the standalone prototype to demonstrate the workflow.

Reference mockup:

- `index-fractiles.html`

## 2. Terminology

| Term | Meaning |
|---|---|
| LAeq | Energy-equivalent sound level calculated over a period |
| Ln | Sound level reached or exceeded during `n%` of the calculation period |
| L10 | Typically represents louder events |
| L50 | Median sound level |
| L90 | Typically represents background noise |
| Source interval | Time represented by each source value, for example 1 second or 1 minute |
| Calculation window | Period used to produce one output value |
| Output interval | Time between two generated results in rolling mode |

## 3. Main UX changes

### 3.1 Rename the outputs section

Replace:

> LAeq outputs

with:

> Acoustic indicators

This section is no longer restricted to LAeq outputs.

### 3.2 Data source

Production mode must display a BTM variable selector:

1. Project
2. Sensor
3. Source variable

Supported source variables:

- `LAeq,1s`;
- `LAeq,1min`;
- another short and regularly sampled LAeq variable when its acquisition interval is known.

The frontend must display:

- variable name;
- unit;
- acquisition interval;
- selected sensor;
- availability status.

The frontend must not imply that `LAeq,1s` is mandatory. `LAeq,1min` is valid, but has lower temporal resolution.

### 3.3 CSV mode

CSV upload is a **demo-only** feature.

It may remain visible in the standalone HTML mockup, but it must not be required by the production BTM workflow.

Expected demo columns:

```csv
timestamp,LAeq_1s_dBA
2026-07-23 10:00:00,52.4
2026-07-23 10:00:01,53.1
```

### 3.4 Output configuration

Each output card must include:

| Field | Type | Required |
|---|---|---:|
| Generated variable name | Text | Yes |
| Display name | Text | Yes |
| Calculation type | Select | Yes |
| Exceedance percentage | Select/number | Only for a fractile |
| Calculation mode | Select | Yes |
| Window duration | Number + unit | Yes |
| Output interval | Number + unit | Rolling mode only |
| Schedule | Time range + weekdays | Calendar/scheduled mode |
| Active | Boolean | Yes |

Calculation type options:

```text
LAeq — energy average
Statistical noise index
```

When `Statistical noise index` is selected, show:

```text
L10 — louder events
L50 — median level
L90 — background noise
L95 — stable background noise
Custom
```

For a custom index, accept an integer from `1` to `99`.

### 3.5 Common fractiles action

Add the following action:

> Add L10, L50 and L90

The action must:

1. reuse the current calculation period, mode and schedule;
2. create only missing outputs;
3. avoid duplicate L10, L50 or L90 outputs for the same configuration;
4. generate editable variable names.

Example generated names:

```text
Noise_LA10_15min
Noise_LA50_15min
Noise_LA90_15min
```

### 3.6 Contextual explanation

For `LAeq`, display:

> The equivalent sound level is calculated using an energy average of the levels in the period.

For `L90`, display:

> L90 is the level reached or exceeded during 90% of the period. It generally represents background noise.

The explanation must change when the selected index changes.

## 4. Resolution and sample information

The interface must support both one-second and one-minute source data.

For a 15-minute window:

| Source | Expected source values |
|---|---:|
| LAeq,1s | 900 |
| LAeq,1min | 15 |

When `LAeq,1min` is selected, display a non-blocking warning:

> Calculation is supported with one-minute data, but short sound variations are not represented. The result describes the distribution of the one-minute LAeq values.

The warning must not prevent saving or running the processing.

Do not mix several source resolutions in the same calculation window.

## 5. Results table

Replace the LAeq-specific results column with generic indicator information.

Required columns:

| Column | Example |
|---|---|
| Variable | `Noise_LA90_15min` |
| Indicator | `L90` |
| Mode | `Fixed` |
| Timestamp | `2026-07-24 10:15:00` |
| Period start | `2026-07-24 10:00:00` |
| Period end | `2026-07-24 10:15:00` |
| Value | `43.2 dB(A)` |
| Source | `LAeq,1s` |
| Samples | `900 / 900` |
| Coverage | `100%` |
| Status | `New`, `Catch-up` or `Skipped` |

The table and CSV download must not name the value column `LAeq_dBA` for every calculation type.

Recommended generic export columns:

```csv
variable,indicator,exceedance_percent,timestamp,period_start,period_end,value_dba,source_variable_id,source_interval_seconds,sample_count,expected_count,coverage_percent,status
```

## 6. Frontend data model

Recommended TypeScript interfaces:

```ts
type CalculationType = "laeq" | "fractile";
type CalculationMode = "fixed" | "rolling" | "calendar";

interface AcousticSource {
  projectId: string;
  sensorId: string;
  variableId: string;
  variableName: string;
  unit: "dB(A)";
  acquisitionIntervalSeconds: number;
}

interface AcousticOutput {
  id: string;
  variableName: string;
  displayName: string;
  calculationType: CalculationType;
  exceedancePercent: number | null;
  mode: CalculationMode;
  duration: number;
  durationUnit: "s" | "min" | "h";
  step: number | null;
  stepUnit: "s" | "min" | "h" | null;
  scheduleEnabled: boolean;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  scheduleDays: number[];
  active: boolean;
}

interface AcousticProcessingConfiguration {
  id?: string;
  name: string;
  source: AcousticSource;
  timezone: string;
  minimumCoveragePercent: number;
  catchupEnabled: boolean;
  outputs: AcousticOutput[];
}
```

Rules:

- `exceedancePercent` must be `null` for LAeq.
- `exceedancePercent` is required for a fractile.
- The source belongs to the processing, not to each output.
- Several outputs may reuse the same source and calculation window.

## 7. API interactions

### Load selectable source variables

The frontend needs an endpoint or existing BTM service capable of returning:

```json
[
  {
    "variableId": "sensor-5184-laeq-1s",
    "variableName": "LAeq,1s",
    "unit": "dB(A)",
    "acquisitionIntervalSeconds": 1
  },
  {
    "variableId": "sensor-5184-laeq-1min",
    "variableName": "LAeq,1min",
    "unit": "dB(A)",
    "acquisitionIntervalSeconds": 60
  }
]
```

### Save processing

Example request:

```json
{
  "name": "Environmental noise indicators",
  "sourceVariableId": "sensor-5184-laeq-1s",
  "timezone": "Europe/Paris",
  "minimumCoveragePercent": 80,
  "catchupEnabled": true,
  "outputs": [
    {
      "variableName": "Noise_LAeq_15min",
      "displayName": "LAeq 15 min",
      "calculationType": "laeq",
      "exceedancePercent": null,
      "mode": "fixed",
      "durationSeconds": 900,
      "active": true
    },
    {
      "variableName": "Noise_LA90_15min",
      "displayName": "L90 15 min",
      "calculationType": "fractile",
      "exceedancePercent": 90,
      "mode": "fixed",
      "durationSeconds": 900,
      "active": true
    }
  ]
}
```

## 8. Validation

Block saving when:

- no source variable is selected;
- no output is active;
- two active outputs have the same generated variable name;
- a generated variable name is empty;
- a fractile has no exceedance percentage;
- the exceedance percentage is outside `1–99`;
- the window duration is zero or negative;
- rolling mode has no valid output interval;
- a calendar output has no selected weekday.

Show a warning without blocking when:

- the source is `LAeq,1min`;
- a calculation window contains a small number of expected samples;
- the configured execution frequency is unnecessarily faster than the smallest complete calculation window.

## 9. Accessibility and responsive behaviour

- Every field must have a visible label.
- New controls must be usable with a keyboard.
- Do not communicate warnings using colour only.
- Tooltips must not contain essential information unavailable elsewhere.
- Output cards must remain readable on tablet and mobile widths.
- The results table may scroll horizontally on small screens.

## 10. Frontend acceptance criteria

- [ ] The user can select a BTM LAeq source variable.
- [ ] Both 1-second and 1-minute source intervals are accepted.
- [ ] Selecting one-minute data displays a warning but does not block the workflow.
- [ ] An output can be configured as LAeq or fractile.
- [ ] L10, L50, L90 and L95 presets are available.
- [ ] A custom index between L1 and L99 can be configured.
- [ ] The common-fractiles action adds missing L10, L50 and L90 outputs.
- [ ] Existing fixed, rolling, calendar, schedule and catch-up controls still work.
- [ ] Results show the indicator and source resolution.
- [ ] CSV remains explicitly marked as demo-only.
- [ ] Existing saved LAeq configurations migrate with `calculationType = "laeq"`.
- [ ] Existing LAeq-only behaviour has no regression.

## 11. Out of scope

- Regulatory compliance conclusions;
- noise penalties or corrections;
- alert thresholds;
- direct calculation from raw microphone pressure signals;
- combining one-second and one-minute values in the same window;
- treating a sensor-provided L90 as an LAeq source.
