/**
 * License Management Component - Simplified
 * Admin interface for viewing and activating Actyze licenses
 */

import React, { useState, useEffect } from 'react';
import LicenseService from '../../services/LicenseService';
import { useToast } from '../../contexts/ToastContext';

const LicenseManagement = () => {
  const [currentLicense, setCurrentLicense] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [showActivateForm, setShowActivateForm] = useState(false);
  const [marketingApiData, setMarketingApiData] = useState(null);
  const [validatingExternal, setValidatingExternal] = useState(false);
  const { showToast } = useToast();

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
      showToast('error', 'Failed to load license information');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();

    if (!licenseKey || licenseKey.length !== 64) {
      showToast('error', 'License key must be exactly 64 characters');
      return;
    }

    setActivating(true);

    try {
      await LicenseService.activateLicense(licenseKey);
      showToast('success', 'License activated successfully!');
      setLicenseKey('');
      setShowActivateForm(false);
      await loadLicenseData();
    } catch (error) {
      console.error('Failed to activate license:', error);
      showToast('error', error.response?.data?.detail || 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  const handleValidateLicense = async () => {
    setValidating(true);

    try {
      const result = await LicenseService.validateLicense(true);
      
      if (result.success) {
        showToast('success', 'License is valid and up to date');
      } else {
        showToast('warning', result.error || 'License validation failed');
      }

      await loadLicenseData();
    } catch (error) {
      console.error('Failed to validate license:', error);
      showToast('error', 'Failed to validate license');
    } finally {
      setValidating(false);
    }
  };

  const handleUpgrade = () => {
    window.open('https://actyze.ai/pricing', '_blank');
  };

  const handleValidateWithMarketingAPI = async () => {
    if (!currentLicense || !currentLicense.license_key) {
      showToast('error', 'No license key available to validate');
      return;
    }

    setValidatingExternal(true);
    setMarketingApiData(null);

    try {
      const result = await LicenseService.validateLicenseWithMarketingAPI(currentLicense.license_key);
      
      if (result.valid) {
        setMarketingApiData(result);
        showToast('success', 'License validated successfully with marketing dashboard');
      } else {
        showToast('error', result.error || 'License validation failed');
      }
    } catch (error) {
      console.error('Failed to validate with marketing API:', error);
      showToast('error', error.message || 'Failed to validate license');
    } finally {
      setValidatingExternal(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              License Management
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your Actyze platform license
            </p>
          </div>
          <button
            onClick={handleUpgrade}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Current License Card */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Current License
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={handleValidateLicense}
                disabled={validating || !currentLicense}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {validating ? 'Validating...' : 'Validate / Refresh'}
              </button>
              <button
                onClick={handleValidateWithMarketingAPI}
                disabled={validatingExternal || !currentLicense}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {validatingExternal ? 'Verifying...' : 'Verify with Actyze.ai'}
              </button>
              <button
                onClick={() => setShowActivateForm(!showActivateForm)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {showActivateForm ? 'Cancel' : 'Activate New License'}
              </button>
            </div>
          </div>
        </div>

        {showActivateForm && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <form onSubmit={handleActivateLicense}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                License Key (64 characters)
              </label>
              <textarea
                rows={3}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white font-mono"
                placeholder="Enter 64-character license key..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.trim())}
                disabled={activating}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {licenseKey && (
                    <span className={licenseKey.length === 64 ? 'text-green-600' : 'text-red-600'}>
                      {licenseKey.length}/64 characters
                    </span>
                  )}
                </p>
                <button
                  type="submit"
                  disabled={activating || licenseKey.length !== 64}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {activating ? 'Activating...' : 'Activate'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="px-6 py-5">
          {currentLicense ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  License ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                  {currentLicense.id}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Status
                </dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                    LicenseService.getStatusBadgeColor(currentLicense.status)
                  }`}>
                    {currentLicense.status}
                  </span>
                  {currentLicense.is_valid && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ Valid</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Plan Type
                </dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                    LicenseService.getPlanBadgeColor(currentLicense.plan_type)
                  }`}>
                    {LicenseService.formatPlanName(currentLicense.plan_type)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Max Users Allowed
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-semibold">
                  {currentLicense.max_users || 'Unlimited'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Issued At
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {formatDate(currentLicense.issued_at)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Expires At
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {currentLicense.expires_at ? formatDate(currentLicense.expires_at) : 'Never (Perpetual)'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Last Validated
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {formatDate(currentLicense.last_validated_at)}
                </dd>
              </div>
              {currentPlan && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Monthly Cost
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(currentPlan.monthly_cost_usd)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Active License</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Please activate a license to continue using the platform.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Marketing API Validation Result */}
      {marketingApiData && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <svg className="mr-2 h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Actyze.ai Verification Result
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Real-time validation from Actyze licensing server
            </p>
          </div>
          
          <div className="px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Validation Status
                </dt>
                <dd className="mt-1">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    marketingApiData.valid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {marketingApiData.valid ? '✓ Valid License' : '✗ Invalid License'}
                  </span>
                  {marketingApiData.message && (
                    <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      {marketingApiData.message}
                    </span>
                  )}
                </dd>
              </div>

              {marketingApiData.plan && (
                <>
                  <div className="sm:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                      Plan Details
                    </h3>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Plan Name
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {marketingApiData.plan.display_name}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {marketingApiData.plan.description}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Max Users
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {marketingApiData.plan.max_users || 'Unlimited'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Pricing
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatCurrency(marketingApiData.plan.monthly_price_usd)}/month
                      {marketingApiData.plan.annual_price_usd && (
                        <span className="ml-2 text-xs text-gray-500">
                          or {formatCurrency(marketingApiData.plan.annual_price_usd)}/year
                        </span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Support Level
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {marketingApiData.plan.support_level}
                    </dd>
                  </div>

                  {marketingApiData.plan.features && Object.keys(marketingApiData.plan.features).length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Plan Features
                      </dt>
                      <dd className="mt-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(marketingApiData.plan.features).map(([key, value]) => (
                            <div key={key} className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded">
                              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {value === -1 ? 'Unlimited' : value === true ? 'Yes' : value === false ? 'No' : value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}
                </>
              )}

              {marketingApiData.license && (
                <>
                  <div className="sm:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                      License Information
                    </h3>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      License Type
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                      {marketingApiData.license.type}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                      {marketingApiData.license.status}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Issued At
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(marketingApiData.license.issued_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Starts At
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(marketingApiData.license.starts_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Expires At
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {marketingApiData.license.expires_at ? formatDate(marketingApiData.license.expires_at) : 'Never'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Validation Count
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {marketingApiData.license.validation_count || 0}
                      {marketingApiData.license.max_validations && ` / ${marketingApiData.license.max_validations}`}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicenseManagement;
