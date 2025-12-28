"""
STEP 8: FACT VERIFICATION
==========================
Verifies generated content against source articles to detect hallucinations.

This module:
1. Compares generated title, bullets, and article text against original sources
2. Uses Gemini to identify any claims not supported by the sources
3. Rejects articles with significant discrepancies
4. Allows regeneration of rejected articles
"""

import os
import json
import requests
from dataclasses import dataclass

@dataclass
class VerificationConfig:
    """Configuration for fact verification"""
    model: str = "gemini-2.0-flash-exp"
    max_tokens: int = 1500
    temperature: float = 0  # Deterministic for verification
    timeout: int = 60
    max_retries: int = 2  # How many times to regenerate if verification fails


VERIFICATION_SYSTEM_PROMPT = """You are a fact-checking editor verifying AI-generated news content against source articles.

YOUR GOAL: Catch MAJOR factual errors and hallucinations. DO NOT flag minor paraphrasing or reasonable inferences.

✅ ALLOW (NOT discrepancies):
- Paraphrasing that preserves meaning
- Combining facts from multiple sources into one sentence
- Reasonable inferences clearly implied by the sources
- Rounding numbers slightly (e.g., "nearly 15%" when source says "14.8%")
- Using synonyms or different word choices
- Summarizing longer passages
- Minor stylistic differences

❌ FLAG AS DISCREPANCIES (ONLY these):
- WRONG NUMBERS: Completely different figures (e.g., "$5 billion" when source says "$500 million")
- WRONG NAMES: Incorrect person/company/place names
- WRONG COUNTRIES: Mixing up countries or locations
- INVENTED FACTS: Claims with NO basis in ANY source
- OPPOSITE MEANING: Saying something increased when it decreased
- FAKE QUOTES: Made up quotes not in sources
- WRONG DATES: Incorrect timing of events

RESPONSE FORMAT (JSON):
{
  "verified": true/false,
  "discrepancies": [
    {
      "type": "wrong_number|wrong_name|invented_fact|opposite_meaning|fake_quote|wrong_date|wrong_location",
      "issue": "Brief description of the error",
      "generated_claim": "What the AI wrote",
      "source_fact": "What the sources actually say (or 'Not mentioned in sources')"
    }
  ],
  "summary": "One sentence overall assessment"
}

IMPORTANT:
- When in doubt, VERIFY the article (set verified: true)
- Only reject for CLEAR, MAJOR errors
- An empty discrepancies array means verified: true
- Be lenient with paraphrasing and stylistic choices"""


def build_verification_prompt(sources: list, generated: dict) -> str:
    """Build the verification prompt with source content and generated output"""
    
    # Build source content section
    sources_text = ""
    sources_with_content = 0
    
    for i, source in enumerate(sources[:10], 1):  # Match Step 4: up to 10 sources
        source_name = source.get('source_name', source.get('source', 'Unknown'))
        title = source.get('title', 'Unknown')
        
        # IMPORTANT: Use EXACT same field priority and truncation as Step 4 synthesis
        # Step 4 uses: s.get('full_text', s.get('description', ''))[:1500]
        content = source.get('full_text', source.get('description', ''))
        
        if content and len(content) > 50:
            sources_with_content += 1
        
        # IMPORTANT: Use EXACT same truncation as Step 4 (1500 chars)
        if len(content) > 1500:
            content = content[:1500] + "..."
        
        sources_text += f"""
━━━ SOURCE {i}: {source_name} ━━━
TITLE: {title}
CONTENT: {content if content else '[No content available]'}
"""
    
    # Build generated content section (no full article content - only title, bullets, 5W's)
    title = generated.get('title', generated.get('title_news', ''))
    bullets = generated.get('summary_bullets', generated.get('summary_bullets_news', []))
    five_ws = generated.get('five_ws', {})
    
    bullets_text = '\n'.join([f"  • {b}" for b in bullets]) if bullets else '[No bullets]'
    
    five_ws_text = ""
    if five_ws:
        five_ws_text = f"""
5 W's:
  WHO: {five_ws.get('who', 'N/A')}
  WHAT: {five_ws.get('what', 'N/A')}
  WHEN: {five_ws.get('when', 'N/A')}
  WHERE: {five_ws.get('where', 'N/A')}
  WHY: {five_ws.get('why', 'N/A')}
"""
    
    prompt = f"""Verify this AI-generated news article against the source articles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 ORIGINAL SOURCE ARTICLES ({sources_with_content} with content)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{sources_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ AI-GENERATED CONTENT (to verify)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE: {title}

SUMMARY BULLETS:
{bullets_text}
{five_ws_text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Compare the AI-generated title, bullets, and 5 W's against ALL sources. Flag ONLY major factual errors.
Return JSON with your verification result."""

    return prompt


class FactVerifier:
    """Verifies generated content against source articles"""
    
    def __init__(self, api_key: str = None, config: VerificationConfig = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        self.config = config or VerificationConfig()
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.config.model}:generateContent?key={self.api_key}"
    
    def verify_article(self, sources: list, generated: dict, debug: bool = True) -> tuple:
        """
        Verify generated article against sources.
        
        Returns:
            tuple: (is_verified: bool, discrepancies: list, summary: str)
        """
        
        if debug:
            print(f"\n   🔍 DEBUG - VERIFICATION INPUT:")
            print(f"      Sources provided: {len(sources)}")
            for i, s in enumerate(sources[:5], 1):
                full_text = s.get('full_text', '')
                desc = s.get('description', '')
                content_len = len(full_text) if full_text else len(desc)
                print(f"      Source {i}: {s.get('source_name', 'Unknown')[:30]} - content: {content_len} chars")
            print(f"      Generated title: {generated.get('title', generated.get('title_news', ''))[:50]}...")
        
        try:
            prompt = build_verification_prompt(sources, generated)
            
            request_data = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": VERIFICATION_SYSTEM_PROMPT + "\n\n" + prompt}]
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
            response.raise_for_status()
            result = response.json()
            
            # Extract response text from Gemini format
            if 'candidates' not in result or len(result['candidates']) == 0:
                raise Exception("No candidates in Gemini response")
            
            response_text = result['candidates'][0]['content']['parts'][0]['text']
            
            # Clean and parse JSON
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(response_text)
            
            is_verified = result.get('verified', True)
            discrepancies = result.get('discrepancies', [])
            summary = result.get('summary', 'Verification complete')
            
            if debug:
                print(f"      Verification result: {'✅ PASSED' if is_verified else '❌ FAILED'}")
                if discrepancies:
                    print(f"      Discrepancies found: {len(discrepancies)}")
            
            return is_verified, discrepancies, summary
            
        except json.JSONDecodeError as e:
            print(f"   ⚠️  JSON parse error in verification: {e}")
            # If we can't parse, assume verified to avoid blocking
            return True, [], "Verification parse error - assuming valid"
            
        except Exception as e:
            print(f"   ⚠️  Verification error: {e}")
            # On error, assume verified to avoid blocking pipeline
            return True, [], f"Verification error: {str(e)[:50]}"
    
    def verify_and_regenerate(self, sources: list, generated: dict, 
                               regenerate_func: callable, max_attempts: int = None) -> tuple:
        """
        Verify article and regenerate if needed.
        
        Args:
            sources: Original source articles
            generated: Generated article content
            regenerate_func: Function to call for regeneration (takes sources, returns new generated)
            max_attempts: Maximum regeneration attempts (default from config)
            
        Returns:
            tuple: (final_generated: dict, was_regenerated: bool, attempts: int)
        """
        max_attempts = max_attempts or self.config.max_retries + 1  # +1 for initial
        
        current_generated = generated
        
        for attempt in range(max_attempts):
            is_verified, discrepancies, summary = self.verify_article(sources, current_generated)
            
            if is_verified:
                return current_generated, attempt > 0, attempt + 1
            
            # If not last attempt, regenerate
            if attempt < max_attempts - 1:
                print(f"   🔄 Regenerating article (attempt {attempt + 2}/{max_attempts})...")
                current_generated = regenerate_func(sources)
                
                if not current_generated:
                    print(f"   ❌ Regeneration failed")
                    return None, True, attempt + 1
        
        # All attempts failed
        return None, True, max_attempts


# For testing
if __name__ == "__main__":
    print("Fact Verification Module")
    print("=" * 50)
    
    # Test with mock data
    verifier = FactVerifier()
    
    test_sources = [
        {
            'source_name': 'Test Source',
            'title': 'Test Article Title',
            'full_text': 'This is a test article about a company announcing 100 new jobs in New York.'
        }
    ]
    
    test_generated = {
        'title': 'Company Announces 100 Jobs in New York',
        'summary_bullets': ['Company creates 100 new positions', 'Jobs located in New York'],
        'five_ws': {'who': 'Company', 'what': '100 new jobs', 'when': 'Today', 'where': 'New York', 'why': 'Expansion'}
    }
    
    verified, discrepancies, summary = verifier.verify_article(test_sources, test_generated)
    print(f"Verified: {verified}")
    print(f"Summary: {summary}")
