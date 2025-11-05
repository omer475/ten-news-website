#!/bin/bash
# TEN NEWS - Environment Setup Script
# Creates .env file with secure API keys

echo "=================================="
echo "TEN NEWS - Environment Setup"
echo "=================================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
    echo ""
fi

# Get API keys securely
echo "Please enter your API keys:"
echo "(Leave blank to skip, but required keys must be set)"
echo ""

read -p "Claude API Key: " CLAUDE_KEY
read -p "Google (Gemini) API Key: " GOOGLE_KEY
read -p "Perplexity API Key: " PERPLEXITY_KEY

echo ""
echo "Optional configuration (press Enter for defaults):"
read -p "Perplexity Max Retries [3]: " MAX_RETRIES
read -p "Perplexity Timeout (seconds) [60]: " TIMEOUT
read -p "Environment (development/production) [development]: " ENV

# Set defaults
MAX_RETRIES=${MAX_RETRIES:-3}
TIMEOUT=${TIMEOUT:-60}
ENV=${ENV:-development}

# Validate required keys
if [ -z "$CLAUDE_KEY" ] || [ -z "$GOOGLE_KEY" ] || [ -z "$PERPLEXITY_KEY" ]; then
    echo ""
    echo "❌ Error: All three API keys are required!"
    echo ""
    echo "Get your API keys from:"
    echo "  Claude: https://console.anthropic.com/"
    echo "  Google: https://makersuite.google.com/app/apikey"
    echo "  Perplexity: https://www.perplexity.ai/settings/api"
    exit 1
fi

# Create .env file
cat > .env << EOF
# TEN NEWS - Environment Variables
# AUTO-GENERATED on $(date)
# NEVER commit this file to git!

# ==================== REQUIRED API KEYS ====================
CLAUDE_API_KEY=$CLAUDE_KEY
GOOGLE_API_KEY=$GOOGLE_KEY
PERPLEXITY_API_KEY=$PERPLEXITY_KEY

# ==================== PERPLEXITY CONFIGURATION ====================
PERPLEXITY_MAX_RETRIES=$MAX_RETRIES
PERPLEXITY_TIMEOUT=$TIMEOUT
PERPLEXITY_MAX_CONNECTIONS=100
PERPLEXITY_MAX_KEEPALIVE=20

# ==================== APPLICATION SETTINGS ====================
ENVIRONMENT=$ENV
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "Your configuration:"
echo "  Claude API Key: ${CLAUDE_KEY:0:8}..."
echo "  Google API Key: ${GOOGLE_KEY:0:8}..."
echo "  Perplexity API Key: ${PERPLEXITY_KEY:0:8}..."
echo "  Max Retries: $MAX_RETRIES"
echo "  Timeout: $TIMEOUT seconds"
echo "  Environment: $ENV"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "  - NEVER commit .env to git"
echo "  - NEVER share your API keys"
echo "  - .env is already in .gitignore"
echo ""
echo "Next steps:"
echo "  1. Run: python env_loader.py  (to test)"
echo "  2. Run: python perplexity_client.py  (to test Perplexity)"
echo "  3. Run your news generation scripts"
echo ""

