# HustleGuard AI – Machine Learning Pipeline

This document defines the machine learning architecture used in HustleGuard AI.

It is intended for developers and AI coding agents responsible for building the ML components.

## Overview

HustleGuard AI uses a **two-stage machine learning pipeline** to predict delivery disruptions and support insurance decisions.

The pipeline predicts:

1. **Future Delivery Activity Index (DAI)** – Regression model
2. **Disruption Probability** – Classification model

The output is used by the insurance engine to trigger payouts.

## ML Pipeline Architecture

```
Environmental + Platform Data
         │
         ▼
Model 1: Future DAI Prediction (Regression)
         │
    Predicted Future DAI
         │
         ▼
Model 2: Disruption Risk Prediction (Classification)
         │
         ▼
    Disruption Probability
         │
         ▼
Insurance Decision Engine
```

---

## Model 1 – Delivery Activity Prediction

### Objective

Predict the future Delivery Activity Index (DAI) for a zone.

**Example:**
- Current DAI = 0.72  
- Predicted DAI (30 minutes later) = 0.35
- Low predicted DAI indicates potential disruption.

### Problem Type

Regression

### Features

**Environmental Features:**
- Rainfall
- Temperature
- Wind speed
- Air quality index (AQI)

**Traffic Features:**
- Average traffic speed
- Congestion index

**Platform Features:**
- orders_last_5min
- orders_last_15min
- active_riders
- average_delivery_time

**Temporal Features:**
- hour_of_day
- day_of_week

### Target Variable

`future_dai`

### Recommended Model

- **Primary:** RandomForestRegressor
- **Alternative:** XGBoost Regressor

### Training Example

Example dataset row:

| rainfall | AQI | orders_last_5min | riders | traffic_speed | future_dai |
|----------|-----|-----------------|--------|---------------|------------|
| 10       | 80  | 120             | 50     | 35            | 0.95       |
| 85       | 110 | 40              | 20     | 10            | 0.28       |
| 0        | 420 | 50              | 25     | 30            | 0.33       |

### Training Code Example

```python
from sklearn.ensemble import RandomForestRegressor

model = RandomForestRegressor()
model.fit(X_train, y_train)

predicted_dai = model.predict(X_test)
```

---

## Model 2 – Disruption Risk Prediction

### Objective

Predict the probability that a zone will experience disruption.

**Example output:** Disruption Probability = 0.82

### Problem Type

Binary classification

**Output labels:**
- `0` = normal
- `1` = disruption

### Features

**Environmental:**
- Rainfall
- AQI
- Wind speed

**Traffic:**
- traffic_speed
- congestion_index

**Platform:**
- current_dai
- predicted_dai

**Zone Risk:**
- historical_disruption_frequency
- zone_risk_score

### Recommended Model

- **Primary:** RandomForestClassifier
- **Alternative:** XGBoost

### Training Dataset Example

| rain | AQI | traffic_speed | current_dai | predicted_dai | disruption |
|------|-----|---------------|-------------|---------------|------------|
| 92   | 120 | 12            | 0.41        | 0.28          | 1          |
| 5    | 80  | 32            | 0.91        | 0.88          | 0          |

### Training Code Example

```python
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier()
model.fit(X_train, y_train)

predictions = model.predict(X_test)
```

---

## Dataset Strategy

Since delivery platform data is private, the dataset will be built using a hybrid approach.

**Sources:**
- Historical environmental data
- Simulated delivery ecosystem data

**Simulated data includes:**
- Orders per hour
- Rider activity
- Delivery times

Simulation allows generation of large training datasets.

### Dataset Size

**Recommended training size:** 20,000 – 50,000 rows

**Generated using:**
- 100 zones
- 24 hour simulation
- 30 days of activity

---

## Evaluation Metrics

### Model 1 – DAI Regression

**Metrics:**
- Mean Absolute Error (MAE)
- Root Mean Square Error (RMSE)
- R² score

**Example results:**
- RMSE = 0.08
- R² = 0.91

### Model 2 – Disruption Classification

**Metrics:**
- Accuracy
- Precision
- Recall
- F1 Score

**Example:**
- Accuracy = 92%
- Precision = 0.91
- Recall = 0.89

---

## Feature Importance

Random Forest models allow feature importance analysis.

**Example importance scores:**

| Feature       | Importance |
|---------------|------------|
| DAI           | 0.42       |
| Rainfall      | 0.31       |
| AQI           | 0.15       |
| Traffic Speed | 0.12       |

This helps explain model decisions.

---

## Model Integration

The ML models run inside the backend monitoring pipeline.

**Flow:**

```
External APIs (Weather, AQI, Traffic)
         │
         ▼
  Feature Extraction
         │
         ▼
Model 1 → Predict Future DAI
         │
         ▼
Model 2 → Predict Disruption Probability
         │
         ▼
Insurance Decision Engine
```

---

## Celery Integration

ML predictions run in background tasks.

**Example pipeline:**
1. Fetch environmental data
2. Compute current DAI
3. Run DAI prediction model
4. Run disruption classification model
5. Trigger insurance logic

---

## ML Project Structure

Add the following folder structure:

```
ml/
├── datasets/
├── notebooks/
│   └── training.ipynb
├── models/
│   ├── dai_predictor.pkl
│   └── disruption_model.pkl
├── pipeline.py
└── predict.py
```

---

## Model Saving

Models should be saved using joblib.

**Example:**

```python
import joblib

joblib.dump(model, "models/disruption_model.pkl")
```

---

## Prediction API

Expose prediction endpoint:

**Endpoint:** `POST /predict-disruption`

### Required input fields

- `rainfall` (float, >= 0)
- `AQI` (float, >= 0)
- `traffic_speed` (float, >= 0)
- `current_dai` (float, 0 to 1)

### Optional input fields (defaults are applied)

- `temperature` (default: 30.0)
- `wind_speed` (default: 10.0)
- `congestion_index` (default: 0.5)
- `orders_last_5min` (default: 70.0)
- `orders_last_15min` (default: 190.0)
- `active_riders` (default: 45.0)
- `average_delivery_time` (default: 24.0)
- `hour_of_day` (default: current UTC hour)
- `day_of_week` (default: current UTC weekday)
- `historical_disruption_frequency` (default: 0.25)
- `zone_risk_score` (default: 0.30)

**Input example:**

```json
{
  "rainfall": 92,
  "AQI": 110,
  "traffic_speed": 12,
  "current_dai": 0.41
}
```

**Output example:**

```json
{
  "predicted_dai": 0.29,
  "disruption_probability": 0.81,
  "risk_label": "high"
}
```

**Risk label mapping:**
- `high` when probability >= 0.75
- `moderate` when probability >= 0.45 and < 0.75
- `normal` when probability < 0.45

## Implementation Notes

- Models are loaded lazily on first prediction call.
- If model files are missing, synthetic training runs automatically and model files are persisted.
- Saved model files:
  - `backend/ml/models/dai_predictor.pkl`
  - `backend/ml/models/disruption_model.pkl`

---

## Future ML Improvements

Possible future models:

1. **Fraud Detection Model** – Isolation Forest
2. **Dynamic Premium Prediction** – Regression model predicting risk score
3. **Worker Reliability Scoring** – Behavioral ML model