const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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

  isAuthenticated() {
    return Boolean(this.getToken());
  }

  logout() {
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
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If unauthorized and has token, clear expired token
        if (response.status === 401 && token) {
          this.setToken(null);
        }
        const errorMsg = data.error || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.warn(`[API Request Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // --- Auth Endpoints ---
  async signup({ name, email, password, level = 'beginner', language = 'english' }) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, level, language }),
    });
    if (data.token) this.setToken(data.token);
    if (data.user) this.setStoredUser(data.user);
    return data;
  }

  async login({ email, password }) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) this.setToken(data.token);
    if (data.user) this.setStoredUser(data.user);
    return data;
  }

  async googleLogin(idToken) {
    const data = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (data.token) this.setToken(data.token);
    if (data.user) this.setStoredUser(data.user);
    return data;
  }

  // --- User Profile & Stats Endpoints ---
  async getMe() {
    const data = await this.request('/users/me');
    if (data.user) this.setStoredUser(data.user);
    return data.user;
  }

  async updateMe({ name, level, language }) {
    const data = await this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, level, language }),
    });
    if (data.user) this.setStoredUser(data.user);
    return data.user;
  }

  async getUserStats() {
    const data = await this.request('/users/me/stats');
    return data.stats;
  }

  // --- Conversation Endpoints ---
  async getConversations() {
    const data = await this.request('/conversations');
    return data.conversations;
  }

  async createConversation(title = 'New Chat') {
    const data = await this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    return data.conversation;
  }

  async renameConversation(id, title) {
    const data = await this.request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    return data.conversation;
  }

  async deleteConversation(id) {
    return await this.request(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  async getMessages(conversationId) {
    const data = await this.request(`/conversations/${conversationId}/messages`);
    return data.messages;
  }

  // --- Chat Endpoint ---
  async sendMessage({ conversationId, message, mode = 'explain', action = null }) {
    return await this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message, mode, action }),
    });
  }
}

export const api = new ApiService();
export default api;
