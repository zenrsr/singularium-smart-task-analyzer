"""
URL configuration for tasks app.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.analyze_tasks, name='analyze_tasks'),
    path('suggest/', views.suggest_tasks, name='suggest_tasks'),
    path('validate/', views.validate_dependencies, name='validate_dependencies'),
]
