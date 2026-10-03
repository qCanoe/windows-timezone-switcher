const {_electron:electron,expect}=require('@playwright/test');
const path=require('node:path'),fs=require('node:fs');
const out=process.argv[3]||'baseline';
const ms=Number(process.env.BENCH_HIDDEN_MS||65000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const start=performance.now();
 const app=await electron.launch({executablePath:path.resolve(process.argv[2]),args:['--test-mode','--background',...(process.env.BENCH_NO_GPU?['--disable-gpu']:[])],cwd:__dirname,env:{...process.env,TIMEZONE_TRAY_TEST_DATA:path.join(__dirname,'perf-profile-'+out+'-'+Date.now())}});
 try {
  const page=await app.firstWindow();
  await expect.poll(()=>app.evaluate(()=>typeof global.trayCheck),{timeout:30000}).toBe('function');
  const readyMs=performance.now()-start;
  const metrics=()=>app.evaluate(({app})=>app.getAppMetrics().map(x=>({pid:x.pid,type:x.type,cpu:x.cpu,memory:x.memory})));
  const measure=async(duration)=>{
   const a=await metrics();const started=performance.now();const samples=[a];
   for(let i=0;i<Math.ceil(duration/5000);i++){await sleep(Math.min(5000,duration-i*5000));samples.push(await metrics());}
   const seconds=(performance.now()-started)/1000;const b=samples.at(-1);
   const cpuSeconds=b.reduce((sum,x)=>sum+(x.cpu.cumulativeCPUUsage-(a.find(v=>v.pid===x.pid)?.cpu.cumulativeCPUUsage||0)),0);
   return {seconds,cpuSeconds,oneCoreCpuPercent:cpuSeconds/seconds*100,samples:samples.map(s=>({workingSetMB:s.reduce((n,x)=>n+x.memory.workingSetSize,0)/1024,privateMB:s.reduce((n,x)=>n+x.memory.privateBytes,0)/1024})),processes:b};
  };
  await app.evaluate(()=>global.trayOpen());
  await page.getByRole('tab',{name:'全部时区'}).click();
  await sleep(2000);const open=await measure(10000);
  await page.evaluate(()=>{window.__perf={clockChanges:0};const el=document.querySelector('[aria-label="当前时间"]');window.__observer=new MutationObserver(()=>window.__perf.clockChanges++);window.__observer.observe(el,{childList:true,characterData:true,subtree:true})});
  await app.evaluate(()=>global.trayHide());
  const hidden=await measure(ms);
  const clockChanges=await page.evaluate(()=>window.__perf.clockChanges);
  const opens=[];for(let i=0;i<5;i++){let t=performance.now();await app.evaluate(()=>global.trayOpen());opens.push(performance.now()-t);await app.evaluate(()=>global.trayHide())}
  const result={readyMs,open,hidden,hiddenClockChanges:clockChanges,reopenMs:opens};
  fs.writeFileSync(path.resolve(__dirname,'../../outputs/时区托盘/performance-'+out+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({label:out,readyMs,open:open.samples,hidden:hidden.samples,openCpuPercent:open.oneCoreCpuPercent,hiddenCpuPercent:hidden.oneCoreCpuPercent,hiddenClockChanges:clockChanges,reopenMs:opens}));
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
