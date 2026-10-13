
"""nids_engine.py - detection engine of the website backend (Step 11).
Loads any detector listed in models/catalog.json, scores NetFlow v3 flow records and explains each alert:
exact TreeSHAP (log-odds) for XGBoost and LightGBM; for the other models, feature replacement
(drop in attack probability when a feature takes its typical benign value)."""
import json, os, time
import numpy as np
import pandas as pd

PROTOCOLS = {1: "ICMP", 6: "TCP", 17: "UDP", 58: "ICMPv6"}

def load_catalog(model_dir):
    with open(os.path.join(model_dir, "catalog.json")) as f:
        return {e["id"]: e for e in json.load(f)["models"]}

class Detector:
    def __init__(self, entry, model_dir):
        self.entry, self.id, self.name = entry, entry["id"], entry["name"]
        self.features = list(entry["features"])
        self.threshold = float(entry.get("default_threshold", 0.5))
        self.method = entry["explanation"]
        # XGBoost was trained on float32 inputs; the scikit-learn/LightGBM models on the stored integer types
        self.dtype = np.float32 if entry["format"] == "xgboost-json" else np.float64
        self.input_dtypes = entry.get("input_dtypes")
        path = os.path.join(model_dir, entry["file"])
        if entry["format"] == "xgboost-json":
            import xgboost as xgb
            self._xgb = xgb
            self.model = xgb.Booster()
            self.model.load_model(path)
            self.model.set_param({"device": "cpu"})
        else:
            import joblib
            self.model = joblib.load(path)
        self.baseline = np.array([entry["benign_median"][f] for f in self.features], dtype=self.dtype)

    def prepare(self, df):
        """Check the columns and build the model input (identifiers are never model inputs)."""
        missing = [c for c in self.features if c not in df.columns]
        if missing:
            raise ValueError(f"The file lacks {len(missing)} required NetFlow v3 column(s): "
                             + ", ".join(missing[:8]) + (" ..." if len(missing) > 8 else ""))
        if self.input_dtypes:                           # same column types as in training whenever values fit
            cols = {}
            for c in self.features:
                v = pd.to_numeric(df[c], errors="coerce")
                dt = np.dtype(self.input_dtypes[c])
                if np.issubdtype(dt, np.integer) and v.notna().all() and (v % 1 == 0).all() \
                        and v.min() >= np.iinfo(dt).min and v.max() <= np.iinfo(dt).max:
                    cols[c] = v.astype(dt)
                else:
                    cols[c] = v.astype(np.float64)
            return pd.DataFrame(cols)
        X = np.empty((len(df), len(self.features)), dtype=self.dtype)
        for j, c in enumerate(self.features):
            X[:, j] = pd.to_numeric(df[c], errors="coerce").to_numpy(self.dtype)
        return pd.DataFrame(X, columns=self.features, copy=False)

    def predict_proba(self, X):
        """Probability that each flow is an attack."""
        if self.entry["format"] == "xgboost-json":
            return np.asarray(self.model.inplace_predict(X), dtype=np.float64)
        return np.asarray(self.model.predict_proba(X), dtype=np.float64)[:, 1]

    def contributions(self, X):
        if self.method == "shap-xgboost":
            return self.model.predict(self._xgb.DMatrix(X), pred_contribs=True)[:, :-1]
        if self.method == "shap-lightgbm":
            return np.asarray(self.model.predict(X, pred_contrib=True))[:, :-1]
        Xf = X.to_numpy(np.float64)                     # feature replacement
        p0 = self.predict_proba(pd.DataFrame(Xf, columns=self.features))
        n, k = X.shape
        Xr = np.repeat(Xf, k, axis=0)
        cols = np.tile(np.arange(k), n)
        Xr[np.arange(n * k), cols] = self.baseline[cols]
        pr = self.predict_proba(pd.DataFrame(Xr, columns=self.features)).reshape(n, k)
        return p0[:, None] - pr

    def explain(self, X, top=3):
        contrib = self.contributions(X)
        order = np.argsort(-contrib, axis=1)[:, :top]
        vals, fmt = X.to_numpy(np.float64), ("{:+.2f}" if self.method.startswith("shap") else "{:+.3f}")
        reasons = ["; ".join(f"{self.features[j]}={vals[i, j]:g} ({fmt.format(contrib[i, j])})"
                             for j in order[i] if contrib[i, j] > 0) for i in range(len(X))]
        return reasons, [self.features[order[i, 0]] for i in range(len(X))]

    def detect(self, df, threshold=None, top=3, max_explain=None):
        thr = self.threshold if threshold is None else float(threshold)
        if max_explain is None:
            max_explain = 2000 if self.method.startswith("shap") else 300
        t0 = time.perf_counter()
        X = self.prepare(df)
        p = self.predict_proba(X)
        t_score = time.perf_counter() - t0
        order = np.flatnonzero(p >= thr)
        order = order[np.argsort(-p[order], kind="stable")]
        explained = order[:max_explain]
        reasons, main_reason = self.explain(X.iloc[explained], top) if len(explained) else ([], [])
        t_total = time.perf_counter() - t0
        alerts = pd.DataFrame({"row": order + 1})
        if "FLOW_START_MILLISECONDS" in df.columns:
            ms = pd.to_numeric(df["FLOW_START_MILLISECONDS"], errors="coerce").to_numpy()[order]
            alerts["time_utc"] = pd.to_datetime(ms, unit="ms", utc=True).strftime("%Y-%m-%d %H:%M:%S")
        for side, ip, port in (("source", "IPV4_SRC_ADDR", "L4_SRC_PORT"), ("destination", "IPV4_DST_ADDR", "L4_DST_PORT")):
            if ip in df.columns:
                a = df[ip].astype(str).to_numpy()[order]
                b = df[port].astype(str).to_numpy()[order] if port in df.columns else np.full(len(order), "?")
                alerts[side] = pd.Series(a) + ":" + pd.Series(b)
        if "PROTOCOL" in df.columns:
            proto = pd.to_numeric(df["PROTOCOL"], errors="coerce").to_numpy()[order]
            alerts["protocol"] = [PROTOCOLS.get(int(v), str(int(v))) if v == v else "?" for v in proto]
        alerts["attack_probability"] = np.round(p[order], 4)
        alerts["reasons"] = list(reasons) + [""] * (len(order) - len(reasons))
        if "Attack" in df.columns:
            alerts["true_label_demo_only"] = df["Attack"].astype(str).to_numpy()[order]
        summary = {"model_id": self.id, "model": self.name, "flows": int(len(df)), "alerts": int(len(order)),
                   "alert_share_pct": 100 * len(order) / max(len(df), 1), "threshold": thr,
                   "seconds_scoring": t_score, "seconds_total": t_total,
                   "flows_per_second": len(df) / max(t_score, 1e-9), "explained_alerts": int(len(explained)),
                   "explanation": self.entry["explanation_label"],
                   "top_reasons": pd.Series(main_reason).value_counts().head(8).to_dict() if main_reason else {}}
        if "Label" in df.columns:                      # ground truth is only reported, never used to decide
            y = pd.to_numeric(df["Label"], errors="coerce").to_numpy()
            hit = p >= thr
            summary.update(attacks_in_file=int((y == 1).sum()), attacks_detected=int((hit & (y == 1)).sum()),
                           benign_in_file=int((y == 0).sum()), false_alarms=int((hit & (y == 0)).sum()))
        return alerts, summary
