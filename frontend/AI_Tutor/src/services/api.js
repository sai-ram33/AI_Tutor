import {
  auth,
  firebaseSignUp,
  firebaseLogin,
  firebaseGoogleLogin,
  firebaseLogout,
  firebaseResetPassword,
  firestoreService,
} from './firebase';

const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .trim()
  .replace(/\/+$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const TOKEN_KEY = 'ai_tutor_auth_token';
const USER_KEY = 'ai_tutor_user_profile';

class ApiService {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to set auth token', e);
    }
  }

  getStoredUser() {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  setStoredUser(user) {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.error('Failed to set stored user', e);
    }
  }

  getCurrentUserId() {
    const user = this.getStoredUser();
    if (user && (user.uid || user.id)) {
      return String(user.uid || user.id);
    }
    return auth.currentUser ? auth.currentUser.uid : 'guest_user';
  }

  isAuthenticated() {
    return !!(this.getToken() || auth.currentUser);
  }

  async logout() {
    try {
      await firebaseLogout();
    } catch (e) {
      console.warn('Firebase logout note:', e.message);
    }
    this.setToken(null);
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('ai_tutor_active_conv');
    } catch {
      // Ignored
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    let token = this.getToken();

    // If no token in localStorage, try getting active Firebase ID token
    if (!token && auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
        this.setToken(token);
      } catch (err) {
        console.warn('Could not refresh Firebase token', err);
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutMs = options.timeout || 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config = {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && token && !endpoint.startsWith('/chat') && !endpoint.startsWith('/ai')) {
          // Token expired or invalid
          this.setToken(null);
        }
        const errorMsg = data.error || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      // Backend might be offline or Postgres error
      console.warn(`[API Request Error] ${url}:`, err.message);
      throw err;
    }
  }

  // --- Auth Endpoints (Firebase Primary + Backend Postgres Sync) ---
  async signup({ name, email, password, level = 'beginner', language = 'english' }) {
    // 1. Authenticate & store login credentials in Firebase Auth + Firestore
    const firebaseResult = await firebaseSignUp({ name, email, password, level, language });
    const { user, token } = firebaseResult;

    if (token) this.setToken(token);
    if (user) this.setStoredUser(user);

    // 2. Sync to PostgreSQL in background without blocking the user interface
    this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, level, language }),
      timeout: 3000,
    }).catch(() => {
      console.info('ℹ️ PostgreSQL unavailable. Account saved via Firebase Auth.');
    });

    return { user, token };
  }

  async login({ email, password }) {
    // 1. Authenticate with Firebase Auth
    const firebaseResult = await firebaseLogin({ email, password });
    const { user, token } = firebaseResult;

    if (token) this.setToken(token);
    if (user) this.setStoredUser(user);

    // 2. Sync / verify session with backend in background
    this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      timeout: 3000,
    }).catch(() => {
      console.info('ℹ️ PostgreSQL unavailable. Authenticated via Firebase Auth.');
    });

    return { user, token };
  }

  async googleLogin() {
    // 1. Firebase Google Popup Sign-in
    const firebaseResult = await firebaseGoogleLogin();
    const { user, token } = firebaseResult;

    if (token) this.setToken(token);
    if (user) this.setStoredUser(user);

    // 2. Sync to PostgreSQL in background
    this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken: token }),
      timeout: 3000,
    }).catch(() => {
      console.info('ℹ️ PostgreSQL unavailable. Authenticated via Firebase Google Sign-in.');
    });

    return { user, token };
  }

  async resetPassword(email) {
    return await firebaseResetPassword(email);
  }

  // --- User Profile & Stats Endpoints (Postgres with Firestore Fallback) ---
  async getMe() {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      const data = await this.request('/users/me');
      if (data.user) {
        this.setStoredUser(data.user);
        return data.user;
      }
    } catch {
      // Fallback to Firestore
      try {
        const fsUser = await firestoreService.getUserProfile(uid);
        if (fsUser) {
          this.setStoredUser(fsUser);
          return fsUser;
        }
      } catch (fsErr) {
        console.warn('Firestore getMe note:', fsErr.message);
      }
    }

    return this.getStoredUser();
  }

  async updateMe({ name, level, language }) {
    const uid = this.getCurrentUserId();
    const current = this.getStoredUser() || {};
    const updated = {
      ...current,
      ...(name !== undefined ? { name } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(language !== undefined ? { language } : {}),
    };

    // Save to Firestore fallback
    await firestoreService.saveUserProfile(uid, updated);
    this.setStoredUser(updated);

    // Also attempt PostgreSQL update
    try {
      const data = await this.request('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, level, language }),
      });
      if (data.user) {
        this.setStoredUser(data.user);
        return data.user;
      }
    } catch {
      // Postgres offline, Firestore updated
    }

    return updated;
  }

  async getUserStats() {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      const data = await this.request('/users/me/stats');
      if (data.stats) return data.stats;
    } catch {
      // Fallback to Firestore
      return await firestoreService.getUserStats(uid);
    }
  }

  // --- Conversation Endpoints (Postgres with Firestore Fallback) ---
  async getConversations() {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      const data = await this.request('/conversations');
      if (data.conversations && data.conversations.length > 0) {
        return data.conversations;
      }
    } catch {
      // Fallback to Firestore
    }

    // Load from Firestore
    const fsConvs = await firestoreService.getConversations(uid);
    return fsConvs;
  }

  async createConversation(title = 'New Chat') {
    const uid = this.getCurrentUserId();
    const tempId = String(Date.now());
    const newConv = {
      id: tempId,
      title,
      pinned: false,
      updatedAt: new Date().toISOString(),
    };

    // Try PostgreSQL
    try {
      const data = await this.request('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      if (data.conversation) {
        // Also mirror to Firestore
        firestoreService.saveConversation(uid, data.conversation).catch(() => {});
        return data.conversation;
      }
    } catch {
      // Fallback: save to Firestore
      await firestoreService.saveConversation(uid, newConv);
    }

    return newConv;
  }

  async renameConversation(id, title) {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      const data = await this.request(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      if (data.conversation) {
        firestoreService.updateConversationTitle(uid, id, title).catch(() => {});
        return data.conversation;
      }
    } catch {
      // Fallback to Firestore
      await firestoreService.updateConversationTitle(uid, id, title);
    }

    return { id, title };
  }

  async deleteConversation(id) {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      await this.request(`/conversations/${id}`, {
        method: 'DELETE',
      });
    } catch {
      // Fallback
    }

    // Delete in Firestore
    await firestoreService.deleteConversation(uid, id);
    return { success: true };
  }

  async getMessages(conversationId) {
    const uid = this.getCurrentUserId();

    // Try PostgreSQL
    try {
      const data = await this.request(`/conversations/${conversationId}/messages`);
      if (data.messages && data.messages.length > 0) {
        return data.messages;
      }
    } catch {
      // Fallback to Firestore
    }

    // Load from Firestore
    return await firestoreService.getMessages(uid, conversationId);
  }

  // --- Chat Endpoint (Mistral AI Reasoning + Dual Persistence) ---
  async sendMessage({ conversationId, message, mode = 'explain', action = null }) {
    const uid = this.getCurrentUserId();
    const result = await this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message, mode, action }),
    });

    // Mirror to Firestore so data is never lost
    try {
      const convId = result.conversationId || conversationId || String(Date.now());
      if (result.userMessage) {
        await firestoreService.saveMessage(uid, convId, {
          id: result.userMessage.id || String(Date.now()),
          role: 'user',
          content: message,
          mode,
          timestamp: result.userMessage.created_at || new Date().toISOString(),
        });
      }
      if (result.aiMessage) {
        await firestoreService.saveMessage(uid, convId, {
          id: result.aiMessage.id || String(Date.now() + 1),
          role: 'assistant',
          content: result.aiMessage.content,
          mode: result.aiMessage.mode || mode,
          timestamp: result.aiMessage.created_at || new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore message mirror note:', fsErr.message);
    }

    return result;
  }

  // --- Vision Endpoint ---
  async sendVisionMessage({ conversationId, message, imageFile, mode = 'explain', action = null }) {
    const uid = this.getCurrentUserId();
    const url = `${API_BASE_URL}/vision/chat`;
    let token = this.getToken();
    if (!token && auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {}
    }
    
    const formData = new FormData();
    if (conversationId) formData.append('conversationId', conversationId);
    if (message) formData.append('message', message);
    if (mode) formData.append('mode', mode);
    if (action) formData.append('action', action);
    if (imageFile) formData.append('image', imageFile);

    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }

    // Mirror to Firestore
    try {
      const convId = data.conversationId || conversationId || String(Date.now());
      if (data.userMessage) {
        await firestoreService.saveMessage(uid, convId, {
          id: data.userMessage.id || String(Date.now()),
          role: 'user',
          content: message,
          mode,
          timestamp: new Date().toISOString(),
        });
      }
      if (data.aiMessage) {
        await firestoreService.saveMessage(uid, convId, {
          id: data.aiMessage.id || String(Date.now() + 1),
          role: 'assistant',
          content: data.aiMessage.content,
          mode,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore vision mirror note:', fsErr.message);
    }

    return data;
  }

  // --- AI / TTS Endpoints ---
  async generateAudio(text, voice) {
    const url = `${API_BASE_URL}/ai/text-to-audio`;
    let token = this.getToken();
    if (!token && auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {}
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`TTS failed: ${response.status} ${errText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}

export const api = new ApiService();
export default api;
