import assert from 'node:assert/strict';
import {installEnvironment,setupInstall} from './dist/install.mjs';

const samsung={userAgent:'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36',platform:'Linux armv8l'};
const chromeAndroid={userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',platform:'Linux armv8l'};
const safariMac={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel'};
const chromeMac={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',platform:'MacIntel'};
assert.equal(installEnvironment(samsung),'samsung');
assert.equal(installEnvironment(chromeAndroid),'android');
assert.equal(installEnvironment(safariMac),'mac-safari');
assert.equal(installEnvironment(chromeMac),'mac-chromium');
assert.equal(installEnvironment({...safariMac,maxTouchPoints:5}),'ios','Desktop-mode iPads must not receive Mac instructions');
assert.equal(installEnvironment({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/130.0 Mobile Safari/604.1'}),'ios');
assert.equal(installEnvironment({}),'desktop');

function fixture(device,{standalone=false,clipboardFails=false}={}) {
  const nodes=new Map(),events={};let copied;
  const element=()=>({hidden:false,disabled:false,children:[],textContent:'',value:'',attributes:{},listeners:{},
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.listeners[k]=v;},
    replaceChildren(...items){this.children=items;},showModal(){this.open=true;},close(){this.open=false;},focus(){this.focused=true;},select(){this.selected=true;}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const trigger=element();
  const document={getElementById:$,createElement:element,querySelectorAll:()=>[trigger]};
  const window={matchMedia:()=>({matches:standalone}),addEventListener:(key,fn)=>{events[key]=fn;}};
  const navigator={...device,clipboard:{writeText:async text=>{if(clipboardFails)throw Error('Clipboard unavailable');copied=text;}}};
  const appURL='https://example.com/process-design-calculator/';
  setupInstall({document,window,navigator,appURL});
  return {$,events,trigger,get copied(){return copied;},appURL};
}
const blocked=fixture(samsung);let prompted=0,prevented=0;
blocked.events.beforeinstallprompt({preventDefault(){prevented++;},prompt(){prompted++;},userChoice:Promise.resolve({outcome:'accepted'})});
blocked.trigger.listeners.click();
assert.equal(prevented,1);
assert.equal(blocked.$('install-native').hidden,true);
await blocked.$('install-native').onclick();
assert.equal(prompted,0,'Samsung Android must never invoke the native install prompt');
assert.equal(blocked.$('install-title').textContent,'Install with Chrome');
assert.equal(blocked.$('install-dialog').open,true);
await blocked.$('install-copy').onclick();
assert.equal(blocked.copied,blocked.appURL,'Copy must retain GitHub project subpath');
assert.match(blocked.$('install-status').textContent,/Open Chrome/);
blocked.$('install-close').onclick();assert.equal(blocked.$('install-dialog').open,false);

const denied=fixture(samsung,{clipboardFails:true});
await denied.$('install-copy').onclick();
assert.equal(denied.$('install-link').selected,true,'Clipboard rejection must offer manual copying');
assert.match(denied.$('install-status').textContent,/Copy the selected link/);

for(const device of [chromeAndroid,chromeMac]) {
  const capable=fixture(device);let calls=0;
  assert.equal(capable.$('install-native').hidden,true,'Do not promise installation without a browser prompt');
  capable.events.beforeinstallprompt({preventDefault(){},async prompt(){calls++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(capable.$('install-native').hidden,false);
  await capable.$('install-native').onclick();
  assert.equal(calls,1);
  assert.match(capable.$('install-status').textContent,/Installation requested/);
  assert.equal(capable.$('install-native').hidden,true,'A consumed prompt must not be reused');
  capable.events.appinstalled();
  assert.match(capable.$('install-status').textContent,/is installed/);
}
const mac=fixture(safariMac);
assert.match(mac.$('install-steps').children.map(n=>n.textContent).join(' '),/File, then Add to Dock/);
assert.match(mac.$('install-note').textContent,/Sonoma 14/);
assert.equal(mac.$('install-native').hidden,true);
const installed=fixture(samsung,{standalone:true});installed.trigger.listeners.click();
assert.equal(installed.trigger.attributes['aria-label'],'App Info');
assert.equal(installed.$('install-instructions').hidden,true);
console.log('Samsung prompt suppression, Mac/iPad guidance, native capability, installed state and clipboard fallback passed.');
