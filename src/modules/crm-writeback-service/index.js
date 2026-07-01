/**
 * CRM Writeback Service
 *
 * Writes call results back to Bitrix24 CRM:
 * - Registers call activity
 * - Attaches transcription
 * - Updates contact/lead fields
 * - Creates follow-up tasks
 */

export class CrmWritebackService {
  #bitrix24;
  #logger;

  constructor({ bitrix24, logger }) {
    this.#bitrix24 = bitrix24;
    this.#logger = logger.child({ module: 'crm-writeback' });
  }

  /**
   * Write complete call result to CRM
   * @param {object} params
   * @param {string} params.contactId - CRM contact/lead ID
   * @param {string} params.entityType - 'contact' or 'lead'
   * @param {object} params.callResult - Result from voice agent
   * @param {number} params.duration - Call duration in seconds
   * @param {string} params.phone - Phone number called
   */
  async writeCallResult({ contactId, entityType, callResult, duration, phone }) {
    this.#logger.info({ contactId, entityType, category: callResult.category }, 'Writing call result to CRM');

    try {
      // 1. Register the call
      const callRecord = await this.#bitrix24.registerCall({
        phoneNumber: phone,
        direction: 'outgoing',
        contactId: entityType === 'contact' ? contactId : undefined,
        leadId: entityType === 'lead' ? contactId : undefined,
      });

      // 2. Finish the call record with duration
      if (callRecord && callRecord.CALL_ID) {
        await this.#bitrix24.finishCall({
          callId: callRecord.CALL_ID,
          duration: duration || 0,
          status: 200,
        });

        // 3. Attach transcription if available
        if (callResult.transcript) {
          await this.#bitrix24.attachTranscription({
            callId: callRecord.CALL_ID,
            transcription: callResult.transcript,
          });
        }
      }

      // 4. Create activity record with summary
      await this.#bitrix24.createActivity({
        subject: `Chamada: ${callResult.category || 'completed'}`,
        description: this.#buildActivityDescription(callResult),
        typeId: 2, // Call
        ownerId: contactId,
        ownerTypeId: entityType === 'lead' ? 1 : 3, // 1=Lead, 3=Contact
        completed: 'Y',
      });

      // 5. Update entity fields based on result
      await this.#updateEntityFields(contactId, entityType, callResult);

      // 6. Create follow-up task if needed
      if (callResult.needsFollowUp || callResult.category === 'callback') {
        await this.#createFollowUpTask(contactId, entityType, callResult);
      }

      this.#logger.info({ contactId }, 'CRM writeback completed');
    } catch (err) {
      this.#logger.error({ contactId, err: err.message }, 'CRM writeback failed');
      throw err;
    }
  }

  #buildActivityDescription(callResult) {
    const parts = [];

    if (callResult.summary) {
      parts.push(`Resumo: ${callResult.summary}`);
    }
    if (callResult.category) {
      parts.push(`Resultado: ${callResult.category}`);
    }
    if (callResult.interestLevel) {
      parts.push(`Nível de interesse: ${callResult.interestLevel}`);
    }
    if (callResult.nextSteps) {
      parts.push(`Próximos passos: ${callResult.nextSteps}`);
    }
    if (callResult.entities) {
      const entities = [];
      if (callResult.entities.products?.length) {
        entities.push(`Produtos: ${callResult.entities.products.join(', ')}`);
      }
      if (callResult.entities.dates?.length) {
        entities.push(`Datas: ${callResult.entities.dates.join(', ')}`);
      }
      if (entities.length) {
        parts.push(`Entidades mencionadas: ${entities.join(' | ')}`);
      }
    }

    return parts.join('\n');
  }

  async #updateEntityFields(contactId, entityType, callResult) {
    const fields = {};

    // Map result category to a status/field update
    const statusMap = {
      'interested': 'INTERESTED',
      'callback': 'CALLBACK_REQUESTED',
      'not-interested': 'NOT_INTERESTED',
      'meeting-scheduled': 'MEETING_SCHEDULED',
    };

    if (statusMap[callResult.category]) {
      // Use a comment field or custom field for call result
      fields['COMMENTS'] = `Última chamada: ${callResult.summary || callResult.category}`;
    }

    if (Object.keys(fields).length > 0) {
      if (entityType === 'lead') {
        await this.#bitrix24.updateLead(contactId, fields);
      } else {
        await this.#bitrix24.updateContact(contactId, fields);
      }
    }
  }

  async #createFollowUpTask(contactId, entityType, callResult) {
    const deadline = callResult.callbackDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await this.#bitrix24.createActivity({
      subject: `Follow-up: ${callResult.category}`,
      description: `Follow-up agendado automaticamente.\n\nMotivo: ${callResult.nextSteps || callResult.summary}`,
      typeId: 2,
      ownerId: contactId,
      ownerTypeId: entityType === 'lead' ? 1 : 3,
      completed: 'N',
      deadline,
    });
  }
}
