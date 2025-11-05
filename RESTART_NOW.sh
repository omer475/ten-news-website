#!/bin/bash

cd "/Users/omersogancioglu/Ten news website "

echo "🔄 Restarting with Gemini 1.5 Flash (higher quota)..."

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

# Check Supabase
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Set Supabase credentials first:"
    echo "   export SUPABASE_URL='...'"
    echo "   export SUPABASE_SERVICE_KEY='...'"
    exit 1
fi

# Kill old
pkill -f "python3 main.py" 2>/dev/null
sleep 2

# Start new
mkdir -p logs
echo "✅ Starting system..."
python3 main.py > logs/system.log 2>&1 &
echo "✅ Started! PID: $!"
echo ""
echo "📊 Monitor: tail -f logs/system.log"
echo "🛑 Stop: pkill -f 'python3 main.py'"

