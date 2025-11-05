#!/bin/bash

# ============================================================
# 🚀 TEN NEWS - COMPLETE SYSTEM
# Generates news + Publishes to tennews.ai
# ============================================================

echo "============================================================"
echo "🚀 TEN NEWS - GENERATING & PUBLISHING TO TENNEWS.AI"
echo "============================================================"
echo ""

# ============================================================
# STEP 1: Set API Keys
# ============================================================

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

echo "✅ API Keys configured (Claude, Gemini, Perplexity)"
echo ""

# ============================================================
# STEP 2: Set Supabase Credentials
# ============================================================
# IMPORTANT: You need to set these!
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ ERROR: Supabase credentials not set!"
    echo ""
    echo "Please run these commands first:"
    echo "  export SUPABASE_URL='https://your-project-id.supabase.co'"
    echo "  export SUPABASE_SERVICE_KEY='your-service-role-key'"
    echo ""
    echo "Then run this script again."
    echo ""
    exit 1
fi

echo "✅ Supabase configured"
echo "   URL: $SUPABASE_URL"
echo ""

# ============================================================
# STEP 3: Check if system is already running
# ============================================================
if pgrep -f "python3 main.py" > /dev/null; then
    echo "✅ RSS System already running"
    echo ""
else
    echo "🌐 Starting RSS Fetcher & AI Filter..."
    mkdir -p logs
    python3 main.py > logs/rss_system.log 2>&1 &
    RSS_PID=$!
    echo "   PID: $RSS_PID"
    echo "   Log: logs/rss_system.log"
    echo ""
    echo "⏳ Waiting 10 seconds for system to start..."
    sleep 10
fi

# ============================================================
# STEP 4: Push existing articles to Supabase
# ============================================================
echo "============================================================"
echo "📤 PUSHING ARTICLES TO SUPABASE (tennews.ai)"
echo "============================================================"
echo ""

python3 push_to_supabase.py

echo ""
echo "============================================================"
echo "✅ SYSTEM RUNNING!"
echo "============================================================"
echo ""
echo "📊 Status:"
echo "   • RSS Fetcher: Running (every 10 minutes)"
echo "   • AI Filter: Running (every 5 minutes)"
echo "   • Articles: Publishing to Supabase"
echo ""
echo "🌐 Check your website:"
echo "   https://tennews.ai"
echo ""
echo "📁 Logs:"
echo "   tail -f logs/rss_system.log"
echo ""
echo "============================================================"
echo ""
echo "Would you like to set up automatic pushing? (y/n)"
read -r SETUP_AUTO

if [[ "$SETUP_AUTO" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Setting up automatic push every 5 minutes..."
    echo ""
    
    # Run push in a loop
    while true; do
        echo "============================================================"
        echo "📤 Auto-pushing articles to Supabase..."
        echo "============================================================"
        python3 push_to_supabase.py
        echo ""
        echo "😴 Waiting 5 minutes before next push..."
        echo "   (Press Ctrl+C to stop)"
        echo ""
        sleep 300
    done
else
    echo "💡 To push new articles later, run:"
    echo "   python3 push_to_supabase.py"
    echo ""
fi

