#!/bin/sh
set -e

mkdir -p /app/database

exec uv run uvicorn main:app --host 0.0.0.0 --port "${APP__PORT:-8000}"
