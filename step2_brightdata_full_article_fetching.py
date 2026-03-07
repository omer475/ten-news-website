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

    # Domain-to-country mapping for proxy geo-targeting
    DOMAIN_COUNTRY_MAP = {
        'cumhuriyet.com.tr': 'tr', 'sozcu.com.tr': 'tr', 'hurriyet.com.tr': 'tr',
        'aa.com.tr': 'tr', 'trt.net.tr': 'tr', 'trthaber.com': 'tr',
        'abc.es': 'es', 'elpais.com': 'es', 'elmundo.es': 'es',
        'rt.com': 'de', 'tass.com': 'de',  # Route Russian sites through Germany
        'cbsnews.com': 'us', 'foxnews.com': 'us', 'cnn.com': 'us',
        'globalnews.ca': 'ca', 'cbc.ca': 'ca',
        'news18.com': 'in', 'ndtv.com': 'in',
    }

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

    def _get_country_for_url(self, url: str) -> Optional[str]:
        """Get the best proxy country code for a URL based on its domain."""
        try:
            domain = urlparse(url).netloc.lower().replace('www.', '')
            for pattern, country in self.DOMAIN_COUNTRY_MAP.items():
                if pattern in domain:
                    return country
        except:
            pass
        return None

    def _get_geo_session(self, country_code: str) -> requests.Session:
        """Create a new proxy session routed through a specific country."""
        geo_username = f"{self.proxy_username}-country-{country_code}"
        geo_proxy_url = f"http://{geo_username}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}"
        session = requests.Session()
        session.proxies = {'http': geo_proxy_url, 'https': geo_proxy_url}
        session.verify = False
        return session
    
    def validate_url(self, url: str) -> bool:
        """Validate URL format"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    # Known default/logo og:image URLs that should be skipped
    DEFAULT_OG_IMAGES = [
        'tass.com/img/blocks/common/',
        'thehindu.com/theme/images/og-image',
        '/default-og', '/og-default', '/share-image', '/default-share',
        '/site-image', '/social-share', '/fallback-image',
    ]

    def _is_default_og_image(self, img_url: str) -> bool:
        """Check if an og:image URL is a known default/logo sharing image."""
        img_lower = img_url.lower()
        for pattern in self.DEFAULT_OG_IMAGES:
            if pattern in img_lower:
                return True
        # Also reject if URL path contains 'logo' or 'brand'
        if any(word in img_lower for word in ['/logo', '/brand', '/favicon', 'logo_share', 'logo-share']):
            return True
        return False

    def extract_og_image(self, html: str, url: str) -> Optional[str]:
        """
        Extract the best quality image from article page HTML.
        Used for sources like BBC/DW where RSS images are low quality.

        Priority order:
        1. og:image meta tag (if not a known default/logo)
        2. twitter:image meta tag (if not a known default/logo)
        3. og:image:secure_url meta tag (if not a known default/logo)
        4. First large image in article body

        Args:
            html: Full HTML content of the page
            url: Article URL (for debugging)

        Returns:
            Best image URL or None if not found
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Try meta tags first, but skip known default/logo images
            for meta_tag, meta_attr in [
                ('meta', {'property': 'og:image'}),
                ('meta', {'attrs': {'name': 'twitter:image'}}),
                ('meta', {'property': 'og:image:secure_url'}),
            ]:
                if 'property' in meta_attr:
                    tag = soup.find(meta_tag, property=meta_attr['property'])
                else:
                    tag = soup.find(meta_tag, **meta_attr)

                if tag and tag.get('content'):
                    img_url = tag['content']
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    if not self._is_default_og_image(img_url):
                        return img_url
                    else:
                        print(f"   ⚠️ Skipping default og:image: {img_url[:80]}")

            # Fallback: First large image in article body
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
                            except Exception:
                                pass
                        if src.startswith('//'):
                            src = 'https:' + src
                        elif src.startswith('/'):
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
    
    def _try_fetch(self, url: str, session: requests.Session, label: str = "proxy") -> Optional[Dict]:
        """
        Single fetch attempt using the given session.
        Returns article data dict or None.
        """
        try:
            response = session.get(url, headers=self.headers, timeout=self.timeout)

            if response.status_code == 200:
                article_data = self.extract_article_text(response.text, url)
                if article_data and len(article_data['text']) > 200:
                    return article_data
                return None
            elif response.status_code in (404, 407, 410):
                return None  # Not recoverable
            else:
                return None
        except (requests.Timeout, requests.exceptions.ProxyError, requests.RequestException):
            return None
        except Exception:
            return None

    def fetch_article(self, url: str, max_retries: int = 2) -> Optional[Dict]:
        """
        Fetch single article with multi-strategy fallback:
        1. Default proxy session (2 attempts)
        2. Geo-targeted proxy if domain has a country mapping (1 attempt)
        3. Direct fetch without proxy (1 attempt)

        Args:
            url: Article URL to fetch
            max_retries: Number of retry attempts per strategy

        Returns:
            Dict with 'url', 'title', 'text' or None if failed
        """
        if not self.validate_url(url):
            print(f"Invalid URL: {url}")
            return None

        # Strategy 1: Default proxy (2 attempts)
        for attempt in range(max_retries):
            result = self._try_fetch(url, self.session, "proxy")
            if result:
                print(f"✅ Fetched: {url[:50]}... ({len(result['text'])} chars)")
                return result
            if attempt < max_retries - 1:
                time.sleep(2)

        # Strategy 2: Geo-targeted proxy for known domains
        country = self._get_country_for_url(url)
        if country:
            try:
                geo_session = self._get_geo_session(country)
                result = self._try_fetch(url, geo_session, f"geo-{country}")
                if result:
                    print(f"✅ Fetched (geo-{country}): {url[:50]}... ({len(result['text'])} chars)")
                    return result
            except Exception:
                pass

        # Strategy 3: Direct fetch (no proxy) — many news sites don't need proxy
        try:
            direct_session = requests.Session()
            direct_session.verify = True
            result = self._try_fetch(url, direct_session, "direct")
            if result:
                print(f"✅ Fetched (direct): {url[:50]}... ({len(result['text'])} chars)")
                return result
        except Exception:
            pass

        print(f"❌ All strategies failed: {url[:60]}")
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

    # Same default og:image patterns as BrightDataArticleFetcher
    DEFAULT_OG_PATTERNS = [
        'tass.com/img/blocks/common/', 'thehindu.com/theme/images/og-image',
        '/default-og', '/og-default', '/share-image', '/default-share',
        '/site-image', '/social-share', '/fallback-image',
        '/logo', '/brand', '/favicon', 'logo_share', 'logo-share',
    ]

    def _fetch_og_image_direct(self, url: str) -> Optional[str]:
        """Quick direct fetch to extract og:image from HTML head (no proxy needed)."""
        try:
            resp = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }, stream=True)
            # Only read the first 50KB to find meta tags (they're in <head>)
            content = b''
            for chunk in resp.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > 50000:
                    break
            html = content.decode('utf-8', errors='ignore')
            soup = BeautifulSoup(html, 'html.parser')

            for tag_finder in [
                lambda: soup.find('meta', property='og:image'),
                lambda: soup.find('meta', attrs={'name': 'twitter:image'}),
            ]:
                tag = tag_finder()
                if tag and tag.get('content'):
                    img_url = tag['content']
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    # Skip known default/logo images
                    img_lower = img_url.lower()
                    if any(p in img_lower for p in self.DEFAULT_OG_PATTERNS):
                        continue
                    return img_url
        except Exception:
            pass
        return None

    def fetch_article(self, url: str) -> Optional[Dict]:
        """Fetch using Jina Reader API + direct og:image extraction"""
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
                    # Also try to get og:image via direct fetch
                    og_image = self._fetch_og_image_direct(url)
                    if og_image:
                        print(f"✅ Jina fallback + og:image: {url[:50]}... ({len(text)} chars)")
                    else:
                        print(f"✅ Jina fallback: {url[:50]}... ({len(text)} chars)")
                    return {'url': url, 'title': title, 'text': text[:15000], 'published_time': '', 'og_image': og_image}

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
