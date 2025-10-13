#!/bin/bash

# Load API keys from environment or .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if required API keys are set
if [ -z "$CLAUDE_API_KEY" ] || [ -z "$GOOGLE_API_KEY" ] || [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "❌ Error: API keys not set!"
    echo "   Please set CLAUDE_API_KEY, GOOGLE_API_KEY, and PERPLEXITY_API_KEY"
    echo "   Either export them in your shell or create a .env file"
    exit 1
fi

echo "============================================================"
echo "🚀 TEN NEWS - FULL AUTO-DEPLOY SYSTEM"
echo "============================================================"
echo ""
echo "📊 What this does:"
echo "   1. ✅ Fetches RSS from 73 sources (every 10 min)"
echo "   2. ✅ Scores articles 0-1000 (threshold: 700+)"
echo "   3. ✅ Generates timelines & details with AI"
echo "   4. ✅ Exports to JSON (every 5 min)"
echo "   5. ✅ Auto-commits & pushes to GitHub"
echo "   6. ✅ Vercel auto-deploys → tennews.ai updates!"
echo ""
echo "👁️  You'll see EVERY step in real-time:"
echo "   • RSS feed fetching"
echo "   • Article scores (0-1000)"
echo "   • Approve/reject decisions"
echo "   • Publishing confirmations"
echo "   • GitHub pushes"
echo ""
echo "🌐 Your website will update automatically every 5 minutes!"
echo ""
echo "Press Ctrl+C to stop"
echo "============================================================"
echo ""

# Change to project directory
cd "/Users/omersogancioglu/Ten news website "

# Run main.py in background
python3 main.py &
MAIN_PID=$!

# Auto-export and deploy loop
(
    while true; do
        sleep 300  # Wait 5 minutes
        
        echo ""
        echo "========================================================================"
        echo "📤 AUTO-EXPORT & DEPLOY CYCLE"
        echo "========================================================================"
        
        # Export to JSON
        echo "📄 Exporting articles to JSON..."
        python3 export_to_json.py
        
        # Check if there are changes
        if git diff --quiet public/tennews_data_*.json; then
            echo "ℹ️  No new articles to deploy"
        else
            echo "📦 Committing changes..."
            git add public/tennews_data_*.json
            git commit -m "Auto-update news: $(date '+%Y-%m-%d %H:%M')" --quiet
            
            echo "🚀 Pushing to GitHub..."
            if git push --quiet; then
                echo "✅ DEPLOYED! Vercel is now updating tennews.ai..."
                echo "🌐 Your website will refresh in ~30 seconds"
            else
                echo "❌ Push failed - will retry in 5 minutes"
            fi
        fi
        
        echo "========================================================================"
        echo ""
    done
) &
DEPLOY_PID=$!

# Trap Ctrl+C to clean up
trap 'echo ""; echo "🛑 Stopping system..."; kill $MAIN_PID $DEPLOY_PID 2>/dev/null; echo "✅ System stopped"; exit' INT

# Wait for main process
wait $MAIN_PID
