"""
SDRAS API Views — Full REST API
"""
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Zone, Resource, EmergencyReport, Allocation, Alert
from .serializers import (
    ZoneSerializer, ZoneListSerializer, ResourceSerializer,
    EmergencyReportSerializer, AllocationSerializer, AlertSerializer
)
from .ai_engine import recommend_resources, compute_zone_priority


# ── Dashboard Stats ────────────────────────────────────────────────────────────

@api_view(['GET'])
def dashboard_stats(request):
    """Single endpoint for the command dashboard"""
    zones = Zone.objects.filter(is_active=True)
    resources = Resource.objects.all()
    alerts = Alert.objects.all()
    reports = EmergencyReport.objects.all()

    total_affected = sum(z.affected_count for z in zones)
    deployed = resources.filter(status='deployed').count()
    in_transit = resources.filter(status='in-transit').count()
    standby = resources.filter(status='standby').count()
    critical_alerts = alerts.filter(alert_type='critical', acknowledged=False).count()
    pending_reports = reports.filter(status='pending').count()

    sev_counts = {
        'critical': zones.filter(severity='critical').count(),
        'high': zones.filter(severity='high').count(),
        'medium': zones.filter(severity='medium').count(),
        'low': zones.filter(severity='low').count(),
    }

    return Response({
        'total_affected': total_affected,
        'total_zones': zones.count(),
        'severity_counts': sev_counts,
        'resources': {
            'deployed': deployed,
            'in_transit': in_transit,
            'standby': standby,
            'total': resources.count(),
        },
        'critical_alerts': critical_alerts,
        'pending_reports': pending_reports,
    })


# ── Zones ──────────────────────────────────────────────────────────────────────

class ZoneListCreate(generics.ListCreateAPIView):
    queryset = Zone.objects.filter(is_active=True)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ZoneListSerializer
        return ZoneSerializer


class ZoneDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer


# ── Resources ─────────────────────────────────────────────────────────────────

class ResourceListCreate(generics.ListCreateAPIView):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer

    def get_queryset(self):
        qs = Resource.objects.all()
        status = self.request.query_params.get('status')
        rtype = self.request.query_params.get('type')
        if status:
            qs = qs.filter(status=status)
        if rtype:
            qs = qs.filter(resource_type=rtype)
        return qs


class ResourceDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer


# ── Emergency Reports ─────────────────────────────────────────────────────────

class EmergencyReportListCreate(generics.ListCreateAPIView):
    queryset = EmergencyReport.objects.all()
    serializer_class = EmergencyReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()
        # Auto-create or update a zone from this report
        _auto_create_zone_from_report(report)
        # Auto-generate alert
        Alert.objects.create(
            alert_type='critical' if report.severity in ['critical', 'high'] else 'warning',
            message=f"New emergency report: {report.disaster_type} in {report.location} — {report.people_affected} people affected",
            zone=report.zone,
        )


class EmergencyReportDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = EmergencyReport.objects.all()
    serializer_class = EmergencyReportSerializer


def _auto_create_zone_from_report(report):
    """Create a Zone from an EmergencyReport if one doesn't exist for that location"""
    severity_weight = {'critical': 1.0, 'high': 0.75, 'medium': 0.5, 'low': 0.25}
    import random
    
    # Parse state and district dynamically
    loc = (report.location or "").lower() + " " + (report.description or "").lower()
    if 'hyderabad' in loc or 'begumpet' in loc or 'musi' in loc:
        state = 'Telangana'
        district = 'Hyderabad'
    elif 'warangal' in loc or 'hanamkonda' in loc:
        state = 'Telangana'
        district = 'Warangal'
    elif 'karimnagar' in loc:
        state = 'Telangana'
        district = 'Karimnagar'
    elif 'ludhiana' in loc or 'punjab' in loc:
        state = 'Punjab'
        district = 'Ludhiana'
    elif 'pune' in loc or 'maharashtra' in loc:
        state = 'Maharashtra'
        district = 'Pune'
    elif 'dehradun' in loc or 'uttarakhand' in loc:
        state = 'Uttarakhand'
        district = 'Dehradun'
    elif 'visakhapatnam' in loc or 'andhra' in loc:
        state = 'Andhra Pradesh'
        district = 'Visakhapatnam'
    elif 'jodhpur' in loc or 'rajasthan' in loc:
        state = 'Rajasthan'
        district = 'Jodhpur'
    else:
        state = 'Telangana'
        district = 'Hyderabad'

    data_source = "🎤 VoiceBot Ingestion Hotline" if report.is_voicebot else "📝 GHMC Emergency Ingestion Portal"

    zone, created = Zone.objects.get_or_create(
        name__icontains=report.location,
        defaults={
            'name': f"{report.location} — {report.disaster_type} Zone",
            'disaster_type': report.disaster_type,
            'severity': report.severity,
            'state': state,
            'district': district,
            'data_source': data_source,
            'population': max(report.people_affected * 4, 10000),
            'affected_count': report.people_affected,
            'coord_x': random.uniform(10, 85),
            'coord_y': random.uniform(10, 85),
            'need_medical': min(100, int(report.people_affected / 50)),
            'need_food': min(100, int(report.people_affected / 40)),
            'need_shelter': min(100, int(report.people_affected / 60)),
            'need_rescue': min(100, int(report.people_affected / 70)),
            'reported_at': report.created_at,
        }
    )
    if not created:
        # Update existing zone
        zone.affected_count += report.people_affected
        zone.save()
    report.zone = zone
    report.save(update_fields=['zone'])


# ── Allocations ───────────────────────────────────────────────────────────────

class AllocationListCreate(generics.ListCreateAPIView):
    queryset = Allocation.objects.all()
    serializer_class = AllocationSerializer

    def perform_create(self, serializer):
        allocation = serializer.save()
        # Update resource status
        resource = allocation.resource
        resource.status = 'in-transit'
        resource.assigned_zone = allocation.zone
        resource.location = f"En route to {allocation.zone.name.split('—')[0].strip()}"
        resource.save()
        # Generate alert
        Alert.objects.create(
            alert_type='info',
            message=f"{resource.name} dispatched to {allocation.zone.name.split('—')[0].strip()}",
            zone=allocation.zone,
        )


class AllocationDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Allocation.objects.all()
    serializer_class = AllocationSerializer

    def perform_update(self, serializer):
        allocation = serializer.save()
        # If completed, free up resource
        if allocation.status == 'completed':
            resource = allocation.resource
            resource.status = 'standby'
            resource.assigned_zone = None
            resource.location = 'Base Camp — Available'
            resource.save()
            allocation.completed_at = timezone.now()
            allocation.save(update_fields=['completed_at'])


# ── Alerts ────────────────────────────────────────────────────────────────────

class AlertListCreate(generics.ListCreateAPIView):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer

    def get_queryset(self):
        qs = Alert.objects.all()
        ack = self.request.query_params.get('acknowledged')
        if ack is not None:
            qs = qs.filter(acknowledged=(ack.lower() == 'true'))
        return qs


class AlertDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer


@api_view(['POST'])
def acknowledge_alert(request, pk):
    try:
        alert = Alert.objects.get(pk=pk)
        alert.acknowledged = True
        alert.save()
        return Response({'status': 'acknowledged'})
    except Alert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=404)


@api_view(['POST'])
def acknowledge_all_alerts(request):
    Alert.objects.filter(acknowledged=False).update(acknowledged=True)
    return Response({'status': 'all acknowledged'})


# ── AI Engine Endpoints ───────────────────────────────────────────────────────

@api_view(['POST'])
def run_ai_analysis(request):
    """Run full AI analysis — compute priority scores and get recommendations"""
    zones = Zone.objects.filter(is_active=True)
    resources = Resource.objects.filter(status='standby')

    results = []
    for zone in zones:
        zone.priority_score = zone.compute_priority_score()
        zone.save(update_fields=['priority_score'])
        recs = recommend_resources(zone, resources)
        results.append({
            'zone_id': zone.id,
            'zone_name': zone.name,
            'priority_score': zone.priority_score,
            'severity': zone.severity,
            'recommendations': recs,
        })

    results.sort(key=lambda x: x['priority_score'], reverse=True)
    return Response({'analysis': results, 'zones_analyzed': len(results)})


@api_view(['GET'])
def zone_priority_scores(request):
    """Get all zones ranked by priority score"""
    zones = Zone.objects.filter(is_active=True)
    data = []
    for z in zones:
        data.append({
            'id': z.id,
            'zone': z.name.split('—')[0].strip(),
            'full_name': z.name,
            'score': z.priority_score,
            'severity': z.severity,
            'disaster_type': z.disaster_type,
            'affected_count': z.affected_count,
        })
    data.sort(key=lambda x: x['score'], reverse=True)
    return Response(data)


# ── VoiceBot Simulation ───────────────────────────────────────────────────────

@api_view(['POST'])
def voicebot_report(request):
    """
    Simulate VoiceBot: Accept text input, extract location/disaster info,
    create an EmergencyReport automatically.
    """
    transcript = request.data.get('transcript', '')
    if not transcript:
        return Response({'error': 'No transcript provided'}, status=400)

    extracted = _extract_from_transcript(transcript)

    # Create report
    report = EmergencyReport.objects.create(
        location=extracted['location'],
        disaster_type=extracted['disaster_type'],
        severity=extracted['severity'],
        people_affected=extracted['people_affected'],
        description=transcript,
        is_voicebot=True,
        voicebot_transcript=transcript,
        reporter_name='VoiceBot Caller',
    )
    _auto_create_zone_from_report(report)

    Alert.objects.create(
        alert_type='warning',
        message=f"🎤 VoiceBot Report: {extracted['disaster_type']} in {extracted['location']} — {extracted['people_affected']} people affected",
        zone=report.zone,
    )

    serializer = EmergencyReportSerializer(report)
    return Response({
        'extracted': extracted,
        'report': serializer.data,
        'message': 'Emergency report created from VoiceBot transcript'
    }, status=201)


def _extract_from_transcript(transcript):
    """Simple keyword-based NLP extraction from voice transcript"""
    text = transcript.lower()

    # Extract disaster type
    disaster_map = {
        'flood': 'Flood', 'flooding': 'Flood', 'water': 'Flood',
        'earthquake': 'Earthquake', 'quake': 'Earthquake', 'tremor': 'Earthquake',
        'fire': 'Wildfire', 'wildfire': 'Wildfire', 'burning': 'Wildfire',
        'storm': 'Storm', 'cyclone': 'Cyclone', 'hurricane': 'Storm',
        'drought': 'Drought', 'landslide': 'Landslide',
    }
    disaster_type = 'Flood'
    for keyword, dtype in disaster_map.items():
        if keyword in text:
            disaster_type = dtype
            break

    # Extract severity
    severity = 'medium'
    if any(w in text for w in ['critical', 'emergency', 'severe', 'extreme', 'urgent', 'immediately']):
        severity = 'critical'
    elif any(w in text for w in ['high', 'serious', 'major', 'badly', 'many']):
        severity = 'high'
    elif any(w in text for w in ['low', 'minor', 'small', 'few']):
        severity = 'low'

    # Extract location — look for "Ward X", "Zone X", "in <Location>"
    import re
    location = 'Unknown Location'
    ward_match = re.search(r'ward\s*(\d+|[a-zA-Z]+)', text)
    zone_match = re.search(r'zone\s*(\d+|[a-zA-Z]+)', text)
    in_match = re.search(r'in\s+([A-Za-z\s]+?)(?:\s+and|\s+area|\s+district|\.|\,|$)', transcript, re.IGNORECASE)

    if ward_match:
        location = f"Ward {ward_match.group(1).title()}"
    elif zone_match:
        location = f"Zone {zone_match.group(1).title()}"
    elif in_match:
        location = in_match.group(1).strip().title()

    # Extract number of people
    people_affected = 50  # default
    num_match = re.search(r'(\d+)\s*(?:people|persons|families|individuals|survivors|victims)', text)
    if num_match:
        people_affected = int(num_match.group(1))

    return {
        'location': location,
        'disaster_type': disaster_type,
        'severity': severity,
        'people_affected': people_affected,
    }


# ── Auth Login ────────────────────────────────────────────────────────────────

from django.contrib.auth import authenticate

@api_view(['POST'])
def api_login(request):
    """API Login view validating credentials against Django User database"""
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user is not None:
        return Response({
            'success': True,
            'username': user.username,
            'is_superuser': user.is_superuser
        })
    return Response({
        'success': False,
        'error': 'Invalid credentials. Please verify your username and password.'
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def voicebot_command(request):
    """
    NLP Voice/Text command executor for dispatching, recalling, adding resources, and registering locations.
    """
    transcript = request.data.get('transcript', '')
    if not transcript:
        return Response({'error': 'No command transcript provided'}, status=400)

    text = transcript.lower().strip()
    
    # 1. RECALL Command
    if any(w in text for w in ['recall', 'return', 'bring back']):
        target_res = None
        for res in Resource.objects.all():
            if res.name.lower() in text or res.resource_type.lower() in text:
                target_res = res
                break
        
        if target_res:
            target_res.status = 'standby'
            target_res.assigned_zone = None
            target_res.location = 'Base Camp — Hyderabad'
            target_res.utilized = 0
            target_res.save()
            return Response({
                'action': 'recall',
                'message': f"Successfully recalled resource '{target_res.name}' back to Base Camp."
            }, status=200)
        
        return Response({'error': "Could not identify which resource to recall in the command."}, status=400)

    # 2. DISPATCH Command
    elif any(w in text for w in ['dispatch', 'send', 'allocate', 'route', 're-route']):
        target_zone = None
        for zone in Zone.objects.filter(is_active=True):
            zone_simple = zone.name.split('—')[0].strip().lower()
            if zone_simple in text or zone.district.lower() in text:
                target_zone = zone
                break
        
        target_res = None
        standby_resources = Resource.objects.filter(status='standby')
        for res in standby_resources:
            if res.name.lower() in text or res.resource_type.lower() in text:
                target_res = res
                break
        
        if not target_res and standby_resources.exists():
            if 'medical' in text or 'doctor' in text:
                target_res = standby_resources.filter(resource_type='medical').first()
            elif 'rescue' in text or 'team' in text or 'fire' in text:
                target_res = standby_resources.filter(resource_type='rescue').first()
            elif 'food' in text or 'water' in text:
                target_res = standby_resources.filter(resource_type='food').first()
            elif 'shelter' in text or 'camp' in text:
                target_res = standby_resources.filter(resource_type='shelter').first()

        if target_zone and target_res:
            target_res.status = 'in-transit'
            target_res.assigned_zone = target_zone
            target_res.location = f"En route to {target_zone.name.split('—')[0].strip()}"
            target_res.save()
            
            Allocation.objects.create(
                zone=target_zone,
                resource=target_res,
                notes="Voicebot command dispatch"
            )
            return Response({
                'action': 'dispatch',
                'message': f"Successfully dispatched '{target_res.name}' to '{target_zone.name.split('—')[0].strip()}'."
            }, status=200)

        if not target_zone:
            return Response({'error': "Could not identify target location/zone in the command."}, status=400)
        return Response({'error': "No matching standby resource found to dispatch."}, status=400)

    # 3. ADD RESOURCE Command
    elif any(w in text for w in ['add resource', 'create resource', 'register resource', 'add standby', 'save resource']):
        rtype = 'medical'
        rname = 'Medical Unit'
        if 'rescue' in text or 'team' in text:
            rtype = 'rescue'
            rname = 'Rescue Team'
        elif 'fire' in text:
            rtype = 'rescue'
            rname = 'Fire Suspension'
        elif 'food' in text:
            rtype = 'food'
            rname = 'Food Supply Unit'
        elif 'water' in text:
            rtype = 'food'
            rname = 'Water Supply Unit'
        elif 'shelter' in text or 'camp' in text:
            rtype = 'shelter'
            rname = 'Emergency Shelter'

        import re
        capacity = 200
        cap_match = re.search(r'(\d+)\s*(?:capacity|units|size|people)?', text)
        if cap_match:
            capacity = int(cap_match.group(1))

        name_match = re.search(r'(?:called|named|with name)\s+([a-z0-9\s]+)', text)
        if name_match:
            rname = name_match.group(1).title()

        res = Resource.objects.create(
            name=rname,
            resource_type=rtype,
            status='standby',
            assigned_zone=None,
            capacity=capacity,
            utilized=0,
            location='Base Camp — Hyderabad'
        )
        return Response({
            'action': 'add_resource',
            'message': f"Successfully added standby resource '{res.name}' with capacity {res.capacity} to Base Camp."
        }, status=201)

    # 4. REGISTER LOCATION Command
    elif any(w in text for w in ['register location', 'add location', 'register zone', 'create zone', 'create location', 'add place']):
        import re
        place_name = "Custom Relief Center"
        name_match = re.search(r'(?:called|named|at|in|place)\s+([a-z0-9\s]+)', text)
        if name_match:
            candidate = name_match.group(1).strip()
            candidate = re.split(r'\s+(?:with|having|need|has)\s+', candidate)[0]
            place_name = candidate.title()

        need_med = 50
        need_fd = 50
        need_sh = 50
        need_re = 50

        if 'critical medical' in text or 'high medical' in text:
            need_med = 85
        elif 'low medical' in text:
            need_med = 20
        
        if 'critical food' in text or 'high food' in text:
            need_fd = 85
        elif 'low food' in text:
            need_fd = 20

        if 'critical shelter' in text or 'high shelter' in text:
            need_sh = 85
        elif 'low shelter' in text:
            need_sh = 20

        if 'critical rescue' in text or 'high rescue' in text:
            need_re = 85
        elif 'low rescue' in text:
            need_re = 20

        import random
        zone = Zone.objects.create(
            name=place_name,
            state='Telangana',
            district='Hyderabad',
            disaster_type='Flood' if 'flood' in text else 'Earthquake' if 'earthquake' in text else 'Wildfire' if 'fire' in text else 'Other',
            severity='critical' if 'critical' in text else 'high' if 'high' in text else 'medium',
            population=10000,
            affected_count=500,
            coord_x=random.randint(25, 75),
            coord_y=random.randint(25, 75),
            need_medical=need_med,
            need_food=need_fd,
            need_shelter=need_sh,
            need_rescue=need_re
        )
        zone.priority_score = zone.compute_priority_score()
        zone.save()

        return Response({
            'action': 'register_location',
            'message': f"Successfully registered location '{zone.name}' in {zone.district}, {zone.state}."
        }, status=201)

    return Response({'error': "Command not recognized. Try saying 'add resource', 'register location', 'dispatch [resource] to [zone]', or 'recall [resource]'."}, status=400)

