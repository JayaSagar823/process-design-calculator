import {units,toSI,fromSI} from './units.mjs';
import {createHistory} from './history.mjs';
import {propertyLabels as labels,formatValue as resultFormat,phaseName as phaseLabel,createReport} from './report.mjs';
const $=id=>document.getElementById(id);
const keys=['P','T','Q','H','S'];
let inputPair='PT';
let selected=[],values={},draft={},unit=Object.fromEntries(Object.keys(units).map(k=>[k,0])),result=null,resultCreatedAt=null,ready=false,busy=false,seq=0,loadError=false;
const worker=new Worker(new URL('./engine/worker.mjs',import.meta.url),{type:'module'});
const fmt=n=>Number(n.toPrecision(7)).toString();
const display=(k,v)=>fromSI(v,units[k][unit[k]]);
const copyIcon='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
const historyStore=createHistory({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let toastTimer,historyEntryId=null,historyPersistent=true;
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2500);}
async function copyValue(text,label){
 try{await navigator.clipboard.writeText(text);toast(`${label} copied`);}
 catch{toast('Copy unavailable. Select the value and copy it manually.');}
}
function copyButton(kind,key,disabled=false){return `<button type="button" class="copy-value" data-copy-${kind}="${key}" aria-label="Copy ${labels[key]} ${kind} value" title="Copy value" ${disabled?'disabled':''}>${copyIcon}</button>`;}
function options(k){return units[k].map((u,i)=>`<option value="${i}" ${i===unit[k]?'selected':''}>${u.label}</option>`).join('');}
function complete(){return selected.length===2&&selected.every(k=>Number.isFinite(values[k]));}
function controls(){
 $('calculate').disabled=!ready||busy||!complete();
 $('calculate').textContent=busy?'Calculating…':'Calculate properties';
 $('input-status').textContent=loadError?'Calculator unavailable. Please reload.':!ready?'Preparing calculator…':busy?'Calculating properties…':'';
 $('input-status').hidden=!$('input-status').textContent;
}
function syncInputState(){
 selected=keys.filter(k=>(draft[k]??'').trim()!=='');
 keys.forEach(k=>{
  const filled=selected.includes(k),locked=!filled&&selected.length>=2;
  $('value-'+k).disabled=locked;
  $('inputs').querySelector(`[data-copy-input="${k}"]`).disabled=!Number.isFinite(values[k]);
  $('row-'+k).hidden=!inputPair.includes(k);
  $('row-'+k).classList.toggle('active',filled);
  $('row-'+k).classList.toggle('locked',locked);
 });
}
function renderInputs(){
 $('inputs').innerHTML='<div class="input-columns" aria-hidden="true"><span>Property</span><span>Value</span><span>Unit</span></div>'+keys.map(k=>`<div class="input-row" id="row-${k}"><label for="value-${k}">${labels[k]}</label><div class="input-value-cell"><input type="text" inputmode="decimal" autocomplete="off" aria-label="${labels[k]} value" id="value-${k}" placeholder="—">${copyButton('input',k,true)}</div><select aria-label="${labels[k]} unit" data-unit="${k}">${options(k)}</select></div>`).join('');
 keys.forEach(k=>{$('value-'+k).value=draft[k]??'';});
 syncInputState();
 keys.forEach(k=>$('value-'+k).addEventListener('input',()=>{
  const text=$('value-'+k).value;draft[k]=text;
  const n=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())?Number(text):NaN;
  values[k]=Number.isFinite(n)?toSI(n,units[k][unit[k]]):undefined;
  syncInputState();invalidate();
 }));
 $('inputs').querySelectorAll('[data-copy-input]').forEach(button=>button.onclick=()=>{const k=button.dataset.copyInput;copyValue(draft[k],`${labels[k]} input`);});
 bindUnits($('inputs'));
}
function bindUnits(parent){parent.querySelectorAll('[data-unit]').forEach(el=>el.addEventListener('change',()=>{const k=el.dataset.unit;unit[k]=Number(el.value);keys.forEach(key=>{if(Number.isFinite(values[key]))draft[key]=fmt(display(key,values[key]));});renderInputs();renderResult();controls();}));}
function invalidate(){++seq;busy=false;result=null;$('message').textContent='';renderResult();controls();}
function calculate(){
 if(!ready||busy||!complete())return;
 const id=++seq;busy=true;result=null;$('message').textContent='';renderResult();controls();
 worker.postMessage({id,inputs:Object.fromEntries(selected.map(k=>[k,values[k]]))});
}
function fail(message){busy=false;result=null;renderResult();controls();$('message').innerHTML='<div class="error" role="alert"></div>';$('message').firstChild.textContent=message;}
worker.onmessage=({data})=>{
 if(data.ready){ready=true;loadError=false;controls();return;}
 if(data.init){loadError=true;ready=false;fail(data.error);return;}
 if(data.id!==seq)return;
 if(data.references){if(result){result.saturation=data.references;renderResult();}return;}
 if(data.error){fail(data.error);return;}
 if(data.result.states.length>1){fail('More than one state matches these inputs. Use pressure with temperature, enthalpy or entropy to identify your process state.');return;}
 busy=false;result=data.result.states[0];resultCreatedAt=new Date().toISOString();$('message').textContent='';renderResult();controls();saveCalculation();window.dispatchEvent(new CustomEvent("fieldkit:result"));
};
worker.onerror=()=>{loadError=true;ready=false;fail('The calculator could not load. Reload the page to try again.');};
function saturationMarkup(state,chosenUnits=unit,allowCopy=true){
 if(!['Superheated vapor','Compressed liquid'].includes(state?.phase))return '';
 if(!state.saturation)return allowCopy?'<div class="saturation-info">Loading saturation references…</div>':'';
 const tu=units.T[chosenUnits.T],pu=units.P[chosenUnits.P];
 const ts=state.saturation.temperatureAtPressure,ps=state.saturation.pressureAtTemperature;
 const value=(n,u)=>Number.isFinite(n)?`${resultFormat(fromSI(n,u))} <small>${u.label}</small>`:'N/A';
 const copy=(k,n)=>allowCopy?`<button type="button" class="copy-value" data-saturation-copy="${k}" aria-label="Copy saturation ${k==='T'?'temperature':'pressure'} value" title="Copy value" ${Number.isFinite(n)?'':'disabled'}>${copyIcon}</button>`:'';
 return `<div class="saturation-info"><div class="saturation-row"><div><span>Saturation temperature</span><small>${state.P>=22.064e6?'Not defined at or above critical pressure':`At ${resultFormat(fromSI(state.P,pu))} ${pu.label}`}</small></div><div class="saturation-value"><strong data-saturation="T">${value(ts,tu)}</strong>${copy('T',ts)}</div></div><div class="saturation-row"><div><span>Saturation pressure</span><small>${state.T>=647.096?'Not defined at or above critical temperature':`At ${resultFormat(fromSI(state.T,tu))} ${tu.label}`}</small></div><div class="saturation-value"><strong data-saturation="P">${value(ps,pu)}</strong>${copy('P',ps)}</div></div></div>`;
}
function loadSaturationReferences(){
 if(['Superheated vapor','Compressed liquid'].includes(result?.phase)&&!result.saturation)worker.postMessage({id:seq,type:'references',P:result.P,T:result.T});
}
function renderResult(){
 $('result-empty').hidden=!!result; $('results').hidden=!result;
 $('results-link').setAttribute('aria-disabled',String(!result));
 const vapor=result?.phase==='Superheated vapor',liquid=result?.phase==='Compressed liquid';
 const shown=result?{...result,Q:vapor?1:liquid?0:result.Q}:null;
 $('result-actions').hidden=!result;
 $('result-actions').innerHTML=exportActions(!result);bindExportActions($('result-actions'),currentSnapshot);
 $('phase').hidden=!result;$('phase').textContent=result?phaseLabel(result):'';
 $('results').innerHTML=`${saturationMarkup(result)}<div class="output-columns" aria-hidden="true"><span>Property</span><span>Value</span><span>Unit</span></div><div class="result-grid">${Object.keys(labels).map(k=>`<div class="result-item"><label>${labels[k].replace('Compressibility','Compressi&shy;bility')}</label><div class="output-value-cell"><strong data-result="${k}" class="${shown?'':'pending'}">${!shown?'—':shown[k]===null?'N/A':resultFormat(display(k,shown[k]))}</strong>${copyButton('output',k,!shown||shown[k]===null)}</div><select data-unit="${k}" aria-label="${labels[k]} result unit">${options(k)}</select></div>`).join('')}</div>`;
 $('results').querySelectorAll('[data-copy-output]').forEach(button=>button.onclick=()=>{const k=button.dataset.copyOutput;copyValue($('results').querySelector(`[data-result="${k}"]`).textContent,`${labels[k]} output`);});
 $('results').querySelectorAll('[data-saturation-copy]').forEach(button=>button.onclick=()=>{const k=button.dataset.saturationCopy;const n=k==='T'?result.saturation.temperatureAtPressure:result.saturation.pressureAtTemperature;copyValue(resultFormat(fromSI(n,units[k][unit[k]])),`Saturation ${k==='T'?'temperature':'pressure'}`);});
 bindUnits($('results'));
 $('results-note').hidden=!result;
 $('results-note').textContent=!result?'':vapor?'Vapor fraction 1 means all vapor; saturation quality is not defined for superheated steam. N/A means not applicable.':result.phase==='Wet steam'?'N/A: wet-steam heat capacities and transport properties require a two-phase model.':result.phase==='Supercritical fluid'?'Vapor fraction is not defined for supercritical fluid. N/A means not applicable.':'N/A means not defined or not modeled for this phase.';
}
$('calculate').onclick=calculate;
$('clear').onclick=()=>{values={};draft={};renderInputs();invalidate();$('value-'+inputPair[0]).focus();};
$('input-pair').onchange=()=>{inputPair=$('input-pair').value;values={};draft={};renderInputs();invalidate();};
$('inputs').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();calculate();}});
renderInputs();renderResult();controls();

function savedUnit(entry,key){return units[key].find(u=>u.label===entry.units[key])??units[key][0];}
function savedValue(entry,key,value){return value===null?'N/A':resultFormat(fromSI(value,savedUnit(entry,key)));}
function savedOutputs(entry){return {...entry.result,Q:entry.result.phase==='Superheated vapor'?1:entry.result.phase==='Compressed liquid'?0:entry.result.Q};}
function dateLabel(entry){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(entry.createdAt));}
function updateHistoryCount(){$('history-count').textContent=historyStore.list().length;renderRecentCalculations();}
function openHistory(id=null){historyEntryId=id;renderHistory();$('history-dialog').showModal();}
function renderRecentCalculations(){
 const entries=historyStore.list().slice(0,3);
 const container=$('recent-calculations');
 container.innerHTML=entries.length?entries.map((entry,index)=>`<button type="button" class="history-card recent-card" data-recent-index="${index}"><span class="history-card-top"><strong>${phaseLabel(entry.result)}</strong><span>View →</span></span><time>${dateLabel(entry)}</time><span class="history-inputs">${Object.entries(entry.inputs).map(([k,v])=>`${labels[k]}: ${savedValue(entry,k,v)} ${savedUnit(entry,k).label}`).join(' · ')}</span></button>`).join(''):'<p class="recent-empty">Your latest 3 calculations will appear here.</p>';
 container.querySelectorAll('[data-recent-index]').forEach(button=>button.onclick=()=>openHistory(entries[Number(button.dataset.recentIndex)].id));
}

function saveCalculation(){
 const entry={id:crypto.randomUUID(),createdAt:resultCreatedAt,inputs:Object.fromEntries(selected.map(k=>[k,values[k]])),units:Object.fromEntries(Object.keys(units).map(k=>[k,units[k][unit[k]].label])),result:structuredClone(result)};
 historyPersistent=historyStore.add(entry);updateHistoryCount();
 if(!historyPersistent)toast('History saved for this session only. Browser storage is unavailable.');
 if($('history-dialog').open)renderHistory();
}
function historyRows(entry,kind){
 const data=kind==='input'?entry.inputs:savedOutputs(entry);
 return '<div class="history-columns"><span>Property</span><span>Value</span><span>Unit</span></div>'+Object.entries(data).filter(([k])=>k in labels).map(([k,v])=>`<div class="history-row"><span>${labels[k]}</span><div class="output-value-cell"><strong>${savedValue(entry,k,v)}</strong><button type="button" class="copy-value" data-history-copy="${kind}:${k}" aria-label="Copy saved ${labels[k]} ${kind} value" title="Copy value" ${v===null?'disabled':''}>${copyIcon}</button></div><span class="saved-unit">${savedUnit(entry,k).label}</span></div>`).join('');
}
function renderHistory(){
 const entries=historyStore.list();const entry=entries.find(e=>e.id===historyEntryId);
 $('history-notice').textContent=historyPersistent?'Saved on this browser · Last 10 calculations':'Session history only · Browser storage unavailable';
 $('history-clear-all').disabled=!entries.length;
 $('history-clear-confirm').hidden=true;
 const content=$('history-content');
 if(entry){
  content.innerHTML=`<div class="history-detail-actions"><button id="history-back" type="button">← All calculations</button><button id="history-load" type="button">Load calculation</button><button id="history-delete-one" class="history-delete" type="button">Delete calculation</button></div><h3 class="saved-phase">${phaseLabel(entry.result)}</h3><p class="saved-date">${dateLabel(entry)}</p><div class="saved-exports">${exportActions()}</div>${saturationMarkup(entry.result,Object.fromEntries(Object.keys(units).map(k=>[k,Math.max(0,units[k].findIndex(u=>u.label===entry.units[k]))])),false)}<h3 class="history-section-title">Input</h3>${historyRows(entry,'input')}<h3 class="history-section-title">Output</h3>${historyRows(entry,'output')}`;
  bindExportActions(content.querySelector('.saved-exports'),()=>entry);
  $('history-delete-one').onclick=()=>deleteHistoryEntry(entry.id);
  $('history-back').onclick=()=>{historyEntryId=null;renderHistory();};
  $('history-load').onclick=()=>{
   ++seq;busy=false;values={...entry.inputs};draft={};
   inputPair=keys.filter(k=>k in entry.inputs).join('');$('input-pair').value=inputPair;
   unit=Object.fromEntries(Object.keys(units).map(k=>[k,Math.max(0,units[k].findIndex(u=>u.label===entry.units[k]))]));
   Object.keys(values).forEach(k=>draft[k]=fmt(display(k,values[k])));
   result=structuredClone(entry.result);resultCreatedAt=entry.createdAt;$('message').textContent='';renderInputs();renderResult();controls();loadSaturationReferences();$('history-dialog').close();toast('Saved calculation loaded');window.dispatchEvent(new CustomEvent('fieldkit:result'));
  };
  content.querySelectorAll('[data-history-copy]').forEach(button=>button.onclick=()=>{const [kind,key]=button.dataset.historyCopy.split(':');const data=kind==='input'?entry.inputs:savedOutputs(entry);copyValue(savedValue(entry,key,data[key]),`${labels[key]} ${kind}`);});
 }else{
  historyEntryId=null;
  content.innerHTML=entries.length?entries.map((entry,index)=>`<div class="history-entry"><button type="button" class="history-card" data-history-index="${index}"><span class="history-card-top"><strong>${phaseLabel(entry.result)}</strong><span>View →</span></span><time>${dateLabel(entry)}</time><span class="history-inputs">${Object.entries(entry.inputs).map(([k,v])=>`${labels[k]}: ${savedValue(entry,k,v)} ${savedUnit(entry,k).label}`).join(' · ')}</span></button><button type="button" class="history-delete" data-history-delete="${index}" aria-label="Delete calculation ${index+1}">Delete</button></div>`).join(''):'<div class="history-empty">No saved calculations yet.</div>';
  content.querySelectorAll('[data-history-delete]').forEach(button=>button.onclick=()=>deleteHistoryEntry(entries[Number(button.dataset.historyDelete)].id));
  content.querySelectorAll('[data-history-index]').forEach(button=>button.onclick=()=>{historyEntryId=entries[Number(button.dataset.historyIndex)].id;renderHistory();});
 }
}
function deleteHistoryEntry(id){
 historyPersistent=historyStore.remove(id);historyEntryId=null;updateHistoryCount();renderHistory();
 toast(historyPersistent?'Calculation deleted':'Deleted for this session only. Browser storage is unavailable.');
 ($('history-content').querySelector('[data-history-index]')??$('history-close')).focus();
}
$('history-clear-all').onclick=()=>{$('history-clear-confirm').hidden=false;$('history-clear-cancel').focus();};
$('history-clear-cancel').onclick=()=>{$('history-clear-confirm').hidden=true;$('history-clear-all').focus();};
$('history-clear-confirmed').onclick=()=>{
 historyPersistent=historyStore.clear();historyEntryId=null;updateHistoryCount();renderHistory();$('history-close').focus();
 toast(historyPersistent?'History cleared':'Cleared for this session only. Browser storage is unavailable.');
};
$('history-open').onclick=()=>openHistory();
$('recent-view-all').onclick=()=>openHistory();
$('history-close').onclick=()=>$('history-dialog').close();
updateHistoryCount();

function currentSnapshot(){
 if(!result)return null;
 return {createdAt:resultCreatedAt,inputs:Object.fromEntries(selected.map(k=>[k,values[k]])),units:Object.fromEntries(Object.keys(units).map(k=>[k,units[k][unit[k]].label])),result};
}
function exportActions(disabled=false){
 return `<div class="export-actions"><button type="button" data-export-share ${disabled?'disabled':''}>Share results</button><button type="button" data-export-download aria-expanded="false" ${disabled?'disabled':''}>Download <span aria-hidden="true">↓</span></button><div class="export-menu" hidden><button type="button" data-export-file="csv">CSV spreadsheet <small>Open in Excel</small></button><button type="button" data-export-file="txt">Text report <small>All values and units</small></button></div></div>`;
}
function bindExportActions(parent,getSnapshot){
 parent.querySelector('[data-export-share]').onclick=()=>{const snapshot=getSnapshot();if(snapshot)shareResults(snapshot);};
 const toggle=parent.querySelector('[data-export-download]'),menu=parent.querySelector('.export-menu');
 toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
 parent.querySelectorAll('[data-export-file]').forEach(button=>button.onclick=()=>{
  const snapshot=getSnapshot();if(snapshot)downloadResults(snapshot,button.dataset.exportFile);
  menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();
 });
 parent.onkeydown=e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}};
}
function shareResults(snapshot){
 const report=createReport(snapshot);
 $('share-report').value=report.text;$('share-status').textContent='';$('share-native').hidden=!navigator.share;$('share-dialog').showModal();
}
function downloadResults(snapshot,extension){
 const report=createReport(snapshot);
 const blob=new Blob([extension==='csv'?report.csv:report.text],{type:extension==='csv'?'text/csv;charset=utf-8':'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${report.filename}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('share-close').onclick=()=>$('share-dialog').close();
$('share-copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('share-report').value);$('share-status').textContent='Report copied. Paste it into a message or email.';}
 catch{$('share-report').focus();$('share-report').select();$('share-status').textContent='Select and copy the report to share it.';}
};

$('share-native').onclick=async()=>{
 try{await navigator.share({title:'Steam Properties results',text:$('share-report').value});}
 catch(error){if(error.name!=='AbortError')$('share-status').textContent='Sharing is unavailable here. Use Copy report instead.';}
};
