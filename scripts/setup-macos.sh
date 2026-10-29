#!/bin/bash
set -euo pipefail

PORT="${K7_TRANS_PORT:-8000}"
LLAMA_VERSION="${LLAMA_VERSION:-b11941}"
LLAMA_INSTALL_REPO="${LLAMA_INSTALL_REPO:-https://hf-mirror.com/buckets/ggml-org/install.sh/resolve}"
MODEL_REPO="${MODEL_REPO:-IndexTeam/Index-Translate-2B-GGUF}"
MODEL_REVISION="${MODEL_REVISION:-master}"
MODEL_FILE="${MODEL_FILE:-Index-Translate-2B.Q4_K_M.gguf}"
MODEL_ALIAS="${MODEL_ALIAS:-Index-Translate-2B}"
MODEL_BASE_URL="${MODEL_BASE_URL:-https://modelscope.cn/models}"
CONTEXT_SIZE="${CONTEXT_SIZE:-8192}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime/macos"
MODEL_DIR="$ROOT_DIR/.runtime/models"
BINARY="$RUNTIME_DIR/llama"
MODEL_PATH="$MODEL_DIR/$MODEL_FILE"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数：$1。用法：$0 [--port 8000]" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "此脚本仅支持 macOS。" >&2
  exit 1
fi
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "端口必须是 1024–65535 之间的整数。" >&2
  exit 2
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 已被占用，请使用 --port 指定其他端口。" >&2
  exit 1
fi
for command in curl lsof; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "缺少依赖：$command" >&2
    exit 1
  fi
done

mkdir -p "$RUNTIME_DIR" "$MODEL_DIR"
if [[ ! -x "$BINARY" ]]; then
  echo "安装 llama.cpp ${LLAMA_VERSION}（优先 Metal）…"
  INSTALLER="$(mktemp)"
  trap 'rm -f "$INSTALLER"' EXIT
  curl -fsSL https://llama.app/install.sh -o "$INSTALLER"
  if ! sed "s|^REPO=.*|REPO=\"$LLAMA_INSTALL_REPO\"|" "$INSTALLER" | LLAMA_VERSION="$LLAMA_VERSION" SKIP_INSTALL=1 sh; then
    echo "Metal 安装失败，尝试 CPU 版本…"
    sed -e "s|^REPO=.*|REPO=\"$LLAMA_INSTALL_REPO\"|" -e 's/probe_metal ;;/probe_cpu ;;/' "$INSTALLER" | LLAMA_VERSION="$LLAMA_VERSION" SKIP_INSTALL=1 sh
  fi
  cp "$HOME/.llama-app/llama" "$BINARY"
  chmod +x "$BINARY"
  rm -f "$INSTALLER"
  trap - EXIT
fi

if [[ ! -f "$MODEL_PATH" ]]; then
  MODEL_URL="$MODEL_BASE_URL/$MODEL_REPO/resolve/$MODEL_REVISION/$MODEL_FILE"
  echo "下载模型：$MODEL_URL"
  curl -fL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 20 --continue-at - "$MODEL_URL" -o "$MODEL_PATH.part"
  if [[ "$(head -c 4 "$MODEL_PATH.part")" != "GGUF" ]]; then
    echo "下载内容不是有效的 GGUF 文件。" >&2
    exit 1
  fi
  mv "$MODEL_PATH.part" "$MODEL_PATH"
fi

echo "启动 ${MODEL_ALIAS}，地址：http://127.0.0.1:$PORT/v1"
"$BINARY" serve \
  --model "$MODEL_PATH" \
  --alias "$MODEL_ALIAS" \
  --host 127.0.0.1 \
  --port "$PORT" \
  --ctx-size "$CONTEXT_SIZE" \
  --reasoning off &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

for _ in {1..120}; do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "模型服务已就绪。按 Ctrl+C 停止。"
    wait "$SERVER_PID"
    exit $?
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "模型服务启动失败，请检查上方日志。" >&2
    exit 1
  fi
  sleep 1
done

echo "等待模型服务超时。" >&2
exit 1
