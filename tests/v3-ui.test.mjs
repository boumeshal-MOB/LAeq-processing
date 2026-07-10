import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(here,'..','index-v3.html'),'utf8');
const app=fs.readFileSync(path.join(here,'..','v3-app.js'),'utf8');
const css=fs.readFileSync(path.join(here,'..','v3.css'),'utf8');

const checks=[
  [html,'3. Execution'],
  [html,'Smart event-driven'],
  [html,'Custom schedule'],
  [html,'placeholder="Enter a value"'],
  [html,'No — recommended'],
  [html,'value="0"'],
  [html,'No new complete period available'],
  [html,'Calendar schedule'],
  [html,'active weekdays'],
  [app,'class="calendar-range"'],
  [app,'class="calendar-days"'],
  [app,'data-day='],
  [app,'data-calendar-preset="weekdays"'],
  [app,'data-calendar-preset="all"'],
  [app,'is-disabled'],
  [app,"input.dataset.k!=='active'"],
  [app,'button.disabled=!output.active'],
  [app,'data-remove'],
  [css,'.output-row.is-disabled'],
  [css,'.calendar-days{display:flex'],
  [css,'.day-chip input:disabled+span'],
  [css,'.output-table{min-width:1550px'],
  [app,'Skipped — No new complete period available or no new source data available'],
  [app,'state.lastCalculatedByOutput'],
  [app,"executionMode()==='custom'"],
  [app,'New data marks the processing as ready'],
  [app,'Results per execution']
];

for(const [source,needle] of checks)assert.ok(source.includes(needle),`Missing expected UI marker: ${needle}`);
assert.ok(!html.includes('id="fcustom" type="number" min="1" value="15"'),'Custom run interval must not be prefilled.');
assert.ok(!/python/i.test(app),'User-facing execution copy must remain implementation-agnostic.');

console.log(`PASS: ${checks.length+2} LAeq V3 UI and behaviour checks`);
