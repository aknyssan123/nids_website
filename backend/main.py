"""main.py - FastAPI backend of the NIDS research prototype.

Run locally (from this folder):  uvicorn main:app --reload --port 8000
API documentation while it runs: http://localhost:8000/docs
"""
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import service

MAX_UPLOAD_MB = float(os.environ.get("MAX_UPLOAD_MB", "20"))
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

app = FastAPI(title="NIDS research prototype API", version="1.0.0",
              description="Scores NetFlow v3 flow records with the detectors from the study.")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "detectors": len(service.CATALOG)}


@app.get("/api/models")
def models():
    return service.list_models()


@app.get("/api/samples")
def samples():
    return service.list_samples()


@app.post("/api/analyze")
def analyze(model_id: str = Form(...),
            threshold: float = Form(0.5),
            sample_id: str | None = Form(None),
            file: UploadFile | None = File(None)):
    if not 0.0 < threshold < 1.0:
        raise HTTPException(status_code=422, detail="The threshold must be between 0 and 1.")
    if model_id not in service.CATALOG:
        raise HTTPException(status_code=404, detail=f"Unknown detector: {model_id}")
    limit = int(MAX_UPLOAD_MB * 1_000_000)
    if file is not None and file.filename:
        data = file.file.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(status_code=413,
                                detail=f"The file is larger than {MAX_UPLOAD_MB:g} MB. Upload fewer flow records.")
        source = file.filename
    elif sample_id:
        try:
            path = service.sample_path(sample_id)
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Unknown sample: {sample_id}")
        with open(path, "rb") as f:
            data = f.read()
        source = os.path.basename(path)
    else:
        raise HTTPException(status_code=422, detail="Choose a built-in sample or upload a CSV file of NetFlow v3 records.")
    try:
        df = service.read_flows(data)
        return service.analyze(df, model_id, threshold, source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
