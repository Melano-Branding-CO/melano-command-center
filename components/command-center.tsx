'use client'

import { useMemo, useState } from 'react'
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

const navigation: { label: SectionKey; icon: typeof LayoutDashboard }[] = [
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

const summaryCards = [
  { label: 'Revenue', value: '—', detail: 'Connect a source to activate', icon: CircleDollarSign },
  { label: 'Active agents', value: '—', detail: 'No live runs detected', icon: Bot },
  { label: 'Approvals', value: '—', detail: 'Nothing awaiting review', icon: CheckCircle2 },
  { label: 'Open blockers', value: '—', detail: 'No connected task data', icon: ShieldAlert },
]

const detailSections: Record<Exclude<SectionKey, 'Command'>, { eyebrow: string; title: string; description: string; icon: typeof Bot; items: { title: string; detail: string; status: string }[] }> = {
  Agents: { eyebrow: 'Operations', title: 'Agent fleet', description: 'Monitor every autonomous worker, its health, and its latest execution.', icon: Bot, items: [{ title: 'No connected agents', detail: 'Register an agent runtime to see health and execution history.', status: 'Standby' }] },
  Approvals: { eyebrow: 'Governance', title: 'Approval queue', description: 'Review high-impact actions before they are released to production.', icon: CheckCircle2, items: [{ title: 'Approval queue is clear', detail: 'New requests will appear here with owner, risk, and context.', status: 'Clear' }] },
  Decisions: { eyebrow: 'Intelligence', title: 'Decision log', description: 'Keep a durable record of decisions, owners, rationale, and outcomes.', icon: Network, items: [{ title: 'No decisions recorded', detail: 'Execute or connect your board workflow to begin the decision trail.', status: 'Awaiting data' }] },
  Tasks: { eyebrow: 'Execution', title: 'Task control', description: 'Prioritize work, assign owners, and keep blockers visible across the workspace.', icon: ListTodo, items: [{ title: 'No open tasks', detail: 'Your task system is ready for the first synced work item.', status: 'Ready' }] },
  Today: { eyebrow: 'Daily brief', title: 'Today at a glance', description: 'A focused operating rhythm for meetings, deadlines, and critical actions.', icon: Clock3, items: [{ title: 'No events scheduled', detail: 'Your daily brief will populate once a calendar or task source is connected.', status: 'Open' }] },
  Leads: { eyebrow: 'Growth', title: 'LUXIA leads', description: 'Track pipeline quality, next actions, and conversion momentum in one place.', icon: Users, items: [{ title: 'Lead pipeline unavailable', detail: 'Connect your CRM or lead source to activate this workspace.', status: 'Not connected' }] },
  Metrics: { eyebrow: 'Performance', title: 'Metrics studio', description: 'Measure the operating system with trusted, auditable performance signals.', icon: Activity, items: [{ title: 'No metrics configured', detail: 'Choose the first KPI source to start building your scorecard.', status: 'Configure' }] },
  Revenue: { eyebrow: 'Finance', title: 'Revenue control', description: 'See revenue movement, forecast confidence, and commercial performance.', icon: CircleDollarSign, items: [{ title: 'Revenue source not connected', detail: 'Connect billing or finance data before displaying financial totals.', status: 'Protected' }] },
  Automations: { eyebrow: 'Systems', title: 'Automation map', description: 'Understand what is running, what failed, and where manual work remains.', icon: Zap, items: [{ title: 'No automations connected', detail: 'Add an automation provider to surface runs and failure states.', status: 'Ready' }] },
  Settings: { eyebrow: 'Workspace', title: 'System settings', description: 'Manage workspace identity, integrations, notifications, and governance defaults.', icon: Settings2, items: [{ title: 'Workspace configuration', detail: 'Supabase connection is detected. Production schema and member access still need verification.', status: 'Review' }] },
}

function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={onAction}>{action}<ArrowUpRight size={13} /></button>}</div>
}

function EmptyCard({ icon: Icon, title, description, action }: { icon: typeof Bot; title: string; description: string; action?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{description}</p>{action && <button className="secondary-button"><Plus size={13} />{action}</button>}</div>
}

export function CommandCenter() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('Command')
  const [running, setRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  const filteredNavigation = useMemo(() => navigation.filter(({ label }) => label.toLowerCase().includes(query.toLowerCase())), [query])
  const detail = activeSection === 'Command' ? null : detailSections[activeSection]

  function selectSection(section: SectionKey) {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  function runMeeting() {
    setRunning(true)
    window.setTimeout(() => setRunning(false), 1800)
  }

  function openConfiguration() {
    setConfigSaved(false)
    setConfigOpen(true)
  }

  function saveConfiguration() {
    setConfigSaved(true)
    window.setTimeout(() => setConfigOpen(false), 900)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Command size={17} strokeWidth={1.7} /></div><div><strong>MELANO</strong><span>INC / COMMAND CENTER</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">M</div><div><span>Workspace</span><strong>Melano Inc</strong></div><ChevronDown size={15} /></div>
      <label className="nav-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" aria-label="Search workspace" /></label>
      <nav aria-label="Primary navigation"><p className="nav-label">Workspace</p>{filteredNavigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => selectSection(label)}><Icon size={17} strokeWidth={1.7} /><span>{label}</span>{label === 'Approvals' && <span className="nav-count">0</span>}</button>)}</nav>
      <div className="sidebar-footer"><div className="status-dot" /><span>Systems operational</span><span className="footer-version">v1.0</span></div>
    </aside>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeSection}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications" onClick={() => setActiveSection('Approvals')}><Bell size={18} /><i /></button><div className="user-chip"><div className="user-avatar">MC</div><span>Melano Corp</span><ChevronDown size={14} /></div></div></header>
      <div className="content-wrap">
        {activeSection === 'Command' ? <>
          <div className="page-heading"><div><p className="eyebrow">THURSDAY, 18 SEPTEMBER 2026</p><h1>Good morning, Melano.</h1><p className="subtitle">Your executive view across AI, automation, and impact.</p></div><button className="primary-button" onClick={runMeeting} disabled={running}><Play size={15} fill="currentColor" />{running ? 'Starting board…' : 'Execute meeting now'}</button></div>
          <div className="system-banner"><span className="banner-icon"><Sparkles size={16} /></span><div><strong>Command center ready</strong><p>Production surfaces are ready. Connect approved data sources to activate live intelligence.</p></div><span className="banner-status"><span className="status-dot" />Ready</span></div>
          <section><SectionHeader eyebrow="At a glance" title="Executive overview" /><div className="summary-grid">{summaryCards.map(({ label, value, detail: cardDetail, icon: Icon }) => <article className="summary-card" key={label}><div className="card-icon"><Icon size={17} /></div><div className="summary-copy"><span>{label}</span><strong>{value}</strong><p>{cardDetail}</p></div></article>)}</div></section>
          <div className="dashboard-grid"><section className="panel"><SectionHeader eyebrow="Priority intelligence" title="Top 3" action="View all" onAction={() => selectSection('Decisions')} /><EmptyCard icon={Target} title="No priorities yet" description="Executive priorities will appear here once your workspace has live data." action="Create priority" /></section><section className="panel"><SectionHeader eyebrow="Operations" title="Agent activity" action="View agents" onAction={() => selectSection('Agents')} /><EmptyCard icon={Bot} title="No agent activity" description="Agent runs and their current status will be visible here." action="Register agent" /></section></div>
          <div className="dashboard-grid lower-grid"><section className="panel"><SectionHeader eyebrow="Growth" title="LUXIA leads" action="Open leads" onAction={() => selectSection('Leads')} /><div className="metric-empty"><Users size={20} /><span>Awaiting connected data</span></div></section><section className="panel"><SectionHeader eyebrow="Automations" title="Recent activity" action="Open automations" onAction={() => selectSection('Automations')} /><div className="metric-empty"><Zap size={20} /><span>No automation logs yet</span></div></section><section className="panel"><SectionHeader eyebrow="Governance" title="Decisions & approvals" action="Review" onAction={() => selectSection('Approvals')} /><div className="metric-empty"><CheckCircle2 size={20} /><span>Nothing to review</span></div></section></div>
        </> : <>
          <div className="page-heading"><div><p className="eyebrow">{detail?.eyebrow}</p><h1>{detail?.title}</h1><p className="subtitle">{detail?.description}</p></div><button className="primary-button" onClick={() => selectSection('Command')}><LayoutDashboard size={15} />Back to command</button></div>
          <div className="detail-toolbar"><div className="connection-state"><span className="status-dot" /><span>Production surface</span><small>Waiting for verified source data</small></div><button className="secondary-button" onClick={openConfiguration}><Settings2 size={13} />Configure</button></div>
          <section className="detail-grid"><div className="detail-card"><SectionHeader eyebrow="Current state" title="Workspace signal" /><div className="detail-list">{detail?.items.map((item) => <article className="detail-row" key={item.title}><div className="detail-icon"><detail.icon size={17} /></div><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="state-pill"><Check size={12} />{item.status}</span></article>)}</div></div><aside className="detail-card side-card"><p className="eyebrow">Control notes</p><h2>Built for verified operations</h2><p className="side-copy">This surface will only show production values after the connected source and tenant permissions are verified. No placeholder business data is being displayed.</p><div className="note-line"><AlertTriangle size={15} /><span>Schema verification required</span></div></aside></section>
        </>}
        <footer className="page-footer"><span>MELANO INC — AUTONOMOUS COMMAND CENTER</span><span>AI. AUTOMATION. IMPACT.</span></footer>
      </div>
    </main>
    {configOpen && <div className="config-overlay" role="dialog" aria-modal="true" aria-labelledby="config-title">
      <button className="config-dismiss" aria-label="Close configuration" onClick={() => setConfigOpen(false)} />
      <div className="config-panel">
        <div className="config-header"><div><p className="eyebrow">SECTION CONFIGURATION</p><h2 id="config-title">Configure {activeSection}</h2></div><button className="icon-button" aria-label="Close configuration" onClick={() => setConfigOpen(false)}><X size={18} /></button></div>
        <p className="config-copy">Connect the verified source and define the permissions for this production surface.</p>
        <label className="config-field"><span>Data source</span><select defaultValue="supabase"><option value="supabase">Supabase — connected</option><option value="manual">Manual review queue</option></select></label>
        <label className="config-field"><span>Refresh policy</span><select defaultValue="realtime"><option value="realtime">Realtime</option><option value="hourly">Every hour</option><option value="daily">Daily</option></select></label>
        <div className="config-actions"><button className="secondary-button" onClick={() => setConfigOpen(false)}>Cancel</button><button className="primary-button" onClick={saveConfiguration}>{configSaved ? 'Saved' : 'Save configuration'}</button></div>
      </div>
    </div>}
  </div>
}

export default CommandCenter
