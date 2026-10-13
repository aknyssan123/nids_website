
"""nids_models.py - model pipelines, evaluation and timing helpers (v3, Step 7b)."""
import io, time, subprocess
import numpy as np
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler, FunctionTransformer, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import (accuracy_score, f1_score, matthews_corrcoef, confusion_matrix,
                             precision_recall_fscore_support, roc_auc_score,
                             average_precision_score)

def _gpu_available():
    try:
        return subprocess.run(["nvidia-smi"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False

XGB_DEVICE = "cuda" if _gpu_available() else "cpu"   # XGBoost trains on the GPU when present

def signed_log1p(x):
    return np.sign(x) * np.log1p(np.abs(x))

def scaled_preprocessor(features, categorical):
    """For linear models / neural nets: log-scale + standardise numbers, one-hot categories.
    Lives inside the model pipeline, so it is fitted on training data only (D7)."""
    cat = [c for c in features if c in categorical]
    num = [c for c in features if c not in categorical]
    return ColumnTransformer(
        [("num", Pipeline([("log", FunctionTransformer(signed_log1p)),
                           ("scale", StandardScaler())]), num),
         ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=500,
                               max_categories=20), cat)],
        sparse_threshold=0.3)

class EncodedLabels:
    """Wraps XGBoost: integer labels 0..K-1, GPU training, CPU prediction (comparable timing)."""
    def __init__(self, model):
        self.model = model
    def fit(self, X, y, **fit_kw):
        self.enc_ = LabelEncoder().fit(y)
        self.classes_ = self.enc_.classes_
        self.model.fit(X, self.enc_.transform(y), **fit_kw)
        if getattr(self.model, "device", "cpu") != "cpu":
            self.model.set_params(device="cpu")
            self.model.get_booster().set_param({"device": "cpu"})
        return self
    def predict(self, X):
        return self.enc_.inverse_transform(np.asarray(self.model.predict(X)).astype(int))
    def predict_proba(self, X):
        return self.model.predict_proba(X)

DEFAULTS = {
    "LR": {"max_iter": 300, "C": 1.0},
    "DT": {"min_samples_leaf": 1},
    "RF": {"n_estimators": 100, "max_samples": 0.25, "min_samples_leaf": 1},
    "XGB": {"n_estimators": 200, "learning_rate": 0.1, "max_depth": 8},
    "LGBM": {"n_estimators": 200, "learning_rate": 0.1, "num_leaves": 63},
    "LGBM2": {"n_estimators": 200, "learning_rate": 0.1, "num_leaves": 63,
              "reg_lambda": 1.0, "min_child_weight": 1.0},
    "MLP": {"hidden_layer_sizes": (128, 64), "batch_size": 1024, "learning_rate_init": 0.001,
            "alpha": 0.0001, "max_iter": 20},
}
CUSTOM = {}                      # name -> (family, parameter overrides), filled by register()
HYPERPARAMS = {k: dict(v) for k, v in DEFAULTS.items()}
HYPERPARAMS["XGB"]["device"] = "cpu (Steps 5-7)"
for _k in ["LR", "DT", "RF", "XGB", "LGBM", "LGBM2"]:
    HYPERPARAMS[_k + "_w"] = {**HYPERPARAMS[_k], "class_weight": "balanced"}

def register(name, family, **overrides):
    """Define a named configuration, e.g. register('XGB_d6', 'XGB', max_depth=6)."""
    CUSTOM[name] = (family, overrides)
    hp = {**DEFAULTS[family], **overrides}
    if family == "XGB":
        hp["device"] = XGB_DEVICE
    HYPERPARAMS[name] = hp
    HYPERPARAMS[name + "_w"] = {**hp, "class_weight": "balanced"}

def make_model(name, features, categorical, seed):
    """Names ending in '_w' use balanced class weights (H1b)."""
    weighted = name.endswith("_w")
    key = name[:-2] if weighted else name
    family, over = CUSTOM.get(key, (key, {}))
    p = {**DEFAULTS[family], **over}
    cw = "balanced" if weighted else None
    if family == "LR":
        return Pipeline([("prep", scaled_preprocessor(features, categorical)),
                         ("clf", LogisticRegression(class_weight=cw, random_state=seed, **p))])
    if family == "DT":
        return DecisionTreeClassifier(class_weight=cw, random_state=seed, **p)
    if family == "RF":
        return RandomForestClassifier(n_jobs=-1, class_weight=cw, random_state=seed, **p)
    if family == "XGB":
        from xgboost import XGBClassifier
        device = XGB_DEVICE if key in CUSTOM else "cpu"   # original 'XGB' stays CPU
        return EncodedLabels(XGBClassifier(tree_method="hist", device=device, n_jobs=-1,
                                           random_state=seed, **p))
    if family in ("LGBM", "LGBM2"):
        from lightgbm import LGBMClassifier
        return LGBMClassifier(n_jobs=-1, random_state=seed, verbose=-1, **p)
    if family == "MLP":
        return Pipeline([("prep", scaled_preprocessor(features, categorical)),
                         ("clf", MLPClassifier(random_state=seed, **p))])
    raise ValueError(name)

def fit_params(name, y):
    """XGBoost / LightGBM take class weights as per-row sample weights."""
    if name.endswith("_w"):
        family = CUSTOM.get(name[:-2], (name[:-2], {}))[0]
        if family in ("XGB", "LGBM", "LGBM2"):
            return {"sample_weight": compute_sample_weight("balanced", y)}
    return {}

def timed_fit(model, X, y, **fit_kw):
    t0 = time.perf_counter()
    model.fit(X, y, **fit_kw)
    return time.perf_counter() - t0

def timed_predict(model, X):
    """Batch prediction; returns predictions and microseconds per flow."""
    t0 = time.perf_counter()
    pred = model.predict(X)
    return pred, 1e6 * (time.perf_counter() - t0) / len(X)

def model_size_mb(model):
    buf = io.BytesIO()
    joblib.dump(model, buf)
    return buf.tell() / 1e6

def evaluate(y_true, y_pred, task, classes, y_score=None, benign="Benign"):
    """Metrics for one run. Binary: attack = 1. Multi-class: also reports the
    security view (benign vs any attack) as attack_fpr / attack_fnr."""
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    out = {"accuracy": accuracy_score(y_true, y_pred),
           "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0),
           "weighted_f1": f1_score(y_true, y_pred, average="weighted", zero_division=0),
           "mcc": matthews_corrcoef(y_true, y_pred)}
    cm = confusion_matrix(y_true, y_pred, labels=classes)
    out["confusion_matrix"] = {"labels": [str(c) for c in classes], "counts": cm.tolist()}
    if task == "binary":
        tn, fp, fn, tp = cm.ravel()
        out.update(precision=tp / max(tp + fp, 1), recall=tp / max(tp + fn, 1),
                   f1=f1_score(y_true, y_pred, zero_division=0),
                   fpr=fp / max(fp + tn, 1), fnr=fn / max(fn + tp, 1))
        if y_score is not None:
            out.update(roc_auc=roc_auc_score(y_true, y_score),
                       pr_auc=average_precision_score(y_true, y_score))
    else:
        p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=classes,
                                                     zero_division=0)
        out["per_class"] = {str(c): {"precision": p[i], "recall": r[i], "f1": f[i],
                                     "support": int(s[i])} for i, c in enumerate(classes)}
        is_att, pred_att = y_true != benign, y_pred != benign
        out["attack_fpr"] = (pred_att & ~is_att).sum() / max((~is_att).sum(), 1)
        out["attack_fnr"] = (~pred_att & is_att).sum() / max(is_att.sum(), 1)
    return out
