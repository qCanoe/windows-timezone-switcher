const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const run = promisify(execFile);
const windows = process.env.SystemRoot || 'C:\\Windows';
const powershell = path.join(windows, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const tzutil = path.join(windows, 'System32/tzutil.exe');
const ps = command => run(powershell, ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); ' + command], {windowsHide:true, encoding:'utf8', timeout:20000, maxBuffer:1024*1024});
let allowed = new Set(), cached, cachedAt=0, pending;
async function readZones(force = false) {
  // Concurrent startup/UI requests share one operation; hidden panels never poll.
  // Verification after a change must not reuse a query started before that change.
  if(force && pending) {try{await pending;}catch{}return readZones(true);}
  if(pending) return pending;
  pending=(async()=>{
   if(!force && cached && Date.now()-cachedAt<55000) {
    const {stdout}=await run(tzutil,['/g'],{windowsHide:true,encoding:'utf8',timeout:5000});
    const id=stdout.trim();
    if(cached.some(z=>z.id===id)) {
     cached=cached.map(z=>({...z,current:z.id===id}));
     return cached;
    }
   }
   return loadZones();
  })();
  try {return await pending;} finally {pending=null;}
}
async function loadZones() {
  const {stdout} = await ps('[System.TimeZoneInfo]::ClearCachedData(); $now=[DateTimeOffset]::UtcNow; $current=[System.TimeZoneInfo]::Local.Id; $zones=@([System.TimeZoneInfo]::GetSystemTimeZones() | ForEach-Object { [pscustomobject]@{ id=$_.Id; label=$_.DisplayName; offset=$_.GetUtcOffset($now).TotalMinutes; current=($_.Id -eq $current) } }); ConvertTo-Json -Compress -InputObject $zones');
  const zones = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  if (!Array.isArray(zones) || !zones.length || !zones.some(z => z.current)) throw new Error('无法读取 Windows 时区。');
  allowed = new Set(zones.map(z => z.id));
  cached=zones;cachedAt=Date.now();
  return zones;
}
async function switchZone(id, elevated = false) {
  if (typeof id !== 'string' || !allowed.has(id)) return {ok:false, error:'无效的时区。'};
  try {
    const before = await readZones();
    if (before.find(z => z.current).id === id) return {ok:true, unchanged:true, zones:before};
    if (elevated) {
      const escaped = id.replace(/'/g, "''");
      const {stdout} = await ps(`$ErrorActionPreference='Stop'; $p=Start-Process -FilePath '${tzutil.replace(/'/g,"''")}' -ArgumentList '/s','"${escaped}"' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; Write-Output $p.ExitCode`);
      if (Number(stdout.trim()) !== 0) throw new Error('Windows 未能应用时区。');
    } else {
      await run(tzutil, ['/s', id], {windowsHide:true, timeout:15000});
    }
    const zones = await readZones(true);
    if (zones.find(z => z.current).id !== id) return {ok:false, error:'时区未生效，请检查“自动设置时区”或设备管理策略。'};
    return {ok:true, zones};
  } catch (error) {
    return {ok:false, canElevate:!elevated, error:elevated ? '切换未完成：权限请求可能已取消，或设备策略限制了修改。' : 'Windows 未能切换时区，可以用管理员权限重试。'};
  }
}
module.exports = {readZones, switchZone};
