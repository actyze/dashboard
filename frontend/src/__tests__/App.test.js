import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock heavy / problematic dependencies before importing App
jest.mock('react-plotly.js', () => () => null);
jest.mock('jspdf', () => jest.fn());
jest.mock('html2canvas', () => jest.fn());
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock('xlsx', () => ({ utils: {}, writeFile: jest.fn() }));

// Mock all contexts to avoid real API calls
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock('../contexts/ToastContext', () => ({
  ToastProvider: ({ children }) => <div>{children}</div>,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../contexts/AIAgentContext', () => ({
  AIAgentProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <div>{children}</div>,
  useTheme: () => ({ isDark: false, toggleTheme: jest.fn() }),
}));

jest.mock('../components/VoiceAI', () => ({
  FloatingAssistant: () => null,
}));

jest.mock('../components/Common', () => ({
  Layout: () => <div data-testid="layout" />,
  ToastContainer: () => null,
}));

// Mock route-level components to avoid their deep dependency trees
jest.mock('../components/Auth', () => ({
  LoginPage: () => <div data-testid="login-page">Login</div>,
  Signup: () => <div data-testid="signup-page">Signup</div>,
}));

jest.mock('../components/QueryExplorer', () => ({
  QueryPage: () => null,
  QueriesList: () => null,
}));

jest.mock('../components/Dashboard', () => ({
  Dashboard: () => null,
  DashboardsList: () => null,
}));

jest.mock('../components/Home', () => ({
  Home: () => null,
}));

jest.mock('../components/Admin/Admin', () => () => null);

jest.mock('../components/DataIntelligence', () => ({
  DataIntelligence: () => null,
}));

// Now import App after all mocks are set up
const App = require('../App').default;

describe('App', () => {
  test('renders without license check spinner', () => {
    render(<App />);
    // Should NOT show "Checking license..." — that was the old paywall
    expect(screen.queryByText(/checking license/i)).not.toBeInTheDocument();
  });

  test('renders login page for unauthenticated users', () => {
    render(<App />);
    // With user: null and loading: false, PrivateRoutes redirects to /login
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  test('does not reference PaywallProvider or LicenseCheck in source', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'App.js'),
      'utf8'
    );
    expect(source).not.toContain('PaywallProvider');
    expect(source).not.toContain('LicenseCheckWrapper');
    expect(source).not.toContain('LicenseCheckDialog');
    expect(source).not.toContain('usePaywall');
  });

  test('wraps app in AuthProvider and AIAgentProvider', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'App.js'),
      'utf8'
    );
    expect(source).toContain('AuthProvider');
    expect(source).toContain('AIAgentProvider');
    expect(source).toContain('ToastProvider');
  });
});
