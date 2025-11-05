#!/usr/bin/env python3
"""
Test script for Step 3 component selection
"""

import os
from step3_gemini_component_selection import GeminiComponentSelector, ComponentConfig

def test_step3():
    """Test Step 3 with sample articles"""
    
    print("🧪 TESTING STEP 3: GEMINI COMPONENT SELECTION")
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
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024",
            "score": 850,
            "status": "APPROVED"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press", 
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://apnews.com/un-gaza-vote",
            "score": 920,
            "status": "APPROVED"
        }
    ]
    
    print(f"🎯 Testing component selection with {len(test_articles)} sample articles...")
    
    try:
        selector = GeminiComponentSelector(
            api_key=api_key,
            config=ComponentConfig()
        )
        
        results = selector.select_components_batch(test_articles)
        
        print(f"\n✅ Step 3 Test Results:")
        print(f"   📊 Articles processed: {len(results)}")
        
        print(f"\n📋 Component Selections:")
        for i, article in enumerate(results):
            components = article.get('components', [])
            print(f"   {i+1}. {article['title'][:50]}...")
            print(f"      Components: {components}")
        
        return True
        
    except Exception as e:
        print(f"❌ Step 3 test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_step3()
    
    if success:
        print(f"\n🎉 Step 3 test passed! Component selection is working.")
    else:
        print(f"\n❌ Step 3 test failed. Check the error above.")
