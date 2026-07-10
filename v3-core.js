(function(){
  const DAY = 864e5;
  const pad = (n)=>String(n).padStart(2,'0');

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function fmt(ms){const d=new Date(ms);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;}
  function parseNumber(v){const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:NaN;}
  function seconds(value, unit){const n=Number(value)||0;return n*(unit==='h'?3600:unit==='min'?60:1);}
  function duration(sec){if(!Number.isFinite(sec)||sec<=0)return '—';if(sec%3600===0)return `${sec/3600} h`;if(sec%60===0)return `${sec/60} min`;return `${sec} s`;}
  function durationWithHours(sec){if(!Number.isFinite(sec)||sec<=0)return '—';return `${duration(sec)} (${trim(sec/3600)} h)`;}
  function trim(n){return Number.isInteger(n)?String(n):String(+n.toFixed(3)).replace(/\.0+$/,'');}

  function csvRows(text, sep){
    const raw = String(text||'').replace(/^\uFEFF/,'');
    const first = raw.split(/\r?\n/)[0] || '';
    sep = sep || (((first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length) ? ';' : ',');
    const out=[];let row=[],field='',q=false;
    for(let i=0;i<raw.length;i++){
      const ch=raw[i], next=raw[i+1];
      if(ch==='"'){
        if(q && next==='"'){field+='"';i++;} else q=!q;
      } else if(ch===sep && !q){row.push(field.trim());field='';
      } else if((ch==='\n'||ch==='\r') && !q){if(ch==='\r'&&next==='\n')i++;row.push(field.trim());field='';if(row.some(x=>x!==''))out.push(row);row=[];
      } else field+=ch;
    }
    if(field || row.length){row.push(field.trim());if(row.some(x=>x!==''))out.push(row);}
    return out;
  }

  function parseTimestamp(v){
    const s=String(v??'').trim();
    let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(m)return Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0));
    const d=Date.parse(s);return Number.isNaN(d)?NaN:d;
  }

  function findDate(meta, name){
    const text = `${meta||''} ${name||''}`;
    const m = text.match(/(20\d{2})[\/-]?(\d{2})[\/-]?(\d{2})/);
    return m?{y:+m[1],m:+m[2],d:+m[3]}:{y:1970,m:1,d:1};
  }

  function parseSource(text, name=''){
    let rows = csvRows(text);
    let idx = rows.findIndex(r=>r.some(x=>/^Tran$/i.test(x)) && r.some(x=>/^Mic$/i.test(x)));
    if(idx>=0){
      const group=rows[idx], meas=rows[idx+1]||[], unit=rows[idx+2]||[];
      const cols = group.map((_,i)=>({index:i,name:i===0?'Time':`[${group[i]||''}] ${meas[i]||''} ${unit[i]||''}`.replace(/\s+/g,' ').trim()}));
      const vi = cols.findIndex((c,i)=>/Mic/i.test(group[i]||'') && /Leq/i.test(meas[i]||''));
      return {format:'Micromate Full Histogram',columns:cols,timeIndex:0,valueIndex:vi>=0?vi:cols.findIndex(c=>/Leq/i.test(c.name)),rows:rows.slice(idx+3),timestampConvention:'end'};
    }
    rows = csvRows(text,';');
    idx = rows.findIndex(r=>r.includes('Time') && r.includes('LAeq'));
    if(idx>=0){
      const header=rows[idx], ti=header.indexOf('Time'), vi=header.indexOf('LAeq');
      const dt=findDate((rows[0]||[]).join(' '),name);
      let prev=null,dayOffset=0;const data=[];
      for(const sourceRow of rows.slice(idx+1)){
        const t=String(sourceRow[ti]||'').trim();
        const z=t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);if(!z)continue;
        const sec=+z[1]*3600 + +z[2]*60 + +z[3];
        if(prev!==null && sec<prev-43200)dayOffset++;
        prev=sec;
        const row=[...sourceRow];row[ti]=fmt(Date.UTC(dt.y,dt.m-1,dt.d+dayOffset,+z[1],+z[2],+z[3]));data.push(row);
      }
      return {format:'CUBE / SONO',columns:header.map((h,i)=>({index:i,name:h||`Column ${i+1}`})),timeIndex:ti,valueIndex:vi,rows:data,timestampConvention:'start'};
    }
    rows = csvRows(text);
    if(rows.length>1){
      const h=rows[0],ti=h.findIndex(x=>/time|date|timestamp/i.test(x)),vi=h.findIndex(x=>/laeq|leq|db|value/i.test(x));
      if(ti>=0&&vi>=0)return {format:'Generic timestamp/value CSV',columns:h.map((x,i)=>({index:i,name:x||`Column ${i+1}`})),timeIndex:ti,valueIndex:vi,rows:rows.slice(1),timestampConvention:'start'};
    }
    throw new Error('Unsupported file: expected Micromate Full Histogram, CUBE/SONO, or timestamp/value CSV.');
  }

  function makePoints(parsed,timeIndex,valueIndex){return parsed.rows.map(r=>({t:parseTimestamp(r[+timeIndex]),v:parseNumber(r[+valueIndex])})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)).sort((a,b)=>a.t-b.t);}
  function inferAcquisition(points){
    const diffs=[],slice=points.slice(-200);
    for(let i=1;i<slice.length;i++){const d=(slice[i].t-slice[i-1].t)/1000;if(d>0&&d<86400)diffs.push(d);}
    diffs.sort((a,b)=>a-b);return diffs.length?diffs[Math.floor(diffs.length/2)]:null;
  }

  function normalizeOutput(o){
    o.periodSeconds=seconds(o.duration,o.unit);
    o.stepSeconds=o.mode==='rolling'?seconds(o.step||o.duration,o.stepUnit||o.unit):o.periodSeconds;
    o.outputIntervalSeconds=o.mode==='rolling'?o.stepSeconds:o.mode==='calendar'?86400:o.periodSeconds;
    return o;
  }

  function energy(values){return 10*Math.log10(values.reduce((s,x)=>s+10**(x/10),0)/values.length);}
  function inWindow(point,start,end,convention){return convention==='end'?point.t>start&&point.t<=end:point.t>=start&&point.t<end;}
  function coverageWindow(points,start,end,acqSec,convention){
    const w=points.filter(p=>inWindow(p,start,end,convention));
    const expected=Math.max(1,Math.round((end-start)/1000/acqSec));
    const coverage=w.length/expected*100;
    return {samples:w.length,expected,coverage,value:w.length?energy(w.map(x=>x.v)):NaN};
  }
  function availableThrough(points,acqSec){return points.length&&acqSec?points[points.length-1].t+acqSec*1000:null;}

  function calculateOutput(points,output,acqSec,opts={}){
    normalizeOutput(output);
    const minCoverage=Number(opts.validCoverage??80),convention=opts.timestampConvention||'start',lastStored=opts.lastCalculatedEnd||null,results=[];
    if(!points.length||!acqSec||!output.active)return results;
    const first=points[0].t,available=availableThrough(points,acqSec);
    const make=(s,e)=>{
      if(lastStored&&e<=lastStored)return;
      const c=coverageWindow(points,s,e,acqSec,convention);
      if(c.samples&&c.coverage>=minCoverage)results.push({outputId:output.id,variableName:output.variableName,mode:output.mode,start:s,end:e,timestamp:e,value:c.value,samples:c.samples,expected:c.expected,coverage:c.coverage,status:lastStored?'Catch-up':'New'});
    };
    if(output.mode==='calendar'){
      const toMin=(x)=>{const a=String(x||'00:00').split(':');return (+a[0]||0)*60+(+a[1]||0);};
      const sm=toMin(output.calendarStart),em=toMin(output.calendarEnd);
      for(let d=Math.floor(first/DAY)*DAY-DAY;d<=Math.floor(available/DAY)*DAY;d+=DAY){const s=d+sm*60000,e=d+em*60000+(em<=sm?DAY:0);if(e<=available)make(s,e);}
    }else if(output.mode==='rolling'){
      const p=output.periodSeconds*1000,step=output.stepSeconds*1000,firstEnd=first+p,lastEnd=available;
      for(let e=firstEnd;e<=lastEnd;e+=step)make(e-p,e);
    }else{
      const p=output.periodSeconds*1000,firstEnd=Math.ceil(first/p)*p,lastEnd=Math.floor(available/p)*p;
      for(let e=firstEnd;e<=lastEnd;e+=p)make(e-p,e);
    }
    return results;
  }

  function calculateAll(points,outputs,acqSec,opts={}){let all=[];for(const o of outputs)all=all.concat(calculateOutput(points,o,acqSec,{...opts,lastCalculatedEnd:opts.lastCalculatedByOutput?.[o.id]}));return all.sort((a,b)=>a.end-b.end||a.variableName.localeCompare(b.variableName));}

  function recommendedExecution(outputs,acqSec){
    const active=outputs.filter(o=>o.active).map(o=>normalizeOutput({...o}));
    if(!active.length)return {batchSeconds:null,fastestOutputSeconds:null,reason:'No active LAeq output.',warnings:[],eventDriven:true};
    const windowCadences=active.map(o=>o.mode==='calendar'?Math.min(3600,o.periodSeconds):o.periodSeconds).filter(x=>x>0);
    const outputCadences=active.map(o=>o.outputIntervalSeconds).filter(x=>x>0);
    const smallestWindow=Math.min(...windowCadences),fastestOutput=Math.min(...outputCadences);
    const batchSeconds=Math.max(smallestWindow,acqSec||0);
    const warnings=[];
    for(const o of active){
      if(o.mode==='rolling'&&acqSec&&o.stepSeconds<acqSec)warnings.push(`${o.displayName||o.variableName}: output interval (${duration(o.stepSeconds)}) is faster than source acquisition (${duration(acqSec)}). Repeated values cannot be invented.`);
    }
    return {
      batchSeconds,
      fastestOutputSeconds:fastestOutput,
      smallestWindowSeconds:smallestWindow,
      eventDriven:true,
      reason:`Recommended run batching uses the smallest calculation window (${duration(smallestWindow)}), not the fastest output interval (${duration(fastestOutput)}). Catch-up can generate several pending result timestamps in one calculation run.`,
      warnings
    };
  }
  function recommendedFrequency(outputs,acqSec){const r=recommendedExecution(outputs,acqSec);return {seconds:r.batchSeconds,reason:r.reason,warnings:r.warnings};}
  function outputsPerRun(output,runSeconds){normalizeOutput(output);if(!runSeconds||!output.active)return 0;if(output.mode==='rolling')return Math.max(1,Math.ceil(runSeconds/output.stepSeconds));if(output.mode==='fixed')return Math.max(1,Math.ceil(runSeconds/output.periodSeconds));return 1;}

  window.BTMCore={DAY,esc,fmt,parseNumber,parseTimestamp,seconds,duration,durationWithHours,csvRows,parseSource,makePoints,inferAcquisition,normalizeOutput,calculateAll,calculateOutput,recommendedExecution,recommendedFrequency,outputsPerRun,availableThrough,trim};
})();
