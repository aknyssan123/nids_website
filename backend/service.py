"""service.py - backend logic of the NIDS website, kept separate from the web framework.

It loads the detectors listed in models/catalog.json (built in Colab, Step 11), reads uploaded or
built-in NetFlow v3 CSV files, and returns JSON-ready results: a summary, the alert list with
reasons, and one score per flow for the flow strip in the browser.
"""
import glob
import io
import math
import os

import numpy as np
import pandas as pd

from nids_engine import Detector, load_catalog

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "models")
SAMPLE_DIR = os.path.join(HERE, "samples")
MAX_ALERTS = int(os.environ.get("MAX_ALERTS", "2000"))      # alerts returned to the browser
MAX_SCORES = int(os.environ.get("MAX_SCORES", "50000"))     # per-flow scores returned for the flow strip

CATALOG = load_catalog(MODEL_DIR)
_detectors = {}
_samples = None
PUBLIC_FIELDS = ("id", "name", "family", "setting", "trained_on", "default", "default_threshold",
                 "explanation_label", "metrics", "speed", "size_mb")
NETWORKS = ("UNSW-NB15", "CSE-CIC-IDS2018")


def jsonable(value):
    """Convert numpy / pandas values to plain JSON types (NaN and infinity become null)."""
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        value = float(value)
        return value if math.isfinite(value) else None
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def list_models():
    return [jsonable({k: e.get(k) for k in PUBLIC_FIELDS}) for e in CATALOG.values()]


def list_samples():
    global _samples
    if _samples is None:
        _samples = []
        for path in sorted(glob.glob(os.path.join(SAMPLE_DIR, "*.csv"))):
            name = os.path.basename(path)
            with open(path, "rb") as f:
                flows = max(sum(1 for _ in f) - 1, 0)
            _samples.append({"id": os.path.splitext(name)[0], "file": name,
                             "network": next((n for n in NETWORKS if n in name), None),
                             "flows": flows, "size_mb": round(os.path.getsize(path) / 1e6, 2)})
    return _samples


def sample_path(sample_id):
    for s in list_samples():
        if s["id"] == sample_id:
            return os.path.join(SAMPLE_DIR, s["file"])
    raise KeyError(sample_id)


def get_detector(model_id):
    if model_id not in CATALOG:
        raise KeyError(model_id)
    if model_id not in _detectors:
        _detectors[model_id] = Detector(CATALOG[model_id], MODEL_DIR)
    return _detectors[model_id]


def read_flows(data):
    """Parse CSV bytes into a table of flow records."""
    if not data:
        raise ValueError("The file is empty.")
    try:
        df = pd.read_csv(io.BytesIO(data), low_memory=False)
    except Exception as exc:                                   # malformed text, wrong encoding, ...
        raise ValueError(f"The file could not be read as CSV ({type(exc).__name__}). "
                         "Export the NetFlow v3 records as comma-separated values with a header row.")
    if df.empty:
        raise ValueError("The file has a header but no flow records.")
    return df


def analyze(df, model_id, threshold, source):
    det = get_detector(model_id)
    alerts, summary = det.detect(df, threshold=threshold)
    scores = det.predict_proba(det.prepare(df))
    labels = None
    if "Label" in df.columns:
        labels = pd.to_numeric(df["Label"], errors="coerce").fillna(-1).astype(int).to_numpy()
    sampled = len(scores) > MAX_SCORES
    if sampled:                                                # keep the payload small for very large files
        keep = np.linspace(0, len(scores) - 1, MAX_SCORES).astype(int)
        scores = scores[keep]
        labels = labels[keep] if labels is not None else None
    shown = alerts.head(MAX_ALERTS)
    summary = dict(summary, source=source, alerts_returned=int(len(shown)),
                   alerts_truncated=bool(len(alerts) > len(shown)),
                   trained_on=CATALOG[model_id]["trained_on"])
    return jsonable({"summary": summary,
                     "alerts": shown.to_dict(orient="records"),
                     "scores": np.round(scores, 4).tolist(),
                     "labels": labels.tolist() if labels is not None else None,
                     "scores_sampled": sampled})
