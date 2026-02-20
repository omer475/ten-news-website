"""
Event Components Generator

Generates contextual components for world events:
- What to Watch (upcoming important dates)
- Data Analytics (Power BI-style charts with real data)

Components are only generated when relevant to the event type.
"""

import json
import os
from datetime import datetime, timezone
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

1. WHAT TO WATCH
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

   RULE: MOST events should have What to Watch enabled.

2. DATA ANALYTICS
   Shows 2-4 data-driven charts (line, bar, area, pie) with real quantitative data

   ✓ ENABLE for:
     - Trade wars (trade volumes, tariff rates, GDP impact)
     - Economic events (stock prices, employment, inflation)
     - Wars/conflicts (casualty data, refugee numbers, military spending)
     - Climate events (temperature data, emission trends)
     - Health crises (case counts, vaccination rates)
     - Political events (polling data, approval ratings)
     - Any event with quantifiable aspects

   ✗ DISABLE for:
     - Events with no meaningful quantitative dimension
     - Very recent breaking news with no data yet

   RULE: MOST events benefit from data analytics. Enable whenever real data exists.

═══════════════════════════════════════════════════════════════
DECISION CRITERIA
═══════════════════════════════════════════════════════════════

For each component, ask:
1. Does this ADD GENUINE VALUE for understanding the event?
2. Is there enough SUBSTANCE to make it meaningful (not empty/forced)?
3. Would it look NATURAL for this event type (not awkward)?
4. Can the information be ACCURATELY generated?

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "components": {{
    "what_to_watch": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why",
      "has_known_dates": true/false
    }},
    "data_analytics": {{
      "enabled": true/false,
      "reason": "1 sentence explaining why",
      "suggested_charts": ["Chart idea 1", "Chart idea 2"]
    }}
  }},
  "summary": "1 sentence: This event will have X, Y components because..."
}}

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


DATA_ANALYTICS_PROMPT = """Generate data analytics for this world event using REAL quantitative data.

═══════════════════════════════════════════════════════════════
EVENT
═══════════════════════════════════════════════════════════════
Name: {event_name}
Background: {background}
Chart suggestions from relevance analysis: {suggested_charts}

═══════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════

Research this event and produce:
1. **2-4 KEY FACTS** — headline-worthy single data points (cost, count, percentage, record)
2. **2-4 CHARTS** — data-driven visualizations with real numbers

KEY FACTS GUIDANCE:
Think about what single numbers tell the biggest story:
- Cost of this event to an economy (e.g. "$2.4T cumulative impact")
- Number of people/jobs/companies affected
- Percentage change year-over-year
- Record high/low comparisons
- Market cap lost/gained
- Trade volume changes
- Casualty or displacement figures
- Budget or spending amounts

Each key fact should be a single, impactful data point with its source.

SOURCE QUALITY REQUIREMENTS:
Sources MUST be from: government agencies (CBO, BLS, Census Bureau, Eurostat), international organizations (World Bank, IMF, UN, WHO, WTO), official statistics offices, central banks, or major research institutions. No blogs, opinions, or unverified estimates.

CHART REQUIREMENTS:
1. Use REAL data from credible sources
2. Each chart must tell a meaningful story about the event
3. Data points should be accurate and verifiable
4. Include source citations for each chart
5. Choose the chart type that best represents the data
6. You MUST generate at least 2 charts — this is mandatory

CHART TYPES AVAILABLE:
- "line" — Time series, trends over time (best for showing change)
- "bar" — Comparing categories or discrete values
- "stacked_bar" — Showing composition/breakdown of totals
- "area" — Like line but emphasizing volume/magnitude
- "horizontal_bar" — Ranking/comparison (best when labels are long)
- "pie" — Showing parts of a whole (use sparingly, max 6 slices)
- "donut" — Same as pie but with center hole (cleaner look)

DATA FORMAT RULES:
- Each chart has 1+ series (for multi-line, grouped bars, etc.)
- Each series has: name, color (hex), and data array of {{x, y}} points
- x values are strings (years, categories, labels)
- y values are numbers (the actual data)
- For pie/donut: use a single series where x = slice label, y = value

COLOR PALETTE (use these for consistency):
- Primary: #3b82f6 (blue), #ef4444 (red), #10b981 (green), #f59e0b (amber)
- Secondary: #8b5cf6 (purple), #06b6d4 (cyan), #ec4899 (pink), #6366f1 (indigo)

Y-AXIS FORMAT OPTIONS:
- "number" — Plain numbers (1000, 2500)
- "percent" — Percentage (45%)
- "currency_b" — Billions USD ($120B)
- "currency_m" — Millions USD ($450M)
- "compact" — Auto-compact (1.2K, 3.4M, 5.6B)

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

{{
  "data_analytics": {{
    "summary": "2-3 sentence insight paragraph summarizing what the data reveals about this event. Be specific with numbers.",
    "key_facts": [
      {{
        "label": "Cost to US Economy",
        "value": "$2.4T",
        "context": "Cumulative impact since tariffs began in 2018",
        "source": "Congressional Budget Office"
      }},
      {{
        "label": "Jobs Affected",
        "value": "2.1M",
        "context": "Manufacturing and agriculture sectors",
        "source": "Bureau of Labor Statistics"
      }}
    ],
    "charts": [
      {{
        "id": "chart_1",
        "title": "Short chart title (e.g., 'US-China Trade Balance 2018-2025')",
        "description": "1 sentence: what this chart reveals about the event",
        "chart_type": "line|bar|stacked_bar|area|horizontal_bar|pie|donut",
        "x_label": "X axis label (e.g., 'Year', 'Country')",
        "y_label": "Y axis label (e.g., 'Billion USD', 'Percent')",
        "y_format": "number|percent|currency_b|currency_m|compact",
        "series": [
          {{
            "name": "Series name (e.g., 'Exports')",
            "color": "#3b82f6",
            "data": [
              {{"x": "2020", "y": 120}},
              {{"x": "2021", "y": 135}},
              {{"x": "2022", "y": 150}}
            ]
          }}
        ],
        "source": "Data source (e.g., 'US Census Bureau, World Bank')"
      }}
    ]
  }}
}}

QUALITY RULES:
- Generate 2-4 key facts (headline single-stat data points)
- Generate 2-4 charts (MINIMUM 2 — this is mandatory, not more than 4)
- Each chart must have at least 3 data points
- Mix chart types for visual variety (don't use all line charts)
- Data must be REAL — do not fabricate numbers
- Round numbers appropriately (don't fake precision)
- Use the most recent available data
- Charts should complement each other, not repeat the same data
- Every key fact and chart MUST have a source from a credible institution

Respond with valid JSON only."""


DATA_ANALYTICS_RETRY_PROMPT = """Your previous attempt only generated {chart_count} chart(s). You MUST generate at least 2 charts.

Event: {event_name}
Background: {background}

Generate a complete data analytics response with:
- 2-4 key_facts (single headline data points with source)
- AT LEAST 2 charts (this is the minimum, aim for 2-4)

Use the exact same JSON format as before. Sources must be from credible institutions (government agencies, World Bank, IMF, UN, official statistics).

Respond with valid JSON only."""



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



def generate_what_to_watch(event_name: str, background: str, model) -> Optional[Dict]:
    """
    Generate what to watch section with upcoming dates.
    Includes both confirmed and potential/expected events.
    Returns None if not relevant or no valid items exist.
    """
    now = datetime.now(timezone.utc)
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
            current_year = datetime.now(timezone.utc).year
            if date_display and not any(str(y) in date_display for y in range(2020, current_year + 5)):
                # Year missing from display - add it from the date field
                try:
                    year = item_date[:4]
                    item['date_display'] = f"{date_display}, {year}" if date_display else date_display
                except Exception:
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


VALID_CHART_TYPES = {'line', 'bar', 'stacked_bar', 'area', 'horizontal_bar', 'pie', 'donut'}


def _validate_analytics_charts(charts: List[Dict]) -> List[Dict]:
    """Validate and filter analytics charts. Returns list of valid charts (max 4)."""
    valid_charts = []
    for chart in charts:
        chart_type = chart.get('chart_type', '')
        series = chart.get('series', [])

        # Must have valid chart type
        if chart_type not in VALID_CHART_TYPES:
            print(f"    ⚠️ Skipping chart with invalid type: {chart_type}")
            continue

        # Must have at least one series with data
        has_data = any(len(s.get('data', [])) >= 2 for s in series)
        if not has_data:
            print(f"    ⚠️ Skipping chart with insufficient data: {chart.get('title', 'untitled')}")
            continue

        valid_charts.append(chart)

    return valid_charts[:4]


def _validate_key_facts(key_facts: List[Dict]) -> List[Dict]:
    """Validate key facts — each must have label and value."""
    valid = []
    for fact in key_facts:
        if fact.get('label') and fact.get('value'):
            valid.append(fact)
    return valid[:4]


def generate_data_analytics(event_name: str, background: str, suggested_charts: List[str], model) -> Optional[Dict]:
    """Generate data analytics (key facts + charts) with real quantitative data.
    Enforces minimum 2 charts with one retry if needed."""
    prompt = DATA_ANALYTICS_PROMPT.format(
        event_name=event_name,
        background=background,
        suggested_charts=', '.join(suggested_charts) if suggested_charts else 'Relevant data visualizations'
    )

    try:
        response = model.generate_content(prompt)
        data = _parse_json_response(response.text)

        if not data or not data.get('data_analytics'):
            return None

        analytics = data['data_analytics']
        valid_charts = _validate_analytics_charts(analytics.get('charts', []))
        valid_key_facts = _validate_key_facts(analytics.get('key_facts', []))

        # Enforce minimum 2 charts — retry once if needed
        if len(valid_charts) < 2:
            print(f"    ⚠️ Only {len(valid_charts)} valid chart(s), retrying for minimum 2...")
            retry_prompt = DATA_ANALYTICS_RETRY_PROMPT.format(
                chart_count=len(valid_charts),
                event_name=event_name,
                background=background
            )
            try:
                retry_response = model.generate_content(retry_prompt)
                retry_data = _parse_json_response(retry_response.text)
                if retry_data and retry_data.get('data_analytics'):
                    retry_analytics = retry_data['data_analytics']
                    retry_charts = _validate_analytics_charts(retry_analytics.get('charts', []))
                    if len(retry_charts) >= 2:
                        valid_charts = retry_charts
                        print(f"    ✅ Retry succeeded: {len(valid_charts)} charts")
                    # Also pick up key_facts from retry if we didn't get any
                    if not valid_key_facts:
                        valid_key_facts = _validate_key_facts(retry_analytics.get('key_facts', []))
            except Exception as retry_e:
                print(f"    ⚠️ Retry failed: {retry_e}")

        if not valid_charts:
            print(f"    ℹ️ No valid charts generated")
            return None

        print(f"    📊 Generated {len(valid_charts)} analytics charts + {len(valid_key_facts)} key facts")
        return {
            'data_analytics': {
                'summary': analytics.get('summary', ''),
                'key_facts': valid_key_facts,
                'charts': valid_charts
            }
        }

    except Exception as e:
        print(f"    ❌ Failed to generate data analytics: {e}")
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
            'has_what_to_watch': False,
            'has_data_analytics': False,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'relevance_reasoning': relevance_result.get('summary', '')
        }
    }

    # Configure model once for all generations
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash')

    # Step 2: Generate components

    # WHAT TO WATCH — conditional based on relevance
    watch_config = components_config.get('what_to_watch', {})
    if watch_config.get('enabled'):
        print(f"    Generating what to watch...")
        watch_data = generate_what_to_watch(event_name, background, model)
        if watch_data and watch_data.get('what_to_watch'):
            result['what_to_watch'] = watch_data['what_to_watch']
            result['components_metadata']['has_what_to_watch'] = True
            print(f"    ✅ Added {len(result['what_to_watch'])} upcoming dates")

    # DATA ANALYTICS — always generated for every event (mandatory)
    print(f"    Generating data analytics...")
    suggested_charts = components_config.get('data_analytics', {}).get('suggested_charts', [])
    analytics_data = generate_data_analytics(event_name, background, suggested_charts, model)
    if analytics_data and analytics_data.get('data_analytics'):
        result['data_analytics'] = analytics_data['data_analytics']
        result['components_metadata']['has_data_analytics'] = True
        charts_count = len(result['data_analytics'].get('charts', []))
        facts_count = len(result['data_analytics'].get('key_facts', []))
        print(f"    ✅ Added {charts_count} analytics charts + {facts_count} key facts")

    # Summary
    enabled_count = sum([
        result['components_metadata']['has_what_to_watch'],
        result['components_metadata']['has_data_analytics']
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

        # Extract data_analytics and deduplicated sources for dedicated columns
        data_analytics = components.get('data_analytics')
        data_sources = []
        if data_analytics:
            for fact in data_analytics.get('key_facts', []):
                if fact.get('source'):
                    data_sources.append(fact['source'])
            for chart in data_analytics.get('charts', []):
                if chart.get('source'):
                    data_sources.append(chart['source'])
            data_sources = list(dict.fromkeys(data_sources))  # dedupe preserving order

        # Update event with new components AND dedicated columns
        supabase.table('world_events').update({
            'components': components,
            'has_what_to_watch': has_what_to_watch,
            'what_to_watch': what_to_watch,
            'data_analytics': data_analytics,
            'data_sources': data_sources
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
