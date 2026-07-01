# Troubleshooting

## Problemas de Instalação

### `npm install` falha

**Erro:** `npm ERR! engine Unsupported`
**Solução:** Atualize Node.js para versão 20+
```bash
node --version  # deve ser v20+
```

**Erro:** `npm ERR! peer dep`
**Solução:** Limpar cache e reinstalar
```bash
rm -rf node_modules package-lock.json
npm install
```

### `npm run setup` falha

**Erro:** `Configuration errors: BITRIX24_WEBHOOK_URL`
**Solução:** Copiar .env.example para .env e configurar
```bash
cp .env.example .env
# Editar .env com suas credenciais
```

**Erro:** `Database not initialized`
**Solução:** Verificar permissão de escrita no diretório data/
```bash
mkdir -p data
chmod 755 data
```

## Problemas de Conexão

### Bitrix24 não conecta

**Teste manual:**
```bash
curl "https://seu-dominio.bitrix24.com/rest/1/seu-token/crm.contact.list?SELECT[]=ID&start=0"
```

**Se retornar erro:**
1. Verificar se a URL está correta
2. Verificar se o webhook não foi revogado
3. Verificar permissões do webhook

**Erro:** `ECONNREFUSED`
**Solução:** Verificar se o domínio Bitrix24 está acessível
```bash
nslookup seu-dominio.bitrix24.com
```

### Twilio não conecta

**Teste:**
```bash
npm run smoke  # inclui teste de telefonia
```

**Erro:** `Authentication Error`
**Solução:** Verificar Account SID e Auth Token no .env

## Problemas de Chamadas

### Chamadas não são iniciadas

1. Verificar se campanha está ativa:
   ```bash
   curl http://localhost:3000/api/campaigns
   ```

2. Verificar compliance (DND hours):
   ```bash
   # Verificar horário atual vs configuração
   grep DND .env
   ```

3. Verificar logs do dialing-engine:
   ```bash
   pm2 logs | grep dialing-engine
   ```

### Chamadas falham imediatamente

**Possíveis causas:**
- Número de telefone inválido (formato E.164: +5511999999999)
- Saldo insuficiente no provedor de telefonia
- Provedor bloqueou a chamada

**Debug:**
```bash
pm2 logs | grep "Call failed"
```

### Voz IA não funciona

**Checklist:**
- [ ] STT API key configurada
- [ ] LLM API key configurada
- [ ] TTS API key configurada
- [ ] Provedor de telefonia suporta áudio bidirecional
- [ ] Latência < 2s (testar com `npm run smoke`)

## Problemas de CRM

### Writeback não registra no Bitrix24

**Debug:**
```bash
pm2 logs | grep "CRM writeback"
```

**Erro:** `PERMISSION_DENIED`
**Solução:** Verificar permissões do webhook (precisa de CRM + Telephony)

**Erro:** `QUERY_LIMIT_EXCEEDED`
**Solução:** Sistema faz retry automático. Se persistir, reduzir taxa de chamadas.

### Transcrição não aparece no Bitrix24

**Verificar:**
1. Chamada foi registrada (tem CALL_ID?)
2. Transcrição não está vazia
3. Método `telephony.call.attachTranscription` está disponível no seu plano

## Problemas de Performance

### Sistema lento com muitas chamadas

**Soluções:**
1. Reduzir `CAMPAIGN_DEFAULT_MAX_CONCURRENT`
2. Aumentar intervalo entre chamadas (`CAMPAIGN_DEFAULT_RATE_PER_MINUTE`)
3. Verificar recursos do servidor (CPU, RAM)
4. Verificar latência com Bitrix24

### Banco de dados crescendo muito

**Manutenção periódica:**
```sql
-- Limpar chamadas antigas (mais de 90 dias)
DELETE FROM call_tasks
WHERE status = 'completed'
  AND created_at < datetime('now', '-90 days');

VACUUM;
```

## Logs e Debug

### Ativar debug logging

```bash
# No .env
LOG_LEVEL=debug
```

### Logs por módulo

```bash
# Campaign orchestrator
pm2 logs | grep campaign-orchestrator

# Dialing engine
pm2 logs | grep dialing-engine

# Voice agent
pm2 logs | grep voice-agent

# Compliance
pm2 logs | grep compliance-guard
```

### Logs estruturados (JSON)

```bash
# Formatar JSON logs
pm2 logs --json | jq '.module'
```

## Contato

Para issues não cobertos aqui:
1. Verificar logs detalhados
2. Abrir issue no GitHub com logs e configuração (sem credenciais)
