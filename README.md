# Bitrix24 Voice Campaign

Sistema de ligações telefônicas outbound em massa com agente de voz IA, integrado ao Bitrix24 CRM.

## O Que Faz

- **Segmenta contatos** do Bitrix24 por filtros CRM (estágio, tags, campos custom)
- **Discagem automática** em massa com rate limiting e retentativas
- **Agente de voz com IA** conduz conversas (STT → LLM → TTS)
- **Registra tudo no CRM** — chamada, transcrição, resumo, classificação, follow-up
- **Compliance automático** — horário permitido, opt-out, LGPD
- **Handoff para humano** quando a IA identifica necessidade

## Arquitetura

```
Campaign Orchestrator → Dialing Engine → Telephony Bridge → Voice Agent
         ↓                    ↓                ↓                ↓
   Bitrix24 Connector    Compliance      Twilio/SIP      STT/LLM/TTS
         ↓               Guard
    CRM Writeback           ↓
                       Audit Trail
```

**14 módulos**, cada um com responsabilidade única e testável.

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20+ |
| HTTP | Fastify |
| Banco | SQLite (better-sqlite3) |
| Telefonia | Twilio / Bitrix24 Voximplant / SIP |
| STT | Deepgram Nova-2 |
| LLM | Claude Haiku / GPT-4o-mini |
| TTS | ElevenLabs |
| Testes | Vitest |

## Modos de Operação

| Modo | Requisitos | Capacidades |
|---|---|---|
| **Full** | Twilio + STT + LLM + TTS | Conversa completa com IA |
| **Basic** | Bitrix24 REST API | CRM only, sem voz IA |
| **Limited** | Nenhum | Mock/simulação para dev |

## Início Rápido

```bash
# Clone
git clone <repo-url> && cd bitrix24-voice-campaign

# Instale
npm install

# Configure
cp .env.example .env   # editar com suas credenciais

# Setup
npm run setup

# Smoke test
npm run smoke

# Execute
npm start
```

## Estrutura

```
src/
├── core/                          # Infraestrutura
│   ├── config.js                  # Carregamento de config
│   ├── database.js                # SQLite manager
│   ├── logger.js                  # Pino logger
│   └── server.js                  # Fastify HTTP server
├── modules/
│   ├── campaign-orchestrator/     # Orquestração de campanhas
│   ├── dialing-engine/            # Fila e execução de chamadas
│   │   └── telephony-bridge.js    # Abstração de telefonia
│   ├── bitrix24-connector/        # Integração Bitrix24 REST/MCP
│   ├── mcp-capability-checker/    # Detecção de capacidades
│   ├── voice-agent-runtime/       # Motor de voz IA
│   │   └── providers.js           # STT/LLM/TTS providers
│   ├── conversation-state-manager/# Estado da conversa
│   ├── crm-writeback-service/     # Escrita no CRM
│   ├── call-event-processor/      # Processamento de eventos
│   ├── transcript-summarizer/     # Resumo pós-chamada
│   ├── compliance-guard/          # Conformidade
│   └── admin-ops-dashboard/       # Dashboard operacional
config/
│   └── prompts/                   # System prompts do agente
scripts/
│   ├── setup.js                   # Setup automatizado
│   ├── smoke.js                   # Smoke tests
│   └── build-check.js             # Validação de build
tests/
│   └── unit/                      # Testes unitários
docs/
│   ├── architecture.md            # Arquitetura detalhada
│   ├── PRD.md                     # Requisitos
│   ├── bitrix24-capabilities.md   # Capacidades nativas vs externas
│   └── hermes-strategy.md         # Estratégia de entrega
```

## Documentação

- [Arquitetura](docs/architecture.md) — Diagramas e decisões técnicas
- [PRD](docs/PRD.md) — Requisitos funcionais e não-funcionais
- [Capacidades Bitrix24](docs/bitrix24-capabilities.md) — Nativas vs externas
- [Estratégia Hermes](docs/hermes-strategy.md) — Build Here, Run There
- [Instalação](INSTALL.md) — Guia completo de instalação
- [Deploy](DEPLOY.md) — Guia de deploy
- [Operações](OPERATIONS.md) — Guia operacional
- [Integração Bitrix24](BITRIX24_INTEGRATION.md) — Detalhes da integração
- [Troubleshooting](TROUBLESHOOTING.md) — Problemas comuns

## Comandos

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o sistema |
| `npm run dev` | Inicia com hot-reload |
| `npm test` | Executa testes |
| `npm run smoke` | Smoke tests end-to-end |
| `npm run setup` | Setup inicial |
| `npm run build:check` | Valida prontidão |

## Licença

MIT
