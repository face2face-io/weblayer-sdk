/**
 * Element Discovery Module
 * Scans page for interactive elements and assigns stable IDs for Claude reference
 */

export class ElementDiscovery {
    constructor() {
        this.elementCounter = 0;
    }

    /**
     * Scan page for all interactive elements
     * @returns {Object} Inventory with elements array
     */
    scan() {
        this.elementCounter = 0;
        const elements = [];

        // Query all potentially interactive elements
        const selectors = [
            'button',
            'a[href]',
            'input[type="button"]',
            'input[type="submit"]',
            'input[type="reset"]',
            'input[type="checkbox"]',
            'input[type="radio"]',
            'input[type="text"]',
            'input[type="email"]',
            'input[type="password"]',
            'input[type="search"]',
            'input[type="tel"]',
            'input[type="url"]',
            'input[type="number"]',
            'textarea',
            'select',
            '[role="button"]',
            '[role="link"]',
            '[role="checkbox"]',
            '[role="radio"]',
            '[role="textbox"]',
            '[role="combobox"]',
            '[role="option"]',
            '[onclick]',
            '[tabindex]:not([tabindex="-1"])'
        ];

        // Get all matching elements
        const allElements = new Set();
        selectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // Skip hidden elements
                    if (this._isElementVisible(el)) {
                        allElements.add(el);
                    }
                });
            } catch (e) {
                // Invalid selector, skip
            }
        });

        // Process each element
        allElements.forEach(element => {
            const elemData = this._extractElementData(element);
            if (elemData) {
                elements.push(elemData);
            }
        });

        return {
            elements: elements,
            timestamp: Date.now(),
            url: window.location.href
        };
    }

    /**
     * Extract data from a single element
     * @private
     */
    _extractElementData(element) {
        try {
            // Skip if element is not in viewport or not visible
            if (!this._isElementVisible(element)) {
                return null;
            }

            // Get element position
            const rect = element.getBoundingClientRect();
            const isInViewport = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );

            // Get text content (limited)
            let text = '';
            try {
                text = element.textContent || element.innerText || '';
                // Clean up text
                text = text.replace(/\s+/g, ' ').trim().slice(0, 100);
            } catch (e) {
                // Ignore
            }

            // Get element attributes
            const tag = element.tagName.toLowerCase();
            const id = element.id || null;
            const classes = element.className ? String(element.className).split(/\s+/).filter(c => c).join(' ') : null;
            
            // Get type for inputs
            const type = element.type || null;
            
            // Get href for links
            const href = element.href || null;
            
            // Get placeholder
            const placeholder = element.placeholder || null;
            
            // Get aria-label
            const ariaLabel = element.getAttribute('aria-label') || null;
            
            // Get role
            const role = element.getAttribute('role') || null;

            // Assign stable ID
            const stableId = `wl-${++this.elementCounter}`;
            
            // Store mapping for later lookup
            if (!element.dataset.weblayerId) {
                element.dataset.weblayerId = stableId;
            }

            return {
                id: element.dataset.weblayerId || stableId,
                tag: tag,
                text: text,
                id_attr: id,
                classes: classes,
                type: type,
                href: href,
                placeholder: placeholder,
                ariaLabel: ariaLabel,
                role: role,
                visible: isInViewport,
                position: {
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                }
            };
        } catch (e) {
            console.warn('[ACB] Error extracting element data:', e);
            return null;
        }
    }

    /**
     * Check if element is visible
     * @private
     */
    _isElementVisible(element) {
        try {
            // Check if element exists
            if (!element || !element.offsetParent) {
                return false;
            }

            // Check computed style
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0') {
                return false;
            }

            // Check dimensions
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Find element by stable ID
     * @param {string} targetId - Stable ID (e.g., "wl-42")
     * @returns {Element|null} DOM element or null
     */
    findElementById(targetId) {
        // Try to find by data attribute first
        const byDataAttr = document.querySelector(`[data-weblayer-id="${targetId}"]`);
        if (byDataAttr) {
            return byDataAttr;
        }

        // Fallback: scan and match
        // This is less efficient but handles cases where element was re-rendered
        const inventory = this.scan();
        const element = inventory.elements.find(e => e.id === targetId);
        
        if (element) {
            // Try to find by original attributes
            if (element.id_attr) {
                const byId = document.getElementById(element.id_attr);
                if (byId) return byId;
            }
            
            // Try to find by text and tag
            if (element.text) {
                const candidates = document.querySelectorAll(element.tag);
                for (let candidate of candidates) {
                    const candidateText = (candidate.textContent || '').trim();
                    if (candidateText === element.text && this._isElementVisible(candidate)) {
                        return candidate;
                    }
                }
            }
        }

        return null;
    }
}

