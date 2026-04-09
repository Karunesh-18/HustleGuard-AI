"""Model evaluation script for the disruption classifier.

Run from the backend directory:
    python -m ml.evaluate_models

Uses the canonical feature names defined in ml.pipeline so the
evaluation matches what the model was actually trained on.
"""

if __name__ == "__main__":
    import joblib
    import pandas as pd
    from pathlib import Path
    from sklearn.metrics import accuracy_score, classification_report
    from sklearn.model_selection import train_test_split

    # Import the exact feature lists the models were trained with
    from ml.pipeline import MODEL_1_FEATURES, MODEL_2_FEATURES

    DATA_DIR = Path(__file__).resolve().parent / "datasets"
    MODEL_DIR = Path(__file__).resolve().parent / "models"

    df = pd.read_csv(DATA_DIR / "training_data.csv")

    # ── Model 1 evaluation (DAI regression) ──────────────────────────────────
    print("\n=== Model 1: DAI Regressor ===")
    from sklearn.metrics import mean_absolute_error, r2_score

    m1_cols = [c for c in MODEL_1_FEATURES if c in df.columns]
    missing_m1 = [c for c in MODEL_1_FEATURES if c not in df.columns]
    if missing_m1:
        print(f"WARNING: Missing Model 1 columns in dataset: {missing_m1}")

    X1 = df[m1_cols]
    y1 = df["future_dai"]
    X1_train, X1_test, y1_train, y1_test = train_test_split(X1, y1, test_size=0.2, random_state=42)

    model1 = joblib.load(MODEL_DIR / "dai_predictor.pkl")
    pred1 = model1.predict(X1_test)
    print(f"R²  : {r2_score(y1_test, pred1):.4f}")
    print(f"MAE : {mean_absolute_error(y1_test, pred1):.4f}")

    # ── Model 2 evaluation (disruption classifier) ────────────────────────────
    print("\n=== Model 2: Disruption Classifier ===")

    # Build Model 2 features: same approach as pipeline.py
    m2_base = [c for c in MODEL_2_FEATURES if c != "predicted_dai" and c in df.columns]
    missing_m2 = [c for c in MODEL_2_FEATURES if c not in df.columns and c != "predicted_dai"]
    if missing_m2:
        print(f"WARNING: Missing Model 2 columns in dataset: {missing_m2}")

    X2 = df[m2_base].copy()
    X2["predicted_dai"] = model1.predict(df[m1_cols])
    X2 = X2.reindex(columns=MODEL_2_FEATURES, fill_value=0.0)
    y2 = df["disruption"]

    _, X2_test, _, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42)

    model2 = joblib.load(MODEL_DIR / "disruption_model.pkl")
    pred2 = model2.predict(X2_test)
    print(f"Accuracy: {accuracy_score(y2_test, pred2):.4f}")
    print(classification_report(y2_test, pred2))