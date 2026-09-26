'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, AlertTriangle, Bot, CheckCircle2, CircleDollarSign, Clock3, Command,
  LayoutDashboard, ListTodo, LogOut, Menu, Network, Play, RefreshCw, Search,
  Settings2, ShieldAlert, Target, Users, X, Zap,
} from 'lucide-react'

const SUPABASE_URL = 'https://fotlgptsjnhmkgjgrzxv.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_J6v-ctU4kYueFa9J8YK34g_3ZUnwCgU'
const SESSION_KEY = 'melano-command-center-session'
const CANONICAL_TENANT_ID = 'c26b11fb-46be-46b8-a8f6-7bbd1ece622f'

type SectionKey = 'Command' | 'Agents' | 'Approvals' | 'Decisions' | 'Tasks' | 'Today' | 'Leads' | 'Metrics' | 'Revenue' | 'Automations' | 'Settings'
type Session = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user: { id: string; email?: string }
}
type Membership = { tenant_id: string; role: string }
type AgentRow = { id: string; name: string; state: string; last_run_at: string | null; error_count: number | null }
type ApprovalRow = { id: string; status: string; risk_level: string | null; action_type: string | null; reason: string | null; requested_at: string }
type DecisionRow = { id: string; priority: string; title: string; state: string; owner: string | null; approval_required: boolean | null; execution_state: string | null; updated_at: string }
type TaskRow = { id: string; priority: string; title: string; status: string; owner_agent_id: string | null; requires_approval: boolean | null; updated_at: string }
type CriticalRow = { id: string; priority: string; title: string; owner: string | null; status: string; updated_at: string }
type LogRow = { id: number; event_type: string; status: string; message: string | null; trace_id: string | null; created_at: string }
type RevenueRow = { id: string; currency: string; realized_amount: number | string; mrr_amount: number | string | null; pipeline_amount: number | string | null; attribution_status: string; updated_at: string }
type PipelineRow = { id: string; health: string; total_value: number | string; deal_count: number; fields: unknown; updated_at: string }
type MrrRow = { id: string; headline: string; mrr_value: number | string; fields: unknown; updated_at: string }
type MeetingRow = { id: string; status: string; trace_id: string; top3_count: number | null; completed_at: string | null; created_at: string; error: string | null }

type Snapshot = {
  membership: Membership
  agents: AgentRow[]
  approvals: ApprovalRow[]
  decisions: DecisionRow[]
  tasks: TaskRow[]
  critical: CriticalRow[]
  logs: LogRow[]
  revenue: RevenueRow[]
  pipeline: PipelineRow[]
  mrr: MrrRow[]
  meetings: MeetingRow[]
}

const navigation: { label: SectionKey; icon: LucideIcon }[] = [
  { label: 'Command', icon: LayoutDashboard },
  { label: 'Agents', icon: Bot },
  { label: 'Approvals', icon: CheckCircle2 },
  { label: 'Decisions', icon: Network },
  { label: 'Tasks', icon: ListTodo },
  { label: 'Today', icon: Clock3 },
  { label: 'Leads', icon: Users },
  { label: 'Metrics', icon: Activity },
  { label: 'Revenue', icon: CircleDollarSign },
  { label: 'Automations', icon: Zap },
  { label: 'Settings', icon: Settings2 },
]

function storageRead(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

function storageWrite(session: Session | null) {
  if (typeof window === 'undefined') return
  if (!session) window.localStorage.removeItem(SESSION_KEY)
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

async function authRequest(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.msg || payload?.error_description || payload?.error || 'AUTH_FAILED')
  return payload
}

function normalizeSession(payload: any): Session {
  const expiresAt = payload.expires_at ?? Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600)
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: expiresAt,
    expires_in: payload.expires_in,
    user: payload.user,
  }
}

async function refreshSession(session: Session): Promise<Session> {
  if (!session.refresh_token) throw new Error('SESSION_EXPIRED')
  const payload = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
  const next = normalizeSession(payload)
  storageWrite(next)
  return next
}

async function ensureSession(session: Session): Promise<Session> {
  if (!session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 90) return session
  return refreshSession(session)
}

async function sbFetch<T>(path: string, session: Session, init: RequestInit = {}): Promise<T> {
  const liveSession = await ensureSession(session)
  const headers = new Headers(init.headers)
  headers.set('apikey', SUPABASE_PUBLISHABLE_KEY)
  headers.set('Authorization', `Bearer ${liveSession.access_token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers, cache: 'no-store' })
  if (response.status === 401) throw new Error('SESSION_INVALID')
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP_${response.status}`)
  return payload as T
}

const rest = (table: string, query: string, session: Session) =>
  sbFetch<any[]>(`/rest/v1/${table}?${query}`, session, { headers: { Accept: 'application/json' } })

function fmtMoney(value: number | string | null | undefined, currency = 'USD') {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Sin registro'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function today() {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date()).toUpperCase()
}

async function loadSnapshot(session: Session): Promise<Snapshot> {
  const memberships = await rest('tenant_members', `select=tenant_id,role&user_id=eq.${encodeURIComponent(session.user.id)}`, session) as Membership[]
  if (!memberships.length) throw new Error('TENANT_MEMBERSHIP_NOT_FOUND')
  const membership = memberships.find(item => item.tenant_id === CANONICAL_TENANT_ID)
  if (!membership) throw new Error('CANONICAL_TENANT_ACCESS_REQUIRED')
  const t = encodeURIComponent(membership.tenant_id)

  const [agents, approvals, decisions, tasks, critical, logs, revenue, pipeline, mrr, meetings] = await Promise.all([
    rest('agents', `select=id,name,state,last_run_at,error_count&tenant_id=eq.${t}&order=name.asc`, session),
    rest('approvals', `select=id,status,risk_level,action_type,reason,requested_at&tenant_id=eq.${t}&order=requested_at.desc&limit=50`, session),
    rest('decisions', `select=id,priority,title,state,owner,approval_required,execution_state,updated_at&tenant_id=eq.${t}&order=updated_at.desc&limit=50`, session),
    rest('tasks', `select=id,priority,title,status,owner_agent_id,requires_approval,updated_at&tenant_id=eq.${t}&order=updated_at.desc&limit=50`, session),
    rest('critical_actions', `select=id,priority,title,owner,status,updated_at&tenant_id=eq.${t}&resolved_at=is.null&order=updated_at.desc&limit=30`, session),
    rest('automation_logs', `select=id,event_type,status,message,trace_id,created_at&tenant_id=eq.${t}&order=created_at.desc&limit=30`, session),
    rest('revenue_ledger_snapshot', `select=id,currency,realized_amount,mrr_amount,pipeline_amount,attribution_status,updated_at&tenant_id=eq.${t}&order=updated_at.desc&limit=10`, session),
    rest('pipeline_snapshot', `select=id,health,total_value,deal_count,fields,updated_at&tenant_id=eq.${t}&order=updated_at.desc&limit=5`, session),
    rest('mrr_snapshot', `select=id,headline,mrr_value,fields,updated_at&tenant_id=eq.${t}&order=updated_at.desc&limit=5`, session),
    rest('meeting_runs', `select=id,status,trace_id,top3_count,completed_at,created_at,error&tenant_id=eq.${t}&order=created_at.desc&limit=10`, session),
  ])

  return {
    membership,
    agents: agents as AgentRow[],
    approvals: approvals as ApprovalRow[],
    decisions: decisions as DecisionRow[],
    tasks: tasks as TaskRow[],
    critical: critical as CriticalRow[],
    logs: logs as LogRow[],
    revenue: revenue as RevenueRow[],
    pipeline: pipeline as PipelineRow[],
    mrr: mrr as MrrRow[],
    meetings: meetings as MeetingRow[],
  }
}

function Login({ onSession }: { onSession: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const payload = await authRequest('token?grant_type=password', { email, password })
      const session = normalizeSession(payload)
      storageWrite(session)
      onSession(session)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b0b0b',color:'#fff',padding:24}}>
    <form onSubmit={submit} style={{width:'min(420px,100%)',border:'1px solid #2b2b2b',borderRadius:18,padding:28,background:'#111'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <div className="brand-mark"><Command size={18}/></div>
        <div><strong style={{display:'block'}}>MELANO INC</strong><span style={{fontSize:12,color:'#a8a8a8'}}>COMMAND CENTER · ACCESO SEGURO</span></div>
      </div>
      <h1 style={{fontSize:26,marginBottom:8}}>Ingresar</h1>
      <p style={{color:'#aaa',marginBottom:22}}>Supabase Auth + aislamiento por tenant.</p>
      <label style={{display:'grid',gap:8,marginBottom:14}}><span>Email</span><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{padding:12,borderRadius:10,border:'1px solid #333',background:'#090909',color:'#fff'}} /></label>
      <label style={{display:'grid',gap:8,marginBottom:18}}><span>Contraseña</span><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{padding:12,borderRadius:10,border:'1px solid #333',background:'#090909',color:'#fff'}} /></label>
      {error && <p style={{color:'#ff8a8a',fontSize:13,marginBottom:14}}>{error}</p>}
      <button className="primary-button" disabled={busy} style={{width:'100%',justifyContent:'center'}}>{busy ? 'Validando…' : 'Entrar al Command Center'}</button>
    </form>
  </main>
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
}

function Rows({ rows }: { rows: { title: string; detail: string; status: string }[] }) {
  return <div className="detail-list">
    {rows.length ? rows.map((row, i) => <article className="detail-list-item" key={`${row.title}-${i}`}>
      <div><strong>{row.title}</strong><p>{row.detail}</p></div>
      <span className={`status-pill ${/error|failed|blocked|red/i.test(row.status) ? 'error' : /pending|warning|degraded|yellow/i.test(row.status) ? 'warning' : 'ready'}`}>{row.status}</span>
    </article>) : <div className="empty-state"><strong>Sin registros</strong><p>No hay datos para este tenant en esta vista.</p></div>}
  </div>
}

export function CommandCenter() {
  const [session, setSession] = useState<Session | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('Command')
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async (current: Session) => {
    setLoading(true); setError('')
    try {
      const live = await ensureSession(current)
      if (live.access_token !== current.access_token) { setSession(live); storageWrite(live) }
      setSnapshot(await loadSnapshot(live))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'LOAD_FAILED'
      if (message === 'SESSION_INVALID' || message === 'SESSION_EXPIRED') {
        storageWrite(null); setSession(null); setSnapshot(null)
      } else setError(message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const stored = storageRead()
    if (!stored) { setLoading(false); return }
    setSession(stored)
    void reload(stored)
  }, [reload])

  async function onLogin(next: Session) {
    setSession(next)
    await reload(next)
  }

  function logout() {
    storageWrite(null); setSession(null); setSnapshot(null); setNotice('')
  }

  async function runMeeting() {
    if (!session) return
    setRunning(true); setError(''); setNotice('')
    try {
      const live = await ensureSession(session)
      const result = await sbFetch<any>('/functions/v1/melania-morning-meeting', live, {
        method: 'POST',
        body: JSON.stringify({ tenant_slug: 'melano-inc', trigger_source: 'manual' }),
      })
      setNotice(`Reunión ejecutada · trace ${result.trace_id ?? result.meeting?.trace_id ?? 'registrado'} · Top 3: ${result.top3_count ?? result.meeting?.top3_count ?? 0}`)
      await reload(live)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MEETING_FAILED')
    } finally { setRunning(false) }
  }

  const filteredNavigation = useMemo(() => navigation.filter(x => x.label.toLowerCase().includes(query.trim().toLowerCase())), [query])

  if (!session && !loading) return <Login onSession={onLogin} />
  if (!session) return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b0b0b',color:'#fff'}}>Validando sesión…</main>

  const pendingApprovals = snapshot?.approvals.filter(x => x.status.toLowerCase() === 'pending') ?? []
  const activeAgents = snapshot?.agents.filter(x => x.state.toUpperCase() === 'ACTIVE') ?? []
  const blockers = (snapshot?.critical.filter(x => x.status.toLowerCase() === 'blocked').length ?? 0) +
    (snapshot?.tasks.filter(x => x.status.toLowerCase() === 'blocked').length ?? 0)
  const ledger = snapshot?.revenue[0]
  const pipe = snapshot?.pipeline[0]
  const latestMeeting = snapshot?.meetings[0]
  const systemState = error ? 'RED' : pipe?.health === 'DEGRADED' || pendingApprovals.length > 0 || blockers > 0 ? 'YELLOW' : snapshot ? 'GREEN' : 'LOADING'

  const sectionRows: Record<Exclude<SectionKey,'Command'>, {title:string;detail:string;status:string}[]> = {
    Agents: (snapshot?.agents ?? []).map(x => ({ title: x.name, detail: `Última ejecución: ${fmtDate(x.last_run_at)} · errores: ${x.error_count ?? 0}`, status: x.state })),
    Approvals: (snapshot?.approvals ?? []).map(x => ({ title: x.action_type ?? 'Acción', detail: `${x.reason ?? 'Sin detalle'} · ${fmtDate(x.requested_at)}`, status: x.status })),
    Decisions: (snapshot?.decisions ?? []).map(x => ({ title: `[${x.priority}] ${x.title}`, detail: `Owner: ${x.owner ?? '—'} · ejecución: ${x.execution_state ?? '—'}`, status: x.state })),
    Tasks: (snapshot?.tasks ?? []).map(x => ({ title: `[${x.priority}] ${x.title}`, detail: `Owner: ${x.owner_agent_id ?? '—'} · aprobación: ${x.requires_approval ? 'sí' : 'no'}`, status: x.status })),
    Today: (snapshot?.critical ?? []).map(x => ({ title: `[${x.priority}] ${x.title}`, detail: `Owner: ${x.owner ?? '—'} · actualizado: ${fmtDate(x.updated_at)}`, status: x.status })),
    Leads: pipe ? [{ title: `${pipe.deal_count} leads en snapshot`, detail: `Fuente melano-crm · actualizado ${fmtDate(pipe.updated_at)}`, status: pipe.health }] : [],
    Metrics: [
      { title: 'Agentes', detail: `${activeAgents.length}/${snapshot?.agents.length ?? 0} activos`, status: activeAgents.length === (snapshot?.agents.length ?? 0) ? 'ready' : 'warning' },
      { title: 'Aprobaciones', detail: `${pendingApprovals.length} pendientes`, status: pendingApprovals.length ? 'warning' : 'ready' },
      { title: 'Bloqueos', detail: `${blockers} detectados`, status: blockers ? 'warning' : 'ready' },
    ],
    Revenue: (snapshot?.revenue ?? []).map(x => ({ title: `${x.currency} · realizado ${fmtMoney(x.realized_amount, x.currency)}`, detail: `MRR ${fmtMoney(x.mrr_amount, x.currency)} · pipeline ${fmtMoney(x.pipeline_amount, x.currency)} · ${fmtDate(x.updated_at)}`, status: x.attribution_status })),
    Automations: (snapshot?.logs ?? []).map(x => ({ title: x.event_type, detail: `${x.message ?? 'Sin mensaje'} · trace ${x.trace_id ?? '—'} · ${fmtDate(x.created_at)}`, status: x.status })),
    Settings: snapshot ? [
      { title: 'Tenant', detail: `${snapshot.membership.tenant_id} · rol ${snapshot.membership.role}`, status: 'ready' },
      { title: 'Supabase', detail: 'melano-command-center · RLS por tenant', status: 'ready' },
      { title: 'LUXIA snapshot', detail: pipe ? `Actualizado ${fmtDate(pipe.updated_at)}` : 'Sin snapshot', status: pipe ? pipe.health : 'warning' },
    ] : [],
  }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Command size={17}/></div><div><strong>MELANO</strong><span>INC / COMMAND CENTER</span></div><button className="mobile-close" onClick={()=>setSidebarOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">M</div><div><span>Workspace</span><strong>Melano Inc</strong></div></div>
      <label className="nav-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar" /></label>
      <nav><p className="nav-label">Workspace</p>{filteredNavigation.map(({label,icon:Icon})=><button key={label} className={`nav-item ${activeSection===label?'active':''}`} onClick={()=>{setActiveSection(label);setSidebarOpen(false)}}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><div className="status-dot"/><span>{systemState} · datos reales</span><span className="footer-version">v2.0</span></div>
    </aside>
    {sidebarOpen && <button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} />}
    <main className="main-content">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setSidebarOpen(true)}><Menu size={21}/></button>
        <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeSection}</strong></div>
        <div className="topbar-actions">
          <button className="icon-button" title="Actualizar" onClick={()=>void reload(session)} disabled={loading}><RefreshCw size={17}/></button>
          <button className="icon-button" title="Salir" onClick={logout}><LogOut size={17}/></button>
        </div>
      </header>
      <div className="content-wrap">
        {error && <div className="system-banner"><span className="banner-icon"><AlertTriangle size={16}/></span><div><strong>Error operativo</strong><p>{error}</p></div></div>}
        {notice && <div className="system-banner"><span className="banner-icon"><CheckCircle2 size={16}/></span><div><strong>Ejecución confirmada</strong><p>{notice}</p></div></div>}

        {activeSection === 'Command' ? <>
          <div className="page-heading"><div><p className="eyebrow">{today()}</p><h1>Command Center ejecutivo</h1><p className="subtitle">Datos reales por tenant · Supabase + LUXIA + n8n + MELANIA.</p></div><button className="primary-button" onClick={()=>void runMeeting()} disabled={running || loading}><Play size={14}/>{running?'Ejecutando…':'Run meeting'}</button></div>
          <div className="system-banner"><span className="banner-icon">{systemState==='GREEN'?<CheckCircle2 size={16}/>:<ShieldAlert size={16}/>}</span><div><strong>Estado {systemState}</strong><p>{snapshot ? `Último snapshot LUXIA: ${fmtDate(pipe?.updated_at)} · última reunión: ${fmtDate(latestMeeting?.completed_at ?? latestMeeting?.created_at)}` : 'Cargando fuentes verificadas…'}</p></div></div>
          <section><SectionHeader eyebrow="EN VIVO" title="Resumen ejecutivo" /><div className="summary-grid">
            <article className="summary-card"><div className="summary-icon"><CircleDollarSign size={18}/></div><div><span>Revenue realizado</span><strong>{ledger ? fmtMoney(ledger.realized_amount, ledger.currency) : '—'}</strong><small>{ledger?.attribution_status ?? 'Sin evidencia económica'}</small></div></article>
            <article className="summary-card"><div className="summary-icon"><Bot size={18}/></div><div><span>Agentes activos</span><strong>{activeAgents.length}/{snapshot?.agents.length ?? 0}</strong><small>Fuente: agents</small></div></article>
            <article className="summary-card"><div className="summary-icon"><CheckCircle2 size={18}/></div><div><span>Aprobaciones</span><strong>{pendingApprovals.length}</strong><small>Pendientes de decisión humana</small></div></article>
            <article className="summary-card"><div className="summary-icon"><ShieldAlert size={18}/></div><div><span>Bloqueos</span><strong>{blockers}</strong><small>critical_actions + tasks</small></div></article>
          </div></section>
          <div className="dashboard-grid">
            <section className="panel"><SectionHeader eyebrow="PRIORIDAD" title="Top 3" /><Rows rows={(snapshot?.critical ?? []).slice().sort((a,b)=>a.priority.localeCompare(b.priority)).slice(0,3).map(x=>({title:`[${x.priority}] ${x.title}`,detail:`Owner: ${x.owner ?? '—'} · ${fmtDate(x.updated_at)}`,status:x.status}))}/></section>
            <section className="panel"><SectionHeader eyebrow="GOBIERNO" title="Aprobaciones" /><Rows rows={pendingApprovals.slice(0,3).map(x=>({title:x.action_type ?? 'Acción',detail:x.reason ?? 'Sin detalle',status:x.status}))}/></section>
          </div>
          <div className="dashboard-grid lower-grid">
            <section className="panel"><SectionHeader eyebrow="LUXIA" title="Pipeline" /><Rows rows={pipe?[{title:`${pipe.deal_count} leads`,detail:`Actualizado ${fmtDate(pipe.updated_at)}`,status:pipe.health}]:[]}/></section>
            <section className="panel"><SectionHeader eyebrow="AUTOMATIZACIÓN" title="Actividad reciente" /><Rows rows={(snapshot?.logs ?? []).slice(0,4).map(x=>({title:x.event_type,detail:`${x.message ?? 'Sin mensaje'} · ${fmtDate(x.created_at)}`,status:x.status}))}/></section>
          </div>
        </> : <>
          <div className="page-heading"><div><p className="eyebrow">FUENTE VERIFICADA</p><h1>{activeSection}</h1><p className="subtitle">Lectura directa del tenant autenticado en Supabase.</p></div><button className="primary-button" onClick={()=>void reload(session)} disabled={loading}><RefreshCw size={14}/>{loading?'Actualizando…':'Actualizar'}</button></div>
          <section className="detail-grid"><div className="detail-card"><SectionHeader eyebrow="ESTADO ACTUAL" title={activeSection} /><Rows rows={sectionRows[activeSection]}/></div></section>
        </>}
        <footer className="page-footer"><span>MELANO INC — COMMAND CENTER</span><span>AUTH · TENANT · TRACE · EVIDENCE</span></footer>
      </div>
    </main>
  </div>
}

export default CommandCenter
