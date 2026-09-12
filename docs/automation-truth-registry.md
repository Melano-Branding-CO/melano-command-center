# Automation Truth Registry

The Command Center automation panel must render only verifiable n8n runtime evidence.

States:
- ACTIVE: workflow exists in n8n, is published, and is not technically blocked.
- BLOCKED: workflow exists but a verified dependency prevents safe production execution.
- PENDING_CONFIG: the intended automation exists as a product/configuration requirement but has no verified published n8n workflow yet.
- PAUSED: workflow exists and is intentionally paused.

GREEN execution requires a terminal recent execution with SUCCESS plus canonical host when a webhook exists.

Canonical n8n host: `melanoinc.app.n8n.cloud`.
