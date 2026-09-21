'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  Grid2X2,
  LayoutDashboard,
  ListTodo,
  Menu,
  Network,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react'

type SectionKey = 'Command' | 'Agents' | 'Approvals' | 'Decisions' | 'Tasks' | 'Today' | 'Leads' | 'Metrics' | 'Revenue' | 'Automations' | 'Settings'
type Status = 'ready' | 'waiting' | 'warning' | 'error'
type DataSource = 'supabase' | 'manual'
type RefreshPolicy = 'realtime' | 'hourly' | 'daily'

type NavigationItem = { label: SectionKey; icon: LucideIcon }
type DetailItem = { title: string; detail: string; status: Status }
type DetailSection = { eyebrow: string; title: string; description: string; icon: LucideIcon; items: DetailItem[] }

const navigation: NavigationItem[] = [
  { label: 'Command', icon: LayoutDashboard }, { label: 'Agents', icon: Bot },
  { label: 'Approvals', icon: CheckCircle2 }, { label: 'Decisions', icon: Network },
  { label: 'Tasks', icon: ListTodo }, { label: 'Today', icon: Clock3 },
  { label: 'Leads', icon: Users }, { label: 'Metrics', icon: Activity },
  { label: 'Revenue', icon: CircleDollarSign }, { label: 'Automations', icon: Zap },
  { label: 'Settings', icon: Settings2 },
]

const summaryCards = [
  { label: 'Revenue', value: '—', detail: 'Connect a source to activate', icon: CircleDollarSign },
  { label: 'Active agents', value: '—', detail: 'No live runs detected', icon: Bot },
  { label: 'Approvals', value: '—', detail: 'Nothing awaiting review', icon: CheckCircle2 },
  { label: 'Open blockers', value: '—', detail: 'No connected task data', icon: ShieldAlert },
]

const detailSections: Record<Exclude<SectionKey, 'Command'>, DetailSection> = {
  Agents: { eyebrow: 'Operations', title: 'Agent fleet', description: 'Monitor every autonomous worker, its health, and its latest execution.', icon: Bot, items: [{ title: 'No connected agents', detail: 'Connect an agent source to begin monitoring.', status: 'waiting' }] },
  Approvals: { eyebrow: 'Governance', title: 'Approval queue', description: 'Review high-impact actions before they are released to production.', icon: CheckCircle2, items: [{ title: 'Approval queue is clear', detail: 'Nothing is awaiting review.', status: 'ready' }] },
  Decisions: { eyebrow: 'Intelligence', title: 'Decision log', description: 'Keep a durable record of decisions, owners, rationale, and outcomes.', icon: Network, items: [{ title: 'No decisions recorded', detail: 'Decision activity will appear here.', status: 'waiting' }] },
  Tasks: { eyebrow: 'Execution', title: 'Task control', description: 'Prioritize work, assign owners, and keep blockers visible across the workspace.', icon: ListTodo, items: [{ title: 'No open tasks', detail: 'Connect task data to activate execution tracking.', status: 'waiting' }] },
  Today: { eyebrow: 'Daily brief', title: 'Today at a glance', description: 'A focused operating rhythm for meetings, deadlines, and critical actions.', icon: Clock3, items: [{ title: 'No events scheduled', detail: 'Your daily brief is clear.', status: 'ready' }] },
  Leads: { eyebrow: 'Growth', title: 'LUXIA leads', description: 'Track pipeline quality, next actions, and conversion momentum in one place.', icon: Users, items: [{ title: 'Lead pipeline unavailable', detail: 'Connect your CRM or funnel source.', status: 'waiting' }] },
  Metrics: { eyebrow: 'Performance', title: 'Metrics studio', description: 'Measure the operating system with trusted, auditable performance signals.', icon: Activity, items: [{ title: 'No metrics connected', detail: 'Configure a verified data source.', status: 'waiting' }] },
  Revenue: { eyebrow: 'Finance', title: 'Revenue control', description: 'See revenue movement, forecast confidence, and commercial performance.', icon: CircleDollarSign, items: [{ title: 'Revenue source required', detail: 'Connect billing or CRM data to activate this view.', status: 'waiting' }] },
  Automations: { eyebrow: 'Systems', title: 'Automation map', description: 'Understand what is running, what failed, and where manual work remains.', icon: Zap, items: [{ title: 'No automations connected', detail: 'Connect an automation provider to monitor runs.', status: 'waiting' }] },
  Settings: { eyebrow: 'Workspace', title: 'System settings', description: 'Manage workspace identity, integrations, notifications, and governance defaults.', icon: Settings2, items: [{ title: 'Workspace configuration', detail: 'Review source and refresh permissions.', status: 'ready' }] },
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()
}

function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button type="button" className="text-button" onClick={onAction}>{action}<ArrowUpRight size={13} aria-hidden="true" /></button>}</div>
}

function EmptyCard({ icon: Icon, title, description, action, onAction }: { icon: LucideIcon; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} aria-hidden="true" /></div><strong>{title}</strong><p>{description}</p>{action && <button type="button" className="secondary-button" onClick={onAction}><Plus size={13} aria-hidden="true" />{action}</button>}</div>
}

function useMeetingRunner() {
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runMeeting = useCallback(() => { if (timer.current) clearTimeout(timer.current); setRunning(true); timer.current = setTimeout(() => { setRunning(false); timer.current = null }, 1800) }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { running, runMeeting }
}

function ConfigurationDialog({ open, section, onClose }: { open: boolean; section: SectionKey; onClose: () => void }) {
  const [dataSource, setDataSource] = useState<DataSource>('supabase')
  const [refreshPolicy, setRefreshPolicy] = useState<RefreshPolicy>('realtime')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (!open) return; closeButtonRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', onKeyDown); const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow } }, [open, onClose])
  if (!open) return null

  async function save() {
    setSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setSaved(true)
      setTimeout(onClose, 700)
    } finally { setSaving(false) }
  }

  return <div className="config-overlay" role="dialog" aria-modal="true" aria-labelledby="config-title"><button type="button" className="config-dismiss" aria-label="Close configuration" onClick={onClose} /><div className="config-panel"><div className="config-header"><div><p className="eyebrow">SECTION CONFIGURATION</p><h2 id="config-title">Configure {section}</h2></div><button ref={closeButtonRef} type="button" className="icon-button" aria-label="Close configuration" onClick={onClose}><X size={17} /></button></div><p className="config-copy">Connect the verified source and define the permissions for this production surface.</p><label className="config-field"><span>Data source</span><select value={dataSource} onChange={(event) => setDataSource(event.target.value as DataSource)}><option value="supabase">Supabase — connected</option><option value="manual">Manual review queue</option></select></label><label className="config-field"><span>Refresh policy</span><select value={refreshPolicy} onChange={(event) => setRefreshPolicy(event.target.value as RefreshPolicy)}><option value="realtime">Realtime</option><option value="hourly">Every hour</option><option value="daily">Daily</option></select></label><div className="config-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={saving} onClick={save}>{saved ? <><Check size={14} />Saved</> : saving ? 'Saving…' : 'Save configuration'}</button></div></div></div>
}

export function CommandCenter() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('Command')
  const [query, setQuery] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const { running, runMeeting } = useMeetingRunner()
  const filteredNavigation = useMemo(() => { const normalized = query.trim().toLowerCase(); return navigation.filter(({ label }) => label.toLowerCase().includes(normalized)) }, [query])
  const detail = activeSection === 'Command' ? null : detailSections[activeSection]
  const selectSection = (section: SectionKey) => { setActiveSection(section); setSidebarOpen(false) }
  const openConfiguration = () => setConfigOpen(true)

  return <div className="app-shell"><aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><div className="brand-lockup"><div className="brand-mark"><Command size={17} strokeWidth={1.7} /></div><div><strong>MELANO</strong><span>INC / COMMAND CENTER</span></div><button type="button" className="mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div><div className="workspace-switcher"><div className="workspace-avatar">M</div><div><span>Workspace</span><strong>Melano Inc</strong></div><ChevronDown size={15} /></div><label className="nav-search"><Search size={14} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" aria-label="Search workspace" /></label><nav aria-label="Primary navigation"><p className="nav-label">Workspace</p>{filteredNavigation.map(({ label, icon: Icon }) => <button type="button" key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} aria-current={activeSection === label ? 'page' : undefined} onClick={() => selectSection(label)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}{filteredNavigation.length === 0 && <p className="nav-empty">No sections found</p>}</nav><div className="sidebar-footer"><div className="status-dot" /><span>Data source connected</span><span className="footer-version">v1.1</span></div></aside>{sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}<main className="main-content"><header className="topbar"><button type="button" className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeSection}</strong></div><div className="topbar-actions"><button type="button" className="icon-button" aria-label="Open notifications"><Bell size={17} /></button><button type="button" className="workspace-avatar" aria-label="Open profile">M</button></div></header><div className="content-wrap">{activeSection === 'Command' ? <><div className="page-heading"><div><p className="eyebrow">{formatToday()}</p><h1>Good morning, Melano.</h1><p className="subtitle">Your executive view across AI, automation, and commercial growth.</p></div><button type="button" className="primary-button" onClick={runMeeting} disabled={running}><Play size={14} aria-hidden="true" />{running ? 'Running meeting…' : 'Run meeting'}</button></div><div className="system-banner"><span className="banner-icon"><Sparkles size={16} /></span><div><strong>Command center ready</strong><p>Production surfaces are ready. Connect approved data sources to activate live signals.</p></div></div><section><SectionHeader eyebrow="At a glance" title="Executive overview" /><div className="summary-grid">{summaryCards.map(({ label, value, detail: cardDetail, icon: Icon }) => <article className="summary-card" key={label}><div className="summary-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{cardDetail}</small></div></article>)}</div></section><div className="dashboard-grid"><section className="panel"><SectionHeader eyebrow="Priority intelligence" title="Top 3" action="View all" onAction={() => selectSection('Decisions')} /><EmptyCard icon={Target} title="No priority decisions" description="Connect decision data to surface the most important items." action="Configure source" onAction={openConfiguration} /></section><section className="panel"><SectionHeader eyebrow="Governance" title="Approvals" action="Open queue" onAction={() => selectSection('Approvals')} /><EmptyCard icon={CheckCircle2} title="Nothing awaiting review" description="High-impact actions will appear here before release." /></section></div><div className="dashboard-grid lower-grid"><section className="panel"><SectionHeader eyebrow="Growth" title="LUXIA leads" action="Open leads" onAction={() => selectSection('Leads')} /><EmptyCard icon={Users} title="Lead pipeline unavailable" description="Connect your CRM or funnel source to activate conversion tracking." action="Configure source" onAction={openConfiguration} /></section><section className="panel"><SectionHeader eyebrow="Automations" title="System activity" action="Open map" onAction={() => selectSection('Automations')} /><EmptyCard icon={Zap} title="No live runs detected" description="Automation health and failures will appear here." /></section></div></> : <><div className="page-heading"><div><p className="eyebrow">{detail?.eyebrow}</p><h1>{detail?.title}</h1><p className="subtitle">{detail?.description}</p></div><button type="button" className="primary-button" onClick={openConfiguration}><Settings2 size={14} />Configure</button></div><div className="detail-toolbar"><div className="connection-state"><span className="status-dot" /><span>Production surface</span><small>Waiting for verified source data</small></div><button type="button" className="secondary-button" onClick={openConfiguration}><Grid2X2 size={14} />Manage source</button></div><section className="detail-grid"><div className="detail-card"><SectionHeader eyebrow="Current state" title="Workspace signal" /><div className="detail-list">{detail?.items.map((item) => <article className="detail-list-item" key={item.title}><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className={`status-pill ${item.status}`}>{item.status}</span></article>)}</div></div><div className="detail-card"><SectionHeader eyebrow="Next action" title="Activate this surface" /><EmptyCard icon={detail?.icon ?? AlertTriangle} title="Connect verified data" description="Choose a source and refresh policy to make this surface operational." action="Configure source" onAction={openConfiguration} /></div></section></>}<footer className="page-footer"><span>MELANO INC — AUTONOMOUS COMMAND CENTER</span><span>AI. AUTOMATION. IMPACT.</span></footer></div></main><ConfigurationDialog open={configOpen} section={activeSection} onClose={() => setConfigOpen(false)} /></div>
}

export default CommandCenter
