/**
 * UI Rendering Module
 * Handles all DOM manipulation and UI updates
 */

import { state, elements, TASKS_PER_PAGE, strategyDescriptions } from './state.js';
import { escapeHtml, formatDate, getPriorityClass, showSuccessToast, showErrorToast } from './utils.js';

/**
 * Switches between tabs
 * @param {string} tabName - Tab to switch to ('form' or 'json')
 */
export function switchTab(tabName) {
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'form') {
        elements.formTab.classList.remove('hidden');
        elements.jsonTab.classList.add('hidden');
    } else {
        elements.formTab.classList.add('hidden');
        elements.jsonTab.classList.remove('hidden');
    }
}

/**
 * Updates the importance value display
 */
export function updateImportanceValue() {
    elements.importanceValue.textContent = elements.taskImportance.value;
}

/**
 * Updates the task preview list
 */
export function updateTaskPreview() {
    elements.taskCount.textContent = state.currentTasks.length;

    if (state.currentTasks.length === 0) {
        elements.taskListPreview.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No tasks added yet</p>';
        renderDependencySelector();
        return;
    }

    elements.taskListPreview.innerHTML = state.currentTasks.map((task, index) => `
        <div class="task-preview-item">
            <span>${escapeHtml(task.title)}</span>
            <button class="task-preview-remove" onclick="window.removeTask(${index})" type="button">&times;</button>
        </div>
    `).join('');

    renderDependencySelector();
}

/**
 * Renders dependency checkbox selector
 */
export function renderDependencySelector() {
    const container = elements.dependencySelector;

    if (state.currentTasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks added yet</p>';
        return;
    }

    container.innerHTML = state.currentTasks.map(task => `
        <label class="dependency-item">
            <input type="checkbox" value="${task.id}" name="dependency" data-task-id="${task.id}">
            <span class="task-id">${task.id}</span>
            <span class="task-title">${escapeHtml(task.title)}</span>
        </label>
    `).join('');
}

/**
 * Gets selected dependencies from checkboxes
 * @returns {Array<number>} Array of selected dependency IDs
 */
export function getSelectedDependencies() {
    const checkboxes = document.querySelectorAll('#dependency-selector input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

/**
 * Updates strategy description text
 */
export function updateStrategyDescription() {
    const strategy = elements.strategySelector.value;
    elements.strategyDescription.textContent = strategyDescriptions[strategy] || '';
}

/**
 * Toggles advanced config visibility based on strategy
 */
export function toggleAdvancedConfig() {
    const strategy = elements.strategySelector.value;
    elements.advancedConfig.style.display = strategy === 'custom' ? 'block' : 'none';
}

/**
 * Updates weight slider values and total
 */
export function updateWeights() {
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

/**
 * Resets weights to default values
 */
export function resetWeights() {
    elements.weightUrgency.value = 40;
    elements.weightImportance.value = 30;
    elements.weightEffort.value = 20;
    elements.weightDependencies.value = 10;
    updateWeights();
}

/**
 * Displays analysis results
 * @param {Object} data - Analysis results from API
 */
export function displayResults(data) {
    elements.welcomeState.style.display = 'none';
    elements.resultsContent.style.display = 'block';
    const tasks = data.tasks;
    elements.tasksTotal.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
    state.currentPage = 1;

    displaySuggestions(tasks.slice(0, 3), tasks);
    displayAllTasks(tasks);
}

/**
 * Displays top 3 suggested tasks
 * @param {Array} topTasks - Top 3 tasks
 * @param {Array} allTasks - All tasks (for dependency lookup)
 */
export function displaySuggestions(topTasks, allTasks) {
    if (topTasks.length === 0) {
        elements.suggestionsList.innerHTML = '<p style="color: var(--text-muted);">No tasks to suggest</p>';
        return;
    }

    elements.suggestionsList.innerHTML = topTasks.map((task, index) => {
        // Check for blocking dependencies WITH SCORE CONTRADICTION
        let blockingBadge = '';
        if (task.dependencies && task.dependencies.length > 0) {
            const blockingDeps = task.dependencies.filter(depId => {
                const depTask = allTasks.find(t => t.id === depId);
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

        // Create details list
        const detailsList = [];

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

        detailsList.push(`${task.estimated_hours} hour${task.estimated_hours !== 1 ? 's' : ''} estimated`);

        const importanceLevel = task.importance >= 7 ? 'High' : task.importance >= 4 ? 'Medium' : 'Low';
        detailsList.push(`${importanceLevel} importance (${task.importance}/10)`);

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

/**
 * Displays all tasks with pagination
 * @param {Array} tasks - All tasks
 */
export function displayAllTasks(tasks) {
    if (tasks.length === 0) {
        elements.allTasksList.innerHTML = '<p style="color: var(--text-secondary); padding: var(--space-m);">No tasks to display</p>';
        elements.paginationControls.style.display = 'none';
        return;
    }

    const startIndex = (state.currentPage - 1) * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, endIndex);
    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);

    elements.allTasksList.innerHTML = paginatedTasks.map(task => {
        const priorityClass = task.priority_level.toLowerCase();

        // Check for blocking dependencies
        let blockingBadge = '';
        if (task.dependencies && task.dependencies.length > 0) {
            const blockingDeps = task.dependencies.filter(depId => {
                const depTask = tasks.find(t => t.id === depId);
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

    updatePagination(totalPages);
}

/**
 * Updates pagination controls
 * @param {number} totalPages - Total number of pages
 */
export function updatePagination(totalPages) {
    if (totalPages <= 1) {
        elements.paginationControls.style.display = 'none';
        return;
    }

    elements.paginationControls.style.display = 'flex';
    elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = state.currentPage === totalPages;
}

/**
 * Changes page in pagination
 * @param {number} delta - Page change (-1 or +1)
 */
export function changePage(delta) {
    if (!state.currentResults) return;

    const totalPages = Math.ceil(state.currentResults.tasks.length / TASKS_PER_PAGE);
    const newPage = state.currentPage + delta;

    if (newPage < 1 || newPage > totalPages) return;

    state.currentPage = newPage;
    displayAllTasks(state.currentResults.tasks);
}
