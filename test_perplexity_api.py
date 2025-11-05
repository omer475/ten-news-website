#!/usr/bin/env python3
"""
Test Perplexity API connection and request format
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_perplexity_api():
    """Test basic Perplexity API connection"""
    
    api_key = os.getenv('PERPLEXITY_API_KEY')
    if not api_key:
        print("❌ PERPLEXITY_API_KEY not found in environment")
        return False
    
    print(f"🔑 API Key: {api_key[:10]}...{api_key[-10:]}")
    
    # Test with minimal request
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama-3.1-sonar-large-128k-online",
        "messages": [
            {
                "role": "user",
                "content": "What is the current date?"
            }
        ],
        "max_tokens": 100
    }
    
    print(f"🌐 Making request to: https://api.perplexity.ai/chat/completions")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📋 Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Error Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_with_search_recency():
    """Test with search_recency_filter parameter"""
    
    api_key = os.getenv('PERPLEXITY_API_KEY')
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama-3.1-sonar-large-128k-online",
        "messages": [
            {
                "role": "user",
                "content": "What are the latest news about AI?"
            }
        ],
        "max_tokens": 100,
        "return_citations": True,
        "search_recency_filter": "month"
    }
    
    print(f"\n🔍 Testing with search_recency_filter...")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success with search_recency_filter!")
            return True
        else:
            print(f"❌ Error with search_recency_filter: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception with search_recency_filter: {e}")
        return False

if __name__ == "__main__":
    print("🧪 TESTING PERPLEXITY API CONNECTION")
    print("=" * 50)
    
    # Test 1: Basic connection
    success1 = test_perplexity_api()
    
    # Test 2: With search_recency_filter
    success2 = test_with_search_recency()
    
    print(f"\n📊 RESULTS:")
    print(f"   Basic API: {'✅ PASS' if success1 else '❌ FAIL'}")
    print(f"   With search_recency_filter: {'✅ PASS' if success2 else '❌ FAIL'}")
    
    if not success1:
        print(f"\n🔧 TROUBLESHOOTING:")
        print(f"   1. Check if API key is valid")
        print(f"   2. Check if model name is correct")
        print(f"   3. Check if API endpoint is correct")
        print(f"   4. Check if account has credits")
