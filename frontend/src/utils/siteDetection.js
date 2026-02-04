/**
 * Site detection utilities
 * Used to conditionally enable features based on the current domain
 */

export const isDemoSite = () => {
  return window.location.hostname === 'demo.actyze.ai';
};

export const isProductionSite = () => {
  return window.location.hostname === 'app.actyze.ai';
};

export const getSiteType = () => {
  const hostname = window.location.hostname;
  if (hostname === 'demo.actyze.ai') return 'demo';
  if (hostname === 'app.actyze.ai') return 'production';
  return 'development';
};
