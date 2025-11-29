/**
 * Main Application Entry Point
 * Initializes the app and handles all event listeners
 */

import { state, elements } from './state.js';
import {
    setDefaultDate,
    showErrorToast,
    showSuccessToast,
    setLoading,
    parseDependencies,
    closeModals
} from './utils.js';
import { analyzeTasks as apiAnalyzeTasks, checkCircularDependencies } from './api.js';
import {
    switchTab,
    updateImportanceValue,
    updateTaskPreview,
    getSelectedDependencies,
    updateStrategyDescription,
    toggleAdvancedConfig,
    updateWeights,
    resetWeights,
    displayResults,
    changePage
} from './ui.js';
import { showEisenhowerMatrix, showDependencyGraph } from './visualizations.js';

/**
 * Handles form submission to add a task
 * @param {Event} e - Form submit event
 */
function handleFormSubmit(e) {
    e.preventDefault();

    const dueDate = new Date(elements.taskDate.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDate < today) {
        showErrorToast('Due date cannot be in the past');
        return;
    }

    const task = {
        id: state.currentTasks.length + 1,
        title: elements.taskTitle.value.trim(),
        due_date: elements.taskDate.value,
        estimated_hours: parseInt(elements.taskHours.value),
        importance: parseInt(elements.taskImportance.value),
        dependencies: getSelectedDependencies()
    };

    state.currentTasks.push(task);
    updateTaskPreview();
    elements.taskForm.reset();
    setDefaultDate();
    elements.importanceValue.textContent = '5';

    showSuccessToast('Task added successfully!');
}

/**
 * Removes a task from the list
 * @param {number} index - Index of task to remove
 */
function removeTask(index) {
    state.currentTasks.splice(index, 1);
    // Reassign IDs
    state.currentTasks = state.currentTasks.map((task, i) => ({ ...task, id: i + 1 }));
    updateTaskPreview();
}

// Expose removeTask globally for onclick handlers
window.removeTask = removeTask;

/**
 * Loads tasks from JSON input
 */
function loadJSONTasks() {
    try {
        const jsonData = JSON.parse(elements.jsonInput.value);

        if (!Array.isArray(jsonData)) {
            throw new Error('JSON must be an array of tasks');
        }

        // Validate and assign IDs
        state.currentTasks = jsonData.map((task, index) => ({
            ...task,
            id: index + 1
        }));

        updateTaskPreview();
        showSuccessToast(`Loaded ${state.currentTasks.length} tasks from JSON`);

    } catch (error) {
        showErrorToast(`Invalid JSON: ${error.message}`);
    }
}

/**
 * Gets custom weight values if custom strategy is selected
 * @returns {Object|null} Custom weights or null
 */
function getCustomWeights() {
    const strategy = elements.strategySelector.value;

    if (strategy !== 'custom') {
        return null;
    }

    const weights = {
        urgency: parseInt(elements.weightUrgency.value) / 100,
        importance: parseInt(elements.weightImportance.value) / 100,
        effort: parseInt(elements.weightEffort.value) / 100,
        dependencies: parseInt(elements.weightDependencies.value) / 100
    };

    const total = Object.values(weights).reduce((sum, val) => sum + val, 0);

    if (Math.abs(total - 1) > 0.01) {
        showErrorToast('Custom weights must sum to 100%');
        return null;
    }

    return weights;
}

/**
 * Main analyze tasks function
 */
async function analyzeTasks() {
    if (state.currentTasks.length === 0) {
        showErrorToast('Please add at least one task before analyzing');
        return;
    }

    setLoading(true);

    try {
        const strategy = elements.strategySelector.value;
        const customWeights = getCustomWeights();

        if (strategy === 'custom' && !customWeights) {
            setLoading(false);
            return;
        }

        const data = await apiAnalyzeTasks(state.currentTasks, strategy, customWeights);
        state.currentResults = data;
        displayResults(data);

        // Check for circular dependencies
        await checkCircularDependencies(state.currentTasks);

    } catch (error) {
        showErrorToast(`Analysis failed: ${error.message}`);
        console.error('Analysis error:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Tab switcher
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Form
    elements.taskForm.addEventListener('submit', handleFormSubmit);
    elements.taskImportance.addEventListener('input', updateImportanceValue);

    // JSON
    elements.loadJsonBtn.addEventListener('click', loadJSONTasks);

    // Strategy
    elements.strategySelector.addEventListener('change', () => {
        updateStrategyDescription();
        toggleAdvancedConfig();
    });

    // Weights
    [elements.weightUrgency, elements.weightImportance, elements.weightEffort, elements.weightDependencies]
        .forEach(slider => slider.addEventListener('input', updateWeights));
    elements.resetWeightsBtn.addEventListener('click', resetWeights);

    // Analyze
    elements.analyzeBtn.addEventListener('click', analyzeTasks);

    // Visualizations
    elements.showMatrixBtn?.addEventListener('click', showEisenhowerMatrix);
    elements.showGraphBtn?.addEventListener('click', showDependencyGraph);

    // Pagination
    elements.prevPageBtn?.addEventListener('click', () => changePage(-1));
    elements.nextPageBtn?.addEventListener('click', () => changePage(1));

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Toast close buttons
    document.querySelectorAll('.toast-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const toast = e.target.closest('.toast');
            toast.style.display = 'none';
        });
    });

    // Modal background click
    [elements.matrixModal, elements.graphModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            closeModals();
        }
    });
}

/**
 * Initializes the application
 */
function init() {
    setupEventListeners();
    setDefaultDate();
    updateStrategyDescription();
    updateWeights(); // Initialize weight display
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
