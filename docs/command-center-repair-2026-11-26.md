# Command Center: reparación operativa

Revisión: 26/11/2026, Argentina. Base: `300a7c5283f16b06b4f5e33339d4dc265ba3a282`.

## Problema y comportamiento corregido

- La base registraba 12 agentes en ERROR por credenciales de IA ausentes o saldo agotado. El encabezado los contaba como activos. Ahora sólo cuenta ACTIVE/RUNNING, muestra bloqueos y consulta configuración sin revelar secretos ni acreditar disponibilidad por tener una clave.
- La ejecución individual validaba la organización del solicitante, pero consultaba el agente con service role sólo por ID. Ahora valida ambas organizaciones antes de ejecutar y reclama el agente mediante actualización condicional. Un agente pausado o en ejecución es rechazado.
- La reunión hacía múltiples solicitudes aun con errores y podía ignorar fallos de escritura. Se agrega preflight, timeout de 25 segundos por solicitud, detención ante el primer fallo y comprobación de persistencia. Las herramientas mencionadas en el prompt ya no figuran como herramientas ejecutadas.
- Revenue leía snapshots de septiembre, incluido un supuesto cliente activo. Las dos cuentas actuales eran PROSPECTO, ARS y MRR 0. `/command`, `/revenue` y el contexto de IA usan un resumen compartido de registros actuales, separado por moneda. Prospectos, demos, presupuestos de leads y otras organizaciones no acreditan MRR activo.
- El seguimiento comercial puede registrar estado, moneda, MRR, próxima acción y fecha desde Clientes. Estos registros no acreditan contrato ni cobro. Costos, margen y rentabilidad continúan SIN DATOS.
- La generación manual de prioridades funciona por reglas: hasta tres tareas desde bloqueos, seguimientos vencidos y cuentas sin próxima acción. La función usa RLS del solicitante, rol operativo, bloqueo transaccional por organización/día e ID determinista por origen. Tareas y audit logs se guardan en la misma transacción; no depende de IA.
- n8n distingue recepción de ejecución terminada. HTTP 200, mensajes de cola o `ok: true` sin resultado final quedan pendientes de verificación. La configuración se valida antes de abrir una corrida y se registran excepciones. Las variables documentadas coinciden con las que lee el backend.

## Validación ejecutada

| Prueba | Resultado y alcance |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS, cliente + SSR |
| `node --import tsx --test src/lib/operations.test.ts src/lib/lead-summary.test.ts src/integrations/supabase/public-config.test.ts` | PASS: 18 pruebas |
| ESLint en módulos nuevos, agregación y componente Revenue | 0 errores; aviso de Fast Refresh por exportación del hook compartido |
| Prueba de RPC con rol `authenticated`, claims de miembro existente y RLS | PASS: persistencia, auditoría, máximo tres compartido entre reglas y reunión de IA (en ambos órdenes), idempotencia y rechazo de otra organización; escrituras de prueba revertidas |
| Permisos efectivos de RPC aplicada | SECURITY INVOKER; authenticated puede ejecutar; anon no puede ejecutar |
| Bundle público | No contiene los nombres de las credenciales privilegiadas de Supabase ni IA |

La migración `20261127011000_operational_priorities.sql` se aplicó al backend activo de Lovable. La migración `20261127012500_shared_daily_priority_cap.sql` está PENDIENTE: el MCP de Lovable alcanzó su límite temporal de operaciones de base de datos al instalarla; la llamada fue rechazada sin ejecutarse (reintento indicado por el proveedor: 39 minutos). No modifica tablas existentes ni crea tareas al instalarse. Las tareas se crean cuando un operador acciona el botón. La generación por IA requiere esa segunda migración antes de publicar esta revisión.

## Bloqueos y comprobación publicada pendiente

Se observó en `https://www.comandcenter.tech/command`: “Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Configure them in Vercel.” En el mismo dominio `/api/public/health` respondió `status: ok`. Un health check aislado no certifica la pantalla ni el login.

Lovable agotó créditos durante su turno y se terminó la integración desde el repositorio. La publicación por interfaz requiere una sesión de Lovable; el navegador disponible muestra el login. Cloudflare compiló y desplegó la primera revisión del PR en dos previews; el preview `melano-command-center-prod` redirigió `/command` a `/auth` correctamente, sin el error de configuración. Vercel mantiene los mismos estados de bloqueo de despliegue que tenía el commit base. El análisis de GitHub no inició pasos y DCO informa falta de sign-off en el commit. Estos checks no se presentan como aprobados. La ejecución real de IA requiere credenciales válidas y saldo. La conexión y el resultado real de n8n siguen pendientes de certificar.

Primero aplicar la segunda migración y completar la integración/publicación. Después, cerrar el gate con una cuenta existente: entrar en `/command`, comprobar Revenue, generar prioridades, recargar y comparar tareas/trace con `activity_logs`; repetir la generación y verificar cero duplicados; abrir Clientes y guardar un seguimiento autorizado; comprobar la misma cifra de Revenue después de recargar. La IA sólo queda certificada con un run exitoso persistido y permisos correctos.

**Estado global: RED hasta completar estas pruebas en la versión publicada.** No se acredita rentabilidad: faltan costos de entrega y cobros verificados.

## Reversión

Revertir el commit de aplicación y volver a publicar la versión anterior. Las nuevas RPC pueden quedar sin uso; las tareas y logs ya creados conservan su historial. No se necesita borrar datos ni revertir tablas.
