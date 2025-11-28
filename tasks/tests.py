"""
Comprehensive unit tests for Smart Task Analyzer.

Tests cover:
- Scoring algorithm with various scenarios
- Edge case handling
- API endpoints
- Circular dependency detection
- Custom weight functionality
"""

import pytest
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from tasks.scoring import (
    SmartBalanceScorer,
    FastestWinsScorer,
    HighImpactScorer,
    DeadlineDrivenScorer,
    detect_circular_dependencies,
    get_scorer
)


class ScoringAlgorithmTests(TestCase):
    """Test the scoring algorithms."""
    
    def setUp(self):
        self.scorer = SmartBalanceScorer()
        self.today = date.today()
    
    def test_overdue_task_high_score(self):
        """Overdue tasks should receive highest urgency score."""
        task = {
            'id': 1,
            'title': 'Overdue task',
            'due_date': self.today - timedelta(days=2),
            'estimated_hours': 3,
            'importance': 5,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertGreater(score, 50, "Overdue tasks should have high scores")
        self.assertIn('OVERDUE', explanation.upper())
    
    def test_quick_win_bonus(self):
        """Tasks with low effort should receive quick win bonus."""
        task = {
            'id': 1,
            'title': 'Quick task',
            'due_date': self.today + timedelta(days=7),
            'estimated_hours': 1,
            'importance': 5,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertIn('Quick win', explanation)
    
    def test_dependency_blocking(self):
        """Tasks that block others should rank higher."""
        all_tasks = [
            {
                'id': 1,
                'title': 'Blocker task',
                'due_date': self.today + timedelta(days=7),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': []
            },
            {
                'id': 2,
                'title': 'Dependent task',
                'due_date': self.today + timedelta(days=7),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': [1]
            }
        ]
        
        score1, explanation1 = self.scorer.calculate_score(all_tasks[0], all_tasks)
        score2, explanation2 = self.scorer.calculate_score(all_tasks[1], all_tasks)
        
        self.assertGreater(score1, score2, "Blocking tasks should score higher")
        self.assertIn('Blocks', explanation1)
    
    def test_missing_due_date(self):
        """Tasks with missing due date should be handled gracefully."""
        task = {
            'id': 1,
            'title': 'No date task',
            'due_date': None,
            'estimated_hours': 3,
            'importance': 5,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertIsNotNone(score)
        self.assertEqual(score, score)  # Should not crash
    
    def test_custom_weights(self):
        """Custom weights should affect scoring."""
        task = {
            'id': 1,
            'title': 'Test task',
            'due_date': self.today + timedelta(days=7),
            'estimated_hours': 3,
            'importance': 8,
            'dependencies': []
        }
        
        # Default weights
        score1, _ = self.scorer.calculate_score(task)
        
        # Custom weights (high importance weight)
        custom_weights = {
            'urgency': 0.1,
            'importance': 0.7,
            'effort': 0.1,
            'dependencies': 0.1
        }
        score2, _ = self.scorer.calculate_score(task, weights=custom_weights)
        
        # With higher importance weight, a high-importance task should score differently
        self.assertNotEqual(score1, score2)


class CircularDependencyTests(TestCase):
    """Test circular dependency detection."""
    
    def test_no_circular_dependencies(self):
        """Valid dependency chain should return no cycles."""
        tasks = [
            {'id': 1, 'dependencies': []},
            {'id': 2, 'dependencies': [1]},
            {'id': 3, 'dependencies': [2]}
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertEqual(len(cycles), 0)
    
    def test_simple_circular_dependency(self):
        """Simple circular dependency (A->B->A) should be detected."""
        tasks = [
            {'id': 1, 'dependencies': [2]},
            {'id': 2, 'dependencies': [1]}
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertGreater(len(cycles), 0, "Should detect circular dependency")
    
    def test_complex_circular_dependency(self):
        """Complex circular dependency (A->B->C->A) should be detected."""
        tasks = [
            {'id': 1, 'dependencies': [2]},
            {'id': 2, 'dependencies': [3]},
            {'id': 3, 'dependencies': [1]}
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertGreater(len(cycles), 0, "Should detect circular dependency")


class APIEndpointTests(TestCase):
    """Test API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.today = date.today()
    
    def test_analyze_endpoint_valid_data(self):
        """Analyze endpoint should accept valid task data."""
        data = {
            'tasks': [
                {
                    'title': 'Test task',
                    'due_date': (self.today + timedelta(days=7)).isoformat(),
                    'estimated_hours': 3,
                    'importance': 8,
                    'dependencies': []
                }
            ],
            'strategy': 'smart_balance'
        }
        
        response = self.client.post(
            '/api/tasks/analyze/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tasks', response.data)
        self.assertIn('strategy_used', response.data)
        self.assertEqual(len(response.data['tasks']), 1)
    
    def test_analyze_endpoint_invalid_data(self):
        """Analyze endpoint should reject invalid task data."""
        data = {
            'tasks': [
                {
                    'title': 'Invalid task',
                    # Missing required fields
                }
            ]
        }
        
        response = self.client.post(
            '/api/tasks/analyze/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_suggest_endpoint(self):
        """Suggest endpoint should return top 3 tasks."""
        data = {
            'tasks': [
                {
                    'title': f'Task {i}',
                    'due_date': (self.today + timedelta(days=i)).isoformat(),
                    'estimated_hours': 3,
                    'importance': 10 - i,
                    'dependencies': []
                }
                for i in range(5)
            ]
        }
        
        response = self.client.post(
            '/api/tasks/suggest/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('suggestions', response.data)
        self.assertLessEqual(len(response.data['suggestions']), 3)
    
    def test_validate_dependencies_endpoint(self):
        """Validate endpoint should detect circular dependencies."""
        data = {
            'tasks': [
                {'id': 1, 'title': 'Task 1', 'due_date': self.today.isoformat(), 
                 'estimated_hours': 1, 'importance': 5, 'dependencies': [2]},
                {'id': 2, 'title': 'Task 2', 'due_date': self.today.isoformat(), 
                 'estimated_hours': 1, 'importance': 5, 'dependencies': [1]}
            ]
        }
        
        response = self.client.post(
            '/api/tasks/validate/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_circular_dependencies'])


class ScoringStrategyTests(TestCase):
    """Test different scoring strategies."""
    
    def setUp(self):
        self.today = date.today()
        self.task = {
            'id': 1,
            'title': 'Test task',
            'due_date': self.today + timedelta(days=7),
            'estimated_hours': 3,
            'importance': 8,
            'dependencies': []
        }
    
    def test_fastest_wins_strategy(self):
        """Fastest wins strategy should prioritize low effort."""
        scorer = FastestWinsScorer()
        score, explanation = scorer.calculate_score(self.task)
        self.assertIn('Quick task strategy', explanation)
    
    def test_high_impact_strategy(self):
        """High impact strategy should prioritize importance."""
        scorer = HighImpactScorer()
        score, explanation = scorer.calculate_score(self.task)
        self.assertIn('High impact strategy', explanation)
        self.assertIn('8/10', explanation)
    
    def test_deadline_driven_strategy(self):
        """Deadline driven strategy should prioritize due date."""
        scorer = DeadlineDrivenScorer()
        score, explanation = scorer.calculate_score(self.task)
        self.assertIn('Due in', explanation)
    
    def test_get_scorer_factory(self):
        """Scorer factory should return correct strategy."""
        self.assertIsInstance(get_scorer('smart_balance'), SmartBalanceScorer)
        self.assertIsInstance(get_scorer('fastest_wins'), FastestWinsScorer)
        self.assertIsInstance(get_scorer('high_impact'), HighImpactScorer)
        self.assertIsInstance(get_scorer('deadline_driven'), DeadlineDrivenScorer)
        # Unknown strategy should default to SmartBalanceScorer
        self.assertIsInstance(get_scorer('unknown'), SmartBalanceScorer)
