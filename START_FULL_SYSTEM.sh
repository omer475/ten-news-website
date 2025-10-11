#!/bin/bash

# 🚀 TEN NEWS - FULL SYSTEM STARTUP
# This script starts ALL components with API keys

echo "============================================================"
echo "🚀 STARTING TEN NEWS COMPLETE SYSTEM"
echo "============================================================"

# Set API Keys (REQUIRED for publishing)
export CLAUDE_API_KEY="sk-ant-api03-nJ8oJuqWGaW7uDdL6ySmdCwFdOv2k4F2xRNzx0GIXC3gPfCWwxuGUv64S_eBzJlLsUSowjBbnR5MiwMNHEXkiw-_chfHAAA"
export GOOGLE_API_KEY="AIzaSyA7uBIfcQ3CqE1m1Q2VqdGKpJOkQ7Yl50I"
export PERPLEXITY_API_KEY="pplx-4xC1FnBv46f7KaMp3GrvKZmN8l6YKuWe"

echo "✅ API Keys configured"
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

# Start RSS Fetcher & AI Filter (background)
echo "🌐 Starting RSS Fetcher & AI Filter..."
python3 main.py > logs/rss_fetcher.log 2>&1 &
RSS_PID=$!
echo "   PID: $RSS_PID"
echo "   Log: logs/rss_fetcher.log"
sleep 1

# Start Flask API Server (background)
echo ""
echo "🔌 Starting Flask API Server (port 5001)..."
python3 api.py > logs/api.log 2>&1 &
API_PID=$!
echo "   PID: $API_PID"
echo "   Log: logs/api.log"
sleep 2

# Check if Flask API is running
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "   ✅ Flask API is running!"
else
    echo "   ⚠️  Flask API not responding yet (may take a moment)"
fi

# Start Next.js Website (foreground - keeps terminal open)
echo ""
echo "🌐 Starting Next.js Website (port 3000)..."
echo "   Visit: http://localhost:3000"
echo ""
echo "============================================================"
echo "📊 SYSTEM STATUS"
echo "============================================================"
echo "RSS Fetcher PID: $RSS_PID"
echo "Flask API PID: $API_PID"
echo ""
echo "To view logs:"
echo "  tail -f logs/rss_fetcher.log"
echo "  tail -f logs/api.log"
echo ""
echo "To stop all services:"
echo "  kill $RSS_PID $API_PID"
echo "  (or run: pkill -f 'python3 main.py' && pkill -f 'python3 api.py')"
echo "============================================================"
echo ""
echo "Starting Next.js... (Press Ctrl+C to stop everything)"
echo ""

npm run dev

# When npm run dev stops (Ctrl+C), clean up background processes
echo ""
echo "🛑 Stopping background services..."
kill $RSS_PID $API_PID 2>/dev/null
echo "✅ All services stopped"

