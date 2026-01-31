/**
 * License Management Component
 * Admin interface for viewing and activating Actyze licenses
 * Design matches the Admin panel style
 */

import React, { useState, useEffect } from 'react';
import LicenseService from '../../services/LicenseService';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';

const LicenseManagement = () => {
  const { isDark } = useTheme();
  const { showSuccess, showError, showWarning } = useToast();
  
  const [currentLicense, setCurrentLicense] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [showActivateForm, setShowActivateForm] = useState(false);

  useEffect(() => {
    loadLicenseData();
  }, []);

  const loadLicenseData = async () => {
    setLoading(true);
    
    try {
      const [licenseResp, planResp] = await Promise.all([
        LicenseService.getCurrentLicense().catch(() => null),
        LicenseService.getCurrentPlan().catch(() => null)
      ]);

      if (licenseResp?.success) {
        setCurrentLicense(licenseResp.license);
      }

      if (planResp?.success) {
        setCurrentPlan(planResp.plan);
      }
    } catch (error) {
      console.error('Failed to load license data:', error);
      showError('Failed to load license information');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();

    if (!licenseKey || licenseKey.length !== 64) {
      showError('License key must be exactly 64 characters');
      return;
    }

    setActivating(true);

    try {
      await LicenseService.activateLicense(licenseKey);
      showSuccess('License activated successfully!');
      setLicenseKey('');
      setShowActivateForm(false);
      await loadLicenseData();
    } catch (error) {
      console.error('Failed to activate license:', error);
      showError(error.response?.data?.detail || 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  const handleValidateLicense = async () => {
    setValidating(true);

    try {
      const result = await LicenseService.validateLicense(true);
      
      if (result.success) {
        showSuccess('License is valid and up to date');
      } else {
        showWarning(result.error || 'License validation failed');
      }

      await loadLicenseData();
    } catch (error) {
      console.error('Failed to validate license:', error);
      showError('Failed to validate license');
    } finally {
      setValidating(false);
    }
  };

  const handleUpgrade = () => {
    window.open('https://actyze.ai/pricing', '_blank');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700';
      case 'DISABLED':
        return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600';
      case 'EXPIRED':
        return isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700';
      default:
        return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600';
    }
  };

  const getPlanColor = (planType) => {
    switch (planType) {
      case 'FREE':
        return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600';
      case 'SMALL':
        return isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700';
      case 'MEDIUM':
        return isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700';
      case 'LARGE_ENTERPRISE':
        return isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
      case 'MANAGED_SERVICE':
        return isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700';
      default:
        return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Loading license...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Actions */}
      <div className={`flex items-center justify-end px-6 py-4 border-b ${
        isDark ? 'border-[#2a2b2e]' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowActivateForm(!showActivateForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            {showActivateForm ? 'Cancel' : 'Activate License'}
          </button>
          <button
            onClick={handleUpgrade}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
              isDark 
                ? 'text-gray-300 hover:bg-[#1c1d1f]' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Activate Form */}
      {showActivateForm && (
        <div className={`px-6 py-4 border-b ${isDark ? 'border-[#2a2b2e] bg-[#17181a]' : 'border-gray-200 bg-gray-50'}`}>
          <form onSubmit={handleActivateLicense}>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              License Key (64 characters)
            </label>
            <textarea
              rows={2}
              className={`w-full px-3 py-2 text-sm rounded-lg border font-mono resize-none
                ${isDark 
                  ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                }
                focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
              `}
              placeholder="Enter 64-character license key..."
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.trim())}
              disabled={activating}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs">
                {licenseKey && (
                  <span className={licenseKey.length === 64 
                    ? (isDark ? 'text-green-400' : 'text-green-600')
                    : (isDark ? 'text-red-400' : 'text-red-600')
                  }>
                    {licenseKey.length}/64 characters
                  </span>
                )}
              </p>
              <button
                type="submit"
                disabled={activating || licenseKey.length !== 64}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors bg-[#5d6ad3] text-white
                  ${licenseKey.length === 64 ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                `}
              >
                {activating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {currentLicense ? (
          <div className="space-y-6">
            {/* License Info Grid */}
            <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              {/* Table Header */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium ${
                isDark 
                  ? 'text-gray-500 bg-[#1c1d1f]' 
                  : 'text-gray-500 bg-gray-50'
              }`}>
                <div className="col-span-3">Property</div>
                <div className="col-span-9">Value</div>
              </div>
              
              {/* License ID */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>License ID</div>
                <div className={`col-span-9 text-sm font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{currentLicense.id}</div>
              </div>

              {/* Status */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</div>
                <div className="col-span-9 flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(currentLicense.status)}`}>
                    {currentLicense.status}
                  </span>
                  <button
                    onClick={handleValidateLicense}
                    disabled={validating}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                      isDark 
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2b2e]' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {validating ? 'Validating...' : 'Validate'}
                  </button>
                </div>
              </div>

              {/* Plan Type */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Plan Type</div>
                <div className="col-span-9">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getPlanColor(currentLicense.plan_type)}`}>
                    {LicenseService.formatPlanName(currentLicense.plan_type)}
                  </span>
                </div>
              </div>

              {/* Max Users */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Max Users</div>
                <div className={`col-span-9 text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {currentLicense.max_users || 'Unlimited'}
                </div>
              </div>

              {/* Issued At */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Issued At</div>
                <div className={`col-span-9 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {formatDate(currentLicense.issued_at)}
                </div>
              </div>

              {/* Expires At */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Expires At</div>
                <div className={`col-span-9 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {currentLicense.expires_at ? formatDate(currentLicense.expires_at) : 'Never (Perpetual)'}
                </div>
              </div>

              {/* Last Validated */}
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Last Validated</div>
                <div className={`col-span-9 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {formatDate(currentLicense.last_validated_at)}
                </div>
              </div>

              {/* Monthly Cost */}
              {currentPlan && (
                <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                  <div className={`col-span-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Monthly Cost</div>
                  <div className={`col-span-9 text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {formatCurrency(currentPlan.monthly_cost_usd)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center py-16 rounded-lg border ${
            isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-gray-50'
          }`}>
            <svg className={`w-10 h-10 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              No Active License
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Click "Activate License" to add your license key
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LicenseManagement;
