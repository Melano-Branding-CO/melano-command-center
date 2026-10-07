# MELANO INC — Autonomous Command Center (MVP)

Proyecto nuevo sobre plantilla limpia + Lovable Cloud (base de datos, auth, funciones de servidor). Todo lo que se ve en pantalla sale de la base de datos real: sin mocks, sin botones decorativos.

## Alcance de este build (MVP)

Auth + Organización → Agentes → Tareas → Decisiones → Reunión Ejecutiva 06:00 → Approval Center → Activity Logs → Command Center.

Fuera de alcance por ahora: integraciones externas (GitHub, Vercel, blockchain, trading), Autonomy Level 3+, ejecución real de acciones críticas.

## Módulos y pantallas

Sidebar: Command Center, Today, Revenue, Agents, Meetings, Decisions, Tasks, Automations, Products, Approvals, Activity, Metrics, Settings.

Header fijo: MELANO INC / Autonomous Command Center, con System status (GREEN/YELLOW/RED), Autonomy Level (arranca en 2), agentes activos y alertas críticas.

- **Command Center**: HOY (máx. 3 prioridades con priority, objective, why now, owner, next action, success metric, status), revenue, bloqueos, agentes, decisiones pendientes, automatizaciones, alertas.
- **Today**: sólo el Top 3 del día, formato completo, nada más.
- **Agents**: grilla de los 12 agentes (MELANIA CEO, CRO, CMO, COO, CTO, CFO, PRODUCT, LUXIA, ALENYA, TITAN, NOTORIUS, QA AUDITOR) + ficha individual con OBJECTIVE, CONTEXT, STATE, TOOLS, PERMISSIONS, EXECUTION LOOP, STOP CONDITIONS, FAILURE HANDLING, OBSERVABILITY, MEASURABLE OUTCOME. Botones reales: Ejecutar, Pausar, Activar, ver runs/logs/decisiones/tareas, editar configuración.
- **Meetings**: lista de reuniones + detalle con aportes por agente y Executive Brief consolidado (cada afirmación marcada HECHO / SUPUESTO / PENDIENTE / BLOQUEO). Botón "Ejecutar reunión ahora" además del schedule de las 06:00 (America/Argentina/Buenos_Aires).
- **Decisions**: trazabilidad signal → analysis → decision → action → outcome, con evidencia, riesgo, confianza y estado.
- **Tasks**: tablero por estado (BACKLOG→DONE/FAILED) con responsable, deadline, success metric, dependencias.
- **Approvals**: sólo acciones que requieren autorización humana (Bruno). Muestra acción, agente, motivo, impacto, riesgo, evidencia, payload; aprobar/rechazar queda registrado con usuario y fecha.
- **Activity**: stream de ejecuciones reales (trigger, input/output, herramientas, error, tokens, costo estimado, trace_id).
- **Revenue / Products / Automations / Metrics**: estructura y datos reales; empty states explícitos cuando no hay registros (nunca datos inventados como reales).
- **Settings**: organización, miembros/roles, autonomy level, y botón para limpiar DEMO DATA.

## Cómo funciona el ciclo autónomo

OBSERVE → ANALYZE → PRIORITIZE → DECIDE → ASSIGN → EXECUTE → VERIFY → LEARN, cada ciclo con su `trace_id`.

La reunión de las 06:00 corre en el servidor: cada agente participante produce su análisis con IA (Lovable AI, sin claves en el frontend) usando su system_prompt y las métricas/tareas/decisiones reales de la organización; MELANIA consolida, detecta contradicciones, fija el Top 3, asigna responsables, crea tareas y escribe el Executive Brief. Todo queda persistido: reunión, participantes, outputs, decisiones, tareas y logs.

Nada crítico (pagos, producción, borrado de datos, seguridad, mainnet, trading, contratos, permisos) se ejecuta: se genera una entrada en Approvals con payload y evidencia.

## Diseño

Enterprise oscuro y minimalista. Onyx #0B0B0B, Azul #0F2D52, Plata #C0C7D1, Blanco #FFFFFF, tipografía Montserrat. Sin gradientes exagerados ni estética gamer. Todos los colores como tokens semánticos del design system.

## Detalles técnicos

- Tablas: `profiles`, `organizations`, `organization_members`, `user_roles` (CEO/ADMIN/OPERATOR/VIEWER/AGENT, tabla separada + función `has_role` security definer), `agents`, `agent_permissions`, `agent_tools`, `agent_runs`, `executive_meetings`, `meeting_participants`, `meeting_outputs`, `decisions`, `decision_evidence`, `tasks`, `task_dependencies`, `approvals`, `automation_rules`, `automation_runs`, `alerts`, `metrics`, `projects`, `products`, `activity_logs`.
- Multi-tenant: `organization_id` en todo registro de negocio; RLS en todas las tablas verificando user → membresía de organización → rol → recurso. GRANTs explícitos por tabla. Enums para status/priority/execution_mode/autonomy.
- Backend con server functions de TanStack Start (`createServerFn`) + middleware de auth; la reunión 06:00 se expone como ruta de servidor programada (`/api/public/...` autenticada) para el cron; nada de secretos en el cliente.
- Seed en migración: 12 agentes con su rol, objetivo y system_prompt, organización inicial, productos LUXIA/MELANIA/TITAN/NOTORIUS (LUXIA como prioridad SaaS Real Estate), autonomy level 2. Cualquier registro de ejemplo va marcado `is_demo = true` y se puede borrar desde Settings.
- Realtime en tareas, aprobaciones y agent_runs para que el Command Center se actualice solo.

## Entrega

Al terminar, informe por módulo con estado IMPLEMENTED / PARTIAL / NOT CONNECTED / BLOCKED, y criterio GREEN sólo cuando hay trigger real + ejecución + resultado esperado + persistencia + log + verificación.
