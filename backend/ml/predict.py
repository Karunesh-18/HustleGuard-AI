from __future__ import annotations

import threading
from pathlib import Path

import joblib
import pandas as pd

from .pipeline import MODEL_1_FEATURES, MODEL_2_FEATURES, TrainedModels, train_pipeline_models

MODEL_DIR = Path(__file__).resolve().parent / "models"
DAI_MODEL_FILE = MODEL_DIR / "dai_predictor.pkl"
DISRUPTION_MODEL_FILE = MODEL_DIR / "disruption_model.pkl"


class ModelRegistry:
    def __init__(self) -> None:
        self._dai_model = None
        self._disruption_model = None
        # Lock prevents race condition when two concurrent requests both find
        # models unloaded and both attempt to trigger training simultaneously.
        self._lock = threading.Lock()

    def _load_or_train(self) -> None:
        # Fast path: both models already loaded (no lock needed)
        if self._dai_model is not None and self._disruption_model is not None:
            return

        with self._lock:
            # Double-checked locking: another thread may have loaded by now
            if self._dai_model is not None and self._disruption_model is not None:
                return

            MODEL_DIR.mkdir(parents=True, exist_ok=True)

            if DAI_MODEL_FILE.exists() and DISRUPTION_MODEL_FILE.exists():
                self._dai_model = joblib.load(DAI_MODEL_FILE)
                self._disruption_model = joblib.load(DISRUPTION_MODEL_FILE)
                return

            trained: TrainedModels = train_pipeline_models()
            self._dai_model = trained.dai_model
            self._disruption_model = trained.disruption_model

            joblib.dump(self._dai_model, DAI_MODEL_FILE)
            joblib.dump(self._disruption_model, DISRUPTION_MODEL_FILE)

    def predict(self, features: dict[str, float]) -> tuple[float, float]:
        self._load_or_train()

        model_1_input = pd.DataFrame([{name: features[name] for name in MODEL_1_FEATURES}])
        predicted_dai = float(self._dai_model.predict(model_1_input)[0])
        predicted_dai = max(0.0, min(1.0, predicted_dai))

        model_2_source = {name: features[name] for name in MODEL_2_FEATURES if name != "predicted_dai"}
        model_2_source["predicted_dai"] = predicted_dai
        model_2_input = pd.DataFrame([model_2_source])[MODEL_2_FEATURES]

        disruption_probability = float(self._disruption_model.predict_proba(model_2_input)[0][1])
        disruption_probability = max(0.0, min(1.0, disruption_probability))

        return predicted_dai, disruption_probability


registry = ModelRegistry()
