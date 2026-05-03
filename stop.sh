#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[STOP] Stopping uvicorn..."
pkill -f "uvicorn backend.main:app" 2>/dev/null || echo "  (not running)"

read -r -p "Stop MongoDB and MinIO containers? (y/N): " STOP_DOCKER
if [[ "$STOP_DOCKER" =~ ^[Yy]$ ]]; then
    docker compose down
    echo "[STOP] Containers stopped."
fi

echo "[STOP] Done."
