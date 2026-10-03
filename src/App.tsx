import { useEffect, useState } from 'react'
import { Search, X, ArrowUpRight, Check, Loader2, Settings2, RotateCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Clock, ClockProvider } from '@/components/clock'
type Preferences = {language:'zh'|'en'; autoStart:boolean; startupSupported:boolean}
type Zone = {id:string; label:string; offset:number; current:boolean}
type Result = {ok:boolean; error?:string; canElevate?:boolean; unchanged?:boolean; zones?:Zone[]}
declare global {interface Window {timezone:{onActivity:(fn:(active:boolean)=>void)=>()=>void; preferences:Preferences; readPreferences:()=>Promise<Preferences>; updatePreferences:(patch:Partial<Preferences>)=>Promise<{ok:boolean;preferences?:Preferences;error?:string}>; onOpenPreferences:(fn:()=>void)=>()=>void; read:()=>Promise<Zone[]>; switch:(id:string,elevated?:boolean)=>Promise<Result>; hide:()=>void; settings:()=>void; onRefresh:(fn:()=>void)=>()=>void}}}
const cities: Record<string,[string,string]> = {
 'China Standard Time':['北京 / 上海','Beijing · Shanghai'], 'Tokyo Standard Time':['东京','Tokyo'],
 'Singapore Standard Time':['新加坡','Singapore'], 'GMT Standard Time':['伦敦','London'],
 'W. Europe Standard Time':['巴黎 / 柏林','Paris · Berlin'], 'Eastern Standard Time':['纽约','New York'],
 'Pacific Standard Time':['洛杉矶','Los Angeles'], 'AUS Eastern Standard Time':['悉尼','Sydney'], 'UTC':['协调世界时','UTC']
}
function offset(n:number) {return `UTC${n<0?'−':'+'}${String(Math.floor(Math.abs(n)/60)).padStart(2,'0')}:${String(Math.abs(n)%60).padStart(2,'0')}`}
export default function App() {
 const [prefs,setPrefs]=useState<Preferences>(window.timezone.preferences), [settingsPage,setSettingsPage]=useState(false), [saving,setSaving]=useState(false), [settingsError,setSettingsError]=useState('')
 const en=prefs.language==='en'
 const tr=(zh:string,english:string)=>en?english:zh
 const name=(z:Zone)=>cities[z.id]?.[en?1:0]||(en?z.id:z.label.replace(/^\(.*?\)\s*/,''))
 useEffect(()=>window.timezone.onOpenPreferences(()=>setSettingsPage(true)),[])
 useEffect(()=>{document.documentElement.lang=en?'en':'zh-CN';document.title=tr('时区切换','Time zone switcher')},[en])
 async function save(patch:Partial<Preferences>) {
  setSaving(true);setSettingsError('')
  try {const result=await window.timezone.updatePreferences(patch);if(result.ok&&result.preferences){setPrefs(result.preferences);setError('');setSuccess('')}else setSettingsError(result.error||tr('设置未能保存，请重试。','Could not save this setting. Please try again.'))}
  catch {setSettingsError(tr('设置未能保存，请重试。','Could not save this setting. Please try again.'))}
  finally {setSaving(false)}
 }

 const [zones,setZones]=useState<Zone[]>([]), [query,setQuery]=useState(''), [tab,setTab]=useState('favorites')
 const [active,setActive]=useState(false), [selected,setSelected]=useState(''), [busy,setBusy]=useState(false)
 const [error,setError]=useState(''), [canElevate,setCanElevate]=useState(false), [success,setSuccess]=useState('')
 async function refresh() {try{setZones(await window.timezone.read());setError('')}catch{setError(tr('无法读取本机时区。请点击刷新重试。','Could not load time zones. Refresh to try again.'))}}
 useEffect(()=>window.timezone.onActivity(setActive),[])
 useEffect(()=>{const remove=window.timezone.onRefresh(()=>{if(active)void refresh()});if(!active||settingsPage)return remove;void refresh();const zoneTimer=setInterval(()=>void refresh(),60000);return()=>{remove();clearInterval(zoneTimer)}},[active,settingsPage,en])
 const current=zones.find(z=>z.current), target=zones.find(z=>z.id===selected)
 const filtered=zones.filter(z=>(query || tab==='all' || cities[z.id]) && `${cities[z.id]?.join(' ')||''} ${z.label} ${z.id} ${offset(z.offset)}`.toLowerCase().includes(query.toLowerCase().trim()))
 if(tab==='favorites' && !query) filtered.sort((a,b)=>Object.keys(cities).indexOf(a.id)-Object.keys(cities).indexOf(b.id))
 async function apply(elevated=false) {
  if(!target||busy)return;setBusy(true);setError('');setSuccess('');
  try {const result=await window.timezone.switch(target.id,elevated);if(result.ok){setZones(result.zones!);setCanElevate(false);setSuccess(result.unchanged?tr('当前已是这个时区','This time zone is already active'):tr('已切换至 ','Switched to ')+name(target)); if(!result.unchanged){setTimeout(()=>window.timezone.hide(),900)}}else{setError(result.error||tr('切换未完成','Unable to switch'));setCanElevate(!!result.canElevate)}}catch{setError(tr('切换未完成，请重试。','Unable to switch. Please try again.'))}finally{setBusy(false)}
 }
 return <ClockProvider active={active&&!settingsPage}><main className="window-shell flex flex-col overflow-hidden">
  <header className="drag flex h-14 shrink-0 items-center justify-between px-5"><div className="flex items-center gap-2.5">{settingsPage&&<Button variant="ghost" size="icon" className="no-drag -ml-2 size-8 rounded-sm" aria-label={tr('返回','Back')} onClick={()=>setSettingsPage(false)}><ArrowLeft className="size-4"/></Button>}<span className="text-[15px] font-normal tracking-tight">{settingsPage?tr('设置','Settings'):tr('时区切换','Time zone switcher')}</span></div><div className="no-drag flex items-center gap-1"><Button variant="ghost" size="icon" className="size-8 rounded-sm text-muted-foreground" aria-label={tr('设置','Settings')} title={tr('设置','Settings')} disabled={busy||settingsPage} onClick={()=>setSettingsPage(true)}><Settings2 className="size-4"/></Button><Button variant="ghost" size="icon" className="size-8 rounded-sm text-muted-foreground" aria-label={tr('收起到托盘','Hide to tray')} title={tr('收起到托盘','Hide to tray')} onClick={()=>window.timezone.hide()}><X className="size-4"/></Button></div></header>
  {settingsPage?<section className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-3" aria-label={tr('应用设置','App settings')}>
   <div className="border-b pb-6">
    <h2 className="text-[13px] font-medium">{tr('界面语言','Interface language')}</h2>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{tr('选择你习惯使用的语言。','Choose your preferred language.')}</p>
    <div className="mt-4 flex gap-2" role="radiogroup" aria-label={tr('界面语言','Interface language')}>
     {(['zh','en'] as const).map(language=><Button key={language} role="radio" aria-checked={prefs.language===language} variant={prefs.language===language?'default':'outline'} disabled={saving} className="h-9 flex-1 rounded-sm text-xs shadow-none" onClick={()=>void save({language})}>{language==='zh'?'简体中文':'English'}</Button>)}
    </div>
   </div>
   <div className="flex items-start justify-between gap-5 border-b py-6">
    <div><h2 id="startup-label" className="text-[13px] font-medium">{tr('开机自动启动','Launch at login')}</h2><p id="startup-description" className="mt-1 max-w-[290px] text-xs leading-5 text-muted-foreground">{tr('登录 Windows 后，在托盘后台运行。','Start in the tray when you sign in to Windows.')}</p>{!prefs.startupSupported&&<p className="mt-2 text-xs text-muted-foreground">{tr('请在正式程序中设置此选项。','Available in the packaged app.')}</p>}</div>
    <button type="button" role="switch" aria-labelledby="startup-label" aria-describedby="startup-description" aria-checked={prefs.autoStart} disabled={saving||!prefs.startupSupported} onClick={()=>void save({autoStart:!prefs.autoStart})} className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${prefs.autoStart?'bg-foreground':'bg-neutral-300'}`}><span className={`size-4 rounded-full bg-white shadow-sm transition-transform ${prefs.autoStart?'translate-x-4':'translate-x-0'}`}/></button>
   </div>
   {settingsError&&<p role="alert" className="mt-4 text-xs leading-5 text-destructive">{settingsError}</p>}
   <div className="mt-auto pt-6"><Button variant="ghost" className="h-9 w-full justify-between rounded-sm px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={()=>window.timezone.settings()}>{tr('日期和时间设置','Date & time settings')}<ArrowUpRight className="size-3.5"/></Button></div>
  </section>:<>
  <section className="px-5 pb-5 pt-2"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{tr('当前时区','Current time zone')}</span><span className="text-[11px] tabular-nums text-muted-foreground">{current?offset(current.offset):'UTC'}</span></div><div className="flex items-center justify-between gap-3"><div className="min-w-0 truncate text-[18px] font-semibold tracking-tight" title={current?.label}>{current?name(current):tr('正在读取…','Loading…')}</div><div className="shrink-0 text-[28px] font-medium leading-none tracking-tight tabular-nums" aria-label={tr('当前时间','Current time')}>{current?<Clock offset={current.offset} seconds/>:'--:--:--'}</div></div></section>
  <Separator/>
  <div className="relative mx-5 border-b transition-colors focus-within:border-foreground"><Search className="absolute left-0 top-4 size-4 text-muted-foreground"/><Input aria-label={tr('搜索时区','Search time zones')} placeholder={tr('搜索城市或时区…','Search cities or time zones…')} className="h-12 rounded-none border-0 bg-transparent pl-7 pr-8 text-[13px] shadow-none placeholder:text-muted-foreground focus-visible:ring-0" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/>{query&&<Button variant="ghost" size="icon" aria-label={tr('清空搜索','Clear search')} className="absolute right-0 top-2 size-8 rounded-sm text-muted-foreground" disabled={busy} onClick={()=>setQuery('')}><X className="size-3.5"/></Button>}</div>
  <div className="mx-5 mb-2 mt-2 flex items-center justify-between"><Tabs value={tab} onValueChange={setTab}><TabsList variant="line" className="h-10 gap-5 rounded-none bg-transparent p-0"><TabsTrigger value="favorites" className="h-9 rounded-none border-0 px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none">{tr('常用','Favorites')}</TabsTrigger><TabsTrigger value="all" className="h-9 rounded-none border-0 px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none">{tr('全部时区','All time zones')}</TabsTrigger></TabsList></Tabs><span className="text-[11px] tabular-nums text-muted-foreground">{filtered.length} {tr('个时区','time zones')}</span></div>
  <div className="min-h-0 flex-1 overflow-y-auto py-1" role="list" aria-label={tr('时区列表','Time zone list')}>
   {!zones.length&&!error&&<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>{tr('正在读取时区','Loading time zones')}</div>}
   {!!zones.length&&!filtered.length&&<div className="py-12 text-center text-sm text-muted-foreground">{tr('没有找到匹配的时区','No matching time zones')}</div>}
   {filtered.map(z=><Button key={z.id} variant="ghost" disabled={busy} aria-pressed={selected===z.id} title={z.label} onClick={()=>{setSelected(z.id);setError('');setCanElevate(false);setSuccess('')}} className={`h-14 w-full justify-between gap-3 rounded-none border-l-2 pl-[18px] pr-5 text-left font-normal transition-colors focus-visible:ring-inset ${selected===z.id?'border-l-foreground bg-muted hover:bg-muted':'border-l-transparent hover:bg-muted/60'}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className="max-w-[278px] truncate text-[13px] font-medium leading-5">{name(z)}</span>{z.current&&<Check className="size-3.5 shrink-0 text-muted-foreground" aria-label={tr('当前时区','Current time zone')}/>}</div><div className="mt-0.5 max-w-[278px] truncate text-[11px] leading-4 text-muted-foreground">{en?z.id:(cities[z.id]?.[1]||z.id)}<span className="mx-1.5 opacity-50">·</span>{offset(z.offset)}</div></div><span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">{<Clock offset={z.offset}/> }</span></Button>)}
  </div>
  <Separator/>
  <footer className="shrink-0 bg-card p-5 pt-4">
   {error&&<div role="alert" className="mb-3 text-xs leading-relaxed text-destructive">{error}{canElevate&&<Button variant="outline" size="sm" className="mt-2 w-full" disabled={busy} onClick={()=>void apply(true)}>{tr('以管理员权限重试','Retry as administrator')}</Button>}{!zones.length&&<Button variant="outline" size="sm" className="ml-2" onClick={()=>void refresh()}><RotateCw className="size-3"/>{tr('刷新','Refresh')}</Button>}</div>}
   {success&&<div role="status" className="mb-3 text-xs text-primary">{success}</div>}
   <Button className="h-10 w-full rounded-sm text-[13px] font-medium shadow-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100" disabled={!target||target.current||busy} onClick={()=>void apply()}>{busy?<><Loader2 className="size-4 animate-spin"/>{tr('正在切换…','Switching…')}</>:<>{tr('切换时区','Switch time zone')} <ArrowUpRight className="size-4"/></>}</Button>
  </footer></> }
 </main></ClockProvider>
}
