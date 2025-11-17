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
        
        // Wait for scroll
        await new Promise(resolve => setTimeout(resolve, 300));

        // Click using virtualpointer
        await clickElement(element);

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
     * Execute type action
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
        await new Promise(resolve => setTimeout(resolve, 300));

        // Focus element
        element.focus();

        // Clear existing value
        element.value = '';

        // Type value character by character (for visual effect)
        const value = String(action.value);
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            
            // Dispatch input events
            const inputEvent = new Event('input', { bubbles: true });
            const keydownEvent = new KeyboardEvent('keydown', { 
                bubbles: true, 
                key: char,
                code: `Key${char.toUpperCase()}`
            });
            const keyupEvent = new KeyboardEvent('keyup', { 
                bubbles: true, 
                key: char 
            });

            element.value += char;
            element.dispatchEvent(keydownEvent);
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(keyupEvent);

            // Small delay between characters
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Dispatch change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);

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
     * Execute scroll action
     * @private
     */
    async _executeScroll(action) {
        if (action.targetId) {
            // Scroll to specific element
            const element = this.elementDiscovery.findElementById(action.targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
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
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            action: action
        };
    }
}

