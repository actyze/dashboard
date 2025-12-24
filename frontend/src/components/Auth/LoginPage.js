import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

// Color palette - single source of truth
const colors = {
  primary: '#5d6ad3',
  primaryLight: '#7b86db',
  primaryLighter: '#9ba3e3',
  primaryDark: '#4f5bc4',
};

// Reusable style generators
const getStyles = () => ({
  decorativeLine: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
  button: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
  buttonHover: `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary} 100%)`,
});

// Animation keyframes for fluid gradient background
const animationStyles = `
  @keyframes fluid-1 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(20%, -30%) scale(1.1); }
    50% { transform: translate(-20%, 20%) scale(0.9); }
    75% { transform: translate(30%, 10%) scale(1.05); }
  }
  @keyframes fluid-2 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(-30%, 20%) scale(1.15); }
    50% { transform: translate(25%, -25%) scale(0.95); }
    75% { transform: translate(-15%, -20%) scale(1.1); }
  }
  @keyframes fluid-3 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(15%, 25%) scale(0.9); }
    50% { transform: translate(-25%, -15%) scale(1.1); }
    75% { transform: translate(20%, -30%) scale(1); }
  }
  @keyframes fluid-4 {
    0%, 100% { transform: translate(0%, 0%) scale(1.1); }
    33% { transform: translate(-20%, 30%) scale(0.95); }
    66% { transform: translate(30%, -20%) scale(1.05); }
  }
`;

// Fluid blob configuration - original blue palette
const blobsConfig = [
  { 
    size: '140%', 
    x: '-20%', 
    y: '-30%', 
    color: 'rgba(48, 100, 255, 0.8)',
    animation: 'fluid-1 15s ease-in-out infinite',
  },
  { 
    size: '100%', 
    x: '50%', 
    y: '60%', 
    color: 'rgba(91, 138, 255, 0.7)',
    animation: 'fluid-2 18s ease-in-out infinite',
  },
  { 
    size: '120%', 
    x: '70%', 
    y: '-20%', 
    color: 'rgba(30, 64, 175, 0.8)',
    animation: 'fluid-3 20s ease-in-out infinite',
  },
  { 
    size: '90%', 
    x: '-10%', 
    y: '70%', 
    color: 'rgba(59, 130, 246, 0.6)',
    animation: 'fluid-4 22s ease-in-out infinite',
  },
  { 
    size: '80%', 
    x: '40%', 
    y: '20%', 
    color: 'rgba(147, 180, 255, 0.5)',
    animation: 'fluid-1 25s ease-in-out infinite reverse',
  },
];

const LoginPage = () => {
  const { login, error } = useAuth();
  const { isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const styles = getStyles();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    if (success) navigate('/');
    setLoading(false);
  };

  const inputClasses = `w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all duration-200 ${
    isDark
      ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-600 focus:border-[#5d6ad3]'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3] focus:shadow-lg focus:shadow-[#5d6ad3]/10'
  }`;

  const labelClasses = `block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#101012]' : 'bg-slate-50'}`}>
      <style>{animationStyles}</style>

      {/* Left Panel - Animated Fluid Gradient */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ backgroundColor: isDark ? '#050a18' : '#1a3a8f' }}
      >
        {/* Animated fluid blobs */}
        {blobsConfig.map((blob, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: blob.size,
              height: blob.size,
              left: blob.x,
              top: blob.y,
              background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
              filter: 'blur(60px)',
              animation: blob.animation,
              willChange: 'transform',
            }}
          />
        ))}

        {/* Subtle overlay for depth */}
        <div 
          className="absolute inset-0" 
          style={{ 
            background: 'radial-gradient(ellipse at 30% 20%, transparent 0%, rgba(0,0,0,0.2) 100%)',
          }} 
        />

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          <h1 
            className="text-6xl font-black tracking-tight mb-4 text-white"
            style={{ textShadow: '0 4px 30px rgba(0,0,0,0.3)' }}
          >
            Actyze
          </h1>
          <p 
            className="text-lg font-light tracking-wide text-white/80"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
          >
            Every Database, One Platform
          </p>
          <div className="mt-8 h-px w-32" style={{ background: styles.decorativeLine }} />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div 
        className={`w-full lg:w-1/2 flex items-center justify-center p-8 relative overflow-hidden ${isDark ? 'bg-[#101012]' : 'bg-slate-50'}`}
      >
        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <h1
              className="text-4xl font-black tracking-tight"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Actyze
            </h1>
          </div>

          {/* Welcome text */}
          <div className="mb-6">
            <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome back
            </h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              Sign in to access your dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-500">
                {error}
              </div>
            )}

            <div>
              <label className={labelClasses}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClasses}
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm text-white transition-all duration-200 relative overflow-hidden group
                ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-[#5d6ad3]/25 hover:-translate-y-0.5'}`}
              style={{ background: styles.button }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: styles.buttonHover }}
              />
            </button>
          </form>

          {/* Footer hint */}
          <div className={`mt-6 pt-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
            <p className={`text-center text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              Default credentials:{' '}
              <span className="font-mono" style={{ color: colors.primary }}>
                nexus_admin / admin
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
