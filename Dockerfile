# ── WC FEVER 2026 — single-container build ───────────────────────────────────
# Serves React frontend + Flask/XGBoost API from one process on port 7860.
# Designed for Hugging Face Spaces (Docker SDK) — free, no card required.

FROM python:3.10-slim

WORKDIR /app

# ── System deps: Node 18 for Vite build ──────────────────────────────────────
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# ── Python deps (cached layer — changes rarely) ───────────────────────────────
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# ── Build React frontend ──────────────────────────────────────────────────────
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
# No VITE_API_URL — frontend and backend share the same origin, so relative
# /api/* paths work directly without any env var.
RUN cd frontend && npm run build

# ── Copy backend (models, data, source) ──────────────────────────────────────
COPY backend/ ./backend/

# ── HF Spaces expects port 7860 ───────────────────────────────────────────────
EXPOSE 7860

# gunicorn: 1 worker keeps memory predictable on the free tier
CMD ["gunicorn", \
     "--chdir", "backend", \
     "app:app", \
     "--bind", "0.0.0.0:7860", \
     "--workers", "1", \
     "--timeout", "120"]
