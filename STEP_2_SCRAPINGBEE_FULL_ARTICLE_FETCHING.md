# STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING

## Overview
Step 2 fetches complete article text for approved articles from Step 1 using ScrapingBee API, which bypasses anti-bot protection, JavaScript rendering, and paywalls.

## Key Features
- **Service**: ScrapingBee API (professional web scraping)
- **Input**: ~100 approved articles with URLs from Step 1
- **Output**: ~100 full articles with extracted text
- **Cost**: ~$0.05 per 100 articles
- **Time**: ~1-2 minutes (sequential) or ~30 seconds (parallel)
- **Success Rate**: ~99%

## Configuration Options
- **Render JS**: False (1 credit) vs True (10 credits)
- **Premium Proxy**: False (1 credit) vs True (25 credits)
- **Block Resources**: True (blocks images/CSS for speed)
- **Timeout**: 30 seconds per request
- **Max Retries**: 3 attempts with exponential backoff
- **Parallel Workers**: 5 concurrent requests (configurable)

## Content Extraction
Uses two methods for robust content extraction:

### Primary: Trafilatura
- Best for news articles
- Extracts clean, readable text
- Handles various HTML structures
- Removes ads and navigation

### Fallback: BeautifulSoup
- Used when Trafilatura fails
- Removes unwanted elements (scripts, styles, nav)
- Finds article content in semantic HTML
- Cleans up whitespace

## Fetching Modes

### Sequential Fetching
- **Speed**: ~2 minutes for 100 articles
- **Reliability**: Higher (no rate limiting issues)
- **Use Case**: Conservative rate limiting
- **Delay**: 0.1 seconds between requests

### Parallel Fetching (Recommended)
- **Speed**: ~30-60 seconds for 100 articles
- **Reliability**: High (99% success rate)
- **Use Case**: Production environments
- **Workers**: 5 concurrent threads

## Cost Analysis

### ScrapingBee Pricing
- **Free Plan**: 1,000 credits
- **Freelance**: $49/month for 150,000 credits
- **Startup**: $99/month for 350,000 credits

### Credit Usage
- **Standard Request**: 1 credit
- **With JavaScript Rendering**: 10 credits
- **With Premium Proxy**: 25 credits

### Cost for 100 Articles
- **Standard (no JS)**: 100 credits = $0.033 (~3 cents)
- **With JS Rendering**: 1,000 credits = $0.33 (33 cents)

## Usage Example
```python
from step2_scrapingbee_full_article_fetching import ScrapingBeeArticleFetcher, FetcherConfig

# Initialize fetcher
fetcher = ScrapingBeeArticleFetcher(
    api_key="YOUR_SCRAPINGBEE_API_KEY",
    config=FetcherConfig(
        render_js=False,  # Use True for JavaScript-heavy sites
        parallel_workers=5,
        max_text_length=15000
    )
)

# Fetch articles (parallel is faster)
full_articles = fetcher.fetch_batch_parallel(approved_articles)

# OR use sequential for conservative rate limiting
# full_articles = fetcher.fetch_batch_sequential(approved_articles)
```

## Output Format
Each fetched article contains:
- `url`: Original article URL
- `title`: Extracted article title
- `text`: Full article text (clean, readable)
- `text_length`: Character count
- `published_time`: Publish timestamp (if available)
- `source`: From Step 1
- `score`: From Step 1
- `category`: From Step 1

## Text Length Limits
- **Maximum**: 15,000 characters (~3,750 tokens)
- **Minimum**: 200 characters (viable article length)
- **Average**: ~3,000 characters (~750 tokens)
- **Truncation**: Content truncated if too long for Claude processing

## Error Handling
- **Authentication Errors**: Invalid API key
- **Rate Limiting**: Exponential backoff retry
- **Timeouts**: Configurable timeout with retries
- **Content Issues**: Fallback extraction methods
- **Network Errors**: Retry with increasing delays

## Site-Specific Handling
Some sites require special configuration:

### JavaScript Required
- Medium.com
- Forbes.com
- Wired.com

### Premium Proxy Required
- NYTimes.com
- Wall Street Journal
- Financial Times

## Integration
After Step 2 completes:
- Pass full articles to Step 3
- Each article has complete text content
- Ready for AI processing in subsequent steps
- Maintains metadata from Step 1

## Troubleshooting

### Low Success Rate (<90%)
- Enable JavaScript rendering for dynamic sites
- Use premium proxy for blocked datacenter IPs
- Check if sites changed their structure

### High Costs
- Minimize JavaScript rendering usage
- Avoid premium proxies unless necessary
- Test with free tier first

### Timeout Errors
- Increase timeout value (default 30s)
- Some sites are naturally slow
- Use parallel fetching to mask slow sites

### Empty Content
- Site may require JavaScript rendering
- Try different extraction method
- Verify URL accessibility in browser


