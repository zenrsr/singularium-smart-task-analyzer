"""
Task models for Smart Task Analyzer.

This module defines the Task model with all required fields for intelligent
task prioritization and scoring.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Task(models.Model):
    """
    Represents a task with properties for intelligent prioritization.
    
    Attributes:
        title: Short description of the task
        due_date: Deadline for task completion
        estimated_hours: Expected time to complete (in hours)
        importance: User-provided importance rating (1-10 scale)
        dependencies: List of task IDs that this task depends on
        created_at: Timestamp when task was created
        updated_at: Timestamp when task was last modified
    """
    
    title = models.CharField(
        max_length=200,
        help_text="Task title or description"
    )
    
    due_date = models.DateField(
        help_text="Deadline for task completion"
    )
    
    estimated_hours = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Estimated hours to complete"
    )
    
    importance = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        default=5,
        help_text="Importance rating from 1 (low) to 10 (high)"
    )
    
    dependencies = models.JSONField(
        default=list,
        blank=True,
        help_text="List of task IDs this task depends on"
    )
    
    # Metadata fields for tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'
    
    def __str__(self):
        return f"{self.title} (Due: {self.due_date})"
    
    def to_dict(self):
        """Convert task to dictionary for scoring algorithm."""
        return {
            'id': self.id,
            'title': self.title,
            'due_date': self.due_date,
            'estimated_hours': self.estimated_hours,
            'importance': self.importance,
            'dependencies': self.dependencies,
        }
