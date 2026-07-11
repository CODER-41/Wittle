#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${DB_HOST:-postgres}" -U "${DB_USER:-wittle_user}" -d "${DB_NAME:-wittle_db}"; do
  echo "PostgreSQL not ready yet — retrying in 2s..."
  sleep 2
done
echo "PostgreSQL is ready"

echo "Running database migrations..."
flask db upgrade head
echo "Migrations complete"

echo "Starting: $@"
exec "$@"
