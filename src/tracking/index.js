import config from '../config.js';

const MAX_BATCH_BYTES = 64 * 1024;
const MAX_BATCH_COUNT = 50;
const FLUSH_MS = 5000;

let queue = [];
let timer = null;

function enqueue(ev) {
  queue.push(ev);
  const estSize = JSON.stringify(queue).length;
  if (queue.length >= MAX_BATCH_COUNT || estSize >= MAX_BATCH_BYTES) {
    flush();
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_MS);
  }
}

// Store original fetch before we wrap it
let origFetchForFlush = window.fetch;

async function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  clearTimeout(timer);
  timer = null;
  try {
    // Use the ORIGINAL fetch to avoid infinite recursion
    await origFetchForFlush(`${config.apiUrl}/sdk/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    });
  } catch (e) {
    // drop on network failure for MVP
  }
}

function nowTs() {
  return new Date().toISOString();
}

function safeSnippet(text, max = 120) {
  if (!text) return null;
  return String(text).replace(/\s+/g, ' ').slice(0, max);
}

export function initWeblayerEmitter(visitorId) {
  if (!config.weblayerEnabled) return;
  if (!visitorId) return;
  if (!config.org_id) return;
  
  // ensure a session id exists
  let sid = sessionStorage.getItem('weblayer_session_id');
  if (!sid) {
    sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('weblayer_session_id', sid);
  }

  // first paint/navigation
  enqueue({
    ts: nowTs(),
    org_id: config.org_id,
    visitor_id: visitorId,
    session_id: sid,
    page_url: window.location.href,
    referrer: document.referrer || null,
    event_type: 'navigation',
    event_name: 'load',
    event_data: { title: document.title }
  });

  // errors
  window.addEventListener('error', (e) => {
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'error', event_name: 'window.onerror',
      event_data: { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno }
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'error', event_name: 'unhandledrejection',
      event_data: { message: safeSnippet(e.reason && (e.reason.message || String(e.reason))) }
    });
  });

  // HTML5 form validation errors
  document.addEventListener('invalid', (e) => {
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    const target = e.target;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'validation_error', event_name: 'invalid',
      event_data: {
        element: target.tagName.toLowerCase(),
        type: target.type || null,
        name: target.name || null,
        id: target.id || null,
        validation_message: target.validationMessage || null,
        value_length: (target.value || '').length
      }
    });
  }, true); // capture phase to catch all form fields

  // form interactions (focus, blur, input, change, submit)
  const formStartTimes = new WeakMap();
  const formFieldTimestamps = new WeakMap();
  
  function trackFormFieldEvent(eventType, e) {
    try {
      const target = e.target;
      if (!target || !target.tagName) return;
      
      const tagName = target.tagName.toLowerCase();
      if (!['input', 'textarea', 'select'].includes(tagName)) return;
      
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      const eventData = {
        field_type: target.type || tagName,
        field_name: target.name || null,
        field_id: target.id || null,
        has_value: !!(target.value && target.value.length > 0),
        value_length: (target.value || '').length
      };
      
      if (eventType === 'focus') {
        formFieldTimestamps.set(target, Date.now());
      }
      
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'form_interaction', event_name: eventType,
        event_data: eventData
      });
    } catch (e) {
      if (config.debug) console.warn(`[weblayer] Failed to track form ${eventType}:`, e);
    }
  }
  
  document.addEventListener('focus', (e) => trackFormFieldEvent('focus', e), true);
  document.addEventListener('blur', (e) => trackFormFieldEvent('blur', e), true);
  document.addEventListener('input', (e) => trackFormFieldEvent('input', e), true);
  document.addEventListener('change', (e) => trackFormFieldEvent('change', e), true);
  
  // Track form submissions
  document.addEventListener('submit', (e) => {
    try {
      const form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      // Calculate completion time if form start time exists
      const startTime = formStartTimes.get(form);
      const completionTime = startTime ? Date.now() - startTime : null;
      
      // Count form fields
      const fieldCount = form.querySelectorAll('input, textarea, select').length;
      
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'form_interaction', event_name: 'submit',
        event_data: {
          form_id: form.id || null,
          field_count: fieldCount,
          completion_time_ms: completionTime
        }
      });
      
      formStartTimes.delete(form);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track form submit:', e);
    }
  }, true);
  
  // Track when user first focuses on a form (to calculate completion time)
  document.addEventListener('focus', (e) => {
    try {
      const target = e.target;
      if (!target || !target.tagName) return;
      
      const tagName = target.tagName.toLowerCase();
      if (!['input', 'textarea', 'select'].includes(tagName)) return;
      
      const form = target.closest('form');
      if (form && !formStartTimes.has(form)) {
        formStartTimes.set(form, Date.now());
      }
    } catch (e) {
      // Silently fail
    }
  }, true);

  // document-level focus/blur events
  document.addEventListener('focusin', (e) => {
    try {
      const target = e.target;
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'focus', event_name: 'focusin',
        event_data: {
          target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null,
          target_id: target ? target.id || null : null,
          target_classes: target ? target.className || null : null
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track focusin:', e);
    }
  }, true);

  document.addEventListener('focusout', (e) => {
    try {
      const target = e.target;
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'focus', event_name: 'focusout',
        event_data: {
          target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null,
          target_id: target ? target.id || null : null,
          target_classes: target ? target.className || null : null
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track focusout:', e);
    }
  }, true);

  // Console error/warn interception
  const origConsoleError = console.error;
  const origConsoleWarn = console.warn;
  
  console.error = function() {
    try {
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const message = Array.from(arguments).map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'console', event_name: 'error',
        event_data: { message: safeSnippet(message, 500) }
      });
    } catch (e) {
      // Don't break console if tracking fails
    }
    return origConsoleError.apply(console, arguments);
  };
  
  console.warn = function() {
    try {
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const message = Array.from(arguments).map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'console', event_name: 'warn',
        event_data: { message: safeSnippet(message, 500) }
      });
    } catch (e) {
      // Don't break console if tracking fails
    }
    return origConsoleWarn.apply(console, arguments);
  };

  // network fetch
  const origFetch = window.fetch;
  
  // Only wrap if not already wrapped
  if (!origFetch.__weblayerWrapped) {
    window.fetch = async function(input, init) {
    // Prevent infinite recursion if fetch is called within our tracking code
    if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].includes('/qwerty/events')) {
      return origFetch.apply(this, arguments);
    }
    
    const start = performance.now();
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
    const method = (init && init.method) || (input instanceof Request && input.method) || 'GET';
    
    try {
      const res = await origFetch.apply(this, arguments);
      const dur = Math.round(performance.now() - start);
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      // Track the request (non-blocking)
      try {
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'network', event_name: method,
          event_data: { url: url, method: method },
          status: res.status, duration_ms: dur
        });
      } catch (e) {
        // Don't break the original request if tracking fails
        if (config.debug) console.warn('[weblayer] Failed to track fetch:', e);
      }
      
      return res;
    } catch (err) {
      const dur = Math.round(performance.now() - start);
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      // Track the error (non-blocking)
      try {
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'network', event_name: method,
          event_data: { url: url, method: method, error: safeSnippet(err && err.message) },
          status: 0, duration_ms: dur
        });
      } catch (e) {
        // Don't break the original request if tracking fails
        if (config.debug) console.warn('[weblayer] Failed to track fetch error:', e);
      }
      
      throw err;
    }
    };
    
    // Preserve original fetch properties
    window.fetch.__weblayerWrapped = true;
    window.fetch.toString = () => origFetch.toString();
  }

  // network XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  
  // Only wrap if not already wrapped
  if (!origOpen.__weblayerWrapped) {
    XMLHttpRequest.prototype.open = function(method, url) {
    this._weblayerMethod = method;
    this._weblayerUrl = url;
    // Prevent tracking our own requests
    this._weblayerSkip = typeof url === 'string' && url.includes('/qwerty/events');
    return origOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    // Skip if this is our own request
    if (this._weblayerSkip) {
      return origSend.apply(this, arguments);
    }
    
    const start = performance.now();
    const method = this._weblayerMethod || 'GET';
    const url = this._weblayerUrl || '';
    
    this.addEventListener('loadend', function() {
      try {
        const dur = Math.round(performance.now() - start);
        const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'network', event_name: method,
          event_data: { url: url, method: method },
          status: this.status || 0, duration_ms: dur
        });
      } catch (e) {
        // Don't break the original request if tracking fails
        if (config.debug) console.warn('[weblayer] Failed to track XHR:', e);
      }
    });
    
      return origSend.apply(this, arguments);
    };
    
    // Mark as wrapped
    XMLHttpRequest.prototype.open.__weblayerWrapped = true;
    XMLHttpRequest.prototype.send.__weblayerWrapped = true;
  }

  // media events
  const trackedMediaElements = new WeakSet();
  
  function attachMediaListeners(element) {
    if (trackedMediaElements.has(element)) return;
    if (!element.src && !element.srcObject) return; // Only track elements with src
    
    trackedMediaElements.add(element);
    const mediaEvents = ['play', 'pause', 'ended', 'seeking', 'timeupdate', 'volumechange', 'error'];
    
    mediaEvents.forEach(eventName => {
      element.addEventListener(eventName, (e) => {
        try {
          const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
          const mediaEl = e.target;
          const src = mediaEl.src || (mediaEl.srcObject ? 'blob/object' : null) || null;
          
          // Only track if element still has src
          if (!src && !mediaEl.srcObject) return;
          
          enqueue({
            ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
            session_id: sid2,
            page_url: window.location.href, referrer: document.referrer || null,
            event_type: 'media', event_name: eventName,
            event_data: {
              element_type: mediaEl.tagName.toLowerCase(),
              src: safeSnippet(src, 200),
              current_time: mediaEl.currentTime || null,
              duration: mediaEl.duration || null,
              volume: mediaEl.volume !== undefined ? mediaEl.volume : null,
              muted: mediaEl.muted !== undefined ? mediaEl.muted : null,
              paused: mediaEl.paused !== undefined ? mediaEl.paused : null
            }
          });
        } catch (e) {
          if (config.debug) console.warn(`[weblayer] Failed to track media ${eventName}:`, e);
        }
      });
    });
  }
  
  // Find and track existing media elements
  function trackExistingMedia() {
    try {
      const videoElements = document.querySelectorAll('video');
      const audioElements = document.querySelectorAll('audio');
      
      videoElements.forEach(el => attachMediaListeners(el));
      audioElements.forEach(el => attachMediaListeners(el));
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track existing media:', e);
    }
  }
  
  // Track existing media on page load
  trackExistingMedia();
  
  // Use MutationObserver to track dynamically added media elements
  if (typeof MutationObserver !== 'undefined') {
    const mediaObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
              attachMediaListeners(node);
            }
            // Also check for media elements added inside the node
            const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
            const audios = node.querySelectorAll ? node.querySelectorAll('audio') : [];
            videos.forEach(el => attachMediaListeners(el));
            audios.forEach(el => attachMediaListeners(el));
          }
        });
      });
    });
    
    try {
      mediaObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to set up media observer:', e);
    }
  }

  // clicks (lightweight; no PII) + dead-click detection
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.tagName) return;
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    
    // Track the click event
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'click', event_name: t.tagName.toLowerCase(),
      event_data: {
        id: t.id || null,
        classes: t.className || null,
        text: safeSnippet(t.textContent)
      }
    });
    
    // Dead-click detection: Check if click produced any response
    const checkpoint = {
      url: window.location.href,
      queueLength: queue.length,
      timestamp: Date.now()
    };
    
    // Track various signals that indicate the click is working
    let activityDetected = false;
    
    // Track if network activity starts (even if not completed yet)
    const networkCheckInterval = setInterval(() => {
      if (queue.length > checkpoint.queueLength) {
        activityDetected = true;
        clearInterval(networkCheckInterval);
      }
    }, 50); // Check every 50ms for network activity
    
    // Detect focus changes (lightweight check)
    const focusHandler = () => { activityDetected = true; };
    document.addEventListener('focusin', focusHandler, { once: true, capture: true });
    
    // Cleanup function
    const cleanup = () => {
      clearInterval(networkCheckInterval);
      document.removeEventListener('focusin', focusHandler, true);
    };
    
    // Compute DOM fingerprint to detect changes
    const getDOMFingerprint = () => {
      try {
        // Check multiple signals of DOM activity
        const visibleText = document.body.innerText.slice(0, 1000);
        const modalCount = document.querySelectorAll('[role="dialog"], .modal, .popup').length;
        
        // Loading indicators (visible or hidden)
        const loadingIndicators = document.querySelectorAll(
          '[class*="loading"], [class*="spinner"], [class*="Loading"], [class*="Spinner"], ' +
          '[aria-busy="true"], [data-loading="true"], ' +
          'svg[class*="spin"], svg[class*="rotate"]'  // Animated spinners
        ).length;
        
        // Disabled states (buttons often get disabled during loading)
        const disabledElements = document.querySelectorAll('button:disabled, input:disabled').length;
        
        // Class changes on the clicked element or its parents (React often toggles classes)
        let clickedElementState = '';
        try {
          if (t && t.isConnected) {  // Element still in DOM
            clickedElementState = `${t.className}-${t.disabled}-${t.getAttribute('aria-busy')}`;
          } else {
            // Element was removed from DOM (React re-render) - that's activity!
            return 'element-removed';
          }
        } catch (e) {
          // Element might have been garbage collected
          return 'element-removed';
        }
        
        return `${visibleText.length}-${modalCount}-${loadingIndicators}-${disabledElements}-${clickedElementState}`;
      } catch (e) {
        return 'error';
      }
    };
    
    const beforeFingerprint = getDOMFingerprint();
    
    // Check multiple times to catch slower responses
    const checkForResponse = (checkNumber) => {
      try {
        // Check if anything changed
        const didNavigate = window.location.href !== checkpoint.url;
        const afterFingerprint = getDOMFingerprint();
        const domChanged = beforeFingerprint !== afterFingerprint;
        
        // If something happened, it's not a dead-click
        if (didNavigate || domChanged || activityDetected) {
          cleanup();
          return; // Not a dead-click
        }
        
        // If this is final check and still nothing happened, report dead-click
        if (checkNumber === 2) {
          cleanup();
          const computedStyle = window.getComputedStyle(t);
          const hasClickHandler = !!(t.onclick || t.getAttribute('onclick'));
          const cursorStyle = computedStyle.cursor;
          const isInteractiveTag = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
          
          // Check for legitimate CSS-only interactions (labels, accordions, etc.)
          const hasLabel = t.tagName === 'LABEL' && t.htmlFor;  // Label triggers input focus
          const hasHref = t.tagName === 'A' && t.href && t.href !== '#' && !t.href.startsWith('javascript:');
          const isFormElement = ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
          
          // Only report if element seems like it should cause visible change
          const shouldCauseChange = (isInteractiveTag && !hasLabel && !isFormElement) || 
                                    (hasClickHandler && !hasHref) || 
                                    (cursorStyle === 'pointer' && !hasLabel);
          
          if (shouldCauseChange) {
            const sid3 = sessionStorage.getItem('weblayer_session_id') || sid;
            enqueue({
              ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
              session_id: sid3,
              page_url: window.location.href, referrer: document.referrer || null,
              event_type: 'dead_click', event_name: 'no_response',
              event_data: {
                element: {
                  tag: t.tagName.toLowerCase(),
                  id: t.id || null,
                  classes: t.className || null,
                  text: safeSnippet(t.textContent),
                  href: t.href || null
                },
                context: {
                  expected_interactive: isInteractiveTag,
                  has_click_handler: hasClickHandler,
                  cursor_style: cursorStyle,
                  time_since_click: Date.now() - checkpoint.timestamp
                }
              }
            });
          }
        }
      } catch (err) {
        // Silently fail - don't break user experience
        if (config.debug) console.warn('[weblayer] Dead-click detection failed:', err);
      }
    };
    
    // Check at 500ms, then again at 1500ms to catch slow responses
    setTimeout(() => checkForResponse(1), 500);
    setTimeout(() => checkForResponse(2), 1500);
  }, { capture: true });

  // hover/pointer movements
  const hoverStartTimes = new WeakMap();
  let hoverThrottleTimer = null;
  
  document.addEventListener('mouseenter', (e) => {
    try {
      const target = e.target;
      if (!target || !target.tagName) return;
      
      const startTime = Date.now();
      hoverStartTimes.set(target, startTime);
      
      // Throttle to avoid flooding
      clearTimeout(hoverThrottleTimer);
      hoverThrottleTimer = setTimeout(() => {
        const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'hover', event_name: 'mouseenter',
          event_data: {
            target_tag: target.tagName.toLowerCase(),
            target_id: target.id || null,
            target_classes: target.className || null
          }
        });
      }, 100);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track mouseenter:', e);
    }
  }, { capture: true });

  document.addEventListener('mouseleave', (e) => {
    try {
      const target = e.target;
      if (!target || !target.tagName) return;
      
      const startTime = hoverStartTimes.get(target);
      const duration = startTime ? Date.now() - startTime : null;
      
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'hover', event_name: 'mouseleave',
        event_data: {
          target_tag: target.tagName.toLowerCase(),
          target_id: target.id || null,
          target_classes: target.className || null,
          duration_ms: duration
        }
      });
      
      hoverStartTimes.delete(target);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track mouseleave:', e);
    }
  }, { capture: true });

  // Track mouseover on interactive elements (throttled)
  let mouseoverThrottleTimer = null;
  document.addEventListener('mouseover', (e) => {
    try {
      const target = e.target;
      if (!target || !target.tagName) return;
      
      const tagName = target.tagName.toLowerCase();
      const isInteractive = ['a', 'button', 'input', 'select', 'textarea'].includes(tagName) ||
                            target.getAttribute('role') === 'button' ||
                            target.getAttribute('tabindex') !== null;
      
      if (!isInteractive) return;
      
      clearTimeout(mouseoverThrottleTimer);
      mouseoverThrottleTimer = setTimeout(() => {
        const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'hover', event_name: 'hover',
          event_data: {
            target_tag: tagName,
            target_id: target.id || null,
            target_classes: target.className || null
          }
        });
      }, 100);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track mouseover:', e);
    }
  }, { capture: true });

  // touch events
  let touchMoveTimer = null;
  document.addEventListener('touchstart', (e) => {
    try {
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const touch = e.touches[0];
      const target = e.target;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'touch', event_name: 'touchstart',
        event_data: {
          x: touch ? touch.clientX : null,
          y: touch ? touch.clientY : null,
          target_id: target ? target.id || null : null,
          target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null,
          target_classes: target ? target.className || null : null,
          touches_count: e.touches.length
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track touchstart:', e);
    }
  }, { capture: true });

  document.addEventListener('touchend', (e) => {
    try {
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const touch = e.changedTouches[0];
      const target = e.target;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'touch', event_name: 'touchend',
        event_data: {
          x: touch ? touch.clientX : null,
          y: touch ? touch.clientY : null,
          target_id: target ? target.id || null : null,
          target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null,
          target_classes: target ? target.className || null : null,
          touches_count: e.changedTouches.length
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track touchend:', e);
    }
  }, { capture: true });

  document.addEventListener('touchmove', (e) => {
    try {
      clearTimeout(touchMoveTimer);
      touchMoveTimer = setTimeout(() => {
        const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
        const touch = e.touches[0];
        const target = e.target;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'touch', event_name: 'touchmove',
          event_data: {
            x: touch ? touch.clientX : null,
            y: touch ? touch.clientY : null,
            target_id: target ? target.id || null : null,
            target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null,
            target_classes: target ? target.className || null : null,
            touches_count: e.touches.length
          }
        });
      }, 100); // Throttle touchmove to avoid flooding
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track touchmove:', e);
    }
  }, { capture: true });

  // scroll tracking with content capture
  let scrollTimer = null;
  let scrollStopTimer = null;
  let currentScrollStop = null;
  let lastScrollX = window.scrollX || 0;
  let lastScrollY = window.scrollY || 0;
  let lastScrollTime = Date.now();
  let durationUpdateInterval = null;

  function captureVisibleContent() {
    try {
      const viewportTop = window.scrollY || window.pageYOffset || 0;
      const viewportBottom = viewportTop + window.innerHeight;
      const viewportLeft = window.scrollX || window.pageXOffset || 0;
      const viewportRight = viewportLeft + window.innerWidth;

      const headings = [];
      const textSnippets = [];
      const images = [];
      const maxContentLength = 1000;

      // Use IntersectionObserver if available, otherwise fallback to manual calculation
      if (typeof IntersectionObserver !== 'undefined') {
        // Sample approach: query visible elements
        const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, img, [role="heading"]');
        
        allElements.forEach(el => {
          try {
            const rect = el.getBoundingClientRect();
            const elementTop = viewportTop + rect.top;
            const elementBottom = elementTop + rect.height;
            const elementLeft = viewportLeft + rect.left;
            const elementRight = elementLeft + rect.width;

            // Check if element is in viewport
            const isVisible = elementBottom > viewportTop && 
                            elementTop < viewportBottom &&
                            elementRight > viewportLeft && 
                            elementLeft < viewportRight;

            if (isVisible && rect.width > 0 && rect.height > 0) {
              const tagName = el.tagName ? el.tagName.toLowerCase() : '';
              
              if (tagName.match(/^h[1-6]$/) || el.getAttribute('role') === 'heading') {
                const headingText = safeSnippet(el.textContent || el.innerText, 200);
                if (headingText) {
                  headings.push({ level: tagName, text: headingText });
                }
              } else if (tagName === 'img') {
                const alt = safeSnippet(el.alt, 100);
                const src = safeSnippet(el.src, 200);
                images.push({ alt: alt || null, src: src || null });
              } else if (tagName === 'p' || el.textContent) {
                const text = safeSnippet(el.textContent || el.innerText, 300);
                if (text && !textSnippets.includes(text)) {
                  textSnippets.push(text);
                  if (textSnippets.join(' ').length >= maxContentLength) return;
                }
              }
            }
          } catch (e) {
            // Skip this element if error
          }
        });
      } else {
        // Fallback: sample from viewport center points
        const centerY = viewportTop + window.innerHeight / 2;
        const centerX = viewportLeft + window.innerWidth / 2;
        
        const samplePoints = [
          [centerX, centerY],
          [centerX, viewportTop + window.innerHeight * 0.25],
          [centerX, viewportTop + window.innerHeight * 0.75]
        ];

        samplePoints.forEach(([x, y]) => {
          try {
            const el = document.elementFromPoint(x - viewportLeft, y - viewportTop);
            if (el) {
              const tagName = el.tagName ? el.tagName.toLowerCase() : '';
              if (tagName.match(/^h[1-6]$/)) {
                const headingText = safeSnippet(el.textContent, 200);
                if (headingText) {
                  headings.push({ level: tagName, text: headingText });
                }
              } else if (el.textContent) {
                const text = safeSnippet(el.textContent, 300);
                if (text && !textSnippets.includes(text)) {
                  textSnippets.push(text);
                }
              }
            }
          } catch (e) {
            // Skip if error
          }
        });
      }

      // Limit content to prevent large payloads
      return {
        headings: headings.slice(0, 10),
        text_snippets: textSnippets.slice(0, 5),
        images: images.slice(0, 5)
      };
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to capture visible content:', e);
      return { headings: [], text_snippets: [], images: [] };
    }
  }

  function recordScrollStop(scrollX, scrollY, direction) {
    try {
      const now = Date.now();
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const visibleContent = captureVisibleContent();

      const scrollStop = {
        scroll_x: scrollX,
        scroll_y: scrollY,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        visible_content: visibleContent,
        scroll_direction: direction,
        stop_time: now
      };

      currentScrollStop = scrollStop;

      // Clear any existing duration update interval
      if (durationUpdateInterval) {
        clearInterval(durationUpdateInterval);
        durationUpdateInterval = null;
      }

      // Periodically update duration while at stop (every 2 seconds)
      durationUpdateInterval = setInterval(() => {
        if (currentScrollStop && currentScrollStop.stop_time) {
          const duration = Date.now() - currentScrollStop.stop_time;
          // Update duration but don't enqueue yet - wait for next scroll or unload
          currentScrollStop.duration_ms = duration;
        }
      }, 2000);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to record scroll stop:', e);
    }
  }

  function flushScrollStop() {
    if (!currentScrollStop) return;
    
    try {
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      const duration = Date.now() - (currentScrollStop.stop_time || Date.now());

      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'scroll', event_name: 'scroll_stop',
        event_data: {
          scroll_x: currentScrollStop.scroll_x,
          scroll_y: currentScrollStop.scroll_y,
          viewport_width: currentScrollStop.viewport_width,
          viewport_height: currentScrollStop.viewport_height,
          visible_content: currentScrollStop.visible_content,
          scroll_direction: currentScrollStop.scroll_direction,
          duration_ms: duration
        }
      });

      currentScrollStop = null;
      if (durationUpdateInterval) {
        clearInterval(durationUpdateInterval);
        durationUpdateInterval = null;
      }
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to flush scroll stop:', e);
    }
  }

  // Throttled scroll event listener
  window.addEventListener('scroll', () => {
    try {
      clearTimeout(scrollTimer);
      clearTimeout(scrollStopTimer);

      scrollTimer = setTimeout(() => {
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const now = Date.now();

        // Determine scroll direction
        let direction = null;
        if (currentScrollStop) {
          const deltaY = scrollY - lastScrollY;
          if (Math.abs(deltaY) > 10) { // Only if significant movement
            direction = deltaY > 0 ? 'down' : 'up';
          }
        }

        // If we had a previous scroll stop, flush it first
        if (currentScrollStop && (Math.abs(scrollY - lastScrollY) > 10 || Math.abs(scrollX - lastScrollX) > 10)) {
          flushScrollStop();
        }

        lastScrollX = scrollX;
        lastScrollY = scrollY;
        lastScrollTime = now;

        // Set timer to detect scroll stop (600ms delay)
        scrollStopTimer = setTimeout(() => {
          const finalScrollX = window.scrollX || window.pageXOffset || 0;
          const finalScrollY = window.scrollY || window.pageYOffset || 0;
          const finalDirection = direction || (finalScrollY > (lastScrollY || 0) ? 'down' : finalScrollY < (lastScrollY || 0) ? 'up' : null);
          recordScrollStop(finalScrollX, finalScrollY, finalDirection);
        }, 600);
      }, 150); // Throttle scroll events to 150ms
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track scroll:', e);
    }
  }, { passive: true });

  // Flush scroll stop on page unload/visibility change
  window.addEventListener('beforeunload', () => {
    flushScrollStop();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushScrollStop();
    }
  });

  // text selection and copy
  let selectionChangeTimer = null;
  
  document.addEventListener('selectstart', (e) => {
    try {
      const target = e.target;
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'selection', event_name: 'selectstart',
        event_data: {
          target_tag: target ? target.tagName ? target.tagName.toLowerCase() : null : null
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track selectstart:', e);
    }
  }, { capture: true });

  document.addEventListener('selectionchange', () => {
    try {
      clearTimeout(selectionChangeTimer);
      selectionChangeTimer = setTimeout(() => {
        try {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (!selectedText || selectedText.trim().length === 0) return;
          
          const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
          
          enqueue({
            ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
            session_id: sid2,
            page_url: window.location.href, referrer: document.referrer || null,
            event_type: 'selection', event_name: 'selectionchange',
            event_data: {
              text_snippet: safeSnippet(selectedText, 200),
              text_length: selectedText.length,
              target_tag: range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
                ? range.commonAncestorContainer.tagName ? range.commonAncestorContainer.tagName.toLowerCase() : null
                : null
            }
          });
        } catch (e) {
          // Silently fail
        }
      }, 200); // Throttle selectionchange
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track selectionchange:', e);
    }
  });

  document.addEventListener('copy', (e) => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const copiedText = range.toString();
      if (!copiedText || copiedText.trim().length === 0) return;
      
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'selection', event_name: 'copy',
        event_data: {
          text_snippet: safeSnippet(copiedText, 200),
          text_length: copiedText.length,
          target_tag: range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer.tagName ? range.commonAncestorContainer.tagName.toLowerCase() : null
            : null
        }
      });
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track copy:', e);
    }
  }, { capture: true });

  // SPA navigation (history API)
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  
  history.pushState = function() {
    flushScrollStop(); // Flush scroll stop before navigation
    origPushState.apply(this, arguments);
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'navigation', event_name: 'pushstate',
      event_data: { title: document.title, state: arguments[0] }
    });
  };
  
  history.replaceState = function() {
    flushScrollStop(); // Flush scroll stop before navigation
    origReplaceState.apply(this, arguments);
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'navigation', event_name: 'replacestate',
      event_data: { title: document.title, state: arguments[0] }
    });
  };
  
  window.addEventListener('popstate', (e) => {
    flushScrollStop(); // Flush scroll stop before navigation
    const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
    enqueue({
      ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
      session_id: sid2,
      page_url: window.location.href, referrer: document.referrer || null,
      event_type: 'navigation', event_name: 'popstate',
      event_data: { title: document.title, state: e.state }
    });
  });

  // window resize (debounced)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    try {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid2,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'resize', event_name: 'window_resize',
          event_data: { width: window.innerWidth, height: window.innerHeight }
        });
      }, 300);
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track resize:', e);
    }
  });

  // Flush on page unload to avoid losing events
  window.addEventListener('beforeunload', () => {
    flush();
  });
  
  // page visibility tracking (active vs inactive time)
  let visibilityStartTime = Date.now();
  let cumulativeActiveTime = 0;
  let cumulativeInactiveTime = 0;
  let lastVisibilityChange = Date.now();
  let visibilityUpdateInterval = null;
  
  function updateVisibilityTracking() {
    const now = Date.now();
    if (!document.hidden) {
      // Page is visible - accumulate active time
      cumulativeActiveTime += (now - lastVisibilityChange);
    } else {
      // Page is hidden - accumulate inactive time
      cumulativeInactiveTime += (now - lastVisibilityChange);
    }
    lastVisibilityChange = now;
  }
  
  document.addEventListener('visibilitychange', () => {
    try {
      updateVisibilityTracking();
      
      const sid2 = sessionStorage.getItem('weblayer_session_id') || sid;
      
      enqueue({
        ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
        session_id: sid2,
        page_url: window.location.href, referrer: document.referrer || null,
        event_type: 'visibility', event_name: document.hidden ? 'hidden' : 'visible',
        event_data: {
          active_time_ms: cumulativeActiveTime,
          inactive_time_ms: cumulativeInactiveTime
        }
      });
      
      // Flush events when tab is hidden
      if (document.hidden) {
        flush();
        
        // Clear interval when hidden
        if (visibilityUpdateInterval) {
          clearInterval(visibilityUpdateInterval);
          visibilityUpdateInterval = null;
        }
      } else {
        // Start periodic updates when visible (every 30 seconds)
        if (visibilityUpdateInterval) {
          clearInterval(visibilityUpdateInterval);
        }
        visibilityUpdateInterval = setInterval(() => {
          try {
            updateVisibilityTracking();
            const sid3 = sessionStorage.getItem('weblayer_session_id') || sid;
            enqueue({
              ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
              session_id: sid3,
              page_url: window.location.href, referrer: document.referrer || null,
              event_type: 'visibility', event_name: 'active_time_update',
              event_data: {
                active_time_ms: cumulativeActiveTime,
                inactive_time_ms: cumulativeInactiveTime
              }
            });
          } catch (e) {
            if (config.debug) console.warn('[weblayer] Failed to update visibility:', e);
          }
        }, 30000); // Every 30 seconds
      }
    } catch (e) {
      if (config.debug) console.warn('[weblayer] Failed to track visibility:', e);
    }
  });
  
  // Track initial visibility state
  if (!document.hidden) {
    lastVisibilityChange = Date.now();
    visibilityUpdateInterval = setInterval(() => {
      try {
        updateVisibilityTracking();
        const sid3 = sessionStorage.getItem('weblayer_session_id') || sid;
        enqueue({
          ts: nowTs(), org_id: config.org_id, visitor_id: visitorId,
          session_id: sid3,
          page_url: window.location.href, referrer: document.referrer || null,
          event_type: 'visibility', event_name: 'active_time_update',
          event_data: {
            active_time_ms: cumulativeActiveTime,
            inactive_time_ms: cumulativeInactiveTime
          }
        });
      } catch (e) {
        if (config.debug) console.warn('[weblayer] Failed to update visibility:', e);
      }
    }, 30000);
  }
}

