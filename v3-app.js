(function(){
  const C=window.BTMCore,$=(id)=>document.getElementById(id),KEY='btm-laeq-v3-admin-v2';
  let state=loadState(),parsed=null,points=[],acquisitionSec=null,results=[];
  let outputs=state.outputs||[
    {id:'15m',variableName:'Noise_LAeq_15min',displayName:'LAeq 15 min',duration:15,unit:'min',mode:'fixed',step:15,stepUnit:'min',calendarStart:'00:00',calendarEnd:'00:15',active:true},
    {id:'1h',variableName:'Noise_LAeq_1h',displayName:'LAeq 1 h',duration:1,unit:'h',mode:'fixed',step:1,stepUnit:'h',calendarStart:'00:00',calendarEnd:'01:00',active:true},
    {id:'10h',variableName:'Noise_LAeq_10h',displayName:'LAeq 10 h',duration:10,unit:'h',mode:'calendar',step:1,stepUnit:'h',calendarStart:'07:00',calendarEnd:'17:00',active:true}
  ];

  $('pname').value=state.processingName||$('pname').value;
  $('active').value=state.active||'Yes';
  $('fmode').value=state.executionMode||state.frequencyMode||'event';
  if($('fmode').value==='auto')$('fmode').value='event';
  $('fcustom').value=state.customFrequency||15;
  $('coverage').value=state.coverage||80;
  $('late').value=state.late||60;
  $('catchup').value=state.catchup||'yes';
  $('schedActive').value=state.schedActive||'Enabled';
  $('fcustom').disabled=$('fmode').value!=='custom';

  function loadState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function persist(){
    state.processingName=$('pname').value;state.active=$('active').value;state.executionMode=$('fmode').value;state.customFrequency=Number($('fcustom').value)||15;state.coverage=Number($('coverage').value)||80;state.late=Number($('late').value)||60;state.catchup=$('catchup').value;state.schedActive=$('schedActive').value;state.outputs=outputs;
    localStorage.setItem(KEY,JSON.stringify(state));
  }
  function currentVariableName(){return parsed?$('vc').options[$('vc').selectedIndex]?.textContent||'—':'—';}
  function activateTab(id){document.querySelectorAll('.tab,.panel').forEach(el=>el.classList.remove('on'));document.querySelector(`.tab[data-p="${id}"]`)?.classList.add('on');$(id)?.classList.add('on');if(id==='admin')renderAdministration();}
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>activateTab(t.dataset.p));

  function renderOutputs(){
    $('olist').innerHTML='';
    for(const o of outputs){
      C.normalizeOutput(o);
      const expected=acquisitionSec?Math.round(o.periodSeconds/acquisitionSec).toLocaleString():'—';
      const outputEvery=o.mode==='rolling'?C.duration(o.stepSeconds):o.mode==='fixed'?C.duration(o.periodSeconds):'one per calendar period';
      const summary=`Window ${C.durationWithHours(o.periodSeconds)} · result ${o.mode==='rolling'?'every '+C.duration(o.stepSeconds):o.mode==='fixed'?'every '+C.duration(o.periodSeconds):'for '+o.calendarStart+'–'+o.calendarEnd} · expected source values ${expected}`;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><input class="var" data-k="variableName" value="${C.esc(o.variableName)}"></td><td><input class="name" data-k="displayName" value="${C.esc(o.displayName)}"></td><td><div class="window"><input type="number" min="1" data-k="duration" value="${o.duration}"><select data-k="unit"><option value="s" ${o.unit==='s'?'selected':''}>Seconds</option><option value="min" ${o.unit==='min'?'selected':''}>Minutes</option><option value="h" ${o.unit==='h'?'selected':''}>Hours</option></select></div></td><td><select data-k="mode"><option value="fixed" ${o.mode==='fixed'?'selected':''}>Fixed</option><option value="rolling" ${o.mode==='rolling'?'selected':''}>Rolling</option><option value="calendar" ${o.mode==='calendar'?'selected':''}>Calendar</option></select></td><td>${o.mode==='rolling'?`<div class="output-every"><input type="number" min="1" data-k="step" value="${o.step}"><select data-k="stepUnit"><option value="s" ${o.stepUnit==='s'?'selected':''}>Seconds</option><option value="min" ${o.stepUnit==='min'?'selected':''}>Minutes</option><option value="h" ${o.stepUnit==='h'?'selected':''}>Hours</option></select></div>`:`<span class="help">${C.esc(outputEvery)}</span>`}</td><td>${o.mode==='calendar'?`<input type="time" data-k="calendarStart" value="${o.calendarStart}"><input type="time" data-k="calendarEnd" value="${o.calendarEnd}" style="margin-top:4px">`:'—'}</td><td><select data-k="active"><option value="true" ${o.active?'selected':''}>Yes</option><option value="false" ${!o.active?'selected':''}>No</option></select></td><td><div class="summary">${C.esc(summary)}</div></td><td><button class="btn small danger" data-remove="${o.id}">Remove</button></td>`;
      tr.querySelectorAll('[data-k]').forEach(input=>input.oninput=()=>{let v=input.value;if(['duration','step'].includes(input.dataset.k))v=Number(v)||1;if(input.dataset.k==='active')v=v==='true';o[input.dataset.k]=v;renderOutputs();updateExecutionRecommendation();persist();});
      tr.querySelector('[data-remove]').onclick=()=>{outputs=outputs.filter(x=>x.id!==o.id);renderOutputs();updateExecutionRecommendation();persist();};
      $('olist').appendChild(tr);
    }
    $('topOutputs').value=`${outputs.filter(o=>o.active).length} active / ${outputs.length} variables`;
    $('ocount').textContent=outputs.filter(o=>o.active).length;
    $('conceptAcq').textContent=acquisitionSec?`Detected source interval: ${C.duration(acquisitionSec)} between values.`:'How often an input value arrives. It is estimated after source selection.';
  }

  function executionPlan(){
    const rec=C.recommendedExecution(outputs,acquisitionSec);
    const selected=$('fmode').value==='event'?rec.batchSeconds:(Number($('fcustom').value)||0)*60;
    return {rec,selected};
  }

  function updateExecutionRecommendation(){
    outputs.forEach(C.normalizeOutput);
    const {rec,selected}=executionPlan();
    $('recommendedBatch').textContent=rec.batchSeconds?`${C.duration(rec.batchSeconds)} batch`:'—';
    $('reason').textContent=rec.reason||'Activate at least one output.';
    const launches=selected?Math.ceil(86400/selected):0;
    $('launchEstimate').textContent=selected?`Selected behaviour: about ${launches.toLocaleString()} calculation run(s) per day per processing. Data-arrival events may be more frequent, but they are only used to update the queue/watermark.`:'No calculation interval available.';

    const active=outputs.filter(o=>o.active).map(o=>C.normalizeOutput(o));
    const lines=active.map(o=>{
      const count=C.outputsPerRun(o,selected||rec.batchSeconds);
      const resultEvery=o.mode==='rolling'?C.duration(o.stepSeconds):o.mode==='fixed'?C.duration(o.periodSeconds):'calendar period';
      return `<li><b>${C.esc(o.displayName)}</b>: ${C.esc(C.duration(o.periodSeconds))} window, result every ${C.esc(resultEvery)}; one recommended batch can create up to <b>${count}</b> result(s).</li>`;
    }).join('');
    $('schedulerScenario').innerHTML=`<b>How the selected configuration behaves</b><ul>${lines||'<li>No active output.</li>'}</ul>${acquisitionSec?`Source values arrive approximately every <b>${C.duration(acquisitionSec)}</b>.`:''}`;

    const warnings=[...(rec.warnings||[])];
    if($('fmode').value==='event'){
      warnings.unshift(`Event-driven batching is selected. A source event may arrive every ${C.duration(acquisitionSec)||'acquisition interval'}, but it does not directly start the Python calculation. Node waits for the ${C.duration(rec.batchSeconds)} batch boundary and a sufficient data watermark.`);
      $('warning').innerHTML=`<div class="ok">${warnings.map(C.esc).join('<br>')}</div>`;
    }else{
      if(rec.batchSeconds&&selected<rec.batchSeconds)warnings.push(`Custom execution every ${C.duration(selected)} is allowed for lower latency, but it creates about ${Math.ceil(rec.batchSeconds/selected)} times more calculation launches than the recommended ${C.duration(rec.batchSeconds)} batch.`);
      if(rec.batchSeconds&&selected>rec.batchSeconds)warnings.push(`Custom execution is slower than recommended. Results may be delayed by up to ${C.duration(selected-rec.batchSeconds)}, while catch-up will still create all complete missing outputs.`);
      if(acquisitionSec&&selected<acquisitionSec)warnings.push(`Custom execution is faster than source acquisition (${C.duration(acquisitionSec)}). Some runs will have no new value.`);
      $('warning').innerHTML=warnings.length?`<div class="warn">${warnings.map(C.esc).join('<br>')}</div>`:'<div class="ok">Custom execution interval is consistent with the active outputs.</div>';
    }

    if(points.length&&acquisitionSec){
      const last=points.at(-1).t,available=C.availableThrough(points,acquisitionSec),complete=rec.batchSeconds?Math.floor(available/(rec.batchSeconds*1000))*rec.batchSeconds*1000:null;
      $('readiness').innerHTML=`<b>Data readiness:</b> latest timestamp ${C.fmt(last)} · estimated data available through ${C.fmt(available)}${complete?` · latest complete recommended batch boundary ${C.fmt(complete)}`:''}. Only output windows ending at or before the data watermark are eligible.`;
    }else $('readiness').textContent='Load source data to see the latest available data watermark.';
    renderAdministration();
  }

  function refreshSource(){
    if(!parsed)return;
    points=C.makePoints(parsed,$('tc').value,$('vc').value);acquisitionSec=C.inferAcquisition(points);
    $('selected').innerHTML=`<b>Selected variable:</b> ${C.esc(currentVariableName())} · <b>Format:</b> ${C.esc(parsed.format)} · <b>Estimated source acquisition:</b> ${C.duration(acquisitionSec)} from recent timestamp gaps.`;
    $('preview').innerHTML=points.slice(0,8).map(p=>`<tr><td>${C.fmt(p.t)}</td><td>${p.v}</td></tr>`).join('');
    $('srows').textContent=parsed.rows.length;$('vrows').textContent=points.length;$('acq').textContent=C.duration(acquisitionSec);renderOutputs();updateExecutionRecommendation();
  }

  $('file').onchange=(e)=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{parsed=C.parseSource(reader.result,f.name);$('fname').textContent=f.name;$('format').value=parsed.format;const opts=parsed.columns.map(col=>`<option value="${col.index}">${C.esc(col.name)}</option>`).join('');$('tc').innerHTML=opts;$('vc').innerHTML=opts;$('tc').value=parsed.timeIndex;$('vc').value=parsed.valueIndex;refreshSource();}catch(err){$('selected').className='warn';$('selected').textContent=err.message;}};reader.readAsText(f,'ISO-8859-1');};
  $('tc').onchange=refreshSource;$('vc').onchange=refreshSource;
  $('add').onclick=()=>{outputs.push({id:'out'+Date.now(),variableName:'Noise_LAeq_custom',displayName:'LAeq custom',duration:30,unit:'min',mode:'fixed',step:30,stepUnit:'min',calendarStart:'07:00',calendarEnd:'17:00',active:true});renderOutputs();updateExecutionRecommendation();persist();};
  ['fmode','fcustom','coverage','late','catchup','schedActive','active','pname'].forEach(id=>{$(id).oninput=()=>{$('fcustom').disabled=$('fmode').value!=='custom';updateExecutionRecommendation();persist();};});

  function runProcessing(trigger='Manual'){
    if(!points.length||!acquisitionSec){$('runmsg').className='warn';$('runmsg').textContent='Load valid source data first.';return;}
    const useCatchup=$('usecatch').checked&&$('catchup').value==='yes';
    results=C.calculateAll(points,outputs,acquisitionSec,{validCoverage:Number($('coverage').value)||80,timestampConvention:parsed.timestampConvention,lastCalculatedByOutput:useCatchup?(state.lastCalculatedByOutput||{}):{}});
    $('result').innerHTML=results.map(r=>`<tr><td>${C.esc(r.variableName)}</td><td>${C.esc(r.mode)}</td><td>${C.fmt(r.timestamp)}</td><td>${C.fmt(r.start)}</td><td>${C.fmt(r.end)}</td><td><b>${r.value.toFixed(2)}</b></td><td>${r.samples}</td><td>${r.expected}</td><td>${Math.min(100,r.coverage).toFixed(1)}%</td><td><span class="pill ${r.status==='Catch-up'?'info':''}">${r.status}</span></td></tr>`).join('');
    $('rcount').textContent=results.length;$('status').textContent=results.length?'Success':'Up to date';$('download').disabled=!results.length;$('runmsg').className=results.length?'ok':'info';$('runmsg').textContent=results.length?`${results.length} result(s) generated across ${new Set(results.map(r=>r.outputId)).size} output(s).`:'No missing complete period was found.';
    state.lastCalculatedByOutput||={};for(const o of outputs){const z=results.filter(r=>r.outputId===o.id);if(z.length)state.lastCalculatedByOutput[o.id]=Math.max(...z.map(r=>r.end));}
    state.lastExecution=Date.now();state.history||=[];state.history.unshift({t:state.lastExecution,trigger,n:results.length,outputs:outputs.filter(o=>o.active).length,status:'Success'});state.history=state.history.slice(0,30);persist();renderAdministration();
  }
  $('runbtn').onclick=()=>runProcessing('Manual run');
  $('download').onclick=()=>{const header='variable,mode,timestamp,start,end,LAeq_dBA,samples,expected,coverage,type',body=results.map(r=>[r.variableName,r.mode,C.fmt(r.timestamp),C.fmt(r.start),C.fmt(r.end),r.value.toFixed(3),r.samples,r.expected,r.coverage.toFixed(2),r.status].join(',')),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[header,...body].join('\n')],{type:'text/csv'}));a.download='btm_laeq_v3_results.csv';a.click();URL.revokeObjectURL(a.href);};
  $('save').onclick=()=>{persist();activateTab('admin');};
  $('reset').onclick=()=>{if(confirm('Reset V3 mockup configuration and execution state?')){localStorage.removeItem(KEY);location.reload();}};

  function currentExecutionLabel(){const {rec}=executionPlan();return $('fmode').value==='event'?`Event-driven · batch ${C.duration(rec.batchSeconds)}`:`Custom · every ${C.duration((Number($('fcustom').value)||0)*60)}`;}
  function processingRows(){return[
    {id:'current',name:$('pname').value,source:currentVariableName(),outputs:outputs.length,execution:currentExecutionLabel(),last:state.lastExecution?new Date(state.lastExecution).toLocaleString():'Never',status:$('active').value==='No'?'Inactive':state.lastExecution?'Healthy':'Never executed'},
    {id:'sample1',name:'Tarmac quarry noise',source:'CUBE / LAeq',outputs:2,execution:'Event-driven · batch 15 min',last:'2026-07-10 11:00',status:'Healthy'},
    {id:'sample2',name:'Night-time monitoring',source:'Micromate / Mic Leq',outputs:1,execution:'Custom · every 1 h',last:'Waiting',status:'Waiting for data'}
  ];}
  function renderAdministration(){$('plist').innerHTML=processingRows().map(p=>`<tr><td><b>${C.esc(p.name)}</b></td><td>${C.esc(p.source)}</td><td>${p.outputs}</td><td>${C.esc(p.execution)}</td><td>${C.esc(p.last)}</td><td><span class="pill ${p.status.includes('Waiting')?'wait':''}">${C.esc(p.status)}</span></td><td><button class="btn small" data-edit="${p.id}">Edit</button></td></tr>`).join('');document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>showDetails(b.dataset.edit));}
  function showDetails(id){
    const box=$('pdetails');box.style.display='block';
    if(id!=='current'){const p=processingRows().find(x=>x.id===id);box.innerHTML=`<div class="details-head"><div><h3>${C.esc(p.name)}</h3><div class="help">Example processing. In production, Edit opens its full source, outputs, execution and quality configuration.</div></div><button class="btn small" onclick="document.getElementById('pdetails').style.display='none'">Close</button></div>`;return;}
    const rows=outputs.map(o=>{C.normalizeOutput(o);const last=state.lastCalculatedByOutput?.[o.id],expected=acquisitionSec?Math.round(o.periodSeconds/acquisitionSec):'—',calc=o.mode==='calendar'?`${o.calendarStart}–${o.calendarEnd}`:`${o.mode} window ${C.duration(o.periodSeconds)} · output ${o.mode==='rolling'?C.duration(o.stepSeconds):C.duration(o.outputIntervalSeconds)}`;return `<tr><td><b>${C.esc(o.variableName)}</b></td><td>${C.esc(calc)}</td><td>${expected}</td><td>${last?C.fmt(last):'Never'}</td><td><span class="pill ${o.active?'':'wait'}">${o.active?(last?'Up to date':'Waiting'):'Disabled'}</span></td></tr>`;}).join('');
    const hist=(state.history||[]).map(h=>`<tr><td>${new Date(h.t).toLocaleString()}</td><td>${C.esc(h.trigger)}</td><td>${h.n}</td><td>${h.outputs}</td><td><span class="pill">${h.status}</span></td></tr>`).join('')||'<tr><td colspan="5">No execution yet.</td></tr>',rec=C.recommendedExecution(outputs,acquisitionSec);
    box.innerHTML=`<div class="details-head"><div><h3>Edit — ${C.esc($('pname').value)}</h3><div class="help">All details are shown only after Edit.</div></div><div><button id="editOutputs" class="btn small">Edit outputs</button> <button id="manualFromAdmin" class="btn small yellow">Manual run</button> <button id="clearState" class="btn small danger">Reset state</button></div></div><div class="stats"><div class="stat"><span>Source</span><b>${C.esc(currentVariableName())}</b></div><div class="stat"><span>Acquisition</span><b>${C.duration(acquisitionSec)}</b></div><div class="stat"><span>Execution</span><b>${C.esc(currentExecutionLabel())}</b></div><div class="stat"><span>Recommended batch</span><b>${C.duration(rec.batchSeconds)}</b></div><div class="stat"><span>Last run</span><b>${state.lastExecution?new Date(state.lastExecution).toLocaleString():'Never'}</b></div><div class="stat"><span>Status</span><b>${$('active').value==='No'?'Inactive':state.lastExecution?'Healthy':'Never executed'}</b></div></div><h3 class="section-title">Generated variables</h3><div class="tw"><table><thead><tr><th>Variable</th><th>Window / output interval</th><th>Expected values</th><th>Last calculated end</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><h3 class="section-title">Execution history</h3><div class="tw"><table><thead><tr><th>Time</th><th>Trigger</th><th>Results</th><th>Outputs checked</th><th>Status</th></tr></thead><tbody>${hist}</tbody></table></div>`;
    $('editOutputs').onclick=()=>activateTab('outputs');$('manualFromAdmin').onclick=()=>activateTab('run');$('clearState').onclick=()=>{state.lastCalculatedByOutput={};state.lastExecution=null;state.history=[];persist();showDetails('current');};
  }

  renderOutputs();updateExecutionRecommendation();renderAdministration();
})();
