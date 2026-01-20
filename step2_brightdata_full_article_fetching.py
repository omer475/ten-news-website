"""
STEP 2: BRIGHT DATA FULL ARTICLE FETCHING
==========================================
Fetch full article content using Bright Data Web Unlocker.
Bright Data bypasses anti-bot measures and paywalls that block Jina/ScrapingBee.

Setup:
1. Add to .env.local:
   BRIGHTDATA_API_KEY=your_zone_password
   BRIGHTDATA_CUSTOMER_ID=your_customer_id
   BRIGHTDATA_ZONE=your_zone_name (default: web_unlocker1)
"""

import os
import requests
import time
import urllib3
from typing import Optional, Dict, List
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
import re

# Suppress SSL warnings for proxy connections
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class BrightDataArticleFetcher:
    """
    Fetch full article content using Bright Data Web Unlocker proxy.
    Bypasses anti-bot measures that block other scrapers.
    """
    
    def __init__(self, api_key: str = None, customer_id: str = None, zone: str = None, timeout: int = 45):
        """
        Initialize Bright Data fetcher.
        
        Args:
            api_key: Bright Data zone password
            customer_id: Bright Data customer ID (from dashboard)
            zone: Zone name (default: web_unlocker1)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or os.getenv('BRIGHTDATA_API_KEY')
        self.customer_id = customer_id or os.getenv('BRIGHTDATA_CUSTOMER_ID', 'hl_3870a989')
        self.zone = zone or os.getenv('BRIGHTDATA_ZONE', 'residential_proxy1')
        self.timeout = timeout
        
        if not self.api_key:
            raise ValueError("BRIGHTDATA_API_KEY is required")
        
        # Bright Data proxy configuration
        # Using Residential proxy format
        self.proxy_host = "brd.superproxy.io"
        self.proxy_port = 33335  # Residential proxy port
        self.proxy_username = f"brd-customer-{self.customer_id}-zone-{self.zone}"
        self.proxy_password = self.api_key
        
        # Build proxy URL with authentication
        self.proxy_url = f"http://{self.proxy_username}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}"
        
        self.proxies = {
            'http': self.proxy_url,
            'https': self.proxy_url
        }
        
        # Create a session with retry logic
        self.session = requests.Session()
        self.session.proxies = self.proxies
        self.session.verify = False  # Bright Data handles SSL
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        print(f"   🌐 Bright Data initialized: customer={self.customer_id}, zone={self.zone}")
    
    def validate_url(self, url: str) -> bool:
        """Validate URL format"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def extract_og_image(self, html: str, url: str) -> Optional[str]:
        """
        Extract the best quality image from article page HTML.
        Used for sources like BBC/DW where RSS images are low quality.
        
        Priority order:
        1. og:image meta tag
        2. twitter:image meta tag  
        3. og:image:secure_url meta tag
        4. First large image in article body
        
        Args:
            html: Full HTML content of the page
            url: Article URL (for debugging)
            
        Returns:
            Best image URL or None if not found
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Priority 1: og:image
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                img_url = og_image['content']
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                return img_url
            
            # Priority 2: twitter:image
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            if twitter_image and twitter_image.get('content'):
                img_url = twitter_image['content']
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                return img_url
            
            # Priority 3: og:image:secure_url
            og_secure = soup.find('meta', property='og:image:secure_url')
            if og_secure and og_secure.get('content'):
                img_url = og_secure['content']
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                return img_url
            
            # Priority 4: First large image in article body
            article = soup.find('article') or soup.find('main') or soup.find('div', class_=re.compile(r'article|content|story', re.I))
            if article:
                for img in article.find_all('img', limit=10):
                    src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                    if src:
                        # Skip logos, icons, and tracking pixels
                        src_lower = src.lower()
                        if any(skip in src_lower for skip in ['logo', 'icon', 'avatar', '1x1', 'pixel', 'tracking', 'ad-']):
                            continue
                        # Prefer images with width > 400 if specified
                        width = img.get('width')
                        if width:
                            try:
                                if int(width) < 300:
                                    continue
                            except:
                                pass
                        if src.startswith('//'):
                            src = 'https:' + src
                        elif src.startswith('/'):
                            # Make absolute URL
                            from urllib.parse import urlparse
                            parsed = urlparse(url)
                            src = f"{parsed.scheme}://{parsed.netloc}{src}"
                        return src
            
            return None
            
        except Exception as e:
            print(f"   ⚠️ Error extracting og:image: {e}")
            return None
    
    def extract_article_text(self, html: str, url: str) -> Dict:
        """
        Extract article text from HTML using BeautifulSoup.
        Handles various news site formats.
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove unwanted elements
            for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 
                                          'aside', 'iframe', 'noscript', 'form', 'button']):
                element.decompose()
            
            # Remove ads and sidebars
            for element in soup.find_all(class_=re.compile(r'ad|sidebar|newsletter|popup|modal|cookie', re.I)):
                element.decompose()
            
            # Try to find the main article content
            article_text = ""
            title = ""
            
            # Get title
            title_tag = soup.find('h1')
            if title_tag:
                title = title_tag.get_text(strip=True)
            else:
                title_meta = soup.find('meta', property='og:title')
                if title_meta:
                    title = title_meta.get('content', '')
                else:
                    title_tag = soup.find('title')
                    if title_tag:
                        title = title_tag.get_text(strip=True)
            
            # Try common article containers
            article_containers = [
                soup.find('article'),
                soup.find(class_=re.compile(r'article|post|content|story|entry', re.I)),
                soup.find(id=re.compile(r'article|post|content|story|main', re.I)),
                soup.find('main'),
                soup.find(class_='body'),
                soup.find(class_='text'),
            ]
            
            for container in article_containers:
                if container:
                    # Get all paragraphs
                    paragraphs = container.find_all('p')
                    if paragraphs:
                        article_text = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20])
                        if len(article_text) > 200:
                            break
            
            # Fallback: get all paragraphs from body
            if len(article_text) < 200:
                body = soup.find('body')
                if body:
                    paragraphs = body.find_all('p')
                    article_text = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])
            
            # Clean up the text
            article_text = re.sub(r'\s+', ' ', article_text)
            article_text = re.sub(r'\n{3,}', '\n\n', article_text)
            
            # Truncate if too long
            max_chars = 15000
            if len(article_text) > max_chars:
                article_text = article_text[:max_chars] + "\n\n[Content truncated...]"
            
            # Extract og:image for high-quality image
            og_image = self.extract_og_image(html, url)
            
            return {
                'url': url,
                'title': title,
                'text': article_text.strip(),
                'published_time': '',
                'og_image': og_image  # High-quality image from article page
            }
            
        except Exception as e:
            print(f"   Error parsing HTML: {e}")
            return {
                'url': url,
                'title': '',
                'text': '',
                'published_time': ''
            }
    
    def fetch_article(self, url: str, max_retries: int = 3) -> Optional[Dict]:
        """
        Fetch single article using Bright Data proxy.
        
        Args:
            url: Article URL to fetch
            max_retries: Number of retry attempts
        
        Returns:
            Dict with 'url', 'title', 'text' or None if failed
        """
        if not self.validate_url(url):
            print(f"Invalid URL: {url}")
            return None
        
        for attempt in range(max_retries):
            try:
                # Use session with configured proxy
                response = self.session.get(
                    url,
                    headers=self.headers,
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    article_data = self.extract_article_text(response.text, url)
                    
                    # Validate we got substantial content
                    if article_data and len(article_data['text']) > 200:
                        print(f"✅ Fetched: {url[:50]}... ({len(article_data['text'])} chars)")
                        return article_data
                    else:
                        print(f"⚠️ Insufficient content for {url[:50]}...")
                        return None
                
                elif response.status_code == 404:
                    print(f"❌ 404 Not found: {url[:50]}...")
                    return None
                
                elif response.status_code == 403:
                    print(f"⚠️ 403 Access denied: {url[:50]}...")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return None
                
                elif response.status_code == 429:
                    wait_time = 3 ** (attempt + 1)
                    print(f"⏳ Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                elif response.status_code == 407:
                    print(f"❌ 407 Proxy auth failed - check BRIGHTDATA_API_KEY, BRIGHTDATA_CUSTOMER_ID, BRIGHTDATA_ZONE")
                    return None
                
                elif response.status_code == 502 or response.status_code == 503:
                    print(f"⚠️ Proxy error {response.status_code}, retrying...")
                    if attempt < max_retries - 1:
                        time.sleep(3)
                        continue
                    return None
                
                else:
                    print(f"⚠️ HTTP {response.status_code} for {url[:50]}...")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return None
                
            except requests.Timeout:
                print(f"⏰ Timeout (attempt {attempt + 1}/{max_retries}): {url[:50]}...")
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                return None
                
            except requests.exceptions.ProxyError as e:
                print(f"❌ Proxy error: {str(e)[:80]}")
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                return None
                
            except requests.RequestException as e:
                error_msg = str(e)[:80]
                print(f"❌ Request error: {error_msg}")
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                return None
            
            except Exception as e:
                print(f"❌ Unexpected error: {str(e)[:80]}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return None
        
        return None
    
    def fetch_batch(self, urls: List[str], delay: float = 0.5) -> List[Dict]:
        """
        Fetch multiple articles sequentially with delay.
        """
        results = []
        
        for i, url in enumerate(urls):
            print(f"Fetching {i+1}/{len(urls)}: {url[:60]}...")
            
            article_data = self.fetch_article(url)
            
            if article_data:
                results.append(article_data)
            
            if i < len(urls) - 1:
                time.sleep(delay)
        
        print(f"Successfully fetched {len(results)}/{len(urls)} articles")
        return results


class JinaFallbackFetcher:
    """Fallback to Jina Reader if Bright Data fails"""
    
    def __init__(self, timeout: int = 15):
        self.base_url = "https://r.jina.ai/"
        self.timeout = timeout
        self.headers = {
            "X-Return-Format": "markdown",
            "X-With-Links-Summary": "false",
            "X-With-Images-Summary": "false",
        }
    
    def fetch_article(self, url: str) -> Optional[Dict]:
        """Fetch using Jina Reader API"""
        try:
            jina_url = f"{self.base_url}{url}"
            response = requests.get(jina_url, headers=self.headers, timeout=self.timeout)
            
            if response.status_code == 200:
                content = response.text
                # Parse Jina response
                lines = content.split('\n')
                title = ""
                text_lines = []
                in_content = False
                
                for line in lines:
                    if line.startswith("Title: "):
                        title = line.replace("Title: ", "").strip()
                    elif line.strip() == "" and not in_content:
                        in_content = True
                    elif in_content:
                        text_lines.append(line)
                
                text = '\n'.join(text_lines).strip()
                
                if len(text) > 200:
                    print(f"✅ Jina fallback: {url[:50]}... ({len(text)} chars)")
                    return {'url': url, 'title': title, 'text': text[:15000], 'published_time': ''}
            
            return None
        except Exception as e:
            return None


def fetch_articles_parallel(urls: List[str], max_workers: int = 3) -> List[Dict]:
    """
    Fetch multiple articles - tries Bright Data first, falls back to Jina.
    
    Args:
        urls: List of URLs to fetch
        max_workers: Number of parallel workers
    
    Returns:
        List of article data dicts
    """
    results = []
    failed_urls = []
    
    # Try Bright Data first
    api_key = os.getenv('BRIGHTDATA_API_KEY')
    if api_key:
        try:
            fetcher = BrightDataArticleFetcher(api_key=api_key)
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_url = {
                    executor.submit(fetcher.fetch_article, url): url 
                    for url in urls
                }
                
                for future in as_completed(future_to_url):
                    url = future_to_url[future]
                    try:
                        article_data = future.result()
                        if article_data:
                            results.append(article_data)
                        else:
                            failed_urls.append(url)
                    except Exception as e:
                        print(f"Error: {str(e)[:50]}")
                        failed_urls.append(url)
        except Exception as e:
            print(f"⚠️ Bright Data init failed: {e}")
            failed_urls = urls
    else:
        print("⚠️ BRIGHTDATA_API_KEY not found")
        failed_urls = urls
    
    # Fallback to Jina for failed URLs
    if failed_urls:
        print(f"   🔄 Trying Jina fallback for {len(failed_urls)} URLs...")
        jina_fetcher = JinaFallbackFetcher()
        
        for url in failed_urls:
            article_data = jina_fetcher.fetch_article(url)
            if article_data:
                results.append(article_data)
    
    print(f"Fetched {len(results)}/{len(urls)} articles")
    return results


# For testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    
    print("🧪 TESTING BRIGHT DATA ARTICLE FETCHER")
    print("=" * 60)
    
    # Test URLs that typically block scrapers
    test_urls = [
        "https://www.businessinsider.com/",
        "https://www.engadget.com/",
        "https://fortune.com/",
        "https://www.reuters.com/world/"
    ]
    
    api_key = os.getenv('BRIGHTDATA_API_KEY')
    if not api_key:
        print("❌ BRIGHTDATA_API_KEY not set")
        exit(1)
    
    fetcher = BrightDataArticleFetcher(api_key=api_key)
    
    print(f"\n📡 Testing with {len(test_urls)} URLs...")
    
    for url in test_urls:
        print(f"\n🔗 Fetching: {url}")
        article = fetcher.fetch_article(url)
        
        if article:
            print(f"   ✅ Title: {article['title'][:50]}...")
            print(f"   📝 Text length: {len(article['text'])} chars")
        else:
            print(f"   ❌ Failed to fetch")
