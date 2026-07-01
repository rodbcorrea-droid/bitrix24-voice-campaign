# Mapa de Capacidades Bitrix24

## Análise de Capacidades Nativas vs Externas

### 1. CRM — Contact/Lead Management

| Operação | Método Bitrix24 | Status | Observação |
|---|---|---|---|
| Listar contatos | `crm.contact.list` | ✅ NATIVO | Filtros por campo suportados |
| Listar leads | `crm.lead.list` | ✅ NATIVO | Filtros por estágio, origem |
| Obter contato | `crm.contact.get` | ✅ NATIVO | — |
| Atualizar contato | `crm.contact.update` | ✅ NATIVO | Campos custom incluídos |
| Criar atividade | `crm.activity.add` | ✅ NATIVO | Timeline do contato |
| Buscar por telefone | `crm.duplicate.findbycomm` | ✅ NATIDO | Deduplicação |
| Campos disponíveis | `crm.contact.fields` | ✅ NATIVO | Descoberta de schema |
| Status/Estágios | `crm.status.list` | ✅ NATIVO | Filtros por pipeline |

**Conclusão CRM:** Capacidade completa para segmentação e escrita.

### 2. Telefonia — Chamadas

| Operação | Método Bitrix24 | Status | Observação |
|---|---|---|---|
| Registrar chamada externa | `telephony.externalCall.register` | ✅ NATIVO | Cria registro no CRM |
| Finalizar chamada | `telephony.externalCall.finish` | ✅ NATIVO | Duração, status |
| Anexar gravação | `telephony.externalCall.attachRecord` | ✅ NATIVO | URL do áudio |
| Anexar transcrição | `telephony.call.attachTranscription` | ✅ NATIVO | Texto da transcrição |
| Mostrar call card | `telephony.externalCall.show` | ✅ NATIVO | UI do operador |
| Callback (iniciar chamada) | `voximplant.callback.start` | ⚠️ LIMITADO | Inicia callback, sem stream |
| Info call com áudio | `voximplant.infocall.startwithsound` | ⚠️ LIMITADO | Unidirecional, play MP3 |
| Info call com TTS | `voximplant.infocall.startwithtext` | ⚠️ LIMITADO | Unidirecional, TTS nativo |
| Vozes TTS disponíveis | `voximplant.tts.voices.get` | ✅ NATIVO | Lista de vozes |
| Linhas externas | `voximplant.line.*` | ✅ NATIVO | Gerenciamento de linhas |
| Conexões SIP | `voximplant.sip.*` | ✅ NATIVO | CRUD de SIP connections |
| Estatísticas de chamadas | `voximplant.statistic.get` | ✅ NATIVO | Histórico de chamadas |

**Conclusão Telefonia:** Registro e metadata completos. Início de chamada limitado
a callbacks e info-calls unidirecionais. **Sem áudio bidirecional nativo.**

### 3. Eventos de Telefonia

| Evento | Disponibilidade | Uso |
|---|---|---|
| `OnExternalCallStart` | ✅ | Detectar início de chamada manual |
| `OnExternalCallBackStart` | ✅ | Detectar callback via CRM |
| `OnVoximplantCallInit` | ✅ | Chamada inicializada |
| `OnVoximplantCallStart` | ✅ | Conversa iniciada |
| `OnVoximplantCallEnd` | ✅ | Conversa encerrada |

**Conclusão Eventos:** Completos para tracking de ciclo de vida.

### 4. Limitações Identificadas

| Limitação | Impacto | Solução |
|---|---|---|
| Sem áudio bidirecional via API | Crítico | Provedor externo (Twilio/SIP) |
| Sem dialer preditivo | Alto | dialing-engine próprio |
| Sem campanhas em massa nativas | Alto | campaign-orchestrator próprio |
| Sem transcrição em tempo real | Alto | Deepgram/Whisper externo |
| Rate limits na API | Médio | Rate limiter adaptativo |
| TTS nativo limitado (infocall) | Médio | ElevenLabs/PlayHT externo |
| Sem LLM/dialog management | Alto | Claude/GPT externo |

### 5. Estratégia de Uso por Modo

#### Modo A: Completo (Twilio + Voice AI)
```
Bitrix24: CRM (segmentação, registro, writeback)
Twilio:   Telefonia (chamada, áudio bidirecional)
Deepgram: STT
Claude:   LLM Dialog
ElevenLabs: TTS
```
**Resultado:** Conversa completa com IA, handoff, transcrição em tempo real.

#### Modo B: Bitrix24 + Info Call
```
Bitrix24: CRM + Telefonia (voximplant.infocall)
```
**Resultado:** Notificação por voz unidirecional, sem conversa. Limitado mas sem custo externo.

#### Modo C: Bitrix24 Apenas (Registro)
```
Bitrix24: CRM (segmentação, registro manual)
Telefonia: Manual (operador discala)
```
**Resultado:** Campanha organizada, mas discagem manual. Writeback automático.

**Sistema deve suportar os 3 modos, detectando capacidades via mcp-capability-checker.**
