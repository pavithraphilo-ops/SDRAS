"""SDRAS API URL Routing"""
from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('stats/', views.dashboard_stats, name='dashboard-stats'),

    # Zones
    path('zones/', views.ZoneListCreate.as_view(), name='zone-list'),
    path('zones/<int:pk>/', views.ZoneDetail.as_view(), name='zone-detail'),
    path('zones/priority-scores/', views.zone_priority_scores, name='zone-priority-scores'),

    # Resources
    path('resources/', views.ResourceListCreate.as_view(), name='resource-list'),
    path('resources/<int:pk>/', views.ResourceDetail.as_view(), name='resource-detail'),

    # Emergency Reports
    path('reports/', views.EmergencyReportListCreate.as_view(), name='report-list'),
    path('reports/<int:pk>/', views.EmergencyReportDetail.as_view(), name='report-detail'),

    # Allocations
    path('allocations/', views.AllocationListCreate.as_view(), name='allocation-list'),
    path('allocations/<int:pk>/', views.AllocationDetail.as_view(), name='allocation-detail'),

    # Alerts
    path('alerts/', views.AlertListCreate.as_view(), name='alert-list'),
    path('alerts/<int:pk>/', views.AlertDetail.as_view(), name='alert-detail'),
    path('alerts/<int:pk>/acknowledge/', views.acknowledge_alert, name='alert-acknowledge'),
    path('alerts/acknowledge-all/', views.acknowledge_all_alerts, name='alert-acknowledge-all'),

    # AI Engine
    path('ai/analyze/', views.run_ai_analysis, name='ai-analyze'),
    path('ai/priority-scores/', views.zone_priority_scores, name='ai-priority-scores'),

    # VoiceBot
    path('voicebot/report/', views.voicebot_report, name='voicebot-report'),
    path('voicebot/command/', views.voicebot_command, name='voicebot-command'),

    # Auth Login
    path('login/', views.api_login, name='api-login'),
]
