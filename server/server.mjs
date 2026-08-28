import http from 'node:http'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { UsageStore } from './usage-store.mjs'
import { calculateCost } from './pricing.mjs'

const port = Number(process.env.PORT || process.env.AI_USAGE_PORT || 3010)
const root = path.dirname(fileURLToPath(import.meta.url))
const store = new UsageStore(process.env.AI_USAGE_STORE || path.join(root, 'data', 'usage.json'))
const publicRoot = path.join(root, '..', 'dist')
const sessions = new Map()
const sessionTtlMs = 8 * 60 * 60 * 1000
const geminiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')
const allowedStatuses = new Set(['completed', 'failed', 'rate_limited'])
const idPattern = /^[a-zA-Z0-9._:-]{1,100}$/

function json(res, status, body) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Headers': 'Content-Type, X-Usage-Token, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    const origin = process.env.AI_USAGE_CORS_ORIGIN
    if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin' }
    res.writeHead(status, headers)
    res.end(JSON.stringify(body))
}
function landing(res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Usage Service</title><style>body{font:16px system-ui;max-width:680px;margin:60px auto;padding:0 24px;color:#242238;background:#f7f7fb}main{background:white;border:1px solid #e7e5ef;border-radius:14px;padding:28px;box-shadow:0 8px 26px #2f2a620b}h1{margin-top:0}a{color:#6657d9;font-weight:700}li{margin:12px 0}</style></head><body><main><h1>AI Usage Service ✓</h1><p>El backend está activo y listo para recibir consumo de Gemini.</p><ul><li><a href="http://localhost:5173/">Abrir dashboard</a></li><li><a href="/health">Ver health check</a></li><li>API: /api/ai-usage/summary</li><li>API: /api/ai-usage/by-key</li><li>API: /api/ai-usage/by-model</li></ul></main></body></html>')
}
async function serveApp(req, res) {
    const requested = req.url === '/' ? 'quotamanager-login.html' : req.url === '/dashboard' || req.url === '/dashboard/' ? 'index.html' : req.url.replace(/^\/+/, '')
    const safePath = path.resolve(publicRoot, requested)
    const relative = path.relative(path.resolve(publicRoot), safePath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return false
    try {
        const content = await fs.readFile(safePath)
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }
        res.writeHead(200, { 'Content-Type': types[path.extname(safePath)] || 'application/octet-stream' })
        res.end(content)
        return true
    } catch { return false }
}
async function readBody(req) {
    let raw = ''
    for await (const chunk of req) raw += chunk
    if (raw.length > 1_000_000) throw new Error('payload demasiado grande')
    return raw ? JSON.parse(raw) : {}
}
function safeEqual(left, right) {
    const a = Buffer.from(String(left || ''))
    const b = Buffer.from(String(right || ''))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}
function parseCookies(req) {
    return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
        const separator = part.indexOf('=')
        return separator >= 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : []
    }).filter(([name, value]) => name && value))
}
function serviceAuthorized(req) {
    const configured = process.env.AI_USAGE_API_TOKEN || process.env.AI_USAGE_INGEST_TOKEN
    if (!configured) return false
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    return safeEqual(req.headers['x-usage-token'], configured) || safeEqual(bearer, configured)
}
function dashboardAuthorized(req) {
    const token = parseCookies(req).ai_usage_session
    const session = token && sessions.get(token)
    if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return false }
    return true
}
function authorized(req, scope = 'service') {
    return scope === 'dashboard' ? dashboardAuthorized(req) || serviceAuthorized(req) : serviceAuthorized(req)
}
function sessionCookie(token, maxAge) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return `ai_usage_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}
function requireId(value, field) {
    if (value === undefined || value === null || value === '') return 'unknown'
    if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(field + ' inválido')
    return value
}
function boundedNumber(value, field, maximum = 100_000_000_000) {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number < 0 || number > maximum) throw new Error(field + ' inválido')
    return Math.floor(number)
}
function normalizeEventBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('evento inválido')
    return {
        ...body,
        tenantId: requireId(body.tenantId, 'tenantId'), userId: requireId(body.userId, 'userId'),
        agentId: requireId(body.agentId, 'agentId'), workflowId: requireId(body.workflowId, 'workflowId'),
        projectId: requireId(body.projectId, 'projectId'), apiKeyId: requireId(body.apiKeyId, 'apiKeyId'),
        model: requireId(body.model, 'model'), inputTokens: boundedNumber(body.inputTokens, 'inputTokens'),
        outputTokens: boundedNumber(body.outputTokens, 'outputTokens'), cachedInputTokens: boundedNumber(body.cachedInputTokens, 'cachedInputTokens'),
        groundingRequests: boundedNumber(body.groundingRequests, 'groundingRequests'),
        status: allowedStatuses.has(body.status || 'completed') ? (body.status || 'completed') : (() => { throw new Error('status inválido') })(),
    }
}
function keyConfig(requestedId) {
    let keys = {}
    if (process.env.GEMINI_API_KEYS_JSON) {
        try { keys = JSON.parse(process.env.GEMINI_API_KEYS_JSON) } catch { throw new Error('GEMINI_API_KEYS_JSON no es JSON válido') }
    }
    const id = requestedId || process.env.GEMINI_API_KEY_ID || Object.keys(keys)[0] || 'default-gemini-key'
    const configured = keys[id]
    const key = typeof configured === 'string' ? configured : configured?.key
    return { key: key || (id === (process.env.GEMINI_API_KEY_ID || 'default-gemini-key') ? process.env.GEMINI_API_KEY : undefined), id, name: configured?.name || id, projectId: configured?.projectId || process.env.GEMINI_PROJECT_ID || 'unknown' }
}
function configuredKeyMetadata() {
    let keys = {}
    if (process.env.GEMINI_API_KEYS_JSON) {
        try { keys = JSON.parse(process.env.GEMINI_API_KEYS_JSON) } catch { throw new Error('GEMINI_API_KEYS_JSON no es JSON válido') }
    }
    const ids = Object.keys(keys)
    if (process.env.GEMINI_API_KEY && !ids.includes(process.env.GEMINI_API_KEY_ID || 'default-gemini-key')) ids.push(process.env.GEMINI_API_KEY_ID || 'default-gemini-key')
    return ids.map(id => ({ id, name: typeof keys[id] === 'object' ? keys[id].name || id : id, projectId: typeof keys[id] === 'object' ? keys[id].projectId || process.env.GEMINI_PROJECT_ID || 'unknown' : process.env.GEMINI_PROJECT_ID || 'unknown', configured: true }))
}
function rpmAllowed(apiKeyId) {
    const limit = Number(process.env.AI_USAGE_RPM_LIMIT || 60)
    const since = Date.now() - 60_000
    const recent = store.state.events.filter(event => event.apiKeyId === apiKeyId && Date.parse(event.timestamp) >= since)
    return { allowed: recent.length < limit, used: recent.length, limit }
}
async function generateWithGemini(body) {
    const config = keyConfig(body.apiKeyId)
    if (!config.key) throw new Error('GEMINI_API_KEY no está configurada en el servidor')
    const model = body.model || 'gemini-2.5-flash'
    const response = await fetch(geminiBaseUrl + '/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
        body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig, systemInstruction: body.systemInstruction })
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message || 'Gemini respondió con HTTP ' + response.status)
    const metadata = payload.usageMetadata || {}
    const inputTokens = Number(metadata.promptTokenCount || 0)
    const outputTokens = Number(metadata.candidatesTokenCount || 0) + Number(metadata.thoughtsTokenCount || 0)
    const event = await store.addEvent({
        provider: 'google', tenantId: body.tenantId, userId: body.userId, agentId: body.agentId, workflowId: body.workflowId,
        projectId: config.projectId, apiKeyId: config.id, model, mode: body.mode || 'standard',
        inputTokens, outputTokens, cachedInputTokens: Number(metadata.cachedContentTokenCount || 0),
        groundingRequests: Number(body.groundingRequests || 0), costUsd: calculateCost({ model, inputTokens, outputTokens, mode: body.mode }),
        status: 'completed'
    })
    return { response: payload, usage: event }
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {})
    try {
        const url = new URL(req.url, 'http://localhost')
        if (req.method === 'GET' && url.pathname === '/' && await serveApp(req, res)) return
        if (req.method === 'GET' && !url.pathname.startsWith('/api/') && await serveApp(req, res)) return
        if (req.method === 'GET' && url.pathname === '/') return landing(res)
        if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, service: 'ai-usage-service', updatedAt: store.state.updatedAt })
        if (req.method === 'POST' && url.pathname === '/api/auth/login') {
            const body = await readBody(req)
            const configuredPassword = process.env.AI_USAGE_DASHBOARD_PASSWORD
            if (!configuredPassword) return json(res, 503, { error: 'dashboard_auth_not_configured' })
            if (!safeEqual(body.password, configuredPassword)) return json(res, 401, { error: 'invalid_credentials' })
            const token = crypto.randomBytes(32).toString('base64url')
            sessions.set(token, { expiresAt: Date.now() + sessionTtlMs })
            res.setHeader('Set-Cookie', sessionCookie(token, sessionTtlMs / 1000))
            return json(res, 200, { authenticated: true })
        }
        if (req.method === 'GET' && url.pathname === '/api/auth/status') return json(res, 200, { authenticated: authorized(req, 'dashboard') })
        if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
            const token = parseCookies(req).ai_usage_session
            if (token) sessions.delete(token)
            res.setHeader('Set-Cookie', sessionCookie('', 0))
            return json(res, 200, { authenticated: false })
        }
        const dashboardWritable = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/ai-usage/keys')
        if (url.pathname.startsWith('/api/ai-usage/') && !authorized(req, req.method === 'GET' || dashboardWritable ? 'dashboard' : 'service')) return json(res, 401, { error: 'unauthorized' })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/keys') return json(res, 200, { items: store.listKeySummaries(configuredKeyMetadata()) })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/events') {
            const events = store.filterEvents(Object.fromEntries(url.searchParams)).slice(-100).reverse()
            return json(res, 200, { items: events })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/events') {
            if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
            const body = normalizeEventBody(await readBody(req))
            if (req.headers['idempotency-key']) body.id = requireId(String(req.headers['idempotency-key']), 'idempotency-key')
            body.costUsd = calculateCost({ model: body.model, inputTokens: body.inputTokens, outputTokens: body.outputTokens, mode: body.mode })
            return json(res, 201, { event: await store.addEvent(body) })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/keys') {
            const body = await readBody(req)
            const id = requireId(String(body.id || ''), 'id')
            const name = String(body.name || id).trim().slice(0, 120)
            const projectId = String(body.projectId || 'unknown').trim().slice(0, 120)
            const status = ['Activo', 'Alerta', 'Pausada'].includes(body.status) ? body.status : 'Activo'
            const internalLimit = Math.min(1000000, Math.max(1, Number(body.internalLimit || 2000)))
            if (!name || !projectId || !Number.isFinite(internalLimit)) throw new Error('metadatos de clave inválidos')
            return json(res, 201, { key: await store.upsertKey({ id, name, projectId, status, internalLimit }) })
        }
        if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname.startsWith('/api/ai-usage/keys/')) {
            const id = requireId(decodeURIComponent(url.pathname.split('/').pop()), 'id')
            const body = await readBody(req)
            const existing = store.state.keys.find(key => key.id === id)
            if (!existing) return json(res, 404, { error: 'key_metadata_not_found' })
            const name = String(body.name ?? existing.name).trim().slice(0, 120)
            const projectId = String(body.projectId ?? existing.projectId).trim().slice(0, 120)
            const status = ['Activo', 'Alerta', 'Pausada'].includes(body.status) ? body.status : existing.status
            const internalLimit = Math.min(1000000, Math.max(1, Number(body.internalLimit ?? existing.internalLimit)))
            if (!name || !projectId || !Number.isFinite(internalLimit)) throw new Error('metadatos de clave inválidos')
            return json(res, 200, { key: await store.upsertKey({ ...existing, id, name, projectId, status, internalLimit }) })
        }
        if (req.method === 'DELETE' && url.pathname.startsWith('/api/ai-usage/keys/')) {
            const id = requireId(decodeURIComponent(url.pathname.split('/').pop()), 'id')
            if (configuredKeyMetadata().some(key => key.id === id)) return json(res, 409, { error: 'configured_key_is_managed_by_railway' })
            const deleted = await store.deleteKey(id)
            return deleted ? json(res, 200, { deleted: true, id }) : json(res, 404, { error: 'key_metadata_not_found' })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/generate') {
            if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
            const body = await readBody(req)
            if (!Array.isArray(body.contents) || body.contents.length === 0) throw new Error('contents es obligatorio')
            if (body.apiKeyId !== undefined) requireId(body.apiKeyId, 'apiKeyId')
            if (req.headers['idempotency-key']) body.id = requireId(String(req.headers['idempotency-key']), 'idempotency-key')
            const config = keyConfig(body.apiKeyId)
            const quota = rpmAllowed(config.id)
            if (!quota.allowed) return json(res, 429, { error: 'internal_rpm_limit_reached', quota })
            try { return json(res, 200, await generateWithGemini(body)) }
            catch (error) {
                await store.addEvent(normalizeEventBody({ ...body, projectId: config.projectId, apiKeyId: config.id, status: 'failed', inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, groundingRequests: 0 }))
                throw error
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/summary') return json(res, 200, { period: { from: url.searchParams.get('from'), to: url.searchParams.get('to') }, ...store.summarize(store.filterEvents(Object.fromEntries(url.searchParams))) })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-key') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'apiKeyId') })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-model') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'model') })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-project') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'projectId') })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-agent') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'agentId') })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-workflow') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'workflowId') })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/by-user') return json(res, 200, { items: store.groupBy(store.filterEvents(Object.fromEntries(url.searchParams)), 'userId') })
        return json(res, 404, { error: 'not_found' })
    } catch (error) { return json(res, 400, { error: error.message }) }
})

await store.init()
server.listen(port, () => console.log('AI usage service listening on http://localhost:' + port))
