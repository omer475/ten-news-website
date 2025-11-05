#!/usr/bin/env python3
"""
Test script for 5-step pipeline with sample data
"""

import os
import json
from step1_gemini_news_scoring_filtering import score_news_articles_step1

def test_step1():
    """Test Step 1 with sample articles"""
    
    print("🧪 TESTING STEP 1: GEMINI NEWS SCORING")
    print("=" * 50)
    
    # Set API key
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ GOOGLE_API_KEY not set")
        return False
    
    # Sample articles
    test_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024"
        },
        {
            "title": "Celebrity couple announces divorce",
            "source": "Entertainment Weekly",
            "text": "Famous actor and actress announce separation after 5 years.",
            "url": "https://ew.com/celebrity-divorce"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://apnews.com/un-gaza-vote"
        }
    ]
    
    print(f"📰 Testing with {len(test_articles)} sample articles...")
    
    try:
        results = score_news_articles_step1(test_articles, api_key)
        
        print(f"\n✅ Step 1 Test Results:")
        print(f"   📊 Total scored: {results['total']}")
        print(f"   ✅ Approved: {len(results['approved'])} ({results['approval_rate']:.1f}%)")
        print(f"   ❌ Filtered: {len(results['filtered'])}")
        
        print(f"\n📋 Detailed Results:")
        for article in results['approved']:
            print(f"   ✅ [{article['score']}] {article['title']}")
        
        for article in results['filtered']:
            print(f"   ❌ [{article['score']}] {article['title']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Step 1 test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_step1()
    
    if success:
        print(f"\n🎉 Step 1 test passed! Ready to run full pipeline.")
    else:
        print(f"\n❌ Step 1 test failed. Check your API key and try again.")
