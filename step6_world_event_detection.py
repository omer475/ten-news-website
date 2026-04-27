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
    model: str = "gemini-2.5-flash-lite"
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

Check if this article DIRECTLY advances the core story of any existing event.
The article must be a genuine new development of that specific event.

STRICT MATCHING RULES:
- The article must be about THE SAME specific story/conflict/situation
- Sharing a broad topic is NOT enough (e.g. "AI regulation in EU" does NOT match "US-China AI rivalry")
- Same country is NOT enough (e.g. "Turkey earthquake" does NOT match "Turkey NATO drills")
- Same industry is NOT enough (e.g. "Tesla stock drops" does NOT match "US-China Trade War")

DO NOT MATCH if the article is only tangentially related or covers a different angle of the same broad topic.

═══════════════════════════════════════════════════════════════
TASK 2: Is this a NEW major world event?
═══════════════════════════════════════════════════════════════

If NO existing event matches, determine if this is a NEW major world event.

A MAJOR ONGOING WORLD EVENT must meet AT LEAST ONE of these patterns:

PATTERN A — GLOBAL ONGOING (all 4 of):
1. GLOBAL SIGNIFICANCE - Affects multiple countries or has worldwide impact
2. ONGOING - Will continue for days, weeks, or months
3. MAJOR FIGURES - Involves world leaders, major institutions, or significant entities
4. HIGH IMPACT - Major humanitarian, economic, political, or security implications

PATTERN B — BREAKING-NEWS INCIDENT (all 3 of):
1. SINGLE NAMED EVENT - A specific, identifiable incident with a clear when+where
   (e.g. "WHCD Shooting", "Heathrow Drone Incident", "Notre Dame Fire")
2. MULTI-PUBLISHER COVERAGE - The kind of story that 5+ outlets will independently
   write about within 24 hours (mass casualty, security breach involving heads of
   state, terror attack, plane crash, building collapse, prominent assassination)
3. MAJOR FIGURE OR INSTITUTION involved (head of state, supreme court, federal
   agency, top sports/entertainment institution)

Pattern B exists specifically so 5+ articles about the same one-day breaking
event share a world_event_id and can be deduplicated downstream. Without it,
each publisher's story gets a different cluster_id and the user sees the same
incident 5 times in one session. Trust this branch on incidents where you can
already imagine the alternate-publisher headlines.

TYPES OF WORLD EVENTS TO DETECT:
✓ Wars/Conflicts: "Israel-Gaza War", "Russia-Ukraine War" (Pattern A)
✓ Trade/Economic: "Trump's Tariffs", "US-China Trade War" (Pattern A)
✓ Global Summits: "G20 Summit", "World Economic Forum", "COP29" (Pattern A)
✓ Major Disasters: "Turkey Earthquake", "Hawaii Wildfires" (Pattern A)
✓ Political Crises: "Iran Protests", "Venezuela Crisis" (Pattern A)
✓ Health Emergencies: "Bird Flu Outbreak", "Mpox Emergency" (Pattern A)
✓ Breaking incidents: "WHCD Shooting", "Heathrow Drone Incident",
  "Trump Assassination Attempt", "Notre Dame Fire" (Pattern B — single
  high-profile incident with multi-publisher coverage in 24 hours)

NOT world events:
✗ "Company releases new product" - NO (not global significance)
✗ "Celebrity scandal" - NO (not major impact)
✗ "Local election results" - NO (not global)
✗ "Stock drops 2%" - NO (unless major crash)
✗ "Local crime story" - NO (no major figure / institution)

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
  "match_confidence": 0-100,

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
        except Exception:
            pass  # Bucket likely already exists

        # Remove existing file first (for upsert behavior)
        try:
            supabase.storage.from_('images').remove([storage_path])
        except Exception:
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
    Generate a single 1:1 editorial illustration for a world event.
    Used for both event boxes and event detail pages.

    Uploads to Supabase Storage.
    Returns dict with: image_url, cover_image_url (same URL), blur_color
    """
    import random

    api_key = os.environ.get('GEMINI_API_KEY')
    result = {'image_url': None, 'cover_image_url': None, 'blur_color': None}

    if not api_key:
        print("  ❌ GEMINI_API_KEY not set, image generation skipped")
        return result

    import uuid
    base_filename = event_slug if event_slug else f"event-{uuid.uuid4().hex[:12]}"

    # Pick a random accent color from the palette
    ACCENT_PALETTE = ['#BFFF00', '#FF6B35', '#7B68EE', '#FF4757', '#00D2FF']
    accent_color = random.choice(ACCENT_PALETTE)

    prompt = f"""Create a conceptual editorial illustration about {topic_prompt}.

STYLE (CRITICAL — follow exactly):
– Loose, energetic, hand-drawn black ink illustration with raw expressive energy
– Lines should feel fast, confident, and alive — like an illustrator sketching rapidly with a thick brush pen or marker
– Varying line weight: bold sweeping strokes mixed with quick scratchy marks and flicks
– Lines should have natural wobble, drips, and imperfections — NOT clean, NOT digital, NOT vector-like
– Visible drawing energy: speed lines, motion marks, splatter dots, quick hatching for emphasis
– The overall feel should be like a brilliant illustrator's spontaneous editorial sketch — raw and alive
– Playful, witty, punchy, slightly provocative tone — NOT corporate, NOT polished, NOT stiff
– Think: Ralph Steadman meets Christoph Niemann meets modern political cartoon sketchbook
– Exactly ONE accent color: {accent_color} (e.g. #BFFF00, #FF6B35, #7B68EE, #FF4757, #00D2FF)
– The accent color is splashed on boldly — slightly messy edges, bleeding outside the lines, raw and loose
– NO other colors besides black ink, the single accent color, and the background

FIGURES — FACE STYLE (ABSOLUTE RULE — NO EXCEPTIONS):
– Faces MUST be extremely simple: oval head, two tiny dot/dash eyes, small line mouth
– Think: emoticon-level simplicity — :( drawn on an egg shape
– NEVER draw realistic noses, ears, jawlines, eyebrows, or hair
– NEVER distinguish gender through facial features or hairstyles
– ALL figures must have the same abstract face style — no exceptions
– If a figure needs to be distinguished (e.g. two opposing sides), use clothing/props NOT facial features
– Reference: the absolute simplest face that still conveys basic emotion

FIGURES — BODY STYLE:
– Exaggerated, dynamic, full-of-life human characters
– Elongated/oval heads with personality — NOT perfect circles, NOT realistic
– EXTREME body language — leaning hard, pulling, pushing, falling, reaching, struggling
– Poses should feel like frozen mid-action — maximum kinetic energy
– Bodies drawn with fast continuous flowing black strokes — gestural and loose
– Limbs can be exaggerated in length for dramatic effect
– Some areas use solid black fills (suits, shoes) for punchy contrast
– Figures should feel ALIVE — like they could leap off the page
– Maximum 2-4 figures per illustration

ENERGY AND MOVEMENT (CRITICAL):
– Every illustration must feel like it has MOTION and TENSION
– Add speed lines, action marks, small impact bursts, or motion trails
– Objects can be tilting, cracking, exploding, colliding, or breaking apart
– The scene should feel like a frozen moment of dramatic action
– Small detail marks: tiny lines radiating from impact points, small dots for dust/debris, quick zigzag lines for electricity/tension

BACKGROUND (CRITICAL):
– The background must be a visible, colored tint inspired by the accent color
– It should be OBVIOUSLY colored — the viewer should immediately notice it is NOT grey
– Examples based on accent color:
  - If accent is #BFFF00 (lime): background = soft yellow-green (#D8D8B0)
  - If accent is #FF6B35 (orange): background = soft warm peach (#E8CDB8)
  - If accent is #7B68EE (purple): background = soft lavender (#D0C4E8)
  - If accent is #FF4757 (red): background = soft warm salmon (#E8C8B8)
  - If accent is #00D2FF (blue): background = soft sky blue (#B8D4E8)
  - If accent is #FFD700 (gold): background = soft warm cream (#E8DDB8)
  - If accent is #FF1493 (pink): background = soft rose (#E8C0D0)
  - If accent is #32CD32 (green): background = soft mint (#B8E0C0)
  - If accent is #FF8C00 (dark orange): background = soft apricot (#E8D0B0)
  - If accent is #6A5ACD (slate blue): background = soft periwinkle (#C8C0E0)
  - If accent is #DC143C (crimson): background = soft blush (#E0C0B8)
  - If accent is #20B2AA (teal): background = soft seafoam (#B8D8D4)
  - If accent is #FF69B4 (hot pink): background = soft pink (#E8C8D8)
  - If accent is #4169E1 (royal blue): background = soft powder blue (#B8C8E0)
  - If accent is #8B4513 (brown): background = soft tan (#DDD0C0)
– The tint should be clearly obvious — approximately 50-60% grey, 40-50% color
– For any accent color not listed: derive a light, desaturated, pastel version at ~40% saturation and ~85% lightness
– NO gradients, NO textures, NO patterns, NO noise
– The entire background must be uniform

COLOR RULES (CRITICAL):
– Only 3 elements: black ink lines/fills, ONE accent color, tinted background
– The accent color MUST appear — used boldly on 1-3 key elements for visual punch
– Accent color fills should feel loose and energetic, not perfectly precise
– Solid black fills allowed for clothing and contrast
– NO shadows, NO gradients — flat color only
– NO additional colors — strict 3-element palette
– If the topic involves multiple sides, use shapes/symbols NOT multiple colors

CREATIVITY AND CONCEPT (CRITICAL):
– The concept must be ORIGINAL and UNEXPECTED — avoid obvious literal depictions
– Use surprising visual metaphors: e.g. a melting chess king for political downfall, a puppet with cut strings for independence, a cracked hourglass for a deadline crisis
– Combine two unrelated objects to create a new meaning — this is the heart of great editorial illustration
– Avoid cliché metaphors: no generic handshakes, no simple tug-of-war unless reimagined in a fresh way
– The illustration should make someone stop scrolling — it needs to be visually surprising and intellectually clever
– Think like a top editorial illustrator pitching a cover concept — what image would make an editor say "that's brilliant"
– Each illustration should feel like it could only belong to THIS specific story — not a generic template

COMPOSITION (CRITICAL):
– All illustration elements in the TOP TWO-THIRDS of the image
– BOTTOM ONE-THIRD completely empty — only the tinted background color
– No objects, figures, ground lines, or any elements in the bottom third
– Centered composition within the top two-thirds
– Balanced left-right weight
– Allow slight asymmetry for dynamic tension

OUTPUT:
– Square format (1:1 aspect ratio)
– High resolution
– Text and symbols (e.g. $, €, compass directions) are allowed when they serve the concept
– No captions, no watermarks, no logos"""

    print(f"  🎨 Generating event image (1:1) with accent {accent_color}...")
    img_b64, img_mime = _generate_gemini_image(api_key, prompt, '1:1')

    if img_b64:
        result['blur_color'] = extract_blur_color_from_base64(img_b64)
        img_url = upload_image_to_storage(img_b64, base_filename, img_mime)
        if img_url:
            # Set both columns to the same URL (single image for everything)
            result['image_url'] = img_url
            result['cover_image_url'] = img_url
            print(f"  ✅ Event image uploaded: {base_filename}")
        else:
            print(f"  ⚠️ Storage upload failed")
    else:
        print(f"  ❌ No image generated for event")

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
            
            # Create initial timeline entry (always, with fallback if Gemini omits timeline_entry)
            try:
                tl = event_data.get('timeline_entry') or {}
                tl_headline = tl.get('headline') or event_data['name']
                tl_summary = tl.get('summary') or event_data.get('background', '')[:500]
                supabase.table('world_event_timeline').insert({
                    'event_id': event['id'],
                    'date': datetime.utcnow().date().isoformat(),
                    'headline': tl_headline,
                    'summary': tl_summary
                }).execute()
                print(f"  ✅ Created initial timeline entry: {tl_headline[:60]}")
            except Exception as tl_err:
                print(f"  ⚠️ Failed to create initial timeline entry: {tl_err}")
            
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
            
            # Generate smart components (what_to_watch, data_analytics)
            try:
                components = generate_event_components(
                    event_data['name'],
                    event_data.get('topic_prompt', ''),
                    event_data.get('background', '')
                )
                if components:
                    # Extract dedicated column values
                    what_to_watch = components.get('what_to_watch', [])
                    has_what_to_watch = len(what_to_watch) > 0
                    data_analytics = components.get('data_analytics')
                    data_sources = []
                    if data_analytics:
                        for chart in data_analytics.get('charts', []):
                            if chart.get('source'):
                                data_sources.append(chart['source'])
                        data_sources = list(dict.fromkeys(data_sources))

                    supabase.table('world_events').update({
                        'components': components,
                        'has_what_to_watch': has_what_to_watch,
                        'what_to_watch': what_to_watch,
                        'data_analytics': data_analytics,
                        'data_sources': data_sources
                    }).eq('id', event['id']).execute()
                    print(f"  ✅ Generated event components (charts={len((data_analytics or {}).get('charts', []))})")
            except Exception as comp_err:
                print(f"  ⚠️ Component generation failed (non-critical): {comp_err}")
            
            return event
    except Exception as e:
        print(f"❌ Failed to create world event: {e}")
    return None


def find_duplicate_event(new_name: str, existing_events: List[Dict]) -> Optional[Dict]:
    """
    Check if a proposed new event name is too similar to an existing event.
    Returns the matching existing event if duplicate found, None otherwise.

    Uses word overlap to catch cases like "Ukraine War" vs "Russia-Ukraine War".
    """
    STOP_WORDS = {'the', 'of', 'in', 'and', 'a', 'to', 'for', 'on', 'at', 'by', 'with', 'from', 'new'}

    new_words = set(new_name.lower().replace('-', ' ').replace("'", '').split()) - STOP_WORDS

    best_match = None
    best_overlap = 0

    for event in existing_events:
        existing_words = set(event['name'].lower().replace('-', ' ').replace("'", '').split()) - STOP_WORDS
        overlap = new_words & existing_words

        # If 2+ significant words overlap, it's likely a duplicate
        if len(overlap) >= 2 and len(overlap) > best_overlap:
            best_overlap = len(overlap)
            best_match = event

        # Also check if one name is a substring of the other
        new_lower = new_name.lower().replace("'", '')
        existing_lower = event['name'].lower().replace("'", '')
        if (new_lower in existing_lower or existing_lower in new_lower) and len(new_lower) > 5:
            return event

    return best_match


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
            result = supabase.table('published_articles').select(
                'id, title_news, summary_bullets_news, published_at, created_at'
            ).ilike('title_news', f'%{keyword}%').gte(
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
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    # Batch verify articles with AI (check up to 30 at a time)
    articles_to_check = matched_articles[:30]
    
    article_list = "\n".join([
        f"- ID: {a['id']}, Title: {(a.get('title_news') or a.get('title', ''))[:100]}"
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
                            'headline': (article.get('title_news') or article.get('title', ''))[:200],
                            'summary': (article.get('summary_bullets_news', [''])[0][:500] if isinstance(article.get('summary_bullets_news'), list) and article.get('summary_bullets_news') else '')
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
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
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
        
        # Add timeline entry (always, with fallback if Gemini omits timeline_entry)
        try:
            tl = data.get('timeline_entry') or {}
            tl_headline = tl.get('headline') or data.get('title', event_name)
            tl_summary = tl.get('summary') or data.get('summary', '')[:500]
            supabase.table('world_event_timeline').insert({
                'event_id': event_id,
                'date': datetime.utcnow().date().isoformat(),
                'headline': tl_headline,
                'summary': tl_summary
            }).execute()
            print(f"  ✅ Added timeline entry: {tl_headline[:60]}")
        except Exception as tl_err:
            print(f"  ⚠️ Failed to add timeline entry: {tl_err}")

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
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
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
                # Check confidence threshold — skip weak matches
                confidence = result.get('match_confidence', 50)
                event_id = result['existing_event_id']
                event_name = result.get('existing_event_name', 'Unknown')

                if confidence < 70:
                    print(f"  → Skipped weak match to '{event_name}' (confidence: {confidence}%)")
                else:
                    tag_article_to_event(article_id, event_id)
                    update_latest_development(event_id, event_name, article, article_id)

                    article['world_event_id'] = event_id
                    articles_tagged += 1
                    print(f"  → Matched existing event: {event_name} (confidence: {confidence}%)")
                
            elif result.get('is_new_world_event') and result.get('new_event'):
                # DEDUP GUARD: Check if proposed event is too similar to an existing one
                proposed_name = result['new_event'].get('name', '')
                duplicate = find_duplicate_event(proposed_name, existing_events)

                if duplicate:
                    # Match to existing event instead of creating a duplicate
                    print(f"  → DEDUP: \"{proposed_name}\" matches existing \"{duplicate['name']}\" — tagging instead of creating")
                    tag_article_to_event(article_id, duplicate['id'])
                    update_latest_development(duplicate['id'], duplicate['name'], article, article_id)
                    article['world_event_id'] = duplicate['id']
                    articles_tagged += 1
                else:
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
                except Exception:
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
    import random

    if not supabase:
        return

    try:
        # Find ongoing events missing image_url
        result = supabase.table('world_events').select(
            'id, name, slug, topic_prompt, image_url, cover_image_url'
        ).eq('status', 'ongoing').order('last_article_at', desc=True).execute()

        if not result.data:
            return

        # Find events that need images (missing either column or have base64 leftovers)
        needs_images = []
        for event in result.data:
            has_img = event.get('image_url') and not str(event['image_url']).startswith('data:')
            has_cover = event.get('cover_image_url') and not str(event['cover_image_url']).startswith('data:')
            if not has_img or not has_cover:
                needs_images.append(event)

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
        ACCENT_PALETTE = ['#BFFF00', '#FF6B35', '#7B68EE', '#FF4757', '#00D2FF']

        for event in needs_images[:max_per_run]:
            topic = event.get('topic_prompt') or event.get('name', '')
            slug = event.get('slug') or f"event-{uuid.uuid4().hex[:12]}"
            accent_color = random.choice(ACCENT_PALETTE)

            print(f"    [{generated+1}/{min(max_per_run, len(needs_images))}] {event['name']}")

            images = get_event_images(topic, slug)

            update_data = {}
            if images['image_url']:
                update_data['image_url'] = images['image_url']
                update_data['cover_image_url'] = images['image_url']
            if images['blur_color']:
                update_data['blur_color'] = images['blur_color']

            if update_data:
                try:
                    supabase.table('world_events').update(update_data).eq('id', event['id']).execute()
                    generated += 1
                    print(f"      ✅ Event updated with new image")
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
