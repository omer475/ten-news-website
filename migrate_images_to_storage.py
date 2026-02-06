#!/usr/bin/env python3
"""
Migration script to convert base64 images in world_events to Supabase Storage URLs.
This dramatically improves database performance and reduces Disk IO usage.

Run: python migrate_images_to_storage.py
"""

import os
import base64
import uuid
from supabase import create_client, Client

# Initialize Supabase
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
    print("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def ensure_bucket_exists():
    """Ensure the images bucket exists and is public"""
    try:
        supabase.storage.create_bucket(
            id='images',
            options={'public': True, 'allowed_mime_types': ['image/png', 'image/jpeg', 'image/webp'], 'file_size_limit': 10485760}
        )
        print("✅ Created 'images' bucket")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("✅ 'images' bucket already exists")
        else:
            print(f"⚠️ Bucket creation note: {e}")


def upload_base64_to_storage(base64_data: str, filename: str) -> str:
    """Upload base64 image data to Supabase Storage and return public URL"""
    try:
        # Decode base64
        image_bytes = base64.b64decode(base64_data)
        
        storage_path = f"event-images/{filename}.png"
        
        # Try to remove existing file first (for upsert behavior)
        try:
            supabase.storage.from_('images').remove([storage_path])
        except:
            pass
        
        # Upload to storage
        supabase.storage.from_('images').upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/png"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_('images').get_public_url(storage_path)
        
        return public_url
        
    except Exception as e:
        print(f"  ❌ Upload error: {e}")
        return None


def migrate_event_images():
    """Migrate all base64 images in world_events to Storage"""
    
    print("\n🚀 Starting image migration...")
    print("=" * 50)
    
    ensure_bucket_exists()
    
    # First, fetch just IDs and basic info (without the huge image_url)
    print("\n📊 Fetching event list from database...")
    result = supabase.table('world_events').select('id, slug, name').execute()
    
    events = result.data
    print(f"   Found {len(events)} events")
    
    migrated = 0
    skipped = 0
    failed = 0
    
    for event in events:
        event_id = event['id']
        slug = event['slug'] or f"event-{uuid.uuid4().hex[:8]}"
        name = event['name']
        
        print(f"\n📦 Processing: {name[:40]}...")
        
        # Fetch just the image_url for this event (one at a time to avoid timeout)
        try:
            img_result = supabase.table('world_events').select('image_url').eq('id', event_id).single().execute()
            image_url = img_result.data.get('image_url') if img_result.data else None
        except Exception as e:
            print(f"   ⚠️ Could not fetch image: {e}")
            skipped += 1
            continue
        
        # Skip if no image
        if not image_url:
            print("   ⏭️ No image, skipping")
            skipped += 1
            continue
        
        # Skip if already a URL (not base64)
        if image_url.startswith('http://') or image_url.startswith('https://'):
            print("   ✅ Already a URL, skipping")
            skipped += 1
            continue
        
        # Check if it's a base64 data URL
        if not image_url.startswith('data:'):
            print("   ⚠️ Unknown format, skipping")
            skipped += 1
            continue
        
        # Extract base64 data from data URL
        try:
            # Format: data:image/png;base64,XXXX...
            parts = image_url.split(',', 1)
            if len(parts) != 2:
                print("   ⚠️ Invalid data URL format, skipping")
                skipped += 1
                continue
            
            base64_data = parts[1]
            
            # Calculate size
            size_bytes = len(base64_data) * 3 // 4  # Approximate decoded size
            size_kb = size_bytes / 1024
            print(f"   📏 Image size: {size_kb:.1f} KB")
            
            # Upload to storage
            public_url = upload_base64_to_storage(base64_data, slug)
            
            if public_url:
                # Update database with new URL
                supabase.table('world_events').update({
                    'image_url': public_url
                }).eq('id', event_id).execute()
                
                print(f"   ✅ Migrated to: {public_url[:60]}...")
                migrated += 1
            else:
                print("   ❌ Migration failed")
                failed += 1
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print("📊 MIGRATION COMPLETE")
    print(f"   ✅ Migrated: {migrated}")
    print(f"   ⏭️ Skipped:  {skipped}")
    print(f"   ❌ Failed:   {failed}")
    print("=" * 50)
    
    if migrated > 0:
        print("\n💡 Database queries should now be MUCH faster!")
        print("   Response size reduced from ~10MB to ~5KB")


def migrate_cover_images():
    """Also migrate cover_image_url if it exists"""
    print("\n🚀 Checking for cover_image_url fields...")
    
    try:
        result = supabase.table('world_events').select('id, slug, cover_image_url').not_.is_('cover_image_url', 'null').execute()
        
        if not result.data:
            print("   No cover images to migrate")
            return
        
        migrated = 0
        for event in result.data:
            cover_url = event.get('cover_image_url')
            if cover_url and cover_url.startswith('data:'):
                slug = event['slug'] or f"event-{uuid.uuid4().hex[:8]}"
                
                parts = cover_url.split(',', 1)
                if len(parts) == 2:
                    public_url = upload_base64_to_storage(parts[1], f"{slug}-cover")
                    if public_url:
                        supabase.table('world_events').update({
                            'cover_image_url': public_url
                        }).eq('id', event['id']).execute()
                        migrated += 1
                        print(f"   ✅ Migrated cover image for: {slug}")
        
        print(f"   Migrated {migrated} cover images")
        
    except Exception as e:
        print(f"   ⚠️ Cover image migration: {e}")


if __name__ == '__main__':
    migrate_event_images()
    migrate_cover_images()
    print("\n✨ Done!")
