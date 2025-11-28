"""
Django REST Framework serializers for Task API.

Handles validation, serialization, and deserialization of Task data.
"""

from rest_framework import serializers
from .models import Task
from datetime import date


class TaskSerializer(serializers.Serializer):
    """
    Serializer for task input/output.
    Validates all task fields and handles conversion between formats.
    """
    
    id = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField(max_length=200)
    due_date = serializers.DateField()
    estimated_hours = serializers.IntegerField(min_value=1)
    importance = serializers.IntegerField(min_value=1, max_value=10)
    dependencies = serializers.ListField(
        child=serializers.IntegerField(),
        default=list,
        required=False
    )
    
    def validate_due_date(self, value):
        """Allow any due date including past dates (they'll be marked as overdue)."""
        return value
    
    def validate_dependencies(self, value):
        """Ensure dependencies is a list of integers."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Dependencies must be a list")
        return value


class ScoredTaskSerializer(serializers.Serializer):
    """
    Serializer for tasks with calculated priority scores.
    Adds computed fields for score, explanation, and priority level.
    """
    
    id = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField()
    due_date = serializers.DateField()
    estimated_hours = serializers.IntegerField()
    importance = serializers.IntegerField()
    dependencies = serializers.ListField(child=serializers.IntegerField(), default=list)
    
    # Computed fields
    score = serializers.FloatField()
    explanation = serializers.CharField()
    priority_level = serializers.CharField()
    
    def get_priority_level(self, score: float) -> str:
        """Determine priority level based on score."""
        if score >= 70:
            return "HIGH"
        elif score >= 30:
            return "MEDIUM"
        else:
            return "LOW"


class TaskAnalysisRequestSerializer(serializers.Serializer):
    """
    Serializer for task analysis API requests.
    Validates the request payload for analyzing tasks.
    """
    
    tasks = TaskSerializer(many=True)
    strategy = serializers.ChoiceField(
        choices=['smart_balance', 'fastest_wins', 'high_impact', 'deadline_driven'],
        default='smart_balance',
        required=False
    )
    weights = serializers.DictField(
        child=serializers.FloatField(),
        required=False,
        allow_null=True
    )
    
    def validate_weights(self, value):
        """Validate that custom weights sum to 1.0 (or 100%)."""
        if value is None:
            return value
        
        required_keys = {'urgency', 'importance', 'effort', 'dependencies'}
        if set(value.keys()) != required_keys:
            raise serializers.ValidationError(
                f"Weights must contain exactly: {required_keys}"
            )
        
        total = sum(value.values())
        if abs(total - 1.0) > 0.01:  # Allow small floating point errors
            raise serializers.ValidationError(
                f"Weights must sum to 1.0 (100%), got {total}"
            )
        
        return value
