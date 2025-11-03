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
}

export default WebLayerSDK;


