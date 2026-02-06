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
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass
from supabase import create_client, Client

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


def get_event_image(topic_prompt: str, event_slug: str = None) -> tuple:
    """
    Generate an AI image for world event using Gemini 2.5 Flash Image.
    Uploads to Supabase Storage and returns (public_url, blur_color) or (None, None) on failure.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        print("  ❌ GEMINI_API_KEY not set, image generation skipped")
        return None, None
    
    # Prompt for Gemini image generation
    prompt = f"""Create a newspaper-cover-style editorial illustration about {topic_prompt}.

The image should feel like a lead illustration or cover visual from TIME magazine, The Independent, The New York Times, or The Economist: intelligent, concept-driven, visually clever, and engaging rather than literal.

STYLE:
– detailed, expressive editorial illustration
– recognisable public figures allowed if relevant
– slightly exaggerated features allowed for wit and character
– not photorealistic, not cartoonish
– sophisticated, modern newspaper illustration aesthetic

BACKGROUND (CRITICAL):
– background must be pure white (#ffffff)
– no colour tint, no grey, no off-white
– no gradients, no texture, no patterns
– no shadows or lighting effects on the background

LAYOUT:
– illustration positioned entirely in the top two-thirds of the image
– bottom one-third must remain completely empty
– bottom one-third contains only pure white background
– no objects, details, fade, or visual elements in the bottom section

COMPOSITION:
– strong, balanced composition in the upper area
– clear separation between illustration and background
– cover-ready framing suitable for a newspaper or magazine front page

OUTPUT:
– high resolution
– newspaper-cover quality finish
– no text, no headlines, no captions"""

    try:
        # Call Gemini 2.5 Flash Image model using generateContent
        response = requests.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
            headers={
                'Content-Type': 'application/json',
                'x-goog-api-key': api_key
            },
            json={
                'contents': [{
                    'parts': [{'text': prompt}]
                }],
                'generationConfig': {
                    'responseModalities': ['IMAGE'],
                    'imageConfig': {
                        'aspectRatio': '21:9'
                    }
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"  ❌ Gemini API error: {response.status_code} - {response.text[:200]}")
            return None, None
        
        data = response.json()
        
        # Extract image from response
        parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        
        for part in parts:
            if 'inlineData' in part:
                base64_data = part['inlineData']['data']
                mime_type = part['inlineData'].get('mimeType', 'image/png')
                
                # Extract blur color from the generated image
                blur_color = extract_blur_color_from_base64(base64_data)
                
                # Generate unique filename using slug or timestamp
                import uuid
                filename = event_slug if event_slug else f"event-{uuid.uuid4().hex[:12]}"
                
                # Upload to Supabase Storage instead of storing base64
                image_url = upload_image_to_storage(base64_data, filename, mime_type)
                
                if image_url:
                    print(f"  ✅ AI image generated and uploaded for: {topic_prompt[:30]}...")
                    return image_url, blur_color
                else:
                    # Fallback to base64 if storage upload fails
                    print(f"  ⚠️ Storage upload failed, falling back to base64")
                    image_url = f'data:{mime_type};base64,{base64_data}'
                    return image_url, blur_color
        
        print(f"  ❌ No image in Gemini response")
        return None, None
        
    except Exception as e:
        print(f"  ❌ Image generation error: {e}")
        return None, None


def create_world_event(event_data: Dict, article_id: str) -> Optional[Dict]:
    """Create a new world event in Supabase"""
    if not supabase:
        print("Supabase not configured")
        return None
    
    try:
        # Generate AI image for event (uploads to Supabase Storage)
        image_url, blur_color = get_event_image(event_data['topic_prompt'], event_data.get('slug'))
        
        if image_url is None:
            print("  ⚠️ No image generated, event will have no image")
        
        # Parse started_at date if provided
        started_at = None
        if event_data.get('started_at'):
            try:
                started_at = event_data['started_at']
                print(f"  📅 Event start date: {started_at}")
            except Exception as e:
                print(f"  ⚠️ Could not parse start date: {e}")
        
        # Insert event (note: created_by_article_id removed as it expects UUID but we have integer IDs)
        insert_data = {
            'name': event_data['name'],
            'slug': event_data['slug'],
            'topic_prompt': event_data['topic_prompt'],
            'background': event_data.get('background', ''),
            'key_facts': event_data.get('key_facts', []),
            'importance': event_data.get('importance', 5),
            'image_url': image_url,
            'blur_color': blur_color,
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
                    'summary': event_data['timeline_entry'].get('summary', ''),
                    'significance': 'high'
                }).execute()
            
            # Create initial latest development entry
            initial_summary = event_data.get('background', '')
            if event_data.get('timeline_entry'):
                initial_summary = event_data['timeline_entry'].get('summary', initial_summary)
            
            supabase.table('world_event_latest').insert({
                'event_id': event['id'],
                'title': event_data.get('timeline_entry', {}).get('headline', event_data['name']),
                'summary': initial_summary,
                'image_url': image_url,
                'published_at': datetime.utcnow().isoformat()
            }).execute()
            print(f"  ✅ Created initial latest development")
            
            # Search historical articles and add to timeline
            search_historical_articles_for_event(event, event_data)
            
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
                            'significance': 'medium',
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
                'summary': data['timeline_entry'].get('summary', ''),
                'significance': data['timeline_entry'].get('significance', 'medium')
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
    
    return processed


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
