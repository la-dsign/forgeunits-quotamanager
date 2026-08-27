import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useTheme } from './contexts/ThemeContext.tsx'
import { calculateTotalCost, UsageSample } from './domain/costCalculator.ts'
import './App.css'

type KeyStatus = 'Activo' | 'Pausado' | 'Alerta'
type ApiKey = { id: number; name: string; project: string; masked: string; status: KeyStatus; requests: number; tokens: number; inputTokens: number; outputTokens: number; limit: number; lastUsed: string; color: string }
const initialKeys: ApiKey[] = [
    { id: 1, name: 'Producción · Principal', project: 'gen-lang-client-0015125690', masked: 'AIza••••••••••••K8x2', status: 'Activo', requests: 8240, tokens: 1860000, inputTokens: 1480000, outputTokens: 380000, limit: 10000, lastUsed: 'hace 2 min', color: 'violet' },
    { id: 2, name: 'Producción · Backup', project: 'gen-lang-client-0015125690', masked: 'AIza••••••••••••P4m9', status: 'Alerta', requests: 6420, tokens: 1240000, inputTokens: 990000, outputTokens: 250000, limit: 8000, lastUsed: 'hace 5 min', color: 'blue' },
    { id: 3, name: 'Desarrollo', project: 'gen-lang-client-0015125690', masked: 'AIza••••••••••••R2q7', status: 'Activo', requests: 2180, tokens: 430000, inputTokens: 345000, outputTokens: 85000, limit: 5000, lastUsed: 'hace 11 min', color: 'orange' },
    { id: 4, name: 'QA / pruebas', project: 'gen-lang-client-0015125690', masked: 'AIza••••••••••••M6n1', status: 'Pausado', requests: 820, tokens: 160000, inputTokens: 128000, outputTokens: 32000, limit: 2000, lastUsed: 'ayer, 18:42', color: 'green' },
]
const activity = [['09:42:18', 'Producción · Principal', 'gemini-2.5-flash', '1,240', '200', 'Completada'], ['09:41:52', 'Producción · Backup', 'gemini-2.5-pro', '840', '124', 'Completada'], ['09:40:11', 'Producción · Principal', 'gemini-2.5-flash', '2,180', '350', 'Completada'], ['09:38:46', 'Desarrollo', 'gemini-2.5-flash-lite', '420', '72', 'Completada']]
const fmt = (value: number) => new Intl.NumberFormat('es-ES').format(value)

function App() {
    const { theme, toggleTheme } = useTheme()
    const [dashboardAuth, setDashboardAuth] = useState<'checking' | 'authenticated' | 'required'>('checking')
    const [dashboardPassword, setDashboardPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [keys, setKeys] = useState(initialKeys)
    const [selectedId, setSelectedId] = useState(1)
    const [activeNav, setActiveNav] = useState('Resumen')
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState('')
    const [search, setSearch] = useState('')
    const [liveSummary, setLiveSummary] = useState<{ requests: number; inputTokens: number; outputTokens: number; costUsd?: number } | null>(null)
    const [liveKeys, setLiveKeys] = useState<Record<string, { requests: number; inputTokens: number; outputTokens: number; costUsd?: number; lastUsed?: string | null }>>({})
    const visibleKeys = useMemo(() => keys.filter(key => (key.name + ' ' + key.project).toLowerCase().includes(search.toLowerCase())), [keys, search])
    useEffect(() => {
        fetch('/api/auth/status').then(response => response.json()).then(result => setDashboardAuth(result.authenticated ? 'authenticated' : 'required')).catch(() => setDashboardAuth('required'))
    }, [])
    useEffect(() => {
        let active = true
        if (dashboardAuth !== 'authenticated') return () => { active = false }
        const refresh = async () => {
            try {
                const [summaryResponse, keysResponse] = await Promise.all([fetch('/api/ai-usage/summary'), fetch('/api/ai-usage/by-key')])
                if (!summaryResponse.ok || !keysResponse.ok) throw new Error('service unavailable')
                const summary = await summaryResponse.json()
                const byKey = await keysResponse.json()
                if (!active) return
                if (summary.requests > 0) setLiveSummary(summary)
                setLiveKeys(Object.fromEntries((byKey.items || []).map((item: { apiKeyId: string }) => [item.apiKeyId, item])))
            } catch { /* Demo data remains visible while the service is offline. */ }
        }
        refresh()
        const interval = window.setInterval(refresh, 15000)
        return () => { active = false; window.clearInterval(interval) }
    }, [dashboardAuth])
    const totalRequests = liveSummary?.requests ?? keys.reduce((total, key) => total + key.requests, 0)
    const totalTokens = liveSummary ? liveSummary.inputTokens + liveSummary.outputTokens : keys.reduce((total, key) => total + key.tokens, 0)
    const totalCost = liveSummary?.costUsd ?? calculateTotalCost(keys.map<UsageSample>(key => ({ model: 'gemini-2.5-flash', inputTokens: key.inputTokens, outputTokens: key.outputTokens })))
    const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
    const toggleKey = (id: number) => setKeys(current => current.map(key => key.id === id ? { ...key, status: key.status === 'Pausado' ? 'Activo' : 'Pausado' } : key))
    const addKey = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setKeys(current => [...current, { id: Date.now(), name: String(data.get('name') || 'Nueva clave'), project: String(data.get('project') || 'gen-lang-client-0015125690'), masked: 'AIza••••••••••••N7v3', status: 'Activo', requests: 0, tokens: 0, inputTokens: 0, outputTokens: 0, limit: Number(data.get('limit') || 2000), lastUsed: 'nunca', color: 'pink' }])
        setShowModal(false); notify('API key agregada correctamente')
    }
    const login = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setLoginError('')
        const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: dashboardPassword }) })
        if (!response.ok) { setLoginError(response.status === 503 ? 'Falta configurar AI_USAGE_DASHBOARD_PASSWORD en Railway.' : 'Contraseña incorrecta.'); return }
        setDashboardPassword(''); setDashboardAuth('authenticated')
    }
    if (dashboardAuth !== 'authenticated') return <div className="auth-shell"><form className="auth-card" onSubmit={login}><div className="brand-mark">◈</div><p className="eyebrow">FORGEUNITS QUOTAMANAGER</p><h1>Acceso privado</h1><p className="muted">Las métricas de consumo están protegidas. Introduce la contraseña del dashboard.</p>{dashboardAuth === 'checking' ? <p className="muted">Comprobando acceso…</p> : <><label>Contraseña<input type="password" value={dashboardPassword} onChange={event => setDashboardPassword(event.target.value)} autoFocus required /></label><button className="primary-button" type="submit">Entrar</button>{loginError && <p className="auth-error">{loginError}</p>}</>}</form></div>
    return <div className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-mark">◈</div><div><strong>quota<span>pilot</span></strong><small>Gemini control center</small></div></div><div className="workspace-label">WORKSPACE</div><button className="workspace"><span className="workspace-icon">G</span><span>ForgeUnits · IA</span><span className="chevron">⌄</span></button><nav>{['Resumen', 'API keys', 'Consumo', 'Proyectos', 'Alertas'].map((item, index) => <button key={item} className={'nav-item ' + (activeNav === item ? 'active' : '')} onClick={() => setActiveNav(item)}><span className="nav-icon">{['⌂', '⌁', '▥', '▦', '♧'][index]}</span>{item}{item === 'Alertas' && <em>2</em>}</button>)}</nav><div className="sidebar-bottom"><div className="plan-card"><div><span className="plan-dot" /> Tier 1 · Paid</div><strong>8.4% <small>de uso mensual</small></strong><div className="mini-progress"><i /></div><small>Renueva en 12 días</small></div><button className="help"><span>?</span> Centro de ayuda</button><button className="profile"><span className="avatar">LP</span><span><strong>Luis Pérez</strong><small>Administrador</small></span><span className="chevron">⌄</span></button></div></aside>
        <main className="main-area"><header className="topbar"><div><div className="breadcrumbs">Workspace <span>/</span> {activeNav}</div><h1>{activeNav === 'Resumen' ? 'Resumen de consumo' : activeNav}</h1></div><div className="top-actions"><button className="date-chip">◷ Últimas 24 horas <span>⌄</span></button><button className="icon-button" onClick={toggleTheme} title="Cambiar tema">{theme === 'dark' ? '☼' : '☾'}</button><button className="icon-button notification">♧<i /></button></div></header>
        <div className="content"><section className="welcome-row"><div><p className="eyebrow">JUEVES, 27 DE AGOSTO DE 2026</p><h2>Buenos días, Luis <span>✦</span></h2><p className="muted">Aquí tienes el estado de tus límites de Gemini.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><span>＋</span> Añadir API key</button></section>
        <section className="stats-grid"><div className="stat-card"><div className="stat-top"><span>Solicitudes</span><span className="stat-icon purple">↗</span></div><strong>{fmt(totalRequests)}</strong><div className="trend positive">↑ 12.8% <small>vs. periodo anterior</small></div></div><div className="stat-card"><div className="stat-top"><span>Tokens procesados</span><span className="stat-icon blue">✧</span></div><strong>{(totalTokens / 1000000).toFixed(2)}M</strong><div className="trend positive">↑ 8.4% <small>vs. periodo anterior</small></div></div><div className="stat-card"><div className="stat-top"><span>Costo estimado</span><span className="stat-icon orange">$</span></div><strong>$\{totalCost.toFixed(2)}</strong><div className="trend neutral">USD · tarifa estándar <small>catálogo Gemini</small></div></div><div className="stat-card"><div className="stat-top"><span>Promedio RPM</span><span className="stat-icon orange">⌁</span></div><strong>42.6</strong><div className="trend neutral">— 2.1% <small>vs. periodo anterior</small></div></div><div className="stat-card"><div className="stat-top"><span>Disponibilidad</span><span className="stat-icon green">✓</span></div><strong>99.98<span className="unit">%</span></strong><div className="trend positive">↑ 0.02% <small>últimos 30 días</small></div></div></section>
        <section className="dashboard-grid"><div className="panel consumption-panel"><div className="panel-heading"><div><h3>Consumo de solicitudes</h3><p>Seguimiento de las últimas 24 horas</p></div><div className="legend"><span><i className="legend-dot violet" />Solicitudes</span><span><i className="legend-dot pale" />Límite estimado</span></div></div><div className="chart"><div className="chart-y"><span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span></div><div className="bars">{[28,40,35,55,44,68,52,76,62,82,71,88,66,78,58,72,92,74,86,64,80,94,72,83].map((height, index) => <div className="bar-group" key={index}><div className="bar-limit" style={{ height: (Math.min(height + 5, 98)) + '%' }} /><div className="bar-value" style={{ height: height + '%' }} /></div>)}</div></div><div className="chart-x"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Ahora</span></div></div><div className="panel health-panel"><div className="panel-heading"><div><h3>Salud de las claves</h3><p>Estado actual del pool</p></div><span className="live-dot">● En vivo</span></div><div className="health-ring"><div><strong>3<span>/4</span></strong><small>claves activas</small></div></div><div className="health-legend"><div><span><i className="dot green-bg" />Activas</span><strong>3</strong></div><div><span><i className="dot amber-bg" />En alerta</span><strong>1</strong></div><div><span><i className="dot gray-bg" />Pausadas</span><strong>1</strong></div></div><button className="text-button" onClick={() => setActiveNav('API keys')}>Ver todas las claves <span>→</span></button></div></section>
        <section className="panel keys-panel"><div className="panel-heading keys-heading"><div><h3>API keys</h3><p>Gestiona tus claves y límites internos</p></div><div className="key-actions"><label className="search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar clave..." /></label><button className="outline-button" onClick={() => notify('Rotación inteligente activada')}>⟳ Rotar clave</button><button className="more-button">•••</button></div></div><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Proyecto</th><th>Estado</th><th>Solicitudes (24h)</th><th>Límite interno</th><th>Último uso</th><th /></tr></thead><tbody>{visibleKeys.map(key => <tr key={key.id} className={selectedId === key.id ? 'selected-row' : ''} onClick={() => setSelectedId(key.id)}><td><div className="key-name"><span className={'key-symbol ' + key.color}>⌁</span><div><strong>{key.name}</strong><small>{key.masked}</small></div></div></td><td><span className="project-name">{key.project}</span></td><td><span className={'status-pill ' + key.status.toLowerCase()}><i />{key.status}</span></td><td><strong>{fmt(key.requests)}</strong><small className="cell-muted"> {Math.round(key.requests / 24)} / h</small></td><td><div className="limit-cell"><span>{Math.round(key.requests / key.limit * 100)}%</span><div className="limit-track"><i className={key.requests / key.limit > .75 ? 'warning' : ''} style={{ width: Math.min(key.requests / key.limit * 100, 100) + '%' }} /></div></div></td><td className="last-used">{key.lastUsed}</td><td><button className="row-menu" onClick={(event) => { event.stopPropagation(); toggleKey(key.id) }}>{key.status === 'Pausado' ? 'Activar' : '•••'}</button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Mostrando {visibleKeys.length} de {keys.length} claves</span><button className="text-button" onClick={() => setActiveNav('API keys')}>Gestionar API keys <span>→</span></button></div></section>
        <section className="panel activity-panel"><div className="panel-heading"><div><h3>Actividad reciente</h3><p>Últimas llamadas registradas por el gateway</p></div><button className="outline-button" onClick={() => notify('Exportación CSV preparada')}>Exportar CSV ↓</button></div><div className="activity-table"><div className="activity-row header"><span>Hora</span><span>API key</span><span>Modelo</span><span>Tokens</span><span>Duración</span><span>Estado</span></div>{activity.map(row => <div className="activity-row" key={row[0]}>{row.map((cell, index) => <span key={row[0] + '-' + index} className={index === 5 ? 'complete' : ''}>{index === 5 && <i />} {cell}</span>)}</div>)}</div></section>
        <div className="integration-note"><span>✦</span><div><strong>{liveSummary ? 'Servicio de consumo conectado' : 'Conecta el servicio de consumo para datos en tiempo real'}</strong><p>{liveSummary ? `Métricas reales actualizadas automáticamente · ${Object.keys(liveKeys).length} claves con actividad registrada.` : 'Ahora estás viendo datos de demostración. Inicia el servicio para sincronizar consumo automáticamente.'}</p></div><button className="outline-button" onClick={() => notify('Servicio: npm run server')}>{liveSummary ? 'Conectado ✓' : 'Cómo conectar'} <span>→</span></button></div></div></main>
        {toast && <div className="toast">✓ {toast}</div>}{showModal && <div className="modal-backdrop" onClick={() => setShowModal(false)}><form className="modal" onSubmit={addKey} onClick={event => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowModal(false)}>×</button><p className="eyebrow">NUEVA CREDENCIAL</p><h2>Añadir API key</h2><p className="muted">Registra una clave para controlarla desde el gateway.</p><label>Nombre<input name="name" required placeholder="Ej. Producción · Imagen" /></label><label>Proyecto Google Cloud<input name="project" defaultValue="gen-lang-client-0015125690" required /></label><label>Límite interno de solicitudes<input name="limit" type="number" min="1" defaultValue="5000" required /></label><button className="primary-button" type="submit">Guardar API key</button></form></div>}
    </div>
}
export default App
