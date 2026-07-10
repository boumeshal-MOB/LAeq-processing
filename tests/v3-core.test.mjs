import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const code=fs.readFileSync(path.join(here,'..','v3-core.js'),'utf8');
const context={window:{},console,Intl,Date,Math,JSON,Number,String,Array,Set,Object};
vm.createContext(context);
vm.runInContext(code,context);
const C=context.window.BTMCore;

const pointSeries=(start,count,stepSeconds,value=60)=>Array.from({length:count},(_,index)=>({t:start+index*stepSeconds*1000,v:value}));
const baseOutput=(overrides={})=>C.normalizeOutput({
  id:'o',variableName:'LAeq',displayName:'LAeq',mode:'fixed',duration:15,unit:'min',step:15,stepUnit:'min',
  scheduleEnabled:false,scheduleStart:'00:00',scheduleEnd:'00:00',scheduleDays:[0,1,2,3,4,5,6],active:true,
  ...overrides
});

assert.equal(C.inferAcquisition(pointSeries(Date.UTC(2026,0,1),20,60)),60);
assert.equal(C.nominalScheduleSeconds('07:00','17:00'),10*3600);
assert.equal(C.nominalScheduleSeconds('23:00','07:00'),8*3600);
assert.equal(C.nominalScheduleSeconds('00:00','00:00'),24*3600);

const localParsed={timestampBasis:'local',rows:[['2026-07-01 10:00:00','60']],columns:[],timeIndex:0,valueIndex:1};
const localPoint=C.makePoints(localParsed,0,1,'Europe/Paris')[0];
assert.equal(C.fmt(localPoint.t,'Europe/Paris'),'2026-07-01 10:00:00','Naive source timestamps must be interpreted in the site timezone.');

const t0=Date.UTC(2026,0,1,0,0,0);
let result=C.calculateOutput(pointSeries(t0,15,60),baseOutput(),60,{validCoverage:100,timeZone:'UTC'});
assert.equal(result.length,1);
assert.equal(result[0].samples,15);
assert.equal(result[0].value,60);

const rolling=baseOutput({id:'rolling',mode:'rolling',duration:15,unit:'min',step:1,stepUnit:'min'});
result=C.calculateOutput(pointSeries(t0,30,60),rolling,60,{validCoverage:100,timeZone:'UTC'});
assert.equal(result.length,16);
assert.equal(result[0].end,t0+15*60*1000);
assert.equal(result.at(-1).end,t0+30*60*1000);

const calendar=baseOutput({id:'calendar',mode:'calendar',duration:1,unit:'h',scheduleStart:'07:00',scheduleEnd:'17:00',scheduleDays:[1,2,3,4,5]});
assert.equal(calendar.periodSeconds,10*3600,'Calendar duration must be derived from schedule, not stale duration input.');
const monday=Date.UTC(2026,0,5,7,0,0);
result=C.calculateOutput(pointSeries(monday,600,60),calendar,60,{validCoverage:100,timeZone:'UTC'});
assert.equal(result.length,1);
assert.equal(result[0].expected,600);

const nightFixed=baseOutput({id:'night',duration:15,unit:'min',scheduleEnabled:true,scheduleStart:'23:00',scheduleEnd:'07:00',scheduleDays:C.ALL_DAYS});
const nightStart=Date.UTC(2026,0,5,23,0,0);
result=C.calculateOutput(pointSeries(nightStart,8*60,60),nightFixed,60,{validCoverage:100,timeZone:'UTC'});
assert.equal(result.length,32);
assert.equal(result[0].end,nightStart+15*60*1000);
assert.equal(result.at(-1).end,Date.UTC(2026,0,6,7,0,0));

const weekdays=baseOutput({id:'weekdays',mode:'calendar',scheduleStart:'07:00',scheduleEnd:'19:00',scheduleDays:[1,2,3,4,5]});
const friday=Date.UTC(2026,0,2,7,0,0);
result=C.calculateOutput(pointSeries(friday,4*24,3600),weekdays,3600,{validCoverage:100,timeZone:'UTC'});
assert.equal(result.length,2,'Friday and Monday periods should be generated; weekend periods must be excluded.');
assert.equal(new Date(result[0].start).getUTCDay(),5);
assert.equal(new Date(result[1].start).getUTCDay(),1);

const france=C.getTemplate('france');
assert.equal(france.timeZone,'Europe/Paris');
assert.equal(france.outputs.length,3);
assert.equal(france.outputs[0].periodSeconds,15*3600);
assert.deepEqual(Array.from(france.outputs[0].scheduleDays),[1,2,3,4,5,6]);
assert.equal(france.outputs[2].periodSeconds,15*3600);
assert.deepEqual(Array.from(france.outputs[2].scheduleDays),[0]);

const uk=C.getTemplate('uk');
assert.equal(uk.outputs.length,2);
assert.equal(uk.outputs[0].periodSeconds,3600);
assert.equal(uk.outputs[0].scheduleStart,'07:00');
assert.equal(uk.outputs[0].scheduleEnd,'23:00');
assert.equal(uk.outputs[1].periodSeconds,900);
assert.equal(uk.outputs[1].scheduleStart,'23:00');
assert.equal(uk.outputs[1].scheduleEnd,'07:00');

const ireland=C.getTemplate('ireland');
assert.equal(ireland.outputs.length,4);
assert.equal(ireland.outputs[1].periodSeconds,12*3600);
assert.equal(ireland.outputs[2].periodSeconds,4*3600);
assert.equal(ireland.outputs[3].periodSeconds,8*3600);

const spain=C.getTemplate('spain');
assert.deepEqual(Array.from(spain.outputs.map(output=>output.periodSeconds)),[12*3600,4*3600,8*3600]);
assert.equal(spain.timeZone,'Europe/Madrid');

const italy=C.getTemplate('italy');
assert.equal(italy.outputs[0].periodSeconds,3600);
assert.equal(italy.outputs[1].periodSeconds,16*3600);
assert.equal(italy.outputs[2].periodSeconds,8*3600);

result=C.calculateOutput(pointSeries(t0,15,60),baseOutput({active:false}),60,{validCoverage:0,timeZone:'UTC'});
assert.equal(result.length,0);

const catchupOutput=baseOutput({id:'catch'});
result=C.calculateOutput(pointSeries(t0,60,60),catchupOutput,60,{validCoverage:100,timeZone:'UTC',lastCalculatedEnd:t0+30*60*1000});
assert.equal(result.length,2);
assert.ok(result.every(item=>item.status==='Catch-up'));
assert.equal(result[0].end,t0+45*60*1000);
assert.equal(result[1].end,t0+60*60*1000);

const recommendation=C.recommendedExecution([
  baseOutput({duration:1,unit:'h'}),
  baseOutput({mode:'rolling',duration:15,unit:'min',step:1,stepUnit:'min'})
],60);
assert.equal(recommendation.batchSeconds,900);
assert.equal(recommendation.fastestOutputSeconds,60);
assert.equal(C.outputsPerRun(baseOutput({mode:'rolling',duration:15,unit:'min',step:1,stepUnit:'min'}),900),15);

const londonFullDay=baseOutput({id:'dst',mode:'calendar',scheduleStart:'00:00',scheduleEnd:'00:00',scheduleDays:C.ALL_DAYS});
const springBlock=C.scheduleBlock({year:2026,month:3,day:29},londonFullDay,'Europe/London');
assert.equal((springBlock.end-springBlock.start)/3600000,23,'DST spring day must contain 23 real hours while remaining a 24 h local period.');
assert.equal(londonFullDay.periodSeconds,24*3600);

console.log('PASS: 21 LAeq calculation, source-timezone, schedule and country-template scenarios');
