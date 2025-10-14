import requests
import time
from typing import Optional, Dict, List
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

class JinaArticleFetcher:
    """
    Fetch full article content using Jina Reader API
    """
    
    def __init__(self, timeout: int = 10):
        self.base_url = "https://r.jina.ai/"
        self.timeout = timeout
        self.headers = {
            "X-Return-Format": "markdown",
            "X-With-Links-Summary": "false",
            "X-With-Images-Summary": "false",
            "X-Timeout": str(timeout)
        }
    
    def validate_url(self, url: str) -> bool:
        """
        Validate URL format
        """
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def fetch_article(self, url: str, max_retries: int = 3) -> Optional[Dict]:
        """
        Fetch single article with retry logic
        
        Args:
            url: Article URL to fetch
            max_retries: Number of retry attempts
        
        Returns:
            Dict with 'url', 'title', 'text', 'published_time' or None if failed
        """
        # Validate URL
        if not self.validate_url(url):
            print(f"Invalid URL: {url}")
            return None
        
        jina_url = f"{self.base_url}{url}"
        
        for attempt in range(max_retries):
            try:
                response = requests.get(
                    jina_url,
                    headers=self.headers,
                    timeout=self.timeout
                )
                
                # Check status code
                if response.status_code == 200:
                    content = response.text
                    
                    # Parse response
                    article_data = self._parse_jina_response(content, url)
                    
                    # Validate we got substantial content
                    if article_data and len(article_data['text']) > 200:
                        return article_data
                    else:
                        print(f"Insufficient content for {url}")
                        return None
                
                elif response.status_code == 404:
                    print(f"Article not found: {url}")
                    return None
                
                elif response.status_code == 403:
                    print(f"Access denied (paywall?): {url}")
                    return None
                
                elif response.status_code == 451:
                    print(f"Blocked by site (451): {url}")
                    return None
                
                elif response.status_code == 429:
                    # Rate limited - wait and retry
                    wait_time = 2 ** attempt
                    print(f"Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                else:
                    print(f"Unexpected status {response.status_code} for {url}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return None
                
            except requests.Timeout:
                print(f"Timeout fetching {url} (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
                
            except requests.RequestException as e:
                print(f"Request error for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
        
        return None
    
    def _parse_jina_response(self, content: str, original_url: str) -> Dict:
        """
        Parse Jina's markdown response
        """
        lines = content.split('\n')
        
        title = ""
        url_source = original_url
        published_time = ""
        text_lines = []
        
        # Parse header information
        in_content = False
        for line in lines:
            if line.startswith("Title: "):
                title = line.replace("Title: ", "").strip()
            elif line.startswith("URL Source: "):
                url_source = line.replace("URL Source: ", "").strip()
            elif line.startswith("Published Time: "):
                published_time = line.replace("Published Time: ", "").strip()
            elif line.strip() == "" and not in_content:
                # Empty line after headers means content starts
                in_content = True
            elif in_content:
                text_lines.append(line)
        
        # Join text content
        text = '\n'.join(text_lines).strip()
        
        # Truncate if too long (Claude has token limits)
        max_chars = 15000  # ~3750 tokens
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Content truncated...]"
        
        return {
            'url': url_source,
            'title': title,
            'text': text,
            'published_time': published_time
        }
    
    def fetch_batch(
        self, 
        urls: List[str], 
        delay: float = 0.05
    ) -> List[Dict]:
        """
        Fetch multiple articles with rate limiting
        
        Args:
            urls: List of article URLs
            delay: Delay between requests (seconds)
        
        Returns:
            List of article data dicts
        """
        results = []
        
        for i, url in enumerate(urls):
            print(f"Fetching {i+1}/{len(urls)}: {url}")
            
            article_data = self.fetch_article(url)
            
            if article_data:
                results.append(article_data)
            
            # Rate limiting
            if i < len(urls) - 1:
                time.sleep(delay)
        
        print(f"\nSuccessfully fetched {len(results)}/{len(urls)} articles")
        return results


def fetch_articles_parallel(urls: List[str], max_workers: int = 5) -> List[Dict]:
    """
    Fetch multiple articles in parallel
    
    Args:
        urls: List of URLs to fetch
        max_workers: Number of parallel workers (max 10 for free tier)
    
    Returns:
        List of article data dicts
    """
    fetcher = JinaArticleFetcher()
    results = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all fetch tasks
        future_to_url = {
            executor.submit(fetcher.fetch_article, url): url 
            for url in urls
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                article_data = future.result()
                if article_data:
                    results.append(article_data)
            except Exception as e:
                print(f"Error fetching {url}: {e}")
    
    print(f"Fetched {len(results)}/{len(urls)} articles")
    return results


class RateLimiter:
    """
    Simple rate limiter for Jina requests
    """
    def __init__(self, max_per_second: int = 15):
        self.max_per_second = max_per_second
        self.min_interval = 1.0 / max_per_second
        self.last_request = 0
    
    def wait_if_needed(self):
        """
        Wait if necessary to respect rate limit
        """
        now = time.time()
        time_since_last = now - self.last_request
        
        if time_since_last < self.min_interval:
            sleep_time = self.min_interval - time_since_last
            time.sleep(sleep_time)
        
        self.last_request = time.time()


def test_jina_fetcher():
    """
    Test Jina fetcher with various URLs
    """
    test_urls = [
        # Major news sites
        "https://www.reuters.com/world/",
        "https://www.bbc.com/news",
        "https://apnews.com/",
        
        # Paywalls (should fail gracefully)
        "https://www.nytimes.com/",
        "https://www.wsj.com/",
        
        # Invalid URLs
        "not-a-url",
        "https://this-site-does-not-exist-12345.com"
    ]
    
    fetcher = JinaArticleFetcher()
    
    results = {
        'success': 0,
        'failed': 0,
        'errors': []
    }
    
    for url in test_urls:
        article = fetcher.fetch_article(url)
        
        if article:
            results['success'] += 1
            print(f"✓ {url}: {len(article['text'])} chars")
        else:
            results['failed'] += 1
            results['errors'].append(url)
            print(f"✗ {url}: Failed")
    
    print(f"\nResults: {results['success']} success, {results['failed']} failed")
    return results


# Example usage and testing
if __name__ == "__main__":
    # Test with sample URLs
    print("🧪 TESTING JINA ARTICLE FETCHER")
    print("=" * 60)
    
    # Initialize fetcher
    fetcher = JinaArticleFetcher(timeout=10)
    
    # Example: Approved articles from Gemini scoring
    approved_articles = [
        {
            "title": "BBC News Article",
            "url": "https://www.bbc.com/news",
            "score": 850
        },
        {
            "title": "TechCrunch Article", 
            "url": "https://techcrunch.com/",
            "score": 920
        }
    ]
    
    # Extract URLs
    urls = [article['url'] for article in approved_articles]
    
    print(f"\n📡 Fetching {len(urls)} articles...")
    
    # Test sequential fetching
    print("\n🔄 Sequential fetching:")
    full_articles = fetcher.fetch_batch(urls, delay=0.05)
    
    # Display results
    if full_articles:
        print(f"\n📰 SUCCESSFULLY FETCHED {len(full_articles)} ARTICLES")
        print("=" * 60)
        
        for i, article in enumerate(full_articles, 1):
            print(f"\n{i}. {article['title']}")
            print(f"   URL: {article['url']}")
            print(f"   Published: {article['published_time']}")
            print(f"   Text length: {len(article['text'])} characters")
            print(f"   Preview: {article['text'][:200]}...")
    else:
        print("❌ No articles fetched successfully")
    
    # Test parallel fetching
    print(f"\n⚡ Testing parallel fetching...")
    parallel_articles = fetch_articles_parallel(urls, max_workers=3)
    
    print(f"\n📊 PERFORMANCE SUMMARY:")
    print(f"   Sequential: {len(full_articles)} articles")
    print(f"   Parallel: {len(parallel_articles)} articles")
    print(f"   Success rate: {len(full_articles)}/{len(urls)} = {len(full_articles)/len(urls)*100:.1f}%")
    
    # Test with various URLs
    print(f"\n🧪 Testing with various URLs...")
    test_results = test_jina_fetcher()
