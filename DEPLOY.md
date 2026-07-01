# Guia de Deploy

## Ambientes Suportados

| Ambiente | Status | Observação |
|---|---|---|
| Local (dev) | ✅ | `npm run dev` |
| Servidor Linux | ✅ | Produção recomendada |
| Docker | ✅ | Dockerfile incluso |
| Hermes Agent | ✅ | Modo MCP automático |

## Deploy Local (Produção)

```bash
# Build
npm install --production

# Configurar variáveis de ambiente
export NODE_ENV=production
export PORT=3000
export BITRIX24_WEBHOOK_URL=...

# Iniciar
npm start
```

## Deploy com PM2 (Recomendado)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar
pm2 start src/index.js --name voice-campaign

# Monitorar
pm2 monit

# Logs
pm2 logs voice-campaign

# Auto-restart no boot
pm2 startup
pm2 save
```

## Deploy com Docker

### Dockerfile
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Build e Run
```bash
docker build -t voice-campaign .
docker run -d \
  --name voice-campaign \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  voice-campaign
```

### Docker Compose
```yaml
version: '3.8'
services:
  voice-campaign:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

## Deploy no Hermes Agent

O Hermes Agent deve:

1. Clonar o repositório
2. Executar `npm install`
3. Copiar `.env.example` para `.env`
4. Configurar credenciais no `.env`
5. Executar `npm run setup`
6. Executar `npm run smoke`
7. Iniciar com `npm start`

O sistema detecta automaticamente o ambiente MCP e ajusta o comportamento.

## Variáveis de Ambiente Críticas

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BITRIX24_WEBHOOK_URL` | Sim | URL do webhook Bitrix24 |
| `TELEPHONY_PROVIDER` | Não | `twilio`, `bitrix24`, `sip` |
| `TWILIO_ACCOUNT_SID` | Se Twilio | Account SID |
| `TWILIO_AUTH_TOKEN` | Se Twilio | Auth Token |
| `STT_API_KEY` | Se voz IA | Chave Deepgram |
| `LLM_API_KEY` | Se voz IA | Chave Anthropic/OpenAI |
| `TTS_API_KEY` | Se voz IA | Chave ElevenLabs |

## Health Check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-07-01T12:00:00.000Z",
  "capabilities": { ... }
}
```

## Rollback

### Com Git
```bash
# Listar versões
git log --oneline -10

# Voltar para versão anterior
git checkout <commit-hash>
npm install
npm start
```

### Com PM2
```bash
# Voltar para versão anterior
git checkout HEAD~1
npm install
pm2 restart voice-campaign
```

### Backup do Banco
```bash
# Antes de atualizar
cp data/campaign.db data/campaign.db.backup

# Restaurar
cp data/campaign.db.backup data/campaign.db
```
