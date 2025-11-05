#!/bin/bash

# ============================================================
# 🚀 RESTART TEN NEWS WITH FIXES
# Score 85, Title optimization, Timeline & Details fixed
# ============================================================

cd "/Users/omersogancioglu/Ten news website "

echo "============================================================"
echo "🔄 RESTARTING TEN NEWS SYSTEM (FIXED)"
echo "============================================================"
echo ""
echo "Changes:"
echo "  ✅ Minimum score: 85 (was 70)"
echo "  ✅ Title optimization: 4-10 words"
echo "  ✅ Timeline: Perplexity internet search"
echo "  ✅ Details: Perplexity internet search"
echo ""

# Check for Supabase credentials
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ ERROR: Supabase credentials not set!"
    echo ""
    echo "Please run these commands first:"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_SERVICE_KEY='your-service-key'"
    echo ""
    exit 1
fi

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

echo "✅ API Keys configured"
echo "✅ Supabase: $SUPABASE_URL"
echo ""

# Kill old processes
echo "🧹 Stopping old system..."
pkill -f "python3 main.py" 2>/dev/null
sleep 3
echo ""

# Create logs directory
mkdir -p logs

# Clear old database (optional - comment out to keep old articles)
# echo "🗑️  Clearing old articles..."
# sqlite3 ten_news.db "DELETE FROM articles WHERE published = FALSE"
# echo ""

# Start system
echo "🚀 Starting system..."
python3 main.py > logs/system.log 2>&1 &
MAIN_PID=$!

echo "✅ System started (PID: $MAIN_PID)"
echo "   📁 Log: logs/system.log"
echo ""

# Wait for first articles
echo "⏳ Waiting 30 seconds for first batch..."
sleep 30
echo ""

# Show live progress
echo "============================================================"
echo "📊 LIVE SYSTEM MONITOR"
echo "============================================================"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Monitor loop
while true; do
    echo "============================================================"
    echo "📊 Status at $(date +%H:%M:%S)"
    echo "============================================================"
    
    # Check database stats
    if [ -f "ten_news.db" ]; then
        TOTAL=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles" 2>/dev/null || echo "0")
        PUBLISHED=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles WHERE published = TRUE" 2>/dev/null || echo "0")
        WITH_TIMELINE=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles WHERE timeline_generated = TRUE" 2>/dev/null || echo "0")
        WITH_DETAILS=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles WHERE details_generated = TRUE" 2>/dev/null || echo "0")
        
        echo "📰 Articles:"
        echo "   Total: $TOTAL"
        echo "   Published (≥85): $PUBLISHED"
        echo "   With Timeline: $WITH_TIMELINE"
        echo "   With Details: $WITH_DETAILS"
        echo ""
    fi
    
    # Show latest log entries
    echo "📝 Recent activity:"
    tail -10 logs/system.log 2>/dev/null | grep -E "✅|📊|❌" | tail -5
    echo ""
    
    # Push to Supabase
    echo "📤 Pushing to tennews.ai..."
    python3 push_to_supabase.py 2>&1 | grep -E "Pushed|Skipped|Error" | head -3
    echo ""
    
    echo "⏰ Next update in 60 seconds..."
    echo ""
    
    sleep 60
done

# Cleanup
trap "kill $MAIN_PID 2>/dev/null; echo ''; echo '🛑 Stopped'; exit" INT TERM

