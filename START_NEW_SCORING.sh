#!/bin/bash

echo "============================================================"
echo "🛑 STOPPING OLD PROCESSES"
echo "============================================================"
pkill -9 -f "main.py"
sleep 3

echo ""
echo "============================================================"
echo "🚀 STARTING NEW SHAREABILITY-FOCUSED SYSTEM"
echo "============================================================"
echo ""
echo "✨ NEW SCORING SYSTEM:"
echo "   • 60 points: Shareability (smart, cool, interesting)"
echo "   • 25 points: Global Appeal (universal, cross-cultural)"
echo "   • 10 points: Interest & Novelty"
echo "   •  5 points: News Relevance"
echo "   •  3 points: Content Quality"
echo "   •  2 points: Engagement"
echo ""
echo "🎯 NEW THRESHOLD: 55+ points (was 85)"
echo ""
echo "⚠️  AUTOMATIC PENALTIES:"
echo "   • -20 pts: Hyper-local news (city, weather, regional)"
echo "   • -20 pts: Single-country politics (no global impact)"
echo ""
echo "🎁 AUTOMATIC BONUSES:"
echo "   • +10 pts: Scientific breakthroughs, global health, space"
echo "   • +5 pts: Data viz, exclusive research"
echo ""

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

python3 main.py > shareability_system.log 2>&1 &
MAIN_PID=$!

echo "✅ System started (PID: $MAIN_PID)"
echo ""
echo "============================================================"
echo "📋 CONFIGURATION"
echo "============================================================"
echo "  • AI Model: Gemini 2.5 Flash"
echo "  • Min Score: 55 (shareability-focused)"
echo "  • RSS Fetcher: Every 10 minutes"
echo "  • AI Filter: Every 5 minutes"
echo "  • Focus: Global, shareable, fascinating news"
echo ""
echo "============================================================"
echo "📊 MONITOR LOGS"
echo "============================================================"
echo ""
echo "Watch live logs:"
echo "  tail -f shareability_system.log"
echo ""
echo "Check for published articles (55+):"
echo "  grep '✅ Published' shareability_system.log"
echo ""
echo "See scores:"
echo "  grep 'Score:' shareability_system.log | tail -20"
echo ""
echo "============================================================"
echo "🌍 EXPECTING MORE GLOBAL, SHAREABLE NEWS!"
echo "============================================================"
echo ""
echo "With the new system, you should see:"
echo "  ✅ Scientific discoveries"
echo "  ✅ Technology breakthroughs"
echo "  ✅ Global health news"
echo "  ✅ Space exploration"
echo "  ✅ Nature & environment"
echo "  ✅ Psychology & human behavior"
echo ""
echo "  ❌ Local politics"
echo "  ❌ City news"
echo "  ❌ Regional sports"
echo "  ❌ Single-country issues"
echo ""

# Show live feed
tail -f shareability_system.log

