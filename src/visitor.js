/**
 * Cookie-based visitor ID for cross-subdomain tracking
 * Sets cookie on root domain (e.g., .example.com) so it works across all subdomains
 */

/**
 * Get root domain from current hostname
 * app.example.com -> .example.com
 * www.example.com -> .example.com
 * localhost -> localhost
 */
function getRootDomain() {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // Handle localhost and IP addresses
  if (parts.length <= 1) {
    return host;
  }
  
  // For domains, use last two parts (e.g., .example.com)
  // This works for most domains: example.com, co.uk, etc.
  return '.' + parts.slice(-2).join('.');
}

/**
 * Get cookie value by name
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

/**
 * Set cookie with domain scope for cross-subdomain access
 */
function setCookie(name, value, days = 365) {
  const domain = getRootDomain();
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  const cookieString = `${name}=${value}; expires=${expires.toUTCString()}; domain=${domain}; path=/; SameSite=Lax`;
  document.cookie = cookieString;
}

/**
 * Get or create visitor ID
 * Tries cookie first, falls back to localStorage if cookies unavailable
 * Cookie works across subdomains, localStorage is domain-specific
 */
export function getOrCreateVisitorId() {
  const cookieName = 'weblayer_visitor_id';
  const storageKey = 'weblayer_visitor_id';
  
  // Try to get from cookie (cross-subdomain)
  let visitorId = getCookie(cookieName);
  
  if (visitorId) {
    // Also store in localStorage as backup
    try {
      localStorage.setItem(storageKey, visitorId);
    } catch (e) {
      // localStorage might be disabled
    }
    return visitorId;
  }
  
  // Try localStorage as fallback
  try {
    visitorId = localStorage.getItem(storageKey);
    if (visitorId) {
      // Sync to cookie if available
      setCookie(cookieName, visitorId);
      return visitorId;
    }
  } catch (e) {
    // localStorage might be disabled
  }
  
  // Generate new visitor ID
  visitorId = `${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  
  // Store in both cookie and localStorage
  try {
    setCookie(cookieName, visitorId);
    localStorage.setItem(storageKey, visitorId);
  } catch (e) {
    // If both fail, still return the ID (won't persist but at least works for this session)
  }
  
  return visitorId;
}


