# LAeq V3 validation

The V3 mockup was validated locally before opening the pull request.

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

## Other scenarios checked

- CUBE-style source with one value per second.
- Robust acquisition estimation from recent timestamp gaps.
- Constant 60 dB(A) input remains 60 dB(A) after energetic aggregation.
- Fixed non-overlapping clock-aligned windows.
- Rolling windows with configurable output step.
- Calendar output such as 07:00–17:00.
- Multiple output variables in one processing.
- Scheduler recommendation based on the smallest active output cadence and source acquisition.
- Warning when a custom scheduler is slower than the requested output cadence.
- Warning when a scheduler is faster than source acquisition.
- Catch-up using the last stored period boundary.
- No duplicate result generation when the processing is already up to date.
- CSV download and administration execution history.

## Intended production split

- **Next.js / React:** forms, source selection, generated-variable cards and administration screens.
- **Node.js service:** persistence, scheduler recommendation, missing-period detection and job orchestration.
- **Python Lambda:** source query, energetic LAeq calculation, coverage validation and result upsert.
