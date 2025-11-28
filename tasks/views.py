"""
API views for Smart Task Analyzer.

Implements the two required endpoints:
- POST /api/tasks/analyze/ - Analyze and sort tasks by priority
- GET /api/tasks/suggest/ - Get top 3 suggested tasks

Additional bonus endpoint:
- POST /api/tasks/validate/ - Check for circular dependencies
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    TaskSerializer, 
    ScoredTaskSerializer,
    TaskAnalysisRequestSerializer
)
from .scoring import get_scorer, detect_circular_dependencies
from typing import Dict, List


@api_view(['POST'])
def analyze_tasks(request):
    """
    Analyze and sort tasks by priority score.
    
    Request Body:
    {
        "tasks": [
            {
                "id": 1,
                "title": "Fix login bug",
                "due_date": "2025-11-30",
                "estimated_hours": 3,
                "importance": 8,
                "dependencies": []
            },
            ...
        ],
        "strategy": "smart_balance",  // optional: smart_balance, fastest_wins, high_impact, deadline_driven
        "weights": {  // optional: custom weights (must sum to 1.0)
            "urgency": 0.4,
            "importance": 0.3,
            "effort": 0.2,
            "dependencies": 0.1
        }
    }
    
    Response:
    {
        "tasks": [
            {
                "id": 1,
                "title": "Fix login bug",
                "due_date": "2025-11-30",
                "estimated_hours": 3,
                "importance": 8,
                "dependencies": [],
                "score": 85.5,
                "explanation": "Due in 2 days • High importance (8/10) • Standard task (3h)",
                "priority_level": "HIGH"
            },
            ...
        ],
        "strategy_used": "smart_balance",
        "total_tasks": 5
    }
    """
    
    # Validate request data
    request_serializer = TaskAnalysisRequestSerializer(data=request.data)
    if not request_serializer.is_valid():
        return Response(
            {
                'error': 'Invalid request data',
                'details': request_serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    validated_data = request_serializer.validated_data
    tasks = validated_data['tasks']
    strategy_name = validated_data.get('strategy', 'smart_balance')
    custom_weights = validated_data.get('weights')
    
    # Get the appropriate scoring strategy
    scorer = get_scorer(strategy_name)
    
    # Convert serialized data to dict for scoring
    task_dicts = []
    for i, task in enumerate(tasks):
        task_dict = dict(task)
        # Assign temporary ID if not provided
        if task_dict.get('id') is None:
            task_dict['id'] = i + 1
        task_dicts.append(task_dict)
    
    # Calculate scores for each task
    scored_tasks = []
    for task_dict in task_dicts:
        score, explanation = scorer.calculate_score(
            task_dict,
            all_tasks=task_dicts,
            weights=custom_weights
        )
        
        # Determine priority level
        if score >= 70:
            priority_level = "HIGH"
        elif score >= 30:
            priority_level = "MEDIUM"
        else:
            priority_level = "LOW"
        
        scored_task = {
            **task_dict,
            'score': score,
            'explanation': explanation,
            'priority_level': priority_level
        }
        scored_tasks.append(scored_task)
    
    # Sort by score (descending)
    scored_tasks.sort(key=lambda x: x['score'], reverse=True)
    
    return Response({
        'tasks': scored_tasks,
        'strategy_used': strategy_name,
        'total_tasks': len(scored_tasks),
        'custom_weights_applied': custom_weights is not None
    })


@api_view(['POST'])
def suggest_tasks(request):
    """
    Get top 3 tasks to work on today with detailed explanations.
    
    This endpoint analyzes tasks and returns the top 3 priorities with
    detailed reasoning for why each was selected.
    
    Request Body: Same as analyze_tasks
    
    Response:
    {
        "suggestions": [
            {
                "rank": 1,
                "task": {...},
                "score": 95.5,
                "reason": "This task is critical because it's overdue by 2 days..."
            },
            ...
        ],
        "total_analyzed": 10
    }
    """
    
    # Validate and process request data (same as analyze_tasks)
    request_serializer = TaskAnalysisRequestSerializer(data=request.data)
    if not request_serializer.is_valid():
        return Response(
            {
                'error': 'Invalid request data',
                'details': request_serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    validated_data = request_serializer.validated_data
    tasks = validated_data['tasks']
    strategy_name = validated_data.get('strategy', 'smart_balance')
    custom_weights = validated_data.get('weights')
    
    # Get the appropriate scoring strategy
    scorer = get_scorer(strategy_name)
    
    # Convert serialized data to dict for scoring
    task_dicts = []
    for i, task in enumerate(tasks):
        task_dict = dict(task)
        if task_dict.get('id') is None:
            task_dict['id'] = i + 1
        task_dicts.append(task_dict)
    
    # Calculate scores for each task
    scored_tasks = []
    for task_dict in task_dicts:
        score, explanation = scorer.calculate_score(
            task_dict,
            all_tasks=task_dicts,
            weights=custom_weights
        )
        
        # Determine priority level
        if score >= 70:
            priority_level = "HIGH"
        elif score >= 30:
            priority_level = "MEDIUM"
        else:
            priority_level = "LOW"
        
        scored_task = {
            **task_dict,
            'score': score,
            'explanation': explanation,
            'priority_level': priority_level
        }
        scored_tasks.append(scored_task)
    
    # Sort by score (descending)
    scored_tasks.sort(key=lambda x: x['score'], reverse=True)
    
    # Get top 3 tasks
    top_3 = scored_tasks[:3]
    
    suggestions = []
    for rank, task in enumerate(top_3, 1):
        # Generate detailed reason
        reason = _generate_detailed_reason(task, rank)
        
        suggestions.append({
            'rank': rank,
            'task': task,
            'score': task['score'],
            'reason': reason
        })
    
    return Response({
        'suggestions': suggestions,
        'total_analyzed': len(scored_tasks),
        'strategy_used': strategy_name
    })


@api_view(['POST'])
def validate_dependencies(request):
    """
    BONUS: Validate task dependencies and detect circular references.
    
    Request Body:
    {
        "tasks": [...]
    }
    
    Response:
    {
        "has_circular_dependencies": true,
        "cycles": [[1, 2, 3, 1]],  // task IDs forming cycles
        "is_valid": false
    }
    """
    
    serializer = TaskSerializer(data=request.data.get('tasks', []), many=True)
    if not serializer.is_valid():
        return Response(
            {'error': 'Invalid task data', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    tasks = serializer.validated_data
    
    # Convert to dict format
    task_dicts = []
    for i, task in enumerate(tasks):
        task_dict = dict(task)
        if task_dict.get('id') is None:
            task_dict['id'] = i + 1
        task_dicts.append(task_dict)
    
    # Detect cycles
    cycles = detect_circular_dependencies(task_dicts)
    
    return Response({
        'has_circular_dependencies': len(cycles) > 0,
        'cycles': cycles,
        'cycle_count': len(cycles),
        'is_valid': len(cycles) == 0,
        'message': 'Dependencies are valid' if len(cycles) == 0 else f'Found {len(cycles)} circular dependency cycle(s)'
    })


def _generate_detailed_reason(task: Dict, rank: int) -> str:
    """Generate detailed explanation for why a task was suggested."""
    
    reasons = []
    
    # Priority level
    priority = task['priority_level']
    if priority == 'HIGH':
        reasons.append(f"🔴 Ranked #{rank} with HIGH priority (score: {task['score']})")
    elif priority == 'MEDIUM':
        reasons.append(f"🟡 Ranked #{rank} with MEDIUM priority (score: {task['score']})")
    else:
        reasons.append(f"🟢 Ranked #{rank} with LOW priority (score: {task['score']})")
    
    # Add the detailed explanation
    reasons.append(f"Factors: {task['explanation']}")
    
    # Add actionable recommendation
    if rank == 1:
        reasons.append("💡 Recommendation: Start with this task immediately")
    elif rank == 2:
        reasons.append("💡 Recommendation: Work on this after completing the top task")
    else:
        reasons.append("💡 Recommendation: Plan to complete this task today if possible")
    
    return " | ".join(reasons)
