do $$
declare
  org uuid;
  shared text;
begin
  select id into org from public.organizations order by created_at limit 1;
  if org is null then return; end if;

  shared := E'\n\n## Estado real de MELANO INC (al 31/08/2026) — usar como única fuente de verdad\n'
    || E'Equipo confirmado: Bruno Melano (CEO & Founder, autoridad final para acciones críticas); Paola Soria (CMO / Arquitecta de Crecimiento).\n'
    || E'Meta económica declarada: USD 10.000 mensuales recurrentes.\n'
    || E'Prioridad comercial: LUXIA, empezando por inmobiliarias de Mar del Plata.\n'
    || E'Activo comercial disponible: cohorte interna de ~1.200 leads, todavía pendiente de validación operativa.\n'
    || E'Producto: LUXIA todavía NO superó el Green Gate completo.\n'
    || E'\n### Cifras financieras: PENDIENTE (no informadas, prohibido inventarlas)\n'
    || E'revenue mensual cobrado, MRR contratado, caja disponible, gastos mensuales (burn), runway, clientes activos, clientes pagos recurrentes, ticket promedio: todas PENDIENTE.\n'
    || E'Regla dura: nunca presentes MRR, caja, runway ni clientes como cifras confirmadas. Marcalas PENDIENTE y pedí las 5 cifras faltantes: revenue cobrado últimos 30 días, MRR contratado, caja disponible, gastos mensuales, clientes pagos activos (fuentes: bancos, Mercado Pago/Stripe, contratos, CRM).\n'
    || E'\n### Plan 90 días (objetivo: USD 10.000/mes)\n'
    || E'Días 0–14: LUXIA funcional y defendible — Auth, tenant/RLS, lead real, NBA, acción, outcome y logs.\n'
    || E'Días 15–45: validación comercial con inmobiliarias de Mar del Plata; convertir pilotos en clientes pagos.\n'
    || E'Días 46–90: aprendizaje basado en outcomes, automatizar seguimiento y escalar adquisición.\n'
    || E'\n### Productos reales\n'
    || E'LUXIA (Real Estate Intelligence): centraliza consultas inmobiliarias, las califica y organiza el seguimiento en un flujo trazable. Es la prioridad comercial #1.\n'
    || E'TITAN (Financial Analytics): analítica, monitoreo y automatización financiera, con controles explícitos antes de cualquier ejecución sensible.\n'
    || E'NOTORIUS (Tokenization & RWA): arquitectura para tokenización de activos y smart contracts, separando claramente prototipo, testnet y producción.\n'
    || E'\n### Éxito del tablero\n'
    || E'Un único tablero revenue → MRR → cash → burn → runway → clientes → ticket promedio, actualizado semanalmente.';

  update public.agents
     set context = coalesce(context, '') || shared
   where organization_id = org
     and (context is null or context not like '%Estado real de MELANO INC (al 31/08/2026)%');

  update public.agents
     set context = coalesce(context,'') || E'\n\n## Foco LUXIA\nProducto: LUXIA — Real Estate Intelligence. Centraliza consultas inmobiliarias entrantes, las califica (lead scoring) y organiza el seguimiento en un flujo trazable end-to-end: lead → NBA (next best action) → acción → outcome → log.\nMercado inicial: inmobiliarias de Mar del Plata. Activo: cohorte interna de ~1.200 leads sin validar.\nEstado: pre Green Gate. Días 0–14 = Auth, tenant/RLS, lead real, NBA, acción, outcome y logs funcionando de punta a punta.\nMétrica que importa: pilotos activos, leads procesados con outcome registrado y clientes pagos recurrentes. Nada de vanity metrics.'
   where organization_id = org and code = 'LUXIA';

  update public.agents
     set context = coalesce(context,'') || E'\n\n## Foco TITAN\nProducto: TITAN — Financial Analytics. Analítica, monitoreo y automatización financiera con controles explícitos: toda ejecución sensible (pagos, movimientos, cambios de límites) requiere aprobación humana de Bruno.\nEstado: el tablero financiero de MELANO INC no es verificable todavía. Tu prioridad #1 es cerrar las 5 cifras faltantes (revenue cobrado 30 días, MRR contratado, caja, gastos mensuales, clientes pagos) desde bancos, Mercado Pago/Stripe, contratos y CRM.\nProhibido estimar o proyectar cifras sin fuente. Cada número lleva fuente y fecha.'
   where organization_id = org and code = 'TITAN';

  update public.agents
     set context = coalesce(context,'') || E'\n\n## Foco NOTORIUS\nProducto: NOTORIUS — Tokenization & RWA. Arquitectura para tokenización de activos reales y smart contracts.\nRegla estructural: separar siempre y de forma explícita prototipo, testnet y producción. Ningún entregable puede mezclar entornos ni presentar un prototipo como producción.\nEstado: no es prioridad comercial en los próximos 90 días (la prioridad es LUXIA). Trabajá en avances de bajo costo y sin riesgo regulatorio; cualquier despliegue a producción o interacción con fondos reales requiere aprobación de Bruno.'
   where organization_id = org and code = 'NOTORIUS';

  insert into public.products (organization_id, code, name, description, status, priority, is_demo)
  values
    (org,'LUXIA','LUXIA — Real Estate Intelligence','Centraliza consultas inmobiliarias, las califica y organiza el seguimiento en un flujo trazable: lead → NBA → acción → outcome → log. Mercado inicial: inmobiliarias de Mar del Plata. Pre Green Gate.','BUILDING','P0',false),
    (org,'TITAN','TITAN — Financial Analytics','Analítica, monitoreo y automatización financiera con controles explícitos antes de cualquier ejecución sensible.','BUILDING','P1',false),
    (org,'NOTORIUS','NOTORIUS — Tokenization & RWA','Arquitectura para tokenización de activos y smart contracts, separando prototipo, testnet y producción.','EXPLORING','P2',false)
  on conflict do nothing;

  update public.products p set
    description = v.description, name = v.name, priority = v.priority::public.priority_level, status = v.status, is_demo = false
  from (values
    ('LUXIA','LUXIA — Real Estate Intelligence','Centraliza consultas inmobiliarias, las califica y organiza el seguimiento en un flujo trazable: lead → NBA → acción → outcome → log. Mercado inicial: inmobiliarias de Mar del Plata. Pre Green Gate.','BUILDING','P0'),
    ('TITAN','TITAN — Financial Analytics','Analítica, monitoreo y automatización financiera con controles explícitos antes de cualquier ejecución sensible.','BUILDING','P1'),
    ('NOTORIUS','NOTORIUS — Tokenization & RWA','Arquitectura para tokenización de activos y smart contracts, separando prototipo, testnet y producción.','EXPLORING','P2')
  ) as v(code,name,description,status,priority)
  where p.organization_id = org and p.code = v.code;
end $$;