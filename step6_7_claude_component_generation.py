# STEP 7: COMPONENT GENERATION (Timeline, Details, Graph)
# ================================================================
# Purpose: Generate supplementary components using Gemini context search data
# Model: Gemini 2.0 Flash
# Input: Articles with components selected in Step 6 + context from Step 5
# Output: Timeline, Details, Graph based on web search results
# Writes: timeline, details, graph (as selected by Gemini in Step 6)
# Cost: ~$0.10 per 100 articles
# Time: ~2-3 minutes for 100 articles

import re
import requests
import json
import time
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass


_MONTHS = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5,
    'june': 6, 'july': 7, 'august': 8, 'september': 9, 'october': 10,
    'november': 11, 'december': 12,
}


def _parse_timeline_date(date_str: str) -> Optional[Tuple[int, int]]:
    """Best-effort (year, month) extraction from a timeline date string.

    Recognizes "May 2026", "May 8, 2026", "8 May 2026", "March 2024", etc.
    Returns None for fuzzy strings like "Friday" or "Late March" that
    cannot be pinned to a specific (year, month). Used by the validator
    to enforce date-spread (≥30 days between events) and reject
    same-month-padding timelines.
    """
    if not isinstance(date_str, str) or not date_str.strip():
        return None
    s = date_str.lower()
    month = None
    for name, num in _MONTHS.items():
        if name in s:
            month = num
            break
    if month is None:
        return None
    year_match = re.search(r'\b(19|20)\d{2}\b', s)
    if not year_match:
        return None
    return int(year_match.group(0)), month


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentWriterConfig:
    """Configuration for Gemini component writer"""
    model: str = "gemini-2.5-flash-lite"
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

Generate EXACTLY 3 fact cards with NEW information. Always 3 — no more, no less.

CRITICAL RULE: No duplicates from bullet summary.

Before writing each detail:
1. Check if fact is in BULLET SUMMARY
2. If YES → Do NOT include it
3. If NO → Include it

REQUIREMENTS:
✓ Every detail must contain a number
✓ Must NOT be in bullet summary
✓ Must DIRECTLY support or explain the headline
✓ Label: 1-3 words
✓ Value: Number with unit
✓ Maximum 7 words total per detail

HEADLINE-RELEVANCE RULE — read this twice:
The 3 details MUST connect to the specific story in the headline,
not provide unrelated historical background. If the headline says
"After 18 Months", the details should explain THAT GAP — last
flight date, current launch date, payload weight, destination —
NOT the rocket's debut from years ago. If the headline says "Wins
4th Title", the details should be about the 4 wins (year span,
margin, opponents) — NOT the sport's invention date.

If a fact is older than 1 year before TODAY'S DATE, only include
it when it's the *direct cause* of why this story is news today.
Otherwise reach for a number that lives in the article body about
the current event.

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
✗ Stale historical: {"label": "Falcon Heavy debut", "value": "February 2018"}
   for an article about a 2026 launch — debut isn't why today's news exists.
   Better: {"label": "Last flight", "value": "October 2024"} which IS the
   reason for "After 18 months" in the headline.
✗ Filler: {"label": "Age", "value": "43 years"} when age adds nothing
✗ Fewer than 3 or more than 3 details

═══════════════════════════════════════════════════════════════
📅 TIMELINE
═══════════════════════════════════════════════════════════════

PURPOSE: 30-second "how we got here" — chronology only, no commentary.

Format: tight feed factoids, NOT Wikipedia paragraphs. The reader skims
this between cards; long sentences kill it.

HARD CONSTRAINTS (every event must satisfy):
✓ 6-12 WORDS per event description (NOT 15-25 — this is a feed, not an
  article body)
✓ One concrete fact per event: who did what, optionally where/how-many
✓ Past tense, specific verb
✓ At least ONE bold-able entity OR specific number per event
✓ A real, citable public event — never invented backfill
✓ EXACTLY 3 events, dates spanning AT LEAST 30 DAYS in total
✓ Strictly chronological: oldest first, newest last
✓ All 3 dates must be DIFFERENT (no two events sharing the same month)

DATE FORMAT:
- "Month YYYY" (e.g. "March 2024") — full month name
- For events within 30 days of today: "Day Month YYYY" (e.g. "8 May 2026")
- Never abbreviate ("Jan", "Feb") and never write a past date as future

WHEN TO RETURN AN EMPTY ARRAY (`[]`):
You MUST return an empty array if ANY of the following is true. The
selector layer (Step 5) is imperfect; you are the second gate. Do not
fabricate to fill quota.

✗ The 3 distinct dates you can find are all within 30 days of each other
✗ You'd need to invent or estimate dates to reach 3 events
✗ The story is a single moment (announcement, arrest, attack, launch,
  game, statement) with no real history feeding into it
✗ The "history" would be generic context (e.g. "ChatGPT gained
  popularity in 2023") not specific to this exact story
✗ Two of the three events would land in the same week as today's news

═══════════════════════════════════════════════════════════════
BAD TIMELINES (DO NOT EMIT — these are real failures from prior runs)
═══════════════════════════════════════════════════════════════

✗ All-same-month padding (just bullets in disguise):
   [{"date": "May 2026", "event": "Trump said US would blow up uranium site"},
    {"date": "May 2026", "event": "Qatar warned Iran on Hormuz"},
    {"date": "May 2026", "event": "Trump cited Space Force surveillance"}]
   → Three items in the same week is NOT a timeline. Return [].

✗ Fabricated history backfill:
   [{"date": "April 2024", "event": "Browns selected McNeil-Warren in NFL Draft"},
    {"date": "May 2024", "event": "He started early team practices"},
    {"date": "August 2024", "event": "Preseason games gave him reps"}]
   → A rookie's standard career path is NOT timeline-worthy. Return [].

✗ Verbose Wikipedia-paragraph style (too many words):
   {"date": "December 2021", "event": "Ghislaine Maxwell convicted on
    five federal charges for her role in recruiting and grooming girls
    for Epstein's trafficking network"}
   → 22 words. Cut to ≤12. Use the GOOD example below.

✗ Reverse chronology (newest first):
   [May 2026, April 2026, March 2026]
   → Always oldest-first, newest-last.

✗ Generic context not specific to this story:
   {"date": "2023", "event": "ChatGPT gained widespread popularity"}
   → Generic AI history is not a timeline of THIS story. Return [].

═══════════════════════════════════════════════════════════════
GOOD TIMELINES (tight, dated, specific)
═══════════════════════════════════════════════════════════════

EPSTEIN CASE (multi-year saga):
[
  {"date": "July 2019", "event": "Epstein arrested on federal sex-trafficking charges"},
  {"date": "August 2019", "event": "Epstein found dead in Manhattan jail cell"},
  {"date": "December 2021", "event": "Maxwell convicted on five federal counts"}
]

UKRAINE WAR (multi-year escalation):
[
  {"date": "February 2022", "event": "Russia invaded Ukraine on three fronts"},
  {"date": "September 2022", "event": "Putin announced partial military mobilization"},
  {"date": "March 2024", "event": "Russia launched largest drone wave on Kyiv"}
]

After reading: "Three concrete moments, each on a different date, none
require a Wikipedia trip to understand."

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
🏆 SCORE CARD
═══════════════════════════════════════════════════════════════

Generate match result data for a completed sports match.

REQUIREMENTS:
✓ Both team names
✓ Both final scores (integers)
✓ Scorers with team, player name, and minute
✓ Competition name
✓ Key match stats (possession, shots, etc.)
✓ Standing impact if available

OUTPUT FORMAT:
{
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "home_score": 3,
  "away_score": 1,
  "scorers": [
    {"team": "home", "player": "Saka", "minute": "23'"},
    {"team": "home", "player": "Havertz", "minute": "55'"},
    {"team": "home", "player": "Trossard", "minute": "78'"},
    {"team": "away", "player": "Palmer", "minute": "41'"}
  ],
  "stats": {"possession": ["58%", "42%"], "shots": ["14(7)", "9(3)"]},
  "competition": "Premier League",
  "standing_impact": "1st (+3 pts)"
}

BAD SCORE CARD:
✗ Missing team names or scores
✗ Made-up scorer names not in the article
✗ No competition name

═══════════════════════════════════════════════════════════════
🍳 RECIPE CARD
═══════════════════════════════════════════════════════════════

Generate recipe summary data.

REQUIREMENTS:
✓ Ingredients list (at least 2 ingredients)
✓ Cook time
✓ Difficulty level (Easy/Medium/Hard)
✓ Number of servings
✓ Approximate calories per serving (if available, otherwise estimate)

OUTPUT FORMAT:
{
  "ingredients": ["200g pasta", "2 cloves garlic", "150ml cream", "50g parmesan"],
  "cook_time": "30 min",
  "difficulty": "Easy",
  "serves": 4,
  "calories": 480
}

BAD RECIPE CARD:
✗ Fewer than 2 ingredients
✗ Missing cook time
✗ No servings count

═══════════════════════════════════════════════════════════════
FINAL OUTPUT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON with selected components:

{
  "map": [...],
  "timeline": [...],
  "details": [...],
  "graph": {...},
  "scorecard": {...},
  "recipe": {...}
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

class GeminiComponentWriter:
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
        # Quality bar (2026-05-10): timeline was overused (~16% rate) and
        # most outputs were same-week padding, fabricated backfill, or
        # 22-word Wikipedia paragraphs. Validator now requires:
        #   - exactly 3 events (was min 2 / max 4)
        #   - ≤14 words per event description
        #   - dates spanning ≥30 days (or 3 distinct date strings if dates
        #     can't be parsed)
        # Failures DROP the timeline (don't fail the whole article) so
        # map/graph/details survive — same independent-component model as
        # before.
        # IMPORTANT: validates whenever a timeline is present in the output,
        # NOT just when it was in selected_components. Step 7 generates
        # timeline as a side-effect when other components (e.g. details)
        # are selected (Trump/Dell article 156215 leaked through with
        # 2-bucket dates because of this). The validator was previously
        # skipping side-effect timelines entirely.
        if 'timeline' in selected_components or result.get('timeline') is not None:
            tl = result.get('timeline')
            drop_reason = None
            if tl is None:
                drop_reason = "Timeline selected but not in output"
            elif not isinstance(tl, list):
                drop_reason = "Timeline is not a list"
            elif len(tl) != 3:
                drop_reason = f"Timeline must have exactly 3 events (got {len(tl)})"
            else:
                # Per-event word count cap — 6-12 target, hard cap 14.
                for i, ev in enumerate(tl):
                    if not isinstance(ev, dict) or 'event' not in ev or 'date' not in ev:
                        drop_reason = f"Timeline event {i+1} missing date or event"
                        break
                    word_count = len(str(ev.get('event', '')).split())
                    if word_count > 14:
                        drop_reason = f"Timeline event {i+1} too long ({word_count} words, cap 14)"
                        break
                    if word_count < 4:
                        drop_reason = f"Timeline event {i+1} too short ({word_count} words, min 4)"
                        break
                # Date-spread check: parse year+month for each event.
                if drop_reason is None:
                    parsed = [_parse_timeline_date(str(ev.get('date', ''))) for ev in tl]
                    if all(p is not None for p in parsed):
                        # All 3 dates parsed — require ≥30 days spread.
                        ym = [(y * 12 + m) for (y, m) in parsed]
                        if max(ym) - min(ym) < 1:
                            drop_reason = "Timeline events all within same month (not a real timeline)"
                        # Require 3 distinct (year, month) buckets.
                        elif len(set(parsed)) < 3:
                            drop_reason = "Timeline has duplicate month/year (need 3 distinct dates)"
                    else:
                        # Fallback: at least require 3 distinct date strings.
                        date_strings = [str(ev.get('date', '')).strip().lower() for ev in tl]
                        if len(set(date_strings)) < 3:
                            drop_reason = "Timeline has duplicate date strings (need 3 distinct moments)"
            if drop_reason:
                errors.append(drop_reason)
                if 'timeline' in result:
                    del result['timeline']

        # --- DETAILS validation (exactly 3 required) ---
        if 'details' in selected_components:
            if 'details' not in result or not isinstance(result['details'], list) or len(result['details']) == 0:
                errors.append("Details selected but missing or empty — need exactly 3")
                if 'details' in result:
                    del result['details']
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

                # Prefer details with numbers, require exactly 3
                best_details = details_with_numbers if len(details_with_numbers) >= 3 else valid_details
                if len(best_details) >= 3:
                    result['details'] = best_details[:3]
                else:
                    errors.append(f"Only {len(best_details)} valid details (need exactly 3)")
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

        # --- SCORECARD validation ---
        if 'scorecard' in selected_components:
            if 'scorecard' not in result:
                errors.append("Scorecard selected but not in output")
            elif not isinstance(result['scorecard'], dict):
                errors.append("Scorecard is not a dict")
                del result['scorecard']
            else:
                sc = result['scorecard']
                if not sc.get('home_team') or not sc.get('away_team'):
                    errors.append("Scorecard missing team names")
                    del result['scorecard']
                elif sc.get('home_score') is None or sc.get('away_score') is None:
                    errors.append("Scorecard missing scores")
                    del result['scorecard']

        # --- RECIPE validation ---
        if 'recipe' in selected_components:
            if 'recipe' not in result:
                errors.append("Recipe selected but not in output")
            elif not isinstance(result['recipe'], dict):
                errors.append("Recipe is not a dict")
                del result['recipe']
            else:
                ingredients = result['recipe'].get('ingredients', [])
                if not isinstance(ingredients, list) or len(ingredients) < 2:
                    errors.append(f"Recipe has {len(ingredients) if isinstance(ingredients, list) else 0} ingredients (need at least 2)")
                    del result['recipe']

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
    api_key = os.getenv('GEMINI_API_KEY')
    
    # Test with a sample article
    test_article = {
        "title_news": "**European Central Bank** raises interest rates to **4.5 percent**",
        "components": ["timeline", "details"],
        "context_data": {
            "timeline": "ECB began raising rates in July 2023. Previous rate was 4.25%.",
            "details": "Current rate: 4.5%, Previous rate: 4.25%, Inflation: 5.3%"
        }
    }
    
    writer = GeminiComponentWriter(api_key)
    components = writer.write_components(test_article)
    
    print("\n✅ Generated components:")
    print(json.dumps(components, indent=2))

