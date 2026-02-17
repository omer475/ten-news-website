# STEP 6: COMPONENT GENERATION (Timeline, Details, Graph)
# ================================================================
# Purpose: Generate supplementary components using Perplexity search context
# Model: Gemini 2.0 Flash (switched from Claude due to API limits)
# Input: Articles with dual-language content from Step 5 + Perplexity context from Step 4
# Output: Timeline, Details, Graph based on web search results
# Writes: timeline, details, graph (as selected by Gemini in Step 3)
# Cost: ~$0.10 per 100 articles
# Time: ~2-3 minutes for 100 articles

import requests
import json
import time
from datetime import datetime, timezone
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentWriterConfig:
    """Configuration for Gemini component writer"""
    model: str = "gemini-2.0-flash"
    max_tokens: int = 1536  # Enough for timeline + details + graph
    temperature: float = 0.3
    timeout: int = 60
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.3


# ==========================================
# COMPONENT GENERATION PROMPT
# ==========================================

COMPONENT_PROMPT = """Generate components for this news article.

TODAY'S DATE: {today}
ARTICLE TITLE: {title}
BULLET SUMMARY: {bullets}
SELECTED COMPONENTS: {components}
SEARCH CONTEXT: {context}

Generate ONLY the selected components.

═══════════════════════════════════════════════════════════════
📋 DETAILS
═══════════════════════════════════════════════════════════════

Generate EXACTLY 3 fact cards with NEW information.

CRITICAL RULE: No duplicates from bullet summary.

Before writing each detail:
1. Check if fact is in BULLET SUMMARY
2. If YES → Do NOT include it
3. If NO → Include it

REQUIREMENTS:
✓ Every detail must contain a number
✓ Must NOT be in bullet summary
✓ Must be relevant to the story
✓ Label: 1-3 words
✓ Value: Number with unit
✓ Maximum 7 words total per detail

OUTPUT FORMAT:
[
  {"label": "Crew members", "value": "5 aboard"},
  {"label": "Flight origin", "value": "Leipzig, Germany"},
  {"label": "Runway length", "value": "2,515 meters"}
]

BAD DETAILS (never do):
✗ Duplicates from bullets
✗ No number: {"label": "Status", "value": "Ongoing"}
✗ Irrelevant: {"label": "Temple founded", "value": "628 AD"} for tech story

═══════════════════════════════════════════════════════════════
📅 TIMELINE
═══════════════════════════════════════════════════════════════

PURPOSE: Answer "What is this news about? How did we get here?"

The timeline should help readers UNDERSTAND the story:
- What is this news about?
- How did this situation start?
- What key events led to today's news?

Generate 2-4 events with CLEAR, COMPLETE descriptions.

EACH EVENT MUST:
✓ Be 15-25 words long
✓ Explain WHAT happened AND WHY it matters
✓ Help the reader understand the CONTEXT of today's news
✓ Be from recent past (usually last 1-5 years) — use TODAY'S DATE above as reference
✓ NEVER write a past date as if it is in the future. If a date is before TODAY'S DATE, use past tense
✓ Be directly relevant to this specific story
✓ All dates must make sense relative to today's date (no future dates unless they are upcoming events)

THE TIMELINE SHOULD TELL A STORY:
- First event: "This is how it all started..."
- Middle events: "This is what happened next..."
- Last event: "This is the most recent development before today's news..."

DATE FORMAT:
- Use full month: "January 2024" not "Jan 2024"
- Always include year

═══════════════════════════════════════════════════════════════
BAD TIMELINE (too short, doesn't explain anything):
═══════════════════════════════════════════════════════════════

✗ {"date": "Jul 2019", "event": "Epstein arrested"}
✗ {"date": "Feb 2022", "event": "Russia invades Ukraine"}  
✗ {"date": "Aug 2019", "event": "Epstein found dead"}

These are useless! Reader learns almost nothing about WHAT the story is or HOW we got here.

═══════════════════════════════════════════════════════════════
GOOD TIMELINE (tells the story, explains context):
═══════════════════════════════════════════════════════════════

✓ {
    "date": "July 2019", 
    "event": "Jeffrey Epstein arrested on federal sex trafficking charges involving dozens of underage victims, reopening investigations that had been closed since 2008"
  }

✓ {
    "date": "August 2019", 
    "event": "Epstein found dead in Manhattan jail cell under suspicious circumstances, officially ruled suicide but sparking widespread conspiracy theories and investigations"
  }

✓ {
    "date": "December 2021", 
    "event": "Ghislaine Maxwell convicted on five federal charges for recruiting and grooming underage girls for Epstein's sex trafficking network"
  }

✓ {
    "date": "February 2022", 
    "event": "Russia launched full-scale military invasion of Ukraine with attacks on Kyiv, beginning the largest armed conflict in Europe since World War II"
  }

✓ {
    "date": "January 2024", 
    "event": "William Lai elected Taiwan's president with 40% of the vote despite Chinese pressure, securing unprecedented third consecutive term for DPP party"
  }

After reading a good timeline, the reader should think:
"Now I understand what this story is about and how we got to today's news."

OUTPUT FORMAT:
[
  {
    "date": "July 2019", 
    "event": "Jeffrey Epstein arrested on federal sex trafficking charges involving dozens of underage victims, reopening investigations closed since 2008"
  },
  {
    "date": "August 2019", 
    "event": "Epstein found dead in Manhattan federal jail cell under suspicious circumstances, officially ruled suicide amid widespread skepticism"
  },
  {
    "date": "December 2021", 
    "event": "Ghislaine Maxwell convicted on five federal charges for her role in recruiting and grooming girls for Epstein's trafficking network"
  }
]

═══════════════════════════════════════════════════════════════
🗺️ MAP
═══════════════════════════════════════════════════════════════

Generate 1-2 SPECIFIC locations showing WHERE THE NEWS HAPPENED.

CRITICAL RULES:
1. MUST be a SPECIFIC location (building, facility, airport, etc.)
2. MUST be ON PLANET EARTH (no Moon, Mars, space stations, asteroids)
3. MUST NOT be just a country or city name
4. MUST NOT be a famous building everyone knows (Kremlin, White House)

THE PURPOSE: Users want to see "Where EXACTLY did this happen?"

═══════════════════════════════════════════════════════════════
GOOD MAP LOCATIONS (specific places on Earth):
═══════════════════════════════════════════════════════════════

INCIDENT LOCATIONS:
✓ {
    "name": "Vilnius International Airport",
    "type": "transport",
    "city": "Vilnius",
    "country": "Lithuania",
    "coordinates": {"lat": 54.6341, "lng": 25.2858},
    "description": "Crash site where UPS cargo plane went down on Christmas morning"
  }

✓ {
    "name": "Crocus City Hall",
    "type": "venue",
    "city": "Moscow",
    "country": "Russia",
    "coordinates": {"lat": 55.8244, "lng": 37.3958},
    "description": "Concert venue where terrorist attack killed over 140 people in March 2024"
  }

✓ {
    "name": "Francis Scott Key Bridge",
    "type": "infrastructure",
    "city": "Baltimore",
    "country": "USA",
    "coordinates": {"lat": 39.2177, "lng": -76.5284},
    "description": "Bridge that collapsed after being struck by container ship Dali"
  }

MILITARY STRIKE LOCATIONS:
✓ {
    "name": "Zaporizhzhia Nuclear Power Plant",
    "type": "infrastructure",
    "city": "Enerhodar",
    "country": "Ukraine",
    "coordinates": {"lat": 47.5069, "lng": 34.5853},
    "description": "Europe's largest nuclear plant targeted by Russian strikes"
  }

DISASTER EPICENTERS:
✓ {
    "name": "Gaziantep Province Epicenter",
    "type": "landmark",
    "city": "Gaziantep",
    "country": "Turkey",
    "coordinates": {"lat": 37.0662, "lng": 37.3833},
    "description": "Epicenter of magnitude 7.8 earthquake that killed over 50,000"
  }

DISPUTED TERRITORIES:
✓ {
    "name": "Woody Island",
    "type": "military",
    "city": "Sansha",
    "country": "China",
    "coordinates": {"lat": 16.8333, "lng": 112.3333},
    "description": "Disputed South China Sea island where China constructed military facilities"
  }

MILITARY/SECRET FACILITIES:
✓ {
    "name": "Yongbyon Nuclear Complex",
    "type": "military",
    "city": "Yongbyon",
    "country": "North Korea",
    "coordinates": {"lat": 39.7947, "lng": 125.7553},
    "description": "North Korea's primary nuclear weapons research and production facility"
  }

═══════════════════════════════════════════════════════════════
BAD MAP LOCATIONS (NEVER use these):
═══════════════════════════════════════════════════════════════

SPACE LOCATIONS (NOT ON EARTH - NEVER USE):
✗ {
    "name": "Moon",
    "description": "Landing site"
  }
  → NOT ON EARTH - DO NOT USE

✗ {
    "name": "Mars",
    "description": "Rover location"
  }
  → NOT ON EARTH - DO NOT USE

✗ {
    "name": "International Space Station"
  }
  → NOT ON EARTH - DO NOT USE

JUST A COUNTRY (TOO VAGUE):
✗ {
    "name": "Ukraine",
    "description": "Where war is happening"
  }
  → TOO VAGUE - Need specific location like "Zaporizhzhia Power Plant"

✗ {
    "name": "Russia"
  }
  → TOO VAGUE

✗ {
    "name": "Israel"
  }
  → TOO VAGUE

JUST A CITY (TOO VAGUE):
✗ {
    "name": "Kyiv"
  }
  → TOO VAGUE - Need specific building or site

✗ {
    "name": "Moscow"
  }
  → TOO VAGUE

FAMOUS GOVERNMENT BUILDINGS (everyone knows these):
✗ {
    "name": "The Kremlin"
  }
  → EVERYONE KNOWS WHERE THIS IS

✗ {
    "name": "The White House"
  }
  → EVERYONE KNOWS WHERE THIS IS

✗ {
    "name": "Capitol Building"
  }
  → EVERYONE KNOWS WHERE THIS IS

TV STATIONS & OFFICES:
✗ {
    "name": "Channel 4 Television Centre"
  }
  → NOBODY CARES WHERE A TV STATION IS

OUTPUT FORMAT:
[
  {
    "name": "Vilnius International Airport",
    "type": "transport",
    "city": "Vilnius",
    "country": "Lithuania",
    "coordinates": {"lat": 54.6341, "lng": 25.2858},
    "description": "Crash site where UPS cargo plane went down killing all 5 crew"
  }
]

TYPE OPTIONS:
- transport: Airports, train stations, ports
- venue: Concert halls, stadiums, theaters, malls
- infrastructure: Bridges, pipelines, power plants, dams
- military: Bases, nuclear facilities, shipyards
- landmark: Mountains, islands, natural features, parks
- building: Hospitals, factories, specific buildings

═══════════════════════════════════════════════════════════════
📊 GRAPH
═══════════════════════════════════════════════════════════════

Generate chart using ONLY REAL, VERIFIED data.

CRITICAL: Do NOT fabricate data.

Only use numbers that:
✓ Come from search context
✓ Have a cited source
✓ Are verifiable facts

REQUIREMENTS:
✓ At least 4 data points
✓ Real data from reliable source
✓ Include source field
✓ Dates in YYYY-MM or YYYY format

OUTPUT FORMAT:
{
  "type": "line",
  "title": "Federal Reserve Interest Rate 2022-2024",
  "data": [
    {"date": "2022-03", "value": 0.50},
    {"date": "2022-12", "value": 4.25},
    {"date": "2023-07", "value": 5.25},
    {"date": "2024-01", "value": 5.50}
  ],
  "y_label": "Interest Rate (%)",
  "x_label": "Date",
  "source": "Federal Reserve"
}

BAD GRAPH DATA:
✗ Numbers too clean: 8, 9, 10, 11, 12 (obviously fake)
✗ No source cited
✗ Made-up projections

═══════════════════════════════════════════════════════════════
FINAL OUTPUT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON with selected components:

{
  "map": [...],
  "timeline": [...],
  "details": [...],
  "graph": {...}
}

Include ONLY components that were selected.

═══════════════════════════════════════════════════════════════
CHECKLIST BEFORE SUBMITTING
═══════════════════════════════════════════════════════════════

□ DETAILS:
  - None duplicate bullet summary?
  - All contain numbers?
  - All relevant to story?

□ TIMELINE:
  - Does it answer "What is this news about? How did we get here?"
  - Each event 15-25 words?
  - Each explains WHAT happened AND WHY it matters?
  - Recent events (1-5 years)?
  - Reader will understand the story after reading this?

□ MAP:
  - Is this a SPECIFIC location (not just country/city)?
  - Is this ON PLANET EARTH (not Moon, Mars, space)?
  - NOT a famous government building (Kremlin, White House)?
  - Users would want to see this exact location?

□ GRAPH:
  - All data from verified source?
  - Source cited?
  - At least 4 real data points?
  - Not fabricated?
"""


# ==========================================
# CLAUDE COMPONENT WRITER CLASS
# ==========================================

class ClaudeComponentWriter:
    """
    Generates article components using Gemini 2.0 Flash
    Components: Timeline, Details, Graph
    Based on Perplexity search context data
    """
    
    def __init__(self, api_key: str, config: Optional[ComponentWriterConfig] = None):
        """
        Initialize writer with API key and optional config
        
        Args:
            api_key: Gemini API key
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
                
                response = requests.post(
                    self.api_url,
                    json=request_data,
                    timeout=self.config.timeout
                )
                
                # Handle rate limiting
                if response.status_code == 429:
                    wait_time = 15 * (attempt + 1)
                    print(f"   ⚠️ Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                response.raise_for_status()
                result = response.json()
                
                # Extract response text from Gemini format
                if 'candidates' not in result or len(result['candidates']) == 0:
                    raise Exception("No candidates in Gemini response")
                
                response_text = result['candidates'][0]['content']['parts'][0]['text']
                print(f"   📝 Raw Claude response: {response_text[:300]}...")
                
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
        today = datetime.now(timezone.utc).strftime('%B %d, %Y')
        formatted_prompt = COMPONENT_PROMPT
        formatted_prompt = formatted_prompt.replace('{today}', today)
        formatted_prompt = formatted_prompt.replace('{title}', title)
        formatted_prompt = formatted_prompt.replace('{bullets}', bullets_text)
        formatted_prompt = formatted_prompt.replace('{components}', ', '.join(components))
        formatted_prompt = formatted_prompt.replace('{context}', context_str)

        return formatted_prompt
    
    def _validate_output(self, result: Dict, selected_components: List[str]) -> tuple[bool, List[str]]:
        """
        Validate component output PER-COMPONENT.
        Invalid components are removed from result but valid ones are kept.

        Returns:
            (is_valid, errors) - is_valid is True if at least one component survived
        """
        errors = []

        # --- TIMELINE validation ---
        if 'timeline' in selected_components:
            if 'timeline' not in result:
                errors.append("Timeline selected but not in output")
            elif not isinstance(result['timeline'], list):
                errors.append("Timeline is not a list")
                del result['timeline']
            elif len(result['timeline']) < 2:
                errors.append(f"Timeline event count: {len(result['timeline'])} (need at least 2)")
                del result['timeline']
            elif len(result['timeline']) > 4:
                # Too many events - just trim to 4 instead of failing
                result['timeline'] = result['timeline'][:4]

        # --- DETAILS validation (relaxed: keep details with or without numbers) ---
        if 'details' in selected_components:
            if 'details' not in result:
                errors.append("Details selected but not in output")
            else:
                valid_details = []
                details_with_numbers = []
                for detail in result['details']:
                    if isinstance(detail, dict) and detail.get('label') and detail.get('value'):
                        valid_details.append(detail)
                        value = str(detail.get('value', ''))
                        if any(char.isdigit() for char in value):
                            details_with_numbers.append(detail)
                    elif isinstance(detail, str) and len(detail) > 3:
                        valid_details.append(detail)
                        if any(char.isdigit() for char in detail):
                            details_with_numbers.append(detail)

                # Prefer details with numbers, but accept without if that's all we have
                if len(details_with_numbers) >= 3:
                    result['details'] = details_with_numbers[:3]
                elif len(valid_details) >= 2:
                    # Use whatever valid details we have (at least 2)
                    result['details'] = valid_details[:3]
                    errors.append(f"Only {len(details_with_numbers)} details have numbers, using {len(result['details'])} valid details")
                else:
                    errors.append(f"Only {len(valid_details)} valid details (need at least 2)")
                    del result['details']

        # --- GRAPH validation ---
        if 'graph' in selected_components:
            if 'graph' not in result:
                errors.append("Graph selected but not in output")
            elif isinstance(result['graph'], dict):
                if not result['graph'].get('data') or len(result['graph'].get('data', [])) < 3:
                    errors.append("Graph has fewer than 3 data points")
                    del result['graph']

        # --- MAP validation (relaxed: allow cities, just block countries/continents/space) ---
        if 'map' in selected_components:
            if 'map' not in result:
                errors.append("Map selected but not in output")
            elif not isinstance(result['map'], list) or len(result['map']) < 1:
                errors.append("Map must have at least 1 location")
                if 'map' in result:
                    del result['map']
            else:
                # Only block truly vague locations (countries/continents) and space
                too_vague = ['ukraine', 'russia', 'israel', 'palestine', 'china', 'usa', 'united states',
                             'middle east', 'europe', 'asia', 'africa', 'south america', 'north america',
                             'eastern europe', 'downtown', 'city center', 'suburbs']
                space_locations = ['moon', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus',
                                   'pluto', 'asteroid', 'comet', 'space station', 'international space station',
                                   'iss', 'lunar', 'orbit', 'outer space', 'milky way', 'galaxy', 'sun', 'solar']
                valid_types = ['venue', 'building', 'landmark', 'infrastructure', 'military', 'transport', 'street']

                valid_locations = []
                for i, loc in enumerate(result['map']):
                    if not isinstance(loc, dict):
                        errors.append(f"Map location {i+1} is not a dict")
                        continue
                    if 'name' not in loc or 'coordinates' not in loc:
                        errors.append(f"Map location {i+1} missing name or coordinates")
                        continue

                    loc_name_lower = loc.get('name', '').lower().strip()

                    if loc_name_lower in too_vague:
                        errors.append(f"Map location '{loc.get('name')}' too vague (country/region)")
                        continue
                    if any(space in loc_name_lower for space in space_locations):
                        errors.append(f"Map location '{loc.get('name')}' not on Earth")
                        continue

                    # Validate coordinates
                    coords = loc.get('coordinates', {})
                    if isinstance(coords, dict) and 'lat' in coords and 'lng' in coords:
                        # Fix type if present but invalid
                        if 'type' in loc and loc['type'] not in valid_types:
                            loc['type'] = 'landmark'
                        valid_locations.append(loc)
                    else:
                        errors.append(f"Map location '{loc.get('name')}' has invalid coordinates")

                if valid_locations:
                    result['map'] = valid_locations
                else:
                    errors.append("No valid map locations survived validation")
                    del result['map']

        # Check if at least one component survived
        surviving = [c for c in selected_components if c in result]
        has_any_component = len(surviving) > 0

        return has_any_component, errors
    
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

