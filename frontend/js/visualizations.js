/**
 * Visualizations Module
 * Handles Eisenhower Matrix and Dependency Graph rendering
 */

import { state, elements } from './state.js';
import { escapeHtml, formatDate, showErrorToast } from './utils.js';

/**
 * Shows Eisenhower Matrix visualization
 */
export function showEisenhowerMatrix() {
    if (!state.currentResults || !state.currentResults.tasks) {
        showErrorToast('Please analyze tasks first');
        return;
    }

    const tasks = state.currentResults.tasks;

    // Categorize tasks into quadrants
    const quadrants = {
        urgent_important: [],
        notUrgent_important: [],
        urgent_notImportant: [],
        notUrgent_notImportant: []
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

/**
 * Shows Dependency Graph visualization
 */
export function showDependencyGraph() {
    if (!state.currentResults || !state.currentResults.tasks) {
        showErrorToast('Please analyze tasks first');
        return;
    }

    const canvas = elements.graphCanvas;
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    drawDependencyGraph(ctx, state.currentResults.tasks);
    elements.graphModal.style.display = 'flex';
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

    // Draw edges (dependencies)
    tasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
                if (positions[depId]) {
                    const from = positions[depId];
                    const to = positions[task.id];

                    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
                    gradient.addColorStop(0, '#3b82f6');
                    gradient.addColorStop(1, '#8b5cf6');

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    drawArrow(ctx, from.x, from.y, to.x, to.y);
                    ctx.setLineDash([]);
                }
            });
        }
    });

    // Draw nodes
    tasks.forEach(task => {
        const pos = positions[task.id];
        const priorityClass = task.priority_level.toLowerCase();

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

        // Node ID
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(task.id, pos.x, pos.y);

        // Node label
        const label = task.title.length > 18 ? task.title.substring(0, 18) + '...' : task.title;
        ctx.font = '13px Inter';
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(26, 29, 40, 0.9)';
        ctx.fillRect(pos.x - textWidth / 2 - 6, pos.y + 38, textWidth + 12, 22);
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x - textWidth / 2 - 6, pos.y + 38, textWidth + 12, 22);

        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(label, pos.x, pos.y + 49);
    });
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 12;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    const shortening = 35;
    const startX = fromX + shortening * Math.cos(angle);
    const startY = fromY + shortening * Math.sin(angle);
    const endX = toX - shortening * Math.cos(angle);
    const endY = toY - shortening * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
}
