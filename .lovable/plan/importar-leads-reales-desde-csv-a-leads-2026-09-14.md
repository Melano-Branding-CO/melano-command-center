# Importar leads reales desde CSV a /leads

## Objetivo
Cargar en la tabla `leads` del Command Center los contactos reales que el usuario exportó como CSV desde su otro proyecto, para que /leads y Green Gate muestren datos reales.

## Pasos

1. **Recibir y leer el CSV** que el usuario suba al chat.
2. **Mapear columnas del CSV a la tabla `leads`**:
   - `full_name` (obligatorio) ← nombre/contacto
   - `email`, `phone`, `zone` (zona), `source` (origen), `interest`, `budget`, `notes`
   - Valores por defecto coherentes con el sistema: `cohort`, `phase = FASE_0_14`, `status = NUEVO`, `score = 0`, `currency = ARS`, `is_demo = false`
   - `organization_id` = MELANO INC (`11111111-1111-4111-8111-111111111111`)
   - Filas sin nombre se omiten y se reportan.
3. **Insertar los leads** en la base (carga directa en la tabla `leads`).
4. **Registrar la importación** en `activity_logs` con trace_id (auditoría).
5. **Verificar**:
   - Conteo insertado vs. filas del CSV.
   - /leads muestra los nuevos contactos.
   - Green Gate deja de mostrar PENDIENTE por falta de leads.

## Notas técnicas
- Si el CSV trae columnas con nombres distintos (ej. `nombre`, `telefono`, `localidad`), se normalizan al mapeo anterior.
- No se inventa ningún dato: lo que no esté en el CSV queda vacío o con el valor por defecto declarado.
- Si hay emails duplicados con leads existentes, se reportan y no se duplican.

## Pendiente del usuario
- Subir el archivo CSV exportado del otro proyecto.
