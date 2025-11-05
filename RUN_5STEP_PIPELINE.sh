#!/bin/bash

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "============================================================"
echo "🚀 TEN NEWS - 5-STEP LIVE NEWS GENERATION PIPELINE"
echo "============================================================"
echo ""

echo "============================================================"
echo "🔑 STEP 1: SETTING UP API KEYS"
echo "============================================================"

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

echo "✅ Claude API configured"
echo "✅ Google Gemini API configured"
echo "✅ Perplexity API configured"
if [ -n "$SCRAPINGBEE_API_KEY" ]; then
    echo "✅ ScrapingBee API configured"
fi
echo ""

echo "============================================================"
echo "📋 STEP 2: CHECKING REQUIREMENTS"
echo "============================================================"

# Check if we're in the right directory
if [ ! -f "step1_gemini_news_scoring_filtering.py" ]; then
    echo "❌ Error: step1_gemini_news_scoring_filtering.py not found"
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

echo "============================================================"
echo "🚀 STEP 3: RUNNING 5-STEP PIPELINE"
echo "============================================================"
echo ""
echo "Pipeline Overview:"
echo "  📰 Step 0: Load RSS articles from database"
echo "  🤖 Step 1: Gemini scoring & filtering (0-1000 scale)"
echo "  📄 Step 2: ScrapingBee full article fetching"
echo "  🎯 Step 3: Gemini component selection (timeline, details, graph, map)"
echo "  🔍 Step 4: Perplexity dynamic context search"
echo "  ✍️ Step 5: Claude final writing & formatting"
echo ""

# Run the pipeline
python3 run_5step_pipeline.py

# Check if pipeline succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "🎉 PIPELINE COMPLETED SUCCESSFULLY!"
    echo "============================================================"
    echo ""
    echo "📁 Check the output file: 5step_pipeline_results_*.json"
    echo "🌍 Your articles are ready for publication!"
    echo ""
else
    echo ""
    echo "============================================================"
    echo "❌ PIPELINE FAILED!"
    echo "============================================================"
    echo ""
    echo "Check the error messages above for details"
    echo ""
fi
