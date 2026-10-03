const assert=require('node:assert/strict');
const child=require('node:child_process'),{promisify}=require('node:util');
const original=child.execFile,oldNow=Date.now;
let clock=oldNow(),current='A',powershellCalls=0,fail=false;
function fake(){}
fake[promisify.custom]=async(file,args)=>{
 await new Promise(resolve=>setTimeout(resolve,5));
 if(file.endsWith('tzutil.exe'))return {stdout:current+'\r\n'};
 powershellCalls++;if(fail)throw new Error('Read failed');
 return {stdout:JSON.stringify([{id:'A',label:'A',offset:0,current:current==='A'},{id:'B',label:'B',offset:60,current:current==='B'}])};
};
child.execFile=fake;Date.now=()=>clock;
const {readZones,switchZone}=require('./electron/zones.cjs');
(async()=>{try{
 await Promise.all(Array.from({length:10},()=>readZones()));assert.equal(powershellCalls,1);
 current='B';assert.equal((await readZones()).find(z=>z.current).id,'B');assert.equal(powershellCalls,1);
 clock+=56000;await readZones();assert.equal(powershellCalls,2);
 assert.equal((await switchZone('not-a-zone')).ok,false);
 assert.equal((await switchZone('B')).unchanged,true);
 await Promise.all([readZones(),readZones(true)]);assert.equal(powershellCalls,3);
 fail=true;await assert.rejects(()=>readZones(true));fail=false;await readZones(true);assert.equal(powershellCalls,5);
 console.log(JSON.stringify({concurrentReadsDeduplicated:true,cachedReadDetectsExternalChange:true,expiryRefresh:true,unchangedSwitch:true,invalidIdRejected:true,recoveryAfterFailure:true}));
}finally{child.execFile=original;Date.now=oldNow}})().catch(e=>{console.error(e);process.exitCode=1});
