# Integração Bitrix24

## Visão Geral

O sistema integra com Bitrix24 de duas formas:
1. **REST API** — via webhook URL (desenvolvimento e produção)
2. **MCP** — via ferramentas MCP do Hermes Agent (produção)

## Métodos Utilizados

### CRM — Segmentação de Contatos

| Método | Uso |
|---|---|
| `crm.contact.list` | Listar contatos com filtros |
| `crm.lead.list` | Listar leads com filtros |
| `crm.contact.fields` | Descobrir campos disponíveis |
| `crm.status.list` | Listar estágios/status |

#### Exemplo: Listar Contatos

```javascript
// Filtro por responsável
const contacts = await bitrix24.call('crm.contact.list', {
  filter: { ASSIGNED_BY_ID: 1 },
  select: ['ID', 'NAME', 'PHONE', 'EMAIL'],
});
```

### CRM — Escrita de Resultados

| Método | Uso |
|---|---|
| `crm.contact.update` | Atualizar campos do contato |
| `crm.lead.update` | Atualizar campos do lead |
| `crm.activity.add` | Criar atividade na timeline |

#### Exemplo: Registrar Atividade

```javascript
await bitrix24.call('crm.activity.add', {
  fields: {
    SUBJECT: 'Chamada: interested',
    DESCRIPTION: 'Resumo da conversa...',
    TYPE_ID: 2,        // Call
    OWNER_ID: 12345,
    OWNER_TYPE_ID: 3,  // Contact
    RESPONSIBLE_ID: 1,
    COMPLETED: 'Y',
  },
});
```

### Telefonia — Registro de Chamadas

| Método | Uso |
|---|---|
| `telephony.externalCall.register` | Registrar início da chamada |
| `telephony.externalCall.finish` | Finalizar registro |
| `telephony.call.attachTranscription` | Anexar transcrição |

#### Exemplo: Registrar e Finalizar Chamada

```javascript
// Registrar
const call = await bitrix24.call('telephony.externalCall.register', {
  PHONE_NUMBER: '+5511999999999',
  DIRECTION: 'outgoing',
  CRM_ENTITY_TYPE: 'CONTACT',
  CRM_ENTITY_ID: 12345,
  START_DATE: new Date().toISOString(),
});

// Finalizar
await bitrix24.call('telephony.externalCall.finish', {
  CALL_ID: call.CALL_ID,
  DURATION: 180,
  STATUS: 200,
});

// Anexar transcrição
await bitrix24.call('telephony.call.attachTranscription', {
  CALL_ID: call.CALL_ID,
  TRANSCRIPTION: 'Agente: Ola!\nContato: Oi...',
});
```

### Telefonia — Chamadas Nativas (Limitado)

| Método | Capacidade | Limitação |
|---|---|---|
| `voximplant.callback.start` | Iniciar callback | Sem áudio bidirecional |
| `voximplant.infocall.startwithsound` | Tocar áudio | Unidirecional |
| `voximplant.infocall.startwithtext` | TTS nativo | Unidirecional |

**Nota:** Para voz com IA (conversa bidirecional), é necessário provedor externo (Twilio/SIP).

## Webhook do Bitrix24

### Como Obter

1. Acesse seu Bitrix24
2. Menu → DevTools → Webhooks
3. Criar webhook → Selecionar permissões:
   - CRM (read/write)
   - Telephony (read/write)
4. Copiar URL

### Permissões Necessárias

| Escopo | Necessário | Por quê |
|---|---|---|
| `crm` | Sim | Ler/escrever contatos, leads, atividades |
| `telephony` | Sim | Registrar chamadas, anexar transcrições |
| `entity` | Não | Para campos custom avançados |
| `user` | Não | Para listar operadores |

## Rate Limits

O Bitrix24 limita requisições REST:
- **2 requisições por segundo** por padrão
- Erro `QUERY_LIMIT_EXCEEDED` quando excedido

O sistema implementa:
- Rate limiter adaptativo
- Retry com backoff exponencial
- Batch operations quando possível

## Erros Comuns

| Erro | Código | Solução |
|---|---|---|
| `QUERY_LIMIT_EXCEEDED` | — | Aguardar e retry |
| `ERROR_METHOD_NOT_FOUND` | — | Verificar nome do método |
| `INVALID_CREDENTIALS` | — | Verificar webhook URL |
| `PERMISSION_DENIED` | — | Verificar permissões do webhook |

## MCP (Hermes Agent)

Quando rodando via Hermes Agent, o sistema detecta automaticamente
ferramentas MCP disponíveis e as usa em vez da REST API.

### Detecção

```javascript
const isMcp = process.env.HERMES_AGENT === 'true' ||
              typeof globalThis.__mcp_bridge !== 'undefined';
```

### Vantagens do MCP

- Sem necessidade de webhook URL
- Autenticação gerenciada pelo Hermes
- Possível acesso a funcionalidades adicionais

### Fallback

Se MCP falhar, o sistema cai automaticamente para REST API.
