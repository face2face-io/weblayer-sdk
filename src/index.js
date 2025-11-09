import config from './config.js';
import { getOrCreateVisitorId } from './visitor.js';
import { initWeblayerEmitter } from './tracking/index.js';

class WebLayerSDK {
  static init(orgId, options = {}) {
    if (!orgId) {
      console.error('[weblayer] orgId is required');
      return;
    }

    // Set configuration
    config.org_id = orgId;
    config.apiUrl = options.apiUrl || config.apiUrl || 'https://api.weblayer.ai';
    config.debug = options.debug || false;
    config.weblayerEnabled = options.weblayerEnabled !== false; // Default to true

    if (config.debug) {
      console.log('[weblayer] Initializing WebLayer SDK with orgId:', orgId);
      console.log('[weblayer] API URL:', config.apiUrl);
    }

    // Get or create visitor ID (cookie-based, cross-subdomain)
    const visitorId = getOrCreateVisitorId();

    if (!visitorId) {
      console.error('[weblayer] Failed to create visitor ID');
      return;
    }

    if (config.debug) {
      console.log('[weblayer] Visitor ID:', visitorId);
    }

    // Initialize event tracking
    try {
      initWeblayerEmitter(visitorId);
    } catch (e) {
      console.error('[weblayer] Failed to initialize tracking:', e);
    }
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.WebLayerSDK = WebLayerSDK;

  // Auto-initialize if org_id is present in the script URL path
  (function() {
    // Try to get the current executing script tag first (most reliable)
    let currentScript = document.currentScript;
    
    // Fallback: find the script tag that loaded this SDK
    if (!currentScript) {
      const scripts = document.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i--) {
        const script = scripts[i];
        const src = script.src || '';
        // Check if this script tag matches our SDK (unpkg or sdk.weblayer.ai)
        if (src.includes('weblayer-sdk') || src.includes('sdk.weblayer.ai')) {
          currentScript = script;
          break;
        }
      }
    }

    // If script tag found, extract org_id from URL path
    if (currentScript) {
      let orgId = null;
      
      // First try to get org_id from URL path (sdk.weblayer.ai/org_id)
      try {
        const scriptUrl = new URL(currentScript.src);
        const pathParts = scriptUrl.pathname.split('/').filter(part => part.length > 0);
        // If path has parts and it's not just the root, use the last part as org_id
        if (pathParts.length > 0 && scriptUrl.hostname.includes('sdk.weblayer.ai')) {
          orgId = pathParts[pathParts.length - 1];
        }
      } catch (e) {
        // Fallback: simple string parsing if URL constructor fails
        const src = currentScript.src || '';
        if (src.includes('sdk.weblayer.ai/')) {
          const match = src.match(/sdk\.weblayer\.ai\/([^\/\?#]+)/);
          if (match && match[1]) {
            orgId = match[1];
          }
        }
      }
      
      // Fallback: check for data-org-id attribute (for backward compatibility)
      if (!orgId) {
        orgId = currentScript.getAttribute('data-org-id');
      }

      // Auto-initialize if org_id found
      if (orgId) {
        // Initialize immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            WebLayerSDK.init(orgId);
          });
        } else {
          WebLayerSDK.init(orgId);
        }
      }
    }
  })();
}

export default WebLayerSDK;


