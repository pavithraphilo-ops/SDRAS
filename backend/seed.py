"""
SDRAS Database Seed Script — Kaggle India Natural Disasters Dataset
Run: python3 seed.py
Populates the database with real historical disasters in India from 1990-2021 Kaggle dataset
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sdras_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.utils import timezone
from api.models import Zone, Resource, Alert, EmergencyReport, Allocation
from datetime import timedelta
import random

print("🌱 Seeding SDRAS database with Kaggle India Disasters Dataset...")

# Clear existing data
Zone.objects.all().delete()
Resource.objects.all().delete()
Alert.objects.all().delete()
EmergencyReport.objects.all().delete()
Allocation.objects.all().delete()

print("   ✓ Cleared existing data")

# Coordinate conversion formula to map real lat/lng to coord_x/y (0-100%)
# Longitude range: 68.7 to 97.2
# Latitude range: 8.4 to 35.5 (invert Y since 0 is top north)
def latlng_to_coord(lat, lng):
    x = ((lng - 68.7) / (97.2 - 68.7)) * 100
    y = ((35.5 - lat) / (35.5 - 8.4)) * 100
    return min(100, max(0, round(x, 2))), min(100, max(0, round(y, 2)))

kaggle_disasters = [
    {
        'title': '1993 Latur Earthquake',
        'state': 'Maharashtra', 'district': 'Latur',
        'lat': 18.40, 'lng': 76.56,
        'disaster_type': 'Earthquake', 'severity': 'critical',
        'duration': '1 day', 'year': 1993, 'date': '1993-09-30',
        'info': 'The Latur earthquake struck Maharashtra, causing massive damage and over 10,000 casualties. It affected several villages in Latur and Osmanabad.',
        'population': 120000, 'affected_count': 30000,
        'need_medical': 90, 'need_food': 70, 'need_shelter': 95, 'need_rescue': 85
    },
    {
        'title': '1999 Odisha Cyclone',
        'state': 'Odisha', 'district': 'Jagatsinghpur',
        'lat': 20.27, 'lng': 86.66,
        'disaster_type': 'Cyclone', 'severity': 'critical',
        'duration': '3 days', 'year': 1999, 'date': '1999-10-29',
        'info': 'The 1999 Odisha cyclone was the strongest recorded tropical cyclone in the North Indian Ocean. It caused over 9,000 fatalities and extensive coastal inundation.',
        'population': 350000, 'affected_count': 120000,
        'need_medical': 85, 'need_food': 95, 'need_shelter': 90, 'need_rescue': 80
    },
    {
        'title': '2001 Gujarat Earthquake',
        'state': 'Gujarat', 'district': 'Kutch',
        'lat': 23.24, 'lng': 69.66,
        'disaster_type': 'Earthquake', 'severity': 'critical',
        'duration': '1 day', 'year': 2001, 'date': '2001-01-26',
        'info': "The Bhuj earthquake occurred on India's 52nd Republic Day, causing severe destruction across Gujarat, killing around 20,000 people and destroying hundreds of thousands of buildings.",
        'population': 250000, 'affected_count': 85000,
        'need_medical': 95, 'need_food': 65, 'need_shelter': 85, 'need_rescue': 90
    },
    {
        'title': '2004 Indian Ocean Tsunami',
        'state': 'Tamil Nadu', 'district': 'Nagapattinam',
        'lat': 10.76, 'lng': 79.84,
        'disaster_type': 'Cyclone', 'severity': 'critical',
        'duration': '1 day', 'year': 2004, 'date': '2004-12-26',
        'info': 'The 2004 Indian Ocean tsunami devastated coastal communities in Tamil Nadu and Andaman Islands, causing widespread loss of life and displacement.',
        'population': 180000, 'affected_count': 55000,
        'need_medical': 85, 'need_food': 80, 'need_shelter': 95, 'need_rescue': 70
    },
    {
        'title': '2005 Kashmir Earthquake',
        'state': 'Jammu and Kashmir', 'district': 'Baramulla',
        'lat': 34.08, 'lng': 74.03,
        'disaster_type': 'Earthquake', 'severity': 'high',
        'duration': '1 day', 'year': 2005, 'date': '2005-10-08',
        'info': 'The major earthquake hit near Muzaffarabad and affected parts of Jammu & Kashmir, leading to severe structural damage and thousands of deaths.',
        'population': 95000, 'affected_count': 15000,
        'need_medical': 80, 'need_food': 60, 'need_shelter': 85, 'need_rescue': 75
    },
    {
        'title': '2005 Maharashtra Floods',
        'state': 'Maharashtra', 'district': 'Mumbai Suburban',
        'lat': 19.07, 'lng': 72.87,
        'disaster_type': 'Flood', 'severity': 'critical',
        'duration': '2 days', 'year': 2005, 'date': '2005-07-26',
        'info': 'The 2005 Mumbai floods resulted from unprecedented heavy rainfall of 944 mm in 24 hours, bringing the entire financial capital of India to a complete halt.',
        'population': 600000, 'affected_count': 220000,
        'need_medical': 90, 'need_food': 85, 'need_shelter': 70, 'need_rescue': 80
    },
    {
        'title': '2008 Bihar Flood',
        'state': 'Bihar', 'district': 'Supaul',
        'lat': 26.12, 'lng': 86.60,
        'disaster_type': 'Flood', 'severity': 'critical',
        'duration': '30 days', 'year': 2008, 'date': '2008-08-18',
        'info': 'The Kosi river breached its embankments at Kushaha, shifting its course and flooding several districts in Northern Bihar, affecting millions of people.',
        'population': 400000, 'affected_count': 140000,
        'need_medical': 80, 'need_food': 90, 'need_shelter': 90, 'need_rescue': 75
    },
    {
        'title': '2009 Andhra Pradesh Floods',
        'state': 'Andhra Pradesh', 'district': 'Kurnool',
        'lat': 15.82, 'lng': 78.03,
        'disaster_type': 'Flood', 'severity': 'high',
        'duration': '5 days', 'year': 2009, 'date': '2009-10-02',
        'info': 'Record water levels in the Krishna River caused major flooding in Kurnool and Mahabubnagar districts, submerging large areas and displacing residents.',
        'population': 150000, 'affected_count': 32000,
        'need_medical': 70, 'need_food': 80, 'need_shelter': 75, 'need_rescue': 60
    },
    {
        'title': '2012 Himalayan Flash Floods',
        'state': 'Uttarakhand', 'district': 'Uttarkashi',
        'lat': 30.72, 'lng': 78.44,
        'disaster_type': 'Flood', 'severity': 'medium',
        'duration': '3 days', 'year': 2012, 'date': '2012-08-03',
        'info': 'Heavy cloudbursts caused severe flooding in the Bhagirathi River, destroying houses and roads, causing casualties in Uttarkashi district.',
        'population': 45000, 'affected_count': 6000,
        'need_medical': 55, 'need_food': 65, 'need_shelter': 60, 'need_rescue': 45
    },
    {
        'title': '2013 Kedarnath Floods',
        'state': 'Uttarakhand', 'district': 'Rudraprayag',
        'lat': 30.73, 'lng': 79.06,
        'disaster_type': 'Flood', 'severity': 'critical',
        'duration': '5 days', 'year': 2013, 'date': '2013-06-16',
        'info': 'A multi-day cloudburst centered on Uttarakhand caused catastrophic floods and landslides, particularly devastating the Kedarnath temple area and surrounding towns.',
        'population': 280000, 'affected_count': 95000,
        'need_medical': 90, 'need_food': 80, 'need_shelter': 90, 'need_rescue': 95
    },
    {
        'title': '2014 Kashmir Floods',
        'state': 'Jammu and Kashmir', 'district': 'Srinagar',
        'lat': 34.08, 'lng': 74.79,
        'disaster_type': 'Flood', 'severity': 'high',
        'duration': '7 days', 'year': 2014, 'date': '2014-09-02',
        'info': 'Torrential rains led to the overflow of the Jhelum River, flooding Srinagar and surrounding valley districts, resulting in massive infrastructure collapse and evacuations.',
        'population': 220000, 'affected_count': 48000,
        'need_medical': 75, 'need_food': 85, 'need_shelter': 80, 'need_rescue': 70
    },
    {
        'title': '2015 South India Floods',
        'state': 'Tamil Nadu', 'district': 'Chennai',
        'lat': 13.08, 'lng': 80.27,
        'disaster_type': 'Flood', 'severity': 'critical',
        'duration': '10 days', 'year': 2015, 'date': '2015-11-08',
        'info': 'Heavy northeast monsoon rainfall compounded by reservoir discharges caused catastrophic urban flooding across Chennai and adjacent coastal districts.',
        'population': 450000, 'affected_count': 110000,
        'need_medical': 85, 'need_food': 90, 'need_shelter': 80, 'need_rescue': 75
    },
    {
        'title': '2018 Kerala Floods',
        'state': 'Kerala', 'district': 'Wayanad',
        'lat': 11.68, 'lng': 76.13,
        'disaster_type': 'Flood', 'severity': 'critical',
        'duration': '15 days', 'year': 2018, 'date': '2018-08-15',
        'info': 'Kerala received abnormally high rainfall during the monsoon, forcing the opening of 35 dams and triggering devastating floods and landslides across all 14 districts.',
        'population': 320000, 'affected_count': 98000,
        'need_medical': 90, 'need_food': 85, 'need_shelter': 95, 'need_rescue': 85
    },
    {
        'title': '2019 Cyclone Fani',
        'state': 'Odisha', 'district': 'Puri',
        'lat': 19.81, 'lng': 85.83,
        'disaster_type': 'Cyclone', 'severity': 'high',
        'duration': '5 days', 'year': 2019, 'date': '2019-05-03',
        'info': 'Extremely severe cyclonic storm Fani made landfall near Puri, causing severe destruction to power lines, homes, and agriculture across coastal Odisha.',
        'population': 200000, 'affected_count': 65000,
        'need_medical': 70, 'need_food': 85, 'need_shelter': 85, 'need_rescue': 55
    },
    {
        'title': '2020 Cyclone Amphan',
        'state': 'West Bengal', 'district': 'South 24 Parganas',
        'lat': 22.13, 'lng': 88.66,
        'disaster_type': 'Cyclone', 'severity': 'high',
        'duration': '3 days', 'year': 2020, 'date': '2020-05-20',
        'info': 'Super Cyclone Amphan hit coastal West Bengal, causing catastrophic wind and tidal surge damage to the Sunderbans delta, Kolkata, and surrounding regions.',
        'population': 280000, 'affected_count': 82000,
        'need_medical': 80, 'need_food': 85, 'need_shelter': 90, 'need_rescue': 60
    },
    {
        'title': '2021 Uttarakhand Flood',
        'state': 'Uttarakhand', 'district': 'Chamoli',
        'lat': 30.41, 'lng': 79.33,
        'disaster_type': 'Flood', 'severity': 'high',
        'duration': '2 days', 'year': 2021, 'date': '2021-02-07',
        'info': 'A glacial breach triggered flash flooding in the Rishiganga and Dhauliganga rivers, destroying hydroelectric dams and causing severe rescue challenges in Chamoli district.',
        'population': 35000, 'affected_count': 2200,
        'need_medical': 75, 'need_food': 60, 'need_shelter': 70, 'need_rescue': 80
    }
]

zones = []
for item in kaggle_disasters:
    # Compute relative coordinates based on true lat/lng
    cx, cy = latlng_to_coord(item['lat'], item['lng'])
    z = Zone.objects.create(
        name=f"{item['district']} — {item['title']}",
        disaster_type=item['disaster_type'],
        severity=item['severity'],
        state=item['state'],
        district=item['district'],
        data_source="Kaggle India Disasters Dataset (1990-2021)",
        population=item['population'],
        affected_count=item['affected_count'],
        coord_x=cx,
        coord_y=cy,
        need_medical=item['need_medical'],
        need_food=item['need_food'],
        need_shelter=item['need_shelter'],
        need_rescue=item['need_rescue'],
        reported_at=timezone.now() - timedelta(days=random.randint(1, 30))
    )
    zones.append(z)
    print(f"   ✓ Zone Mapped: {z.name} (Priority Score: {z.priority_score})")

# ── Resources ─────────────────────────────────────────────────────────────────
# NDRF Regional Base camps & Deployed configurations
resources_data = [
    {'name': 'NDRF Medical Unit North', 'resource_type': 'medical', 'status': 'deployed', 'zone': zones[9], 'capacity': 500, 'utilized': 420, 'location': 'Rudraprayag (Kedarnath)'},
    {'name': 'NDRF Rescue Team North', 'resource_type': 'rescue', 'status': 'deployed', 'zone': zones[9], 'capacity': 100, 'utilized': 95, 'location': 'Rudraprayag (Kedarnath)'},
    {'name': 'NDRF Medical Unit West', 'resource_type': 'medical', 'status': 'deployed', 'zone': zones[2], 'capacity': 400, 'utilized': 380, 'location': 'Kutch (Bhuj)'},
    {'name': 'NDRF Rescue Team West', 'resource_type': 'rescue', 'status': 'deployed', 'zone': zones[2], 'capacity': 120, 'utilized': 110, 'location': 'Kutch (Bhuj)'},
    {'name': 'NDRF Food Supply East', 'resource_type': 'food', 'status': 'deployed', 'zone': zones[1], 'capacity': 10000, 'utilized': 8500, 'location': 'Jagatsinghpur (Odisha)'},
    {'name': 'NDRF Shelter Unit South', 'resource_type': 'shelter', 'status': 'deployed', 'zone': zones[12], 'capacity': 1000, 'utilized': 920, 'location': 'Wayanad (Kerala)'},
    {'name': 'NDRF Rescue Team South', 'resource_type': 'rescue', 'status': 'deployed', 'zone': zones[12], 'capacity': 80, 'utilized': 75, 'location': 'Wayanad (Kerala)'},
    # Standby base camps
    {'name': 'NDRF Medical Unit Standby', 'resource_type': 'medical', 'status': 'standby', 'zone': None, 'capacity': 300, 'utilized': 0, 'location': 'Base Camp — Ghaziabad'},
    {'name': 'NDRF Rescue Team Standby', 'resource_type': 'rescue', 'status': 'standby', 'zone': None, 'capacity': 100, 'utilized': 0, 'location': 'Base Camp — Pune'},
    {'name': 'NDRF Food Supply Standby', 'resource_type': 'food', 'status': 'standby', 'zone': None, 'capacity': 20000, 'utilized': 0, 'location': 'Base Camp — Patna'},
    {'name': 'NDRF Shelter Unit Standby', 'resource_type': 'shelter', 'status': 'standby', 'zone': None, 'capacity': 1500, 'utilized': 0, 'location': 'Base Camp — Cuttack'},
]

resources = []
for rd in resources_data:
    zone = rd.pop('zone')
    r = Resource.objects.create(assigned_zone=zone, **rd)
    resources.append(r)
    print(f"   ✓ Resource Registered: {r.name} ({r.status})")

# ── Alerts ─────────────────────────────────────────────────────────────────────
alerts_data = [
    {'alert_type': 'critical', 'message': 'Kedarnath: Landslide warning active in valley sectors', 'zone': zones[9], 'acknowledged': False},
    {'alert_type': 'warning', 'message': 'Kerala: Emergency dam gates opening warning issued', 'zone': zones[12], 'acknowledged': False},
    {'alert_type': 'info', 'message': 'Bhuj: Structural safety assessments completed for Ward 4', 'zone': zones[2], 'acknowledged': True},
    {'alert_type': 'warning', 'message': 'Sundarbans: Coastal surge flooding alerts broadcast', 'zone': zones[14], 'acknowledged': False},
]

for ad in alerts_data:
    a = Alert.objects.create(**ad)
    print(f"   ✓ Alert Generated: [{a.alert_type}] {a.message[:45]}...")

# ── Emergency Reports ──────────────────────────────────────────────────────────
# Mapped to real Kaggle disasters descriptions/metadata
reports_data = [
    {
        'location': 'Kedarnath Valley',
        'disaster_type': 'Flood',
        'severity': 'critical',
        'people_affected': 95000,
        'description': 'Catastrophic cloudburst and flooding around the Kedarnath temple. Thousands stranded in higher reaches.',
        'reporter_name': 'Uttarakhand Disaster Response',
        'status': 'allocated',
        'zone': zones[9]
    },
    {
        'location': 'Bhuj Town Center',
        'disaster_type': 'Earthquake',
        'severity': 'critical',
        'people_affected': 85000,
        'description': 'Massive collapse of residential structures. Severe search & rescue operations required.',
        'reporter_name': 'District Collector Kutch',
        'status': 'allocated',
        'zone': zones[2]
    },
    {
        'location': 'Wayanad Hill Outposts',
        'disaster_type': 'Flood',
        'severity': 'high',
        'people_affected': 1800,
        'description': 'Heavy runoffs triggering massive debris flows. Blockages reported on state highway.',
        'reporter_name': 'Kerala Fire Service',
        'is_voicebot': True,
        'voicebot_transcript': 'Landslide blocking roads in Wayanad, around 1800 people cut off from resources',
        'status': 'pending',
        'zone': zones[12]
    },
]

for rd in reports_data:
    r = EmergencyReport.objects.create(**rd)
    print(f"   ✓ Report Ingested: {r.disaster_type} at {r.location} (Score: {r.ai_priority_score})")

print("\n✅ Database seeded successfully with real Kaggle India Disaster Dataset!")
print(f"   Mapped Disaster Zones: {Zone.objects.count()}")
print(f"   Registered Resources:  {Resource.objects.count()}")
print(f"   Active Alerts:         {Alert.objects.count()}")
print(f"   Incident Reports:      {EmergencyReport.objects.count()}")

