"""Scraping engine for VC Scout.

Uses Playwright to render JS-heavy Turkish startup directory pages,
then extracts company information with BeautifulSoup.
"""

import asyncio
import re
from dataclasses import dataclass, field
from typing import Optional

from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

import httpx


@dataclass
class ScrapedCompany:
    """Raw company data extracted from a page."""
    name: str
    description: str = ""
    website: str = ""
    industry: str = ""
    location: str = ""
    founded_year: str = ""
    funding_stage: str = ""
    funding_amount: str = ""
    source_url: str = ""
    source_name: str = ""


async def fetch_page_html(url: str, use_playwright: bool = True) -> str:
    """Fetch the full rendered HTML of a page.

    Uses Playwright for JS-rendered sites, falls back to httpx for static ones.
    """
    if use_playwright and PLAYWRIGHT_AVAILABLE:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            page.set_default_timeout(30000)
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                # Wait a bit for dynamic content
                await page.wait_for_timeout(2000)
                # Scroll down to trigger lazy loading
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1000)
                html = await page.content()
            except Exception as e:
                print(f"Playwright failed for {url}: {e}, falling back to httpx")
                html = await _fetch_with_httpx(url)
            finally:
                await browser.close()
            return html
    else:
        return await _fetch_with_httpx(url)


async def _fetch_with_httpx(url: str) -> str:
    """Simple HTTP fetch for static pages."""
    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36"
        }
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text


def extract_companies_from_html(html: str, source_url: str, source_name: str) -> list[ScrapedCompany]:
    """Extract company data from HTML using common patterns.

    This uses a generic extraction approach that works across many
    startup directory layouts. It looks for common patterns:
    - Card/list layouts with company names, descriptions
    - Links to company profiles
    - Industry/category tags
    """
    soup = BeautifulSoup(html, "lxml")
    companies = []

    # Strategy 1: Look for article/card patterns (most common in directories)
    card_selectors = [
        "article", ".card", ".company-card", ".startup-card",
        ".listing-item", ".company-item", ".post-item",
        "[class*='company']", "[class*='startup']", "[class*='listing']",
        ".portfolio-item", ".grid-item", ".list-item",
    ]

    cards = []
    for selector in card_selectors:
        found = soup.select(selector)
        if found and len(found) > 1:  # Multiple cards = likely a listing
            cards = found
            break

    if cards:
        for card in cards:
            company = _extract_from_card(card, source_url, source_name)
            if company and company.name:
                companies.append(company)

    # Strategy 2: If no cards found, look for table rows
    if not companies:
        rows = soup.select("table tbody tr")
        for row in rows:
            company = _extract_from_table_row(row, source_url, source_name)
            if company and company.name:
                companies.append(company)

    # Strategy 3: Look for heading + description pairs
    if not companies:
        companies = _extract_from_headings(soup, source_url, source_name)

    return companies


def _extract_from_card(card, source_url: str, source_name: str) -> Optional[ScrapedCompany]:
    """Extract company info from a card-like element."""
    # Find company name: usually in a heading or strong tag
    name = ""
    for tag in card.select("h1, h2, h3, h4, h5, .title, .name, [class*='name'], [class*='title']"):
        text = tag.get_text(strip=True)
        if text and len(text) > 1 and len(text) < 200:
            name = text
            break

    if not name:
        # Try the first link text
        link = card.select_one("a")
        if link:
            name = link.get_text(strip=True)

    if not name or len(name) < 2:
        return None

    # Find description
    description = ""
    for tag in card.select("p, .description, .excerpt, .summary, [class*='desc']"):
        text = tag.get_text(strip=True)
        if text and len(text) > 10:
            description = text[:500]
            break

    # Find website link
    website = ""
    for link in card.select("a[href]"):
        href = link.get("href", "")
        if href and not href.startswith("#") and "http" in href:
            # Skip source-internal links
            if source_url not in href:
                website = href
                break

    # Find industry/category
    industry = ""
    for tag in card.select(".category, .tag, .industry, [class*='category'], [class*='tag'], [class*='industry'], .badge"):
        text = tag.get_text(strip=True)
        if text and len(text) < 100:
            industry = text
            break

    # Find location
    location = ""
    for tag in card.select(".location, [class*='location'], [class*='city'], [class*='country']"):
        text = tag.get_text(strip=True)
        if text:
            location = text
            break

    return ScrapedCompany(
        name=name,
        description=description,
        website=website,
        industry=industry,
        location=location,
        source_url=source_url,
        source_name=source_name,
    )


def _extract_from_table_row(row, source_url: str, source_name: str) -> Optional[ScrapedCompany]:
    """Extract company info from a table row."""
    cells = row.select("td")
    if len(cells) < 2:
        return None

    name = cells[0].get_text(strip=True)
    description = cells[1].get_text(strip=True) if len(cells) > 1 else ""
    industry = cells[2].get_text(strip=True) if len(cells) > 2 else ""
    location = cells[3].get_text(strip=True) if len(cells) > 3 else ""

    website = ""
    link = row.select_one("a[href]")
    if link:
        href = link.get("href", "")
        if href and "http" in href:
            website = href

    if not name or len(name) < 2:
        return None

    return ScrapedCompany(
        name=name,
        description=description[:500],
        website=website,
        industry=industry,
        location=location,
        source_url=source_url,
        source_name=source_name,
    )


def _extract_from_headings(soup, source_url: str, source_name: str) -> list[ScrapedCompany]:
    """Last resort: extract from h2/h3 headings with following paragraphs."""
    companies = []
    for heading in soup.select("h2, h3"):
        name = heading.get_text(strip=True)
        if not name or len(name) < 2 or len(name) > 200:
            continue

        # Get next sibling paragraph as description
        description = ""
        next_el = heading.find_next_sibling()
        if next_el and next_el.name == "p":
            description = next_el.get_text(strip=True)[:500]

        # Find any link
        website = ""
        link = heading.select_one("a[href]")
        if link:
            website = link.get("href", "")

        companies.append(ScrapedCompany(
            name=name,
            description=description,
            website=website,
            source_url=source_url,
            source_name=source_name,
        ))

    return companies


def filter_companies_by_topics(
    companies: list[ScrapedCompany],
    topics: list[str],
) -> list[ScrapedCompany]:
    """Filter companies whose description or industry matches any active topic.

    If no topics are provided, returns all companies (no filtering).
    """
    if not topics:
        return companies

    topic_patterns = [re.compile(re.escape(t), re.IGNORECASE) for t in topics]
    filtered = []

    for company in companies:
        searchable = f"{company.name} {company.description} {company.industry}".lower()
        for pattern in topic_patterns:
            if pattern.search(searchable):
                filtered.append(company)
                break

    return filtered


async def scrape_source(
    url: str,
    source_name: str,
    topics: list[str] | None = None,
    use_playwright: bool = True,
) -> list[ScrapedCompany]:
    """Full pipeline: fetch page -> extract companies -> filter by topics."""
    html = await fetch_page_html(url, use_playwright=use_playwright)
    companies = extract_companies_from_html(html, url, source_name)

    if topics:
        companies = filter_companies_by_topics(companies, topics)

    return companies
