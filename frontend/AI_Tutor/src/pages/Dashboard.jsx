import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LoadingDots } from '../components/LoadingDots';
import { ThemeToggle } from '../components/ThemeToggle';
import { api } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './Dashboard.css';

const STORAGE_KEY = 'ai_tutor_conversations';
const ACTIVE_CONV_KEY = 'ai_tutor_active_conv';

const initialDefaultConversations = [];

const starterPromptCards = [
  {
    icon: '🧠',
    title: 'Explain a Concept',
    desc: 'Break down quantum entanglement or neural networks with analogies',
    prompt: 'Explain quantum entanglement simply using an everyday analogy.',
    mode: 'explain',
  },
  {
    icon: '🐍',
    title: 'Python & Code',
    desc: 'Understand recursion, closures, or asynchronous event loops',
    prompt: 'Explain how recursion and the call stack work in Python with a code example.',
    mode: 'explain',
  },
  {
    icon: '💡',
    title: 'Socratic Guide',
    desc: 'Guide your thinking with hints instead of giving away the answer',
    prompt: 'Guide me step-by-step through how GPS triangulates location.',
    mode: 'guide',
  },
  {
    icon: '📝',
    title: 'Practice Quiz',
    desc: 'Test your understanding with 3 targeted knowledge-check questions',
    prompt: 'Give me 3 practice quiz questions on Python functions and scope.',
    mode: 'explain',
  },
];

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupConversationsByDate(conversations) {
  const groups = {
    'Pinned': [],
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Older': [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  conversations.forEach((conv) => {
    if (conv.pinned) {
      groups['Pinned'].push(conv);
      return;
    }

    const date = new Date(conv.updatedAt);
    if (date >= today) {
      groups['Today'].push(conv);
    } else if (date >= yesterday) {
      groups['Yesterday'].push(conv);
    } else if (date >= lastWeek) {
      groups['Previous 7 Days'].push(conv);
    } else {
      groups['Older'].push(conv);
    }
  });

  return Object.fromEntries(
    Object.entries(groups).filter(([, convos]) => convos.length > 0)
  );
}

export function Dashboard() {
  const navigate = useNavigate();

  // Load from localStorage or defaults
  const [conversations, setConversations] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    return initialDefaultConversations;
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    try {
      const storedActive = localStorage.getItem(ACTIVE_CONV_KEY);
      return storedActive || '1';
    } catch {
      return '1';
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    return api.getStoredUser() || { name: 'Sai Ram', level: 'intermediate' };
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [responseMode, setResponseMode] = useState('explain'); // 'explain' | 'guide'
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({}); // { [msgId]: 'like' | 'dislike' }

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const modeDropdownRef = useRef(null);

  // Load live user and conversations on mount if authenticated
  useEffect(() => {
    async function loadServerData() {
      if (api.isAuthenticated()) {
        try {
          const user = await api.getMe().catch(() => null);
          if (user) setCurrentUser(user);

          const serverConvs = await api.getConversations().catch(() => null);
          if (serverConvs && serverConvs.length > 0) {
            const loaded = await Promise.all(
              serverConvs.map(async (c) => {
                const msgs = await api.getMessages(c.id).catch(() => []);
                return {
                  id: String(c.id),
                  title: c.title,
                  pinned: false,
                  updatedAt: c.updated_at || c.created_at,
                  messages: msgs.map((m) => ({
                    id: String(m.id),
                    role: m.role === 'ai' ? 'assistant' : m.role,
                    content: m.content,
                    mode: m.mode,
                    timestamp: m.created_at,
                    metadata: { originalQuestion: c.title },
                  })),
                };
              })
            );
            setConversations(loaded);
            if (loaded[0]) setActiveConversationId(loaded[0].id);
          }
        } catch (err) {
          console.warn('Backend sync note:', err.message);
        }
      }

      // Check for pending question from Landing / Signup
      const pendingQ = sessionStorage.getItem('pendingQuestion');
      if (pendingQ) {
        sessionStorage.removeItem('pendingQuestion');
        setInputValue(pendingQ);
        setTimeout(() => textareaRef.current?.focus(), 150);
      }
    }
    loadServerData();
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [conversations]);

  // Save active conversation ID
  useEffect(() => {
    try {
      if (activeConversationId) {
        localStorage.setItem(ACTIVE_CONV_KEY, activeConversationId);
      }
    } catch (e) {
      console.error('Failed to save active conv ID', e);
    }
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConversationId, isLoading]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [inputValue]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Filter conversations by search
  const filteredConversations = searchQuery
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const groupedConversations = groupConversationsByDate(filteredConversations);

  const handleNewChat = () => {
    const newConv = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: 'New conversation',
      pinned: false,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMobileSidebarOpen(false);
    setInputValue('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
    setOpenMenuId(null);
  };

  const handleTogglePin = (e, id) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
    setOpenMenuId(null);
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (window.confirm('Delete this conversation?')) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      if (api.isAuthenticated() && !isNaN(Number(id))) {
        try {
          await api.deleteConversation(id);
        } catch (err) {
          console.warn('Backend delete sync error:', err.message);
        }
      }
    }
  };

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setEditingConversationId(conv.id);
    setEditTitle(conv.title);
    setOpenMenuId(null);
  };

  const handleSaveRename = async (id) => {
    const trimmed = editTitle.trim();
    if (trimmed) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: trimmed, updatedAt: new Date().toISOString() } : c
        )
      );
      if (api.isAuthenticated() && !isNaN(Number(id))) {
        try {
          await api.renameConversation(id, trimmed);
        } catch (err) {
          console.warn('Backend rename sync error:', err.message);
        }
      }
    }
    setEditingConversationId(null);
    setEditTitle('');
  };

  const handleCopyMessage = (msgId, content) => {
    // Strip HTML tags for clean clipboard copying
    const tempEl = document.createElement('div');
    tempEl.innerHTML = content;
    const textToCopy = tempEl.textContent || tempEl.innerText || '';
    navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleFeedback = (msgId, type) => {
    setFeedbackState((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type,
    }));
  };

  const handleStarterCardClick = (card) => {
    setResponseMode(card.mode);
    setInputValue(card.prompt);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Generate response mock
  const generateAIResponse = (prompt, mode) => {
    const lower = prompt.toLowerCase();
    let responseHtml = '';
    const prefix = mode === 'guide' ? `<p><strong>💡 Let's reason through this step-by-step:</strong></p>` : '';

    if (lower.includes('function')) {
      responseHtml = `${prefix}<p>A <span class="highlight-term">function</span> is a named, reusable block of instructions. In Python, you write <code>def name():</code> to define it.</p>
<pre><code>def square(n):
    return n * n

result = square(4) # 16</code></pre>`;
      if (mode === 'guide') {
        responseHtml += `<p><em>What do you think happens if you call <code>square()</code> without passing an argument?</em></p>`;
      }
    } else if (lower.includes('recursion') || lower.includes('recursive')) {
      responseHtml = `${prefix}<p><span class="highlight-term">Recursion</span> is a method where the solution depends on solutions to smaller instances of the same problem.</p>
<p>Every recursive function requires a <span class="highlight-term">base case</span> to terminate and prevent a stack overflow error.</p>`;
      if (mode === 'guide') {
        responseHtml += `<p><em>If you're counting down from 10 to 1, what should your base case be?</em></p>`;
      }
    } else if (lower.includes('quantum') || lower.includes('entangle')) {
      responseHtml = `${prefix}<p><span class="highlight-term">Quantum Entanglement</span> occurs when a pair of particles become interconnected such that measuring the state of one instantly dictates the state of the other, no matter the distance between them.</p>
<p><strong>Analogy:</strong> Imagine a pair of shoes placed in two identical sealed boxes. If you open your box in New York and find the left shoe, you instantly know the box opened in Tokyo contains the right shoe.</p>`;
    } else if (lower.includes('gps') || lower.includes('triangulat')) {
      responseHtml = `${prefix}<p><span class="highlight-term">GPS (Global Positioning System)</span> uses trilateration with signals from at least 4 orbiting satellites to calculate your precise latitude, longitude, and elevation.</p>`;
      if (mode === 'guide') {
        responseHtml += `<p><em>If 1 satellite tells you that you are 20,000 km away, your position forms a sphere. What shape is formed when 2 satellite spheres overlap?</em></p>`;
      }
    } else if (lower.includes('quiz') || lower.includes('practice') || lower.includes('question')) {
      responseHtml = `<p><strong>📝 3 Practice Quiz Questions:</strong></p>
<ol>
  <li>Explain the core difference between a parameter and an argument.</li>
  <li>What happens to variables defined inside a function when the function returns?</li>
  <li>Write a short function that checks if a number is even.</li>
</ol>`;
    } else {
      responseHtml = `${prefix}<p>Here is a clear, structured breakdown for <strong>"${prompt}"</strong>:</p>
<p>The foundational concept begins with understanding the core mechanisms before applying them to advanced use cases. Feel free to explore further with practice questions or a simpler analogy.</p>`;
    }

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + 1),
      role: 'assistant',
      mode,
      content: responseHtml,
      timestamp: new Date().toISOString(),
      metadata: { originalQuestion: prompt },
    };
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    let targetConvId = activeConversationId;
    let targetConv = conversations.find((c) => c.id === targetConvId);

    // If no active conversation or active conversation is empty and untitled
    if (!targetConv) {
      targetConvId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      targetConv = {
        id: targetConvId,
        title: userText.slice(0, 36),
        pinned: false,
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      setConversations((prev) => [targetConv, ...prev]);
      setActiveConversationId(targetConvId);
    }

    const userMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? {
              ...c,
              title: c.messages.length === 0 ? userText.slice(0, 36) : c.title,
              updatedAt: new Date().toISOString(),
              messages: [...c.messages, userMessage],
            }
          : c
      )
    );

    try {
      if (api.isAuthenticated()) {
        const isNumericId = !isNaN(Number(targetConvId)) && Number(targetConvId) > 0;
        const result = await api.sendMessage({
          conversationId: isNumericId ? Number(targetConvId) : undefined,
          message: userText,
          mode: responseMode,
        });

        if (result && result.aiMessage) {
          const realConvId = String(result.conversationId || targetConvId);
          const aiMsg = {
            id: String(result.aiMessage.id || Date.now() + 1),
            role: 'assistant',
            mode: result.aiMessage.mode || responseMode,
            content: result.aiMessage.content,
            timestamp: result.aiMessage.created_at || new Date().toISOString(),
            metadata: { originalQuestion: userText },
          };

          setConversations((prev) =>
            prev.map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    id: realConvId,
                    updatedAt: new Date().toISOString(),
                    messages: [...c.messages, aiMsg],
                  }
                : c
            )
          );

          if (realConvId !== targetConvId) {
            setActiveConversationId(realConvId);
          }

          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend chat API note (using built-in generator):', err.message);
    }

    // Resilient fallback generator
    await new Promise((resolve) => setTimeout(resolve, 800));
    const aiMessage = generateAIResponse(userText, responseMode);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: [...c.messages, aiMessage],
            }
          : c
      )
    );

    setIsLoading(false);
  };

  const handleExplainSimpler = async (originalQuestion) => {
    if (isLoading || !originalQuestion) return;
    setIsLoading(true);

    try {
      if (api.isAuthenticated() && !isNaN(Number(activeConversationId))) {
        const result = await api.sendMessage({
          conversationId: Number(activeConversationId),
          message: `Explain simpler: ${originalQuestion}`,
          mode: 'explain',
          action: 'simplify',
        });

        if (result && result.aiMessage) {
          const simplerMessage = {
            id: String(result.aiMessage.id || Date.now() + 1),
            role: 'assistant',
            mode: 'explain',
            content: result.aiMessage.content,
            timestamp: result.aiMessage.created_at || new Date().toISOString(),
            metadata: { originalQuestion },
          };

          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, simplerMessage] }
                : c
            )
          );
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend explain simpler note:', err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    const simplerMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + 1),
      role: 'assistant',
      mode: 'explain',
      content: `<p><strong>💡 Simpler Explanation:</strong></p>
<p>Think of it in the simplest possible terms: everything boils down to input, processing, and output. No complicated jargon — just step 1 leading naturally to step 2.</p>`,
      timestamp: new Date().toISOString(),
      metadata: { originalQuestion },
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, simplerMessage] }
          : c
      )
    );

    setIsLoading(false);
  };

  const handleGeneratePractice = async (originalQuestion) => {
    if (isLoading || !originalQuestion) return;
    setIsLoading(true);

    try {
      if (api.isAuthenticated() && !isNaN(Number(activeConversationId))) {
        const result = await api.sendMessage({
          conversationId: Number(activeConversationId),
          message: `Practice quiz for: ${originalQuestion}`,
          mode: 'explain',
          action: 'generate_practice',
        });

        if (result && result.aiMessage) {
          const quizMessage = {
            id: String(result.aiMessage.id || Date.now() + 1),
            role: 'assistant',
            mode: 'explain',
            content: result.aiMessage.content,
            timestamp: result.aiMessage.created_at || new Date().toISOString(),
            metadata: { originalQuestion },
          };

          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, quizMessage] }
                : c
            )
          );
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend practice quiz note:', err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    const quizMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + 1),
      role: 'assistant',
      mode: 'explain',
      content: `<p><strong>📝 3 Follow-Up Practice Questions on "${originalQuestion.slice(0, 30)}":</strong></p>
<ol>
  <li>How would you summarize this concept to a 10-year-old?</li>
  <li>What is the single most common mistake beginners make with this?</li>
  <li>Give a real-world scenario where you would use this.</li>
</ol>`,
      timestamp: new Date().toISOString(),
      metadata: { originalQuestion },
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, quizMessage] }
          : c
      )
    );

    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`claude-dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Claude-Style Sidebar */}
      <aside className={`dashboard-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-logo-icon">✦</div>
            <span className="brand-title">AI Teacher</span>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label="Toggle sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            className="sidebar-new-chat-btn"
            onClick={handleNewChat}
          >
            <span className="new-chat-plus">+</span>
            <span className="new-chat-text">Start new chat</span>
          </button>

          {/* Search Box */}
          <div className="sidebar-search-container">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search chats"
            />
          </div>
        </div>

        {/* Conversation List */}
        <nav className="sidebar-nav-scroll" aria-label="Chat history">
          {Object.entries(groupedConversations).length === 0 ? (
            <div className="sidebar-empty-state">
              <p>No conversations found</p>
            </div>
          ) : (
            Object.entries(groupedConversations).map(([groupTitle, convList]) => (
              <div key={groupTitle} className="conv-group">
                <div className="conv-group-heading">{groupTitle}</div>
                <div className="conv-list">
                  {convList.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    const isEditing = editingConversationId === conv.id;
                    const isMenuOpen = openMenuId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className={`conv-item ${isActive ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}`}
                        onClick={() => handleSelectConversation(conv.id)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            className="conv-rename-input"
                            value={editTitle}
                            autoFocus
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(conv.id);
                              if (e.key === 'Escape') setEditingConversationId(null);
                            }}
                            onBlur={() => handleSaveRename(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <div className="conv-main-info">
                              {conv.pinned && <span className="pin-indicator" title="Pinned">📌</span>}
                              <span className="conv-title">{conv.title}</span>
                            </div>

                            <div className="conv-actions" ref={isMenuOpen ? menuRef : null}>
                              <button
                                type="button"
                                className="conv-menu-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(isMenuOpen ? null : conv.id);
                                }}
                                aria-label="Conversation actions"
                              >
                                ⋯
                              </button>

                              {isMenuOpen && (
                                <div className="conv-menu-popover" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="menu-option"
                                    onClick={(e) => handleTogglePin(e, conv.id)}
                                  >
                                    <span>{conv.pinned ? 'Unpin chat' : 'Pin chat'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-option"
                                    onClick={(e) => handleStartRename(e, conv)}
                                  >
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-option menu-danger"
                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                  >
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="sidebar-footer">
          <div className="user-profile-pill" onClick={() => navigate('/profile')}>
            <Avatar name={currentUser?.name || 'User'} size="sm" />
            <div className="user-info">
              <span className="user-name">{currentUser?.name || 'Learner'}</span>
              <span className="user-tier">
                {currentUser?.level ? currentUser.level.charAt(0).toUpperCase() + currentUser.level.slice(1) : 'Beginner'} • Free
              </span>
            </div>
          </div>
          <ThemeToggle className="sidebar-theme-toggle" />
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="dashboard-workspace">
        {/* Workspace Header */}
        <header className="workspace-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {sidebarCollapsed && (
              <button
                type="button"
                className="header-expand-btn"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
              </button>
            )}

            <h2 className="header-conv-title">
              {activeConversation?.messages.length
                ? activeConversation.title
                : 'New Conversation'}
            </h2>
          </div>

          <div className="header-right">
            <div className="active-mode-indicator">
              <span className="mode-pill-dot" />
              <span>{responseMode === 'guide' ? '💡 Guide Mode' : '🎓 Explain Mode'}</span>
            </div>
            <Link to="/profile" className="header-avatar-link" title="Your profile">
              <Avatar name={currentUser?.name || 'User'} size="sm" />
            </Link>
          </div>
        </header>

        {/* Workspace Body Area */}
        <div className="workspace-body">
          {activeConversation && activeConversation.messages.length > 0 ? (
            /* Active Message Feed */
            <div className="claude-messages-feed">
              {activeConversation.messages.map((message) => {
                const isAssistant = message.role === 'assistant';
                const isCopied = copiedMessageId === message.id;
                const feedback = feedbackState[message.id];

                return (
                  <div
                    key={message.id}
                    className={`message-row ${isAssistant ? 'assistant-row' : 'user-row'}`}
                  >
                    <div className="message-container">
                      <div className="message-avatar-col">
                        {isAssistant ? (
                          <div className="ai-message-avatar">✦</div>
                        ) : (
                          <Avatar name={currentUser?.name || 'You'} size="sm" />
                        )}
                      </div>

                      <div className="message-content-col">
                        <div className="message-meta-header">
                          <span className="message-sender-name">
                            {isAssistant ? 'AI Teacher' : 'You'}
                          </span>
                          {isAssistant && message.mode && (
                            <span className="message-mode-badge">
                              {message.mode === 'guide' ? 'Guide' : 'Explain'}
                            </span>
                          )}
                          <time className="message-timestamp">
                            {formatRelativeTime(message.timestamp)}
                          </time>
                        </div>

                        <div className="message-prose-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    {...props}
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code {...props} className={className}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>

                        {/* Claude-Style Action Toolbar on Assistant Messages */}
                        {isAssistant && (
                          <div className="message-action-toolbar">
                            <button
                              type="button"
                              className={`action-btn ${isCopied ? 'copied' : ''}`}
                              onClick={() => handleCopyMessage(message.id, message.content)}
                              title="Copy explanation"
                            >
                              {isCopied ? '✓ Copied' : '📋 Copy'}
                            </button>

                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => handleExplainSimpler(message.metadata?.originalQuestion)}
                              disabled={isLoading}
                              title="Explain in simpler terms"
                            >
                              💡 Explain simpler
                            </button>

                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => handleGeneratePractice(message.metadata?.originalQuestion)}
                              disabled={isLoading}
                              title="Generate 3 quiz questions"
                            >
                              📝 Practice quiz
                            </button>

                            <div className="feedback-group">
                              <button
                                type="button"
                                className={`action-icon-btn ${feedback === 'like' ? 'active' : ''}`}
                                onClick={() => handleFeedback(message.id, 'like')}
                                title="Good response"
                                aria-label="Thumbs up"
                              >
                                👍
                              </button>
                              <button
                                type="button"
                                className={`action-icon-btn ${feedback === 'dislike' ? 'active' : ''}`}
                                onClick={() => handleFeedback(message.id, 'dislike')}
                                title="Needs improvement"
                                aria-label="Thumbs down"
                              >
                                👎
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="message-row assistant-row loading-row">
                  <div className="message-container">
                    <div className="message-avatar-col">
                      <div className="ai-message-avatar">✦</div>
                    </div>
                    <div className="message-content-col">
                      <div className="message-meta-header">
                        <span className="message-sender-name">AI Teacher</span>
                        <span className="typing-indicator-text">Thinking...</span>
                      </div>
                      <div className="loading-dots-container">
                        <LoadingDots />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="feed-bottom-anchor" />
            </div>
          ) : (
            /* Claude-Style Welcoming Empty State */
            <div className="claude-empty-state">
              <div className="empty-greeting-container">
                <div className="empty-sparkle-icon">✦</div>
                <h1 className="empty-greeting-title">
                  {getTimeGreeting()}, <span className="greeting-name">{currentUser?.name || 'Learner'}</span>
                </h1>
                <p className="empty-greeting-subtitle">
                  What concept, question, or challenge would you like to master today?
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="starter-cards-grid">
                {starterPromptCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="starter-card"
                    onClick={() => handleStarterCardClick(card)}
                  >
                    <div className="starter-card-top">
                      <span className="starter-card-icon">{card.icon}</span>
                      <span className="starter-card-arrow">↗</span>
                    </div>
                    <h3 className="starter-card-title">{card.title}</h3>
                    <p className="starter-card-desc">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Claude-Style Floating Input Bar */}
        <div className="workspace-footer">
          <form className="claude-input-card" onSubmit={handleSendMessage}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or request guidance..."
              className="claude-textarea"
              disabled={isLoading}
              aria-label="Message prompt input"
            />

            <div className="input-card-controls">
              <div className="controls-left">
                {/* Mode Selector Dropdown */}
                <div className="mode-picker-wrapper" ref={modeDropdownRef}>
                  <button
                    type="button"
                    className="mode-picker-btn"
                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                    aria-haspopup="true"
                    aria-expanded={isModeDropdownOpen}
                  >
                    <span className="picker-icon">{responseMode === 'guide' ? '💡' : '🎓'}</span>
                    <span className="picker-text">
                      {responseMode === 'guide' ? 'Guide Mode' : 'Explain Mode'}
                    </span>
                    <span className="picker-chevron">▾</span>
                  </button>

                  {isModeDropdownOpen && (
                    <div className="mode-picker-menu" role="menu">
                      <button
                        type="button"
                        className={`mode-menu-item ${responseMode === 'explain' ? 'active' : ''}`}
                        onClick={() => {
                          setResponseMode('explain');
                          setIsModeDropdownOpen(false);
                        }}
                      >
                        <span className="item-icon">🎓</span>
                        <div className="item-details">
                          <span className="item-title">Explain Mode</span>
                          <span className="item-desc">Direct intuitive breakdown & code</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`mode-menu-item ${responseMode === 'guide' ? 'active' : ''}`}
                        onClick={() => {
                          setResponseMode('guide');
                          setIsModeDropdownOpen(false);
                        }}
                      >
                        <span className="item-icon">💡</span>
                        <div className="item-details">
                          <span className="item-title">Guide Mode (Socratic)</span>
                          <span className="item-desc">Guided prompts & step-by-step thinking</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="controls-right">

                <button type="button" className="voice-btn" title="Voice Input" aria-label="Voice Input">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                  </svg>
                </button>

                <button type="button" className="advanced-voice-btn" title="Advanced Voice" aria-label="Advanced Voice">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="6" y1="9" x2="6" y2="15"></line>
                    <line x1="18" y1="9" x2="18" y2="15"></line>
                    <line x1="9" y1="7" x2="9" y2="17"></line>
                    <line x1="15" y1="7" x2="15" y2="17"></line>
                  </svg>
                </button>

                <button
                  type="submit"
                  className="send-arrow-btn"
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </form>
          <div className="workspace-disclaimer">
            AI Teacher can make mistakes. Verify critical facts and formulas.
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;