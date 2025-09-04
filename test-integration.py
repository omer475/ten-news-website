#!/usr/bin/env python3
"""
Test script to verify the integration between news generator and website
"""

import json
import os
from datetime import datetime

def test_data_structure():
    """Test if the sample data file has the correct structure"""
    print("🧪 Testing data structure...")
    
    # Get today's filename
    today = datetime.now()
    filename = f"tennews_data_{today.year}_{today.month:02d}_{today.day:02d}.json"
    
    if not os.path.exists(filename):
        print(f"❌ Data file not found: {filename}")
        return False
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check required fields
        required_fields = ['dailyGreeting', 'readingTime', 'displayDate', 'historicalEvents', 'articles']
        for field in required_fields:
            if field not in data:
                print(f"❌ Missing required field: {field}")
                return False
            print(f"✅ Found field: {field}")
        
        # Check articles structure
        if not isinstance(data['articles'], list):
            print("❌ Articles must be a list")
            return False
        
        if len(data['articles']) == 0:
            print("❌ No articles found")
            return False
        
        print(f"✅ Found {len(data['articles'])} articles")
        
        # Check first article structure
        article = data['articles'][0]
        article_fields = ['rank', 'emoji', 'title', 'summary', 'category', 'source', 'url']
        for field in article_fields:
            if field not in article:
                print(f"❌ Article missing field: {field}")
                return False
        
        print("✅ Article structure is correct")
        
        # Check historical events
        if not isinstance(data['historicalEvents'], list):
            print("❌ Historical events must be a list")
            return False
        
        if len(data['historicalEvents']) > 0:
            event = data['historicalEvents'][0]
            if 'year' not in event or 'description' not in event:
                print("❌ Historical event missing year or description")
                return False
        
        print("✅ Historical events structure is correct")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def test_url_structure():
    """Test if URLs are properly formatted"""
    print("\n🔗 Testing URL structure...")
    
    today = datetime.now()
    filename = f"tennews_data_{today.year}_{today.month:02d}_{today.day:02d}.json"
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        valid_urls = 0
        total_articles = len(data['articles'])
        
        for i, article in enumerate(data['articles'], 1):
            url = article.get('url', '')
            if url.startswith('http://') or url.startswith('https://'):
                valid_urls += 1
                print(f"✅ Article {i}: Valid URL")
            else:
                print(f"❌ Article {i}: Invalid URL - {url}")
        
        print(f"\n📊 URL Test Results: {valid_urls}/{total_articles} valid URLs")
        return valid_urls == total_articles
        
    except Exception as e:
        print(f"❌ Error testing URLs: {e}")
        return False

def test_website_compatibility():
    """Test if data is compatible with website structure"""
    print("\n🌐 Testing website compatibility...")
    
    today = datetime.now()
    filename = f"tennews_data_{today.year}_{today.month:02d}_{today.day:02d}.json"
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Simulate website conversion
        stories = [
            {
                'type': 'opening',
                'date': data.get('displayDate', ''),
                'headline': data.get('dailyGreeting', ''),
                'readingTime': data.get('readingTime', ''),
                'historicalEvents': data.get('historicalEvents', [])
            }
        ]
        
        # Convert articles
        for article in data['articles']:
            story = {
                'type': 'news',
                'number': article.get('rank', 1),
                'category': article.get('category', ''),
                'emoji': article.get('emoji', '📰'),
                'title': article.get('title', ''),
                'summary': article.get('summary', ''),
                'details': article.get('details', []),
                'source': article.get('source', ''),
                'url': article.get('url', '')
            }
            stories.append(story)
        
        stories.append({'type': 'newsletter', 'content': 'Newsletter Signup'})
        
        print(f"✅ Successfully converted {len(stories)} stories")
        print(f"   - Opening page: ✅")
        print(f"   - News articles: {len(data['articles'])}")
        print(f"   - Newsletter page: ✅")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing compatibility: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 TEN NEWS - Integration Test")
    print("=" * 50)
    
    # Run tests
    structure_ok = test_data_structure()
    urls_ok = test_url_structure()
    compatibility_ok = test_website_compatibility()
    
    print("\n" + "=" * 50)
    print("📋 TEST RESULTS:")
    print(f"   Data Structure: {'✅ PASS' if structure_ok else '❌ FAIL'}")
    print(f"   URL Validation: {'✅ PASS' if urls_ok else '❌ FAIL'}")
    print(f"   Website Compatibility: {'✅ PASS' if compatibility_ok else '❌ FAIL'}")
    
    if all([structure_ok, urls_ok, compatibility_ok]):
        print("\n🎉 ALL TESTS PASSED!")
        print("Your integration is ready to go!")
        print("\nNext steps:")
        print("1. Install Node.js if not already installed")
        print("2. Run: npm install")
        print("3. Run: npm run dev")
        print("4. Visit: http://localhost:3000")
        return True
    else:
        print("\n❌ SOME TESTS FAILED!")
        print("Please check the errors above and fix them.")
        return False

if __name__ == "__main__":
    main()
