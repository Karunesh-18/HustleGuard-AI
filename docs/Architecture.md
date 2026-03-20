# Architecture

This document describes the technical architecture of HustleGuard AI.

It is intended for developers and AI coding agents contributing to the project.

## Overview

HustleGuard AI is a parametric insurance platform that protects gig delivery workers from income loss caused by external disruptions.

The system continuously monitors:

- Weather conditions
- Air Quality Index (AQI)
- Traffic congestion
- Government alerts
- Delivery ecosystem activity

When disruptions significantly reduce delivery activity in a zone, the system automatically triggers insurance payouts.

## Core Idea

Traditional insurance requires manual claims.

HustleGuard uses **parametric triggers**.

Example trigger:

Rainfall > 80mm AND Delivery Activity Index < 40% → payout triggered

This enables:

- instant claim settlement
- transparent rules
- fraud-resistant payouts

## Technology Stack

## Frontend
- Next.js (TypeScript)
- TailwindCSS
- Leaflet.js (maps)
- Recharts (analytics)

## Backend
- FastAPI (Python)
- Celery (background workers)
- Redis (task queue)

## Database
- Neon PostgreSQL
- PostGIS extension for spatial queries

## APIs
- OpenWeather API
- AQI API
- Google Maps Traffic API
- News API

## High Level Architecture

```text
External Data Sources
│
├ Weather API
├ AQI API
├ Traffic API
└ News Alerts
│
▼
Disruption Detection Engine
│
▼
Delivery Activity Index Engine
│
▼
Risk Evaluation Engine
│
▼
Parametric Insurance Engine
│
▼
Automatic Payout System
│
▼
Worker Dashboard & Admin Dashboard
```

## Key Components

## Disruption Detection Engine

Monitors environmental signals every 5 minutes.

Signals monitored:

- rainfall
- air pollution
- traffic congestion
- emergency alerts

---

## Delivery Activity Index (DAI)

Measures delivery ecosystem activity.

Formula:

DAI = Current Orders / Expected Orders

Example:

Expected Orders = 120/hour  
Current Orders = 35/hour  

DAI = 35 / 120 = 0.29 (29%)

Low DAI indicates disruption.

---

## Fraud Detection System

Fraud checks include:

- GPS location validation
- zone verification
- duplicate claim detection
- abnormal activity detection

---

## Delivery Ecosystem Simulation

Since delivery platform APIs are unavailable, the system simulates:

- rider locations
- order generation
- delivery completion

Simulation allows controlled testing of disruptions.

## Background Monitoring

Monitoring tasks run every 5 minutes using Celery workers.

Responsibilities:

- fetch external data
- compute DAI
- detect disruptions
- trigger payouts

## Maps

Two map layers are used:

## Disruption Heatmap
Shows current disruption intensity.

Colors:

Green → normal  
Yellow → moderate disruption  
Red → severe disruption

## Insurance Risk Map
Displays zone insurance risk levels.

Risk is calculated from historical disruption data.

## Dashboard

## Worker Dashboard

Workers can view:

- active coverage
- disruption alerts
- payout history
- predicted earnings

## Admin Dashboard

Admins can monitor:

- disruption heatmaps
- claim analytics
- fraud alerts
- zone risk levels

## Deployment

Recommended deployment setup:

Frontend → Vercel  
Backend → FastAPI server  
Database → Neon PostgreSQL  
Queue → Redis  
Workers → Celery

## Design Principles

The system follows these principles:

- automation-first insurance
- multi-signal disruption detection
- hyperlocal risk modeling
- transparent claim triggers