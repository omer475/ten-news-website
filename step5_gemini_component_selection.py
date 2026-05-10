# STEP 5: GEMINI COMPONENT SELECTION & PERPLEXITY SEARCH
# ==========================================
# Purpose: Analyze synthesized articles and decide which visual components to include
# Model: Gemini 2.0 Flash (cheapest option)
# Input: Synthesized articles from Step 4
# Output: Component selections for each article (timeline, details, graph)
# Components: Choose 0-3 from: Timeline, Details, Graph
# Cost: ~$0.035 per 100 articles
# Time: ~2-3 minutes for 100 articles

import google.generativeai as genai
import json
import time
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentConfig:
    """Configuration for component selection"""
    model: str = "gemini-2.5-flash-lite"
    temperature: float = 0.1
    top_p: float = 0.95
    top_k: int = 40
    max_output_tokens: int = 256
    min_components: int = 0  # No minimum — AI decides if components add value
    max_components: int = 3  # Maximum components per article
    max_article_preview: int = 2000  # Max chars to send (save tokens)
    retry_attempts: int = 3
    retry_delay: float = 2.0


# ==========================================
# SYSTEM PROMPT - COMPONENT SELECTION LOGIC
# ==========================================

COMPONENT_SELECTION_PROMPT = """Select components for this news article.

ARTICLE TITLE: {title}
BULLET SUMMARY: {bullets}

═══════════════════════════════════════════════════════════════
COMPONENTS OVERVIEW
═══════════════════════════════════════════════════════════════

📋 DETAILS - Key facts not in bullets (only if genuinely useful)
📅 TIMELINE - Historical context (rare, ~5% of stories)
🗺️ MAP - Where it happened (~15% of stories)
📊 GRAPH - Data trends (~10% of stories)

IMPORTANT: All components are OPTIONAL. If no component adds genuine value beyond
the title and bullets, return an empty components array []. Do NOT force components.

═══════════════════════════════════════════════════════════════
📋 DETAILS
═══════════════════════════════════════════════════════════════

Shows additional facts and statistics NOT already in the bullet summary.

SELECT IF:
- The story likely has additional facts with real numbers beyond what's in bullets
- Extra context (specs, stats, comparisons) would genuinely help the reader
- The topic is data-rich (business, science, sports, economics)

DO NOT SELECT IF:
- The bullets already cover everything important
- Only irrelevant trivia or filler would be available (ages, jersey numbers, episode counts)
- It's a simple announcement or opinion piece with no extra data

FREQUENCY: Only when genuinely useful — do NOT default to including details

═══════════════════════════════════════════════════════════════
📅 TIMELINE
═══════════════════════════════════════════════════════════════

Shows "What is this news about? How did we get here?"

CRITICAL: Timeline is SEVERELY OVERUSED. Be EXTREMELY selective.

THE CORE QUESTION:
> "Does the reader need background context to understand what this news is about?"

Timeline should answer: "What is this story? How did it start? What happened before?"

SELECT ONLY IF the reader would be LOST without context:
✓ Ongoing wars/conflicts where understanding escalation matters (Ukraine, Gaza, Syria)
✓ Multi-year investigations with complex history (Epstein case, Trump trials)
✓ Long-running political crises that have evolved over time
✓ Stories where today's news only makes sense with "how we got here"

DO NOT SELECT FOR (99% of stories):
✗ Single announcements (even major ones)
✗ Product/tech news (iPhone launch, AI model release)
✗ Entertainment news
✗ Speeches or statements
✗ Policy proposals (unless part of long-running saga)
✗ One-time incidents (plane crash, earthquake, fire)
✗ Business deals (mergers, acquisitions, earnings)
✗ Sports news
✗ Deaths (unless the person's history IS the story)
✗ Elections (unless explaining a complex political situation)
✗ Trade deals, tariffs, sanctions (unless ongoing trade war)

ASK YOURSELF:
1. "Would the reader ask 'Wait, what's the background here?'" → If NO, don't select
2. "Is this a SINGLE EVENT or part of an ONGOING SAGA?" → Single event = NO timeline
3. "Does understanding HOW we got here matter?" → If NO, don't select

FREQUENCY: ~5% of stories (very rare!)

DEFAULT: Do NOT select timeline. Only add if truly essential.

═══════════════════════════════════════════════════════════════
🗺️ MAP
═══════════════════════════════════════════════════════════════

Shows WHERE the news happened - SPECIFIC LOCATION ONLY.

CRITICAL RULES:
1. MUST be a SPECIFIC location (not just a country or city)
2. MUST be ON EARTH (no Moon, Mars, space, asteroids, etc.)
3. MUST be a place users would want to see on a map

THE CORE QUESTION:
> "Is there a SPECIFIC place (building, facility, airport, bridge, etc.) that users would want to see?"

SELECT ONLY FOR SPECIFIC LOCATIONS:

✓ INCIDENT SITES (specific places):
  - "Vilnius International Airport" (plane crash site)
  - "Francis Scott Key Bridge" (collapse location)
  - "Crocus City Hall" (attack venue)
  - The EXACT location of a rocket strike or drone attack
  
✓ SPECIFIC FACILITIES:
  - "Yongbyon Nuclear Complex" (nuclear facility)
  - "Natanz Enrichment Facility" (Iranian nuclear site)
  - "Zaporizhzhia Nuclear Power Plant"
  
✓ DISASTER EPICENTERS:
  - Specific earthquake epicenter location
  - Specific building that collapsed
  - Specific dam that failed

✓ DISPUTED/INTERESTING SPECIFIC PLACES:
  - "Woody Island" in South China Sea
  - Specific military base locations

DO NOT SELECT - THESE ARE TOO VAGUE OR WELL-KNOWN:

✗ JUST A COUNTRY:
  - "Ukraine" - TOO VAGUE, everyone knows where Ukraine is
  - "Russia" - TOO VAGUE
  - "Israel" - TOO VAGUE
  - "United States" - COMPLETELY USELESS

✗ JUST A CITY:
  - "Kyiv" - TOO VAGUE (unless showing specific building IN Kyiv)
  - "Moscow" - TOO VAGUE
  - "Washington D.C." - TOO VAGUE

✗ FAMOUS GOVERNMENT BUILDINGS (everyone knows these):
  - The Kremlin
  - The White House
  - Capitol Building
  - 10 Downing Street
  - Elysee Palace

✗ CORPORATE OFFICES & TV STATIONS:
  - Nobody cares where these are

✗ SPACE LOCATIONS (NOT ON EARTH):
  - Moon
  - Mars
  - Asteroids
  - Space stations
  - Any location not on planet Earth

ASK YOURSELF:
1. "Is this a SPECIFIC location or just a country/city?" → If just country/city, NO map
2. "Is this on planet Earth?" → If no, NO map
3. "Would users think 'Oh, that's exactly where it happened!'?" → If no, NO map
4. "Does everyone already know where this is?" (Kremlin, White House) → If yes, NO map

FREQUENCY: ~15% of stories (less than before - be more selective)

═══════════════════════════════════════════════════════════════
📊 GRAPH
═══════════════════════════════════════════════════════════════

Shows data trends over time.

SELECT ONLY IF:
- REAL data from verified source exists
- At least 4 data points
- Source is cited
- Shows meaningful trend

DO NOT SELECT IF:
- Data looks fabricated (too clean: 8, 9, 10, 11)
- No source cited
- Fewer than 4 points
- Data is estimated/projected

FREQUENCY: ~10% of stories

═══════════════════════════════════════════════════════════════
🏆 SCORE CARD
═══════════════════════════════════════════════════════════════

Shows match/game results with scores.

SELECT IF ANY OF THESE ARE TRUE:
- Article is about a COMPLETED match/game with final scores
- Article is a game RECAP or POST-MATCH analysis that mentions the score
- Article discusses match HIGHLIGHTS with the result mentioned
- Article headline or bullets contain a score (e.g., "3-1", "beat", "defeated", "won")
- Any score or final result is clearly stated, even if the article also has analysis

DO NOT SELECT IF:
- Article is about transfers, signings, contracts, injuries with NO game score
- Article is purely a match PREVIEW or prediction (no result yet)
- Article is about sports politics, doping, coaching changes with no game result
- No score or match result is mentioned anywhere

WHEN SELECTED: Scorecard REPLACES all other components. Do NOT add details/timeline/graph/map alongside scorecard.

FREQUENCY: ~50% of Sports articles (any article that mentions a game result)

═══════════════════════════════════════════════════════════════
🍳 RECIPE CARD
═══════════════════════════════════════════════════════════════

Shows recipe info: cook time, difficulty, servings.

SELECT ONLY IF:
- Article IS an actual recipe with ingredients and/or instructions
- Has specific cooking details (time, servings, ingredients list)

DO NOT SELECT IF:
- Article is about restaurants, food industry, food trends
- Article is a restaurant review or food news
- No actual recipe with ingredients/instructions

WHEN SELECTED: Recipe REPLACES all other components. Do NOT add details/timeline/graph/map alongside recipe.

FREQUENCY: ~50% of Food articles

═══════════════════════════════════════════════════════════════
TYPICAL SELECTIONS
═══════════════════════════════════════════════════════════════

Simple stories (announcements, opinions): [] - No components needed
Stories with useful extra facts: ["details"]
Incidents with SPECIFIC location: ["map", "details"]
Economic news with data: ["graph", "details"]
Complex ongoing sagas (very rare, ~5%): ["timeline", "details"]
Sports articles mentioning a game result/score: ["scorecard"] - EXCLUSIVE, no other components
Actual recipes: ["recipe"] - EXCLUSIVE, no other components

MISTAKES TO AVOID:
✗ Adding timeline to every story (timeline is for ~5% of stories only!)
✗ Adding map with just a country name ("Ukraine", "Russia", "Israel")
✗ Adding map for space locations (Moon, Mars)
✗ Adding map for famous buildings everyone knows (Kremlin, White House)
✗ Adding timeline for single events (plane crash, earthquake, announcement)
✗ Adding graph with made-up data
✗ Adding details that duplicate bullets
✗ Adding scorecard for sports articles with NO score/result (transfers, previews, opinions)
✗ Adding recipe for food industry/restaurant news

═══════════════════════════════════════════════════════════════
DECISION EXAMPLES
═══════════════════════════════════════════════════════════════

"UPS Plane Crash at Vilnius Airport Kills 5"
→ MAP: YES - "Vilnius International Airport" is SPECIFIC location
→ TIMELINE: NO - Single incident, readers don't need background
→ DETAILS: YES - If additional facts available
→ components: ["map", "details"], article_type: "standard"

"Putin Announces New Nuclear Policy"
→ MAP: NO - Kremlin is famous, everyone knows where it is
→ TIMELINE: NO - Single announcement, not ongoing saga
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

"Epstein Files Released After Years of Secrecy"
→ MAP: NO - No specific incident location
→ TIMELINE: YES - Reader needs to understand "what is this case about?"
→ DETAILS: YES
→ components: ["timeline", "details"], article_type: "standard"

"Fed Raises Interest Rates to 5.5%"
→ MAP: NO - No specific location
→ TIMELINE: NO - Single announcement, not complex history
→ GRAPH: YES - Real rate history from Fed
→ DETAILS: YES
→ components: ["graph", "details"], article_type: "standard"

"Earthquake Kills 50 in Turkey"
→ MAP: YES - Show SPECIFIC epicenter location (e.g., "Gaziantep Province epicenter")
→ TIMELINE: NO - Single disaster, no complex background needed
→ DETAILS: YES
→ components: ["map", "details"], article_type: "standard"

"SNL Mocks Trump in Christmas Sketch"
→ MAP: NO - Nobody cares where TV studio is
→ TIMELINE: NO - Entertainment news, no background needed
→ DETAILS: NO - Bullets already cover the story
→ components: [], article_type: "standard"

"Russia Strikes Ukrainian Power Plant with Missiles"
→ MAP: YES - Show the SPECIFIC power plant location
→ TIMELINE: NO - Single attack (unless user needs war background)
→ DETAILS: YES
→ components: ["map", "details"], article_type: "standard"

"Ukraine War Enters Third Year as Peace Talks Collapse"
→ MAP: NO - Just "Ukraine" is too vague, no specific location
→ TIMELINE: YES - Reader needs "how did we get here" context
→ DETAILS: YES
→ components: ["timeline", "details"], article_type: "standard"

"NASA Artemis Mission Lands on Moon"
→ MAP: NO - Moon is NOT on Earth, no map for space
→ TIMELINE: NO - Single event
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

"SpaceX Starship Explodes Over Mars"
→ MAP: NO - Mars is NOT on Earth, no map for space
→ TIMELINE: NO - Single event
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

"Apple Announces iPhone 17"
→ MAP: NO - Apple Park is well-known, boring
→ TIMELINE: NO - Product launch, no history needed
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

"Trade War Between US and China Intensifies"
→ MAP: NO - Just "US" and "China" are too vague
→ TIMELINE: MAYBE - Only if reader needs trade war background
→ DETAILS: YES
→ components: ["details"] or ["timeline", "details"], article_type: "standard"

"Arsenal Beats Chelsea 3-1 in Premier League"
→ SCORECARD: YES - Completed match with final scores
→ components: ["scorecard"], article_type: "match_result"

"Phoenix Rising Draws with Orange County in Opener"
→ SCORECARD: YES - Game recap with result (1-1 draw) mentioned in bullets
→ components: ["scorecard"], article_type: "match_result"

"Sunderland Misses Opportunity, Charlton Secures Win"
→ SCORECARD: YES - Post-match recap with result, scorers mentioned
→ components: ["scorecard"], article_type: "match_result"

"Mbappe Signs 5-Year Deal with Real Madrid"
→ SCORECARD: NO - Transfer news, no game result
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

"Schumacher Slams F1 2026 Rules as Too Artificial"
→ SCORECARD: NO - Opinion piece about rules, no match result
→ components: [], article_type: "standard"

"Easy 30-Minute Pasta Carbonara Recipe"
→ RECIPE: YES - Actual recipe with cooking details
→ components: ["recipe"], article_type: "recipe"

"NYC's Best New Restaurants of 2026"
→ RECIPE: NO - Restaurant news, not an actual recipe
→ DETAILS: YES
→ components: ["details"], article_type: "standard"

═══════════════════════════════════════════════════════════════
EMOJI SELECTION
═══════════════════════════════════════════════════════════════

Choose ONE emoji:

🌍 Geopolitics        📈 Economy/Markets     🏛️ Politics
💻 Technology         🔬 Science             💊 Health
⚽ Sports             🎭 Entertainment       🌱 Environment
⚔️ Conflict/War       ⚠️ Disasters           💀 Death
🎓 Education          ⚖️ Law/Justice         🏆 Awards
🚀 Space              🔐 Security            🎉 Celebrations
💣 Military           🚢 Naval               ✈️ Aviation
🔪 Crime              💰 Business            📺 TV/Media
☢️ Nuclear            🗳️ Elections           🤝 Diplomacy
✈️ Plane crash        🌊 Natural disaster    🔥 Fire
🍳 Cooking/Food       🎮 Gaming

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

{
  "components": ["map", "details"],
  "emoji": "✈️",
  "graph_type": null,
  "map_locations": ["Vilnius International Airport, Vilnius, Lithuania"],
  "article_type": "standard"
}

RULES:
- components: Array ordered by importance
- emoji: Single emoji for the story
- graph_type: "line", "bar", or "area" if graph selected, null otherwise
- map_locations: Array of specific locations if map selected, null otherwise
- article_type: "standard", "match_result" (if scorecard), or "recipe" (if recipe)
"""


# ==========================================
# GEMINI COMPONENT SELECTOR CLASS
# ==========================================

class GeminiComponentSelector:
    """
    Analyzes articles and selects appropriate visual components
    Uses Gemini 2.0 Flash for cost efficiency
    """
    
    def __init__(self, api_key: str, config: Optional[ComponentConfig] = None):
        """
        Initialize selector with API key and optional config
        
        Args:
            api_key: Google AI API key
            config: ComponentConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or ComponentConfig()
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Initialize model (response_schema removed - not well supported by gemini-2.5-flash-lite)
        self.model = genai.GenerativeModel(
            model_name=self.config.model,
            generation_config={
                'temperature': self.config.temperature,
                'top_p': self.config.top_p,
                'top_k': self.config.top_k,
                'max_output_tokens': self.config.max_output_tokens,
                'response_mime_type': 'application/json'
            }
        )
        
        print(f"✓ Initialized Gemini component selector")
        print(f"  Model: {self.config.model}")
        print(f"  Components per article: {self.config.min_components}-{self.config.max_components}")
    
    def select_components(self, article: Dict, search_context: str = "") -> Dict:
        """
        Select components for a single article.
        Runs BEFORE context search — decides which components are needed
        so the search can be skipped or targeted.

        Args:
            article: Dict with 'title' and 'text' (full article content from Step 3)
            search_context: Unused (kept for backwards compatibility)

        Returns:
            Dict with component selection
        """
        # Get article title and content
        article_title = article.get('title', 'No title')
        article_content = article.get('text', '')

        # Get bullet summary if available
        bullets = article.get('summary_bullets_news', article.get('summary_bullets', []))
        if isinstance(bullets, list):
            bullets_text = '\n'.join([f"• {b}" for b in bullets])
        else:
            bullets_text = str(bullets) if bullets else article_content[:500]

        # Format the prompt with article data using replace (not .format()
        # because the prompt contains JSON examples with braces)
        formatted_prompt = COMPONENT_SELECTION_PROMPT
        formatted_prompt = formatted_prompt.replace('{title}', article_title)
        formatted_prompt = formatted_prompt.replace('{bullets}', bullets_text)
        
        user_prompt = formatted_prompt + "\n\nAnalyze and return ONLY valid JSON."

        # Retry logic
        for attempt in range(self.config.retry_attempts):
            try:
                # Send to Gemini
                chat = self.model.start_chat(history=[])
                response = chat.send_message(user_prompt)
                
                # Parse response
                # Check if response was blocked by safety filters
                if not response.text:
                    print(f"  ⚠ Response blocked by safety filters (attempt {attempt + 1}/{self.config.retry_attempts})")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                        continue
                    else:
                        return self._get_fallback_selection(article_title)
                
                result_text = response.text.strip()
                
                # DEBUG: Log raw Gemini response
                print(f"\n   🔍 DEBUG - Gemini Raw Response:")
                print(f"      Title: {article_title[:80]}...")
                print(f"      Content length sent: {len(article_content)} chars")
                print(f"      Gemini returned: {result_text[:300]}")
                
                # Extract JSON from potential markdown code blocks
                import re
                
                # Method 1: Extract from markdown code blocks
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', result_text)
                if json_match:
                    result_text = json_match.group(1).strip()
                
                # Method 2: Try to find JSON object with braces
                if not result_text.startswith('{'):
                    json_obj_match = re.search(r'\{[\s\S]*\}', result_text)
                    if json_obj_match:
                        result_text = json_obj_match.group(0)
                    else:
                        # Method 3: Gemini returned JSON content without braces - wrap it
                        if '"components"' in result_text or "'components'" in result_text:
                            result_text = '{' + result_text + '}'
                
                # Clean up any trailing commas before closing brace
                result_text = re.sub(r',\s*}', '}', result_text)
                result_text = re.sub(r',\s*]', ']', result_text)
                
                print(f"      Cleaned JSON: {result_text[:200]}")
                
                result = json.loads(result_text)
                
                # Debug: Check if result is a list instead of dict
                if isinstance(result, list) and len(result) > 0:
                    result = result[0]  # Take first item if it's a list
                
                # Validate and fix if needed
                result = self._validate_and_fix_selection(result)
                
                # DEBUG: Log validated result
                components_list = result.get('components', [])
                print(f"      Validated components: {components_list}")
                if not components_list:
                    print(f"      ℹ️  No components selected for this article")
                
                return result
            
            except json.JSONDecodeError as e:
                print(f"  ⚠ JSON parse error (attempt {attempt + 1}/{self.config.retry_attempts}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                else:
                    # Return intelligent fallback
                    return self._get_fallback_selection(article_title)
            
            except Exception as e:
                error_msg = str(e)
                if "response.text" in error_msg and "finish_reason" in error_msg:
                    print(f"  ⚠ Gemini safety filter blocked content (attempt {attempt + 1}/{self.config.retry_attempts})")
                else:
                    print(f"  ✗ Error selecting components (attempt {attempt + 1}/{self.config.retry_attempts}): {e}")
                
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                else:
                    return self._get_fallback_selection(article_title)
        
        return self._get_fallback_selection(article_title)
    
    def _validate_and_fix_selection(self, result: Dict) -> Dict:
        """
        Validate component selection and fix if needed
        
        Args:
            result: Raw result from Gemini
        
        Returns:
            Validated and fixed result
        """
        # Ensure result is a dict (need article reference for smart fallback)
        if not isinstance(result, dict):
            print(f"  ⚠ Invalid result type: {type(result)}, using fallback")
            return self._get_fallback_selection()
        
        # Ensure components field exists
        if 'components' not in result:
            result['components'] = []
        
        components = result['components']
        
        # Ensure components is a list (need article reference for smart fallback)
        if not isinstance(components, list):
            print(f"  ⚠ Components is not a list: {type(components)}, using fallback")
            return self._get_fallback_selection()
        
        # Filter out any non-string components
        # NOTE: 'map' is now re-enabled, 'scorecard' and 'recipe' are exclusive components
        valid_component_names = {'timeline', 'details', 'graph', 'map', 'scorecard', 'recipe'}
        filtered_components = []
        for comp in components:
            if isinstance(comp, str):
                if comp in valid_component_names:
                    filtered_components.append(comp)
                else:
                    print(f"  ⚠ Invalid component name: '{comp}' (expected: timeline, details, graph, map, scorecard, recipe)")
            elif isinstance(comp, dict):
                # Sometimes Gemini returns dicts - try to extract the component name
                if 'name' in comp:
                    comp_name = comp['name']
                    if comp_name in valid_component_names:
                        filtered_components.append(comp_name)
                    else:
                        print(f"  ⚠ Invalid component name in dict: '{comp_name}'")
                else:
                    print(f"  ⚠ Invalid component dict (no 'name' field): {comp}")
            else:
                print(f"  ⚠ Invalid component type: {type(comp)} - value: {comp}")

        components = filtered_components

        # Scorecard and recipe are exclusive — strip all other components if present
        if 'scorecard' in components:
            components = ['scorecard']
        elif 'recipe' in components:
            components = ['recipe']
        
        # Ensure minimum components (now 0 is allowed — no components is a valid decision)
        if self.config.min_components > 0 and len(components) < self.config.min_components:
            print(f"  ⚠ Too few components ({len(components)}), using fallback")
            return self._get_fallback_selection()
        
        # Ensure maximum components
        if len(components) > self.config.max_components:
            components = components[:self.config.max_components]
        
        result['components'] = components
        
        # Validate graph_type
        if 'graph' in components and not result.get('graph_type'):
            result['graph_type'] = 'line'  # Default to line chart
        elif 'graph' not in components:
            result['graph_type'] = None
        
        # Validate graph_data_needed
        if 'graph' in components and not result.get('graph_data_needed'):
            result['graph_data_needed'] = 'historical data'
        elif 'graph' not in components:
            result['graph_data_needed'] = None
        
        # Validate map_locations
        if 'map' not in components:
            result['map_locations'] = None
        elif not result.get('map_locations'):
            result['map_locations'] = []
        
        return result
    
    def _get_fallback_selection(self, article_title: str = '') -> Dict:
        """
        Return intelligent fallback selection based on article title
        
        Args:
            article_title: Article title to analyze
        
        Returns:
            Smart fallback component selection
        """
        # Simple keyword-based fallback
        title_lower = article_title.lower()
        
        # Fallback for incidents with specific locations (map only for specific places)
        if any(word in title_lower for word in ['airport', 'bridge', 'plant', 'facility', 'base', 'building', 'crash site']):
            return {
                'components': ['map', 'details'],
                'emoji': '🌍',
                'graph_type': None,
                'graph_data_needed': None,
                'map_locations': [],
                'article_type': 'standard'
            }

        # Check for data/trend indicators
        elif any(word in title_lower for word in ['rate', 'price', 'percent', 'increases', 'falls', 'stock', 'market']):
            return {
                'components': ['graph', 'details'],
                'emoji': '📈',
                'graph_type': 'line',
                'graph_data_needed': 'historical data',
                'article_type': 'standard'
            }

        # Check for ongoing sagas that need timeline (very selective)
        elif any(phrase in title_lower for phrase in ['war enters', 'conflict continues', 'investigation reveals', 'files released', 'trial continues']):
            return {
                'components': ['timeline', 'details'],
                'emoji': '📰',
                'graph_type': None,
                'graph_data_needed': None,
                'article_type': 'standard'
            }

        # Default fallback - JUST DETAILS (most stories only need details)
        else:
            return {
                'components': ['details'],
                'emoji': '📰',
                'graph_type': None,
                'graph_data_needed': None,
                'article_type': 'standard'
            }
    
    def select_components_batch(self, articles: List[Dict]) -> List[Dict]:
        """
        Select components for multiple articles
        
        Args:
            articles: List of articles from Step 2
        
        Returns:
            List of articles with added component selection
        """
        print(f"\n{'='*60}")
        print(f"STEP 3: COMPONENT SELECTION")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        component_stats = {
            'timeline': 0,
            'details': 0,
            'graph': 0,
            'map': 0,
            'scorecard': 0,
            'recipe': 0
        }
        
        for i, article in enumerate(articles, 1):
            # Ensure article is a dictionary
            if not isinstance(article, dict):
                print(f"✗ Error: Article {i} is not a dictionary: {type(article)}")
                continue
                
            print(f"[{i}/{len(articles)}] Analyzing: {article.get('title', 'No title')[:60]}...", end=' ')
            
            try:
                # Select components
                selection = self.select_components(article)
                
                # Ensure selection is valid
                if not isinstance(selection, dict) or 'components' not in selection:
                    print(f"✗ Invalid selection returned")
                    continue
                
                # Add selection to article
                article_with_components = article.copy()
                article_with_components['components'] = selection['components']  # Fixed: was 'selected_components'
                article_with_components['emoji'] = selection.get('emoji', '📰')  # NEW: Extract emoji, default to 📰
                article_with_components['graph_type'] = selection.get('graph_type')
                article_with_components['graph_data_needed'] = selection.get('graph_data_needed')
                article_with_components['map_locations'] = selection.get('map_locations')
                article_with_components['article_type'] = selection.get('article_type', 'standard')
                
                results.append(article_with_components)
                
                # Update stats - ensure components are strings
                for component in selection['components']:
                    if isinstance(component, str) and component in component_stats:
                        component_stats[component] += 1
                
                components_str = ', '.join(selection['components']) if selection['components'] else 'none'
                print(f"✓ [{components_str}]")
                
            except Exception as e:
                print(f"✗ Error processing article: {e}")
                continue
            
            # Small delay to avoid rate limits
            if i < len(articles):
                time.sleep(0.1)
        
        # Print statistics
        print(f"\n{'='*60}")
        print(f"COMPONENT SELECTION COMPLETE")
        print(f"{'='*60}")
        print(f"Total articles processed: {len(results)}")
        print(f"\nComponent usage:")
        for component, count in sorted(component_stats.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(results)) * 100
            print(f"  {component}: {count} articles ({percentage:.1f}%)")
        
        # Calculate average components per article
        total_components = sum(component_stats.values())
        avg_components = total_components / len(results) if results else 0
        print(f"\nAverage components per article: {avg_components:.1f}")
        
        return results


# ==========================================
# VALIDATION
# ==========================================

def validate_component_selections(articles: List[Dict]) -> tuple[bool, List[str]]:
    """
    Validate component selections
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    if not articles:
        errors.append("No articles provided")
        return False, errors
    
    for i, article in enumerate(articles[:10]):  # Check first 10
        if 'selected_components' not in article:
            errors.append(f"Article {i} missing 'selected_components'")
            continue
        
        components = article['selected_components']
        
        # Check component count
        if len(components) < 2:
            errors.append(f"Article {i} has only {len(components)} components (need 2-4)")
        elif len(components) > 4:
            errors.append(f"Article {i} has {len(components)} components (max 4)")
        
        # Check valid component names
        valid_components = {'timeline', 'details', 'graph', 'map', 'scorecard', 'recipe'}
        for comp in components:
            if comp not in valid_components:
                errors.append(f"Article {i} has invalid component: {comp}")
        
        # Check graph consistency
        if 'graph' in components:
            if not article.get('graph_type'):
                errors.append(f"Article {i} has graph but no graph_type")
            if not article.get('graph_data_needed'):
                errors.append(f"Article {i} has graph but no graph_data_needed")
        
        # Check map consistency
        if 'map' in components:
            if article.get('map_locations') is None:
                errors.append(f"Article {i} has map but map_locations is None")
    
    return len(errors) == 0, errors


# ==========================================
# STATISTICS & ANALYSIS
# ==========================================

def analyze_component_patterns(articles: List[Dict]) -> Dict:
    """
    Analyze component selection patterns
    
    Returns:
        Dict with analysis results
    """
    # Component combinations
    combinations = {}
    for article in articles:
        components = tuple(sorted(article['selected_components']))
        combinations[components] = combinations.get(components, 0) + 1
    
    # Graph types distribution
    graph_types = {}
    for article in articles:
        if 'graph' in article['selected_components']:
            graph_type = article.get('graph_type', 'unknown')
            graph_types[graph_type] = graph_types.get(graph_type, 0) + 1
    
    # Category-component correlation
    category_components = {}
    for article in articles:
        category = article.get('category', 'Other')
        if category not in category_components:
            category_components[category] = {
                'timeline': 0,
                'details': 0,
                'graph': 0,
                'map': 0,
                'total': 0
            }
        
        category_components[category]['total'] += 1
        for component in article['selected_components']:
            category_components[category][component] += 1
    
    return {
        'total_articles': len(articles),
        'component_combinations': combinations,
        'graph_types': graph_types,
        'category_components': category_components
    }


# ==========================================
# EXAMPLE USAGE
# ==========================================

def main():
    """
    Example usage of Step 3
    """
    
    # API key
    GEMINI_API_KEY = "YOUR_GOOGLE_AI_API_KEY"
    
    # Load full articles from Step 2
    # In real pipeline, this comes from Step 2 output
    full_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "text": "The European Central Bank announced Thursday it is raising interest rates by 0.25 percentage points to 4.5%, marking the tenth consecutive increase since July 2023. The decision comes as inflation remains at 5.3%, well above the bank's 2% target. ECB President Christine Lagarde stated that the move is necessary to bring inflation under control...",
            "url": "https://reuters.com/...",
            "source": "Reuters",
            "score": 850,
            "category": "Economy"
        },
        {
            "title": "Magnitude 7.8 earthquake strikes Turkey and Syria",
            "text": "A powerful magnitude 7.8 earthquake struck southern Turkey and northern Syria at 4:17 AM local time. The epicenter was located 23 kilometers from Gaziantep, Turkey. Initial reports indicate at least 1,200 casualties across both countries. The tremor was felt across six countries including Lebanon, Cyprus, and Iraq...",
            "url": "https://apnews.com/...",
            "source": "Associated Press",
            "score": 920,
            "category": "Disaster"
        },
        # ... ~98 more articles from Step 2
    ]
    
    print(f"Loaded {len(full_articles)} full articles from Step 2")
    
    # Initialize selector
    selector = GeminiComponentSelector(
        api_key=GEMINI_API_KEY,
        config=ComponentConfig(
            min_components=2,
            max_components=4
        )
    )
    
    # Select components for all articles
    articles_with_components = selector.select_components_batch(full_articles)
    
    # Validate results
    is_valid, errors = validate_component_selections(articles_with_components)
    if errors:
        print(f"\n⚠ Validation warnings:")
        for error in errors:
            print(f"  - {error}")
    
    # Analyze patterns
    analysis = analyze_component_patterns(articles_with_components)
    
    print(f"\n{'='*60}")
    print(f"COMPONENT PATTERN ANALYSIS")
    print(f"{'='*60}")
    
    # Show most common combinations
    print(f"\nMost common component combinations:")
    top_combos = sorted(analysis['component_combinations'].items(), key=lambda x: x[1], reverse=True)[:5]
    for combo, count in top_combos:
        percentage = (count / analysis['total_articles']) * 100
        components_str = ' + '.join(combo)
        print(f"  {components_str}: {count} articles ({percentage:.1f}%)")
    
    # Show graph type distribution
    if analysis['graph_types']:
        print(f"\nGraph type distribution:")
        for graph_type, count in sorted(analysis['graph_types'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {graph_type}: {count} articles")
    
    # Show category-component correlation
    print(f"\nComponent usage by category:")
    for category, stats in analysis['category_components'].items():
        if stats['total'] > 0:
            print(f"\n  {category} ({stats['total']} articles):")
            for component in ['timeline', 'details', 'graph', 'map']:
                percentage = (stats[component] / stats['total']) * 100
                print(f"    {component}: {percentage:.0f}%")
    
    # Save results
    with open('step3_components_selected.json', 'w', encoding='utf-8') as f:
        json.dump(articles_with_components, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(articles_with_components)} articles with components to step3_components_selected.json")
    print(f"✓ Ready for Step 4: Perplexity Context Search")
    
    # Show examples
    print(f"\n{'='*60}")
    print(f"EXAMPLE SELECTIONS")
    print(f"{'='*60}")
    
    for i, article in enumerate(articles_with_components[:3], 1):
        print(f"\nArticle {i}: {article['title'][:60]}...")
        print(f"  Category: {article['category']}")
        print(f"  Components: {', '.join(article['selected_components'])}")
        if 'graph' in article['selected_components']:
            print(f"  Graph type: {article['graph_type']}")
            print(f"  Graph data: {article['graph_data_needed']}")
        if 'map' in article['selected_components']:
            print(f"  Map locations: {article['map_locations']}")
    
    return articles_with_components


if __name__ == "__main__":
    main()


# ==========================================
# COST & PERFORMANCE
# ==========================================

"""
GEMINI 2.0 FLASH PRICING:
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

PER 100 ARTICLES:
- Input per article: ~2,500 tokens (system prompt + article preview)
- Output per article: ~100 tokens (component selection JSON)
- Total input: 250,000 tokens
- Total output: 10,000 tokens
- Cost: (250k × $0.075/1M) + (10k × $0.30/1M)
- Cost: $0.01875 + $0.003 = ~$0.022 (~2 cents)

Actually cheaper in practice: ~$0.035 per 100 articles

TIME:
- ~1-2 seconds per article
- Total: ~2-3 minutes for 100 articles
- With 0.1s delays between requests

COMPONENT STATISTICS (Expected):
Based on typical news distribution:
- Details: ~95% of articles (almost always useful)
- Timeline: ~70% of articles (most news has history)
- Graph: ~40% of articles (when time-series data exists)
- Map: ~30% of articles (geographic events)

AVERAGE COMPONENTS PER ARTICLE: ~3.0

Most common combinations:
1. Timeline + Details + Graph (35%)
2. Timeline + Details (25%)
3. Map + Details + Timeline (20%)
4. Details + Graph (15%)
5. All four components (5%)
"""


# ==========================================
# INTEGRATION WITH STEP 4
# ==========================================

"""
After Step 3 completes, pass to Step 4 for dynamic searching:

# Get articles with component selections
articles_with_components = selector.select_components_batch(full_articles)

print(f"Step 3 complete: {len(articles_with_components)} articles with component selections")

# Each article now has:
# - All fields from Step 2 (url, title, text, etc.)
# - selected_components: list of 2-4 components
# - graph_type: 'line', 'bar', 'area', 'column' (if graph selected)
# - graph_data_needed: description of data to search
# - map_locations: list of location names (if map selected)

# Step 4 will now search ONLY for selected components:
# - If 'timeline' selected → search for historical events
# - If 'details' selected → search for key numbers/stats
# - If 'graph' selected → search for time-series data
# - If 'map' selected → search for coordinates/locations

# Proceed to Step 4: Perplexity Dynamic Context Search
# See "Step 4: Perplexity Context Search" document
"""


# ==========================================
# TROUBLESHOOTING
# ==========================================

"""
COMMON ISSUES & SOLUTIONS:

1. Too few components selected:
   - Validation will automatically add 'details' as fallback
   - Adjust min_components in config if needed

2. Wrong component selections:
   - Review system prompt for better guidance
   - Add more examples in prompt
   - Increase temperature slightly (0.2 → 0.3)

3. Missing graph_type when graph selected:
   - Validation automatically defaults to 'line'
   - Can adjust default in _validate_and_fix_selection()

4. JSON parsing errors:
   - Retry logic handles this automatically
   - Falls back to default selection after 3 attempts
   - Default: ['timeline', 'details']

5. Rate limiting:
   - Increase delay between requests
   - Default 0.1s should be sufficient

6. High costs:
   - Already using cheapest model (Gemini 2.0 Flash)
   - Can reduce max_article_preview to 1500 chars
   - Minimal cost impact (~$0.035 per 100 articles)
"""


