# Importar Leads CSV a LUXIA CRM

Script TypeScript para importar masivamente leads desde CSV a Supabase tabla `leads`, optimizado para cohortes de CUCICBA.

## Formato CSV

```
**NOMBRE COMPLETO** | email@domain.com | phone: 1150321515 | address: Dirección
```

**Campos:**
- `**NOMBRE**` (requerido): nombre entre asteriscos dobles
- `email` (opcional): dirección de correo
- `phone` (requerido): formato 11XXXXXXXX o internacional
- `address` (opcional): domicilio

**Ejemplo:**
```
**SABAJ, LEONARDO ISAAC** | administracion@sabajpropiedades.com.ar | phone: 1150321515 | address: Av. Directorio 1025 PB
**FIKS, CARLOS ISAAC** | administracion@fiksycia.com | phone: 1144485819 |
```

## Instalación

```bash
npm install @supabase/supabase-js
```

## Uso

### 1. Preparar archivo CSV

Asegúrate que el CSV siga el formato exacto. Ver `data/leads-cucicba-sample.csv`.

### 2. Configurar variables de entorno

```bash
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGc..."
export MELANO_ORG_ID="uuid-de-tu-org"
```

O crear `.env.local`:
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
MELANO_ORG_ID=11111111-1111-4111-b111-111111111111
```

### 3. Ejecutar importación

```bash
# Con archivo
npx tsx scripts/import-leads.ts data/leads-1200.csv

# Con org ID específico
npx tsx scripts/import-leads.ts data/leads-1200.csv 11111111-1111-4111-b111-111111111111

# Con archivo de ejemplo (10 leads)
npx tsx scripts/import-leads.ts data/leads-cucicba-sample.csv
```

## Características

✅ **Deduplicación por email** - Evita leads duplicados  
✅ **Validación de formato** - Parsea correctamente el CSV  
✅ **Batch insert** - Carga 100 leads por lote (optimizado)  
✅ **Reporte detallado** - Muestra éxitos, fallos y errores  
✅ **RLS automático** - Respeta Row Level Security de Supabase  
✅ **Metadata** - Asigna automáticamente:
  - `cohort: LUXIA`
  - `source: CUCICBA`
  - `phase: FASE_0_14`
  - `status: NUEVO`
  - `score: 0`

## Output

```
📊 IMPORT SUMMARY
──────────────────────────────────────
Total:      1200
Success:    1198 ✅
Failed:     2 ❌
Duplicates: 0 ⚠️
──────────────────────────────────────
```

## Troubleshooting

### Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY

```bash
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_KEY="eyJ..."
```

### Error: Missing organization ID

```bash
export MELANO_ORG_ID="uuid"
# O pasar como parámetro
npx tsx scripts/import-leads.ts data/leads.csv uuid
```

### Ciertos leads fallan

Revisa que cumplan el formato:
- Nombre entre `**`
- Email válido
- Phone numérico

Ver detalle en el reporte de errores.

## Validación posterior

Una vez importados, verifica en LUXIA:

```sql
SELECT COUNT(*), status, phase
FROM leads
WHERE source = 'CUCICBA'
GROUP BY status, phase;
```

Esperado:
- 1200 leads
- Todos `status = 'NUEVO'`
- Todos `phase = 'FASE_0_14'`
- Todos `source = 'CUCICBA'`

## API

```typescript
import { parseCSV, importLeads } from "./scripts/import-leads";

// Parsear CSV
const leads = await parseCSV("path/to/file.csv");

// Importar a Supabase
const result = await importLeads("path/to/file.csv", organizationId);
console.log(result); // { total, success, failed, duplicates, errors }
```

---

**Creado por:** Claude Code  
**Rama:** claude/vercel-leads-csv-crm-rywrhi  
**Agente:** LUXIA CRM
