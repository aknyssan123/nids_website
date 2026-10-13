# Project context for Claude Code

This file hands over a research project that was run in a long claude.ai session. Read it fully before doing anything.
All numbers below come from the owner's own Google Colab runs. Before any number goes into the paper, check it against
the result tables on the owner's Google Drive (`NIDS_research/results/`); if they differ, the Drive table wins.

## 1. The project

- Goal: a publication-ready English article for the **Scientific Journal of Astana IT University**. Working title:
  "Development of an Intelligent Cyberattack Detection System Based on Network Traffic Analysis Using Machine Learning
  Methods" (too long; the final title must be at most 96 characters, see section 7).
- Topic: binary and attack-type detection of network attacks from NetFlow v3 flow records with machine learning, plus a
  working prototype (this website).
- Datasets (public, from the University of Queensland NIDS collection,
  <https://staff.itee.uq.edu.au/marius/NIDS_datasets/>):
  - **NF-UNSW-NB15-v3**: 2,350,609 flows after cleaning.
  - **NF-CSE-CIC-IDS2018-v3**: DOI 10.48610/ECE9B83 (UQ eSpace record UQ:ece9b83, which also states the licence).
    20,115,529 raw flows; 628,474 exact duplicates removed, leaving 19,487,055. 14 attack labels, each attack type
    occurs on a single day; 23 sessions separated by gaps of more than 30 minutes.

## 2. Rules the owner set (keep them)

1. Never invent or estimate metrics, results, data, citations, DOIs, code output, author names, affiliations, ORCIDs or
   e-mails. Use only results the owner actually produced. Leave placeholders for author details; the DOI is assigned by
   the editors.
2. Do not ask for account credentials or private access tokens. Public datasets only.
3. Do not write the full article until the experiments are finished and validated and the owner approves
   **Checkpoint 8**.
4. Experiments run in Google Colab, by the owner. For a Colab step give 1 to 3 cells per message in this format:
   Current stage / Objective / Scientific reasoning / Colab instructions / Python code / Expected output / What to send /
   Next step. Then wait for the owner's real output.
5. Every experiment is logged in `NIDS_research/logs/experiment_log.csv` via `log_experiment()` in `nids_utils.py`
   (it refuses to reuse an `exp_id`). Never overwrite earlier results without warning the owner first.
6. Teach as you go: the owner must be able to defend every choice in front of reviewers.
7. Website code in this folder may be edited and run directly on the owner's machine (no Colab needed for that).

## 3. Status

- Steps 1 to 11 are done: data audit and cleaning, splits, model selection, multi-seed runs, statistics, SHAP,
  cross-network experiments (Step 10, 10b, 10c), controlled speed test and backend bundle (Step 11).
- **Checkpoint 7 approved (2026-10-13)**: the website runs locally (Python 3.13 venv in `backend/.venv`, pinned
  versions); the API reproduced the four Step 11 engine self-test results exactly; the owner checked the default run,
  the threshold slider and the cross-network warning in the browser (own-CSV upload not yet tried).
- **Next: Checkpoint 8**, approval to start writing. Before writing, propose the outline, the final title (at most
  96 characters; one candidate was "Intelligent Cyberattack Detection from Network Flow Traffic Using Machine Learning
  Methods") and the plan of tables and figures, and wait for approval.
- After that: the article, an editable .docx following the journal template, at least 20 verified real references,
  a research-integrity report and a template-compliance checklist.
- Submission deadline: unknown; ask the owner.

## 4. Where things are

- **This folder** (`nids-website/`): the prototype. `backend/main.py` (FastAPI routes), `backend/service.py` (logic),
  `frontend/` (React 18 + Vite 5). `backend/` also needs the contents of `nids_backend_bundle.zip`; see README.md.
- **Google Drive** `MyDrive/NIDS_research/` (used from Colab as `/content/drive/MyDrive/NIDS_research/`):
  - modules: `nids_utils.py`, `nids_models.py`, `nids_runner.py` (v2), `nids_cross.py`;
  - `data/processed/` cleaned parquet files (UNSW and CIC, about 1 GB for CIC; do not copy these here);
  - `results/metrics/` (for example `cross_runs.csv`, per-run JSON), `results/predictions/`, `results/tables/`,
    `results/figures/`;
  - `logs/` (experiment log, raw audit and provenance JSON per dataset);
  - `models/` (saved models), `prototype/` (website bundle).
- Suggestion for the owner: copy the four modules plus `results/tables`, `results/figures` and `logs` from Drive into
  a `research/` folder next to this file, so Claude Code can read the real tables before writing.
- Tables produced so far include CIC versions of T01 to T06, T20 to T27, T28 (MLP vs boosting), T29 (feature
  comparability between the networks), T30 to T35b (cross-network), T36 (without TCP window features), T37 (speed).
  Figures: F01 (CIC timeline) and F03 to F08. Check the Drive folder for the exact list and file names.

## 5. Methods in brief

- Splits on UNSW: S1 random; S2 group-aware 60/20/20 (main protocol); S3 session-based (one fixed period).
- CIC: S2 group-aware, groups from `split_group(group_id, attack codes)`; T = time split, training and validation
  (80/20, group-aware) on flows before 2018-02-22 UTC, test on flows after it; the test part contains 5 attack types
  never seen in training.
- Models: LR, DT_msl10, RF_msl5, XGB_d6, LGBM2_nl31, MLP. Configurations were chosen on seed-42 validation data.
  XGBoost used the GPU when available; from Step 10 everything ran on the CPU, which reproduced the Step 8 GPU result
  exactly (seed 42 MCC 0.9942).
- Main feature set F_MAIN has 41 features (identifiers such as IP addresses, ports and timestamps are excluded).
- Statistics: Wilcoxon signed-rank with Holm correction over 10 seeds; with 5 seeds Wilcoxon cannot reach p < 0.05
  (smallest possible p = 0.0625), so 95% t-based confidence intervals of paired differences are reported instead;
  Mann-Whitney for comparing protocols; McNemar tests. Oracle thresholds (chosen with test labels) only as an upper bound.
- Explanations: exact TreeSHAP (XGBoost `pred_contribs=True`, LightGBM `pred_contrib=True`); for LR, DT, RF and MLP,
  feature replacement (drop in attack probability when a feature takes its typical benign value).

## 6. Results so far (verify against Drive before use)

**UNSW binary detection, S2, 10 seeds (MCC):** XGB 0.9981, LGBM2 0.9980, RF 0.9970, DT 0.9959, MLP 0.9974,
LR 0.9903 (1 seed). The MLP misses about 5 times more attacks than boosting (median FNR 0.21% vs 0.04%, Holm p = 0.012).

**UNSW attack-type classification (macro-F1, ×100):** XGB 58.55, RF 56.98, DT 55.85; class-weighted XGB 61.16 at the
cost of more false alarms. Protocol difficulty S1 < S2 < S3 (scores S1 > S2 > S3). The top 15 features are enough for
binary detection but not for attack types.

**False alarms:** one benign pattern of 229 flows causes about 83% of the false alarms on seeds 7 and 42.

**Cross-network, Step 10 (main features, 5 seeds):**

| Train → test | MCC | ROC-AUC | Note |
| --- | --- | --- | --- |
| UNSW → UNSW | 0.9982 | 1.000 | |
| CIC → CIC | 0.9662 | 0.988 | FNR 5.6%, mostly Infiltration (13% detected) and Brute_Force-Web (9%) |
| CIC time split T (new attack types) | 0.0045 | 0.73 | FNR 99.98% |
| UNSW → CIC | −0.108 | 0.19 | false-alarm rate 16.5% |
| CIC → UNSW | 0.000 | 0.41 | |

- With an oracle threshold at 1% false alarms: cross-network detection at most 1.3%; time split 12.7%.
- Host-stack feature-set variant (see the Step 10 tables on Drive for its exact definition): UNSW → CIC false alarms
  fall from 16.5% to 0.09% but AUC is only 0.53; CIC → UNSW AUC gets worse by 0.14.
- SHAP (Step 10b): rank correlation of feature importance between the two networks 0.56. The UNSW model on CIC benign
  flows shifts +10.8 log-odds, mainly through DST_TO_SRC_AVG_THROUGHPUT and SERVER_TCP_FLAGS; on CIC attacks −19.2,
  mainly SERVER_TCP_FLAGS (−9.0). The CIC model on UNSW attacks shifts −15.6, mainly TCP_WIN_MAX_IN (−7.2).
- Step 10c (exploratory, added after the Step 10b SHAP findings; report it as such): without the TCP window features
  CIC → UNSW AUC rises from 0.41 to 0.63 (paired 95% CI [0.05, 0.38], 5 of 5 seeds); UNSW → CIC unchanged;
  in-network results unchanged.

**Speed, Step 11 (AMD EPYC 7B12, 2 logical CPUs, 13.3 GB RAM; batch prediction on 1 thread):**

| Model | µs per flow | One-flow call, median (ms) | Size (MB) |
| --- | --- | --- | --- |
| LR | 4.451 | 10.375 | 0.04 |
| DT | 0.117 | 0.846 | 0.03 |
| RF | 3.761 | 6.006 | 2.38 |
| XGB | 2.554 | 4.958 | 0.46 |
| LGBM2 | 6.496 | 0.924 | 0.69 |
| MLP | 4.088 | 5.928 | 0.90 |

**Engine self-test on the 5,000-flow samples (Step 11, default threshold):** UNSW detector on UNSW 286/286 attacks,
1/4,714 false alarms; CIC detector on CIC 421/441 attacks, 1/4,559 false alarms; UNSW detector on CIC 10/441 attacks,
1,283/4,559 false alarms; CIC detector on UNSW 4/286 attacks.

**Limitations to report:** configurations chosen on seed-42 validation; Colab timing noise (hence the controlled
speed test); the CIC test sets lack FTP-BruteForce and SlowHTTPTest because each sits in a single pattern that fell into
training; SQL injection and XSS have only 15 to 23 test flows per seed; TCP window sizes are host-dependent and slipped
through the pre-set exclusion rule (single-feature AUC 0.96 to 0.98); S3 uses one fixed period; the log transform runs at
reduced precision for int8 columns (consistent between training and testing).

## 7. Article requirements (journal template)

English; title at most 96 characters; abstract of about 250 words or more; at most 10 keywords; Times New Roman 12;
A4; margins top 2 cm, bottom 2.5 cm, left 3 cm, right 1.5 cm; 8 to 15 pages; at least 20 genuine, verified references in
APA style cited with numbers [1]; placeholders for authors and affiliations. Deliver the article text, an editable
.docx that follows the template, the reference list, a research-integrity report and a template-compliance checklist.

## 8. The website

- Backend API (FastAPI, `backend/main.py`):
  - `GET /api/health`, `GET /api/models` (public catalog fields), `GET /api/samples`;
  - `POST /api/analyze` (multipart form: `model_id`, `threshold` in (0, 1), and either `sample_id` or `file`).
    Returns `{summary, alerts, scores, labels, scores_sampled}`; errors are 404 (unknown detector or sample),
    413 (file too large), 422 (bad threshold, missing input, unreadable CSV, missing columns).
- `backend/nids_engine.py` (from the bundle): `load_catalog`, `Detector.prepare / predict_proba / explain / detect`.
  scikit-learn pipelines get their training column dtypes (`input_dtypes` in `catalog.json`); XGBoost gets float32.
  Reasons are computed for the top 2,000 alerts (SHAP) or top 300 (feature replacement).
- `backend/models/catalog.json`: seven detectors (`unsw-xgboost` default, `cic-xgboost`, `unsw-lr`, `unsw-dt`,
  `unsw-rf`, `unsw-lgbm2`, `unsw-mlp`) with metrics, speed and explanation method.
- Frontend design: ink #1d2733, paper #f3f6f8, signal blue #2a78d6 and alert orange #eb6834 (same as the paper's
  figures), calm #9fb7cf, track #e3e9ef; IBM Plex Sans for text, IBM Plex Mono only for machine values (feature names,
  addresses, probabilities). The signature element is the flow strip (`FlowStrip.jsx`): each canvas column is a run of
  consecutive flows, its height the highest attack probability in the run, orange when it reaches the threshold, a dashed
  threshold line that follows the slider, and a lower band marking the file's labelled attacks. Avoid all-caps labels,
  identical card grids and decorative motion.
- The threshold slider recomputes counts and the strip in the browser from the returned per-flow scores; reasons and
  the alert list refresh only on a new run (the page says so).
- Hosting later: frontend on Vercel; backend as a Vercel Python function or on a separate host. Vercel limits request
  and response bodies to 4.5 MB (hence the 5,000-flow samples); set `ALLOWED_ORIGINS` and `VITE_API_URL` accordingly.
