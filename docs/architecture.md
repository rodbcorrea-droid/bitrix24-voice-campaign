# Arquitetura do Sistema — Bitrix24 Voice Campaign

## 1. Visão Geral

Sistema de ligações telefônicas outbound em massa integrado ao Bitrix24 CRM,
com agente de voz conduzido por IA, operação final via Hermes Agent.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE OPERAÇÃO                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Admin Ops    │  │ Hermes Agent │  │ Monitoring / Alerts      │  │
│  │ Dashboard    │  │ (runtime)    │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
├─────────┼─────────────────┼────────────────────────┼────────────────┤
│         │      CAMADA DE ORQUESTRAÇÃO              │                │
│  ┌──────▼─────────────────▼────────────────────────▼─────────────┐  │
│  │              campaign-orchestrator                             │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐  │  │
│  │  │ Segmentação  │ │ Fila/Estado  │ │ Compliance Guard      │  │  │
│  │  │ de Contatos  │ │ Manager      │ │ (horário, LGPD, DND) │  │  │
│  │  └─────────────┘ └──────────────┘ └───────────────────────┘  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
├─────────────────────────────┼───────────────────────────────────────┤
│                             │      CAMADA DE ENGENHARIA DE CHAMADA  │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │                 dialing-engine                                 │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ Call Queue    │ │ Rate Limiter │ │ Retry Manager        │  │  │
│  │  │ (priority)    │ │              │ │ (no-answer, busy)    │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
├─────────────────────────────┼───────────────────────────────────────┤
│                    CAMADA DE TELEFONIA                              │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │              telephony-bridge                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐  │  │
│  │  │ Bitrix24 Native  │  │ External Provider (Twilio/SIP)   │  │  │
│  │  │ Voximplant API   │  │ via REST API                     │  │  │
│  │  └────────┬─────────┘  └────────────┬─────────────────────┘  │  │
│  │           │     capability-checker  │                         │  │
│  │           └──────────┬──────────────┘                         │  │
│  └──────────────────────┼───────────────────────────────────────┘  │
│                         │                                           │
├─────────────────────────┼───────────────────────────────────────────┤
│                    CAMADA DE VOZ IA                                 │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │              voice-agent-runtime                               │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ STT Engine    │ │ LLM Dialog   │ │ TTS Engine           │  │  │
│  │  │ (Whisper/etc) │ │ Manager      │ │ (ElevenLabs/etc)     │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐                           │  │
│  │  │ Conversation  │ │ Intent       │                           │  │
│  │  │ State Manager │ │ Classifier   │                           │  │
│  │  └──────────────┘ └──────────────┘                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    CAMADA CRM                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  bitrix24-connector                                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ REST Client   │ │ MCP Adapter  │ │ Entity Mapper        │  │  │
│  │  │ (direct API)  │ │ (Hermes)     │ │ (contacts↔leads)     │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐                           │  │
│  │  │ CRM Writeback │ │ Call Event   │                           │  │
│  │  │ Service       │ │ Processor    │                           │  │
│  │  └──────────────┘ └──────────────┘                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    CAMADA DE DADOS                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────────────────┐  │  │
│  │  │ SQLite   │ │ Call Logs    │ │ Audit Trail              │  │  │
│  │  │ (state)  │ │ (transcripts)│ │ (compliance)             │  │  │
│  │  └──────────┘ └──────────────┘ └──────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Módulos e Responsabilidades

### 2.1 campaign-orchestrator
**Responsabilidade:** Coordenação central de campanhas.
- Recebe definição de campanha (segmento, script, horários, limites)
- Aciona segmentação de contatos via bitrix24-connector
- Gerencia ciclo de vida da campanha (draft → active → paused → completed)
- Orquestra chamadas via dialing-engine

### 2.2 dialing-engine
**Responsabilidade:** Fila e execução de chamadas.
- Mantém fila prioritária de chamadas pendentes
- Controla taxa de discagem (rate limiting)
- Gerencia retentativas (no-answer, busy, failed)
- Distribui chamadas entre canais disponíveis

### 2.3 bitrix24-connector
**Responsabilidade:** Comunicação com Bitrix24.
- Cliente REST wrapper com retry, rate limiting, error handling
- Adapter MCP para operação via Hermes Agent
- Mapper de entidades CRM (contacts, leads, deals, activities)

### 2.4 mcp-capability-checker
**Responsabilidade:** Verificação de capacidades disponíveis.
- Detecta se está rodando via Hermes Agent (MCP disponível)
- Verifica quais endpoints Bitrix24 estão acessíveis
- Testa capacidades de telefonia disponíveis
- Retorna mapa de capacidades para decisões de routing

### 2.5 voice-agent-runtime
**Responsabilidade:** Motor do agente de voz com IA.
- Gerencia sessão de áudio bidirecional
- Integra STT (Speech-to-Text) para transcrição em tempo real
- Integra LLM para geração de respostas contextuais
- Integra TTS (Text-to-Speech) para síntese de voz
- Gerencia estado da conversa e intents

### 2.6 conversation-state-manager
**Responsabilidade:** Estado e contexto da conversa.
- Mantém histórico da conversa em andamento
- Gerencia slots de informação coletados
- Controla fluxo do script de atendimento
- Detecta momentos de handoff para humano

### 2.7 crm-writeback-service
**Responsabilidade:** Escrita de resultados no CRM.
- Registra atividade de chamada no contato/lead
- Atualiza campos customizados com resultado
- Cria follow-up tasks quando necessário
- Anexa transcrição e resumo à timeline

### 2.8 call-event-processor
**Responsabilidade:** Processamento de eventos de chamada.
- Escuta eventos de telefonia (init, start, end, fail)
- Enriquece eventos com dados do CRM
- Aciona callbacks e webhooks configurados
- Alimenta métricas e dashboard

### 2.9 transcript-summarizer
**Responsabilidade:** Processamento pós-chamada.
- Gera transcrição final da chamada
- Produz resumo estruturado (objetivo, resultado, próximos passos)
- Classifica a chamada (interest, objection, callback, not-interested)
- Extrai entidades mencionadas (produtos, valores, datas)

### 2.10 compliance-guard
**Responsabilidade:** Conformidade e proteção.
- Verifica horário permitido para ligação (DND hours)
- Respeita lista de opt-out / bloqueio
- Valida consentimento LGPD
- Limita número de tentativas por contato
- Registra evidência de conformidade

### 2.11 qa-loop-runner
**Responsabilidade:** Quality assurance automatizada.
- Executa cenários de teste end-to-end
- Valida fluxo completo: segmentação → chamada → CRM writeback
- Testa cenários de erro e fallback
- Gera relatório de cobertura

### 2.12 admin-ops-dashboard
**Responsabilidade:** Interface operacional.
- Status de campanhas ativas
- Métricas em tempo real (chamadas, conversões, taxas)
- Logs e auditoria
- Controles de pausa/retomada

### 2.13 deployment-bootstrap
**Responsabilidade:** Setup e instalação.
- Scripts de instalação automatizada
- Verificação de dependências
- Configuração inicial do ambiente
- Migração de banco de dados

### 2.14 hermes-install-adapter
**Responsabilidade:** Adaptação para Hermes Agent.
- Configuração específica para ambiente Hermes
- Setup de MCP tools necessários
- Validação de permissões Bitrix24
- Testes de integração pós-instalação

## 3. Decisões de Arquitetura

### 3.1 Telefonia: Híbrido Bitrix24 + Externo

**Decisão:** Suportar dois modos de telefonia:
1. **Bitrix24 Native** — usar `voximplant.callback.start` e `voximplant.infocall.*` quando disponível
2. **External Provider** — Twilio, Telnyx, ou SIP custom para capacidades avançadas

**Justificativa:** O Bitrix24 não oferece dialer preditivo ou campanhas em massa nativamente. Os métodos `voximplant.infocall.*` são limitados a notificações (play audio/read text), não conversas bidirecionais. Para voz com IA, precisamos de acesso ao stream de áudio, que requer provedor externo.

**Fallback:** Se apenas Bitrix24 estiver disponível, usar modo limitado (infocall para notificações + registro manual no CRM).

### 3.2 Voice AI: WebSocket Audio Stream

**Decisão:** Usar WebSocket para streaming de áudio bidirecional entre telefonia e LLM.

**Stack:**
- STT: Deepgram ou Whisper API (baixa latência)
- LLM: Claude Haiku ou GPT-4o-mini (rápido, custo-eficiente)
- TTS: ElevenLabs ou PlayHT (voz natural, baixa latência)

**Justificativa:** Para conversas naturais, latência total (STT + LLM + TTS) deve ser < 2s. Streaming via WebSocket permite processamento em paralelo.

### 3.3 CRM Integration: Dual-Path

**Decisão:** Suportar REST API direta E MCP adapter.

**Modo REST (desenvolvimento/teste):** Conexão direta via webhook URL do Bitrix24.
**Modo MCP (Hermes Agent):** Operação via ferramentas MCP do Hermes.

**Justificativa:** Permite desenvolvimento e teste sem acesso ao Hermes, enquanto aproveita MCP quando disponível.

### 3.4 Persistência: SQLite + Bitrix24

**Decisão:** SQLite local para estado operacional, Bitrix24 como fonte de verdade para CRM.

**Dados locais (SQLite):**
- Estado de campanhas e filas
- Cache de contatos segmentados
- Transcrições temporárias
- Métricas agregadas
- Audit log operacional

**Dados no Bitrix24:**
- Atividades de chamada
- Transcrições finais
- Resultados e classificações
- Tasks de follow-up

### 3.5 Conformidade: Proativo

**Decisão:** Compliance guard como middleware, não como afterthought.

- Verificação ANTES de cada chamada
- Horários permitidos: configurável por região
- Opt-out: lista local + verificação CRM
- LGPD: consent flag obrigatório, retenção limitada
- Rate limiting: máximo X chamadas/minuto, Y tentativas/contato

## 4. Mapa Nativo vs Externo

| Capacidade | Bitrix24 Nativo | Externo Necessário | Observação |
|---|---|---|---|
| Listar contatos/leads | ✅ `crm.contact.list` | — | Filtros nativos suficientes |
| Segmentar por campo | ✅ `crm.item.list` + filter | — | Campos custom suportados |
| Registrar chamada | ✅ `telephony.externalCall.register` | — | API completa |
| Anexar transcrição | ✅ `telephony.call.attachTranscription` | — | — |
| Anexar gravação | ✅ `telephony.externalCall.attachRecord` | — | URL do áudio |
| Iniciar chamada | ⚠️ `voximplant.callback.start` | Twilio/SIP para voz IA | Limitado a callback simples |
| Info call (TTS) | ⚠️ `voximplant.infocall.*` | — | Unidirecional, sem conversa |
| Áudio bidirecional | ❌ | Twilio/SIP + WebSocket | Necessário para voz IA |
| Dialer preditivo | ❌ | dialing-engine próprio | Bitrix24 não oferece |
| Transcrição em tempo real | ❌ | Deepgram/Whisper | STT externo |
| LLM conversacional | ❌ | Claude/GPT API | Voz IA |
| TTS de alta qualidade | ❌ | ElevenLabs/PlayHT | Voz natural |
| Dashboard operacional | ❌ | admin-ops-dashboard próprio | — |
| Compliance LGPD | ❌ | compliance-guard próprio | — |

## 5. Estratégia Hermes/GitHub

### Build Here, Run There

```
DESENVOLVIMENTO (Claude Code)          OPERAÇÃO (Hermes Agent)
┌─────────────────────────┐           ┌─────────────────────────┐
│ • Código completo        │           │ • Clone do repositório   │
│ • Testes unitários       │  GitHub   │ • npm install            │
│ • Mocks e simulações     │ ────────► │ • Configuração .env      │
│ • Documentação           │  (push)   │ • Validação capability   │
│ • Scripts de setup       │           │ • Operação via MCP       │
│ • CI/CD workflows        │           │ • Bitrix24 MCP nativo    │
└─────────────────────────┘           └─────────────────────────┘
```

### Contrato entre ambientes:
1. **Configuração:** Tudo via `.env` + `config/` — nunca hardcoded
2. **Bitrix24 Access:** REST API via webhook OU MCP via Hermes — dual-path
3. **Telefonia:** Configurável — Bitrix24 native, Twilio, ou SIP
4. **Voice AI:** Configurável — provedor de STT/TTS/LLM via .env
5. **Persistência:** SQLite local — portável, sem setup de DB

### Garantias de instalabilidade:
- `npm install` instala tudo
- `npm run setup` configura ambiente
- `npm test` valida integração
- `npm run smoke` testa operação real
- Documentação completa em INSTALL.md

## 6. Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js 20+ | Async I/O, WebSocket nativo, ecossistema rico |
| Framework | Fastify | Performance, schema validation, plugins |
| Telefonia | Twilio SDK / SIP.js | Programável, WebSocket media streams |
| STT | Deepgram Nova-2 | Latência ultra-baixa (~200ms) |
| LLM | Claude Haiku / GPT-4o-mini | Rápido, custo-eficiente para voz |
| TTS | ElevenLabs | Voz natural, streaming, baixa latência |
| Banco | SQLite (better-sqlite3) | Zero-config, portável, performante |
| Testes | Vitest | Rápido, ESM nativo, cobertura integrada |
| Linting | ESLint + Prettier | Consistência de código |
| Docs | Markdown | Universal, versionável |

## 7. Diagrama de Sequência — Chamada End-to-End

```
Campaign    Dialing     Telephony   Voice      Bitrix24
Orchestrator Engine      Bridge     Agent      Connector
    │          │           │          │           │
    │─select──►│           │          │           │
    │          │─check────►│          │           │
    │          │ compliance │          │           │
    │          │           │          │           │
    │          │─dial──────►│          │           │
    │          │           │─call────►│ (telco)   │
    │          │           │          │           │
    │          │           │◄─answer──│           │
    │          │           │─audio───►│           │
    │          │           │          │─STT───────│
    │          │           │          │─LLM───────│
    │          │           │          │─TTS───────│
    │          │           │◄─audio───│           │
    │          │           │          │           │
    │          │           │─hangup───│           │
    │          │           │          │           │
    │          │           │──────────────────────│
    │          │           │  register call       │
    │          │           │──────────────────────│
    │          │           │  attach transcript   │
    │          │           │──────────────────────│
    │          │           │  update CRM entity   │
    │          │           │──────────────────────│
    │          │           │  create follow-up    │
    │          │           │          │           │
    │◄─result──│◄──────────│          │           │
    │          │           │          │           │
    │─next─────►│           │          │           │
```

## 8. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Bitrix24 rate limits | Alto | Rate limiter adaptativo, batch operations |
| Latência de voz IA > 2s | Alto | Streaming STT/TTS, LLM rápido, cache de prompts |
| Provedor telefônico indisponível | Alto | Fallback entre provedores, retry com backoff |
| LGPD/Compliance violação | Crítico | Compliance guard proativo, audit trail completo |
| MCP tools limitados no Hermes | Médio | Dual-path REST/MCP, capability checker |
| Custo de voz IA alto | Médio | Rate limiting, horários otimizados, modelo eficiente |
| Transcrição imprecisa | Médio | Pós-processamento, confidence threshold, revisão humana |
