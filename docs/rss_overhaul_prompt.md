# RSS Feed Overhaul - Implementation Prompt

You are tasked with overhauling `rss_sources.py`. This document tells you exactly what to delete and what to add. Follow it precisely.

---

## FILE FORMAT

`rss_sources.py` contains a `RSS_FEEDS` list of dictionaries:
```python
{'name': 'Feed Name', 'url': 'https://...', 'category': 'category_name', 'tier': 'premium'}
```

Some entries have special fields — **preserve these on feeds you're keeping**:
- `'image_size': 'largest'` — Guardian and ABC News feeds
- `'fetch_image_from_website': True` — CBS News feeds and some humor feeds
- `'country': 'Country'` — country-specific feeds

The file ends with `ALL_SOURCES` tuple generation and a `__main__` stats block — **keep those unchanged**.

---

## IMPORTANT RULES — READ BEFORE STARTING

1. **DO NOT touch any existing sports feeds** — Keep all 26 sports feeds exactly as they are (only MMA Fighting is removed — it's in the broken list).
2. **DO NOT touch any country-specific feeds** (India, Turkiye, China, Russia, Ukraine, Germany, France, Spain, Italy, Japan, Australia, Canada) — Keep ALL of them.
3. **DO NOT touch France 24 feeds** — Keep all 6.
4. **DO NOT touch existing gaming feeds** — Keep all 9 originals.
5. **DO NOT delete MIT Technology Review** — it's a separate publication from MIT News. Only delete the MIT News topic sub-feeds listed below.
6. Keep the `ALL_SOURCES` tuple generation and `__main__` block at the bottom unchanged.
7. Organize new feeds into clearly labeled sections with `# ========` comment headers.
8. **Move WWD** from consumer category to fashion category (change its category field to `'fashion'` and rename from `'WWD (Luxury Fashion)'` to `'WWD'`). Do NOT add a second WWD entry.

---

## PART 1: FEEDS TO DELETE (~137 feeds)

Find each feed by its `name` field in the file and remove the entire dictionary entry.

### 1. Broken/Empty Feeds (50 feeds)

These return 0 entries when fetched. Delete all:

```
Reuters World
Reuters Breaking News
Associated Press Top News
Associated Press International
Associated Press US News
Agence France-Presse (AFP)
The New York Times Sports
USA Today
Los Angeles Times
The Times (UK)
The Economist World
Deutsche Welle Science
The Australian
Toronto Star
Globe and Mail (Canada)
Haaretz
The Marshall Project
Forbes
Harvard Business Review
Ad Age
World Trade Organization News
Scientific American
Stanford News
Johns Hopkins Medicine
Mayo Clinic News
Harvard Medical School
NASA Climate
NOAA News
ACS News
CERN
World Bank News
IMF News
OECD News
Forbes Billionaires
Forbes Lifestyle
Mansion Global
Business Insider Retail
Business Insider Personal Finance
Statista Chart of the Day
Sports Business Journal
TechCrunch Startups
Times Higher Education
Politico Picks
CBC Top Stories
CBC World
Caixin Global
RT (Russia Today)
Le Figaro
CBC Canada
MMA Fighting
```

Note: For `Forbes`, delete the main Forbes feed (url contains `forbes.com/real-time/feed2/`). There may be other Forbes feeds — only delete the main broken one plus Forbes Billionaires and Forbes Lifestyle.

### 2. DW Sub-feeds (8 feeds)

Keep ONLY `Deutsche Welle` (the main feed at `rss-en-all`). Delete these 8:

```
Deutsche Welle Top Stories
Deutsche Welle World
Deutsche Welle EU
Deutsche Welle Africa
Deutsche Welle Business
Deutsche Welle Environment
Deutsche Welle Sports
Deutsche Welle Asia
```

### 3. CBS Sub-section Feeds (8 feeds)

Keep `CBS News Main`, `CBS News World`, and `CBS News US`. Delete these 8:

```
CBS News Politics
CBS News Health
CBS News MoneyWatch
CBS News Science
CBS News Technology
CBS News Entertainment
CBS News Space
CBS News Investigates
```

### 4. NYT Regional/Topic Feeds (5 feeds)

Keep: NYT World, US, Homepage, Technology, Science, Climate, Space, Health. Delete these 5:

```
The New York Times Africa
The New York Times Americas
The New York Times Asia Pacific
The New York Times Europe
The New York Times Middle East
```

(NYT Sports is already in the broken list above.)

### 5. Fox News Sub-sections (5 feeds)

Keep `Fox News Latest`, `Fox News World`, and `Fox News Tech`. Delete these 5:

```
Fox News Politics
Fox News Science
Fox News Health
Fox News Sports
Fox News Travel
```

### 6. Sky News Sub-sections (5 feeds)

Keep `Sky News Home` and `Sky News World`. Delete these 5:

```
Sky News Business
Sky News Politics
Sky News Technology
Sky News Entertainment
Sky News Strange
```

### 7. Guardian Sub-sections (2 feeds)

Keep `The Guardian UK`, `The Guardian World`, and `Guardian Wildlife`. Delete:

```
The Guardian Global Development
The Guardian UK Culture
```

### 8. MIT News Topic Feeds (27 feeds)

Keep ONLY: `MIT News`, `MIT Research`, `MIT Artificial Intelligence`, and `MIT Technology Review`.

Delete these 27 MIT News sub-topic feeds:

```
MIT Architecture
MIT Biology & Genetics
MIT Neuroscience
MIT Business
MIT Chemistry
MIT Chemical Engineering
MIT Civil Engineering
MIT Climate & Sustainability
MIT Earth & Atmospheric Sciences
MIT Economics
MIT Energy
MIT Environment
MIT Health Sciences
MIT History
MIT Humanities
MIT Materials Science
MIT Mathematics
MIT Mechanical Engineering
MIT Nanotech
MIT Nuclear Engineering
MIT Oceans
MIT Physics
MIT Political Science
MIT Real Estate
MIT Robotics
MIT Space
MIT Science Technology & Society
```

### 9. Eurostat Feeds (9 feeds)

Delete ALL 9:

```
Eurostat Press Releases
Eurostat Population & Social
Eurostat General Statistics
Eurostat Economy & Finance
Eurostat Industry & Commerce
Eurostat Transport
Eurostat External Trade
Eurostat Environment & Energy
Eurostat Research & Development
```

### 10. Academic Journals (4 feeds)

```
PNAS
Cell
The Lancet
New England Journal of Medicine
```

### 11. High-Cost / Low-Value Feeds (5 feeds)

```
Physics World
Longevity Technology
CDC
WHO News
IPCC
```

### 12. Automotive Reduction (5 feeds)

Keep: Car and Driver, The Drive, Electrek, InsideEVs, Hagerty, Carscoops, Motorsport.com, Autocar, Jalopnik, Road and Track (10 feeds).

Delete these 5:

```
CarBuzz
Motor1
Bring a Trailer
Autosport
RACER
```

### 13. Other Low-Value (3 feeds)

```
Washington Post Entertainment
Washington Post Business
Daily Mail Money
```

### 14. Duplicate TechCrunch

TechCrunch appears TWICE (once under business, once under technology). Delete the one under business. Keep the technology one.

---

## PART 2: FEEDS TO ADD (~134 feeds)

All feeds below have been tested and verified working with recent content. Add them to `rss_sources.py` in clearly labeled sections.

### SPORTS — 7 new feeds

```python
# ========================================
# SPORTS - ADDITIONAL
# ========================================
{'name': 'Yahoo Sports', 'url': 'https://sports.yahoo.com/rss/', 'category': 'sports', 'tier': 'premium'},
{'name': 'Sky Sports News', 'url': 'https://www.skysports.com/rss/12040', 'category': 'sports', 'tier': 'premium'},
{'name': 'FourFourTwo', 'url': 'https://www.fourfourtwo.com/feeds/all', 'category': 'sports', 'tier': 'premium'},
{'name': 'CBS Sports', 'url': 'https://www.cbssports.com/rss/headlines/', 'category': 'sports', 'tier': 'premium'},
{'name': 'Talksport', 'url': 'https://talksport.com/feed/', 'category': 'sports', 'tier': 'premium'},
{'name': 'Wrestling Inc', 'url': 'https://www.wrestlinginc.com/feed/', 'category': 'sports', 'tier': 'standard'},
{'name': 'ClutchPoints', 'url': 'https://clutchpoints.com/feed/', 'category': 'sports', 'tier': 'premium'},
```

### GAMING — 13 new feeds

```python
# ========================================
# GAMING - ADDITIONAL
# ========================================
{'name': 'Dexerto', 'url': 'https://www.dexerto.com/feed/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'Dot Esports', 'url': 'https://dotesports.com/feed', 'category': 'gaming', 'tier': 'premium'},
{'name': 'Game Rant', 'url': 'https://gamerant.com/feed/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'GamesRadar', 'url': 'https://www.gamesradar.com/rss/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'TheGamer', 'url': 'https://www.thegamer.com/feed/', 'category': 'gaming', 'tier': 'standard'},
{'name': 'Destructoid', 'url': 'https://www.destructoid.com/feed/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'PCGamesN', 'url': 'https://www.pcgamesn.com/mainrss.xml', 'category': 'gaming', 'tier': 'premium'},
{'name': 'Push Square', 'url': 'https://www.pushsquare.com/feeds/latest', 'category': 'gaming', 'tier': 'standard'},
{'name': 'Pure Xbox', 'url': 'https://www.purexbox.com/feeds/latest', 'category': 'gaming', 'tier': 'standard'},
{'name': 'Siliconera', 'url': 'https://www.siliconera.com/feed/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'Escapist Magazine', 'url': 'https://www.escapistmagazine.com/feed/', 'category': 'gaming', 'tier': 'premium'},
{'name': 'NintendoEverything', 'url': 'https://nintendoeverything.com/feed/', 'category': 'gaming', 'tier': 'standard'},
{'name': 'Esports Insider', 'url': 'https://esportsinsider.com/feed', 'category': 'gaming', 'tier': 'premium'},
```

### ENTERTAINMENT — 20 new feeds

```python
# ========================================
# CELEBRITY & GOSSIP
# ========================================
{'name': 'E! Online', 'url': 'https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Page Six', 'url': 'https://pagesix.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Us Weekly', 'url': 'https://www.usmagazine.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Hollywood Life', 'url': 'https://hollywoodlife.com/feed/', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'PopSugar', 'url': 'https://www.popsugar.com/feed', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'Celebitchy', 'url': 'https://www.celebitchy.com/feed/', 'category': 'entertainment', 'tier': 'standard'},

# ========================================
# TV & STREAMING NEWS
# ========================================
{'name': 'TV Line', 'url': 'https://tvline.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{"name": "What's on Netflix", "url": "https://www.whats-on-netflix.com/feed/", "category": "entertainment", "tier": "premium"},
{'name': 'Decider', 'url': 'https://decider.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Den of Geek', 'url': 'https://www.denofgeek.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'SlashFilm', 'url': 'https://www.slashfilm.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'The Wrap', 'url': 'https://www.thewrap.com/feed/', 'category': 'entertainment', 'tier': 'premium'},

# ========================================
# MOVIES / COMICS / FANDOM
# ========================================
{'name': 'ScreenCrush', 'url': 'https://screencrush.com/feed/', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'ComicBook.com', 'url': 'https://comicbook.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Giant Freakin Robot', 'url': 'https://www.giantfreakinrobot.com/feed', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'Nerdist', 'url': 'https://nerdist.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'Looper', 'url': 'https://www.looper.com/feed/', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'CBR', 'url': 'https://www.cbr.com/feed/', 'category': 'entertainment', 'tier': 'premium'},
{'name': 'MovieWeb', 'url': 'https://movieweb.com/feed/', 'category': 'entertainment', 'tier': 'standard'},
{'name': 'Consequence', 'url': 'https://consequence.net/feed/', 'category': 'entertainment', 'tier': 'premium'},
```

### SCIENCE — 15 new feeds

```python
# ========================================
# SCIENCE - POPULAR / EXPLAINER
# ========================================
{'name': 'Popular Mechanics', 'url': 'https://www.popularmechanics.com/rss/all.xml/', 'category': 'science', 'tier': 'premium'},
{'name': 'Smithsonian Smart News', 'url': 'https://www.smithsonianmag.com/rss/smart-news/', 'category': 'science', 'tier': 'premium'},
{'name': 'Futurism', 'url': 'https://futurism.com/feed', 'category': 'science', 'tier': 'premium'},
{'name': 'ScienceAlert', 'url': 'https://www.sciencealert.com/feed', 'category': 'science', 'tier': 'premium'},
{'name': 'Ars Technica Science', 'url': 'https://arstechnica.com/science/feed/', 'category': 'science', 'tier': 'premium'},
{'name': 'Interesting Engineering', 'url': 'https://interestingengineering.com/feed', 'category': 'science', 'tier': 'premium'},
{'name': 'Aeon', 'url': 'https://aeon.co/feed.rss', 'category': 'science', 'tier': 'premium'},
{'name': 'New Atlas', 'url': 'https://newatlas.com/index.rss', 'category': 'science', 'tier': 'premium'},
{'name': 'Mental Floss', 'url': 'https://www.mentalfloss.com/feed', 'category': 'science', 'tier': 'premium'},
{'name': 'Big Think', 'url': 'https://bigthink.com/feed/', 'category': 'science', 'tier': 'premium'},
{'name': 'The Conversation', 'url': 'https://theconversation.com/us/articles.atom', 'category': 'science', 'tier': 'premium'},
{'name': 'ZME Science', 'url': 'https://www.zmescience.com/feed/', 'category': 'science', 'tier': 'premium'},
{'name': 'RealClearScience', 'url': 'https://www.realclearscience.com/index.xml', 'category': 'science', 'tier': 'standard'},
{'name': 'Knowable Magazine', 'url': 'https://knowablemagazine.org/rss', 'category': 'science', 'tier': 'premium'},
{'name': 'Nautilus', 'url': 'https://nautil.us/feed/', 'category': 'science', 'tier': 'premium'},
```

### TECHNOLOGY — 15 new feeds

```python
# ========================================
# AI & MACHINE LEARNING
# ========================================
{'name': 'The Verge AI', 'url': 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'category': 'technology', 'tier': 'premium'},
{'name': 'Ars Technica AI', 'url': 'https://arstechnica.com/ai/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'AI News', 'url': 'https://www.artificialintelligence-news.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'SiliconAngle AI', 'url': 'https://siliconangle.com/category/ai/feed/', 'category': 'technology', 'tier': 'premium'},

# ========================================
# TECH & GADGETS
# ========================================
{"name": "Tom's Guide", "url": "https://www.tomsguide.com/feeds/all", "category": "technology", "tier": "premium"},
{"name": "Tom's Hardware", "url": "https://www.tomshardware.com/feeds/all", "category": "technology", "tier": "premium"},
{'name': '9to5Mac', 'url': 'https://9to5mac.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': '9to5Google', 'url': 'https://9to5google.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'MacRumors', 'url': 'https://feeds.macrumors.com/MacRumors-All', 'category': 'technology', 'tier': 'premium'},
{'name': 'Android Authority', 'url': 'https://www.androidauthority.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'CNET', 'url': 'https://www.cnet.com/rss/news/', 'category': 'technology', 'tier': 'premium'},
{'name': 'Digital Trends', 'url': 'https://www.digitaltrends.com/feed/', 'category': 'technology', 'tier': 'premium'},

# ========================================
# TECHNOLOGY - GENERAL
# ========================================
{'name': 'How-To Geek', 'url': 'https://www.howtogeek.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'Ars Technica', 'url': 'https://arstechnica.com/feed/', 'category': 'technology', 'tier': 'premium'},
{'name': 'TechRadar', 'url': 'https://www.techradar.com/rss', 'category': 'technology', 'tier': 'premium'},
```

### FASHION & BEAUTY — 15 new feeds (but 14 actually new — see WWD note)

**IMPORTANT**: WWD already exists in the file under consumer as `'WWD (Luxury Fashion)'`. Change its category to `'fashion'` and rename it to `'WWD'`. Do NOT add a second WWD. So only 14 of these are brand new entries:

```python
# ========================================
# FASHION & BEAUTY
# ========================================
{'name': 'Allure', 'url': 'https://www.allure.com/feed/rss', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Glamour', 'url': 'https://www.glamour.com/feed/rss', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Fashionista', 'url': 'https://fashionista.com/.rss/full/', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Who What Wear', 'url': 'https://www.whowhatwear.com/rss', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Elle', 'url': 'https://www.elle.com/rss/all.xml/', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Cosmopolitan', 'url': 'https://www.cosmopolitan.com/rss/all.xml/', 'category': 'fashion', 'tier': 'premium'},
{"name": "Harper's Bazaar", "url": "https://www.harpersbazaar.com/rss/all.xml/", "category": "fashion", "tier": "premium"},
{'name': 'StyleCaster', 'url': 'https://stylecaster.com/feed/', 'category': 'fashion', 'tier': 'standard'},
{'name': 'Coveteur', 'url': 'https://coveteur.com/feed', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Bustle', 'url': 'https://www.bustle.com/rss', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Teen Vogue', 'url': 'https://www.teenvogue.com/feed/rss', 'category': 'fashion', 'tier': 'premium'},
{'name': 'i-D', 'url': 'https://i-d.co/feed/', 'category': 'fashion', 'tier': 'premium'},
{'name': 'Dazed', 'url': 'https://www.dazeddigital.com/rss', 'category': 'fashion', 'tier': 'premium'},
# WWD: DO NOT ADD — just change the existing WWD entry's category to 'fashion' and name to 'WWD'
{'name': 'Hypebeast', 'url': 'https://hypebeast.com/feed', 'category': 'fashion', 'tier': 'premium'},
```

### FOOD — 4 new feeds

```python
# ========================================
# FOOD - ADDITIONAL
# ========================================
{"name": "Bon Appetit", "url": "https://www.bonappetit.com/feed/rss", "category": "food", "tier": "premium"},
{'name': 'Delish', 'url': 'https://www.delish.com/rss/all.xml/', 'category': 'food', 'tier': 'premium'},
{'name': 'Damn Delicious', 'url': 'https://damndelicious.net/feed/', 'category': 'food', 'tier': 'standard'},
{'name': 'Pinch of Yum', 'url': 'https://pinchofyum.com/feed', 'category': 'food', 'tier': 'standard'},
```

### BUSINESS — 5 new feeds

```python
# ========================================
# PERSONAL FINANCE & MARKETS
# ========================================
{'name': 'NerdWallet', 'url': 'https://www.nerdwallet.com/blog/feed/', 'category': 'business', 'tier': 'premium'},
{'name': 'Kiplinger', 'url': 'https://www.kiplinger.com/feed/all', 'category': 'business', 'tier': 'premium'},
{'name': 'MarketWatch', 'url': 'https://www.marketwatch.com/rss/topstories', 'category': 'business', 'tier': 'premium'},
{'name': 'Yahoo Finance', 'url': 'https://finance.yahoo.com/news/rssindex', 'category': 'business', 'tier': 'premium'},
{'name': 'Money Magazine', 'url': 'https://money.com/feed/', 'category': 'business', 'tier': 'premium'},
```

### CONSUMER — 5 new feeds

```python
# ========================================
# LIFESTYLE & REVIEWS
# ========================================
{'name': 'Lifehacker', 'url': 'https://lifehacker.com/feed/rss', 'category': 'consumer', 'tier': 'premium'},
{'name': 'Wirecutter', 'url': 'https://www.nytimes.com/wirecutter/feed/', 'category': 'consumer', 'tier': 'premium'},
{'name': 'Upworthy', 'url': 'https://www.upworthy.com/feed', 'category': 'consumer', 'tier': 'standard'},
{'name': 'Gizmodo', 'url': 'https://gizmodo.com/feed/rss', 'category': 'consumer', 'tier': 'premium'},
{'name': 'Mashable', 'url': 'https://mashable.com/feeds/rss/all', 'category': 'consumer', 'tier': 'premium'},
```

### MUSIC — 8 new feeds

```python
# ========================================
# MUSIC - ADDITIONAL
# ========================================
{'name': 'Billboard', 'url': 'https://www.billboard.com/feed/', 'category': 'music', 'tier': 'premium'},
{'name': 'BrooklynVegan', 'url': 'https://www.brooklynvegan.com/feed/', 'category': 'music', 'tier': 'standard'},
{'name': 'The Line of Best Fit', 'url': 'https://www.thelineofbestfit.com/feed', 'category': 'music', 'tier': 'standard'},
{'name': 'Soompi', 'url': 'https://www.soompi.com/feed', 'category': 'music', 'tier': 'premium'},
{'name': 'Far Out Magazine', 'url': 'https://faroutmagazine.co.uk/feed/', 'category': 'music', 'tier': 'standard'},
{'name': 'Louder Sound', 'url': 'https://www.loudersound.com/feeds/all', 'category': 'music', 'tier': 'premium'},
{'name': 'UPROXX Music', 'url': 'https://uproxx.com/music/feed/', 'category': 'music', 'tier': 'standard'},
{'name': 'Revolver Mag', 'url': 'https://www.revolvermag.com/feed', 'category': 'music', 'tier': 'standard'},
```

### AUTOMOTIVE — 1 new feed

```python
# ========================================
# AUTOMOTIVE - ADDITIONAL
# ========================================
{'name': 'The Autopian', 'url': 'https://www.theautopian.com/feed/', 'category': 'automotive', 'tier': 'standard'},
```

### HUMOR — 11 new feeds (NEW CATEGORY)

This is a brand new category. All 11 feeds are new additions:

```python
# ========================================
# HUMOR (NEW CATEGORY)
# ========================================
{'name': 'The Onion', 'url': 'https://theonion.com/feed/', 'category': 'humor', 'tier': 'premium'},
{'name': 'BuzzFeed', 'url': 'https://www.buzzfeed.com/index.xml', 'category': 'humor', 'tier': 'premium'},
{'name': 'Bored Panda', 'url': 'https://www.boredpanda.com/feed/', 'category': 'humor', 'tier': 'premium'},
{'name': 'The Babylon Bee', 'url': 'https://babylonbee.com/feed', 'category': 'humor', 'tier': 'premium'},
{'name': 'The Hard Times', 'url': 'https://thehardtimes.net/feed/', 'category': 'humor', 'tier': 'standard', 'fetch_image_from_website': True},
{'name': 'ClickHole', 'url': 'https://clickhole.com/feed/', 'category': 'humor', 'tier': 'standard', 'fetch_image_from_website': True},
{'name': 'The Daily Mash', 'url': 'https://www.thedailymash.co.uk/feed', 'category': 'humor', 'tier': 'standard'},
{'name': 'The Beaverton', 'url': 'https://www.thebeaverton.com/feed/', 'category': 'humor', 'tier': 'standard'},
{'name': 'Points in Case', 'url': 'https://www.pointsincase.com/feed', 'category': 'humor', 'tier': 'standard'},
{'name': 'The Chive', 'url': 'https://thechive.com/feed/', 'category': 'humor', 'tier': 'standard'},
{'name': 'Reductress', 'url': 'https://reductress.com/feed/', 'category': 'humor', 'tier': 'standard', 'fetch_image_from_website': True},
```

### CRYPTO — 9 new feeds (NEW CATEGORY)

This is a brand new category. All 9 feeds are new additions:

```python
# ========================================
# CRYPTO (NEW CATEGORY)
# ========================================
{'name': 'CoinDesk', 'url': 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'category': 'crypto', 'tier': 'premium'},
{'name': 'CoinTelegraph', 'url': 'https://cointelegraph.com/rss', 'category': 'crypto', 'tier': 'premium'},
{'name': 'The Block', 'url': 'https://www.theblock.co/rss.xml', 'category': 'crypto', 'tier': 'premium'},
{'name': 'Decrypt', 'url': 'https://decrypt.co/feed', 'category': 'crypto', 'tier': 'premium'},
{'name': 'Bitcoin Magazine', 'url': 'https://bitcoinmagazine.com/.rss/full/', 'category': 'crypto', 'tier': 'premium'},
{'name': 'DL News', 'url': 'https://www.dlnews.com/arc/outboundfeeds/rss/', 'category': 'crypto', 'tier': 'premium'},
{'name': 'The Defiant', 'url': 'https://thedefiant.io/feed', 'category': 'crypto', 'tier': 'premium'},
{'name': 'Crypto Briefing', 'url': 'https://cryptobriefing.com/feed/', 'category': 'crypto', 'tier': 'premium'},
{'name': 'CryptoSlate', 'url': 'https://cryptoslate.com/feed/', 'category': 'crypto', 'tier': 'premium'},
```

### HISTORY — 2 new feeds

```python
# ========================================
# HISTORY - ADDITIONAL
# ========================================
{'name': 'The Collector', 'url': 'https://www.thecollector.com/feed/', 'category': 'history', 'tier': 'premium'},
{'name': 'The History Blog', 'url': 'https://www.thehistoryblog.com/feed', 'category': 'history', 'tier': 'standard'},
```

### SPACE — 3 new feeds

```python
# ========================================
# SPACE - ADDITIONAL
# ========================================
{'name': 'Universe Today', 'url': 'https://www.universetoday.com/feed', 'category': 'space', 'tier': 'premium'},
{'name': 'Space.com', 'url': 'https://www.space.com/feeds/all', 'category': 'space', 'tier': 'premium'},
{'name': 'SpaceFlightNow', 'url': 'https://spaceflightnow.com/feed/', 'category': 'space', 'tier': 'premium'},
```

---

## FINAL EXPECTED CATEGORY COUNTS

After all deletions, additions, and the WWD category move:

| Category | Target Count |
|----------|-------------|
| News | 101 |
| Science | 42 |
| Sports | 32 |
| Entertainment | 30 |
| Technology | 28 |
| Business | 27 |
| Food | 25 |
| Gaming | 22 |
| Fashion | 20 |
| Consumer | 17 |
| History | 12 |
| Music | 11 |
| Automotive | 11 |
| Humor | 11 |
| Crypto | 9 |
| Space | 6 |
| Travel | 5 |
| Design | 5 |
| Health | 5 |
| Nature | 4 |
| Pets | 2 |
| Outdoor | 2 |
| Home | 2 |
| Books | 2 |
| **TOTAL** | **~433** |

---

## VERIFICATION CHECKLIST

After making all changes, verify:

1. Run `python3 rss_sources.py` — check total count is ~433
2. Check category counts match the table above (especially news=101, sports=32, gaming=22, entertainment=30, science=42, technology=28, fashion=20, humor=11, crypto=9)
3. Country-specific feeds are ALL still present (India, Turkiye, China, Russia, Ukraine, Germany, France, Spain, Italy, Japan, Australia, Canada)
4. All 6 France 24 feeds still present
5. `ALL_SOURCES` line still works (no syntax errors)
6. No duplicate feed names (especially check TechCrunch only appears once)
7. MIT Technology Review was NOT deleted
8. All original sports feeds kept (only MMA Fighting removed — it was broken)
9. All 9 original gaming feeds kept
10. WWD moved from consumer to fashion (not duplicated)
11. No feeds with `'country'` field were touched
12. Special fields preserved: `image_size`, `fetch_image_from_website`, `country`
