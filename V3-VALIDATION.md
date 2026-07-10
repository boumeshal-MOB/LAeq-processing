# LAeq processing validation

## Scope

This version validates LAeq calculation windows and recurring local-time schedules only. Country templates do not configure limits, penalties, alerts or full regulatory assessments.

## Main corrections

- Calendar duration is derived from its start/end times and can no longer contradict the displayed schedule.
- Fixed and Rolling outputs can be restricted to selected local hours and weekdays.
- Site timezone is explicit and IANA-based (`Europe/London`, `Europe/Paris`, `Europe/Madrid`, `Europe/Dublin`, `Europe/Rome`).
- Naive timestamps from Micromate and CUBE files are interpreted in the selected site timezone.
- Overnight schedules use the selected start weekday.
- Inactive outputs are visibly greyed, locked, excluded from calculation, and remain removable/reactivatable.
- Custom execution remains empty until the user enters a value.
- User-facing execution text describes BTM behaviour without exposing implementation technology.

## Calculation templates

### Basic LAeq

- Fixed LAeq 15 min, continuous.
- Fixed LAeq 1 h, continuous.
- Calendar LAeq 07:00–17:00, Monday–Friday, derived duration 10 h.

### France — ICPE recurring periods

- Day: 07:00–22:00, Monday–Saturday, one LAeq over the 15 h period.
- Night: 22:00–07:00, every day, one LAeq over the 9 h period.
- Additional Sunday daytime block: 07:00–22:00, Sunday, treated separately without overlapping the daily night block.
- Public holidays remain site-calendar dates and require review.

Reference: https://aida.ineris.fr/reglementation/arrete-230197-relatif-a-limitation-bruits-emis-lenvironnement-installations-classees

### United Kingdom — BS 4142 typical calculation periods

- Daytime: fixed LAeq 1 h within 07:00–23:00.
- Night-time: fixed LAeq 15 min within 23:00–07:00.
- The template covers calculation periods only and is not a complete BS 4142 assessment.

Reference: https://knowledge.bsigroup.com/products/methods-for-rating-and-assessing-industrial-and-commercial-sound

### Ireland — EPA NG4

- Fixed LAeq 15 min, aligned continuously.
- Day: 07:00–19:00, one LAeq over 12 h.
- Evening: 19:00–23:00, one LAeq over 4 h.
- Night: 23:00–07:00, one LAeq over 8 h.

Reference: https://www.epa.ie/publications/monitoring--assessment/noise/NG4-Guidance-Note-%28January-2016-Update%29.pdf

### Spain — RD 1367/2007

- Day: 07:00–19:00 local time, one LAeq over 12 h.
- Evening: 19:00–23:00 local time, one LAeq over 4 h.
- Night: 23:00–07:00 local time, one LAeq over 8 h.
- The competent authority may adjust the start times, therefore all fields remain editable.

Reference: https://www.boe.es/buscar/act.php?id=BOE-A-2007-18397

### Italy — national reference periods

- Fixed LAeq 1 h, continuous.
- Daytime: 06:00–22:00, one LAeq over 16 h.
- Night-time: 22:00–06:00, one LAeq over 8 h.

Reference framework: DPCM 14 November 1997 and DM 16 March 1998.

## Automated validation

### Core test suite

`node tests/v3-core.test.mjs`

21 scenarios cover:

- source acquisition inference;
- naive source timestamps interpreted in the site timezone;
- fixed and rolling LAeq calculations;
- calendar duration derived from start/end time;
- overnight periods;
- weekday/weekend exclusion;
- all five country templates;
- inactive-output exclusion;
- catch-up without duplicate periods;
- recommendation based on the smallest calculation window;
- daylight-saving transition handling.

### Static UI regression suite

`node tests/v3-ui.test.mjs`

31 checks cover:

- template controls and country definitions;
- site timezone selector;
- derived Calendar calculation window;
- schedule presets and weekdays;
- inactive-output styling and locking;
- removable inactive outputs;
- empty Custom execution value;
- absence of implementation-language references.

### Chromium interaction suite

`python tests/v3-browser.test.py`

30 browser checks cover:

- live Calendar duration updates;
- no editable Calendar duration field;
- grey inactive cards and locked fields;
- reactivation and deletion controls;
- France, UK, Ireland, Spain and Italy template rendering;
- correct timezone selection;
- correct country period summaries;
- Custom execution validation;
- absence of runtime JavaScript errors.

## Reference Micromate verification

The supplied Micromate Full Histogram file was parsed as 60 values at a 60-second acquisition interval. With the site timezone set to `Europe/Paris`, fixed LAeq 15 min results are:

- 10:15 → 67.44 dB(A)
- 10:30 → 67.86 dB(A)
- 10:45 → 67.88 dB(A)
- 11:00 → 73.62 dB(A)

This confirms that the local measurement timestamps are not incorrectly shifted by the timezone display.
