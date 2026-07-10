# LAeq V3 validation

The V3 mockup was validated locally after the execution-model and user-interface redesign.

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

The user interface separates four concepts:

1. **Source acquisition interval** — how often an input value is stored.
2. **Calculation window** — how much history is used for one LAeq.
3. **Output interval** — how often a result timestamp is produced.
4. **Processing execution interval** — how often the service checks and calculates.

The recommended processing execution interval is based on the smallest active **calculation window**, not on the fastest rolling output interval.

Example with source data every 1 minute:

- Fixed LAeq 15 min: recommended calculation batch = 15 min, one result per batch.
- Rolling LAeq 15 min with output every 1 min: recommended calculation batch = 15 min. One batch can create up to 15 missing rolling results.
- Custom execution every 1 min remains possible for lower latency, but it creates approximately 15 times more calculation launches than the recommended 15-minute batch.

Smart event-driven mode is batched: a data-arrival event marks the processing as ready, but it does not directly invoke the Python calculation. The calculation starts only when a complete recommended batch boundary is available.

If there is no new complete period, the execution is recorded as:

`Skipped — No new complete period available or no new source data available.`

No generated variable is modified in that case.

## Advanced delayed-data policy

Recalculation of already completed periods is disabled by default.

- Default: **No recalculation**.
- Default delayed-data tolerance: **0 minutes**.
- The tolerance control is hidden unless recalculation is explicitly enabled.

This means the default configuration has no delayed-data side effect.

## Automated tests

Run:

```bash
node tests/v3-core.test.mjs
node tests/v3-ui.test.mjs
node --check v3-core.js
node --check v3-app.js
```

The core automated checks cover:

1. Acquisition inference for 1-minute and 1-second sources.
2. A 15-minute rolling window with 1-minute outputs still recommends a 15-minute calculation batch.
3. A fixed 15-minute LAeq waits for all 15 source minutes.
4. A rolling 15-minute LAeq creates the first complete output only when enough data is available.
5. The next 15-minute batch catches up 15 missing rolling outputs.
6. Re-running with the same stored boundary creates no duplicates.
7. Multiple outputs select the smallest calculation window as the recommended batch.
8. Rolling output faster than source acquisition produces a warning.
9. Constant energetic input remains unchanged after LAeq aggregation.
10. A 10-hour calendar output is generated only when the full period is available.

The UI regression checks cover:

- Smart event-driven is selected by default.
- Custom schedule is hidden until selected.
- No custom run interval is prefilled or automatically suggested.
- The custom interval is mandatory before saving a custom schedule.
- The delayed-data option is advanced, disabled by default and starts at 0 minutes.
- The output table uses fixed column widths and a dedicated calendar-range layout.
- Skip messaging and stored output-boundary logic remain present.

## Browser interaction and visual checks

The mockup was rendered at **1518 × 900** and checked with a headless browser.

Validated interactions:

- Three default output rows render correctly.
- Calendar start/end fields do not overlap the Summary column.
- Switching to Custom schedule reveals an empty interval field.
- Saving an empty Custom schedule is blocked with a validation message.
- A valid custom interval saves and opens Administration.
- Advanced delayed-data controls remain hidden until explicitly enabled.
- Manual run without source data is blocked with a clear message.

## Intended production split

- **Next.js / React:** forms, source selection, output configuration and administration screens.
- **Node.js service:** event batching, boundary checks, scheduler recommendation, missing-period detection and orchestration.
- **Python Lambda:** source query, energetic LAeq calculation, coverage validation and result upsert.
