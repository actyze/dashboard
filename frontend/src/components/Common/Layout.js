import React, { useState } from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import { useTheme } from '../../contexts/ThemeContext';
import { useLicense } from '../../contexts/LicenseContext';
import LicenseCheckDialog from './LicenseCheckDialog';

const Layout = () => {
  const { isDark } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { showLicenseDialog, hasLicense, handleLicenseAdded, loading } = useLicense();

  return (
    <div className={`${isDark ? 'dark' : ''} h-screen flex relative`}>
      {/* License Check Dialog - Shows with blurred background on ANY protected route */}
      {showLicenseDialog && !loading && (
        <>
          {/* Backdrop blur overlay */}
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          {/* License Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <LicenseCheckDialog 
              onLicenseAdded={handleLicenseAdded}
              onClose={hasLicense ? () => {} : null}
              embedded={true}
            />
          </div>
        </>
      )}

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page content */}
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
