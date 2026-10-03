const {_electron:electron,expect} = require('@playwright/test');
const assert = require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const executablePath=process.argv[2] || require('electron');
 const packaged=!!process.argv[2];
 const profile=path.join(__dirname,'light-check-profile-'+Date.now());
 fs.mkdirSync(profile,{recursive:true});
 fs.writeFileSync(path.join(profile,'theme.json'),JSON.stringify({theme:'dark'}));
 const app=await electron.launch({executablePath,args:packaged?['--test-mode']:['.','--test-mode'],cwd:__dirname,env:{...process.env,TIMEZONE_TRAY_TEST_DATA:profile}});
 try {
  const page=await app.firstWindow();
  await expect.poll(()=>app.evaluate(()=>typeof global.trayCheck),{timeout:30000}).toBe('function');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'北京 / 上海',exact:false}).waitFor({timeout:30000});
  assert.equal(await page.getByRole('list').getByRole('button').count(),9);
  const initialBorders=await page.getByRole('list').getByRole('button').evaluateAll(rows=>rows.map(row=>getComputedStyle(row).borderLeftColor));
  assert.ok(initialBorders.every(color=>color==='rgba(0, 0, 0, 0)'));
  const native=await app.evaluate(()=>global.trayCheck());assert.equal(native.tray,true);
  assert.equal(native.menu.includes('外观'),false);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('main')).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(native.bounds.x+native.bounds.width,native.screen.x+native.screen.width-4);
  assert.equal(native.bounds.y+native.bounds.height,native.screen.y+native.screen.height-4);
  assert.equal(await page.getByText('关闭面板后，程序仍在托盘运行').count(),0);
  await page.getByRole('button',{name:'设置',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索时区'}).fill('Tokyo');
  assert.equal(await page.getByRole('list').getByRole('button').count(),1);
  await page.getByRole('list').getByRole('button').click();
  await expect(page.getByRole('list').getByRole('button')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('list').getByRole('button')).toHaveCSS('border-left-color','rgb(23, 23, 23)');
  assert.equal(await page.getByRole('button',{name:'切换时区',exact:false}).isEnabled(),true);
  await page.getByRole('button',{name:'清空搜索'}).click();
  await expect(page.getByRole('textbox',{name:'搜索时区'})).toHaveValue('');
  await page.getByRole('textbox',{name:'搜索时区'}).fill('no-such-zone-xyz');
  await page.getByText('没有找到匹配的时区').waitFor();
  await page.getByRole('textbox',{name:'搜索时区'}).fill('');
  await page.getByRole('tab',{name:'全部时区'}).click();
  assert.ok(await page.getByRole('list').getByRole('button').count()>100);
  await page.getByRole('tab',{name:'常用',exact:true}).click();
  const inactiveBorders=await page.getByRole('list').getByRole('button').evaluateAll(rows=>rows.filter(row=>row.getAttribute('aria-pressed')==='false').map(row=>getComputedStyle(row).borderLeftColor));
  assert.ok(inactiveBorders.every(color=>color==='rgba(0, 0, 0, 0)'));
  await page.screenshot({path:path.resolve(__dirname,'../../outputs/时区托盘/浅色预览.png'),omitBackground:true});
  await page.screenshot({path:path.resolve(__dirname,'../../outputs/时区托盘/界面预览.png'),omitBackground:true});
  const checks=await page.evaluate(async()=>{
   const zones=await window.timezone.read();const id=zones.find(z=>z.current).id;
   const invalid=await window.timezone.switch('bad-zone');
   const same=await window.timezone.switch(id);
   return {invalid:invalid.ok,same:same.ok,unchanged:same.unchanged,current:same.zones.find(z=>z.current).id};
  });
  assert.equal(checks.invalid,false);assert.equal(checks.same,true);assert.equal(checks.unchanged,true);assert.equal(checks.current,native.current);
  await page.getByRole('list').getByRole('button').filter({hasText:'北京 / 上海'}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[aria-pressed="true"]')).some(el=>el.textContent.includes('北京 / 上海')));
  assert.equal(await page.getByRole('button',{name:'切换时区',exact:false}).isEnabled(),false);
  const overflow=await page.evaluate(()=>document.documentElement.scrollHeight>window.innerHeight);assert.equal(overflow,false);
  await page.getByRole('button',{name:'收起到托盘'}).click();
  await expect.poll(()=>app.evaluate(()=>global.trayCheck().visible)).toBe(false);
  const hidden=await app.evaluate(()=>global.trayCheck());assert.equal(hidden.visible,false);assert.equal(hidden.tray,true);
  await app.evaluate(async ({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setPosition(40,40);await global.trayOpen();});
  const reopened=await app.evaluate(()=>global.trayCheck());
  assert.equal(reopened.bounds.x+reopened.bounds.width,reopened.screen.x+reopened.screen.width-4);
  assert.equal(reopened.bounds.y+reopened.bounds.height,reopened.screen.y+reopened.screen.height-4);
  const reopenTrace=await app.evaluate(async ({BrowserWindow})=>{
   const window=BrowserWindow.getAllWindows()[0];
   window.hide();
   const changes=[];
   const original=window.setBounds.bind(window);
   window.setBounds=(...args)=>{changes.push({visible:window.isVisible()});return original(...args);};
   try {
    window.setPosition(40,40);
    for(let i=0;i<5;i++){await global.trayOpen();if(window.getOpacity()!==1)throw new Error('Window was not revealed');window.hide();}
    return changes;
   } finally {window.setBounds=original;await global.trayOpen();}
  });
  assert.ok(reopenTrace.every(change=>!change.visible),'Window moved after it was shown');
  const stableBounds=await app.evaluate(()=>global.trayCheck());
  assert.deepEqual(stableBounds.bounds,reopened.bounds);
  const fadeCheck=await app.evaluate(async ({BrowserWindow,systemPreferences})=>{
   const window=BrowserWindow.getAllWindows()[0];
   const values=[], original=window.setOpacity.bind(window);
   window.setOpacity=value=>{values.push(value);return original(value);};
   const reduced=systemPreferences.getAnimationSettings().prefersReducedMotion;
   try {
    const start=performance.now();await global.trayHide();
    const duration=performance.now()-start;
    const hidden=!window.isVisible();
    await global.trayOpen();
    const pending=global.trayHide();
    await new Promise(resolve=>setTimeout(resolve,50));
    await global.trayOpen();await pending;
    await new Promise(resolve=>setTimeout(resolve,220));
    return {values,duration,reduced,hidden,reopened:window.isVisible()&&window.getOpacity()===1,tray:global.trayCheck().tray};
   } finally {window.setOpacity=original;}
  });
  assert.equal(fadeCheck.hidden,true);assert.equal(fadeCheck.tray,true);assert.equal(fadeCheck.reopened,true);
  if(!fadeCheck.reduced) {
   assert.ok(fadeCheck.values.some(value=>value>0&&value<1),'Fade did not use intermediate opacity');
   assert.ok(fadeCheck.duration>=150&&fadeCheck.duration<1000,'Fade duration is unexpected');
  }
  const reducedMotionCheck=await app.evaluate(async ({BrowserWindow,systemPreferences})=>{
   const window=BrowserWindow.getAllWindows()[0];
   const settings=systemPreferences.getAnimationSettings;
   systemPreferences.getAnimationSettings=()=>({...settings.call(systemPreferences),prefersReducedMotion:true});
   try {await global.trayHide();return !window.isVisible()&&!global.trayCheck().fading;}
   finally {systemPreferences.getAnimationSettings=settings;await global.trayOpen();}
  });
  assert.equal(reducedMotionCheck,true);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  assert.equal((await app.evaluate(()=>global.trayCheck())).tray,true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({packaged,fadeOut:true,reopenDuringFade:true,noVisibleRepositionOnFiveReopens:true,workAreaBottomRightOnOpenAndReopen:true,fixedLightIgnoresOldDarkPreference:true,themeMenuRemoved:true,search:true,clearSearch:true,selection:true,tray:true,hide:true,closeKeepsRunning:true,unchangedZone:checks.current,renderErrors:errors}));
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
