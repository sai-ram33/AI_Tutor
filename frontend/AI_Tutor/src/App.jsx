import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Landing } from './pages/Landing';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestoreService } from './services/firebase';
import { api } from './services/api';
import './styles/design-system.css';
import './App.css';

// Initialize theme on app mount
function ThemeInitializer() {
  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem('theme');
    if (stored) {
      root.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.setAttribute('data-theme', 'dark');
    }
  }, []);
  return null;
}

// Observe Firebase Auth state continuously
function AuthObserver() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          api.setToken(token);
          const stored = api.getStoredUser();
          if (!stored || stored.uid !== user.uid) {
            const fsUser = await firestoreService.getUserProfile(user.uid);
            if (fsUser) {
              api.setStoredUser(fsUser);
            } else {
              api.setStoredUser({
                uid: user.uid,
                name: user.displayName || 'Learner',
                email: user.email,
                level: 'intermediate',
                language: 'english',
              });
            }
          }
        } catch (e) {
          console.warn('Auth sync error:', e.message);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer />
      <AuthObserver />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;