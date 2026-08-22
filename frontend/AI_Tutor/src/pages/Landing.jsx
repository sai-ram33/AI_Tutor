import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import './Landing.css';

const exampleQuestions = [
  "What is recursion in Python?",
  "Why is the sky blue?",
  "How does a neural network work?",
  "Explain quantum entanglement simply",
  "How does the immune system remember viruses?",
  "What caused the French Revolution?",
];

const quickTopics = [
  { label: "🐍 Python recursion", query: "What is recursion in Python?" },
  { label: "🧬 CRISPR gene editing", query: "How does CRISPR gene editing work?" },
  { label: "⚡ Newton's 3rd law", query: "Explain Newton's third law of motion" },
  { label: "📐 Bayes' theorem", query: "Explain Bayes' theorem with an example" },
  { label: "🌌 Black hole event horizon", query: "What is a black hole event horizon?" },
];

const subjectsData = [
  {
    id: 'cs',
    name: 'Computer Science',
    icon: '💻',
    color: 'teal',
    badge: 'Popular',
    desc: 'Algorithms, Data Structures, Python, Web Dev',
    sample: 'How do hash tables resolve collisions?',
  },
  {
    id: 'math',
    name: 'Mathematics',
    icon: '📐',
    color: 'amber',
    badge: 'Core',
    desc: 'Calculus, Linear Algebra, Probability & Stats',
    sample: 'What is the intuitive meaning of a derivative?',
  },
  {
    id: 'physics',
    name: 'Physics & Chemistry',
    icon: '⚡',
    color: 'blue',
    badge: 'Science',
    desc: 'Quantum Mechanics, Thermodynamics, Atomic Structure',
    sample: 'Why does light slow down in water?',
  },
  {
    id: 'biology',
    name: 'Biology & Medicine',
    icon: '🧬',
    color: 'emerald',
    badge: 'Life Sciences',
    desc: 'Genetics, Cellular Biology, Neuroscience',
    sample: 'How do mRNA vaccines work?',
  },
  {
    id: 'history',
    name: 'History & Humanities',
    icon: '🏛️',
    color: 'rose',
    badge: 'Humanities',
    desc: 'World History, Philosophy, Economics',
    sample: 'What were the main catalysts of the Industrial Revolution?',
  },
  {
    id: 'general',
    name: 'General Knowledge',
    icon: '🌐',
    color: 'purple',
    badge: 'Daily',
    desc: 'Everyday Science, Technology, Logic',
    sample: 'How does GPS triangulate your exact location?',
  },
];

const featuresData = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    title: 'Socratic Guided Mode',
    desc: 'Rather than just dumping raw answers, Guide Mode asks intuitive leading questions to help you reach the breakthrough yourself.',
    tag: 'Active Learning',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
    ),
    title: 'Plain-English Analogies',
    desc: 'Complex concepts translated into relatable everyday models (like explaining recursion using Russian nesting dolls).',
    tag: 'Intuitive',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
    title: 'Instant Practice Quizzes',
    desc: 'Click "Practice" on any explanation to immediately receive 3 targeted follow-up questions to test and cement your comprehension.',
    tag: 'Retention',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    title: '"Explain Simpler" Button',
    desc: 'Never feel stuck. One click re-frames the concept with simpler vocabulary, less technical jargon, and zero judgment.',
    tag: 'Zero Friction',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
    title: 'Adaptive Learning Levels',
    desc: 'Customize your profile for Beginner, Intermediate, or Advanced pacing, plus bilingual English and Telugu preferences.',
    tag: 'Personalized',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    ),
    title: 'Distraction-Free Dark Mode',
    desc: 'The Annotated Notebook design system offers dark and light themes crafted for prolonged, eye-friendly study sessions.',
    tag: 'Ergonomic',
  },
];

const testimonialsData = [
  {
    name: 'Ananya R.',
    role: 'CS Undergrad',
    initials: 'AR',
    rating: 5,
    quote: 'I struggled with Python recursion for weeks. AI Teacher explained it in two minutes with the nesting doll analogy, and the practice quiz locked it in!',
  },
  {
    name: 'David K.',
    role: 'Self-Taught Developer',
    initials: 'DK',
    rating: 5,
    quote: 'Guide Mode is a game changer. Instead of giving me the code outright, it nudged me to spot the off-by-one bug myself. Felt like pair programming with a senior engineer.',
  },
  {
    name: 'Priya M.',
    role: 'High School Senior',
    initials: 'PM',
    rating: 5,
    quote: 'Being able to switch to bilingual explanations helped me understand difficult physics thermodynamics concepts so much faster for my exams.',
  },
];

const faqData = [
  {
    question: 'How does AI Teacher differ from general search engines?',
    answer: 'General search engines return pages of links and long articles. AI Teacher gives you direct, structured, conversational explanations tailored to your exact learning level, complete with interactive practice quizzes and Socratic guidance.',
  },
  {
    question: 'What is the difference between Explain Mode and Guide Mode?',
    answer: 'Explain Mode provides a direct, intuitive breakdown with analogies and syntax. Guide Mode acts like a private tutor, asking leading questions to help you deduce the answer yourself for deeper retention.',
  },
  {
    question: 'Can I test my knowledge with practice quizzes?',
    answer: 'Yes! Under every AI response, simply click the "Practice" button. The tutor will instantly generate 3 custom practice exercises based on the exact topic you just discussed.',
  },
  {
    question: 'Is AI Teacher free to use?',
    answer: 'Yes, AI Teacher is free to start. You can ask questions, practice concepts, explore all subject categories, and organize your conversation notebook.',
  },
  {
    question: 'Which subjects can I learn?',
    answer: 'Anything! Popular subjects include Computer Science, Mathematics, Physics, Chemistry, Biology, History, Humanities, and General Knowledge.',
  },
];

const previewDemos = {
  explain: {
    question: 'What is recursion in Python?',
    response: `<p><span class="highlight-term">Recursion</span> is a programming technique where a function solves a problem by calling a smaller instance of itself.</p>
<p>Every recursive function has two essential parts:</p>
<ol>
  <li><strong>Base Case:</strong> The stopping condition that prevents infinite looping (e.g. <code>if n == 1: return 1</code>).</li>
  <li><strong>Recursive Case:</strong> The step where the function calls itself with a reduced problem.</li>
</ol>
<pre><code>def factorial(n):
    if n &lt;= 1: return 1
    return n * factorial(n - 1)</code></pre>`,
  },
  guide: {
    question: 'How do I calculate factorial recursively?',
    response: `<p><strong>Let's think through this together! 💡</strong></p>
<p>Imagine you want to calculate <code>factorial(4)</code>, which is <code>4 × 3 × 2 × 1</code>.</p>
<p>Notice that <code>factorial(4) = 4 × factorial(3)</code>. If someone gave you the answer to <code>factorial(3)</code>, how would you find <code>factorial(4)</code>?</p>
<p><em>What would be the simplest number where we already know the factorial without doing any multiplication (our base case)?</em></p>`,
  },
  quiz: {
    question: 'Practice: Python Recursion',
    response: `<p><strong>📝 3 Quick Practice Questions:</strong></p>
<ol>
  <li>What happens if a recursive function does not define a base case?</li>
  <li>Trace through <code>factorial(3)</code> step by step. How many total function calls are made?</li>
  <li>Can any loop be converted into a recursive function? Why or why not?</li>
</ol>`,
  },
};

export function Landing() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState('explain');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const inputRef = useRef(null);

  // Cycle through placeholder texts
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % exampleQuestions.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && question.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e) => {
    setQuestion(e.target.value);
  };

  const handleInputClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleQuickTopicClick = (query) => {
    setQuestion(query);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = () => {
    if (question.trim()) {
      navigate('/signup', { state: { question: question.trim() } });
    } else {
      navigate('/signup');
    }
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="landing-page">
      {/* Background Ambient Glows */}
      <div className="landing-ambient-glow" aria-hidden="true" />
      <div className="landing-ambient-glow-secondary" aria-hidden="true" />

      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo-group">
          <div className="landing-logo-badge">
            <span className="logo-sparkle">✦</span>
          </div>
          <Link to="/" className="landing-logo-text">
            AI TEACHER
          </Link>
        </div>

        <nav className="landing-nav-links" aria-label="Main Navigation">
          <a href="#features" className="nav-link">Features</a>
          <a href="#demo-preview" className="nav-link">Interactive Demo</a>
          <a href="#subjects" className="nav-link">Subjects</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </nav>

        <div className="landing-header-actions">
          <ThemeToggle className="landing-theme-toggle" />
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
            Start Free →
          </Button>
        </div>
      </header>

      <main className="landing-main">
        {/* Hero Section */}
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="hero-pill-badge">
            <span className="hero-pill-icon">✨</span>
            <span className="hero-pill-text">AI Tutor 2.0 • Socratic & Plain-English Explanations</span>
          </div>

          <h1 id="hero-heading" className="landing-headline">
            Ask anything.
            <br />
            Master it <span className="highlight-gradient">step by step</span>.
          </h1>

          <p className="landing-subheadline">
            No robotic jargon. No walls of text. Just clear analogies, guided Socratic thinking, and instant practice quizzes tailored to your level.
          </p>

          {/* Interactive Demo Search Input */}
          <div className="hero-search-wrapper">
            <div className="landing-demo-input" onClick={handleInputClick}>
              <div className="search-icon-wrapper" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder={exampleQuestions[placeholderIndex]}
                value={question}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="demo-input"
                aria-label="Ask your question"
              />
              <Button
                variant="primary"
                size="md"
                className="demo-submit-btn"
                onClick={handleSubmit}
                aria-label="Submit question"
              >
                <span>Ask AI</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </Button>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="quick-topics-row" aria-label="Suggested questions">
              <span className="quick-topics-label">Try asking:</span>
              <div className="quick-topics-pills">
                {quickTopics.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    className="topic-pill"
                    onClick={() => handleQuickTopicClick(topic.query)}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trust Highlights */}
          <div className="hero-trust-bar">
            <div className="trust-item">
              <span className="trust-stars">★★★★★</span>
              <span className="trust-text">Loved by students</span>
            </div>
            <div className="trust-divider" aria-hidden="true" />
            <div className="trust-item">
              <span className="trust-icon">⚡</span>
              <span className="trust-text">Zero setup required</span>
            </div>
            <div className="trust-divider" aria-hidden="true" />
            <div className="trust-item">
              <span className="trust-icon">🔓</span>
              <span className="trust-text">100% free to start</span>
            </div>
          </div>
        </section>

        {/* Live Interactive Sandbox Preview */}
        <section id="demo-preview" className="landing-preview-section" aria-labelledby="preview-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Interactive AI Sandbox</span>
            <h2 id="preview-heading" className="section-heading">Experience the difference live</h2>
            <p className="section-subtext">Toggle between modes to see how AI Teacher adapts to how your mind learns.</p>
          </div>

          <div className="preview-showcase-container">
            {/* Mode Switcher Tabs */}
            <div className="preview-tabs" role="tablist" aria-label="Interactive Demo Modes">
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'explain'}
                className={`preview-tab ${activePreviewTab === 'explain' ? 'active' : ''}`}
                onClick={() => setActivePreviewTab('explain')}
              >
                <span className="tab-icon">🎓</span>
                <div className="tab-info">
                  <span className="tab-title">Explain Mode</span>
                  <span className="tab-desc">Crystal clear analogies</span>
                </div>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'guide'}
                className={`preview-tab ${activePreviewTab === 'guide' ? 'active' : ''}`}
                onClick={() => setActivePreviewTab('guide')}
              >
                <span className="tab-icon">💡</span>
                <div className="tab-info">
                  <span className="tab-title">Guide Mode</span>
                  <span className="tab-desc">Socratic discovery</span>
                </div>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'quiz'}
                className={`preview-tab ${activePreviewTab === 'quiz' ? 'active' : ''}`}
                onClick={() => setActivePreviewTab('quiz')}
              >
                <span className="tab-icon">📝</span>
                <div className="tab-info">
                  <span className="tab-title">Practice Quiz</span>
                  <span className="tab-desc">Active recall testing</span>
                </div>
              </button>
            </div>

            {/* Simulated Chat Interface */}
            <div className="preview-window">
              <div className="preview-window-bar">
                <div className="preview-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-yellow" />
                  <span className="dot dot-green" />
                </div>
                <div className="preview-title-bar">
                  <span className="preview-online-dot" />
                  <span>AI Teacher • {activePreviewTab === 'explain' ? 'Explain Mode' : activePreviewTab === 'guide' ? 'Guide Mode' : 'Quiz Mode'}</span>
                </div>
                <div className="preview-badge">Interactive Demo</div>
              </div>

              <div className="preview-messages">
                <div className="preview-msg preview-user-msg">
                  <div className="msg-avatar user-avatar">You</div>
                  <div className="msg-content user-content">
                    {previewDemos[activePreviewTab].question}
                  </div>
                </div>

                <div className="preview-msg preview-ai-msg">
                  <div className="msg-avatar ai-avatar">AI</div>
                  <div className="msg-content ai-content">
                    <div dangerouslySetInnerHTML={{ __html: previewDemos[activePreviewTab].response }} />
                    <div className="preview-actions-bar">
                      <button className="preview-action-chip" onClick={() => setActivePreviewTab('quiz')}>
                        📝 Practice Questions
                      </button>
                      <button className="preview-action-chip" onClick={() => setActivePreviewTab('explain')}>
                        💡 Explain Simpler
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="preview-cta-footer">
                <p>Want full interactive conversations across your own topics?</p>
                <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
                  Try With Your Question →
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="landing-features-section" aria-labelledby="features-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Purpose-Built for Learners</span>
            <h2 id="features-heading" className="section-heading">Everything you need to truly grasp concepts</h2>
            <p className="section-subtext">Built specifically for students, self-taught engineers, and curious minds.</p>
          </div>

          <div className="features-grid">
            {featuresData.map((feat, index) => (
              <div key={index} className="feature-card">
                <div className="feature-card-header">
                  <div className="feature-icon-box">{feat.icon}</div>
                  <span className="feature-tag">{feat.tag}</span>
                </div>
                <h3 className="feature-title">{feat.title}</h3>
                <p className="feature-desc">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Subjects Explorer */}
        <section id="subjects" className="landing-subjects-section" aria-labelledby="subjects-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Boundless Curriculum</span>
            <h2 id="subjects-heading" className="section-heading">Explore any subject without limits</h2>
            <p className="section-subtext">Click any domain to get started with popular prompt explorations.</p>
          </div>

          <div className="subjects-grid">
            {subjectsData.map((subj) => (
              <div
                key={subj.id}
                className={`subject-card subject-${subj.color}`}
                onClick={() => handleQuickTopicClick(subj.sample)}
              >
                <div className="subject-top">
                  <span className="subject-icon-emoji">{subj.icon}</span>
                  <span className="subject-badge">{subj.badge}</span>
                </div>
                <h3 className="subject-name">{subj.name}</h3>
                <p className="subject-desc">{subj.desc}</p>
                <div className="subject-prompt-box">
                  <span className="prompt-label">Example:</span>
                  <span className="prompt-text">"{subj.sample}"</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="landing-how-section" aria-labelledby="how-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Simple 3-Step Process</span>
            <h2 id="how-heading" className="section-heading">How your learning journey unfolds</h2>
            <p className="section-subtext">Designed for effortless flow from curiosity to complete mastery.</p>
          </div>

          <div className="how-steps-grid">
            <div className="how-step-card">
              <div className="how-step-badge">Step 1</div>
              <div className="how-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 className="how-step-title">Ask in Plain Words</h3>
              <p className="how-step-desc">Type your question however it comes to mind. No complex prompting required.</p>
            </div>

            <div className="how-connector" aria-hidden="true">→</div>

            <div className="how-step-card">
              <div className="how-step-badge">Step 2</div>
              <div className="how-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
              <h3 className="how-step-title">Grasp the Intuition</h3>
              <p className="how-step-desc">Receive structured breakdowns, vivid real-world analogies, and guided insights.</p>
            </div>

            <div className="how-connector" aria-hidden="true">→</div>

            <div className="how-step-card">
              <div className="how-step-badge">Step 3</div>
              <div className="how-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 className="how-step-title">Cement with Practice</h3>
              <p className="how-step-desc">Lock in your knowledge with instant auto-generated interactive quiz exercises.</p>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="landing-testimonials-section" aria-labelledby="testimonials-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Proven Results</span>
            <h2 id="testimonials-heading" className="section-heading">Loved by curious minds everywhere</h2>
          </div>

          <div className="testimonials-grid">
            {testimonialsData.map((t, idx) => (
              <div key={idx} className="testimonial-card">
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.initials}</div>
                  <div className="author-details">
                    <span className="author-name">{t.name}</span>
                    <span className="author-role">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section id="faq" className="landing-faq-section" aria-labelledby="faq-heading">
          <div className="section-header-center">
            <span className="section-eyebrow">Got Questions?</span>
            <h2 id="faq-heading" className="section-heading">Frequently Asked Questions</h2>
          </div>

          <div className="faq-accordion-list">
            {faqData.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span className="faq-question-text">{faq.question}</span>
                    <span className="faq-toggle-icon" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="faq-answer-pane">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* High-Conversion Bottom CTA */}
        <section className="landing-bottom-cta">
          <div className="cta-card">
            <div className="cta-sparkle" aria-hidden="true">✦</div>
            <h2 className="cta-title">Ready to understand anything faster?</h2>
            <p className="cta-subtitle">
              Join thousands of learners mastering complex topics in science, coding, math, and history today.
            </p>
            <div className="cta-actions">
              <Button
                variant="primary"
                size="lg"
                className="cta-primary-btn"
                onClick={() => navigate('/signup')}
              >
                Start Learning Free →
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/dashboard')}
              >
                Explore Dashboard
              </Button>
            </div>
            <p className="cta-footnote">⚡ Free account • No credit card required • Instant access</p>
          </div>
        </section>
      </main>

      {/* Enhanced Footer */}
      <footer className="landing-footer">
        <div className="footer-top-grid">
          <div className="footer-brand-col">
            <div className="footer-logo">AI TEACHER</div>
            <p className="footer-brand-desc">
              Your personalized AI learning companion. Breaking down the world's knowledge into intuitive, memorable lessons.
            </p>
            <div className="footer-status-pill">
              <span className="footer-status-dot" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Navigation</h4>
            <ul className="footer-nav-list">
              <li><a href="#features">Features</a></li>
              <li><a href="#demo-preview">Interactive Demo</a></li>
              <li><a href="#subjects">Subjects</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Subjects</h4>
            <ul className="footer-nav-list">
              <li><a href="#subjects">Computer Science</a></li>
              <li><a href="#subjects">Mathematics</a></li>
              <li><a href="#subjects">Physics & Chemistry</a></li>
              <li><a href="#subjects">Biology</a></li>
              <li><a href="#subjects">History</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Account</h4>
            <ul className="footer-nav-list">
              <li><Link to="/login">Log In</Link></li>
              <li><Link to="/signup">Create Account</Link></li>
              <li><Link to="/onboarding">Level Selector</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p className="footer-copyright">
            © {new Date().getFullYear()} AI Teacher. Crafted for deep understanding.
          </p>
          <div className="footer-legal-links">
            <Link to="#">Privacy Policy</Link>
            <span className="footer-dot-sep">•</span>
            <Link to="#">Terms of Service</Link>
            <span className="footer-dot-sep">•</span>
            <Link to="#">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;