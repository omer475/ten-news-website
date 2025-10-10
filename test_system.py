"""
TEN NEWS - System Test Script
Quick validation that everything works
"""

import sqlite3
import os
import sys

def test_environment_variables():
    """Test that API keys are set"""
    print("🔑 Testing Environment Variables...")
    
    required = [
        'CLAUDE_API_KEY',
        'GOOGLE_API_KEY',
        'PERPLEXITY_API_KEY'
    ]
    
    optional = []
    
    all_good = True
    
    for key in required:
        value = os.getenv(key)
        if value and len(value) > 10:
            print(f"   ✅ {key}: {'*' * 20}... (set)")
        else:
            print(f"   ❌ {key}: NOT SET (required)")
            all_good = False
    
    for key in optional:
        value = os.getenv(key)
        if value and len(value) > 10:
            print(f"   ✅ {key}: {'*' * 20}... (set)")
        else:
            print(f"   ⚠️  {key}: Not set (optional)")
    
    return all_good

def test_database():
    """Test database creation and schema"""
    print("\n🗄️  Testing Database...")
    
    try:
        # Check if schema file exists
        if not os.path.exists('database_schema.sql'):
            print("   ❌ database_schema.sql not found")
            return False
        print("   ✅ database_schema.sql exists")
        
        # Create database
        conn = sqlite3.connect('ten_news_test.db')
        cursor = conn.cursor()
        
        # Execute schema
        with open('database_schema.sql', 'r') as f:
            schema = f.read()
            cursor.executescript(schema)
        
        print("   ✅ Database created successfully")
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['articles', 'fetch_cycles', 'source_stats']
        for table in expected_tables:
            if table in tables:
                print(f"   ✅ Table '{table}' exists")
            else:
                print(f"   ❌ Table '{table}' missing")
                conn.close()
                return False
        
        conn.close()
        
        # Cleanup test database
        os.remove('ten_news_test.db')
        
        return True
        
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        return False

def test_rss_sources():
    """Test RSS sources configuration"""
    print("\n📡 Testing RSS Sources...")
    
    try:
        from rss_sources import ALL_SOURCES, get_source_credibility
        
        print(f"   ✅ Loaded {len(ALL_SOURCES)} RSS sources")
        
        if len(ALL_SOURCES) < 200:
            print(f"   ⚠️  Expected 200+ sources, got {len(ALL_SOURCES)}")
        
        # Test a few sources
        test_count = min(5, len(ALL_SOURCES))
        print(f"   🔍 Testing {test_count} sample sources...")
        
        for source_name, url in ALL_SOURCES[:test_count]:
            credibility = get_source_credibility(source_name)
            print(f"      • {source_name}: {url[:50]}... (cred: {credibility})")
        
        return True
        
    except Exception as e:
        print(f"   ❌ RSS sources error: {e}")
        return False

def test_imports():
    """Test that all modules can be imported"""
    print("\n📦 Testing Imports...")
    
    modules = [
        ('feedparser', 'RSS parsing'),
        ('flask', 'REST API'),
        ('bs4', 'HTML parsing'),
        ('google.generativeai', 'Gemini AI'),
        ('anthropic', 'Claude AI'),
    ]
    
    all_good = True
    
    for module_name, description in modules:
        try:
            __import__(module_name)
            print(f"   ✅ {module_name} ({description})")
        except ImportError:
            print(f"   ❌ {module_name} ({description}) - NOT INSTALLED")
            all_good = False
    
    return all_good

def test_main_components():
    """Test that main components can be imported"""
    print("\n🔧 Testing Main Components...")
    
    components = [
        ('rss_fetcher', 'OptimizedRSSFetcher'),
        ('ai_filter', 'AINewsFilter'),
        ('api', 'Flask app'),
    ]
    
    all_good = True
    
    for module_name, component_name in components:
        try:
            module = __import__(module_name)
            print(f"   ✅ {module_name}.py ({component_name})")
        except Exception as e:
            print(f"   ❌ {module_name}.py - ERROR: {str(e)[:50]}")
            all_good = False
    
    return all_good

def main():
    """Run all tests"""
    print("="*60)
    print("🧪 TEN NEWS - SYSTEM TEST")
    print("="*60)
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Database Schema", test_database),
        ("RSS Sources", test_rss_sources),
        ("Python Imports", test_imports),
        ("Main Components", test_main_components),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\n❌ {test_name} CRASHED: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n📈 Score: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! System is ready to run.")
        print("\nNext steps:")
        print("  1. Set environment variables (if not already set)")
        print("  2. Run: python3 main.py")
        print("  3. Check logs: tail -f rss_fetcher.log")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED. Please fix issues before running.")
        print("\nCommon fixes:")
        print("  • Install missing packages: pip install -r requirements.txt")
        print("  • Set environment variables:")
        print("    export CLAUDE_API_KEY='...'")
        print("    export GOOGLE_API_KEY='...'")
        print("    export PERPLEXITY_API_KEY='...'")
        print("  • Check file permissions")
        return 1

if __name__ == '__main__':
    sys.exit(main())

