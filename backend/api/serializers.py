"""
SDRAS API Serializers
"""
from rest_framework import serializers
from .models import Zone, Resource, EmergencyReport, Allocation, Alert


class ResourceSerializer(serializers.ModelSerializer):
    assigned_zone_name = serializers.CharField(source='assigned_zone.name', read_only=True, allow_null=True)

    class Meta:
        model = Resource
        fields = [
            'id', 'name', 'resource_type', 'status',
            'assigned_zone', 'assigned_zone_name',
            'capacity', 'utilized', 'location', 'last_update'
        ]


class ZoneSerializer(serializers.ModelSerializer):
    resources = ResourceSerializer(many=True, read_only=True)
    resources_deployed = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'name', 'disaster_type', 'severity',
            'state', 'district', 'data_source',
            'population', 'affected_count',
            'coord_x', 'coord_y', 'reported_at',
            'need_medical', 'need_food', 'need_shelter', 'need_rescue',
            'priority_score', 'is_active',
            'resources', 'resources_deployed',
        ]

    def get_resources_deployed(self, obj):
        return obj.resources.filter(status__in=['deployed', 'in-transit']).count()


class ZoneListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    resources_deployed = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'name', 'disaster_type', 'severity',
            'state', 'district', 'data_source',
            'population', 'affected_count',
            'coord_x', 'coord_y', 'reported_at',
            'need_medical', 'need_food', 'need_shelter', 'need_rescue',
            'priority_score', 'is_active', 'resources_deployed',
        ]

    def get_resources_deployed(self, obj):
        return obj.resources.filter(status__in=['deployed', 'in-transit']).count()


class EmergencyReportSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)

    class Meta:
        model = EmergencyReport
        fields = [
            'id', 'location', 'disaster_type', 'severity',
            'people_affected', 'description',
            'reporter_name', 'reporter_contact',
            'is_voicebot', 'voicebot_transcript',
            'ai_priority_score', 'status', 'zone', 'zone_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['ai_priority_score', 'created_at', 'updated_at']


class AllocationSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    resource_name = serializers.CharField(source='resource.name', read_only=True)
    resource_type = serializers.CharField(source='resource.resource_type', read_only=True)

    class Meta:
        model = Allocation
        fields = [
            'id', 'zone', 'zone_name', 'resource', 'resource_name', 'resource_type',
            'status', 'notes', 'allocated_at', 'updated_at', 'completed_at',
        ]
        read_only_fields = ['allocated_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'alert_type', 'message', 'zone', 'zone_name',
            'acknowledged', 'created_at',
        ]
        read_only_fields = ['created_at']
