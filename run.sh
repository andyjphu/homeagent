#!/bin/bash

# FoyerFind — run Next.js + Python browser agent locally
# Usage: ./run.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
AGENT_DIR="$ROOT_DIR/services/browser-agent"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $WEB_PID $AGENT_PID 2>/dev/null
  wait $WEB_PID $AGENT_PID 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# Check dependencies
if ! command -v node &>/dev/null; then
  echo -e "${RED}node not found. Install Node.js first.${NC}"
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}python3 not found. Install Python 3.10+ first.${NC}"
  exit 1
fi

# Install deps if needed
if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo -e "${YELLOW}Installing web dependencies...${NC}"
  (cd "$WEB_DIR" && npm install)
fi

if [ ! -d "$AGENT_DIR/.venv" ]; then
  echo -e "${YELLOW}Creating Python venv...${NC}"
  python3 -m venv "$AGENT_DIR/.venv"
  echo -e "${YELLOW}Installing Python dependencies...${NC}"
  "$AGENT_DIR/.venv/bin/pip" install -r "$AGENT_DIR/requirements.txt"
fi

echo -e "${GREEN}Starting FoyerFind...${NC}"
echo ""

# Start Python browser agent (port 8000)
echo -e "${GREEN}[browser-agent]${NC} http://localhost:8000"
(cd "$AGENT_DIR" && .venv/bin/python -m uvicorn main:app --port 8000) &
AGENT_PID=$!

# Start Next.js dev server (port 3000)
echo -e "${GREEN}[web]${NC}            http://localhost:3000"
(cd "$WEB_DIR" && npm run dev) &
WEB_PID=$!

echo ""
echo -e "${GREEN}Both services running. Press Ctrl+C to stop.${NC}"
echo ""

wait
