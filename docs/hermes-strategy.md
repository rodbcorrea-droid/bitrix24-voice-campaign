# Estratégia de Entrega — Hermes Agent

## Princípio: Build Here, Run There

```
┌─────────────────────────┐              ┌─────────────────────────┐
│   DESENVOLVIMENTO       │              │   OPERAÇÃO              │
│   (Claude Code)         │              │   (Hermes Agent)        │
│                         │    GitHub    │                         │
│   • Código completo     │ ───────────► │   • git clone           │
│   • Testes unitários    │              │   • npm install         │
│   • Mocks e simulações  │              │   • cp .env.example     │
│   • Documentação        │              │   • Configurar .env     │
│   • Scripts de setup    │              │   • npm run setup       │
│   • CI/CD workflows     │              │   • npm run smoke       │
│                         │              │   • npm start           │
└─────────────────────────┘              └─────────────────────────┘
```

## Contrato entre Ambientes

### 1. Configuração
- **Toda configuração** via variáveis de ambiente (`.env`)
- **Nunca** valores hardcoded no código
- `.env.example` documenta TODAS as variáveis necessárias
- Defaults sensíveis quando possível (ex: `PORT=3000`)

### 2. Acesso ao Bitrix24
- **Modo REST:** Via `BITRIX24_WEBHOOK_URL` no .env
- **Modo MCP:** Via ferramentas MCP do Hermes (auto-detectado)
- `mcp-capability-checker` determina o modo automaticamente
- Código funciona em ambos os modos

### 3. Telefonia
- **Configurável:** `TELEPHONY_PROVIDER=bitrix24|twilio|sip`
- Cada provedor com suas variáveis de configuração
- Capability checker valida disponibilidade na inicialização

### 4. Voice AI
- **STT:** `STT_PROVIDER=deepgram|whisper` + `STT_API_KEY`
- **LLM:** `LLM_PROVIDER=anthropic|openai` + `LLM_API_KEY`
- **TTS:** `TTS_PROVIDER=elevenlabs|playht` + `TTS_API_KEY`

### 5. Persistência
- SQLite local em `data/campaign.db`
- Criado automaticamente na primeira execução
- Backup manual possível (copiar arquivo .db)
- Dados CRM sempre no Bitrix24 (fonte de verdade)

## Fluxo de Instalação pelo Hermes

### Pré-requisitos
1. Node.js 20+ instalado
2. Acesso ao Bitrix24 (webhook URL ou MCP)
3. Chaves de API para telefonia e voz (para Modo A)

### Passos
```bash
# 1. Clone
git clone <repo-url> bitrix24-voice-campaign
cd bitrix24-voice-campaign

# 2. Instale dependências
npm install

# 3. Configure
cp .env.example .env
# Editar .env com credenciais

# 4. Setup (cria DB, valida config, testa conexões)
npm run setup

# 5. Smoke test (testa cada componente)
npm run smoke

# 6. Inicie
npm start
```

### Validação pós-instalação
- [ ] `npm run setup` completa sem erros
- [ ] `npm run smoke` passa em todos os checks
- [ ] Dashboard acessível em `http://localhost:PORT`
- [ ] Bitrix24 connection test passa
- [ ] Telefony connection test passa (se configurado)
- [ ] Voice AI connection test passa (se configurado)

## Capacidades MCP do Hermes

O Hermes Agent já possui acesso ao Bitrix24 via MCP. O sistema detecta
e usa isso automaticamente:

```javascript
// mcp-capability-checker detecta:
const capabilities = {
  bitrix24_mcp: true/false,    // Hermes MCP disponível
  bitrix24_rest: true/false,   // Webhook URL configurado
  telephony_native: true/false, // Bitrix24 telefonia disponível
  telephony_external: true/false, // Twilio/SIP configurado
  voice_ai: true/false,        // STT/LLM/TTS configurado
};
```

## Riscos e Contingências

| Risco | Probabilidade | Impacto | Contingência |
|---|---|---|---|
| MCP tools insuficientes | Média | Alto | Fallback para REST API |
| Bitrix24 rate limit | Alta | Médio | Rate limiter + batch |
| Latência de voz alta | Média | Alto | Otimizar provedores, cache |
| Falha provedor telefônico | Baixa | Alto | Multi-provider fallback |
| Credenciais inválidas | Baixa | Crítico | Setup validation + erros claros |

## Limitações Conhecidas

1. **Sem acesso ao Hermes durante desenvolvimento** — validação MCP será feita pelo próprio Hermes pós-clone
2. **Provedores externos requerem conta** — Twilio, Deepgram, ElevenLabs precisam de cadastro e API keys
3. **Bitrix24 plan matters** — telefonia Voximplant disponível em planos Professional+
4. **Latência de voz depende de rede** — não controlável, apenas otimizável
