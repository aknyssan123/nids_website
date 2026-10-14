# Flow-based intrusion detector (research prototype)

A local website for our study of machine-learning cyberattack detection from network flow traffic. It scores NetFlow v3 flow records with the seven detectors trained in Google Colab, shows the alerts with
the reasons behind them (SHAP or feature replacement), and lets you move the alert threshold live.

```
nids-website/
├── backend/        FastAPI service (Python): main.py = web routes, service.py = logic
│                   + the files from nids_backend_bundle.zip (engine, models, samples, requirements)
├── frontend/       React + Vite user interface
├── CLAUDE.md       project context for Claude Code
└── README.md       this file
```

## 1. One-time setup

### 1.1 Put the trained models into `backend/`

The models are not in this zip: they are in the bundle you built in Colab (Step 11, Cell 2).

1. In Google Drive, download `NIDS_research/prototype/nids_backend_bundle.zip`.
2. Extract its **contents** directly into `nids-website/backend/`.

Afterwards `backend/` must look like this:

```
backend/
├── main.py              (from this zip)
├── service.py           (from this zip)
├── nids_engine.py       (from the bundle)
├── nids_models.py       (from the bundle)
├── requirements.txt     (from the bundle)
├── README.md            (from the bundle: says which Python version Colab used)
├── models/              (from the bundle: catalog.json + 7 model files)
└── samples/             (from the bundle: two 5,000-flow test files)
```

### 1.2 Install the tools

- **Python**: open `backend/README.md` (from the bundle). It says
  "Trained in Google Colab with Python X.Y.Z". Install the **same X.Y** version from
  <https://www.python.org/downloads/windows/>, and tick "Add python.exe to PATH" in the installer.
  The same minor version matters: the saved scikit-learn and LightGBM models are loaded with the exact library versions
  pinned in `requirements.txt`, and those versions have wheels for that Python version.
- **Node.js**: install the current LTS version from <https://nodejs.org/> (Vite 5 needs Node 18 or newer).
- **VS Code** (optional) with the Claude Code extension, if you want to keep working on the project with Claude.

Check in a new terminal:

```powershell
py --list        # shows the installed Python versions
node --version
npm --version
```

### 1.3 Backend environment (once)

In VS Code: **Terminal → New Terminal**, then (replace `3.X` with the version from `backend/README.md`, e.g. `3.12`):

```powershell
cd backend
py -3.X -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell refuses to run `Activate.ps1` ("running scripts is disabled"), run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

On macOS or Linux use `python3.X -m venv .venv` and `source .venv/bin/activate`.

### 1.4 Frontend packages (once)

In a second terminal:

```powershell
cd frontend
npm install
```

## 2. Run the site (every time)

You need two terminals, both kept open.

**Terminal 1, backend:**

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Wait for `Application startup complete`. Check <http://127.0.0.1:8000/api/health>: it should show
`{"status":"ok","detectors":7}`. The automatic API documentation is at <http://127.0.0.1:8000/docs>.

**Terminal 2, frontend:**

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>.

## 3. Using it

1. Pick a detector. Six were trained on NF-UNSW-NB15-v3 and one (XGBoost) on NF-CSE-CIC-IDS2018-v3.
2. Pick flow records: a built-in sample (5,000 test flows that no detector saw during training) or your own CSV.
3. Set the alert threshold and press **Run detector**.

The flow strip, the counts and the false-alarm figures follow the threshold slider immediately. The reasons and the
alert list belong to the threshold of the last run, so run again after moving the slider to refresh them.

Your own CSV needs a header row and the 41 NetFlow v3 feature columns the detectors use (the same names as in the
NF-*-v3 datasets). If it has `IPV4_SRC_ADDR`, `L4_SRC_PORT`, `IPV4_DST_ADDR`, `L4_DST_PORT` and
`FLOW_START_MILLISECONDS`, these appear in the alert list; they are never model inputs. A `Label` column (0/1) and an
`Attack` column are used only to report how many attacks were caught; the detectors never see them.

A detector applied to records from the other network performs badly. That is a finding of the study
(cross-network test, Step 10), not a bug, and the site warns about it.

## 4. Problems and fixes

| What you see | Fix |
| --- | --- |
| Page says "The detection service is not running" | Terminal 1 is not running or failed. Start it and read its error. |
| `ModuleNotFoundError: nids_engine` or `catalog.json` not found | The bundle was not extracted into `backend/` (see 1.1). |
| `pip install` fails building numpy, pandas or scikit-learn | Your Python version differs from Colab's. Install the version from `backend/README.md`, delete `.venv`, repeat 1.3. |
| Warning about scikit-learn versions when a model loads | The installed scikit-learn differs from the pinned version. Reinstall with `pip install -r requirements.txt`. |
| `uvicorn` is not recognised | The virtual environment is not active: run `.venv\Scripts\Activate.ps1` first. |
| Port 8000 or 5173 already in use | Close the other program, or run uvicorn with `--port 8001` and change the port in `frontend/vite.config.js`. |
| Upload rejected as too large | The limit is 20 MB. Set the environment variable `MAX_UPLOAD_MB` before starting uvicorn to change it. |

## 5. Settings (environment variables, all optional)

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `MAX_UPLOAD_MB` | backend | 20 | Largest CSV upload |
| `MAX_ALERTS` | backend | 2000 | Alerts sent to the browser (highest probability first) |
| `MAX_SCORES` | backend | 50000 | Per-flow scores sent for the flow strip (evenly sampled above this) |
| `ALLOWED_ORIGINS` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Sites allowed to call the API from a browser |
| `VITE_API_URL` | frontend `.env` | empty | Backend address when it is not on the same machine (see `frontend/.env.example`) |

## 6. Later: hosting

The plan is the frontend on Vercel and the backend either as a Vercel Python function or on a separate Python host.
Points to settle then: Vercel limits request and response bodies to 4.5 MB (so uploads must stay small there, which is
why the samples have 5,000 flows), `ALLOWED_ORIGINS` must include the deployed frontend address, and `VITE_API_URL`
must point to the deployed backend.

## 7. Where the numbers come from

Everything the site displays about model quality (MCC, false alarms, missed attacks, timing) is read from
`backend/models/catalog.json`, which Colab Step 11 wrote from the experiment results (Steps 8 and 10). Results computed
on the page come from the backend running the real models on the selected file, on your own computer.

## 8. Exact commands (Windows PowerShell)

The project folder on this computer is `C:\Users\User\Desktop\nids_website`; the backend uses Python 3.13. These
commands call the virtual environment's `python.exe` directly, so `Activate.ps1` (and the execution-policy question)
is never needed.

### First time only

```powershell
cd C:\Users\User\Desktop\nids_website\backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd C:\Users\User\Desktop\nids_website\frontend
npm ci
```

### Every time

Terminal 1 (backend), leave it open:

```powershell
cd C:\Users\User\Desktop\nids_website\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend), leave it open:

```powershell
cd C:\Users\User\Desktop\nids_website\frontend
npm run dev
```

Then open <http://localhost:5173> in the browser. Stop either part with `Ctrl+C` in its terminal.

### Optional: production build of the frontend

```powershell
cd C:\Users\User\Desktop\nids_website\frontend
npm run build
npm run preview
```

`npm run build` writes the finished site to `frontend\dist`; `npm run preview` serves that build at
<http://localhost:4173> (the backend from Terminal 1 must still be running).
