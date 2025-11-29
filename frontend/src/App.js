import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import Login from './components/Login';
import Signup from './components/Signup';
import QueryPage from './components/QueryPage';
import QueriesList from './components/QueriesList';
import Dashboard from './components/Dashboard';
import DashboardsList from './components/DashboardsList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Main App Routes with Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardsList />} />
          <Route path="/dashboards" element={<DashboardsList />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />
          <Route path="/queries" element={<QueriesList />} />
          <Route path="/query/:id" element={<QueryPage />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
