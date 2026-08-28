# AI usage service

Servicio independiente para registrar consumo y preparar la integración posterior con ForgeUnits.

## Ejecutar

AI_USAGE_INGEST_TOKEN=local-dev-token node server/server.mjs

Variables: AI_USAGE_PORT, AI_USAGE_STORE, AI_USAGE_API_TOKEN, AI_USAGE_DASHBOARD_PASSWORD, AI_USAGE_INGEST_TOKEN, AI_USAGE_CORS_ORIGIN, GEMINI_API_KEY, GEMINI_API_KEY_ID, GEMINI_API_KEYS_JSON, GEMINI_PROJECT_ID, GEMINI_API_BASE_URL y AI_USAGE_RPM_LIMIT.

`GEMINI_API_BASE_URL` es opcional y por defecto apunta al endpoint oficial de Gemini. Puede cambiarse en pruebas automatizadas o entornos controlados, pero en producción debe conservar el endpoint oficial.

No se almacenan API keys de Google. apiKeyId es un identificador lógico; los secretos deberán vivir en un gestor de secretos.

## Evento

El servicio acepta Authorization: Bearer TOKEN para integraciones de servicio. AI_USAGE_API_TOKEN es el nombre recomendado; AI_USAGE_INGEST_TOKEN se conserva por compatibilidad. Las consultas del dashboard requieren sesión iniciada con AI_USAGE_DASHBOARD_PASSWORD; si no se configura, el acceso queda bloqueado de forma segura.

POST /api/ai-usage/events recibe provider, tenantId, userId, agentId, workflowId, projectId, apiKeyId, model, mode, inputTokens, outputTokens, cachedInputTokens, groundingRequests, status y timestamp. El costo siempre se calcula en el backend; el valor enviado por un cliente se ignora.

Los clientes deben enviar `Idempotency-Key` para que los reintentos de red no dupliquen eventos. `server/forgeunits-client.mjs` lo genera automáticamente cuando el evento no incluye `id`.

POST /api/ai-usage/generate recibe model, contents, generationConfig y opcionalmente apiKeyId, tenantId, userId, agentId, workflowId, systemInstruction, mode y groundingRequests. La clave real se lee exclusivamente desde GEMINI_API_KEY o GEMINI_API_KEYS_JSON, nunca desde el navegador. La respuesta incluye el resultado de Gemini y el evento de uso registrado.

Para varias claves, `GEMINI_API_KEYS_JSON` acepta el formato simple `{"production-main":"AIza..."}` o el formato recomendado con proyecto y nombre por clave:

```json
{
  "project-01-main": { "key": "AIza...", "projectId": "gen-lang-client-001", "name": "Proyecto 01" },
  "project-02-main": { "key": "AIza...", "projectId": "gen-lang-client-002", "name": "Proyecto 02" }
}
```

En producción debe inyectarse desde un gestor de secretos y no guardarse en el repositorio. `GEMINI_PROJECT_ID` se usa como fallback para claves con el formato simple.

Consultas: GET /api/ai-usage/summary, GET /api/ai-usage/by-key, GET /api/ai-usage/by-model, GET /api/ai-usage/by-project, GET /api/ai-usage/by-agent, GET /api/ai-usage/by-workflow y GET /api/ai-usage/by-user. Todas requieren el token de servicio o una sesión iniciada del dashboard.

## Cliente para ForgeUnits

El archivo server/forgeunits-client.mjs exporta createForgeUnitsUsageReporter({ baseUrl, token }). ForgeUnits puede importar ese cliente y llamar reporter.report({ tenantId, userId, agentId, workflowId, projectId, apiKeyId, model, inputTokens, outputTokens, status }) después de cada llamada a un proveedor.

## Pruebas

`npm run test:server` ejecuta pruebas de contrato para autenticación, sesiones, cálculo de costos e idempotencia.
