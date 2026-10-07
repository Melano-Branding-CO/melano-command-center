# Restaurar el Command Center completo

## Problema confirmado
El sitio actual es una sola pantalla (Next.js estático). Se borraron las páginas reales: /auth, /publico, /leads, /approvals, /automations, /admin, la reunión diaria programada y los endpoints /api/health y /api/agents. Hoy esos enlaces dan "no encontrado".

## Qué se hará
1. Recuperar del historial la última versión funcional de la app TanStack Start (antes del cambio a Next.js): rutas, funciones del servidor, integración con la base de datos y migraciones.
2. Quitar la versión Next.js (app/, components/command-center.tsx, next.config.mjs) y volver a las dependencias originales de package.json.
3. Mantener lo hecho después: login con Google y email exigiendo membresía en la organización.
4. Restaurar /api/public/health (estado, latencia, checked_at) y el proxy de agentes leyendo AGENT_WORKER_URL / AGENT_WORKER_TOKEN del lado del servidor.
5. Verificar: build OK, /auth, /publico, /leads (300 leads con prioridad) cargan, endpoints responden, sin errores en consola.

## Detalles técnicos
- Identificar el commit previo a la migración a Next (rango 24377a0..da9e9d0) y restaurar `src/`, `supabase/migrations`, `vite.config.ts`, `package.json`, `tsconfig.json` desde ahí con `git show`/copia de archivos (sin comandos git que cambien estado).
- La base de datos no se modifica: las tablas y los datos siguen intactos.
- Se resolverán los findings "app reemplazada" y "endpoints eliminados" al verificar.
