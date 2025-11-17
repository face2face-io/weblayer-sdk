import config from './config.js';
import { getOrCreateVisitorId } from './visitor.js';
import { initWeblayerEmitter } from './tracking/index.js';
import { ACBController } from './acb/index.js';

// Global ACB controller instance (created when needed)
let acbControllerInstance = null;

// Initialize ACB controller (will use config.org_id when set)
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
    const MESSAGE = "yes";

    try {
      if (!orgId) {
        console.error('[weblayer] orgId is required');
        return;
      }

      // Set configuration
      config.org_id = orgId;
      config.apiUrl = options.apiUrl || config.apiUrl || 'https://api.weblayer.ai';
      config.debug = options.debug || false;
      config.weblayerEnabled = options.weblayerEnabled !== false; // Default to true

      // Log immediately like F2F SDK
      console.log("[weblayer] WebLayer SDK initialized with org_id: ", orgId, MESSAGE);

      if (config.debug) {
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

      // Update or create ACB controller with new orgId
      if (typeof window !== 'undefined') {
        try {
          if (acbControllerInstance) {
            acbControllerInstance.updateOrgId(config.org_id);
            acbControllerInstance.config.apiUrl = config.apiUrl;
            acbControllerInstance.config.debug = config.debug;
          } else {
            // Create new controller if it doesn't exist
            initializeACB();
          }
          
          if (config.debug) {
            console.log('[weblayer] ACB module updated with orgId:', config.org_id);
          }
        } catch (e) {
          console.error('[weblayer] Failed to update ACB controller:', e);
        }
      }

      return true;
    } catch (error) {
      if (config.debug) console.error("[weblayer] Error initializing WebLayer SDK:", error);
      return false;
    }
  }
}

// Add DOMContentLoaded listener as primary initialization method
document.addEventListener("DOMContentLoaded", () => {
  initializeSDK();
});

// Fallback initialization
window.addEventListener("load", () => {
  initializeSDK();
});

const INIT_TIMEOUT = 5000; // 5 seconds
setTimeout(() => {
  initializeSDK();
}, INIT_TIMEOUT);

// Helper function to handle initialization (F2F-style)
function initializeSDK() {
  if (!window._weblayerInitialized) {
    window._weblayerInitialized = true;
    const scriptTag = document.querySelector("script#weblayer-sdk");
    if (scriptTag) {
      // First try data-org-id attribute (like F2F's data-org_id)
      let orgId = scriptTag.getAttribute("data-org-id");
      
      // Fallback: extract from URL path (sdk.weblayer.ai/org_id)
      if (!orgId && scriptTag.src) {
        try {
          const scriptUrl = new URL(scriptTag.src);
          const pathParts = scriptUrl.pathname.split('/').filter(part => part.length > 0);
          if (pathParts.length > 0 && scriptUrl.hostname.includes('sdk.weblayer.ai')) {
            orgId = pathParts[pathParts.length - 1];
          }
        } catch (e) {
          // Fallback: simple string parsing if URL constructor fails
          const src = scriptTag.src || '';
          if (src.includes('sdk.weblayer.ai/')) {
            const match = src.match(/sdk\.weblayer\.ai\/([^\/\?#]+)/);
            if (match && match[1]) {
              orgId = match[1];
            }
          }
        }
      }
      
      const debug = scriptTag.getAttribute("data-debug");
      const options = debug === 'true' ? { debug: true } : {};
      
      if (orgId) {
        try {
          WebLayerSDK.init(orgId, options);
        } catch (err) {
          if (config.debug) console.error("[weblayer] Failed to initialize WebLayer SDK:", err);
        }
      } else {
        if (config.debug) console.warn("[weblayer] WebLayer SDK script tag found but no org_id detected. Call WebLayerSDK.init(orgId) manually.");
      }
    } else {
      if (config.debug) console.warn("[weblayer] WebLayer SDK script tag not found or missing id=\"weblayer-sdk\"");
    }
  }
}

if (typeof window !== 'undefined') {
  // Expose WebLayerSDK on window (like F2F does)
  window.WebLayerSDK = WebLayerSDK;

  // Initialize WEBLAYERSDK namespace for ACB methods
  window.WEBLAYERSDK = window.WEBLAYERSDK || {};

  // Expose ACB methods (they'll initialize the controller when called)
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

  // Expose act method on WebLayerSDK class
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
}

export default WebLayerSDK;


