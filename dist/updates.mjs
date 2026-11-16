// Stamped by the same build that versions the complete offline cache.
export const APP_VERSION='v17-source';

export function watchForUpdates({serviceWorker, window, document, navigator, scriptURL, onReady, onUpdate, onUnavailable, version=APP_VERSION}) {
  let registration, checking=false, stopped=false, announcedVersion;
  const queryVersion=()=>serviceWorker.controller?.postMessage({type:'PROCESSCALC_VERSION'});
  const onMessage=event=>{
    const data=event.data;
    // Only offer a reload after the new, fully cached worker controls this page.
    if(event.source!==serviceWorker.controller || data?.type!=='PROCESSCALC_VERSION' || typeof data.version!=='string')return;
    if(data.version!==version && data.version!==announcedVersion){
      announcedVersion=data.version;
      onUpdate(()=>window.location.reload());
    }
  };
  const check=async()=>{
    if(stopped || checking || !registration || !navigator.onLine || document.visibilityState==='hidden')return;
    checking=true;
    try{await registration.update();}catch{/* Keep using the installed calculator when the network is unavailable. */}
    finally{checking=false;if(!stopped)queryVersion();}
  };
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  serviceWorker.addEventListener('message',onMessage);
  serviceWorker.addEventListener('controllerchange',queryVersion);
  window.addEventListener('online',check);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',onVisible);
  const interval=window.setInterval(check,60_000);
  const ready=(async()=>{
    try{
      registration=await serviceWorker.register(scriptURL,{updateViaCache:'none'});
      queryVersion();
      void check();
      await serviceWorker.ready;
      if(!stopped){onReady();queryVersion();}
    }catch{
      if(!stopped){if(serviceWorker.controller)onReady();else onUnavailable();}
    }
  })();
  return {ready,check,dispose(){
    stopped=true;
    window.clearInterval(interval);
    serviceWorker.removeEventListener('message',onMessage);
    serviceWorker.removeEventListener('controllerchange',queryVersion);
    window.removeEventListener('online',check);
    window.removeEventListener('focus',check);
    document.removeEventListener('visibilitychange',onVisible);
  }};
}
