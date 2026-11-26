import { createContext, useContext, useState, type ReactNode, type ComponentType } from 'react'
import Link from 'next/link'
import { hostHref, type HostScreenId } from './hostRoutes'

import {
  House, Utensils, HeartPulse, User, Wifi, WifiOff, RefreshCw, TriangleAlert, ChevronRight, LogOut,
  LayoutDashboard, Users, LayoutTemplate, Blocks, FolderOpen, Activity, Bell, Check, X, MessageCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/clients'
import { HostDemoContext } from '@/lib/auth/AuthGate'

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ')

/* ---------- atoms ---------- */
export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx('text-[9px] font-extrabold uppercase tracking-wider text-mute', className)}>{children}</span>
)

export const Card = ({ children, className, dashed }: { children: ReactNode; className?: string; dashed?: boolean }) => (
  <div className={cx('rounded-2xl bg-white p-3', dashed ? 'border-2 border-dashed border-mute/40' : 'border-2 border-b-4 border-line', className)}>
    {children}
  </div>
)

export const Btn = ({
  children, variant = 'primary', className, icon, onClick, to, patientId,
}: { onClick?: () => void; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue' | 'orange'; className?: string; icon?: ReactNode; to?: HostScreenId; patientId?: string }) => {
  const currentPatient = useContext(HostPatientContext)
  const styles = cx(
      'inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[12px] font-extrabold uppercase tracking-wide transition active:translate-y-[3px] active:border-b-0',
      variant === 'primary' && 'border-b-4 border-green-d bg-green text-white',
      variant === 'blue' && 'border-b-4 border-blue-d bg-blue text-white',
      variant === 'orange' && 'border-b-4 border-orange-d bg-orange text-white',
      variant === 'secondary' && 'border-2 border-b-4 border-line bg-white text-blue',
      variant === 'ghost' && 'border-b-4 border-line bg-fill text-ink',
      variant === 'danger' && 'border-2 border-b-4 border-alert/30 bg-white text-alert',
      !onClick && !to && 'cursor-default opacity-60',
      className,
  )
  const content = <>{icon}{children}</>
  if (to) return <Link className={styles} href={hostHref(to, patientId ?? currentPatient)}>{content}</Link>
  return <button type="button" className={styles} disabled={!onClick} onClick={onClick}>{content}</button>
}

export const Chip = ({ children, tone = 'gray', className }: { children: ReactNode; tone?: 'gray' | 'ink' | 'ok' | 'warn' | 'alert' | 'outline' | 'orange' | 'green'; className?: string }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
      tone === 'gray' && 'bg-fill text-ink',
      tone === 'ink' && 'bg-blue text-white',
      tone === 'orange' && 'bg-orange/15 text-orange-d',
      tone === 'green' && 'bg-green/15 text-green-d',
      tone === 'ok' && 'bg-ok/10 text-ok',
      tone === 'warn' && 'bg-warn/10 text-warn',
      tone === 'alert' && 'bg-alert/10 text-alert',
      tone === 'outline' && 'border border-line text-mute',
      className,
    )}
  >
    {children}
  </span>
)

export const Ph = ({ icon, className, label, src, alt }: { icon?: ReactNode; className?: string; label?: string; src?: string; alt?: string }) =>
  src ? (
    <div className={cx('relative overflow-hidden rounded-xl bg-fill', className)}>
      <img src={src} alt={alt ?? label ?? ''} loading="lazy" className="h-full w-full object-cover" />
      {label && <span className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[8px] font-bold font-bold uppercase text-white">{label}</span>}
    </div>
  ) : (
    <div className={cx('flex flex-col items-center justify-center gap-1 rounded-xl bg-blue/10 text-blue', className)}>
      {icon}
      {label && <Mono className="text-blue">{label}</Mono>}
    </div>
  )

export const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=75&w=${w}`
export const IMG = {
  chicken: img('photo-1772693471187-6e7d364f99ee'),
  omelet: img('photo-1677844592730-ce9c936d8f1a'),
  yogurt: img('photo-1621797350487-c8996f886ab1'),
  salad: img('photo-1604909052743-94e838986d24'),
  tacos: img('photo-1660180750968-4fbc84789a96'),
  gym: img('photo-1534438327276-14e5300c3a48'),
  press: img('photo-1641337221253-fdc7237f6b61'),
  rack: img('photo-1576678927484-cc907957088c'),
  rest: img('photo-1593811167565-4672e6c8ce4c'),
  water: img('photo-1523362628745-0c100150b504'),
  woman: img('photo-1580489944761-15a19d654956', 300),
  lab: img('photo-1606206591513-adbfbdd7a177'),
  article: img('photo-1483722987215-6ee3a1d33f86', 300),
}

/* animated icon wrapper */
export const AIcon = ({ icon: I, kind = 'bounce', size = 16, className, strokeWidth }: { icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; kind?: 'bounce' | 'wiggle' | 'flame' | 'float' | 'spin' | 'beat'; size?: number; className?: string; strokeWidth?: number }) => (
  <span className={cx('inline-flex', `a-${kind}`, className)}><I size={size} strokeWidth={strokeWidth} /></span>
)

export const Bar = ({ v, className }: { v: number; className?: string }) => (
  <div className={cx('h-2.5 overflow-hidden rounded-full bg-fill', className)}>
    <div className="h-full rounded-full bg-green" style={{ width: `${v}%` }} />
  </div>
)

export const Field = ({ label, value, placeholder, icon, className, area }: { label?: string; value?: string; placeholder?: string; icon?: ReactNode; className?: string; area?: boolean }) => (
  <label className={cx('block', className)}>
    {label && <div className="mb-1 text-[10px] font-medium text-mute">{label}</div>}
    <div className={cx('flex items-start gap-1.5 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px]', area && 'min-h-[56px]')}>
      {icon}
      <span className={value ? 'text-ink' : 'text-mute/70'}>{value || placeholder}</span>
    </div>
  </label>
)

export const Toggle = ({ on: init = false }: { on?: boolean }) => {
  const [on, set] = useState(init)
  return (
    <button onClick={() => set(!on)} className={cx('relative h-[18px] w-8 shrink-0 rounded-full transition', on ? 'bg-green' : 'bg-line')}>
      <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-0.5')} />
    </button>
  )
}

export const Check2 = ({ on }: { on?: boolean }) => (
  <span className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-green bg-green text-white' : 'border-mute/50 bg-white')}>
    {on && <Check size={11} />}
  </span>
)

export const Tabs = ({ items, active, className }: { items: string[]; active?: string; className?: string }) => {
  const [a, setA] = useState(active ?? items[0])
  return (
    <div className={cx('noscroll flex gap-1 overflow-x-auto', className)}>
      {items.map((t) => (
        <button key={t} onClick={() => setA(t)} className={cx('shrink-0 rounded-full border-b-2 px-3 py-1 text-[11px] font-extrabold', a === t ? 'border-blue-d bg-blue text-white' : 'border-line bg-fill text-ink')}>
          {t}
        </button>
      ))}
    </div>
  )
}

export const Row = ({ title, sub, right, icon }: { title: string; sub?: string; right?: ReactNode; icon?: ReactNode }) => (
  <div className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
    {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange/15 text-orange-d">{icon}</div>}
    <div className="min-w-0 flex-1">
      <div className="truncate text-[12px] font-semibold">{title}</div>
      {sub && <div className="truncate text-[10px] text-mute">{sub}</div>}
    </div>
    {right ?? <ChevronRight size={14} className="text-mute" />}
  </div>
)

/* ---------- sync status ---------- */
export type Sync = 'ok' | 'offline' | 'pending' | 'error'
export const SyncBadge = ({ s, compact }: { s: Sync; compact?: boolean }) => {
  const m = {
    ok: { t: 'Conectado', i: <AIcon icon={Wifi} kind="beat" size={11} />, c: 'ok' as const },
    offline: { t: 'Sin conexión', i: <WifiOff size={11} />, c: 'gray' as const },
    pending: { t: 'Sincronización pendiente', i: <AIcon icon={RefreshCw} kind="spin" size={11} />, c: 'warn' as const },
    error: { t: 'Error de sincronización', i: <AIcon icon={TriangleAlert} kind="wiggle" size={11} />, c: 'alert' as const },
  }[s]
  return (
    <Chip tone={m.c}>
      {m.i}
      {!compact && m.t}
    </Chip>
  )
}

/* ---------- charts ---------- */
export const LineChart = ({ data, labels, unit, h = 90 }: { data: number[]; labels: string[]; unit: string; h?: number }) => {
  const w = 240
  const min = Math.min(...data) - 1
  const max = Math.max(...data) + 1
  const pts = data.map((d, i) => [10 + (i * (w - 20)) / (data.length - 1), 8 + (1 - (d - min) / (max - min)) * (h - 16)])
  return (
    <div>
      <div className="mb-1 flex justify-between"><Mono>Unidad: {unit}</Mono><Mono>{max.toFixed(0)}–{min.toFixed(0)}</Mono></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#e1e7f2" strokeDasharray="3 3" />)}
        <polyline fill="none" stroke="#1c4dff" strokeWidth="3" strokeLinecap="round" points={pts.map((p) => p.join(',')).join(' ')} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.8" fill="#fff" stroke="#ff9600" strokeWidth="2.5" />)}
      </svg>
      <div className="flex justify-between">{labels.map((l) => <Mono key={l}>{l}</Mono>)}</div>
    </div>
  )
}

export const Bars = ({ data, h = 70, labels }: { data: number[]; h?: number; labels?: string[] }) => (
  <div>
    <div className="flex items-end gap-1.5" style={{ height: h }}>
      {data.map((d, i) => <div key={i} className="flex-1 rounded-t-lg bg-green" style={{ height: `${d}%` }} />)}
    </div>
    {labels && <div className="mt-1 flex gap-1.5">{labels.map((l, i) => <div key={i} className="flex-1 text-center"><Mono>{l}</Mono></div>)}</div>}
  </div>
)

/* ---------- phone ---------- */
const clientNav = [
  { k: 'HUB', i: House }, { k: 'Nutrición', i: Utensils }, { k: 'Salud integral', i: HeartPulse }, { k: 'Perfil', i: User },
]

export const Phone = ({
  children, nav, title, back, sync, overlay, noStatus,
}: { children: ReactNode; nav?: string; title?: string; back?: boolean; sync?: Sync; overlay?: ReactNode; noStatus?: boolean }) => (
  <div className="relative w-[300px] shrink-0 rounded-[40px] border-[7px] border-ink bg-white shadow-[0_18px_40px_-18px_rgba(30,39,51,.45)]">
    <div className="absolute left-1/2 top-0 z-30 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
    <div className="relative flex h-[630px] flex-col overflow-hidden rounded-[32px]">
      {!noStatus && (
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-2 text-[9px] font-semibold">
          <span>9:41</span><span>●●● 100%</span>
        </div>
      )}
      {title && (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-1">
          {back && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill text-[14px] font-extrabold">‹</span>}
          <div className="font-display text-[17px] font-black">{title}</div>
          {sync && <div className="ml-auto"><SyncBadge s={sync} compact /></div>}
        </div>
      )}
      <div className="noscroll flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-4 pt-1">{children}</div>
      {nav && (
        <div className="flex shrink-0 border-t border-line bg-white px-2 pb-3 pt-1.5">
          {clientNav.map(({ k, i: I }) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-0.5">
              <span className={cx('flex h-6 w-12 items-center justify-center rounded-full', nav === k ? 'bg-blue text-white' : 'text-mute')}><I size={14} /></span>
              <span className={cx('text-[8px] font-bold', nav === k ? 'font-bold text-ink' : 'text-mute')}>{k}</span>
            </div>
          ))}
        </div>
      )}
      {overlay}
    </div>
  </div>
)

export const Sheet = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="absolute inset-0 z-20 flex flex-col justify-end bg-ink/50">
    <div className="rounded-t-3xl bg-white p-4 pb-6">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
      <div className="mb-2 font-display text-[16px] font-black">{title}</div>
      {children}
    </div>
  </div>
)

export const Modal = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/50 p-5">
    <div className="w-full rounded-2xl bg-white p-4">
      <div className="mb-2 font-display text-[16px] font-black">{title}</div>
      {children}
    </div>
  </div>
)

/* ---------- desktop (HOST) ---------- */
export const HostNavigationContext = createContext<((screenId: HostScreenId) => void) | null>(null)
export const HostPatientContext = createContext<string | undefined>(undefined)
export const HostPreviewContext = createContext(false)

const hostNav = [
  { k: 'Inicio', i: LayoutDashboard }, { k: 'Clientes', i: Users }, { k: 'Plantillas', i: LayoutTemplate },
  { k: 'Módulos', i: Blocks }, { k: 'Expedientes', i: FolderOpen }, { k: 'Seguimiento', i: Activity }, { k: 'Chat', i: MessageCircle },
]

export const Desk = ({ nav, title, actions, children, crumbs }: { nav: string; title: string; actions?: ReactNode; children: ReactNode; crumbs?: string }) => {
  const exitDemo = useContext(HostDemoContext)
  const preview = useContext(HostPreviewContext)
  const [profileOpen, setProfileOpen] = useState(false)
const [confirmLogout, setConfirmLogout] = useState(false)
const [loggingOut, setLoggingOut] = useState(false)
const [logoutError, setLogoutError] = useState('')

async function handleLogout() {
  if (exitDemo) {
    exitDemo()
    return
  }
  setLoggingOut(true)
  setLogoutError('')

  const { error } = await supabase.auth.signOut()

  if (error) {
    setLogoutError('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    setLoggingOut(false)
    return
  }
}
  const destinations: Record<string, HostScreenId> = {
    Inicio: 'H1', Clientes: 'H2', Plantillas: 'H3', Módulos: 'H4', Expedientes: 'H5', Seguimiento: 'H6', Chat: 'H8',
  }
  return (
  <div className="flex h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-[#f8faff]">
    <aside className="flex w-[176px] shrink-0 flex-col bg-blue p-3 text-white">
      <div className="mb-5 px-2 pt-1 font-display text-[16px] font-black">CECYFIT <span className="text-orange">GO!</span><div className="font-mono text-[8px] font-bold font-normal uppercase tracking-widest text-white/50">Panel HOST</div></div>
      <nav className="space-y-0.5">
        {hostNav.map(({ k, i: I }) => (
          <Link
            key={k}
            href={hostHref(destinations[k])}
            aria-current={nav === k ? 'page' : undefined}
            className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors', nav === k ? 'border-b-4 border-orange bg-white font-extrabold text-blue' : 'text-white/80 hover:bg-white/10')}
          >
            <I size={14} />{k}
          </Link>
        ))}
      </nav>
      <div className="relative mt-auto">
  <button
    type="button"
    onClick={() => {
      setProfileOpen(!profileOpen)
      setConfirmLogout(false)
      setLogoutError('')
    }}
    className="flex w-full items-center gap-2 rounded-xl bg-white/10 p-2 text-left transition hover:bg-white/20"
  >
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange text-white">
      <User size={17} />
    </div>

    <div className="min-w-0 flex-1 text-[10px] leading-tight">
      <div className="truncate font-extrabold">{exitDemo ? "Demostración" : "Mi cuenta"}</div>
      <div className="text-white/60">Panel profesional</div>
    </div>

    <ChevronRight
      size={14}
      className={`transition-transform ${profileOpen ? '-rotate-90' : 'rotate-90'}`}
    />
  </button>

  {profileOpen && (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-2xl border border-line bg-white p-3 text-ink shadow-xl">
      {!confirmLogout ? (
        <>
          <div className="mb-3 border-b border-line pb-3">
            <div className="text-xs font-black">{exitDemo ? "Demostración" : "Mi cuenta"}</div>
            <div className="mt-1 text-[10px] text-mute">
              Cuenta profesional
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-extrabold text-alert transition hover:bg-red-50"
          >
            <LogOut size={15} />
            {exitDemo ? "Salir de la demostración" : "Cerrar sesión"}
          </button>
        </>
      ) : (
        <>
          <div className="text-xs font-black">
            ¿Cerrar sesión?
          </div>

          <p className="mt-1 text-[10px] leading-relaxed text-mute">
            Tendrás que iniciar sesión nuevamente para acceder al panel.
          </p>

          {logoutError && (
            <p className="mt-2 text-[10px] font-bold text-alert">
              {logoutError}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                setConfirmLogout(false)
                setLogoutError('')
              }}
              className="flex-1 rounded-lg border border-line px-2 py-2 text-[10px] font-bold hover:bg-fill"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="flex-1 rounded-lg bg-alert px-2 py-2 text-[10px] font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loggingOut ? 'Saliendo...' : 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </div>
  )}
</div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-5">
        <div>
          {crumbs && <Mono className="block leading-none">{crumbs}</Mono>}
          <div className="font-display text-[16px] font-black leading-tight">{title}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {preview && <><SyncBadge s="ok" />
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-fill"><Bell size={13} /><span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-alert" /></span></>}
        </div>
      </header>
      <main className="noscroll min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
  {preview && <p className="rounded-lg bg-fill px-3 py-2 text-xs text-ink">Vista de demostración · datos ilustrativos</p>}
  {children}
</main>
    </div>
  </div>
  )
}

export const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-hidden rounded-xl border-2 border-line bg-white">
    <table className="w-full text-left text-[11px]">
      <thead className="bg-blue/10"><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-[9px] font-extrabold text-blue uppercase tracking-wider text-mute">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cx('px-3 py-2', j === 0 && 'font-semibold')}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
)

export const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card className="flex-1"><Mono>{label}</Mono><div className="font-display text-[26px] font-black leading-tight text-blue">{value}</div>{sub && <div className="text-[10px] text-mute">{sub}</div>}</Card>
)

export const Panel = ({ title, children, right, className }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) => (
  <Card className={cx('p-4', className)}>
    <div className="mb-3 flex items-center justify-between"><div className="text-[12px] font-semibold">{title}</div>{right}</div>
    {children}
  </Card>
)

export const Close = () => <X size={14} />

/* ---------- board ---------- */
export type Screen = { id: string; title: string; notes?: string[]; el: ReactNode; wide?: boolean }
export const Frame = ({ s }: { s: Screen }) => (
  <figure id={s.id} className="scroll-mt-20">
    <div className="mb-2 flex items-baseline gap-2"><Mono className="text-ink">{s.id}</Mono><span className="text-[12px] font-semibold">{s.title}</span></div>
    {s.el}
    {s.notes && (
      <ul className="mt-3 space-y-1" style={{ maxWidth: s.wide ? 1040 : 300 }}>
        {s.notes.map((n) => <li key={n} className="flex gap-1.5 text-[11px] leading-snug text-mute"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />{n}</li>)}
      </ul>
    )}
  </figure>
)
