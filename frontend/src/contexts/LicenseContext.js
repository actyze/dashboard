/**
 * License Context
 * Manages license state and provides license check functionality
 * License check happens AFTER user logs in, not before
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const LicenseContext = createContext();

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

export const LicenseProvider = ({ children }) => {
  const { user } = useAuth();
  const [licenseStatus, setLicenseStatus] = useState({
    checked: false,
    hasLicense: false,
    license: null,
    loading: true,
  });
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);

  // Check license when user logs in
  const checkLicense = useCallback(async () => {
    if (!user) {
      setLicenseStatus({
        checked: false,
        hasLicense: false,
        license: null,
        loading: false,
      });
      return;
    }

    try {
      setLicenseStatus(prev => ({ ...prev, loading: true }));
      const response = await axios.get('/api/v1/license-check/status');
      
      if (response.data.has_license) {
        setLicenseStatus({
          checked: true,
          hasLicense: true,
          license: response.data.license,
          loading: false,
        });
        setShowLicenseDialog(false);
      } else {
        setLicenseStatus({
          checked: true,
          hasLicense: false,
          license: null,
          loading: false,
        });
        setShowLicenseDialog(true);
      }
    } catch (err) {
      console.error('Error checking license:', err);
      setLicenseStatus({
        checked: true,
        hasLicense: false,
        license: null,
        loading: false,
      });
      setShowLicenseDialog(true);
    }
  }, [user]);

  // Check license when user changes (login/logout)
  useEffect(() => {
    if (user) {
      checkLicense();
    } else {
      setLicenseStatus({
        checked: false,
        hasLicense: false,
        license: null,
        loading: false,
      });
      setShowLicenseDialog(false);
    }
  }, [user, checkLicense]);

  // Handle license added
  const handleLicenseAdded = useCallback((licenseData) => {
    console.log('License added successfully:', licenseData);
    setLicenseStatus({
      checked: true,
      hasLicense: true,
      license: licenseData.license,
      loading: false,
    });
    setShowLicenseDialog(false);
  }, []);

  // Manually show license dialog
  const openLicenseDialog = useCallback(() => {
    setShowLicenseDialog(true);
  }, []);

  // Close license dialog (only if license exists)
  const closeLicenseDialog = useCallback(() => {
    if (licenseStatus.hasLicense) {
      setShowLicenseDialog(false);
    }
  }, [licenseStatus.hasLicense]);

  const value = {
    ...licenseStatus,
    showLicenseDialog,
    checkLicense,
    handleLicenseAdded,
    openLicenseDialog,
    closeLicenseDialog,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};

export default LicenseContext;
