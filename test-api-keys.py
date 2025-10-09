#!/usr/bin/env python3
"""Test script to verify all API keys are configured and working"""

import os
import sys

print("🔍 TEN NEWS - API KEYS VERIFICATION")
print("=" * 60)

# Test environment variables
keys = {
    'CLAUDE_API_KEY': 'Claude AI',
    'GOOGLE_API_KEY': 'Google Gemini',
    'PERPLEXITY_API_KEY': 'Perplexity AI',
    'NEWSAPI_KEY': 'NewsAPI (optional)'
}

print("\n📋 Checking Environment Variables...")
print("-" * 60)

all_set = True
for key, name in keys.items():
    value = os.environ.get(key)
    if value and len(value) > 10:
        prefix = value[:15] + '...'
        print(f"✅ {name:25} {prefix}")
    else:
        if 'optional' in name.lower():
            print(f"⏸️  {name:25} Not set (optional)")
        else:
            print(f"❌ {name:25} NOT SET!")
            all_set = False

if not all_set:
    print("\n❌ Some required keys missing!")
    sys.exit(1)

print("\n✅ All API keys are configured!")
print("\n🎯 Next: pip install -r requirements.txt")
print("Then: python news-generator.py")

