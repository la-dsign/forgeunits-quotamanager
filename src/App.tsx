import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from './contexts/ThemeContext.tsx'
import './App.css'
import './ForgeUnitsTheme.css'

type Summary = { requests: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; groundingRequests: number; failedRequests: number; costUsd: number }
type KeySummary = Summary & { id: string; name: string; projectId: string; status: string; internalLimit: number; configured: boolean; lastUsed: string | null }
type UsageEvent = { id: string; apiKeyId: string; projectId: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; status: string; timestamp: string; agentId: string; workflowId: string }
type AuthState = 'checking' | 'authenticated' | 'required'

const emptySummary: Summary = { requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, groundingRequests: 0, failedRequests: 0, costUsd: 0 }
const navItems = ['Resumen', 'API keys', 'Consumo', 'Proyectos', 'Alertas']
const navIcons = ['⌂', '⌁', '▥', '▦', '♧']
const fmt = (value: number) => new Intl.NumberFormat('es-ES').format(value || 0)
const compact = (value: number) => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value || 0)
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin actividad'
const keyColor = (index: number) => ['violet', 'blue', 'orange', 'green', 'pink'][index % 5]

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, credentials: 'same-origin' })
    if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'request_failed')
    return response.json()
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return <div className="empty-state"><div className="empty-icon">⌁</div><strong>{title}</strong><p>{description}</p></div>
}

function App() {
    const { theme, toggleTheme } = useTheme()
    const [auth, setAuth] = useState<AuthState>('checking')
    const [password, setPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [activeNav, setActiveNav] = useState('Resumen')
    const [summary, setSummary] = useState<Summary>(emptySummary)
    const [keys, setKeys] = useState<KeySummary[]>([])
    const [events, setEvents] = useState<UsageEvent[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const [showKeyForm, setShowKeyForm] = useState(false)
    const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
    const [keyForm, setKeyForm] = useState({ id: '', name: '', projectId: '', internalLimit: '2000', status: 'Activo' })
    const [keyFormError, setKeyFormError] = useState('')

    useEffect(() => {
        readJson<{ authenticated: boolean }>('/api/auth/status').then(result => setAuth(result.authenticated ? 'authenticated' : 'required')).catch(() => setAuth('required'))
    }, [])

    const refresh = useCallback(async () => {
        if (auth !== 'authenticated') return
        setLoading(true); setError('')
        try {
            const [summaryData, keyData, eventData] = await Promise.all([
                readJson<Summary>('/api/ai-usage/summary'),
                readJson<{ items: KeySummary[] }>('/api/ai-usage/keys'),
                readJson<{ items: UsageEvent[] }>('/api/ai-usage/events'),
            ])
            setSummary(summaryData); setKeys(keyData.items || []); setEvents(eventData.items || []); setLastUpdated(new Date().toISOString())
        } catch (requestError) {
            setError(requestError instanceof Error && requestError.message === 'unauthorized' ? 'La sesión expiró. Vuelve a iniciar sesión.' : 'No se pudieron cargar las métricas.')
        } finally { setLoading(false) }
    }, [auth])

    useEffect(() => {
        refresh()
        if (auth !== 'authenticated') return
        const interval = window.setInterval(refresh, 15000)
        return () => window.clearInterval(interval)
    }, [auth, refresh])

    const login = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setLoginError('')
        try { await readJson('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); setPassword(''); setAuth('authenticated') }
        catch (requestError) { setLoginError(requestError instanceof Error && requestError.message === 'request_failed' ? 'Contraseña incorrecta.' : 'Configura AI_USAGE_DASHBOARD_PASSWORD en Railway.') }
    }
    const logout = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); setAuth('required') }
    const saveKeyMetadata = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setKeyFormError('')
        try {
            const id = editingKeyId || keyForm.id
            await readJson(`/api/ai-usage/keys${editingKeyId ? `/${encodeURIComponent(id)}` : ''}`, { method: editingKeyId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...keyForm, id, internalLimit: Number(keyForm.internalLimit) }) })
            closeKeyForm(); await refresh()
        } catch { setKeyFormError('No se pudo guardar. Usa un alias único y revisa los campos.') }
    }
    const closeKeyForm = () => { setShowKeyForm(false); setEditingKeyId(null); setKeyForm({ id: '', name: '', projectId: '', internalLimit: '2000', status: 'Activo' }); setKeyFormError('') }
    const editKey = (key: KeySummary) => { setEditingKeyId(key.id); setKeyForm({ id: key.id, name: key.name, projectId: key.projectId, internalLimit: String(key.internalLimit), status: key.status }); setShowKeyForm(true) }
    const deleteKey = async (key: KeySummary) => {
        if (key.configured) { setError('Esta clave está configurada en Railway. Elimínala desde las variables del servicio.'); return }
        if (!window.confirm(`¿Eliminar el alias ${key.name}? Los eventos históricos se conservarán.`)) return
        try { await readJson(`/api/ai-usage/keys/${encodeURIComponent(key.id)}`, { method: 'DELETE' }); await refresh() }
        catch { setError('No se pudo eliminar el alias.') }
    }
    const exportEvents = () => {
        const columns = ['timestamp', 'apiKeyId', 'projectId', 'model', 'inputTokens', 'outputTokens', 'costUsd', 'status']
        const csv = [columns.join(','), ...events.map(event => columns.map(column => JSON.stringify(event[column as keyof UsageEvent] ?? '')).join(','))].join('\n')
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `forgeunits-quotamanager-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url)
    }
    const filteredKeys = useMemo(() => keys.filter(key => `${key.name} ${key.id} ${key.projectId}`.toLowerCase().includes(search.toLowerCase())), [keys, search])
    const activeKeys = keys.filter(key => key.status === 'Activo').length
    const alertCount = summary.failedRequests + keys.filter(key => !key.configured || key.status === 'Alerta').length
    const byModel = useMemo(() => Object.entries(events.reduce<Record<string, Summary>>((groups, event) => { const current = groups[event.model] || { ...emptySummary }; current.requests++; current.inputTokens += event.inputTokens; current.outputTokens += event.outputTokens; current.costUsd += event.costUsd; if (event.status !== 'completed') current.failedRequests++; groups[event.model] = current; return groups }, {})).map(([model, data]) => ({ model, ...data })), [events])
    const byProject = useMemo(() => Object.entries(events.reduce<Record<string, Summary>>((groups, event) => { const current = groups[event.projectId] || { ...emptySummary }; current.requests++; current.inputTokens += event.inputTokens; current.outputTokens += event.outputTokens; current.costUsd += event.costUsd; groups[event.projectId] = current; return groups }, {})).map(([projectId, data]) => ({ projectId, ...data })), [events])

    if (auth !== 'authenticated') return <div className="auth-shell"><main className="auth-layout"><section className="auth-brief"><div className="auth-brand"><span className="auth-brand-mark"><img src="/forgeunits-logo-transparent.png" alt="" /></span><span><strong>ForgeUnits</strong><small>Workspace access</small></span></div><figure className="auth-logo"><img src="/forgeunits-logo-transparent.png" alt="ForgeUnits" /><figcaption>Control Panel</figcaption></figure><p className="auth-wordmark">FORGE<span>UNITS</span></p><p className="auth-subtitle">QUOTAMANAGER</p><p className="auth-brief-copy">Supervisa el consumo de IA, revisa límites y mantiene cada decisión de uso trazable desde un solo centro operativo.</p><ul className="auth-signals"><li>Consumo y costos en tiempo real</li><li>Claves y proyectos protegidos</li><li>Alertas operativas verificables</li></ul></section><form className="auth-card" onSubmit={login}><div className="auth-card-head"><div><p className="eyebrow">QUOTAMANAGER</p><h1>Iniciar sesión</h1><p className="muted">Accede al panel de control de tu workspace.</p></div><span className="secure-mark">◉</span></div>{auth === 'checking' ? <p className="muted auth-loading">Comprobando acceso…</p> : <><label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoFocus required /></label><button className="primary-button" type="submit">Entrar al dashboard</button>{loginError && <p className="auth-error">{loginError}</p>}</>}</form></main></div>

    const renderOverview = () => <>
        <section className="welcome-row"><div><p className="eyebrow">CONTROL OPERATIVO · GEMINI</p><h2>Resumen de consumo <span>✦</span></h2><p className="muted">Datos registrados por Quotamanager, sin cifras simuladas.</p></div><div className="welcome-actions"><span className="updated-label">{loading ? 'Actualizando…' : lastUpdated ? `Actualizado ${dateTime(lastUpdated)}` : 'Sin sincronizar'}</span><button className="primary-button" onClick={refresh}>↻ Actualizar</button></div></section>
        <section className="stats-grid"><StatCard label="Solicitudes" value={fmt(summary.requests)} icon="↗" tone="purple" detail={`${fmt(summary.failedRequests)} fallidas`} /><StatCard label="Tokens procesados" value={compact(summary.inputTokens + summary.outputTokens)} icon="✧" tone="blue" detail={`${compact(summary.inputTokens)} entrada · ${compact(summary.outputTokens)} salida`} /><StatCard label="Costo estimado" value={money(summary.costUsd)} icon="$" tone="orange" detail="Calculado por el backend" /><StatCard label="Claves activas" value={`${activeKeys}/${keys.length}`} icon="⌁" tone="green" detail={keys.length ? `${alertCount} requieren atención` : 'Aún no configuradas'} /></section>
        {summary.requests === 0 ? <EmptyState title="Todavía no hay consumo registrado" description="Configura una API key en Railway y enruta la primera llamada Gemini por /api/ai-usage/generate, o reporta un evento desde ForgeUnits." /> : <section className="dashboard-grid"><div className="panel"><PanelTitle title="Actividad reciente" subtitle="Últimas llamadas recibidas por el gateway" /><ActivityTable events={events.slice(0, 8)} /></div><div className="panel health-panel"><PanelTitle title="Salud del pool" subtitle="Estado de las claves configuradas" /><div className="health-ring"><div><strong>{activeKeys}<span>/{keys.length}</span></strong><small>activas</small></div></div><p className="health-copy">{alertCount ? `${alertCount} elemento${alertCount === 1 ? '' : 's'} requiere atención.` : 'Sin alertas operativas.'}</p></div></section>}
    </>

    const renderKeys = () => <section className="panel full-panel"><div className="section-header"><div><p className="eyebrow">CREDENCIALES</p><h2>API keys</h2><p className="muted">Gestiona alias, proyectos y límites. Los secretos viven únicamente en Railway.</p></div><div className="section-actions"><label className="search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar clave o proyecto…" /></label><button className="primary-button" onClick={() => { setEditingKeyId(null); setShowKeyForm(true) }}>＋ Agregar clave</button></div></div>{filteredKeys.length ? <div className="table-wrap"><table><thead><tr><th>Identificador</th><th>Proyecto</th><th>Estado</th><th>Configuración</th><th>Solicitudes</th><th>Costo</th><th>Último uso</th><th>Acciones</th></tr></thead><tbody>{filteredKeys.map((key, index) => <tr key={key.id}><td><div className="key-name"><span className={`key-symbol ${keyColor(index)}`}>⌁</span><div><strong>{key.name}</strong><small>{key.id}</small></div></div></td><td className="project-name">{key.projectId}</td><td><span className={`status-pill ${key.status === 'Activo' ? 'activo' : 'alerta'}`}><i />{key.status}</span></td><td><span className={`status-pill ${key.configured ? 'activo' : 'alerta'}`}><i />{key.configured ? 'Configurada' : 'Sin secreto'}</span></td><td><strong>{fmt(key.requests)}</strong><small className="cell-muted"> · {fmt(key.failedRequests)} fallidas</small></td><td>{money(key.costUsd)}</td><td className="last-used">{dateTime(key.lastUsed)}</td><td><div className="row-actions"><button className="table-action" onClick={() => editKey(key)}>Editar</button><button className="table-action danger" onClick={() => deleteKey(key)}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No hay API keys registradas" description="Agrega un alias aquí y configura después su secreto en Railway. Esta pantalla nunca mostrará las API keys reales." />}{showKeyForm && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeKeyForm()}><form className="modal-card" onSubmit={saveKeyMetadata}><div className="modal-header"><div><p className="eyebrow">CONFIGURACIÓN SEGURA</p><h3>{editingKeyId ? 'Editar API key' : 'Agregar API key'}</h3></div><button type="button" className="close-button" onClick={closeKeyForm}>×</button></div><p className="muted">Gestiona metadatos y límites. El secreto se configura en Railway como <code>GEMINI_API_KEYS_JSON</code> o <code>GEMINI_API_KEY</code>.</p><label>Alias interno<input required disabled={Boolean(editingKeyId)} value={keyForm.id} onChange={event => setKeyForm({ ...keyForm, id: event.target.value })} placeholder="project-01-main" /></label><label>Nombre visible<input required value={keyForm.name} onChange={event => setKeyForm({ ...keyForm, name: event.target.value })} placeholder="Proyecto principal" /></label><label>Project ID<input required value={keyForm.projectId} onChange={event => setKeyForm({ ...keyForm, projectId: event.target.value })} placeholder="gen-lang-client-0015125690" /></label><label>Estado<select value={keyForm.status} onChange={event => setKeyForm({ ...keyForm, status: event.target.value })}><option>Activo</option><option>Alerta</option><option>Pausada</option></select></label><label>Límite interno RPM<input type="number" min="1" max="1000000" required value={keyForm.internalLimit} onChange={event => setKeyForm({ ...keyForm, internalLimit: event.target.value })} /></label>{keyFormError && <p className="auth-error">{keyFormError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeKeyForm}>Cancelar</button><button className="primary-button" type="submit">{editingKeyId ? 'Guardar cambios' : 'Agregar clave'}</button></div></form></div>}</section>

    const renderConsumption = () => <section className="two-column"><div className="panel full-panel"><div className="panel-heading"><PanelTitle title="Consumo por modelo" subtitle="Calculado a partir de los eventos registrados" /><button className="secondary-button" onClick={exportEvents} disabled={!events.length}>↓ Exportar CSV</button></div>{byModel.length ? <div className="metric-list">{byModel.map(model => <div className="metric-row" key={model.model}><div><strong>{model.model}</strong><small>{fmt(model.requests)} solicitudes · {compact(model.inputTokens + model.outputTokens)} tokens</small></div><strong>{money(model.costUsd)}</strong></div>)}</div> : <EmptyState title="Sin datos de modelos" description="El desglose aparecerá después de la primera llamada registrada." />}</div><div className="panel full-panel"><PanelTitle title="Eventos recientes" subtitle="Máximo 100 eventos más recientes" /><ActivityTable events={events} /></div></section>
    const renderProjects = () => <section className="panel full-panel"><PanelTitle title="Proyectos" subtitle="Distribución del uso por proyecto Google Cloud" />{byProject.length ? <div className="metric-list">{byProject.map(project => <div className="metric-row" key={project.projectId}><div><strong>{project.projectId}</strong><small>{fmt(project.requests)} solicitudes · {compact(project.inputTokens + project.outputTokens)} tokens</small></div><strong>{money(project.costUsd)}</strong></div>)}</div> : <EmptyState title="Sin proyectos con actividad" description="Los proyectos aparecerán cuando Quotamanager reciba eventos reales." />}</section>
    const renderAlerts = () => <section className="panel full-panel"><PanelTitle title="Alertas operativas" subtitle="Señales que requieren revisión" />{alertCount ? <div className="alert-list">{keys.filter(key => !key.configured || key.status === 'Alerta').map(key => <div className="alert-item" key={key.id}><span className="alert-icon">!</span><div><strong>{key.name}</strong><p>{key.configured ? 'La clave está marcada en alerta.' : 'Existe un identificador, pero falta configurar su secreto en Railway.'}</p></div></div>)}{summary.failedRequests > 0 && <div className="alert-item"><span className="alert-icon">!</span><div><strong>Solicitudes fallidas</strong><p>{fmt(summary.failedRequests)} eventos terminaron con error.</p></div></div>}</div> : <EmptyState title="Todo en orden" description="No hay claves sin configurar ni solicitudes fallidas registradas." />}</section>

    return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">◈</div><div><strong>ForgeUnits <span>Quotamanager</span></strong><small>AI usage control center</small></div></div><div className="workspace-label">WORKSPACE</div><div className="workspace"><span className="workspace-icon">F</span><span>ForgeUnits · IA</span></div><nav>{navItems.map((item, index) => <button key={item} className={`nav-item ${activeNav === item ? 'active' : ''}`} onClick={() => setActiveNav(item)}><span className="nav-icon">{navIcons[index]}</span>{item}{item === 'Alertas' && alertCount > 0 && <em>{alertCount}</em>}</button>)}</nav><div className="sidebar-bottom"><div className="security-card"><span className="security-dot" /> API protegida<strong>{keys.length ? 'Conectada' : 'Esperando configuración'}</strong></div><button className="profile" onClick={logout}><span className="avatar">LP</span><span><strong>Administrador</strong><small>Cerrar sesión</small></span><span className="chevron">↗</span></button></div></aside><main className="main-area"><header className="topbar"><div><div className="breadcrumbs">ForgeUnits <span>/</span> {activeNav}</div><h1>{activeNav}</h1></div><div className="top-actions"><span className="live-status"><i />{loading ? 'Sincronizando' : 'Servicio activo'}</span><button className="icon-button" onClick={toggleTheme} title="Cambiar tema">{theme === 'dark' ? '☼' : '☾'}</button></div></header><div className="content">{error && <div className="error-banner">{error}<button onClick={refresh}>Reintentar</button></div>}{activeNav === 'Resumen' && renderOverview()}{activeNav === 'API keys' && renderKeys()}{activeNav === 'Consumo' && renderConsumption()}{activeNav === 'Proyectos' && renderProjects()}{activeNav === 'Alertas' && renderAlerts()}</div></main></div>
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="panel-heading"><div><h3>{title}</h3><p>{subtitle}</p></div></div> }
function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><div className="trend neutral">{detail}</div></div> }
function ActivityTable({ events }: { events: UsageEvent[] }) { return events.length ? <div className="activity-table"><div className="activity-row header"><span>Hora</span><span>API key</span><span>Modelo</span><span>Tokens</span><span>Costo</span><span>Estado</span></div>{events.map(event => <div className="activity-row" key={event.id}><span>{new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(new Date(event.timestamp))}</span><span>{event.apiKeyId}</span><span>{event.model}</span><span>{fmt(event.inputTokens + event.outputTokens)}</span><span>{money(event.costUsd)}</span><span className={event.status === 'completed' ? 'complete' : 'failed'}><i />{event.status}</span></div>)}</div> : <EmptyState title="Sin actividad reciente" description="Las llamadas de Gemini aparecerán aquí después de ser procesadas por el gateway." /> }

export default App
