"""
CHAOS TESTS for Smart Task Analyzer
"Insane" scenarios to test system resilience.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

class ChaosTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_massive_payload_10000_tasks(self):
        """Test system resilience with 10,000 tasks."""
        tasks = [
            {
                'id': i,
                'title': f'Task {i}',
                'due_date': '2025-12-01',
                'estimated_hours': 1,
                'importance': 5,
                'dependencies': []
            }
            for i in range(10000)
        ]
        # This might be slow, but should not crash
        response = self.client.post('/api/tasks/analyze/', {'tasks': tasks}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['tasks']), 10000)

    def test_type_mismatches(self):
        """Test sending strings where numbers are expected."""
        data = {
            'tasks': [{
                'title': 'Bad types',
                'due_date': '2025-12-01',
                'estimated_hours': "five",  # String instead of int
                'importance': "high",       # String instead of int
                'dependencies': "none"      # String instead of list
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        # Should return 400 Bad Request, not 500 Server Error
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deeply_nested_json(self):
        """Test sending deeply nested JSON structure."""
        data = {'tasks': {'nested': {'deep': {'structure': []}}}}
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_html_injection_persistence(self):
        """
        Verify backend accepts HTML/Script tags (sanitization happens on frontend).
        The API should store/process it, but frontend must escape it.
        """
        malicious_title = "<script>alert('pwned')</script><b>Bold</b>"
        data = {
            'tasks': [{
                'title': malicious_title,
                'due_date': '2025-12-01',
                'estimated_hours': 1,
                'importance': 5,
                'dependencies': []
            }]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tasks'][0]['title'], malicious_title)

    def test_mixed_valid_and_invalid_tasks(self):
        """Test a mix of valid and invalid tasks - should reject all or handle gracefully."""
        data = {
            'tasks': [
                {
                    'title': 'Valid Task',
                    'due_date': '2025-12-01',
                    'estimated_hours': 1,
                    'importance': 5,
                    'dependencies': []
                },
                {
                    'title': 'Invalid Task',
                    # Missing required fields
                }
            ]
        }
        response = self.client.post('/api/tasks/analyze/', data, format='json')
        # DRF default behavior is usually 400 if any item is invalid
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
