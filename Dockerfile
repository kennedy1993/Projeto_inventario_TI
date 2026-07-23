# ==============================================================================
# Dockerfile - ITAM Avanço Construções
# Build multi-stage: compila o frontend React e serve tudo por um único
# processo FastAPI (backend/APP.PY monta web/dist como estático em "/").
# ==============================================================================

# --- Stage 1: build do frontend (React + Vite) ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: backend (FastAPI) servindo API + estáticos do frontend ---
FROM python:3.11-slim AS backend
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# O arquivo é "APP.PY" (extensão maiúscula) — funciona no Windows (case-insensitive)
# mas o Linux do container é case-sensitive, então "import APP" não encontraria o
# módulo sem essa cópia com o nome exato que o Python espera.
RUN cp APP.PY APP.py
COPY --from=frontend-build /app/web/dist /app/web/dist

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "APP:app", "--host", "0.0.0.0", "--port", "8000"]
