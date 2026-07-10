import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(here,'..','index-v3.html'),'utf8');
const app=fs.readFileSync(path.join(here,'..','v3-app.js'),'utf8');
const css=fs.readFileSync(path.join(here,'..','v3.css'),'utf8');

assert.match(html,/data-p="quality">3\. Execution</);
assert.match(html,/Smart event-driven/);
assert.match(html,/Custom schedule/);
assert.match(html,/id="customPanel"[^>]*hidden/);
assert.match(html,/id="fcustom"[^>]*placeholder="Enter a value"/);
assert.doesNotMatch(html,/id="fcustom"[^>]*value="15"/);
assert.match(html,/id="recalcLate"/);
assert.match(html,/No — recommended/);
assert.match(html,/id="late"[^>]*value="0"/);
assert.match(html,/No new complete period available/);
assert.match(app,/class="calendar-range"/);
assert.match(css,/\.output-table\{min-width:1390px/);
assert.match(css,/\.calendar-range\{display:grid/);
assert.match(app,/Skipped — No new complete period available or no new source data available/);
assert.match(app,/state\.lastCalculatedByOutput/);
assert.match(app,/executionMode\(\)==='custom'/);

console.log('PASS: 16 LAeq V3 UI and behaviour checks');
