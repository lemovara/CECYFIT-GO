import { useState } from 'react'
import {
  Utensils, Dumbbell, Droplets, Bell, Search, Plus, Trash2, Pencil, FileText, Download, Lock, Moon, Check,
  ChevronRight, Clock, Timer, Pause, SkipForward, Sparkles, Heart, ShoppingBasket, Smartphone, KeyRound, Flame,
  Salad, BedDouble, Info, Quote, Camera, ShieldCheck, Play, Wallet, BookOpen, X,
} from 'lucide-react'
import {
  AIcon, IMG, Phone, Card, Btn, Chip, Ph, Bar, Mono, SyncBadge, Field, Toggle, Check2, Tabs, Row, LineChart, Bars, Sheet, Modal, type Screen, type Sync,
} from './ui'

const dish = <Utensils size={26} strokeWidth={1.3} />
const mealImg: Record<string, string> = { 'Omelette de espinaca': IMG.omelet, 'Yogurt con fruta': IMG.yogurt, 'Pollo con arroz': IMG.chicken, 'Ensalada de atún': IMG.salad }
const today = 'Martes, 14 de octubre'

/* ---------- 1. HUB ---------- */
const Hub = ({ sync = 'ok', meal = true, rest = false }: { sync?: Sync; meal?: boolean; rest?: boolean }) => (
  <Phone nav="HUB">
    <div className="flex items-start justify-between pt-1">
      <div>
        <div className="text-[11px] text-mute">Hola, Ana</div>
        <div className="font-display text-[19px] font-bold leading-tight">Buenos días, Ana</div>
        <div className="text-[10px] text-mute">{today}</div>
      </div>
      <div className="flex flex-col items-end gap-1"><SyncBadge s={sync} compact /><Chip tone="orange"><AIcon icon={Flame} kind="flame" size={11} />Racha 6</Chip></div>
    </div>
    {sync !== 'ok' && (
      <div className={`rounded-lg px-2.5 py-1.5 text-[10px] ${sync === 'error' ? 'bg-alert/10 text-alert' : 'bg-fill text-ink'}`}>
        {sync === 'offline' && 'Sin conexión. Tus registros se guardarán en el dispositivo.'}
        {sync === 'pending' && '3 registros esperan sincronizarse. Reintento automático.'}
        {sync === 'error' && 'No pudimos sincronizar. Toca para reintentar o ver detalle.'}
      </div>
    )}
    <Card>
      <div className="flex justify-between"><Mono>Nutrición</Mono><Mono>Siguiente comida</Mono></div>
      {meal ? (
        <>
          <Ph src={IMG.chicken} alt="Pollo con arroz y verduras" className="my-2 h-[104px]" />
          <div className="text-center"><div className="text-[13px] font-semibold">Pollo con arroz y verduras</div><div className="flex items-center justify-center gap-1 text-[10px] text-mute"><Clock size={10} />Comida · 14:30</div></div>
          <Btn className="mt-2 w-full">Ver comida</Btn>
        </>
      ) : (
        <div className="my-2 flex flex-col items-center gap-1 rounded-xl border border-dashed border-line py-6 text-center">
          <Utensils size={18} className="text-mute" /><div className="text-[12px] font-semibold">No hay comida programada</div>
          <div className="px-4 text-[10px] text-mute">Tu profesional aún no asigna comidas para hoy.</div>
        </div>
      )}
    </Card>
    <Card>
      <Mono>Actividad física</Mono>
      {rest ? (
        <div className="my-2 flex items-center gap-3 rounded-xl bg-fill p-3"><AIcon icon={Moon} kind="float" size={24} /><div><div className="text-[13px] font-semibold">Día de descanso</div><div className="text-[10px] text-mute">Recuperar también es parte del plan.</div></div></div>
      ) : (
        <>
          <Ph src={IMG.press} alt="Entrenamiento de tren superior" className="my-2 h-[84px]" />
          <div className="text-center text-[13px] font-semibold">Tren superior · 45 min</div>
          <Btn variant="blue" className="mt-2 w-full">Ver rutina</Btn>
        </>
      )}
    </Card>
    <Card>
      <div className="mb-1.5 flex justify-between"><Mono>Recordatorios y mensajes</Mono><Chip tone="outline">3</Chip></div>
      <div className="mb-2 rounded-xl border border-dashed border-mute/50 p-2.5">
        <Quote size={11} className="mb-1 text-mute" />
        <div className="text-[11px] italic leading-snug">“Cada comida sana es un paso más cerca de tu meta.”</div>
        <div className="mt-1 flex items-center gap-1"><Chip tone="ink">De tu HOST</Chip></div>
      </div>
      <Row title="Registrar agua" sub="Recordatorio · 16:00" icon={<AIcon icon={Droplets} kind="float" size={14} />} />
      <Row title="Cita con tu nutrióloga" sub="Aviso · Jueves 10:30" icon={<AIcon icon={Bell} kind="wiggle" size={14} />} />
      <div className="pt-1 text-[10px] text-mute">Mensaje de biblioteca general: “Beber agua también cuenta.”</div>
    </Card>
    <Card>
      <div className="mb-2 flex justify-between"><Mono>Progreso de hoy</Mono><span className="text-[10px] font-semibold">62%</span></div>
      {[['Comidas registradas', '2 / 4', 50], ['Actividad física', 'Pendiente', 0], ['Hidratación', '1.2 / 2.0 L', 60], ['Hábitos completados', '2 / 3', 66]].map(([l, v, p]) => (
        <div key={l as string} className="mb-2 last:mb-0"><div className="mb-1 flex justify-between text-[10px]"><span>{l}</span><span className="text-mute">{v}</span></div><Bar v={p as number} /></div>
      ))}
      <div className="mt-2 text-[9px] text-mute">Solo se muestran objetivos activos para ti.</div>
    </Card>
  </Phone>
)

/* ---------- 2. Nutrición ---------- */
const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const meals = [['08:00', 'Omelette de espinaca', 'Desayuno', true], ['11:30', 'Yogurt con fruta', 'Colación', true], ['14:30', 'Pollo con arroz', 'Comida', null], ['19:00', 'Ensalada de atún', 'Cena', null]] as const

const Nutri = () => {
  const [d, setD] = useState(1)
  return (
    <Phone nav="Nutrición" title="Nutrición" sync="ok">
      <Tabs items={['Menú', 'Consumo fuera del plan', 'Costos']} />
      <Card>
        <div className="mb-2 flex items-center justify-between"><Mono>Menú semanal</Mono><Mono>Sem. 42</Mono></div>
        <div className="mb-3 flex justify-between">
          {days.map((x, i) => <button key={i} onClick={() => setD(i)} className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${d === i ? 'bg-blue text-white' : 'bg-fill'}`}>{x}</button>)}
        </div>
        <div className="space-y-2">
          {meals.map(([h, n, t, ok]) => (
            <div key={n} className="flex items-center gap-2.5 rounded-xl border border-line p-2">
              <Ph src={mealImg[n]} alt={n} className="h-11 w-11 shrink-0" />
              <div className="min-w-0 flex-1"><div className="text-[10px] text-mute">{h} · {t}</div><div className="truncate text-[12px] font-semibold">{n}</div></div>
              <ChevronRight size={14} className="text-mute" />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Mono>Registro de consumo · hoy</Mono>
        <div className="mt-2 space-y-1.5">
          {meals.map(([h, n, , ok]) => (
            <div key={n} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate">{h} {n}</span>
              <div className="flex shrink-0 gap-1">
                <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${ok === true ? 'bg-blue text-white' : 'bg-fill'}`}>Sí</span>
                <span className="rounded-md bg-fill px-2 py-1 text-[10px] font-semibold">No</span>
              </div>
            </div>
          ))}
        </div>
        <Btn variant="secondary" className="mt-3 w-full" icon={<Plus size={12} />}>Agregar alimento adicional</Btn>
        <div className="mt-1.5 text-[9px] text-mute">Visible solo si tu HOST habilitó esta función.</div>
      </Card>
      <Card>
        <Mono>Resumen del plan</Mono>
        <div className="mt-1 font-display text-[16px] font-semibold">Plan de definición · 4 comidas</div>
        <div className="mt-2 space-y-1 text-[11px] text-mute">
          <div className="flex gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-ink" />Priorizar proteína en cada comida.</div>
          <div className="flex gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-ink" />Respetar horarios con ±30 min de margen.</div>
          <div className="flex gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-ink" />Evitar lácteos enteros (intolerancia).</div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-fill px-2.5 py-2"><span className="text-[10px] text-mute">Referencia diaria autorizada</span><span className="font-display text-[15px] font-semibold">1,520 kcal</span></div>
      </Card>
    </Phone>
  )
}

const Extra = () => (
  <Phone nav="Nutrición" title="Consumo fuera del plan" back>
    <div className="rounded-xl bg-fill p-2.5 text-[11px] leading-snug"><Heart size={12} className="mb-1" />Comer algo distinto también es parte del proceso. Regístralo sin juicios; tu profesional lo tomará en cuenta.</div>
    <Field icon={<Search size={12} />} placeholder="Buscar alimento: tacos, manzana…" />
    <Mono>Resultados</Mono>
    <Card className="!p-1.5">
      <Row title="Tacos al pastor (3 pzas)" sub="Fuente: Base nutricional SMAE" />
      <Row title="Refresco de cola 355 ml" sub="Fuente: Etiqueta de fabricante" />
      <Row title="Pizza de queso (1 rebanada)" sub="Fuente: USDA FoodData" />
    </Card>
    <Mono>Mis registros de hoy</Mono>
    <Card className="!p-2">
      <div className="flex items-center gap-2"><div className="flex-1"><div className="text-[12px] font-semibold">Galletas de avena</div><div className="text-[10px] text-mute">4 pzas · 17:20 · ≈ 220 kcal</div></div><Pencil size={13} /><Trash2 size={13} className="text-alert" /></div>
      <div className="mt-1 text-[9px] text-mute">Solo puedes editar o eliminar tus propias entradas.</div>
    </Card>
    <div className="flex items-center gap-1 text-[9px] text-mute"><Info size={10} />Datos nutricionales orientativos, no sustituyen indicación profesional.</div>
  </Phone>
)

const ExtraDetail = () => (
  <Phone nav="Nutrición" title="Alimento adicional" back>
    <Ph src={IMG.tacos} alt="Tacos al pastor" className="h-[130px]" />
    <div><div className="font-display text-[18px] font-semibold">Tacos al pastor</div><Chip tone="outline">Fuente: SMAE</Chip></div>
    <Card>
      <Mono>Cantidad consumida</Mono>
      <div className="mt-2 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill">−</div><div className="flex-1 rounded-lg border border-line py-1.5 text-center text-[13px] font-semibold">3</div><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill">+</div><Chip>piezas</Chip></div>
      <div className="mt-2 flex gap-1.5"><Chip tone="ink">Cena</Chip><Chip>Comida</Chip><Chip>Otro</Chip></div>
    </Card>
    <Card>
      <div className="mb-1.5 flex justify-between"><Mono>Información nutricional</Mono><Chip tone="warn">Orientativa</Chip></div>
      {[['Energía', '≈ 480 kcal'], ['Proteína', '24 g'], ['Carbohidratos', '45 g'], ['Grasas', '22 g']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-line py-1.5 text-[11px] last:border-0"><span className="text-mute">{a}</span><span className="font-semibold">{b}</span></div>)}
    </Card>
    <Btn className="w-full">Guardar consumo</Btn>
    <Btn variant="ghost" className="w-full">Cancelar</Btn>
  </Phone>
)

const Costs = () => (
  <Phone nav="Nutrición" title="Costos de alimentación" back>
    <Chip tone="outline">Módulo opcional · requiere precios del HOST</Chip>
    <Card><Mono>Costo estimado semanal</Mono><div className="font-display text-[30px] font-semibold leading-tight">$1,900 <span className="text-[13px]">MXN</span></div><div className="text-[10px] text-mute">Gastado esta semana: $640 · Quedan $1,260</div><Bar v={34} className="mt-2" /></Card>
    <Card className="!p-2.5">
      <div className="mb-1 flex items-center justify-between"><Mono>Lista de ingredientes</Mono><ShoppingBasket size={13} /></div>
      {[['Pechuga de pollo', '1.2 kg', '$216'], ['Arroz integral', '500 g', '$28'], ['Espinaca', '3 manojos', '$45'], ['Yogurt griego', '1 kg', '$98'], ['Huevo', '18 pzas', '$62']].map(([n, q, p]) => (
        <div key={n} className="flex items-center gap-2 border-b border-line py-1.5 text-[11px] last:border-0"><Check2 on={n !== 'Huevo'} /><span className="flex-1">{n}</span><span className="text-mute">{q}</span><span className="w-10 text-right font-semibold">{p}</span></div>
      ))}
      <div className="mt-1.5 flex justify-between text-[12px] font-semibold"><span>Total estimado</span><span>$1,900</span></div>
    </Card>
    <Card className="!p-2.5"><Mono>Registro de gastos</Mono><Row title="Mercado La Paz" sub="12 oct · 8 artículos" right={<span className="text-[12px] font-semibold">$410</span>} /><Row title="Supermercado" sub="13 oct · 4 artículos" right={<span className="text-[12px] font-semibold">$230</span>} /></Card>
    <Btn variant="secondary" className="w-full" icon={<Wallet size={12} />}>Registrar gasto</Btn>
  </Phone>
)

/* ---------- 3. Salud integral ---------- */
const calDays = [
  ['Dom', '12', 'done'], ['Lun', '13', 'rest'], ['Mar', '14', 'today'], ['Mié', '15', 'sched'], ['Jue', '16', 'rest'],
] as const
const calStyle: Record<string, string> = { done: 'Completada', rest: 'Descanso', today: 'Pendiente', sched: 'Programada' }

const Health = () => {
  const [ml, setMl] = useState(1200)
  const [open, setOpen] = useState(false)
  const pct = Math.min(100, (ml / 2000) * 100)
  return (
    <Phone
      nav="Salud integral"
      title="Salud integral"
      overlay={open && (
        <Sheet title="Agregar agua">
          <div className="grid grid-cols-4 gap-1.5">{[150, 250, 350, 500].map((v) => <button key={v} onClick={() => { setMl(ml + v); setOpen(false) }} className="rounded-xl border border-line py-3 text-[12px] font-semibold">{v}<div className="text-[9px] font-normal text-mute">ml</div></button>)}</div>
          <Field className="mt-2" label="Otra cantidad" placeholder="Ej. 400 ml" />
          <Btn variant="ghost" onClick={() => setOpen(false)} className="mt-2 w-full">Cancelar</Btn>
        </Sheet>
      )}
    >
      <Card>
        <div className="flex justify-between"><Mono>Actividad de hoy</Mono><Chip>Tren superior</Chip></div>
        <div className="mt-2 flex items-center gap-3"><Ph src={IMG.gym} alt="Rutina de hoy" className="h-12 w-12" /><div className="flex-1"><div className="text-[13px] font-semibold">Pecho, hombro y tríceps</div><div className="text-[10px] text-mute">Fuerza · 45 min</div></div></div>
        <Btn variant="blue" className="mt-2 w-full">Ver rutina</Btn>
      </Card>
      <Card>
        <Mono>Calendario de actividad</Mono>
        <div className="mt-2 flex gap-1.5">
          {calDays.map(([d, n, s]) => (
            <div key={n} className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 ${s === 'today' ? 'border-b-4 border-orange-d bg-orange text-white' : 'border-2 border-b-4 border-line'}`}>
              <span className="text-[9px] opacity-70">{d}</span><span className="text-[13px] font-semibold">{n}</span>
              <span className="flex h-4 w-4 items-center justify-center">{s === 'done' ? <span className="rounded-full bg-green p-0.5 text-white"><Check size={11} /></span> : s === 'rest' ? <Moon size={11} /> : s === 'sched' ? <span className="h-2 w-2 rounded-full border-2 border-blue" /> : <span className="h-2 w-2 rounded-full bg-white" />}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{Object.values(calStyle).map((l) => <Mono key={l}>● {l}</Mono>)}</div>
      </Card>
      <Card>
        <div className="flex items-center justify-between"><span className="flex items-center gap-1"><AIcon icon={Droplets} kind="float" size={12} className="text-blue" /><Mono>Hidratación</Mono></span><Mono>Meta HOST: 2.0 L</Mono></div>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-24 w-14 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-blue"><div className="a-water absolute bottom-0 w-full bg-blue transition-all duration-500" style={{ height: `${pct}%` }} /></div>
          <div className="flex-1"><div className="font-display text-[24px] font-semibold leading-none">{(ml / 1000).toFixed(1)} L</div><div className="mb-2 text-[10px] text-mute">{Math.round(pct)}% de tu meta</div><Btn onClick={() => setOpen(true)} className="w-full !py-2" icon={<Plus size={12} />}>Agregar agua</Btn></div>
        </div>
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {[['10:15', '+350 ml'], ['08:05', '+250 ml']].map(([h, v]) => <div key={h} className="flex items-center text-[11px]"><span className="flex-1 text-mute">{h}</span><span className="mr-2 font-semibold">{v}</span><Pencil size={11} className="mr-1.5" /><Trash2 size={11} className="text-alert" /></div>)}
        </div>
      </Card>
      <Card>
        <div className="mb-1 flex justify-between"><Mono>Hábitos</Mono><span className="text-[10px] text-mute">2 / 3 hoy</span></div>
        {[['Dormir 7 h', 'Diario', true], ['Caminar 8,000 pasos', 'Diario', true], ['Preparar comidas', 'Domingos', false]].map(([n, f, ok]) => (
          <div key={n as string} className="flex items-center gap-2 border-b border-line py-2 last:border-0"><Check2 on={ok as boolean} /><div className="flex-1"><div className="text-[12px] font-semibold">{n}</div><div className="text-[10px] text-mute">{f}</div></div><ChevronRight size={13} className="text-mute" /></div>
        ))}
      </Card>
      <Card>
        <Mono>Recomendaciones del HOST</Mono>
        <div className="mt-2 space-y-2">
          {[['Guía: porciones con la mano', 'Artículo · 4 min', IMG.article], ['Cómo hidratarte al entrenar', 'Infografía', IMG.water]].map(([t, s, im]) => <div key={t} className="flex items-center gap-2.5"><Ph src={im} alt={t} className="h-11 w-11" /><div className="flex-1"><div className="text-[12px] font-semibold leading-tight">{t}</div><div className="text-[10px] text-mute">{s}</div></div></div>)}
        </div>
        <div className="mt-2 text-[9px] text-mute">Seleccionadas manualmente por tu profesional. No se generan a partir de diagnósticos.</div>
      </Card>
    </Phone>
  )
}

const DayDetail = ({ done }: { done?: boolean }) => (
  <Phone
    nav="Salud integral"
    title="Martes 14 · Actividad"
    back
    overlay={done && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/95">
        <div className="pop flex h-24 w-24 items-center justify-center rounded-full border-b-8 border-green-d bg-green text-white"><Check size={46} strokeWidth={3} /></div>
        {[['10%','#ff9600'],['28%','#1c4dff'],['50%','#58cc02'],['70%','#ff9600'],['88%','#1c4dff']].map(([l, bg], i) => <span key={i} className="confetti absolute top-[22%] h-2 w-2 rounded-sm" style={{ left: l, background: bg, animationDelay: `${i * 0.25}s` }} />)}
        <div className="font-display text-[20px] font-semibold">¡Actividad completada!</div>
        <div className="px-10 text-center text-[11px] text-mute">Registrada a las 19:42. Racha de 3 sesiones.</div>
        <Btn className="mt-2">Continuar</Btn>
      </div>
    )}
  >
    <Chip tone="warn">Pendiente</Chip>
    <div className="font-display text-[19px] font-semibold">Tren superior</div>
    <Ph src={IMG.press} alt="Tren superior" className="h-28" />
    <Card className="!p-2.5"><Row title="Press de banca" sub="4 × 10" right={<span />} /><Row title="Press militar" sub="3 × 12" right={<span />} /><Row title="Fondos en banco" sub="3 × 15" right={<span />} /></Card>
    <Btn className="w-full" icon={<Check size={13} />}>Marcar actividad como completada</Btn>
    <Btn variant="secondary" className="w-full">Ver rutina</Btn>
    <Btn variant="ghost" className="w-full">No pude realizarla</Btn>
  </Phone>
)

const HydraDialog = () => (
  <Phone nav="Salud integral" title="Salud integral" overlay={
    <Sheet title="Registro de hidratación">
      <div className="mb-2 text-[11px] text-mute">Hoy llevas 1.2 L de 2.0 L</div>
      <div className="grid grid-cols-4 gap-1.5">{[150, 250, 350, 500].map((v, i) => <div key={v} className={`rounded-xl border py-3 text-center text-[12px] font-semibold ${i === 1 ? 'border-blue bg-blue text-white' : 'border-line'}`}>{v}<div className="text-[9px] font-normal opacity-70">ml</div></div>)}</div>
      <Field className="mt-2" label="Cantidad personalizada" placeholder="ml" />
      <div className="mt-3 grid grid-cols-2 gap-2"><Btn variant="ghost">Cancelar</Btn><Btn>Guardar</Btn></div>
      <div className="mt-3 border-t border-line pt-2"><Mono>Corregir un registro</Mono><div className="mt-1 flex items-center text-[11px]"><span className="flex-1">10:15 · 350 ml</span><Pencil size={12} className="mr-2" /><Trash2 size={12} className="text-alert" /></div></div>
    </Sheet>
  }><div className="h-40 rounded-xl hatch bg-fill" /></Phone>
)

const Habit = () => (
  <Phone nav="Salud integral" title="Hábito" back>
    <Card><div className="flex items-center justify-between"><div className="font-display text-[17px] font-semibold">Caminar 8,000 pasos</div><Chip tone="ok">Hoy ✓</Chip></div><div className="mt-1 text-[11px] text-mute">Camina a ritmo ligero después de comer para mejorar la digestión.</div><div className="mt-2 flex gap-1.5"><Chip>Diario</Chip><Chip>Meta 8,000</Chip></div></Card>
    <Card><Mono>Últimos 14 días</Mono><div className="mt-2 grid grid-cols-7 gap-1.5">{[1,1,1,0,1,1,0,1,1,1,1,0,1,1].map((v, i) => <div key={i} className={`flex h-7 items-center justify-center rounded-md ${v ? 'bg-blue text-white' : 'border border-line'}`}>{v ? <Check size={11} /> : <X size={10} className="text-mute" />}</div>)}</div><div className="mt-2 text-[11px] text-mute">Cumplimiento: 79% · mejor racha: 6 días</div></Card>
    <Card className="!p-2.5"><Mono>Historial de registros</Mono><Row title="Hoy · 14 oct" sub="8,420 pasos" right={<Chip tone="ok">Cumplido</Chip>} /><Row title="13 oct" sub="9,100 pasos" right={<Chip tone="ok">Cumplido</Chip>} /><Row title="11 oct" sub="Sin registro" right={<Chip>Omitido</Chip>} /></Card>
    <Btn className="w-full">Registrar hoy</Btn>
  </Phone>
)

/* ---------- 4. Perfil ---------- */
const Profile = () => (
  <Phone nav="Perfil" title="Perfil" sync="ok">
    <Card className="text-center">
      <div className="relative mx-auto h-[72px] w-[72px]"><img src={IMG.woman} alt="Ana Martínez" className="h-full w-full rounded-full border-4 border-orange object-cover" /><span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue text-white"><Camera size={12} /></span></div>
      <div className="mt-2 font-display text-[18px] font-semibold">Ana Martínez</div>
      <div className="text-[10px] text-mute">Nutrióloga: Dra. M. Reyes</div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">{[['32 años', 'Edad'], ['1.64 m', 'Estatura'], ['68.4 kg', 'Peso']].map(([v, l]) => <div key={l} className="rounded-lg bg-fill py-1.5"><div className="text-[12px] font-semibold">{v}</div><Mono>{l}</Mono></div>)}</div>
      <div className="mt-2 text-left"><Mono>Objetivos físicos</Mono><div className="mt-1 flex flex-wrap gap-1"><Chip tone="ink">Reducir grasa corporal</Chip><Chip tone="ink">Ganar fuerza</Chip></div></div>
      <div className="mt-2 text-left"><Mono>Etiquetas autorizadas</Mono><div className="mt-1 flex flex-wrap gap-1"><Chip>Intolerancia a lactosa</Chip><Chip>Hipotiroidismo</Chip></div></div>
    </Card>
    <Card>
      <div className="mb-1 flex justify-between"><Mono>Evolución física</Mono><span className="text-[10px] font-semibold">Ver detalle ›</span></div>
      <LineChart data={[72, 71.2, 70.1, 69.4, 68.4]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="kg" />
    </Card>
    <Card className="!p-2.5">
      <Row title="Estado de salud" sub="Condiciones, alergias, restricciones" icon={<Heart size={14} />} />
      <Row title="Expediente documental" sub="5 documentos" icon={<FileText size={14} />} />
      <Row title="Configuración de cuenta" sub="Datos, notificaciones, dispositivos" icon={<Smartphone size={14} />} />
    </Card>
  </Phone>
)

const Evolution = () => (
  <Phone nav="Perfil" title="Detalle de evolución" back>
    <Tabs items={['Peso', 'Cintura', 'Cadera', 'Grasa %']} />
    <Card><div className="mb-1 font-display text-[22px] font-semibold">68.4 <span className="text-[12px]">kg</span></div><div className="mb-2 text-[10px] text-mute">−3.6 kg desde 02 sep</div><LineChart h={120} data={[72, 71.2, 70.1, 69.4, 68.4]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="kilogramos (kg)" /></Card>
    <Card><Mono>Cintura · cm</Mono><div className="mt-1"><LineChart h={70} data={[84, 83, 81.5, 80.5, 79.5]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="centímetros (cm)" /></div></Card>
    <Card className="!p-2.5"><Mono>Registros</Mono><Row title="14 oct 2025" sub="Registrado por Dra. Reyes" right={<span className="text-[12px] font-semibold">68.4 kg</span>} /><Row title="07 oct 2025" sub="Registrado por ti" right={<span className="text-[12px] font-semibold">69.4 kg</span>} /></Card>
    <div className="text-[9px] text-mute">Solo variables habilitadas por tu HOST.</div>
  </Phone>
)

const Health2 = () => (
  <Phone nav="Perfil" title="Estado de salud" back>
    {[['Condiciones diagnosticadas', ['Hipotiroidismo (2021)']], ['Alergias e intolerancias', ['Lactosa', 'Nueces']], ['Restricciones alimentarias', ['Sin lácteos enteros', 'Bajo en sodio']], ['Nivel de actividad física', ['Moderado · 3 días/sem']], ['Objetivos', ['Reducir grasa corporal', 'Ganar fuerza']]].map(([t, v]) => (
      <Card key={t as string}><Mono>{t}</Mono><div className="mt-1.5 flex flex-wrap gap-1">{(v as string[]).map((x) => <Chip key={x}>{x}</Chip>)}</div></Card>
    ))}
    <Card><Mono>Observaciones profesionales</Mono><div className="mt-1 text-[11px] leading-snug">Mantener ingesta de yodo moderada. Revisar en próxima cita.</div><div className="mt-1 text-[9px] text-mute">Dra. Reyes · 02 oct 2025</div></Card>
    <Btn variant="secondary" className="w-full" icon={<Pencil size={12} />}>Solicitar corrección</Btn>
    <div className="flex gap-1.5 text-[9px] text-mute"><ShieldCheck size={11} className="shrink-0" />Los cambios clínicos serán revisados por tu HOST antes de aplicarse.</div>
  </Phone>
)

const CorrectionReq = () => (
  <Phone nav="Perfil" title="Estado de salud" back overlay={
    <Sheet title="Solicitar corrección">
      <Field label="Dato a corregir" value="Alergias e intolerancias" />
      <Field className="mt-2" label="¿Qué debería decir?" area value="También tengo alergia a la soya." />
      <div className="mt-2 flex gap-1.5 rounded-lg bg-fill p-2 text-[10px]"><Info size={11} className="shrink-0" />Tu solicitud quedará como “En revisión” hasta que tu HOST la apruebe o rechace.</div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Btn variant="ghost">Cancelar</Btn><Btn>Enviar solicitud</Btn></div>
    </Sheet>}><div className="h-52 rounded-xl hatch bg-fill" /></Phone>
)

const Docs = () => (
  <Phone nav="Perfil" title="Expediente documental" back>
    <Field icon={<Search size={12} />} placeholder="Buscar documento" />
    <Tabs items={['Todos', 'Laboratorio', 'Imagen', 'Otros']} />
    {[['Biometría hemática', 'Laboratorio', '08 oct 2025', '10 oct 2025'], ['Perfil tiroideo', 'Laboratorio', '22 sep 2025', '23 sep 2025'], ['Densitometría', 'Imagen', '15 ago 2025', '16 ago 2025'], ['Plan inicial firmado', 'Administrativo', '02 sep 2025', '02 sep 2025']].map(([n, t, a, b]) => (
      <Card key={n} className="!p-2.5"><div className="flex gap-2.5"><div className="flex h-10 w-9 items-center justify-center rounded-md bg-fill"><FileText size={16} /></div><div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">{n}</div><div className="text-[10px] text-mute">{t}</div><div className="text-[9px] text-mute">Realizado {a} · Cargado {b}</div></div><ChevronRight size={14} className="mt-3 text-mute" /></div></Card>
    ))}
  </Phone>
)

const DocDetail = () => (
  <Phone nav="Perfil" title="Documento" back>
    <Ph src={IMG.lab} label="Vista previa" alt="Estudio de laboratorio" className="h-[190px]" />
    <div className="font-display text-[18px] font-semibold">Perfil tiroideo</div>
    <Card className="!p-2.5">
      {[['Tipo de estudio', 'Laboratorio'], ['Fecha de realización', '22 sep 2025'], ['Fecha de carga', '23 sep 2025'], ['Cargado por', 'Dra. Reyes'], ['Archivo', 'tiroides.pdf · 1.2 MB'], ['Descripción', 'TSH y T4 libre en ayuno.']].map(([a, b]) => <div key={a} className="flex justify-between gap-3 border-b border-line py-1.5 text-[11px] last:border-0"><span className="text-mute">{a}</span><span className="text-right font-medium">{b}</span></div>)}
    </Card>
    <div className="grid grid-cols-2 gap-2"><Btn icon={<FileText size={12} />}>Abrir</Btn><Btn variant="secondary" icon={<Download size={12} />}>Descargar</Btn></div>
    <div className="flex gap-1.5 text-[9px] text-mute"><Lock size={11} className="shrink-0" />Si el formato no es compatible con tu dispositivo, solo verás los datos descriptivos.</div>
  </Phone>
)

const Settings = () => (
  <Phone nav="Perfil" title="Configuración de cuenta" back>
    <Card><Mono>Datos personales</Mono><div className="mt-2 space-y-2"><Field label="Nombre" value="Ana Martínez" /><Field label="Correo" value="ana@correo.com" /><Field label="Teléfono" value="55 1234 5678" /><div className="text-[9px] text-mute">Estatura, peso y datos clínicos los gestiona tu HOST.</div></div></Card>
    <Card><Mono>Seguridad</Mono><Row title="Cambiar contraseña" icon={<KeyRound size={14} />} /></Card>
    <Card><Mono>Notificaciones</Mono>{[['Recordatorio de comidas', true], ['Recordatorio de agua', true], ['Mensajes del HOST', true], ['Avisos de citas', false]].map(([n, o]) => <div key={n as string} className="flex items-center justify-between border-b border-line py-2 text-[11px] last:border-0">{n}<Toggle on={o as boolean} /></div>)}</Card>
    <Card><Mono>Dispositivos vinculados</Mono><Row title="iPhone 15 · este dispositivo" sub="Activo ahora" right={<Chip tone="ok">Actual</Chip>} icon={<Smartphone size={14} />} /><Row title="Pixel 7" sub="Última sync · 02 oct" right={<span className="text-[10px] font-semibold text-alert">Desvincular</span>} icon={<Smartphone size={14} />} /></Card>
  </Phone>
)

/* ---------- 5. Subpantallas ---------- */
const DishDetail = () => (
  <Phone nav="Nutrición" title="Detalle de platillo" back>
    <Ph src={IMG.chicken} alt="Pollo con arroz y verduras" className="h-[150px]" />
    <div><div className="font-display text-[19px] font-semibold leading-tight">Pollo con arroz y verduras</div><div className="mt-1 flex items-center gap-2 text-[10px] text-mute"><Clock size={10} />Comida · 14:30 <Flame size={10} />≈ 620 kcal</div></div>
    <Card className="!p-2.5"><Mono>Ingredientes y porciones</Mono>{[['Pechuga de pollo', '120 g'], ['Arroz integral cocido', '¾ taza'], ['Brócoli y zanahoria', '1 taza'], ['Aceite de oliva', '1 cdita']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-line py-1.5 text-[11px] last:border-0"><span>{a}</span><span className="text-mute">{b}</span></div>)}</Card>
    <Card className="!p-2.5"><Mono>Indicaciones</Mono><div className="mt-1 text-[11px] leading-snug text-mute">Cocinar el pollo a la plancha sin piel. Evitar sal adicional.</div></Card>
    <div className="space-y-1.5"><Btn className="w-full" icon={<Check size={12} />}>Marcar como consumido</Btn><div className="grid grid-cols-2 gap-1.5"><Btn variant="secondary">No consumido</Btn><Btn variant="secondary">Consultar ingredientes</Btn></div></div>
  </Phone>
)

const Routine = () => (
  <Phone nav="Salud integral" title="Detalle de rutina" back>
    <div><div className="font-display text-[19px] font-semibold">Tren superior</div><div className="text-[10px] text-mute">6 ejercicios · 45 min · Fuerza</div></div>
    <Card className="!p-2.5">
      {[['Press de banca', '4 × 10', 'Descanso 90 s'], ['Remo con mancuerna', '4 × 12', 'Descanso 60 s'], ['Press militar', '3 × 12', 'Descanso 60 s'], ['Curl de bíceps', '3 × 12', 'Descanso 45 s'], ['Fondos en banco', '3 × 15', 'Descanso 45 s'], ['Plancha', '3 × 40 s', 'Descanso 30 s']].map(([n, s, d], i) => (
        <div key={n} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill text-[10px] font-bold">{i + 1}</span><Ph src={IMG.rack} alt={n} className="h-9 w-9" /><div className="flex-1"><div className="text-[12px] font-semibold">{n}</div><div className="text-[10px] text-mute">{s} · {d}</div></div></div>
      ))}
    </Card>
    <Card className="!p-2.5"><Mono>Instrucciones generales</Mono><div className="mt-1 text-[11px] text-mute">Calentamiento de 5 min. Mantén la espalda neutra.</div></Card>
    <Btn className="w-full" icon={<Play size={12} />}>Iniciar rutina</Btn>
  </Phone>
)

const RunRoutine = ({ dialog }: { dialog?: boolean }) => (
  <Phone noStatus={false} title="Rutina en curso" overlay={dialog && (
    <Modal title="¿Salir de la rutina?">
      <div className="text-[11px] leading-snug text-mute">Tu progreso (2 de 6 ejercicios) no se pierde. Elige cómo guardarlo:</div>
      <div className="mt-3 space-y-1.5"><Btn className="w-full">Pausar y continuar después</Btn><Btn variant="secondary" className="w-full">Marcar como interrumpida</Btn><Btn variant="ghost" className="w-full">Seguir entrenando</Btn></div>
      <div className="mt-2 text-[9px] text-mute">Si cierras la app sin elegir, la rutina se pausa automáticamente.</div>
    </Modal>)}>
    <div className="flex items-center justify-between"><Chip tone="ink">Ejercicio 3 / 6</Chip><span className="text-[10px] text-mute">18:42 transcurridos</span></div>
    <Bar v={50} />
    <Ph src={IMG.press} label="Demostración" alt="Press militar" className="h-[150px]" />
    <div className="font-display text-[22px] font-semibold">Press militar</div>
    <div className="flex gap-2"><Card className="flex-1 text-center !p-2"><Mono>Serie</Mono><div className="font-display text-[22px] font-semibold">2/3</div></Card><Card className="flex-1 text-center !p-2"><Mono>Reps</Mono><div className="font-display text-[22px] font-semibold">12</div></Card></div>
    <Card className="flex items-center gap-3 !p-2.5"><AIcon icon={Timer} kind="beat" size={24} /><div className="flex-1"><Mono>Descanso</Mono><div className="font-display text-[26px] font-semibold leading-none">00:42</div></div><Chip>Temporizador</Chip></Card>
    <div className="text-[11px] leading-snug text-mute">Empuja la barra sobre la cabeza sin arquear la espalda. Exhala al subir.</div>
    <div className="grid grid-cols-2 gap-2"><Btn variant="secondary" icon={<Pause size={12} />}>Pausar rutina</Btn><Btn icon={<SkipForward size={12} />}>Siguiente ejercicio</Btn></div>
  </Phone>
)

export const clientScreens: Screen[] = [
  { id: 'C1', title: 'HUB · estado normal', el: <Hub />, notes: ['Saludo, fecha e indicador de sincronización en el encabezado.', 'Cuatro bloques: siguiente comida, actividad, mensajes y progreso diario.', 'Mensajes: personalizados del HOST o de la biblioteca general.'] },
  { id: 'C1a', title: 'HUB · sin comida y día de descanso', el: <Hub meal={false} rest />, notes: ['Estado vacío de comida: «No hay comida programada».', 'Día de descanso reemplaza el botón «Ver rutina».'] },
  { id: 'C1b', title: 'HUB · sin conexión', el: <Hub sync="offline" />, notes: ['Los registros se guardan localmente.'] },
  { id: 'C1c', title: 'HUB · sincronización pendiente', el: <Hub sync="pending" /> },
  { id: 'C1d', title: 'HUB · error de sincronización', el: <Hub sync="error" meal={false} />, notes: ['El error ofrece reintento y acceso al detalle.'] },
  { id: 'C2', title: 'Nutrición · menú, registro y resumen', el: <Nutri />, notes: ['Selector de día; cada comida abre su detalle.', 'Registro Sí / No por comida asignada.'] },
  { id: 'C2a', title: 'Consumo fuera del plan', el: <Extra />, notes: ['Reemplaza «Pecados». Lenguaje neutral, sin culpa.', 'Buscar, cantidad, info nutricional con fuente, guardar, corregir o eliminar entradas propias.'] },
  { id: 'C2b', title: 'Detalle de alimento adicional', el: <ExtraDetail />, notes: ['Dato nutricional orientativo con fuente identificada.'] },
  { id: 'C2c', title: 'Costos de alimentación (opcional)', el: <Costs />, notes: ['Solo disponible si el HOST registró precios. Módulo de etapa posterior.'] },
  { id: 'C3', title: 'Salud integral', el: <Health />, notes: ['Interactivo: pulsa «Agregar agua» para llenar el recipiente.', 'Calendario de 5 días: dos previos, hoy y dos próximos.', 'Recomendaciones elegidas por el HOST; nunca generadas por diagnóstico.'] },
  { id: 'C3a', title: 'Detalle del día de actividad', el: <DayDetail />, notes: ['Estados: programada, completada, descanso, pendiente.'] },
  { id: 'C3b', title: 'Actividad completada · confirmación', el: <DayDetail done />, notes: ['Animación de confirmación al marcar completada.'] },
  { id: 'C3c', title: 'Registro de hidratación (diálogo)', el: <HydraDialog />, notes: ['Cantidades rápidas, personalizada y corrección de registros.'] },
  { id: 'C3d', title: 'Detalle de hábito', el: <Habit />, notes: ['Nombre, descripción, frecuencia, estado e historial.'] },
  { id: 'C4', title: 'Perfil', el: <Profile />, notes: ['Etiquetas visibles solo si el HOST las autoriza.'] },
  { id: 'C4a', title: 'Detalle de evolución', el: <Evolution />, notes: ['Fechas y unidad de medida en cada gráfica.'] },
  { id: 'C4b', title: 'Estado de salud', el: <Health2 /> },
  { id: 'C4c', title: 'Solicitud de corrección', el: <CorrectionReq />, notes: ['Estado «En revisión» hasta aprobación del HOST.'] },
  { id: 'C4d', title: 'Expediente documental', el: <Docs /> },
  { id: 'C4e', title: 'Detalle de documento', el: <DocDetail /> },
  { id: 'C4f', title: 'Configuración de cuenta', el: <Settings /> },
  { id: 'C5a', title: 'Detalle de platillo', el: <DishDetail /> },
  { id: 'C5b', title: 'Detalle de rutina', el: <Routine /> },
  { id: 'C5c', title: 'Ejecución de rutina', el: <RunRoutine />, notes: ['Temporizador de descanso, pausar y siguiente ejercicio.'] },
  { id: 'C5d', title: 'Salir de la rutina', el: <RunRoutine dialog />, notes: ['Decisión: pausar por defecto o marcar interrumpida. El progreso nunca se elimina.'] },
]
void Salad; void BedDouble; void Sparkles
