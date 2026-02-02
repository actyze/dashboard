/**
 * Paywall Context
 * Manages resource limits based on the current license/plan
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import LicenseService from '../services/LicenseService';
import { useAuth } from './AuthContext';

const PaywallContext = createContext();

// Map resource type to backend field name
const LIMIT_FIELDS = {
  user: 'max_users',
  dashboard: 'max_dashboards',
  data_source: 'max_data_sources',
};

// Display names for resource types
const TYPE_DISPLAY_NAMES = {
  user: 'User',
  dashboard: 'Dashboard',
  data_source: 'Data Source',
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
      setCurrentPlan({ plan_type: 'FREE', max_users: 1, max_dashboards: 1, max_data_sources: 1 });
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
        // Default to FREE with minimal limits if no plan found
        setCurrentPlan({ plan_type: 'FREE', max_users: 1, max_dashboards: 1, max_data_sources: 1 });
      }
    } catch (err) {
      console.error('Failed to fetch plan:', err);
      setError(err);
      // Default to FREE with minimal limits on error
      setCurrentPlan({ plan_type: 'FREE', max_users: 1, max_dashboards: 1, max_data_sources: 1 });
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
   * Get the limit for a specific resource type
   * @param {string} type - The resource type (user, dashboard, data_source)
   * @returns {number|null} - The limit, or null if unlimited
   */
  const getLimit = useCallback((type) => {
    if (!currentPlan) return null;
    const field = LIMIT_FIELDS[type];
    return field ? currentPlan[field] : null;
  }, [currentPlan]);

  /**
   * Check if the current count is within the limit for a resource type
   * @param {string} type - The resource type (user, dashboard, data_source)
   * @param {number} currentCount - The current count of resources
   * @returns {Object} - { allowed, limit, current, remaining }
   */
  const checkLimit = useCallback((type, currentCount) => {
    const limit = getLimit(type);
    
    // If no limit defined or null, allow unlimited
    if (limit === null || limit === undefined) {
      return { 
        allowed: true, 
        limit: null, 
        current: currentCount,
        remaining: Infinity
      };
    }
    
    return {
      allowed: currentCount < limit,
      limit,
      current: currentCount,
      remaining: Math.max(0, limit - currentCount)
    };
  }, [getLimit]);

  /**
   * Get the display name for a resource type
   * @param {string} type - The resource type
   * @returns {string} - Human-readable name
   */
  const getTypeName = useCallback((type) => {
    return TYPE_DISPLAY_NAMES[type] || type;
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
    window.open('https://actyze.ai/#pricing', '_blank');
  }, []);

  /**
   * Check if the license is valid
   * @returns {boolean} - Whether the license is valid
   */
  const isLicenseValid = useCallback(() => {
    return currentPlan?.is_valid ?? false;
  }, [currentPlan]);

  const value = {
    currentPlan,
    loading,
    error,
    getLimit,
    checkLimit,
    getTypeName,
    refreshPlan,
    openUpgrade,
    isLicenseValid,
    limitFields: LIMIT_FIELDS,
    typeDisplayNames: TYPE_DISPLAY_NAMES,
  };

  return (
    <PaywallContext.Provider value={value}>
      {children}
    </PaywallContext.Provider>
  );
};

export default PaywallContext;
