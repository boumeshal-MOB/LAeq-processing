(function(){
  const C = window.BTMCore;
  const $ = (id)=>document.getElementById(id);
  const KEY='btm-laeq-v3-admin';
  let state=loadState();
  let parsed=null, points=[], acquisitionSec=null, results=[];
  let outputs = state.outputs || [
    {id:'15m',variableName:'Noise_LAeq_15min',displayName:'LAeq 15 min',duration:15,unit:'min',mode:'fixed',step:15,stepUnit:'min',calendarStart:'00:00',calendarEnd:'00:15',active:true},
    {id:'1h',variableName:'Noise_LAeq_1h',displayName:'LAeq 1 h',duration:1,unit:'h',mode:'fixed',step:1,stepUnit:'h',calendarStart:'00:00',calendarEnd:'01:00',active:true},
    {id:'10h',variableName:'Noise_LAeq_10h',displayName:'LAeq 10 h',duration:10,unit:'h',mode:'calendar',step:1,stepUnit:'h',calendarStart:'07:00',calendarEnd:'17:00',active:true}
  ];
  $('pname').value = state.processingName || $('pname').value;
  $('active').value = state.active || 'Yes';
  const storedMode = state.frequencyMode === 'auto' ? 'event' : state.frequencyMode;
  $('fmode').value = storedMode || 'event';
  $('fcustom').value = state.customFrequency || 15;
  $('coverage').value = state.coverage || 80;
  $('late').value = state.late || 60;
  $('catchup').value = state.catchup || 'yes';
  $('schedActive').value = state.schedActive || 'Enabled';
  $('fcustom').disabled = $('fmode').value !== 'custom';

  function currentVariableName(){return parsed ? $('vc').options[$('vc').selectedIndex]?.textContent || '—' : '—';}
  function persist(){
    state.processingName=$('pname').value;state.active=$('active').value;state.frequencyMode=$('fmode').value;state.customFrequency=Number($('fcustom').value)||15;state.coverage=Number($('coverage').value)||80;state.late=Number($('late').value)||60;state.catchup=$('catchup').value;state.schedActive=$('schedActive').value;state.outputs=outputs;
    localStorage.setItem(KEY,JSON.stringify(state));
  }
  function loadState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function activateTab(id){document.querySelectorAll('.tab,.panel').forEach(el=>el.classList.remove('on'));document.querySelector(`.tab[data-p="${id}"]`)?.classList.add('on');$(id)?.classList.add('on');if(id==='admin')renderAdministration();}
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>activateTab(t.dataset.p));

  function renderOutputs(){
    $('olist').innerHTML='';
    outputs.forEach((o)=>{
      C.normalizeOutput(o);
      const expected = acquisitionSec ? Math.round(o.periodSeconds/acquisitionSec).toLocaleString() : '—';
      const summary = `${C.durationWithHours(o.periodSeconds)} equivalent LAeq · expected source values: ${expected}${o.mode==='fixed'?' · fixed clock blocks':o.mode==='rolling'?` · rolling every ${C.duration(o.stepSeconds)}`:` · period ${o.calendarStart}–${o.calendarEnd}`}`;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><input class="var" data-k="variableName" value="${C.esc(o.variableName)}"></td><td><input class="name" data-k="displayName" value="${C.esc(o.displayName)}"></td><td><input type="number" min="1" data-k="duration" value="${o.duration}"></td><td><select data-k="unit"><option value="s" ${o.unit==='s'?'selected':''}>Seconds</option><option value="min" ${o.unit==='min'?'selected':''}>Minutes</option><option value="h" ${o.unit==='h'?'selected':''}>Hours</option></select></td><td><select data-k="mode"><option value="fixed" ${o.mode==='fixed'?'selected':''}>Fixed</option><option value="rolling" ${o.mode==='rolling'?'selected':''}>Rolling</option><option value="calendar" ${o.mode==='calendar'?'selected':''}>Calendar</option></select></td><td>${o.mode==='rolling'?`<input type="number" min="1" data-k="step" value="${o.step}"><select data-k="stepUnit"><option value="s" ${o.stepUnit==='s'?'selected':''}>s</option><option value="min" ${o.stepUnit==='min'?'selected':''}>min</option><option value="h" ${o.stepUnit==='h'?'selected':''}>h</option></select>`:'—'}</td><td>${o.mode==='calendar'?`<input type="time" data-k="calendarStart" value="${o.calendarStart}"><input type="time" data-k="calendarEnd" value="${o.calendarEnd}" style="margin-top:4px">`:'—'}</td><td><select data-k="active"><option value="true" ${o.active?'selected':''}>Yes</option><option value="false" ${!o.active?'selected':''}>No</option></select></td><td><div class="summary">${C.esc(summary)}</div></td><td><button class="btn small danger" data-remove="${o.id}">Remove</button></td>`;
      tr.querySelectorAll('[data-k]').forEach(input=>input.oninput=()=>{let v=input.value;if(['duration','step'].includes(input.dataset.k))v=Number(v)||1;if(input.dataset.k==='active')v=v==='true';o[input.dataset.k]=v;renderOutputs();updateExecutionRecommendation();persist();});
      tr.querySelector('[data-remove]').onclick=()=>{outputs=outputs.filter(x=>x.id!==o.id);renderOutputs();updateExecutionRecommendation();persist();};
      $('olist').appendChild(tr);
    });
    $('topOutputs').value = `${outputs.filter(o=>o.active).length} active / ${outputs.length} variables`;
    $('ocount').textContent = outputs.filter(o=>o.active).length;
  }

  function updateExecutionRecommendation(){
    outputs.forEach(C.normalizeOutput);
    const rec=C.recommendedFrequency(outputs, acquisitionSec);
    $('recommended').textContent='Event-driven';
    $('fallbackRecommended').textContent=rec.seconds?`${C.duration(rec.seconds)} (${C.trim(rec.seconds/60)} min)`:'—';
    $('reason').textContent=rec.seconds
      ? `Recommended: trigger the orchestrator when a new data batch is ingested, then check completed boundaries. If event-driven execution is not selected, use a custom interval of about ${C.duration(rec.seconds)}. ${rec.reason}`
      : 'Event-driven remains recommended. Load source data and activate at least one output to calculate the custom fallback interval.';
    const warnings=[...(rec.warnings||[])];
    if($('fmode').value==='event'){
      warnings.unshift('Event-driven selected: use an ingestion event, queue or message bus and group bursts before invoking the Python Lambda. Catch-up protects against missed events and downtime.');
      $('warning').innerHTML=`<div class="ok">${warnings.map(C.esc).join('<br>')}</div>`;
    }else{
      const selected=(Number($('fcustom').value)||0)*60;
      if(rec.seconds&&selected>rec.seconds)warnings.push(`Custom interval is slower than the recommended fallback. Results may be delayed by up to ${C.duration(selected-rec.seconds)}, but catch-up will calculate all complete missing periods.`);
      if(acquisitionSec&&selected&&selected<acquisitionSec)warnings.push(`Custom interval is faster than source acquisition (${C.duration(acquisitionSec)}). Some executions will have no new value.`);
      $('warning').innerHTML=warnings.length?`<div class="warn">${warnings.map(C.esc).join('<br>')}</div>`:'<div class="ok">Custom execution interval is consistent with the active outputs.</div>';
    }
    renderAdministration();
  }

  function refreshSource(){
    if(!parsed)return;
    points=C.makePoints(parsed,$('tc').value,$('vc').value);
    acquisitionSec=C.inferAcquisition(points);
    $('selected').innerHTML=`<b>Selected variable:</b> ${C.esc(currentVariableName())} · <b>Format:</b> ${C.esc(parsed.format)} · <b>Estimated acquisition:</b> ${C.duration(acquisitionSec)} from recent timestamp gaps.`;
    $('preview').innerHTML=points.slice(0,8).map(p=>`<tr><td>${C.fmt(p.t)}</td><td>${p.v}</td></tr>`).join('');
    $('srows').textContent=parsed.rows.length;$('vrows').textContent=points.length;$('acq').textContent=C.duration(acquisitionSec);
    renderOutputs();updateExecutionRecommendation();
  }

  $('file').onchange=(e)=>{
    const f=e.target.files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=()=>{try{parsed=C.parseSource(reader.result,f.name);$('fname').textContent=f.name;$('format').value=parsed.format;const opts=parsed.columns.map(col=>`<option value="${col.index}">${C.esc(col.name)}</option>`).join('');$('tc').innerHTML=opts;$('vc').innerHTML=opts;$('tc').value=parsed.timeIndex;$('vc').value=parsed.valueIndex;refreshSource();}catch(err){$('selected').className='warn';$('selected').textContent=err.message;}};
    reader.readAsText(f,'ISO-8859-1');
  };
  $('tc').onchange=refreshSource;$('vc').onchange=refreshSource;
  $('add').onclick=()=>{outputs.push({id:'out'+Date.now(),variableName:'Noise_LAeq_custom',displayName:'LAeq custom',duration:30,unit:'min',mode:'fixed',step:30,stepUnit:'min',calendarStart:'07:00',calendarEnd:'17:00',active:true});renderOutputs();updateExecutionRecommendation();persist();};
  ['fmode','fcustom','coverage','late','catchup','schedActive','active','pname'].forEach(id=>{$(id).oninput=()=>{$('fcustom').disabled=$('fmode').value!=='custom';updateExecutionRecommendation();persist();};});

  function runProcessing(trigger='Manual'){
    if(!points.length||!acquisitionSec){$('runmsg').className='warn';$('runmsg').textContent='Load valid source data first.';return;}
    const useCatchup=$('usecatch').checked&&$('catchup').value==='yes';
    results=C.calculateAll(points,outputs,acquisitionSec,{validCoverage:Number($('coverage').value)||80,timestampConvention:parsed.timestampConvention,lastCalculatedByOutput:useCatchup?(state.lastCalculatedByOutput||{}):{}});
    $('result').innerHTML=results.map(r=>`<tr><td>${C.esc(r.variableName)}</td><td>${C.esc(r.mode)}</td><td>${C.fmt(r.timestamp)}</td><td>${C.fmt(r.start)}</td><td>${C.fmt(r.end)}</td><td><b>${r.value.toFixed(2)}</b></td><td>${r.samples}</td><td>${r.expected}</td><td>${Math.min(100,r.coverage).toFixed(1)}%</td><td><span class="pill ${r.status==='Catch-up'?'info':''}">${r.status}</span></td></tr>`).join('');
    $('rcount').textContent=results.length;$('status').textContent=results.length?'Success':'Up to date';$('download').disabled=!results.length;$('runmsg').className=results.length?'ok':'info';$('runmsg').textContent=results.length?`${results.length} result(s) generated across ${new Set(results.map(r=>r.outputId)).size} output(s).`:'No missing complete period was found.';
    state.lastCalculatedByOutput||={};
    for(const o of outputs){const z=results.filter(r=>r.outputId===o.id);if(z.length)state.lastCalculatedByOutput[o.id]=Math.max(...z.map(r=>r.end));}
    state.lastExecution=Date.now();state.history||=[];state.history.unshift({t:state.lastExecution,trigger,n:results.length,outputs:outputs.filter(o=>o.active).length,status:'Success'});state.history=state.history.slice(0,30);persist();renderAdministration();
  }
  $('runbtn').onclick=()=>runProcessing('Manual run');
  $('download').onclick=()=>{const header='variable,mode,timestamp,start,end,LAeq_dBA,samples,expected,coverage,type';const body=results.map(r=>[r.variableName,r.mode,C.fmt(r.timestamp),C.fmt(r.start),C.fmt(r.end),r.value.toFixed(3),r.samples,r.expected,r.coverage.toFixed(2),r.status].join(','));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[header,...body].join('\n')],{type:'text/csv'}));a.download='btm_laeq_v3_results.csv';a.click();URL.revokeObjectURL(a.href);};
  $('save').onclick=()=>{persist();activateTab('admin');};
  $('reset').onclick=()=>{if(confirm('Reset V3 mockup configuration and execution state?')){localStorage.removeItem(KEY);location.reload();}};

  function processingRows(){
    const currentExecution=currentExecutionLabel();
    return [
      {id:'current',name:$('pname').value,source:currentVariableName(),outputs:outputs.length,frequency:currentExecution,last:state.lastExecution?new Date(state.lastExecution).toLocaleString():'Never',status:$('active').value==='No'?'Inactive':state.lastExecution?'Healthy':'Never executed'},
      {id:'sample1',name:'Tarmac quarry noise',source:'CUBE / LAeq',outputs:2,frequency:'Event-driven',last:'2026-07-10 11:00',status:'Healthy'},
      {id:'sample2',name:'Night-time monitoring',source:'Micromate / Mic Leq',outputs:1,frequency:'Custom · 1 h',last:'Waiting',status:'Waiting for data'}
    ];
  }
  function currentExecutionLabel(){return $('fmode').value==='event'?'Event-driven':`Custom · ${C.duration((Number($('fcustom').value)||0)*60)}`;}
  function renderAdministration(){
    $('plist').innerHTML=processingRows().map(p=>`<tr><td><b>${C.esc(p.name)}</b></td><td>${C.esc(p.source)}</td><td>${p.outputs}</td><td>${C.esc(p.frequency)}</td><td>${C.esc(p.last)}</td><td><span class="pill ${p.status.includes('Waiting')?'wait':''}">${C.esc(p.status)}</span></td><td><button class="btn small" data-edit="${p.id}">Edit</button></td></tr>`).join('');
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>showDetails(b.dataset.edit));
  }
  function showDetails(id){
    const box=$('pdetails');box.style.display='block';
    if(id!=='current'){
      const p=processingRows().find(x=>x.id===id);
      box.innerHTML=`<div class="details-head"><div><h3>${C.esc(p.name)}</h3><div class="help">Example row only. In production, clicking Edit opens the full processing form for this selected processing.</div></div><button class="btn small" onclick="document.getElementById('pdetails').style.display='none'">Close</button></div><div class="info">This mockup keeps one editable processing, but the administration pattern is a list first, details second.</div>`;return;
    }
    const rows=outputs.map(o=>{C.normalizeOutput(o);const last=state.lastCalculatedByOutput?.[o.id];const expected=acquisitionSec?Math.round(o.periodSeconds/acquisitionSec):'—';const calc=o.mode==='calendar'?`${o.calendarStart}–${o.calendarEnd}`:`${o.mode} ${C.duration(o.periodSeconds)}${o.mode==='rolling'?`, step ${C.duration(o.stepSeconds)}`:''}`;return `<tr><td><b>${C.esc(o.variableName)}</b></td><td>${C.esc(calc)}</td><td>${expected}</td><td>${last?C.fmt(last):'Never'}</td><td><span class="pill ${o.active?'':'wait'}">${o.active?(last?'Up to date':'Waiting'):'Disabled'}</span></td></tr>`;}).join('');
    const hist=(state.history||[]).map(h=>`<tr><td>${new Date(h.t).toLocaleString()}</td><td>${C.esc(h.trigger)}</td><td>${h.n}</td><td>${h.outputs}</td><td><span class="pill">${h.status}</span></td></tr>`).join('')||'<tr><td colspan="5">No execution yet.</td></tr>';
    const rec=C.recommendedFrequency(outputs,acquisitionSec).seconds;
    box.innerHTML=`<div class="details-head"><div><h3>Edit — ${C.esc($('pname').value)}</h3><div class="help">Full configuration appears only after Edit: generated variables, execution mode, catch-up state and history.</div></div><div><button id="editOutputs" class="btn small">Edit outputs</button> <button id="manualFromAdmin" class="btn small yellow">Manual run</button> <button id="clearState" class="btn small danger">Reset state</button></div></div><div class="stats"><div class="stat"><span>Source</span><b>${C.esc(currentVariableName())}</b></div><div class="stat"><span>Execution</span><b>${C.esc(currentExecutionLabel())}</b></div><div class="stat"><span>Custom fallback</span><b>${C.esc(C.duration(rec))}</b></div><div class="stat"><span>Last run</span><b>${state.lastExecution?new Date(state.lastExecution).toLocaleString():'Never'}</b></div><div class="stat"><span>Status</span><b>${$('active').value==='No'?'Inactive':state.lastExecution?'Healthy':'Never executed'}</b></div></div><h3 class="section-title">Generated variables</h3><div class="tw"><table><thead><tr><th>Variable</th><th>Calculation</th><th>Expected values</th><th>Last calculated end</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><h3 class="section-title">Execution history</h3><div class="tw"><table><thead><tr><th>Time</th><th>Trigger</th><th>Results</th><th>Outputs checked</th><th>Status</th></tr></thead><tbody>${hist}</tbody></table></div>`;
    $('editOutputs').onclick=()=>activateTab('outputs');$('manualFromAdmin').onclick=()=>activateTab('run');$('clearState').onclick=()=>{state.lastCalculatedByOutput={};state.lastExecution=null;state.history=[];persist();showDetails('current');};
  }

  renderOutputs();updateExecutionRecommendation();renderAdministration();
})();
