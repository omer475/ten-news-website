# STEP 6: WORLD EVENT DETECTION & TAGGING
# ==========================================
# Purpose: Detect if articles relate to major ongoing world events
#          and create new world events when detected
# Model: Gemini 2.0 Flash
# Input: Processed articles from pipeline
# Output: Articles tagged with world_event_id, new events created
# ==========================================

import google.generativeai as genai
import json
import os
import time
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
from supabase import create_client, Client
from event_components import generate_event_components, refresh_all_event_components

# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class WorldEventConfig:
    """Configuration for world event detection"""
    model: str = "gemini-2.0-flash"
    temperature: float = 0.2
    max_output_tokens: int = 1024
    retry_attempts: int = 3
    retry_delay: float = 2.0

# Initialize Supabase (check both env var names for compatibility)
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# ==========================================
# PROMPTS
# ==========================================

EVENT_DETECTION_PROMPT = """Analyze this news article and determine if it relates to a MAJOR ONGOING WORLD EVENT.

ARTICLE TITLE: {title}
ARTICLE CONTENT: {content}

EXISTING WORLD EVENTS:
{existing_events}

═══════════════════════════════════════════════════════════════
TASK 1: Does this article match any EXISTING world event?
═══════════════════════════════════════════════════════════════

Check if this article is about any of the existing events listed above.
Consider topic similarity, key figures, locations, and context.

If it's similar to an existing event but slightly different topic, 
it should MERGE into the most consonant existing event.

═══════════════════════════════════════════════════════════════
TASK 2: Is this a NEW major world event?
═══════════════════════════════════════════════════════════════

If NO existing event matches, determine if this is a NEW major world event.

A MAJOR ONGOING WORLD EVENT must meet ALL criteria:
1. GLOBAL SIGNIFICANCE - Affects multiple countries or has worldwide impact
2. ONGOING - Will continue for days, weeks, or months (not a one-day story)
3. MAJOR FIGURES - Involves world leaders, major institutions, or significant entities
4. HIGH IMPACT - Major humanitarian, economic, political, or security implications

TYPES OF WORLD EVENTS TO DETECT:
✓ Wars/Conflicts: "Israel-Gaza War", "Russia-Ukraine War"
✓ Trade/Economic: "Trump's Tariffs", "US-China Trade War"
✓ Global Summits: "G20 Summit", "World Economic Forum", "COP29", "UN General Assembly"
✓ Major Disasters: "Turkey Earthquake", "Hawaii Wildfires"
✓ Political Crises: "Iran Protests", "Venezuela Crisis"
✓ Health Emergencies: "Bird Flu Outbreak", "Mpox Emergency"

NOT world events:
✗ "Company releases new product" - NO (not global significance)
✗ "Celebrity scandal" - NO (not major impact)
✗ "Local election results" - NO (not global)
✗ "Stock drops 2%" - NO (unless major crash)

═══════════════════════════════════════════════════════════════
EVENT NAMING RULES (CRITICAL):
═══════════════════════════════════════════════════════════════

Event names MUST be SHORT and CONCISE (2-4 words maximum).
Use simple, recognizable names that fit in a small UI card.

✅ GOOD EVENT NAMES:
- "Trump's Tariffs"
- "US-China Trade War"  
- "Israel-Gaza War"
- "Russia-Ukraine War"
- "G20 Summit"
- "World Economic Forum"
- "Davos 2026"
- "COP29 Summit"
- "Iran Protests"
- "Syria Civil War"
- "LA Wildfires"

❌ BAD EVENT NAMES (too long/detailed):
- "Trump Administration Implements New Tariff Policies on Multiple Countries"
- "Ongoing Military Conflict Between Israel and Hamas in Gaza Strip"
- "Annual World Economic Forum Meeting in Davos Switzerland"
- "United States and China Engage in Trade Dispute Over Technology"

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON):
═══════════════════════════════════════════════════════════════

{{
  "matches_existing": true/false,
  "existing_event_id": "uuid or null",
  "existing_event_name": "name or null",
  
  "is_new_world_event": true/false,
  "new_event": {{
    "name": "G20 Summit",
    "slug": "g20-summit",
    "topic_prompt": "G20 Summit world leaders meeting global economy",
    "background": "Brief 2-3 sentence background of the event...",
    "key_facts": [
      {{"label": "Location", "value": "New Delhi"}},
      {{"label": "Dates", "value": "Sept 9-10"}},
      {{"label": "Leaders", "value": "20 nations"}}
    ],
    "importance": 8,
    "started_at": "2024-09-09",
    "show_day_counter": true,
    "timeline_entry": {{
      "headline": "First headline for timeline",
      "summary": "Brief summary of this development"
    }}
  }},
  
  "started_at" RULES (CRITICAL - BE STRICT):
  - ONLY provide a date if there is a SPECIFIC, VERIFIABLE start date
  - For wars/conflicts: Use the exact date the war began (e.g., "2022-02-24" for Russia-Ukraine War invasion)
  - For summits/conferences: Use the first day of that specific event
  - For sieges/blockades: Use the date it officially began
  - Format: "YYYY-MM-DD"
  - If NO clear start date exists, set to NULL
  - DO NOT make up dates like "Jan 1" for vague topics
  
  "show_day_counter" RULES (VERY STRICT):
  ✅ Set to TRUE ONLY for:
  - Active wars with a clear invasion/start date (Russia-Ukraine War, Israel-Gaza War)
  - Military sieges or blockades with a start date
  - Hostage situations with a start date
  - Major protests with a clear start date (only if still ongoing)
  
  ❌ Set to FALSE for:
  - Trends or ongoing issues (AI development, climate change, economic concerns)
  - Topics without a specific start date
  - Summits, conferences, forums (these have end dates)
  - Natural disasters (unless still actively ongoing crisis)
  - General industry topics (AI water demand, tech regulations, etc.)
  - Anything where "Day X" doesn't make intuitive sense
  
  IMPORTANT: When in doubt, set show_day_counter to FALSE. Most events should NOT have a day counter.
  
  "reasoning": "Brief explanation of your decision"
}}

If matches existing event, set is_new_world_event to false and new_event to null.
If is a new event, fill in the new_event object.
If neither (regular news), set both matches_existing and is_new_world_event to false.

Respond with valid JSON only."""


LATEST_DEVELOPMENT_PROMPT = """Write the Latest Development section for a world event.

EVENT: {event_name}
NEW ARTICLE TITLE: {article_title}
FULL ARTICLE CONTENT:
{article_content}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Write a Latest Development summary for this world event based on the article.

Requirements:
1. Write 3-4 flowing sentences (NOT bullet points)
2. MUST be substantial - explain what happened, why it matters, and what's next
3. Include specific details: numbers, names, locations, dates
4. Explain the significance and implications
5. Use natural prose like a professional news brief

EXAMPLE GOOD OUTPUT (3-4 sentences):
"Portuguese authorities have seized a record 9 tonnes of cocaine hidden in banana shipments at the port of Lisbon, marking the largest drug bust in the country's history. The operation, conducted in partnership with Europol, led to the arrest of 12 suspects linked to an international trafficking network. Officials believe the shipment originated from Colombia and was destined for distribution across Western Europe. The seizure highlights growing concerns about drug trafficking routes through Atlantic ports."

BAD OUTPUT (too short):
"Portugal seized cocaine at a port." ❌

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON):
═══════════════════════════════════════════════════════════════

{{
  "title": "Short headline for this development (5-10 words)",
  "summary": "3-4 sentence paragraph as described above. Must be detailed and informative.",
  "timeline_entry": {{
    "headline": "Brief headline for timeline",
    "summary": "One sentence summary",
    "significance": "high/medium/low"
  }}
}}

Respond with valid JSON only."""


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_existing_events() -> List[Dict]:
    """Fetch all ongoing world events from Supabase"""
    if not supabase:
        return []
    
    result = supabase.table('world_events').select('id, name, slug, topic_prompt').eq('status', 'ongoing').execute()
    return result.data if result.data else []


def format_existing_events(events: List[Dict]) -> str:
    """Format existing events for the prompt"""
    if not events:
        return "No existing world events."
    
    lines = []
    for event in events:
        lines.append(f"- ID: {event['id']}")
        lines.append(f"  Name: {event['name']}")
        lines.append(f"  Topic: {event['topic_prompt']}")
        lines.append("")
    return "\n".join(lines)


def extract_blur_color_from_base64(base64_data: str) -> str:
    """Extract a dominant color from base64 image data for blur effect"""
    import base64
    try:
        image_bytes = base64.b64decode(base64_data)
        sample_size = min(len(image_bytes), 10000)
        r_sum, g_sum, b_sum, count = 0, 0, 0, 0
        
        for i in range(100, sample_size - 3, 4):
            r, g, b = image_bytes[i], image_bytes[i+1], image_bytes[i+2]
            if 20 < r < 240 and 20 < g < 240 and 20 < b < 240:
                r_sum += r
                g_sum += g
                b_sum += b
                count += 1
        
        if count > 0:
            avg_r = int(r_sum / count * 0.5)
            avg_g = int(g_sum / count * 0.5)
            avg_b = int(b_sum / count * 0.5)
            return f'#{avg_r:02x}{avg_g:02x}{avg_b:02x}'
    except Exception as e:
        print(f"  Color extraction failed: {e}")
    
    return '#1a365d'


def upload_image_to_storage(base64_data: str, filename: str, mime_type: str = 'image/png') -> Optional[str]:
    """
    Upload a base64 image to Supabase Storage and return the public URL.
    Returns None on failure.
    """
    if not supabase:
        print("  ❌ Supabase not configured for storage upload")
        return None
    
    try:
        import base64
        
        # Decode base64 to binary
        image_bytes = base64.b64decode(base64_data)
        
        # Determine file extension from mime type
        ext = 'png' if 'png' in mime_type else 'jpg' if 'jpeg' in mime_type or 'jpg' in mime_type else 'png'
        storage_path = f"event-images/{filename}.{ext}"
        
        # Upload to Supabase Storage (bucket: 'images')
        # First, try to create the bucket if it doesn't exist
        try:
            supabase.storage.create_bucket(
                id='images',
                options={'public': True}
            )
        except:
            pass  # Bucket likely already exists
        
        # Remove existing file first (for upsert behavior)
        try:
            supabase.storage.from_('images').remove([storage_path])
        except:
            pass
        
        # Upload the file
        result = supabase.storage.from_('images').upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": mime_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_('images').get_public_url(storage_path)
        
        print(f"  ✅ Image uploaded to storage: {storage_path}")
        return public_url
        
    except Exception as e:
        print(f"  ❌ Storage upload error: {e}")
        return None


def _generate_gemini_image(api_key: str, prompt: str, aspect_ratio: str, timeout: int = 90) -> tuple:
    """
    Internal helper: Call Gemini image API and return (base64_data, mime_type) or (None, None).
    """
    try:
        response = requests.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
            headers={
                'Content-Type': 'application/json',
                'x-goog-api-key': api_key
            },
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {
                    'responseModalities': ['IMAGE'],
                    'imageConfig': {'aspectRatio': aspect_ratio}
                }
            },
            timeout=timeout
        )
        
        if response.status_code != 200:
            print(f"    ❌ Gemini API error ({aspect_ratio}): {response.status_code} - {response.text[:300]}")
            return None, None
        
        data = response.json()
        parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        
        for part in parts:
            if 'inlineData' in part:
                return part['inlineData']['data'], part['inlineData'].get('mimeType', 'image/png')
        
        print(f"    ❌ No image in Gemini response ({aspect_ratio})")
        return None, None
        
    except Exception as e:
        print(f"    ❌ Gemini image error ({aspect_ratio}): {e}")
        return None, None


def get_event_images(topic_prompt: str, event_slug: str = None) -> dict:
    """
    Generate BOTH images for a world event:
      - hero image (21:9) for the event detail page
      - cover image (4:5) for the event box card on the homepage
    
    Uploads both to Supabase Storage.
    Returns dict with: image_url, cover_image_url, blur_color (any can be None)
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    result = {'image_url': None, 'cover_image_url': None, 'blur_color': None}
    
    if not api_key:
        print("  ❌ GEMINI_API_KEY not set, image generation skipped")
        return result
    
    import uuid
    base_filename = event_slug if event_slug else f"event-{uuid.uuid4().hex[:12]}"
    
    # ── HERO IMAGE (21:9) for event detail page ──
    hero_prompt = f"""Create a newspaper-cover-style editorial illustration about {topic_prompt}.

The image should feel like a lead illustration from TIME magazine, The Economist, or The New York Times: intelligent, concept-driven, visually clever.

STYLE:
– detailed, expressive editorial illustration
– recognisable public figures allowed if relevant
– slightly exaggerated features for wit and character
– not photorealistic, not cartoonish
– sophisticated, modern newspaper illustration aesthetic

BACKGROUND: pure white (#ffffff), no gradients, no texture
LAYOUT: illustration in the top two-thirds, bottom third is pure white
COMPOSITION: strong balanced composition, cover-ready framing
OUTPUT: high resolution, no text, no headlines, no captions"""

    print(f"  🎨 Generating hero image (21:9)...")
    hero_b64, hero_mime = _generate_gemini_image(api_key, hero_prompt, '21:9')
    
    if hero_b64:
        result['blur_color'] = extract_blur_color_from_base64(hero_b64)
        hero_url = upload_image_to_storage(hero_b64, f"{base_filename}-hero", hero_mime)
        if hero_url:
            result['image_url'] = hero_url
            print(f"  ✅ Hero image uploaded: {base_filename}-hero")
        else:
            print(f"  ⚠️ Hero storage upload failed")
    
    # ── COVER IMAGE (4:5) for event box card on homepage ──
    cover_prompt = f"""Create a single FULL-BLEED editorial newspaper illustration in a classic engraved / woodcut illustration style with fine linework, cross-hatching, and stippling.

CRITICAL - FULL COVERAGE REQUIREMENT:
- The illustration MUST fill 100% of the canvas - every single pixel
- NO empty space on ANY side (left, right, top, bottom)
- NO margins, NO padding, NO borders, NO blank areas
- The subject and background must extend ALL THE WAY to every edge

EVENT TO ILLUSTRATE: {topic_prompt}

COLOR RULE:
Use bold, saturated, high-contrast colors. Avoid sepia, beige, parchment, pastel, or muted tones.
Flat colors + engraving shading only. No gradients.

EVENT LOGIC:
- If the event is about a specific person, include that person as the main subject
- If NOT about a person, use a dominant symbolic object or structure instead

COMPOSITION:
- One dominant central subject (person or symbolic object)
- Background scene MUST extend to ALL edges
- Subject should be large enough to dominate the frame
- Straight-on editorial perspective
- No frames, borders, overlays, or graphic effects

FORBIDDEN:
Photography, photorealism, 3D rendering, gradients, pastel colors, sepia tones, paper textures, frames, borders, margins, empty space, text, logos, captions, watermarks.

OUTPUT: One single full-bleed image with NO empty space anywhere."""

    print(f"  🎨 Generating cover image (4:5)...")
    cover_b64, cover_mime = _generate_gemini_image(api_key, cover_prompt, '4:5')
    
    if cover_b64:
        if not result['blur_color']:
            result['blur_color'] = extract_blur_color_from_base64(cover_b64)
        cover_url = upload_image_to_storage(cover_b64, f"{base_filename}-cover", cover_mime)
        if cover_url:
            result['cover_image_url'] = cover_url
            print(f"  ✅ Cover image uploaded: {base_filename}-cover")
        else:
            print(f"  ⚠️ Cover storage upload failed")
    
    if not result['image_url'] and not result['cover_image_url']:
        print(f"  ❌ No images generated for event")
    
    return result


def create_world_event(event_data: Dict, article_id: str) -> Optional[Dict]:
    """Create a new world event in Supabase"""
    if not supabase:
        print("Supabase not configured")
        return None
    
    try:
        # Generate BOTH AI images for event (hero + cover, uploaded to Supabase Storage)
        images = get_event_images(event_data['topic_prompt'], event_data.get('slug'))
        
        if not images['image_url'] and not images['cover_image_url']:
            print("  ⚠️ No images generated, event will have no image")
        
        # Parse started_at date if provided
        started_at = None
        if event_data.get('started_at'):
            try:
                started_at = event_data['started_at']
                print(f"  📅 Event start date: {started_at}")
            except Exception as e:
                print(f"  ⚠️ Could not parse start date: {e}")
        
        # Insert event with BOTH image URLs
        insert_data = {
            'name': event_data['name'],
            'slug': event_data['slug'],
            'topic_prompt': event_data['topic_prompt'],
            'background': event_data.get('background', ''),
            'key_facts': event_data.get('key_facts', []),
            'importance': event_data.get('importance', 5),
            'image_url': images['image_url'],
            'cover_image_url': images['cover_image_url'],
            'blur_color': images['blur_color'],
            'status': 'ongoing',
            'last_article_at': datetime.utcnow().isoformat(),
            'show_day_counter': event_data.get('show_day_counter', False)
        }
        
        # Only add started_at if we have a valid date
        if started_at:
            insert_data['started_at'] = started_at
        
        result = supabase.table('world_events').insert(insert_data).execute()
        
        if result.data:
            event = result.data[0]
            print(f"✅ Created new world event: {event['name']}")
            
            # Create initial timeline entry
            if event_data.get('timeline_entry'):
                supabase.table('world_event_timeline').insert({
                    'event_id': event['id'],
                    'date': datetime.utcnow().date().isoformat(),
                    'headline': event_data['timeline_entry']['headline'],
                    'summary': event_data['timeline_entry'].get('summary', '')
                }).execute()
            
            # Create initial latest development entry
            initial_summary = event_data.get('background', '')
            if event_data.get('timeline_entry'):
                initial_summary = event_data['timeline_entry'].get('summary', initial_summary)
            
            supabase.table('world_event_latest').insert({
                'event_id': event['id'],
                'title': event_data.get('timeline_entry', {}).get('headline', event_data['name']),
                'summary': initial_summary,
                'image_url': images['image_url'],
                'published_at': datetime.utcnow().isoformat()
            }).execute()
            print(f"  ✅ Created initial latest development")
            
            # Search historical articles and add to timeline
            search_historical_articles_for_event(event, event_data)
            
            # Generate smart components (perspectives, what_to_watch, etc.)
            try:
                components = generate_event_components(
                    event_data['name'],
                    event_data.get('topic_prompt', ''),
                    event_data.get('background', '')
                )
                if components:
                    supabase.table('world_events').update({
                        'components': components
                    }).eq('id', event['id']).execute()
                    print(f"  ✅ Generated event components")
            except Exception as comp_err:
                print(f"  ⚠️ Component generation failed (non-critical): {comp_err}")
            
            return event
    except Exception as e:
        print(f"❌ Failed to create world event: {e}")
    return None


def tag_article_to_event(article_id, event_id: str):
    """Tag an article to a world event"""
    if not supabase:
        return
    
    try:
        # Note: article_id can be int or string, we store as string
        supabase.table('article_world_events').upsert({
            'article_id': str(article_id),
            'event_id': event_id
        }, on_conflict='article_id,event_id').execute()
        print(f"  Tagged article {article_id} to event {event_id}")
    except Exception as e:
        print(f"  Failed to tag article: {e}")


def search_historical_articles_for_event(event: Dict, event_data: Dict):
    """
    Search historical articles (last 3 months) that might relate to this new event.
    Uses keyword matching first (efficient), then AI verification (accurate).
    """
    if not supabase:
        return
    
    print(f"\n  🔍 Searching historical articles for: {event['name']}")
    
    # Extract keywords from event name and topic
    event_name = event['name'].lower()
    topic_prompt = event_data.get('topic_prompt', '').lower()
    
    # Build search keywords (split by spaces, remove common words)
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'}
    
    words = set()
    for text in [event_name, topic_prompt]:
        for word in text.split():
            word = word.strip('.,!?()[]{}"\'-')
            if len(word) > 2 and word not in stop_words:
                words.add(word)
    
    keywords = list(words)[:10]  # Limit to 10 keywords
    
    if not keywords:
        print(f"    No keywords extracted, skipping historical search")
        return
    
    print(f"    Keywords: {', '.join(keywords)}")
    
    # Search articles from last 3 months using keywords
    from datetime import timedelta
    three_months_ago = (datetime.utcnow() - timedelta(days=90)).isoformat()
    
    # Build OR query for keyword matching in title
    matched_articles = []
    
    for keyword in keywords[:5]:  # Use top 5 keywords for efficiency
        try:
            result = supabase.table('articles').select(
                'id, title, one_liner, published_at, created_at'
            ).ilike('title', f'%{keyword}%').gte(
                'created_at', three_months_ago
            ).limit(20).execute()
            
            if result.data:
                for article in result.data:
                    # Avoid duplicates
                    if not any(a['id'] == article['id'] for a in matched_articles):
                        matched_articles.append(article)
        except Exception as e:
            print(f"    Search error for '{keyword}': {e}")
    
    if not matched_articles:
        print(f"    No historical articles found matching keywords")
        return
    
    print(f"    Found {len(matched_articles)} potential matches, verifying with AI...")
    
    # Configure Gemini for verification
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Batch verify articles with AI (check up to 30 at a time)
    articles_to_check = matched_articles[:30]
    
    article_list = "\n".join([
        f"- ID: {a['id']}, Title: {a['title'][:100]}"
        for a in articles_to_check
    ])
    
    verification_prompt = f"""You are checking if these articles relate to the world event: "{event['name']}"
Event description: {topic_prompt}

ARTICLES TO CHECK:
{article_list}

For each article, determine if it is DIRECTLY related to this specific world event.
Be STRICT - only include articles that are clearly about this event.

Return a JSON array of article IDs that ARE related:
{{"related_ids": ["id1", "id2", ...]}}

If none are related, return: {{"related_ids": []}}

Respond with valid JSON only."""

    try:
        response = model.generate_content(verification_prompt)
        text = response.text.strip()
        
        # Parse JSON
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        
        result = json.loads(text)
        related_ids = result.get('related_ids', [])
        
        if not related_ids:
            print(f"    AI found no related historical articles")
            return
        
        print(f"    AI verified {len(related_ids)} related articles")
        
        # Tag related articles to event and add to timeline
        tagged_count = 0
        for article in articles_to_check:
            article_id = str(article['id'])
            if article_id in related_ids or article['id'] in related_ids:
                # Tag article to event
                tag_article_to_event(article_id, event['id'])
                
                # Add timeline entry
                article_date = article.get('published_at') or article.get('created_at')
                if article_date:
                    try:
                        date_obj = datetime.fromisoformat(article_date.replace('Z', '+00:00'))
                        supabase.table('world_event_timeline').insert({
                            'event_id': event['id'],
                            'date': date_obj.date().isoformat(),
                            'headline': article['title'][:200],
                            'summary': article.get('one_liner', '')[:500] if article.get('one_liner') else '',
                            'source_article_id': article_id
                        }).execute()
                        tagged_count += 1
                    except Exception as e:
                        print(f"    Failed to add timeline entry: {e}")
        
        print(f"    ✅ Added {tagged_count} historical articles to event timeline")
        
    except json.JSONDecodeError as e:
        print(f"    AI response parse error: {e}")
    except Exception as e:
        print(f"    Historical search error: {e}")


def update_latest_development(event_id: str, event_name: str, article: Dict, article_id: str):
    """Update the latest development for an event"""
    if not supabase:
        return
    
    # Configure Gemini
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Generate latest development content
    prompt = LATEST_DEVELOPMENT_PROMPT.format(
        event_name=event_name,
        article_title=article.get('title', ''),
        article_content=article.get('content', article.get('bullets', ''))[:3000]
    )
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Parse JSON
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        
        data = json.loads(text)
        
        # Upsert latest development
        supabase.table('world_event_latest').upsert({
            'event_id': event_id,
            'title': data['title'],
            'summary': data['summary'],
            'image_url': article.get('image_url'),
            'components': article.get('components', {}),
            'published_at': datetime.utcnow().isoformat()
        }, on_conflict='event_id').execute()
        
        # Add timeline entry
        if data.get('timeline_entry'):
            supabase.table('world_event_timeline').insert({
                'event_id': event_id,
                'date': datetime.utcnow().date().isoformat(),
                'headline': data['timeline_entry']['headline'],
                'summary': data['timeline_entry'].get('summary', '')
            }).execute()
        
        print(f"  ✅ Updated latest development for {event_name}")
        
    except Exception as e:
        print(f"  ❌ Failed to update latest development: {e}")


# ==========================================
# MAIN DETECTION FUNCTION
# ==========================================

def detect_world_events(articles: List[Dict]) -> List[Dict]:
    """
    Process articles to detect and tag world events.
    
    Args:
        articles: List of processed articles with id, title, content/bullets
    
    Returns:
        List of articles with world_event_id added if applicable
    """
    if not supabase:
        print("⚠️ Supabase not configured, skipping world event detection")
        return articles
    
    print("\n" + "="*60)
    print("STEP 6: WORLD EVENT DETECTION")
    print("="*60)
    
    # Configure Gemini
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Get existing events
    existing_events = get_existing_events()
    existing_events_text = format_existing_events(existing_events)
    print(f"Found {len(existing_events)} existing world events")
    
    processed = []
    new_events_created = 0
    articles_tagged = 0
    
    for i, article in enumerate(articles):
        print(f"\n[{i+1}/{len(articles)}] Processing: {article.get('title', 'Untitled')[:50]}...")
        
        article_id = article.get('id', f'temp_{i}')
        content = article.get('content', article.get('bullets', ''))[:2000]
        
        # Build prompt
        prompt = EVENT_DETECTION_PROMPT.format(
            title=article.get('title', ''),
            content=content,
            existing_events=existing_events_text
        )
        
        try:
            # Call Gemini
            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Parse JSON
            if text.startswith('```'):
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
            
            result = json.loads(text)
            
            # Handle result
            if result.get('matches_existing') and result.get('existing_event_id'):
                # Tag to existing event
                event_id = result['existing_event_id']
                event_name = result.get('existing_event_name', 'Unknown')
                
                tag_article_to_event(article_id, event_id)
                update_latest_development(event_id, event_name, article, article_id)
                
                article['world_event_id'] = event_id
                articles_tagged += 1
                print(f"  → Matched existing event: {event_name}")
                
            elif result.get('is_new_world_event') and result.get('new_event'):
                # Create new event
                new_event = create_world_event(result['new_event'], article_id)
                
                if new_event:
                    tag_article_to_event(article_id, new_event['id'])
                    article['world_event_id'] = new_event['id']
                    
                    # Add to existing events for subsequent articles
                    existing_events.append({
                        'id': new_event['id'],
                        'name': new_event['name'],
                        'slug': new_event['slug'],
                        'topic_prompt': new_event['topic_prompt']
                    })
                    existing_events_text = format_existing_events(existing_events)
                    
                    new_events_created += 1
                    articles_tagged += 1
                    print(f"  → Created NEW world event: {new_event['name']}")
            else:
                print(f"  → Not a world event (regular news)")
            
        except json.JSONDecodeError as e:
            print(f"  ❌ JSON parse error: {e}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        processed.append(article)
        time.sleep(0.5)  # Rate limiting
    
    print("\n" + "="*60)
    print(f"WORLD EVENT DETECTION COMPLETE")
    print(f"  New events created: {new_events_created}")
    print(f"  Articles tagged: {articles_tagged}")
    print("="*60)
    
    # ── AUTO-ARCHIVE: Mark stale events as 'ended' so they don't clog the homepage ──
    try:
        archive_stale_events(max_days_inactive=7)
    except Exception as e:
        print(f"  ⚠️ Stale event archiving error (non-critical): {e}")
    
    # ── AUTO-BACKFILL: Generate images for events that don't have them ──
    try:
        backfill_missing_event_images(max_per_run=3)
    except Exception as e:
        print(f"  ⚠️ Image backfill error (non-critical): {e}")
    
    # ── AUTO-REFRESH: Refresh components for events missing them or with stale what_to_watch ──
    try:
        refresh_stale_event_components(max_per_run=3)
    except Exception as e:
        print(f"  ⚠️ Component refresh error (non-critical): {e}")
    
    return processed


def refresh_stale_event_components(max_per_run: int = 3):
    """
    Refresh components for ongoing events that either:
    1. Have no components at all (components is NULL or empty)
    2. Haven't been refreshed in 7+ days (stale what_to_watch dates)
    Processes a few per run to avoid timeouts.
    """
    if not supabase:
        return
    
    try:
        # Find ongoing events
        result = supabase.table('world_events').select(
            'id, name, topic_prompt, background, components'
        ).eq('status', 'ongoing').order('last_article_at', desc=True).execute()
        
        if not result.data:
            return
        
        needs_refresh = []
        now = datetime.utcnow()
        
        for event in result.data:
            components = event.get('components') or {}
            metadata = components.get('components_metadata', {})
            generated_at = metadata.get('generated_at')
            
            # Needs refresh if: no components, or generated 7+ days ago
            if not components or not metadata:
                needs_refresh.append((event, 'missing'))
            elif generated_at:
                try:
                    gen_date = datetime.fromisoformat(generated_at.replace('Z', '+00:00').replace('+00:00', ''))
                    days_old = (now - gen_date).days
                    if days_old >= 7:
                        needs_refresh.append((event, f'{days_old}d old'))
                except:
                    needs_refresh.append((event, 'bad date'))
            else:
                needs_refresh.append((event, 'no timestamp'))
        
        if not needs_refresh:
            print(f"  ✅ All event components are fresh")
            return
        
        print(f"\n🧩 COMPONENT REFRESH: {len(needs_refresh)} events need refresh (processing {min(max_per_run, len(needs_refresh))})")
        
        refreshed = 0
        for event, reason in needs_refresh[:max_per_run]:
            try:
                print(f"  🔄 Refreshing: {event['name']} ({reason})")
                components = generate_event_components(
                    event['name'],
                    event.get('topic_prompt', ''),
                    event.get('background', '')
                )
                if components:
                    supabase.table('world_events').update({
                        'components': components
                    }).eq('id', event['id']).execute()
                    refreshed += 1
                    print(f"  ✅ Refreshed components for {event['name']}")
            except Exception as e:
                print(f"  ❌ Failed to refresh {event['name']}: {e}")
            
            time.sleep(1)
        
        print(f"  ✅ Refreshed {refreshed}/{min(max_per_run, len(needs_refresh))} events")
        if len(needs_refresh) > max_per_run:
            print(f"     ({len(needs_refresh) - max_per_run} remaining, will process in next run)")
    
    except Exception as e:
        print(f"  ❌ Component refresh error: {e}")


def archive_stale_events(max_days_inactive: int = 7):
    """
    Automatically archive (mark as 'ended') events that haven't received
    new articles in max_days_inactive days. This keeps the homepage event
    boxes fresh and focused on active stories.
    """
    if not supabase:
        return
    
    try:
        cutoff = (datetime.utcnow() - timedelta(days=max_days_inactive)).isoformat()
        
        # Find ongoing events whose last_article_at is older than the cutoff
        result = supabase.table('world_events').select(
            'id, name, slug, last_article_at'
        ).eq('status', 'ongoing').lt('last_article_at', cutoff).execute()
        
        if not result.data:
            print(f"  ✅ No stale events to archive (all updated within {max_days_inactive} days)")
            return
        
        stale_events = result.data
        print(f"\n📦 AUTO-ARCHIVE: Found {len(stale_events)} stale events (no articles in {max_days_inactive}+ days)")
        
        archived = 0
        for event in stale_events:
            try:
                supabase.table('world_events').update({
                    'status': 'ended'
                }).eq('id', event['id']).execute()
                
                last_at = event.get('last_article_at', 'unknown')
                print(f"  📦 Archived: {event['name']} (last article: {last_at[:10]})")
                archived += 1
            except Exception as e:
                print(f"  ❌ Failed to archive {event['name']}: {e}")
        
        print(f"  ✅ Archived {archived}/{len(stale_events)} stale events")
        
    except Exception as e:
        print(f"  ❌ Stale event check error: {e}")


def backfill_missing_event_images(max_per_run: int = 3):
    """
    Check ongoing events for missing images and generate them.
    Runs automatically at the end of each world event detection cycle.
    Processes up to max_per_run events per cycle to avoid timeout.
    """
    if not supabase:
        return
    
    try:
        # Find ongoing events missing BOTH image_url and cover_image_url
        result = supabase.table('world_events').select(
            'id, name, slug, topic_prompt, image_url, cover_image_url'
        ).eq('status', 'ongoing').order('last_article_at', desc=True).execute()
        
        if not result.data:
            return
        
        # Find events that need images
        needs_images = []
        for event in result.data:
            has_hero = event.get('image_url') and not str(event['image_url']).startswith('data:')
            has_cover = event.get('cover_image_url') and not str(event['cover_image_url']).startswith('data:')
            
            if not has_hero or not has_cover:
                needs_images.append({
                    'event': event,
                    'needs_hero': not has_hero,
                    'needs_cover': not has_cover
                })
        
        if not needs_images:
            print(f"\n  ✅ All {len(result.data)} events have images")
            return
        
        print(f"\n  🖼️ IMAGE BACKFILL: {len(needs_images)} events need images (processing up to {max_per_run})")
        
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            print(f"    ❌ GEMINI_API_KEY not set, skipping backfill")
            return
        
        import uuid
        generated = 0
        
        for item in needs_images[:max_per_run]:
            event = item['event']
            topic = event.get('topic_prompt') or event.get('name', '')
            slug = event.get('slug') or f"event-{uuid.uuid4().hex[:12]}"
            
            print(f"    [{generated+1}/{min(max_per_run, len(needs_images))}] {event['name']}")
            
            update_data = {}
            
            # Generate hero if missing
            if item['needs_hero']:
                hero_prompt = f"""Create a newspaper-cover-style editorial illustration about {topic}.
STYLE: detailed editorial illustration, not photorealistic, not cartoonish, sophisticated newspaper aesthetic.
BACKGROUND: pure white (#ffffff), no gradients.
LAYOUT: illustration in top two-thirds, bottom third pure white.
OUTPUT: high resolution, no text, no captions."""
                
                print(f"      🎨 Generating hero (21:9)...")
                b64, mime = _generate_gemini_image(api_key, hero_prompt, '21:9')
                if b64:
                    url = upload_image_to_storage(b64, f"{slug}-hero", mime)
                    if url:
                        update_data['image_url'] = url
                        if not event.get('blur_color') or event['blur_color'] == '#1a365d':
                            update_data['blur_color'] = extract_blur_color_from_base64(b64)
                        print(f"      ✅ Hero uploaded")
            
            # Generate cover if missing
            if item['needs_cover']:
                cover_prompt = f"""Create a single FULL-BLEED editorial newspaper illustration in a classic engraved / woodcut style about {topic}.
The illustration MUST fill 100% of the canvas. NO empty space on ANY side.
Use bold, saturated colors. Flat colors + engraving shading. No gradients.
One dominant central subject. Background extends to ALL edges.
FORBIDDEN: photography, photorealism, 3D, gradients, pastels, text, logos, frames, borders, empty space."""
                
                print(f"      🎨 Generating cover (4:5)...")
                b64, mime = _generate_gemini_image(api_key, cover_prompt, '4:5')
                if b64:
                    url = upload_image_to_storage(b64, f"{slug}-cover", mime)
                    if url:
                        update_data['cover_image_url'] = url
                        print(f"      ✅ Cover uploaded")
            
            # Update event in database
            if update_data:
                try:
                    supabase.table('world_events').update(update_data).eq('id', event['id']).execute()
                    generated += 1
                    print(f"      ✅ Event updated with {len(update_data)} new image(s)")
                except Exception as e:
                    print(f"      ❌ DB update error: {e}")
            
            time.sleep(1)  # Rate limiting between events
        
        print(f"  ✅ Backfill complete: {generated}/{min(max_per_run, len(needs_images))} events updated")
        if len(needs_images) > max_per_run:
            print(f"     ({len(needs_images) - max_per_run} remaining, will process in next run)")
    
    except Exception as e:
        print(f"  ❌ Backfill error: {e}")


# ==========================================
# CLI INTERFACE
# ==========================================

if __name__ == "__main__":
    import sys
    
    print("World Event Detection System")
    print("="*40)
    
    # Test with sample article
    test_articles = [
        {
            'id': 'test-1',
            'title': 'Ukraine Launches Major Drone Strike on Russian Oil Depot',
            'content': 'Ukrainian forces conducted one of the largest drone attacks on Russian territory, targeting fuel storage facilities in multiple regions. The strikes disrupted fuel supplies to Russian military operations.'
        }
    ]
    
    result = detect_world_events(test_articles)
    print(f"\nResult: {json.dumps(result, indent=2)}")
