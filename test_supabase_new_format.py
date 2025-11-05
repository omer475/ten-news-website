#!/usr/bin/env python3
"""
Test Supabase connection with new live system fields
"""

import os
import json
from datetime import datetime
from supabase_storage import save_articles_to_supabase

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Verify environment variables are loaded
print(f"🔍 Environment check:")
print(f"   SUPABASE_URL: {'✅ Set' if os.getenv('SUPABASE_URL') else '❌ Missing'}")
print(f"   SUPABASE_SERVICE_KEY: {'✅ Set' if os.getenv('SUPABASE_SERVICE_KEY') else '❌ Missing'}")
print(f"   SCRAPINGBEE_API_KEY: {'✅ Set' if os.getenv('SCRAPINGBEE_API_KEY') else '❌ Missing'}")
print()

def test_new_format():
    """Test saving articles with new live system format"""
    
    # Sample article in new live system format
    test_article = {
        "title": "European Central Bank raises interest rates to 4.5 percent",
        "summary": {
            "paragraph": "The European Central Bank increased its main interest rate to 4.5%, marking the tenth consecutive hike since July 2023 as inflation remains above the 2% target.",
            "bullets": [
                "ECB raises interest rates to 4.5%, tenth consecutive increase since July 2023",
                "Current inflation at 5.3%, well above the 2% target rate",
                "Decision affects 340 million people across 20 eurozone countries",
                "Higher borrowing costs expected for mortgages and business loans"
            ]
        },
        "timeline": [
            {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"},
            {"date": "Mar 2024", "event": "ECB holds rates steady for first time in eight months"},
            {"date": "Dec 12, 2024", "event": "Next ECB policy meeting scheduled"}
        ],
        "details": [
            {"label": "Previous rate", "value": "4.25%"},
            {"label": "Inflation target", "value": "2%"},
            {"label": "GDP growth", "value": "0.1%"}
        ],
        "graph": {
            "type": "line",
            "title": "ECB Interest Rates 2020-2024",
            "data": [
                {"date": "2020-03", "value": 0.25},
                {"date": "2022-03", "value": 0.50},
                {"date": "2023-07", "value": 5.25},
                {"date": "2024-01", "value": 5.50}
            ],
            "y_label": "Interest Rate (%)",
            "x_label": "Date"
        },
        "map": {
            "type": "point_markers",
            "center": {"lat": 50.1109, "lon": 8.6821},
            "zoom": 6,
            "markers": [
                {
                    "lat": 50.1109,
                    "lon": 8.6821,
                    "label": "Frankfurt, Germany",
                    "type": "primary_location",
                    "color": "blue",
                    "size": "large",
                    "info": "ECB headquarters"
                }
            ]
        },
        "url": "https://example.com/ecb-rate-hike",
        "source": "Reuters",
        "category": "Economy",
        "publishedAt": datetime.now().isoformat()
    }
    
    print("🧪 Testing Supabase with new live system format...")
    print(f"📊 Article structure:")
    print(f"   Title: {test_article['title']}")
    print(f"   Summary paragraph: {len(test_article['summary']['paragraph'])} chars")
    print(f"   Bullets: {len(test_article['summary']['bullets'])} items")
    print(f"   Timeline: {len(test_article['timeline'])} events")
    print(f"   Details: {len(test_article['details'])} data points")
    print(f"   Graph: {test_article['graph']['type']} chart")
    print(f"   Map: {len(test_article['map']['markers'])} markers")
    
    # Test saving to Supabase
    success = save_articles_to_supabase([test_article], source_part=1)
    
    if success:
        print("✅ Test successful! New format works with Supabase")
    else:
        print("❌ Test failed! Check your Supabase configuration")
    
    return success

if __name__ == "__main__":
    test_new_format()
