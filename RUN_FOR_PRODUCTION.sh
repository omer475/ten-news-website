#!/bin/bash

# 🚀 RUN LOCALLY - PUBLISH TO TENNEWS.AI
# This script runs everything locally but pushes articles to Supabase
# so they appear on your live website (tennews.ai)

echo "============================================================"
echo "🚀 TEN NEWS - LOCAL RUN → LIVE WEBSITE"
echo "============================================================"
echo ""

# Check if Supabase credentials are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ ERROR: Supabase credentials not set!"
    echo ""
    echo "Please set these environment variables:"
    echo "  export SUPABASE_URL='your-supabase-url'"
    echo "  export SUPABASE_SERVICE_KEY='your-service-key'"
    echo ""
    exit 1
fi

# Check if API keys are set
if [ -z "$CLAUDE_API_KEY" ] || [ -z "$GOOGLE_API_KEY" ] || [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "❌ ERROR: API keys not set!"
    echo ""
    echo "Please set these environment variables first:"
    echo "  export CLAUDE_API_KEY='your-key'"
    echo "  export GOOGLE_API_KEY='your-key'"
    echo "  export PERPLEXITY_API_KEY='your-key'"
    echo ""
    exit 1
fi

echo "✅ API Keys configured"
echo "✅ Supabase configured"
echo ""

# Create logs directory
mkdir -p logs

echo "🌐 Starting RSS Fetcher & AI Filter..."
python3 main.py > logs/rss.log 2>&1 &
RSS_PID=$!
echo "   PID: $RSS_PID"
sleep 5

echo ""
echo "============================================================"
echo "📤 PUSHING ARTICLES TO SUPABASE"
echo "============================================================"
echo ""

# Push articles every 5 minutes
while true; do
    python3 push_to_supabase.py
    echo ""
    echo "😴 Waiting 5 minutes before next push..."
    echo "   (RSS Fetcher runs every 10 minutes)"
    echo "   (AI Filter runs every 5 minutes)"
    echo ""
    sleep 300  # 5 minutes
done

# Cleanup on exit
trap "kill $RSS_PID 2>/dev/null; echo ''; echo '🛑 Stopped'; exit" INT TERM

