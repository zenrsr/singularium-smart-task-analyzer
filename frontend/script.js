/**
 * Smart Task Analyzer - JavaScript Logic
 * Handles all frontend interactions, API calls, and visualizations
 */

// ==================== GLOBAL STATE ====================
let currentTasks = [];
let currentResults = null;
let currentPage = 1;
const TASKS_PER_PAGE = 5;
const API_BASE = 'http://127.0.0.1:8000/api/tasks';

// ==================== DOM ELEMENTS ====================
const elements = {
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

// ==================== INITIALIZATION ====================
function init() {
    setupEventListeners();
    setDefaultDate();
    updateStrategyDescription();
}

function setupEventListeners() {
    // Tab Switcher
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

    // Modal Close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Toast Close
    document.querySelectorAll('.toast-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.toast').style.display = 'none';
        });
    });

    // Modal Background Click
    [elements.matrixModal, elements.graphModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    elements.taskDate.value = today;
    elements.taskDate.min = today;
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ==================== FORM HANDLING ====================
function updateImportanceValue() {
    elements.importanceValue.textContent = elements.taskImportance.value;
}

function handleFormSubmit(e) {
    e.preventDefault();

    const dueDate = new Date(elements.taskDate.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDate < today) {
        showToast('Due date cannot be in the past', 'error');
        return;
    }

    const task = {
        id: currentTasks.length + 1,
        title: elements.taskTitle.value.trim(),
        due_date: elements.taskDate.value,
        estimated_hours: parseInt(elements.taskHours.value),
        importance: parseInt(elements.taskImportance.value),
        dependencies: getSelectedDependencies() // Use checkbox selector
    };

    currentTasks.push(task);
    updateTaskPreview();
    elements.taskForm.reset();
    setDefaultDate();
    elements.importanceValue.textContent = '5';

    showSuccess('Task added successfully!');
}

function parseDependencies(value) {
    if (!value.trim()) return [];
    return value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

function updateTaskPreview() {
    elements.taskCount.textContent = currentTasks.length;

    if (currentTasks.length === 0) {
        elements.taskListPreview.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No tasks added yet</p>';
        renderDependencySelector(); // Update dependency selector
        return;
    }

    elements.taskListPreview.innerHTML = currentTasks.map((task, index) => `
        <div class="task-preview-item">
            <span>${task.title}</span>
            <button class="task-preview-remove" onclick="removeTask(${index})" type="button">&times;</button>
        </div>
    `).join('');

    // Update dependency selector with new tasks
    renderDependencySelector();
}

function removeTask(index) {
    currentTasks.splice(index, 1);
    // Reassign IDs
    currentTasks = currentTasks.map((task, i) => ({ ...task, id: i + 1 }));
    updateTaskPreview();
}

// ==================== DEPENDENCY SELECTOR ====================
function renderDependencySelector() {
    const container = elements.dependencySelector;

    if (currentTasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks added yet</p>';
        return;
    }

    container.innerHTML = currentTasks.map(task => `
        <label class="dependency-item">
            <input type="checkbox" value="${task.id}" name="dependency" data-task-id="${task.id}">
            <span class="task-id">${task.id}</span>
            <span class="task-title">${escapeHtml(task.title)}</span>
        </label>
    `).join('');
}

function getSelectedDependencies() {
    const checkboxes = document.querySelectorAll('#dependency-selector input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// ==================== JSON LOADING ====================
function loadJSONTasks() {
    try {
        const jsonData = JSON.parse(elements.jsonInput.value);

        if (!Array.isArray(jsonData)) {
            throw new Error('JSON must be an array of tasks');
        }

        // Validate and assign IDs
        currentTasks = jsonData.map((task, index) => ({
            ...task,
            id: index + 1
        }));

        updateTaskPreview();
        showSuccess(`Loaded ${currentTasks.length} tasks from JSON`);


    } catch (error) {
        showError(`Invalid JSON: ${error.message}`);
    }
}

// ==================== STRATEGY DESCRIPTIONS ====================
const strategyDescriptions = {
    'smart_balance': 'Balances urgency, importance, effort, and dependencies for optimal prioritization',
    'fastest_wins': 'Prioritizes quick tasks (low effort) to help you get fast wins and build momentum',
    'high_impact': 'Focuses solely on importance ratings to tackle high-value tasks first',
    'deadline_driven': 'Sorts by due dates to help you meet deadlines and avoid overdue tasks',
    'custom': 'Customize scoring algorithm with your own weight distribution'
};

function updateStrategyDescription() {
    const strategy = elements.strategySelector.value;
    elements.strategyDescription.textContent = strategyDescriptions[strategy] || '';
}

function toggleAdvancedConfig() {
    const strategy = elements.strategySelector.value;

    if (strategy === 'custom') {
        elements.advancedConfig.style.display = 'block';
    } else {
        elements.advancedConfig.style.display = 'none';
    }
}

// ==================== WEIGHT MANAGEMENT ====================
function updateWeights() {
    const urgency = parseInt(elements.weightUrgency.value);
    const importance = parseInt(elements.weightImportance.value);
    const effort = parseInt(elements.weightEffort.value);
    const dependencies = parseInt(elements.weightDependencies.value);

    elements.weightUrgencyValue.textContent = urgency;
    elements.weightImportanceValue.textContent = importance;
    elements.weightEffortValue.textContent = effort;
    elements.weightDependenciesValue.textContent = dependencies;

    const total = urgency + importance + effort + dependencies;
    elements.totalWeight.innerHTML = `Total: <strong>${total}%</strong>`;

    if (total !== 100) {
        elements.totalWeight.classList.add('invalid');
    } else {
        elements.totalWeight.classList.remove('invalid');
    }
}

function resetWeights() {
    elements.weightUrgency.value = 40;
    elements.weightImportance.value = 30;
    elements.weightEffort.value = 20;
    elements.weightDependencies.value = 10;
    updateWeights();
}

function getCustomWeights() {
    const urgency = parseInt(elements.weightUrgency.value);
    const importance = parseInt(elements.weightImportance.value);
    const effort = parseInt(elements.weightEffort.value);
    const dependencies = parseInt(elements.weightDependencies.value);

    const total = urgency + importance + effort + dependencies;

    // Only return custom weights if they sum to 100 and are different from defaults
    if (total === 100 && (urgency !== 40 || importance !== 30 || effort !== 20 || dependencies !== 10)) {
        return {
            urgency: urgency / 100,
            importance: importance / 100,
            effort: effort / 100,
            dependencies: dependencies / 100
        };
    }

    return null;
}

// ==================== ANALYZE TASKS ====================
async function analyzeTasks() {
    if (currentTasks.length === 0) {
        showError('Please add at least one task before analyzing');
        return;
    }

    setLoading(true);

    try {
        const strategy = elements.strategySelector.value;
        const customWeights = getCustomWeights();

        const requestData = {
            tasks: currentTasks,
            strategy: strategy
        };

        if (customWeights) {
            requestData.weights = customWeights;
        }

        const response = await fetch(`${API_BASE}/analyze/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze tasks');
        }

        const data = await response.json();
        currentResults = data;
        displayResults(data);

    } catch (error) {
        showError(`Analysis failed: ${error.message}`);
        console.error('Analysis error:', error);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        elements.analyzeBtnText.style.display = 'none';
        elements.analyzeLoader.style.display = 'block';
        elements.analyzeBtn.disabled = true;
    } else {
        elements.analyzeBtnText.style.display = 'block';
        elements.analyzeLoader.style.display = 'none';
        elements.analyzeBtn.disabled = false;
    }
}

// ==================== DISPLAY RESULTS ====================
function displayResults(data) {
    elements.welcomeState.style.display = 'none';
    elements.resultsContent.style.display = 'block';
    const tasks = data.tasks;
    elements.tasksTotal.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
    currentPage = 1;

    // Display top 3 suggestions (pass ALL tasks for dependency lookup)
    displaySuggestions(tasks.slice(0, 3), tasks);

    // Display all tasks with pagination
    displayAllTasks(tasks);
}

function displaySuggestions(topTasks, allTasks) {
    if (topTasks.length === 0) {
        elements.suggestionsList.innerHTML = '<p style="color: var(--text-muted);">No tasks to suggest</p>';
        return;
    }

    const taskIds = new Set(currentTasks.map(t => t.id));

    elements.suggestionsList.innerHTML = topTasks.map((task, index) => {
        // Check for blocking dependencies WITH SCORE CONTRADICTION
        let blockingBadge = '';
        if (task.dependencies && task.dependencies.length > 0) {
            // Only show warning if dependencies have LOWER scores (contradiction)
            // Look up in allTasks (scored results) not currentTasks!
            const blockingDeps = task.dependencies.filter(depId => {
                const depTask = allTasks.find(t => t.id === depId);
                // Show badge only if: dependency exists AND has lower score
                return depTask && depTask.score < task.score;
            });

            if (blockingDeps.length > 0) {
                const depNames = blockingDeps
                    .map(depId => {
                        const depTask = allTasks.find(t => t.id === depId);
                        return depTask ? `#${depId}: ${depTask.title}` : `Task #${depId}`;
                    })
                    .join(', ');

                blockingBadge = `
                    <div class="blocking-badge-full">
                        <div class="blocking-badge-header">
                            <span class="blocking-badge-icon">⚠</span>
                            <strong>Blocked - Cannot Start Yet</strong>
                        </div>
                        <div class="blocking-badge-text">
                            This task cannot be started until ${blockingDeps.length === 1 ? 'this task is' : 'these tasks are'} completed: <strong>${depNames}</strong>
                        </div>
                    </div>
                `;
            }
        }

        // Create clean detail list
        const detailsList = [];

        // Due date with urgency indicator
        const dueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = dueDate.toDateString() === today.toDateString();
        const isTomorrow = dueDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();

        if (isToday) {
            detailsList.push('Due today');
        } else if (isTomorrow) {
            detailsList.push('Due tomorrow');
        } else {
            detailsList.push(`Due ${formatDate(task.due_date)}`);
        }

        // Effort
        detailsList.push(`${task.estimated_hours} hour${task.estimated_hours !== 1 ? 's' : ''} estimated`);

        // Importance level
        const importanceLevel = task.importance >= 7 ? 'High' : task.importance >= 4 ? 'Medium' : 'Low';
        detailsList.push(`${importanceLevel} importance (${task.importance}/10)`);

        // Blocking info (only if contradictory - dependency has lower score)
        if (task.dependencies && task.dependencies.length > 0) {
            const blockingDeps = task.dependencies.filter(depId => {
                const depTask = allTasks.find(t => t.id === depId);
                return depTask && depTask.score < task.score; // Only contradictions
            });

            if (blockingDeps.length > 0) {
                detailsList.push(`Blocked by ${blockingDeps.length} task${blockingDeps.length !== 1 ? 's' : ''}`);
            }
        }

        return `
            <div class="suggestion-item">
                <div class="suggestion-content">
                    <h3 class="suggestion-title">${escapeHtml(task.title)}</h3>
                    <ul class="task-details-list">
                        ${detailsList.map(detail => `<li>${detail}</li>`).join('')}
                    </ul>
                    ${blockingBadge}
                </div>
                
                <div class="suggestion-score">
                    <div class="suggestion-rank">#${index + 1}</div>
                    <div class="suggestion-rank-label">Rank</div>
                </div>
            </div>
        `;
    }).join('');
}

function displayAllTasks(tasks) {
    if (tasks.length === 0) {
        elements.allTasksList.innerHTML = '<p style="color: var(--text-secondary); padding: var(--space-m);">No tasks to display</p>';
        elements.paginationControls.style.display = 'none';
        return;
    }

    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, endIndex);
    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
    const taskIds = new Set(currentTasks.map(t => t.id));

    elements.allTasksList.innerHTML = paginatedTasks.map(task => {
        const priorityClass = task.priority_level.toLowerCase();

        // Check for blocking dependencies WITH SCORE CONTRADICTION
        let blockingBadge = '';
        if (task.dependencies && task.dependencies.length > 0) {
            // Only show warning if dependencies have LOWER scores (contradiction)
            // Use tasks array (scored) not currentTasks (unscored)
            const blockingDeps = task.dependencies.filter(depId => {
                const depTask = tasks.find(t => t.id === depId);
                // Show badge only if: dependency exists AND has lower score
                return depTask && depTask.score < task.score;
            });

            if (blockingDeps.length > 0) {
                const depNames = blockingDeps
                    .map(depId => {
                        const depTask = tasks.find(t => t.id === depId);
                        return depTask ? `#${depId}: ${depTask.title}` : `Task #${depId}`;
                    })
                    .join(', ');

                blockingBadge = `
                    <div class="blocking-badge-full" style="margin-top: var(--space-xs);">
                        <div class="blocking-badge-header">
                            <span class="blocking-badge-icon">⚠</span>
                            <strong>Blocked - Cannot Start Yet</strong>
                        </div>
                        <div class="blocking-badge-text">
                            Complete ${blockingDeps.length === 1 ? 'this task' : 'these tasks'} first: <strong>${depNames}</strong>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="task-card">
                <div class="task-card-content">
                    <div class="task-title-row">
                        <h3 class="task-title">${escapeHtml(task.title)}</h3>
                        <span class="priority-badge ${priorityClass}">${task.priority_level}</span>
                    </div>
                    
                    <div class="task-meta">
                        <span>Due: ${formatDate(task.due_date)}</span>
                        <span>${task.estimated_hours}h</span>
                        <span>Importance: ${task.importance}/10</span>
                    </div>
                    
                    ${blockingBadge}
                </div>
                
                <div class="task-card-score">
                    <div class="score-value">${task.score}</div>
                    <div class="score-label">Score</div>
                </div>
            </div>
        `;
    }).join('');

    // Update pagination
    updatePagination(totalPages);
}

// ==================== PAGINATION ====================
function updatePagination(totalPages) {
    if (totalPages <= 1) {
        elements.paginationControls.style.display = 'none';
        return;
    }

    elements.paginationControls.style.display = 'flex';
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    elements.prevPageBtn.disabled = currentPage === 1;
    elements.nextPageBtn.disabled = currentPage === totalPages;
}

function changePage(delta) {
    if (!currentResults || !currentResults.tasks) return;

    const totalPages = Math.ceil(currentResults.tasks.length / TASKS_PER_PAGE);
    const newPage = currentPage + delta;

    if (newPage < 1 || newPage > totalPages) return;

    currentPage = newPage;
    displayAllTasks(currentResults.tasks);

    // Scroll to top of tasks list
    elements.allTasksList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ==================== EISENHOWER MATRIX ====================
function showEisenhowerMatrix() {
    if (!currentResults || !currentResults.tasks) {
        showError('Please analyze tasks first');
        return;
    }

    const tasks = currentResults.tasks;

    // Categorize tasks into quadrants based on urgency and importance
    const quadrants = {
        urgent_important: [],      // High urgency, High importance
        notUrgent_important: [],   // Low urgency, High importance
        urgent_notImportant: [],   // High urgency, Low importance
        notUrgent_notImportant: [] // Low urgency, Low importance
    };

    tasks.forEach(task => {
        const isUrgent = isTaskUrgent(task);
        const isImportant = task.importance >= 7;

        if (isUrgent && isImportant) {
            quadrants.urgent_important.push(task);
        } else if (!isUrgent && isImportant) {
            quadrants.notUrgent_important.push(task);
        } else if (isUrgent && !isImportant) {
            quadrants.urgent_notImportant.push(task);
        } else {
            quadrants.notUrgent_notImportant.push(task);
        }
    });

    elements.matrixGrid.innerHTML = `
        <div class="matrix-quadrant q1">
            <h3>Do First - Urgent & Important</h3>
            ${renderMatrixTasks(quadrants.urgent_important)}
        </div>
        <div class="matrix-quadrant q2">
            <h3>Schedule - Not Urgent & Important</h3>
            ${renderMatrixTasks(quadrants.notUrgent_important)}
        </div>
        <div class="matrix-quadrant q3">
            <h3>Delegate - Urgent & Not Important</h3>
            ${renderMatrixTasks(quadrants.urgent_notImportant)}
        </div>
        <div class="matrix-quadrant q4">
            <h3>Eliminate - Not Urgent & Not Important</h3>
            ${renderMatrixTasks(quadrants.notUrgent_notImportant)}
        </div>
    `;

    elements.matrixModal.style.display = 'flex';
}

function isTaskUrgent(task) {
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    return daysUntil <= 3;
}

function renderMatrixTasks(tasks) {
    if (tasks.length === 0) {
        return '<p style="color: var(--text-muted); font-size: 0.875rem;">No tasks in this quadrant</p>';
    }

    return tasks.map(task => `
        <div class="matrix-task-item">
            <strong>${escapeHtml(task.title)}</strong><br>
            <small style="color: var(--text-muted);">
                Due: ${formatDate(task.due_date)} • Score: ${task.score}
            </small>
        </div>
    `).join('');
}

// ==================== DEPENDENCY GRAPH ====================
function showDependencyGraph() {
    if (!currentResults || !currentResults.tasks) {
        showError('Please analyze tasks first');
        return;
    }

    const tasks = currentResults.tasks;
    const canvas = elements.graphCanvas;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Check for circular dependencies
    checkCircularDependencies(tasks);

    // Draw graph
    drawDependencyGraph(ctx, tasks);

    elements.graphModal.style.display = 'flex';
}

async function checkCircularDependencies(tasks) {
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
            elements.circularWarning.style.display = 'block';
            elements.circularWarning.innerHTML = `
                ⚠️ Circular dependencies detected! 
                <strong>${data.cycle_count} cycle(s) found:</strong>
                ${data.cycles.map(cycle => cycle.join(' → ')).join('<br>')}
            `;
        } else {
            elements.circularWarning.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking dependencies:', error);
    }
}

function drawDependencyGraph(ctx, tasks) {
    const width = 800;
    const height = 600;
    const padding = 80;

    // Clear with dark background
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, width, height);

    // Position nodes in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - padding;

    const positions = {};
    tasks.forEach((task, index) => {
        const angle = (index / tasks.length) * 2 * Math.PI - Math.PI / 2;
        positions[task.id] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            task: task
        };
    });

    // Draw edges (dependencies) with gradient
    tasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
                if (positions[depId]) {
                    const from = positions[depId];
                    const to = positions[task.id];

                    // Create gradient for arrow
                    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
                    gradient.addColorStop(0, '#3b82f6');
                    gradient.addColorStop(1, '#8b5cf6');

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);

                    // Draw arrow
                    drawArrow(ctx, from.x, from.y, to.x, to.y);
                    ctx.setLineDash([]);
                }
            });
        }
    });

    // Draw nodes with priority-based colors
    tasks.forEach(task => {
        const pos = positions[task.id];
        const priorityClass = task.priority_level.toLowerCase();

        // Determine node color based on priority
        let nodeColor, glowColor;
        if (priorityClass === 'high') {
            nodeColor = '#ef4444';
            glowColor = 'rgba(239, 68, 68, 0.4)';
        } else if (priorityClass === 'medium') {
            nodeColor = '#f59e0b';
            glowColor = 'rgba(245, 158, 11, 0.4)';
        } else {
            nodeColor = '#10b981';
            glowColor = 'rgba(16, 185, 129, 0.4)';
        }

        // Outer glow
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 32, 0, 2 * Math.PI);
        ctx.fillStyle = glowColor;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 28, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();
        ctx.strokeStyle = '#1a1d28';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner circle for depth
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 24, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Node ID
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(task.id, pos.x, pos.y);

        // Node label with background
        const label = task.title.length > 18 ? task.title.substring(0, 18) + '...' : task.title;
        ctx.font = '13px Inter';
        const textWidth = ctx.measureText(label).width;

        // Label background
        ctx.fillStyle = 'rgba(26, 29, 40, 0.9)';
        ctx.fillRect(pos.x - textWidth / 2 - 6, pos.y + 38, textWidth + 12, 22);
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x - textWidth / 2 - 6, pos.y + 38, textWidth + 12, 22);

        // Label text
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(label, pos.x, pos.y + 49);
    });
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 12;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Shorten the line to stop at the circle edge
    const nodeRadius = 28;
    const startX = fromX + nodeRadius * Math.cos(angle);
    const startY = fromY + nodeRadius * Math.sin(angle);
    toX = toX - nodeRadius * Math.cos(angle);
    toY = toY - nodeRadius * Math.sin(angle);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrowhead
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

// ==================== UTILITY FUNCTIONS ====================
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    } else if (date < today) {
        const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        return `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
    } else {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorToast.style.display = 'flex';
    setTimeout(() => {
        elements.errorToast.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    elements.successMessage.textContent = message;
    elements.successToast.style.display = 'flex';
    setTimeout(() => {
        elements.successToast.style.display = 'none';
    }, 3000);
}

// ==================== INITIALIZE ON LOAD ====================
document.addEventListener('DOMContentLoaded', init);
