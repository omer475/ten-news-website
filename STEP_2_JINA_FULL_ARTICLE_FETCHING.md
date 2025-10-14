# STEP 2: JINA READER - FULL ARTICLE FETCHING

## Purpose
After Gemini filters articles (Step 1), fetch the full article text for approved articles only. Jina Reader extracts clean, readable content from article URLs, removing ads, navigation, and clutter.

---

## Jina Reader Overview

**What is Jina Reader?**
- Web content extraction API
- Returns clean markdown text of articles
- Removes ads, sidebars, navigation, comments
- Optimized for news articles and blog posts
- Free tier: 20 requests/second

**API Endpoint:** `https://r.jina.ai/[YOUR_URL]`

**How it works:**
- Simply prepend `https://r.jina.ai/` to any article URL
- Jina fetches, extracts, and returns clean markdown
- No API key required for basic usage

---

## API Configuration

**Endpoint:** `GET https://r.jina.ai/{article_url}`

**Method:** GET request

**Headers (Optional):**
```json
{
  "X-Return-Format": "markdown",
  "X-With-Links-Summary": "true",
  "X-With-Images-Summary": "false",
  "X-Timeout": "10"
}
```

**No authentication required for free tier**

---

## Request Headers Explanation

### X-Return-Format
- **Value:** `"markdown"` (default), `"html"`, `"text"`, `"screenshot"`
- **Recommended:** `"markdown"` - Clean, structured text perfect for AI
- **Purpose:** Controls output format

### X-With-Links-Summary
- **Value:** `"true"` or `"false"`
- **Default:** `"false"`
- **Purpose:** Include summary of links found in article
- **Recommended:** `"false"` (we don't need link summaries)

### X-With-Images-Summary
- **Value:** `"true"` or `"false"`
- **Default:** `"false"`
- **Purpose:** Include image descriptions/URLs
- **Recommended:** `"false"` (we only need text)

### X-Timeout
- **Value:** Number of seconds (default: 30)
- **Recommended:** `"10"` - Most articles load within 10 seconds
- **Purpose:** Prevent hanging on slow sites

### X-Target-Selector (Advanced)
- **Value:** CSS selector (e.g., `"article"`, `".post-content"`)
- **Purpose:** Target specific element on page
- **Recommended:** Leave empty (Jina auto-detects)

---

## Response Format

**Success Response:**
```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

Title: European Central Bank Raises Interest Rates to 4.5 Percent
URL Source: https://www.reuters.com/markets/europe/ecb-raises-rates...
Published Time: 2024-10-14T13:45:00Z

The European Central Bank announced Thursday it is raising interest rates by 0.25 percentage points to 4.5%, marking the tenth consecutive increase since July 2023.

ECB President Christine Lagarde stated that the decision was necessary to combat persistent inflation, which remains at 5.3% across the eurozone, well above the bank's 2% target.

[... rest of article content ...]
```

**Key components:**
- **Title:** Extracted article title
- **URL Source:** Original article URL
- **Published Time:** Publication timestamp (if available)
- **Content:** Clean markdown text of article body

---

## Error Handling

**Common errors:**

**1. 404 Not Found**
```
Error: URL not found or page doesn't exist
```
**Action:** Skip this article, log error

**2. 403 Forbidden**
```
Error: Access denied or paywall detected
```
**Action:** Try with fallback method or skip

**3. Timeout**
```
Error: Request timed out
```
**Action:** Retry with longer timeout or skip

**4. Invalid URL**
```
Error: Invalid URL format
```
**Action:** Validate URL before sending to Jina

**5. Rate Limit (429)**
```
Error: Too many requests
```
**Action:** Wait and retry with exponential backoff

---

## Complete Python Implementation

```python
import requests
import time
from typing import Optional, Dict, List
from urllib.parse import urlparse

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


# Example usage
def main():
    # Initialize fetcher
    fetcher = JinaArticleFetcher(timeout=10)
    
    # Example: Approved articles from Gemini scoring
    approved_articles = [
        {
            "title": "ECB Raises Rates",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024",
            "score": 850
        },
        {
            "title": "UN Votes on Gaza Resolution",
            "url": "https://www.apnews.com/article/un-gaza-vote",
            "score": 920
        }
    ]
    
    # Extract URLs
    urls = [article['url'] for article in approved_articles]
    
    # Fetch full articles
    full_articles = fetcher.fetch_batch(urls, delay=0.05)
    
    # Display results
    for article in full_articles:
        print(f"\n{'='*60}")
        print(f"Title: {article['title']}")
        print(f"URL: {article['url']}")
        print(f"Published: {article['published_time']}")
        print(f"Text length: {len(article['text'])} characters")
        print(f"Preview: {article['text'][:200]}...")

if __name__ == "__main__":
    main()
```

---

## Complete Node.js Implementation

```javascript
const axios = require('axios');

class JinaArticleFetcher {
    constructor(timeout = 10000) {
        this.baseUrl = 'https://r.jina.ai/';
        this.timeout = timeout;
        this.headers = {
            'X-Return-Format': 'markdown',
            'X-With-Links-Summary': 'false',
            'X-With-Images-Summary': 'false',
            'X-Timeout': String(timeout / 1000)
        };
    }

    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    async fetchArticle(url, maxRetries = 3) {
        if (!this.validateUrl(url)) {
            console.log(`Invalid URL: ${url}`);
            return null;
        }

        const jinaUrl = `${this.baseUrl}${url}`;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await axios.get(jinaUrl, {
                    headers: this.headers,
                    timeout: this.timeout
                });

                if (response.status === 200) {
                    const content = response.data;
                    const articleData = this.parseJinaResponse(content, url);

                    if (articleData && articleData.text.length > 200) {
                        return articleData;
                    } else {
                        console.log(`Insufficient content for ${url}`);
                        return null;
                    }
                }
            } catch (error) {
                if (error.response) {
                    const status = error.response.status;
                    
                    if (status === 404) {
                        console.log(`Article not found: ${url}`);
                        return null;
                    } else if (status === 403) {
                        console.log(`Access denied (paywall?): ${url}`);
                        return null;
                    } else if (status === 429) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`Rate limited, waiting ${waitTime}ms...`);
                        await this.sleep(waitTime);
                        continue;
                    }
                }

                if (error.code === 'ECONNABORTED') {
                    console.log(`Timeout fetching ${url} (attempt ${attempt + 1}/${maxRetries})`);
                } else {
                    console.log(`Error fetching ${url}: ${error.message}`);
                }

                if (attempt < maxRetries - 1) {
                    await this.sleep(Math.pow(2, attempt) * 1000);
                    continue;
                }
                return null;
            }
        }

        return null;
    }

    parseJinaResponse(content, originalUrl) {
        const lines = content.split('\n');
        
        let title = '';
        let urlSource = originalUrl;
        let publishedTime = '';
        const textLines = [];
        let inContent = false;

        for (const line of lines) {
            if (line.startsWith('Title: ')) {
                title = line.replace('Title: ', '').trim();
            } else if (line.startsWith('URL Source: ')) {
                urlSource = line.replace('URL Source: ', '').trim();
            } else if (line.startsWith('Published Time: ')) {
                publishedTime = line.replace('Published Time: ', '').trim();
            } else if (line.trim() === '' && !inContent) {
                inContent = true;
            } else if (inContent) {
                textLines.push(line);
            }
        }

        let text = textLines.join('\n').trim();

        // Truncate if too long
        const maxChars = 15000;
        if (text.length > maxChars) {
            text = text.substring(0, maxChars) + '\n\n[Content truncated...]';
        }

        return {
            url: urlSource,
            title: title,
            text: text,
            published_time: publishedTime
        };
    }

    async fetchBatch(urls, delay = 50) {
        const results = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`Fetching ${i + 1}/${urls.length}: ${url}`);

            const articleData = await this.fetchArticle(url);

            if (articleData) {
                results.push(articleData);
            }

            if (i < urls.length - 1) {
                await this.sleep(delay);
            }
        }

        console.log(`\nSuccessfully fetched ${results.length}/${urls.length} articles`);
        return results;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Example usage
async function main() {
    const fetcher = new JinaArticleFetcher(10000);

    const approvedArticles = [
        {
            title: 'ECB Raises Rates',
            url: 'https://www.reuters.com/markets/europe/ecb-rates-2024',
            score: 850
        },
        {
            title: 'UN Votes on Gaza Resolution',
            url: 'https://www.apnews.com/article/un-gaza-vote',
            score: 920
        }
    ];

    const urls = approvedArticles.map(article => article.url);
    const fullArticles = await fetcher.fetchBatch(urls, 50);

    for (const article of fullArticles) {
        console.log('\n' + '='.repeat(60));
        console.log(`Title: ${article.title}`);
        console.log(`URL: ${article.url}`);
        console.log(`Published: ${article.published_time}`);
        console.log(`Text length: ${article.text.length} characters`);
        console.log(`Preview: ${article.text.substring(0, 200)}...`);
    }
}

main().catch(console.error);
```

---

## Parallel Processing for Speed

For faster processing of many articles:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

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

# Usage
urls = [article['url'] for article in approved_articles]
full_articles = fetch_articles_parallel(urls, max_workers=5)
```

**Note:** Free tier allows 20 req/sec, so max 10 parallel workers is safe.

---

## Integration with Complete Workflow

```python
def process_news_articles(rss_articles):
    """
    Complete workflow: Score → Fetch → Write
    """
    
    # Step 1: Score with Gemini
    print("Step 1: Scoring articles with Gemini...")
    scored = score_news_articles(rss_articles, gemini_api_key)
    
    # Filter approved
    approved = [s for s in scored if s['status'] == 'APPROVED']
    print(f"Approved: {len(approved)}/{len(rss_articles)} articles")
    
    if not approved:
        print("No articles approved")
        return []
    
    # Step 2: Fetch full text with Jina
    print("\nStep 2: Fetching full articles with Jina...")
    urls = [a['url'] for a in approved]
    fetcher = JinaArticleFetcher()
    full_articles = fetcher.fetch_batch(urls, delay=0.05)
    
    # Match scores with full articles
    url_to_score = {a['url']: a['score'] for a in approved}
    for article in full_articles:
        article['score'] = url_to_score.get(article['url'], 0)
    
    # Step 3: Claude writes title + summary
    print("\nStep 3: Writing titles and summaries with Claude...")
    formatted_articles = []
    for article in full_articles:
        result = claude_write_title_summary({
            'title': article['title'],
            'description': article['text']
        })
        
        formatted_articles.append({
            'original_url': article['url'],
            'original_title': article['title'],
            'score': article['score'],
            'written_title': result['title'],
            'written_summary': result['summary'],
            'full_text': article['text']
        })
    
    print(f"\nProcessed {len(formatted_articles)} articles successfully")
    return formatted_articles

# Usage
rss_articles = [
    {
        'title': 'ECB Rate Decision',
        'source': 'Reuters',
        'description': 'Short RSS description...',
        'url': 'https://reuters.com/article/...'
    },
    # ... more articles
]

final_articles = process_news_articles(rss_articles)
```

---

## Fallback Strategy

If Jina fails, fallback to trafilatura:

```python
import trafilatura

def fetch_with_fallback(url: str) -> Optional[str]:
    """
    Try Jina first, fallback to trafilatura
    """
    # Try Jina
    fetcher = JinaArticleFetcher()
    jina_result = fetcher.fetch_article(url)
    
    if jina_result and len(jina_result['text']) > 200:
        return jina_result['text']
    
    # Fallback to trafilatura
    print(f"Jina failed for {url}, trying trafilatura...")
    try:
        downloaded = trafilatura.fetch_url(url)
        text = trafilatura.extract(downloaded)
        if text and len(text) > 200:
            return text
    except:
        pass
    
    return None
```

---

## Cost & Performance

**Jina Reader Pricing:**
- **Free Tier:** 20 requests/second (unlimited requests)
- **No API key required** for free tier
- **Paid tier:** $0.002 per request (if you need >20 req/sec)

**Performance:**
- **Speed:** ~500ms per article
- **Success rate:** ~85-90% (depends on sites)
- **Parallel processing:** Up to 10 workers safely on free tier

**Cost per 1000 articles:**
- Free tier: $0
- Paid tier: $2 (if needed)

**Time to fetch 150 approved articles:**
- Sequential (0.05s delay): ~8 seconds
- Parallel (5 workers): ~2 seconds

---

## Rate Limiting Best Practices

```python
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

# Usage
rate_limiter = RateLimiter(max_per_second=15)

for url in urls:
    rate_limiter.wait_if_needed()
    article = fetcher.fetch_article(url)
```

---

## Monitoring & Logging

```python
import logging
from datetime import datetime

def setup_logging():
    """
    Setup logging for article fetching
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('jina_fetching.log'),
            logging.StreamHandler()
        ]
    )

def fetch_with_logging(fetcher, url):
    """
    Fetch article with detailed logging
    """
    logger = logging.getLogger(__name__)
    start_time = time.time()
    
    try:
        article = fetcher.fetch_article(url)
        duration = time.time() - start_time
        
        if article:
            logger.info({
                'url': url,
                'status': 'success',
                'duration_ms': duration * 1000,
                'text_length': len(article['text']),
                'title': article['title']
            })
        else:
            logger.warning({
                'url': url,
                'status': 'failed',
                'duration_ms': duration * 1000
            })
        
        return article
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error({
            'url': url,
            'status': 'error',
            'duration_ms': duration * 1000,
            'error': str(e)
        })
        return None
```

---

## Testing & Validation

```python
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
```

---

## Key Configuration Summary

```python
JINA_CONFIG = {
    'base_url': 'https://r.jina.ai/',
    'timeout': 10,  # seconds
    'max_retries': 3,
    'delay_between_requests': 0.05,  # 50ms (20 req/sec)
    'max_parallel_workers': 5,  # for parallel processing
    'max_text_length': 15000,  # characters (~3750 tokens)
    'min_content_length': 200,  # minimum viable article length
    'headers': {
        'X-Return-Format': 'markdown',
        'X-With-Links-Summary': 'false',
        'X-With-Images-Summary': 'false',
        'X-Timeout': '10'
    }
}
```

---

## Troubleshooting

**Issue: Low success rate**
- Check URLs are valid and accessible
- Some sites block automated access
- Try increasing timeout
- Implement fallback to trafilatura

**Issue: Rate limiting (429 errors)**
- Reduce parallel workers
- Increase delay between requests
- Implement exponential backoff

**Issue: Truncated articles**
- Increase `max_text_length` if needed
- Claude can handle ~4000 tokens (~16000 chars)

**Issue: Slow fetching**
- Use parallel processing
- Reduce timeout for faster failures
- Cache successful fetches

---

## Final Recommendation

**Settings for production:**
- Timeout: 10 seconds
- Max retries: 3
- Delay: 50ms between requests
- Parallel workers: 5
- Text limit: 15,000 characters

This balances speed, reliability, and cost for processing ~150 approved articles in under 3 seconds.
