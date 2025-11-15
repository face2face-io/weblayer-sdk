/**
 * State Manager Module
 * Manages ACB session state and validates state transitions
 */

export class StateManager {
    constructor() {
        this.currentSession = null;
    }

    /**
     * Create a new ACB session
     * @param {string} prompt - User's automation prompt
     * @param {string} mode - Execution mode ('act' or 'guide')
     * @returns {Object} Session object
     */
    createSession(prompt, mode) {
        if (this.currentSession && this.currentSession.status === 'active') {
            throw new Error('Session already active');
        }

        this.currentSession = {
            threadId: null,  // Set by backend
            prompt: prompt,
            mode: mode,
            status: 'active',
            actionsExecuted: 0,
            startTime: Date.now(),
            pausedAt: null
        };

        return this.currentSession;
    }

    /**
     * Get current session
     * @returns {Object|null} Current session or null
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Check if a session is running
     * @returns {boolean}
     */
    isRunning() {
        return this.currentSession && this.currentSession.status === 'active';
    }

    /**
     * Check if a session is paused
     * @returns {boolean}
     */
    isPaused() {
        return this.currentSession && this.currentSession.status === 'paused';
    }

    /**
     * Pause current session
     * @param {Object} session - Session object
     */
    pause(session) {
        if (!session) {
            session = this.currentSession;
        }
        if (session && session.status === 'active') {
            session.status = 'paused';
            session.pausedAt = Date.now();
        }
    }

    /**
     * Resume paused session
     * @param {Object} session - Session object
     */
    resume(session) {
        if (!session) {
            session = this.currentSession;
        }
        if (session && session.status === 'paused') {
            session.status = 'active';
            session.pausedAt = null;
        }
    }

    /**
     * Stop current session
     * @param {Object} session - Session object
     */
    stop(session) {
        if (!session) {
            session = this.currentSession;
        }
        if (session) {
            session.status = 'stopped';
        }
    }

    /**
     * Mark session as completed
     * @param {Object} session - Session object
     */
    complete(session) {
        if (!session) {
            session = this.currentSession;
        }
        if (session) {
            session.status = 'completed';
        }
    }

    /**
     * Mark session as error
     * @param {Object} session - Session object
     * @param {Error} error - Error object
     */
    error(session, error) {
        if (!session) {
            session = this.currentSession;
        }
        if (session) {
            session.status = 'error';
            session.error = error;
        }
    }

    /**
     * Clear current session
     */
    clearSession() {
        this.currentSession = null;
    }
}

