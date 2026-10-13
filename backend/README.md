# NIDS website - backend bundle (Step 11)

Trained in Google Colab with Python 3.13.16 - use the same Python minor version locally.

- `nids_engine.py` - detection engine (scores NetFlow v3 records, explains alerts)
- `nids_models.py` - project module required to load the saved scikit-learn pipelines
- `models/` - seven binary detectors + `catalog.json` (metrics, speed, explanation method)
- `samples/` - 5,000 held-out test flows per dataset
- `requirements.txt` - pinned versions

The FastAPI app (`main.py`) and the React frontend come in the next step.
