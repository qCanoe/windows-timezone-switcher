const {app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, shell, Notification, systemPreferences} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {readZones, switchZone} = require('./zones.cjs');
let panel, tray, trayMenu, quitting = false, switching = false, zones = [];
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
  panel = new BrowserWindow({width:456, height:696, resizable:false, frame:false, thickFrame:false, transparent:true, roundedCorners:true, show:false, opacity:0, skipTaskbar:true, alwaysOnTop:true, backgroundColor:'#00000000', title:'时区切换', autoHideMenuBar:true, webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true}});
  const firstPaint = new Promise(resolve => panel.once('ready-to-show', resolve));
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
  tray.setToolTip('时区切换');
  tray.on('click', () => {trace('tray-click');if(!showTask) (hideTask || !panel.isVisible()) ? showPanel() : hidePanel();});
  tray.on('double-click', () => {trace('tray-double-click');showPanel();});
  async function refresh() { zones=await readZones(); updateMenu(); return zones; }
  function trusted(event) { return event.sender === panel.webContents && event.senderFrame === panel.webContents.mainFrame; }
  ipcMain.handle('zones:read', async event => {if (!trusted(event)) throw new Error('Invalid sender'); return refresh();});
  ipcMain.handle('zones:switch', async (event,id,elevated) => {
   if (!trusted(event)) throw new Error('Invalid sender');
   if (switching) return {ok:false,error:'正在切换，请稍候。'};
   if (typeof elevated !== 'boolean') return {ok:false,error:'无效请求。'};
   switching = true;
   try { const result=await switchZone(id,elevated); if(result.ok) {zones=result.zones; updateMenu(); if (!result.unchanged) notify('时区已切换', zones.find(z=>z.current).label);} return result; } finally {switching=false;}
  });
  ipcMain.on('panel:hide', event => {if(trusted(event)) hidePanel();});
  ipcMain.on('settings:open', event => {if(trusted(event)) shell.openExternal('ms-settings:dateandtime');});
  function updateMenu() {
   const current = zones.find(z=>z.current);
   if(current) tray.setToolTip(('时区切换 · ' + current.label).slice(0,127));
   trayMenu=Menu.buildFromTemplate([
    {label:'打开时区面板', click:showPanel}, {type:'separator'},
    ...favorites.filter(([,id])=>zones.some(z=>z.id===id)).map(([label,id])=>({label,type:'checkbox', checked:current?.id===id, click:async () => {
      if(switching) return; switching=true;
      try {const result=await switchZone(id); if(result.ok){zones=result.zones;updateMenu();panel.webContents.send('zones:refresh');notify('时区已切换',label);}else{showPanel();notify('切换未完成',result.error);}} finally {switching=false;}
    }})),
    {type:'separator'}, {label:'日期和时间设置',click:()=>shell.openExternal('ms-settings:dateandtime')}, {label:'退出',click:()=>{quitting=true;app.quit();}}
   ]);
   tray.setContextMenu(trayMenu);
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
