#!/bin/bash
# Emergency Design Restoration Script
# Run this if your design breaks: bash restore-correct-design.sh

echo "🔧 Restoring correct design..."

# Stop dev server
pkill -f "next dev" 2>/dev/null

# Restore from backup
if [ -f "pages/index-WORKING-VERSION-DO-NOT-DELETE.js" ]; then
    cp pages/index-WORKING-VERSION-DO-NOT-DELETE.js pages/index.js
    echo "✅ Restored correct index.js"
else
    echo "❌ ERROR: Backup file not found!"
    exit 1
fi

# Clear Next.js cache
rm -rf .next
echo "✅ Cleared Next.js cache"

# Check file size
LINES=$(wc -l < pages/index.js)
if [ "$LINES" -lt 4000 ]; then
    echo "❌ ERROR: File still broken (only $LINES lines)!"
    exit 1
fi

echo "✅ File looks good ($LINES lines)"

# Restart dev server
npm run dev &
echo "✅ Dev server restarting..."
echo ""
echo "🎉 Design restored! Refresh your browser with Ctrl+Shift+R"

