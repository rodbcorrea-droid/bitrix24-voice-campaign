/**
 * Voice AI Providers
 *
 * Abstraction layer for STT, LLM, and TTS providers.
 * Includes mock implementations for testing.
 */

// --- STT Providers ---

export class DeepgramSttProvider {
  #apiKey;
  #model;
  #language;
  #logger;

  constructor({ apiKey, model = 'nova-2', language = 'pt-BR', logger }) {
    this.#apiKey = apiKey;
    this.#model = model;
    this.#language = language;
    this.#logger = logger;
  }

  async transcribeStream(audioStream) {
    // Deepgram WebSocket streaming implementation
    // In production, this connects to Deepgram's streaming API
    this.#logger.debug('Starting Deepgram transcription...');

    return new Promise((resolve, reject) => {
      const chunks = [];

      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', async () => {
        try {
          const audio = Buffer.concat(chunks);
          const response = await fetch('https://api.deepgram.com/v1/listen', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${this.#apiKey}`,
              'Content-Type': 'audio/wav',
            },
            body: audio,
          });

          const result = await response.json();
          resolve(result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '');
        } catch (err) {
          reject(err);
        }
      });

      audioStream.on('error', reject);
    });
  }
}

// --- LLM Providers ---

export class AnthropicLlmProvider {
  #apiKey;
  #model;
  #maxTokens;
  #systemPrompt;
  #logger;

  constructor({ apiKey, model, maxTokens = 500, systemPrompt = '', logger }) {
    this.#apiKey = apiKey;
    this.#model = model;
    this.#maxTokens = maxTokens;
    this.#systemPrompt = systemPrompt;
    this.#logger = logger;
  }

  async generate(prompt) {
    this.#logger.debug({ model: this.#model }, 'Generating LLM response...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.#apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#model,
        max_tokens: this.#maxTokens,
        system: this.#systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async generateJSON(prompt) {
    const text = await this.generate(prompt);
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : text);
    } catch {
      this.#logger.warn({ text }, 'Failed to parse LLM response as JSON');
      return { text, category: 'unknown' };
    }
  }
}

// --- TTS Providers ---

export class ElevenLabsTtsProvider {
  #apiKey;
  #voiceId;
  #model;
  #logger;

  constructor({ apiKey, voiceId, model = 'eleven_multilingual_v2', logger }) {
    this.#apiKey = apiKey;
    this.#voiceId = voiceId;
    this.#model = model;
    this.#logger = logger;
  }

  async synthesize(text) {
    this.#logger.debug({ textLength: text.length }, 'Synthesizing speech...');

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.#voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.#apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: this.#model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    return response.body;
  }
}

// --- Mock Providers (for testing) ---

export class MockSttProvider {
  #logger;
  #responses;
  #callIndex = 0;

  constructor({ logger, responses = [] }) {
    this.#logger = logger;
    this.#responses = responses;
  }

  async transcribeStream() {
    const response = this.#responses[this.#callIndex % this.#responses.length] || 'Olá, estou interessado.';
    this.#callIndex++;
    this.#logger.debug({ response }, 'Mock STT response');
    return response;
  }
}

export class MockLlmProvider {
  #logger;
  #responses;
  #callIndex = 0;

  constructor({ logger, responses = [] }) {
    this.#logger = logger;
    this.#responses = responses;
  }

  async generate(prompt) {
    const response = this.#responses[this.#callIndex % this.#responses.length] || 'Entendo. Posso ajudar com mais alguma coisa?';
    this.#callIndex++;
    this.#logger.debug({ response }, 'Mock LLM response');
    return response;
  }

  async generateJSON(prompt) {
    const defaults = {
      text: 'Obrigado pelo interesse. Vou agendar uma reunião.',
      nextStep: 'closing',
      action: 'end',
      slots: { interestLevel: 'high' },
      intent: 'interested',
    };

    const response = this.#responses[this.#callIndex % this.#responses.length] || defaults;
    this.#callIndex++;
    this.#logger.debug({ response }, 'Mock LLM JSON response');
    return typeof response === 'string' ? { ...defaults, text: response } : response;
  }
}

export class MockTtsProvider {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  async synthesize(text) {
    this.#logger.debug({ text }, 'Mock TTS synthesis');
    // Return a mock readable stream
    const { Readable } = await import('node:stream');
    const stream = new Readable({
      read() {
        this.push(Buffer.from('mock-audio-data'));
        this.push(null);
      },
    });
    return stream;
  }
}
