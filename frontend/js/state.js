/**
 * State Management Module
 * Manages global application state and constants
 */

// Global State
export const state = {
    currentTasks: [],
    currentResults: null,
    currentPage: 1
};

// Constants
export const TASKS_PER_PAGE = 5;
export const API_BASE = 'http://127.0.0.1:8000/api/tasks';

// DOM Element References
export const elements = {
    // Tabs
    tabButtons: document.querySelectorAll('.tab-button'),
    formTab: document.getElementById('form-tab'),
    jsonTab: document.getElementById('json-tab'),

    // Form Elements
    taskForm: document.getElementById('task-form'),
    taskTitle: document.getElementById('task-title'),
    taskDate: document.getElementById('task-date'),
    taskHours: document.getElementById('task-hours'),
    taskImportance: document.getElementById('task-importance'),
    importanceValue: document.getElementById('importance-value'),
    taskDependencies: document.getElementById('task-dependencies'),

    // JSON Input
    jsonInput: document.getElementById('json-input'),
    loadJsonBtn: document.getElementById('load-json-btn'),

    // Current Tasks
    taskCount: document.getElementById('task-count'),
    taskListPreview: document.getElementById('task-list-preview'),

    // Strategy
    strategySelector: document.getElementById('strategy-selector'),
    strategyDescription: document.getElementById('strategy-description'),

    // Advanced Config
    weightUrgency: document.getElementById('weight-urgency'),
    weightImportance: document.getElementById('weight-importance'),
    weightEffort: document.getElementById('weight-effort'),
    weightDependencies: document.getElementById('weight-dependencies'),
    weightUrgencyValue: document.getElementById('weight-urgency-value'),
    weightImportanceValue: document.getElementById('weight-importance-value'),
    weightEffortValue: document.getElementById('weight-effort-value'),
    weightDependenciesValue: document.getElementById('weight-dependencies-value'),
    totalWeight: document.getElementById('total-weight'),
    resetWeightsBtn: document.getElementById('reset-weights-btn'),

    // Analyze
    analyzeBtn: document.getElementById('analyze-btn'),
    analyzeBtnText: document.getElementById('analyze-btn-text'),
    analyzeLoader: document.getElementById('analyze-loader'),

    // Results
    welcomeState: document.getElementById('welcome-state'),
    resultsContent: document.getElementById('results-content'),
    suggestionsList: document.getElementById('suggestions-list'),
    allTasksList: document.getElementById('all-tasks-list'),
    tasksTotal: document.getElementById('tasks-total'),

    // Visualizations
    showMatrixBtn: document.getElementById('show-matrix-btn'),
    showGraphBtn: document.getElementById('show-graph-btn'),
    matrixModal: document.getElementById('matrix-modal'),
    graphModal: document.getElementById('graph-modal'),
    matrixGrid: document.getElementById('matrix-grid'),
    graphCanvas: document.getElementById('graph-canvas'),
    circularWarning: document.getElementById('circular-warning'),

    // Toasts
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
    successToast: document.getElementById('success-toast'),
    successMessage: document.getElementById('success-message'),

    // Pagination
    paginationControls: document.getElementById('pagination-controls'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageInfo: document.getElementById('page-info'),

    // Dependency Selector
    dependencySelector: document.getElementById('dependency-selector'),

    // Advanced Config
    advancedConfig: document.getElementById('advanced-config'),
};

// Strategy Descriptions
export const strategyDescriptions = {
    'smart_balance': 'Balances urgency, importance, effort, and dependencies for optimal prioritization',
    'fastest_wins': 'Prioritizes quick tasks for maximum productivity',
    'high_impact': 'Focuses on high-importance tasks regardless of effort',
    'deadline_driven': 'Sorts by due dates to help you meet deadlines and avoid overdue tasks',
    'custom': 'Customize scoring algorithm with your own weight distribution'
};
