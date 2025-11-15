/**
 * Visual Feedback Module
 * Provides visual feedback (cursor, ripple effects) for ACB actions
 */

import { showCursor, hideCursor } from './virtualpointer-wrapper.js';

export class VisualFeedback {
    constructor() {
        this.isVisible = false;
    }

    /**
     * Show action with visual feedback
     * @param {Object} action - Action to show
     * @returns {Promise} Resolves when feedback is shown
     */
    async showAction(action) {
        if (!this.isVisible) {
            showCursor();
            this.isVisible = true;
        }

        // Visual feedback is handled by virtualpointer's click_element
        // which shows cursor movement and ripple effects
        return Promise.resolve();
    }

    /**
     * Show guide action (without executing)
     * @param {Object} action - Action to guide
     * @returns {Promise} Resolves when guide is shown
     */
    async guideAction(action) {
        // For guide mode, we could highlight the element
        // For now, just show cursor
        if (!this.isVisible) {
            showCursor();
            this.isVisible = true;
        }

        // Highlight target element if available
        if (action.targetId) {
            this._highlightElement(action.targetId);
        }

        return Promise.resolve();
    }

    /**
     * Hide visual feedback
     */
    hide() {
        if (this.isVisible) {
            hideCursor();
            this.isVisible = false;
        }

        // Remove any highlights
        this._removeHighlights();
    }

    /**
     * Highlight an element
     * @private
     */
    _highlightElement(targetId) {
        // Remove existing highlights
        this._removeHighlights();

        // Find element
        const element = document.querySelector(`[data-weblayer-id="${targetId}"]`);
        if (!element) {
            return;
        }

        // Add highlight class
        element.classList.add('weblayer-acb-highlight');
        
        // Add CSS if not already added
        if (!document.getElementById('weblayer-acb-styles')) {
            const style = document.createElement('style');
            style.id = 'weblayer-acb-styles';
            style.textContent = `
                .weblayer-acb-highlight {
                    outline: 3px solid #3b82f6 !important;
                    outline-offset: 2px !important;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5) !important;
                    transition: outline 0.2s ease !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Remove highlight after 2 seconds
        setTimeout(() => {
            element.classList.remove('weblayer-acb-highlight');
        }, 2000);
    }

    /**
     * Remove all highlights
     * @private
     */
    _removeHighlights() {
        const highlighted = document.querySelectorAll('.weblayer-acb-highlight');
        highlighted.forEach(el => {
            el.classList.remove('weblayer-acb-highlight');
        });
    }
}

