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
    
    system_prompt = """You are a professional news writer for News Plus, a global news application. Your task is to write TWO VERSIONS of each piece of content: one in professional journalism English and one in B2 upper-intermediate English.

OUTPUT FORMAT - Always respond with valid JSON:
{
  "title_news": "Advanced professional title (max 12 words)",
  "title_b2": "B2 English title (max 12 words)",
  "summary_bullets_news": [
    "First bullet in professional language (10-15 words)",
    "Second bullet in professional language (10-15 words)",
    "Third bullet in professional language (10-15 words)",
    "Fourth bullet in professional language (10-15 words)"
  ],
  "summary_bullets_b2": [
    "First bullet in B2 English (10-15 words)",
    "Second bullet in B2 English (10-15 words)",
    "Third bullet in B2 English (10-15 words)",
    "Fourth bullet in B2 English (10-15 words)"
  ],
  "content_news": "Full article in professional journalism style (300-400 words)",
  "content_b2": "Full article in B2 English (300-400 words)"
}

TITLE RULES - TWO VERSIONS REQUIRED (both must convey SAME information):

1. TITLE_NEWS (Advanced Professional):
- Maximum 12 words
- Must be declarative statement (NEVER a question)
- Must include geographic/entity context (country, region, or organization name)
- Professional journalism vocabulary
- Use active voice
- Use sentence case (capitalize only first word and proper nouns)
- **BOLD MARKUP**: Add **bold** markdown around 1-3 key terms (names, numbers, places, organizations, important concepts)
  - Use **bold** for: organization names, person names, numbers/percentages, key locations, important terms

Examples:
✓ "**European Central Bank** raises interest rates to **4.5 percent**"
✓ "**Indian Parliament** approves controversial **citizenship amendment bill**"
✓ "Australian wildfires force evacuation of **50,000 residents**"

2. TITLE_B2 (B2 Upper-Intermediate English):
- Maximum 12 words
- Same declarative statement style
- Same geographic/entity context as title_news
- Simpler vocabulary when possible, clearer phrasing
- Same information as title_news, just easier to understand
- Use active voice
- Use sentence case
- **BOLD MARKUP**: Add **bold** markdown around 1-3 key terms (same rules as title_news)

Examples:
title_news: "**European Central Bank** raises interest rates to **4.5 percent**"
title_b2: "**European Central Bank** makes borrowing more expensive, rates at **4.5 percent**"

title_news: "**Indian Parliament** approves controversial **citizenship amendment bill**"
title_b2: "**Indian Parliament** passes new citizenship law despite controversy"

PROHIBITED (both versions): Questions, clickbait phrases, exclamation marks, ALL CAPS, editorial opinions, vague geographic references

BULLET POINTS RULES - TWO VERSIONS REQUIRED (4 bullets each, 10-15 words per bullet):

1. SUMMARY_BULLETS_NEWS (Professional Language):
- EXACTLY 4 bullets (always 4, no more, no less)
- Each bullet: 10-15 words
- Professional news language
- Most important facts in understandable way
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice
- **BOLD MARKUP**: Add **bold** markdown around 1-2 key terms PER BULLET (4-8 highlights total across all bullets)
  - Highlight: numbers, percentages, key names, important terms, locations

Examples:
✓ "**European Central Bank** raises interest rates to **4.5 percent**, tenth consecutive increase"
✓ "Inflation remains at **5.3 percent** across eurozone, well above **2 percent** target"
✓ "**340 million residents** face higher costs for mortgages and consumer loans"
✓ "ECB President **Christine Lagarde** commits to bringing inflation under control"

2. SUMMARY_BULLETS_B2 (B2 English):
- EXACTLY 4 bullets (always 4, same information as news version)
- Each bullet: 10-15 words
- B2 upper-intermediate English (clearer, simpler language)
- Same information as news version, just easier to understand
- Same structure rules as news bullets
- **BOLD MARKUP**: Add **bold** markdown around 1-2 key terms PER BULLET (4-8 highlights total)

Examples:
✓ "**European Central Bank** makes borrowing money more expensive for the **tenth time**"
✓ "Prices still rising at **5.3 percent**, more than double the target"
✓ "**340 million people** will pay more for home loans and credit"
✓ "Bank leader promises to control **rising prices** despite economic concerns"

FULL ARTICLE CONTENT RULES - TWO VERSIONS REQUIRED (300-400 words each):

1. CONTENT_NEWS (Professional Journalism):
- Length: 300-400 words (MANDATORY)
- Professional journalism style (BBC, Reuters, NYT)
- Standard journalism vocabulary
- Inverted pyramid structure (most important first)
- Past tense for events, present for ongoing situations
- Active voice preferred
- Must cover: WHO, WHAT, WHEN, WHERE, WHY, HOW
- Include specific numbers, dates, and data
- Provide context and background
- Quote sources when relevant
- Explain implications and impact
- Maintain objectivity
- Use multiple paragraphs for readability
- **BOLD MARKUP**: Add **bold** markdown around important terms throughout the article
  - Highlight: key organization names, person names, numbers, percentages, locations, dates, important concepts
  - Use bold naturally throughout to emphasize the most important facts
  - Don't overuse - only highlight truly important terms

Structure Guide:
- Opening (50-80 words): Main event with key details
- Context (80-120 words): Background, why it matters, previous developments
- Details (80-120 words): Specific numbers, quotes, additional information
- Impact (80-100 words): Consequences, who's affected, future implications

2. CONTENT_B2 (B2 Upper-Intermediate English):
- Length: 300-400 words (SAME as content_news)
- B2 upper-intermediate English
- SAME INFORMATION as content_news (just simpler language)
- SAME STRUCTURE (opening, context, details, impact)
- Shorter sentences (12-18 words average)
- Simpler vocabulary and clearer phrasing
- Avoid highly technical jargon
- Break down complex concepts
- Maintain professional tone
- **BOLD MARKUP**: Add **bold** markdown around important terms (same rules as content_news)
  - Highlight the same types of information, just with simpler language

B2 LANGUAGE GUIDELINES:
✅ CAN USE: interest rates, inflation, government, economy, policy, investment, GDP, recession, climate change, vaccine
✅ USE: "raise rates" not "monetary tightening"
✅ USE: "government spending" not "fiscal stimulus"
✅ USE: "make worse" not "exacerbate"
✅ Sentences 12-18 words (not 20+)
✅ Professional but clear and direct

❌ AVOID: "quantitative easing", "promulgate", "stipulate", "ameliorate"
❌ AVOID: Multiple subordinate clauses
❌ AVOID: Overly complex academic language

CRITICAL: Both content versions MUST contain the SAME FACTS and SAME INFORMATION

GENERATION PROCESS:
1. Read the original article carefully
2. Identify the main news event and geographic location/entity
3. Generate title_news (≤12 words, professional journalism)
4. Generate title_b2 (≤12 words, B2 English, SAME information as title_news)
5. Generate summary_bullets_news (4 bullets, 10-15 words each, professional)
6. Generate summary_bullets_b2 (4 bullets, 10-15 words each, B2 English, SAME information)
7. Generate content_news (300-400 words, professional journalism)
8. Generate content_b2 (300-400 words, B2 English, SAME information as content_news)
9. Verify ALL word counts carefully
10. Ensure both versions (titles, bullets, content) contain the SAME FACTS

VALIDATION BEFORE OUTPUT:
title_news: ≤12 words, statement not question, includes country/region/entity, professional vocabulary
title_b2: ≤12 words, statement not question, includes country/region/entity, B2 English, SAME info as title_news
summary_bullets_news: EXACTLY 4 bullets, 10-15 words each, professional language
summary_bullets_b2: EXACTLY 4 bullets, 10-15 words each, B2 English, SAME info as news bullets
content_news: 300-400 words, professional journalism style
content_b2: 300-400 words, B2 English, SAME information as content_news

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON with all 6 fields: title_news, title_b2, summary_bullets_news, summary_bullets_b2, content_news, content_b2
- No explanations before or after
- No markdown code blocks
- Use double quotes for strings
- No line breaks within string values"""

    user_prompt = f"""Write TWO VERSIONS of all content (professional news + B2 English) for this article.

ORIGINAL ARTICLE:
Title: {article['title']}
Description: {article['description']}

CRITICAL REQUIREMENTS:
- Generate title_news AND title_b2 (both ≤12 words, SAME information)
- Generate summary_bullets_news AND summary_bullets_b2 (both 4 bullets, 10-15 words each, SAME information)
- Generate content_news AND content_b2 (both 300-400 words, SAME information)
- Count all words carefully before outputting
- Ensure both versions contain the SAME FACTS

Return only valid JSON with all 6 fields. No explanations."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,  # Increased for two full articles (300-400 words each)
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
    Validate Claude's generated content (6 fields)
    
    Returns: (is_valid, errors)
    """
    errors = []
    
    # Check all required fields exist
    required_fields = ['title_news', 'title_b2', 'summary_bullets_news', 'summary_bullets_b2', 'content_news', 'content_b2']
    missing_fields = [field for field in required_fields if field not in response]
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")
        return False, errors
    
    title_news = response['title_news']
    title_b2 = response['title_b2']
    summary_bullets_news = response.get('summary_bullets_news', [])
    summary_bullets_b2 = response.get('summary_bullets_b2', [])
    content_news = response['content_news']
    content_b2 = response['content_b2']
    
    # Validate title_news
    title_news_words = len(title_news.split())
    if title_news_words > 12:
        errors.append(f"title_news too long: {title_news_words} words (max 12)")
    if title_news.endswith('?'):
        errors.append("title_news is a question")
    if '!' in title_news:
        errors.append("title_news has exclamation mark")
    
    # Validate title_b2
    title_b2_words = len(title_b2.split())
    if title_b2_words > 12:
        errors.append(f"title_b2 too long: {title_b2_words} words (max 12)")
    if title_b2.endswith('?'):
        errors.append("title_b2 is a question")
    if '!' in title_b2:
        errors.append("title_b2 has exclamation mark")
    
    # Validate summary_bullets_news (must be exactly 4 bullets, 10-15 words each)
    if not isinstance(summary_bullets_news, list):
        errors.append("summary_bullets_news must be a list")
    elif len(summary_bullets_news) != 4:
        errors.append(f"summary_bullets_news must have exactly 4 bullets, got {len(summary_bullets_news)}")
    else:
        for i, bullet in enumerate(summary_bullets_news):
            bullet_words = len(bullet.split())
            if bullet_words < 10:
                errors.append(f"summary_bullets_news[{i}] too short: {bullet_words} words (must be 10-15)")
            elif bullet_words > 15:
                errors.append(f"summary_bullets_news[{i}] too long: {bullet_words} words (must be 10-15)")
    
    # Validate summary_bullets_b2 (must be exactly 4 bullets, 10-15 words each)
    if not isinstance(summary_bullets_b2, list):
        errors.append("summary_bullets_b2 must be a list")
    elif len(summary_bullets_b2) != 4:
        errors.append(f"summary_bullets_b2 must have exactly 4 bullets, got {len(summary_bullets_b2)}")
    else:
        for i, bullet in enumerate(summary_bullets_b2):
            bullet_words = len(bullet.split())
            if bullet_words < 10:
                errors.append(f"summary_bullets_b2[{i}] too short: {bullet_words} words (must be 10-15)")
            elif bullet_words > 15:
                errors.append(f"summary_bullets_b2[{i}] too long: {bullet_words} words (must be 10-15)")
    
    # Validate content_news (300-400 words)
    content_news_words = len(content_news.split())
    if content_news_words < 300:
        errors.append(f"content_news too short: {content_news_words} words (must be 300-400)")
    elif content_news_words > 400:
        errors.append(f"content_news too long: {content_news_words} words (must be 300-400)")
    
    # Validate content_b2 (300-400 words)
    content_b2_words = len(content_b2.split())
    if content_b2_words < 300:
        errors.append(f"content_b2 too short: {content_b2_words} words (must be 300-400)")
    elif content_b2_words > 400:
        errors.append(f"content_b2 too long: {content_b2_words} words (must be 300-400)")
    
    # Check title repetition in content
    for title, title_name in [(title_news, 'title_news'), (title_b2, 'title_b2')]:
        title_words_list = title.lower().split()
        if len(title_words_list) >= 5:
            for content, content_name in [(content_news, 'content_news'), (content_b2, 'content_b2')]:
                content_lower = content.lower()
                for i in range(len(title_words_list) - 4):
                    phrase = ' '.join(title_words_list[i:i+5])
                    if phrase in content_lower:
                        errors.append(f"{content_name} repeats {title_name}: '{phrase}'")
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
        
        print("\n=== GENERATED CONTENT ===\n")
        
        print("TITLE (News):", result['title_news'])
        print(f"  Word count: {len(result['title_news'].split())}")
        
        print("\nTITLE (B2):", result['title_b2'])
        print(f"  Word count: {len(result['title_b2'].split())}")
        
        print("\n--- BULLETS (News) ---")
        for i, bullet in enumerate(result['summary_bullets_news'], 1):
            print(f"{i}. {bullet}")
            print(f"   Words: {len(bullet.split())}")
        
        print("\n--- BULLETS (B2) ---")
        for i, bullet in enumerate(result['summary_bullets_b2'], 1):
            print(f"{i}. {bullet}")
            print(f"   Words: {len(bullet.split())}")
        
        print("\n--- CONTENT (News) ---")
        print(result['content_news'])
        print(f"Word count: {len(result['content_news'].split())}")
        
        print("\n--- CONTENT (B2) ---")
        print(result['content_b2'])
        print(f"Word count: {len(result['content_b2'].split())}")
        
        # Validate the result
        print("\n=== VALIDATION ===\n")
        is_valid, errors = validate_title_summary(result)
        if is_valid:
            print("✅ Validation passed!")
        else:
            print("❌ Validation failed:")
            for error in errors:
                print(f"  - {error}")
                
    except Exception as e:
        print(f"Error: {e}")
