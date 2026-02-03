import { useEffect } from 'react';

/**
 * Google Analytics Component
 * Loads GA if REACT_APP_GA_TRACKING_ID is set (demo/tracking enabled deployments)
 * For customer deployments, simply don't set the env var - no GA loaded
 */
const GoogleAnalytics = () => {
  const GA_TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;

  useEffect(() => {
    if (!GA_TRACKING_ID) {
      // No tracking ID configured - skip GA entirely
      return;
    }

    // Load Google Analytics script
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
    document.head.appendChild(script1);

    // Initialize Google Analytics
    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_TRACKING_ID}', {
        page_path: window.location.pathname,
      });
    `;
    document.head.appendChild(script2);

    console.log('✅ Google Analytics loaded:', GA_TRACKING_ID);

    // Cleanup
    return () => {
      if (document.head.contains(script1)) document.head.removeChild(script1);
      if (document.head.contains(script2)) document.head.removeChild(script2);
    };
  }, [GA_TRACKING_ID]);

  return null; // No UI to render
};

export default GoogleAnalytics;
