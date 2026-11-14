import {setupInstall} from './install.mjs';
const $=id=>document.getElementById(id);
setupInstall({document,window,navigator,appURL:new URL('./',import.meta.url).href});
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
addEventListener('fieldkit:result',()=>{const output=$('output-panel');output?.focus({preventScroll:true});if(matchMedia('(max-width:900px)').matches)output?.scrollIntoView({behavior:reduce()?'instant':'smooth',block:'start'});});
let offlineReady=false;
function connectivity(){document.querySelectorAll('[data-connection]').forEach(el=>el.textContent=!navigator.onLine?(offlineReady?'Offline · Calculators available':'Offline · Reconnect to finish setup'):(offlineReady?'Ready for offline use':'Preparing offline access…'));}
addEventListener('online',connectivity);addEventListener('offline',connectivity);connectivity();
if('serviceWorker' in navigator){
 navigator.serviceWorker.register(new URL('./sw.js', import.meta.url),{updateViaCache:'none'}).then(async reg=>{reg.update().catch(()=>{});await navigator.serviceWorker.ready;offlineReady=true;connectivity();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Update ready · Close and reopen ProcessCalc');});});}).catch(()=>{document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access · Offline setup unavailable');});
}else document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access');
