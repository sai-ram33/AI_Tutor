import { config } from '../../../config/env.js';

class QwenClient {
  constructor() {
    this.serviceUrl = config.qwenServiceUrl || 'http://127.0.0.1:8000';
  }

  /**
   * Checks the health of the local Qwen vision service
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return {
          success: false,
          service: 'qwen-vision',
          status: 'unavailable',
          error: `Service returned HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        service: 'qwen-vision',
        model: data.model || 'Qwen/Qwen2.5-VL-3B-Instruct',
        status: data.status || 'unknown',
        device: data.device || 'unknown',
      };
    } catch (err) {
      return {
        success: false,
        service: 'qwen-vision',
        status: 'offline',
        error: 'Qwen Vision microservice is not reachable. Please ensure python qwen_service.py is running.',
      };
    }
  }

  /**
   * Sends an image and prompt to the Qwen Vision microservice for explanation
   */
  async generate({
    imageBuffer,
    imageMimetype = 'image/jpeg',
    imageOriginalName = 'upload.jpg',
    message,
    history = [],
    userLevel = 'beginner',
    mode = 'explain',
  }) {
    if (!message || !message.trim()) {
      throw new Error('Instruction message is required.');
    }

    const formData = new FormData();

    if (imageBuffer) {
      const blob = new Blob([imageBuffer], { type: imageMimetype });
      formData.append('image', blob, imageOriginalName);
    }

    formData.append('message', message.trim());
    formData.append('history', JSON.stringify(history));
    formData.append('user_level', userLevel);
    formData.append('mode', mode);

    console.log('[Qwen Vision] Sending request to vision service');

    try {
      const response = await fetch(`${this.serviceUrl}/generate`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000), // 2 min timeout for local model inference
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail || `Vision service error (HTTP ${response.status})`;
        const error = new Error(detail);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();
      console.log('[Qwen Vision] Response received from vision service');

      return {
        success: true,
        model: data.model || 'Qwen/Qwen2.5-VL-3B-Instruct',
        response: data.response || '',
        device: data.device || 'unknown',
      };
    } catch (err) {
      console.error('[Qwen Vision] Request failed:', err.message);

      if (err.name === 'TimeoutError') {
        const timeoutErr = new Error('Qwen Vision inference timed out. Please try again.');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        if (config.mistralApiKey) {
          console.log('[Qwen Vision] Local service offline, falling back to Mistral Pixtral API');
          return await this.fallbackToMistral({ imageBuffer, imageMimetype, message, history, mode, userLevel });
        }

        const connErr = new Error(
          'Qwen Vision service is currently offline. Please ensure the Python Qwen service is started.'
        );
        connErr.statusCode = 503;
        throw connErr;
      }

      throw err;
    }
  }

  /**
   * Fallback to Mistral Vision API (pixtral-12b-2409) if local python server is off
   */
  async fallbackToMistral({ imageBuffer, imageMimetype, message, history, mode, userLevel }) {
    try {
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${imageMimetype};base64,${base64Image}`;
      
      const systemPrompt = `You are an AI Teacher with image understanding capability. A student with a '${userLevel}' learning level is asking for help.\n\nThe user can provide an image and a question. Analyze the complete visual content of the image.\n\nUse simple English, explain step-by-step, and never fabricate information from the image.`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.mistralApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'pixtral-12b-2409',
          temperature: mode === 'explain' ? 0.4 : 0.6,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: message },
                { type: 'image_url', image_url: { url: dataUrl } }
              ] 
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        model: 'Mistral/pixtral-12b-2409',
        response: data.choices[0].message.content,
        device: 'cloud'
      };
    } catch (err) {
      console.error('[Mistral Fallback] Failed:', err.message);
      throw new Error('Both Local Vision and Cloud Vision (Mistral) are currently unavailable.');
    }
  }
}

export const qwenClient = new QwenClient();
export const qwenVisionService = qwenClient;
