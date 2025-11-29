/**
 * API Communication Module
 * Handles all backend API interactions
 */

import { API_BASE, elements } from './state.js';
import { showErrorToast } from './utils.js';

/**
 * Analyzes tasks using the backend API
 * @param {Array} tasks - Array of task objects
 * @param {string} strategy - Scoring strategy to use
 * @param {Object} weights - Optional custom weights
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeTasks(tasks, strategy, weights = null) {
    const requestBody = {
        tasks: tasks,
        strategy: strategy
    };

    if (weights) {
        requestBody.weights = weights;
    }

    const response = await fetch(`${API_BASE}/analyze/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.detail || 'Analysis failed');
    }

    return await response.json();
}

/**
 * Checks for circular dependencies in tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Promise<Object>} Validation results
 */
export async function checkCircularDependencies(tasks) {
    try {
        const response = await fetch(`${API_BASE}/validate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tasks: tasks })
        });

        const data = await response.json();

        if (data.has_circular_dependencies) {
            const cycleList = data.cycles.map(cycle =>
                `Task ${cycle.join(' → Task ')} → Task ${cycle[0]}`
            ).join('<br>');

            elements.circularWarning.innerHTML = `
                <strong>⚠️ Circular Dependencies Detected!</strong><br>
                ${cycleList}<br>
                <small>Tasks in circular dependencies may cause workflow issues.</small>
            `;
            elements.circularWarning.style.display = 'block';
        } else {
            elements.circularWarning.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking dependencies:', error);
    }
}
