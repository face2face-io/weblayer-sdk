/**
 * Action Executor Module
 * Executes actions (click, type, scroll) using virtualpointer
 */

import { clickElement } from './virtualpointer-wrapper.js';
import { ElementDiscovery } from './element-discovery.js';

export class ActionExecutor {
    constructor() {
        this.elementDiscovery = new ElementDiscovery();
    }

    /**
     * Execute an action
     * @param {Object} action - Action object from Claude
     * @param {string} action.type - Action type ('click', 'type', 'scroll')
     * @param {string} action.targetId - Target element ID (e.g., 'wl-42')
     * @param {string} action.value - Value for type actions
     * @returns {Promise<Object>} Execution result
     */
    async execute(action) {
        if (!action || !action.type) {
            throw new Error('Invalid action: type is required');
        }

        try {
            switch (action.type) {
                case 'click':
                    return await this._executeClick(action);
                case 'type':
                    return await this._executeType(action);
                case 'scroll':
                    return await this._executeScroll(action);
                case 'key':
                case 'keypress':
                    return await this._executeKeyPress(action);
                case 'submit':
                    return await this._executeSubmit(action);
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                action: action
            };
        }
    }

    /**
     * Execute click action
     * @private
     */
    async _executeClick(action) {
        const element = this.elementDiscovery.findElementById(action.targetId);
        
        if (!element) {
            throw new Error(`Element not found: ${action.targetId}`);
        }

        // Scroll into view first
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait for scroll (reduced from 300ms to 150ms)
        await new Promise(resolve => setTimeout(resolve, 150));

        // Click using virtualpointer
        await clickElement(element);

        // Wait for any DOM changes triggered by the click (reduced from 500ms to 250ms)
        await this._waitForDOMChanges(250);

        return {
            success: true,
            action: action,
            element: {
                id: action.targetId,
                tag: element.tagName.toLowerCase(),
                text: (element.textContent || '').trim().slice(0, 50)
            }
        };
    }

    /**
     * Execute type action (React-compatible)
     * @private
     */
    async _executeType(action) {
        const element = this.elementDiscovery.findElementById(action.targetId);
        
        if (!element) {
            throw new Error(`Element not found: ${action.targetId}`);
        }

        if (!action.value) {
            throw new Error('Type action requires value');
        }

        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 150));

        // Focus element
        element.focus();

        // Clear existing value using React-compatible method
        this._setReactValue(element, '');

        // Type value character by character (for visual effect)
        const value = String(action.value);
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            const currentValue = element.value + char;
            
            // Dispatch keyboard events first
            const keydownEvent = new KeyboardEvent('keydown', { 
                bubbles: true, 
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: char.charCodeAt(0),
                which: char.charCodeAt(0)
            });
            element.dispatchEvent(keydownEvent);

            // Update value using React-compatible setter
            this._setReactValue(element, currentValue);

            const keyupEvent = new KeyboardEvent('keyup', { 
                bubbles: true, 
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: char.charCodeAt(0),
                which: char.charCodeAt(0)
            });
            element.dispatchEvent(keyupEvent);

            // Small delay between characters (reduced from 50ms to 20ms)
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        // Final change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);

        // Wait for any DOM changes triggered by the input (reduced from 300ms to 150ms)
        await this._waitForDOMChanges(150);

        return {
            success: true,
            action: action,
            element: {
                id: action.targetId,
                tag: element.tagName.toLowerCase(),
                value: element.value
            }
        };
    }

    /**
     * Set value on input element (React-compatible)
     * @private
     */
    _setReactValue(element, value) {
        // Get the native input value setter (bypasses React)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 
            'value'
        )?.set;
        
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 
            'value'
        )?.set;

        // Use the appropriate setter based on element type
        if (element.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(element, value);
        } else {
            element.value = value;
        }

        // Trigger React's synthetic event system
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
    }

    /**
     * Wait for DOM changes to settle
     * @private
     */
    async _waitForDOMChanges(maxWait = 250) {
        return new Promise((resolve) => {
            let timeout;
            const observer = new MutationObserver((mutations) => {
                // Clear existing timeout
                if (timeout) {
                    clearTimeout(timeout);
                }
                
                // Set new timeout - resolve after 100ms of no changes
                timeout = setTimeout(() => {
                    observer.disconnect();
                    resolve();
                }, 100);
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Maximum wait time (default reduced from 500ms to 250ms)
            setTimeout(() => {
                if (timeout) {
                    clearTimeout(timeout);
                }
                observer.disconnect();
                resolve();
            }, maxWait);
        });
    }

    /**
     * Execute scroll action
     * @private
     */
    async _executeScroll(action) {
        if (action.targetId) {
            // Scroll to specific element
            const element = this.elementDiscovery.findElementById(action.targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 250));
                return {
                    success: true,
                    action: action,
                    element: {
                        id: action.targetId,
                        tag: element.tagName.toLowerCase()
                    }
                };
            }
        }

        // Default: scroll down
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 250));

        return {
            success: true,
            action: action
        };
    }

    /**
     * Execute key press action (Enter, Tab, Escape, etc.)
     * @private
     */
    async _executeKeyPress(action) {
        const element = this.elementDiscovery.findElementById(action.targetId);
        
        if (!element) {
            throw new Error(`Element not found: ${action.targetId}`);
        }

        const key = action.key || action.value || 'Enter';

        // Scroll into view and focus
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));
        element.focus();

        // Create and dispatch keyboard events
        const keydownEvent = new KeyboardEvent('keydown', {
            key: key,
            code: key === 'Enter' ? 'Enter' : `Key${key}`,
            keyCode: key === 'Enter' ? 13 : key.charCodeAt(0),
            which: key === 'Enter' ? 13 : key.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });

        const keypressEvent = new KeyboardEvent('keypress', {
            key: key,
            code: key === 'Enter' ? 'Enter' : `Key${key}`,
            keyCode: key === 'Enter' ? 13 : key.charCodeAt(0),
            which: key === 'Enter' ? 13 : key.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });

        const keyupEvent = new KeyboardEvent('keyup', {
            key: key,
            code: key === 'Enter' ? 'Enter' : `Key${key}`,
            keyCode: key === 'Enter' ? 13 : key.charCodeAt(0),
            which: key === 'Enter' ? 13 : key.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });

        element.dispatchEvent(keydownEvent);
        element.dispatchEvent(keypressEvent);
        element.dispatchEvent(keyupEvent);

        // If it's Enter on a form field, just wait for handlers to execute
        // Modern frameworks (React, Vue, etc.) handle form submission via event handlers
        // Don't call form.submit() directly as it bypasses preventDefault and causes page reloads
        if (key === 'Enter' && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
            // Give React/framework handlers time to execute (reduced from 100ms to 50ms)
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Wait for any DOM changes triggered by the key press (reduced from 300ms to 150ms)
        await this._waitForDOMChanges(150);

        return {
            success: true,
            action: action,
            element: {
                id: action.targetId,
                tag: element.tagName.toLowerCase(),
                key: key
            }
        };
    }

    /**
     * Execute form submit action
     * @private
     */
    async _executeSubmit(action) {
        const element = this.elementDiscovery.findElementById(action.targetId);
        
        if (!element) {
            throw new Error(`Element not found: ${action.targetId}`);
        }

        // Find the form
        let form = element;
        if (element.tagName !== 'FORM') {
            form = element.closest('form');
        }

        if (!form) {
            throw new Error('No form found for element');
        }

        // Scroll into view
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));

        // Dispatch submit event
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);

        // Try to actually submit
        try {
            form.submit();
        } catch (e) {
            // Ignore if submit() fails (form might handle it via event)
        }

        return {
            success: true,
            action: action,
            element: {
                id: action.targetId,
                tag: form.tagName.toLowerCase()
            }
        };
    }
}

