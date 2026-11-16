// Browser detection selects guidance only. Native installation still requires
// the browser's beforeinstallprompt capability, with Samsung Android excluded.
export function installEnvironment({userAgent='',platform='',maxTouchPoints=0}={}) {
  const ios=/iPhone|iPad|iPod/i.test(userAgent)||(/Mac/i.test(platform)&&maxTouchPoints>1);
  const android=/Android/i.test(userAgent);
  const mac=!ios&&/Mac/i.test(platform+' '+userAgent);
  const chromium=/Chrome|Chromium|Edg|OPR/i.test(userAgent);
  if(android&&/SamsungBrowser/i.test(userAgent))return 'samsung';
  if(ios)return 'ios';
  if(mac)return chromium?'mac-chromium':'mac-safari';
  if(android)return 'android';
  return 'desktop';
}

const guides={
  samsung:{
    title:'Install with Chrome',
    description:'Samsung Internet may block app installation on some phones. Open this calculator in Google Chrome to install it.',
    steps:['Copy the calculator link below.','Open Google Chrome and paste the link into its address bar.','In Chrome, tap the three-dot menu, then Install and create shortcut, then Install. Some versions show Add to Home screen, then Install.'],
    note:'Keep Play Protect enabled. You can also use the calculator in your browser.',
    copy:true,
  },
  'mac-safari':{
    title:'Add to Your Mac',
    description:'Save the calculator as an app in your Dock using Safari.',
    steps:['Open this calculator in Safari.','Choose File, then Add to Dock, or Share, then Add to Dock.','Choose Add, then open the calculator from your Dock.'],
    note:'Requires macOS Sonoma 14 or later. If Add to Dock is unavailable, update macOS or open this link in Google Chrome and use its install option.',
    copy:true,
  },
  'mac-chromium':{
    title:'Install on Your Mac',
    description:'Open the calculator in its own app window on your Mac.',
    steps:['Use the Install App button below when available.','In Chrome, you can also choose the three-dot menu, then Cast, save, and share, then Install page as app. In Edge, use the three-dot menu, then Apps, then Install this site as an app.'],
    note:'Prefer Safari? On macOS Sonoma 14 or later, choose File, then Add to Dock.',
  },
  ios:{
    title:'Add to Your Home Screen',
    description:'Use Safari to add the calculator to your iPhone or iPad.',
    steps:['Open this calculator in Safari.','Tap Share, then Add to Home Screen.','Enable Open as Web App if offered, then tap Add.'],
    note:'Open the new icon on your home screen to use the calculator as an app.',
  },
  android:{
    title:'Install on Your Phone',
    description:'Use Google Chrome for installation on Android.',
    steps:['Use the Install App button below when available.','In Chrome, you can also tap the three-dot menu, then Install and create shortcut, then Install, or Add to Home screen, then Install.'],
    note:'If installation is unavailable, update Chrome and open this link there. You can continue using the calculator in your browser.',
  },
  desktop:{
    title:'Install the Calculator',
    description:'Keep both calculators a click away in their own app window.',
    steps:['Use the Install App button below when available.','In Chrome, choose the three-dot menu, then Cast, save, and share, then Install page as app. In Edge, use the three-dot menu, then Apps, then Install this site as an app.'],
    note:'Installation options depend on your browser. You can also bookmark this page.',
  },
};

export function setupInstall({document,window,navigator,appURL}) {
  const $=id=>document.getElementById(id);
  const environment=installEnvironment(navigator);
  const guide=guides[environment];
  const nativeAllowed=environment!=='samsung';
  const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let installPrompt=null,busy=false;
  const status=$('install-status');
  const native=$('install-native');
  const link=$('install-link');
  link.value=appURL;
  const steps=$('install-steps');
  steps.replaceChildren(...guide.steps.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
  $('install-note').textContent=guide.note;
  $('install-link-block').hidden=!guide.copy;
  $('install-copy').textContent=environment==='samsung'?'Copy Link for Chrome':'Copy Calculator Link';

  function update() {
    const isInstalled=installed();
    document.querySelectorAll('[data-install]').forEach(button=>{
      const label=isInstalled?'App Info':environment==='samsung'?'Install with Chrome':'Install App';
      button.setAttribute('aria-label',label);button.title=label;
      // The visible word matches the announced name.
      const text=isInstalled?'App Info':'Install',target=button.querySelector?.('.header-icon-label')||button;
      if(target.textContent!==text)target.textContent=text;
    });
    $('install-title').textContent=isInstalled?'ProcessCalc':guide.title;
    $('install-description').textContent=isInstalled?'You’re using the installed app. Open it from your home screen, Dock or app launcher.':guide.description;
    $('install-instructions').hidden=isInstalled;
    native.hidden=!nativeAllowed||!installPrompt||isInstalled;
    native.disabled=busy;
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    if(nativeAllowed)installPrompt=event;
    update();
  });
  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    update();
    status.textContent='ProcessCalc is installed.';
  });
  document.querySelectorAll('[data-install]').forEach(button=>button.addEventListener('click',()=>{
    status.textContent='';update();$('install-dialog').showModal();
  }));
  native.onclick=async()=>{
    if(!nativeAllowed||!installPrompt||installed()||busy)return;
    const prompt=installPrompt;busy=true;update();
    try {
      await prompt.prompt();
      const {outcome}=await prompt.userChoice;
      status.textContent=outcome==='accepted'?'Installation requested. Follow any remaining browser prompts.':'Installation cancelled. You can try again from your browser menu.';
    } catch {
      status.textContent='Installation could not be opened. Follow the browser steps above.';
    } finally {installPrompt=null;busy=false;update();}
  };
  $('install-copy').onclick=async()=>{
    try {
      await navigator.clipboard.writeText(appURL);
      status.textContent=environment==='samsung'?'Link copied. Open Chrome and paste it into the address bar.':'Calculator link copied.';
    } catch {
      link.focus();link.select();
      status.textContent='Copy the selected link, then paste it into '+(environment==='samsung'?'Chrome.':'your browser.');
    }
  };
  $('install-close').onclick=()=>$('install-dialog').close();
  update();
}
