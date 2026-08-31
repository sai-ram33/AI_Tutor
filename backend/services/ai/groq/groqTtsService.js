import { config } from '../../../config/env.js';

class GroqTtsService {
  constructor() {
    this.apiUrl = 'https://api.groq.com/openai/v1/audio/speech';
    this.supportedVoices = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'];
  }

  /**
   * Returns list of supported voice personas for Groq TTS
   */
  getAvailableVoices() {
    return this.supportedVoices;
  }

  /**
   * Splits long text into chunks of at most maxChunkSize characters while preserving sentence boundaries
   * @param {string} text - Input text
   * @param {number} [maxChunkSize=180] - Maximum chunk size (Groq limit is 200 chars)
   * @returns {string[]}
   */
  chunkText(text, maxChunkSize = 180) {
    const trimmed = text.trim();
    if (trimmed.length <= maxChunkSize) {
      return [trimmed];
    }

    const sentences = trimmed.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [trimmed];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if ((currentChunk + ' ' + trimmedSentence).trim().length <= maxChunkSize) {
        currentChunk = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If a single sentence exceeds maxChunkSize, split by commas or words
        if (trimmedSentence.length > maxChunkSize) {
          const words = trimmedSentence.split(' ');
          for (const word of words) {
            if ((currentChunk + ' ' + word).trim().length <= maxChunkSize) {
              currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = word;
            }
          }
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [trimmed];
  }

  /**
   * Combines multiple RIFF WAV audio buffers into a single valid WAV buffer
   * @param {Buffer[]} buffers - Array of WAV buffers
   * @returns {Buffer}
   */
  combineWavBuffers(buffers) {
    if (!buffers || buffers.length === 0) {
      throw new Error('No audio buffers provided to combine.');
    }
    if (buffers.length === 1) {
      return buffers[0];
    }

    const header = Buffer.from(buffers[0].subarray(0, 44));
    const audioDataSegments = buffers.map(b => b.subarray(44));
    const totalAudioData = Buffer.concat(audioDataSegments);

    const totalAudioLength = totalAudioData.length;
    const totalFileLength = totalAudioLength + 36;

    // RIFF ChunkSize at offset 4 (4 bytes, Little-Endian)
    header.writeUInt32LE(totalFileLength, 4);
    // data subchunk size at offset 40 (4 bytes, Little-Endian)
    header.writeUInt32LE(totalAudioLength, 40);

    return Buffer.concat([header, totalAudioData]);
  }

  /**
   * Generates audio for a single chunk of text
   * @private
   */
  async synthesizeSingleChunk({ text, voice, model }) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || config.groqTtsModel,
        input: text,
        voice: voice || config.groqTtsVoice,
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (_) {
        errorBody = { message: await response.text() };
      }
      throw this.normalizeError(response.status, errorBody);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generates speech/audio from input text using Groq TTS API
   * @param {Object} params
   * @param {string} params.text - The text to convert to speech
   * @param {string} [params.voice] - Voice persona ('autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy')
   * @param {string} [params.model] - TTS model name
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, format: string, byteLength: number}>}
   */
  async generateSpeech({ text, voice, model }) {
    // 1. Validate text input
    if (!text || typeof text !== 'string' || !text.trim()) {
      const err = new Error('Text is required and must not be empty.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate Groq API Key configuration
    if (!config.groqApiKey) {
      const err = new Error('Groq API key is not configured. Please set GROQ_API_KEY in backend/.env');
      err.statusCode = 500;
      throw err;
    }

    const selectedVoice = voice || config.groqTtsVoice || 'autumn';
    const selectedModel = model || config.groqTtsModel || 'canopylabs/orpheus-v1-english';

    console.log(`[Groq TTS] Synthesizing speech with model "${selectedModel}" and voice "${selectedVoice}"`);

    // 3. Chunk text if it exceeds single request limit
    const chunks = this.chunkText(text.trim());
    const audioBuffers = [];

    try {
      for (const chunk of chunks) {
        const chunkBuffer = await this.synthesizeSingleChunk({
          text: chunk,
          voice: selectedVoice,
          model: selectedModel,
        });
        audioBuffers.push(chunkBuffer);
      }

      const finalAudioBuffer = this.combineWavBuffers(audioBuffers);
      console.log(`[Groq TTS] Speech generated successfully (${finalAudioBuffer.length} bytes)`);

      return {
        audioBuffer: finalAudioBuffer,
        mimeType: 'audio/wav',
        format: 'wav',
        byteLength: finalAudioBuffer.length,
      };
    } catch (err) {
      console.error('[Groq TTS Service Error]:', err.message);
      throw err;
    }
  }

  /**
   * Normalizes Groq API errors into clean, safe user messages without leaking credentials
   * @private
   */
  normalizeError(status, errorBody) {
    const errorDetails = errorBody?.error || errorBody || {};
    const errorCode = errorDetails.code || '';
    const errorMsg = errorDetails.message || '';

    if (errorCode === 'model_terms_required' || errorMsg.includes('requires terms acceptance')) {
      const err = new Error(
        'The Groq TTS model requires terms acceptance. Please accept the model terms at https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english'
      );
      err.statusCode = 400;
      return err;
    }

    if (status === 401 || errorMsg.toLowerCase().includes('invalid api key') || errorMsg.toLowerCase().includes('unauthorized')) {
      const err = new Error('Groq API authentication failed. Please verify your GROQ_API_KEY in backend/.env.');
      err.statusCode = 401;
      return err;
    }

    if (status === 429 || errorMsg.toLowerCase().includes('rate limit')) {
      const err = new Error('Groq API rate limit reached. Please wait a moment and try again.');
      err.statusCode = 429;
      return err;
    }

    if (status === 404 || errorMsg.toLowerCase().includes('model not found')) {
      const err = new Error('The requested Groq TTS model is not available or unsupported.');
      err.statusCode = 404;
      return err;
    }

    const safeError = new Error(errorMsg || 'Text-to-audio generation failed. Please try again.');
    safeError.statusCode = status >= 400 && status < 600 ? status : 500;
    return safeError;
  }
}

export const groqTtsService = new GroqTtsService();
