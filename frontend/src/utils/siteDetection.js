/**
 * Site detection utilities
 * Used to conditionally enable features based on the current domain
 * Configure REACT_APP_SITE_TYPE env var to override detection
 */

export const isDemoSite = () => {
  return process.env.REACT_APP_SITE_TYPE === 'demo';
};

export const isProductionSite = () => {
  return process.env.REACT_APP_SITE_TYPE === 'production';
};

export const getSiteType = () => {
  return process.env.REACT_APP_SITE_TYPE || 'development';
};
