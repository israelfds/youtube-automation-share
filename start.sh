#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source venv/bin/activate

echo "[START] Starting infrastructure..."
docker compose up -d

PORT="${PORT:-7070}"
echo "[START] Starting server on http://localhost:$PORT"
uvicorn backend.main:app --host 0.0.0.0 --port "$PORT" --reload
