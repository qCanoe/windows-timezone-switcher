import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const Seconds = createContext(Date.now())
const Minutes = createContext(Math.floor(Date.now() / 60000) * 60000)
const shortTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
const fullTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Only the seconds clock updates each second. City clocks update once per minute.
export function ClockProvider({ active, children }: { active: boolean; children: ReactNode }) {
 const [now, setNow] = useState(Date.now())
 useEffect(() => {
  if (!active) return
  setNow(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 1000)
  return () => clearInterval(timer)
 }, [active])
 return <Seconds.Provider value={now}><Minutes.Provider value={Math.floor(now / 60000) * 60000}>{children}</Minutes.Provider></Seconds.Provider>
}

export function Clock({ offset, seconds = false }: { offset: number; seconds?: boolean }) {
 const now = useContext(seconds ? Seconds : Minutes)
 return (seconds ? fullTime : shortTime).format(new Date(now + offset * 60000))
}
