"""
TEN NEWS - PREMIUM RSS SOURCES CONFIGURATION
Comprehensive collection of premium news sources
Organized by category and tier
"""

# MAJOR INTERNATIONAL NEWS AGENCIES
BREAKING_NEWS_SOURCES = [
    ('Reuters World', 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best'),
    ('Reuters Breaking News', 'https://www.reutersagency.com/feed/?best-topics=breaking-news'),
    ('Associated Press Top News', 'https://feeds.apnews.com/rss/apf-topnews'),
    ('Associated Press International', 'https://feeds.apnews.com/rss/apf-international'),
    ('Associated Press US News', 'https://feeds.apnews.com/rss/apf-usnews'),
    ('Agence France-Presse (AFP)', 'https://www.afp.com/en/news/rss'),
]

# US PREMIUM NEWS
US_NEWS_SOURCES = [
    ('The New York Times World', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'),
    ('The New York Times US', 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml'),
    ('The New York Times Homepage', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'),
    ('Washington Post World', 'https://feeds.washingtonpost.com/rss/world'),
    ('Washington Post National', 'https://feeds.washingtonpost.com/rss/national'),
    ('USA Today', 'https://www.usatoday.com/rss/'),
    ('Los Angeles Times', 'https://www.latimes.com/rss'),
    ('Chicago Tribune', 'https://www.chicagotribune.com/rss/'),
    ('The Boston Globe', 'https://www.bostonglobe.com/rss'),
]

# UK PREMIUM NEWS
UK_NEWS_SOURCES = [
    ('BBC News World', 'http://feeds.bbci.co.uk/news/world/rss.xml'),
    ('BBC News UK', 'http://feeds.bbci.co.uk/news/uk/rss.xml'),
    ('BBC News Top Stories', 'http://feeds.bbci.co.uk/news/rss.xml'),
    ('The Guardian World', 'https://www.theguardian.com/world/rss'),
    ('The Guardian UK', 'https://www.theguardian.com/uk-news/rss'),
    ('The Guardian US', 'https://www.theguardian.com/us-news/rss'),
    ('The Times (UK)', 'https://www.thetimes.co.uk/rss'),
    ('The Telegraph', 'https://www.telegraph.co.uk/rss.xml'),
    ('The Independent', 'https://www.independent.co.uk/rss'),
    ('The Economist World', 'https://www.economist.com/world/rss.xml'),
]

# INTERNATIONAL PREMIUM NEWS
INTERNATIONAL_NEWS_SOURCES = [
    ('Al Jazeera English', 'https://www.aljazeera.com/xml/rss/all.xml'),
    ('Deutsche Welle', 'https://rss.dw.com/xml/rss-en-all'),
    ('France 24', 'https://www.france24.com/en/rss'),
    ('Euronews', 'https://www.euronews.com/rss'),
    ('The Japan Times', 'https://www.japantimes.co.jp/feed/'),
    ('South China Morning Post', 'https://www.scmp.com/rss/91/feed'),
    ('The Straits Times', 'https://www.straitstimes.com/news/world/rss.xml'),
    ('The Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'),
    ('The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss'),
    ('The Sydney Morning Herald', 'https://www.smh.com.au/rss/feed.xml'),
    ('The Australian', 'https://www.theaustralian.com.au/feed/'),
    ('Toronto Star', 'https://www.thestar.com/rss'),
    ('Globe and Mail (Canada)', 'https://www.theglobeandmail.com/rss/'),
]

# PREMIUM NEWS MAGAZINES
NEWS_MAGAZINES_SOURCES = [
    ('TIME Magazine', 'https://time.com/feed/'),
    ('Newsweek', 'https://www.newsweek.com/rss'),
    ('The Atlantic', 'https://www.theatlantic.com/feed/all/'),
    ('The New Yorker', 'https://www.newyorker.com/feed/everything'),
    ('Vanity Fair', 'https://www.vanityfair.com/feed/rss'),
    ('Axios', 'https://www.axios.com/feeds/feed.rss'),
    ('ProPublica', 'https://www.propublica.org/feeds/propublica/main'),
]

# FINANCIAL NEWS LEADERS
FINANCIAL_SOURCES = [
    ('Bloomberg Markets', 'https://www.bloomberg.com/feed/sitemap_news.xml'),
    ('Financial Times', 'https://www.ft.com/?format=rss'),
    ('Financial Times Companies', 'https://www.ft.com/companies?format=rss'),
    ('The Economist Business', 'https://www.economist.com/business/rss.xml'),
    ('The Economist Finance', 'https://www.economist.com/finance-and-economics/rss.xml'),
    ('Wall Street Journal', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml'),
    ('Wall Street Journal Markets', 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml'),
    ('Barron\'s', 'https://www.barrons.com/rss'),
]

# BUSINESS NEWS & ANALYSIS
BUSINESS_SOURCES = [
    ('Forbes', 'https://www.forbes.com/real-time/feed2/'),
    ('Forbes Leadership', 'https://www.forbes.com/leadership/feed/'),
    ('Fortune', 'https://fortune.com/feed/'),
    ('Fortune 500', 'https://fortune.com/fortune500/feed/'),
    ('Business Insider', 'https://www.businessinsider.com/rss'),
    ('Business Insider Markets', 'https://markets.businessinsider.com/rss/news'),
    ('Fast Company', 'https://www.fastcompany.com/latest/rss'),
    ('Inc. Magazine', 'https://www.inc.com/rss/'),
    ('Entrepreneur', 'https://www.entrepreneur.com/latest.rss'),
    ('Harvard Business Review', 'https://hbr.org/feed'),
]

# MARKET & INVESTMENT NEWS
MARKET_SOURCES = [
    ('CNBC Top News', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'),
    ('CNBC Markets', 'https://www.cnbc.com/id/10000664/device/rss/rss.html'),
    ('CNBC Business', 'https://www.cnbc.com/id/10001147/device/rss/rss.html'),
    ('MarketWatch', 'https://www.marketwatch.com/rss/'),
    ('MarketWatch Markets', 'https://www.marketwatch.com/rss/marketpulse'),
    ('Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'),
    ('Seeking Alpha Market News', 'https://seekingalpha.com/feed.xml'),
    ('Investor\'s Business Daily', 'https://www.investors.com/feed/'),
    ('Morningstar', 'https://www.morningstar.com/rss'),
]

# GLOBAL BUSINESS NEWS
GLOBAL_BUSINESS_SOURCES = [
    ('Reuters Business', 'https://www.reutersagency.com/feed/?best-topics=business-finance'),
    ('Financial Times Global Economy', 'https://www.ft.com/global-economy?format=rss'),
    ('Nikkei Asia', 'https://asia.nikkei.com/rss'),
    ('South China Morning Post Business', 'https://www.scmp.com/rss/2/feed'),
]

# CRYPTOCURRENCY & FINTECH
CRYPTO_FINTECH_SOURCES = [
    ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    ('Cointelegraph', 'https://cointelegraph.com/rss'),
    ('The Block', 'https://www.theblockcrypto.com/rss.xml'),
    ('Decrypt', 'https://decrypt.co/feed'),
    ('Fintech News', 'https://www.fintechnews.org/feed/'),
]

# MAJOR TECH NEWS
TECHNOLOGY_SOURCES = [
    ('The Verge', 'https://www.theverge.com/rss/index.xml'),
    ('Wired', 'https://www.wired.com/feed/rss'),
    ('Wired Business', 'https://www.wired.com/feed/category/business/rss'),
    ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'),
    ('TechCrunch', 'https://techcrunch.com/feed/'),
    ('TechCrunch Startups', 'https://techcrunch.com/startups/feed/'),
    ('CNET News', 'https://www.cnet.com/rss/news/'),
    ('ZDNet', 'https://www.zdnet.com/news/rss.xml'),
    ('Engadget', 'https://www.engadget.com/rss.xml'),
    ('TechRadar', 'https://www.techradar.com/rss'),
    ('PCMag', 'https://www.pcmag.com/feed'),
    ('Tom\'s Hardware', 'https://www.tomshardware.com/feeds/all'),
    ('AnandTech', 'https://www.anandtech.com/rss/'),
]

# TECH INDUSTRY & BUSINESS
TECH_INDUSTRY_SOURCES = [
    ('MIT Technology Review', 'https://www.technologyreview.com/feed/'),
    ('IEEE Spectrum', 'https://spectrum.ieee.org/feeds/feed.rss'),
    ('VentureBeat', 'https://venturebeat.com/feed/'),
    ('The Next Web', 'https://thenextweb.com/feed/'),
    ('Mashable Tech', 'https://mashable.com/feeds/rss/tech'),
    ('Gizmodo', 'https://gizmodo.com/rss'),
    ('The Information', 'https://www.theinformation.com/feed'),
    ('Protocol', 'https://www.protocol.com/feeds/feed.rss'),
    ('Rest of World', 'https://restofworld.org/feed/latest/'),
]

# AI & MACHINE LEARNING
AI_ML_SOURCES = [
    ('Google AI Blog', 'https://blog.google/technology/ai/rss/'),
    ('DeepMind Blog', 'https://deepmind.google/blog/rss.xml'),
    ('OpenAI Blog', 'https://openai.com/blog/rss/'),
    ('Anthropic News', 'https://www.anthropic.com/news/rss'),
    ('MIT CSAIL', 'https://www.csail.mit.edu/news/rss.xml'),
    ('Stanford HAI', 'https://hai.stanford.edu/news/rss.xml'),
]

# DEVELOPER & PROGRAMMING
DEVELOPER_SOURCES = [
    ('GitHub Blog', 'https://github.blog/feed/'),
    ('Stack Overflow Blog', 'https://stackoverflow.blog/feed/'),
    ('Hacker News', 'https://hnrss.org/frontpage'),
    ('Slashdot', 'http://rss.slashdot.org/Slashdot/slashdotMain'),
]

# COMPANY TECH BLOGS
COMPANY_TECH_SOURCES = [
    ('Apple Newsroom', 'https://www.apple.com/newsroom/rss-feed.rss'),
    ('Microsoft News', 'https://news.microsoft.com/feed/'),
    ('Google Developers Blog', 'https://developers.googleblog.com/feeds/posts/default'),
    ('Meta Engineering', 'https://engineering.fb.com/feed/'),
    ('Netflix Tech Blog', 'https://netflixtechblog.com/feed'),
    ('Uber Engineering', 'https://eng.uber.com/feed/'),
    ('Amazon AWS News', 'https://aws.amazon.com/blogs/aws/feed/'),
    ('Spotify Engineering', 'https://engineering.atspotify.com/feed/'),
]

# CYBERSECURITY
CYBERSECURITY_SOURCES = [
    ('Krebs on Security', 'https://krebsonsecurity.com/feed/'),
    ('Schneier on Security', 'https://www.schneier.com/feed/atom/'),
    ('The Hacker News', 'https://feeds.feedburner.com/TheHackersNews'),
    ('Dark Reading', 'https://www.darkreading.com/rss_simple.asp'),
]

# TOP SCIENCE JOURNALS
SCIENCE_SOURCES = [
    ('Nature News', 'https://www.nature.com/nature.rss'),
    ('Nature Research Highlights', 'https://www.nature.com/nature/research-highlights.rss'),
    ('Science Magazine News', 'https://www.science.org/rss/news_current.xml'),
    ('Science Daily', 'https://www.sciencedaily.com/rss/all.xml'),
    ('PNAS', 'https://www.pnas.org/rss/current.xml'),
    ('Cell', 'https://www.cell.com/cell/current.rss'),
    ('PLOS Biology', 'https://journals.plos.org/plosbiology/feed/atom'),
    ('PLOS ONE', 'https://journals.plos.org/plosone/feed/atom'),
]

# NATURE FAMILY JOURNALS
NATURE_FAMILY_SOURCES = [
    ('Nature Medicine', 'https://www.nature.com/nm.rss'),
    ('Nature Biotechnology', 'https://www.nature.com/nbt.rss'),
    ('Nature Physics', 'https://www.nature.com/nphys.rss'),
    ('Nature Chemistry', 'https://www.nature.com/nchem.rss'),
    ('Nature Neuroscience', 'https://www.nature.com/neuro.rss'),
    ('Nature Genetics', 'https://www.nature.com/ng.rss'),
    ('Nature Climate Change', 'https://www.nature.com/nclimate.rss'),
    ('Nature Communications', 'https://www.nature.com/ncomms.rss'),
]

# POPULAR SCIENCE PUBLICATIONS
POPULAR_SCIENCE_SOURCES = [
    ('Scientific American', 'https://www.scientificamerican.com/feed/'),
    ('New Scientist', 'https://www.newscientist.com/feed/home'),
    ('Popular Science', 'https://www.popsci.com/feed/'),
    ('Popular Mechanics', 'https://www.popularmechanics.com/rss/all.xml/'),
    ('Discover Magazine', 'https://www.discovermagazine.com/rss'),
    ('Quanta Magazine', 'https://www.quantamagazine.org/feed/'),
    ('Smithsonian Magazine Science', 'https://www.smithsonianmag.com/rss/science/'),
    ('National Geographic Science', 'https://www.nationalgeographic.com/science/rss'),
]

# SPACE & ASTRONOMY
SPACE_ASTRONOMY_SOURCES = [
    ('NASA', 'https://www.nasa.gov/rss/dyn/breaking_news.rss'),
    ('NASA Science', 'https://science.nasa.gov/rss/science.rss'),
    ('ESA (European Space Agency)', 'https://www.esa.int/rssfeed/Our_Activities/Space_News'),
    ('Space.com', 'https://www.space.com/feeds/all'),
    ('Astronomy Magazine', 'https://www.astronomy.com/feed/'),
    ('Sky & Telescope', 'https://skyandtelescope.org/astronomy-news/feed/'),
]

# PHYSICS & MATHEMATICS
PHYSICS_MATH_SOURCES = [
    ('Physics World', 'https://physicsworld.com/feed/'),
    ('Phys.org', 'https://phys.org/rss-feed/'),
    ('APS Physics', 'https://physics.aps.org/feed'),
    ('Quanta Magazine Math', 'https://www.quantamagazine.org/tag/mathematics/feed/'),
]

# BIOLOGY & MEDICINE RESEARCH
BIOLOGY_MEDICINE_SOURCES = [
    ('The Lancet', 'https://www.thelancet.com/rssfeed/lancet_current.xml'),
    ('New England Journal of Medicine', 'https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm'),
    ('British Medical Journal (BMJ)', 'https://www.bmj.com/rss'),
    ('JAMA', 'https://jamanetwork.com/rss/site_3/1.xml'),
    ('Nature Medicine', 'https://www.nature.com/nm.rss'),
]

# ENVIRONMENTAL SCIENCE
ENVIRONMENTAL_SOURCES = [
    ('Environmental Science & Technology (ACS)', 'https://pubs.acs.org/action/showFeed?type=axatoc&feed=rss&jc=esthag'),
    ('Nature Climate Change', 'https://www.nature.com/nclimate.rss'),
    ('IPCC', 'https://www.ipcc.ch/feed/'),
    ('NOAA News', 'https://www.noaa.gov/feed'),
]

# SCIENCE NEWS ORGANIZATIONS
SCIENCE_NEWS_SOURCES = [
    ('ScienceNews.org', 'https://www.sciencenews.org/feed'),
    ('Live Science', 'https://www.livescience.com/feeds/all'),
    ('EurekAlert! (AAAS)', 'https://www.eurekalert.org/rss/technology_engineering.xml'),
    ('NIH Research Matters', 'https://www.nih.gov/news-events/nih-research-matters/feed'),
]

# Combine all sources
ALL_SOURCES = (
    BREAKING_NEWS_SOURCES +
    US_NEWS_SOURCES +
    UK_NEWS_SOURCES +
    INTERNATIONAL_NEWS_SOURCES +
    NEWS_MAGAZINES_SOURCES +
    FINANCIAL_SOURCES +
    BUSINESS_SOURCES +
    MARKET_SOURCES +
    GLOBAL_BUSINESS_SOURCES +
    CRYPTO_FINTECH_SOURCES +
    TECHNOLOGY_SOURCES +
    TECH_INDUSTRY_SOURCES +
    AI_ML_SOURCES +
    DEVELOPER_SOURCES +
    COMPANY_TECH_SOURCES +
    CYBERSECURITY_SOURCES +
    SCIENCE_SOURCES +
    NATURE_FAMILY_SOURCES +
    POPULAR_SCIENCE_SOURCES +
    SPACE_ASTRONOMY_SOURCES +
    PHYSICS_MATH_SOURCES +
    BIOLOGY_MEDICINE_SOURCES +
    ENVIRONMENTAL_SOURCES +
    SCIENCE_NEWS_SOURCES
)

# Source credibility scores (for AI weighting)
SOURCE_CREDIBILITY = {
    # Tier 1: Gold Standard (9-10 points) - Major International Agencies
    'Reuters World': 10,
    'Reuters Breaking News': 10,
    'Reuters Business': 10,
    'Associated Press Top News': 10,
    'Associated Press International': 10,
    'Associated Press US News': 10,
    'Agence France-Presse (AFP)': 10,
    'BBC News World': 10,
    'BBC News UK': 10,
    'BBC News Top Stories': 10,
    
    # Tier 1: Premium News Organizations
    'The New York Times World': 10,
    'The New York Times US': 10,
    'The New York Times Homepage': 10,
    'Washington Post World': 9,
    'Washington Post National': 9,
    'The Guardian World': 9,
    'The Guardian UK': 9,
    'The Guardian US': 9,
    'The Economist World': 9,
    'The Economist Business': 9,
    'The Economist Finance': 9,
    
    # Tier 1: Top Science Journals
    'Nature News': 10,
    'Nature Research Highlights': 10,
    'Science Magazine News': 10,
    'The Lancet': 10,
    'New England Journal of Medicine': 10,
    'Cell': 10,
    'PNAS': 10,
    
    # Tier 1: Financial News
    'Bloomberg Markets': 10,
    'Financial Times': 10,
    'Financial Times Companies': 10,
    'Wall Street Journal': 10,
    'Wall Street Journal Markets': 10,
    
    # Tier 2: Highly Credible (8-9 points)
    'Al Jazeera English': 9,
    'Deutsche Welle': 9,
    'France 24': 8,
    'The Times (UK)': 9,
    'The Telegraph': 8,
    'The Independent': 8,
    'USA Today': 8,
    'Los Angeles Times': 8,
    'Chicago Tribune': 8,
    'The Boston Globe': 8,
    'Forbes': 8,
    'Fortune': 8,
    'Business Insider': 8,
    'Harvard Business Review': 9,
    'MIT Technology Review': 9,
    'Wired': 8,
    'The Verge': 8,
    'Ars Technica': 8,
    'Scientific American': 9,
    'Nature Medicine': 10,
    'Nature Biotechnology': 10,
    'JAMA': 10,
    'British Medical Journal (BMJ)': 10,
    'NASA': 9,
    'ESA (European Space Agency)': 9,
    'The Atlantic': 9,
    'TIME Magazine': 8,
    'ProPublica': 9,
    
    # Tier 3: Credible (6-7 points) - most sources default to this
}

def get_source_credibility(source_name):
    """Get credibility score for a source (default 7)"""
    return SOURCE_CREDIBILITY.get(source_name, 7)

# Statistics
print(f"📊 Total Premium RSS Sources: {len(ALL_SOURCES)}")
print(f"   Major International News Agencies: {len(BREAKING_NEWS_SOURCES)}")
print(f"   US Premium News: {len(US_NEWS_SOURCES)}")
print(f"   UK Premium News: {len(UK_NEWS_SOURCES)}")
print(f"   International News: {len(INTERNATIONAL_NEWS_SOURCES)}")
print(f"   News Magazines: {len(NEWS_MAGAZINES_SOURCES)}")
print(f"   Financial News: {len(FINANCIAL_SOURCES)}")
print(f"   Business News: {len(BUSINESS_SOURCES)}")
print(f"   Market News: {len(MARKET_SOURCES)}")
print(f"   Global Business: {len(GLOBAL_BUSINESS_SOURCES)}")
print(f"   Crypto & Fintech: {len(CRYPTO_FINTECH_SOURCES)}")
print(f"   Technology: {len(TECHNOLOGY_SOURCES)}")
print(f"   Tech Industry: {len(TECH_INDUSTRY_SOURCES)}")
print(f"   AI & Machine Learning: {len(AI_ML_SOURCES)}")
print(f"   Developer: {len(DEVELOPER_SOURCES)}")
print(f"   Company Tech Blogs: {len(COMPANY_TECH_SOURCES)}")
print(f"   Cybersecurity: {len(CYBERSECURITY_SOURCES)}")
print(f"   Science Journals: {len(SCIENCE_SOURCES)}")
print(f"   Nature Family: {len(NATURE_FAMILY_SOURCES)}")
print(f"   Popular Science: {len(POPULAR_SCIENCE_SOURCES)}")
print(f"   Space & Astronomy: {len(SPACE_ASTRONOMY_SOURCES)}")
print(f"   Physics & Math: {len(PHYSICS_MATH_SOURCES)}")
print(f"   Biology & Medicine: {len(BIOLOGY_MEDICINE_SOURCES)}")
print(f"   Environmental Science: {len(ENVIRONMENTAL_SOURCES)}")
print(f"   Science News: {len(SCIENCE_NEWS_SOURCES)}")
