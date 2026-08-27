import fs from 'node:fs/promises'
import path from 'node:path'

const emptyState = { events: [], keys: [], updatedAt: null }

export class UsageStore {
    constructor(filePath) { this.filePath = filePath; this.state = structuredClone(emptyState) }
    async init() {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true })
        try { this.state = JSON.parse(await fs.readFile(this.filePath, 'utf8')) }
        catch (error) { if (error.code !== 'ENOENT') throw error; await this.persist() }
    }
    async persist() {
        this.state.updatedAt = new Date().toISOString()
        const tempPath = this.filePath + '.tmp'
        await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf8')
        await fs.rename(tempPath, this.filePath)
    }
    async addEvent(event) {
        const normalized = {
            id: event.id || crypto.randomUUID(), provider: event.provider || 'google',
            tenantId: event.tenantId || 'default', userId: event.userId || 'system',
            agentId: event.agentId || 'unknown', workflowId: event.workflowId || 'unknown',
            projectId: event.projectId || 'unknown', apiKeyId: event.apiKeyId || 'unknown',
            model: event.model || 'unknown', mode: event.mode || 'standard',
            inputTokens: Math.max(0, Number(event.inputTokens || 0)), outputTokens: Math.max(0, Number(event.outputTokens || 0)),
            cachedInputTokens: Math.max(0, Number(event.cachedInputTokens || 0)), groundingRequests: Math.max(0, Number(event.groundingRequests || 0)),
            costUsd: Math.max(0, Number(event.costUsd || 0)), status: event.status || 'completed', timestamp: event.timestamp || new Date().toISOString(),
        }
        if (!Number.isFinite(Date.parse(normalized.timestamp))) throw new Error('timestamp inválido')
        this.state.events.push(normalized); await this.persist(); return normalized
    }
    async upsertKey(key) {
        const safeKey = { id: key.id || crypto.randomUUID(), name: key.name || 'Nueva clave', projectId: key.projectId || 'unknown', status: key.status || 'Activo', internalLimit: Math.max(1, Number(key.internalLimit || 2000)), createdAt: key.createdAt || new Date().toISOString() }
        const index = this.state.keys.findIndex(item => item.id === safeKey.id)
        if (index >= 0) this.state.keys[index] = { ...this.state.keys[index], ...safeKey }; else this.state.keys.push(safeKey)
        await this.persist(); return safeKey
    }
    filterEvents(query = {}) {
        const from = query.from ? Date.parse(query.from) : -Infinity
        const to = query.to ? Date.parse(query.to) : Infinity
        const dimensions = ['tenantId', 'userId', 'agentId', 'workflowId', 'projectId', 'apiKeyId', 'model']
        return this.state.events.filter(event => Date.parse(event.timestamp) >= from && Date.parse(event.timestamp) <= to && dimensions.every(dimension => !query[dimension] || event[dimension] === query[dimension]))
    }
    summarize(events) {
        return events.reduce((summary, event) => {
            summary.requests++; summary.inputTokens += event.inputTokens; summary.outputTokens += event.outputTokens
            summary.cachedInputTokens += event.cachedInputTokens; summary.groundingRequests += event.groundingRequests
            summary.costUsd += event.costUsd || 0
            summary.failedRequests += event.status === 'completed' ? 0 : 1; return summary
        }, { requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, groundingRequests: 0, failedRequests: 0, costUsd: 0 })
    }
    groupBy(events, field) {
        const groups = new Map()
        for (const event of events) { const key = event[field] || 'unknown'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(event) }
        return [...groups.entries()].map(([key, items]) => ({ [field]: key, ...this.summarize(items) }))
    }
}
