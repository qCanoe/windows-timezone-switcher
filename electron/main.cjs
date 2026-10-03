const {app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, shell, Notification, systemPreferences} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {readZones, switchZone} = require('./zones.cjs');
const {createPreferences} = require('./preferences.cjs');
// This small text interface needs no 3D acceleration. Avoid retaining GPU resources.
app.disableHardwareAcceleration();
let preferences;
const texts={zh:{title:'时区切换',open:'打开时区面板',settings:'设置',system:'日期和时间设置',quit:'退出',switched:'时区已切换',failed:'切换未完成'},en:{title:'Time zone switcher',open:'Open time zone panel',settings:'Settings',system:'Date & time settings',quit:'Quit',switched:'Time zone changed',failed:'Unable to switch'}};
function text() {return texts[preferences?.getLanguage() || 'zh'];}
function localize(result) {
 if(!result.error || preferences.getLanguage()==='zh') return result;
 const errors={'无效的时区。':'Invalid time zone.','正在切换，请稍候。':'A switch is in progress. Please wait.','无效请求。':'Invalid request.','时区未生效，请检查“自动设置时区”或设备管理策略。':'The time zone did not change. Check automatic time zone settings or device policies.','切换未完成：权限请求可能已取消，或设备策略限制了修改。':'The permission request was cancelled, or a device policy blocked the change.','Windows 未能切换时区，可以用管理员权限重试。':'Windows could not change the time zone. Retry as administrator.'};
 return {...result,error:errors[result.error] || 'Unable to change the time zone. Please try again.'};
}
let panel, tray, trayMenu, quitting = false, switching = false, zones = [], menuSignature;
let showTask = null, presentationGeneration = 0, blurTimer;
let hideTask = null, fadeTimer, finishFade;
const diagnostic = process.argv.includes('--diagnose-tray');
function trace(event, detail={}) {
 if(!diagnostic || !process.env.TIMEZONE_TRAY_TRACE) return;
 fs.appendFileSync(process.env.TIMEZONE_TRAY_TRACE, JSON.stringify({time:Date.now(),event,visible:panel?.isVisible(),focused:panel?.isFocused(),...detail})+'\n');
}
if ((process.argv.includes('--test-mode') || diagnostic) && process.env.TIMEZONE_TRAY_TEST_DATA) {
 fs.mkdirSync(process.env.TIMEZONE_TRAY_TEST_DATA, {recursive:true});
 app.setPath('userData', process.env.TIMEZONE_TRAY_TEST_DATA);
}
const favorites = [['北京 / 上海','China Standard Time'],['东京','Tokyo Standard Time'],['伦敦','GMT Standard Time'],['纽约','Eastern Standard Time'],['洛杉矶','Pacific Standard Time'],['UTC','UTC']];
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
 app.on('second-instance', () => showPanel());
 app.whenReady().then(async () => {
  preferences=createPreferences(app,process.argv.includes('--test-mode')?'WindowsTimezoneSwitcher.Test':'WindowsTimezoneSwitcher');
  panel = new BrowserWindow({width:456, height:696, resizable:false, frame:false, thickFrame:false, transparent:true, roundedCorners:true, show:false, opacity:0, skipTaskbar:true, alwaysOnTop:true, backgroundColor:'#00000000', title:'时区切换', autoHideMenuBar:true, webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true}});
  const firstPaint = new Promise(resolve => panel.once('ready-to-show', resolve));
  panel.on('hide',()=>panel.webContents.send('panel:activity',false));
  if(diagnostic) {
   for(const event of ['show','hide','focus','blur','move','resize','ready-to-show']) panel.on(event,()=>trace(event,{bounds:panel.getBounds()}));
   for(const event of ['did-start-loading','dom-ready','did-finish-load','render-process-gone']) panel.webContents.on(event,()=>trace(event));
  }
  panel.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  panel.webContents.on('will-navigate', event => event.preventDefault());
  panel.on('close', event => { if (!quitting) {event.preventDefault(); hidePanel();} });
  panel.on('blur', () => {
   clearTimeout(blurTimer);
   if(switching || showTask || process.argv.includes('--test-mode')) return;
   blurTimer=setTimeout(()=>{if(!switching && !showTask && !panel.isFocused()) hidePanel();},80);
  });
  panel.on('focus',()=>clearTimeout(blurTimer));
  panel.webContents.on('before-input-event', (event, input) => {if (input.key === 'Escape') {hidePanel();event.preventDefault();}});
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname,'tray.ico')));
  tray.setToolTip(text().title);
  tray.on('click', () => {trace('tray-click');if(!showTask) (hideTask || !panel.isVisible()) ? showPanel() : hidePanel();});
  tray.on('double-click', () => {trace('tray-double-click');showPanel();});
  tray.on('right-click',async()=>{try{await refresh();}catch{}if(!tray.isDestroyed()&&trayMenu)tray.popUpContextMenu(trayMenu);});
  async function refresh() { zones=await readZones(); updateMenu(); return zones; }
  function trusted(event) { return event.sender === panel.webContents && event.senderFrame === panel.webContents.mainFrame; }
  ipcMain.on('preferences:bootstrap',event=>{event.returnValue=trusted(event)?preferences.read():null;});
  ipcMain.handle('preferences:read',event=>{if(!trusted(event))throw new Error('Invalid sender');return preferences.read();});
  ipcMain.handle('preferences:update',(event,patch)=>{
   if(!trusted(event))throw new Error('Invalid sender');
   try {const saved=preferences.update(patch);updateMenu();panel.setTitle(text().title);return {ok:true,preferences:saved};}
   catch(error){const en=preferences.getLanguage()==='en';return {ok:false,error:error.message==='startup_unavailable'?(en?'Startup is available in the packaged app.':'请在正式程序中设置开机启动。'):(en?'Could not save this setting. Please try again.':'设置未能保存，请重试。')};}
  });
  ipcMain.handle('zones:read', async event => {if (!trusted(event)) throw new Error('Invalid sender'); return refresh();});
  ipcMain.handle('zones:switch', async (event,id,elevated) => {
   if (!trusted(event)) throw new Error('Invalid sender');
   if (switching) return localize({ok:false,error:'正在切换，请稍候。'});
   if (typeof elevated !== 'boolean') return localize({ok:false,error:'无效请求。'});
   switching = true;
   try { const result=localize(await switchZone(id,elevated)); if(result.ok) {zones=result.zones; updateMenu(); if (!result.unchanged) notify(text().switched, preferences.getLanguage()==='en'?zones.find(z=>z.current).id:zones.find(z=>z.current).label);} return result; } finally {switching=false;}
  });
  ipcMain.on('panel:hide', event => {if(trusted(event)) hidePanel();});
  ipcMain.on('settings:open', event => {if(trusted(event)) shell.openExternal('ms-settings:dateandtime');});
  function updateMenu() {
   const current = zones.find(z=>z.current);
   const language=preferences.getLanguage();
   const signature=JSON.stringify([language,current?.id,current?.label,favorites.filter(([,id])=>zones.some(z=>z.id===id)).map(([,id])=>id)]);
   if(menuSignature===signature) return;
   menuSignature=signature;
   if(current) tray.setToolTip((text().title+' · '+(preferences.getLanguage()==='en'?current.id:current.label)).slice(0,127));
   trayMenu=Menu.buildFromTemplate([
    {label:text().open, click:showPanel}, {type:'separator'},
    ...favorites.filter(([,id])=>zones.some(z=>z.id===id)).map(([label,id])=>({label:preferences.getLanguage()==='en'?({'China Standard Time':'Beijing / Shanghai','Tokyo Standard Time':'Tokyo','GMT Standard Time':'London','Eastern Standard Time':'New York','Pacific Standard Time':'Los Angeles','UTC':'UTC'}[id]):label,type:'checkbox', checked:current?.id===id, click:async () => {
      if(switching) return; switching=true;
      try {const result=localize(await switchZone(id)); if(result.ok){zones=result.zones;updateMenu();panel.webContents.send('zones:refresh');notify(text().switched,preferences.getLanguage()==='en'?id:label);}else{showPanel();notify(text().failed,result.error);}} finally {switching=false;}
    }})),
    {type:'separator'}, {label:text().settings,click:()=>{panel.webContents.send('preferences:open');showPanel();}}, {label:text().system,click:()=>shell.openExternal('ms-settings:dateandtime')}, {label:text().quit,click:()=>{quitting=true;app.quit();}}
   ]);

  }
  await Promise.all([panel.loadFile(path.join(__dirname,'../dist/index.html')), firstPaint]);
  try {await refresh();} catch {updateMenu();}
  if(!process.argv.includes('--background')) await showPanel();
  // Read-only hooks used by the packaged-app integration check.
  if(process.argv.includes('--test-mode') || diagnostic) {
   global.trayCheck = () => ({tray:!!tray&&!tray.isDestroyed(), visible:panel.isVisible(), opacity:panel.getOpacity(), reducedMotion:systemPreferences.getAnimationSettings().prefersReducedMotion, fading:!!hideTask, current:zones.find(z=>z.current)?.id, menu:trayMenu.items.map(item=>item.label), bounds:panel.getBounds(), screen:screen.getDisplayMatching(panel.getBounds()).workArea});
   global.trayOpen = showPanel;
   global.trayHide = hidePanel;
  }
 }).catch(error => { console.error(error); app.quit(); });
}
function showPanel() {
 trace('show-request');
 if (!panel || panel.isDestroyed() || !tray) return Promise.resolve();
 if(showTask) return showTask;
 const wasFading=!!hideTask;
 cancelFade();
 if(wasFading && panel.isVisible()) {panel.setOpacity(1);panel.focus();return Promise.resolve();}
 if(panel.isVisible() && panel.getOpacity()===1) {panel.focus();return Promise.resolve();}
 clearTimeout(blurTimer);
 const generation=++presentationGeneration;
 showTask=presentPanel(generation).catch(error=>{trace('show-failed',{message:error.message});hidePanel(true);console.error(error);}).finally(()=>{showTask=null;});
 return showTask;
}
async function presentPanel(generation) {
 const bounds=tray.getBounds();
 const area=screen.getDisplayNearestPoint({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}).workArea;
 const width=456, height=696, gap=4;
 const x=area.x+area.width-width-gap;
 const y=area.y+area.height-height-gap;
 // Preserve already aligned native bounds: setting them again can round differently
 // at fractional DPI. Complete any necessary corrections before making the window visible.
 let actual=panel.getBounds();
 const aligned=Math.abs(actual.width-width)<=2 && Math.abs(actual.height-height)<=2 &&
  actual.x+actual.width===area.x+area.width-gap && actual.y+actual.height===area.y+area.height-gap;
 if(!aligned) panel.setBounds({x,y,width,height});
 for(let attempt=0;!aligned && attempt<3;attempt++) {
  const actual=panel.getBounds();
  const dx=area.x+area.width-gap-actual.x-actual.width;
  const dy=area.y+area.height-gap-actual.y-actual.height;
  if(dx===0&&dy===0) break;
  panel.setBounds({x:actual.x+dx,y:actual.y+dy,width,height});
 }
 // Keep the native surface invisible until Chromium has supplied a fresh frame.
 // ready-to-show only covers startup, not a transparent window being shown again.
 panel.setOpacity(0);
 panel.showInactive();
 panel.webContents.send('panel:activity',true);
 const frame=await panel.webContents.capturePage();
 if(generation!==presentationGeneration || panel.isDestroyed() || !panel.isVisible()) return;
 if(frame.isEmpty()) throw new Error('Window frame is not ready');
 trace('frame-ready');
 panel.setOpacity(1); panel.focus();
 trace('presented');
 panel.webContents.send('zones:refresh');
}
function cancelFade() {
 clearTimeout(fadeTimer);
 fadeTimer=null;
 const resolve=finishFade;
 finishFade=null;
 hideTask=null;
 if(resolve) resolve();
}
function hidePanel(immediate=false) {
 presentationGeneration++;
 clearTimeout(blurTimer);
 if(!panel || panel.isDestroyed() || !panel.isVisible()) return Promise.resolve();
 if(immediate || quitting || systemPreferences.getAnimationSettings().prefersReducedMotion || panel.getOpacity()===0) {
  cancelFade(); panel.setOpacity(0); panel.hide(); return Promise.resolve();
 }
 if(hideTask) return hideTask;
 const started=performance.now(), initialOpacity=panel.getOpacity(), duration=180;
 hideTask=new Promise(resolve=>{
  finishFade=resolve;
  function step() {
   if(panel.isDestroyed()) {cancelFade();return;}
   const progress=Math.min(1,(performance.now()-started)/duration);
   panel.setOpacity(initialOpacity*(1-progress)**3);
   if(progress===1) {panel.hide();cancelFade();return;}
   fadeTimer=setTimeout(step,16);
  }
  fadeTimer=setTimeout(step,16);
 });
 return hideTask;
}
function notify(title,body) { if(Notification.isSupported()) new Notification({title,body,silent:true}).show(); }
app.on('before-quit',()=>{quitting=true;cancelFade();if(tray)tray.destroy();});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
