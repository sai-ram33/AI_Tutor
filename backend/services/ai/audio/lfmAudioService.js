import { config } from '../../../config/env.js';

class LfmAudioClient {
  constructor() {
    this.serviceUrl = config.lfmAudioServiceUrl || 'http://127.0.0.1:8001';
  }

  /**
   * Checks the health of the local LFM Audio microservice
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
          service: 'lfm-audio',
          status: 'unavailable',
          error: `Service returned HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        service: 'lfm-audio',
        model: data.model || config.lfmAudioModel || 'LiquidAI/LFM2.5-Audio-1.5B',
        status: data.status || 'unknown',
        device: data.device || 'unknown',
        dtype: data.dtype || 'unknown',
        samplingRate: data.sampling_rate || 24000,
        ready: data.ready ?? (data.status === 'ready'),
        isMock: data.is_mock_fallback || false,
      };
    } catch (err) {
      return {
        success: false,
        service: 'lfm-audio',
        status: 'offline',
        error: 'LFM Audio microservice is not reachable. Ensure python lfm_audio_service.py is running on port 8001.',
      };
    }
  }

  /**
   * Fetches model information and capabilities from the audio microservice
   */
  async getModelInfo() {
    try {
      const response = await fetch(`${this.serviceUrl}/model-info`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        throw new Error(`LFM Audio microservice returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      return {
        success: false,
        model: config.lfmAudioModel || 'LiquidAI/LFM2.5-Audio-1.5B',
        status: 'offline',
        error: err.message,
      };
    }
  }

  /**
   * Sends an audio file (and optional message/history) to the LFM Audio microservice for audio-to-audio processing
   */
  async processAudio({
    audioBuffer,
    audioMimetype = 'audio/wav',
    audioOriginalName = 'recording.wav',
    message = '',
    history = [],
    userLevel = 'beginner',
    mode = 'explain',
  }) {
    if (!audioBuffer || audioBuffer.length === 0) {
      const err = new Error('Audio file buffer is required for audio chat processing.');
      err.statusCode = 400;
      throw err;
    }

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: audioMimetype });
    formData.append('audio', audioBlob, audioOriginalName);

    if (message && message.trim()) {
      formData.append('message', message.trim());
    }
    formData.append('history', JSON.stringify(history));
    formData.append('user_level', userLevel);
    formData.append('mode', mode);

    console.log('[LFM Audio Client] Sending audio request to Python microservice...');

    try {
      const response = await fetch(`${this.serviceUrl}/audio/chat`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180000), // 3-minute timeout for local CPU model inference
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail || `LFM Audio service error (HTTP ${response.status})`;
        const error = new Error(detail);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();
      console.log('[LFM Audio Client] Audio response received successfully from Python microservice');

      return {
        success: true,
        model: data.model || config.lfmAudioModel || 'LiquidAI/LFM2.5-Audio-1.5B',
        inputType: data.input_type || 'audio',
        text: data.text || '',
        audioBase64: data.audio_base64 || '',
        audioFormat: data.audio_format || 'wav',
        samplingRate: data.sampling_rate || 24000,
        durationSeconds: data.duration_seconds || 0,
        device: data.device || 'unknown',
        isFallback: data.is_fallback || false,
      };
    } catch (err) {
      console.error('[LFM Audio Client] Request failed:', err.message);

      if (err.name === 'TimeoutError') {
        const timeoutErr = new Error('LFM Audio inference timed out. Please try with a shorter audio recording.');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        const connErr = new Error(
          'LFM Audio microservice is currently offline. Please ensure python lfm_audio_service.py is running.'
        );
        connErr.statusCode = 503;
        throw connErr;
      }

      throw err;
    }
  }
}

export const lfmAudioService = new LfmAudioClient();
