import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'

let child
let upstream
let baseUrl
let tempDir
const serviceToken = 'test-service-token'
const dashboardPassword = 'test-dashboard-password'

async function waitForHealth() {
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch(baseUrl + '/health')).ok) return } catch { /* process is still starting */ }
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('El servidor de pruebas no inició')
}

before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quotamanager-test-'))
    upstream = http.createServer((request, response) => {
        assert.equal(request.headers['x-goog-api-key'], 'fake-gemini-key')
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'respuesta de prueba' }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 250, cachedContentTokenCount: 100 } }))
    })
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
    const upstreamPort = upstream.address().port
    const port = 3203
    baseUrl = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(port), AI_USAGE_API_TOKEN: serviceToken, AI_USAGE_DASHBOARD_PASSWORD: dashboardPassword, GEMINI_API_KEY: 'fake-gemini-key', GEMINI_API_KEY_ID: 'production-main', GEMINI_PROJECT_ID: 'project-1', GEMINI_API_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1beta`, AI_USAGE_STORE: path.join(tempDir, 'usage.json') }, stdio: 'ignore' })
    await waitForHealth()
})

after(async () => {
    child?.kill()
    await new Promise(resolve => upstream?.close(resolve))
    await fs.rm(tempDir, { recursive: true, force: true })
})

test('protege métricas sin autenticación y permite login de dashboard', async () => {
    const unauthenticated = await fetch(baseUrl + '/api/ai-usage/summary')
    assert.equal(unauthenticated.status, 401)
    const login = await fetch(baseUrl + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: dashboardPassword }) })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie')?.split(';')[0]
    const authenticated = await fetch(baseUrl + '/api/ai-usage/summary', { headers: { cookie } })
    assert.equal(authenticated.status, 200)
})

test('calcula el costo en servidor y evita duplicar idempotency keys', async () => {
    const headers = { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json', 'idempotency-key': 'event-001' }
    const body = JSON.stringify({ apiKeyId: 'production-main', projectId: 'project-1', model: 'gemini-2.5-flash', inputTokens: 1000000, outputTokens: 1000000, costUsd: 999 })
    const first = await fetch(baseUrl + '/api/ai-usage/events', { method: 'POST', headers, body })
    const second = await fetch(baseUrl + '/api/ai-usage/events', { method: 'POST', headers, body })
    assert.equal(first.status, 201); assert.equal(second.status, 201)
    const firstEvent = (await first.json()).event
    const secondEvent = (await second.json()).event
    assert.equal(firstEvent.costUsd, 2.8)
    assert.equal(secondEvent.id, firstEvent.id)
    const summary = await (await fetch(baseUrl + '/api/ai-usage/summary', { headers: { authorization: `Bearer ${serviceToken}` } })).json()
    assert.equal(summary.requests, 1)
})

test('captura usageMetadata de Gemini y registra la generación', async () => {
    const response = await fetch(baseUrl + '/api/ai-usage/generate', { method: 'POST', headers: { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json', 'idempotency-key': 'generation-001' }, body: JSON.stringify({ apiKeyId: 'production-main', model: 'gemini-2.5-flash', contents: [{ parts: [{ text: 'test' }] }] }) })
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.response.candidates[0].content.parts[0].text, 'respuesta de prueba')
    assert.equal(payload.usage.inputTokens, 1000)
    assert.equal(payload.usage.outputTokens, 250)
    assert.equal(payload.usage.costUsd, 0.000925)
})
