import config from './config.js';
import { getOrCreateVisitorId } from './visitor.js';
import { initWeblayerEmitter } from './tracking/index.js';
import { ACBController } from './acb/index.js';

// Global ACB controller instance (created immediately)
let acbControllerInstance = null;

// Initialize ACB controller immediately (will use config.org_id when set)
function initializeACB() {
  if (!acbControllerInstance) {
    try {
      acbControllerInstance = new ACBController({
        apiUrl: config.apiUrl || 'https://api.weblayer.ai',
        orgId: config.org_id,
        debug: config.debug || false
      });
    } catch (e) {
      console.error('[weblayer] Failed to initialize ACB controller:', e);
    }
  }
  return acbControllerInstance;
}

// Expose ACB methods on window.WEBLAYERSDK immediately
if (typeof window !== 'undefined') {
  window.WEBLAYERSDK = window.WEBLAYERSDK || {};
  
  // Initialize ACB controller
  initializeACB();
  
  // Expose methods immediately (they'll use the controller instance)
  window.WEBLAYERSDK.acb = async (prompt, mode = 'act') => {
    const controller = initializeACB();
    if (!controller) {
      throw new Error('ACB not available. Make sure WebLayerSDK.init() has been called with an orgId.');
    }
    return await controller.acb(prompt, mode);
  };

  window.WEBLAYERSDK.acbStop = async () => {
    const controller = initializeACB();
    if (!controller) {
      throw new Error('ACB not available. Make sure WebLayerSDK.init() has been called with an orgId.');
    }
    return await controller.acbStop();
  };

  window.WEBLAYERSDK.acbPause = async () => {
    const controller = initializeACB();
    if (!controller) {
      throw new Error('ACB not available. Make sure WebLayerSDK.init() has been called with an orgId.');
    }
    return await controller.acbPause();
  };

  window.WEBLAYERSDK.acbResume = async () => {
    const controller = initializeACB();
    if (!controller) {
      throw new Error('ACB not available. Make sure WebLayerSDK.init() has been called with an orgId.');
    }
    return await controller.acbResume();
  };

  window.WEBLAYERSDK.acbStatus = () => {
    const controller = initializeACB();
    if (!controller) {
      return { running: false, error: 'ACB not available' };
    }
    return controller.getStatus();
  };
}

class WebLayerSDK {
  /**
   * Convenience method: alias for WEBLAYERSDK.acb()
   * @param {string} prompt - Natural language instruction
   * @param {string} mode - Execution mode ('act' or 'guide')
   */
  static act(prompt, mode = 'act') {
    if (typeof window !== 'undefined' && window.WEBLAYERSDK && window.WEBLAYERSDK.acb) {
      return window.WEBLAYERSDK.acb(prompt, mode);
    }
    throw new Error('WEBLAYERSDK not available. Make sure the SDK is loaded and WebLayerSDK.init() has been called.');
  }

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

    // Update ACB controller with new orgId (if controller exists)
    if (typeof window !== 'undefined' && acbControllerInstance) {
      try {
        acbControllerInstance.updateOrgId(config.org_id);
        acbControllerInstance.config.apiUrl = config.apiUrl;
        acbControllerInstance.config.debug = config.debug;
        
        // Log initialization similar to f2f SDK
        console.log('[weblayer] WebLayer SDK initialized with org_id:', config.org_id);
        
        if (config.debug) {
          console.log('[weblayer] ACB module updated with orgId:', config.org_id);
        }
      } catch (e) {
        console.error('[weblayer] Failed to update ACB controller:', e);
      }
    } else if (typeof window !== 'undefined') {
      // Log even if controller doesn't exist yet
      console.log('[weblayer] WebLayer SDK initialized with org_id:', config.org_id);
    }
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.WebLayerSDK = WebLayerSDK;
  
  // Expose act method on WebLayerSDK class immediately
  // This ensures it's available even before init() is called
  WebLayerSDK.act = function(prompt, mode = 'act') {
    if (window.WEBLAYERSDK && window.WEBLAYERSDK.acb) {
      return window.WEBLAYERSDK.acb(prompt, mode);
    }
    throw new Error('WEBLAYERSDK not available. Make sure the SDK is loaded and WebLayerSDK.init() has been called.');
  };
  
  // Also expose on window for easier access
  window.act = function(prompt, mode = 'act') {
    return WebLayerSDK.act(prompt, mode);
  };

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
          console.log('[weblayer] Auto-detected org_id from URL:', orgId);
        }
      } catch (e) {
        // Fallback: simple string parsing if URL constructor fails
        const src = currentScript.src || '';
        if (src.includes('sdk.weblayer.ai/')) {
          const match = src.match(/sdk\.weblayer\.ai\/([^\/\?#]+)/);
          if (match && match[1]) {
            orgId = match[1];
            console.log('[weblayer] Auto-detected org_id from URL (fallback):', orgId);
          }
        }
      }
      
      // Fallback: check for data-org-id attribute (for backward compatibility)
      if (!orgId) {
        orgId = currentScript.getAttribute('data-org-id');
      }

      // Auto-initialize if org_id found
      if (orgId) {
        console.log('[weblayer] Auto-initializing with org_id:', orgId);
        // Initialize immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            WebLayerSDK.init(orgId);
          });
        } else {
          WebLayerSDK.init(orgId);
        }
      } else {
        console.log('[weblayer] No org_id found in script URL. Call WebLayerSDK.init(orgId) manually.');
      }
    }
  })();
}

export default WebLayerSDK;


