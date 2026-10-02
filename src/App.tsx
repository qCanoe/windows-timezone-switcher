import { useEffect, useState } from 'react'
import { Search, X, ArrowUpRight, Check, Loader2, Settings2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
type Zone = {id:string; label:string; offset:number; current:boolean}
type Result = {ok:boolean; error?:string; canElevate?:boolean; unchanged?:boolean; zones?:Zone[]}
declare global {interface Window {timezone:{read:()=>Promise<Zone[]>; switch:(id:string,elevated?:boolean)=>Promise<Result>; hide:()=>void; settings:()=>void; onRefresh:(fn:()=>void)=>()=>void}}}
const cities: Record<string,[string,string]> = {
 'China Standard Time':['北京 / 上海','Beijing · Shanghai'], 'Tokyo Standard Time':['东京','Tokyo'],
 'Singapore Standard Time':['新加坡','Singapore'], 'GMT Standard Time':['伦敦','London'],
 'W. Europe Standard Time':['巴黎 / 柏林','Paris · Berlin'], 'Eastern Standard Time':['纽约','New York'],
 'Pacific Standard Time':['洛杉矶','Los Angeles'], 'AUS Eastern Standard Time':['悉尼','Sydney'], 'UTC':['协调世界时','UTC']
}
function offset(n:number) {return `UTC${n<0?'−':'+'}${String(Math.floor(Math.abs(n)/60)).padStart(2,'0')}:${String(Math.abs(n)%60).padStart(2,'0')}`}
const shortTime=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'})
const fullTime=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',second:'2-digit'})
function time(now:number,z:Zone,seconds=false) {return (seconds?fullTime:shortTime).format(new Date(now+z.offset*60000))}
export default function App() {
 const [zones,setZones]=useState<Zone[]>([]), [query,setQuery]=useState(''), [tab,setTab]=useState('favorites')
 const [now,setNow]=useState(Date.now()), [selected,setSelected]=useState(''), [busy,setBusy]=useState(false)
 const [error,setError]=useState(''), [canElevate,setCanElevate]=useState(false), [success,setSuccess]=useState('')
 async function refresh() {try{setZones(await window.timezone.read());setError('')}catch{setError('无法读取本机时区。请点击刷新重试。')}}
 useEffect(()=>{void refresh(); const remove=window.timezone.onRefresh(()=>void refresh()); const timer=setInterval(()=>setNow(Date.now()),1000); const zoneTimer=setInterval(()=>void refresh(),60000); return()=>{remove();clearInterval(timer);clearInterval(zoneTimer)}},[])
 const current=zones.find(z=>z.current), target=zones.find(z=>z.id===selected)
 const filtered=zones.filter(z=>(query || tab==='all' || cities[z.id]) && `${cities[z.id]?.join(' ')||''} ${z.label} ${z.id} ${offset(z.offset)}`.toLowerCase().includes(query.toLowerCase().trim()))
 if(tab==='favorites' && !query) filtered.sort((a,b)=>Object.keys(cities).indexOf(a.id)-Object.keys(cities).indexOf(b.id))
 async function apply(elevated=false) {
  if(!target||busy)return;setBusy(true);setError('');setSuccess('');
  try {const result=await window.timezone.switch(target.id,elevated);if(result.ok){setZones(result.zones!);setCanElevate(false);setSuccess(result.unchanged?'当前已是这个时区':'已切换至 '+(cities[target.id]?.[0]||target.label)); if(!result.unchanged){setTimeout(()=>window.timezone.hide(),900)}}else{setError(result.error||'切换未完成');setCanElevate(!!result.canElevate)}}catch{setError('切换未完成，请重试。')}finally{setBusy(false)}
 }
 return <main className="window-shell flex flex-col overflow-hidden">
  <header className="drag flex h-14 shrink-0 items-center justify-between px-5"><div className="flex items-center gap-2.5"><span className="text-[15px] font-normal tracking-tight">时区切换</span></div><div className="no-drag flex items-center gap-1"><Button variant="ghost" size="icon" className="size-8 rounded-sm text-muted-foreground" aria-label="系统设置" title="系统设置" onClick={()=>window.timezone.settings()}><Settings2 className="size-4"/></Button><Button variant="ghost" size="icon" className="size-8 rounded-sm text-muted-foreground" aria-label="收起到托盘" title="收起到托盘" onClick={()=>window.timezone.hide()}><X className="size-4"/></Button></div></header>
  <section className="px-5 pb-5 pt-2"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">当前时区</span><span className="text-[11px] tabular-nums text-muted-foreground">{current?offset(current.offset):'UTC'}</span></div><div className="flex items-center justify-between gap-3"><div className="min-w-0 truncate text-[18px] font-semibold tracking-tight" title={current?.label}>{current?(cities[current.id]?.[0]||current.label.replace(/^\(.*?\)\s*/,'')):'正在读取…'}</div><div className="shrink-0 text-[28px] font-medium leading-none tracking-tight tabular-nums" aria-label="当前时间">{current?time(now,current,true):'--:--:--'}</div></div></section>
  <Separator/>
  <div className="relative mx-5 border-b transition-colors focus-within:border-foreground"><Search className="absolute left-0 top-4 size-4 text-muted-foreground"/><Input aria-label="搜索时区" placeholder="搜索城市或时区…" className="h-12 rounded-none border-0 bg-transparent pl-7 pr-8 text-[13px] shadow-none placeholder:text-muted-foreground focus-visible:ring-0" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/>{query&&<Button variant="ghost" size="icon" aria-label="清空搜索" className="absolute right-0 top-2 size-8 rounded-sm text-muted-foreground" disabled={busy} onClick={()=>setQuery('')}><X className="size-3.5"/></Button>}</div>
  <div className="mx-5 mb-2 mt-2 flex items-center justify-between"><Tabs value={tab} onValueChange={setTab}><TabsList variant="line" className="h-10 gap-5 rounded-none bg-transparent p-0"><TabsTrigger value="favorites" className="h-9 rounded-none border-0 px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none">常用</TabsTrigger><TabsTrigger value="all" className="h-9 rounded-none border-0 px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none">全部时区</TabsTrigger></TabsList></Tabs><span className="text-[11px] tabular-nums text-muted-foreground">{filtered.length} 个时区</span></div>
  <div className="min-h-0 flex-1 overflow-y-auto py-1" role="list" aria-label="时区列表">
   {!zones.length&&!error&&<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>正在读取时区</div>}
   {!!zones.length&&!filtered.length&&<div className="py-12 text-center text-sm text-muted-foreground">没有找到匹配的时区</div>}
   {filtered.map(z=><Button key={z.id} variant="ghost" disabled={busy} aria-pressed={selected===z.id} title={z.label} onClick={()=>{setSelected(z.id);setError('');setCanElevate(false);setSuccess('')}} className={`h-14 w-full justify-between gap-3 rounded-none border-l-2 pl-[18px] pr-5 text-left font-normal transition-colors focus-visible:ring-inset ${selected===z.id?'border-l-foreground bg-muted hover:bg-muted':'border-l-transparent hover:bg-muted/60'}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className="max-w-[278px] truncate text-[13px] font-medium leading-5">{cities[z.id]?.[0]||z.label.replace(/^\(.*?\)\s*/,'')}</span>{z.current&&<Check className="size-3.5 shrink-0 text-muted-foreground" aria-label="当前时区"/>}</div><div className="mt-0.5 max-w-[278px] truncate text-[11px] leading-4 text-muted-foreground">{cities[z.id]?.[1]||z.id}<span className="mx-1.5 opacity-50">·</span>{offset(z.offset)}</div></div><span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">{time(now,z)}</span></Button>)}
  </div>
  <Separator/>
  <footer className="shrink-0 bg-card p-5 pt-4">
   {error&&<div role="alert" className="mb-3 text-xs leading-relaxed text-destructive">{error}{canElevate&&<Button variant="outline" size="sm" className="mt-2 w-full" disabled={busy} onClick={()=>void apply(true)}>以管理员权限重试</Button>}{!zones.length&&<Button variant="outline" size="sm" className="ml-2" onClick={()=>void refresh()}><RotateCw className="size-3"/>刷新</Button>}</div>}
   {success&&<div role="status" className="mb-3 text-xs text-primary">{success}</div>}
   <Button className="h-10 w-full rounded-sm text-[13px] font-medium shadow-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100" disabled={!target||target.current||busy} onClick={()=>void apply()}>{busy?<><Loader2 className="size-4 animate-spin"/>正在切换…</>:<>切换时区 <ArrowUpRight className="size-4"/></>}</Button>
  </footer>
 </main>
}
