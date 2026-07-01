# Guia de Operações

## Monitoramento

### Endpoints

| Endpoint | Método | Descrição |
|---|---|---|
| `/health` | GET | Health check (status, capabilities) |
| `/api/status` | GET | Métricas de campanhas e chamadas |
| `/api/campaigns` | GET | Lista de campanhas |
| `/api/campaigns/:id` | GET | Detalhes de campanha |
| `/api/campaigns/:id/calls` | GET | Chamadas de uma campanha |

### Logs

Logs são estruturados (JSON em produção, pretty-print em dev).

```bash
# Ver logs em produção (PM2)
pm2 logs voice-campaign

# Filtrar por nível
pm2 logs voice-campaign --lines 100 | grep '"level":"error"'

# Logs de módulo específico
pm2 logs voice-campaign | grep '"module":"campaign-orchestrator"'
```

### Métricas Importantes

| Métrica | Descrição | Alerta se |
|---|---|---|
| Campanhas ativas | Número de campanhas rodando | 0 quando deveria haver |
| Chamadas pendentes | Na fila aguardando | Crescendo sem processar |
| Taxa de sucesso | completed / (completed + failed) | < 30% |
| Taxa de handoff | handoff / completed | > 50% |
| Erros de CRM | Falhas de writeback | > 5% das chamadas |

## Campanhas

### Criar Campanha

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prospecção Q3",
    "segmentFilter": {
      "entityType": "contact",
      "filter": { "ASSIGNED_BY_ID": 1 }
    }
  }'
```

### Ativar Campanha

```bash
curl -X POST http://localhost:3000/api/campaigns/:id/activate
```

### Pausar Campanha

```bash
curl -X POST http://localhost:3000/api/campaigns/:id/pause
```

## Compliance

### Opt-Out

Quando um contato solicita não ser contatado:

```bash
curl -X POST http://localhost:3000/api/compliance/optout \
  -H "Content-Type: application/json" \
  -d '{ "contactId": "12345", "reason": "contact_request" }'
```

### Horários

Configuráveis via .env:
- `COMPLIANCE_DND_HOURS_START` — Início do período de não perturbe
- `COMPLIANCE_DND_HOURS_END` — Fim do período
- `COMPLIANCE_MAX_CALLS_PER_CONTACT` — Máximo de tentativas

## Backup

### Banco de Dados

```bash
# Backup manual
cp data/campaign.db data/campaign.db.$(date +%Y%m%d)

# Restaurar
cp data/campaign.db.20260701 data/campaign.db
```

### Configuração

```bash
# Backup .env
cp .env .env.backup

# Backup prompts
tar czf prompts-backup.tar.gz config/prompts/
```

## Manutenção

### Limpar Chamadas Antigas

```sql
-- Remover chamadas completadas há mais de 90 dias
DELETE FROM call_tasks
WHERE status = 'completed'
  AND created_at < datetime('now', '-90 days');

-- Vacuum para recuperar espaço
VACUUM;
```

### Resetar Campanha

```bash
# Deletar tasks de uma campanha
DELETE FROM call_tasks WHERE campaign_id = 'campaign-id';
DELETE FROM campaigns WHERE id = 'campaign-id';
```

## Incidentes

### Sistema Não Responde

1. Verificar logs: `pm2 logs voice-campaign --lines 100`
2. Verificar saúde: `curl localhost:3000/health`
3. Reiniciar: `pm2 restart voice-campaign`
4. Se persistir, verificar .env e banco de dados

### Chamadas Não Sendo Feitas

1. Verificar se campanha está ativa
2. Verificar compliance (DND hours, opt-out)
3. Verificar provedor de telefonia (credenciais, saldo)
4. Verificar logs de `dialing-engine`

### CRM Writeback Falhando

1. Verificar webhook URL do Bitrix24
2. Testar conexão: `npm run smoke`
3. Verificar rate limits (Bitrix24 limita requisições)
4. Verificar permissões do webhook
