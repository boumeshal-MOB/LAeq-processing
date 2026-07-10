(function(){
  'use strict';

  const C=window.BTMCore;
  const $=(id)=>document.getElementById(id);
  const KEY='btm-laeq-v3-admin-v3';

  let state=loadState();
  let parsed=null;
  let points=[];
  let acquisitionSec=null;
  let results=[];

  let outputs=state.outputs||[
    {id:'15m',variableName:'Noise_LAeq_15min',displayName:'LAeq 15 min',duration:15,unit:'min',mode:'fixed',step:15,stepUnit:'min',calendarStart:'00:00',calendarEnd:'00:15',active:true},
    {id:'1h',variableName:'Noise_LAeq_1h',displayName:'LAeq 1 h',duration:1,unit:'h',mode:'fixed',step:1,stepUnit:'h',calendarStart:'00:00',calendarEnd:'01:00',active:true},
    {id:'10h',variableName:'Noise_LAeq_10h',displayName:'LAeq 10 h',duration:10,unit:'h',mode:'calendar',step:1,stepUnit:'h',calendarStart:'07:00',calendarEnd:'17:00',active:true}
  ];

  $('pname').value=state.processingName||$('pname').value;
  $('active').value=state.active||'Yes';
  $('coverage').value=state.coverage??80;
  $('catchup').value=state.catchup||'yes';
  $('recalcLate').value=state.recalcLate||'no';
  $('late').value=state.lateTolerance??0;
  $('fcustom').value=state.customFrequency??'';
  $('fcustomUnit').value=state.customFrequencyUnit||'min';

  const initialMode=state.executionMode==='custom'?'custom':'event';
  $('execEvent').checked=initialMode==='event';
  $('execCustom').checked=initialMode==='custom';

  function loadState(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}');}
    catch{return {};}
  }

  function executionMode(){return $('execCustom').checked?'custom':'event';}

  function customRunSeconds(){
    const value=Number($('fcustom').value);
    if(!Number.isFinite(value)||value<=0)return null;
    return C.seconds(value,$('fcustomUnit').value);
  }

  function persist(){
    state.processingName=$('pname').value.trim();
    state.active=$('active').value;
    state.executionMode=executionMode();
    state.customFrequency=$('fcustom').value===''?null:Number($('fcustom').value);
    state.customFrequencyUnit=$('fcustomUnit').value;
    state.coverage=Number($('coverage').value)||0;
    state.catchup=$('catchup').value;
    state.recalcLate=$('recalcLate').value;
    state.lateTolerance=Number($('late').value)||0;
    state.outputs=outputs;
    localStorage.setItem(KEY,JSON.stringify(state));
  }

  function currentVariableName(){
    return parsed?$('vc').options[$('vc').selectedIndex]?.textContent||'—':'—';
  }

  function activateTab(id){
    document.querySelectorAll('.tab,.panel').forEach(el=>el.classList.remove('on'));
    document.querySelector(`.tab[data-p="${id}"]`)?.classList.add('on');
    $(id)?.classList.add('on');
    if(id==='admin')renderAdministration();
  }

  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>activateTab(tab.dataset.p)));

  function renderOutputs(){
    $('olist').innerHTML='';

    for(const output of outputs){
      C.normalizeOutput(output);
      const expected=acquisitionSec?Math.round(output.periodSeconds/acquisitionSec).toLocaleString():'—';
      const outputLabel=output.mode==='rolling'
        ?`every ${C.duration(output.stepSeconds)}`
        :output.mode==='fixed'
          ?`every ${C.duration(output.periodSeconds)}`
          :`${output.calendarStart}–${output.calendarEnd}`;
      const summary=`${C.duration(output.periodSeconds)} ${output.mode} · output ${outputLabel} · ${expected} source value${expected==='1'?'':'s'}`;

      const row=document.createElement('tr');
      row.innerHTML=`
        <td><input class="var" data-k="variableName" value="${C.esc(output.variableName)}"></td>
        <td><input class="name" data-k="displayName" value="${C.esc(output.displayName)}"></td>
        <td><div class="window-fields"><input type="number" min="1" data-k="duration" value="${output.duration}"><select data-k="unit"><option value="s" ${output.unit==='s'?'selected':''}>Seconds</option><option value="min" ${output.unit==='min'?'selected':''}>Minutes</option><option value="h" ${output.unit==='h'?'selected':''}>Hours</option></select></div></td>
        <td><select data-k="mode"><option value="fixed" ${output.mode==='fixed'?'selected':''}>Fixed</option><option value="rolling" ${output.mode==='rolling'?'selected':''}>Rolling</option><option value="calendar" ${output.mode==='calendar'?'selected':''}>Calendar</option></select></td>
        <td>${output.mode==='rolling'
          ?`<div class="output-fields"><input type="number" min="1" data-k="step" value="${output.step}"><select data-k="stepUnit"><option value="s" ${output.stepUnit==='s'?'selected':''}>Seconds</option><option value="min" ${output.stepUnit==='min'?'selected':''}>Minutes</option><option value="h" ${output.stepUnit==='h'?'selected':''}>Hours</option></select></div>`
          :`<span class="cell-note">${output.mode==='fixed'?C.duration(output.periodSeconds):'One per period'}</span>`}</td>
        <td>${output.mode==='calendar'
          ?`<div class="calendar-range"><input type="time" data-k="calendarStart" value="${output.calendarStart}"><span>→</span><input type="time" data-k="calendarEnd" value="${output.calendarEnd}"></div>`
          :'—'}</td>
        <td><select data-k="active"><option value="true" ${output.active?'selected':''}>Yes</option><option value="false" ${!output.active?'selected':''}>No</option></select></td>
        <td><div class="summary">${C.esc(summary)}</div></td>
        <td><button class="btn small danger" data-remove="${output.id}">Remove</button></td>`;

      row.querySelectorAll('[data-k]').forEach(input=>{
        input.addEventListener('change',()=>{
          let value=input.value;
          if(['duration','step'].includes(input.dataset.k))value=Number(value)||1;
          if(input.dataset.k==='active')value=value==='true';
          output[input.dataset.k]=value;
          renderOutputs();
          updateExecutionUI();
          persist();
        });
      });

      row.querySelector('[data-remove]').addEventListener('click',()=>{
        outputs=outputs.filter(item=>item.id!==output.id);
        renderOutputs();
        updateExecutionUI();
        persist();
      });

      $('olist').appendChild(row);
    }

    const activeCount=outputs.filter(output=>output.active).length;
    $('topOutputs').value=`${activeCount} active / ${outputs.length} variables`;
    $('ocount').textContent=activeCount;
    $('conceptAcq').textContent=acquisitionSec
      ?`Detected source interval: one value every ${C.duration(acquisitionSec)}.`
      :'How often one input value is stored. It is estimated after source selection.';
  }

  function executionPlan(){
    const recommendation=C.recommendedExecution(outputs,acquisitionSec);
    const selectedSeconds=executionMode()==='event'?recommendation.batchSeconds:customRunSeconds();
    return {recommendation,selectedSeconds};
  }

  function latestCompleteBoundary(batchSeconds){
    if(!points.length||!acquisitionSec||!batchSeconds)return null;
    const available=C.availableThrough(points,acquisitionSec);
    return Math.floor(available/(batchSeconds*1000))*batchSeconds*1000;
  }

  function updateExecutionUI(){
    outputs.forEach(C.normalizeOutput);
    const mode=executionMode();
    const {recommendation,selectedSeconds}=executionPlan();

    $('eventChoice').classList.toggle('selected',mode==='event');
    $('customChoice').classList.toggle('selected',mode==='custom');
    $('customPanel').hidden=mode!=='custom';
    $('latePanel').hidden=$('recalcLate').value!=='yes';

    $('recommendedBatch').textContent=recommendation.batchSeconds?C.duration(recommendation.batchSeconds):'—';

    const activeOutputs=outputs.filter(output=>output.active);
    const possibleResults=recommendation.batchSeconds
      ?activeOutputs.reduce((sum,output)=>sum+C.outputsPerRun(output,recommendation.batchSeconds),0)
      :0;
    const sourceLabel=acquisitionSec?C.duration(acquisitionSec):'not detected';

    if(mode==='event'){
      $('executionSummary').innerHTML=`
        <div><span>Source acquisition</span><b>${C.esc(sourceLabel)}</b></div>
        <div><span>Calculation check</span><b>Every ${C.esc(C.duration(recommendation.batchSeconds))}</b></div>
        <div><span>Possible outputs per run</span><b>Up to ${possibleResults}</b></div>
        <p>New data does not start Python immediately. BTM waits for a complete boundary, then calculates all missing results in one run.</p>`;
    }else if(selectedSeconds){
      const launches=Math.ceil(86400/selectedSeconds);
      $('executionSummary').innerHTML=`
        <div><span>Source acquisition</span><b>${C.esc(sourceLabel)}</b></div>
        <div><span>Custom run</span><b>Every ${C.esc(C.duration(selectedSeconds))}</b></div>
        <div><span>Estimated launches</span><b>About ${launches.toLocaleString()}/day</b></div>
        <p>Each run checks the database. If no complete new period is available, it is skipped without changing outputs.</p>`;
    }else{
      $('executionSummary').innerHTML=`
        <div><span>Source acquisition</span><b>${C.esc(sourceLabel)}</b></div>
        <div><span>Recommended batch</span><b>${C.esc(C.duration(recommendation.batchSeconds))}</b></div>
        <div><span>Custom schedule</span><b>Not configured</b></div>
        <p>Enter the interval above. BTM will still skip runs when no complete new period is available.</p>`;
    }

    const warnings=[...(recommendation.warnings||[])];
    if(mode==='custom'){
      if(!selectedSeconds){
        warnings.unshift('Enter a custom run interval. No value is automatically proposed.');
      }else{
        if(recommendation.batchSeconds&&selectedSeconds<recommendation.batchSeconds){
          const ratio=Math.ceil(recommendation.batchSeconds/selectedSeconds);
          warnings.push(`This custom interval may launch the calculation about ${ratio} times more often than the recommended ${C.duration(recommendation.batchSeconds)} batch.`);
        }
        if(recommendation.batchSeconds&&selectedSeconds>recommendation.batchSeconds){
          warnings.push(`Results may be delayed by up to ${C.duration(selectedSeconds-recommendation.batchSeconds)}. Catch-up will still create complete missing periods.`);
        }
        if(acquisitionSec&&selectedSeconds<acquisitionSec){
          warnings.push(`The custom interval is faster than source acquisition (${C.duration(acquisitionSec)}), so many runs may be skipped.`);
        }
      }
    }

    if(warnings.length){
      $('warning').innerHTML=`<div class="warn">${warnings.map(C.esc).join('<br>')}</div>`;
    }else{
      $('warning').innerHTML=mode==='event'
        ?'<div class="ok">Recommended setup: calculations are batched and only complete periods are processed.</div>'
        :'<div class="ok">The custom schedule is valid.</div>';
    }

    if(points.length&&acquisitionSec){
      const lastMeasurement=points.at(-1).t;
      const available=C.availableThrough(points,acquisitionSec);
      const boundary=latestCompleteBoundary(recommendation.batchSeconds);
      $('readiness').innerHTML=`<b>Database timestamps:</b> latest measurement ${C.fmt(lastMeasurement)} · estimated available through ${C.fmt(available)}${boundary?` · latest complete recommended boundary ${C.fmt(boundary)}`:''}. These are measurement timestamps, not arrival timestamps.`;
    }else{
      $('readiness').textContent='Load source data to inspect the latest available measurement timestamp.';
    }

    renderAdministration();
  }

  function refreshSource(){
    if(!parsed)return;
    points=C.makePoints(parsed,$('tc').value,$('vc').value);
    acquisitionSec=C.inferAcquisition(points);
    $('selected').className='info';
    $('selected').innerHTML=`<b>Selected variable:</b> ${C.esc(currentVariableName())} · <b>Format:</b> ${C.esc(parsed.format)} · <b>Estimated acquisition:</b> ${C.duration(acquisitionSec)} from recent timestamp gaps.`;
    $('preview').innerHTML=points.slice(0,8).map(point=>`<tr><td>${C.fmt(point.t)}</td><td>${point.v}</td></tr>`).join('');
    $('srows').textContent=parsed.rows.length;
    $('vrows').textContent=points.length;
    $('acq').textContent=C.duration(acquisitionSec);
    renderOutputs();
    updateExecutionUI();
  }

  $('file').addEventListener('change',event=>{
    const selectedFile=event.target.files[0];
    if(!selectedFile)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        parsed=C.parseSource(reader.result,selectedFile.name);
        $('fname').textContent=selectedFile.name;
        $('format').value=parsed.format;
        const options=parsed.columns.map(column=>`<option value="${column.index}">${C.esc(column.name)}</option>`).join('');
        $('tc').innerHTML=options;
        $('vc').innerHTML=options;
        $('tc').value=parsed.timeIndex;
        $('vc').value=parsed.valueIndex;
        refreshSource();
      }catch(error){
        $('selected').className='warn';
        $('selected').textContent=error.message;
      }
    };
    reader.readAsText(selectedFile,'ISO-8859-1');
  });

  $('tc').addEventListener('change',refreshSource);
  $('vc').addEventListener('change',refreshSource);

  $('add').addEventListener('click',()=>{
    outputs.push({id:`out${Date.now()}`,variableName:'Noise_LAeq_custom',displayName:'LAeq custom',duration:30,unit:'min',mode:'fixed',step:30,stepUnit:'min',calendarStart:'07:00',calendarEnd:'17:00',active:true});
    renderOutputs();
    updateExecutionUI();
    persist();
  });

  ['execEvent','execCustom','fcustom','fcustomUnit','coverage','catchup','recalcLate','late','active','pname'].forEach(id=>{
    $(id).addEventListener(id==='pname'||id==='fcustom'?'input':'change',()=>{
      updateExecutionUI();
      persist();
    });
  });

  function runProcessing(trigger='Manual run'){
    if(!points.length||!acquisitionSec){
      $('runmsg').className='warn';
      $('runmsg').textContent='Load valid source data first.';
      return;
    }

    const useCatchup=$('usecatch').checked&&$('catchup').value==='yes';
    results=C.calculateAll(points,outputs,acquisitionSec,{
      validCoverage:Number($('coverage').value)||0,
      timestampConvention:parsed.timestampConvention,
      lastCalculatedByOutput:useCatchup?(state.lastCalculatedByOutput||{}):{}
    });

    $('result').innerHTML=results.map(result=>`<tr><td>${C.esc(result.variableName)}</td><td>${C.esc(result.mode)}</td><td>${C.fmt(result.timestamp)}</td><td>${C.fmt(result.start)}</td><td>${C.fmt(result.end)}</td><td><b>${result.value.toFixed(2)}</b></td><td>${result.samples}</td><td>${result.expected}</td><td>${Math.min(100,result.coverage).toFixed(1)}%</td><td><span class="pill ${result.status==='Catch-up'?'info':''}">${result.status}</span></td></tr>`).join('');

    const skipped=results.length===0;
    $('rcount').textContent=results.length;
    $('status').textContent=skipped?'Skipped':'Success';
    $('download').disabled=skipped;
    $('runmsg').className=skipped?'info':'ok';
    $('runmsg').textContent=skipped
      ?'Skipped — No new complete period available or no new source data available.'
      :`${results.length} result(s) generated across ${new Set(results.map(result=>result.outputId)).size} output(s).`;

    state.lastCalculatedByOutput||={};
    for(const output of outputs){
      const outputResults=results.filter(result=>result.outputId===output.id);
      if(outputResults.length)state.lastCalculatedByOutput[output.id]=Math.max(...outputResults.map(result=>result.end));
    }

    state.lastExecution=Date.now();
    state.lastStatus=skipped?'Skipped':'Success';
    state.history||=[];
    state.history.unshift({
      t:state.lastExecution,
      trigger,
      n:results.length,
      outputs:outputs.filter(output=>output.active).length,
      status:state.lastStatus,
      comment:skipped?'No new complete period available':'Calculation completed'
    });
    state.history=state.history.slice(0,30);
    persist();
    renderAdministration();
  }

  $('runbtn').addEventListener('click',()=>runProcessing());

  $('download').addEventListener('click',()=>{
    const header='variable,mode,timestamp,start,end,LAeq_dBA,samples,expected,coverage,type';
    const body=results.map(result=>[result.variableName,result.mode,C.fmt(result.timestamp),C.fmt(result.start),C.fmt(result.end),result.value.toFixed(3),result.samples,result.expected,result.coverage.toFixed(2),result.status].join(','));
    const link=document.createElement('a');
    link.href=URL.createObjectURL(new Blob([[header,...body].join('\n')],{type:'text/csv'}));
    link.download='btm_laeq_v3_results.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  function currentExecutionLabel(){
    const recommendation=C.recommendedExecution(outputs,acquisitionSec);
    if(executionMode()==='event')return `Smart event-driven · ${C.duration(recommendation.batchSeconds)} batch`;
    const custom=customRunSeconds();
    return custom?`Custom · every ${C.duration(custom)}`:'Custom · not configured';
  }

  function processingRows(){
    return [
      {id:'current',name:$('pname').value||'Untitled processing',source:currentVariableName(),outputs:outputs.length,execution:currentExecutionLabel(),last:state.lastExecution?new Date(state.lastExecution).toLocaleString():'Never',status:$('active').value==='No'?'Inactive':state.lastStatus||'Never executed'},
      {id:'sample1',name:'Tarmac quarry noise',source:'CUBE / LAeq',outputs:2,execution:'Smart event-driven · 15 min batch',last:'2026-07-10 11:00',status:'Healthy'},
      {id:'sample2',name:'Night-time monitoring',source:'Micromate / Mic Leq',outputs:1,execution:'Custom · every 1 h',last:'Waiting',status:'Waiting for data'}
    ];
  }

  function renderAdministration(){
    if(!$('plist'))return;
    $('plist').innerHTML=processingRows().map(processing=>`<tr><td><b>${C.esc(processing.name)}</b></td><td>${C.esc(processing.source)}</td><td>${processing.outputs}</td><td>${C.esc(processing.execution)}</td><td>${C.esc(processing.last)}</td><td><span class="pill ${/Waiting|Skipped|Never/.test(processing.status)?'wait':''}">${C.esc(processing.status)}</span></td><td><button class="btn small" data-edit="${processing.id}">Edit</button></td></tr>`).join('');
    document.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>showDetails(button.dataset.edit)));
  }

  function showDetails(id){
    const box=$('pdetails');
    box.hidden=false;

    if(id!=='current'){
      const processing=processingRows().find(item=>item.id===id);
      box.innerHTML=`<div class="details-head"><div><h3>${C.esc(processing.name)}</h3><div class="help">Example processing. In production, Edit opens its full source, outputs and execution configuration.</div></div><button class="btn small" id="closeDetails">Close</button></div>`;
      $('closeDetails').addEventListener('click',()=>{box.hidden=true;});
      return;
    }

    const outputRows=outputs.map(output=>{
      C.normalizeOutput(output);
      const last=state.lastCalculatedByOutput?.[output.id];
      const expected=acquisitionSec?Math.round(output.periodSeconds/acquisitionSec):'—';
      const calculation=output.mode==='calendar'
        ?`${output.calendarStart}–${output.calendarEnd}`
        :`${output.mode} ${C.duration(output.periodSeconds)} · output ${output.mode==='rolling'?C.duration(output.stepSeconds):C.duration(output.outputIntervalSeconds)}`;
      return `<tr><td><b>${C.esc(output.variableName)}</b></td><td>${C.esc(calculation)}</td><td>${expected}</td><td>${last?C.fmt(last):'Never'}</td><td><span class="pill ${output.active?'':'wait'}">${output.active?(last?'Up to date':'Waiting'):'Disabled'}</span></td></tr>`;
    }).join('');

    const historyRows=(state.history||[]).map(item=>`<tr><td>${new Date(item.t).toLocaleString()}</td><td>${C.esc(item.trigger)}</td><td>${item.n}</td><td>${item.outputs}</td><td><span class="pill ${item.status==='Skipped'?'wait':''}">${C.esc(item.status)}</span></td><td>${C.esc(item.comment||'—')}</td></tr>`).join('')||'<tr><td colspan="6">No execution yet.</td></tr>';
    const recommendation=C.recommendedExecution(outputs,acquisitionSec);

    box.innerHTML=`
      <div class="details-head"><div><h3>Edit — ${C.esc($('pname').value)}</h3><div class="help">All processing details are displayed after Edit.</div></div><div><button id="editOutputs" class="btn small">Edit outputs</button> <button id="manualFromAdmin" class="btn small yellow">Manual run</button> <button id="clearState" class="btn small danger">Reset state</button></div></div>
      <div class="stats admin-stats"><div class="stat"><span>Source</span><b>${C.esc(currentVariableName())}</b></div><div class="stat"><span>Acquisition</span><b>${C.duration(acquisitionSec)}</b></div><div class="stat"><span>Execution</span><b>${C.esc(currentExecutionLabel())}</b></div><div class="stat"><span>Recommended batch</span><b>${C.duration(recommendation.batchSeconds)}</b></div><div class="stat"><span>Catch-up</span><b>${$('catchup').value==='yes'?'Enabled':'Disabled'}</b></div><div class="stat"><span>Last status</span><b>${state.lastStatus||'Never executed'}</b></div></div>
      <h3 class="section-title">Generated variables</h3><div class="tw"><table><thead><tr><th>Variable</th><th>Window / output interval</th><th>Expected values</th><th>Last calculated end</th><th>Status</th></tr></thead><tbody>${outputRows}</tbody></table></div>
      <h3 class="section-title">Execution history</h3><div class="tw"><table><thead><tr><th>Time</th><th>Trigger</th><th>Results</th><th>Outputs checked</th><th>Status</th><th>Comment</th></tr></thead><tbody>${historyRows}</tbody></table></div>`;

    $('editOutputs').addEventListener('click',()=>activateTab('outputs'));
    $('manualFromAdmin').addEventListener('click',()=>activateTab('run'));
    $('clearState').addEventListener('click',()=>{
      state.lastCalculatedByOutput={};
      state.lastExecution=null;
      state.lastStatus=null;
      state.history=[];
      persist();
      showDetails('current');
    });
  }

  $('save').addEventListener('click',()=>{
    if(executionMode()==='custom'&&!customRunSeconds()){
      activateTab('quality');
      $('warning').innerHTML='<div class="warn">Enter a valid custom run interval before saving.</div>';
      $('fcustom').focus();
      return;
    }
    persist();
    activateTab('admin');
  });

  $('reset').addEventListener('click',()=>{
    if(confirm('Reset V3 mockup configuration and execution state?')){
      localStorage.removeItem(KEY);
      location.reload();
    }
  });

  renderOutputs();
  updateExecutionUI();
  renderAdministration();
})();
