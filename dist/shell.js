import {setupInstall} from './install.mjs';
import {watchForUpdates} from './updates.mjs';
import {readSettings,applyTheme,SETTINGS_KEY} from './prefs.mjs';
addEventListener('storage',e=>{if(e.key===SETTINGS_KEY||e.key===null)applyTheme(readSettings().theme);});
const $=id=>document.getElementById(id);
setupInstall({document,window,navigator,appURL:new URL('./',import.meta.url).href});
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
addEventListener('fieldkit:result',()=>{
 const output=$('output-panel');if(!output)return;
 output.focus({preventScroll:true});
 const headerBottom=Math.max(0,document.querySelector('.app-header')?.getBoundingClientRect().bottom||0);
 const top=output.getBoundingClientRect().top;
 if(top<headerBottom||top>innerHeight-120)output.scrollIntoView({behavior:reduce()?'instant':'smooth',block:'start'});
});
let offlineReady=false,offlineUnavailable=false;
function setConnection(text,state){document.querySelectorAll('[data-connection]').forEach(el=>{el.textContent=text;el.dataset.state=state;});}
function connectivity(){
 if(offlineUnavailable)return setConnection("Offline use isn't available in this browser.",'off');
 if(navigator.onLine)setConnection(offlineReady?'Ready to use offline':'Getting offline use ready…',offlineReady?'ok':'wait');
 else setConnection(offlineReady?'Offline. The calculators still work.':'Offline. Reconnect once to finish offline setup.',offlineReady?'ok':'wait');
}
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
  trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.2 6.2a8 8 0 0 1 13 2.8M4.8 15a8 8 0 0 0 13 2.8"/></svg><span class="header-icon-label">Update</span>';
  document.querySelector('.header-actions')?.prepend(trigger);
  trigger.onclick=()=>{notice.hidden=false;$('app-update-now').focus();};
  $('app-update-later').onclick=()=>{notice.hidden=true;trigger.focus();};
 }
 $('app-update-now').onclick=reload;
 notice.hidden=false;
}
if('serviceWorker' in navigator){
 watchForUpdates({serviceWorker:navigator.serviceWorker,window,document,navigator,scriptURL:new URL('./sw.js',import.meta.url),
  onReady(){offlineReady=true;offlineUnavailable=false;connectivity();},onUpdate:offerUpdate,
  onUnavailable(){offlineUnavailable=true;connectivity();}
 });
}else{offlineUnavailable=true;connectivity();}
