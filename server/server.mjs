import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { UsageStore } from './usage-store.mjs'
import { calculateCost } from './pricing.mjs'

const port = Number(process.env.PORT || process.env.AI_USAGE_PORT || 3010)
const root = path.dirname(fileURLToPath(import.meta.url))
const store = new UsageStore(process.env.AI_USAGE_STORE || path.join(root, 'data', 'usage.json'))
const publicRoot = path.join(root, '..', 'dist')

function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': process.env.AI_USAGE_CORS_ORIGIN || 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type, X-Usage-Token, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' })
    res.end(JSON.stringify(body))
}
function landing(res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Usage Service</title><style>body{font:16px system-ui;max-width:680px;margin:60px auto;padding:0 24px;color:#242238;background:#f7f7fb}main{background:white;border:1px solid #e7e5ef;border-radius:14px;padding:28px;box-shadow:0 8px 26px #2f2a620b}h1{margin-top:0}a{color:#6657d9;font-weight:700}li{margin:12px 0}</style></head><body><main><h1>AI Usage Service ✓</h1><p>El backend está activo y listo para recibir consumo de Gemini.</p><ul><li><a href="http://localhost:5173/">Abrir dashboard</a></li><li><a href="/health">Ver health check</a></li><li>API: /api/ai-usage/summary</li><li>API: /api/ai-usage/by-key</li><li>API: /api/ai-usage/by-model</li></ul></main></body></html>')
}
async function serveApp(req, res) {
    const requested = req.url === '/' ? 'index.html' : req.url.replace(/^\/+/, '')
    const safePath = path.resolve(publicRoot, requested)
    if (!safePath.startsWith(path.resolve(publicRoot))) return false
    try {
        const content = await fs.readFile(safePath)
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' }
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
function authorized(req) {
    const configured = process.env.AI_USAGE_API_TOKEN || process.env.AI_USAGE_INGEST_TOKEN
    if (!configured) return true
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    return req.headers['x-usage-token'] === configured || bearer === configured
}
function keyConfig(requestedId) {
    let keys = {}
    if (process.env.GEMINI_API_KEYS_JSON) {
        try { keys = JSON.parse(process.env.GEMINI_API_KEYS_JSON) } catch { throw new Error('GEMINI_API_KEYS_JSON no es JSON válido') }
    }
    const id = requestedId || process.env.GEMINI_API_KEY_ID || Object.keys(keys)[0] || 'default-gemini-key'
    return { key: keys[id] || (id === (process.env.GEMINI_API_KEY_ID || 'default-gemini-key') ? process.env.GEMINI_API_KEY : undefined), id, projectId: process.env.GEMINI_PROJECT_ID || 'unknown' }
}
function configuredKeyMetadata() {
    let keys = {}
    if (process.env.GEMINI_API_KEYS_JSON) {
        try { keys = JSON.parse(process.env.GEMINI_API_KEYS_JSON) } catch { throw new Error('GEMINI_API_KEYS_JSON no es JSON válido') }
    }
    const ids = Object.keys(keys)
    if (process.env.GEMINI_API_KEY && !ids.includes(process.env.GEMINI_API_KEY_ID || 'default-gemini-key')) ids.push(process.env.GEMINI_API_KEY_ID || 'default-gemini-key')
    return ids.map(id => ({ id, projectId: process.env.GEMINI_PROJECT_ID || 'unknown', configured: true }))
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
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(config.key), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/keys') return json(res, 200, { items: store.listKeySummaries(configuredKeyMetadata()) })
        if (req.method === 'GET' && url.pathname === '/api/ai-usage/events') {
            const events = store.filterEvents(Object.fromEntries(url.searchParams)).slice(-100).reverse()
            return json(res, 200, { items: events })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/events') {
            if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
            const body = await readBody(req)
            const hasCost = body.costUsd !== undefined && body.costUsd !== null && Number.isFinite(Number(body.costUsd))
            if (!hasCost) body.costUsd = calculateCost({ model: body.model, inputTokens: body.inputTokens, outputTokens: body.outputTokens, mode: body.mode })
            return json(res, 201, { event: await store.addEvent(body) })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/keys') {
            if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
            return json(res, 201, { key: await store.upsertKey(await readBody(req)) })
        }
        if (req.method === 'POST' && url.pathname === '/api/ai-usage/generate') {
            if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
            const body = await readBody(req)
            const config = keyConfig(body.apiKeyId)
            const quota = rpmAllowed(config.id)
            if (!quota.allowed) return json(res, 429, { error: 'internal_rpm_limit_reached', quota })
            const result = await generateWithGemini(body)
            return json(res, 200, result)
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
