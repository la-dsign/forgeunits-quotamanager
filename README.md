# QuotaPilot

Proyecto independiente para monitorizar límites y calcular costos de uso de IA. Está preparado para desplegarse como servicio separado de ForgeUnits en Railway.

## Desarrollo local

Ejecuta npm install, npm run build y después define AI_USAGE_API_TOKEN=local-dev-token antes de ejecutar npm start.

La aplicación queda en http://localhost:3010/.

## Railway

Conecta este repositorio a un proyecto nuevo de Railway. Railway desplegará cada push a la rama configurada. Define las variables de .env.example en Railway; nunca subas las credenciales al repositorio.

El servicio sirve el dashboard compilado y la API desde el mismo dominio. El dashboard consulta el resumen y el desglose por clave cada 15 segundos; si no existen eventos reales, conserva la vista demo para facilitar la configuración inicial.

Configura una clave individual con `GEMINI_API_KEY` y `GEMINI_API_KEY_ID`, o varias con `GEMINI_API_KEYS_JSON`. El servidor nunca devuelve los secretos: solo expone identificadores, proyecto, estado y métricas agregadas. El almacenamiento JSON es adecuado para desarrollo; en producción se recomienda montar un volumen persistente de Railway o migrar a PostgreSQL antes de guardar históricos importantes.

## Integración con ForgeUnits

ForgeUnits puede usar server/forgeunits-client.mjs para enviar eventos a /api/ai-usage/events, o enrutar sus llamadas Gemini a /api/ai-usage/generate para que Quotamanager capture automáticamente el `usageMetadata` real. El contrato se detalla en AI-COST-INTEGRATION.md.
