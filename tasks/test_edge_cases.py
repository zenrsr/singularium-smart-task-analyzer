"""
EXTREME EDGE CASE TESTS for Smart Task Analyzer

This module contains aggressive testing scenarios including:
- Extreme date ranges (past 100 years, future 100 years)
- Invalid data combinations
- Massive task lists (100+ tasks)
- Circular dependency chains
- Invalid importance/effort values
- Empty and null data
- Special characters and SQL injection attempts
- Concurrent request handling
"""

import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from tasks.scoring import (
    SmartBalanceScorer,
    detect_circular_dependencies,
)


class ExtremeEdgeCaseTests(TestCase):
    """Aggressive edge case testing."""
    
    def setUp(self):
        self.client = APIClient()
        self.scorer = SmartBalanceScorer()
        self.today = date.today()
    
    def test_year_1900_due_date(self):
        """Test task due 100+ years ago."""
        task = {
            'id': 1,
            'title': 'Ancient task',
            'due_date': date(1900, 1, 1),
            'estimated_hours': 5,
            'importance': 5,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertGreater(score, 100, "Tasks 100+ years overdue should have maximum priority")
        self.assertIn('OVERDUE', explanation.upper())
    
    def test_year_2100_due_date(self):
        """Test task due 75+ years in future."""
        task = {
            'id': 1,
            'title': 'Future task',
            'due_date': date(2100, 12, 31),
            'estimated_hours': 5,
            'importance': 10,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertLess(score, 50, "Tasks decades away should have low urgency")
    
    def test_zero_hours_task(self):
        """Test task with 0 estimated hours (should be handled)."""
        data = {
            'tasks': [{
                'title': 'Zero hour task',
                'due_date': (self.today + timedelta(days=1)).isoformat(),
                'estimated_hours': 0,  # Invalid
                'importance': 5,
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_negative_hours_task(self):
        """Test task with negative hours."""
        data = {
            'tasks': [{
                'title': 'Negative hours',
                'due_date': self.today.isoformat(),
                'estimated_hours': -5,
                'importance': 5,
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_importance_over_10(self):
        """Test importance value > 10."""
        data = {
            'tasks': [{
                'title': 'Over-important task',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 15,  # Invalid
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_importance_under_1(self):
        """Test importance value < 1."""
        data = {
            'tasks': [{
                'title': 'Under-important task',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 0,  # Invalid
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_extremely_long_title(self):
        """Test task with 500+ character title."""
        long_title = 'A' * 500
        data = {
            'tasks': [{
                'title': long_title,
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        # Should either accept or reject cleanly
        self.assertIn(response.status_code, [200, 400])
    
    def test_special_characters_title(self):
        """Test task with special characters and potential SQL injection."""
        injection_attempts = [
            "'; DROP TABLE tasks; --",
            "<script>alert('xss')</script>",
            "../../etc/passwd",
            "\x00\x01\x02",
            "\\' OR 1=1 --"
        ]
        
        for malicious_title in injection_attempts:
            data = {
                'tasks': [{
                    'title': malicious_title,
                    'due_date': self.today.isoformat(),
                    'estimated_hours': 3,
                    'importance': 5,
                    'dependencies': []
                }]
            }
            response = self.client.post('/api/tasks/analyze/', data, format='json')
            # Should handle safely
            self.assertIn(response.status_code, [200, 400])
    
    def test_100_tasks_performance(self):
        """Test system with 100 tasks."""
        tasks = [
            {
                'title': f'Task {i}',
                'due_date': (self.today + timedelta(days=i % 30)).isoformat(),
                'estimated_hours': (i % 10) + 1,
                'importance': (i % 10) + 1,
                'dependencies': []
            }
            for i in range(100)
        ]
        
        data = {'tasks': tasks}
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['tasks']), 100)
        # Check sorting
        scores = [task['score'] for task in response.data['tasks']]
        self.assertEqual(scores, sorted(scores, reverse=True))
    
    def test_empty_task_list(self):
        """Test with empty task array."""
        data = {'tasks': []}
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['tasks']), 0)
    
    def test_missing_required_fields(self):
        """Test task missing all required fields."""
        data = {
            'tasks': [{'title': 'Incomplete'}]  # Missing everything else
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_invalid_date_format(self):
        """Test various invalid date formats."""
        invalid_dates = [
            '2025-13-01',  # Invalid month
            '2025-02-30',  # Invalid day
            'not-a-date',
            '01/01/2025',  # Wrong format
            '2025',
            ''
        ]
        
        for invalid_date in invalid_dates:
            data = {
                'tasks': [{
                    'title': 'Test',
                    'due_date': invalid_date,
                    'estimated_hours': 3,
                    'importance': 5,
                    'dependencies': []
                }]
            }
            response = self.client.post('/api/tasks/analyze/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_complex_circular_dependency_chain(self):
        """Test complex circular dependency: A->B->C->D->A."""
        tasks = [
            {'id': 1, 'dependencies': [2]},
            {'id': 2, 'dependencies': [3]},
            {'id': 3, 'dependencies': [4]},
            {'id': 4, 'dependencies': [1]},  # Creates cycle
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertGreater(len(cycles), 0, "Should detect 4-node cycle")
    
    def test_self_dependency(self):
        """Test task that depends on itself."""
        tasks = [
            {'id': 1, 'dependencies': [1]},  # Self-dependency
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertGreater(len(cycles), 0)
    
    def test_multiple_circular_chains(self):
        """Test multiple independent circular dependencies."""
        tasks = [
            {'id': 1, 'dependencies': [2]},
            {'id': 2, 'dependencies': [1]},  # Cycle 1
            {'id': 3, 'dependencies': [4]},
            {'id': 4, 'dependencies': [3]},  # Cycle 2
            {'id': 5, 'dependencies': []},   # Independent
        ]
        cycles = detect_circular_dependencies(tasks)
        self.assertGreaterEqual(len(cycles), 2, "Should detect both cycles")
    
    def test_invalid_dependency_ids(self):
        """Test dependencies referencing non-existent tasks."""
        data = {
            'tasks': [{
                'id': 1,
                'title': 'Test',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': [999, 1000, 1001]  # Non-existent IDs
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        # Should handle gracefully
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_weights_sum_to_zero(self):
        """Test custom weights that sum to 0."""
        data = {
            'tasks': [{
                'title': 'Test',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': []
            }],
            'weights': {
                'urgency': 0,
                'importance': 0,
                'effort': 0,
                'dependencies': 0
            }
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        # Should reject or use defaults
        self.assertIn(response.status_code, [200, 400])
    
    def test_weights_sum_over_1(self):
        """Test custom weights summing to >100%."""
        data = {
            'tasks': [{
                'title': 'Test',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': []
            }],
            'weights': {
                'urgency': 0.5,
                'importance': 0.5,
                'effort': 0.5,
                'dependencies': 0.5  # Sums to 2.0
            }
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_missing_weight_keys(self):
        """Test custom weights with missing keys."""
        data = {
            'tasks': [{
                'title': 'Test',
                'due_date': self.today.isoformat(),
                'estimated_hours': 3,
                'importance': 5,
                'dependencies': []
            }],
            'weights': {
                'urgency': 0.5,
                'importance': 0.5
                # Missing effort and dependencies
            }
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_unicode_characters_in_title(self):
        """Test Unicode characters in task title."""
        unicode_titles = [
            '测试任务',  # Chinese
            'Тестовая задача',  # Russian
            '🚀 Deploy to production 🎉',  # Emojis
            'Ñoño task with ñ',  # Special Latin
            '¯\\_(ツ)_/¯'  # Emoticons
        ]
        
        for unicode_title in unicode_titles:
            data = {
                'tasks': [{
                    'title': unicode_title,
                    'due_date': self.today.isoformat(),
                    'estimated_hours': 3,
                    'importance': 5,
                    'dependencies': []
                }]
            }
            response = self.client.post('/api/tasks/analyze/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['tasks'][0]['title'], unicode_title)
    
    def test_1000_hour_task(self):
        """Test task requiring 1000 hours."""
        task = {
            'id': 1,
            'title': 'Massive project',
            'due_date': self.today + timedelta(days=365),
            'estimated_hours': 1000,
            'importance': 10,
            'dependencies': []
        }
        score, explanation = self.scorer.calculate_score(task)
        self.assertIsNotNone(score)
        # Large tasks should get penalty
        self.assertIn('Large', explanation)
    
    def test_all_strategies_with_same_task(self):
        """Test all 4 strategies produce different scores for same task."""
        task_data = {
            'title': 'Test task',
            'due_date': (self.today + timedelta(days=7)).isoformat(),
            'estimated_hours': 5,
            'importance': 8,
            'dependencies': []
        }
        
        strategies = ['smart_balance', 'fastest_wins', 'high_impact', 'deadline_driven']
        scores = []
        
        for strategy in strategies:
            data = {
                'tasks': [task_data],
                'strategy': strategy
            }
            response = self.client.post('/api/tasks/analyze/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            scores.append(response.data['tasks'][0]['score'])
        
        # At least some strategies should produce different scores
        self.assertGreater(len(set(scores)), 1, "Different strategies should produce different scores")
