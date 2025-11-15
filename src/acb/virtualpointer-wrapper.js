/**
 * VirtualPointer Wrapper
 * Wraps virtualpointer.js functionality for ACB action execution
 * Uses the bundled virtualpointer module
 */

import virtualpointerInstance from './virtualpointer.js';

/**
 * Click an element using virtualpointer
 * @param {Element} element - DOM element to click
 * @returns {Promise} Promise that resolves when click is complete
 */
export function clickElement(element) {
    if (!element) {
        return Promise.reject(new Error('Element is required'));
    }

    return new Promise((resolve, reject) => {
        try {
            // Show cursor first
            if (virtualpointerInstance && virtualpointerInstance.show_cursor) {
                virtualpointerInstance.show_cursor();
            }
            
            // Click the element
            if (virtualpointerInstance && virtualpointerInstance.click_element) {
                virtualpointerInstance.click_element(element);
                
                // Wait for click animation to complete
                // virtualpointer uses event queue with timestamps:
                // - first_event_offset: 50ms
                // - default_click_duration: ~20-250ms (random)
                // - mouseover: +10ms, mousemove: +20ms, mousedown: +20ms, mouseup: +duration*2, click: +10ms
                // Total: ~50 + 20 + 10 + 20 + 20 + (20-250)*2 + 10 = ~150-600ms
                // Add buffer for scroll and animation: ~1000ms should be safe
                setTimeout(() => {
                    resolve({ success: true });
                }, 1000);
            } else {
                reject(new Error('VirtualPointer not available'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Show visual cursor
 */
export function showCursor() {
    if (virtualpointerInstance && virtualpointerInstance.show_cursor) {
        virtualpointerInstance.show_cursor();
    }
}

/**
 * Hide visual cursor
 */
export function hideCursor() {
    if (virtualpointerInstance && virtualpointerInstance.hide_cursor) {
        virtualpointerInstance.hide_cursor();
    }
}

