import anthropic
import json
import re
import os
from typing import Dict, Tuple

def claude_write_title_summary(article: Dict[str, str]) -> Dict[str, str]:
    """
    Step 1: Claude writes title and summary from original article
    
    Args:
        article: dict with 'title' and 'description'
    
    Returns:
        dict with 'title' and 'summary'
    """
    
    # Get API key from environment
    api_key = os.getenv('CLAUDE_API_KEY')
    if not api_key:
        raise ValueError("CLAUDE_API_KEY environment variable not set")
    
    client = anthropic.Anthropic(api_key=api_key)
    
    system_prompt = """You are a professional news writer for News Plus, a global news application. Your task is to write a compelling title and summary for news articles.

OUTPUT FORMAT - Always respond with valid JSON:
{
  "title": "Your generated title",
  "summary": "Your generated summary"
}

TITLE RULES:
- Maximum 12 words
- Must be declarative statement (NEVER a question)
- Must include geographic/entity context (country, region, or organization name)
- Must convey complete main point of the article
- Use active voice
- Use sentence case (capitalize only first word and proper nouns)
- PROHIBITED: Questions, clickbait phrases, exclamation marks, ALL CAPS, editorial opinions, vague geographic references

Geographic specificity - Always specify location/entity:
❌ "Government announces policy" ✓ "Canadian government announces climate policy"
❌ "Central bank raises rates" ✓ "European Central Bank raises rates to 4.5 percent"

Title examples:
✓ "European Central Bank raises interest rates to 4.5 percent"
✓ "Indian Parliament approves controversial citizenship amendment bill"
✓ "Australian wildfires force evacuation of 50,000 residents"

SUMMARY RULES:
- EXACTLY 35-42 words (MANDATORY - count carefully)
- Must add NEW information beyond the title
- NEVER repeat exact wording from title
- Must include geographic/entity specificity
- Flexible sentence structure (1-4 sentences)
- Prioritize impact and consequences
- Use past tense for completed events, present tense for ongoing situations
- Use active voice

SUMMARY EXAMPLES (35-42 words each):
✓ "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent. The decision affects 340 million eurozone residents and is expected to increase borrowing costs for mortgages and business loans across member countries." (42 words)
✓ "This latest increase brings the ECB's main refinancing rate to 4.5 percent, the highest level since 2008. The move affects borrowing costs for 19 eurozone countries and comes as inflation remains stubbornly high despite previous rate increases." (38 words)

Information hierarchy (prioritize in order):
1. Impact/consequences (who affected, how many)
2. Specific numbers (percentages, amounts, dates)
3. Timeline information (when starts, duration, deadlines)
4. Brief context (background if essential)
5. Additional parties involved

Geographic rules:
- Always specify countries, regions, organizations
- Well-known entities need no context: UN, WHO, NATO, NASA, EU, US, UK
- Multiple countries (up to 3): "US, Japan, and South Korea"
- More than 3: use regional grouping "Southeast Asian nations"

Define acronyms on first use EXCEPT: UN, US, UK, EU, NATO, NASA, WHO, GDP, CEO, AI, IT

PROHIBITED in summary: Exact title repetition, speculative language ("may", "could", "might") unless quoting source, editorial opinions, questions, exclamation marks, promotional language, incomplete sentences, bullet points, dramatic phrases ("shocking", "devastating"), vague references without location

GENERATION PROCESS:
1. Read the original article carefully
2. Identify the main news event and geographic location/entity
3. Generate title (≤12 words) with complete main point
4. Generate summary (35-42 words) adding information NOT in title
5. Verify no exact title wording repeated in summary
6. Check word counts and geographic specificity

VALIDATION BEFORE OUTPUT:
Title: ≤12 words, statement not question, includes country/region/entity, active voice, sentence case
Summary: EXACTLY 35-42 words (count each word carefully), no exact title repetition, geographic specificity, specific numbers included, correct tense, active voice

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- No explanations before or after
- No markdown code blocks
- Use double quotes for strings
- No line breaks within string values"""

    user_prompt = f"""Write a professional news title and summary for this article.

ORIGINAL ARTICLE:
Title: {article['title']}
Description: {article['description']}

CRITICAL: Summary must be EXACTLY 35-42 words. Count each word carefully before outputting.

Generate title and summary following all rules. Return only valid JSON with no explanation."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            temperature=0.5,
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


def validate_title_summary(response: Dict[str, str]) -> Tuple[bool, list]:
    """
    Validate Claude's title and summary
    
    Returns: (is_valid, errors)
    """
    errors = []
    
    if 'title' not in response or 'summary' not in response:
        errors.append("Missing title or summary")
        return False, errors
    
    title = response['title']
    summary = response['summary']
    
    # Validate title
    title_words = len(title.split())
    if title_words > 12:
        errors.append(f"Title too long: {title_words} words (max 12)")
    
    if title.endswith('?'):
        errors.append("Title is a question")
    
    if '!' in title:
        errors.append("Title has exclamation mark")
    
    # Validate summary
    summary_words = len(summary.split())
    if summary_words < 35:
        errors.append(f"Summary too short: {summary_words} words (min 35)")
    elif summary_words > 42:
        errors.append(f"Summary too long: {summary_words} words (max 42)")
    
    # Check title repetition
    title_words_list = title.lower().split()
    summary_lower = summary.lower()
    for i in range(len(title_words_list) - 4):
        phrase = ' '.join(title_words_list[i:i+5])
        if phrase in summary_lower:
            errors.append(f"Summary repeats title: '{phrase}'")
            break
    
    is_valid = len(errors) == 0
    return is_valid, errors


# Example usage and testing
if __name__ == "__main__":
    # Test article
    article = {
        "title": "ECB Raises Rates",
        "description": "The European Central Bank announced today that it is raising interest rates by 0.25 percentage points to 4.5%, marking the tenth consecutive increase since July 2023. The decision comes as inflation remains at 5.3%, well above the bank's 2% target. ECB President Christine Lagarde stated that the move is necessary to bring inflation under control, despite concerns about economic growth slowing across the eurozone."
    }
    
    try:
        result = claude_write_title_summary(article)
        
        print("Generated Title:", result['title'])
        print("Generated Summary:", result['summary'])
        
        # Validate the result
        is_valid, errors = validate_title_summary(result)
        if is_valid:
            print("✅ Validation passed!")
        else:
            print("❌ Validation failed:")
            for error in errors:
                print(f"  - {error}")
                
    except Exception as e:
        print(f"Error: {e}")
