import { Mistral } from '@mistralai/mistralai';
import { config } from '../../../config/env.js';

class MistralService {
  constructor() {
    this.client = null;
  }

  /**
   * Lazily initialize and return the Mistral client
   */
  getClient() {
    if (!config.mistralApiKey) {
      throw new Error('Mistral API key is not configured. Please set MISTRAL_API_KEY in backend/.env');
    }

    if (!this.client) {
      this.client = new Mistral({
        apiKey: config.mistralApiKey,
      });
    }

    return this.client;
  }

  /**
   * Builds the pedagogical system instruction for the AI Tutor
   */
  buildSystemPrompt({ userLevel = 'beginner', mode = 'explain', action = null }) {
    let modeInstruction = '';
    if (mode === 'guide') {
      modeInstruction = `
- Mode: "guide" (Socratic Method).
- Do NOT give the final solution or answer directly immediately.
- Ask the student 1-2 intuitive, leading questions that nudge them toward deriving the answer themselves.
- Acknowledge what they got right, and guide their intuition step-by-step.`;
    } else {
      modeInstruction = `
- Mode: "explain" (Direct & Analogical).
- Provide a clear, structured breakdown directly.
- Use relatable real-world analogies, code snippets, or formulas where applicable, followed by common pitfalls.`;
    }

    let actionInstruction = '';
    if (action === 'generate_practice') {
      actionInstruction = `
- Action: "generate_practice".
- Generate 3 distinct, high-yield practice quiz questions based on the topic discussed.
- Format with a numbered list (1, 2, 3) with varying difficulty.`;
    } else if (action === 'simplify') {
      actionInstruction = `
- Action: "simplify".
- The student requested an ultra-simple explanation.
- Explain the concept using a completely plain everyday analogy with zero technical jargon.`;
    }

    return `You are an expert AI Tutor and educational mentor.
A student with a "${userLevel}" learning level is asking questions.

Pedagogical Guidelines:
1. Explain concepts clearly and adjust explanations to the student's level and question.
2. Use simple, precise language and relatable examples or analogies.
3. Avoid unnecessarily verbose answers; keep responses focused, interactive, and engaging.
4. Encourage learning rather than just dumping answers.
5. Remember the context of the ongoing conversation. Never fabricate previous details or claim to remember things not present in the conversation history.
6. If the student is confused, re-explain using a different perspective or analogy.
7. If the student asks for a step-by-step explanation or practice, adapt accordingly.
${modeInstruction}
${actionInstruction}

CRITICAL OUTPUT FORMATTING:
- Formulate your main teaching response cleanly.
- At the very end of your response, on a new line, suggest a single, relevant follow-up question or exploration prompt that naturally encourages the student to continue learning (e.g., trying a practice question, exploring a deeper subtopic, or asking for a real-world example).
- Enclose this suggested follow-up in the tag: <<<NEXT_PROMPT: Your suggested question or prompt here>>>
- Do NOT include any text after this tag.`;
  }

  /**
   * Formats database conversation history into Mistral-compatible message objects
   */
  formatMessages({ history = [], newMessage, systemPrompt }) {
    const messages = [];

    // 1. Add System Message
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // 2. Add sliding window of recent history (max 12 messages for token efficiency)
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      const role = (msg.role === 'ai' || msg.role === 'assistant') ? 'assistant' : 'user';
      const cleanContent = (msg.content || '').replace(/<[^>]*>/g, '').trim();
      if (cleanContent) {
        messages.push({
          role,
          content: cleanContent,
        });
      }
    }

    // 3. Add the latest user message
    let promptContent = newMessage.trim();
    messages.push({
      role: 'user',
      content: promptContent,
    });

    return messages;
  }

  /**
   * Generates a pedagogical response using Mistral AI
   */
  async generateResponse({
    history = [],
    newMessage,
    userLevel = 'beginner',
    mode = 'explain',
    action = null,
  }) {
    if (!newMessage || !newMessage.trim()) {
      throw new Error('User message cannot be empty.');
    }

    const client = this.getClient();
    const systemPrompt = this.buildSystemPrompt({ userLevel, mode, action });
    const messages = this.formatMessages({ history, newMessage, systemPrompt });

    console.log('[Mistral] Request started');

    try {
      const response = await client.chat.complete({
        model: config.mistralModel,
        messages,
        temperature: mode === 'guide' ? 0.6 : 0.4,
        maxTokens: 1200,
      });

      console.log('[Mistral] Response received');

      const rawContent = response.choices?.[0]?.message?.content || '';
      return this.parseResponseAndPrompt(rawContent);
    } catch (err) {
      console.error('[Mistral] API request failed:', err.message || 'Unknown error');
      throw this.normalizeError(err);
    }
  }

  /**
   * Generates a structured educational recap of the conversation history
   */
  async generateRecap({ history = [] }) {
    if (!history || history.length === 0) {
      return {
        content: "There is no prior conversation history to summarize yet. Feel free to start asking questions!",
        suggestedNextPrompt: "What topic would you like to explore today?",
      };
    }

    const client = this.getClient();

    const recapSystemPrompt = `You are an expert AI Tutor.
Your task is to generate a concise, structured educational recap of the conversation history provided.

The summary MUST include:
1. **Main Topic**: The primary subject discussed.
2. **Key Concepts Discussed**: Bullet points of key ideas explained.
3. **Questions the Student Asked**: Key inquiries raised by the student.
4. **Key Explanations & Insights**: Core takeaways provided by the tutor.
5. **Student Progress**: What the student has learned or demonstrated understanding of.
6. **Suggested Next Steps**: 2-3 logical next topics or practice areas to explore next.

Rules:
- Base the recap ONLY on the provided conversation history.
- Do NOT fabricate or invent concepts that were not discussed.
- Be encouraging, clear, and structured.

CRITICAL: At the very end of your response, on a new line, provide a single relevant follow-up question in the format:
<<<NEXT_PROMPT: Would you like to dive into [suggested next topic] or try a quick quiz on [current topic]?>>>`;

    const formattedHistory = history.map((m) => {
      const role = (m.role === 'ai' || m.role === 'assistant') ? 'Tutor' : 'Student';
      const text = (m.content || '').replace(/<[^>]*>/g, '').trim();
      return `${role}: ${text}`;
    }).join('\n\n');

    const messages = [
      { role: 'system', content: recapSystemPrompt },
      {
        role: 'user',
        content: `Here is the conversation history to recap:\n\n${formattedHistory}\n\nPlease generate the educational summary.`,
      },
    ];

    console.log('[Mistral] Request started (recap)');

    try {
      const response = await client.chat.complete({
        model: config.mistralModel,
        messages,
        temperature: 0.3,
        maxTokens: 1000,
      });

      console.log('[Mistral] Response received (recap)');

      const rawContent = response.choices?.[0]?.message?.content || '';
      return this.parseResponseAndPrompt(rawContent);
    } catch (err) {
      console.error('[Mistral] API request failed (recap):', err.message || 'Unknown error');
      throw this.normalizeError(err);
    }
  }

  /**
   * Parses the raw content to separate the educational content from the suggested next prompt
   */
  parseResponseAndPrompt(rawContent) {
    let content = rawContent;
    let suggestedNextPrompt = 'What would you like to explore next?';

    const promptRegex = /<<<NEXT_PROMPT:\s*([\s\S]*?)>>>/i;
    const match = content.match(promptRegex);

    if (match) {
      suggestedNextPrompt = match[1].trim();
      content = content.replace(promptRegex, '').trim();
    } else {
      const paragraphs = content.split('\n\n').map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 1) {
        const lastP = paragraphs[paragraphs.length - 1];
        if (lastP.endsWith('?') && lastP.length < 150) {
          suggestedNextPrompt = lastP;
        }
      }
    }

    return {
      content,
      suggestedNextPrompt,
    };
  }

  /**
   * Normalizes errors into clean, safe error messages without exposing credentials or internal traces
   */
  normalizeError(err) {
    const status = err.status || err.statusCode || 500;
    const msg = err.message || '';

    if (status === 401 || msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key')) {
      const error = new Error('Mistral AI authentication failed. Please verify your MISTRAL_API_KEY.');
      error.statusCode = 401;
      return error;
    }

    if (status === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      const error = new Error('Mistral AI rate limit reached. Please wait a moment and try again.');
      error.statusCode = 429;
      return error;
    }

    if (status === 503 || status === 502 || status === 504 || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('service unavailable')) {
      const error = new Error('Mistral AI service is temporarily unavailable. Please try again shortly.');
      error.statusCode = 503;
      return error;
    }

    const safeError = new Error('Failed to generate AI response. Please try again.');
    safeError.statusCode = status >= 400 && status < 600 ? status : 500;
    return safeError;
  }
}

export const mistralService = new MistralService();
export const textGenerationService = mistralService;
