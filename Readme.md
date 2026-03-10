# HustleGuard AI

**Predict. Protect. Pay.**

AI-powered parametric income protection for gig delivery workers.

Built for **Guidewire DEVTrails Hackathon 2026**.

## Overview

HustleGuard AI is an AI-powered parametric insurance platform designed to protect gig delivery workers from income loss caused by external disruptions such as:

- extreme weather
- hazardous pollution
- traffic gridlock
- government restrictions

Food delivery ecosystems such as Swiggy and Zomato rely on millions of gig workers who earn income per completed delivery. When external conditions prevent deliveries from happening, riders immediately lose income with no financial safety net.

HustleGuard AI solves this by introducing weekly micro-insurance with intelligent disruption monitoring and automatic payouts.

The platform continuously monitors environmental signals and operational data across delivery zones. When disruptions significantly reduce delivery activity, the system compensates affected workers automatically.

Unlike traditional insurance, HustleGuard AI uses **parametric triggers**, meaning payouts occur automatically when predefined measurable conditions are met.

- No paperwork
- No claim filing
- No delays

## Problem Statement

Gig delivery workers operate in unpredictable environments. External disruptions such as the following can suddenly halt delivery operations:

- heavy rain
- flooding
- extreme heat
- hazardous air quality
- traffic shutdowns
- curfews or strikes

When this happens:

- riders cannot complete deliveries
- platforms lose operational capacity
- workers lose daily income

Traditional insurance products focus on health, life, or vehicle protection, but they do not cover short-term income disruptions caused by environmental conditions.

HustleGuard AI introduces a parametric insurance model specifically designed for gig workers, with fast and automated income protection.

## Target Persona

### Food Delivery Riders (Swiggy / Zomato)

Food delivery riders operate in hyper-local city zones where income depends on:

- number of deliveries completed
- demand in the area
- environmental conditions

Typical rider profile:

| Metric | Value |
| --- | --- |
| Average earnings per delivery | `INR 20-INR 40` |
| Daily deliveries | `15-25` |
| Daily income | `INR 800-INR 1500` |

Disruptions like heavy rain or flooding can reduce order availability by `30-70%`, causing major income loss.

HustleGuard AI protects riders by automatically compensating them when disruptions prevent deliveries.

## Core Idea

HustleGuard AI combines prediction, prevention, and insurance compensation.

The system introduces a **Disruption Intelligence Engine** that continuously analyzes real-world signals and calculates whether delivery work is feasible in a specific zone.

When disruptions occur, the platform automatically triggers insurance payouts.

HustleGuard goes beyond simple payouts. The system also:

- predicts disruptions
- redirects workers to safer zones
- stabilizes income before loss occurs

This creates value for both workers and insurance providers.

## Key Features

### 1. Hyperlocal Disruption Detection

Cities are divided into delivery zones. Each zone is monitored using external signals such as:

- weather conditions
- air quality levels
- traffic congestion
- government alerts
- disaster news

Example:

| Zone | Rainfall |
| --- | --- |
| Koramangala | `92 mm` |
| Indiranagar | `22 mm` |

Only riders operating in affected zones receive payouts.

### 2. Delivery Activity Index (DAI)

HustleGuard introduces a unique metric called the **Delivery Activity Index (DAI)**.

DAI measures how active deliveries are compared to normal conditions:

```text
DAI = Current Delivery Activity / Normal Delivery Activity
```

Delivery activity indicators include:

- orders per hour
- number of active riders
- average delivery time

Example:

| Metric | Normal | Current |
| --- | --- | --- |
| Orders/hour | `120` | `35` |
| Active riders | `50` | `30` |

`DAI = 0.32`

A sharp drop in DAI indicates ecosystem disruption.

### 3. Multi-Signal Disruption Confirmation

To avoid false triggers, HustleGuard confirms disruptions using multiple signals.

Example trigger condition:

```text
Rainfall > 80 mm
AND
Delivery Activity Index < 40%
```

This ensures payouts only occur during real operational disruptions.

### 4. Workability Score

HustleGuard calculates a **Workability Score (0-100)** for each delivery zone.

Factors considered:

- rainfall severity
- air quality index
- traffic congestion
- delivery activity levels
- disaster alerts

| Score | Meaning |
| --- | --- |
| `80-100` | Normal conditions |
| `50-80` | Moderate disruption |
| `0-50` | Work not feasible |

When the score falls below a defined threshold, payouts are triggered.

### 5. Disruption Prediction and Worker Redirection

HustleGuard AI predicts disruptions before they occur.

Example:

- Heavy rain forecast in Zone A
- System recommendation: move to Zone B
- Expected order density: `+25%`

This allows workers to continue earning and reduces insurance claims.

### 6. AI Risk Pricing

Weekly premiums are dynamically calculated based on zone risk.

Factors include:

- historical weather patterns
- flood zone data
- pollution frequency
- past disruptions
- delivery density

Example:

| City | Risk Level | Weekly Premium |
| --- | --- | --- |
| Mumbai | High | `INR 40` |
| Bangalore | Medium | `INR 30` |
| Hyderabad | Low | `INR 20` |

### 7. Worker Reliability Score

HustleGuard builds a financial reliability score for gig workers.

Score range: `0-100`

Factors include:

- delivery consistency
- active hours
- claim behavior
- fraud risk
- operational stability

Benefits:

| Score | Benefit |
| --- | --- |
| High score | lower premiums |
| Medium score | normal pricing |
| Low score | fraud monitoring |

This creates a financial identity for gig workers.

### 8. Automatic Parametric Claims

When disruption conditions are confirmed:

- external event detected
- zone disruption verified
- eligible riders identified
- income loss estimated
- payout triggered automatically

Example:

| Event | Trigger | Payout |
| --- | --- | --- |
| Heavy Rain | `Rain > 80 mm` | `INR 300` |
| Severe Pollution | `AQI > 400` | `INR 200` |
| Government Curfew | `Official Alert` | `INR 500` |

### 9. Fraud Detection Engine

Fraud protection mechanisms include:

- GPS location verification
- zone validation
- duplicate claim detection
- fake disruption filtering

Example:

If a rider claims disruption but the Delivery Activity Index remains normal, the payout is rejected.

## System Architecture

```text
External Data Sources
(Weather API | AQI API | Traffic API | News Scraper)
        -> Disruption Detection Engine
        -> Hyperlocal Zone Mapping
        -> Delivery Activity Index Engine
        -> Workability Score Model
        -> AI Risk Pricing Engine
        -> Fraud Detection System
        -> Parametric Insurance Engine
        -> Automatic Payout System
```

## Technology Stack

### Frontend

- Next.js
- React
- Tailwind CSS
- Recharts (analytics dashboards)
- Leaflet / Mapbox (disruption maps)

### Backend

- FastAPI
- Python
- Pydantic
- Uvicorn

### Database

- PostgreSQL
- Optional: PostGIS (geospatial queries)

### AI and Data Processing

- Pandas
- NumPy
- Scikit-learn

Used for:

- risk prediction
- disruption detection
- anomaly detection

### Background Processing

- Redis
- Celery / scheduled workers

Used for:

- monitoring APIs
- recalculating disruption scores
- triggering payouts

### External APIs

- OpenWeatherMap API
- AQI API
- Google Maps Traffic API
- News API
- custom web scraper

### Payments

- Razorpay Sandbox (simulated payouts)

## User Workflow

### 1. Rider Onboarding

- rider registers
- location verified
- risk profile generated

### 2. Insurance Subscription

- weekly plan selected
- premium calculated
- policy activated

### 3. Disruption Monitoring

System continuously monitors:

- weather
- pollution
- delivery activity
- public alerts

### 4. Automatic Payout

When disruption occurs:

- claim triggered automatically
- payout credited instantly

## Dashboard

### Worker Dashboard

Riders can view:

- coverage status
- earnings protected
- payout history
- disruption alerts
- income forecast

### Admin Dashboard

Admins can monitor:

- disruption heatmaps
- claim statistics
- fraud alerts
- risk analytics

### Income Forecast Dashboard

Workers receive an estimated income range for the week.

Example:

```text
Expected Weekly Earnings: INR 5200-INR 6300
Risk Level: Medium
Insurance Coverage: Active
```

This helps riders make better operational decisions.

## Scalability

HustleGuard AI is designed to scale across cities and delivery platforms.

Future expansions:

- integration with delivery platforms
- real-time rider telemetry
- predictive disruption modeling
- gig-economy financial services

## Hackathon Compliance

This project follows all competition rules:

- Covers income loss only
- Uses parametric insurance triggers
- Implements weekly subscription pricing
- Focuses on one persona (food delivery riders)
- Includes AI risk pricing and fraud detection
- Demonstrates automated claims and payouts

## Future Vision

HustleGuard AI can evolve into a full gig-economy financial protection platform, providing insurance, credit scoring, and income stabilization for millions of workers across food delivery, grocery logistics, and e-commerce fulfillment.

The long-term goal is to create financial resilience for gig workers while enabling insurers to manage risk using real-time data intelligence.
