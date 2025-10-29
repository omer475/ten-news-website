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
  "summary": "Your detailed article text (maximum 200 words)",
  "summary_bullets": [
    "First bullet point (8-15 words)",
    "Second bullet point (8-15 words)",
    "Third bullet point (8-15 words)"
  ]
}

TITLE RULES:
- Maximum 12 words
- Must be declarative statement (NEVER a question)
- Must include geographic/entity context (country, region, or organization name)
- Must convey complete main point of the article
- Use active voice
- Use sentence case (capitalize only first word and proper nouns)
- PROHIBITED: Questions, clickbait phrases, exclamation marks, ALL CAPS, editorial opinions, vague geographic references
- **BOLD MARKUP**: Use **bold** for 2-4 key words, names, places, numbers, or important entities
  - Highlight: important names, locations, numbers, key concepts, organizations
  - Use 2-4 bold items per title (not too few, not too many)
  - Example: "**European Central Bank** raises interest rates to **4.5 percent**"

Geographic specificity - Always specify location/entity:
❌ "Government announces policy" ✓ "Canadian government announces climate policy"
❌ "Central bank raises rates" ✓ "European Central Bank raises rates to 4.5 percent"

Title examples:
✓ "**European Central Bank** raises interest rates to **4.5 percent**"
✓ "**Indian Parliament** approves controversial citizenship amendment bill"
✓ "Australian wildfires force evacuation of **50,000** residents"

SUMMARY RULES:
- Maximum 200 words (MANDATORY - do not exceed)
- Write detailed, comprehensive news article
- No minimum word count - focus on quality and completeness
- Must add NEW information beyond the title
- NEVER repeat exact wording from title
- Must include geographic/entity specificity
- Use multiple paragraphs for better readability
- Include background context, current developments, and implications
- Cover WHO, WHAT, WHEN, WHERE, WHY, and HOW
- Use past tense for completed events, present tense for ongoing situations
- Use active voice
- Write for an educated audience seeking in-depth information

SUMMARY EXAMPLES (150-200 words each):
✓ "The European Central Bank announced a quarter-point interest rate increase to 4.5 percent on Thursday, marking the tenth consecutive rate hike since July 2023. The decision comes as inflation remains stubbornly high at 5.3 percent, well above the ECB's 2 percent target. The rate increase affects 340 million people across 19 eurozone countries and is expected to raise borrowing costs for mortgages, business loans, and consumer credit. ECB President Christine Lagarde stated that the bank remains committed to bringing inflation back to target levels, despite concerns about economic growth. The move follows similar actions by other central banks globally, including the Federal Reserve and Bank of England. Analysts predict this could be the final rate increase in the current cycle, as economic indicators suggest slowing growth across the eurozone. The decision was made unanimously by the ECB's Governing Council, reflecting broad consensus on the need for continued monetary tightening." (150 words)

✓ "A powerful magnitude 7.8 earthquake struck southeastern Turkey near the Syrian border early Monday morning, causing widespread destruction across both countries. The quake's epicenter was located near the city of Gaziantep, Turkey, at a depth of approximately 17.9 kilometers. Initial reports indicate significant damage to buildings and infrastructure, with rescue operations underway in multiple cities including Kahramanmaras, Malatya, and Diyarbakir. The earthquake was felt as far away as Cyprus, Lebanon, and Israel. Turkish authorities have declared a state of emergency in affected regions and requested international assistance. The disaster comes at a particularly vulnerable time, with harsh winter conditions complicating rescue efforts. Hospitals in the region are reportedly overwhelmed, and power outages have affected millions of residents. This is the strongest earthquake to hit Turkey since the devastating 1999 Izmit earthquake that killed over 17,000 people." (150 words)

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

SUMMARY BULLETS RULES:
- EXACTLY 3-5 bullets (minimum 3, maximum 5)
- Each bullet: 8-15 words
- MAXIMUM 40 words total across ALL bullets combined
- Each bullet is complete, standalone thought
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice
- **BOLD MARKUP**: Use **bold** for 3-6 key words, names, places, numbers in EACH bullet
  - Highlight: important names, locations, numbers, key concepts, organizations
  - Use 1-2 bold items per bullet (not too many)
  - Example: "**ECB** raises interest rates to **4.5%**, tenth consecutive increase since **July 2023**"
- Must tell COMPLETE story independently

Bullet Structure:
1. First bullet: Full main event with key details (WHO + WHAT + KEY NUMBER)
2. Second bullet: Context or background (WHY, historical comparison)
3. Third bullet: Impact/consequences (WHO affected, HOW MANY)
4. Fourth bullet (optional): Additional key detail
5. Fifth bullet (optional): Final important detail

Bullet Examples:
✓ "**European Central Bank** raises interest rates to **4.5 percent**, tenth consecutive hike"
✓ "Inflation remains at **5.3 percent**, well above **ECB's** **2 percent** target"
✓ "**340 million** eurozone residents face **higher borrowing costs** for mortgages"

GENERATION PROCESS:
1. Read the original article carefully
2. Identify the main news event and geographic location/entity
3. Generate title (≤12 words) with complete main point
4. Generate detailed article (maximum 200 words) adding comprehensive information NOT in title
5. Generate 3-5 bullet points (8-15 words each, max 40 words total)
6. Verify no exact title wording repeated in summary
7. Check word counts and geographic specificity

VALIDATION BEFORE OUTPUT:
Title: ≤12 words, statement not question, includes country/region/entity, active voice, sentence case
Summary: Maximum 200 words, detailed comprehensive coverage, journalistic style, no exact title repetition, geographic specificity, specific numbers included, correct tense, active voice
Bullets: 3-5 bullets, 8-15 words each, max 40 words total, complete standalone thoughts, no periods

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
    
    if 'title' not in response or 'summary' not in response or 'summary_bullets' not in response:
        errors.append("Missing title, summary, or summary_bullets")
        return False, errors
    
    title = response['title']
    summary = response['summary']
    summary_bullets = response.get('summary_bullets', [])
    
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
    if summary_words > 200:
        errors.append(f"Summary too long: {summary_words} words (max 200)")
    elif summary_words < 50:
        errors.append(f"Summary too short: {summary_words} words (should be detailed and comprehensive)")
    
    # Check title repetition
    title_words_list = title.lower().split()
    summary_lower = summary.lower()
    for i in range(len(title_words_list) - 4):
        phrase = ' '.join(title_words_list[i:i+5])
        if phrase in summary_lower:
            errors.append(f"Summary repeats title: '{phrase}'")
            break
    
    # Validate bullets
    if not isinstance(summary_bullets, list):
        errors.append("Summary bullets must be a list")
    elif len(summary_bullets) < 3:
        errors.append(f"Too few bullets: {len(summary_bullets)} (min 3)")
    elif len(summary_bullets) > 5:
        errors.append(f"Too many bullets: {len(summary_bullets)} (max 5)")
    else:
        total_bullet_words = 0
        for i, bullet in enumerate(summary_bullets):
            bullet_words = len(bullet.split())
            total_bullet_words += bullet_words
            if bullet_words < 8:
                errors.append(f"Bullet {i+1} too short: {bullet_words} words (min 8)")
            elif bullet_words > 15:
                errors.append(f"Bullet {i+1} too long: {bullet_words} words (max 15)")
        
        if total_bullet_words > 40:
            errors.append(f"Total bullet words too many: {total_bullet_words} (max 40)")
    
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
