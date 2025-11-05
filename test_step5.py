#!/usr/bin/env python3
"""
Test script for Step 5 Claude final writing & formatting
"""

import os
from step5_claude_final_writing_formatting import ClaudeFinalWriter, WriterConfig

def test_step5():
    """Test Step 5 with sample articles"""
    
    print("🧪 TESTING STEP 5: CLAUDE FINAL WRITING & FORMATTING")
    print("=" * 50)
    
    # Set API key
    api_key = os.getenv('CLAUDE_API_KEY')
    if not api_key:
        print("❌ CLAUDE_API_KEY not set")
        return False
    
    # Sample articles with context data
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
            "graph_data_needed": "ECB interest rates 2020-2024",
            "timeline_context": [
                {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"},
                {"date": "Mar 14, 2024", "event": "ECB holds rates steady for first time in eight months"}
            ],
            "details_context": [
                "Previous rate: 4.25%",
                "Inflation target: 2%",
                "Current inflation: 5.3%",
                "GDP growth: 0.1%"
            ],
            "graph_context": [
                {"date": "2020-03", "value": 0.25, "label": "COVID rate cut"},
                {"date": "2022-03", "value": 0.50, "label": "First hike"},
                {"date": "2023-07", "value": 5.25, "label": "Peak rate"},
                {"date": "2024-01", "value": 5.50, "label": "Current rate"}
            ]
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://apnews.com/un-gaza-vote",
            "score": 920,
            "status": "APPROVED",
            "components": ["timeline", "details", "map"],
            "map_locations": ["Gaza", "Israel", "Palestine"],
            "timeline_context": [
                {"date": "Oct 7, 2023", "event": "Hamas attacks Israel, conflict begins"},
                {"date": "Oct 15, 2023", "event": "UN Security Council first emergency meeting"}
            ],
            "details_context": [
                "Casualties: 1,200+ Israelis, 15,000+ Palestinians",
                "Displaced: 1.8 million Palestinians",
                "Resolution votes: 14-1 (US abstained)"
            ],
            "map_context": {
                "primary_location": {"name": "Gaza Strip", "lat": 31.3547, "lon": 34.3088},
                "affected_areas": [
                    {"name": "Gaza City", "lat": 31.3547, "lon": 34.3088, "impact": "major damage"},
                    {"name": "Tel Aviv", "lat": 32.0853, "lon": 34.7818, "impact": "rocket attacks"}
                ],
                "event_type": "conflict",
                "radius_km": 50
            }
        }
    ]
    
    print(f"✍️ Testing final writing with {len(test_articles)} sample articles...")
    
    try:
        writer = ClaudeFinalWriter(
            api_key=api_key,
            config=WriterConfig()
        )
        
        results = writer.write_all_articles(test_articles)
        
        print(f"\n✅ Step 5 Test Results:")
        print(f"   ✍️ Articles written: {len(results)}")
        
        print(f"\n📋 Final Articles:")
        for i, article in enumerate(results):
            print(f"   {i+1}. {article.get('title', 'No title')}")
            print(f"      Summary: {article.get('summary', {}).get('paragraph', 'No summary')[:100]}...")
            print(f"      Bullets: {len(article.get('summary', {}).get('bullets', []))} bullets")
            
            # Show components included
            components = []
            if 'timeline' in article:
                components.append('timeline')
            if 'details' in article:
                components.append('details')
            if 'graph' in article:
                components.append('graph')
            if 'map' in article:
                components.append('map')
            
            print(f"      Components: {components}")
        
        return True
        
    except Exception as e:
        print(f"❌ Step 5 test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_step5()
    
    if success:
        print(f"\n🎉 Step 5 test passed! Final writing is working.")
    else:
        print(f"\n❌ Step 5 test failed. Check the error above.")
