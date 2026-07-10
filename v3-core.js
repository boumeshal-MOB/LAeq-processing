(function(){
  'use strict';

  const DAY_MS=86400000;
  const ALL_DAYS=[0,1,2,3,4,5,6];
  const WEEKDAYS=[1,2,3,4,5];
  const MON_SAT=[1,2,3,4,5,6];
  const DAY_NAMES={0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  const pad=n=>String(n).padStart(2,'0');
  const deepClone=value=>JSON.parse(JSON.stringify(value));

  function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
  function parseNumber(value){const match=String(value??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):NaN;}
  function seconds(value,unit){const amount=Number(value)||0;return amount*(unit==='h'?3600:unit==='min'?60:1);}
  function duration(totalSeconds){if(!Number.isFinite(totalSeconds)||totalSeconds<=0)return '—';if(totalSeconds%3600===0)return `${totalSeconds/3600} h`;if(totalSeconds%60===0)return `${totalSeconds/60} min`;return `${Math.round(totalSeconds)} s`;}

  function fmt(ms,timeZone='UTC'){
    if(!Number.isFinite(ms))return '—';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const map=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  }

  function csvRows(text,separator){
    const raw=String(text||'').replace(/^\uFEFF/,'');
    const first=raw.split(/\r?\n/)[0]||'';
    const sep=separator||(((first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length)?';':',');
    const rows=[];let row=[],field='',quoted=false;
    for(let index=0;index<raw.length;index++){
      const char=raw[index],next=raw[index+1];
      if(char==='"'){if(quoted&&next==='"'){field+='"';index++;}else quoted=!quoted;}
      else if(char===sep&&!quoted){row.push(field.trim());field='';}
      else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')index++;row.push(field.trim());field='';if(row.some(item=>item!==''))rows.push(row);row=[];}
      else field+=char;
    }
    if(field||row.length){row.push(field.trim());if(row.some(item=>item!==''))rows.push(row);}
    return rows;
  }

  const formatterCache=new Map();
  function zonedParts(ms,timeZone){
    const key=timeZone||'UTC';
    if(!formatterCache.has(key))formatterCache.set(key,new Intl.DateTimeFormat('en-GB',{timeZone:key,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
    const parts=formatterCache.get(key).formatToParts(new Date(ms));
    const map=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
    return {year:map.year,month:map.month,day:map.day,hour:map.hour,minute:map.minute,second:map.second};
  }
  function zoneOffset(ms,timeZone){const parts=zonedParts(ms,timeZone);return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second)-ms;}
  function zonedTimeToUtc(local,timeZone){const target=Date.UTC(local.year,local.month-1,local.day,local.hour||0,local.minute||0,local.second||0);let guess=target;for(let attempt=0;attempt<4;attempt++)guess=target-zoneOffset(guess,timeZone);return guess;}

  function parseTimestamp(value,timeZone='UTC',assumeLocal=false){
    const text=String(value??'').trim();
    if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)){const absolute=Date.parse(text);if(!Number.isNaN(absolute))return absolute;}
    let match=text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(match){const local={year:+match[1],month:+match[2],day:+match[3],hour:+match[4],minute:+match[5],second:+(match[6]||0)};return assumeLocal?zonedTimeToUtc(local,timeZone):Date.UTC(local.year,local.month-1,local.day,local.hour,local.minute,local.second);}
    match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(match){const local={year:+match[3],month:+match[2],day:+match[1],hour:+match[4],minute:+match[5],second:+(match[6]||0)};return assumeLocal?zonedTimeToUtc(local,timeZone):Date.UTC(local.year,local.month-1,local.day,local.hour,local.minute,local.second);}
    const parsed=Date.parse(text);return Number.isNaN(parsed)?NaN:parsed;
  }

  function findDate(metadata,fileName){const text=`${metadata||''} ${fileName||''}`;const match=text.match(/(20\d{2})[\/-]?(\d{2})[\/-]?(\d{2})/);return match?{year:+match[1],month:+match[2],day:+match[3]}:{year:1970,month:1,day:1};}

  function parseSource(text,fileName=''){
    let rows=csvRows(text);
    let headerIndex=rows.findIndex(row=>row.some(value=>/^Tran$/i.test(value))&&row.some(value=>/^Mic$/i.test(value)));
    if(headerIndex>=0){
      const groups=rows[headerIndex],measurements=rows[headerIndex+1]||[],units=rows[headerIndex+2]||[];
      const columns=groups.map((_,index)=>({index,name:index===0?'Time':`[${groups[index]||''}] ${measurements[index]||''} ${units[index]||''}`.replace(/\s+/g,' ').trim()}));
      const preferred=columns.findIndex((column,index)=>/Mic/i.test(groups[index]||'')&&/Leq/i.test(measurements[index]||''));
      return {format:'Micromate Full Histogram',columns,timeIndex:0,valueIndex:preferred>=0?preferred:columns.findIndex(column=>/Leq/i.test(column.name)),rows:rows.slice(headerIndex+3),timestampConvention:'end',timestampBasis:'local'};
    }
    rows=csvRows(text,';');
    headerIndex=rows.findIndex(row=>row.includes('Time')&&row.includes('LAeq'));
    if(headerIndex>=0){
      const header=rows[headerIndex],timeIndex=header.indexOf('Time'),valueIndex=header.indexOf('LAeq');
      const date=findDate((rows[0]||[]).join(' '),fileName);let previous=null,dayOffset=0;const data=[];
      for(const sourceRow of rows.slice(headerIndex+1)){
        const rawTime=String(sourceRow[timeIndex]||'').trim(),match=rawTime.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);if(!match)continue;
        const currentSeconds=+match[1]*3600 + +match[2]*60 + +match[3];if(previous!==null&&currentSeconds<previous-43200)dayOffset++;previous=currentSeconds;
        const dateValue=new Date(Date.UTC(date.year,date.month-1,date.day+dayOffset));const row=[...sourceRow];
        row[timeIndex]=`${dateValue.getUTCFullYear()}-${pad(dateValue.getUTCMonth()+1)}-${pad(dateValue.getUTCDate())} ${pad(match[1])}:${pad(match[2])}:${pad(match[3])}`;data.push(row);
      }
      return {format:'CUBE / SONO',columns:header.map((name,index)=>({index,name:name||`Column ${index+1}`})),timeIndex,valueIndex,rows:data,timestampConvention:'start',timestampBasis:'local'};
    }
    rows=csvRows(text);
    if(rows.length>1){
      const header=rows[0],timeIndex=header.findIndex(value=>/time|date|timestamp/i.test(value)),valueIndex=header.findIndex(value=>/laeq|leq|db|value/i.test(value));
      if(timeIndex>=0&&valueIndex>=0)return {format:'Generic timestamp/value CSV',columns:header.map((name,index)=>({index,name:name||`Column ${index+1}`})),timeIndex,valueIndex,rows:rows.slice(1),timestampConvention:'start',timestampBasis:'auto'};
    }
    throw new Error('Unsupported file: expected Micromate Full Histogram, CUBE/SONO, or timestamp/value CSV.');
  }

  function makePoints(parsed,timeIndex,valueIndex,timeZone='UTC'){const assumeLocal=parsed.timestampBasis!=='utc';return parsed.rows.map(row=>({t:parseTimestamp(row[+timeIndex],timeZone,assumeLocal),v:parseNumber(row[+valueIndex])})).filter(point=>Number.isFinite(point.t)&&Number.isFinite(point.v)).sort((left,right)=>left.t-right.t);}
  function inferAcquisition(points){const differences=[],recent=points.slice(-200);for(let index=1;index<recent.length;index++){const difference=(recent[index].t-recent[index-1].t)/1000;if(difference>0&&difference<86400)differences.push(difference);}differences.sort((left,right)=>left-right);return differences.length?differences[Math.floor(differences.length/2)]:null;}
  function normalizeDays(days){const clean=Array.isArray(days)?[...new Set(days.map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))]:[];return clean.length?clean:ALL_DAYS.slice();}
  function timeToMinutes(value){const [hours='0',minutes='0']=String(value||'00:00').split(':');return Math.max(0,Math.min(1439,(Number(hours)||0)*60+(Number(minutes)||0)));}
  function nominalScheduleSeconds(start,end){const startMinutes=timeToMinutes(start),endMinutes=timeToMinutes(end);const total=endMinutes===startMinutes?1440:(endMinutes>startMinutes?endMinutes-startMinutes:1440-startMinutes+endMinutes);return total*60;}

  function normalizeOutput(output){
    output.mode=['fixed','rolling','calendar'].includes(output.mode)?output.mode:'fixed';output.duration=Number(output.duration)||15;output.unit=['s','min','h'].includes(output.unit)?output.unit:'min';output.step=Number(output.step)||output.duration;output.stepUnit=['s','min','h'].includes(output.stepUnit)?output.stepUnit:output.unit;
    output.scheduleStart=output.scheduleStart||output.calendarStart||'00:00';output.scheduleEnd=output.scheduleEnd||output.calendarEnd||'00:00';output.scheduleDays=normalizeDays(output.scheduleDays||output.calendarDays);output.scheduleEnabled=output.mode==='calendar'?true:Boolean(output.scheduleEnabled);output.active=output.active!==false;
    output.periodSeconds=output.mode==='calendar'?nominalScheduleSeconds(output.scheduleStart,output.scheduleEnd):seconds(output.duration,output.unit);output.stepSeconds=output.mode==='rolling'?seconds(output.step,output.stepUnit):output.periodSeconds;output.outputIntervalSeconds=output.mode==='rolling'?output.stepSeconds:output.periodSeconds;return output;
  }

  function energy(values){return 10*Math.log10(values.reduce((sum,value)=>sum+10**(value/10),0)/values.length);}
  function inWindow(point,start,end,convention){return convention==='end'?point.t>start&&point.t<=end:point.t>=start&&point.t<end;}
  function coverageWindow(points,start,end,acquisitionSeconds,convention){const selected=points.filter(point=>inWindow(point,start,end,convention));const expected=Math.max(1,Math.round((end-start)/1000/acquisitionSeconds));const coverage=selected.length/expected*100;return {samples:selected.length,expected,coverage,value:selected.length?energy(selected.map(point=>point.v)):NaN};}
  function availableThrough(points,acquisitionSeconds){return points.length&&acquisitionSeconds?points.at(-1).t+acquisitionSeconds*1000:null;}
  function addLocalDays(localDate,days){const date=new Date(Date.UTC(localDate.year,localDate.month-1,localDate.day+days));return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};}
  function localWeekday(localDate){return new Date(Date.UTC(localDate.year,localDate.month-1,localDate.day)).getUTCDay();}
  function localDateKey(localDate){return `${localDate.year}-${pad(localDate.month)}-${pad(localDate.day)}`;}
  function scheduleBlock(localDate,output,timeZone){const startMinutes=timeToMinutes(output.scheduleStart),endMinutes=timeToMinutes(output.scheduleEnd),fullDay=startMinutes===endMinutes;const start=zonedTimeToUtc({...localDate,hour:Math.floor(startMinutes/60),minute:startMinutes%60,second:0},timeZone);const endDate=addLocalDays(localDate,fullDay||endMinutes<=startMinutes?1:0);const end=zonedTimeToUtc({...endDate,hour:Math.floor(endMinutes/60),minute:endMinutes%60,second:0},timeZone);return {start,end,localDate:localDateKey(localDate),weekday:localWeekday(localDate)};}
  function listScheduleBlocks(firstTimestamp,lastTimestamp,output,timeZone){const firstLocal=zonedParts(firstTimestamp,timeZone),lastLocal=zonedParts(lastTimestamp,timeZone);let cursor=addLocalDays({year:firstLocal.year,month:firstLocal.month,day:firstLocal.day},-1);const endDate=addLocalDays({year:lastLocal.year,month:lastLocal.month,day:lastLocal.day},1),blocks=[];for(let guard=0;guard<5000;guard++){if(localDateKey(cursor)>localDateKey(endDate))break;if(output.scheduleDays.includes(localWeekday(cursor)))blocks.push(scheduleBlock(cursor,output,timeZone));cursor=addLocalDays(cursor,1);}return blocks;}
  function listLocalDayBlocks(firstTimestamp,lastTimestamp,timeZone){return listScheduleBlocks(firstTimestamp,lastTimestamp,{scheduleStart:'00:00',scheduleEnd:'00:00',scheduleDays:ALL_DAYS},timeZone);}

  function calculateOutput(points,rawOutput,acquisitionSeconds,options={}){
    const output=normalizeOutput({...rawOutput}),results=[];if(!points.length||!acquisitionSeconds||!output.active)return results;
    const minCoverage=Number(options.validCoverage??80),convention=options.timestampConvention||'start',lastStored=Number(options.lastCalculatedEnd)||null,timeZone=options.timeZone||'UTC',available=availableThrough(points,acquisitionSeconds),first=points[0].t;
    const createResult=(start,end)=>{if(end>available||(lastStored&&end<=lastStored))return;const coverage=coverageWindow(points,start,end,acquisitionSeconds,convention);if(!coverage.samples||coverage.coverage<minCoverage)return;results.push({outputId:output.id,variableName:output.variableName,displayName:output.displayName,mode:output.mode,start,end,timestamp:end,value:coverage.value,samples:coverage.samples,expected:coverage.expected,coverage:coverage.coverage,status:lastStored?'Catch-up':'New'});};
    if(output.mode==='calendar'){for(const block of listScheduleBlocks(first,available,output,timeZone))createResult(block.start,block.end);}
    else if(output.scheduleEnabled){const period=output.periodSeconds*1000,step=output.mode==='rolling'?output.stepSeconds*1000:period;for(const block of listScheduleBlocks(first,available,output,timeZone))for(let end=block.start+period;end<=block.end;end+=step)createResult(end-period,end);}
    else if(output.mode==='rolling'){const period=output.periodSeconds*1000,step=output.stepSeconds*1000;for(let end=first+period;end<=available;end+=step)createResult(end-period,end);}
    else{const period=output.periodSeconds*1000;for(const dayBlock of listLocalDayBlocks(first,available,timeZone))for(let end=dayBlock.start+period;end<=dayBlock.end;end+=period)createResult(end-period,end);}
    return results.sort((left,right)=>left.end-right.end);
  }
  function calculateAll(points,outputs,acquisitionSeconds,options={}){let results=[];for(const output of outputs)results=results.concat(calculateOutput(points,output,acquisitionSeconds,{...options,lastCalculatedEnd:options.lastCalculatedByOutput?.[output.id]}));return results.sort((left,right)=>left.end-right.end||left.variableName.localeCompare(right.variableName));}

  function recommendedExecution(outputs,acquisitionSeconds){const active=outputs.filter(output=>output.active).map(output=>normalizeOutput({...output}));if(!active.length)return {batchSeconds:null,fastestOutputSeconds:null,warnings:[],reason:'No active LAeq output.'};const smallestWindow=Math.min(...active.map(output=>output.periodSeconds).filter(value=>value>0)),fastestOutput=Math.min(...active.map(output=>output.outputIntervalSeconds).filter(value=>value>0)),batchSeconds=Math.max(smallestWindow,acquisitionSeconds||0),warnings=[];for(const output of active)if(output.mode==='rolling'&&acquisitionSeconds&&output.stepSeconds<acquisitionSeconds)warnings.push(`${output.displayName||output.variableName}: output interval ${duration(output.stepSeconds)} is faster than source acquisition ${duration(acquisitionSeconds)}.`);return {batchSeconds,smallestWindowSeconds:smallestWindow,fastestOutputSeconds:fastestOutput,warnings,reason:`The recommendation follows the smallest active calculation window (${duration(smallestWindow)}).`};}
  function outputsPerRun(rawOutput,runSeconds){const output=normalizeOutput({...rawOutput});if(!output.active||!runSeconds)return 0;if(output.mode==='rolling')return Math.max(1,Math.ceil(runSeconds/output.stepSeconds));if(output.mode==='fixed')return Math.max(1,Math.ceil(runSeconds/output.periodSeconds));return 1;}
  function makeOutput(id,variableName,displayName,mode,options={}){return normalizeOutput({id,variableName,displayName,mode,duration:options.duration??15,unit:options.unit||'min',step:options.step??options.duration??15,stepUnit:options.stepUnit||options.unit||'min',scheduleEnabled:Boolean(options.scheduleEnabled),scheduleStart:options.scheduleStart||'00:00',scheduleEnd:options.scheduleEnd||'00:00',scheduleDays:options.scheduleDays||ALL_DAYS,active:options.active!==false,sourceTemplate:options.sourceTemplate||null});}

  const TEMPLATES={
    basic:{id:'basic',name:'Basic LAeq',country:'Custom',timeZone:'Europe/Paris',description:'Starter outputs for continuous LAeq 15 min, 1 h and a weekday 10 h period.',note:'All fields remain editable.',outputs:[makeOutput('basic-15m','Noise_LAeq_15min','LAeq 15 min','fixed',{duration:15,unit:'min',sourceTemplate:'basic'}),makeOutput('basic-1h','Noise_LAeq_1h','LAeq 1 h','fixed',{duration:1,unit:'h',sourceTemplate:'basic'}),makeOutput('basic-10h','Noise_LAeq_10h','LAeq 07:00–17:00','calendar',{scheduleStart:'07:00',scheduleEnd:'17:00',scheduleDays:WEEKDAYS,sourceTemplate:'basic'})]},
    france:{id:'france',name:'France — ICPE periods',country:'France',timeZone:'Europe/Paris',description:'Recurring reference periods based on 07:00–22:00 day, 22:00–07:00 night and the additional Sunday daytime block.',note:'The Sunday 07:00–22:00 block complements the daily night output without overlap. Public holidays must be added from the site calendar.',outputs:[makeOutput('fr-day','Noise_LAeq_FR_day','LAeq day 07:00–22:00','calendar',{scheduleStart:'07:00',scheduleEnd:'22:00',scheduleDays:MON_SAT,sourceTemplate:'france'}),makeOutput('fr-night','Noise_LAeq_FR_night','LAeq night 22:00–07:00','calendar',{scheduleStart:'22:00',scheduleEnd:'07:00',scheduleDays:ALL_DAYS,sourceTemplate:'france'}),makeOutput('fr-sunday','Noise_LAeq_FR_sunday_day','LAeq Sunday 07:00–22:00','calendar',{scheduleStart:'07:00',scheduleEnd:'22:00',scheduleDays:[0],sourceTemplate:'france'})]},
    uk:{id:'uk',name:'UK — BS 4142 typical periods',country:'United Kingdom',timeZone:'Europe/London',description:'Typical industrial assessment windows: 1 h during 07:00–23:00 and 15 min during 23:00–07:00.',note:'This is a calculation-period template, not a complete BS 4142 assessment.',outputs:[makeOutput('uk-day-1h','Noise_LAeq_UK_day_1h','LAeq 1 h — daytime','fixed',{duration:1,unit:'h',scheduleEnabled:true,scheduleStart:'07:00',scheduleEnd:'23:00',scheduleDays:ALL_DAYS,sourceTemplate:'uk'}),makeOutput('uk-night-15m','Noise_LAeq_UK_night_15min','LAeq 15 min — night','fixed',{duration:15,unit:'min',scheduleEnabled:true,scheduleStart:'23:00',scheduleEnd:'07:00',scheduleDays:ALL_DAYS,sourceTemplate:'uk'})]},
    ireland:{id:'ireland',name:'Ireland — EPA NG4 periods',country:'Ireland',timeZone:'Europe/Dublin',description:'15-minute aligned LAeq plus day 07:00–19:00, evening 19:00–23:00 and night 23:00–07:00 aggregates.',note:'Outputs cover calculation periods only.',outputs:[makeOutput('ie-15m','Noise_LAeq_IE_15min','LAeq 15 min','fixed',{duration:15,unit:'min',sourceTemplate:'ireland'}),makeOutput('ie-day','Noise_LAeq_IE_day','LAeq day 07:00–19:00','calendar',{scheduleStart:'07:00',scheduleEnd:'19:00',scheduleDays:ALL_DAYS,sourceTemplate:'ireland'}),makeOutput('ie-evening','Noise_LAeq_IE_evening','LAeq evening 19:00–23:00','calendar',{scheduleStart:'19:00',scheduleEnd:'23:00',scheduleDays:ALL_DAYS,sourceTemplate:'ireland'}),makeOutput('ie-night','Noise_LAeq_IE_night','LAeq night 23:00–07:00','calendar',{scheduleStart:'23:00',scheduleEnd:'07:00',scheduleDays:ALL_DAYS,sourceTemplate:'ireland'})]},
    spain:{id:'spain',name:'Spain — RD 1367/2007 periods',country:'Spain',timeZone:'Europe/Madrid',description:'Local-time day 07:00–19:00, evening 19:00–23:00 and night 23:00–07:00 periods.',note:'Competent authorities may adjust period start times; the template remains editable.',outputs:[makeOutput('es-day','Noise_LAeq_ES_day','LAeq día 07:00–19:00','calendar',{scheduleStart:'07:00',scheduleEnd:'19:00',scheduleDays:ALL_DAYS,sourceTemplate:'spain'}),makeOutput('es-evening','Noise_LAeq_ES_evening','LAeq tarde 19:00–23:00','calendar',{scheduleStart:'19:00',scheduleEnd:'23:00',scheduleDays:ALL_DAYS,sourceTemplate:'spain'}),makeOutput('es-night','Noise_LAeq_ES_night','LAeq noche 23:00–07:00','calendar',{scheduleStart:'23:00',scheduleEnd:'07:00',scheduleDays:ALL_DAYS,sourceTemplate:'spain'})]},
    italy:{id:'italy',name:'Italy — DPCM reference periods',country:'Italy',timeZone:'Europe/Rome',description:'Hourly LAeq plus daytime 06:00–22:00 and night-time 22:00–06:00 reference periods.',note:'Outputs cover the national recurring time periods only.',outputs:[makeOutput('it-1h','Noise_LAeq_IT_1h','LAeq 1 h','fixed',{duration:1,unit:'h',sourceTemplate:'italy'}),makeOutput('it-day','Noise_LAeq_IT_day','LAeq diurno 06:00–22:00','calendar',{scheduleStart:'06:00',scheduleEnd:'22:00',scheduleDays:ALL_DAYS,sourceTemplate:'italy'}),makeOutput('it-night','Noise_LAeq_IT_night','LAeq notturno 22:00–06:00','calendar',{scheduleStart:'22:00',scheduleEnd:'06:00',scheduleDays:ALL_DAYS,sourceTemplate:'italy'})]}
  };
  function getTemplate(id){return TEMPLATES[id]?deepClone(TEMPLATES[id]):null;}
  function templateList(){return Object.values(TEMPLATES).map(template=>({id:template.id,name:template.name,country:template.country,timeZone:template.timeZone,description:template.description,note:template.note}));}
  function templateOutputs(id){const template=getTemplate(id);return template?template.outputs.map(output=>normalizeOutput(output)):[];}

  window.BTMCore={DAY_MS,ALL_DAYS,WEEKDAYS,MON_SAT,DAY_NAMES,esc,parseNumber,seconds,duration,fmt,csvRows,parseTimestamp,parseSource,makePoints,inferAcquisition,normalizeDays,timeToMinutes,nominalScheduleSeconds,normalizeOutput,energy,coverageWindow,availableThrough,zonedParts,zonedTimeToUtc,addLocalDays,localWeekday,scheduleBlock,listScheduleBlocks,calculateOutput,calculateAll,recommendedExecution,outputsPerRun,TEMPLATES,getTemplate,templateList,templateOutputs,deepClone};
})();
