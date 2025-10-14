import anthropic
import json
import re
import os
from typing import Dict, Tuple

def claude_format_timeline_details(claude_title: str, claude_summary: str, perplexity_results: str) -> Dict[str, str]:
    """
    Step 3: Claude formats timeline and details from Perplexity context
    
    Args:
        claude_title: str, title from Step 1
        claude_summary: str, summary from Step 1
        perplexity_results: str, contextual search results from Step 2
    
    Returns:
        dict with 'timeline' and 'details'
    """
    
    # Get API key from environment
    api_key = os.getenv('CLAUDE_API_KEY')
    if not api_key:
        raise ValueError("CLAUDE_API_KEY environment variable not set")
    
    client = anthropic.Anthropic(api_key=api_key)
    
    system_prompt = """You are a professional news content formatter for News Plus. Your task is to format contextual search results into timeline and details sections that ADD VALUE to a news article.

OUTPUT FORMAT - Always respond with valid JSON:
{
  "timeline": [
    {"date": "Oct 14, 2024", "event": "Event description"},
    {"date": "14:30, Oct 14", "event": "Recent event with time"}
  ],
  "details": [
    "Label: Value",
    "Label: Value",
    "Label: Value"
  ]
}

TIMELINE RULES:
- 2-4 events in chronological order (oldest to newest)
- Each event: date/time + description
- Each description: MAXIMUM 14 words
- Focus on CONTEXTUAL events (background, related developments, upcoming events)
- DO NOT include the main news event that is already in the title/summary
- Events must provide context that helps understand the bigger picture
- Events must be verified and directly relevant

Date/time formats:
- Different days: "Oct 14, 2024"
- Same day (recent): "14:30, Oct 14" (use local timezone where event occurred)
- Month only: "Oct 2024"
- Future: "Dec 2024" or "Dec 12, 2024"

Content requirements:
- Select events that show: what led to this, related developments, what's coming next
- Include specific details when possible
- Use active, clear descriptions
- Maintain chronological order (oldest first)
- Each event must be self-contained and understandable

Timeline examples:
✓ {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle to combat inflation"}
✓ {"date": "Mar 2024", "event": "ECB holds rates steady for first time in eight months"}
✓ {"date": "Dec 2024", "event": "Next policy meeting scheduled to review rates"}
❌ {"date": "Oct 14, 2024", "event": "ECB raises rates to 4.5 percent"} - this is the main news, already in title
❌ {"date": "2023", "event": "Things happened"} - too vague
❌ {"date": "Oct 14, 2024", "event": "The European Central Bank made the decision to raise interest rates for the tenth consecutive time"} - 16 words, too long

DETAILS RULES:
- EXACTLY 3 data points (always 3, never more or less)
- Format: "Label: Value"
- Label: 1-3 words maximum
- Total per detail: under 8 words
- Focus on CONTEXTUAL data (background statistics, comparisons, scale)
- DO NOT include data that is already in the title or summary
- Must use most recent/relevant data available

Content priority (prioritize in order):
1. Comparative numbers (previous rates, historical benchmarks, averages)
2. Scale/impact data (affected populations, market size, scope)
3. Background statistics (related metrics, industry data)
4. Historical context ("First since 2020", "Highest in 20 years")

What to include:
- Previous rates/values before the current news
- Historical comparisons and benchmarks
- Affected populations, scale indicators
- Related metrics from the broader topic
- Timeframes and durations
- Rankings and positions

Details examples:
✓ "Previous rate: 4.25%"
✓ "Inflation target: 2%"
✓ "Affected population: 340M eurozone"
✓ "Last pause: Mar 2024"
✓ "Rate cycle start: Jul 2023"
✓ "Historic high: Since 2001"
❌ "Current rate: 4.5%" - this is already in the title
❌ "Tenth consecutive increase" - this is already in the summary
❌ "The European Central Bank target is 2%" - not in "Label: Value" format
❌ "Rate" - no value provided

GENERATION PROCESS:
1. Read the contextual search results from Perplexity carefully
2. Identify 2-4 key contextual events for timeline (avoid main news event)
3. Sort timeline events chronologically (oldest first)
4. Format each event: date + description (≤14 words)
5. Identify exactly 3 contextual data points for details
6. Format details as "Label: Value" (each <8 words)
7. Verify timeline is chronological and details provide context
8. Ensure NO repetition of information from title/summary

VALIDATION BEFORE OUTPUT:
Timeline: 2-4 events, chronological order, each ≤14 words, correct date format, focuses on context not main news
Details: Exactly 3 items, "Label: Value" format, each <8 words, no title/summary repetition, provides contextual value
Overall: Valid JSON, all fields present, no explanatory text

CRITICAL: The timeline and details must ADD NEW CONTEXTUAL INFORMATION. They should help readers understand the background, scale, and context of the news - NOT repeat what's already in the title and summary.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- No explanations before or after
- No markdown code blocks
- Use double quotes for strings
- No line breaks within string values
- Ensure arrays are properly formatted"""

    user_prompt = f"""Format the contextual search results into timeline and details sections.

ARTICLE TITLE & SUMMARY (for reference - DO NOT repeat this information):
Title: {claude_title}
Summary: {claude_summary}

CONTEXTUAL SEARCH RESULTS FROM PERPLEXITY:
{perplexity_results}

Format the search results into timeline (2-4 events) and details (exactly 3) following all rules. Focus on CONTEXT that adds value. Return only valid JSON with no explanation."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=0.3,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        # Extract and clean response
        response_text = response.content[0].text.strip()
        response_text = re.sub(r'^```json\s*', '', response_text)
        response_text = re.sub(r'\s*```$', '', response_text)
        response_text = response_text.strip()
        
        result = json.loads(response_text)
        
        return result
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        print(f"Response: {response_text}")
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise


def validate_timeline_details(response: Dict[str, str], claude_title: str, claude_summary: str) -> Tuple[bool, list]:
    """
    Validate timeline and details
    
    Returns: (is_valid, errors)
    """
    errors = []
    
    if 'timeline' not in response or 'details' not in response:
        errors.append("Missing timeline or details")
        return False, errors
    
    timeline = response['timeline']
    details = response['details']
    
    # Validate timeline
    if not isinstance(timeline, list):
        errors.append("Timeline must be array")
    elif len(timeline) < 2 or len(timeline) > 4:
        errors.append(f"Timeline must have 2-4 events, got {len(timeline)}")
    else:
        for i, event in enumerate(timeline):
            if 'date' not in event or 'event' not in event:
                errors.append(f"Timeline {i} missing date or event")
            else:
                words = len(event['event'].split())
                if words > 14:
                    errors.append(f"Timeline {i} too long: {words} words (max 14)")
                
                # Check if main news is repeated
                title_lower = claude_title.lower()
                event_lower = event['event'].lower()
                # Check for significant overlap
                title_words = set(title_lower.split())
                event_words = set(event_lower.split())
                overlap = title_words.intersection(event_words)
                if len(overlap) > 5:  # Significant overlap suggests repetition
                    errors.append(f"Timeline {i} may repeat main news from title")
    
    # Validate details
    if not isinstance(details, list):
        errors.append("Details must be array")
    elif len(details) != 3:
        errors.append(f"Details must have exactly 3 items, got {len(details)}")
    else:
        for i, detail in enumerate(details):
            if ':' not in detail:
                errors.append(f"Detail {i} not in 'Label: Value' format")
            
            words = len(detail.split())
            if words > 8:
                errors.append(f"Detail {i} too long: {words} words (max 8)")
            
            # Check if repeating title/summary
            detail_lower = detail.lower()
            if detail_lower in claude_title.lower() or detail_lower in claude_summary.lower():
                errors.append(f"Detail {i} repeats information from title/summary")
    
    is_valid = len(errors) == 0
    return is_valid, errors


# Example usage and testing
if __name__ == "__main__":
    # Test with outputs from Steps 1 and 2
    claude_title = "European Central Bank raises interest rates to 4.5 percent"
    claude_summary = "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent. The decision affects 340 million eurozone residents and is expected to increase borrowing costs for mortgages and business loans across member countries."
    
    perplexity_context = """TIMELINE CONTEXT:

1. July 27, 2023: ECB began its rate hiking cycle, raising rates from 3.5% to 3.75% to combat inflation that had reached 5.5% across the eurozone. This was the first increase after years of near-zero rates.

2. March 2024: ECB held rates steady for the first time in 8 months at 4.25%, signaling potential pause in hiking cycle as inflation showed signs of moderating.

3. June 2024: ECB resumed rate increases despite economic slowdown concerns, citing persistent core inflation pressures.

4. December 12, 2024 (scheduled): Next ECB monetary policy meeting where officials will review rate policy based on latest inflation and growth data.

CONTEXTUAL DATA POINTS:

1. ECB target rate: 2% inflation (current level significantly above target)

2. Eurozone GDP growth: 0.1% in Q3 2024, indicating near-stagnation as high rates impact economic activity

3. Average mortgage impact: Rates expected to increase 0.3 percentage points within 2-3 months, affecting approximately 15 million mortgage holders

4. Historical context: Highest ECB rates since 2001 during dot-com bubble period

5. Previous rate before July 2023: 3.5% (rates have increased 1 full percentage point in 15 months)

6. Unemployment rate: 6.4% across eurozone, relatively stable despite rate increases

ADDITIONAL CONTEXT:

Geographic scope: Policy affects all 20 eurozone countries - Germany, France, Italy, Spain, Netherlands, Belgium, Austria, Portugal, Greece, Finland, Ireland, Slovakia, Slovenia, Lithuania, Latvia, Estonia, Cyprus, Luxembourg, Malta, Croatia.

Market reaction to previous hikes: Euro strengthened against dollar, but European stock markets experienced volatility. Business investment has contracted in manufacturing sectors.

Comparison to other central banks: US Federal Reserve at 5.25-5.5%, Bank of England at 5.25%, showing ECB in line with global tightening trend."""
    
    try:
        result = claude_format_timeline_details(claude_title, claude_summary, perplexity_context)
        
        print("=== STEP 3: CLAUDE FORMATS TIMELINE & DETAILS ===")
        print("Timeline:")
        for event in result['timeline']:
            print(f"  {event['date']}: {event['event']}")
        
        print("\nDetails:")
        for detail in result['details']:
            print(f"  • {detail}")
        
        # Validate the result
        is_valid, errors = validate_timeline_details(result, claude_title, claude_summary)
        if is_valid:
            print("\n✅ Validation passed!")
        else:
            print("\n❌ Validation failed:")
            for error in errors:
                print(f"  - {error}")
                
    except Exception as e:
        print(f"Error: {e}")
