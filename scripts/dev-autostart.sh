#!/bin/zsh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/xiaowu/play/remnote++

cleanup() {
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

NODE_BIN="$(dirname "$(which node)")"
export PATH="$NODE_BIN:$PWD/node_modules/.bin:$PATH"

echo "[autostart] starting clipboard-bridge..."
node scripts/clipboard-bridge.js &
sleep 1

echo "[autostart] starting webpack-dev-server..."
exec cross-env NODE_ENV=development webpack-dev-server --color --progress --no-open
