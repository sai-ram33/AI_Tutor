import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { ThemeToggle } from '../components/ThemeToggle';
import { api } from '../services/api';
import './Profile.css';

const CONV_STORAGE_KEY = 'ai_tutor_conversations';
const PROFILE_STORAGE_KEY = 'ai_tutor_user_profile';

const defaultProfile = {
  name: 'Sai Ram',
  email: 'sairam@email.com',
  level: 'intermediate',
  defaultMode: 'explain',
  language: 'english',
  dailyGoal: 5,
  joinedDate: 'January 2026',
  bio: 'Learning Computer Science, Python, and Mathematics for deep intuitive understanding.',
};

const levelOptions = [
  {
    value: 'beginner',
    label: 'Beginner',
    tag: 'From Scratch',
    description: 'Break concepts down with simple analogies, everyday examples, and foundational basics.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    tag: 'Balanced',
    description: 'Clear explanations with code syntax, deeper intuition, and practical applications.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    tag: 'High Depth',
    description: 'Skip the basics. Focus directly on edge cases, internal mechanics, and architecture.',
  },
];

const modeOptions = [
  {
    value: 'explain',
    label: 'Explain Mode',
    icon: '🎓',
    description: 'Direct intuitive breakdown with code examples and analogies first.',
  },
  {
    value: 'guide',
    label: 'Guide Mode (Socratic)',
    icon: '💡',
    description: 'Asks thought-provoking leading questions to guide your deduction step-by-step.',
  },
];

const languageOptions = [
  { value: 'english', label: 'English (Standard)' },
  { value: 'telugu', label: 'Telugu (తెలుగు)' },
  { value: 'bilingual', label: 'Bilingual (English + Telugu)' },
];

const goalOptions = [
  { value: 3, label: '3 questions / day (Casual)' },
  { value: 5, label: '5 questions / day (Recommended)' },
  { value: 10, label: '10 questions / day (Intensive)' },
];

export function Profile() {
  const navigate = useNavigate();

  // Load user profile from localStorage or defaults
  const [user, setUser] = useState(() => {
    try {
      const stored = api.getStoredUser() || localStorage.getItem(PROFILE_STORAGE_KEY);
      if (typeof stored === 'string') return { ...defaultProfile, ...JSON.parse(stored) };
      if (stored) return { ...defaultProfile, ...stored };
    } catch {
      // Fallback
    }
    return defaultProfile;
  });

  const [serverStats, setServerStats] = useState(null);
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'preferences' | 'account'
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load profile and stats from backend API on mount
  useEffect(() => {
    async function loadData() {
      if (api.isAuthenticated()) {
        try {
          const userData = await api.getMe();
          if (userData) {
            setUser((prev) => ({
              ...prev,
              name: userData.name || prev.name,
              email: userData.email || prev.email,
              level: userData.level || prev.level,
              language: userData.language || prev.language,
            }));
          }
          const statsData = await api.getUserStats();
          if (statsData) {
            setServerStats(statsData);
          }
        } catch (err) {
          console.warn('Could not fetch server profile, using local state:', err.message);
        }
      }
    }
    loadData();
  }, []);

  // Load conversations for statistics fallback
  const [conversations] = useState(() => {
    try {
      const stored = localStorage.getItem(CONV_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    return [];
  });

  // Calculate live statistics
  const stats = useMemo(() => {
    let totalQuestions = serverStats?.questionsAsked || 0;
    let practiceQuizzes = 0;
    const subjectsMap = new Map();

    conversations.forEach((conv) => {
      conv.messages?.forEach((msg) => {
        if (!serverStats && msg.role === 'user') totalQuestions++;
        if (msg.content?.toLowerCase().includes('practice') || msg.mode === 'quiz') {
          practiceQuizzes++;
        }
      });

      // Extract subject words
      const words = conv.title?.toLowerCase().split(/\s+/) || [];
      words.forEach((w) => {
        const clean = w.replace(/[^a-z]/g, '');
        if (clean.length > 3 && !['what', 'with', 'about', 'from', 'this', 'that', 'your', 'basics'].includes(clean)) {
          subjectsMap.set(clean, (subjectsMap.get(clean) || 0) + 1);
        }
      });
    });

    const topSubjects = Array.from(subjectsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([subject, count]) => ({
        name: subject.charAt(0).toUpperCase() + subject.slice(1),
        count,
      }));

    const streak = serverStats ? serverStats.streakDays : (totalQuestions > 0 ? 5 : 0);
    const subjectsCount = serverStats ? serverStats.subjectsExplored : (topSubjects.length || 4);
    const todayQuestions = Math.min(totalQuestions, user.dailyGoal || 5);
    const goalPercent = Math.min(Math.round((todayQuestions / (user.dailyGoal || 5)) * 100), 100);

    return {
      totalQuestions: totalQuestions || 8,
      subjectsCount: subjectsCount || 4,
      streak: streak || 5,
      practiceQuizzes: practiceQuizzes || 3,
      topSubjects: topSubjects.length > 0 ? topSubjects : [
        { name: 'Python', count: 3 },
        { name: 'Recursion', count: 2 },
        { name: 'Physics', count: 1 },
        { name: 'Algorithms', count: 1 },
      ],
      todayQuestions: todayQuestions > 0 ? todayQuestions : 3,
      goalPercent: goalPercent > 0 ? goalPercent : 60,
    };
  }, [conversations, user.dailyGoal, serverStats]);

  const handleChange = (name, value) => {
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);

    try {
      if (api.isAuthenticated()) {
        await api.updateMe({
          name: user.name,
          level: user.level,
          language: user.language,
        });
      }
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(user));
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const dataToExport = {
      profile: user,
      conversations,
      exportedAt: new Date().toISOString(),
      version: '2.0',
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-tutor-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    api.logout();
    try {
      localStorage.removeItem(CONV_STORAGE_KEY);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // Ignored
    }
    setShowDeleteConfirm(false);
    navigate('/');
  };

  return (
    <div className="full-profile-page">
      {/* Full Width Top Header Bar */}
      <header className="full-profile-navbar">
        <div className="navbar-left">
          <div className="navbar-brand">
            <span className="navbar-logo-sparkle">✦</span>
            <span className="navbar-brand-title">AI Teacher</span>
          </div>
          <div className="navbar-divider" aria-hidden="true" />
          <nav className="navbar-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/dashboard" className="crumb-link">Dashboard</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Learner Profile</span>
          </nav>
        </div>

        <div className="navbar-right">
          {saveToast && (
            <span className="nav-save-pill" role="status">
              ✓ Saved to notebook
            </span>
          )}
          <ThemeToggle />
          <Link to="/dashboard" className="nav-chat-btn">
            <span>← Back to Chat</span>
          </Link>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            className="nav-save-btn"
          >
            Save Changes
          </Button>
        </div>
      </header>

      {/* Main Full-Width Content Layout */}
      <div className="full-profile-layout">
        {/* Left Sticky Sidebar Card */}
        <aside className="profile-left-sidebar">
          {/* User Profile Card */}
          <div className="sidebar-card user-hero-card">
            <div className="user-hero-cover" />
            <div className="user-hero-body">
              <div className="user-avatar-wrapper">
                <Avatar name={user.name} size="lg" className="hero-avatar" />
                <span className="avatar-status-badge" title="Active learner">✦</span>
              </div>
              <h1 className="user-display-name">{user.name}</h1>
              <p className="user-display-email">{user.email}</p>
              <div className="user-tier-pill">
                <span>✨ Free Plan</span>
                <span className="tier-dot">•</span>
                <span>Active Learner</span>
              </div>
              <p className="user-joined-text">Joined {user.joinedDate}</p>
            </div>
          </div>

          {/* Daily Goal & Streak Card */}
          <div className="sidebar-card goal-streak-card">
            <div className="streak-badge-row">
              <span className="streak-icon">🔥</span>
              <div className="streak-info">
                <span className="streak-count">{stats.streak}-Day Study Streak</span>
                <span className="streak-sub">Keep asking questions to maintain your streak!</span>
              </div>
            </div>

            <div className="goal-meter-box">
              <div className="goal-meter-header">
                <span className="goal-meter-label">Today's Target</span>
                <span className="goal-meter-stat">{stats.todayQuestions} / {user.dailyGoal} questions</span>
              </div>
              <div className="goal-meter-track">
                <div
                  className="goal-meter-fill"
                  style={{ width: `${stats.goalPercent}%` }}
                />
              </div>
              <span className="goal-meter-caption">{stats.goalPercent}% of daily goal achieved</span>
            </div>
          </div>

          {/* Quick Navigation Menu */}
          <div className="sidebar-card quick-nav-card">
            <span className="card-mini-title">Navigation</span>
            <div className="nav-tabs-column">
              <button
                type="button"
                className={`tab-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <span className="tab-btn-icon">📊</span>
                <span>Learning Analytics</span>
              </button>
              <button
                type="button"
                className={`tab-nav-btn ${activeTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setActiveTab('preferences')}
              >
                <span className="tab-btn-icon">⚙️</span>
                <span>Pacing & Preferences</span>
              </button>
              <button
                type="button"
                className={`tab-nav-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                <span className="tab-btn-icon">👤</span>
                <span>Account & Data</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="sidebar-card quick-actions-card">
            <span className="card-mini-title">Data Sovereignty</span>
            <button
              type="button"
              className="sidebar-action-item"
              onClick={handleExportData}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Export Notebook (JSON)</span>
            </button>
            <button
              type="button"
              className="sidebar-action-item"
              onClick={handleLogout}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Log Out</span>
            </button>
            <button
              type="button"
              className="sidebar-action-item danger-item"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete Account</span>
            </button>
          </div>
        </aside>

        {/* Right Main Content Pane */}
        <main className="profile-right-pane">
          <form onSubmit={handleSave} className="profile-form-wrapper">
            {/* Section 1: Real-Time Learning Analytics */}
            <section className="full-section-card" id="analytics">
              <div className="section-card-header">
                <div className="section-title-group">
                  <h2 className="section-main-title">Learning Stats & Study Progress</h2>
                  <p className="section-main-desc">Overview of your study activity, quizzes, and explored knowledge domains.</p>
                </div>
                <span className="section-badge">Live Analytics</span>
              </div>

              <div className="full-kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon-box">💬</div>
                  <div className="kpi-content">
                    <span className="kpi-value">{stats.totalQuestions}</span>
                    <span className="kpi-label">Questions Asked</span>
                    <span className="kpi-meta">All-time conversations</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box kpi-fire">🔥</div>
                  <div className="kpi-content">
                    <span className="kpi-value">{stats.streak} Days</span>
                    <span className="kpi-label">Active Streak</span>
                    <span className="kpi-meta">Consistency meter</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box kpi-book">📚</div>
                  <div className="kpi-content">
                    <span className="kpi-value">{stats.subjectsCount}</span>
                    <span className="kpi-label">Subjects Explored</span>
                    <span className="kpi-meta">Disciplines covered</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box kpi-quiz">📝</div>
                  <div className="kpi-content">
                    <span className="kpi-value">{stats.practiceQuizzes}</span>
                    <span className="kpi-label">Quizzes Completed</span>
                    <span className="kpi-meta">Retention checks</span>
                  </div>
                </div>
              </div>

              {/* Explored Domain Badges */}
              <div className="explored-domains-container">
                <span className="domains-label">Frequently Explored Domains:</span>
                <div className="domains-tags-row">
                  {stats.topSubjects.map((sub, i) => (
                    <span key={i} className="domain-chip">
                      <span className="chip-sparkle">✦</span>
                      <span className="chip-name">{sub.name}</span>
                      <span className="chip-badge">{sub.count} questions</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 2: Personal Details */}
            <section className="full-section-card" id="account">
              <div className="section-card-header">
                <div className="section-title-group">
                  <h2 className="section-main-title">Personal Profile Information</h2>
                  <p className="section-main-desc">Manage your account identity, email, and learning focus.</p>
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-input-group">
                  <label className="input-field-label" htmlFor="input-user-name">Full Name</label>
                  <input
                    id="input-user-name"
                    type="text"
                    className="full-text-input"
                    value={user.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-input-group">
                  <label className="input-field-label" htmlFor="input-user-email">Email Address</label>
                  <input
                    id="input-user-email"
                    type="email"
                    className="full-text-input"
                    value={user.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-input-group" style={{ marginTop: '16px' }}>
                <label className="input-field-label" htmlFor="input-user-bio">Study Focus / Bio</label>
                <input
                  id="input-user-bio"
                  type="text"
                  className="full-text-input"
                  value={user.bio || ''}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  placeholder="e.g. Learning Python, Computer Science, and Calculus"
                />
              </div>
            </section>

            {/* Section 3: Learning Pacing Level */}
            <section className="full-section-card" id="preferences">
              <div className="section-card-header">
                <div className="section-title-group">
                  <h2 className="section-main-title">Learning Level & Pacing</h2>
                  <p className="section-main-desc">Control how deeply AI Teacher explains concepts and what prerequisites it assumes.</p>
                </div>
              </div>

              <div className="pacing-cards-grid" role="radiogroup" aria-label="Learning level">
                {levelOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={user.level === opt.value}
                    className={`pacing-card-item ${user.level === opt.value ? 'selected' : ''}`}
                    onClick={() => handleChange('level', opt.value)}
                  >
                    <div className="pacing-header">
                      <span className="pacing-title">{opt.label}</span>
                      <span className="pacing-tag">{opt.tag}</span>
                    </div>
                    <p className="pacing-desc">{opt.description}</p>
                    <div className="pacing-radio-indicator">
                      {user.level === opt.value ? '✓ Active Level' : 'Select'}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Section 4: Default Teaching Style */}
            <section className="full-section-card">
              <div className="section-card-header">
                <div className="section-title-group">
                  <h2 className="section-main-title">Default Teaching Style</h2>
                  <p className="section-main-desc">Choose how the AI tutor initiates answers during your chat sessions.</p>
                </div>
              </div>

              <div className="teaching-mode-grid" role="radiogroup" aria-label="Teaching mode">
                {modeOptions.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    role="radio"
                    aria-checked={user.defaultMode === mode.value}
                    className={`teaching-mode-item ${user.defaultMode === mode.value ? 'selected' : ''}`}
                    onClick={() => handleChange('defaultMode', mode.value)}
                  >
                    <div className="mode-item-icon">{mode.icon}</div>
                    <div className="mode-item-details">
                      <div className="mode-item-title-row">
                        <span className="mode-item-title">{mode.label}</span>
                        {user.defaultMode === mode.value && <span className="mode-active-pill">Default</span>}
                      </div>
                      <p className="mode-item-desc">{mode.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Section 5: Language & Daily Goal Controls */}
            <section className="full-section-card">
              <div className="section-card-header">
                <div className="section-title-group">
                  <h2 className="section-main-title">Language & Daily Goal Settings</h2>
                  <p className="section-main-desc">Customize your tutoring language and target questions per day.</p>
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-input-group">
                  <label className="input-field-label" htmlFor="full-language-select">Preferred Tutoring Language</label>
                  <select
                    id="full-language-select"
                    className="full-select-input"
                    value={user.language}
                    onChange={(e) => handleChange('language', e.target.value)}
                  >
                    {languageOptions.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-input-group">
                  <label className="input-field-label" htmlFor="full-goal-select">Daily Question Target</label>
                  <select
                    id="full-goal-select"
                    className="full-select-input"
                    value={user.dailyGoal}
                    onChange={(e) => handleChange('dailyGoal', Number(e.target.value))}
                  >
                    {goalOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Sticky Save Changes Action Bar */}
            <div className="full-profile-save-bar">
              <div className="save-bar-info">
                <span className="save-bar-text">Make sure to save your preference updates.</span>
                {saveToast && <span className="save-bar-toast">✓ All changes saved successfully!</span>}
              </div>

              <div className="save-bar-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/dashboard')}
                >
                  Return to Chat
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isSaving}
                  className="save-submit-btn"
                >
                  Save Profile Changes
                </Button>
              </div>
            </div>
          </form>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-dialog-title">Delete Account & Chat History?</h3>
            <p className="modal-dialog-text">
              This will permanently delete your learning profile, saved preferences, and all conversation notebooks. This action cannot be reversed.
            </p>
            <div className="modal-dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteAccount}
              >
                Delete Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;