"""
TEN NEWS - RSS SOURCES CONFIGURATION
200+ High-Quality RSS Feeds
Organized by category
"""

# BREAKING NEWS & WORLD NEWS (25 sources)
BREAKING_NEWS_SOURCES = [
    # Tier 1 - Highest Priority
    ('Reuters World', 'http://feeds.reuters.com/Reuters/worldNews'),
    ('Reuters Breaking News', 'http://feeds.reuters.com/reuters/topNews'),
    ('Associated Press', 'https://feeds.apnews.com/rss/apf-topnews'),
    ('BBC World News', 'http://feeds.bbci.co.uk/news/world/rss.xml'),
    ('BBC Breaking News', 'http://feeds.bbci.co.uk/news/rss.xml'),
    ('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'),
    
    # Tier 2
    ('CNN Top Stories', 'http://rss.cnn.com/rss/edition.rss'),
    ('CNN World', 'http://rss.cnn.com/rss/edition_world.rss'),
    ('The Guardian World', 'https://www.theguardian.com/world/rss'),
    ('The Guardian UK', 'https://www.theguardian.com/uk/rss'),
    ('The Guardian US', 'https://www.theguardian.com/us-news/rss'),
    ('ABC News', 'https://abcnews.go.com/abcnews/topstories'),
    ('NBC News', 'https://feeds.nbcnews.com/nbcnews/public/news'),
    ('CBS News', 'https://www.cbsnews.com/latest/rss/main'),
    ('NPR News', 'https://feeds.npr.org/1001/rss.xml'),
    
    # International
    ('Deutsche Welle', 'https://rss.dw.com/rdf/rss-en-all'),
    ('France 24', 'https://www.france24.com/en/rss'),
    ('The Japan Times', 'https://www.japantimes.co.jp/feed/'),
    ('South China Morning Post', 'https://www.scmp.com/rss/91/feed'),
    ('Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'),
    ('The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss'),
    ('Straits Times', 'https://www.straitstimes.com/news/world/rss.xml'),
    ('Arab News', 'https://www.arabnews.com/rss.xml'),
    ('Jerusalem Post', 'https://www.jpost.com/rss/rssfeedsheadlines.aspx'),
    ('Sydney Morning Herald', 'https://www.smh.com.au/rss/feed.xml'),
]

# SCIENCE & RESEARCH (45 sources)
SCIENCE_SOURCES = [
    # Top Tier Journals
    ('Nature News', 'http://feeds.nature.com/nature/rss/current'),
    ('Nature Research Highlights', 'http://feeds.nature.com/nature/rss/research_highlights'),
    ('Science Magazine', 'https://www.science.org/rss/news_current.xml'),
    ('Science Daily', 'https://www.sciencedaily.com/rss/all.xml'),
    ('PNAS', 'https://www.pnas.org/rss/current.xml'),
    ('Cell', 'https://www.cell.com/cell/current.rss'),
    ('The Lancet', 'https://www.thelancet.com/rssfeed/lancet_current.xml'),
    ('NEJM', 'https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm'),
    
    # Nature Family
    ('Nature Biotechnology', 'http://feeds.nature.com/nbt/rss/current'),
    ('Nature Medicine', 'http://feeds.nature.com/nm/rss/current'),
    ('Nature Physics', 'http://feeds.nature.com/nphys/rss/current'),
    ('Nature Chemistry', 'http://feeds.nature.com/nchem/rss/current'),
    ('Nature Materials', 'http://feeds.nature.com/nmat/rss/current'),
    ('Nature Neuroscience', 'http://feeds.nature.com/neuro/rss/current'),
    ('Nature Genetics', 'http://feeds.nature.com/ng/rss/current'),
    ('Nature Climate Change', 'http://feeds.nature.com/nclimate/rss/current'),
    ('Nature Communications', 'http://feeds.nature.com/ncomms/rss/current'),
    ('Scientific Reports', 'http://feeds.nature.com/srep/rss/current'),
    
    # arXiv Categories
    ('arXiv Physics', 'https://rss.arxiv.org/rss/physics'),
    ('arXiv Computer Science', 'https://rss.arxiv.org/rss/cs'),
    ('arXiv Mathematics', 'https://rss.arxiv.org/rss/math'),
    ('arXiv Quantitative Biology', 'https://rss.arxiv.org/rss/q-bio'),
    ('arXiv Astrophysics', 'https://rss.arxiv.org/rss/astro-ph'),
    ('arXiv Quantum Physics', 'https://rss.arxiv.org/rss/quant-ph'),
    
    # Science Publishers
    ('PLOS Biology', 'https://journals.plos.org/plosbiology/feed/atom'),
    ('PLOS ONE', 'https://journals.plos.org/plosone/feed/atom'),
    ('BMJ', 'https://www.bmj.com/rss/recent.xml'),
    ('eLife', 'https://elifesciences.org/rss/recent.xml'),
    
    # Popular Science
    ('Scientific American', 'http://rss.sciam.com/ScientificAmerican-Global'),
    ('New Scientist', 'https://www.newscientist.com/feed/home'),
    ('Phys.org', 'https://phys.org/rss-feed/'),
    ('Quanta Magazine', 'https://www.quantamagazine.org/feed/'),
    ('Live Science', 'https://www.livescience.com/feeds/all'),
    ('Space.com', 'https://www.space.com/feeds/all'),
    ('NASA', 'https://www.nasa.gov/rss/dyn/breaking_news.rss'),
    ('ESA', 'https://www.esa.int/rssfeed/Our_Activities/Space_Science'),
    
    # Medical
    ('Medical News Today', 'https://www.medicalnewstoday.com/rss'),
    ('WebMD', 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC'),
    ('Johns Hopkins Medicine', 'https://www.hopkinsmedicine.org/news/feed'),
    ('Mayo Clinic', 'https://newsnetwork.mayoclinic.org/feed/'),
    
    # Climate & Environment Science
    ('Climate Central', 'https://www.climatecentral.org/feed'),
    ('Carbon Brief', 'https://www.carbonbrief.org/feed/'),
    ('RealClimate', 'http://www.realclimate.org/index.php/feed/'),
    ('IPCC', 'https://www.ipcc.ch/feed/'),
]

# TECHNOLOGY (35 sources)
TECHNOLOGY_SOURCES = [
    # Major Tech News
    ('TechCrunch', 'http://feeds.feedburner.com/TechCrunch/'),
    ('The Verge', 'https://www.theverge.com/rss/index.xml'),
    ('Wired', 'https://www.wired.com/feed/rss'),
    ('Ars Technica', 'http://feeds.arstechnica.com/arstechnica/index'),
    ('Engadget', 'https://www.engadget.com/rss.xml'),
    ('CNET', 'https://www.cnet.com/rss/news/'),
    ('TechRadar', 'https://www.techradar.com/rss'),
    ('ZDNet', 'http://www.zdnet.com/news/rss.xml'),
    ('VentureBeat', 'https://venturebeat.com/feed/'),
    ('The Next Web', 'https://thenextweb.com/feed/'),
    
    # Specific Tech Areas
    ('MIT Technology Review', 'https://www.technologyreview.com/feed/'),
    ('IEEE Spectrum', 'https://spectrum.ieee.org/feeds/feed.rss'),
    ('Hacker News', 'https://hnrss.org/frontpage'),
    ('Slashdot', 'http://rss.slashdot.org/Slashdot/slashdotMain'),
    ('Gizmodo', 'https://gizmodo.com/rss'),
    ('Mashable Tech', 'https://mashable.com/feeds/rss/tech'),
    
    # AI & Machine Learning
    ('OpenAI Blog', 'https://openai.com/blog/rss/'),
    ('Google AI Blog', 'http://feeds.feedburner.com/blogspot/gJZg'),
    ('DeepMind Blog', 'https://deepmind.com/blog/feed/basic/'),
    ('AI News', 'https://artificialintelligence-news.com/feed/'),
    ('Machine Learning Mastery', 'https://machinelearningmastery.com/feed/'),
    
    # Developer & Coding
    ('GitHub Blog', 'https://github.blog/feed/'),
    ('Stack Overflow Blog', 'https://stackoverflow.blog/feed/'),
    ('Dev.to', 'https://dev.to/feed/'),
    ('freeCodeCamp', 'https://www.freecodecamp.org/news/rss/'),
    ('CSS Tricks', 'https://css-tricks.com/feed/'),
    
    # Company Blogs
    ('Google Developers', 'https://developers.googleblog.com/feeds/posts/default'),
    ('AWS News', 'https://aws.amazon.com/blogs/aws/feed/'),
    ('Apple Newsroom', 'https://www.apple.com/newsroom/rss-feed.rss'),
    ('Meta Engineering', 'https://engineering.fb.com/feed/'),
    ('Netflix Tech Blog', 'https://netflixtechblog.com/feed'),
    ('Uber Engineering', 'https://eng.uber.com/feed/'),
    ('Airbnb Engineering', 'https://medium.com/feed/airbnb-engineering'),
    ('Spotify Engineering', 'https://engineering.atspotify.com/feed/'),
    ('Dropbox Tech Blog', 'https://dropbox.tech/feed'),
]

# BUSINESS & FINANCE (30 sources)
BUSINESS_SOURCES = [
    # Major Business News
    ('Reuters Business', 'http://feeds.reuters.com/reuters/businessNews'),
    ('CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'),
    ('MarketWatch', 'http://feeds.marketwatch.com/marketwatch/topstories/'),
    ('Forbes', 'https://www.forbes.com/real-time/feed2/'),
    ('Fortune', 'https://fortune.com/feed/'),
    ('Business Insider', 'https://www.businessinsider.com/rss'),
    ('Fast Company', 'https://www.fastcompany.com/latest/rss'),
    
    # Markets & Trading
    ('Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'),
    ('Seeking Alpha', 'https://seekingalpha.com/feed.xml'),
    ('Benzinga', 'https://www.benzinga.com/feed'),
    ('The Motley Fool', 'https://www.fool.com/feeds/index.aspx'),
    ('Morningstar', 'https://www.morningstar.com/rss'),
    
    # Crypto & Fintech
    ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    ('Cointelegraph', 'https://cointelegraph.com/rss'),
    ('The Block', 'https://www.theblock.co/rss.xml'),
    ('Decrypt', 'https://decrypt.co/feed'),
    ('Fintech News', 'https://www.fintechnews.org/feed/'),
    
    # Economics
    ('The World Bank', 'https://www.worldbank.org/en/news/rss'),
    ('IMF', 'https://www.imf.org/en/News/RSS'),
    ('Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml'),
    ('Trading Economics', 'https://tradingeconomics.com/rss/news.aspx'),
    
    # Industry News
    ('TechCrunch Startups', 'https://techcrunch.com/startups/feed/'),
    ('VentureBeat Business', 'https://venturebeat.com/category/business/feed/'),
    ('The Hustle', 'https://thehustle.co/feed/'),
    ('Morning Brew', 'https://www.morningbrew.com/daily/feed'),
    ('Protocol', 'https://www.protocol.com/feeds/feed.rss'),
    ('Axios Business', 'https://www.axios.com/business/feed'),
    ('Bloomberg Markets', 'https://www.bloomberg.com/feed/markets/index.xml'),
    ('CNBC World Markets', 'https://www.cnbc.com/id/15839135/device/rss/rss.html'),
    ('Financial Times Markets', 'https://www.ft.com/markets?format=rss'),
]

# ENVIRONMENT & CLIMATE (20 sources)
ENVIRONMENT_SOURCES = [
    # Climate News
    ('Climate Home News', 'https://www.climatechangenews.com/feed/'),
    ('Inside Climate News', 'https://insideclimatenews.org/feed/'),
    ('Yale Environment 360', 'https://e360.yale.edu/feed'),
    ('The Guardian Environment', 'https://www.theguardian.com/environment/rss'),
    ('Grist', 'https://grist.org/feed/'),
    
    # Conservation
    ('WWF News', 'https://www.worldwildlife.org/rss/news.xml'),
    ('Conservation International', 'https://www.conservation.org/blog/feed'),
    ('The Nature Conservancy', 'https://blog.nature.org/feed/'),
    ('Sierra Club', 'https://www.sierraclub.org/rss/national.xml'),
    ('Greenpeace', 'https://www.greenpeace.org/international/feed/'),
    ('Rainforest Alliance', 'https://www.rainforest-alliance.org/feed/'),
    
    # Energy & Sustainability
    ('Renewable Energy World', 'https://www.renewableenergyworld.com/feeds/all/'),
    ('Clean Technica', 'https://cleantechnica.com/feed/'),
    ('Green Tech Media', 'https://www.greentechmedia.com/rss/all'),
    ('Energy News Network', 'https://energynews.us/feed/'),
    ('Mongabay', 'https://news.mongabay.com/feed/'),
    ('Environmental Health News', 'https://www.ehn.org/rss-articles'),
    ('DeSmog', 'https://www.desmog.com/feed/'),
    ('TreeHugger', 'https://www.treehugger.com/feeds/rss'),
    ('Earth911', 'https://earth911.com/feed/'),
]

# DATA SCIENCE & STATISTICS (15 sources)
DATA_SOURCES = [
    # Data Science
    ('Towards Data Science', 'https://towardsdatascience.com/feed'),
    ('KDnuggets', 'https://www.kdnuggets.com/feed'),
    ('Data Science Central', 'https://www.datasciencecentral.com/feed/'),
    ('Analytics Vidhya', 'https://www.analyticsvidhya.com/feed/'),
    ('R-bloggers', 'https://www.r-bloggers.com/feed/'),
    ('Real Python', 'https://realpython.com/atom.xml'),
    
    # Statistics & Research
    ('FiveThirtyEight', 'https://fivethirtyeight.com/feed/'),
    ('Pew Research', 'https://www.pewresearch.org/feed/'),
    ('Our World in Data', 'https://ourworldindata.org/atom.xml'),
    ('The Pudding', 'https://pudding.cool/feed/index.xml'),
    ('Flowing Data', 'https://flowingdata.com/feed'),
    
    # Big Data
    ('Data Innovation', 'https://www.datainnovation.org/feed/'),
    ('Data Science Weekly', 'https://www.datascienceweekly.org/feed'),
    ('Data Informed', 'https://data-informed.com/feed/'),
    ('Big Data Analytics News', 'https://bigdata-madesimple.com/feed/'),
]

# POLITICS (20 sources)
POLITICS_SOURCES = [
    # US Politics
    ('Politico', 'https://www.politico.com/rss/politicopicks.xml'),
    ('The Hill', 'https://thehill.com/feed/'),
    ('Roll Call', 'https://www.rollcall.com/feed/'),
    ('Axios Politics', 'https://www.axios.com/politics/feed'),
    ('RealClearPolitics', 'http://www.realclearpolitics.com/index.xml'),
    ('The Atlantic Politics', 'https://www.theatlantic.com/feed/channel/politics/'),
    ('VOX Politics', 'https://www.vox.com/rss/policy-and-politics/index.xml'),
    
    # International Politics
    ('Foreign Policy', 'https://foreignpolicy.com/feed/'),
    ('Foreign Affairs', 'https://www.foreignaffairs.com/rss.xml'),
    ('The Diplomat', 'https://thediplomat.com/feed/'),
    ('Council on Foreign Relations', 'https://www.cfr.org/rss/index.xml'),
    ('Brookings', 'https://www.brookings.edu/feed/'),
    ('CSIS', 'https://www.csis.org/analysis/feed'),
    
    # EU & UK
    ('Euronews', 'https://www.euronews.com/rss'),
    ('EUobserver', 'https://euobserver.com/rss.xml'),
    ('UK Parliament', 'https://www.parliament.uk/site-information/rss-feeds/'),
    
    # Think Tanks
    ('Atlantic Council', 'https://www.atlanticcouncil.org/feed/'),
    ('Carnegie Endowment', 'https://carnegieendowment.org/rss/feed.xml'),
    ('RAND', 'https://www.rand.org/news/press.xml'),
    ('Heritage Foundation', 'https://www.heritage.org/rss/commentary-op-eds'),
]

# GENERAL NEWS & OPINION (15 sources)
GENERAL_SOURCES = [
    ('New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'),
    ('Washington Post', 'http://feeds.washingtonpost.com/rss/national'),
    ('Los Angeles Times', 'https://www.latimes.com/local/rss2.0.xml'),
    ('USA Today', 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories'),
    ('Chicago Tribune', 'https://www.chicagotribune.com/arcio/rss/'),
    ('The Times (UK)', 'https://www.thetimes.co.uk/rss'),
    ('The Independent', 'https://www.independent.co.uk/rss'),
    ('The Telegraph', 'https://www.telegraph.co.uk/rss.xml'),
    ('Huffington Post', 'https://www.huffpost.com/section/front-page/feed'),
    ('Slate', 'http://www.slate.com/all.fulltext.all.rss'),
    ('Salon', 'https://www.salon.com/feed/'),
    ('The Daily Beast', 'https://www.thedailybeast.com/rss'),
    ('Medium Top Stories', 'https://medium.com/feed/tag/top-stories'),
    ('Axios', 'https://www.axios.com/feeds/feed.rss'),
    ('ProPublica', 'https://www.propublica.org/feeds/propublica/main'),
]

# Combine all sources
ALL_SOURCES = (
    BREAKING_NEWS_SOURCES +
    SCIENCE_SOURCES +
    TECHNOLOGY_SOURCES +
    BUSINESS_SOURCES +
    ENVIRONMENT_SOURCES +
    DATA_SOURCES +
    POLITICS_SOURCES +
    GENERAL_SOURCES
)

# Source credibility scores (for AI weighting)
SOURCE_CREDIBILITY = {
    # Tier 1: Gold Standard (9-10 points)
    'Reuters World': 10,
    'Reuters Breaking News': 10,
    'Reuters Business': 10,
    'Associated Press': 10,
    'BBC World News': 10,
    'BBC Breaking News': 10,
    'Nature News': 10,
    'Science Magazine': 10,
    'NPR News': 9,
    'The Guardian World': 9,
    'New York Times': 9,
    'Washington Post': 9,
    'Financial Times Markets': 9,
    
    # Tier 2: Highly Credible (7-8 points)
    'Al Jazeera': 8,
    'CNN Top Stories': 8,
    'CNN World': 8,
    'NBC News': 8,
    'CBS News': 8,
    'The Economist': 8,
    'Scientific American': 8,
    'MIT Technology Review': 8,
    'Foreign Affairs': 8,
    'The Atlantic Politics': 8,
    
    # Tier 3: Credible (5-6 points) - most sources default to this
    # Tier 4: Lower Credibility (3-4 points)
}

def get_source_credibility(source_name):
    """Get credibility score for a source (default 6)"""
    return SOURCE_CREDIBILITY.get(source_name, 6)

# Statistics
print(f"📊 Total RSS Sources: {len(ALL_SOURCES)}")
print(f"   Breaking News: {len(BREAKING_NEWS_SOURCES)}")
print(f"   Science: {len(SCIENCE_SOURCES)}")
print(f"   Technology: {len(TECHNOLOGY_SOURCES)}")
print(f"   Business: {len(BUSINESS_SOURCES)}")
print(f"   Environment: {len(ENVIRONMENT_SOURCES)}")
print(f"   Data Science: {len(DATA_SOURCES)}")
print(f"   Politics: {len(POLITICS_SOURCES)}")
print(f"   General: {len(GENERAL_SOURCES)}")

