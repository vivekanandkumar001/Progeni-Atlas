FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y --auto-remove build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --system --create-home --uid 10001 appuser
RUN mkdir -p /app/uploads /app/recordings /app/data && chown -R appuser:appuser /app

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8406

HEALTHCHECK --interval=30s \
    --timeout=5s \
    --start-period=30s \
    --retries=3 \
    CMD curl -fsS http://127.0.0.1:8406/health || exit 1

CMD ["gunicorn", "wsgi:app", "--worker-class", "sync", "--workers", "2", "--timeout", "300", "--graceful-timeout", "60", "--bind", "0.0.0.0:8406", "--access-logfile", "-", "--error-logfile", "-"]
