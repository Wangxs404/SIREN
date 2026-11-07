#!/bin/zsh
set -e
ROOT="${0:A:h}"
cd "$ROOT"
.venv/bin/python -m backend.run &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM
cd frontend
npm run dev -- --host 127.0.0.1
