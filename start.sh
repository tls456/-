#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [ ! -f node_modules/vite/bin/vite.js ]; then
  printf '%s\n' '먼저 프로젝트 폴더에서 corepack pnpm install 또는 npm install을 실행해 주세요.'
  exit 1
fi
exec node node_modules/vite/bin/vite.js --host 127.0.0.1 "$@"
