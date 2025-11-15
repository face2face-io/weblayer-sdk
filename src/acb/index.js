/**
 * ACB Controller - Main module for Agentic Co-Browsing
 * Orchestrates element discovery, action execution, visual feedback, and LLM communication
 */

import { ElementDiscovery } from './element-discovery.js';
import { ActionExecutor } from './action-executor.js';
import { VisualFeedback } from './visual-feedback.js';
import { LLMClient } from './llm-client.js';
import { StateManager } from './state-manager.js';
import config from '../config.js';

export class ACBController {
    constructor(options = {}) {
        this.config = {
            apiUrl: options.apiUrl || config.apiUrl || 'https://api.weblayer.ai',
            orgId: options.orgId || config.org_id,
            debug: options.debug || config.debug || false
        };

        this.elementDiscovery = new ElementDiscovery();
        this.actionExecutor = new ActionExecutor();
        this.visualFeedback = new VisualFeedback();
        this.llmClient = new LLMClient(this.config.apiUrl, this.config.orgId);
        this.stateManager = new StateManager();
    }

    /**
     * Update orgId (called when init() is called with new orgId)
     */
    updateOrgId(orgId) {
        this.config.orgId = orgId;
        // Recreate LLM client with new orgId
        this.llmClient = new LLMClient(this.config.apiUrl, orgId);
    }

    /**
     * Start ACB automation session
     * @param {string} prompt - Natural language instruction
     * @param {string} mode - Execution mode ('act' or 'guide')
     * @returns {Promise<Object>} Result with success, threadId, status, etc.
     */
    async acb(prompt, mode = 'act') {
        // Validate state
        if (this.stateManager.isRunning()) {
            throw new Error('ACB already running. Stop or pause current session first.');
        }

        if (!prompt || !prompt.trim()) {
            throw new Error('Prompt is required');
        }

        if (!['act', 'guide'].includes(mode)) {
            throw new Error('Mode must be "act" or "guide"');
        }

        if (this.config.debug) {
            console.log(`[ACB] Starting ${mode} mode:`, prompt);
        }

        // Create new session
        const session = this.stateManager.createSession(prompt, mode);

        try {
            // Discover elements
            const inventory = this.elementDiscovery.scan();
            if (this.config.debug) {
                console.log(`[ACB] Found ${inventory.elements.length} interactive elements`);
            }

            // Get session and visitor IDs
            const sessionId = this._getSessionId();
            const visitorId = this._getVisitorId();

            // Start thread with backend
            const response = await this.llmClient.start({
                prompt,
                mode,
                inventory,
                sessionId,
                visitorId
            });

            session.threadId = response.threadId;

            // Execute actions until complete
            await this._executionLoop(session, response.action, response.complete);

            // Mark complete
            this.stateManager.complete(session);
            this.visualFeedback.hide();

            return {
                success: true,
                threadId: session.threadId,
                status: 'completed',
                actionsExecuted: session.actionsExecuted,
                duration: Date.now() - session.startTime
            };

        } catch (error) {
            this.stateManager.error(session, error);
            this.visualFeedback.hide();

            return {
                success: false,
                threadId: session.threadId,
                status: 'error',
                actionsExecuted: session.actionsExecuted,
                duration: Date.now() - session.startTime,
                error: error.message
            };
        }
    }

    /**
     * Stop current session immediately
     * @returns {Promise<Object>} Stop result
     */
    async acbStop() {
        const session = this.stateManager.getCurrentSession();

        if (!session) {
            return {
                success: false,
                message: 'No ACB session running'
            };
        }

        if (this.config.debug) {
            console.log('[ACB] Stopping session:', session.threadId);
        }

        // Stop execution loop
        this.stateManager.stop(session);

        // Hide visual feedback
        this.visualFeedback.hide();

        // Notify backend
        try {
            await this.llmClient.stop(session.threadId);
        } catch (error) {
            if (this.config.debug) {
                console.warn('[ACB] Error notifying backend of stop:', error);
            }
        }

        return {
            success: true,
            threadId: session.threadId,
            actionsExecuted: session.actionsExecuted,
            message: 'Stopped by user'
        };
    }

    /**
     * Pause current session with ability to resume
     * @returns {Promise<Object>} Pause result
     */
    async acbPause() {
        const session = this.stateManager.getCurrentSession();

        if (!session) {
            return {
                success: false,
                message: 'No ACB session running'
            };
        }

        if (session.status === 'paused') {
            return {
                success: true,
                message: 'Already paused'
            };
        }

        if (this.config.debug) {
            console.log('[ACB] Pausing session:', session.threadId);
        }

        // Pause execution loop
        this.stateManager.pause(session);

        // Hide visual feedback temporarily
        this.visualFeedback.hide();

        // Notify backend
        try {
            await this.llmClient.pause(session.threadId);
        } catch (error) {
            if (this.config.debug) {
                console.warn('[ACB] Error notifying backend of pause:', error);
            }
        }

        return {
            success: true,
            threadId: session.threadId,
            actionsExecuted: session.actionsExecuted,
            currentStep: session.actionsExecuted,
            message: 'Paused'
        };
    }

    /**
     * Resume paused session
     * @returns {Promise<Object>} Resume result
     */
    async acbResume() {
        const session = this.stateManager.getCurrentSession();

        if (!session) {
            return {
                success: false,
                message: 'No paused ACB session'
            };
        }

        if (session.status !== 'paused') {
            return {
                success: false,
                message: 'ACB not paused'
            };
        }

        if (this.config.debug) {
            console.log('[ACB] Resuming session:', session.threadId);
        }

        // Resume execution loop
        this.stateManager.resume(session);

        // Get updated inventory
        const inventory = this.elementDiscovery.scan();

        // Notify backend and get next action
        const response = await this.llmClient.resume({
            threadId: session.threadId,
            inventory
        });

        // Continue execution
        await this._executionLoop(session, response.action, response.complete);

        return {
            success: true,
            threadId: session.threadId,
            message: 'Resumed'
        };
    }

    /**
     * Get current ACB status
     * @returns {Object} Status information
     */
    getStatus() {
        const session = this.stateManager.getCurrentSession();
        if (!session) {
            return { running: false };
        }

        return {
            running: true,
            threadId: session.threadId,
            status: session.status,
            prompt: session.prompt,
            actionsExecuted: session.actionsExecuted,
            duration: Date.now() - session.startTime
        };
    }

    /**
     * Internal execution loop (handles pause/stop checks)
     * @private
     */
    async _executionLoop(session, initialAction, initialComplete = false) {
        let action = initialAction;
        let complete = initialComplete;

        while (action && !complete) {
            // Check if stopped
            if (session.status === 'stopped') {
                if (this.config.debug) {
                    console.log('[ACB] Execution stopped');
                }
                break;
            }

            // Check if paused
            if (session.status === 'paused') {
                if (this.config.debug) {
                    console.log('[ACB] Execution paused');
                }
                break;
            }

            // Check for errors in action
            if (action.error) {
                throw new Error(`Action error: ${action.error}`);
            }

            // Show and execute action
            if (session.mode === 'act') {
                await this.visualFeedback.showAction(action);
                
                const result = await this.actionExecutor.execute(action);
                session.actionsExecuted++;

                // Check if action failed
                if (!result.success) {
                    if (this.config.debug) {
                        console.warn('[ACB] Action failed:', result.error);
                    }
                    // Continue anyway - let Claude decide what to do
                }

                // Get next action from Claude
                const inventory = this.elementDiscovery.scan();
                const response = await this.llmClient.continue({
                    threadId: session.threadId,
                    result: {
                        success: result.success,
                        action: action,
                        error: result.error,
                        url: window.location.href
                    },
                    inventory
                });

                action = response.action;
                complete = response.complete || false;

            } else if (session.mode === 'guide') {
                // Guide mode: show without executing (phase 2)
                await this.visualFeedback.guideAction(action);
                // Wait for user to execute manually
                // For now, just wait a bit then get next action
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const inventory = this.elementDiscovery.scan();
                const response = await this.llmClient.continue({
                    threadId: session.threadId,
                    result: { guided: true },
                    inventory
                });

                action = response.action;
                complete = response.complete || false;
            }
        }

        // Hide feedback when done
        this.visualFeedback.hide();
    }

    /**
     * Get session ID from sessionStorage
     * @private
     */
    _getSessionId() {
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem('weblayer_session_id');
        }
        return null;
    }

    /**
     * Get visitor ID from cookie
     * @private
     */
    _getVisitorId() {
        return this._getCookie('weblayer_visitor_id');
    }

    /**
     * Get cookie value
     * @private
     */
    _getCookie(name) {
        if (typeof document === 'undefined') {
            return null;
        }
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }
}

