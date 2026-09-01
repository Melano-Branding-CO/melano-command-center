alter table public.automation_rules
  add column if not exists n8n_webhook_url text,
  add column if not exists n8n_workflow text;

comment on column public.automation_rules.n8n_webhook_url is 'URL del webhook de n8n que ejecuta esta automatización';