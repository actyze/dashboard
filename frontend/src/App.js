import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { Layout, ToastContainer, Intercom } from './components/Common';
import { LoginPage, Signup } from './components/Auth';
import { QueryPage, QueriesList } from './components/QueryExplorer';
import { Dashboard, DashboardsList } from './components/Dashboard';
import { Home } from './components/Home';
import Admin from './components/Admin/Admin';
import { DataIntelligence } from './components/DataIntelligence';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { PaywallProvider } from './contexts/PaywallContext';
import LicenseCheckDialog from './components/Common/LicenseCheckDialog';
import axios from 'axios';

// License Check Wrapper - Runs BEFORE authentication
const LicenseCheckWrapper = ({ children }) => {
  const [checkingLicense, setCheckingLicense] = useState(true);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    setCheckingLicense(true);
    try {
      // Check license without authentication
      const response = await axios.get('/api/v1/license-check/status');
      if (response.data.has_license) {
        setHasLicense(true);
      } else {
        setShowLicenseDialog(true);
      }
    } catch (err) {
      console.error('Error checking license:', err);
      // If endpoint doesn't exist or fails, show dialog
      setShowLicenseDialog(true);
    } finally {
      setCheckingLicense(false);
    }
  };

  const handleLicenseAdded = (licenseData) => {
    console.log('License added successfully:', licenseData);
    setShowLicenseDialog(false);
    setHasLicense(true);
  };

  if (checkingLicense) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking license...</p>
        </div>
      </div>
    );
  }

  if (showLicenseDialog) {
    return (
      <LicenseCheckDialog 
        onLicenseAdded={handleLicenseAdded}
        onClose={null}  // Cannot be closed without adding license
      />
    );
  }

  if (hasLicense) {
    return children;
  }

  return null;
};

// Private Route Wrapper
const PrivateRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <LicenseCheckWrapper>
      <AuthProvider>
        <ToastProvider>
          <PaywallProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Public Dashboard Access (no auth required) */}
                <Route path="/public/dashboard/:id" element={<Dashboard isPublic={true} />} />

                {/* Protected Routes */}
                <Route element={<PrivateRoutes />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/dashboards" element={<DashboardsList />} />
                    <Route path="/dashboard/:id" element={<Dashboard />} />
                    <Route path="/queries" element={<QueriesList />} />
                    <Route path="/query/:id" element={<QueryPage />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/license" element={<Admin />} />
                    <Route path="/data-intelligence" element={<DataIntelligence />} />
                    {/* Legacy route redirect */}
                    <Route path="/preferences" element={<Navigate to="/data-intelligence" replace />} />
                  </Route>
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <ToastContainer />
              <Intercom />
            </BrowserRouter>
          </PaywallProvider>
        </ToastProvider>
      </AuthProvider>
    </LicenseCheckWrapper>
  );
}

export default App;
