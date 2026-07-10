# V3 UI refinement notes

This follow-up refines the V3 LAeq mockup after review.

## UI updates

- LAeq outputs are now shown in a compact table instead of large cards.
- The scheduler tab now contains both selected execution frequency and recommended frequency.
- Catch-up missing periods is explained directly in the UI.
- The manual execution tab is now the last tab and highlighted as a manual/support action.
- Administration now starts with a processing list. Full details are shown only after clicking Edit.

## Functional intent

- One processing can still generate several LAeq variables.
- The acquisition interval is still inferred from timestamp gaps after selecting the source variable.
- The recommended execution frequency is based on active fixed/rolling/calendar outputs and source acquisition.
- Catch-up still calculates complete missing periods after the last stored boundary and avoids duplicates through upsert logic.
