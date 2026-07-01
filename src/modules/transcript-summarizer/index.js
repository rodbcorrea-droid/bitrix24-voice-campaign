/**
 * Transcript Summarizer
 *
 * Post-call processing: generates structured summaries,
 * extracts entities, and classifies outcomes.
 */

export class TranscriptSummarizer {
  #llmProvider;
  #logger;

  constructor({ llmProvider, logger }) {
    this.#llmProvider = llmProvider;
    this.#logger = logger.child({ module: 'transcript-summarizer' });
  }

  /**
   * Generate a structured summary from a transcript
   * @param {string} transcript - Full conversation transcript
   * @param {object} context - Additional context (contact info, campaign info)
   * @returns {object} Structured summary
   */
  async summarize(transcript, context = {}) {
    this.#logger.info('Generating transcript summary...');

    const prompt = `Analyze this phone conversation transcript and generate a structured summary.

Transcript:
${transcript}

Context:
- Contact: ${context.contactName || 'Unknown'}
- Campaign: ${context.campaignName || 'Unknown'}
- Duration: ${context.duration || 'Unknown'} seconds

Respond with JSON in Portuguese:
{
  "category": "interested|callback|not-interested|no-answer|wrong-number|do-not-call|meeting-scheduled|info-requested",
  "summary": "Resumo profissional da conversa em 2-3 frases",
  "keyPoints": ["ponto importante 1", "ponto importante 2"],
  "nextSteps": "Próxima ação recomendada",
  "interestLevel": "high|medium|low|none",
  "entities": {
    "products": ["produto mencionado"],
    "dates": ["data mencionada"],
    "values": ["valor mencionado"],
    "competitors": ["concorrente mencionado"]
  },
  "sentiment": "positive|neutral|negative",
  "urgency": "high|medium|low"
}`;

    try {
      const result = await this.#llmProvider.generateJSON(prompt);
      this.#logger.info({ category: result.category }, 'Summary generated');
      return result;
    } catch (err) {
      this.#logger.error({ err: err.message }, 'Failed to generate summary');
      return {
        category: 'unknown',
        summary: 'Erro ao gerar resumo automaticamente.',
        nextSteps: 'Revisar transcrição manualmente.',
      };
    }
  }

  /**
   * Classify a call outcome from a brief result
   * @param {string} briefResult - Short description of the call result
   * @returns {string} Category
   */
  async classify(briefResult) {
    const prompt = `Classify this phone call result into exactly one category:
"${briefResult}"

Categories: interested, callback, not-interested, no-answer, wrong-number, do-not-call, meeting-scheduled, info-requested

Respond with only the category name.`;

    const result = await this.#llmProvider.generate(prompt);
    return result.trim().toLowerCase();
  }
}
