"""
Event Components Generator

Generates contextual components for world events:
- Multiple Perspectives (positions from different sides)
- What to Watch (upcoming important dates)
- Geographic Impact (affected countries/regions)
- Historical Comparison (similar past events)

Components are only generated when relevant to the event type.
"""

import json
import os
from datetime import datetime
from typing import Dict, Optional, List

import google.generativeai as genai
from supabase import create_client, Client

# Initialize Supabase
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


# ==========================================
# PROMPTS
# ==========================================

COMPONENT_RELEVANCE_PROMPT = """Analyze this world event and determine which components would be valuable and make sense to display.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
Name: {event_name}
Description: {topic_prompt}
Background: {background}
Type indicators: {event_type}

═══════════════════════════════════════════════════════════════
AVAILABLE COMPONENTS - DECIDE WHICH TO ENABLE
═══════════════════════════════════════════════════════════════

1. MULTIPLE PERSPECTIVES
   Shows positions/stances from different sides (countries, organizations, parties)
   
   ✓ ENABLE for:
     - Trade disputes (multiple countries with different interests)
     - Wars/conflicts (opposing sides + international observers)
     - Political conflicts (different parties/factions)
     - International negotiations (participating parties)
     - Controversial policies (supporters vs opponents)
   
   ✗ DISABLE for:
     - Natural disasters (no "sides" to show)
     - Single-actor events (one country's internal decision)
     - Scientific discoveries (no opposing positions)
     - Accidents/incidents (no stakeholder positions)

2. WHAT TO WATCH
   Shows upcoming dates/events that readers should know about
   
   ✓ ENABLE for (most world events have relevant dates):
     - Wars/conflicts (invasion anniversaries, scheduled UN sessions, peace talks)
     - Trade wars (tariff implementation dates, WTO rulings)
     - Political events (elections, parliamentary votes, summits)
     - Policy changes (implementation deadlines, review periods)
     - Diplomatic events (G7, G20, UN General Assembly)
     - Court cases (ruling dates, hearings)
     - Economic events (central bank meetings, earnings)
     - Anniversaries of significant dates (1 year, 100 days, etc.)
   
   ✗ DISABLE only for:
     - One-time completed events with no ongoing relevance
     - Very localized incidents with no future developments
     - Events that are fully resolved
   
   RULE: MOST events should have What to Watch enabled. Include anniversaries, scheduled diplomatic events, and expected developments.

3. GEOGRAPHIC IMPACT MAP
   Shows countries/regions affected with their involvement type
   
   ✓ ENABLE for:
     - International conflicts (multiple countries involved)
     - Trade wars (countries imposing/receiving tariffs)
     - Pandemics/health emergencies (spread across regions)
     - Climate events (affecting multiple nations)
     - Multinational agreements/disputes
     - Refugee/migration crises
   
   ✗ DISABLE for:
     - Single-country domestic issues
     - Individual-focused events (celebrity, single politician)
     - Abstract/conceptual events (policy debates without geographic element)
     - Events affecting only one specific location

4. HISTORICAL COMPARISON
   Compares to similar past events for context
   
   ✓ ENABLE for:
     - Trade wars (previous trade disputes exist)
     - Military conflicts (similar past wars)
     - Economic crises (past recessions, crashes)
     - Political crises (impeachments, coups with precedents)
     - Recurring patterns (elections, negotiations)
     - Events with clear historical parallels
   
   ✗ DISABLE for:
     - Truly unprecedented events (first of its kind)
     - Very recent phenomena (no historical comparison exists)
     - Unique technological events (new tech, no parallel)
     - Events where comparison would be misleading/forced

═══════════════════════════════════════════════════════════════
DECISION CRITERIA
═══════════════════════════════════════════════════════════════

For each component, ask:
1. Does this ADD GENUINE VALUE for understanding the event?
2. Is there enough SUBSTANCE to make it meaningful (not empty/forced)?
3. Would it look NATURAL for this event type (not awkward)?
4. Can the information be ACCURATELY generated?

BE RELEVANT - Enable all components that genuinely fit, disable those that don't:
- Events CAN have all 4 components if all 4 are relevant
- Historical Comparison: enable if there is a CLEAR historical parallel. Do NOT force vague or misleading comparisons.
- Perspectives: enable if there are genuine OPPOSING positions from identifiable parties. One-sided events (natural disasters, accidents) don't need this.
- Geographic Impact: enable if multiple countries are meaningfully involved
- What to Watch: enable for most events (this is the most universally useful component)
- The key rule: every enabled component must ADD REAL VALUE. Don't force it, but don't skip it if it fits.

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "components": {{
    "perspectives": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why this fits or doesn't fit",
      "potential_sides": ["Side 1", "Side 2", "Side 3"]
    }},
    "what_to_watch": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why",
      "has_known_dates": true/false
    }},
    "geographic_impact": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why",
      "affected_regions": ["Country/Region 1", "Country/Region 2"]
    }},
    "historical_comparison": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why",
      "potential_comparisons": ["Historical Event 1", "Historical Event 2"]
    }}
  }},
  "summary": "1 sentence: This event will have X, Y components because..."
}}

Respond with valid JSON only."""


PERSPECTIVES_PROMPT = """Generate a Multiple Perspectives section for this world event.

═══════════════════════════════════════════════════════════════
EVENT
═══════════════════════════════════════════════════════════════
Name: {event_name}
Background: {background}
Key sides to cover: {potential_sides}

═══════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════

Create 2-4 perspective entries showing different positions on this event.

REQUIREMENTS:
1. Each perspective represents a DISTINCT stakeholder (country, organization, political group, international body)
2. Include a real or accurately paraphrased quote/position that captures their stance
3. Keep positions concise (1-2 sentences max)
4. Be NEUTRAL - present each side fairly without editorializing or taking sides
5. Use appropriate flag emoji for countries, or relevant symbol for organizations
6. Ensure positions are CURRENT and ACCURATE based on public statements

STAKEHOLDER TYPES TO CONSIDER:
- Countries directly involved (use flag emoji: 🇺🇸 🇨🇳 🇬🇧 🇪🇺 🇷🇺 🇺🇦 🇮🇱 🇵🇸 etc.)
- International organizations (🇺🇳 UN, 🏛️ NATO, 🌍 African Union, etc.)
- Political parties or factions (use relevant symbol)
- Industry/business groups (🏢)
- Civil society/NGOs (relevant symbol)

STANCE CATEGORIES:
- "supportive" - Actively supports/promotes
- "opposed" - Actively opposes/condemns  
- "concerned" - Worried but not taking strong action
- "neutral" - Officially neutral or mediating
- "defensive" - Defending their own position/actions
- "divided" - Internal disagreement

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "perspectives": [
    {{
      "entity": "Name of country/organization",
      "icon": "Flag emoji or relevant symbol",
      "position": "1-2 sentence quote or paraphrased official position",
      "stance": "supportive/opposed/concerned/neutral/defensive/divided",
      "source_context": "Who/what this position comes from (e.g., 'Government officials', 'Ministry statement')"
    }}
  ]
}}

Include 2-4 perspectives, ordered by relevance/importance to the event.
Respond with valid JSON only."""


WHAT_TO_WATCH_PROMPT = """Generate a "What to Watch" section for this world event.

"What to Watch" shows UPCOMING dates/events that could affect the situation.

═══════════════════════════════════════════════════════════════
EVENT
═══════════════════════════════════════════════════════════════
Name: {event_name}
Background: {background}

⚠️ CRITICAL DATE RULES:
Today's date is: {current_date}
Current year is: {current_year}

ALL dates MUST be in the FUTURE (after {current_date}).
DO NOT include any dates that have already passed.
ALWAYS include the YEAR in date_display (e.g. "February 24, 2026" NOT "February 24").

═══════════════════════════════════════════════════════════════
TYPES OF ITEMS TO INCLUDE
═══════════════════════════════════════════════════════════════

ALWAYS LOOK FOR:
✅ SCHEDULED EVENTS - Summits, meetings, conferences
✅ DEADLINES - Treaty expirations, tariff implementation dates
✅ ELECTIONS - That could affect the situation
✅ ANNIVERSARIES - Major milestones (1 year, 100 days, etc.)
✅ RECURRING EVENTS - UN sessions, G7/G20, annual summits
✅ RELATED VOTES - UN Security Council, congressional votes

FOR WARS/CONFLICTS, also include:
✅ Scheduled peace talks or negotiations
✅ UN General Assembly sessions that may address it
✅ Humanitarian aid deadlines
✅ Significant anniversaries (war start date, ceasefire anniversary)
✅ Related diplomatic meetings

FOR POLICY/TRADE, also include:
✅ Implementation dates
✅ Review periods
✅ Related court rulings expected
✅ Congressional/parliamentary votes

═══════════════════════════════════════════════════════════════
ITEM TYPES
═══════════════════════════════════════════════════════════════

Mark each item with appropriate type:
- "scheduled" - Officially confirmed event (summit, meeting)
- "deadline" - Hard deadline (tariffs, treaty expiration)
- "election" - Election that affects the situation
- "anniversary" - Significant date milestone
- "potential" - Highly likely but not 100% confirmed (UN vote expected)

For "potential" items, be clear in description that it's expected but not confirmed.

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "is_relevant": true,
  "reason": "Brief explanation",
  "what_to_watch": [
    {{
      "date": "YYYY-MM-DD",
      "date_display": "February 24, 2026",
      "title": "What's happening (3-6 words)",
      "description": "Why it matters (1 sentence)",
      "type": "scheduled|deadline|election|anniversary|potential",
      "confirmed": true/false,
      "source": "Where this was announced or known from"
    }}
  ]
}}

═══════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════

EXAMPLE 1 - Trade War:
{{
  "is_relevant": true,
  "reason": "Trade disputes have implementation dates and review deadlines",
  "what_to_watch": [
    {{
      "date": "2026-02-01",
      "date_display": "February 1, 2026",
      "title": "25% Tariffs Take Effect",
      "description": "Scheduled implementation date for new tariffs on Chinese goods",
      "type": "deadline",
      "confirmed": true,
      "source": "White House announcement"
    }},
    {{
      "date": "2026-03-15",
      "date_display": "March 15, 2026",
      "title": "WTO Ruling Expected",
      "description": "World Trade Organization ruling on tariff legality",
      "type": "potential",
      "confirmed": false,
      "source": "WTO calendar"
    }}
  ]
}}

EXAMPLE 2 - War/Conflict (Ukraine-Russia):
{{
  "is_relevant": true,
  "reason": "Ongoing conflict with diplomatic calendar and key dates",
  "what_to_watch": [
    {{
      "date": "2026-02-24",
      "date_display": "February 24, 2026",
      "title": "4th Anniversary of Invasion",
      "description": "Marks 4 years since Russia's full-scale invasion began",
      "type": "anniversary",
      "confirmed": true,
      "source": "Historical date"
    }},
    {{
      "date": "2026-09-15",
      "date_display": "September 15, 2026",
      "title": "UN General Assembly Session",
      "description": "Annual assembly where Ukraine crisis typically addressed",
      "type": "scheduled",
      "confirmed": true,
      "source": "UN calendar"
    }}
  ]
}}

EXAMPLE 3 - AI Regulations:
{{
  "is_relevant": true,
  "reason": "Regulatory process has implementation dates and review periods",
  "what_to_watch": [
    {{
      "date": "2026-08-01",
      "date_display": "August 1, 2026",
      "title": "EU AI Act Full Implementation",
      "description": "All provisions of EU AI Act come into force",
      "type": "deadline",
      "confirmed": true,
      "source": "EU legislation"
    }}
  ]
}}

ONLY return is_relevant: false for:
- Completed/resolved events with no future relevance
- Single incidents with no ongoing developments

IMPORTANT:
- Maximum 5 entries
- Include at least 1 item for most events
- Mix confirmed and potential items when appropriate
- ALL dates MUST be AFTER {current_date} (today). Never include past dates.
- ALWAYS include the year in date_display (e.g. "March 15, 2026")
- If unsure about exact date, use the best estimate but keep it in the future

Respond with valid JSON only."""


GEOGRAPHIC_IMPACT_PROMPT = """Generate geographic impact data for this world event.

═══════════════════════════════════════════════════════════════
EVENT
═══════════════════════════════════════════════════════════════
Name: {event_name}
Background: {background}
Known affected regions: {affected_regions}

═══════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════

Identify all countries/regions significantly affected by this event and categorize their involvement.

REQUIREMENTS:
1. Use ISO 3166-1 alpha-2 country codes (US, CN, GB, DE, FR, JP, etc.)
2. Categorize each country's involvement level
3. Include brief description of HOW each is affected
4. Order by significance (primary actors first)
5. Be comprehensive but focused (4-10 countries typically)

INVOLVEMENT LEVELS:
- "primary": Directly causing or central to the event (main actors)
- "major": Significantly affected or key player in response
- "moderate": Notable impact or meaningful involvement
- "minor": Peripheral involvement, indirect effects, or observer status

DESCRIPTION GUIDELINES:
- 1 short sentence per country
- Focus on HOW they're involved, not just THAT they're involved
- Be specific (e.g., "Targeted with 25% tariffs on auto exports" not "Affected by tariffs")

═══════════════════════════════════════════════════════════════
COMMON COUNTRY CODES REFERENCE
═══════════════════════════════════════════════════════════════
US - United States       CN - China              RU - Russia
GB - United Kingdom      DE - Germany            FR - France
JP - Japan               KR - South Korea        IN - India
BR - Brazil              MX - Mexico             CA - Canada
AU - Australia           IT - Italy              ES - Spain
NL - Netherlands         SA - Saudi Arabia       AE - UAE
IL - Israel              PS - Palestine          UA - Ukraine
TR - Turkey              EG - Egypt              ZA - South Africa
ID - Indonesia           NG - Nigeria            PK - Pakistan
IR - Iran                IQ - Iraq               SY - Syria

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "geographic_impact": {{
    "primary_region": "Main geographic area or theme (e.g., 'Middle East', 'Global Trade')",
    "total_countries_affected": <number>,
    "countries": [
      {{
        "code": "XX",
        "name": "Full Country Name",
        "involvement": "primary/major/moderate/minor",
        "role": "initiator/target/combatant/mediator/ally/affected/observer/beneficiary",
        "description": "1 sentence on how this country is involved"
      }}
    ],
    "regions_summary": [
      {{"region": "Region name", "status": "Brief status"}}
    ]
  }}
}}

Include 4-10 countries. Respond with valid JSON only."""


HISTORICAL_COMPARISON_PROMPT = """Find meaningful historical parallels for this world event.

═══════════════════════════════════════════════════════════════
EVENT
═══════════════════════════════════════════════════════════════
Name: {event_name}
Background: {background}
Potential comparisons to explore: {potential_comparisons}

═══════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════

Find 1-2 historical events that provide MEANINGFUL context for understanding this event.

REQUIREMENTS:
1. Comparisons must be GENUINELY USEFUL (similar causes, dynamics, stakes, or actors)
2. Include what happened AND how it resolved
3. Explicitly state both SIMILARITIES and DIFFERENCES
4. Be honest about limitations of the comparison
5. Focus on what readers can LEARN from the comparison

GOOD COMPARISONS HELP READERS UNDERSTAND:
- How similar situations played out historically
- What factors led to resolution, escalation, or stalemate
- Rough timelines to expect
- Potential outcomes based on precedent

COMPARISON QUALITY CRITERIA:
✓ Similar underlying dynamics (not just surface similarity)
✓ Comparable stakes or scale
✓ Relevant to understanding current situation
✓ Historical event is well-documented and concluded

✗ Avoid forced comparisons (stretching to find parallels)
✗ Avoid misleading comparisons (different in crucial ways)
✗ Avoid comparisons that are too obvious/unhelpful
✗ Avoid ongoing events (no resolution to learn from)

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "historical_comparison": {{
    "headline": "Short headline for this section (e.g., 'How previous trade wars played out')",
    "comparisons": [
      {{
        "event_name": "Name of historical event",
        "years": "Year or range (e.g., '2018-2020', '1962')",
        "duration_months": <number or null if ongoing/unclear>,
        "summary": "2-3 sentence description of what happened",
        "resolution": "How it ended (1-2 sentences)",
        "outcome_type": "resolution/partial_resolution/escalation/ceasefire_no_resolution/ongoing",
        "similarities": ["Similarity 1", "Similarity 2", "Similarity 3"],
        "differences": ["Difference 1", "Difference 2", "Difference 3"],
        "key_lessons": "What we can learn from this comparison (2-3 sentences)"
      }}
    ],
    "context_note": "Brief caveat about comparison limitations (1-2 sentences)",
    "timeline_insight": "What the historical precedent suggests about timeline/duration (1 sentence)"
  }}
}}

Include 1-2 comparisons (quality over quantity). Respond with valid JSON only."""


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def _parse_json_response(text: str) -> dict:
    """Parse JSON from AI response, handling markdown code blocks."""
    text = text.strip()
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text)


# ==========================================
# COMPONENT GENERATION FUNCTIONS
# ==========================================

def determine_relevant_components(event_name: str, topic_prompt: str, background: str) -> Dict:
    """
    Use AI to determine which components are relevant for this event.
    Returns component configuration with enabled flags and generation hints.
    """
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Infer event type from keywords for better AI context
    event_type_indicators = []
    combined_text = f"{event_name} {topic_prompt}".lower()
    
    type_keywords = {
        'military_conflict': ['war', 'conflict', 'invasion', 'attack', 'military', 'troops', 'combat'],
        'economic_dispute': ['tariff', 'trade', 'sanction', 'economic', 'import', 'export', 'duties'],
        'political_event': ['election', 'vote', 'political', 'government', 'president', 'minister', 'parliament'],
        'diplomatic_event': ['summit', 'meeting', 'negotiation', 'talks', 'treaty', 'agreement', 'diplomacy'],
        'humanitarian_crisis': ['refugee', 'humanitarian', 'crisis', 'displacement', 'famine', 'aid'],
        'natural_disaster': ['earthquake', 'hurricane', 'flood', 'disaster', 'tsunami', 'wildfire'],
        'health_emergency': ['pandemic', 'outbreak', 'virus', 'epidemic', 'health emergency', 'disease']
    }
    
    for event_type, keywords in type_keywords.items():
        if any(kw in combined_text for kw in keywords):
            event_type_indicators.append(event_type)
    
    prompt = COMPONENT_RELEVANCE_PROMPT.format(
        event_name=event_name,
        topic_prompt=topic_prompt,
        background=background,
        event_type=', '.join(event_type_indicators) if event_type_indicators else 'general/other'
    )
    
    try:
        response = model.generate_content(prompt)
        result = _parse_json_response(response.text)
        print(f"    Component relevance: {result.get('summary', 'Determined')}")
        return result
        
    except Exception as e:
        print(f"    ❌ Failed to determine components: {e}")
        # Return safe defaults - no components enabled
        return {"components": {}}


def generate_perspectives(event_name: str, background: str, potential_sides: List[str], model) -> Optional[Dict]:
    """Generate multiple perspectives section."""
    prompt = PERSPECTIVES_PROMPT.format(
        event_name=event_name,
        background=background,
        potential_sides=', '.join(potential_sides) if potential_sides else 'Key stakeholders involved'
    )
    
    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except Exception as e:
        print(f"    ❌ Failed to generate perspectives: {e}")
        return None


def generate_what_to_watch(event_name: str, background: str, model) -> Optional[Dict]:
    """
    Generate what to watch section with upcoming dates.
    Includes both confirmed and potential/expected events.
    Returns None if not relevant or no valid items exist.
    """
    now = datetime.utcnow()
    prompt = WHAT_TO_WATCH_PROMPT.format(
        event_name=event_name,
        background=background,
        current_date=now.strftime('%Y-%m-%d'),
        current_year=now.strftime('%Y')
    )
    
    try:
        response = model.generate_content(prompt)
        data = _parse_json_response(response.text)
        
        if not data:
            return None
        
        # Check if this event type is relevant for What to Watch
        is_relevant = data.get('is_relevant', True)  # Default to True for backwards compatibility
        reason = data.get('reason', '')
        
        if not is_relevant:
            print(f"    ℹ️ What to Watch skipped: {reason}")
            return None
        
        # Get the what_to_watch array
        what_to_watch = data.get('what_to_watch', [])
        
        # Only filter out truly speculative/vague items
        # Allow "potential" and "expected" items - these are useful for users
        hard_filter_keywords = [
            'rumored', 'speculated', 'uncertain',
            'might happen', 'could happen', 'may occur',
            'no date set', 'tbd', 'to be determined'
        ]
        
        today_str = now.strftime('%Y-%m-%d')
        
        filtered_items = []
        for item in what_to_watch:
            title_lower = item.get('title', '').lower()
            desc_lower = item.get('description', '').lower()
            combined = title_lower + ' ' + desc_lower
            
            # Only filter truly vague/speculative items
            is_too_vague = any(keyword in combined for keyword in hard_filter_keywords)
            
            if is_too_vague:
                print(f"    ⚠️ Filtered out vague item: {item.get('title')}")
                continue
            
            # Must have a date
            if not item.get('date'):
                print(f"    ⚠️ Filtered out item without date: {item.get('title')}")
                continue
            
            # CRITICAL: Filter out past dates
            item_date = item.get('date', '')
            if item_date < today_str:
                print(f"    ⚠️ Filtered out PAST date: {item.get('title')} ({item_date})")
                continue
            
            # Ensure year is in date_display
            date_display = item.get('date_display', '')
            if date_display and not any(str(y) in date_display for y in range(2024, 2035)):
                # Year missing from display - add it from the date field
                try:
                    year = item_date[:4]
                    item['date_display'] = f"{date_display}, {year}" if date_display else date_display
                except:
                    pass
            
            # Source is nice to have but not required for anniversaries/known dates
            item_type = item.get('type', '')
            if not item.get('source') and item_type not in ['anniversary', 'deadline']:
                # Add a generic source for scheduled events without one
                item['source'] = 'Known schedule'
                
            filtered_items.append(item)
        
        # If no valid items remain, return None
        if not filtered_items:
            print(f"    ℹ️ No valid events found for What to Watch")
            return None
        
        print(f"    📅 Generated {len(filtered_items)} What to Watch items")
        return {'what_to_watch': filtered_items, 'reason': reason}
        
    except Exception as e:
        print(f"    ❌ Failed to generate what to watch: {e}")
        return None


def generate_geographic_impact(event_name: str, background: str, affected_regions: List[str], model) -> Optional[Dict]:
    """Generate geographic impact section with country data."""
    prompt = GEOGRAPHIC_IMPACT_PROMPT.format(
        event_name=event_name,
        background=background,
        affected_regions=', '.join(affected_regions) if affected_regions else 'To be determined by analysis'
    )
    
    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except Exception as e:
        print(f"    ❌ Failed to generate geographic impact: {e}")
        return None


def generate_historical_comparison(event_name: str, background: str, potential_comparisons: List[str], model) -> Optional[Dict]:
    """Generate historical comparison section."""
    prompt = HISTORICAL_COMPARISON_PROMPT.format(
        event_name=event_name,
        background=background,
        potential_comparisons=', '.join(potential_comparisons) if potential_comparisons else 'Relevant historical precedents'
    )
    
    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except Exception as e:
        print(f"    ❌ Failed to generate historical comparison: {e}")
        return None


# ==========================================
# MAIN FUNCTIONS
# ==========================================

def generate_event_components(event_name: str, topic_prompt: str, background: str) -> Dict:
    """
    Main function to generate all relevant components for an event.
    
    Flow:
    1. AI determines which components are relevant for this event type
    2. Generates only the relevant components
    3. Returns combined components dict with metadata
    
    Args:
        event_name: Short event name (e.g., "Trump's Tariffs")
        topic_prompt: Event description/topic
        background: Event background paragraph
        
    Returns:
        Dict with generated components and metadata
    """
    print(f"\n  🧩 Generating components for: {event_name}")
    
    # Step 1: Determine which components are relevant
    relevance_result = determine_relevant_components(event_name, topic_prompt, background)
    components_config = relevance_result.get('components', {})
    
    # Initialize result with metadata
    result = {
        'components_metadata': {
            'has_perspectives': False,
            'has_what_to_watch': False,
            'has_geographic_impact': False,
            'has_historical_comparison': False,
            'generated_at': datetime.utcnow().isoformat(),
            'relevance_reasoning': relevance_result.get('summary', '')
        }
    }
    
    # Check if any components are enabled
    any_enabled = any([
        components_config.get('perspectives', {}).get('enabled', False),
        components_config.get('what_to_watch', {}).get('enabled', False),
        components_config.get('geographic_impact', {}).get('enabled', False),
        components_config.get('historical_comparison', {}).get('enabled', False)
    ])
    
    if not any_enabled:
        print(f"    ℹ️ No components enabled for this event type")
        return result
    
    # Configure model once for all generations
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Step 2: Generate each enabled component
    
    # PERSPECTIVES
    perspectives_config = components_config.get('perspectives', {})
    if perspectives_config.get('enabled'):
        print(f"    Generating perspectives...")
        potential_sides = perspectives_config.get('potential_sides', [])
        perspectives_data = generate_perspectives(event_name, background, potential_sides, model)
        if perspectives_data and perspectives_data.get('perspectives'):
            result['perspectives'] = perspectives_data['perspectives']
            result['components_metadata']['has_perspectives'] = True
            print(f"    ✅ Added {len(result['perspectives'])} perspectives")
    
    # WHAT TO WATCH
    watch_config = components_config.get('what_to_watch', {})
    if watch_config.get('enabled'):
        print(f"    Generating what to watch...")
        watch_data = generate_what_to_watch(event_name, background, model)
        if watch_data and watch_data.get('what_to_watch'):
            result['what_to_watch'] = watch_data['what_to_watch']
            result['components_metadata']['has_what_to_watch'] = True
            print(f"    ✅ Added {len(result['what_to_watch'])} upcoming dates")
    
    # GEOGRAPHIC IMPACT
    geo_config = components_config.get('geographic_impact', {})
    if geo_config.get('enabled'):
        print(f"    Generating geographic impact...")
        affected_regions = geo_config.get('affected_regions', [])
        geo_data = generate_geographic_impact(event_name, background, affected_regions, model)
        if geo_data and geo_data.get('geographic_impact'):
            result['geographic_impact'] = geo_data['geographic_impact']
            result['components_metadata']['has_geographic_impact'] = True
            countries_count = len(result['geographic_impact'].get('countries', []))
            print(f"    ✅ Added geographic impact for {countries_count} countries")
    
    # HISTORICAL COMPARISON
    comparison_config = components_config.get('historical_comparison', {})
    if comparison_config.get('enabled'):
        print(f"    Generating historical comparison...")
        potential_comparisons = comparison_config.get('potential_comparisons', [])
        comparison_data = generate_historical_comparison(event_name, background, potential_comparisons, model)
        if comparison_data and comparison_data.get('historical_comparison'):
            result['historical_comparison'] = comparison_data['historical_comparison']
            result['components_metadata']['has_historical_comparison'] = True
            comparisons_count = len(result['historical_comparison'].get('comparisons', []))
            print(f"    ✅ Added {comparisons_count} historical comparisons")
    
    # Summary
    enabled_count = sum([
        result['components_metadata']['has_perspectives'],
        result['components_metadata']['has_what_to_watch'],
        result['components_metadata']['has_geographic_impact'],
        result['components_metadata']['has_historical_comparison']
    ])
    print(f"  ✅ Generated {enabled_count} components for {event_name}")
    
    return result


def update_event_components(event_id: str) -> bool:
    """
    Regenerate components for an existing event.
    Useful for refreshing what_to_watch dates or adding new components.
    
    Args:
        event_id: UUID of the event to update
        
    Returns:
        True if successful, False otherwise
    """
    if not supabase:
        print("    ❌ Supabase not configured")
        return False
    
    try:
        # Fetch event data
        result = supabase.table('world_events').select(
            'name, topic_prompt, background'
        ).eq('id', event_id).single().execute()
        
        if not result.data:
            print(f"    ❌ Event not found: {event_id}")
            return False
        
        event = result.data
        
        # Generate fresh components
        components = generate_event_components(
            event['name'],
            event.get('topic_prompt', ''),
            event.get('background', '')
        )
        
        # Extract what_to_watch for dedicated columns
        what_to_watch = components.get('what_to_watch', [])
        has_what_to_watch = len(what_to_watch) > 0
        
        # Update event with new components AND dedicated what_to_watch columns
        supabase.table('world_events').update({
            'components': components,
            'has_what_to_watch': has_what_to_watch,
            'what_to_watch': what_to_watch
        }).eq('id', event_id).execute()
        
        print(f"  ✅ Updated components for event: {event['name']}")
        if has_what_to_watch:
            print(f"      📅 What to Watch: {len(what_to_watch)} items")
        return True
        
    except Exception as e:
        print(f"    ❌ Failed to update components: {e}")
        return False


def refresh_all_event_components() -> Dict:
    """
    Refresh components for all ongoing world events.
    Useful for batch updates or scheduled refreshes.
    
    Returns:
        Dict with success/failure counts
    """
    if not supabase:
        print("❌ Supabase not configured")
        return {'success': 0, 'failed': 0}
    
    try:
        # Fetch all ongoing events
        result = supabase.table('world_events').select(
            'id, name'
        ).eq('status', 'ongoing').execute()
        
        events = result.data or []
        print(f"\n🔄 Refreshing components for {len(events)} events...")
        
        success_count = 0
        failed_count = 0
        
        for event in events:
            if update_event_components(event['id']):
                success_count += 1
            else:
                failed_count += 1
        
        print(f"\n✅ Refresh complete: {success_count} success, {failed_count} failed")
        return {'success': success_count, 'failed': failed_count}
        
    except Exception as e:
        print(f"❌ Batch refresh error: {e}")
        return {'success': 0, 'failed': 0, 'error': str(e)}


# ==========================================
# CLI INTERFACE
# ==========================================

if __name__ == "__main__":
    import sys
    
    print("Event Components Generator")
    print("="*40)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "refresh-all":
            refresh_all_event_components()
        elif sys.argv[1] == "refresh" and len(sys.argv) > 2:
            event_id = sys.argv[2]
            update_event_components(event_id)
        else:
            print("Usage:")
            print("  python event_components.py refresh-all        # Refresh all events")
            print("  python event_components.py refresh <event_id> # Refresh specific event")
    else:
        # Test with sample data
        test_result = generate_event_components(
            event_name="Trump's Tariffs",
            topic_prompt="US tariffs on China, Canada, Mexico and other trading partners",
            background="The Trump administration has imposed significant tariffs on imports from multiple countries, triggering retaliatory measures and concerns about a global trade war."
        )
        print(f"\nResult: {json.dumps(test_result, indent=2)}")
