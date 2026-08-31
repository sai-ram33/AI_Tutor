import { config } from '../config/env.js';
import { mistralService } from './ai/mistral/mistralService.js';
import { qwenClient } from './ai/qwen/qwenClient.js';
import { groqTtsService } from './ai/groq/groqTtsService.js';

export const aiService = {
  /**
   * Generates speech/audio from text using Groq TTS service
   * @param {Object} params
   * @param {string} params.text - The text to synthesize
   * @param {string} [params.voice] - The voice persona ('autumn', 'diana', 'hannah', etc.)
   * @param {string} [params.model] - The TTS model
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, format: string, byteLength: number}>}
   */
  async textToAudio({ text, voice, model }) {
    return await groqTtsService.generateSpeech({ text, voice, model });
  },

  /**
   * Returns list of supported TTS voice personas
   */
  getTtsVoices() {
    return groqTtsService.getAvailableVoices();
  },
  /**
   * Generates a pedagogical AI response adapted for mode, level, and action using Mistral AI.
   * @param {Object} params
   * @param {Array} params.history - Array of recent conversation messages
   * @param {string} params.newMessage - The student's current message
   * @param {string} params.userLevel - 'beginner' | 'intermediate' | 'advanced'
   * @param {string} params.mode - 'explain' | 'guide'
   * @param {string} [params.action] - 'generate_practice' | 'simplify' | 'recap' | null
   * @returns {Promise<{content: string, suggestedNextPrompt: string}>} Generated explanation and follow-up prompt
   */
  async getExplanation({ history = [], newMessage, userLevel = 'beginner', mode = 'explain', action = null }) {
    // 1. Check if Mistral AI is configured
    if (config.mistralApiKey) {
      try {
        if (action === 'recap' || this.isRecapIntent(newMessage)) {
          return await mistralService.generateRecap({ history });
        }

        return await mistralService.generateResponse({
          history,
          newMessage,
          userLevel,
          mode,
          action,
        });
      } catch (err) {
        console.error('[AI Service Error]:', err.message);
        if (err.statusCode) {
          throw err;
        }
      }
    }

    // 2. Intelligent built-in pedagogical tutor generator (fallback when key is missing or offline)
    console.log('[AI Service] Using built-in tutor generator fallback');
    const content = this.generateTutorResponse({ history, newMessage, userLevel, mode, action });
    const suggestedNextPrompt = mode === 'guide'
      ? 'Would you like to try walking through the first step?'
      : 'Would you like to explore a practice question or a simpler analogy?';

    return {
      content,
      suggestedNextPrompt,
    };
  },

  /**
   * Explains an uploaded image and user prompt using Qwen2.5-VL-3B-Instruct
   * @param {Object} params
   * @param {Buffer} [params.imageBuffer] - Uploaded image binary buffer
   * @param {string} [params.imageMimetype] - Uploaded image mime type
   * @param {string} [params.imageOriginalName] - Original image filename
   * @param {string} params.message - Student prompt / instruction
   * @param {Array} [params.history] - Prior conversation messages
   * @param {string} [params.userLevel] - Student proficiency level
   * @param {string} [params.mode] - 'explain' | 'guide'
   * @returns {Promise<{success: boolean, model: string, response: string, device: string}>}
   */
  async explainImage({
    imageBuffer,
    imageMimetype,
    imageOriginalName,
    message,
    history = [],
    userLevel = 'beginner',
    mode = 'explain',
  }) {
    return await qwenClient.generate({
      imageBuffer,
      imageMimetype,
      imageOriginalName,
      message,
      history,
      userLevel,
      mode,
    });
  },

  /**
   * Health check for Qwen Vision microservice
   */
  async checkVisionHealth() {
    return await qwenClient.checkHealth();
  },

  /**
   * Generates an educational recap of the conversation history.
   * @param {Object} params
   * @param {Array} params.history - Array of conversation messages
   * @returns {Promise<{content: string, suggestedNextPrompt: string}>}
   */
  async getRecap({ history = [] }) {
    if (config.mistralApiKey) {
      try {
        return await mistralService.generateRecap({ history });
      } catch (err) {
        console.error('[AI Service Recap Error]:', err.message);
        if (err.statusCode) throw err;
      }
    }

    return {
      content: this.generateFallbackRecap(history),
      suggestedNextPrompt: 'What topic would you like to explore next?',
    };
  },

  /**
   * Detects if the student is asking for a summary/recap of the conversation
   */
  isRecapIntent(message = '') {
    const q = message.toLowerCase().trim();
    const recapPhrases = [
      'summarize our conversation',
      'summarize the conversation',
      'give me a recap',
      'recap our conversation',
      'recap what we discussed',
      'recap',
      'summary of our conversation',
      'what did we discuss',
      'summarize what we discussed',
      'give me a summary',
    ];
    return recapPhrases.some((phrase) => q.includes(phrase)) || q === 'summarize' || q === 'recap';
  },

  /**
   * Built-in intelligent pedagogical response generator for seamless local execution/fallback
   */
  generateTutorResponse({ history, newMessage, userLevel, mode, action }) {
    const q = newMessage.toLowerCase();
    const prefix = mode === 'guide' ? `<p><strong>💡 Let's think through this together:</strong></p>` : '';

    if (action === 'generate_practice') {
      return `<p><strong>📝 3 Custom Practice Questions for "${newMessage.slice(0, 30)}":</strong></p>
<ol>
  <li><strong>Core Concept:</strong> In your own words, what is the single most important purpose of this concept?</li>
  <li><strong>Edge Case:</strong> What is a common scenario or input where this approach might fail or behave unexpectedly?</li>
  <li><strong>Application:</strong> How would you implement or apply this in a real-world project?</li>
</ol>`;
    }

    if (action === 'simplify') {
      return `<p><strong>💡 Simplified Explanation:</strong></p>
<p>Imagine this like a kitchen recipe: you have your <strong>ingredients (input)</strong>, your <strong>cooking steps (process)</strong>, and your <strong>finished dish (output)</strong>.</p>
<p>You don't need to worry about complex technical details — as long as you follow the steps one by one, you get the right result every time.</p>`;
    }

    if (q.includes('photosynthesis')) {
      return `${prefix}<p><strong>Photosynthesis</strong> is the biological process by which green plants, algae, and some bacteria convert light energy (usually from the Sun) into chemical energy stored in glucose.</p>
<p><strong>Equation:</strong> 6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂</p>
<p>Sunlight provides the energetic activation to split water molecules and fix carbon dioxide into nourishing sugars.</p>`;
    }

    if (q.includes('sunlight') && (history || []).some(m => (m.content || '').toLowerCase().includes('photosynthesis'))) {
      return `${prefix}<p>Sunlight is critical because it powers the <strong>light-dependent reactions</strong> in the thylakoid membranes of chloroplasts.</p>
<p>Without sunlight, chlorophyll cannot energize electrons to generate ATP and NADPH, which means the plant cannot synthesize glucose.</p>`;
    }

    // Default pedagogical response
    if (mode === 'guide') {
      return `${prefix}<p>That is an excellent topic to explore: <strong>"${newMessage}"</strong>.</p>
<p>Before we dive into the full explanation, <em>what is your current intuition about how this works, or what specific part feels most confusing?</em></p>`;
    }

    return `<p>Here is a structured explanation for <strong>"${newMessage}"</strong> tailored to your ${userLevel} level:</p>
<p>The core concept begins with understanding the primary objective: breaking down complex behavior into simple, predictable building blocks.</p>`;
  },

  /**
   * Generates a fallback recap if offline
   */
  generateFallbackRecap(history = []) {
    if (!history || history.length === 0) {
      return 'No previous conversation history found to summarize.';
    }
    const topics = history
      .filter((m) => m.role === 'user')
      .map((m) => m.content.replace(/<[^>]*>/g, '').trim())
      .slice(-5);

    return `### Conversation Summary
- **Topics Explored:** ${topics.join(', ') || 'General Concepts'}
- **Focus:** Building foundational understanding and clarifying key questions.`;
  },
};
