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

- GET /api/ai-usage/summary?from=&to=
- GET /api/ai-usage/by-key?from=&to=
- GET /api/ai-usage/by-model?from=&to=
- POST /api/ai-usage/events

El adaptador de Google Cloud será responsable de consultar Monitoring/Quotas. El gateway será responsable de identificar la API key, contar tokens desde la respuesta de Gemini y aplicar los límites internos.

## Precios incluidos

El catálogo demo incluye Gemini 2.5 Pro, Gemini 2.5 Flash y Gemini 2.5 Flash-Lite en USD, con tarifas estándar y batch/flex consultadas el 27 de agosto de 2026. Fuente: https://ai.google.dev/gemini-api/docs/pricing
