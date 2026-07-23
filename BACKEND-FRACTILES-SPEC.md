# BTM Acoustic Processing — Backend Specification

## 1. Purpose

Extend the BTM acoustic processing backend so that it calculates both:

- energy-equivalent sound levels (`LAeq`);
- statistical noise indices (`L10`, `L50`, `L90`, `L95` or a custom `Ln`).

The normal production input is an existing BTM database variable containing regularly sampled short LAeq values, typically:

- `LAeq,1s`;
- `LAeq,1min`.

CSV parsing is not part of the production backend requirement. It is used only by the standalone frontend prototype.

## 2. Architecture

Recommended production split:

| Component | Responsibility |
|---|---|
| React/Next.js | Processing configuration and result display |
| Node.js service | Validation, orchestration, scheduling and execution requests |
| Python Lambda | Acoustic calculations |
| BTM database | Source values, processing configuration and calculated results |

The Python Lambda is the production source of truth for calculation results.

The JavaScript prototype must use the same fixtures and expected results, but must not become the official production engine.

## 3. Input requirements

### 3.1 Required source fields

Each source record must provide:

```text
timestamp
value_dba
quality/status, when available
```

The processing configuration must provide:

```text
source_variable_id
source_interval_seconds
timezone
minimum_coverage_percent
calculation outputs
```

### 3.2 Accepted source resolution

Both one-second and one-minute LAeq inputs are supported.

Example for a 15-minute calculation:

| Source | Expected records |
|---|---:|
| LAeq,1s | 900 |
| LAeq,1min | 15 |

The backend must not reject one-minute data because it is less detailed. It must store the source interval with the result so that the result remains interpretable.

### 3.3 Source semantics

A fractile calculated from `LAeq,1min` represents the statistical distribution of the **one-minute LAeq values**.

It is not identical to a fractile calculated from `LAeq,1s`, because variations shorter than one minute have already been averaged.

The backend must not:

- reconstruct one-second data from one-minute data;
- interpolate missing acoustic values to increase the apparent sample count;
- mix source intervals in the same calculation window;
- derive a fractile from one global LAeq value.

## 4. Processing configuration contract

Example:

```json
{
  "processingId": "acoustic-processing-001",
  "sourceVariableId": "sensor-5184-laeq-1s",
  "sourceIntervalSeconds": 1,
  "timezone": "Europe/Paris",
  "minimumCoveragePercent": 80,
  "catchupEnabled": true,
  "outputs": [
    {
      "outputId": "laeq-15m",
      "variableName": "Noise_LAeq_15min",
      "calculationType": "laeq",
      "exceedancePercent": null,
      "mode": "fixed",
      "durationSeconds": 900,
      "stepSeconds": 900,
      "active": true
    },
    {
      "outputId": "l10-15m",
      "variableName": "Noise_LA10_15min",
      "calculationType": "fractile",
      "exceedancePercent": 10,
      "mode": "fixed",
      "durationSeconds": 900,
      "stepSeconds": 900,
      "active": true
    },
    {
      "outputId": "l90-15m",
      "variableName": "Noise_LA90_15min",
      "calculationType": "fractile",
      "exceedancePercent": 90,
      "mode": "fixed",
      "durationSeconds": 900,
      "stepSeconds": 900,
      "active": true
    }
  ]
}
```

Validation rules:

- `calculationType` must be `laeq` or `fractile`;
- `exceedancePercent` must be `null` for LAeq;
- `exceedancePercent` must be between `1` and `99` for a fractile;
- duration and step must be positive;
- output variable names must be unique within one processing;
- the source interval must be known and positive.

## 5. LAeq calculation

For source levels \(L_i\) expressed in dB(A):

\[
L_{Aeq,T}=10\log_{10}\left(\frac{1}{N}\sum_{i=1}^{N}10^{L_i/10}\right)
\]

Python reference:

```python
import math
from collections.abc import Sequence


def calculate_laeq(levels: Sequence[float]) -> float:
    if not levels:
        raise ValueError("No valid acoustic levels")

    mean_energy = sum(10 ** (level / 10) for level in levels) / len(levels)
    return 10 * math.log10(mean_energy)
```

## 6. Fractile calculation

`Ln` is the level reached or exceeded during `n%` of the calculation period.

With values sorted in ascending order:

\[
L_n=P_{100-n}
\]

Examples:

\[
L_{10}=P_{90}
\]

\[
L_{50}=P_{50}
\]

\[
L_{90}=P_{10}
\]

Python reference:

```python
from collections.abc import Sequence
import numpy as np


def calculate_fractile(
    levels: Sequence[float],
    exceedance_percent: float,
) -> float:
    if not levels:
        raise ValueError("No valid acoustic levels")

    if not 1 <= exceedance_percent <= 99:
        raise ValueError("Exceedance percentage must be between 1 and 99")

    quantile = 1 - (exceedance_percent / 100)
    return float(np.quantile(levels, quantile, method="linear"))
```

Important:

- Do not convert levels to acoustic energy for a fractile.
- Do not calculate L90 by energy-averaging several existing L90 values.
- The percentile interpolation method must be explicit and versioned.

### 6.1 Interpolation method

The prototype recommendation is:

```text
method = linear
```

Before production release, compare reference files against at least one target sound level meter or its official export software.

If the instrument uses another percentile convention, either:

1. adopt the validated method globally; or
2. store the calculation method as part of the processing algorithm version.

Never change the percentile method silently after results have been stored.

### 6.2 Irregular timestamps

The primary use case is a regular source interval.

If timestamps are irregular:

- do not apply an unweighted percentile while pretending the data are regular;
- either reject the period as unsuitable;
- or implement a duration-weighted percentile using the time represented by each value.

The chosen behaviour must be explicit. For the first production version, rejecting materially irregular periods is safer than silently changing their statistical meaning.

## 7. Window construction

Reuse the current LAeq rules for:

- fixed aligned windows;
- rolling windows;
- calendar periods;
- weekday selection;
- periods crossing midnight;
- site timezone;
- daylight-saving transitions;
- catch-up processing.

For every output window:

1. determine `period_start` and `period_end`;
2. query or select valid source values within the period;
3. calculate expected records;
4. calculate coverage;
5. skip the result if coverage is below the configured minimum;
6. run the configured acoustic calculation;
7. persist the result idempotently.

Timestamp boundary conventions must remain consistent with the current source:

- start-stamped samples: `start <= timestamp < end`;
- end-stamped samples: `start < timestamp <= end`.

## 8. Coverage and missing data

Expected count:

\[
N_{expected}=\frac{period\ duration}{source\ interval}
\]

Coverage:

\[
coverage=\frac{N_{valid}}{N_{expected}}\times100
\]

Rules:

- Ignore non-numeric values.
- Exclude values explicitly marked invalid by the sensor ingestion pipeline.
- Do not replace missing levels with zero.
- Do not interpolate missing values for LAeq or fractile calculations.
- Skip the output when coverage is below the configured minimum.
- Store actual and expected counts with every result.
- Cap the displayed coverage at 100%, but investigate duplicate source timestamps.

Duplicate timestamp policy:

- use the existing BTM ingestion uniqueness rule when available;
- otherwise reject or deterministically deduplicate duplicate timestamps before calculation;
- record duplicate detection in execution diagnostics.

## 9. Efficient execution

The Lambda should read each required source period once and calculate all outputs from the same in-memory values.

Example:

```text
Database read: LAeq,1s from 10:00 to 10:15
Calculations from the same 900 values:
  - LAeq,15min
  - L10,15min
  - L50,15min
  - L90,15min
```

Avoid four identical database queries for four indicators.

For multiple rolling windows:

- query a bounded source range;
- reuse already loaded values;
- preserve deterministic window boundaries;
- avoid loading the complete sensor history.

## 10. Result model

Recommended result fields:

```text
processing_id
output_id
output_variable_id
source_variable_id
calculation_type
exceedance_percent
period_start
period_end
timestamp
value_dba
source_interval_seconds
sample_count
expected_count
coverage_percent
calculation_method
algorithm_version
status
created_at
```

Example:

```json
{
  "processingId": "acoustic-processing-001",
  "outputId": "l90-15m",
  "variableName": "Noise_LA90_15min",
  "sourceVariableId": "sensor-5184-laeq-1min",
  "calculationType": "fractile",
  "exceedancePercent": 90,
  "periodStart": "2026-07-24T08:00:00Z",
  "periodEnd": "2026-07-24T08:15:00Z",
  "timestamp": "2026-07-24T08:15:00Z",
  "valueDba": 43.2,
  "sourceIntervalSeconds": 60,
  "sampleCount": 15,
  "expectedCount": 15,
  "coveragePercent": 100,
  "calculationMethod": "quantile-linear",
  "algorithmVersion": "acoustic-v1",
  "status": "new"
}
```

## 11. Idempotency

The backend must not create duplicate values when:

- the Lambda retries;
- a manual run overlaps an automatic run;
- catch-up processing rechecks an already completed period.

Recommended uniqueness:

```text
processing_id + output_id + period_start + period_end + algorithm_version
```

Use an atomic upsert or the existing BTM equivalent.

If recalculation with a newer algorithm version is required, preserve or explicitly supersede the old result according to BTM data governance rules.

## 12. Execution response

Recommended response:

```json
{
  "processingId": "acoustic-processing-001",
  "executionId": "execution-20260724-001",
  "status": "success",
  "sourceRowsRead": 900,
  "resultsCreated": 4,
  "resultsSkipped": 0,
  "results": [
    {
      "outputId": "laeq-15m",
      "indicator": "LAeq",
      "valueDba": 58.4,
      "sampleCount": 900,
      "expectedCount": 900,
      "coveragePercent": 100
    },
    {
      "outputId": "l90-15m",
      "indicator": "L90",
      "valueDba": 43.2,
      "sampleCount": 900,
      "expectedCount": 900,
      "coveragePercent": 100
    }
  ]
}
```

## 13. Error handling

Recommended error codes:

| Code | Meaning |
|---|---|
| `SOURCE_NOT_FOUND` | The configured BTM source variable does not exist |
| `SOURCE_INTERVAL_UNKNOWN` | Acquisition interval cannot be determined |
| `SOURCE_INTERVAL_IRREGULAR` | Timestamps are materially irregular |
| `NO_VALID_LEVELS` | Period contains no valid numeric levels |
| `INSUFFICIENT_COVERAGE` | Coverage is below the configured minimum |
| `INVALID_FRACTILE` | Exceedance percentage is outside 1–99 |
| `INVALID_WINDOW` | Window or step configuration is invalid |
| `RESULT_WRITE_FAILED` | Calculated result could not be persisted |

Insufficient coverage is normally a skipped output, not a failed execution, unless all outputs fail according to the existing BTM execution policy.

## 14. Migration

Existing LAeq processing configurations must continue working.

Migration defaults:

```json
{
  "calculationType": "laeq",
  "exceedancePercent": null
}
```

Do not require users to recreate existing LAeq outputs.

The existing generated values must remain unchanged after the model migration.

## 15. Tests

### 15.1 Unit tests

- Constant levels produce the same LAeq, L10, L50 and L90.
- L10 is greater than or equal to L50.
- L50 is greater than or equal to L90.
- LAeq uses energy averaging.
- Fractiles do not use energy averaging.
- `L10 = percentile 90`.
- `L50 = percentile 50`.
- `L90 = percentile 10`.
- One-second and one-minute sources are both accepted.
- Invalid fractiles `L0` and `L100` are rejected.
- Empty inputs are rejected.
- Non-numeric and invalid-status values are excluded.

### 15.2 Window tests

- fixed 15-minute window;
- rolling 15-minute window with a 1-minute step;
- hourly aligned windows;
- calendar daytime and night-time periods;
- a period crossing midnight;
- daylight-saving spring transition;
- daylight-saving autumn transition;
- start-stamped and end-stamped source values;
- exactly minimum coverage;
- below minimum coverage;
- catch-up after several missed periods.

### 15.3 Resolution tests

- 15 minutes of LAeq,1s expects 900 records;
- 15 minutes of LAeq,1min expects 15 records;
- source resolutions are not mixed;
- the stored result records the correct source interval.

### 15.4 Golden fixture tests

Create shared fixture files with:

```text
timestamp
source level
expected LAeq
expected L10
expected L50
expected L90
```

Use the same expected results for:

- Python Lambda tests;
- JavaScript prototype tests.

Before release, add at least one reference export from a target sound level meter or its official software.

## 16. Backend acceptance criteria

- [ ] The backend calculates LAeq and fractiles from a BTM database variable.
- [ ] LAeq,1s and LAeq,1min are supported.
- [ ] One-minute inputs are not presented as one-second-equivalent results.
- [ ] L10, L50, L90, L95 and a custom L1–L99 are supported.
- [ ] Fractiles use the documented percentile method.
- [ ] LAeq continues to use energy averaging.
- [ ] Existing fixed, rolling, calendar, timezone and catch-up behaviours remain available.
- [ ] Coverage rules apply consistently to LAeq and fractiles.
- [ ] One database read can produce several indicators for the same period.
- [ ] Every result stores its source interval and calculation method.
- [ ] Execution is idempotent.
- [ ] Existing LAeq configurations migrate without regression.
- [ ] Python and JavaScript golden fixture tests produce matching results within the defined tolerance.

## 17. Out of scope

- Calculation from raw sound pressure waveforms;
- frequency-spectrum processing;
- regulatory penalties and rating-level corrections;
- automatic compliance decisions;
- fabrication of missing source values;
- aggregation of existing sensor-provided fractiles into longer-period fractiles;
- changing the original source variable’s historical values.
