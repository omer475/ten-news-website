# STEP 6: COMPONENT GENERATION (Timeline, Details, Graph)
# ================================================================
# Purpose: Generate supplementary components using Perplexity search context
# Model: Gemini 2.0 Flash (temporarily switched from Claude)
# Input: Articles with dual-language content from Step 5 + Perplexity context from Step 4
# Output: Timeline, Details, Graph based on web search results
# Writes: timeline, details, graph (as selected by Gemini in Step 3)
# Cost: ~$0.60 per 100 articles
# Time: ~2-3 minutes for 100 articles

import requests
import json
import time
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentWriterConfig:
    """Configuration for component writer (using Gemini temporarily)"""
    model: str = "gemini-2.0-flash-exp"  # Temporarily using Gemini instead of Claude
    max_tokens: int = 1536  # Enough for timeline + details + graph
    temperature: float = 0.3
    timeout: int = 60
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.3


# ==========================================
# COMPONENT GENERATION PROMPT
# ==========================================

COMPONENT_PROMPT = """Generate news article components using the provided search data.

ARTICLE TITLE: {title}
BULLET SUMMARY: {bullets}
SELECTED COMPONENTS: {components}
SEARCH CONTEXT DATA: {context}

Generate ONLY the selected components. Follow formats EXACTLY.

═══════════════════════════════════════════════════════════════
🗺️ MAP
═══════════════════════════════════════════════════════════════

Generate 1-2 precise, interesting location markers.

THE LOCATION MUST BE:
✓ Specific venue, building, facility, or installation
✓ Directly relevant to the story (where it happened, where subject is)
✓ Interesting enough that readers would want to see it
✓ Verified from article text or reliable search

LOCATION TYPES:

Government Buildings:
- "The Kremlin" - Russian government
- "The White House" - US President
- "Capitol Building" - US Congress
- "Pentagon" - US Military
- "10 Downing Street" - UK Prime Minister

Military/Nuclear Facilities:
- "Yongbyon Nuclear Complex" - North Korea nuclear
- "Novorossiysk Naval Base" - Russian Black Sea Fleet
- "Zaporizhzhia Nuclear Plant" - Ukraine nuclear
- "Area 51" - US military
- "Natanz Nuclear Facility" - Iran nuclear

Entertainment Venues:
- "Studio 8H, 30 Rockefeller Plaza" - SNL studio
- "Dolby Theatre" - Oscars venue
- "Madison Square Garden" - Major events
- "Hollywood Bowl" - Concerts

Meeting/Event Venues:
- "Mar-a-Lago" - Trump's Florida residence
- "Davos Congress Centre" - World Economic Forum
- "UN Headquarters" - United Nations

LOCATION TYPE RULES:
═════════════════════
Use "location_type": "pin" for SPECIFIC locations (buildings, venues, facilities)
Use "location_type": "area" for LARGER regions when the whole country/region is relevant

PIN examples (specific places):
- White House, Studio 8H, Kremlin, Pentagon, specific nuclear facilities

AREA examples (highlight entire country/region):
- War zones (Ukraine, Gaza, Syria)
- Country-wide sanctions/policies
- Natural disasters affecting entire regions
- Elections/referendums nationwide

NEVER USE AREA FOR:
✗ Stories about specific events at specific locations
✗ When a building or venue can be identified

OUTPUT FORMAT FOR PIN (specific location):
[
  {
    "name": "Studio 8H, 30 Rockefeller Plaza",
    "type": "venue",
    "location_type": "pin",
    "city": "New York",
    "country": "USA",
    "coordinates": {"lat": 40.7593, "lng": -73.9794},
    "description": "Historic studio where SNL has broadcast since 1975"
  }
]

OUTPUT FORMAT FOR AREA (country/region highlight):
[
  {
    "name": "Ukraine",
    "type": "country",
    "location_type": "area",
    "region_name": "Ukraine",
    "coordinates": {"lat": 48.3794, "lng": 31.1656},
    "description": "War zone where Russian offensive continues"
  }
]

REAL CORRECTIONS FOR YOUR EXAMPLES:

❌ WRONG: "Seoul, South Korea" for North Korea nuclear story
✓ CORRECT: {
    "name": "Yongbyon Nuclear Complex",
    "type": "military",
    "city": "Yongbyon",
    "country": "North Korea",
    "coordinates": {"lat": 39.7947, "lng": 125.7553},
    "description": "North Korea's main nuclear weapons facility"
  }

❌ WRONG: "Ukraine" for peace talks story
✓ CORRECT: {
    "name": "Mar-a-Lago",
    "type": "venue",
    "city": "Palm Beach",
    "country": "USA",
    "coordinates": {"lat": 26.6777, "lng": -80.0367},
    "description": "Trump's residence hosting Russia-Ukraine negotiations"
  }

❌ WRONG: "United States" for SNL story
✓ CORRECT: {
    "name": "Studio 8H, 30 Rockefeller Plaza",
    "type": "venue",
    "city": "New York",
    "country": "USA",
    "coordinates": {"lat": 40.7593, "lng": -73.9794},
    "description": "SNL studio where Trump parody sketch aired"
  }

❌ WRONG: "United States" for Trump policy story
✓ CORRECT: {
    "name": "The White House",
    "type": "building",
    "city": "Washington DC",
    "country": "USA",
    "coordinates": {"lat": 38.8977, "lng": -77.0365},
    "description": "Where Trump announced cash payment policy"
  }
OR: {
    "name": "Capitol Building",
    "type": "building",
    "city": "Washington DC",
    "country": "USA",
    "coordinates": {"lat": 38.8899, "lng": -77.0091},
    "description": "Where Congress will vote on Trump Accounts"
  }

═══════════════════════════════════════════════════════════════
📅 TIMELINE
═══════════════════════════════════════════════════════════════

Generate 2-4 events ONLY if timeline was selected.

Remember: Timeline should only be selected for complex stories that need historical context.

RULES:
✗ DO NOT include the main news event from the title
✓ Only background events that help understanding
✓ Chronological order (oldest → newest)
✓ Each event: MAX 12 words
✓ Events should answer "how did we get here?"

OUTPUT FORMAT:
[
  {"date": "Feb 2022", "event": "Russia invades Ukraine beginning full-scale war"},
  {"date": "Apr 2024", "event": "Previous peace talks collapse after Bucha massacre revealed"},
  {"date": "Nov 2024", "event": "Trump wins election promising quick peace deal"}
]

═══════════════════════════════════════════════════════════════
📋 DETAILS
═══════════════════════════════════════════════════════════════

Generate EXACTLY 3 fact cards NOT in the bullet summary.

RULES:
✓ Every fact MUST contain a number
✓ Facts must NOT duplicate bullet summary
✓ MAX 7 words per detail
✓ Prioritize interesting "hidden" facts from article

OUTPUT FORMAT:
[
  {"label": "SNL season", "value": "50th anniversary"},
  {"label": "Episode runtime", "value": "90 minutes"},
  {"label": "James Austin Johnson tenure", "value": "Since 2021"}
]

═══════════════════════════════════════════════════════════════
📊 GRAPH
═══════════════════════════════════════════════════════════════

Generate chart data only if graph was selected.

OUTPUT FORMAT:
{
  "type": "line",
  "title": "Interest Rate 2022-2024",
  "data": [
    {"date": "2022-03", "value": 0.50},
    {"date": "2023-07", "value": 5.25},
    {"date": "2024-01", "value": 5.50}
  ],
  "y_label": "Rate (%)",
  "x_label": "Date"
}

═══════════════════════════════════════════════════════════════
FINAL OUTPUT
═══════════════════════════════════════════════════════════════

{
  "map": [...],
  "timeline": [...],
  "details": [...],
  "graph": {...}
}

Include ONLY selected components.

═══════════════════════════════════════════════════════════════
PRE-SUBMISSION CHECKLIST
═══════════════════════════════════════════════════════════════

□ MAP:
  - Is location a specific venue/building/facility?
  - Is it the RIGHT location for this story?
  - NOT a country, city, or state?
  - Coordinates point to exact spot?

□ TIMELINE:
  - Was timeline actually needed for this story?
  - Does NOT include the main news event?
  - Only 2-4 contextual events?

□ DETAILS:
  - Exactly 3 details?
  - All have numbers?
  - None duplicate bullet summary?

□ GRAPH:
  - At least 4 data points?
  - Clear trend to visualize?
"""


# ==========================================
# CLAUDE COMPONENT WRITER CLASS
# ==========================================

class ClaudeComponentWriter:
    """
    Generates article components using Gemini (temporarily switched from Claude)
    Components: Timeline, Details, Graph
    Based on Perplexity search context data
    """
    
    def __init__(self, api_key: str, config: Optional[ComponentWriterConfig] = None):
        """
        Initialize writer with API key and optional config
        
        Args:
            api_key: Gemini API key (temporarily, was Anthropic)
            config: ComponentWriterConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or ComponentWriterConfig()
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.config.model}:generateContent?key={api_key}"
    
    def write_components(self, article: Dict) -> Optional[Dict]:
        """
        Generate components for a single article
        
        Args:
            article: Article dict with:
                - title_news: Article title (for context)
                - selected_components: List of components to generate
                - context_data: Perplexity search results
        
        Returns:
            Dict with generated components or None if failed
        """
        print(f"   🔧 DEBUG: Starting component generation...")
        
        # Get selected components
        components = article.get('components', article.get('selected_components', []))
        print(f"   🔧 DEBUG: Components to generate: {components}")
        
        if not components:
            return {}  # No components selected
        
        # Build formatted system prompt with article data
        print(f"   🔧 DEBUG: Building system prompt...")
        system_prompt = self._build_system_prompt(article, components)
        print(f"   🔧 DEBUG: System prompt built ({len(system_prompt)} chars)")
        
        # Try up to retry_attempts times
        for attempt in range(self.config.retry_attempts):
            try:
                print(f"   🔧 DEBUG: Calling Gemini API (attempt {attempt + 1})...")
                
                # Build Gemini API request
                request_data = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": system_prompt + "\n\nGenerate the components now. Return ONLY valid JSON."}]
                        }
                    ],
                    "generationConfig": {
                        "temperature": self.config.temperature,
                        "maxOutputTokens": self.config.max_tokens,
                        "responseMimeType": "application/json"
                    }
                }
                
                response = requests.post(self.api_url, json=request_data, timeout=self.config.timeout)
                
                # Handle rate limiting
                if response.status_code == 429:
                    wait_time = (attempt + 1) * 3
                    print(f"   ⚠️ Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                response.raise_for_status()
                response_json = response.json()
                
                # Extract response text from Gemini format
                response_text = response_json['candidates'][0]['content']['parts'][0]['text']
                print(f"   📝 Raw Gemini response: {response_text[:300]}...")
                
                # Remove markdown code blocks if present
                import re
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
                if json_match:
                    response_text = json_match.group(1).strip()
                else:
                    response_text = response_text.replace('```json', '').replace('```', '')
                    response_text = response_text.strip()
                
                # Try to find JSON object with braces if not starting with {
                if not response_text.startswith('{'):
                    json_obj_match = re.search(r'\{[\s\S]*\}', response_text)
                    if json_obj_match:
                        response_text = json_obj_match.group(0)
                    elif '"timeline"' in response_text or '"details"' in response_text or '"map"' in response_text or '"graph"' in response_text:
                        # Wrap bare JSON content in braces
                        response_text = '{' + response_text.strip() + '}'
                
                # Clean up trailing commas
                response_text = re.sub(r',\s*}', '}', response_text)
                response_text = re.sub(r',\s*]', ']', response_text)
                
                # Remove any leading/trailing whitespace and newlines inside the JSON
                response_text = response_text.strip()
                
                print(f"   📝 Cleaned JSON: {response_text[:200]}...")
                
                # Parse JSON
                result = json.loads(response_text)
                
                # Validate
                is_valid, errors = self._validate_output(result, components)
                
                if is_valid:
                    return result
                else:
                    print(f"  ⚠ Validation issues (attempt {attempt + 1}): {errors[:2]}")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                print(f"   Response text: {response_text[:200]}...")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
            except Exception as e:
                print(f"❌ Error: {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None  # Failed after all retries
    
    def _build_system_prompt(self, article: Dict, components: List[str]) -> str:
        """Build system prompt with article data filled in"""

        title = article.get('title_news', article.get('title', 'Unknown'))

        # Get bullet summary
        bullets = article.get('summary_bullets_news', article.get('summary_bullets', []))
        if isinstance(bullets, list):
            bullets_text = '\n'.join([f"• {b}" for b in bullets])
        else:
            bullets_text = str(bullets)

        # Build context string from context_data
        context_data = article.get('context_data', {})
        context_parts = []
        for component in components:
            if component in context_data and context_data[component]:
                context_text = context_data[component].get('results', '') if isinstance(context_data[component], dict) else str(context_data[component])
                context_parts.append(context_text[:2500])  # Limit per component

        context_str = '\n\n'.join(context_parts) if context_parts else 'No additional context available.'
        
        # Add map_locations to context if available (from Step 6 selection)
        map_locations = article.get('map_locations', [])
        if map_locations and 'map' in components:
            map_hint = f"\n\nSELECTED MAP LOCATIONS (use these for map generation):\n"
            for loc in map_locations:
                map_hint += f"• {loc}\n"
            context_str += map_hint

        # Format the prompt template with article data using replace (not .format()
        # because the prompt contains JSON examples with braces)
        formatted_prompt = COMPONENT_PROMPT
        formatted_prompt = formatted_prompt.replace('{title}', title)
        formatted_prompt = formatted_prompt.replace('{bullets}', bullets_text)
        formatted_prompt = formatted_prompt.replace('{components}', ', '.join(components))
        formatted_prompt = formatted_prompt.replace('{context}', context_str)

        return formatted_prompt
    
    def _validate_output(self, result: Dict, selected_components: List[str]) -> tuple[bool, List[str]]:
        """
        Validate component output
        
        Returns:
            (is_valid, errors)
        """
        errors = []
        
        if 'timeline' in selected_components:
            if 'timeline' not in result:
                errors.append("Timeline selected but not in output")
            elif len(result['timeline']) < 2 or len(result['timeline']) > 4:
                errors.append(f"Timeline event count: {len(result['timeline'])} (need 2-4)")
        
        if 'details' in selected_components:
            if 'details' not in result:
                errors.append("Details selected but not in output")
            elif len(result['details']) != 3:
                errors.append(f"Details count: {len(result['details'])} (need exactly 3)")
            else:
                for i, detail in enumerate(result['details']):
                    # Handle both old format (string) and new format (dict with label/value)
                    if isinstance(detail, dict):
                        # New format: {"label": "...", "value": "..."}
                        value = str(detail.get('value', ''))
                        if not any(char.isdigit() for char in value):
                            errors.append(f"Detail {i+1} has no number in value: '{value}'")
                    elif isinstance(detail, str):
                        # Old format: "Label: Value"
                        if not any(char.isdigit() for char in detail):
                            errors.append(f"Detail {i+1} has no number: '{detail}'")
        
        if 'graph' in selected_components:
            if 'graph' not in result:
                errors.append("Graph selected but not in output")
        
        if 'map' in selected_components:
            if 'map' not in result:
                errors.append("Map selected but not in output")
            elif not isinstance(result['map'], list) or len(result['map']) < 1:
                errors.append("Map must have at least 1 location")
            else:
                # Validate each location has required fields and is precise (not just country/city)
                vague_locations = ['ukraine', 'russia', 'israel', 'palestine', 'china', 'usa', 'united states', 
                                   'middle east', 'europe', 'asia', 'australia', 'sydney', 'moscow', 'gaza city',
                                   'baltimore', 'new york', 'london', 'paris', 'tokyo', 'beijing', 'california',
                                   'new south wales', 'eastern europe', 'downtown', 'city center', 'suburbs']
                valid_types = ['venue', 'building', 'landmark', 'infrastructure', 'military', 'transport', 'street']
                for i, loc in enumerate(result['map']):
                    if not isinstance(loc, dict):
                        errors.append(f"Map location {i+1} is not a dict")
                    elif 'name' not in loc or 'coordinates' not in loc:
                        errors.append(f"Map location {i+1} missing name or coordinates")
                    elif loc.get('name', '').lower() in vague_locations:
                        errors.append(f"Map location {i+1} is too vague: '{loc.get('name')}' (need specific venue/building/landmark)")
                    # Validate type field if present
                    if 'type' in loc and loc['type'] not in valid_types:
                        errors.append(f"Map location {i+1} has invalid type: '{loc.get('type')}'")
                    # Validate coordinates format
                    if 'coordinates' in loc and isinstance(loc['coordinates'], dict):
                        if 'lat' not in loc['coordinates'] or 'lng' not in loc['coordinates']:
                            errors.append(f"Map location {i+1} coordinates missing lat or lng")
        
        return len(errors) == 0, errors
    
    def write_all_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Generate components for all articles
        
        Args:
            articles: List of articles from Step 5 with dual-language content
        
        Returns:
            Articles with components added
        """
        if not articles:
            return []
        
        print(f"\n{'='*60}")
        print(f"STEP 6: COMPONENT GENERATION")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        failed = []
        
        for i, article in enumerate(articles, 1):
            title = article.get('title_news', article.get('title', 'Unknown'))[:60]
            components = article.get('components', article.get('selected_components', []))
            
            print(f"[{i}/{len(articles)}] Generating components: {title}")
            print(f"  Components: {', '.join(components) if components else 'none'}")
            
            if not components:
                # No components selected, just pass through
                results.append(article)
                print(f"  (No components selected)")
                continue
            
            # Generate components
            generated = self.write_components(article)
            
            if generated:
                # Add components to article
                complete_article = {**article, **generated}
                results.append(complete_article)
                print(f"  Components generated: {', '.join(generated.keys())} ✓")
            else:
                # Failed, but include article anyway (components are optional)
                results.append(article)
                failed.append(title)
                print(f"  ✗ Failed (article included without components)")
            
            # Rate limiting
            if i < len(articles):
                time.sleep(self.config.delay_between_requests)
        
        success_rate = ((len(results) - len(failed)) / len(articles) * 100) if articles else 0
        
        print(f"\n{'='*60}")
        print(f"COMPONENT GENERATION COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results) - len(failed)}/{len(articles)} ({success_rate:.1f}%)")
        if failed:
            print(f"⚠ Failed: {len(failed)} articles (included without components)")
        
        return results


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    api_key = os.getenv('ANTHROPIC_API_KEY')
    
    # Test with a sample article
    test_article = {
        "title_news": "**European Central Bank** raises interest rates to **4.5 percent**",
        "components": ["timeline", "details"],
        "context_data": {
            "timeline": "ECB began raising rates in July 2023. Previous rate was 4.25%.",
            "details": "Current rate: 4.5%, Previous rate: 4.25%, Inflation: 5.3%"
        }
    }
    
    writer = ClaudeComponentWriter(api_key)
    components = writer.write_components(test_article)
    
    print("\n✅ Generated components:")
    print(json.dumps(components, indent=2))

