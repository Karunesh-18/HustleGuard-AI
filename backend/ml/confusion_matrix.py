"""Confusion matrix visualization for the disruption classifier.

Run this script directly to generate the confusion matrix plot:
    python backend/ml/confusion_matrix.py
"""

if __name__ == "__main__":
    import joblib
    import matplotlib.pyplot as plt
    import pandas as pd
    from sklearn.metrics import ConfusionMatrixDisplay
    from sklearn.model_selection import train_test_split
    from pathlib import Path

    DATA_DIR = Path(__file__).resolve().parent / "datasets"
    MODEL_DIR = Path(__file__).resolve().parent / "models"

    df = pd.read_csv(DATA_DIR / "training_data.csv")

    X = df[["rainfall", "AQI", "traffic_speed", "current_dai", "future_dai"]]
    y = df["disruption"]

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = joblib.load(MODEL_DIR / "disruption_model.pkl")
    pred = model.predict(X_test)

    ConfusionMatrixDisplay.from_predictions(y_test, pred)
    plt.title("Disruption Model — Confusion Matrix")
    plt.tight_layout()
    plt.show()