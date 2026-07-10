# LAeq V3 validation

The V3 mockup was validated locally after the execution-model redesign.

## Reference Micromate file

Source acquisition inferred from recent timestamps: **60 seconds**.

Fixed 15-minute output with 80% valid-data coverage:

| Period end | Samples | Expected | LAeq |
|---|---:|---:|---:|
| 2026-07-01 10:15:00 | 14 | 15 | 67.44 dB(A) |
| 2026-07-01 10:30:00 | 15 | 15 | 67.86 dB(A) |
| 2026-07-01 10:45:00 | 15 | 15 | 67.88 dB(A) |
| 2026-07-01 11:00:00 | 16 | 15 | 73.62 dB(A) |

These four values match the supplied official 15-minute result file.

## Execution-model validation

The user interface now separates three concepts:

1. **Source acquisition interval** — how often an input value arrives.
2. **Calculation window** — how much history is used for one LAeq.
3. **Output interval** — how often a result timestamp is produced.

The recommended processing execution interval is based on the smallest active **calculation window**, not on the fastest rolling output interval.

Example with source data every 1 minute:

- Fixed LAeq 15 min: recommended calculation batch = 15 min, one result per batch.
- Rolling LAeq 15 min with output every 1 min: recommended calculation batch = 15 min. One batch can create up to 15 missing rolling results.
- Custom execution every 1 min remains possible for lower latency, but it creates approximately 15 times more calculation launches than the recommended 15-minute batch.

Event-driven mode is batched: each data-arrival event updates the queue/watermark, but it does not directly invoke the Python calculation. The calculation starts only when a recommended batch boundary is due and the data watermark proves that complete periods are available.

## Automated tests

Run:

```bash
node tests/v3-core.test.mjs
```

The automated checks cover:

1. Acquisition inference for 1-minute and 1-second sources.
2. A 15-minute rolling window with 1-minute outputs still recommends a 15-minute calculation batch.
3. A fixed 15-minute LAeq waits for all 15 source minutes.
4. A rolling 15-minute LAeq creates the first complete output only when enough data is available.
5. The next 15-minute batch catches up 15 missing rolling outputs.
6. Re-running with the same stored boundary creates no duplicates.
7. Multiple outputs select the smallest calculation window as the recommended batch.
8. Rolling output faster than source acquisition produces a warning.
9. Constant energetic input remains unchanged after LAeq aggregation.
10. A 10-hour calendar output is generated only when the full period watermark is available.

## Other scenarios checked

- CUBE-style source with one value per second.
- Robust acquisition estimation from recent timestamp gaps.
- Fixed non-overlapping clock-aligned windows.
- Source-aligned rolling windows with configurable output interval.
- Calendar output such as 07:00–17:00.
- Multiple output variables in one processing.
- Catch-up using the last stored period boundary.
- No duplicate result generation when the processing is already up to date.
- CSV download and administration execution history.

## Intended production split

- **Next.js / React:** forms, source selection, output configuration and administration screens.
- **Node.js service:** ingestion-event batching, watermark checks, scheduler recommendation, missing-period detection and orchestration.
- **Python Lambda:** source query, energetic LAeq calculation, coverage validation and result upsert.
