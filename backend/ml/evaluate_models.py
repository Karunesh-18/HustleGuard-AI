import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

df = pd.read_csv("datasets/training_data.csv")

X = df[[
    "rainfall",
    "AQI",
    "traffic_speed",
    "current_dai",
    "future_dai"
]]

y = df["disruption"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = joblib.load("models/disruption_model.pkl")

pred = model.predict(X_test)

print("Accuracy:", accuracy_score(y_test, pred))
print(classification_report(y_test, pred))