# Python image for the api + agents Railway services (Root Directory = repo root "/").
# The web service builds from apps/web with its own railway.json and does NOT use this file.
# railway.api.json / railway.agents.json force builder=DOCKERFILE and override the start command.
FROM python:3.13-slim

# Toolchain for any deps without wheels; curl for healthchecks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copy the repo (apps/web + node_modules excluded via .dockerignore) and resolve the whole
# uv workspace into /app/.venv. --all-packages installs every member so the API can import
# the agents package in-process and httpx is present at runtime.
COPY . /app
RUN uv sync --all-packages

# Default = api. The agents service overrides this via railway.agents.json startCommand.
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
