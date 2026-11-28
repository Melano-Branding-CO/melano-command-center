# Roadmap

- [x] Reparar vínculo de configuración y migrar Google al acceso gestionado antes de publicar.
- [ ] Confirmar entrada completa con Google: requiere seleccionar una cuenta real de Google.
- [x] Confirmar invitación vigente en Clientes → /publico con tarea asignada y aislamiento de cuentas (25/11/2026).

- [x] Diagnosticar variables de preview tras reversión: acceso, health y lectura autenticada del portal verificados el 21/11/2026; el error no se reproduce en el entorno actual. Sin cambios de backend, permisos ni publicación.

- [ ] Conectar Automatizaciones al backend real de n8n sin llamadas de IA y verificar ejecución, permisos y registros persistidos.
- [ ] Reparar preflight de IA, ejecución scoped de agentes, errores y persistencia; sin cambiar proveedor/modelo ni ejecutar servicios externos.
- [ ] Generar hasta tres prioridades operativas por reglas con autorización, deduplicación y trazabilidad, sin IA.
- [ ] Unificar Revenue actual por moneda desde clientes/leads reales y verificar pruebas y UI con identidad existente; sin modificar datos reales durante pruebas ni publicar.
- [ ] /publico: mostrar datos reales (tareas, decisiones, aprobaciones, leads) en lugar de conteos en 0


## Reparación operativa 26/11/2026
- [x] Integrar preflight de IA, ejecución de agente por organización y reclamación condicional, timeout y comprobación de persistencia. Verificación de código y pruebas, no certificación de IA productiva.
- [x] Integrar prioridades por reglas con RPC transaccional, RLS, trazabilidad e idempotencia; primera migración aplicada y pruebas SQL revertidas.
- [x] Aplicar 20261127012500_shared_daily_priority_cap.sql: aplicada sin modificaciones el 28/11/2026 como drizzle/migrations/0001_shared_daily_priority_cap.sql. EXECUTE verificado: anon/authenticated false, servidor true.
- [x] Unificar Revenue actual y agregar edición del seguimiento comercial en Clientes; 18 pruebas, TypeScript y build PASS.
- [ ] Publicar desde una sesión autorizada de Lovable y verificar login, rutas, recarga, tareas/audit y seguimiento con datos autorizados.
- [ ] Certificar una ejecución real de IA con credenciales/saldo y la conexión real de n8n. Estado global RED.

## Gate de producción 28/11/2026
- [x] Suite con loader tsx: 18/18 pruebas; compilación automática OK; health local HTTP 200 con database ok. Revisión básica de seguridad sin hallazgos; no incluye revisión profunda de código.
- [ ] Verificar /command, /revenue y /today con identidad autorizada: BLOQUEO, la identidad disponible no tiene organization_members; las pantallas muestran estados vacíos y no constituyen evidencia de funcionamiento autorizado. No se otorgaron roles ni se crearon usuarios.
- [ ] Publicar y verificar comandcenter.tech: detenido hasta completar el gate autenticado. No se ejecutaron IA, workflows externos, mensajes ni cobros. No hay nuevos trace_id/run_id operativos.
