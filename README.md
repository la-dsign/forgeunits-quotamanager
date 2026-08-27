# QuotaPilot

Proyecto independiente para monitorizar límites y calcular costos de uso de IA. Está preparado para desplegarse como servicio separado de ForgeUnits en Railway.

## Desarrollo local

Ejecuta npm install, npm run build y después define AI_USAGE_API_TOKEN=local-dev-token antes de ejecutar npm start.

La aplicación queda en http://localhost:3010/.

## Railway

Conecta este repositorio a un proyecto nuevo de Railway. Railway desplegará cada push a la rama configurada. Define las variables de .env.example en Railway; nunca subas las credenciales al repositorio.

El servicio sirve el dashboard compilado y la API desde el mismo dominio. El almacenamiento JSON es adecuado para desarrollo; para producción se recomienda añadir PostgreSQL o Redis antes de guardar históricos importantes.

## Integración con ForgeUnits

ForgeUnits puede usar server/forgeunits-client.mjs para enviar eventos a /api/ai-usage/events. El contrato se detalla en AI-COST-INTEGRATION.md.
