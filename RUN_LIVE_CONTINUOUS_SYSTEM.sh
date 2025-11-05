#!/bin/bash

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "============================================================"
echo "🚀 TEN NEWS - LIVE CONTINUOUS SYSTEM"
echo "============================================================"
echo ""
echo "📊 This system will:"
echo "   📰 Fetch RSS feeds every 10 minutes"
echo "   🤖 Process NEW articles only (not existing ones)"
echo "   ✍️ Generate AI content (timeline, details, etc.)"
echo "   🌍 Publish to Supabase (https://tennews.ai)"
echo "   🔄 Run continuously until stopped"
echo ""
echo "🛑 Press Ctrl+C to stop the system"
echo "============================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "live_news_system.py" ]; then
    echo "❌ Error: live_news_system.py not found"
    echo "Make sure you're in the correct directory"
    exit 1
fi

# Check if database exists
if [ ! -f "ten_news.db" ]; then
    echo "❌ Error: ten_news.db not found"
    echo "Run your RSS fetcher first to populate the database"
    exit 1
fi

# Check if required Python packages are installed
echo "🔍 Checking Python dependencies..."
python3 -c "import requests, json, sqlite3" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Missing required Python packages"
    echo "Installing requirements..."
    pip3 install requests
fi

echo "✅ All requirements met"
echo ""

# Load environment variables
echo "🔧 Loading environment variables..."
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env file"
else
    echo "⚠️  No .env file found - using system environment variables"
fi

# Set required API keys
export GEMINI_API_KEY="${GEMINI_API_KEY}"
export SCRAPINGBEE_API_KEY="${SCRAPINGBEE_API_KEY}"
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
export SUPABASE_URL="${SUPABASE_URL}"
export SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"

echo "✅ Environment variables set"
echo ""

echo "============================================================"
echo "🚀 STARTING LIVE CONTINUOUS SYSTEM"
echo "============================================================"
echo ""

# Run the live system
python3 live_news_system.py

# Check if system stopped gracefully
if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ LIVE SYSTEM STOPPED GRACEFULLY"
    echo "============================================================"
    echo ""
    echo "📊 Check the output above for final statistics"
    echo "🌍 Your articles are live on: https://tennews.ai"
    echo ""
else
    echo ""
    echo "============================================================"
    echo "❌ LIVE SYSTEM STOPPED WITH ERRORS"
    echo "============================================================"
    echo ""
    echo "Check the error messages above for details"
    echo ""
fi
