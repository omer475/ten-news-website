#!/bin/bash
cd "$(dirname "$0")"

# Generate a random subdomain
SUBDOMAIN=$(openssl rand -hex 4)

echo "🚀 Localtunnel başlatılıyor..."
echo "📱 URL hazır olunca aşağıda göreceksiniz!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Try with subdomain first (more reliable)
npx localtunnel --port 3000 --subdomain $SUBDOMAIN 2>/dev/null || npx localtunnel --port 3000
