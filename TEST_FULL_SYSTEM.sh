#!/bin/bash

# ============================================================
# 🧪 TEN NEWS - FULL SYSTEM TEST
# Tests: RSS → AI Scoring → Details → Timeline → Photos → Publish
# ============================================================

cd "/Users/omersogancioglu/Ten news website "

echo "============================================================"
echo "🧪 TEN NEWS - FULL SYSTEM TEST"
echo "============================================================"
echo ""
echo "This will:"
echo "  1. ✅ Fetch RSS feeds (158 sources)"
echo "  2. ✅ Score articles with AI (Gemini) - min score: 80"
echo "  3. ✅ Generate 35-40 word summaries (Claude)"
echo "  4. ✅ Generate timeline events (Claude)"
echo "  5. ✅ Generate 3 key details (Claude)"
echo "  6. ✅ Extract photos (7 methods)"
echo "  7. ✅ Push to Supabase → tennews.ai"
echo ""
echo "============================================================"
echo ""

# Check for Supabase credentials
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "⚠️  Supabase not configured (articles won't publish to tennews.ai)"
    echo ""
    echo "To publish to tennews.ai, set:"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_SERVICE_KEY='your-service-key'"
    echo ""
    echo "Continue anyway to test locally? (y/n)"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
    PUBLISH_TO_SUPABASE=false
else
    echo "✅ Supabase configured: $SUPABASE_URL"
    PUBLISH_TO_SUPABASE=true
fi

# Check API Keys
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
echo ""

# Create logs directory
mkdir -p logs

# Kill any existing processes
echo "🧹 Cleaning up old processes..."
pkill -f "python3 main.py" 2>/dev/null
sleep 2
echo ""

echo "============================================================"
echo "🚀 STARTING RSS FETCHER & AI FILTER"
echo "============================================================"
echo ""

# Start the system
python3 main.py > logs/test_run.log 2>&1 &
MAIN_PID=$!

echo "✅ System started (PID: $MAIN_PID)"
echo "📊 Log: logs/test_run.log"
echo ""

# Monitor the log
echo "============================================================"
echo "📊 MONITORING PROGRESS (Live Feed)"
echo "============================================================"
echo ""
echo "Press Ctrl+C to stop monitoring (system will keep running)"
echo ""

# Show live progress
tail -f logs/test_run.log &
TAIL_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo ""
    echo "============================================================"
    echo "🛑 STOPPING TEST"
    echo "============================================================"
    kill $TAIL_PID 2>/dev/null
    kill $MAIN_PID 2>/dev/null
    echo ""
    
    # Show summary
    echo "============================================================"
    echo "📊 TEST SUMMARY"
    echo "============================================================"
    
    # Count published articles
    if [ -f "ten_news.db" ]; then
        PUBLISHED=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles WHERE published = TRUE" 2>/dev/null || echo "0")
        TOTAL=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles" 2>/dev/null || echo "0")
        
        echo "📰 Articles in database:"
        echo "   Total fetched: $TOTAL"
        echo "   Published (score ≥80): $PUBLISHED"
        echo ""
        
        if [ "$PUBLISHED" -gt 0 ]; then
            echo "🏆 Top 5 Articles:"
            sqlite3 ten_news.db "SELECT ai_final_score, title FROM articles WHERE published = TRUE ORDER BY ai_final_score DESC LIMIT 5" 2>/dev/null | while read line; do
                echo "   $line"
            done
            echo ""
        fi
    fi
    
    # Push to Supabase if configured
    if [ "$PUBLISH_TO_SUPABASE" = true ] && [ "$PUBLISHED" -gt 0 ]; then
        echo "============================================================"
        echo "📤 PUSHING TO TENNEWS.AI"
        echo "============================================================"
        echo ""
        python3 push_to_supabase.py
        echo ""
        echo "✅ Articles pushed! Check https://tennews.ai"
    elif [ "$PUBLISH_TO_SUPABASE" = false ] && [ "$PUBLISHED" -gt 0 ]; then
        echo "💡 To publish to tennews.ai, run:"
        echo "   export SUPABASE_URL='...'"
        echo "   export SUPABASE_SERVICE_KEY='...'"
        echo "   python3 push_to_supabase.py"
    fi
    
    echo ""
    echo "============================================================"
    echo "📁 REVIEW LOGS"
    echo "============================================================"
    echo "   cat logs/test_run.log"
    echo ""
    echo "============================================================"
    
    exit 0
}

trap cleanup INT TERM

# Wait for user to stop (or auto-stop after 10 minutes)
sleep 600 &
wait $!

# Auto cleanup after 10 minutes
cleanup

