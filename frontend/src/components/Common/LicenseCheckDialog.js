import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import axios from 'axios';

const LicenseCheckDialog = ({ onLicenseAdded, onClose }) => {
  const { isDark } = useTheme();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate license key format (64 characters)
    if (licenseKey.length !== 64) {
      setError('License key must be exactly 64 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('/api/v1/license-check/add-initial', {
        license_key: licenseKey
      });

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          onLicenseAdded(response.data);
        }, 1500);
      }
    } catch (err) {
      console.error('License validation error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to validate license key. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    window.open('https://app.actyze.ai/dashboard/licenses', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-gray-900/50'} backdrop-blur-sm`}
        onClick={onClose ? onClose : undefined}
      />
      
      {/* Dialog */}
      <div 
        className={`relative z-10 w-full max-w-md mx-4 rounded-xl shadow-2xl ${
          isDark ? 'bg-[#1c1d1f] border border-[#2a2b2e]' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-5 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-[#5d6ad3]/20' : 'bg-[#5d6ad3]/10'
            }`}>
              <svg className="w-6 h-6 text-[#5d6ad3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                License Required
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Activate your Actyze license
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          {success ? (
            <div className={`p-4 rounded-lg ${isDark ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                    License Activated!
                  </p>
                  <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                    Redirecting to dashboard...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                  To use Actyze Dashboard, you need an active license from your{' '}
                  <button
                    onClick={handleGoToDashboard}
                    className="font-medium underline hover:no-underline"
                  >
                    Actyze account dashboard
                  </button>
                  .
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {error}
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    License Key
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Enter your 64-character license key"
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all font-mono ${
                      isDark
                        ? 'bg-[#0a0a0a] border-[#2a2b2e] text-white placeholder-gray-600 focus:border-[#5d6ad3]'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3] focus:ring-1 focus:ring-[#5d6ad3]'
                    }`}
                    required
                    disabled={loading}
                    maxLength={64}
                  />
                  <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {licenseKey.length}/64 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || licenseKey.length !== 64}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm text-white transition-all duration-200 ${
                    loading || licenseKey.length !== 64
                      ? 'opacity-50 cursor-not-allowed bg-gray-400'
                      : 'bg-gradient-to-r from-[#5d6ad3] to-[#4f5bc4] hover:shadow-lg hover:shadow-[#5d6ad3]/25 hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validating...
                    </span>
                  ) : (
                    'Activate License'
                  )}
                </button>
              </form>

              <div className={`text-center pt-2 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                <button
                  onClick={handleGoToDashboard}
                  className={`text-sm font-medium transition-colors ${
                    isDark ? 'text-[#5d6ad3] hover:text-[#7b86db]' : 'text-[#5d6ad3] hover:text-[#4f5bc4]'
                  }`}
                >
                  Don't have a license? Get one from your dashboard →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseCheckDialog;
