import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const code=fs.readFileSync(path.join(here,'..','v3-core.js'),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(code,context);
const C=context.window.BTMCore;

function output(overrides={}){return {id:'o',variableName:'LAeq',displayName:'LAeq 15 min',duration:15,unit:'min',mode:'fixed',step:15,stepUnit:'min',calendarStart:'07:00',calendarEnd:'17:00',calendarDays:[0,1,2,3,4,5,6],active:true,...overrides};}
function points(start,count,stepSec,value=60){return Array.from({length:count},(_,i)=>({t:start+i*stepSec*1000,v:value}));}

assert.equal(C.inferAcquisition(points(Date.UTC(2026,0,1),20,60)),60);
assert.equal(C.inferAcquisition(points(Date.UTC(2026,0,1),20,1)),1);

let rec=C.recommendedExecution([output({mode:'rolling',step:1,stepUnit:'min'})],60);
assert.equal(rec.batchSeconds,900);
assert.equal(rec.fastestOutputSeconds,60);
assert.equal(C.outputsPerRun(output({mode:'rolling',step:1,stepUnit:'min'}),900),15);

const t0=Date.UTC(2026,0,1,10,0,0);
let r=C.calculateOutput(points(t0,14,60),output(),60,{validCoverage:80,timestampConvention:'start'});
assert.equal(r.length,0);
r=C.calculateOutput(points(t0,15,60),output(),60,{validCoverage:80,timestampConvention:'start'});
assert.equal(r.length,1);
assert.equal(r[0].end,t0+15*60*1000);
assert.equal(r[0].samples,15);
assert.equal(r[0].value,60);

const rolling=output({id:'roll',mode:'rolling',step:1,stepUnit:'min'});
r=C.calculateOutput(points(t0,15,60),rolling,60,{validCoverage:80,timestampConvention:'start'});
assert.equal(r.length,1);
assert.equal(r[0].end,t0+15*60*1000);
const last=r[0].end;
r=C.calculateOutput(points(t0,30,60),rolling,60,{validCoverage:80,timestampConvention:'start',lastCalculatedEnd:last});
assert.equal(r.length,15);
assert.equal(r[0].end,t0+16*60*1000);
assert.equal(r.at(-1).end,t0+30*60*1000);
assert.ok(r.every(x=>x.status==='Catch-up'));

r=C.calculateOutput(points(t0,30,60),rolling,60,{validCoverage:80,timestampConvention:'start',lastCalculatedEnd:t0+30*60*1000});
assert.equal(r.length,0);

rec=C.recommendedExecution([rolling],60);
assert.equal(rec.batchSeconds,900);
assert.equal(Math.ceil(rec.batchSeconds/60),15);

rec=C.recommendedExecution([output(),output({id:'1h',duration:1,unit:'h'}),output({id:'10h',duration:10,unit:'h',mode:'calendar'})],60);
assert.equal(rec.batchSeconds,900);

rec=C.recommendedExecution([output({mode:'rolling',step:10,stepUnit:'s'})],60);
assert.equal(rec.batchSeconds,900);
assert.equal(rec.warnings.length,1);

r=C.calculateOutput(points(t0,15,60,72.5),output(),60,{validCoverage:80,timestampConvention:'start'});
assert.ok(Math.abs(r[0].value-72.5)<1e-10);

const cal=output({id:'cal',duration:10,unit:'h',mode:'calendar',calendarStart:'07:00',calendarEnd:'17:00'});
r=C.calculateOutput(points(Date.UTC(2026,0,1,7,0),599,60),cal,60,{validCoverage:80,timestampConvention:'start'});
assert.equal(r.length,0);
r=C.calculateOutput(points(Date.UTC(2026,0,1,7,0),600,60),cal,60,{validCoverage:80,timestampConvention:'start'});
assert.equal(r.length,1);
assert.equal(r[0].expected,600);

const weekdays=output({id:'weekdays',duration:10,unit:'h',mode:'calendar',calendarStart:'07:00',calendarEnd:'17:00',calendarDays:[1,2,3,4,5]});
r=C.calculateOutput(points(Date.UTC(2026,0,2,7,0),82,3600),weekdays,3600,{validCoverage:100,timestampConvention:'start'});
assert.equal(r.length,2);
assert.equal(new Date(r[0].start).getUTCDay(),5);
assert.equal(new Date(r[1].start).getUTCDay(),1);

const overnight=output({id:'night',duration:9,unit:'h',mode:'calendar',calendarStart:'22:00',calendarEnd:'07:00',calendarDays:[1]});
r=C.calculateOutput(points(Date.UTC(2026,0,5,22,0),9,3600),overnight,3600,{validCoverage:100,timestampConvention:'start'});
assert.equal(r.length,1);
assert.equal(new Date(r[0].start).getUTCDay(),1);
assert.equal(new Date(r[0].end).getUTCDay(),2);

r=C.calculateOutput(points(t0,15,60),output({active:false}),60,{validCoverage:0,timestampConvention:'start'});
assert.equal(r.length,0);

console.log('PASS: 13 LAeq V3 execution, calendar-day and calculation scenarios');
