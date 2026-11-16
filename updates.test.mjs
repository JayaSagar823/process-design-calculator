import test from 'node:test';
import assert from 'node:assert/strict';
import {watchForUpdates} from './dist/updates.mjs';

class Events {
  listeners=new Map();
  addEventListener(name,handler){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(handler);}
  removeEventListener(name,handler){this.listeners.get(name)?.delete(handler);}
  emit(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
}
function fixture({version='release-a',workerVersion='release-a',controlled=true,registrationFails=false,updateFails=false}={}){
  const serviceWorker=new Events(),window=new Events(),document=new Events();
  const navigator={onLine:true};document.visibilityState='visible';
  let checks=0,notices=0,ready=0,unavailable=0,reloads=0,apply,interval,cleared=false;
  const worker={postMessage(){serviceWorker.emit('message',{source:worker,data:{type:'PROCESSCALC_VERSION',version:workerVersion}});}};
  serviceWorker.controller=controlled?worker:null;
  serviceWorker.ready=Promise.resolve({});
  serviceWorker.register=async(url,options)=>{
    assert.equal(String(url),'https://example.com/subpath/sw.js');assert.equal(options.updateViaCache,'none');
    if(registrationFails)throw Error('Network unavailable');
    return {update:async()=>{checks++;if(updateFails)throw Error('Network unavailable');}};
  };
  window.location={reload(){reloads++;}};
  window.setInterval=(fn,ms)=>{assert.equal(ms,60000);interval=fn;return 1;};
  window.clearInterval=()=>{cleared=true;};
  const watcher=watchForUpdates({serviceWorker,window,document,navigator,version,scriptURL:'https://example.com/subpath/sw.js',
    onReady(){ready++;},onUpdate(fn){notices++;apply=fn;},onUnavailable(){unavailable++;}});
  return {serviceWorker,worker,window,document,navigator,watcher,
    get state(){return {checks,notices,ready,unavailable,reloads,cleared};},
    activate(value){workerVersion=value;serviceWorker.controller=worker;serviceWorker.emit('controllerchange');},
    apply(){apply();},tick(){interval();}};
}

test('First install and current releases never cause a reload loop or update notice',async()=>{
  const f=fixture({controlled:false});await f.watcher.ready;
  f.activate('release-a');
  assert.equal(f.state.notices,0);assert.equal(f.state.reloads,0);assert.equal(f.state.ready,1);
  f.watcher.dispose();assert.equal(f.state.cleared,true);
});

test('An activated release offers an update without interrupting readings; reload needs a click',async()=>{
  const f=fixture();await f.watcher.ready;
  f.activate('release-b');assert.equal(f.state.notices,1);assert.equal(f.state.reloads,0);
  f.serviceWorker.emit('controllerchange');assert.equal(f.state.notices,1,'Do not repeat the notice after Later');
  f.apply();assert.equal(f.state.reloads,1);
  f.activate('release-c');assert.equal(f.state.notices,2,'A subsequent release can announce itself');
  f.watcher.dispose();
});

test('Cached old pages detect a worker that activated before event listeners attached',async()=>{
  const f=fixture({workerVersion:'release-b'});await f.watcher.ready;
  assert.equal(f.state.notices,1);assert.equal(f.state.reloads,0);f.watcher.dispose();
});

test('Updates are checked on reconnect, return to app, and periodic foreground use',async()=>{
  const f=fixture();await f.watcher.ready;await f.watcher.check();
  const initial=f.state.checks;
  f.document.visibilityState='hidden';await f.watcher.check();assert.equal(f.state.checks,initial);
  f.document.visibilityState='visible';f.navigator.onLine=false;await f.watcher.check();assert.equal(f.state.checks,initial);
  f.navigator.onLine=true;
  for(const run of [()=>f.window.emit('online'),()=>f.window.emit('focus'),()=>f.document.emit('visibilitychange'),()=>f.tick()]){
    const before=f.state.checks;run();await Promise.resolve();await Promise.resolve();assert.equal(f.state.checks,before+1);
  }
  f.watcher.dispose();const stopped=f.state.checks;f.window.emit('online');await f.watcher.check();assert.equal(f.state.checks,stopped);
});

test('Network failure preserves the installed app, and unrelated messages cannot request an update',async()=>{
  const f=fixture({updateFails:true});await f.watcher.ready;await f.watcher.check();
  f.serviceWorker.emit('message',{source:{},data:{type:'PROCESSCALC_VERSION',version:'other'}});
  f.serviceWorker.emit('message',{source:f.worker,data:{type:'unrelated',version:'other'}});
  assert.equal(f.state.notices,0);assert.equal(f.state.unavailable,0);assert.equal(f.state.ready,1);f.watcher.dispose();
  const offline=fixture({registrationFails:true});await offline.watcher.ready;assert.equal(offline.state.ready,1);offline.watcher.dispose();
  const unsupported=fixture({controlled:false,registrationFails:true});await unsupported.watcher.ready;assert.equal(unsupported.state.unavailable,1);unsupported.watcher.dispose();
});
