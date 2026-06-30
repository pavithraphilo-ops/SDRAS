"""
SDRAS API Models
"""
from django.db import models
from django.utils import timezone


class Zone(models.Model):
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    DISASTER_TYPES = [
        ('Flood', 'Flood'),
        ('Earthquake', 'Earthquake'),
        ('Wildfire', 'Wildfire'),
        ('Storm', 'Storm'),
        ('Drought', 'Drought'),
        ('Cyclone', 'Cyclone'),
        ('Landslide', 'Landslide'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=200)
    disaster_type = models.CharField(max_length=50, choices=DISASTER_TYPES, default='Flood')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    state = models.CharField(max_length=100, default='Telangana')
    district = models.CharField(max_length=100, default='Hyderabad')
    data_source = models.CharField(max_length=150, default='NDMA Weather Station Network')
    population = models.IntegerField(default=0)
    affected_count = models.IntegerField(default=0)
    coord_x = models.FloatField(default=50)   # % position for map
    coord_y = models.FloatField(default=50)
    reported_at = models.DateTimeField(default=timezone.now)

    # Need scores (0-100)
    need_medical = models.IntegerField(default=0)
    need_food = models.IntegerField(default=0)
    need_shelter = models.IntegerField(default=0)
    need_rescue = models.IntegerField(default=0)

    # AI-computed
    priority_score = models.FloatField(default=0)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-priority_score']

    def compute_priority_score(self):
        severity_weight = {'critical': 1.0, 'high': 0.75, 'medium': 0.5, 'low': 0.25}
        need_avg = (self.need_medical + self.need_rescue + self.need_food + self.need_shelter) / 4
        affected_ratio = (self.affected_count / self.population * 100) if self.population > 0 else 0
        sev = severity_weight.get(self.severity, 0.5)
        score = (need_avg * 0.4) + (affected_ratio * 0.3) + (sev * 100 * 0.3)
        return min(100, round(score, 1))

    def save(self, *args, **kwargs):
        self.priority_score = self.compute_priority_score()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Resource(models.Model):
    TYPE_CHOICES = [
        ('medical', 'Medical Unit'),
        ('rescue', 'Rescue Team'),
        ('food', 'Food/Water Supply'),
        ('shelter', 'Shelter Kit'),
    ]
    STATUS_CHOICES = [
        ('standby', 'Standby'),
        ('deployed', 'Deployed'),
        ('in-transit', 'In Transit'),
        ('unavailable', 'Unavailable'),
    ]

    name = models.CharField(max_length=200)
    resource_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='medical')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='standby')
    assigned_zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.SET_NULL, related_name='resources')
    capacity = models.IntegerField(default=100)
    utilized = models.IntegerField(default=0)
    location = models.CharField(max_length=200, default='Base Camp')
    last_update = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class EmergencyReport(models.Model):
    """Citizen/authority emergency report — triggers zone creation or update"""
    DISASTER_TYPES = Zone.DISASTER_TYPES
    SEVERITY_CHOICES = Zone.SEVERITY_CHOICES
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('allocated', 'Allocated'),
        ('resolved', 'Resolved'),
    ]

    location = models.CharField(max_length=200)
    disaster_type = models.CharField(max_length=50, choices=DISASTER_TYPES, default='Flood')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    people_affected = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    reporter_name = models.CharField(max_length=100, blank=True, default='Anonymous')
    reporter_contact = models.CharField(max_length=50, blank=True)

    # VoiceBot fields
    is_voicebot = models.BooleanField(default=False)
    voicebot_transcript = models.TextField(blank=True)

    # Computed
    ai_priority_score = models.FloatField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.SET_NULL, related_name='reports')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def compute_priority_score(self):
        severity_weight = {'critical': 100, 'high': 75, 'medium': 50, 'low': 25}
        sev_score = severity_weight.get(self.severity, 50)
        # Normalize people affected (cap at 10000 for scoring)
        people_score = min(100, (self.people_affected / 10000) * 100)
        score = (sev_score * 0.6) + (people_score * 0.4)
        return round(score, 1)

    def save(self, *args, **kwargs):
        self.ai_priority_score = self.compute_priority_score()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.disaster_type} at {self.location} — {self.severity}"


class Allocation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('en_route', 'En Route'),
        ('arrived', 'Arrived'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name='allocations')
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='allocations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    allocated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-allocated_at']

    def __str__(self):
        return f"{self.resource.name} → {self.zone.name}"


class Alert(models.Model):
    TYPE_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
    ]

    alert_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='info')
    message = models.TextField()
    zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.SET_NULL, related_name='alerts')
    acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.alert_type}] {self.message[:50]}"
