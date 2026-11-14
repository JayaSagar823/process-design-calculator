const $=id=>document.getElementById(id);
let installPrompt=null;
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function updateInstall(){document.querySelectorAll('[data-install-label]').forEach(el=>el.textContent=installed()?'App info':'Install app');$('install-native').hidden=!installPrompt||installed();}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateInstall();});
addEventListener('appinstalled',()=>{installPrompt=null;updateInstall();$('install-status').textContent='Process Design Calculator is installed. Open it from your home screen.';});
async function promptInstall(){if(!installPrompt)return;try{await installPrompt.prompt();const {outcome}=await installPrompt.userChoice;$('install-status').textContent=outcome==='accepted'?'Installation accepted. Your browser will add Process Design Calculator to your apps.':'Installation cancelled. You can install it later.';}catch{$('install-status').textContent='Use your browser menu to add Process Design Calculator to your home screen.';}finally{installPrompt=null;updateInstall();}}
document.querySelectorAll('[data-install]').forEach(button=>button.addEventListener('click',()=>{$('install-status').textContent=installed()?'You are using the installed Process Design Calculator app.':'';$('install-instructions').hidden=installed();updateInstall();$('install-dialog').showModal();}));
$('install-native').onclick=promptInstall;$('install-close').onclick=()=>$('install-dialog').close();updateInstall();
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function section(name){if($('location-label'))$('location-label').textContent=name;document.querySelectorAll('.section-nav a').forEach(link=>{if(link.textContent===name)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}
addEventListener('fieldkit:result',()=>{section('Results');const output=$('output-panel');output?.focus({preventScroll:true});if(matchMedia('(max-width:900px)').matches)output?.scrollIntoView({behavior:reduce()?'instant':'smooth',block:'start'});});
section('Inputs');
$('input-panel')?.addEventListener('focusin',event=>{if(!$('output-panel')?.contains(event.target))section('Inputs');});
$('output-panel')?.addEventListener('focusin',()=>section('Results'));
$('history-open')?.addEventListener('click',()=>section('History'));
$('history-close')?.addEventListener('click',()=>section('Inputs'));
$('history-dialog')?.addEventListener('close',()=>section('Inputs'));
document.querySelectorAll('.section-nav a').forEach(link=>link.addEventListener('click',e=>{if(link.getAttribute('aria-disabled')==='true'){e.preventDefault();return;}section(link.textContent);}));
let offlineReady=false;
function connectivity(){document.querySelectorAll('[data-connection]').forEach(el=>el.textContent=!navigator.onLine?(offlineReady?'Offline · Calculators available':'Offline · Reconnect to finish setup'):(offlineReady?'Ready for offline use':'Preparing offline access…'));}
addEventListener('online',connectivity);addEventListener('offline',connectivity);connectivity();
if('serviceWorker' in navigator){
 navigator.serviceWorker.register(new URL('./sw.js', import.meta.url),{updateViaCache:'none'}).then(async reg=>{reg.update().catch(()=>{});await navigator.serviceWorker.ready;offlineReady=true;connectivity();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Update ready · Close and reopen Process Design Calculator');});});}).catch(()=>{document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access · Offline setup unavailable');});
}else document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access');
