/**
 * Voice Agent Runtime
 *
 * Manages the AI voice conversation:
 * - STT: Speech-to-Text (audio → text)
 * - LLM: Dialog management (context → response)
 * - TTS: Text-to-Speech (text → audio)
 * - Conversation flow control
 */

export class VoiceAgentRuntime {
  #config;
  #sttProvider;
  #llmProvider;
  #ttsProvider;
  #conversationStateManager;
  #logger;

  constructor({ config, sttProvider, llmProvider, ttsProvider, conversationStateManager, logger }) {
    this.#config = config;
    this.#sttProvider = sttProvider;
    this.#llmProvider = llmProvider;
    this.#ttsProvider = ttsProvider;
    this.#conversationStateManager = conversationStateManager;
    this.#logger = logger.child({ module: 'voice-agent' });
  }

  /**
   * Handle a complete voice conversation
   * @param {object} params
   * @param {string} params.callTaskId - Call task ID
   * @param {string} params.contactId - CRM contact ID
   * @param {object} params.audioStream - Bidirectional audio stream
   * @returns {object} Conversation result
   */
  async handleConversation({ callTaskId, contactId, audioStream }) {
    this.#logger.info({ callTaskId, contactId }, 'Starting voice conversation');

    // Initialize or resume conversation state
    const state = this.#conversationStateManager.getState(callTaskId) || {
      callTaskId,
      turns: [],
      slots: {},
      currentStep: 'greeting',
    };

    try {
      // Send greeting
      const greeting = await this.#generateGreeting(contactId, state);
      await this.#speak(audioStream, greeting);
      state.turns.push({ role: 'agent', text: greeting, timestamp: new Date().toISOString() });

      // Conversation loop
      let conversationActive = true;
      let turnCount = 0;
      const maxTurns = 20; // Safety limit

      while (conversationActive && turnCount < maxTurns) {
        // Listen for contact's response
        const contactText = await this.#listen(audioStream);
        if (!contactText) {
          // Silence or hangup
          conversationActive = false;
          break;
        }

        state.turns.push({ role: 'contact', text: contactText, timestamp: new Date().toISOString() });

        // Generate AI response
        const aiResponse = await this.#generateResponse(contactText, state);
        state.turns.push({ role: 'agent', text: aiResponse.text, timestamp: new Date().toISOString() });

        // Update slots from LLM analysis
        if (aiResponse.slots) {
          Object.assign(state.slots, aiResponse.slots);
        }

        // Check for conversation end conditions
        if (aiResponse.action === 'end' || aiResponse.action === 'handoff') {
          if (aiResponse.action === 'handoff') {
            state.currentStep = 'handoff';
          }
          await this.#speak(audioStream, aiResponse.text);
          conversationActive = false;
        } else {
          state.currentStep = aiResponse.nextStep || state.currentStep;
          await this.#speak(audioStream, aiResponse.text);
        }

        turnCount++;
      }

      // Save final state
      this.#conversationStateManager.saveState(callTaskId, state);

      // Generate summary
      const summary = await this.#summarizeConversation(state);

      this.#logger.info({ callTaskId, turnCount }, 'Conversation completed');

      return {
        category: summary.category,
        summary: summary.summary,
        nextSteps: summary.nextSteps,
        transcript: state.turns.map(t => `[${t.role}] ${t.text}`).join('\n'),
        slots: state.slots,
        needsHandoff: state.currentStep === 'handoff',
      };
    } catch (err) {
      this.#logger.error({ callTaskId, err: err.message }, 'Conversation error');
      throw err;
    }
  }

  /**
   * Generate greeting based on contact info
   */
  async #generateGreeting(contactId, state) {
    const prompt = `Generate a professional greeting in Portuguese for a business call.
Contact ID: ${contactId}
Current step: ${state.currentStep}
Keep it brief and professional. Do not use the contact's name unless available.`;

    return this.#llmProvider.generate(prompt);
  }

  /**
   * Listen to audio and transcribe
   */
  async #listen(audioStream) {
    return this.#sttProvider.transcribeStream(audioStream);
  }

  /**
   * Generate response based on contact's input
   */
  async #generateResponse(contactText, state) {
    const conversationHistory = state.turns
      .slice(-6) // Last 6 turns for context
      .map(t => `${t.role}: ${t.text}`)
      .join('\n');

    const prompt = `You are a professional AI phone agent for a business call.
Current conversation step: ${state.currentStep}
Known information: ${JSON.stringify(state.slots)}

Conversation history:
${conversationHistory}

Contact just said: "${contactText}"

Respond in Portuguese. Be concise (1-3 sentences max for phone calls).
Analyze the contact's intent and update slots if new information is detected.

Respond with JSON:
{
  "text": "your response to the contact",
  "nextStep": "greeting|qualifying|presenting|objection-handling|closing",
  "action": "continue|end|handoff",
  "slots": { "key": "value" },
  "intent": "interested|objection|question|not-interested|callback-request|info-request"
}`;

    const response = await this.#llmProvider.generateJSON(prompt);
    return response;
  }

  /**
   * Speak text to audio stream
   */
  async #speak(audioStream, text) {
    const audio = await this.#ttsProvider.synthesize(text);
    audioStream.write(audio);
  }

  /**
   * Summarize conversation for CRM
   */
  async #summarizeConversation(state) {
    const transcript = state.turns.map(t => `${t.role}: ${t.text}`).join('\n');

    const prompt = `Summarize this phone conversation in Portuguese.
Transcript:
${transcript}

Slots collected: ${JSON.stringify(state.slots)}

Respond with JSON:
{
  "category": "interested|callback|not-interested|no-answer|wrong-number|do-not-call",
  "summary": "2-3 sentence summary of the conversation",
  "nextSteps": "recommended next action",
  "interestLevel": "high|medium|low|none"
}`;

    return this.#llmProvider.generateJSON(prompt);
  }
}
