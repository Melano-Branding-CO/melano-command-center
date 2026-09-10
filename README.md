# Melano Command Center

Crea un nuevo proyecto con Supabase habilitado.Arquitectura objetivo

Lovable = interfaz + Command Center
Supabase = estado, memoria, decisiones, logs y métricas
MELANIA = CEO digital / orquestador
Agentes = especialistas ejecutivos
Automatizaciones = ejecución programada/event-driven
Bruno = autoridad final para acciones críticas

La operación diaria debería funcionar así:

06:00 → reunión autónoma de agentes → análisis → prioridades → tareas → ejecución permitida → reporte → Command Center → escalamiento a Bruno sólo cuando haga falta.

Agentes iniciales:

AgenteFunciónMELANIA CEOCoordina todo el sistemaCRORevenue, pipeline, ventas, MRRCMOGrowth, campañas, contenido, competenciaCOOOperaciones, bloqueos, responsablesCTOGitHub, Supabase, Vercel, arquitecturaCFOCashflow, costos, forecastingPRODUCTLUXIA, roadmap, productoLUXIALeads, CRM, follow-up, conversiónALENYAKnowledge base y documentaciónTITANAnalytics financieroNOTORIUSTokenización y blockchainQA / AUDITOREvidencia, errores y GREEN Gate

Prompt maestro para Lovable

Construí una aplicación web production-ready llamada:

MELANO INC — AUTONOMOUS COMMAND CENTER

OBJETIVO

Crear un sistema operativo empresarial autónomo para MELANO INC donde múltiples agentes de IA trabajen como un equipo ejecutivo digital, compartan información, tengan reuniones automáticas, creen decisiones, tareas, alertas, métricas y registros verificables.

La aplicación NO debe ser una simulación visual.

Toda acción, estado, agente, reunión, tarea, decisión y ejecución debe tener persistencia real en Supabase.

==================================================

ARQUITECTURA GENERAL
==================================================

Frontend:

React

TypeScript

Tailwind

shadcn/ui

responsive desktop/mobile

diseño premium enterprise

Backend:

Supabase

PostgreSQL

Supabase Auth

Row Level Security

Edge Functions cuando corresponda

realtime para estados relevantes

La aplicación debe quedar preparada para integraciones externas mediante APIs y webhooks.

NO colocar secretos en frontend.

Marca:

MELANO INC

Tagline:

AI. Automation. Impact.

Estética:

enterprise

tecnológica

minimalista

premium

oscura

Paleta:

Onyx: #0B0B0B
Azul: #0F2D52
Plata: #C0C7D1
Blanco: #FFFFFF

Usar Montserrat o alternativa visual equivalente.

Evitar:

gradients exagerados

estética gamer

interfaces ficticias

datos falsos

botones sin función

Crear Dashboard principal denominado:

COMMAND CENTER

Debe permitir entender en menos de 10 segundos:

HOY
REVENUE
BLOQUEOS
AGENTES
DECISIONES
PRODUCTO
AUTOMATIZACIONES
ALERTAS
MÉTRICAS

La sección HOY tendrá máximo 3 prioridades.

Cada prioridad debe mostrar:

prioridad P0/P1/P2/P3

objetivo

responsable

estado

fecha

métrica de éxito

siguiente acción

Prioridades:

P0 = producción, seguridad, cliente o revenue crítico
P1 = ventas, cliente o lanzamiento
P2 = escala, automatización o producto
P3 = mejora futura

Crear un agente principal:

MELANIA

Rol:

Digital CEO / Executive Orchestrator de MELANO INC.

MELANIA debe:

recibir estado de todos los agentes

revisar métricas

detectar bloqueos

detectar conflictos

ordenar prioridades

decidir qué agente debe actuar

crear tareas

solicitar aprobación humana cuando corresponda

verificar resultados

producir briefing ejecutivo

MELANIA no debe ejecutar automáticamente acciones críticas o irreversibles.

Crear inicialmente:

MELANIA CEO
CRO
CMO
COO
CTO
CFO
PRODUCT
LUXIA
ALENYA
TITAN
NOTORIUS
QA AUDITOR

Cada agente necesita:

id
name
role
objective
system_prompt
status
enabled
execution_mode
permissions
tools
dependencies
last_run_at
next_run_at
last_result
last_error
confidence
created_at
updated_at

Estados:

ACTIVE
PAUSED
RUNNING
BLOCKED
ERROR

Modos:

MANUAL
ASSISTED
AUTONOMOUS
APPROVAL_REQUIRED

Crear una ficha individual.

Mostrar:

OBJECTIVE
CONTEXT
STATE
TOOLS
PERMISSIONS
EXECUTION LOOP
STOP CONDITIONS
FAILURE HANDLING
OBSERVABILITY
MEASURABLE OUTCOME

Botones funcionales:

Ejecutar
Pausar
Activar
Ver ejecución
Ver logs
Ver decisiones
Ver tareas
Editar configuración

Nunca mostrar un botón operativo si no tiene función.

Crear módulo:

EXECUTIVE MORNING MEETING

Horario objetivo:

06:00 America/Argentina/Buenos_Aires

Participantes:

MELANIA
CRO
CMO
COO
CTO
CFO
PRODUCT
y agentes especializados relevantes.

Flujo:

START
↓
cada agente analiza su área
↓
cada agente presenta:

situación

cambios

problemas

oportunidades

métricas

propuesta de acción
↓
MELANIA consolida
↓
identifica contradicciones
↓
prioriza
↓
crea máximo 3 prioridades para HOY
↓
asigna responsables
↓
crea tareas
↓
genera Executive Brief
↓
END

Guardar la reunión completa.

Después de cada reunión generar:

MELANO INC
EXECUTIVE BRIEF

Debe contener:

ESTADO GENERAL

TOP 3 DE HOY

REVENUE

PIPELINE

CLIENTES

PRODUCTO

TECNOLOGÍA

MARKETING

AUTOMATIZACIONES

BLOQUEOS

RIESGOS

DECISIONES

OPORTUNIDADES

ACCIONES EJECUTADAS

ACCIONES QUE REQUIEREN BRUNO

Cada afirmación debe diferenciar:

HECHO
SUPUESTO
PENDIENTE
BLOQUEO

Crear tabla y módulo de decisiones.

Cada decisión:

id
title
description
source_agent
priority
status
reasoning_summary
evidence
expected_impact
risk
confidence
requires_approval
approved_by
approved_at
created_at
outcome
outcome_at

Estados:

PROPOSED
APPROVED
REJECTED
EXECUTING
COMPLETED
FAILED

Crear trazabilidad:

signal
→ analysis
→ decision
→ action
→ outcome

Crear sistema central de tareas.

Cada tarea:

id
title
description
project
priority
assigned_agent
created_by
status
execution_mode
deadline
success_metric
dependencies
requires_approval
result
error
created_at
started_at
completed_at

Estados:

BACKLOG
READY
RUNNING
BLOCKED
REVIEW
DONE
FAILED

Crear:

HUMAN APPROVAL CENTER

Aquí aparecen exclusivamente acciones que no deben ejecutarse sin autorización humana.

Ejemplos:

pagos

publicaciones publicitarias con gasto

cambios de producción

eliminación de datos

modificaciones de seguridad

mainnet blockchain

trading real

contratos

comunicaciones críticas

cambios de permisos

Mostrar:

acción
agente
motivo
impacto
riesgo
evidencia
payload
aprobar
rechazar

Registrar quién autorizó y cuándo.

Toda ejecución debe producir log.

Guardar:

execution_id
agent_id
task_id
trigger
started_at
finished_at
status
input
output
tools_used
error
tokens
estimated_cost
trace_id

Visualizarlo mediante:

ACTIVITY STREAM

No inventar actividad.

Crear módulo:

AUTOMATION CENTER

Mostrar automatizaciones:

nombre
trigger
agente
acción
estado
última ejecución
próxima ejecución
resultado
errores

Triggers posibles:

schedule
database_event
webhook
manual
external_event

Crear módulo prioritario:

REVENUE

Debe mostrar:

MRR
pipeline
oportunidades
leads
conversaciones calificadas
demos
propuestas
cierres
follow-ups vencidos
riesgo comercial

No introducir datos simulados como si fueran reales.

Mostrar EMPTY STATE cuando no existen registros.

Productos principales:

LUXIA
MELANIA
TITAN
NOTORIUS

Cada uno debe mostrar:

estado
prioridad
roadmap
incidentes
métricas
bloqueos
decisiones
tasks
últimas ejecuciones

LUXIA debe permanecer como prioridad SaaS de Real Estate.

Diseñar tablas como mínimo:

profiles
organizations
agents
agent_permissions
agent_tools
agent_runs
executive_meetings
meeting_participants
meeting_outputs
decisions
decision_evidence
tasks
task_dependencies
approvals
automation_rules
automation_runs
alerts
metrics
projects
products
activity_logs

Todos los registros asociados a organización deben utilizar organization_id.

Preparar arquitectura multi-tenant.

Implementar:

Supabase Auth

Roles iniciales:

CEO
ADMIN
OPERATOR
VIEWER
AGENT

Configurar RLS.

No asumir que un usuario autenticado tiene autorización.

Verificar:

user
→ role
→ organization
→ permissions
→ resource

Nunca exponer:

service_role
API secrets
tokens
OAuth secrets

Crear indicador visual:

AUTONOMY LEVEL

0 = manual
1 = recommendation
2 = assisted execution
3 = autonomous low-risk actions
4 = advanced autonomy
5 = full operational autonomy

El sistema comienza en:

LEVEL 2

No activar Level 5 automáticamente.

El nivel se aumenta únicamente después de resultados verificados.

Una función se considera GREEN únicamente cuando:

trigger real +
ejecución real +
resultado esperado +
persistencia +
log +
verificación

Compilar correctamente NO significa GREEN.

Mostrar estados:

GREEN
YELLOW
RED

Implementar arquitectura para:

OBSERVE
↓
ANALYZE
↓
PRIORITIZE
↓
DECIDE
↓
ASSIGN
↓
EXECUTE
↓
VERIFY
↓
LEARN
↓
REPEAT

Cada ciclo debe producir trace_id.

Sidebar:

Command Center
Today
Revenue
Agents
Meetings
Decisions
Tasks
Automations
Products
Approvals
Activity
Metrics
Settings

Header:

MELANO INC
Autonomous Command Center

Mostrar:

System status
Autonomy level
Active agents
Critical alerts

Esta pantalla es extremadamente importante.

Máximo 3 acciones.

Formato:

PRIORITY

OBJECTIVE

WHY NOW

OWNER

NEXT ACTION

SUCCESS METRIC

STATUS

No llenar esta pantalla con 20 tareas.

================================================== 23. MVP

Primero implementar un MVP REAL.

MVP =

Auth +
Supabase +
Agents +
Tasks +
Decisions +
Executive Meeting +
Activity Logs +
Approval Center +
Command Center

No construir primero integraciones complejas.

================================================== 24. DEMO DATA

Si necesitás datos de demostración para desarrollar UI:

identificarlos claramente como:

DEMO DATA

Nunca mezclarlos con información real.

Agregar opción para limpiar demo data.

================================================== 25. CRITERIO FINAL

No quiero solamente un dashboard atractivo.

Quiero la base funcional de un sistema operativo empresarial autónomo.

Toda pantalla debe responder:

¿Qué está pasando?

¿Qué decidió el sistema?

¿Por qué?

¿Quién lo está ejecutando?

¿Qué resultado produjo?

¿Qué requiere intervención humana?

¿Qué hacemos hoy?

Construí primero la arquitectura, schema y navegación.

Después implementar los módulos MVP y conectar todas las interfaces con Supabase real.

No declarar ninguna función terminada si todavía utiliza mocks.

Finalizar mostrando claramente:

IMPLEMENTED
PARTIAL
NOT CONNECTED
BLOCKED

para cada módulo.

Orden de construcción

No intentaría construir el Level 5 de entrada. La secuencia correcta es:

Lovable UI → Supabase real → MELANIA → agentes → reunión 06:00 → tareas/decisiones → approval gate → logs → acciones autónomas de bajo riesgo → integraciones externas.

DECISIÓN: BUILD MVP ONLY. El sistema autónomo pasa a ser un activo central de MELANO INC, pero empieza en Autonomy Level 2, no con autonomía irrestricta.

PRÓXIMA ACCIÓN: usar este prompt como especificación maestra de Lovable y convertir el primer build en Command Center + Agents + Morning Meeting + Decisions + Tasks + Approvals + Logs.

ÉXITO: a las 06:00 se genera una reunión real registrada en Supabase, MELANIA recibe los outputs de los agentes, produce un Top 3, crea tareas con responsables y deja evidencia/traces; ninguna acción crítica se ejecuta sin autorización.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://melano-command-center.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e2ce9f8f-6161-46f2-bc7f-78870b1012b3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
