#!/usr/bin/env python3
"""
Test Supabase connection and publish articles
"""

import os
import sys

# Set environment variables BEFORE importing supabase_storage
os.environ['SUPABASE_URL'] = "https://nczwonwflrrfvxlujbze.supabase.co"
os.environ['SUPABASE_SERVICE_KEY'] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jendvbndmbHJyZnZ4bHVqYnplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTQ1NzI2OCwiZXhwIjoyMDQxMDMzMjY4fQ.Wq7LvlqAg7vAmwDKzwFSjkD4PHiTUjA3lzWz_Vz0g5s"

from supabase_storage import save_articles_to_supabase

def test_supabase_connection():
    """Test if we can connect to Supabase"""
    
    print("🔍 Testing Supabase Connection...")
    
    # Check environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print(f"SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
        print(f"SUPABASE_SERVICE_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
        return False
    
    print(f"✅ Supabase URL: {supabase_url}")
    print(f"✅ Service Key: {'*' * 20}...{supabase_key[-10:]}")
    
    # Test with empty articles list
    try:
        print("\n🧪 Testing connection with empty data...")
        result = save_articles_to_supabase([], source_part=1)
        print(f"✅ Connection test result: {result}")
        return True
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_supabase_connection()
    
    if success:
        print("\n🎉 Supabase connection is working!")
    else:
        print("\n❌ Supabase connection failed!")
        print("\nPossible solutions:")
        print("1. Check your internet connection")
        print("2. Try using a different network (mobile hotspot)")
        print("3. Check if Supabase is down: https://status.supabase.com")
        print("4. Verify your Supabase credentials are correct")
