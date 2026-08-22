import { config } from '../config/env.js';

export const aiService = {
  /**
   * Generates a pedagogical AI response adapted for mode, level, and action.
   * @param {Object} params
   * @param {Array} params.history - Array of recent conversation messages
   * @param {string} params.newMessage - The student's current message
   * @param {string} params.userLevel - 'beginner' | 'intermediate' | 'advanced'
   * @param {string} params.mode - 'explain' | 'guide'
   * @param {string} [params.action] - 'generate_practice' | 'simplify' | null
   * @returns {Promise<string>} Formatted HTML or Markdown explanation
   */
  async getExplanation({ history = [], newMessage, userLevel = 'beginner', mode = 'explain', action = null }) {
    try {
      // If an external AI API key is configured (Gemini / OpenAI / Custom)
      if (config.aiApiKey) {
        const externalResponse = await this.callExternalLLM({
          history,
          newMessage,
          userLevel,
          mode,
          action,
        });
        if (externalResponse) return externalResponse;
      }

      // Intelligent built-in pedagogical tutor generator (fallback)
      return this.generateTutorResponse({ history, newMessage, userLevel, mode, action });
    } catch (err) {
      console.error('[AI Service Error]:', err.message);
      throw new Error("Couldn't reach AI Teacher, please try again");
    }
  },

  /**
   * Calls Google Gemini or OpenAI compatible LLM endpoints when API Key is set
   */
  async callExternalLLM({ history, newMessage, userLevel, mode, action }) {
    try {
      const systemPrompt = this.buildSystemPrompt(userLevel, mode, action);
      
      // Default to Google Gemini 1.5/2.0 API endpoint if key provided
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.aiApiKey}`;
      
      const contents = [];
      
      // Add context history
      history.forEach((m) => {
        contents.push({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content.replace(/<[^>]*>/g, '') }],
        });
      });

      // Add user message
      let promptText = newMessage;
      if (action === 'generate_practice') {
        promptText = `[Action: Generate 3 practice quiz questions based on our previous topic] ${newMessage}`;
      } else if (action === 'simplify') {
        promptText = `[Action: Explain simpler with an everyday analogy] ${newMessage}`;
      }

      contents.push({
        role: 'user',
        parts: [{ text: promptText }],
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: mode === 'guide' ? 0.6 : 0.4,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        console.warn('External AI API returned status:', response.status);
        return null;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (rawText) {
        return this.formatAiHtml(rawText);
      }
      return null;
    } catch (err) {
      console.warn('External AI call failed, using built-in engine:', err.message);
      return null;
    }
  },

  buildSystemPrompt(level, mode, action) {
    let modeInstruction = '';
    if (mode === 'guide') {
      modeInstruction = `
- Mode: "guide" (Socratic Method).
- Do NOT give the answer or solution directly.
- Ask the student 1-2 intuitive, leading questions that nudge them toward deriving the answer themselves.
- Acknowledge what they got right, and guide their intuition step-by-step.`;
    } else {
      modeInstruction = `
- Mode: "explain" (Direct & Analogical).
- Give a full, step-by-step intuitive breakdown directly.
- Use relatable real-world analogies, code snippets or formulas where applicable, followed by common pitfalls.`;
    }

    let actionInstruction = '';
    if (action === 'generate_practice') {
      actionInstruction = `
- Action: "generate_practice".
- Generate 3 distinct, high-yield practice quiz questions based on the topic discussed.
- Format with numbered list (1, 2, 3) with varying difficulty.`;
    } else if (action === 'simplify') {
      actionInstruction = `
- Action: "simplify".
- The student requested an ultra-simple explanation.
- Explain the concept using a completely plain everyday analogy (like cooking, traffic, or games) with zero technical jargon.`;
    }

    return `You are an expert AI Teacher. A student (${level} learning level) is asking a question.
Teaching Rules:
1. Begin with an intuitive 1-sentence definition.
2. Explain WHY this concept exists and what problem it solves.
3. Provide a vivid analogy suitable for a ${level} student.
4. Show a clean example or code block.
5. Highlight critical terms in <span class="highlight-term">term</span> HTML tags.
${modeInstruction}
${actionInstruction}`;
  },

  formatAiHtml(text) {
    // Basic markdown to HTML formatting for clean rendering
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Wrap paragraphs if not already wrapped
    if (!formatted.startsWith('<p>') && !formatted.startsWith('<pre>')) {
      const paragraphs = formatted.split('\n\n').filter(Boolean);
      formatted = paragraphs.map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('');
    }

    return formatted;
  },

  /**
   * Built-in intelligent pedagogical response generator for seamless local execution
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

    // Keyword based pedagogical breakdowns
    if (q.includes('function') || q.includes('def ')) {
      if (mode === 'guide') {
        return `${prefix}<p>Think about a recipe card in a kitchen. You write the recipe once, and you can make that meal whenever you need it.</p>
<p><em>In Python, why do you think we use parameters inside <code>def function_name(parameter):</code>? What advantage does that give over hard-coding numbers?</em></p>`;
      }
      return `${prefix}<p>A <span class="highlight-term">function</span> in Python is a reusable, named block of code that carries out a specific task. You define it once using <code>def</code>, and invoke it whenever needed.</p>
<pre><code>def calculate_total(price, tax_rate=0.05):
    """Calculates final price with sales tax."""
    return price * (1 + tax_rate)

# Calling our function
total = calculate_total(100) # Output: 105.0</code></pre>
<p><strong>Why use functions?</strong></p>
<ul>
  <li><strong>DRY Principle:</strong> Write code once, reuse it everywhere without copy-pasting.</li>
  <li><strong>Modularity:</strong> Breaks complex systems into small, testable units.</li>
</ul>`;
    }

    if (q.includes('recursion') || q.includes('recursive')) {
      if (mode === 'guide') {
        return `${prefix}<p>Imagine you have a stack of 5 nested boxes. To reach the prize in the smallest box, what action must you repeat for each box?</p>
<p><em>What happens if you forget to include a rule for what to do when you reach the final box (the <span class="highlight-term">base case</span>)?</em></p>`;
      }
      return `${prefix}<p><span class="highlight-term">Recursion</span> is a problem-solving technique where a function solves a problem by calling smaller instances of itself.</p>
<p>Every recursive algorithm requires two fundamental components:</p>
<ol>
  <li><strong>Base Case:</strong> The stopping condition that returns immediately without further recursive calls.</li>
  <li><strong>Recursive Case:</strong> The step where the problem is reduced and the function calls itself.</li>
</ol>
<pre><code>def countdown(n):
    if n <= 0: # Base case
        print("Blast off! 🚀")
        return
    print(n)
    countdown(n - 1) # Recursive case</code></pre>`;
    }

    if (q.includes('quantum') || q.includes('entangle')) {
      return `${prefix}<p><span class="highlight-term">Quantum Entanglement</span> is a phenomenon where two or more particles become interconnected such that measuring the quantum state of one instantly reveals the state of the other, regardless of distance.</p>
<p><strong>The Shoe Box Analogy:</strong> Suppose you put one left shoe and one right shoe into two identical sealed boxes. If you open one box in New York and find a left shoe, you instantly know the box in Tokyo contains the right shoe.</p>`;
    }

    if (q.includes('gps') || q.includes('satellite')) {
      if (mode === 'guide') {
        return `${prefix}<p>If 1 satellite tells you you are 20,000 km away, you could be anywhere on a huge sphere. If a 2nd satellite also gives you its distance, those two spheres overlap in a circle.</p>
<p><em>How many total satellites do you think we need to pinpoint your exact 3D location (latitude, longitude, and altitude)?</em></p>`;
      }
      return `${prefix}<p><span class="highlight-term">GPS (Global Positioning System)</span> uses <strong>trilateration</strong> with signals transmitted from a constellation of 24+ orbiting satellites to determine your exact coordinates on Earth.</p>
<p>By measuring the precise time it takes radio signals to travel from at least 4 satellites, your receiver calculates the exact intersection point.</p>`;
    }

    // Default pedagogical response
    if (mode === 'guide') {
      return `${prefix}<p>That is an excellent topic to explore: <strong>"${newMessage}"</strong>.</p>
<p>Before we dive into the full explanation, <em>what is your current intuition about how this works, or what specific part feels most confusing?</em></p>`;
    }

    return `<p>Here is a structured explanation for <strong>"${newMessage}"</strong> tailored to your ${userLevel} level:</p>
<p>The core concept begins with understanding the primary objective: breaking down complex behavior into simple, predictable building blocks.</p>
<p>Feel free to click <strong>"Practice Quiz"</strong> below to test your understanding or <strong>"Explain Simpler"</strong> for a fresh analogy.</p>`;
  },
};
