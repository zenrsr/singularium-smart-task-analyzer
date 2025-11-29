"""
Intelligent task scoring algorithms for Smart Task Analyzer.

This module implements multiple scoring strategies using the Strategy Pattern:
- SmartBalanceScorer: Balanced algorithm considering all factors
- FastestWinsScorer: Prioritizes low-effort tasks
- HighImpactScorer: Prioritizes importance only
- DeadlineDrivenScorer: Prioritizes based on due dates

Edge cases handled:
- Missing or invalid data fields
- Past due dates (overdue tasks)
- Circular dependencies
- Custom weight configurations
"""

from abc import ABC, abstractmethod
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple


def count_business_days(start_date: date, end_date: date) -> int:
    """
    Count business days (Monday-Friday) between two dates.
    
    This provides more realistic urgency calculations by excluding weekends.
    For example, a task due Monday evaluated on Friday is 1 business day away,
    not 3 calendar days.
    
    Args:
        start_date: Starting date (typically today)
        end_date: Ending date (typically task due date)
        
    Returns:
        Number of business days between dates (can be negative if end < start)
        
    Example:
        Friday (2025-11-28) to Monday (2025-12-01) = 1 business day
        Monday to Friday (same week) = 5 business days
    """
    if start_date == end_date:
        return 0
    
    # Determine direction
    if start_date > end_date:
        # Counting backwards (overdue case)
        return -count_business_days(end_date, start_date)
    
    business_days = 0
    current = start_date
    
    while current < end_date:
        # weekday() returns 0=Monday, 6=Sunday
        # We count Monday-Friday (0-4)
        if current.weekday() < 5:
            business_days += 1
        current += timedelta(days=1)
    
    return business_days


class ScoringStrategy(ABC):
    """Abstract base class for scoring strategies."""
    
    @abstractmethod
    def calculate_score(
        self, 
        task_data: Dict, 
        all_tasks: List[Dict] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, str]:
        """
        Calculate priority score for a task.
        
        Args:
            task_data: Dictionary containing task information
            all_tasks: List of all tasks (for dependency analysis)
            weights: Optional custom weights for scoring components
            
        Returns:
            Tuple of (score, explanation) where:
            - score: Numerical priority score (higher = more important)
            - explanation: Human-readable explanation of the score
        """
        pass


class SmartBalanceScorer(ScoringStrategy):
    """
    Balanced scoring algorithm considering urgency, importance, effort, and dependencies.
    
    Default weights:
    - Urgency: 40%
    - Importance: 30%
    - Effort: 20%
    - Dependencies: 10%
    """
    
    DEFAULT_WEIGHTS = {
        'urgency': 0.40,
        'importance': 0.30,
        'effort': 0.20,
        'dependencies': 0.10
    }
    
    def calculate_score(
        self, 
        task_data: Dict, 
        all_tasks: List[Dict] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, str]:
        """Calculate balanced score with configurable weights."""
        
        # Use custom weights or defaults
        w = weights if weights else self.DEFAULT_WEIGHTS
        
        # Validate weights sum to 1.0 (or close to it)
        if weights and abs(sum(weights.values()) - 1.0) > 0.01:
            w = self.DEFAULT_WEIGHTS
        
        score = 0
        explanations = []
        
        # 1. URGENCY COMPONENT
        urgency_score, urgency_explanation = self._calculate_urgency(task_data)
        score += urgency_score * w['urgency']
        explanations.append(urgency_explanation)
        
        # 2. IMPORTANCE COMPONENT
        importance_score, importance_explanation = self._calculate_importance(task_data)
        score += importance_score * w['importance']
        explanations.append(importance_explanation)
        
        # 3. EFFORT COMPONENT
        effort_score, effort_explanation = self._calculate_effort(task_data)
        score += effort_score * w['effort']
        explanations.append(effort_explanation)
        
        # 4. DEPENDENCY COMPONENT
        if all_tasks:
            dep_score, dep_explanation = self._calculate_dependencies(task_data, all_tasks)
            score += dep_score * w['dependencies']
            if dep_explanation:
                explanations.append(dep_explanation)
        
        explanation = " • ".join(explanations)
        return round(score, 2), explanation
    
    def _calculate_urgency(self, task_data: Dict) -> Tuple[float, str]:
        """
        Calculate urgency score based on due date.
        
        Uses business days (Mon-Fri) for more realistic urgency.
        Weekend-aware: A task due Monday is 1 business day from Friday, not 3.
        """
        try:
            due_date = task_data.get('due_date')
            
            # Handle missing due date
            if not due_date:
                return 0, "No due date set"
            
            # Convert string to date if needed
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date).date()
            
            today = date.today()
            
            # Use business days instead of calendar days
            days_until_due = count_business_days(today, due_date)
            
            if days_until_due < 0:
                # OVERDUE - maximum urgency
                days_overdue = abs(days_until_due)
                return 100, f"⚠️ OVERDUE by {days_overdue} business day(s)"
            elif days_until_due == 0:
                return 90, "⚠️ Due TODAY"
            elif days_until_due == 1:
                return 80, "Due tomorrow (1 business day)"
            elif days_until_due <= 3:
                return 50, f"Due in {days_until_due} business days"
            elif days_until_due <= 5:
                return 30, f"Due in {days_until_due} business days"
            elif days_until_due <= 10:
                return 15, "Due within 2 weeks"
            else:
                return 5, "Due date is distant"
                
        except Exception as e:
            return 0, f"Invalid due date"
    
    def _calculate_importance(self, task_data: Dict) -> Tuple[float, str]:
        """Calculate importance score."""
        importance = task_data.get('importance', 5)
        
        # Validate importance is in range 1-10
        importance = max(1, min(10, importance))
        
        # Scale to 0-100 range
        score = importance * 10
        
        if importance >= 8:
            return score, f"❗ High importance ({importance}/10)"
        elif importance >= 5:
            return score, f"Medium importance ({importance}/10)"
        else:
            return score, f"Low importance ({importance}/10)"
    
    def _calculate_effort(self, task_data: Dict) -> Tuple[float, str]:
        """Calculate effort score (quick wins get bonus)."""
        hours = task_data.get('estimated_hours', 2)
        
        # Ensure positive hours
        hours = max(1, hours)
        
        if hours < 2:
            return 20, f"⚡ Quick win ({hours}h)"
        elif hours <= 4:
            return 10, f"Moderate effort ({hours}h)"
        elif hours <= 8:
            return 0, f"Standard task ({hours}h)"
        else:
            return -10, f"Large task ({hours}h)"
    
    def _calculate_dependencies(
        self, 
        task_data: Dict, 
        all_tasks: List[Dict]
    ) -> Tuple[float, str]:
        """Calculate dependency impact."""
        task_id = task_data.get('id')
        dependencies = task_data.get('dependencies', [])
        
        # Check how many tasks depend on THIS task (blockers)
        blockers_count = 0
        for other_task in all_tasks:
            if task_id in other_task.get('dependencies', []):
                blockers_count += 1
        
        if blockers_count > 0:
            score = blockers_count * 15
            return score, f"🔗 Blocks {blockers_count} task(s)"
        
        # Check if THIS task is blocked
        if dependencies:
            return -20, f"⏸️ Waiting on {len(dependencies)} task(s)"
        
        return 0, ""


class FastestWinsScorer(ScoringStrategy):
    """Prioritizes tasks with lowest effort (quick wins)."""
    
    def calculate_score(
        self, 
        task_data: Dict, 
        all_tasks: List[Dict] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, str]:
        """Score based on estimated hours (lower is better)."""
        hours = task_data.get('estimated_hours', 2)
        hours = max(1, hours)
        
        # Invert so lower hours = higher score
        score = 100 - (hours * 5)
        score = max(0, score)
        
        return score, f"Quick task strategy: {hours} hour(s)"


class HighImpactScorer(ScoringStrategy):
    """Prioritizes tasks based solely on importance."""
    
    def calculate_score(
        self, 
        task_data: Dict, 
        all_tasks: List[Dict] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, str]:
        """Score based on importance only."""
        importance = task_data.get('importance', 5)
        importance = max(1, min(10, importance))
        
        score = importance * 10
        return score, f"High impact strategy: {importance}/10 importance"


class DeadlineDrivenScorer(ScoringStrategy):
    """Prioritizes tasks based on due date proximity."""
    
    def calculate_score(
        self, 
        task_data: Dict,
        all_tasks: List[Dict] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, str]:
        """
        Score based on due date urgency using business days.
        
        Weekend-aware for consistent urgency across all strategies.
        """
        try:
            due_date = task_data.get('due_date')
            
            if not due_date:
                return 0, "No due date"
            
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date).date()
            
            today = date.today()
            
            # Use business days for deadline calculations
            days_until_due = count_business_days(today, due_date)
            
            if days_until_due < 0:
                score = 150 + abs(days_until_due)
                return score, f"Overdue by {abs(days_until_due)} business days"
            elif days_until_due == 0:
                return 120, "Due today"
            elif days_until_due <= 5:  # Within 1 week of business days
                score = 100 - (days_until_due * 10)
                return score, f"Due in {days_until_due} business days"
            else:
                score = max(0, 30 - days_until_due)
                return score, f"Due in {days_until_due} business days"
                
        except Exception:
            return 0, "Invalid due date"


def detect_circular_dependencies(tasks: List[Dict]) -> List[List[int]]:
    """
    Detect circular dependencies using Depth-First Search (DFS).
    
    Args:
        tasks: List of task dictionaries with 'id' and 'dependencies' fields
        
    Returns:
        List of cycles, where each cycle is a list of task IDs forming a loop
        
    Example:
        If task 1 depends on task 2, and task 2 depends on task 1,
        returns [[1, 2, 1]]
    """
    cycles = []
    visited = set()
    rec_stack = set()
    
    # Build adjacency list
    graph = {}
    for task in tasks:
        task_id = task.get('id')
        if task_id:
            graph[task_id] = task.get('dependencies', [])
    
    def dfs(node, path):
        """Recursive DFS to detect cycles."""
        visited.add(node)
        rec_stack.add(node)
        path.append(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor, path):
                    return True
            elif neighbor in rec_stack:
                # Found a cycle
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                cycles.append(cycle)
                return True
        
        path.pop()
        rec_stack.remove(node)
        return False
    
    # Check each node
    for task_id in graph:
        if task_id not in visited:
            dfs(task_id, [])
    
    return cycles


def get_scorer(strategy: str = 'smart_balance') -> ScoringStrategy:
    """
    Factory function to get the appropriate scoring strategy.
    
    Args:
        strategy: One of 'smart_balance', 'fastest_wins', 'high_impact', 'deadline_driven'
        
    Returns:
        Instance of the requested scoring strategy
    """
    strategies = {
        'smart_balance': SmartBalanceScorer(),
        'fastest_wins': FastestWinsScorer(),
        'high_impact': HighImpactScorer(),
        'deadline_driven': DeadlineDrivenScorer(),
    }
    
    return strategies.get(strategy, SmartBalanceScorer())
