"""
SDRAS AI Engine — Priority Scoring & Resource Recommendation
"""


def compute_zone_priority(zone):
    """
    Priority Score Formula:
    - Need Index (avg of medical/food/shelter/rescue): 40%
    - Affected Population Ratio: 30%
    - Severity Weight: 30%
    Returns score 0-100
    """
    severity_weight = {'critical': 1.0, 'high': 0.75, 'medium': 0.5, 'low': 0.25}
    need_avg = (zone.need_medical + zone.need_rescue + zone.need_food + zone.need_shelter) / 4
    affected_ratio = (zone.affected_count / zone.population * 100) if zone.population > 0 else 0
    sev = severity_weight.get(zone.severity, 0.5)
    score = (need_avg * 0.4) + (affected_ratio * 0.3) + (sev * 100 * 0.3)
    return min(100, round(score, 1))


def recommend_resources(zone, available_resources):
    """
    Given a zone and list of standby resources,
    return a list of recommendation dicts.
    """
    recs = []
    score = compute_zone_priority(zone)

    resource_list = list(available_resources)

    # Medical
    if zone.need_medical > 60:
        med = next((r for r in resource_list if r.resource_type == 'medical'), None)
        if med:
            urgency = 'immediate' if zone.need_medical >= 85 else 'high'
            recs.append({
                'resource_id': med.id,
                'resource_name': med.name,
                'resource_type': 'medical',
                'urgency': urgency,
                'reason': f"Medical need at {zone.need_medical}% — threshold exceeded",
                'priority_score': score,
            })

    # Rescue
    if zone.need_rescue > 55:
        res = next((r for r in resource_list if r.resource_type == 'rescue'), None)
        if res:
            urgency = 'immediate' if zone.need_rescue >= 80 else 'high'
            recs.append({
                'resource_id': res.id,
                'resource_name': res.name,
                'resource_type': 'rescue',
                'urgency': urgency,
                'reason': f"Rescue need at {zone.need_rescue}% — {zone.affected_count:,} people at risk",
                'priority_score': score,
            })

    # Food
    if zone.need_food > 60:
        food = next((r for r in resource_list if r.resource_type == 'food'), None)
        if food:
            recs.append({
                'resource_id': food.id,
                'resource_name': food.name,
                'resource_type': 'food',
                'urgency': 'high',
                'reason': f"Food/water supply at {zone.need_food}% — supply critical",
                'priority_score': score,
            })

    # Shelter
    if zone.need_shelter > 65:
        shelter = next((r for r in resource_list if r.resource_type == 'shelter'), None)
        if shelter:
            recs.append({
                'resource_id': shelter.id,
                'resource_name': shelter.name,
                'resource_type': 'shelter',
                'urgency': 'high',
                'reason': f"Shelter need at {zone.need_shelter}% — displacement occurring",
                'priority_score': score,
            })

    return recs


def compute_report_priority(report):
    """Score an emergency report 0-100"""
    severity_weight = {'critical': 100, 'high': 75, 'medium': 50, 'low': 25}
    sev_score = severity_weight.get(report.severity, 50)
    people_score = min(100, (report.people_affected / 10000) * 100)
    score = (sev_score * 0.6) + (people_score * 0.4)
    return round(score, 1)
