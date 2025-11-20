#!/bin/bash

echo "============================================================"
echo "🛑 STOPPING OLD SYSTEM..."
echo "============================================================"
pkill -f "complete_clustered_7step_workflow.py"
echo "✅ Stopped"
echo ""

echo "============================================================"
echo "🧹 CLEARING DATABASE..."
echo "============================================================"
python3 clear_clustering_database.py
echo ""

echo "============================================================"
echo "🚀 STARTING FIXED SYSTEM..."
echo "============================================================"
./RUN_LIVE_CLUSTERED_SYSTEM.sh
