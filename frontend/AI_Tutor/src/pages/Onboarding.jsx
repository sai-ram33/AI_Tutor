import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { api } from '../services/api';
import './Onboarding.css';

const levels = [
  {
    value: 'beginner',
    label: 'New to this',
    description: 'Explain from scratch — I\'m just starting out',
  },
  {
    value: 'intermediate',
    label: 'I know some basics',
    description: 'Give me clear explanations with some depth',
  },
  {
    value: 'advanced',
    label: 'I\'m comfortable',
    description: 'Just want depth — skip the basics',
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = (level) => {
    setSelectedLevel(level);
  };

  const handleContinue = async () => {
    if (!selectedLevel) return;

    setIsSubmitting(true);

    try {
      if (api.isAuthenticated()) {
        await api.updateMe({ level: selectedLevel });
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to save level:', error);
      navigate('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <main className="onboarding-main">
        <div className="onboarding-card">
          <header className="onboarding-header">
            <div className="onboarding-logo">AI TEACHER</div>
            <h1 className="onboarding-title">Before we start...</h1>
            <p className="onboarding-subtitle">
              How would you describe yourself?
            </p>
          </header>

          <div className="onboarding-options" role="radiogroup" aria-label="Learning level">
            {levels.map((level) => (
              <button
                key={level.value}
                type="button"
                className={`level-option ${selectedLevel === level.value ? 'selected' : ''}`}
                onClick={() => handleSelect(level.value)}
                role="radio"
                aria-checked={selectedLevel === level.value}
                aria-label={level.label}
              >
                <div className="level-option-content">
                  <h3 className="level-label">{level.label}</h3>
                  <p className="level-description">{level.description}</p>
                </div>
                <div className="level-indicator" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            block
            size="lg"
            onClick={handleContinue}
            disabled={!selectedLevel || isSubmitting}
            loading={isSubmitting}
          >
            Continue →
          </Button>
        </div>
      </main>
    </div>
  );
}

export default Onboarding;