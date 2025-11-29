"""
Tests for Date Intelligence (Weekend Awareness) feature.

Tests the business day counting logic and weekend-aware urgency calculations.
"""

from datetime import date, timedelta
from django.test import TestCase
from tasks.scoring import (
    count_business_days,
    SmartBalanceScorer,
    DeadlineDrivenScorer
)


class BusinessDaysTestCase(TestCase):
    """Test business day counting logic."""
    
    def test_same_day(self):
        """Same day should return 0 business days."""
        today = date(2025, 11, 28)  # Friday
        self.assertEqual(count_business_days(today, today), 0)
    
    def test_friday_to_monday(self):
        """Friday to Monday should be 1 business day (not 3)."""
        friday = date(2025, 11, 28)
        monday = date(2025, 12, 1)
        self.assertEqual(count_business_days(friday, monday), 1)
    
    def test_monday_to_friday_same_week(self):
        """Monday to Friday same week should be 4 business days."""
        monday = date(2025, 12, 1)
        friday = date(2025, 12, 5)
        # Count from Mon to Fri: Tue, Wed, Thu, Fri = 4 days (not including Monday)
        self.assertEqual(count_business_days(monday, friday), 4)
    
    def test_skip_weekend(self):
        """Week including weekend should count only business days."""
        # Thursday to next Wednesday (includes Sat, Sun)
        thursday = date(2025, 11, 27)
        next_wednesday = date(2025, 12, 3)  
        # Fri(1) + Mon(1) + Tue(1) + Wed(1) = 4 business days
        self.assertEqual(count_business_days(thursday, next_wednesday), 4)
    
    def test_negative_days_overdue(self):
        """Past dates should return negative business days."""
        today = date(2025, 11, 28)  # Friday
        last_monday = date(2025, 11, 24)  # Previous Monday
        # Mon(-1) + Tue(-1) + Wed(-1) + Thu(-1) + Fri(0) = -4 business days
        result = count_business_days(today, last_monday)
        self.assertTrue(result < 0, "Overdue should be negative")
        self.assertEqual(result, -4)
    
    def test_saturday_to_sunday(self):
        """Weekend to weekend should be 0 business days."""
        saturday = date(2025, 11, 29)
        sunday = date(2025, 11, 30)
        self.assertEqual(count_business_days(saturday, sunday), 0)


class UrgencyWithWeekendsTestCase(TestCase):
    """Test urgency scoring with weekend awareness."""
    
    def setUp(self):
        """Set up test scorer."""
        self.scorer = SmartBalanceScorer()
    
    def test_urgency_friday_to_monday(self):
        """Task due Monday from Friday should show low urgency (1 business day)."""
        # Mock today as Friday
        from unittest.mock import patch
        friday = date(2025, 11, 28)
        monday = date(2025, 12, 1)
        
        with patch('tasks.scoring.date') as mock_date:
            mock_date.today.return_value = friday
            
            task = {
                'due_date': monday.isoformat(),
                'importance': 5,
                'estimated_hours': 2
            }
            
            score, explanation = self.scorer._calculate_urgency(task)
            
            # Should reflect 1 business day urgency
            self.assertIn('business day', explanation.lower())
            self.assertGreater(score, 50, "1 business day should have urgency")
    
    def test_urgency_overdue_weekends(self):
        """Overdue tasks should count business days correctly."""
        from unittest.mock import patch
        
        # Task due last Friday, today is Tuesday
        last_friday = date(2025, 11, 21)
        tuesday = date(2025, 11, 25)
        
        with patch('tasks.scoring.date') as mock_date:
            mock_date.today.return_value = tuesday
            
            task = {
                'due_date': last_friday.isoformat(),
                'importance': 8,
                'estimated_hours': 3
            }
            
            score, explanation = self.scorer._calculate_urgency(task)
            
            # Should be overdue (Mon + Tue = 2 business days)
            self.assertIn('overdue', explanation.lower())
            self.assertIn('business day', explanation.lower())
            self.assertEqual(score, 100, "Overdue should have max urgency")


class DeadlineDrivenWithWeekendsTestCase(TestCase):
    """Test deadline-driven strategy with weekend awareness."""
    
    def setUp(self):
        """Set up deadline-driven scorer."""
        self.scorer = DeadlineDrivenScorer()
    
    def test_deadline_scorer_uses_business_days(self):
        """Deadline scorer should use business days."""
        from unittest.mock import patch
        
        friday = date(2025, 11, 28)
        next_tuesday = date(2025, 12, 2)  # 2 business days away
        
        with patch('tasks.scoring.date') as mock_date:
            mock_date.today.return_value = friday
            
            task = {
                'due_date': next_tuesday.isoformat(),
                'importance': 5,
                'estimated_hours': 2
            }
            
            score, explanation = self.scorer.calculate_score(task)
            
            # Should mention business days
            self.assertIn('business day', explanation.lower())
            # Score should be high (within 5 business days)
            self.assertGreater(score, 50)
