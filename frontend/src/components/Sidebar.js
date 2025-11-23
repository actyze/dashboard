import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Text, Button } from './ui';

const Sidebar = ({ isCollapsed, onToggle, currentView, onNavigate }) => {
  const { isDark } = useTheme();

  // Icons
  const HomeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );

  const QueriesIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const ProjectsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );


  const AIIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );

  const MonitoringIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );


  const ComputeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const AdminIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const ChevronLeftIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );

  const menuItems = [
    {
      section: 'Work with data',
      items: [
        { id: 'queries-list', label: 'Queries', icon: <QueriesIcon />, view: 'queries-list' },
        { id: 'home', label: 'Home', icon: <HomeIcon /> },
        { id: 'projects', label: 'Projects', icon: <ProjectsIcon /> },
        { id: 'ai-ml', label: 'AI & ML', icon: <AIIcon /> },
        { id: 'monitoring', label: 'Monitoring', icon: <MonitoringIcon /> },
      ]
    },
    {
      section: 'Manage',
      items: [
        { id: 'compute', label: 'Compute', icon: <ComputeIcon /> },
        { id: 'admin', label: 'Admin', icon: <AdminIcon /> },
      ]
    }
  ];

  const MenuItem = ({ item, section }) => (
    <button
      onClick={() => {
        if (item.view && onNavigate) {
          onNavigate(item.view);
        }
      }}
      className={`
        w-full flex items-center px-3 py-2.5 text-left rounded-lg transition-all duration-200
        ${(item.view && currentView === item.view) || (item.id === 'queries-list' && currentView === 'query-page')
          ? 'bg-blue-600 text-white shadow-sm' 
          : isDark 
            ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }
        ${isCollapsed ? 'justify-center' : 'justify-start'}
        group
      `}
    >
      <span className={`flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`}>
        {item.icon}
      </span>
      {!isCollapsed && (
        <span className="text-sm font-medium">{item.label}</span>
      )}
    </button>
  );

  const SectionHeader = ({ title }) => (
    !isCollapsed && (
      <Text 
        variant="caption" 
        className={`uppercase tracking-wider font-semibold px-3 mt-6 mb-3 ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {title}
      </Text>
    )
  );

  return (
    <div className={`
      h-full flex flex-col transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-64'}
      ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      border-r
    `}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <Text variant="h6" className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Dashboard
            </Text>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark 
              ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((section, sectionIndex) => (
          <div key={section.section}>
            <SectionHeader title={section.section} />
            <div className={`space-y-1 ${isCollapsed && sectionIndex > 0 ? 'mt-4' : ''}`}>
              {section.items.map((item) => (
                <MenuItem key={item.id} item={item} section={section.section} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User Section */}
      <div className={`p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            UV
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <Text className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Uddish Verma
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                PUBLIC
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;