#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== automation-youtube setup ==="

# ── 1. Detect OS ──────────────────────────────────────────────────────────────
OS="$(uname -s)"

# ── 2. Detect GPU ─────────────────────────────────────────────────────────────
GPU_BACKEND="cpu"
LLAMA_CMAKE_ARGS=""

if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null 2>&1; then
    echo "[GPU] NVIDIA detected → CUDA backend"
    GPU_BACKEND="cuda"
    LLAMA_CMAKE_ARGS="-DGGML_CUDA=ON"
elif [[ "$OS" == "Darwin" ]]; then
    echo "[GPU] macOS detected → Metal backend"
    GPU_BACKEND="metal"
    LLAMA_CMAKE_ARGS="-DGGML_METAL=ON"
else
    echo "[GPU] No discrete GPU → CPU backend"
    GPU_BACKEND="cpu"
fi

# ── 3. .env setup — must happen BEFORE docker compose ─────────────────────────
if [ ! -f ".env" ]; then
    MINIO_PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9_@#' < /dev/urandom | head -c 24)"
    sed "s/sua_senha_minio_aqui/$MINIO_PASS/" .env.example > .env
    echo "[ENV] .env created with random MinIO password."
fi

# Stamp GPU_BACKEND into .env
if grep -q "^GPU_BACKEND=" .env; then
    sed -i.bak "s/^GPU_BACKEND=.*/GPU_BACKEND=$GPU_BACKEND/" .env && rm -f .env.bak
else
    echo "GPU_BACKEND=$GPU_BACKEND" >> .env
fi

# ── 4. System dependencies ────────────────────────────────────────────────────
if [[ "$OS" == "Linux" ]]; then
    echo "[SYS] Installing system packages..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq ffmpeg curl git python3-venv python3-pip
elif [[ "$OS" == "Darwin" ]]; then
    if ! command -v brew &>/dev/null; then
        echo "[ERROR] Homebrew required. Install: https://brew.sh"
        exit 1
    fi
    # Skip ffmpeg if already installed (may come from a different tap)
    command -v ffmpeg &>/dev/null || brew install ffmpeg
    brew install curl git python3
fi

# ── 5. Python venv ────────────────────────────────────────────────────────────
if [ ! -d "venv" ]; then
    echo "[PY] Creating virtualenv..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip -q

# ── 6. Python requirements ────────────────────────────────────────────────────
echo "[PY] Installing requirements..."
pip install -r requirements.txt -q

if [[ "$GPU_BACKEND" == "cuda" ]]; then
    echo "[PY] Installing PyTorch CUDA 12.1..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 -q
else
    echo "[PY] Installing PyTorch CPU..."
    pip install torch -q
fi

# Optional: llama-cpp-python
echo ""
read -r -p "[LLAMA] Install llama-cpp-python for local LLM? (y/N): " INSTALL_LLAMA
if [[ "$INSTALL_LLAMA" =~ ^[Yy]$ ]]; then
    echo "[LLAMA] Building with CMAKE_ARGS=\"$LLAMA_CMAKE_ARGS\"..."
    CMAKE_ARGS="$LLAMA_CMAKE_ARGS" pip install llama-cpp-python --no-cache-dir -q
    echo "[LLAMA] Done."
fi

# ── 7. Frontend build ─────────────────────────────────────────────────────────
echo "[FE] Installing frontend dependencies..."
cd frontend
npm install --silent
echo "[FE] Building frontend..."
npm run build --silent
cd ..

# ── 8. Start infrastructure ───────────────────────────────────────────────────
echo "[DOCKER] Starting MongoDB and MinIO..."
docker compose up -d

echo "[DOCKER] Waiting for MongoDB..."
until docker inspect autoyt-mongodb --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
    sleep 2; printf "."
done
echo " ready."

echo "[DOCKER] Waiting for MinIO..."
until docker inspect autoyt-minio --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
    sleep 2; printf "."
done
echo " ready."

# ── 9. Create MinIO bucket ────────────────────────────────────────────────────
_MINIO_USER="$(grep '^MINIO_ACCESS_KEY=' .env | cut -d= -f2)"
_MINIO_PASS="$(grep '^MINIO_SECRET_KEY=' .env | cut -d= -f2)"

echo "[MINIO] Creating bucket 'automation-yt'..."
if [[ "$OS" == "Darwin" ]]; then
    # On macOS --network=host doesn't work in Docker Desktop; use host.docker.internal
    docker run --rm \
        minio/mc:latest \
        alias set local http://host.docker.internal:9100 "$_MINIO_USER" "$_MINIO_PASS" --quiet 2>/dev/null || true
    docker run --rm \
        minio/mc:latest \
        mb local/automation-yt --ignore-existing --quiet 2>/dev/null || true
else
    docker run --rm --network=host \
        minio/mc:latest \
        alias set local http://localhost:9100 "$_MINIO_USER" "$_MINIO_PASS" --quiet 2>/dev/null || true
    docker run --rm --network=host \
        minio/mc:latest \
        mb local/automation-yt --ignore-existing --quiet 2>/dev/null || true
fi
echo "[MINIO] Bucket ready."

# ── 10. Final touches ─────────────────────────────────────────────────────────
touch backend/__init__.py
touch backend/pipeline/__init__.py
touch backend/routers/__init__.py

echo ""
echo "========================================="
echo "  Setup completo!"
echo "  GPU backend : $GPU_BACKEND"
echo "  Run         : ./start.sh"
echo "  URL         : http://localhost:7070"
echo "  MinIO UI    : http://localhost:9101"
echo "========================================="
