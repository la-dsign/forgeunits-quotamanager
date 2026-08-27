# AI usage cost module

Este dashboard es un proyecto independiente. Su objetivo es convertirse después en un módulo de ForgeUnits para calcular y controlar el costo de uso de IA.

## Contrato de consumo

El gateway debe emitir un evento por llamada con estos campos:

- provider: google
- projectId: gen-lang-client-0015125690
- apiKeyId: key-production-main
- model: gemini-2.5-flash
- mode: standard
- inputTokens y outputTokens
- cachedInputTokens y groundingRequests
- status y timestamp

El costo se calcula con el catálogo del frontend solo para demo. En producción, el backend debe guardar el precio aplicado junto al evento para que los reportes históricos no cambien cuando Google actualice sus tarifas.

## Integración futura con ForgeUnits

ForgeUnits debería consumir datos agregados, sin conocer secretos:

- GET /api/ai-usage/summary?from=&to=&tenantId=&projectId=
- GET /api/ai-usage/by-key?from=&to=&projectId=
- GET /api/ai-usage/by-model?from=&to=
- GET /api/ai-usage/keys
- GET /api/ai-usage/events?from=&to=&apiKeyId=&limit=100
- POST /api/ai-usage/events

Para que ForgeUnits no tenga que reportar manualmente cada token, puede enviar las llamadas al gateway:

```text
POST /api/ai-usage/generate
Authorization: Bearer <AI_USAGE_API_TOKEN>
{
  "apiKeyId": "production-main",
  "tenantId": "forgeunits",
  "agentId": "quotation-agent",
  "workflowId": "quote-123",
  "model": "gemini-2.5-flash",
  "contents": [{"parts":[{"text":"..."}]}]
}
```

El gateway selecciona el secreto desde Railway, llama a Gemini, registra el resultado y devuelve la respuesta del modelo junto con el evento normalizado. Para aplicaciones que sigan llamando directamente al proveedor, ForgeUnits puede usar `createForgeUnitsUsageReporter` después de cada respuesta.

El adaptador de Google Cloud será responsable de consultar Monitoring/Quotas si más adelante se necesita el valor oficial de cuota del proyecto. El gateway es responsable de identificar la API key lógica, contar tokens desde la respuesta de Gemini y aplicar los límites internos. Las cuotas de Google se aplican por proyecto, por lo que el desglose por API key en Quotamanager es trazabilidad y control operativo, no una cuota independiente creada por la aplicación.

## Precios incluidos

El catálogo demo incluye Gemini 2.5 Pro, Gemini 2.5 Flash y Gemini 2.5 Flash-Lite en USD, con tarifas estándar y batch/flex consultadas el 27 de agosto de 2026. Fuente: https://ai.google.dev/gemini-api/docs/pricing
