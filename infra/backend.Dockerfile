FROM python:3.12-slim
WORKDIR /srv/backend
COPY backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/app ./app
RUN useradd --create-home ledger
USER ledger
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s CMD python -c "import os, urllib.request; port = int(os.environ.get('PORT', '8000')); urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health/ready', timeout=8)"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --no-access-log"]
