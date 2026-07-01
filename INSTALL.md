# Guia de Instalação

## Pré-requisitos

- **Node.js** 20+ ([download](https://nodejs.org/))
- **npm** 10+ (incluído com Node.js)
- **Git** ([download](https://git-scm.com/))
- Conta no **Bitrix24** (plano Professional+ para telefonia)
- (Opcional) Conta **Twilio** para telefonia externa
- (Opcional) Conta **Deepgram** para STT
- (Opcional) Conta **Anthropic/OpenAI** para LLM
- (Opcional) Conta **ElevenLabs** para TTS

## Instalação Passo a Passo

### 1. Clone o Repositório

```bash
git clone <repo-url> bitrix24-voice-campaign
cd bitrix24-voice-campaign
```

### 2. Instale Dependências

```bash
npm install
```

### 3. Configure o Ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

#### Bitrix24 (obrigatório)
```
BITRIX24_WEBHOOK_URL=https://seu-dominio.bitrix24.com/rest/1/seu-token/
```

Para obter o webhook URL:
1. Acesse seu Bitrix24
2. Vá em DevTools → Webhooks → Criar webhook
3. Selecione as permissões necessárias (CRM, Telephony)
4. Copie a URL

#### Telefonia (para voz IA)
```
TELEPHONY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=sua_account_sid
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Voice AI (para voz IA)
```
STT_PROVIDER=deepgram
STT_API_KEY=sua_chave_deepgram
LLM_PROVIDER=anthropic
LLM_API_KEY=sua_chave_anthropic
TTS_PROVIDER=elevenlabs
TTS_API_KEY=sua_chave_elevenlabs
```

### 4. Execute o Setup

```bash
npm run setup
```

Este script:
- Valida a configuração
- Cria o banco de dados
- Testa conexões disponíveis
- Reporta capacidades do sistema

### 5. Execute os Smoke Tests

```bash
npm run smoke
```

Deve mostrar `✅ All smoke tests passed!`

### 6. Inicie o Sistema

```bash
npm start
```

O sistema estará disponível em `http://localhost:3000`

## Instalação pelo Hermes Agent

```bash
# 1. Clone
git clone <repo-url> bitrix24-voice-campaign
cd bitrix24-voice-campaign

# 2. Instale
npm install

# 3. Configure (preencher com credenciais do Bitrix24)
cp .env.example .env
# Editar .env

# 4. Setup
npm run setup

# 5. Smoke
npm run smoke

# 6. Inicie
npm start
```

### Validação Pós-Instalação

- [ ] `npm run setup` completa sem erros
- [ ] `npm run smoke` passa em todos os testes
- [ ] Dashboard acessível em `http://localhost:3000`
- [ ] Endpoint `/health` retorna `status: ok`
- [ ] Bitrix24 connection test passa (se configurado)

## Modo Desenvolvimento (sem credenciais)

Para desenvolver e testar sem acesso ao Bitrix24:

```bash
# O sistema funciona em modo "limited" sem credenciais
npm run setup   # cria DB, valida estrutura
npm run smoke   # testa componentes internos
npm test        # testes unitários
```

## Troubleshooting

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para problemas comuns.
