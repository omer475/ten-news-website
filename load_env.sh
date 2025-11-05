#!/bin/bash
# TEN NEWS - Secure Environment Variable Loader
# Sources .env file and exports variables
# Usage: source load_env.sh

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Please run: ./setup_env.sh"
    echo "Or manually create .env file with your API keys"
    return 1 2>/dev/null || exit 1
fi

# Load .env file
# Use proper parsing to handle quotes and comments
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Parse KEY=VALUE
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove quotes if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        
        # Export variable
        export "$key=$value"
    fi
done < "$ENV_FILE"

# Validate required variables
required_vars=("CLAUDE_API_KEY" "GOOGLE_API_KEY" "PERPLEXITY_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please run: ./setup_env.sh"
    return 1 2>/dev/null || exit 1
fi

# Success (optional: only show in verbose mode)
if [ "${VERBOSE}" = "1" ]; then
    echo "✅ Environment variables loaded from .env"
fi

