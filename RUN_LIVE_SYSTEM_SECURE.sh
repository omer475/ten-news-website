#!/bin/bash
# TEN NEWS - LIVE NEWS SYSTEM (SECURE VERSION)
# Complete RSS → AI → Website pipeline that runs every 5 minutes
# Uses .env file for secure API key management

echo "=================================="
echo "TEN NEWS - LIVE SYSTEM (SECURE)"
echo "=================================="
echo "Starting complete news pipeline..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables from .env
echo "🔐 Loading environment variables..."
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/load_env.sh"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to load environment variables"
        exit 1
    fi
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found!"
    echo ""
    echo "Please run: ./setup_env.sh"
    echo "Or manually create .env file with your API keys"
    exit 1
fi

# Validate Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 not found. Please install Python 3."
    exit 1
fi

# Check if main.py exists
if [ ! -f "main.py" ]; then
    echo "❌ main.py not found in current directory"
    exit 1
fi

# Kill any existing instances
echo ""
echo "🧹 Cleaning up old processes..."
pkill -9 -f "main.py" 2>/dev/null
sleep 3

# Create logs directory
mkdir -p logs

# Start the system in background
LOG_FILE="logs/live_system_$(date +%Y%m%d_%H%M%S).log"

echo ""
echo "🚀 Starting Live News System..."
echo "📝 Logging to: $LOG_FILE"
echo ""
echo "System will:"
echo "  1. Fetch RSS feeds (every 5 min)"
echo "  2. AI process articles (score, enhance, publish)"
echo "  3. Generate JSON for website"
echo "  4. Repeat continuously"
echo ""

# Run in background
nohup python3 main.py > "$LOG_FILE" 2>&1 &
PID=$!

echo "✅ System started!"
echo "   Process ID: $PID"
echo "   Log file: $LOG_FILE"
echo ""
echo "Commands:"
echo "  View logs: tail -f $LOG_FILE"
echo "  Stop system: kill $PID"
echo "  Or: pkill -f main.py"
echo ""
echo "🔒 Security: API keys loaded from .env (not visible in process list)"
echo ""

