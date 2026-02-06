import { useEffect } from 'react';

// Read configuration from environment variables (injected via Helm)
const ENABLE_INTERCOM = process.env.REACT_APP_ENABLE_INTERCOM === 'true';
const INTERCOM_APP_ID = process.env.REACT_APP_INTERCOM_APP_ID || '';

/**
 * Intercom component - Helm-controlled via environment variables
 * 
 * Enabled ONLY when Helm values.frontend.intercom.enabled is true
 * This ensures customer deployments are NOT affected (disabled by default)
 * 
 * Usage: Add <Intercom /> to your App.js
 * 
 * To pass user data, use the user prop:
 * <Intercom user={{ name: 'John', email: 'john@example.com' }} />
 */
const Intercom = ({ user = null }) => {
  useEffect(() => {
    // Only load Intercom if explicitly enabled via Helm config
    if (!ENABLE_INTERCOM || !INTERCOM_APP_ID) {
      console.log('[Intercom] Disabled (REACT_APP_ENABLE_INTERCOM not set or no APP_ID)');
      return;
    }

    console.log('[Intercom] Initializing with App ID:', INTERCOM_APP_ID);

    // Load Intercom script
    const loadIntercom = () => {
      // Initialize Intercom settings
      window.intercomSettings = {
        api_base: "https://api-iam.intercom.io",
        app_id: INTERCOM_APP_ID,
        ...(user && {
          name: user.name,
          email: user.email,
          user_id: user.id,
          created_at: user.created_at,
        }),
      };

      // Intercom script loader (from Intercom docs)
      (function() {
        var w = window;
        var ic = w.Intercom;
        if (typeof ic === "function") {
          ic('reattach_activator');
          ic('update', w.intercomSettings);
        } else {
          var d = document;
          var i = function() {
            i.c(arguments);
          };
          i.q = [];
          i.c = function(args) {
            i.q.push(args);
          };
          w.Intercom = i;
          var l = function() {
            var s = d.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = 'https://widget.intercom.io/widget/' + INTERCOM_APP_ID;
            var x = d.getElementsByTagName('script')[0];
            x.parentNode.insertBefore(s, x);
          };
          if (document.readyState === 'complete') {
            l();
          } else if (w.attachEvent) {
            w.attachEvent('onload', l);
          } else {
            w.addEventListener('load', l, false);
          }
        }
      })();
    };

    loadIntercom();

    // Cleanup on unmount
    return () => {
      if (window.Intercom) {
        window.Intercom('shutdown');
      }
    };
  }, [user]);

  // Update Intercom when user changes
  useEffect(() => {
    if (!ENABLE_INTERCOM || !window.Intercom) {
      return;
    }

    if (user) {
      window.Intercom('update', {
        name: user.name,
        email: user.email,
        user_id: user.id,
        created_at: user.created_at,
      });
    }
  }, [user]);

  // This component doesn't render anything visible
  return null;
};

export default Intercom;
