"""Confusion matrix visualization for the disruption classifier.

Run this script directly from the backend directory:
    python -m ml.confusion_matrix

Feature names must match the pipeline.py training columns exactly.
"""

if __name__ == "__main__":
    import joblib
    import matplotlib.pyplot as plt
    import pandas as pd
    from pathlib import Path
    from sklearn.metrics import ConfusionMatrixDisplay
    from sklearn.model_selection import train_test_split

    from ml.pipeline import MODEL_1_FEATURES, MODEL_2_FEATURES

    DATA_DIR = Path(__file__).resolve().parent / "datasets"
    MODEL_DIR = Path(__file__).resolve().parent / "models"

    df = pd.read_csv(DATA_DIR / "training_data.csv")

    # Build Model 2 test set using the same construction as pipeline.py
    # (Model 2 needs predicted_dai from Model 1 as a feature)
    model1 = joblib.load(MODEL_DIR / "dai_predictor.pkl")
    m1_cols = [c for c in MODEL_1_FEATURES if c in df.columns]
    m2_base = [c for c in MODEL_2_FEATURES if c != "predicted_dai" and c in df.columns]

    X2 = df[m2_base].copy()
    X2["predicted_dai"] = model1.predict(df[m1_cols])
    X2 = X2.reindex(columns=MODEL_2_FEATURES, fill_value=0.0)
    y = df["disruption"]

    _, X_test, _, y_test = train_test_split(X2, y, test_size=0.2, random_state=42)

    model2 = joblib.load(MODEL_DIR / "disruption_model.pkl")
    pred = model2.predict(X_test)

    ConfusionMatrixDisplay.from_predictions(y_test, pred, display_labels=["Normal", "Disruption"])
    plt.title("Disruption Model — Confusion Matrix")
    plt.tight_layout()
    plt.show()