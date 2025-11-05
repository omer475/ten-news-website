#!/usr/bin/env python3
"""
Test script for Step 4 Perplexity dynamic context search
"""

import os
from step4_perplexity_dynamic_context_search import PerplexityContextSearcher, PerplexityConfig

def test_step4():
    """Test Step 4 with sample articles"""
    
    print("🧪 TESTING STEP 4: PERPLEXITY DYNAMIC CONTEXT SEARCH")
    print("=" * 50)
    
    # Set API key
    api_key = os.getenv('PERPLEXITY_API_KEY')
    if not api_key:
        print("❌ PERPLEXITY_API_KEY not set")
        return False
    
    # Sample articles with components
    test_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024",
            "score": 850,
            "status": "APPROVED",
            "components": ["timeline", "details", "graph"],
            "graph_type": "line",
            "graph_data_needed": "ECB interest rates 2020-2024"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://apnews.com/un-gaza-vote",
            "score": 920,
            "status": "APPROVED",
            "components": ["timeline", "details", "map"],
            "map_locations": ["Gaza", "Israel", "Palestine"]
        }
    ]
    
    print(f"🔍 Testing context search with {len(test_articles)} sample articles...")
    
    try:
        searcher = PerplexityContextSearcher(
            api_key=api_key,
            config=PerplexityConfig()
        )
        
        results = searcher.search_all_articles(test_articles)
        
        print(f"\n✅ Step 4 Test Results:")
        print(f"   🔍 Articles processed: {len(results)}")
        
        print(f"\n📋 Context Search Results:")
        for i, article in enumerate(results):
            print(f"   {i+1}. {article['title'][:50]}...")
            print(f"      Components: {article.get('components', [])}")
            
            # Show context data found
            if 'timeline_context' in article:
                print(f"      Timeline events: {len(article['timeline_context'])} found")
            if 'details_context' in article:
                print(f"      Key data points: {len(article['details_context'])} found")
            if 'graph_context' in article:
                print(f"      Graph data points: {len(article['graph_context'])} found")
            if 'map_context' in article:
                print(f"      Map locations: {len(article['map_context'])} found")
        
        return True
        
    except Exception as e:
        print(f"❌ Step 4 test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_step4()
    
    if success:
        print(f"\n🎉 Step 4 test passed! Context search is working.")
    else:
        print(f"\n❌ Step 4 test failed. Check the error above.")
