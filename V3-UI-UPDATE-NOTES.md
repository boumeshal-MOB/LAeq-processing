# V3 UI refinement notes

This follow-up refines the V3 LAeq mockup after review.

## UI updates

- LAeq outputs are now shown in a compact table instead of large cards.
- The execution tab recommends **Event-driven** processing by default.
- Event-driven means a new ingestion batch or message triggers boundary checks; events should be queued/debounced so one-second data does not invoke one Lambda per sample.
- Users who do not want event-driven execution can select a custom interval.
- A recommended custom fallback interval is still calculated from the active fixed/rolling/calendar outputs and inferred acquisition interval.
- Catch-up missing periods is explained directly in the UI and also protects against missed ingestion events.
- The manual execution tab is the last tab and highlighted as a manual/support action.
- Administration starts with a processing list. Full details are shown only after clicking Edit.

## Functional intent

- One processing can still generate several LAeq variables.
- The acquisition interval is inferred from timestamp gaps after selecting the source variable.
- Catch-up calculates complete missing periods after the last stored boundary and avoids duplicates through upsert logic.
- Production split remains React/Next.js for UI, Node for event handling/orchestration, and Python Lambda for energetic LAeq calculations.
