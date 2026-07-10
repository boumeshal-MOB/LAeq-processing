import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(here,'..','index-v3.html'),'utf8');
const app=fs.readFileSync(path.join(here,'..','v3-app.js'),'utf8');
const core=fs.readFileSync(path.join(here,'..','v3-core.js'),'utf8');
const css=fs.readFileSync(path.join(here,'..','v3.css'),'utf8');

const checks=[
  [html,'Calculation templates'],
  [html,'Apply template'],
  [html,'Site timezone'],
  [html,'Smart event-driven'],
  [html,'Custom schedule'],
  [html,'placeholder="Enter a value"'],
  [html,'No new complete period available'],
  [html,'Add custom LAeq output'],
  [app,'Calendar period'],
  [app,'Derived automatically from start and end time.'],
  [app,'data-days-preset="weekdays"'],
  [app,'data-days-preset="mon-sat"'],
  [app,'data-days-preset="all"'],
  [app,"output-card${output.active?'':' inactive'}"],
  [app,"control.disabled=!output.active"],
  [app,'data-remove'],
  [app,'C.templateOutputs'],
  [html,'Europe/London'],
  [core,"name:'France — ICPE periods'"],
  [core,"name:'UK — BS 4142 typical periods'"],
  [core,"name:'Ireland — EPA NG4 periods'"],
  [core,"name:'Spain — RD 1367/2007 periods'"],
  [core,"name:'Italy — DPCM reference periods'"],
  [css,'.output-card.inactive'],
  [css,'.day-chip input:disabled+span'],
  [css,'.schedule-editor'],
  [app,'BTM waits until at least one configured period is complete'],
  [app,'Skipped — No new complete period available.']
];

for(const [source,needle] of checks)assert.ok(source.includes(needle),`Missing expected marker: ${needle}`);
assert.ok(!app.includes('Python'),'User-facing application must not expose implementation-language references.');
assert.ok(!html.includes('value="15" placeholder="Enter a value"'),'Custom execution must not be prefilled.');
assert.ok(app.includes("output.mode==='calendar'"),'Calendar mode must have a dedicated derived-window branch.');

console.log(`PASS: ${checks.length+3} LAeq UI structure and regression checks`);
