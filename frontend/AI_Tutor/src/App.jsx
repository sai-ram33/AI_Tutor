import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Landing } from './pages/Landing';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
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

function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes (would add auth guard in real app) */}
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