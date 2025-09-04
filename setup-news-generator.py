#!/usr/bin/env python3
"""
TEN NEWS - Setup and Installation Script
Installs dependencies and sets up the news generator
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a Python package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ Installed {package}")
        return True
    except subprocess.CalledProcessError:
        print(f"❌ Failed to install {package}")
        return False

def main():
    print("🚀 TEN NEWS - Setup and Installation")
    print("=" * 50)
    
    # Required packages
    packages = [
        "requests",
        "beautifulsoup4", 
        "pytz",
        "schedule"
    ]
    
    print("📦 Installing required packages...")
    
    failed_packages = []
    for package in packages:
        if not install_package(package):
            failed_packages.append(package)
    
    if failed_packages:
        print(f"\n❌ Failed to install: {', '.join(failed_packages)}")
        print("Please install them manually:")
        for pkg in failed_packages:
            print(f"  pip install {pkg}")
        return False
    
    print("\n✅ All packages installed successfully!")
    
    # Check if API key is set
    print("\n🔑 Checking API key configuration...")
    
    try:
        with open('news-generator.py', 'r') as f:
            content = f.read()
            if 'sk-ant-api03-' in content and 'your-actual-api-key-here' not in content:
                print("✅ Claude API key appears to be configured")
            else:
                print("⚠️ Please set your Claude API key in news-generator.py")
                print("   Replace the CLAUDE_API_KEY value with your actual key")
                print("   Get your key from: https://console.anthropic.com/account/keys")
    except Exception as e:
        print(f"⚠️ Could not check API key: {e}")
    
    print("\n📋 Setup complete! You can now:")
    print("1. Run once: python news-generator.py (choose option 1)")
    print("2. Start scheduler: python news-generator.py (choose option 2)")
    print("   - Scheduler runs daily at 7:00 AM UK time")
    print("   - Generates JSON files for the website to load")
    
    print("\n📁 Generated files will be:")
    print("   - tennews_data_YYYY_MM_DD.json (main data)")
    print("   - historical_events_YYYY_MM_DD.json (historical events)")
    
    print("\n🌐 Your website will automatically load today's data!")
    print("   If no data exists, it will use sample data as fallback")
    
    return True

if __name__ == "__main__":
    main()
