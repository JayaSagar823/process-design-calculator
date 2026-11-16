import {units,toSI,fromSI} from './units.mjs';
import {readSettings,historyLimit} from './prefs.mjs';
import {createHistory} from './history.mjs';
import {propertyLabels as labels,formatValue as resultFormat,phaseName as phaseLabel,createReport} from './report.mjs';
import {formatDateTime,formatTime} from './dates.mjs';
import {toast as showToast,confirmAction} from './feedback.mjs';
const $=id=>document.getElementById(id);
const keys=['P','T','Q','H','S'];
let inputPair='PT';
let selected=[],values={},draft={},unit=Object.fromEntries(Object.keys(units).map(k=>[k,0])),result=null,resultCreatedAt=null,ready=false,busy=false,seq=0,loadError=false;
// Settings can choose the units new calculations start in; "default" keeps this calculator's own.
{const s=readSettings(),p=units.P.findIndex(u=>u.label===s.pressure),t=units.T.findIndex(u=>u.label===s.temperature);if(p>=0)unit.P=p;if(t>=0)unit.T=t;}
const worker=new Worker(new URL('./engine/worker.mjs',import.meta.url),{type:'module'});
const fmt=n=>Number(n.toPrecision(7)).toString();
const display=(k,v)=>fromSI(v,units[k][unit[k]]);
const copyIcon='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const trashIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const shareIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>';
const downloadIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';
let keep=historyLimit();
const historyStore=createHistory({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},{limit:()=>keep});
let historyEntryId=null,historyPersistent=(()=>{try{const probe='steam-operator.probe';localStorage.setItem(probe,'1');localStorage.removeItem(probe);return true;}catch{return false;}})();
// Outside an open modal dialog the page is inert, so the message bar moves into the top dialog to keep its Undo pressable.
function toast(text,options){const host=[...document.querySelectorAll('dialog[open]')].pop()??document.body,node=$('toast');if(node&&node.parentElement!==host)host.append(node);showToast(text,options);}
async function copyValue(text,label){
 try{await navigator.clipboard.writeText(text);toast(`${label} copied`);}
 catch{toast('Copy unavailable. Select the value and copy it manually.');}
}
function copyButton(kind,key,disabled=false){return `<button type="button" class="copy-value" data-copy-${kind}="${key}" aria-label="Copy ${labels[key]} ${kind} value" title="Copy value" ${disabled?'disabled':''}>${copyIcon}</button>`;}
function unitControl(k){if(units[k].length>1)return `<select data-unit="${k}" aria-label="${labels[k]} result unit">${options(k)}</select>`;const label=units[k][0].label;return `<span class="unit-static">${label==='—'?'':label}</span>`;}
function options(k){return units[k].map((u,i)=>`<option value="${i}" ${i===unit[k]?'selected':''}>${u.label}</option>`).join('');}
function complete(){return selected.length===2&&selected.every(k=>Number.isFinite(values[k]));}
// The engine's own limits (engine/thermo.mjs), shown under the field and checked before calculating.
// With vapor fraction as an input the state must sit below the critical point, which the engine checks strictly.
const LIMITS={P:[611.657,1e8],T:[273.16,1073.15],Q:[0,1]},CRITICAL={P:22.064e6,T:647.096};
function limits(k){if(!LIMITS[k])return null;const capped=k!=='Q'&&inputPair.includes('Q');return {lo:LIMITS[k][0],hi:capped?CRITICAL[k]:LIMITS[k][1],below:capped};}
function rangeText(k){const l=limits(k);if(!l)return '';const u=units[k][unit[k]],lo=fmt(fromSI(l.lo,u)),hi=fmt(fromSI(l.hi,u));return l.below?`Range: ${lo} to below ${hi} ${u.label}, the critical point`:`Range: ${lo} to ${hi} ${u.label}`;}
// A value typed from the rounded hint can land a hair outside the exact bound; snap it onto the bound.
function withinLimits(k){const l=limits(k);if(!l)return true;const v=values[k],eps=Math.abs(l.hi)*1e-6+1e-12;if(Math.abs(v-l.lo)<=Math.abs(l.lo)*1e-6+1e-12){values[k]=l.lo;return true;}if(!l.below&&Math.abs(v-l.hi)<=eps){values[k]=l.hi;return true;}return v>=l.lo&&(l.below?v<l.hi:v<=l.hi);}
function fieldError(k,message){const input=$('value-'+k),error=$('error-'+k);if(!input||!error)return;error.textContent=message||'';error.hidden=!message;if(message){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',`error-${k}${LIMITS[k]?` range-${k}`:''}`);}else{input.removeAttribute('aria-invalid');if(LIMITS[k])input.setAttribute('aria-describedby',`range-${k}`);else input.removeAttribute('aria-describedby');}}
function checkInputs(){
 const problems=[...inputPair].map(k=>{
  const text=(draft[k]??'').trim();
  if(!text)return [k,`Enter ${labels[k].toLowerCase()}.`];
  if(!Number.isFinite(values[k]))return [k,'Enter a valid number.'];
  if(!withinLimits(k))return [k,`Out of range. ${rangeText(k).replace('Range: ','Use ')}.`];
  return [k,''];
 });
 problems.forEach(([k,message])=>fieldError(k,message));
 const first=problems.find(([,message])=>message);
 if(first)$('value-'+first[0]).focus();
 return !first;
}
function controls(){
 // Calculate waits for both readings of the chosen pair; the status line says what's missing.
 const filled=[...inputPair].filter(k=>(draft[k]??'').trim()).length;
 $('calculate').disabled=!ready||busy||filled<2;
 $('clear').disabled=!result&&!keys.some(k=>(draft[k]??'').trim());
 $('calculate').textContent=busy?'Calculating…':'Calculate';
 $('input-status').textContent=loadError?'Calculator unavailable. Please reload.':!ready?'Preparing calculator…':busy?'Calculating properties…':filled<2?(filled?'Enter one more reading to calculate.':'Enter both readings to calculate.'):'';
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
 $('inputs').innerHTML='<div class="input-columns" aria-hidden="true"><span>Property</span><span>Value</span><span>Unit</span></div>'+keys.map(k=>`<div class="input-row" id="row-${k}"><label for="value-${k}">${labels[k]}</label><div class="input-value-cell"><input type="text" inputmode="decimal" autocomplete="off" aria-label="${labels[k]} value" id="value-${k}" placeholder="Enter value"${LIMITS[k]?` aria-describedby="range-${k}"`:''}>${copyButton('input',k,true)}</div><select aria-label="${labels[k]} unit" data-unit="${k}">${options(k)}</select><p class="field-error" id="error-${k}" role="alert" hidden></p>${LIMITS[k]?`<p class="hint range-hint" id="range-${k}">${rangeText(k)}</p>`:''}</div>`).join('');
 keys.forEach(k=>{$('value-'+k).value=draft[k]??'';});
 syncInputState();
 keys.forEach(k=>$('value-'+k).addEventListener('input',()=>{
  const text=$('value-'+k).value;draft[k]=text;
  const n=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())?Number(text):NaN;
  values[k]=Number.isFinite(n)?toSI(n,units[k][unit[k]]):undefined;
  fieldError(k,'');syncInputState();invalidate();
 }));
 $('inputs').querySelectorAll('[data-copy-input]').forEach(button=>button.onclick=()=>{const k=button.dataset.copyInput;copyValue(draft[k],`${labels[k]} input`);});
 bindUnits($('inputs'));
}
function bindUnits(parent){parent.querySelectorAll('[data-unit]').forEach(el=>el.addEventListener('change',()=>{const k=el.dataset.unit;unit[k]=Number(el.value);keys.forEach(key=>{if(Number.isFinite(values[key]))draft[key]=fmt(display(key,values[key]));});renderInputs();renderResult();controls();}));}
function invalidate(){++seq;busy=false;result=null;$('message').textContent='';renderResult();controls();}
function calculate(){
 if(!ready||busy||!checkInputs()||!complete())return;
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
 const vapor=result?.phase==='Superheated vapor',liquid=result?.phase==='Compressed liquid';
 const shown=result?{...result,Q:vapor?1:liquid?0:result.Q}:null;
 $('result-actions').hidden=!result;
 $('result-actions').innerHTML=exportActions({main:true,disabled:!result});bindExportActions($('result-actions'),currentSnapshot);
 $('phase').hidden=!result;$('phase').textContent=result?phaseLabel(result):'';
 $('results').innerHTML=`${saturationMarkup(result)}<div class="output-columns" aria-hidden="true"><span>Property</span><span>Value</span><span>Unit</span></div><div class="result-grid">${Object.keys(labels).map(k=>`<div class="result-item"><label>${labels[k].replace('Compressibility','Compressi&shy;bility')}</label><div class="output-value-cell"><strong data-result="${k}" class="${shown?'':'pending'}">${!shown?'—':shown[k]===null?'N/A':resultFormat(display(k,shown[k]))}</strong></div>${unitControl(k)}${copyButton('output',k,!shown||shown[k]===null)}</div>`).join('')}</div>`;
 $('results').querySelectorAll('[data-copy-output]').forEach(button=>button.onclick=()=>{const k=button.dataset.copyOutput;copyValue($('results').querySelector(`[data-result="${k}"]`).textContent,`${labels[k]} output`);});
 $('results').querySelectorAll('[data-saturation-copy]').forEach(button=>button.onclick=()=>{const k=button.dataset.saturationCopy;const n=k==='T'?result.saturation.temperatureAtPressure:result.saturation.pressureAtTemperature;copyValue(resultFormat(fromSI(n,units[k][unit[k]])),`Saturation ${k==='T'?'temperature':'pressure'}`);});
 bindUnits($('results'));
 $('results-note').hidden=!result;
 if(!result)savedNote('');
 $('results-note').textContent=!result?'':vapor?'Superheated steam is all vapor (fraction 1). N/A: not applicable.':result.phase==='Wet steam'?'N/A: not modelled for wet steam.':result.phase==='Supercritical fluid'?'No vapor fraction above the critical point. N/A: not applicable.':'N/A: not defined for this phase.';
}
$('calculate').onclick=calculate;
$('clear').onclick=()=>{values={};draft={};renderInputs();invalidate();$('value-'+inputPair[0]).focus();};
// Example: 1 MPa(a) at 200 °C (superheated steam), written in the units the reader has chosen.
$('example').onclick=async()=>{
 if([...inputPair].some(k=>(draft[k]??'').trim())&&!(await confirmAction({title:'Replace Your Readings?',message:'Load Example replaces the readings you have entered.',confirmLabel:'Replace'})))return;
 inputPair='PT';$('input-pair').value='PT';const example={P:1e6,T:473.15};values={...example};draft=Object.fromEntries(Object.entries(example).map(([k,v])=>[k,fmt(display(k,v))]));renderInputs();invalidate();$('value-P').focus();};
$('input-pair').onchange=()=>{inputPair=$('input-pair').value;values={};draft={};renderInputs();invalidate();};
$('inputs').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();calculate();}});
renderInputs();renderResult();controls();

function savedUnit(entry,key){return units[key].find(u=>u.label===entry.units[key])??units[key][0];}
function savedValue(entry,key,value){return value===null?'N/A':resultFormat(fromSI(value,savedUnit(entry,key)));}
function savedOutputs(entry){return {...entry.result,Q:entry.result.phase==='Superheated vapor'?1:entry.result.phase==='Compressed liquid'?0:entry.result.Q};}
function dateLabel(entry){return formatDateTime(entry.createdAt);}
function updateHistoryCount(){checkSavedNote();
 const n=historyStore.list().length;$('history-count').textContent=n;
 $('history-meta').textContent=historyPersistent?`${n} saved on this device. The last ${keep} are kept.`:'Saved for this session only. This browser can\'t keep history.';
 $('history-clear-all').disabled=!n;
}
function openHistory(id=null){historyEntryId=id;$('history-status').textContent='';renderHistory();$('history-dialog').showModal();}
function savedNote(text){$('saved-note').textContent=text;$('saved-note').hidden=!text;}
// Once the saved record is deleted (one row or all), the note no longer says it is in History.
function checkSavedNote(){if(result&&$('saved-note').textContent&&!historyStore.list().some(e=>e.createdAt===resultCreatedAt))savedNote('');}
// The Undo message moves into the open History window; put it back on the page when the window closes.
$('history-dialog').addEventListener('close',()=>{const bar=$('toast');if(bar&&bar.parentElement!==document.body)document.body.append(bar);});
function deleteButton(entry,attributes=''){const label=`Delete calculation from ${dateLabel(entry)}`;return `<button type="button" class="action-icon" ${attributes} aria-label="${label}" title="${label}">${trashIcon}</button>`;}

function saveCalculation(){
 const entry={id:crypto.randomUUID(),createdAt:resultCreatedAt,inputs:Object.fromEntries(selected.map(k=>[k,values[k]])),units:Object.fromEntries(Object.keys(units).map(k=>[k,units[k][unit[k]].label])),result:structuredClone(result)};
 historyPersistent=historyStore.add(entry,{replaceSame:true});updateHistoryCount();
 savedNote(historyPersistent?`Saved to History at ${formatTime(entry.createdAt)}.`:'Kept for this session only. This browser can\'t save history.');
 if($('history-dialog').open)renderHistory();
}
function historyRows(entry,kind){
 const data=kind==='input'?entry.inputs:savedOutputs(entry);
 return '<div class="history-columns"><span>Property</span><span>Value</span><span>Unit</span></div>'+Object.entries(data).filter(([k])=>k in labels).map(([k,v])=>`<div class="history-row"><span>${labels[k]}</span><div class="output-value-cell"><strong>${savedValue(entry,k,v)}</strong></div><span class="saved-unit">${savedUnit(entry,k).label}</span><button type="button" class="copy-value" data-history-copy="${kind}:${k}" aria-label="Copy saved ${labels[k]} ${kind} value" title="Copy value" ${v===null?'disabled':''}>${copyIcon}</button></div>`).join('');
}
function renderHistory(){
 const entries=historyStore.list();const entry=entries.find(e=>e.id===historyEntryId);
 updateHistoryCount();
 const content=$('history-content');
 if(entry){
  content.innerHTML=`<div class="history-detail-actions">${deleteButton(entry,'id="history-delete-one"')}<button id="history-back" class="secondary" type="button">Back to History</button><button id="history-load" class="primary" type="button">Load Calculation</button></div><h3 class="saved-phase">${phaseLabel(entry.result)}</h3><p class="saved-date">${dateLabel(entry)}</p><div class="saved-exports">${exportActions()}</div>${saturationMarkup(entry.result,Object.fromEntries(Object.keys(units).map(k=>[k,Math.max(0,units[k].findIndex(u=>u.label===entry.units[k]))])),false)}<h3 class="history-section-title">Input</h3>${historyRows(entry,'input')}<h3 class="history-section-title">Output</h3>${historyRows(entry,'output')}`;
  bindExportActions(content.querySelector('.saved-exports'),()=>entry);
  $('history-delete-one').onclick=()=>deleteHistoryEntry(entry.id);
  $('history-back').onclick=()=>{historyEntryId=null;renderHistory();};
  $('history-load').onclick=()=>{
   ++seq;busy=false;values={...entry.inputs};draft={};
   inputPair=keys.filter(k=>k in entry.inputs).join('');$('input-pair').value=inputPair;
   unit=Object.fromEntries(Object.keys(units).map(k=>[k,Math.max(0,units[k].findIndex(u=>u.label===entry.units[k]))]));
   Object.keys(values).forEach(k=>draft[k]=fmt(display(k,values[k])));
   result=structuredClone(entry.result);resultCreatedAt=entry.createdAt;$('message').textContent='';renderInputs();renderResult();controls();savedNote('');loadSaturationReferences();$('history-dialog').close();toast('Saved calculation loaded');window.dispatchEvent(new CustomEvent('fieldkit:result'));
  };
  content.querySelectorAll('[data-history-copy]').forEach(button=>button.onclick=()=>{const [kind,key]=button.dataset.historyCopy.split(':');const data=kind==='input'?entry.inputs:savedOutputs(entry);copyValue(savedValue(entry,key,data[key]),`${labels[key]} ${kind}`);});
 }else{
  historyEntryId=null;
  content.innerHTML=entries.length?entries.map((entry,index)=>`<div class="history-entry"><button type="button" class="history-card" data-history-index="${index}"><span class="history-card-top"><strong>${phaseLabel(entry.result)}</strong></span><time>${dateLabel(entry)}</time><span class="history-inputs">${Object.entries(entry.inputs).map(([k,v])=>`${labels[k]}: ${savedValue(entry,k,v)} ${savedUnit(entry,k).label}`).join(', ')}</span></button>${deleteButton(entry,`data-history-delete="${index}"`)}</div>`).join(''):'<div class="history-empty">No saved calculations yet.</div>';
  content.querySelectorAll('[data-history-delete]').forEach(button=>button.onclick=()=>deleteHistoryEntry(entries[Number(button.dataset.historyDelete)].id));
  content.querySelectorAll('[data-history-index]').forEach(button=>button.onclick=()=>{historyEntryId=entries[Number(button.dataset.historyIndex)].id;renderHistory();});
 }
}
function deleteHistoryEntry(id){
 const entries=historyStore.list(),index=entries.findIndex(e=>e.id===id),entry=entries[index];
 if(!entry)return;
 historyPersistent=historyStore.remove(id);historyEntryId=null;$('history-status').textContent='';updateHistoryCount();renderHistory();
 const cards=$('history-content').querySelectorAll('[data-history-index]');
 (cards[index]??cards[index-1]??$('history-close')).focus();
 toast('Calculation deleted',{action:'Undo',onAction:()=>{
  historyPersistent=historyStore.insert(entry,index);updateHistoryCount();
  if($('history-dialog').open){renderHistory();$('history-content').querySelectorAll('[data-history-index]')[index]?.focus();}
 }});
}
$('history-clear-all').onclick=async()=>{
 const n=historyStore.list().length;if(!n)return;
 if(!(await confirmAction({title:'Delete All Saved Calculations?',message:`This removes all ${n} saved steam calculations from this device. This can't be undone.`,confirmLabel:'Delete All'})))return;
 historyPersistent=historyStore.clear();historyEntryId=null;updateHistoryCount();renderHistory();$('history-close').focus();
 $('history-status').textContent='All saved calculations deleted.';
};
$('history-open').onclick=()=>openHistory();
$('history-close').onclick=()=>$('history-dialog').close();
updateHistoryCount();

function currentSnapshot(){
 if(!result)return null;
 return {createdAt:resultCreatedAt,inputs:Object.fromEntries(selected.map(k=>[k,values[k]])),units:Object.fromEntries(Object.keys(units).map(k=>[k,units[k][unit[k]].label])),result};
}
// Only the results' own Share carries the page id; the copy inside a saved calculation's detail has none.
function exportActions({main=false,disabled=false}={}){
 return `<div class="export-actions result-actions"><button type="button" class="with-icon" ${main?'id="share" ':''}data-export-share ${disabled?'disabled':''}>${shareIcon}<span>Share</span></button><details class="download"><summary class="with-icon" data-export-download>${downloadIcon}<span>Download</span></summary><div class="export-menu"><button type="button" data-export-file="csv">CSV spreadsheet <small>Open in Excel</small></button><button type="button" data-export-file="txt">Text report <small>All values and units</small></button></div></details></div>`;
}
function bindExportActions(parent,getSnapshot){
 parent.querySelector('[data-export-share]').onclick=()=>{const snapshot=getSnapshot();if(snapshot)shareResults(snapshot);};
 const menu=parent.querySelector('details.download'),toggle=menu.querySelector('summary');
 parent.querySelectorAll('[data-export-file]').forEach(button=>button.onclick=()=>{
  const snapshot=getSnapshot();if(snapshot)downloadResults(snapshot,button.dataset.exportFile);
  menu.open=false;toggle.focus();
 });
 parent.onkeydown=e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();menu.open=false;toggle.focus();}};
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

// Home links a saved calculation as ?open=<id>: show it in History, where Load Calculation is.
{const openId=new URLSearchParams(location.search).get('open');if(openId&&historyStore.list().some(e=>e.id===openId)){openHistory(openId);window.history.replaceState(null,'',location.pathname);}}

// Changes from another tab or Settings: refresh the count, the saved note and an open History.
addEventListener('storage',e=>{if(e.key!=='steam-operator.history.v1'&&e.key!==null)return;if(historyEntryId&&!historyStore.list().some(x=>x.id===historyEntryId))historyEntryId=null;updateHistoryCount();if($('history-dialog').open)renderHistory();});
addEventListener('storage',e=>{if(e.key!=='processcalc-settings-v1'&&e.key!==null)return;keep=historyLimit();updateHistoryCount();if($('history-dialog').open)renderHistory();});
