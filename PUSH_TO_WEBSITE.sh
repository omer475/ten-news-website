#!/bin/bash

# ============================================================
# 🚀 PUSH ARTICLES TO TENNEWS.AI - ONE COMMAND
# ============================================================

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

# Set Supabase credentials (passed as arguments)
export SUPABASE_URL="$1"
export SUPABASE_SERVICE_KEY="$2"

# Check if credentials provided
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ ERROR: Missing Supabase credentials!"
    echo ""
    echo "Usage:"
    echo "  ./PUSH_TO_WEBSITE.sh 'https://your-project.supabase.co' 'your-service-key'"
    echo ""
    exit 1
fi

echo "============================================================"
echo "🚀 PUSHING ARTICLES TO TENNEWS.AI"
echo "============================================================"
echo ""
echo "✅ API Keys configured"
echo "✅ Supabase: ${SUPABASE_URL}"
echo ""

# Push articles
python3 push_to_supabase.py

echo ""
echo "============================================================"
echo "✅ DONE! Check https://tennews.ai"
echo "============================================================"
