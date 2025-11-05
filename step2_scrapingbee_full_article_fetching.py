# STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING
# ==========================================
# Purpose: Fetch complete article text for approved articles from Step 1
# Service: ScrapingBee API (bypasses anti-bot, JavaScript rendering, paywalls)
# Input: ~100 approved articles with URLs from Step 1
# Output: ~100 full articles with extracted text
# Cost: ~$0.05 per 100 articles
# Time: ~1-2 minutes (sequential) or ~30 seconds (parallel)
# Success Rate: ~99%

import requests
import time
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

# For HTML parsing
try:
    from bs4 import BeautifulSoup
    import trafilatura
except ImportError:
    print("⚠ Installing required packages...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'beautifulsoup4', 'trafilatura', 'lxml'])
    from bs4 import BeautifulSoup
    import trafilatura


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class FetcherConfig:
    """Configuration for ScrapingBee fetcher"""
    base_url: str = "https://app.scrapingbee.com/api/v1/"
    render_js: bool = False  # False = 1 credit, True = 10 credits
    premium_proxy: bool = False  # False = 1 credit, True = 25 credits
    block_resources: bool = True  # Block images/CSS for speed
    timeout: int = 30  # seconds
    max_retries: int = 3
    retry_delay: float = 2.0
    max_text_length: int = 15000  # Max chars for Claude (15k chars ≈ 3750 tokens)
    min_content_length: int = 200  # Minimum viable article length
    parallel_workers: int = 5  # Number of parallel fetch workers
    delay_between_requests: float = 0.1  # Delay between sequential requests


# ==========================================
# SCRAPINGBEE ARTICLE FETCHER CLASS
# ==========================================

class ScrapingBeeArticleFetcher:
    """
    Fetches full article content using ScrapingBee API
    Handles anti-bot protection, JavaScript rendering, and content extraction
    """
    
    def __init__(self, api_key: str, config: Optional[FetcherConfig] = None):
        """
        Initialize fetcher with API key and optional config
        
        Args:
            api_key: ScrapingBee API key (get from scrapingbee.com)
            config: FetcherConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or FetcherConfig()
        
        print(f"✓ Initialized ScrapingBee fetcher")
        print(f"  Render JS: {self.config.render_js} (costs {'10x' if self.config.render_js else '1x'} credits)")
        print(f"  Premium proxy: {self.config.premium_proxy}")
        print(f"  Parallel workers: {self.config.parallel_workers}")
    
    def validate_url(self, url: str) -> bool:
        """
        Validate URL format
        
        Args:
            url: URL to validate
        
        Returns:
            True if valid, False otherwise
        """
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def fetch_article(self, url: str, article_metadata: Optional[Dict] = None) -> Optional[Dict]:
        """
        Fetch single article with retry logic
        
        Args:
            url: Article URL to fetch
            article_metadata: Optional dict with title, source, score from Step 1
        
        Returns:
            Dict with article data or None if failed
        """
        if not self.validate_url(url):
            print(f"✗ Invalid URL: {url}")
            return None
        
        # Try fetching with retries
        for attempt in range(self.config.max_retries):
            try:
                # Build request parameters
                params = {
                    'api_key': self.api_key,
                    'url': url,
                    'render_js': str(self.config.render_js).lower(),
                    'premium_proxy': str(self.config.premium_proxy).lower(),
                    'block_resources': str(self.config.block_resources).lower(),
                    'timeout': str(self.config.timeout * 1000)  # Convert to milliseconds
                }
                
                # Make request to ScrapingBee
                response = requests.get(
                    self.config.base_url,
                    params=params,
                    timeout=self.config.timeout + 5  # Add buffer to timeout
                )
                
                # Handle different status codes
                if response.status_code == 200:
                    html_content = response.text
                    
                    # Extract article content
                    article_data = self._extract_article_content(html_content, url)
                    
                    if article_data and len(article_data['text']) >= self.config.min_content_length:
                        # Add metadata from Step 1 if provided
                        if article_metadata:
                            article_data['original_title'] = article_metadata.get('title', '')
                            article_data['source'] = article_metadata.get('source', '')
                            article_data['score'] = article_metadata.get('score', 0)
                            article_data['category'] = article_metadata.get('category', 'Other')
                        
                        return article_data
                    else:
                        print(f"✗ Insufficient content: {url}")
                        return None
                
                elif response.status_code == 401:
                    print(f"✗ Authentication error: Invalid API key")
                    return None
                
                elif response.status_code == 403:
                    print(f"✗ Forbidden: {url}")
                    return None
                
                elif response.status_code == 404:
                    print(f"✗ Not found: {url}")
                    return None
                
                elif response.status_code == 429:
                    # Rate limited - retry with exponential backoff
                    wait_time = (2 ** attempt) * self.config.retry_delay
                    print(f"⚠ Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                elif response.status_code == 500:
                    print(f"✗ ScrapingBee server error: {url}")
                    if attempt < self.config.max_retries - 1:
                        time.sleep(self.config.retry_delay)
                        continue
                    return None
                
                else:
                    print(f"✗ Unexpected status {response.status_code}: {url}")
                    return None
                
            except requests.Timeout:
                print(f"⚠ Timeout: {url} (attempt {attempt + 1}/{self.config.max_retries})")
                if attempt < self.config.max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
            
            except requests.RequestException as e:
                print(f"✗ Request error: {url}: {e}")
                if attempt < self.config.max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
        
        return None
    
    def _extract_article_content(self, html: str, url: str) -> Optional[Dict]:
        """
        Extract clean article content from HTML
        Uses trafilatura for best extraction, BeautifulSoup as fallback
        
        Args:
            html: Raw HTML content
            url: Article URL
        
        Returns:
            Dict with extracted article data or None
        """
        try:
            # Method 1: Try trafilatura (best for news articles)
            text = trafilatura.extract(
                html,
                include_comments=False,
                include_tables=True,
                no_fallback=False
            )
            
            # Method 2: Fallback to BeautifulSoup if trafilatura fails
            if not text or len(text) < self.config.min_content_length:
                text = self._extract_with_beautifulsoup(html)
            
            if not text or len(text) < self.config.min_content_length:
                return None
            
            # Extract metadata
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract title
            title = ""
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text().strip()
            
            if not title:
                h1_tag = soup.find('h1')
                if h1_tag:
                    title = h1_tag.get_text().strip()
            
            # Extract publish time
            published_time = ""
            time_tag = soup.find('time')
            if time_tag and time_tag.get('datetime'):
                published_time = time_tag['datetime']
            
            # Extract image using Open Graph/Twitter meta as reliable fallback
            image_url = ""
            try:
                og_image = soup.find('meta', attrs={'property': 'og:image'})
                if og_image and og_image.get('content'):
                    image_url = og_image.get('content').strip()
                if not image_url:
                    tw_image = soup.find('meta', attrs={'name': 'twitter:image'})
                    if tw_image and tw_image.get('content'):
                        image_url = tw_image.get('content').strip()
                # Some sites use og:image:secure_url
                if not image_url:
                    og_image_secure = soup.find('meta', attrs={'property': 'og:image:secure_url'})
                    if og_image_secure and og_image_secure.get('content'):
                        image_url = og_image_secure.get('content').strip()
            except Exception:
                # Best-effort image extraction; ignore parsing errors
                pass

            # Truncate if too long for Claude
            if len(text) > self.config.max_text_length:
                text = text[:self.config.max_text_length] + "\n\n[Content truncated for processing...]"
            
            return {
                'url': url,
                'title': title,
                'text': text,
                'published_time': published_time,
                'text_length': len(text),
                'image_url': image_url
            }
        
        except Exception as e:
            print(f"✗ Extraction error: {e}")
            return None
    
    def _extract_with_beautifulsoup(self, html: str) -> str:
        """
        Fallback extraction method using BeautifulSoup
        
        Args:
            html: Raw HTML content
        
        Returns:
            Extracted text
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'aside', 'header']):
                element.decompose()
            
            # Try to find article content
            article = soup.find('article')
            if article:
                text = article.get_text(separator='\n', strip=True)
            else:
                # Fallback to main or body
                main = soup.find('main') or soup.find('body')
                if main:
                    text = main.get_text(separator='\n', strip=True)
                else:
                    text = soup.get_text(separator='\n', strip=True)
            
            # Clean up whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            text = '\n'.join(lines)
            
            return text
        
        except Exception as e:
            print(f"✗ BeautifulSoup extraction error: {e}")
            return ""
    
    def fetch_batch_sequential(self, articles: List[Dict]) -> List[Dict]:
        """
        Fetch articles sequentially (slower but more reliable)
        
        Args:
            articles: List of article dicts from Step 1 with 'url' field
        
        Returns:
            List of successfully fetched articles
        """
        results = []
        failed = []
        
        print(f"\n{'='*60}")
        print(f"STEP 2: FETCHING ARTICLES SEQUENTIALLY")
        print(f"{'='*60}")
        print(f"Total articles to fetch: {len(articles)}\n")
        
        for i, article in enumerate(articles, 1):
            url = article['url']
            print(f"[{i}/{len(articles)}] Fetching: {url[:60]}...", end=' ')
            
            fetched = self.fetch_article(url, article_metadata=article)
            
            if fetched:
                results.append(fetched)
                print(f"✓ ({fetched['text_length']} chars)")
            else:
                failed.append(article)
                print(f"✗ Failed")
            
            # Rate limiting delay
            if i < len(articles):
                time.sleep(self.config.delay_between_requests)
        
        success_rate = len(results) / len(articles) * 100 if articles else 0
        
        print(f"\n{'='*60}")
        print(f"FETCHING COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results)}/{len(articles)} ({success_rate:.1f}%)")
        if failed:
            print(f"✗ Failed: {len(failed)} articles")
        
        return results
    
    def fetch_batch_parallel(self, articles: List[Dict]) -> List[Dict]:
        """
        Fetch articles in parallel (faster)
        
        Args:
            articles: List of article dicts from Step 1 with 'url' field
        
        Returns:
            List of successfully fetched articles
        """
        results = []
        failed = []
        
        print(f"\n{'='*60}")
        print(f"STEP 2: FETCHING ARTICLES IN PARALLEL")
        print(f"{'='*60}")
        print(f"Total articles to fetch: {len(articles)}")
        print(f"Parallel workers: {self.config.parallel_workers}\n")
        
        # Create thread pool
        with ThreadPoolExecutor(max_workers=self.config.parallel_workers) as executor:
            # Submit all fetch tasks
            future_to_article = {
                executor.submit(self.fetch_article, article['url'], article): article
                for article in articles
            }
            
            # Collect results as they complete
            completed = 0
            for future in as_completed(future_to_article):
                article = future_to_article[future]
                completed += 1
                
                try:
                    fetched = future.result()
                    if fetched:
                        results.append(fetched)
                        print(f"[{completed}/{len(articles)}] ✓ {article['url'][:60]}... ({fetched['text_length']} chars)")
                    else:
                        failed.append(article)
                        print(f"[{completed}/{len(articles)}] ✗ {article['url'][:60]}...")
                except Exception as e:
                    failed.append(article)
                    print(f"[{completed}/{len(articles)}] ✗ {article['url'][:60]}... Error: {e}")
        
        success_rate = len(results) / len(articles) * 100 if articles else 0
        
        print(f"\n{'='*60}")
        print(f"FETCHING COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results)}/{len(articles)} ({success_rate:.1f}%)")
        if failed:
            print(f"✗ Failed: {len(failed)} articles")
        
        return results


# ==========================================
# VALIDATION
# ==========================================

def validate_fetched_articles(articles: List[Dict]) -> tuple[bool, List[str]]:
    """
    Validate fetched articles
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    if not articles:
        errors.append("No articles were successfully fetched")
        return False, errors
    
    # Check required fields
    required_fields = ['url', 'title', 'text', 'text_length']
    
    for i, article in enumerate(articles[:5]):  # Check first 5
        for field in required_fields:
            if field not in article:
                errors.append(f"Article {i} missing field: {field}")
        
        # Check text length
        if article.get('text_length', 0) < 200:
            errors.append(f"Article {i} has insufficient text: {article.get('text_length', 0)} chars")
    
    # Check success rate
    if len(articles) < 50:  # Less than 50% of typical ~100 approved articles
        errors.append(f"Low fetch count: only {len(articles)} articles fetched (expected ~100)")
    
    return len(errors) == 0, errors


# ==========================================
# EXAMPLE USAGE
# ==========================================

def main():
    """
    Example usage of Step 2
    """
    
    # API key (get from https://app.scrapingbee.com/account/api)
    SCRAPINGBEE_API_KEY = "YOUR_SCRAPINGBEE_API_KEY"
    
    # Load approved articles from Step 1
    # In real pipeline, this comes from Step 1 output
    approved_articles = [
        {
            "title": "European Central Bank raises interest rates",
            "source": "Reuters",
            "url": "https://www.reuters.com/markets/europe/ecb-raises-rates-2024",
            "score": 850,
            "category": "Economy"
        },
        {
            "title": "UN Security Council votes on Gaza resolution",
            "source": "Associated Press",
            "url": "https://apnews.com/article/un-gaza-vote",
            "score": 920,
            "category": "International"
        },
        # ... ~98 more articles from Step 1
    ]
    
    print(f"Loaded {len(approved_articles)} approved articles from Step 1")
    
    # Initialize fetcher
    fetcher = ScrapingBeeArticleFetcher(
        api_key=SCRAPINGBEE_API_KEY,
        config=FetcherConfig(
            render_js=False,  # Use True for JavaScript-heavy sites (costs 10x)
            parallel_workers=5,
            max_text_length=15000
        )
    )
    
    # Fetch articles (choose parallel or sequential)
    # Parallel is faster (30 seconds vs 2 minutes)
    full_articles = fetcher.fetch_batch_parallel(approved_articles)
    
    # OR use sequential if you want slower but more conservative rate limiting:
    # full_articles = fetcher.fetch_batch_sequential(approved_articles)
    
    # Validate results
    is_valid, errors = validate_fetched_articles(full_articles)
    if errors:
        print(f"\n⚠ Validation warnings:")
        for error in errors:
            print(f"  - {error}")
    
    # Save results
    with open('step2_full_articles.json', 'w', encoding='utf-8') as f:
        json.dump(full_articles, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(full_articles)} full articles to step2_full_articles.json")
    
    # Show statistics
    if full_articles:
        avg_length = sum(a['text_length'] for a in full_articles) / len(full_articles)
        print(f"\nArticle statistics:")
        print(f"  Average text length: {int(avg_length)} characters")
        print(f"  Shortest article: {min(a['text_length'] for a in full_articles)} chars")
        print(f"  Longest article: {max(a['text_length'] for a in full_articles)} chars")
        
        # Show sample
        print(f"\nSample article:")
        sample = full_articles[0]
        print(f"  Title: {sample['title']}")
        print(f"  URL: {sample['url']}")
        print(f"  Length: {sample['text_length']} chars")
        print(f"  Preview: {sample['text'][:200]}...")
    
    print(f"\n✓ Ready for Step 3: Component Selection")
    
    return full_articles


if __name__ == "__main__":
    main()


# ==========================================
# COST & PERFORMANCE
# ==========================================

"""
SCRAPINGBEE PRICING:
- Free plan: 1,000 credits
- Freelance: $49/month for 150,000 credits
- Startup: $99/month for 350,000 credits

CREDIT USAGE:
- Standard request: 1 credit
- With JavaScript rendering: 10 credits
- With premium proxy: 25 credits

COST FOR 100 APPROVED ARTICLES:
- Standard (no JS): 100 credits = $0.033 (~3 cents)
- With JS rendering: 1,000 credits = $0.33 (33 cents)

RECOMMENDED: Use standard (no JS) for 99% of sites
Only enable JS for specific sites that need it

PERFORMANCE:
- Sequential: ~2 minutes for 100 articles (with 0.1s delays)
- Parallel (5 workers): ~30-60 seconds for 100 articles
- Success rate: ~99% (ScrapingBee bypasses most blocking)

TIME BREAKDOWN:
- Average fetch time: ~2-3 seconds per article
- With 5 parallel workers: 100 articles / 5 = 20 batches
- 20 batches × 3 seconds = ~60 seconds total

TOKENS PER ARTICLE:
- Average article: ~3,000 characters = ~750 tokens
- Max article (truncated): 15,000 characters = ~3,750 tokens
- This ensures we stay within Claude's context window in later steps
"""


# ==========================================
# INTEGRATION WITH STEP 3
# ==========================================

"""
After Step 2 completes, pass full articles to Step 3:

# Get full articles from Step 2
full_articles = fetcher.fetch_batch_parallel(approved_articles)

print(f"Step 2 complete: {len(full_articles)} articles ready for Step 3")

# Each article now has:
# - url: Original URL
# - title: Extracted title
# - text: Full article text (clean, readable)
# - text_length: Character count
# - published_time: Publish timestamp (if available)
# - source: From Step 1
# - score: From Step 1
# - category: From Step 1

# Proceed to Step 3: Component Selection
# See "Step 3: Component Selection" document
"""


# ==========================================
# TROUBLESHOOTING
# ==========================================

"""
COMMON ISSUES & SOLUTIONS:

1. Authentication Error (401):
   - Check API key is correct
   - Verify key has credits remaining
   - Check dashboard: https://app.scrapingbee.com/account/api

2. Low Success Rate (<90%):
   - Try with render_js=True for dynamic sites
   - Use premium_proxy=True for sites blocking datacenter IPs
   - Check if sites changed their structure

3. Insufficient Content Extracted:
   - Site may require JavaScript rendering
   - Try enabling render_js=True
   - Some sites may need custom extraction rules

4. Rate Limiting (429):
   - Increase delay_between_requests
   - Reduce parallel_workers
   - Upgrade ScrapingBee plan for higher limits

5. High Costs:
   - Minimize JS rendering (use only when needed)
   - Avoid premium proxies unless necessary
   - Test with free tier first

6. Timeout Errors:
   - Increase timeout value (default 30s)
   - Some sites are naturally slow
   - Use parallel fetching to mask slow sites

7. Empty/Bad Content:
   - Check if site changed structure
   - Try different extraction method
   - Verify URL is accessible in browser
"""


# ==========================================
# ADVANCED: SITE-SPECIFIC HANDLING
# ==========================================

def get_fetch_config_for_domain(url: str) -> Dict:
    """
    Return custom config for specific domains
    Some sites need JavaScript rendering or premium proxies
    """
    domain = urlparse(url).netloc.lower()
    
    # Sites that need JS rendering
    js_required_domains = [
        'medium.com',
        'forbes.com',
        'wired.com'
    ]
    
    # Sites that need premium proxy
    premium_domains = [
        'nytimes.com',
        'wsj.com',
        'ft.com'  # Financial Times
    ]
    
    config = {
        'render_js': any(d in domain for d in js_required_domains),
        'premium_proxy': any(d in domain for d in premium_domains)
    }
    
    return config


# Example usage with smart domain detection:
"""
def smart_fetch(fetcher, article):
    url = article['url']
    domain_config = get_fetch_config_for_domain(url)
    
    # Update fetcher config for this article
    original_render_js = fetcher.config.render_js
    original_premium = fetcher.config.premium_proxy
    
    fetcher.config.render_js = domain_config['render_js']
    fetcher.config.premium_proxy = domain_config['premium_proxy']
    
    result = fetcher.fetch_article(url, article)
    
    # Restore original config
    fetcher.config.render_js = original_render_js
    fetcher.config.premium_proxy = original_premium
    
    return result
"""


