FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY migrations/alembic.ini ./migrations/alembic.ini
COPY migrations/env.py ./migrations/env.py
COPY migrations/script.py.mako ./migrations/script.py.mako
COPY migrations/versions/ ./migrations/versions/
COPY run.py .
COPY docker-entrypoint.sh .

RUN mkdir -p /tmp/wittle_pdfs /var/log/wittle \
    && chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--timeout", "120", \
     "app:create_app('production')"]