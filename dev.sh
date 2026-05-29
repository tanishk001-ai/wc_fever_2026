#!/bin/bash
# World Cup Fever — start both dev servers
# Run from the project root: bash start_dev.sh

PROJECT="$(cd "$(dirname "$0")" && pwd)"

# ── Install Python deps ───────────────────────────────────────────────────────
echo "Installing Python dependencies..."
cd "$PROJECT/backend"
pip3 install -r requirements.txt --break-system-packages -q 2>&1 | tail -5

# ── Start Flask (foreground in this tab) ─────────────────────────────────────
echo ""
echo "Starting Flask backend on http://localhost:5000 ..."
python3 app.py &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Give Flask a moment to boot before Vite starts
sleep 2

# ── Install Node deps & start Vite ───────────────────────────────────────────
echo "Starting React frontend on http://localhost:5173 ..."
cd "$PROJECT/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "✓ Both servers running."
echo "  Flask  → http://localhost:5001/api/health"
echo "  Vite   → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'" EXIT
wait
