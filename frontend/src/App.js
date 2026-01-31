import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { Layout, ToastContainer } from './components/Common';
import { LoginPage, Signup } from './components/Auth';
import { QueryPage, QueriesList } from './components/QueryExplorer';
import { Dashboard, DashboardsList } from './components/Dashboard';
import { Home } from './components/Home';
import Admin from './components/Admin/Admin';
import { DataIntelligence } from './components/DataIntelligence';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

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
    <AuthProvider>
      <ToastProvider>
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
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
