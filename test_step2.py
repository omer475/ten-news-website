#!/usr/bin/env python3
"""
Test script for Step 2 ScrapingBee full article fetching
"""

import os
from step2_scrapingbee_full_article_fetching import ScrapingBeeArticleFetcher, FetcherConfig

def test_step2():
    """Test Step 2 with sample URLs"""
    
    print("🧪 TESTING STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING")
    print("=" * 50)
    
    # Set API key
    api_key = os.getenv('SCRAPINGBEE_API_KEY')
    if not api_key:
        print("❌ SCRAPINGBEE_API_KEY not set")
        return False
    
    # Sample articles with URLs
    test_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "url": "https://www.reuters.com/markets/europe/ecb-raises-rates-2024",
            "score": 850,
            "status": "APPROVED"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "url": "https://apnews.com/article/un-gaza-ceasefire-vote",
            "score": 920,
            "status": "APPROVED"
        }
    ]
    
    print(f"📄 Testing article fetching with {len(test_articles)} sample URLs...")
    
    try:
        fetcher = ScrapingBeeArticleFetcher(
            api_key=api_key,
            config=FetcherConfig(
                render_js=False,  # Use standard (cheaper)
                parallel_workers=2,  # Small batch for testing
                max_text_length=5000  # Smaller for testing
            )
        )
        
        results = fetcher.fetch_batch_parallel(test_articles)
        
        print(f"\n✅ Step 2 Test Results:")
        print(f"   📄 Articles fetched: {len(results)}")
        print(f"   📊 Success rate: {len(results)/len(test_articles)*100:.1f}%")
        
        print(f"\n📋 Fetched Articles:")
        for i, article in enumerate(results):
            print(f"   {i+1}. {article['title'][:50]}...")
            print(f"      Length: {article['text_length']} chars")
            print(f"      Preview: {article['text'][:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Step 2 test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_step2()
    
    if success:
        print(f"\n🎉 Step 2 test passed! Article fetching is working.")
    else:
        print(f"\n❌ Step 2 test failed. Check the error above.")
