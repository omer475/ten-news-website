#!/bin/bash

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "============================================================"
echo "🚀 TEN NEWS - LIVE CLUSTERED NEWS SYSTEM"
echo "============================================================"
echo ""
echo "📊 This system will run the COMPLETE 8-STEP WORKFLOW:"
echo "   Step 0: 📰 Fetch RSS from 171 premium sources"
echo "   Step 1: 🎯 Score & filter with Gemini (≥70 points)"
echo "   Step 1.5: 🔗 Cluster similar events"
echo "   Step 2: 📡 Fetch full article text with Jina"
echo "   Step 3: 📸 Smart image selection (NEW)"
echo "   Step 4: ✍️  Synthesize multi-source articles with Claude"
echo "   Step 5: 🔍 Component selection & Perplexity search"
echo "   Steps 6-7: 📊 Generate components (timeline/details/graph)"
echo "   Step 8: 🌍 Publish to Supabase"
echo "   🔄 Repeat every 10 minutes"
echo ""
echo "🛑 Press Ctrl+C to stop the system"
echo "============================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "complete_clustered_8step_workflow.py" ]; then
    echo "❌ Error: complete_clustered_8step_workflow.py not found"
    echo "Make sure you're in the correct directory"
    exit 1
fi

# Check if required Python packages are installed
echo "🔍 Checking Python dependencies..."
python3 -c "import requests, feedparser, anthropic, supabase, dotenv" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Missing required Python packages"
    echo "Please install: pip3 install requests feedparser anthropic supabase python-dotenv"
    exit 1
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

# Verify required API keys
missing_keys=0
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ Missing GEMINI_API_KEY"
    missing_keys=1
fi
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Missing ANTHROPIC_API_KEY"
    missing_keys=1
fi
if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "❌ Missing PERPLEXITY_API_KEY"
    missing_keys=1
fi
if [ -z "$SCRAPINGBEE_API_KEY" ]; then
    echo "⚠️  Missing SCRAPINGBEE_API_KEY (will use Jina as fallback)"
fi
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Missing SUPABASE_URL"
    missing_keys=1
fi
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Missing SUPABASE_SERVICE_KEY"
    missing_keys=1
fi

if [ $missing_keys -eq 1 ]; then
    echo ""
    echo "❌ Please set all required API keys in .env file"
    exit 1
fi

echo "✅ All API keys found"
echo ""

echo "============================================================"
echo "🚀 STARTING LIVE CLUSTERED SYSTEM"
echo "============================================================"
echo ""

# Run the complete 8-step clustered system
python3 complete_clustered_8step_workflow.py

# Check if system stopped gracefully
if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ LIVE CLUSTERED SYSTEM STOPPED GRACEFULLY"
    echo "============================================================"
    echo ""
    echo "📊 Check your Supabase published_articles table"
    echo "🌍 Your synthesized articles are ready!"
    echo ""
else
    echo ""
    echo "============================================================"
    echo "❌ LIVE CLUSTERED SYSTEM STOPPED WITH ERRORS"
    echo "============================================================"
    echo ""
    echo "Check the error messages above for details"
    echo ""
fi

