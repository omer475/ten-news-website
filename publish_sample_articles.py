#!/usr/bin/env python3
"""
Publish processed articles to Supabase
"""

import os
import json
from datetime import datetime

# Set environment variables BEFORE importing supabase_storage
os.environ['SUPABASE_URL'] = "https://nczwonwflrrfvxlujbze.supabase.co"
os.environ['SUPABASE_SERVICE_KEY'] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jendvbndmbHJyZnZ4bHVqYnplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTQ1NzI2OCwiZXhwIjoyMDQxMDMzMjY4fQ.Wq7LvlqAg7vAmwDKzwFSjkD4PHiTUjA3lzWz_Vz0g5s"

from supabase_storage import save_articles_to_supabase

def publish_sample_articles():
    """Publish sample articles to test the system"""
    
    print("📤 Publishing Sample Articles to Supabase...")
    
    # Create sample articles (you can replace this with your actual processed articles)
    sample_articles = [
        {
            'title': 'European Central Bank raises interest rates to 4.5 percent',
            'summary': 'The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.',
            'full_text': 'The European Central Bank announced Thursday it is raising interest rates by 0.25 percentage points to 4.5 percent, marking the tenth consecutive increase since July 2023.',
            'url': 'https://www.reuters.com/markets/europe/ecb-rates-2024',
            'source': 'Reuters',
            'category': 'Economy',
            'final_score': 850.0,
            'details': ['Previous rate: 4.25%', 'Inflation target: 2%', 'Current inflation: 5.3%'],
            'timeline': [
                {'date': 'Jul 27, 2023', 'event': 'ECB begins rate hike cycle with increase to 3.75 percent'},
                {'date': 'Mar 14, 2024', 'event': 'ECB holds rates steady for first time in eight months'}
            ],
            'publishedAt': datetime.now().isoformat(),
            'added_at': datetime.now().isoformat()
        },
        {
            'title': 'UN Security Council votes on Gaza ceasefire resolution',
            'summary': 'The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.',
            'full_text': 'The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire in Gaza.',
            'url': 'https://apnews.com/un-gaza-vote',
            'source': 'Associated Press',
            'category': 'International',
            'final_score': 920.0,
            'details': ['Casualties: 1,200+ Israelis', 'Displaced: 1.8M Palestinians', 'Resolution votes: 14-1'],
            'timeline': [
                {'date': 'Oct 7, 2023', 'event': 'Hamas attacks Israel, conflict begins'},
                {'date': 'Oct 15, 2023', 'event': 'UN Security Council first emergency meeting'}
            ],
            'publishedAt': datetime.now().isoformat(),
            'added_at': datetime.now().isoformat()
        }
    ]
    
    try:
        result = save_articles_to_supabase(sample_articles, source_part=1)
        
        if result:
            print(f"✅ Successfully published {len(sample_articles)} sample articles!")
            print("🌍 Check your website: https://tennews.ai")
        else:
            print("❌ Failed to publish articles")
            
    except Exception as e:
        print(f"❌ Error publishing articles: {e}")

if __name__ == "__main__":
    publish_sample_articles()
