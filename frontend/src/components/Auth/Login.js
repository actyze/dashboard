import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Text, Button } from '../ui';

const Login = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement actual authentication
      // Mock login for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to home page after successful login
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full max-w-md px-6">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mb-4">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <Text variant="h4" className="font-bold mb-2">
            Welcome back
          </Text>
          <Text color="secondary" className="text-sm">
            Sign in to your account to continue
          </Text>
        </div>

        {/* Login Form */}
        <Card className={`p-8 ${isDark ? 'bg-[#1c1d1f]' : 'bg-white'}`}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <Text className="text-sm">{error}</Text>
              </div>
            )}

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`
                  w-full px-4 py-2 rounded-lg border
                  ${isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`
                  w-full px-4 py-2 rounded-lg border
                  ${isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5d6ad3] hover:bg-[#4f5bc4] text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Text color="secondary" className="text-sm">
              Don't have an account?{' '}
              <Link 
                to="/signup" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign up
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;

