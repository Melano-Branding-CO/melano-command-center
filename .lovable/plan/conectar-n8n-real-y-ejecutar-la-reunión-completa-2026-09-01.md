# Conectar n8n real y ejecutar la reunión completa

## Objetivo

Guardar la Production URL real de n8n en la automatización "Executive Morning Meeting" y disparar el run completo para verificar brief, respuestas de agentes y tareas en `/meetings`.

## Datos confirmados

- Production URL: `https://n8n.melanoinc.com/webhook/melano-lead-intake`
- Regla destino: `Executive Morning Meeting` (id `31a17261-3745-4fce-aea9-832a5937a518`), actualmente sin webhook ni workflow.
- Los endpoints y server functions ya existen: `runN8nAutomation`, `runExecutiveMeetingServer` y `/api/public/n8n/dispatch`.

## Pasos

1. **Guardar la URL en la regla** — Actualizar `automation_rules`: `n8n_webhook_url = https://n8n.melanoinc.com/webhook/melano-lead-intake`, `n8n_workflow = melano-lead-intake`, `enabled = true`.
2. **Ejecutar la reunión ejecutiva real** — Invocar `runExecutiveMeetingServer` (vía server function o el endpoint `/api/public/n8n/dispatch` con `action: run_meeting` y el cron secret) para la organización.
3. **Verificar el pipeline completo** — Confirmar en la base:
   - `executive_meetings`: reunión COMPLETED con `executive_brief` y `trace_id`.
   - `meeting_outputs`: una intervención por agente (12 agentes activos).
   - `decisions` y `tasks`: Top 3 prioridades generadas y tareas derivadas.
   - `activity_logs`: trace del run.
   - `automation_runs`: registro del disparo a n8n con status y trace.
4. **Mostrar en UI** — Verificar `/meetings` y `/meetings/$meetingId` (brief + respuestas de agentes) y `/automations` (último run con trace). Informar el meetingId y traceId resultantes.

## Nota

El webhook `melano-lead-intake` sugiere un flujo de intake de leads; se ejecuta la reunión ejecutiva desde el Command Center (server-side) y, si el workflow de n8n responde, queda registrado en `automation_runs`. Si el workflow esperado en n8n es otro (p.ej. uno de brief), indicame el path correcto y actualizo la URL.

## Verificación

- Query de control post-run: reunión, outputs por agente, decisiones, tasks y logs del trace.
- Reporte con meetingId, traceId, cantidad de outputs y estado del webhook n8n.
