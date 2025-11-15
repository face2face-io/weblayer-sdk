/**
 * LLM Client Module
 * Handles communication with backend ACB API endpoints
 */

import config from '../config.js';

export class LLMClient {
    constructor(apiUrl, orgId) {
        this.apiUrl = apiUrl || config.apiUrl || 'https://api.weblayer.ai';
        this.orgId = orgId || config.org_id;
    }

    /**
     * Get API key from config or headers
     * @private
     */
    _getApiKey() {
        // API key should be set via config or header
        // For now, we'll rely on backend to extract from request
        return null; // Backend will use authenticate_api_key()
    }

    /**
     * Make API request with CORS and error handling
     * @private
     */
    async _request(endpoint, data) {
        const url = `${this.apiUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this._getApiKey() || '' // Backend will handle auth
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[ACB] API request failed (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Start new ACB session
     * @param {Object} params - Start parameters
     * @param {string} params.prompt - User prompt
     * @param {string} params.mode - Execution mode
     * @param {Object} params.inventory - Element inventory
     * @param {string} params.sessionId - Session ID
     * @param {string} params.visitorId - Visitor ID
     * @returns {Promise<Object>} Response with threadId and action
     */
    async start({ prompt, mode, inventory, sessionId, visitorId }) {
        return await this._request('/sdk/acb/start', {
            prompt,
            mode,
            inventory,
            sessionId,
            visitorId,
            org_id: this.orgId
        });
    }

    /**
     * Continue ACB session with execution result
     * @param {Object} params - Continue parameters
     * @param {string} params.threadId - Thread ID
     * @param {Object} params.result - Execution result
     * @param {Object} params.inventory - Updated element inventory
     * @returns {Promise<Object>} Response with next action
     */
    async continue({ threadId, result, inventory }) {
        return await this._request('/sdk/acb/continue', {
            threadId,
            result,
            inventory,
            org_id: this.orgId
        });
    }

    /**
     * Pause ACB session
     * @param {string} threadId - Thread ID
     * @returns {Promise<Object>} Response
     */
    async pause(threadId) {
        return await this._request('/sdk/acb/pause', {
            threadId,
            org_id: this.orgId
        });
    }

    /**
     * Resume paused ACB session
     * @param {Object} params - Resume parameters
     * @param {string} params.threadId - Thread ID
     * @param {Object} params.inventory - Current element inventory
     * @returns {Promise<Object>} Response with next action
     */
    async resume({ threadId, inventory }) {
        return await this._request('/sdk/acb/resume', {
            threadId,
            inventory,
            org_id: this.orgId
        });
    }

    /**
     * Stop ACB session
     * @param {string} threadId - Thread ID
     * @returns {Promise<Object>} Response
     */
    async stop(threadId) {
        return await this._request('/sdk/acb/stop', {
            threadId,
            org_id: this.orgId
        });
    }
}

