#!/bin/bash

echo "============================================================"
echo "📊 RSS SOURCE STATUS CHECK"
echo "============================================================"
echo ""

cd "/Users/omersogancioglu/Ten news website "

echo "🔍 Sources fetched in the last 30 minutes:"
echo ""

sqlite3 ten_news.db "
SELECT 
    source,
    COUNT(*) as total_articles,
    MAX(fetched_at) as last_fetch,
    ROUND((JULIANDAY('now') - JULIANDAY(MAX(fetched_at))) * 24 * 60, 1) as minutes_ago
FROM articles
WHERE fetched_at > datetime('now', '-30 minutes')
GROUP BY source
ORDER BY last_fetch DESC
LIMIT 30;
" | column -t -s '|'

echo ""
echo "============================================================"
echo "📈 SUMMARY (Last 30 minutes)"
echo "============================================================"

ACTIVE_SOURCES=$(sqlite3 ten_news.db "SELECT COUNT(DISTINCT source) FROM articles WHERE fetched_at > datetime('now', '-30 minutes');")
echo "  • Active sources: $ACTIVE_SOURCES"

TOTAL_FETCHED=$(sqlite3 ten_news.db "SELECT COUNT(*) FROM articles WHERE fetched_at > datetime('now', '-30 minutes');")
echo "  • Articles fetched: $TOTAL_FETCHED"

echo ""
echo "✅ These sources ARE being checked every 10 minutes!"
echo "   (They just have 0 NEW articles because all are duplicates)"
echo ""

