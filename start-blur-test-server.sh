#!/bin/bash

# Simple HTTP server to test blur effect on localhost
# This will make the file accessible on your local network

echo "🌐 Starting local server for blur test..."
echo ""
echo "📍 To access from your phone:"
echo "   1. Find your computer's local IP address below"
echo "   2. On your phone, open: http://YOUR_IP:8000/blur-test-localhost.html"
echo ""

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    LOCAL_IP="localhost"
fi

echo "💻 Your local IP: $LOCAL_IP"
echo ""
echo "📱 Open this URL on your phone:"
echo "   http://$LOCAL_IP:8000/blur-test-localhost.html"
echo ""
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

# Start Python HTTP server
python3 -m http.server 8000

