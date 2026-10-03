const {_electron:electron,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const executablePath=path.resolve(process.argv[2]);
const profile=path.join(__dirname,'settings-check-profile-'+Date.now());
const launch=()=>electron.launch({executablePath,args:['--test-mode','--background'],cwd:__dirname,env:{...process.env,TIMEZONE_TRAY_TEST_DATA:profile}});
(async()=>{
 let app;
 try {
  app=await launch();let page=await app.firstWindow();
  await expect.poll(()=>app.evaluate(()=>typeof global.trayCheck),{timeout:30000}).toBe('function');
  assert.equal((await app.evaluate(()=>global.trayCheck())).visible,false);
  await app.evaluate(()=>global.trayOpen());
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('radio',{name:'English',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Interface language'})).toBeVisible();
  assert.ok((await app.evaluate(()=>global.trayCheck())).menu.includes('Settings'));
  const toggle=page.getByRole('switch',{name:'Launch at login'});
  await expect(toggle).toHaveAttribute('aria-checked','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked','true');
  const startup=await app.evaluate(({app})=>app.getLoginItemSettings({path:'"'+process.execPath+'"',args:['--background']}));
  assert.equal(startup.executableWillLaunchAtLogin,true);
  const command=require('node:child_process').execFileSync('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','/v','WindowsTimezoneSwitcher.Test'],{encoding:'utf8'});
  assert.ok(command.includes('--background'));
  await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');
  const removed=(()=>{try{require('node:child_process').execFileSync('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','/v','WindowsTimezoneSwitcher.Test'],{stdio:'ignore'});return false}catch{return true}})();
  assert.equal(removed,true);
  await page.screenshot({path:path.resolve(__dirname,'../../outputs/时区托盘/设置英文预览.png'),omitBackground:true,animations:'disabled'});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Search time zones'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Favorites',exact:true})).toBeVisible();
  await app.close();app=null;
  app=await launch();page=await app.firstWindow();
  await expect.poll(()=>app.evaluate(()=>typeof global.trayCheck),{timeout:30000}).toBe('function');
  await app.evaluate(()=>global.trayOpen());
  await expect(page.getByRole('textbox',{name:'Search time zones'})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('switch',{name:'Launch at login'})).toHaveAttribute('aria-checked','false');
  await page.getByRole('radio',{name:'简体中文',exact:true}).click();
  await expect(page.getByRole('heading',{name:'界面语言'})).toBeVisible();
  await expect(page.getByRole('radio',{name:'简体中文',exact:true})).toHaveAttribute('aria-checked','true');
  await expect(page.getByRole('radio',{name:'简体中文',exact:true})).toBeEnabled();
  await page.screenshot({path:path.resolve(__dirname,'../../outputs/时区托盘/设置预览.png'),omitBackground:true,animations:'disabled'});
  const invalid=await page.evaluate(()=>window.timezone.updatePreferences({language:'bad'}));assert.equal(invalid.ok,false);
  console.log(JSON.stringify({languageSwitch:true,trayTranslated:true,persistedAfterRestart:true,realWindowsStartupAddedAndRemoved:true,backgroundLaunchHidden:true,invalidInputRejected:true}));
 } finally {
  if(app){await app.evaluate(({app})=>app.setLoginItemSettings({path:process.execPath,args:['--background'],name:'WindowsTimezoneSwitcher.Test',openAtLogin:false})).catch(()=>{});await app.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
