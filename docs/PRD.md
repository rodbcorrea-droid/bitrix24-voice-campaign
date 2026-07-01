# PRD Técnico-Funcional — Bitrix24 Voice Campaign

## 1. Visão Executiva

Sistema automatizado de ligações telefônicas outbound em massa, integrado ao
Bitrix24 CRM, com agente de voz conduzido por Inteligência Artificial.

**Objetivo:** Permitir que equipes comerciais executem campanhas de chamadas
em massa com qualidade de atendimento individual, usando IA para conduzir
conversas, registrar resultados no CRM e escalar operações.

## 2. Stakeholders

| Papel | Responsabilidade |
|---|---|
| Operador Comercial | Define campanhas, monitora resultados |
| Gerente de Vendas | Aprova campanhas, analisa métricas |
| Equipe de TI | Instala, configura, mantém sistema |
| Hermes Agent | Executa operação via MCP |
| Desenvolvedor (Claude Code) | Constrói e entrega o sistema |

## 3. Personas e Casos de Uso

### 3.1 Operador Comercial
**Objetivo:** Executar campanha de prospecção para 500 contatos.
- Seleciona segmento de contatos no Bitrix24
- Define script de atendimento e objetivos
- Inicia campanha e monitora progresso
- Acompanha resultados em dashboard

### 3.2 Agente de Vendas (Humano)
**Objetivo:** Receber handoff de chamadas que precisam de atenção humana.
- Recebe notificação quando IA identifica lead qualificado
- Acessa transcrição e resumo da conversa
- Continua atendimento com contexto completo

### 3.3 Hermes Agent
**Objetivo:** Operar o sistema autonomamente.
- Clona repositório e instala
- Configura via .env
- Executa campanhas conforme programação
- Reporta resultados via MCP

## 4. Funcionalidades por Prioridade

### P0 — Core (MVP)
| ID | Funcionalidade | Descrição |
|---|---|---|
| F-001 | Segmentação de Contatos | Filtrar contatos/leads do Bitrix24 por campos, status, tags |
| F-002 | Fila de Chamadas | Gerenciar fila prioritária com rate limiting |
| F-003 | Discagem Automática | Iniciar chamadas outbound via telefonia |
| F-004 | Agente de Voz IA | Conduzir conversa com STT → LLM → TTS |
| F-005 | Registro no CRM | Registrar chamada, resultado, transcrição no Bitrix24 |
| F-006 | Compliance Básico | Horário permitido, opt-out, limite de tentativas |

### P1 — Importante
| ID | Funcionalidade | Descrição |
|---|---|---|
| F-007 | Transcrição e Resumo | Gerar transcrição completa e resumo estruturado |
| F-008 | Classificação de Resultado | Categorizar chamada (interested, callback, not-interested) |
| F-009 | Handoff para Humano | Transferir chamada quando IA identifica necessidade |
| F-010 | Retentativas Inteligentes | Retry com backoff baseado no motivo da falha |
| F-011 | Métricas em Tempo Real | Dashboard com KPIs de campanha |

### P2 — Desejável
| ID | Funcionalidade | Descrição |
|---|---|---|
| F-012 | Multi-provedor Telefônico | Fallback entre Twilio, SIP, Bitrix24 native |
| F-013 | Scripts Dinâmicos | Scripts de atendimento baseados em contexto do CRM |
| F-014 | Análise de Sentimento | Detectar sentimento do interlocutor em tempo real |
| F-015 | A/B Testing de Scripts | Testar variações de script automaticamente |
| F-016 | Relatórios Gerenciais | Relatórios exportáveis com análises detalhadas |

## 5. Requisitos Não-Funcionais

| Requisito | Especificação |
|---|---|
| Latência de voz | < 2s total (STT + LLM + TTS) |
| Concorrência | Até 50 chamadas simultâneas |
| Disponibilidade | 99.5% durante horário comercial |
| Compliance | LGPD, horário permitido, opt-out |
| Auditabilidade | Log completo de cada chamada |
| Instalabilidade | Clone → install → configure → run |
| Portabilidade | Node.js 20+, SQLite, sem DB externo |
| Segredos | Nunca versionados, sempre via .env |

## 6. Modelo de Dados

### 6.1 Campaign
```json
{
  "id": "uuid",
  "name": "Prospecção Q3 2026",
  "status": "draft|active|paused|completed",
  "segment_filter": { "entityType": "contact", "filter": { "..." : "..." } },
  "script_id": "uuid",
  "schedule": { "start": "09:00", "end": "18:00", "timezone": "America/Sao_Paulo" },
  "limits": { "maxConcurrent": 10, "maxPerContact": 3, "ratePerMinute": 5 },
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 6.2 CallTask
```json
{
  "id": "uuid",
  "campaign_id": "uuid",
  "contact_id": "number",
  "phone": "+5511999999999",
  "status": "pending|dialing|in-progress|completed|failed|skipped",
  "priority": 1,
  "attempts": 0,
  "max_attempts": 3,
  "last_attempt_at": "ISO8601",
  "next_retry_at": "ISO8601",
  "result": { "category": "interested|callback|not-interested|no-answer|busy|failed", "summary": "...", "nextSteps": "..." },
  "crm_activity_id": "number",
  "transcript": "...",
  "created_at": "ISO8601"
}
```

### 6.3 ConversationState
```json
{
  "call_task_id": "uuid",
  "turns": [
    { "role": "agent", "text": "...", "timestamp": "ISO8601" },
    { "role": "contact", "text": "...", "timestamp": "ISO8601" }
  ],
  "slots": {
    "interest_level": "high|medium|low",
    "objection": "...",
    "callback_date": "...",
    "decision_maker": true
  },
  "current_step": "greeting|qualifying|presenting|objection-handling|closing|handoff"
}
```

## 7. Integrações

### 7.1 Bitrix24 REST API
- `crm.contact.list` / `crm.lead.list` — segmentação
- `telephony.externalCall.register` — registrar chamada
- `telephony.externalCall.finish` — finalizar registro
- `telephony.call.attachTranscription` — anexar transcrição
- `crm.activity.add` — criar atividade na timeline
- `crm.contact.update` / `crm.lead.update` — atualizar campos

### 7.2 Bitrix24 MCP (Hermes Agent)
- Operações CRM via ferramentas MCP
- Leitura e escrita de entidades
- Acesso a telefonia conforme disponível

### 7.3 Provedor de Telefonia (externo)
- Twilio: Programmable Voice, Media Streams (WebSocket)
- Alternativa: SIP via Telnyx, Vonage, ou Asterisk

### 7.4 Voice AI (externo)
- Deepgram: STT streaming (Nova-2)
- Claude/GPT: LLM para dialog management
- ElevenLabs: TTS streaming

## 8. Aceite e Critérios

### 8.1 Critérios de Aceite — MVP
- [ ] Segmenta contatos do Bitrix24 via API
- [ ] Enfileira e discagem chamadas automaticamente
- [ ] Agente IA conduz conversa básica (greeting → qualifying → closing)
- [ ] Registra chamada e resultado no Bitrix24
- [ ] Respeita horário e opt-out
- [ ] Instalável via clone + npm install + .env
- [ ] Testes passando (unit + integration)
- [ ] Documentação completa

### 8.2 Critérios de Aceite — Hermes Ready
- [ ] Clona sem erros
- [ ] Instala sem dependência oculta
- [ ] .env.example é suficiente para configurar
- [ ] Build funciona
- [ ] Smoke test funciona
- [ ] Documentação permite terceiro instalar
- [ ] Não depende do Claude para operar
