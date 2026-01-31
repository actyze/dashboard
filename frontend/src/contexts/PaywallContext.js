/**
 * Paywall Context
 * Manages feature access based on the current license/plan
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import LicenseService from '../services/LicenseService';
import { useAuth } from './AuthContext';

const PaywallContext = createContext();

// Feature definitions by plan type
// Features are unlocked cumulatively - higher plans include all lower plan features
const PLAN_FEATURES = {
  FREE: [
    'basic_queries',
    'view_results',
  ],
  SMALL: [
    'basic_queries',
    'view_results',
    'save_queries',
    'export_csv',
    'query_history',
  ],
  MEDIUM: [
    'basic_queries',
    'view_results',
    'save_queries',
    'export_csv',
    'query_history',
    'advanced_analytics',
    'custom_dashboards',
    'data_intelligence',
    'scheduled_queries',
  ],
  LARGE_ENTERPRISE: [
    'basic_queries',
    'view_results',
    'save_queries',
    'export_csv',
    'query_history',
    'advanced_analytics',
    'custom_dashboards',
    'data_intelligence',
    'scheduled_queries',
    'api_access',
    'team_collaboration',
    'audit_logs',
    'sso_integration',
    'priority_support',
  ],
  MANAGED_SERVICE: [
    // All features unlocked
    'basic_queries',
    'view_results',
    'save_queries',
    'export_csv',
    'query_history',
    'advanced_analytics',
    'custom_dashboards',
    'data_intelligence',
    'scheduled_queries',
    'api_access',
    'team_collaboration',
    'audit_logs',
    'sso_integration',
    'priority_support',
    'unlimited_queries',
    'dedicated_support',
    'custom_integrations',
  ],
};

// Feature display names for UI
export const FEATURE_NAMES = {
  basic_queries: 'Basic Queries',
  view_results: 'View Results',
  save_queries: 'Save Queries',
  export_csv: 'Export to CSV',
  query_history: 'Query History',
  advanced_analytics: 'Advanced Analytics',
  custom_dashboards: 'Custom Dashboards',
  data_intelligence: 'Data Intelligence',
  scheduled_queries: 'Scheduled Queries',
  api_access: 'API Access',
  team_collaboration: 'Team Collaboration',
  audit_logs: 'Audit Logs',
  sso_integration: 'SSO Integration',
  priority_support: 'Priority Support',
  unlimited_queries: 'Unlimited Queries',
  dedicated_support: 'Dedicated Support',
  custom_integrations: 'Custom Integrations',
};

// Minimum plan required for each feature
export const FEATURE_REQUIREMENTS = {
  basic_queries: 'FREE',
  view_results: 'FREE',
  save_queries: 'SMALL',
  export_csv: 'SMALL',
  query_history: 'SMALL',
  advanced_analytics: 'MEDIUM',
  custom_dashboards: 'MEDIUM',
  data_intelligence: 'MEDIUM',
  scheduled_queries: 'MEDIUM',
  api_access: 'LARGE_ENTERPRISE',
  team_collaboration: 'LARGE_ENTERPRISE',
  audit_logs: 'LARGE_ENTERPRISE',
  sso_integration: 'LARGE_ENTERPRISE',
  priority_support: 'LARGE_ENTERPRISE',
  unlimited_queries: 'MANAGED_SERVICE',
  dedicated_support: 'MANAGED_SERVICE',
  custom_integrations: 'MANAGED_SERVICE',
};

export const usePaywall = () => {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error('usePaywall must be used within a PaywallProvider');
  }
  return context;
};

export const PaywallProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current plan only when user is authenticated
  const fetchPlan = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!user) {
      setCurrentPlan({ plan_type: 'FREE' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await LicenseService.getCurrentPlan();
      if (response?.success && response?.plan) {
        setCurrentPlan(response.plan);
      } else {
        // Default to FREE if no plan found
        setCurrentPlan({ plan_type: 'FREE' });
      }
    } catch (err) {
      console.error('Failed to fetch plan:', err);
      setError(err);
      // Default to FREE on error
      setCurrentPlan({ plan_type: 'FREE' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch plan when user changes (login/logout)
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }
    fetchPlan();
  }, [fetchPlan, authLoading]);

  /**
   * Check if a feature is enabled for the current plan
   * @param {string} featureKey - The feature key to check
   * @returns {boolean} - Whether the feature is enabled
   */
  const isFeatureEnabled = useCallback((featureKey) => {
    if (loading || !currentPlan) return false;
    
    const planType = currentPlan.plan_type || 'FREE';
    const planFeatures = PLAN_FEATURES[planType] || PLAN_FEATURES.FREE;
    
    return planFeatures.includes(featureKey);
  }, [currentPlan, loading]);

  /**
   * Get the minimum required plan for a feature
   * @param {string} featureKey - The feature key
   * @returns {string} - The minimum plan type required
   */
  const getRequiredPlan = useCallback((featureKey) => {
    return FEATURE_REQUIREMENTS[featureKey] || 'MANAGED_SERVICE';
  }, []);

  /**
   * Get human-readable feature name
   * @param {string} featureKey - The feature key
   * @returns {string} - Human-readable name
   */
  const getFeatureName = useCallback((featureKey) => {
    return FEATURE_NAMES[featureKey] || featureKey;
  }, []);

  /**
   * Refresh the plan data
   */
  const refreshPlan = useCallback(() => {
    return fetchPlan();
  }, [fetchPlan]);

  /**
   * Open the upgrade page
   */
  const openUpgrade = useCallback(() => {
    window.open('https://actyze.ai/pricing', '_blank');
  }, []);

  const value = {
    currentPlan,
    loading,
    error,
    isFeatureEnabled,
    getRequiredPlan,
    getFeatureName,
    refreshPlan,
    openUpgrade,
    planFeatures: PLAN_FEATURES,
    featureNames: FEATURE_NAMES,
    featureRequirements: FEATURE_REQUIREMENTS,
  };

  return (
    <PaywallContext.Provider value={value}>
      {children}
    </PaywallContext.Provider>
  );
};

export default PaywallContext;
