UPDATE public.automation_rules
SET enabled = false,
    status = 'PENDING_CONFIG',
    last_error = 'Webhook apuntaba a un host de n8n inexistente (404). Reconfigurar en Automations.'
WHERE n8n_webhook_url LIKE 'https://melanoincorporated.app.n8n.cloud/%';