#!/usr/bin/env python3
"""
Test different Perplexity API model names
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_model(model_name):
    """Test a specific model name"""
    
    api_key = os.getenv('PERPLEXITY_API_KEY')
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": "Hello"
            }
        ],
        "max_tokens": 50
    }
    
    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ {model_name}: SUCCESS")
            return True
        else:
            print(f"❌ {model_name}: {response.status_code} - {response.text[:100]}")
            return False
            
    except Exception as e:
        print(f"❌ {model_name}: Exception - {e}")
        return False

if __name__ == "__main__":
    print("🧪 TESTING PERPLEXITY API MODEL NAMES")
    print("=" * 50)
    
    # Common model names to test
    models_to_test = [
        "llama-3.1-sonar-large-128k-online",  # Current (failing)
        "llama-3.1-sonar-large-128k",         # Without online
        "llama-3.1-sonar-large",               # Shorter
        "llama-3.1-sonar",                     # Even shorter
        "sonar-large-128k-online",             # Without llama prefix
        "sonar-large-128k",                    # Without online
        "sonar-large",                         # Shortest
        "llama-3.1-sonar-small-128k-online",   # Small variant
        "llama-3.1-sonar-medium-128k-online",  # Medium variant
        "llama-3.1-sonar-large-32k-online",    # Different context
        "llama-3.1-sonar-large-64k-online",    # Different context
        "llama-3.1-sonar-large-256k-online",   # Different context
    ]
    
    successful_models = []
    
    for model in models_to_test:
        if test_model(model):
            successful_models.append(model)
    
    print(f"\n📊 RESULTS:")
    if successful_models:
        print(f"✅ Working models:")
        for model in successful_models:
            print(f"   - {model}")
    else:
        print(f"❌ No working models found")
        print(f"\n🔧 SUGGESTIONS:")
        print(f"   1. Check Perplexity API documentation for current models")
        print(f"   2. Verify API key has access to models")
        print(f"   3. Check if account needs upgrade")
