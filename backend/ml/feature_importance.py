import joblib
import matplotlib.pyplot as plt

model = joblib.load("models/disruption_model.pkl")

features = [
    "rainfall",
    "AQI",
    "traffic_speed",
    "current_dai",
    "future_dai"
]

importances = model.feature_importances_

plt.bar(features, importances)
plt.title("Feature Importance")
plt.xticks(rotation=45)
plt.show()