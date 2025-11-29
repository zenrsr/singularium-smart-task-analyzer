/**
 * Utility Functions Module
 * Helper functions for common operations
 */

import { elements } from './state.js';

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Shows error toast message
 * @param {string} message - Error message to display
 */
export function showErrorToast(message) {
    elements.errorMessage.textContent = message;
    elements.errorToast.style.display = 'flex';

    setTimeout(() => {
        elements.errorToast.style.display = 'none';
    }, 5000);
}

/**
 * Shows success toast message
 * @param {string} message - Success message to display
 */
export function showSuccessToast(message) {
    elements.successMessage.textContent = message;
    elements.successToast.style.display = 'flex';

    setTimeout(() => {
        elements.successToast.style.display = 'none';
    }, 3000);
}

/**
 * Parses dependency string into array of numbers
 * @param {string} value - Comma-separated dependency IDs
 * @returns {Array<number>} Array of dependency IDs
 */
export function parseDependencies(value) {
    return value.trim() ? value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];
}

/**
 * Sets the default date to tomorrow
 */
export function setDefaultDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    elements.taskDate.value = dateString;
}

/**
 * Gets the priority class based on level
 * @param {string} level - Priority level (HIGH, MEDIUM, LOW)
 * @returns {string} CSS class name
 */
export function getPriorityClass(level) {
    const priorityClasses = {
        'HIGH': 'badge-high',
        'MEDIUM': 'badge-medium',
        'LOW': 'badge-low'
    };
    return priorityClasses[level] || 'badge-medium';
}

/**
 * Formats a date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `in ${diffDays} days`;

    return date.toLocaleDateString();
}

/**
 * Closes all modals
 */
export function closeModals() {
    elements.matrixModal.style.display = 'none';
    elements.graphModal.style.display = 'none';
}

/**
 * Sets loading state for analyze button
 * @param {boolean} isLoading - Whether loading is active
 */
export function setLoading(isLoading) {
    if (isLoading) {
        elements.analyzeBtn.disabled = true;
        elements.analyzeBtnText.textContent = 'Analyzing...';
        elements.analyzeLoader.style.display = 'inline-block';
    } else {
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtnText.textContent = '🔍 Analyze Tasks';
        elements.analyzeLoader.style.display = 'none';
    }
}
