#!/bin/sh
set -eu

MODEL_REPO="${MODEL_REPO:-IndexTeam/Index-Translate-2B-GGUF}"
MODEL_REVISION="${MODEL_REVISION:-master}"
MODEL_FILE="${MODEL_FILE:-Index-Translate-2B.Q4_K_M.gguf}"
MODEL_ALIAS="${MODEL_ALIAS:-Index-Translate-2B}"
MODEL_BASE_URL="${MODEL_BASE_URL:-https://modelscope.cn/models}"
CONTEXT_SIZE="${CONTEXT_SIZE:-8192}"
MODEL_PATH="/models/$MODEL_FILE"

if [ ! -f "$MODEL_PATH" ]; then
  MODEL_URL="$MODEL_BASE_URL/$MODEL_REPO/resolve/$MODEL_REVISION/$MODEL_FILE"
  echo "Downloading model: $MODEL_URL"
  curl -fL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 20 --continue-at - "$MODEL_URL" -o "$MODEL_PATH.part"
  if [ "$(head -c 4 "$MODEL_PATH.part")" != "GGUF" ]; then
    echo "Downloaded file is not a valid GGUF model." >&2
    exit 1
  fi
  mv "$MODEL_PATH.part" "$MODEL_PATH"
fi

exec /app/llama-server \
  --model "$MODEL_PATH" \
  --alias "$MODEL_ALIAS" \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size "$CONTEXT_SIZE" \
  --reasoning off
