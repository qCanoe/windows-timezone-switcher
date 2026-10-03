const fs = require('node:fs');
const path = require('node:path');

function createPreferences(app, name = 'WindowsTimezoneSwitcher') {
 const file = path.join(app.getPath('userData'), 'preferences.json');
 const loginOptions = {path:'"'+process.execPath+'"', args:['--background']};
 let language = 'zh';
 try {const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.language==='en') language='en';} catch {}
 function read() {
  const login=app.isPackaged ? app.getLoginItemSettings(loginOptions) : null;
  return {language, autoStart:!!login?.launchItems.some(item=>item.name===name && item.scope==='user' && item.enabled), startupSupported:app.isPackaged};
 }
 function setStartup(enabled) {
  app.setLoginItemSettings({...loginOptions,name,openAtLogin:enabled,enabled});
  if(read().autoStart!==enabled) throw new Error('startup_failed');
 }
 function update(patch) {
  if(!patch || typeof patch!=='object' || Array.isArray(patch) || !Object.keys(patch).length ||
   Object.keys(patch).some(key=>!['language','autoStart'].includes(key)) ||
   ('language' in patch && !['zh','en'].includes(patch.language)) ||
   ('autoStart' in patch && typeof patch.autoStart!=='boolean')) throw new Error('invalid_preferences');
  const before=read();
  if('autoStart' in patch && !app.isPackaged) throw new Error('startup_unavailable');
  try {
   if('autoStart' in patch) setStartup(patch.autoStart);
   if('language' in patch) {
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file+'.tmp',JSON.stringify({language:patch.language}), 'utf8');
    fs.renameSync(file+'.tmp',file);
    language=patch.language;
   }
   return read();
  } catch(error) {
   if('autoStart' in patch) {try{setStartup(before.autoStart);}catch{}}
   throw error.message==='startup_failed' ? error : new Error('save_failed');
  }
 }
 return {read,update,getLanguage:()=>language};
}
module.exports={createPreferences};

