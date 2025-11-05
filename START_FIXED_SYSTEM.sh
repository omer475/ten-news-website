#!/bin/bash

echo "============================================================"
echo "🛑 STOPPING OLD PROCESSES"
echo "============================================================"
pkill -9 -f "main.py"
sleep 3

echo ""
echo "============================================================"
echo "🚀 STARTING FIXED RSS + AI SYSTEM"
echo "============================================================"
echo ""
echo "✅ Fixes Applied:"
echo "   • Details section with Perplexity + Claude fallback"
echo "   • Timeline with Perplexity + Claude fallback"
echo "   • Title optimization with logging"
echo "   • Enhanced error handling"
echo ""

cd "/Users/omersogancioglu/Ten news website "

# Load API Keys from .env file or environment
if [ -f ".env" ]; then
    source .env
fi

# Check if API keys are set
if [ -z "$CLAUDE_API_KEY" ] || [ -z "$GOOGLE_API_KEY" ] || [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "❌ ERROR: API keys not configured!"
    echo "Set CLAUDE_API_KEY, GOOGLE_API_KEY, and PERPLEXITY_API_KEY in your environment or .env file"
    exit 1
fi

python3 main.py > fixed_system.log 2>&1 &
MAIN_PID=$!

echo "✅ System started (PID: $MAIN_PID)"
echo ""
echo "============================================================"
echo "📋 CONFIGURATION"
echo "============================================================"
echo "  • AI Model: Gemini 2.5 Flash"
echo "  • Min Score: 85"
echo "  • RSS Fetcher: Every 10 minutes"
echo "  • AI Filter: Every 5 minutes"
echo "  • Timeline: Perplexity → Claude fallback"
echo "  • Details: Perplexity → Claude fallback"
echo "  • Title: Claude optimization (4-10 words)"
echo "  • Summary: Claude (35-40 words)"
echo ""
echo "============================================================"
echo "📊 MONITOR LOGS"
echo "============================================================"
echo ""
echo "Watch live logs:"
echo "  tail -f fixed_system.log"
echo ""
echo "Check for high scores:"
echo "  grep 'Score: [89]' fixed_system.log"
echo ""
echo "See published articles:"
echo "  grep '✅ Published' fixed_system.log"
echo ""
echo "============================================================"
echo "✨ System is running! Press Ctrl+C to stop monitoring."
echo "============================================================"
echo ""

# Show live feed for 30 seconds
timeout 30 tail -f fixed_system.log || tail -f fixed_system.log

