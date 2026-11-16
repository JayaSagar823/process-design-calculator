import {setupInstall} from './install.mjs';
import {watchForUpdates} from './updates.mjs';
const $=id=>document.getElementById(id);
setupInstall({document,window,navigator,appURL:new URL('./',import.meta.url).href});
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
addEventListener('fieldkit:result',()=>{const output=$('output-panel');output?.focus({preventScroll:true});if(matchMedia('(max-width:900px)').matches)output?.scrollIntoView({behavior:reduce()?'instant':'smooth',block:'start'});});
let offlineReady=false;
function connectivity(){document.querySelectorAll('[data-connection]').forEach(el=>el.textContent=!navigator.onLine?(offlineReady?'Offline · Calculators available':'Offline · Reconnect to finish setup'):(offlineReady?'Ready for offline use':'Preparing offline access…'));}
addEventListener('online',connectivity);addEventListener('offline',connectivity);connectivity();
function offerUpdate(reload){
 let notice=$('app-update');
 if(!notice){
  notice=document.createElement('aside');notice.id='app-update';notice.className='app-update';
  notice.setAttribute('aria-labelledby','app-update-title');
  notice.innerHTML='<div role="status"><strong id="app-update-title">Update available</strong><p>Update now to get the latest changes. Current readings will be cleared; saved history is kept.</p></div><div class="update-actions"><button type="button" id="app-update-now" class="primary">Update now</button><button type="button" id="app-update-later" class="secondary">Later</button></div>';
  document.body.append(notice);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='header-icon update-trigger';
  trigger.setAttribute('aria-label','Update available');trigger.title='Update available';
  trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.2 6.2a8 8 0 0 1 13 2.8M4.8 15a8 8 0 0 0 13 2.8"/></svg>';
  document.querySelector('.header-actions')?.prepend(trigger);
  trigger.onclick=()=>{notice.hidden=false;$('app-update-now').focus();};
  $('app-update-later').onclick=()=>{notice.hidden=true;trigger.focus();};
 }
 $('app-update-now').onclick=reload;
 notice.hidden=false;
}
if('serviceWorker' in navigator){
 watchForUpdates({serviceWorker:navigator.serviceWorker,window,document,navigator,scriptURL:new URL('./sw.js',import.meta.url),
  onReady(){offlineReady=true;connectivity();},onUpdate:offerUpdate,
  onUnavailable(){document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access · Offline setup unavailable');}
 });
}else document.querySelectorAll('[data-connection]').forEach(el=>el.textContent='Online access');
