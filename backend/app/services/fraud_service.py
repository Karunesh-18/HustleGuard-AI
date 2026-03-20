from app.schemas import FraudEvaluationRequest, FraudEvaluationResponse, FraudSignalBreakdown


def _clamp_score(score: float) -> float:
    return max(0.0, min(100.0, score))


def evaluate_fraud_risk(payload: FraudEvaluationRequest) -> FraudEvaluationResponse:
    reasons: list[str] = []

    environmental = 100.0
    if payload.rainfall < 20 and payload.zone_dai < 0.45:
        environmental -= 40
        reasons.append("Low rainfall conflicts with severe disruption pattern.")
    if payload.aqi < 120 and payload.zone_dai < 0.45:
        environmental -= 20
        reasons.append("AQI does not support high-disruption claim.")
    if payload.traffic_speed > 30 and payload.zone_dai < 0.45:
        environmental -= 20
        reasons.append("Traffic speed appears too normal for claimed disruption.")

    dai_zone = 100.0
    if payload.zone_dai >= 0.7:
        dai_zone -= 70
        reasons.append("Zone DAI is normal despite disruption claim.")
    elif payload.zone_dai >= 0.55:
        dai_zone -= 35
        reasons.append("Zone DAI indicates only mild disruption.")

    behavioral = 100.0
    if payload.historical_zone_visits == 0:
        behavioral -= 45
        reasons.append("No prior activity in claimed zone.")
    if payload.claim_count_last_30_days >= 8:
        behavioral -= 35
        reasons.append("Unusually high claim frequency in last 30 days.")

    motion = 100.0
    speed_km_per_min = payload.teleport_distance_km / payload.teleport_time_minutes
    if speed_km_per_min > 0.8:
        motion -= 70
        reasons.append("Movement velocity indicates potential teleportation/spoofing.")
    elif speed_km_per_min > 0.5:
        motion -= 35
        reasons.append("Movement profile appears improbable.")

    ip_network = 100.0
    if payload.city_from_gps.strip().lower() != payload.city_from_ip.strip().lower():
        ip_network -= 45
        reasons.append("GPS city and IP city mismatch detected.")
    if payload.subnet_cluster_size >= 20:
        ip_network -= 25
        reasons.append("Large subnet cluster suggests coordinated origin.")

    peer_safety = 100.0
    if payload.peer_claims_last_15m >= 100:
        peer_safety -= 75
        reasons.append("High synchronized claim burst detected.")
    elif payload.peer_claims_last_15m >= 40:
        peer_safety -= 40
        reasons.append("Moderate synchronized claim pattern detected.")

    if payload.mock_location_detected:
        motion -= 30
        ip_network -= 20
        reasons.append("Mock location signal detected.")
    if payload.developer_mode_enabled:
        ip_network -= 10
        reasons.append("Developer mode enabled; elevated spoofing risk.")
    if payload.rooted_or_emulator:
        motion -= 20
        ip_network -= 20
        reasons.append("Rooted/emulator environment detected.")

    environmental = _clamp_score(environmental)
    dai_zone = _clamp_score(dai_zone)
    behavioral = _clamp_score(behavioral)
    motion = _clamp_score(motion)
    ip_network = _clamp_score(ip_network)
    peer_safety = _clamp_score(peer_safety)

    trust_score = (
        0.25 * environmental
        + 0.25 * dai_zone
        + 0.15 * behavioral
        + 0.15 * motion
        + 0.10 * ip_network
        + 0.10 * peer_safety
    )
    trust_score = _clamp_score(trust_score)

    if trust_score >= 80:
        decision_band = "green"
        decision = "instant_payout"
    elif trust_score >= 55:
        decision_band = "yellow"
        decision = "provisional_payout_with_review"
    elif trust_score >= 35:
        decision_band = "orange"
        decision = "manual_review_required"
    else:
        decision_band = "red"
        decision = "hold_or_reject"

    if not reasons:
        reasons.append("Signals are broadly consistent with a genuine disruption.")

    return FraudEvaluationResponse(
        trust_score=round(trust_score, 2),
        decision_band=decision_band,
        decision=decision,
        reasons=reasons,
        signal_breakdown=FraudSignalBreakdown(
            environmental_consistency=round(environmental, 2),
            dai_zone_consistency=round(dai_zone, 2),
            behavioral_continuity=round(behavioral, 2),
            motion_realism=round(motion, 2),
            ip_network_consistency=round(ip_network, 2),
            peer_coordination_safety=round(peer_safety, 2),
        ),
    )