"""External real-time data adapters for HustleGuard AI.

Each adapter fetches from a live API and returns None on any failure so
that callers can gracefully fall back to the simulation layer.

Available adapters:
  weather_adapter   — OpenWeatherMap (primary) + WeatherAPI (backup)
  aqi_adapter       — AQICN / WAQI geolocalized feed
  traffic_adapter   — Google Maps Routes API for road speed
  news_adapter      — NewsAPI for government & disaster alerts
  ip_adapter        — ipapi.co for IP geolocation (fraud gate)
"""
