import crypto from 'node:crypto'

export function createForgeUnitsUsageReporter({ baseUrl = 'http://localhost:3010', token, fetchImpl = fetch } = {}) {
    if (!token) throw new Error('El reporter necesita un token de servicio')
    return {
        async report(event) {
            const idempotencyKey = event.id || crypto.randomUUID()
            const response = await fetchImpl(baseUrl.replace(/\/$/, '') + '/api/ai-usage/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': idempotencyKey },
                body: JSON.stringify({
                    provider: event.provider || 'google',
                    tenantId: event.tenantId || 'forgeunits',
                    userId: event.userId || 'system',
                    agentId: event.agentId || 'unknown',
                    workflowId: event.workflowId || 'unknown',
                    projectId: event.projectId || 'unknown',
                    apiKeyId: event.apiKeyId || 'unknown',
                    model: event.model || 'unknown',
                    mode: event.mode || 'standard',
                    inputTokens: Number(event.inputTokens || 0),
                    outputTokens: Number(event.outputTokens || 0),
                    cachedInputTokens: Number(event.cachedInputTokens || 0),
                    groundingRequests: Number(event.groundingRequests || 0),
                    status: event.status || 'completed',
                    timestamp: event.timestamp || new Date().toISOString(),
                }),
            })
            if (!response.ok) throw new Error('No se pudo registrar el consumo: HTTP ' + response.status)
            return response.json()
        },
    }
}
