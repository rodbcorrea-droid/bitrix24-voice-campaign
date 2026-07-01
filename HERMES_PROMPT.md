# Prompt para Hermes Agent — Bitrix24 Voice Campaign

Copie e cole o conteúdo abaixo como instrução para o Hermes Agent.

---

## INSTRUÇÃO PARA HERMES AGENT

Você é o operador do sistema **Bitrix24 Voice Campaign**. Sua tarefa é clonar, instalar, configurar e operar o sistema de ligações telefônicas em massa com agente de voz IA integrado ao Bitrix24.

### PASSO 1 — Clone e Instalação

```bash
git clone https://github.com/rodbcorrea-droid/bitrix24-voice-campaign.git
cd bitrix24-voice-campaign
npm install
```

### PASSO 2 — Configuração

Copie o arquivo de configuração:
```bash
cp .env.example .env
```

Edite `.env` com as credenciais do Bitrix24. As variáveis obrigatórias são:

```
BITRIX24_WEBHOOK_URL=<sua URL de webhook do Bitrix24>
```

Para operação com voz IA (opcional, mas recomendado):
```
TELEPHONY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<seu SID>
TWILIO_AUTH_TOKEN=<seu token>
TWILIO_PHONE_NUMBER=<seu número Twilio>

STT_PROVIDER=deepgram
STT_API_KEY=<sua chave Deepgram>

LLM_PROVIDER=anthropic
LLM_API_KEY=<sua chave Anthropic>

TTS_PROVIDER=elevenlabs
TTS_API_KEY=<sua chave ElevenLabs>
```

### PASSO 3 — Setup e Validação

```bash
npm run setup
```

Este comando:
- Valida todas as configurações
- Cria o banco de dados SQLite
- Testa conexões com Bitrix24 e provedores
- Reporta o modo de operação disponível

Em seguida, execute os smoke tests:
```bash
npm run smoke
```

Todos os testes devem passar. Se algum falhar, verifique as credenciais no `.env`.

### PASSO 4 — Iniciar o Sistema

```bash
npm start
```

O sistema estará disponível em `http://localhost:3000`.

### PASSO 5 — Criar e Executar uma Campanha

Para criar uma campanha via API:

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome da Campanha",
    "segmentFilter": {
      "entityType": "contact",
      "filter": {}
    }
  }'
```

O `segmentFilter.filter` aceita qualquer filtro válido do Bitrix24 CRM:
- `{ "ASSIGNED_BY_ID": 1 }` — contatos de um responsável específico
- `{ "SOURCE_ID": "WEB" }` — contatos por origem
- `{ "STATUS_ID": "NEW" }` — leads por estágio

Para ativar a campanha:
```bash
curl -X POST http://localhost:3000/api/campaigns/{id}/activate
```

Para verificar status:
```bash
curl http://localhost:3000/api/status
curl http://localhost:3000/api/campaigns
curl http://localhost:3000/api/campaigns/{id}/calls
```

### MODOS DE OPERAÇÃO

O sistema detecta automaticamente o modo disponível:

| Modo | O que faz |
|---|---|
| **Full** | Chamadas com voz IA (Twilio + Deepgram + Claude + ElevenLabs) |
| **Basic** | Apenas CRM — segmenta contatos, registra atividades, sem telefonia |
| **Limited** | Mock — para testes sem credenciais reais |

### COMPLIANCE

O sistema respeita automaticamente:
- Horário permitido para ligações (configurável via `COMPLIANCE_DND_HOURS_START/END`)
- Lista de opt-out
- Máximo de tentativas por contato
- LGPD (consent flag)

Para registrar opt-out de um contato:
```bash
curl -X POST http://localhost:3000/api/compliance/optout \
  -H "Content-Type: application/json" \
  -d '{ "contactId": "ID_DO_CONTATO", "reason": "contact_request" }'
```

### MONITORAMENTO

- Health check: `GET /health`
- Status geral: `GET /api/status`
- Campanhas: `GET /api/campaigns`
- Dashboard: `GET /api/dashboard/overview`
- Auditoria: `GET /api/dashboard/audit`

### TROUBLESHOOTING

Se `npm run setup` falhar:
- Verifique se `.env` existe e tem `BITRIX24_WEBHOOK_URL`
- Verifique se o webhook do Bitrix24 está ativo

Se chamadas não iniciarem:
- Verifique se a campanha está com status `active`
- Verifique se não está em horário de DND
- Verifique logs: `grep "dialing-engine" <logfile>`

Se o CRM writeback falhar:
- Verifique permissões do webhook (precisa de CRM + Telephony)
- O sistema faz retry automático em caso de rate limit

### ARQUITETURA

14 módulos independentes:
- `campaign-orchestrator` — orquestra campanhas
- `dialing-engine` — fila e execução de chamadas
- `bitrix24-connector` — integração REST + MCP
- `voice-agent-runtime` — motor de voz IA (STT/LLM/TTS)
- `compliance-guard` — conformidade e proteção
- `crm-writeback-service` — escrita no CRM
- `transcript-summarizer` — resumo pós-chamada
- `admin-ops-dashboard` — monitoramento

### DOCUMENTAÇÃO COMPLETA

- `README.md` — visão geral
- `INSTALL.md` — instalação detalhada
- `DEPLOY.md` — deploy em produção
- `OPERATIONS.md` — guia operacional
- `BITRIX24_INTEGRATION.md` — detalhes da integração Bitrix24
- `TROUBLESHOOTING.md` — problemas comuns
- `docs/architecture.md` — arquitetura técnica
- `docs/PRD.md` — requisitos funcionais

### COMANDOS RÁPIDOS

| Comando | Descrição |
|---|---|
| `npm start` | Iniciar sistema |
| `npm run dev` | Iniciar com hot-reload |
| `npm test` | Executar testes |
| `npm run smoke` | Smoke tests |
| `npm run setup` | Setup inicial |

---

**Pronto.** Após executar estes passos, o sistema estará operacional e pronto para executar campanhas de ligações em massa com agente de voz IA integrado ao Bitrix24 CRM.
