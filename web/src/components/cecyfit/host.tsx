import {
  PatientListFunctional,
  PatientRegisterFunctional,
} from "@/lib/patients/PatientScreens";
import {
  Plus, Search, QrCode, Upload, FileText, Lock, Utensils, Dumbbell, Droplets, Check, Clock, GripVertical, Trash2,
  Copy, History, Users, UserCheck, Activity, RefreshCw, Settings2, Download, ShieldCheck, X, RotateCcw, Eye as EyeIcon,
} from 'lucide-react'
import {
  IMG, AIcon, Desk, Btn, Chip, Card, Mono, Field, Toggle, Check2, Tabs, Table, Stat, Panel, Ph, Bar, LineChart, Bars, Row, SyncBadge, type Screen,
} from './ui'

const clients = [
  ['Ana Martínez', 'CG-0142', 'Reducir grasa corporal', 'Al día', 'Hace 5 min', 'ok'],
  ['Luis Hernández', 'CG-0138', 'Rendimiento deportivo', 'Atención', 'Hace 2 h', 'pending'],
  ['Sofía Ramírez', 'CG-0131', 'Control de glucosa', 'Al día', 'Ayer', 'ok'],
  ['Carlos Ortega', 'CG-0127', 'Ganancia muscular', 'Sin registros 5 d', 'Hace 6 d', 'error'],
  ['Valeria Núñez', 'CG-0119', 'Alimentación general', 'Al día', 'Hace 1 h', 'ok'],
] as const
const trk = (t: string) => <Chip tone={t === 'Al día' ? 'ok' : t === 'Atención' ? 'warn' : 'alert'}>{t}</Chip>

const Home = () => (
  <Desk nav="Inicio" title="Buenos días, Dra. Reyes" crumbs="Inicio">
    <div className="flex gap-3"><Stat label="Clientes registrados" value="48" sub="+3 este mes" /><Stat label="Activos" value="41" sub="85%" /><Stat label="Con registros recientes" value="33" sub="Últimas 48 h" /><Stat label="Sync pendiente" value="5" sub="2 requieren revisión" /></div>
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Actividad reciente" className="col-span-2" right={<Chip tone="outline">Hoy</Chip>}>
        {[[Utensils, 'Ana Martínez registró Comida (Pollo con arroz)', '14:41'], [Dumbbell, 'Luis Hernández completó Tren inferior', '13:10'], [FileText, 'Nuevo documento: Biometría — Sofía Ramírez', '11:52'], [Settings2, 'Perfil actualizado: Carlos Ortega (peso)', '10:20'], [RefreshCw, 'Sincronización realizada: Valeria Núñez', '09:03']].map(([I, t, h], i) => { const Ic = I as typeof Utensils; return <Row key={i} title={t as string} icon={<AIcon icon={Ic} kind="bounce" size={14} />} right={<Mono>{h as string}</Mono>} /> })}
      </Panel>
      <div className="space-y-4">
        <Panel title="Accesos rápidos"><div className="grid gap-2"><Btn to="H2a" icon={<Plus size={12} />}>Registrar cliente</Btn><Btn to="H3a" variant="secondary" icon={<Plus size={12} />}>Crear plantilla</Btn><Btn to="H4b" variant="secondary" icon={<Settings2 size={12} />}>Configurar módulos</Btn><Btn to="H6" variant="secondary" icon={<Activity size={12} />}>Consultar seguimiento</Btn></div></Panel>
        <Panel title="Cumplimiento semanal"><Bars data={[60, 72, 55, 80, 68, 40, 50]} labels={['L', 'M', 'M', 'J', 'V', 'S', 'D']} /></Panel>
      </div>
    </div>
  </Desk>
)

export const DemoClientList = () => (
  <Desk nav="Clientes" title="Clientes" crumbs="Gestión de clientes" actions={<><Btn to="H2b" variant="secondary" icon={<QrCode size={12} />}>Vincular por QR</Btn><Btn to="H2a" icon={<Plus size={12} />}>Registrar cliente</Btn></>}>
    <div className="flex gap-2"><div className="flex-1"><Field icon={<Search size={12} />} placeholder="Buscar por nombre o identificador" /></div><Chip tone="ink">Todos · 48</Chip><Chip>Atención · 7</Chip><Chip>Sin sync · 5</Chip></div>
    <Table head={['Nombre', 'Identificador', 'Objetivo principal', 'Seguimiento', 'Última sincronización', '']} rows={clients.map(([n, id, o, t, s, st]) => [n, <span key="visibility" className="font-mono">{id}</span>, o, trk(t), <span key="visibility" className="flex items-center gap-1.5">{s}<SyncBadge s={st as 'ok'} compact /></span>, <Btn key="action" to="H2c" variant="ghost">Ver ficha</Btn>])} />
  </Desk>
)

export const DemoRegister = () => (
  <Desk nav="Clientes" title="Registrar cliente" crumbs="Clientes › Nuevo">
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Datos de cuenta" className="col-span-2">
        <div className="grid grid-cols-2 gap-3"><Field label="Nombre(s)" placeholder="Ana" /><Field label="Apellidos" placeholder="Martínez" /><Field label="Correo electrónico" placeholder="ana@correo.com" /><Field label="Teléfono" placeholder="55 0000 0000" /><Field label="Fecha de nacimiento" placeholder="DD / MM / AAAA" /><Field label="Sexo registrado" placeholder="Seleccionar" /><Field label="Estatura (cm)" placeholder="164" /><Field label="Peso (kg)" placeholder="68.4" /></div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Perfil inicial"><Field label="Objetivo principal" placeholder="Seleccionar" /><Field className="mt-2" label="Plantilla inicial (opcional)" placeholder="Seguimiento nutricional general" /></Panel>
        <Panel title="Consentimiento"><div className="space-y-2 text-[11px]"><div className="flex gap-2"><Check2 on />Aviso de privacidad aceptado</div><div className="flex gap-2"><Check2 on />Autoriza almacenar datos de salud</div><div className="flex gap-2"><Check2 />Autoriza compartir con otros profesionales</div></div></Panel>
      </div>
    </div>
    <div className="flex justify-end gap-2"><Btn to="H2" variant="ghost">Cancelar</Btn><Btn variant="secondary">Guardar y vincular por QR</Btn><Btn>Crear cliente</Btn></div>
  </Desk>
)

const QR = () => (
  <Desk nav="Clientes" title="Vincular cliente" crumbs="Clientes › Ana Martínez › Vinculación">
    <div className="mx-auto grid max-w-[640px] grid-cols-2 gap-6 pt-2">
      <Card className="flex flex-col items-center p-5">
        <div className="grid h-[190px] w-[190px] grid-cols-9 gap-[3px] rounded-xl border-2 border-blue p-3">
          {Array.from({ length: 81 }).map((_, i) => <div key={i} className={((i * 7 + (i % 5) * 3) % 3 === 0 || [0, 1, 9, 10, 7, 8, 16, 17, 63, 64, 72, 73].includes(i)) ? 'bg-blue' : 'bg-transparent'} />)}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold"><Clock size={12} />Expira en 09:42</div>
        <Mono className="mt-1">Token: CG-LNK-7F3A…</Mono>
        <div className="mt-3 flex gap-2"><Btn variant="secondary" icon={<RefreshCw size={12} />}>Regenerar</Btn><Btn variant="ghost" icon={<Copy size={12} />}>Copiar enlace</Btn></div>
      </Card>
      <div className="space-y-3">
        <div className="font-display text-[16px] font-semibold">Cómo vincular</div>
        {['El cliente abre CECYFIT GO! e inicia sesión.', 'Elige «Vincular con mi profesional».', 'Escanea este código antes de que expire.', 'Confirma la vinculación en su dispositivo.'].map((t, i) => <div key={t} className="flex gap-2.5 text-[12px]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue text-[10px] text-white">{i + 1}</span>{t}</div>)}
        <div className="flex gap-2 rounded-xl bg-fill p-3 text-[11px]"><ShieldCheck size={14} className="shrink-0" />El código es de un solo uso y no contiene datos médicos ni contraseñas; solo inicia un proceso seguro de vinculación.</div>
        <Chip tone="warn">Estado: esperando escaneo</Chip>
      </div>
    </div>
  </Desk>
)

const clientTabs = [['H2c', 'Información general'], ['H2d', 'Estado de salud'], ['H2e', 'Módulos'], ['H2f', 'Planes'], ['H2g', 'Seguimiento'], ['H2h', 'Expediente documental'], ['H2i', 'Historial de modificaciones']] as const
const ClientHeader = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Desk nav="Clientes" title="Ana Martínez" crumbs="Clientes › CG-0142" actions={<Btn to="H4c" variant="secondary" icon={<Settings2 size={12} />}>Configuración individual</Btn>}>
    <div className="flex items-center gap-3"><img src={IMG.woman} alt="Ana Martínez" className="h-11 w-11 rounded-full border-2 border-orange object-cover" /><div><div className="text-[13px] font-semibold">Ana Martínez · 32 años</div><div className="text-[10px] text-mute">Reducir grasa corporal · Plantilla: Seguimiento de objetivos físicos v2</div></div><SyncBadge s="ok" /></div>
    <div className="noscroll -mt-1 flex gap-1 overflow-x-auto border-b border-line pb-2">{clientTabs.map(([id, label]) => <Btn key={id} to={id} variant={label === tab ? 'blue' : 'ghost'}>{label}</Btn>)}</div>
    {children}
  </Desk>
)

const ClientDetail = () => (
  <ClientHeader tab="Información general">
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Datos personales" right={<Btn to="H7d" variant="ghost" className="!px-2 !py-1">Editar</Btn>}>{[['Correo', 'ana@correo.com'], ['Teléfono', '55 1234 5678'], ['Nacimiento', '12 mar 1993'], ['Estatura', '1.64 m'], ['Peso', '68.4 kg'], ['IMC', '25.4']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-line py-1.5 text-[11px] last:border-0"><span className="text-mute">{a}</span><span className="font-medium">{b}</span></div>)}</Panel>
      <Panel title="Objetivos y etiquetas"><Mono>Objetivos</Mono><div className="my-1.5 flex flex-wrap gap-1"><Chip tone="ink">Reducir grasa</Chip><Chip tone="ink">Ganar fuerza</Chip></div><Mono>Etiquetas visibles para el cliente</Mono><div className="mt-1.5 space-y-1.5">{[['Intolerancia a lactosa', true], ['Hipotiroidismo', true], ['Notas internas', false]].map(([t, v]) => <div key={t as string} className="flex items-center justify-between text-[11px]">{t}<Toggle on={v as boolean} /></div>)}</div></Panel>
      <Panel title="Resumen"><div className="space-y-2.5 text-[11px]">{[['Comidas registradas (7 d)', 82], ['Rutinas completadas', 66], ['Hidratación', 74]].map(([l, v]) => <div key={l as string}><div className="mb-1 flex justify-between"><span>{l}</span><span className="text-mute">{v}%</span></div><Bar v={v as number} /></div>)}</div></Panel>
    </div>
  </ClientHeader>
)

const modules = [['Nutrición', Utensils, 'Planes, comidas, horarios', true], ['Actividad física', Dumbbell, 'Rutinas y calendario', true], ['Hidratación', Droplets, 'Meta diaria 2.0 L', true], ['Hábitos', Check, '3 hábitos activos', true], ['Costos', Utensils, 'Precios de ingredientes', false], ['Consumo fuera del plan', Utensils, 'Registro de adicionales', true]] as const

const ClientModules = () => (
  <ClientHeader tab="Módulos">
    <div className="grid grid-cols-3 gap-3">{modules.map(([n, I, d, on]) => <Card key={n} className="p-4"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill"><I size={16} /></div><Toggle on={on} /></div><div className="mt-2 text-[13px] font-semibold">{n}</div><div className="text-[10px] text-mute">{d}</div><div className="mt-2 flex justify-between"><Chip tone={on ? 'ok' : 'gray'}>{on ? 'Activo' : 'Inactivo'}</Chip><span className="text-[11px] font-semibold">Configurar ›</span></div></Card>)}</div>
  </ClientHeader>
)

const ClientPlans = () => (
  <ClientHeader tab="Planes">
    <div className="grid grid-cols-3 gap-4">
      {[['Plan nutricional', 'Definición · 4 comidas · 1,520 kcal', 'Vigente desde 02 sep', Utensils], ['Rutina', 'Tren superior / inferior · 4 días', 'Vigente desde 09 sep', Dumbbell], ['Hábitos', '3 hábitos · frecuencia diaria', 'Vigente desde 02 sep', Check]].map(([t, s, d, I]) => { const Ic = I as typeof Utensils; return <Panel key={t as string} title={t as string} right={<Chip tone="ok">Vigente</Chip>}><Ic size={18} /><div className="mt-2 text-[12px] font-semibold">{s as string}</div><div className="text-[10px] text-mute">{d as string}</div><div className="mt-3 flex gap-2"><Btn to={t === 'Plan nutricional' ? 'H7a' : t === 'Rutina' ? 'H7b' : 'H7c'} variant="secondary" className="!px-2.5 !py-1.5">Editar</Btn><Btn to="H2i" variant="ghost" className="!px-2.5 !py-1.5">Historial</Btn></div></Panel> })}
    </div>
  </ClientHeader>
)

const ClientTrack = () => (
  <ClientHeader tab="Seguimiento">
    <div className="grid grid-cols-2 gap-4"><Panel title="Peso (kg)"><LineChart data={[72, 71.2, 70.1, 69.4, 68.4]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="kg" /></Panel><Panel title="Cumplimiento semanal (%)"><Bars data={[60, 72, 55, 80, 68]} labels={['S38', 'S39', 'S40', 'S41', 'S42']} /></Panel></div>
    <Panel title="Observaciones profesionales" right={<Btn variant="secondary" className="!px-2 !py-1" icon={<Plus size={11} />}>Agregar</Btn>}><div className="text-[11px]">Buena adherencia a desayunos. Ajustar cena por baja saciedad. <span className="text-mute">— Dra. Reyes · 10 oct</span></div></Panel>
  </ClientHeader>
)

const docs = [['Biometría hemática', 'Laboratorio', '08 oct 2025', '10 oct 2025', 'Cliente + HOST'], ['Perfil tiroideo', 'Laboratorio', '22 sep 2025', '23 sep 2025', 'Cliente + HOST'], ['Densitometría', 'Imagen', '15 ago 2025', '16 ago 2025', 'Solo HOST'], ['Notas de consulta', 'Interno', '02 sep 2025', '02 sep 2025', 'Solo HOST']]

const ClientDocs = () => (
  <ClientHeader tab="Expediente documental">
    <Table head={['Documento', 'Tipo', 'Realizado', 'Cargado', 'Visible para', '']} rows={docs.map((d) => [d[0], d[1], d[2], d[3], <Chip key="status" tone={d[4] === 'Solo HOST' ? 'gray' : 'ok'}>{d[4]}</Chip>, <Btn key="action" to="H5b" variant="ghost">Ver</Btn>])} />
  </ClientHeader>
)

const mods = [['10 oct 14:20', 'Dra. Reyes', 'Plan nutricional', 'Cena: Ensalada de atún → Salmón con verduras'], ['02 oct 09:00', 'Dra. Reyes', 'Perfil de salud', 'Se agregó restricción: bajo en sodio'], ['25 sep 17:45', 'Ana Martínez', 'Solicitud', 'Corrección de alergias (en revisión)'], ['09 sep 12:00', 'Dra. Reyes', 'Módulo', 'Activó Actividad física']]
const ClientHistory = () => (
  <ClientHeader tab="Historial de modificaciones">
    <Table head={['Fecha', 'Autor', 'Área', 'Cambio']} rows={mods.map((m) => m)} />
    <div className="text-[10px] text-mute">El historial es de solo lectura y conserva el valor anterior y el nuevo.</div>
  </ClientHeader>
)

const ClientHealth = () => (
  <ClientHeader tab="Estado de salud">
    <div className="grid grid-cols-2 gap-4">{[['Condiciones diagnosticadas', 'Hipotiroidismo'], ['Alergias e intolerancias', 'Lactosa · Nueces'], ['Restricciones alimentarias', 'Sin lácteos · Bajo en sodio'], ['Nivel de actividad', 'Moderado']].map(([a, b]) => <Panel key={a} title={a} right={<Btn variant="ghost" className="!px-2 !py-1">Editar</Btn>}><div className="text-[12px]">{b}</div></Panel>)}</div>
  </ClientHeader>
)

/* ---------- Plantillas ---------- */
const Templates = () => (
  <Desk nav="Plantillas" title="Catálogo de plantillas" crumbs="Plantillas" actions={<Btn to="H3a" icon={<Plus size={12} />}>Crear plantilla</Btn>}>
    <div className="grid grid-cols-2 gap-4">
      {[['Seguimiento nutricional general', 'v3', 12, ['Nutrición', 'Hidratación']], ['Seguimiento de objetivos físicos', 'v2', 18, ['Nutrición', 'Actividad', 'Hábitos']], ['Seguimiento deportivo', 'v1', 6, ['Actividad', 'Hidratación', 'Costos']], ['Personalizado: condición de salud', 'v1', 4, ['Nutrición', 'Hábitos', 'Documentos']]].map(([n, v, c, m], i) => (
        <Card key={n as string} className="p-4"><Ph src={[IMG.salad, IMG.gym, IMG.press, IMG.rest][i]} alt={n as string} className="mb-3 h-24" /><div className="flex justify-between"><div className="text-[13px] font-semibold">{n as string}</div><Chip tone="ink">{v as string}</Chip></div><div className="mt-1 text-[10px] text-mute">{c as number} clientes usan esta plantilla</div><div className="mt-2 flex flex-wrap gap-1">{(m as string[]).map((x) => <Chip key={x}>{x}</Chip>)}</div><div className="mt-3 flex gap-2"><Btn to="H3b" variant="secondary" className="!px-2.5 !py-1.5">Editar</Btn><Btn variant="ghost" className="!px-2.5 !py-1.5" icon={<Copy size={11} />}>Duplicar</Btn></div></Card>
      ))}
    </div>
  </Desk>
)

const TemplateForm = ({ edit }: { edit?: boolean }) => (
  <Desk nav="Plantillas" title={edit ? 'Editar plantilla · Seguimiento de objetivos físicos' : 'Crear plantilla'} crumbs="Plantillas › " actions={edit && <Chip tone="ink">Versión actual v2</Chip>}>
    {edit && <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 p-3 text-[11px]"><History size={14} className="mt-0.5 shrink-0" /><div><b>18 clientes usan la v2.</b> Tus cambios generarán la <b>v3</b>. Los clientes actuales no se modifican automáticamente; podrás solicitar su actualización de forma individual.</div></div>}
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Información" className="col-span-2"><div className="grid gap-3"><Field label="Nombre" value={edit ? 'Seguimiento de objetivos físicos' : undefined} placeholder="Nombre de plantilla" /><Field label="Descripción" area placeholder="¿Para qué perfil de cliente sirve?" /><Field label="Objetivos de seguimiento" placeholder="Ej. Reducir grasa, mejorar fuerza" /><Field label="Indicaciones generales" area placeholder="Texto visible para el cliente" /></div></Panel>
      <Panel title="Módulos incluidos" right={<Btn variant="ghost" className="!px-2 !py-1" icon={<Plus size={11} />}>Agregar</Btn>}>
        {[['Nutrición', true], ['Actividad física', true], ['Hidratación', true], ['Hábitos', false], ['Costos', false]].map(([n, on]) => <div key={n as string} className="flex items-center gap-2 border-b border-line py-2 text-[11px] last:border-0"><GripVertical size={12} className="text-mute" /><span className="flex-1">{n}</span>{on ? <><Chip>Config. inicial</Chip><X size={12} className="text-mute" /></> : <Plus size={12} />}</div>)}
      </Panel>
    </div>
    <div className="flex justify-end gap-2"><Btn to="H3" variant="ghost">Cancelar</Btn><Btn variant="secondary">Guardar borrador</Btn><Btn>{edit ? 'Publicar nueva versión' : 'Crear plantilla'}</Btn></div>
  </Desk>
)

/* ---------- Módulos ---------- */
const Modules = () => (
  <Desk nav="Módulos" title="Catálogo de módulos" crumbs="Módulos" actions={<Btn to="H4a" icon={<Plus size={12} />}>Crear módulo</Btn>}>
    <Tabs items={['Todos', 'Nutrición', 'Actividad', 'Bienestar', 'Administrativo']} />
    <Table head={['Módulo', 'Categoría', 'Funciones', 'Clientes', 'Estado', '']} rows={[['Nutrición', 'Nutrición', 'Planes, comidas, registro', '41', <Chip key="status" tone="ok">Activo</Chip>, <Settings2 key="settings" size={13} />], ['Actividad física', 'Actividad', 'Rutinas, calendario', '33', <Chip key="status" tone="ok">Activo</Chip>, <Settings2 key="settings" size={13} />], ['Hidratación', 'Bienestar', 'Meta, registros', '40', <Chip key="status" tone="ok">Activo</Chip>, <Btn key="action" to="H4b" variant="ghost">Configurar</Btn>], ['Hábitos', 'Bienestar', 'Seguimiento de hábitos', '22', <Chip key="status" tone="ok">Activo</Chip>, <Settings2 key="settings" size={13} />], ['Costos', 'Nutrición', 'Precios y gastos', '3', <Chip key="status" tone="warn">Beta</Chip>, <Settings2 key="settings" size={13} />], ['Expediente', 'Administrativo', 'Documentos', '48', <Chip key="status" tone="ok">Activo</Chip>, <Settings2 key="settings" size={13} />]]} />
  </Desk>
)

const NewModule = () => (
  <Desk nav="Módulos" title="Crear módulo" crumbs="Módulos › Nuevo">
    <div className="grid grid-cols-2 gap-4">
      <Panel title="Definición"><div className="grid gap-3"><Field label="Nombre" placeholder="Ej. Sueño" /><Field label="Descripción" area placeholder="Qué hace este módulo" /><Field label="Categoría" placeholder="Bienestar" /></div></Panel>
      <Panel title="Funciones"><div className="space-y-2 text-[11px]">{[['Registro diario', true], ['Meta configurable', true], ['Recordatorios', false], ['Gráfica de evolución', true]].map(([n, v]) => <div key={n as string} className="flex gap-2"><Check2 on={v as boolean} />{n}</div>)}</div></Panel>
      <Panel title="Datos que necesita"><div className="flex flex-wrap gap-1.5"><Chip tone="ink">Fecha</Chip><Chip tone="ink">Cantidad</Chip><Chip tone="ink">Unidad</Chip><Chip tone="outline">+ campo</Chip></div></Panel>
      <Panel title="Permisos requeridos"><div className="space-y-2 text-[11px]">{[['Cliente: registrar', true], ['Cliente: ver historial', true], ['HOST: configurar parámetros', true], ['HOST: ver datos', true]].map(([n, v]) => <div key={n as string} className="flex gap-2"><Check2 on={v as boolean} />{n}</div>)}</div></Panel>
      <Panel title="Pantallas asociadas" className="col-span-2"><div className="flex gap-2"><Chip>Cliente: Tarjeta en Salud integral</Chip><Chip>Cliente: Registro</Chip><Chip>HOST: Configuración</Chip><Chip tone="outline">+ pantalla</Chip></div></Panel>
    </div>
    <div className="flex justify-end gap-2"><Btn to="H4" variant="ghost">Cancelar</Btn><Btn>Registrar módulo</Btn></div>
  </Desk>
)

const ModuleConfig = () => (
  <Desk nav="Módulos" title="Configuración · Hidratación" crumbs="Módulos › Hidratación">
    <div className="grid grid-cols-2 gap-4">
      <Panel title="Parámetros"><div className="grid gap-3"><Field label="Objetivo diario" value="2000" /><Field label="Unidad de medida" value="Mililitros (ml)" /><Field label="Cantidades rápidas" value="150 · 250 · 350 · 500" /><div className="flex items-center justify-between text-[11px]">Permitir cantidad personalizada<Toggle on /></div><div className="flex items-center justify-between text-[11px]">Permitir corregir registros<Toggle on /></div></div></Panel>
      <Panel title="Vista previa del cliente"><div className="flex items-center gap-4"><div className="relative h-28 w-16 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-blue"><div className="absolute bottom-0 h-3/5 w-full bg-blue/80" /></div><div><div className="font-display text-[26px] font-semibold">1.2 L</div><div className="text-[11px] text-mute">de 2.0 L</div></div></div></Panel>
    </div>
    <Panel title="Otros módulos: parámetros de ejemplo"><div className="grid grid-cols-3 gap-3 text-[11px]">{[['Nutrición', 'Planes · Comidas · Horarios · Ingredientes'], ['Actividad', 'Rutinas · Descansos · Calendario'], ['Hábitos', 'Frecuencia · Meta · Historial']].map(([a, b]) => <div key={a} className="rounded-lg bg-fill p-2.5"><b>{a}</b><div className="text-mute">{b}</div></div>)}</div></Panel>
    <div className="flex justify-end gap-2"><Btn to="H4" variant="ghost">Descartar</Btn><Btn>Guardar configuración</Btn></div>
  </Desk>
)

const ClientConfig = () => (
  <Desk nav="Clientes" title="Configuración individual · Ana Martínez" crumbs="Clientes › Ana Martínez › Configuración">
    <div className="grid grid-cols-3 gap-4">
      <Panel title="1 · Plantilla"><div className="space-y-2">{[['Seguimiento nutricional general', false], ['Seguimiento de objetivos físicos v2', true], ['Seguimiento deportivo', false]].map(([n, on]) => <div key={n as string} className={`rounded-lg border p-2.5 text-[11px] ${on ? 'border-blue bg-fill font-semibold' : 'border-line'}`}>{n as string}</div>)}</div></Panel>
      <Panel title="2 · Módulos" className="col-span-2"><div className="grid grid-cols-2 gap-2">{modules.map(([n, , , on]) => <div key={n} className="flex items-center justify-between rounded-lg border border-line p-2.5 text-[11px]"><span>{n}</span><div className="flex items-center gap-2"><Settings2 size={12} className="text-mute" /><Toggle on={on} /></div></div>)}</div></Panel>
    </div>
    <Panel title="3 · Asignación"><div className="flex items-center justify-between text-[11px]"><span>Se aplicará una copia de la plantilla v2 a este cliente. Cambios posteriores a la plantilla no lo afectarán.</span><Btn>Asignar al cliente</Btn></div></Panel>
  </Desk>
)

/* ---------- Expedientes ---------- */
const Docs = () => (
  <Desk nav="Expedientes" title="Expedientes documentales" crumbs="Expedientes" actions={<Btn to="H5a" icon={<Upload size={12} />}>Cargar documento</Btn>}>
    <div className="flex gap-2"><div className="flex-1"><Field icon={<Search size={12} />} placeholder="Buscar documento o cliente" /></div><Chip tone="ink">Todos</Chip><Chip>Laboratorio</Chip><Chip>Imagen</Chip></div>
    <Table head={['Documento', 'Cliente', 'Tipo', 'Realizado', 'Cargado', 'Visibilidad', '']} rows={docs.map((d, i) => [d[0], clients[i % 3][0], d[1], d[2], d[3], <span key="visibility" className="flex items-center gap-1"><Lock size={10} />{d[4]}</span>, <Btn key="action" to="H5b" variant="ghost">Ver</Btn>])} />
  </Desk>
)

const Upload2 = () => (
  <Desk nav="Expedientes" title="Cargar documento" crumbs="Expedientes › Nuevo">
    <div className="grid grid-cols-2 gap-4">
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-mute/50 bg-white"><Upload size={26} strokeWidth={1.3} /><div className="text-[12px] font-semibold">Arrastra el archivo o selecciona</div><Mono>PDF · JPG · PNG · máx. 20 MB</Mono></div>
      <Panel title="Clasificación"><div className="grid gap-3"><Field label="Cliente" value="Ana Martínez · CG-0142" /><Field label="Nombre del documento" placeholder="Biometría hemática" /><div className="grid grid-cols-2 gap-3"><Field label="Tipo de estudio" placeholder="Laboratorio" /><Field label="Fecha de realización" placeholder="DD / MM / AAAA" /></div><Field label="Descripción" area placeholder="Notas descriptivas" /></div></Panel>
    </div>
    <div className="flex justify-end gap-2"><Btn to="H5" variant="ghost">Cancelar</Btn><Btn>Guardar documento</Btn></div>
  </Desk>
)

const DocView = () => (
  <Desk nav="Expedientes" title="Perfil tiroideo" crumbs="Expedientes › Ana Martínez" actions={<><Btn variant="secondary" icon={<Download size={12} />}>Descargar</Btn></>}>
    <div className="grid grid-cols-3 gap-4">
      <Ph src={IMG.lab} label="Vista previa del documento" alt="Estudio de laboratorio" className="col-span-2 min-h-[380px]" />
      <div className="space-y-4">
        <Panel title="Datos descriptivos">{[['Tipo', 'Laboratorio'], ['Realizado', '22 sep 2025'], ['Cargado', '23 sep 2025'], ['Archivo', 'tiroides.pdf']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-line py-1.5 text-[11px] last:border-0"><span className="text-mute">{a}</span>{b}</div>)}</Panel>
        <Panel title="Permisos documentales"><div className="space-y-2 text-[11px]">{[['Cliente puede consultar', true], ['Cliente puede descargar', true], ['Otros profesionales', false]].map(([n, v]) => <div key={n as string} className="flex items-center justify-between">{n}<Toggle on={v as boolean} /></div>)}</div><div className="mt-2 text-[9px] text-mute">Se respeta la autorización del paciente y las reglas del sistema.</div></Panel>
      </div>
    </div>
  </Desk>
)

/* ---------- Seguimiento ---------- */
const Tracking = () => (
  <Desk nav="Seguimiento" title="Seguimiento de clientes" crumbs="Seguimiento" actions={<><Btn to="H6a" variant="secondary">Nutrición</Btn><Btn to="H6b" variant="secondary">Sincronización</Btn></>}>
    <Tabs items={['Evolución', 'Nutrición', 'Físico', 'Hábitos e hidratación', 'Observaciones', 'Historial']} />
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Peso (kg)"><LineChart data={[72, 71.2, 70.1, 69.4, 68.4]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="kg" /></Panel>
      <Panel title="Cintura (cm)"><LineChart data={[84, 83, 81.5, 80.5, 79.5]} labels={['02 sep', '16 sep', '30 sep', '07 oct', '14 oct']} unit="cm" /></Panel>
      <Panel title="Cumplimiento nutricional (%)"><Bars data={[60, 72, 55, 80, 68]} labels={['S38', 'S39', 'S40', 'S41', 'S42']} /></Panel>
      <Panel title="Rutinas completadas"><Bars data={[100, 50, 75, 75, 100]} labels={['S38', 'S39', 'S40', 'S41', 'S42']} /></Panel>
      <Panel title="Hidratación (L/día)"><Bars data={[70, 80, 60, 90, 75, 85, 60]} labels={['L', 'M', 'M', 'J', 'V', 'S', 'D']} /></Panel>
      <Panel title="Hábitos" ><div className="space-y-2 text-[11px]">{[['Dormir 7 h', 86], ['Caminar', 79], ['Meal prep', 50]].map(([l, v]) => <div key={l as string}><div className="flex justify-between"><span>{l}</span><span className="text-mute">{v}%</span></div><Bar v={v as number} /></div>)}</div></Panel>
    </div>
  </Desk>
)

const TrackNutri = () => (
  <Desk nav="Seguimiento" title="Seguimiento nutricional · Ana Martínez" crumbs="Seguimiento › Nutrición">
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Cumplimiento del plan" className="col-span-2"><Table head={['Día', 'Desayuno', 'Colación', 'Comida', 'Cena', 'Fuera del plan']} rows={[['Lun', '✓', '✓', '✓', '✓', '—'], ['Mar', '✓', '✓', '—', '—', '—'], ['Dom', '✓', '✗', '✓', '✓', 'Galletas (≈220 kcal)']]} /></Panel>
      <Panel title="Observaciones profesionales" right={<Btn variant="secondary" className="!px-2 !py-1" icon={<Plus size={11} />}>Agregar</Btn>}><Field area placeholder="Observación, indicación o ajuste…" /><div className="mt-2 text-[10px] text-mute">Última: «Ajustar cena por baja saciedad» · 10 oct</div></Panel>
    </div>
  </Desk>
)

/* ---------- Editores ---------- */
const MealEditor = () => (
  <Desk nav="Clientes" title="Editor de plan nutricional" crumbs="Ana Martínez › Planes › Nutrición" actions={<Btn>Guardar plan</Btn>}>
    <div className="grid grid-cols-3 gap-4">
      <Panel title="Comidas del día" right={<Tabs items={['L', 'M', 'M', 'J', 'V', 'S', 'D']} active="M" />} className="col-span-2">
        {[['08:00', 'Omelette de espinaca'], ['11:30', 'Yogurt con fruta'], ['14:30', 'Pollo con arroz'], ['19:00', 'Ensalada de atún']].map(([h, n]) => <div key={n} className="mb-1.5 flex items-center gap-2 rounded-lg border border-line p-2 text-[11px]"><GripVertical size={12} className="text-mute" /><Chip>{h}</Chip><span className="flex-1 font-semibold">{n}</span><Copy size={12} className="text-mute" /><Trash2 size={12} className="text-alert" /></div>)}
        <Btn variant="secondary" className="mt-1 w-full" icon={<Plus size={12} />}>Agregar comida</Btn>
      </Panel>
      <Panel title="Pollo con arroz"><Ph src={IMG.chicken} alt="Pollo con arroz" className="mb-2.5 h-24" /><div className="grid gap-2.5"><Field label="Horario" value="14:30" /><Field label="Porción" value="1 plato" /><div><Mono>Ingredientes</Mono>{[['Pechuga', '120 g'], ['Arroz integral', '¾ taza']].map(([a, b]) => <div key={a} className="mt-1 flex justify-between rounded bg-fill px-2 py-1 text-[11px]"><span>{a}</span><span>{b}</span></div>)}<div className="mt-1 text-[11px] font-semibold">+ Ingrediente</div></div><Field label="Indicaciones" area value="Cocinar a la plancha." /></div></Panel>
    </div>
  </Desk>
)

const RoutineEditor = () => (
  <Desk nav="Clientes" title="Editor de rutina" crumbs="Ana Martínez › Planes › Rutina" actions={<Btn>Guardar rutina</Btn>}>
    <Panel title="Tren superior · Lunes y jueves" right={<Btn variant="secondary" className="!px-2 !py-1" icon={<Plus size={11} />}>Agregar ejercicio</Btn>}>
      <Table head={['', 'Ejercicio', 'Series', 'Repeticiones', 'Descanso', 'Instrucciones', '']} rows={[['⋮⋮', 'Press de banca', '4', '10', '90 s', 'Espalda neutra', <Trash2 key="remove" size={12} />], ['⋮⋮', 'Remo con mancuerna', '4', '12', '60 s', 'Codo pegado', <Trash2 key="remove" size={12} />], ['⋮⋮', 'Press militar', '3', '12', '60 s', 'No arquear', <Trash2 key="remove" size={12} />], ['⋮⋮', 'Plancha', '3', '40 s', '30 s', 'Core activo', <Trash2 key="remove" size={12} />]]} />
    </Panel>
  </Desk>
)

const HabitEditor = () => (
  <Desk nav="Clientes" title="Editor de hábitos" crumbs="Ana Martínez › Planes › Hábitos" actions={<Btn>Guardar hábitos</Btn>}>
    <div className="grid grid-cols-2 gap-4">
      <Panel title="Hábitos configurados" right={<Btn variant="secondary" className="!px-2 !py-1" icon={<Plus size={11} />}>Nuevo</Btn>}>{[['Dormir 7 h', 'Diario'], ['Caminar 8,000 pasos', 'Diario'], ['Preparar comidas', 'Domingos']].map(([a, b]) => <Row key={a} title={a} sub={b} />)}</Panel>
      <Panel title="Caminar 8,000 pasos"><div className="grid gap-3"><Field label="Nombre" value="Caminar 8,000 pasos" /><Field label="Descripción" area value="Caminata ligera tras comer." /><div><Mono>Frecuencia</Mono><div className="mt-1.5 flex gap-1">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full bg-blue text-[10px] text-white">{d}</span>)}</div></div><Field label="Objetivo" value="8000 pasos" /></div></Panel>
    </div>
  </Desk>
)

const HealthEditor = () => (
  <Desk nav="Clientes" title="Perfil de salud · Ana Martínez" crumbs="Clientes › Ana Martínez › Perfil de salud" actions={<Btn>Guardar cambios</Btn>}>
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 grid grid-cols-2 gap-4">{[['Condiciones diagnosticadas', 'Hipotiroidismo'], ['Alergias e intolerancias', 'Lactosa, Nueces'], ['Restricciones alimentarias', 'Sin lácteos, bajo en sodio'], ['Objetivos', 'Reducir grasa, ganar fuerza']].map(([a, b]) => <Panel key={a} title={a}><Field value={b} /><div className="mt-2 flex items-center justify-between text-[10px] text-mute">Visible al cliente<Toggle on /></div></Panel>)}<Panel title="Solicitud pendiente del cliente" className="col-span-2"><div className="flex items-center gap-3 text-[11px]"><div className="flex-1">Ana solicita agregar «alergia a la soya».</div><Btn variant="secondary" className="!px-2.5 !py-1.5">Rechazar</Btn><Btn className="!px-2.5 !py-1.5">Aprobar</Btn></div></Panel></div>
      <Panel title="Trazabilidad"><div className="space-y-2.5 text-[10px]">{[['10 oct · Dra. Reyes', 'Restricciones: +bajo en sodio'], ['02 oct · Dra. Reyes', 'Condiciones: alta de hipotiroidismo'], ['25 sep · Ana', 'Solicitud: alergias']].map(([a, b]) => <div key={a} className="border-l-2 border-blue pl-2"><Mono>{a}</Mono><div className="text-[11px]">{b}</div></div>)}</div></Panel>
    </div>
  </Desk>
)

const SyncHistory = () => (
  <Desk nav="Seguimiento" title="Historial de sincronización" crumbs="Seguimiento › Sincronización">
    <div className="flex gap-3"><Stat label="Recibidos" value="128" /><Stat label="Pendientes" value="5" /><Stat label="Rechazados" value="2" /><Stat label="Requieren revisión" value="3" /></div>
    <Table head={['Fecha', 'Cliente', 'Cambio', 'Estado', 'Acción']} rows={[['14 oct 14:41', 'Ana Martínez', 'Registro de comida', <Chip key="status" tone="ok">Recibido</Chip>, '—'], ['14 oct 12:10', 'Luis Hernández', 'Registro de agua ×3', <Chip key="status" tone="warn">Pendiente</Chip>, 'Reintentar'], ['13 oct 20:05', 'Carlos Ortega', 'Edición de perfil de salud', <Chip key="status" tone="alert">Requiere revisión</Chip>, 'Revisar'], ['13 oct 18:22', 'Sofía Ramírez', 'Registro duplicado', <Chip key="status" tone="alert">Rechazado</Chip>, 'Ver motivo']]} />
  </Desk>
)

export const hostScreens: Screen[] = [
  { id: 'H1', title: 'Inicio · HUB del HOST', el: <Home />, wide: true, notes: ['Encabezado con nombre, conexión y notificaciones; indicadores, actividad y accesos rápidos.'] },
  { id: 'H2', title: 'Listado de clientes', el: <PatientListFunctional />, wide: true },
  { id: 'H2a', title: 'Registro de cliente', el: <PatientRegisterFunctional />, wide: true },
  { id: 'H2b', title: 'Vinculación mediante QR', el: <QR />, wide: true, notes: ['Código temporal, de un solo uso; sin datos médicos ni contraseñas.'] },
  { id: 'H2c', title: 'Detalle de cliente · Información general', el: <ClientDetail />, wide: true },
  { id: 'H2d', title: 'Detalle de cliente · Estado de salud', el: <ClientHealth />, wide: true },
  { id: 'H2e', title: 'Detalle de cliente · Módulos', el: <ClientModules />, wide: true },
  { id: 'H2f', title: 'Detalle de cliente · Planes', el: <ClientPlans />, wide: true },
  { id: 'H2g', title: 'Detalle de cliente · Seguimiento', el: <ClientTrack />, wide: true },
  { id: 'H2h', title: 'Detalle de cliente · Expediente documental', el: <ClientDocs />, wide: true },
  { id: 'H2i', title: 'Detalle de cliente · Historial de modificaciones', el: <ClientHistory />, wide: true },
  { id: 'H3', title: 'Catálogo de plantillas', el: <Templates />, wide: true },
  { id: 'H3a', title: 'Crear plantilla', el: <TemplateForm />, wide: true },
  { id: 'H3b', title: 'Editar plantilla · versionado', el: <TemplateForm edit />, wide: true, notes: ['Los cambios crean una nueva versión; no alteran a pacientes existentes.'] },
  { id: 'H4', title: 'Catálogo de módulos', el: <Modules />, wide: true },
  { id: 'H4a', title: 'Crear módulo', el: <NewModule />, wide: true },
  { id: 'H4b', title: 'Configuración del módulo', el: <ModuleConfig />, wide: true },
  { id: 'H4c', title: 'Configuración individual de cliente', el: <ClientConfig />, wide: true },
  { id: 'H5', title: 'Listado de documentos', el: <Docs />, wide: true },
  { id: 'H5a', title: 'Cargar documento', el: <Upload2 />, wide: true },
  { id: 'H5b', title: 'Consultar documento y permisos', el: <DocView />, wide: true },
  { id: 'H6', title: 'Seguimiento · panel de evolución', el: <Tracking />, wide: true },
  { id: 'H6a', title: 'Seguimiento nutricional y observaciones', el: <TrackNutri />, wide: true },
  { id: 'H6b', title: 'Historial de sincronización', el: <SyncHistory />, wide: true },
  { id: 'H7a', title: 'Editor de plan nutricional', el: <MealEditor />, wide: true },
  { id: 'H7b', title: 'Editor de rutina', el: <RoutineEditor />, wide: true },
  { id: 'H7c', title: 'Editor de hábitos', el: <HabitEditor />, wide: true },
  { id: 'H7d', title: 'Perfil de salud con trazabilidad', el: <HealthEditor />, wide: true },
]
void Users; void UserCheck; void RotateCcw; void EyeIcon; void Check
