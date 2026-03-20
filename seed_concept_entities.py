"""
Seed concept_entities table with ~2,000 real-world entities.
Generates MiniLM 384-dim embeddings and inserts into Supabase.

Usage:
  python seed_concept_entities.py
"""

import os
import json
import time
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================
# ENTITY DEFINITIONS (~2,000 entities)
# Format: (entity_name, display_title, seed_text, category, aliases)
# ============================================================

ENTITIES = []

def e(name, title, seed, cat, aliases=None):
    ENTITIES.append((name, title, seed, cat, aliases or []))

# ============================================================
# SOCCER / FOOTBALL (~200)
# ============================================================

# Premier League
e("premier league", "Premier League", "English Premier League football soccer EPL England", "Soccer", ["epl"])
e("manchester united", "Manchester United", "Manchester United football Premier League Old Trafford Red Devils", "Soccer", ["man utd", "man united", "mufc"])
e("liverpool", "Liverpool FC", "Liverpool football Premier League Anfield Reds Merseyside", "Soccer", ["lfc"])
e("arsenal", "Arsenal FC", "Arsenal football Premier League Emirates London Gunners", "Soccer", ["gunners"])
e("manchester city", "Manchester City", "Manchester City football Premier League Etihad Citizens Guardiola", "Soccer", ["man city", "mcfc"])
e("chelsea", "Chelsea FC", "Chelsea football Premier League Stamford Bridge Blues London", "Soccer", ["cfc"])
e("tottenham", "Tottenham Hotspur", "Tottenham Hotspur football Premier League Spurs London", "Soccer", ["spurs", "thfc"])
e("newcastle", "Newcastle United", "Newcastle United football Premier League Magpies St James Park", "Soccer", ["nufc", "toon"])
e("aston villa", "Aston Villa", "Aston Villa football Premier League Birmingham Villa Park", "Soccer", ["avfc"])
e("west ham", "West Ham United", "West Ham United football Premier League London Hammers", "Soccer", ["whufc"])
e("brighton", "Brighton & Hove Albion", "Brighton football Premier League Seagulls Amex Stadium", "Soccer", ["bhafc"])
e("everton", "Everton FC", "Everton football Premier League Goodison Park Toffees Liverpool", "Soccer", ["efc"])
e("wolves", "Wolverhampton Wanderers", "Wolverhampton Wanderers football Premier League Wolves Molineux", "Soccer", ["wolverhampton"])
e("crystal palace", "Crystal Palace", "Crystal Palace football Premier League Eagles Selhurst Park London", "Soccer", ["cpfc"])
e("fulham", "Fulham FC", "Fulham football Premier League Craven Cottage London", "Soccer", ["ffc"])
e("bournemouth", "AFC Bournemouth", "Bournemouth football Premier League Cherries Vitality Stadium", "Soccer", ["afcb"])
e("nottingham forest", "Nottingham Forest", "Nottingham Forest football Premier League City Ground", "Soccer", ["nffc"])
e("brentford", "Brentford FC", "Brentford football Premier League Bees London", "Soccer", [])
e("ipswich", "Ipswich Town", "Ipswich Town football Premier League Tractor Boys Portman Road", "Soccer", [])
e("leicester", "Leicester City", "Leicester City football Premier League Foxes King Power Stadium", "Soccer", ["lcfc"])

# La Liga
e("la liga", "La Liga", "La Liga Spanish football league Spain Primera Division", "Soccer", ["primera division"])
e("real madrid", "Real Madrid", "Real Madrid football La Liga Santiago Bernabeu Champions League Spain", "Soccer", ["rmcf"])
e("barcelona", "FC Barcelona", "FC Barcelona football La Liga Camp Nou Catalonia Spain", "Soccer", ["barca", "fcb"])
e("atletico madrid", "Atletico Madrid", "Atletico Madrid football La Liga Wanda Metropolitano Spain", "Soccer", ["atleti"])
e("real sociedad", "Real Sociedad", "Real Sociedad football La Liga San Sebastian Basque", "Soccer", [])
e("athletic bilbao", "Athletic Bilbao", "Athletic Club Bilbao football La Liga San Mames Basque", "Soccer", ["athletic club"])
e("real betis", "Real Betis", "Real Betis football La Liga Seville Spain Benito Villamarin", "Soccer", ["betis"])
e("villarreal", "Villarreal CF", "Villarreal football La Liga Yellow Submarine Spain", "Soccer", [])
e("sevilla", "Sevilla FC", "Sevilla football La Liga Ramon Sanchez Pizjuan Andalusia", "Soccer", [])

# Bundesliga
e("bundesliga", "Bundesliga", "Bundesliga German football league Germany", "Soccer", [])
e("bayern munich", "Bayern Munich", "Bayern Munich football Bundesliga Allianz Arena Bavaria Germany", "Soccer", ["fcb", "fc bayern"])
e("borussia dortmund", "Borussia Dortmund", "Borussia Dortmund football Bundesliga BVB Signal Iduna Park", "Soccer", ["bvb", "dortmund"])
e("bayer leverkusen", "Bayer Leverkusen", "Bayer Leverkusen football Bundesliga Germany Xabi Alonso", "Soccer", ["leverkusen"])
e("rb leipzig", "RB Leipzig", "RB Leipzig football Bundesliga Red Bull Arena Germany", "Soccer", ["leipzig"])
e("eintracht frankfurt", "Eintracht Frankfurt", "Eintracht Frankfurt football Bundesliga Germany", "Soccer", ["frankfurt", "sge"])

# Serie A
e("serie a", "Serie A", "Serie A Italian football league Italy calcio", "Soccer", ["calcio"])
e("juventus", "Juventus", "Juventus football Serie A Turin Italy Allianz Stadium Old Lady", "Soccer", ["juve"])
e("ac milan", "AC Milan", "AC Milan football Serie A San Siro Rossoneri Italy", "Soccer", ["milan"])
e("inter milan", "Inter Milan", "Inter Milan football Serie A San Siro Nerazzurri Italy", "Soccer", ["inter", "internazionale"])
e("napoli", "SSC Napoli", "Napoli football Serie A Diego Armando Maradona Stadium Italy", "Soccer", [])
e("as roma", "AS Roma", "AS Roma football Serie A Stadio Olimpico Italy Rome", "Soccer", ["roma"])
e("lazio", "SS Lazio", "Lazio football Serie A Stadio Olimpico Rome Italy", "Soccer", [])
e("atalanta", "Atalanta", "Atalanta football Serie A Bergamo Italy Gewiss Stadium", "Soccer", [])
e("fiorentina", "ACF Fiorentina", "Fiorentina football Serie A Florence Italy Artemio Franchi", "Soccer", [])

# Ligue 1
e("ligue 1", "Ligue 1", "Ligue 1 French football league France", "Soccer", [])
e("psg", "Paris Saint-Germain", "Paris Saint-Germain PSG football Ligue 1 Parc des Princes France", "Soccer", ["paris saint-germain"])
e("marseille", "Olympique Marseille", "Olympique Marseille football Ligue 1 Velodrome France", "Soccer", ["om"])
e("lyon", "Olympique Lyon", "Olympique Lyonnais Lyon football Ligue 1 Groupama Stadium France", "Soccer", ["ol"])
e("monaco", "AS Monaco", "AS Monaco football Ligue 1 Stade Louis II Principality", "Soccer", [])
e("lille", "LOSC Lille", "Lille football Ligue 1 Pierre Mauroy France", "Soccer", [])

# Turkish Super Lig
e("super lig", "Turkish Super Lig", "Turkish Super Lig football Turkey Turkiye", "Soccer", ["turkish league"])
e("galatasaray", "Galatasaray & Turkish Super Lig", "Galatasaray football Turkish Super Lig Istanbul Cimbom Turkey", "Soccer", ["cimbom", "gala"])
e("fenerbahce", "Fenerbahce", "Fenerbahce football Turkish Super Lig Istanbul Kadikoy Turkey", "Soccer", ["fener"])
e("besiktas", "Besiktas", "Besiktas football Turkish Super Lig Istanbul Vodafone Park Turkey", "Soccer", ["bjk"])
e("trabzonspor", "Trabzonspor", "Trabzonspor football Turkish Super Lig Trabzon Black Sea Turkey", "Soccer", [])

# Saudi Pro League
e("saudi pro league", "Saudi Pro League", "Saudi Pro League football Saudi Arabia Roshn", "Soccer", ["roshn saudi league"])
e("al hilal", "Al Hilal", "Al Hilal football Saudi Pro League Riyadh Saudi Arabia Neymar", "Soccer", [])
e("al nassr", "Al Nassr & Ronaldo", "Al Nassr football Saudi Pro League Riyadh Ronaldo Saudi Arabia", "Soccer", [])
e("al ittihad", "Al Ittihad", "Al Ittihad football Saudi Pro League Jeddah Saudi Arabia", "Soccer", [])
e("al ahli", "Al Ahli Saudi", "Al Ahli football Saudi Pro League Jeddah Saudi Arabia", "Soccer", [])

# MLS
e("mls", "Major League Soccer", "MLS Major League Soccer USA Canada American football", "Soccer", ["major league soccer"])
e("inter miami", "Inter Miami & Messi", "Inter Miami CF MLS Lionel Messi David Beckham Florida", "Soccer", [])
e("la galaxy", "LA Galaxy", "LA Galaxy MLS Los Angeles California football soccer", "Soccer", ["galaxy"])

# Other leagues
e("champions league", "UEFA Champions League", "UEFA Champions League European football club competition", "Soccer", ["ucl"])
e("europa league", "UEFA Europa League", "UEFA Europa League European football club competition", "Soccer", ["uel"])
e("copa libertadores", "Copa Libertadores", "Copa Libertadores South American football club competition CONMEBOL", "Soccer", [])
e("brasileirao", "Brasileirao", "Brasileirao Brazilian football league Serie A Brazil", "Soccer", ["serie a brazil"])
e("liga mx", "Liga MX", "Liga MX Mexican football league Mexico", "Soccer", [])
e("j-league", "J-League", "J-League Japanese football league Japan J1", "Soccer", [])
e("k-league", "K-League", "K-League South Korean football league Korea", "Soccer", [])
e("a-league", "A-League", "A-League Australian football league Australia soccer", "Soccer", [])
e("isl", "Indian Super League", "Indian Super League ISL football India", "Soccer", [])
e("world cup", "FIFA World Cup", "FIFA World Cup football soccer international tournament global", "Soccer", [])

# Soccer players
e("messi", "Lionel Messi", "Lionel Messi Inter Miami Argentina football GOAT World Cup winner", "Soccer", ["lionel messi", "leo messi"])
e("ronaldo", "Cristiano Ronaldo", "Cristiano Ronaldo Al Nassr Portugal football CR7 goals", "Soccer", ["cr7", "cristiano"])
e("mbappe", "Kylian Mbappe", "Kylian Mbappe Real Madrid France football speed striker", "Soccer", ["kylian mbappe"])
e("haaland", "Erling Haaland", "Erling Haaland Manchester City Norway football striker goals", "Soccer", ["erling haaland"])
e("vinicius", "Vinicius Jr", "Vinicius Junior Real Madrid Brazil football winger Ballon d'Or", "Soccer", ["vinicius jr", "vini jr"])
e("bellingham", "Jude Bellingham", "Jude Bellingham Real Madrid England football midfielder", "Soccer", [])
e("salah", "Mohamed Salah", "Mohamed Salah Liverpool Egypt football winger Premier League goals", "Soccer", ["mo salah"])
e("son heung-min", "Son Heung-min", "Son Heung-min Tottenham South Korea football forward Premier League", "Soccer", ["sonny"])
e("saka", "Bukayo Saka", "Bukayo Saka Arsenal England football winger young talent", "Soccer", [])
e("palmer", "Cole Palmer", "Cole Palmer Chelsea England football midfielder goals assists", "Soccer", [])
e("neymar", "Neymar Jr", "Neymar Junior Brazil football Al Hilal Santos dribbling", "Soccer", [])
e("de bruyne", "Kevin De Bruyne", "Kevin De Bruyne Manchester City Belgium football midfielder assists", "Soccer", ["kdb"])
e("pedri", "Pedri", "Pedri FC Barcelona Spain football midfielder La Masia", "Soccer", [])
e("yamal", "Lamine Yamal", "Lamine Yamal FC Barcelona Spain football winger young prodigy", "Soccer", [])

# ============================================================
# NBA (~80)
# ============================================================

e("nba", "NBA Basketball", "NBA National Basketball Association basketball American professional", "Basketball", [])
e("lakers", "Los Angeles Lakers", "Los Angeles Lakers NBA basketball LeBron Staples Center purple gold", "Basketball", ["la lakers"])
e("celtics", "Boston Celtics", "Boston Celtics NBA basketball TD Garden championship green", "Basketball", [])
e("warriors", "Golden State Warriors", "Golden State Warriors NBA basketball Steph Curry Chase Center", "Basketball", ["gsw"])
e("nuggets", "Denver Nuggets", "Denver Nuggets NBA basketball Jokic Ball Arena Colorado", "Basketball", [])
e("bucks", "Milwaukee Bucks", "Milwaukee Bucks NBA basketball Giannis Fiserv Forum", "Basketball", [])
e("76ers", "Philadelphia 76ers", "Philadelphia 76ers NBA basketball Sixers Embiid Wells Fargo Center", "Basketball", ["sixers", "philly"])
e("knicks", "New York Knicks", "New York Knicks NBA basketball Madison Square Garden NYC", "Basketball", [])
e("suns", "Phoenix Suns", "Phoenix Suns NBA basketball Durant Booker Footprint Center", "Basketball", [])
e("heat", "Miami Heat", "Miami Heat NBA basketball Kaseya Center Florida", "Basketball", [])
e("mavericks", "Dallas Mavericks", "Dallas Mavericks NBA basketball Luka Doncic American Airlines Center", "Basketball", ["mavs"])
e("clippers", "LA Clippers", "LA Clippers NBA basketball Intuit Dome Kawhi Leonard", "Basketball", [])
e("thunder", "Oklahoma City Thunder", "Oklahoma City Thunder NBA basketball SGA Paycom Center", "Basketball", ["okc"])
e("cavaliers", "Cleveland Cavaliers", "Cleveland Cavaliers NBA basketball Cavs Rocket Mortgage FieldHouse", "Basketball", ["cavs"])
e("timberwolves", "Minnesota Timberwolves", "Minnesota Timberwolves NBA basketball Anthony Edwards Target Center", "Basketball", ["wolves"])
e("nets", "Brooklyn Nets", "Brooklyn Nets NBA basketball Barclays Center New York", "Basketball", [])
e("raptors", "Toronto Raptors", "Toronto Raptors NBA basketball Scotiabank Arena Canada", "Basketball", [])
e("bulls", "Chicago Bulls", "Chicago Bulls NBA basketball United Center Jordan legacy", "Basketball", [])
e("hawks", "Atlanta Hawks", "Atlanta Hawks NBA basketball State Farm Arena Trae Young", "Basketball", [])
e("pelicans", "New Orleans Pelicans", "New Orleans Pelicans NBA basketball Zion Williamson Smoothie King Center", "Basketball", [])
e("spurs nba", "San Antonio Spurs", "San Antonio Spurs NBA basketball Wembanyama Frost Bank Center", "Basketball", ["san antonio spurs"])
e("kings", "Sacramento Kings", "Sacramento Kings NBA basketball Golden 1 Center De'Aaron Fox", "Basketball", [])
e("grizzlies", "Memphis Grizzlies", "Memphis Grizzlies NBA basketball Ja Morant FedExForum", "Basketball", [])
e("pacers", "Indiana Pacers", "Indiana Pacers NBA basketball Gainbridge Fieldhouse Haliburton", "Basketball", [])
e("magic", "Orlando Magic", "Orlando Magic NBA basketball Amway Center Paolo Banchero", "Basketball", [])
e("rockets", "Houston Rockets", "Houston Rockets NBA basketball Toyota Center", "Basketball", [])

# NBA players
e("lebron", "LeBron James", "LeBron James Lakers NBA basketball King James scoring leader GOAT", "Basketball", ["lebron james", "king james"])
e("steph curry", "Steph Curry", "Stephen Curry Warriors NBA basketball three pointer shooting splash", "Basketball", ["stephen curry", "curry"])
e("jokic", "Nikola Jokic", "Nikola Jokic Nuggets NBA basketball MVP triple double Serbia", "Basketball", ["nikola jokic"])
e("giannis", "Giannis Antetokounmpo", "Giannis Antetokounmpo Bucks NBA basketball Greek Freak MVP", "Basketball", ["greek freak"])
e("luka doncic", "Luka Doncic", "Luka Doncic Mavericks NBA basketball Slovenia triple double", "Basketball", ["luka"])
e("kevin durant", "Kevin Durant", "Kevin Durant Suns NBA basketball KD scoring Phoenix", "Basketball", ["kd"])
e("joel embiid", "Joel Embiid", "Joel Embiid 76ers NBA basketball Cameroon MVP center", "Basketball", ["embiid"])
e("sga", "Shai Gilgeous-Alexander", "Shai Gilgeous-Alexander Thunder NBA basketball OKC scoring", "Basketball", ["gilgeous-alexander"])
e("anthony edwards", "Anthony Edwards", "Anthony Edwards Timberwolves NBA basketball Ant-Man dunking", "Basketball", ["ant-man", "ant edwards"])
e("wembanyama", "Victor Wembanyama", "Victor Wembanyama Spurs NBA basketball France 7-foot-4 rookie", "Basketball", ["wemby"])
e("tatum", "Jayson Tatum", "Jayson Tatum Celtics NBA basketball All-Star Boston", "Basketball", [])
e("ja morant", "Ja Morant", "Ja Morant Grizzlies NBA basketball dunking Memphis point guard", "Basketball", [])
e("adebayo", "Bam Adebayo", "Bam Adebayo Heat NBA basketball Miami center All-Star", "Basketball", ["bam"])

# ============================================================
# NFL (~70)
# ============================================================

e("nfl", "NFL Football", "NFL National Football League American football professional", "Football", [])
e("super bowl", "Super Bowl", "Super Bowl NFL championship American football biggest game", "Football", [])
e("chiefs", "Kansas City Chiefs", "Kansas City Chiefs NFL football Mahomes Arrowhead Stadium AFC", "Football", ["kc chiefs"])
e("eagles", "Philadelphia Eagles", "Philadelphia Eagles NFL football Lincoln Financial Field NFC", "Football", ["philly eagles"])
e("49ers", "San Francisco 49ers", "San Francisco 49ers NFL football Niners Levi's Stadium NFC West", "Football", ["niners", "sf 49ers"])
e("cowboys", "Dallas Cowboys", "Dallas Cowboys NFL football AT&T Stadium America's Team NFC East", "Football", [])
e("bills", "Buffalo Bills", "Buffalo Bills NFL football Highmark Stadium Josh Allen AFC East", "Football", [])
e("ravens", "Baltimore Ravens", "Baltimore Ravens NFL football Lamar Jackson M&T Bank Stadium AFC North", "Football", [])
e("lions", "Detroit Lions", "Detroit Lions NFL football Ford Field NFC North", "Football", [])
e("dolphins", "Miami Dolphins", "Miami Dolphins NFL football Hard Rock Stadium Tua Tagovailoa", "Football", [])
e("packers", "Green Bay Packers", "Green Bay Packers NFL football Lambeau Field NFC North", "Football", [])
e("bengals", "Cincinnati Bengals", "Cincinnati Bengals NFL football Joe Burrow Paycor Stadium", "Football", [])
e("steelers", "Pittsburgh Steelers", "Pittsburgh Steelers NFL football Acrisure Stadium AFC North", "Football", [])
e("texans", "Houston Texans", "Houston Texans NFL football NRG Stadium CJ Stroud", "Football", [])
e("bears", "Chicago Bears", "Chicago Bears NFL football Soldier Field Caleb Williams", "Football", [])
e("jets", "New York Jets", "New York Jets NFL football MetLife Stadium Aaron Rodgers", "Football", [])
e("chargers", "Los Angeles Chargers", "Los Angeles Chargers NFL football SoFi Stadium Justin Herbert", "Football", ["la chargers"])
e("rams", "Los Angeles Rams", "Los Angeles Rams NFL football SoFi Stadium Matthew Stafford", "Football", ["la rams"])
e("seahawks", "Seattle Seahawks", "Seattle Seahawks NFL football Lumen Field NFC West", "Football", [])
e("commanders", "Washington Commanders", "Washington Commanders NFL football Northwest Stadium NFC East", "Football", [])
e("vikings", "Minnesota Vikings", "Minnesota Vikings NFL football US Bank Stadium NFC North", "Football", [])
e("broncos", "Denver Broncos", "Denver Broncos NFL football Empower Field AFC West", "Football", [])
e("saints", "New Orleans Saints", "New Orleans Saints NFL football Caesars Superdome NFC South", "Football", [])
e("falcons", "Atlanta Falcons", "Atlanta Falcons NFL football Mercedes-Benz Stadium NFC South", "Football", [])
e("giants", "New York Giants", "New York Giants NFL football MetLife Stadium NFC East", "Football", [])
e("raiders", "Las Vegas Raiders", "Las Vegas Raiders NFL football Allegiant Stadium AFC West", "Football", [])
e("panthers", "Carolina Panthers", "Carolina Panthers NFL football Bank of America Stadium NFC South", "Football", [])
e("cardinals", "Arizona Cardinals", "Arizona Cardinals NFL football State Farm Stadium NFC West", "Football", [])
e("titans", "Tennessee Titans", "Tennessee Titans NFL football Nissan Stadium AFC South", "Football", [])
e("jaguars", "Jacksonville Jaguars", "Jacksonville Jaguars NFL football EverBank Stadium AFC South", "Football", [])
e("colts", "Indianapolis Colts", "Indianapolis Colts NFL football Lucas Oil Stadium AFC South", "Football", [])
e("patriots", "New England Patriots", "New England Patriots NFL football Gillette Stadium AFC East", "Football", ["pats"])

# NFL players
e("patrick mahomes", "Patrick Mahomes", "Patrick Mahomes Chiefs NFL quarterback Super Bowl MVP Kansas City", "Football", ["mahomes"])
e("josh allen", "Josh Allen", "Josh Allen Bills NFL quarterback Buffalo dual threat", "Football", [])
e("lamar jackson", "Lamar Jackson", "Lamar Jackson Ravens NFL quarterback MVP Baltimore running", "Football", ["lamar"])
e("joe burrow", "Joe Burrow", "Joe Burrow Bengals NFL quarterback Cincinnati Ohio", "Football", [])
e("cj stroud", "CJ Stroud", "CJ Stroud Texans NFL quarterback Houston rookie sensation", "Football", [])
e("travis kelce", "Travis Kelce", "Travis Kelce Chiefs NFL tight end Kansas City Taylor Swift", "Football", ["kelce"])
e("tyreek hill", "Tyreek Hill", "Tyreek Hill Dolphins NFL wide receiver Miami speed", "Football", [])
e("caleb williams", "Caleb Williams", "Caleb Williams Bears NFL quarterback Chicago USC draft", "Football", [])

# ============================================================
# MLB (~30)
# ============================================================

e("mlb", "MLB Baseball", "MLB Major League Baseball professional baseball American", "Baseball", [])
e("world series", "World Series", "World Series MLB championship baseball Fall Classic", "Baseball", [])
e("yankees", "New York Yankees", "New York Yankees MLB baseball Bronx Bombers Yankee Stadium", "Baseball", ["nyy"])
e("dodgers", "Los Angeles Dodgers", "Los Angeles Dodgers MLB baseball Dodger Stadium LA", "Baseball", [])
e("astros", "Houston Astros", "Houston Astros MLB baseball Minute Maid Park Texas", "Baseball", [])
e("braves", "Atlanta Braves", "Atlanta Braves MLB baseball Truist Park NL East", "Baseball", [])
e("phillies", "Philadelphia Phillies", "Philadelphia Phillies MLB baseball Citizens Bank Park", "Baseball", [])
e("mets", "New York Mets", "New York Mets MLB baseball Citi Field Queens New York", "Baseball", [])
e("red sox", "Boston Red Sox", "Boston Red Sox MLB baseball Fenway Park Boston", "Baseball", [])
e("cubs", "Chicago Cubs", "Chicago Cubs MLB baseball Wrigley Field NL Central", "Baseball", [])
e("padres", "San Diego Padres", "San Diego Padres MLB baseball Petco Park California", "Baseball", [])

# MLB players
e("shohei ohtani", "Shohei Ohtani", "Shohei Ohtani Dodgers MLB baseball Japan two-way pitcher hitter", "Baseball", ["ohtani"])
e("aaron judge", "Aaron Judge", "Aaron Judge Yankees MLB baseball home runs captain New York", "Baseball", [])
e("mike trout", "Mike Trout", "Mike Trout Angels MLB baseball center field California", "Baseball", [])

# ============================================================
# CRICKET (~40)
# ============================================================

e("cricket", "Cricket", "cricket sport bat ball test match international ICC", "Cricket", [])
e("ipl", "IPL - Indian Premier League", "IPL Indian Premier League T20 cricket India franchise", "Cricket", ["indian premier league"])
e("ashes", "The Ashes", "Ashes cricket England Australia test series urn", "Cricket", [])
e("t20 world cup", "T20 World Cup", "T20 World Cup cricket ICC Twenty20 international tournament", "Cricket", [])
e("bcci", "BCCI & Indian Cricket", "BCCI Board of Control for Cricket in India Indian cricket", "Cricket", [])
e("mumbai indians", "Mumbai Indians", "Mumbai Indians IPL T20 cricket franchise Mumbai", "Cricket", ["mi"])
e("csk", "Chennai Super Kings", "Chennai Super Kings CSK IPL T20 cricket MS Dhoni", "Cricket", ["chennai"])
e("rcb", "Royal Challengers Bangalore", "Royal Challengers Bangalore RCB IPL T20 cricket Kohli", "Cricket", ["royal challengers"])
e("kkr", "Kolkata Knight Riders", "Kolkata Knight Riders KKR IPL T20 cricket Eden Gardens", "Cricket", [])
e("virat kohli", "Virat Kohli", "Virat Kohli India cricket batsman RCB centuries ICC runs", "Cricket", ["kohli"])
e("rohit sharma", "Rohit Sharma", "Rohit Sharma India cricket captain Mumbai Indians opening batsman", "Cricket", [])
e("babar azam", "Babar Azam", "Babar Azam Pakistan cricket captain batsman elegant", "Cricket", [])
e("pat cummins", "Pat Cummins", "Pat Cummins Australia cricket captain fast bowler pace", "Cricket", [])
e("shaheen afridi", "Shaheen Afridi", "Shaheen Shah Afridi Pakistan cricket fast bowler left arm pace", "Cricket", [])
e("rashid khan", "Rashid Khan", "Rashid Khan Afghanistan cricket leg spinner T20 IPL", "Cricket", [])
e("ben stokes", "Ben Stokes", "Ben Stokes England cricket captain all-rounder Durham", "Cricket", [])
e("jasprit bumrah", "Jasprit Bumrah", "Jasprit Bumrah India cricket fast bowler yorker death bowling", "Cricket", [])
e("psl", "Pakistan Super League", "Pakistan Super League PSL T20 cricket Pakistan franchise", "Cricket", [])
e("big bash", "Big Bash League", "Big Bash League BBL T20 cricket Australia", "Cricket", ["bbl"])

# ============================================================
# F1 & MOTORSPORT (~30)
# ============================================================

e("f1", "Formula 1 Racing", "Formula 1 F1 racing Grand Prix motorsport open wheel", "Motorsport", ["formula 1", "formula one"])
e("max verstappen", "Max Verstappen", "Max Verstappen Red Bull F1 champion Dutch Netherlands racing", "Motorsport", ["verstappen"])
e("lewis hamilton", "Lewis Hamilton", "Lewis Hamilton Ferrari F1 British seven-time champion racing", "Motorsport", ["hamilton"])
e("charles leclerc", "Charles Leclerc", "Charles Leclerc Ferrari F1 Monaco racing driver Grand Prix", "Motorsport", ["leclerc"])
e("lando norris", "Lando Norris", "Lando Norris McLaren F1 British racing driver Grand Prix", "Motorsport", ["norris"])
e("carlos sainz", "Carlos Sainz", "Carlos Sainz Williams F1 Spanish racing driver Formula 1", "Motorsport", ["sainz"])
e("red bull racing", "Red Bull Racing", "Red Bull Racing F1 team Formula 1 Milton Keynes Verstappen", "Motorsport", ["red bull f1"])
e("ferrari f1", "Scuderia Ferrari", "Scuderia Ferrari F1 team Formula 1 Maranello Italy Hamilton Leclerc", "Motorsport", ["ferrari"])
e("mclaren", "McLaren Racing", "McLaren F1 team Formula 1 Woking Norris Piastri", "Motorsport", [])
e("mercedes f1", "Mercedes AMG F1", "Mercedes AMG F1 team Formula 1 Brackley Russell", "Motorsport", ["mercedes"])
e("nascar", "NASCAR Racing", "NASCAR stock car racing American motorsport oval tracks", "Motorsport", [])
e("motogp", "MotoGP", "MotoGP motorcycle racing Grand Prix Marquez Bagnaia", "Motorsport", [])
e("fernando alonso", "Fernando Alonso", "Fernando Alonso Aston Martin F1 Spanish veteran champion", "Motorsport", ["alonso"])
e("oscar piastri", "Oscar Piastri", "Oscar Piastri McLaren F1 Australian racing driver", "Motorsport", ["piastri"])

# ============================================================
# BOXING & MMA/UFC (~25)
# ============================================================

e("ufc", "UFC & MMA", "UFC Ultimate Fighting Championship MMA mixed martial arts octagon", "Combat Sports", ["mma"])
e("boxing", "Boxing", "boxing professional heavyweight middleweight ring knockout", "Combat Sports", [])
e("canelo alvarez", "Canelo Alvarez", "Canelo Alvarez boxing Mexican super middleweight champion", "Combat Sports", ["canelo"])
e("tyson fury", "Tyson Fury", "Tyson Fury boxing British heavyweight Gypsy King", "Combat Sports", ["fury"])
e("oleksandr usyk", "Oleksandr Usyk", "Oleksandr Usyk boxing Ukrainian undisputed heavyweight champion", "Combat Sports", ["usyk"])
e("islam makhachev", "Islam Makhachev", "Islam Makhachev UFC lightweight champion Dagestan MMA", "Combat Sports", [])
e("jon jones", "Jon Jones", "Jon Jones UFC heavyweight champion MMA GOAT fighter", "Combat Sports", [])
e("alex pereira", "Alex Pereira", "Alex Pereira UFC light heavyweight champion Brazilian MMA knockout", "Combat Sports", [])
e("conor mcgregor", "Conor McGregor", "Conor McGregor UFC MMA Irish fighter Notorious comeback", "Combat Sports", ["mcgregor"])
e("jake paul", "Jake Paul Boxing", "Jake Paul boxing YouTuber professional fighter social media", "Combat Sports", [])
e("ryan garcia", "Ryan Garcia", "Ryan Garcia boxing lightweight Mexican-American Golden Boy", "Combat Sports", [])
e("wwe", "WWE Wrestling", "WWE World Wrestling Entertainment professional wrestling Raw SmackDown", "Combat Sports", ["wrestling", "wrestlemania"])

# ============================================================
# TENNIS (~15)
# ============================================================

e("tennis", "Tennis", "tennis ATP WTA Grand Slam professional racket court", "Tennis", [])
e("novak djokovic", "Novak Djokovic", "Novak Djokovic tennis Serbian Grand Slam champion GOAT ATP", "Tennis", ["djokovic", "nole"])
e("carlos alcaraz", "Carlos Alcaraz", "Carlos Alcaraz tennis Spanish young champion Wimbledon French Open", "Tennis", ["alcaraz"])
e("jannik sinner", "Jannik Sinner", "Jannik Sinner tennis Italian world number one Australian Open", "Tennis", ["sinner"])
e("iga swiatek", "Iga Swiatek", "Iga Swiatek tennis Polish WTA French Open champion", "Tennis", ["swiatek"])
e("coco gauff", "Coco Gauff", "Coco Gauff tennis American US Open champion young star WTA", "Tennis", ["gauff"])
e("australian open", "Australian Open", "Australian Open tennis Grand Slam Melbourne Park January", "Tennis", [])
e("french open", "French Open", "French Open Roland Garros tennis Grand Slam Paris clay court", "Tennis", ["roland garros"])
e("wimbledon", "Wimbledon", "Wimbledon tennis Grand Slam grass court London All England Club", "Tennis", [])
e("us open tennis", "US Open Tennis", "US Open tennis Grand Slam Flushing Meadows New York hard court", "Tennis", [])

# ============================================================
# AI & TECHNOLOGY (~120)
# ============================================================

e("openai", "OpenAI & ChatGPT", "OpenAI ChatGPT artificial intelligence AI language model GPT Sam Altman", "AI & Tech", ["chatgpt"])
e("google ai", "Google AI & Gemini", "Google AI Gemini DeepMind artificial intelligence Bard machine learning", "AI & Tech", ["gemini ai", "deepmind"])
e("anthropic", "Anthropic & Claude", "Anthropic Claude AI artificial intelligence safety Dario Amodei", "AI & Tech", ["claude ai"])
e("meta ai", "Meta AI & Llama", "Meta AI Llama open source artificial intelligence Mark Zuckerberg", "AI & Tech", ["llama"])
e("nvidia", "Nvidia & AI Chips", "Nvidia GPU AI chips Jensen Huang CUDA data center artificial intelligence", "AI & Tech", [])
e("apple", "Apple", "Apple iPhone Mac iPad Tim Cook Cupertino Silicon Valley tech", "AI & Tech", [])
e("google", "Google", "Google Alphabet search Android YouTube Sundar Pichai tech", "AI & Tech", ["alphabet"])
e("microsoft", "Microsoft", "Microsoft Windows Azure Satya Nadella Office Copilot Xbox", "AI & Tech", ["msft"])
e("amazon", "Amazon", "Amazon AWS ecommerce Jeff Bezos Andy Jassy Prime cloud", "AI & Tech", [])
e("meta", "Meta & Facebook", "Meta Facebook Instagram WhatsApp Mark Zuckerberg social media metaverse", "AI & Tech", ["facebook"])
e("tesla", "Tesla & Electric Vehicles", "Tesla electric vehicles Elon Musk EV autonomous driving Cybertruck", "AI & Tech", [])
e("spacex", "SpaceX & Starship", "SpaceX Elon Musk Starship Falcon rocket launch space orbital", "AI & Tech", [])
e("samsung", "Samsung", "Samsung Galaxy smartphone Korean electronics OLED chips", "AI & Tech", [])
e("iphone", "iPhone & iOS", "iPhone Apple iOS smartphone mobile camera A-series chip", "AI & Tech", [])
e("android", "Android", "Android Google mobile operating system smartphone Play Store", "AI & Tech", [])
e("tiktok", "TikTok", "TikTok ByteDance short video social media algorithm content creator", "AI & Tech", [])
e("twitter x", "X (Twitter)", "X Twitter Elon Musk social media platform tweets posts", "AI & Tech", ["x", "twitter"])
e("deepseek", "DeepSeek AI", "DeepSeek AI Chinese artificial intelligence model open source", "AI & Tech", [])
e("midjourney", "Midjourney & AI Art", "Midjourney AI art image generation artificial intelligence creative", "AI & Tech", ["ai art"])
e("sora", "Sora & AI Video", "Sora OpenAI AI video generation artificial intelligence creative", "AI & Tech", ["ai video"])
e("copilot", "GitHub Copilot & AI Coding", "GitHub Copilot AI coding programming artificial intelligence developer tools", "AI & Tech", ["ai coding"])
e("cybersecurity", "Cybersecurity & Hacking", "cybersecurity hacking data breach ransomware privacy encryption vulnerability", "AI & Tech", [])
e("blockchain", "Blockchain & Web3", "blockchain Web3 decentralized DeFi smart contracts crypto technology", "AI & Tech", ["web3", "defi"])
e("quantum computing", "Quantum Computing", "quantum computing qubits IBM Google quantum supremacy quantum processor", "AI & Tech", [])
e("robotics", "Robotics & Automation", "robotics AI robot automation humanoid industrial manufacturing", "AI & Tech", [])
e("self driving", "Self-Driving Cars", "self-driving autonomous vehicles Waymo Tesla FSD robotaxi lidar", "AI & Tech", ["autonomous vehicles", "waymo"])
e("vr ar", "VR & AR Technology", "virtual reality augmented reality VR AR headset Meta Quest Apple Vision", "AI & Tech", ["virtual reality", "augmented reality"])
e("semiconductors", "Semiconductors & Chips", "semiconductors chips processor TSMC Intel AMD fabrication foundry", "AI & Tech", ["chips", "tsmc"])
e("huawei", "Huawei", "Huawei Chinese tech smartphones 5G Kirin chip telecom", "AI & Tech", [])
e("xiaomi", "Xiaomi", "Xiaomi Chinese smartphones gadgets Mi electric vehicles", "AI & Tech", [])
e("playstation", "PlayStation & Sony Gaming", "PlayStation Sony PS5 gaming console exclusive titles DualSense", "AI & Tech", ["ps5", "sony gaming"])
e("xbox", "Xbox & Microsoft Gaming", "Xbox Microsoft gaming console Game Pass Halo Bethesda", "AI & Tech", ["game pass"])
e("nintendo", "Nintendo", "Nintendo Switch Mario Zelda Pokemon Japanese gaming", "AI & Tech", ["switch"])
e("steam", "Steam & PC Gaming", "Steam Valve PC gaming platform store Gabe Newell digital distribution", "AI & Tech", [])
e("esports", "Esports & Competitive Gaming", "esports competitive gaming League of Legends Valorant tournaments professional", "AI & Tech", [])

# ============================================================
# CRYPTO & FINANCE (~40)
# ============================================================

e("bitcoin", "Bitcoin & Crypto", "Bitcoin BTC cryptocurrency digital currency blockchain Satoshi mining", "Finance", ["btc"])
e("ethereum", "Ethereum", "Ethereum ETH cryptocurrency smart contracts DeFi Vitalik Buterin", "Finance", ["eth"])
e("solana", "Solana", "Solana SOL cryptocurrency blockchain fast transactions DeFi NFT", "Finance", ["sol"])
e("xrp", "XRP & Ripple", "XRP Ripple cryptocurrency cross-border payments SEC lawsuit", "Finance", ["ripple"])
e("dogecoin", "Dogecoin & Meme Coins", "Dogecoin DOGE meme coin cryptocurrency Elon Musk Shiba Inu", "Finance", ["doge"])
e("sp500", "S&P 500 & Wall Street", "S&P 500 stock market Wall Street index trading equities NYSE", "Finance", ["s&p 500", "wall street"])
e("nasdaq", "Nasdaq & Tech Stocks", "Nasdaq stock market technology stocks index trading FAANG", "Finance", [])
e("dow jones", "Dow Jones", "Dow Jones Industrial Average stock market index blue chip", "Finance", [])
e("fed", "Federal Reserve & Interest Rates", "Federal Reserve Fed interest rates monetary policy Jerome Powell inflation", "Finance", ["federal reserve", "interest rates"])
e("inflation", "Inflation & Cost of Living", "inflation consumer prices cost of living CPI purchasing power economy", "Finance", [])
e("gold", "Gold & Precious Metals", "gold precious metals commodity safe haven investment price ounce", "Finance", [])
e("oil prices", "Oil Prices & Energy Markets", "oil prices crude petroleum energy market OPEC barrel Brent WTI", "Finance", ["crude oil", "brent"])
e("opec", "OPEC & Oil Production", "OPEC oil production cartel Saudi Arabia crude petroleum output cuts", "Finance", [])
e("sensex", "Sensex & Indian Markets", "Sensex BSE Indian stock market Bombay index trading Mumbai", "Finance", ["bse"])
e("nifty", "Nifty 50", "Nifty 50 NSE Indian stock market index National Stock Exchange", "Finance", [])
e("ftse", "FTSE & London Markets", "FTSE 100 London stock exchange British market index trading UK", "Finance", [])
e("dax", "DAX & German Markets", "DAX German stock market Frankfurt index Xetra trading", "Finance", [])
e("nikkei", "Nikkei & Japanese Markets", "Nikkei 225 Japanese stock market Tokyo index trading Japan", "Finance", [])
e("real estate", "Real Estate & Housing", "real estate housing market property mortgage home prices residential", "Finance", [])

# ============================================================
# US POLITICS (~30)
# ============================================================

e("trump", "Donald Trump", "Donald Trump president Republican White House MAGA conservative", "US Politics", ["donald trump"])
e("biden", "Joe Biden", "Joe Biden president Democrat White House administration Delaware", "US Politics", ["joe biden"])
e("supreme court", "US Supreme Court", "Supreme Court SCOTUS justices constitutional law rulings precedent", "US Politics", ["scotus"])
e("congress", "US Congress", "US Congress Senate House Representatives legislation Capitol Hill", "US Politics", ["senate", "house"])
e("pentagon", "Pentagon & US Military", "Pentagon US military defense Department of Defense armed forces", "US Politics", ["us military"])
e("cia", "CIA & Intelligence", "CIA Central Intelligence Agency intelligence espionage national security", "US Politics", [])
e("fbi", "FBI", "FBI Federal Bureau of Investigation law enforcement investigation crime", "US Politics", [])
e("elon musk politics", "Elon Musk & DOGE", "Elon Musk DOGE Department of Government Efficiency politics Twitter X", "US Politics", ["doge government"])
e("desantis", "Ron DeSantis", "Ron DeSantis Florida governor Republican conservative politics", "US Politics", [])
e("aoc", "Alexandria Ocasio-Cortez", "Alexandria Ocasio-Cortez AOC progressive Democrat New York Congress", "US Politics", [])

# ============================================================
# WORLD POLITICS (~50)
# ============================================================

e("erdogan", "Erdogan & Turkey Politics", "Recep Tayyip Erdogan Turkey president AKP Ankara Turkish politics", "World Politics", ["recep tayyip erdogan"])
e("macron", "Emmanuel Macron", "Emmanuel Macron France president Elysee Paris French politics", "World Politics", [])
e("modi", "Narendra Modi", "Narendra Modi India prime minister BJP Hindu nationalist politics", "World Politics", ["narendra modi"])
e("xi jinping", "Xi Jinping & China", "Xi Jinping China president CCP Communist Party Beijing Chinese leader", "World Politics", [])
e("putin", "Vladimir Putin", "Vladimir Putin Russia president Kremlin Moscow Ukraine war authoritarian", "World Politics", ["vladimir putin"])
e("zelenskyy", "Zelenskyy & Ukraine", "Volodymyr Zelenskyy Ukraine president Kyiv war resistance defense", "World Politics", ["volodymyr zelenskyy"])
e("netanyahu", "Netanyahu & Israel", "Benjamin Netanyahu Israel prime minister Likud Jerusalem Israeli politics", "World Politics", ["benjamin netanyahu", "bibi"])
e("starmer", "Keir Starmer", "Keir Starmer UK prime minister Labour party Westminster British politics", "World Politics", [])
e("trudeau", "Justin Trudeau", "Justin Trudeau Canada prime minister Liberal party Ottawa Canadian", "World Politics", [])
e("meloni", "Giorgia Meloni", "Giorgia Meloni Italy prime minister Brothers of Italy Rome politics", "World Politics", [])
e("merz", "Friedrich Merz", "Friedrich Merz Germany chancellor CDU Bundestag Berlin German politics", "World Politics", [])
e("lula", "Lula & Brazil", "Lula da Silva Brazil president Brasilia Workers Party Latin America", "World Politics", [])
e("ukraine war", "Ukraine-Russia War", "Ukraine Russia war conflict invasion Kyiv Moscow military frontline", "World Politics", [])
e("israel gaza", "Israel-Gaza Conflict", "Israel Gaza conflict Hamas Palestine war IDF Middle East crisis", "World Politics", ["gaza", "hamas"])
e("iran", "Iran & Middle East", "Iran Tehran nuclear program Khamenei Middle East sanctions IRGC", "World Politics", [])
e("taiwan", "Taiwan & Cross-Strait", "Taiwan China cross-strait relations Taipei TSMC independence sovereignty", "World Politics", [])
e("nato", "NATO Alliance", "NATO North Atlantic Treaty Organization military alliance defense collective", "World Politics", [])
e("eu", "European Union", "European Union EU Brussels parliament commission regulation trade", "World Politics", ["european union"])
e("north korea", "North Korea", "North Korea DPRK Kim Jong Un Pyongyang nuclear missiles sanctions", "World Politics", ["dprk", "kim jong un"])
e("saudi arabia", "Saudi Arabia", "Saudi Arabia MBS crown prince Riyadh Vision 2030 oil kingdom", "World Politics", ["mbs"])

# ============================================================
# ENTERTAINMENT (~100)
# ============================================================

# K-Pop
e("bts", "BTS", "BTS K-pop Korean boy band Bangtan Sonyeondan RM Jin Suga J-Hope Jimin V Jungkook", "K-Pop & Music", ["bangtan"])
e("blackpink", "BLACKPINK", "BLACKPINK K-pop Korean girl group Jisoo Jennie Rose Lisa YG", "K-Pop & Music", [])
e("stray kids", "Stray Kids", "Stray Kids K-pop Korean boy band JYP Bang Chan Felix", "K-Pop & Music", ["skz"])
e("newjeans", "NewJeans", "NewJeans K-pop Korean girl group Hanni Minji ADOR", "K-Pop & Music", [])
e("seventeen", "SEVENTEEN", "SEVENTEEN K-pop Korean boy band Pledis 13 members Woozi", "K-Pop & Music", ["svt"])
e("aespa", "aespa", "aespa K-pop Korean girl group SM Entertainment Karina Winter", "K-Pop & Music", [])
e("ateez", "ATEEZ", "ATEEZ K-pop Korean boy band Hongjoong KQ Entertainment", "K-Pop & Music", [])
e("kdrama", "K-Drama & Korean Shows", "K-drama Korean drama series Netflix Viki romance thriller", "K-Pop & Music", ["k-drama", "korean drama"])
e("twice", "TWICE", "TWICE K-pop Korean girl group JYP Nayeon Momo Sana", "K-Pop & Music", [])
e("enhypen", "ENHYPEN", "ENHYPEN K-pop Korean boy band Hybe I-LAND Jungwon", "K-Pop & Music", [])
e("le sserafim", "LE SSERAFIM", "LE SSERAFIM K-pop Korean girl group Source Music Hybe Sakura", "K-Pop & Music", [])
e("ive", "IVE", "IVE K-pop Korean girl group Starship Wonyoung Yujin", "K-Pop & Music", [])

# Music
e("taylor swift", "Taylor Swift", "Taylor Swift pop music Eras Tour Grammy singer songwriter albums", "Entertainment", [])
e("drake", "Drake", "Drake rapper hip hop OVO Toronto Certified Lover Boy music", "Entertainment", [])
e("beyonce", "Beyonce", "Beyonce music singer Renaissance Cowboy Carter Houston pop R&B", "Entertainment", [])
e("travis scott", "Travis Scott", "Travis Scott rapper Astroworld hip hop Cactus Jack music", "Entertainment", [])
e("the weeknd", "The Weeknd", "The Weeknd Abel Tesfaye music R&B pop Canadian singer", "Entertainment", ["abel tesfaye"])
e("rihanna", "Rihanna", "Rihanna Fenty music pop Barbados singer fashion beauty", "Entertainment", [])
e("bad bunny", "Bad Bunny", "Bad Bunny reggaeton Latin music Puerto Rico Spanish trap urban", "Entertainment", [])
e("grammys", "Grammy Awards", "Grammy Awards music ceremony Recording Academy best album song", "Entertainment", [])
e("billie eilish", "Billie Eilish", "Billie Eilish music pop alternative singer songwriter Grammy", "Entertainment", [])
e("kendrick lamar", "Kendrick Lamar", "Kendrick Lamar rapper hip hop Pulitzer Compton TDE pgLang", "Entertainment", [])
e("sza", "SZA", "SZA R&B music singer songwriter SOS TDE Grammy", "Entertainment", [])
e("doja cat", "Doja Cat", "Doja Cat rapper pop music singer viral TikTok", "Entertainment", [])

# Movies & TV
e("marvel", "Marvel Cinematic Universe", "Marvel MCU Avengers superhero movies Disney Kevin Feige films", "Entertainment", ["mcu", "avengers"])
e("dc universe", "DC Universe", "DC Universe Batman Superman Wonder Woman James Gunn Warner Bros", "Entertainment", ["dc", "dceu"])
e("star wars", "Star Wars", "Star Wars Lucasfilm Jedi Sith Disney Mandalorian franchise", "Entertainment", [])
e("harry potter", "Harry Potter & Wizarding World", "Harry Potter Hogwarts wizarding world JK Rowling HBO Max series", "Entertainment", ["hogwarts"])
e("oscars", "Academy Awards & Oscars", "Oscars Academy Awards best picture director actor actress Hollywood", "Entertainment", ["academy awards"])
e("netflix", "Netflix Originals", "Netflix streaming original series movies shows content subscribers", "Entertainment", [])
e("disney", "Disney", "Disney Walt Disney Company parks movies streaming entertainment theme", "Entertainment", [])
e("hbo", "HBO & Max", "HBO Max streaming original series Game of Thrones Warner Bros Discovery", "Entertainment", ["max streaming"])
e("stranger things", "Stranger Things", "Stranger Things Netflix series Eleven Hawkins supernatural horror drama", "Entertainment", [])
e("game of thrones", "Game of Thrones Universe", "Game of Thrones House of the Dragon HBO fantasy Westeros dragons", "Entertainment", ["house of the dragon"])
e("the last of us", "The Last of Us", "The Last of Us HBO series PlayStation game Pedro Pascal post-apocalyptic", "Entertainment", [])
e("pokemon", "Pokemon", "Pokemon franchise games anime trading cards Nintendo Pikachu", "Entertainment", ["pokémon"])
e("gta", "Grand Theft Auto", "Grand Theft Auto GTA 6 Rockstar Games open world gaming Vice City", "Entertainment", ["gta 6"])
e("fortnite", "Fortnite", "Fortnite Epic Games battle royale gaming skins events live service", "Entertainment", [])
e("minecraft", "Minecraft", "Minecraft Mojang sandbox gaming building survival worlds", "Entertainment", [])
e("anime", "Anime & Manga", "anime manga Japanese animation One Piece Naruto Dragon Ball Attack on Titan", "Entertainment", ["manga"])
e("one piece", "One Piece", "One Piece anime manga Luffy Eiichiro Oda Straw Hat pirates Netflix", "Entertainment", [])
e("jujutsu kaisen", "Jujutsu Kaisen", "Jujutsu Kaisen anime manga Gojo Satoru cursed energy Mappa", "Entertainment", [])
e("demon slayer", "Demon Slayer", "Demon Slayer Kimetsu no Yaiba anime manga Tanjiro Ufotable", "Entertainment", [])

# Celebrity
e("kardashians", "The Kardashians", "Kardashians Kim Khloe Kourtney Kylie Jenner reality TV celebrity", "Entertainment", ["kim kardashian", "kylie jenner"])
e("selena gomez", "Selena Gomez", "Selena Gomez actress singer Rare Beauty Only Murders entrepreneur", "Entertainment", [])
e("zendaya", "Zendaya", "Zendaya actress Euphoria Dune Spider-Man fashion Hollywood", "Entertainment", [])
e("timothee chalamet", "Timothee Chalamet", "Timothee Chalamet actor Dune Wonka Hollywood young star", "Entertainment", [])
e("dwayne johnson", "Dwayne 'The Rock' Johnson", "Dwayne Johnson The Rock actor wrestler movies WWE Hollywood", "Entertainment", ["the rock"])
e("tom holland", "Tom Holland", "Tom Holland actor Spider-Man Marvel Uncharted British", "Entertainment", [])
e("sydney sweeney", "Sydney Sweeney", "Sydney Sweeney actress Euphoria Anyone But You Hollywood", "Entertainment", [])
e("pedro pascal", "Pedro Pascal", "Pedro Pascal actor Mandalorian Last of Us Narcos Chilean", "Entertainment", [])
e("margot robbie", "Margot Robbie", "Margot Robbie actress Barbie producer Australian Hollywood", "Entertainment", [])

# ============================================================
# SCIENCE & SPACE (~30)
# ============================================================

e("nasa", "NASA & Space Exploration", "NASA space exploration rockets missions Mars Moon ISS astronaut", "Science", [])
e("mars", "Mars Exploration", "Mars planet exploration rover Perseverance NASA SpaceX colonization", "Science", [])
e("james webb", "James Webb Telescope", "James Webb Space Telescope JWST deep space images NASA infrared", "Science", ["jwst"])
e("climate change", "Climate Change", "climate change global warming carbon emissions greenhouse gas temperature", "Science", ["global warming"])
e("earthquake", "Earthquakes & Seismology", "earthquake seismology fault line magnitude Richter tsunami tremor", "Science", [])
e("volcano", "Volcanoes & Eruptions", "volcano eruption lava magma volcanic activity geological hazard", "Science", [])
e("asteroid", "Asteroids & Near-Earth Objects", "asteroid near-earth object NEO planetary defense DART impact space", "Science", [])
e("ai research", "AI Research & Breakthroughs", "artificial intelligence research breakthroughs neural network deep learning papers", "Science", [])
e("nuclear energy", "Nuclear Energy", "nuclear energy fission fusion reactor power plant clean energy", "Science", ["nuclear fusion"])
e("solar energy", "Solar & Renewable Energy", "solar energy renewable panels photovoltaic clean power green", "Science", ["renewable energy"])
e("electric vehicles", "Electric Vehicles & EVs", "electric vehicles EV battery charging range Tesla BYD Rivian", "Science", ["ev"])

# ============================================================
# HEALTH & MEDICINE (~25)
# ============================================================

e("vaccine", "Vaccines & Immunization", "vaccine immunization shots mRNA Pfizer Moderna booster public health", "Health", [])
e("cancer research", "Cancer Research & Treatment", "cancer research treatment oncology immunotherapy tumor chemotherapy breakthrough", "Health", [])
e("mental health", "Mental Health & Wellness", "mental health depression anxiety therapy wellbeing mindfulness psychology", "Health", [])
e("alzheimers", "Alzheimer's & Dementia", "Alzheimer's disease dementia brain neurodegenerative memory treatment research", "Health", ["dementia"])
e("weight loss drugs", "Weight Loss Drugs & Ozempic", "weight loss drugs Ozempic Wegovy GLP-1 semaglutide Mounjaro obesity", "Health", ["ozempic", "wegovy", "glp-1"])
e("bird flu", "Bird Flu & Avian Influenza", "bird flu avian influenza H5N1 pandemic poultry outbreak WHO", "Health", ["h5n1", "avian flu"])
e("fda", "FDA & Drug Approvals", "FDA Food Drug Administration approval regulation pharmaceutical medicine", "Health", [])
e("who", "World Health Organization", "WHO World Health Organization global health pandemic disease international", "Health", [])
e("longevity", "Longevity & Anti-Aging", "longevity anti-aging lifespan health wellness aging research biotechnology", "Health", [])

# ============================================================
# BUSINESS & ECONOMY (~30)
# ============================================================

e("tariffs", "Trade Wars & Tariffs", "tariffs trade war import export duties sanctions international commerce", "Business", ["trade war"])
e("recession", "Recession & Economic Downturn", "recession economic downturn GDP growth decline unemployment economy", "Business", [])
e("jobs report", "Jobs Report & Employment", "jobs report employment unemployment labor market hiring payroll economy", "Business", ["employment", "unemployment"])
e("ipo", "IPOs & Stock Market Debuts", "IPO initial public offering stock market debut listing shares", "Business", [])
e("mergers", "Mergers & Acquisitions", "mergers acquisitions M&A corporate deal takeover buyout business", "Business", ["acquisitions"])
e("startups", "Startups & Venture Capital", "startups venture capital VC funding seed round unicorn Silicon Valley", "Business", ["venture capital"])
e("boeing", "Boeing", "Boeing aerospace aircraft 737 MAX 787 Dreamliner aviation safety", "Business", [])
e("toyota", "Toyota", "Toyota Japanese automaker hybrid Corolla Camry RAV4 manufacturing", "Business", [])
e("volkswagen", "Volkswagen", "Volkswagen VW German automaker Golf ID electric cars Wolfsburg", "Business", ["vw"])
e("byd", "BYD Electric Vehicles", "BYD Chinese electric vehicles EV batteries China auto manufacturer", "Business", [])
e("aramco", "Saudi Aramco", "Saudi Aramco oil company Saudi Arabia petroleum largest IPO", "Business", ["saudi aramco"])
e("coca cola", "Coca-Cola", "Coca-Cola beverage soft drink company brand consumer goods", "Business", ["coke"])
e("mcdonalds", "McDonald's", "McDonald's fast food restaurant franchise Big Mac global chain", "Business", [])

# ============================================================
# AUTOMOTIVE (~20)
# ============================================================

e("tesla cars", "Tesla Cars & Cybertruck", "Tesla electric cars Cybertruck Model 3 Model Y EV autonomous Musk", "Automotive", ["cybertruck", "model 3"])
e("bmw", "BMW", "BMW German luxury cars Bavaria iX M-series sedan performance", "Automotive", [])
e("mercedes", "Mercedes-Benz", "Mercedes-Benz German luxury cars EQS AMG sedan Stuttgart", "Automotive", ["mercedes-benz"])
e("ford", "Ford", "Ford American automaker Mustang F-150 pickup trucks Bronco", "Automotive", [])
e("gm", "General Motors", "General Motors GM Chevrolet Cadillac Buick American automaker", "Automotive", ["general motors", "chevrolet"])
e("rivian", "Rivian", "Rivian electric truck SUV R1T R1S adventure EV startup", "Automotive", [])
e("lucid", "Lucid Motors", "Lucid Motors luxury electric sedan Air Gravity EV range", "Automotive", [])
e("porsche", "Porsche", "Porsche German sports car 911 Taycan Cayenne luxury performance", "Automotive", [])
e("ferrari cars", "Ferrari", "Ferrari Italian sports car supercar F1 luxury Maranello", "Automotive", [])
e("lamborghini", "Lamborghini", "Lamborghini Italian supercar Huracan Urus Revuelto luxury performance", "Automotive", [])
e("honda", "Honda", "Honda Japanese automaker Civic Accord CR-V motorcycle reliability", "Automotive", [])
e("hyundai", "Hyundai & Kia", "Hyundai Kia Korean automaker Ioniq EV6 electric vehicle", "Automotive", ["kia"])
e("nio", "NIO", "NIO Chinese electric vehicle battery swap smart EV China", "Automotive", [])

# ============================================================
# FOOD & RECIPES (~30)
# ============================================================

e("healthy recipes", "Healthy Recipes & Meal Prep", "healthy recipes meal prep nutritious cooking low calorie clean eating", "Food", [])
e("air fryer", "Air Fryer Recipes", "air fryer recipes crispy cooking appliance healthy low oil kitchen", "Food", ["air fryer recipes"])
e("keto diet", "Keto Diet & Low Carb", "keto ketogenic diet low carb high fat weight loss nutrition", "Food", ["keto", "low carb"])
e("vegan", "Vegan & Plant-Based", "vegan plant-based diet vegetarian cruelty-free sustainable cooking", "Food", ["plant-based", "vegetarian"])
e("intermittent fasting", "Intermittent Fasting", "intermittent fasting diet 16:8 time-restricted eating weight loss health", "Food", [])
e("protein diet", "High Protein Diet", "high protein diet muscle building fitness nutrition chicken eggs lean", "Food", [])
e("mediterranean diet", "Mediterranean Diet", "Mediterranean diet olive oil fish vegetables healthy heart longevity", "Food", [])
e("sourdough", "Sourdough & Bread Baking", "sourdough bread baking starter fermentation artisan homemade loaf", "Food", ["bread baking"])
e("sushi", "Sushi & Japanese Food", "sushi Japanese food ramen tempura sashimi wasabi nori cuisine", "Food", ["japanese food", "ramen"])
e("pasta", "Pasta & Italian Cooking", "pasta Italian cooking spaghetti carbonara bolognese homemade fresh", "Food", ["italian food"])
e("korean food", "Korean Food & BBQ", "Korean food BBQ bibimbap kimchi bulgogi fried chicken cuisine", "Food", ["korean bbq", "kimchi"])
e("mexican food", "Mexican Food & Tacos", "Mexican food tacos burritos enchiladas guacamole salsa cuisine", "Food", ["tacos"])
e("indian food", "Indian Food & Curry", "Indian food curry biryani tandoori naan masala spices cuisine", "Food", ["curry", "biryani"])
e("coffee", "Coffee & Cafe Culture", "coffee espresso latte cappuccino barista brew cafe specialty", "Food", [])
e("smoothies", "Smoothies & Juicing", "smoothie juice healthy blend fruit protein green drink breakfast", "Food", [])
e("chocolate", "Chocolate & Desserts", "chocolate desserts brownies cake cookies sweet baking confection", "Food", [])
e("bbq grilling", "BBQ & Grilling", "BBQ barbecue grilling smoke ribs brisket steak outdoor cooking", "Food", ["barbecue"])

# ============================================================
# FASHION & LIFESTYLE (~15)
# ============================================================

e("fashion week", "Fashion Week", "fashion week runway designer collection Milan Paris New York London", "Lifestyle", [])
e("sneakers", "Sneakers & Streetwear", "sneakers streetwear Nike Adidas Jordan New Balance shoes hype", "Lifestyle", ["sneaker culture"])
e("luxury fashion", "Luxury Fashion & Designer", "luxury fashion designer Gucci Louis Vuitton Chanel Prada couture", "Lifestyle", [])
e("skincare", "Skincare & Beauty", "skincare beauty routine serum moisturizer SPF anti-aging glow", "Lifestyle", [])
e("fitness", "Fitness & Working Out", "fitness workout gym exercise training strength cardio crossfit", "Lifestyle", ["gym", "workout"])
e("yoga", "Yoga & Meditation", "yoga meditation mindfulness flexibility poses wellness practice", "Lifestyle", [])
e("travel", "Travel & Tourism", "travel tourism vacation destination airline hotel passport explore", "Lifestyle", [])
e("paris fashion", "Paris Fashion & Couture", "Paris fashion week haute couture Chanel Dior Balenciaga French style", "Lifestyle", [])
e("milan fashion", "Milan Fashion Week", "Milan fashion week Italian designers Prada Versace Gucci runway", "Lifestyle", [])

# ============================================================
# OLYMPICS & MAJOR EVENTS (~10)
# ============================================================

e("olympics", "Olympic Games", "Olympics Olympic Games IOC gold medal athletics swimming track field", "Sports Events", [])
e("paralympics", "Paralympic Games", "Paralympics Paralympic Games disability sport inclusive athletics", "Sports Events", [])
e("world cup 2026", "2026 World Cup", "2026 FIFA World Cup USA Mexico Canada football soccer tournament", "Sports Events", [])
e("march madness", "March Madness & NCAA", "March Madness NCAA tournament college basketball Final Four bracket", "Sports Events", ["ncaa tournament"])
e("the masters", "The Masters Golf", "The Masters Augusta National golf tournament green jacket PGA", "Sports Events", ["augusta"])
e("tour de france", "Tour de France", "Tour de France cycling race yellow jersey France Pogacar", "Sports Events", [])

# ============================================================
# MISCELLANEOUS TRENDING (~20)
# ============================================================

e("true crime", "True Crime", "true crime murder mystery investigation serial killer documentary podcast", "Entertainment", [])
e("conspiracy", "Conspiracy Theories & UFOs", "conspiracy theories UFO UAP aliens paranormal government secrets", "Entertainment", ["ufo", "uap"])
e("housing crisis", "Housing Crisis", "housing crisis affordable rent mortgage prices cost property market", "Business", [])
e("student loans", "Student Loans & Education", "student loans debt college university education forgiveness tuition", "Business", [])
e("immigration", "Immigration & Border", "immigration border policy asylum refugee deportation visa migrant", "World Politics", ["border", "asylum"])
e("gun control", "Gun Control & Mass Shootings", "gun control mass shooting second amendment NRA firearm regulation", "US Politics", [])
e("abortion", "Abortion & Reproductive Rights", "abortion reproductive rights Roe Wade Supreme Court women healthcare", "US Politics", ["reproductive rights"])
e("lgbtq", "LGBTQ+ Rights", "LGBTQ rights pride transgender equality discrimination inclusion", "World Politics", ["pride", "transgender"])
e("artificial sweeteners", "Artificial Sweeteners & Health", "artificial sweeteners aspartame stevia sugar-free health FDA safety", "Health", [])
e("pets", "Pets & Animal Care", "pets dogs cats animal care veterinary adoption rescue welfare", "Lifestyle", [])

# ============================================================
# MORE SOCCER (South America, Asia, Africa) (~40)
# ============================================================

e("flamengo", "Flamengo", "Flamengo Brazilian football Rio de Janeiro Maracana Brasileirao", "Soccer", [])
e("corinthians", "Corinthians", "Corinthians Brazilian football Sao Paulo Neo Quimica Arena", "Soccer", [])
e("palmeiras", "Palmeiras", "Palmeiras Brazilian football Sao Paulo Allianz Parque Libertadores", "Soccer", [])
e("river plate", "River Plate", "River Plate Argentine football Buenos Aires Monumental Millonarios", "Soccer", [])
e("boca juniors", "Boca Juniors", "Boca Juniors Argentine football Buenos Aires Bombonera", "Soccer", [])
e("club america", "Club America", "Club America Mexican football Liga MX Estadio Azteca Mexico City", "Soccer", [])
e("chivas", "Chivas Guadalajara", "Chivas Guadalajara Mexican football Liga MX Akron Stadium", "Soccer", [])
e("celtic", "Celtic FC", "Celtic Glasgow Scottish Premiership Parkhead football Scotland", "Soccer", [])
e("rangers", "Rangers FC", "Rangers Glasgow Scottish Premiership Ibrox football Scotland", "Soccer", [])
e("ajax", "Ajax Amsterdam", "Ajax Amsterdam Eredivisie Dutch football Johan Cruyff Arena Netherlands", "Soccer", [])
e("psv", "PSV Eindhoven", "PSV Eindhoven Eredivisie Dutch football Philips Stadion Netherlands", "Soccer", [])
e("porto", "FC Porto", "FC Porto Portuguese football Dragao Primeira Liga Portugal", "Soccer", [])
e("benfica", "SL Benfica", "Benfica Portuguese football Luz Stadium Primeira Liga Lisbon", "Soccer", [])
e("sporting cp", "Sporting CP", "Sporting CP Portuguese football Alvalade Primeira Liga Lisbon", "Soccer", [])
e("al ahly", "Al Ahly Cairo", "Al Ahly Egyptian football Cairo African Champions League", "Soccer", [])
e("persepolis", "Persepolis FC", "Persepolis Iranian football Tehran Azadi Stadium Persian Gulf", "Soccer", [])
e("esteghlal", "Esteghlal FC", "Esteghlal Iranian football Tehran Azadi Stadium blue", "Soccer", [])
e("fluminense", "Fluminense", "Fluminense Brazilian football Rio de Janeiro Maracana", "Soccer", [])
e("shakhtar donetsk", "Shakhtar Donetsk", "Shakhtar Donetsk Ukrainian football Champions League Donetsk", "Soccer", [])
e("dynamo kyiv", "Dynamo Kyiv", "Dynamo Kyiv Ukrainian football Kyiv Lobanovskyi", "Soccer", [])

# More soccer players
e("florian wirtz", "Florian Wirtz", "Florian Wirtz Bayer Leverkusen Germany football young talent Bundesliga", "Soccer", ["wirtz"])
e("phil foden", "Phil Foden", "Phil Foden Manchester City England football midfielder Premier League", "Soccer", ["foden"])
e("bruno fernandes", "Bruno Fernandes", "Bruno Fernandes Manchester United Portugal football midfielder captain", "Soccer", [])
e("declan rice", "Declan Rice", "Declan Rice Arsenal England football midfielder Premier League", "Soccer", [])
e("rodri", "Rodri", "Rodri Manchester City Spain football midfielder Ballon d'Or", "Soccer", [])
e("alexander isak", "Alexander Isak", "Alexander Isak Newcastle Sweden football striker Premier League goals", "Soccer", [])
e("william saliba", "William Saliba", "William Saliba Arsenal France football centre-back defender", "Soccer", [])
e("virgil van dijk", "Virgil van Dijk", "Virgil van Dijk Liverpool Netherlands football captain defender", "Soccer", ["van dijk"])
e("robert lewandowski", "Robert Lewandowski", "Robert Lewandowski Barcelona Poland football striker goals La Liga", "Soccer", ["lewandowski"])
e("kvaratskhelia", "Khvicha Kvaratskhelia", "Khvicha Kvaratskhelia PSG Georgia football winger dribbling", "Soccer", ["kvara"])

# ============================================================
# MORE NBA & WNBA (~20)
# ============================================================

e("wnba", "WNBA Women's Basketball", "WNBA Women's National Basketball Association women basketball professional", "Basketball", [])
e("caitlin clark", "Caitlin Clark", "Caitlin Clark Indiana Fever WNBA basketball Iowa NCAA record", "Basketball", [])
e("trail blazers", "Portland Trail Blazers", "Portland Trail Blazers NBA basketball Moda Center Oregon", "Basketball", ["blazers"])
e("wizards", "Washington Wizards", "Washington Wizards NBA basketball Capital One Arena DC", "Basketball", [])
e("hornets", "Charlotte Hornets", "Charlotte Hornets NBA basketball Spectrum Center LaMelo Ball", "Basketball", [])
e("pistons", "Detroit Pistons", "Detroit Pistons NBA basketball Little Caesars Arena Cade Cunningham", "Basketball", [])
e("jazz", "Utah Jazz", "Utah Jazz NBA basketball Delta Center Salt Lake City", "Basketball", [])
e("nba draft", "NBA Draft", "NBA Draft lottery picks prospects rookies first round selection", "Basketball", [])
e("nba finals", "NBA Finals", "NBA Finals championship basketball Larry O'Brien Trophy playoffs", "Basketball", [])
e("nba trade", "NBA Trades & Free Agency", "NBA trade free agency deadline deal contract signing roster moves", "Basketball", [])

# ============================================================
# MORE NFL (~15)
# ============================================================

e("nfl draft", "NFL Draft", "NFL Draft prospects picks first round selection combine", "Football", [])
e("nfl free agency", "NFL Free Agency", "NFL free agency contracts signings deals roster moves trades", "Football", [])
e("fantasy football", "Fantasy Football", "fantasy football NFL lineup points waiver wire start sit rankings", "Football", [])
e("tom brady", "Tom Brady", "Tom Brady retired quarterback GOAT Super Bowl rings Patriots", "Football", [])
e("dak prescott", "Dak Prescott", "Dak Prescott Cowboys quarterback Dallas NFL contract", "Football", [])
e("micah parsons", "Micah Parsons", "Micah Parsons Cowboys linebacker NFL defense pass rush Dallas", "Football", [])
e("sauce gardner", "Sauce Gardner", "Sauce Gardner Jets cornerback NFL defense interception New York", "Football", [])
e("maxx crosby", "Maxx Crosby", "Maxx Crosby Raiders defensive end NFL pass rusher Las Vegas", "Football", [])

# ============================================================
# MORE TECH (~40)
# ============================================================

e("apple vision pro", "Apple Vision Pro", "Apple Vision Pro spatial computing headset AR VR mixed reality", "AI & Tech", ["vision pro"])
e("chatgpt", "ChatGPT", "ChatGPT OpenAI conversational AI chatbot language model GPT", "AI & Tech", [])
e("claude", "Claude AI", "Claude Anthropic AI assistant chatbot helpful harmless honest", "AI & Tech", [])
e("perplexity", "Perplexity AI", "Perplexity AI search engine answer engine LLM knowledge", "AI & Tech", [])
e("cursor", "Cursor & AI Coding Tools", "Cursor AI coding IDE Copilot programming developer tools", "AI & Tech", [])
e("stable diffusion", "Stable Diffusion", "Stable Diffusion AI image generation open source Stability AI", "AI & Tech", [])
e("openai o1", "OpenAI o1 & Reasoning AI", "OpenAI o1 reasoning AI chain of thought GPT advanced", "AI & Tech", ["o1"])
e("gpt5", "GPT-5 & Next Gen AI", "GPT-5 OpenAI next generation language model artificial intelligence", "AI & Tech", ["gpt-5"])
e("figma", "Figma & Design Tools", "Figma design UI UX prototyping collaborative tool web", "AI & Tech", [])
e("notion", "Notion", "Notion productivity workspace notes databases wiki project management", "AI & Tech", [])
e("cloudflare", "Cloudflare", "Cloudflare CDN security web performance DDoS protection edge computing", "AI & Tech", [])
e("stripe", "Stripe", "Stripe online payments fintech processing commerce platform API", "AI & Tech", [])
e("starlink", "Starlink & Satellite Internet", "Starlink SpaceX satellite internet broadband global connectivity LEO", "AI & Tech", [])
e("zoom", "Zoom", "Zoom video conferencing remote work meetings virtual collaboration", "AI & Tech", [])
e("spotify", "Spotify", "Spotify music streaming podcast playlist algorithm discovery", "AI & Tech", [])
e("openai agents", "AI Agents & Autonomous AI", "AI agents autonomous artificial intelligence automated tasks multi-step reasoning", "AI & Tech", ["ai agents"])
e("data privacy", "Data Privacy & GDPR", "data privacy GDPR regulation personal information protection consent", "AI & Tech", ["gdpr"])
e("5g", "5G & Telecom", "5G telecommunications mobile network infrastructure Qualcomm Ericsson Nokia", "AI & Tech", [])
e("apple intelligence", "Apple Intelligence", "Apple Intelligence on-device AI Siri machine learning iOS privacy", "AI & Tech", [])
e("gemini", "Google Gemini", "Google Gemini AI multimodal language model DeepMind artificial intelligence", "AI & Tech", [])

# ============================================================
# MORE ENTERTAINMENT (~40)
# ============================================================

e("squid game", "Squid Game", "Squid Game Netflix Korean series survival thriller drama season", "Entertainment", [])
e("the bear", "The Bear", "The Bear FX Hulu series kitchen restaurant drama cooking Chicago", "Entertainment", [])
e("wednesday", "Wednesday Addams", "Wednesday Addams Netflix series Jenna Ortega Tim Burton gothic", "Entertainment", [])
e("bridgerton", "Bridgerton", "Bridgerton Netflix series Shonda Rhimes Regency romance period drama", "Entertainment", [])
e("the witcher", "The Witcher", "The Witcher Netflix series fantasy Geralt Liam Hemsworth games", "Entertainment", [])
e("doctor who", "Doctor Who", "Doctor Who BBC series sci-fi time travel TARDIS Ncuti Gatwa", "Entertainment", [])
e("succession", "Succession", "Succession HBO series Roy family media empire drama business", "Entertainment", [])
e("white lotus", "The White Lotus", "The White Lotus HBO series resort dark comedy anthology drama", "Entertainment", [])
e("reacher", "Reacher", "Reacher Amazon Prime series action thriller Alan Ritchson Jack Reacher", "Entertainment", [])
e("shogun", "Shogun", "Shogun FX Hulu series Japan historical samurai feudal period drama", "Entertainment", [])
e("fallout tv", "Fallout TV Series", "Fallout Amazon Prime series post-apocalyptic game adaptation Bethesda", "Entertainment", [])
e("rings of power", "Rings of Power", "Lord of the Rings Rings of Power Amazon Prime Tolkien Middle-earth", "Entertainment", [])
e("dune", "Dune", "Dune movie Denis Villeneuve Timothee Chalamet Arrakis sci-fi Herbert", "Entertainment", [])
e("deadpool", "Deadpool & Wolverine", "Deadpool Wolverine Marvel Ryan Reynolds Hugh Jackman MCU movie", "Entertainment", [])
e("barbie", "Barbie", "Barbie movie Margot Robbie Greta Gerwig doll Mattel pink", "Entertainment", [])
e("oppenheimer", "Oppenheimer", "Oppenheimer Christopher Nolan Cillian Murphy atomic bomb historical movie", "Entertainment", [])
e("zelda", "Legend of Zelda", "Legend of Zelda Nintendo Link Tears of the Kingdom Breath Wild gaming", "Entertainment", [])
e("elden ring", "Elden Ring", "Elden Ring FromSoftware Dark Souls RPG open world Miyazaki DLC", "Entertainment", [])
e("baldurs gate", "Baldur's Gate 3", "Baldur's Gate 3 Larian Studios RPG D&D Dungeons Dragons GOTY", "Entertainment", [])
e("call of duty", "Call of Duty", "Call of Duty CoD Activision FPS shooter gaming Warzone Black Ops", "Entertainment", ["cod", "warzone"])
e("hogwarts legacy", "Hogwarts Legacy", "Hogwarts Legacy Harry Potter game open world RPG Avalanche", "Entertainment", [])
e("diablo", "Diablo", "Diablo Blizzard action RPG dungeon crawler Diablo IV Sanctuary", "Entertainment", [])
e("league of legends", "League of Legends", "League of Legends LoL Riot Games MOBA esports competitive gaming", "Entertainment", ["lol"])
e("valorant", "Valorant", "Valorant Riot Games FPS tactical shooter esports competitive", "Entertainment", [])
e("apple tv plus", "Apple TV+", "Apple TV Plus streaming original series movies Severance Morning Show", "Entertainment", ["apple tv+"])
e("amazon prime", "Amazon Prime Video", "Amazon Prime Video streaming originals movies series Rings of Power", "Entertainment", ["prime video"])
e("hulu", "Hulu", "Hulu streaming service original series movies Disney-owned", "Entertainment", [])

# More music
e("olivia rodrigo", "Olivia Rodrigo", "Olivia Rodrigo pop music GUTS driver's license singer Gen Z", "Entertainment", [])
e("dua lipa", "Dua Lipa", "Dua Lipa pop music dance British Albanian singer songwriter", "Entertainment", [])
e("post malone", "Post Malone", "Post Malone music rapper country pop genre-bending Austin", "Entertainment", [])
e("ice spice", "Ice Spice", "Ice Spice rapper hip hop Bronx viral TikTok drill music", "Entertainment", [])
e("sabrina carpenter", "Sabrina Carpenter", "Sabrina Carpenter pop music singer Espresso Nonsense viral", "Entertainment", [])
e("chappell roan", "Chappell Roan", "Chappell Roan pop music singer Pink Pony Club drag inspired", "Entertainment", [])
e("peso pluma", "Peso Pluma", "Peso Pluma Mexican music corridos tumbados regional Latin", "Entertainment", [])
e("shakira", "Shakira", "Shakira Colombian music singer Latin pop global star", "Entertainment", [])
e("eminem", "Eminem", "Eminem rapper hip hop Detroit slim shady Marshall Mathers", "Entertainment", [])
e("kanye", "Kanye West", "Kanye West Ye rapper producer fashion music controversial", "Entertainment", ["ye"])
e("adele", "Adele", "Adele British singer pop soul ballad Grammy Las Vegas residency", "Entertainment", [])

# ============================================================
# MORE SCIENCE (~15)
# ============================================================

e("crispr", "CRISPR & Gene Editing", "CRISPR gene editing genetic engineering therapy DNA biotechnology", "Science", ["gene editing"])
e("brain computer", "Brain-Computer Interfaces", "brain-computer interface BCI Neuralink neural implant paralysis", "Science", ["neuralink", "bci"])
e("dark matter", "Dark Matter & Dark Energy", "dark matter dark energy universe cosmology physics mystery", "Science", [])
e("dinosaur", "Dinosaur Discoveries", "dinosaur fossil paleontology discovery prehistoric extinction Jurassic", "Science", ["fossil"])
e("ocean", "Ocean & Marine Science", "ocean marine science deep sea coral reef underwater exploration", "Science", [])
e("hurricane", "Hurricanes & Tropical Storms", "hurricane tropical storm cyclone typhoon severe weather category NOAA", "Science", ["cyclone", "typhoon"])
e("wildfire", "Wildfires & Forest Fires", "wildfire forest fire California climate drought evacuation firefighter", "Science", [])
e("pandemic", "Pandemic Preparedness", "pandemic virus outbreak disease WHO public health preparedness response", "Science", [])
e("telescope", "Space Telescopes", "space telescope Hubble James Webb observation astronomy deep field", "Science", [])
e("black hole", "Black Holes", "black hole space physics event horizon singularity Hawking radiation galaxy", "Science", [])

# ============================================================
# MORE WORLD REGIONS (~30)
# ============================================================

e("japan", "Japan", "Japan Tokyo Japanese culture technology economy anime Asia Pacific", "World Politics", [])
e("south korea", "South Korea", "South Korea Seoul Korean economy K-pop Samsung technology KOSPI", "World Politics", [])
e("india", "India", "India Delhi Mumbai Modi economy tech Bollywood cricket 1.4 billion", "World Politics", [])
e("germany", "Germany", "Germany Berlin Bundestag EU economy Volkswagen Bundesliga Europe", "World Politics", [])
e("france", "France", "France Paris Macron EU economy culture Ligue 1 nuclear", "World Politics", [])
e("brazil", "Brazil", "Brazil Brasilia Lula economy Amazon football Samba Latin America", "World Politics", [])
e("australia", "Australia", "Australia Canberra economy mining cricket Outback Pacific", "World Politics", [])
e("mexico", "Mexico", "Mexico Mexico City economy trade USMCA drug cartels Latin America", "World Politics", [])
e("spain", "Spain", "Spain Madrid Barcelona La Liga economy EU tourism Europe", "World Politics", [])
e("italy", "Italy", "Italy Rome Milan Serie A economy fashion EU G7 Europe", "World Politics", [])
e("turkey", "Turkey", "Turkey Turkiye Istanbul Ankara Erdogan economy NATO Middle East", "World Politics", ["turkiye"])
e("pakistan", "Pakistan", "Pakistan Islamabad Imran Khan cricket economy military South Asia", "World Politics", [])
e("indonesia", "Indonesia", "Indonesia Jakarta Southeast Asia economy palm oil ASEAN Islam", "World Politics", [])
e("egypt", "Egypt", "Egypt Cairo Nile pyramid Suez Canal Middle East economy Africa", "World Politics", [])
e("south africa", "South Africa", "South Africa Johannesburg Pretoria economy ANC Mandela mining", "World Politics", [])
e("nigeria", "Nigeria", "Nigeria Lagos Abuja economy oil Africa largest population Nollywood", "World Politics", [])
e("argentina", "Argentina", "Argentina Buenos Aires Milei economy peso football Messi", "World Politics", [])
e("poland", "Poland", "Poland Warsaw Krakow EU economy NATO Eastern Europe", "World Politics", [])
e("philippines", "Philippines", "Philippines Manila Marcos Duterte economy Southeast Asia", "World Politics", [])
e("colombia", "Colombia", "Colombia Bogota Petro economy coffee Latin America Escobar", "World Politics", [])
e("uae", "United Arab Emirates", "UAE Dubai Abu Dhabi economy oil luxury real estate Middle East", "World Politics", ["dubai", "abu dhabi"])
e("israel", "Israel", "Israel Jerusalem Tel Aviv Knesset IDF tech startup holy land", "World Politics", [])
e("iraq", "Iraq", "Iraq Baghdad Kurdistan oil war ISIS Middle East Mesopotamia", "World Politics", [])
e("afghanistan", "Afghanistan", "Afghanistan Kabul Taliban war conflict Central Asia humanitarian", "World Politics", [])
e("syria", "Syria", "Syria Damascus civil war Assad refugees Middle East conflict", "World Politics", [])
e("venezuela", "Venezuela", "Venezuela Caracas Maduro oil crisis economy Latin America", "World Politics", [])
e("cuba", "Cuba", "Cuba Havana Castro Caribbean communism sanctions embargo", "World Politics", [])
e("hong kong", "Hong Kong", "Hong Kong China special region protests finance hub Asia Pacific", "World Politics", [])
e("singapore", "Singapore", "Singapore city-state Southeast Asia finance tech hub ASEAN", "World Politics", [])
e("scotland", "Scotland", "Scotland Edinburgh Glasgow independence referendum UK SNP", "World Politics", [])

# ============================================================
# MORE HEALTH & PHARMA (~15)
# ============================================================

e("diabetes", "Diabetes & Blood Sugar", "diabetes blood sugar insulin type 2 glucose management health", "Health", [])
e("heart disease", "Heart Disease & Cardiology", "heart disease cardiovascular cardiology cholesterol blood pressure stroke", "Health", [])
e("covid", "COVID-19 & Long COVID", "COVID-19 coronavirus pandemic long COVID symptoms variant omicron", "Health", ["coronavirus", "long covid"])
e("gut health", "Gut Health & Microbiome", "gut health microbiome probiotics digestive fiber bacteria wellness", "Health", ["microbiome", "probiotics"])
e("sleep", "Sleep Science & Insomnia", "sleep insomnia circadian rhythm melatonin REM quality rest", "Health", [])
e("fertility", "Fertility & IVF", "fertility IVF reproductive health pregnancy embryo treatment conception", "Health", ["ivf"])
e("nutrition", "Nutrition & Diet Science", "nutrition diet vitamins minerals macros calories healthy eating science", "Health", [])
e("pfizer", "Pfizer", "Pfizer pharmaceutical company vaccine drug medication biotech", "Health", [])
e("novo nordisk", "Novo Nordisk", "Novo Nordisk pharmaceutical Ozempic Wegovy GLP-1 obesity diabetes", "Health", [])
e("moderna", "Moderna", "Moderna mRNA vaccine pharmaceutical biotechnology Cambridge", "Health", [])

# ============================================================
# MORE FINANCE & BUSINESS (~20)
# ============================================================

e("berkshire hathaway", "Berkshire Hathaway", "Berkshire Hathaway Warren Buffett investment conglomerate Omaha", "Finance", ["warren buffett"])
e("jpmorgan", "JPMorgan Chase", "JPMorgan Chase bank finance Jamie Dimon Wall Street investment", "Finance", ["jp morgan"])
e("goldman sachs", "Goldman Sachs", "Goldman Sachs investment bank Wall Street finance trading", "Finance", [])
e("blackrock", "BlackRock", "BlackRock investment management Larry Fink ETF iShares largest fund", "Finance", [])
e("softbank", "SoftBank", "SoftBank Japanese investment Vision Fund Masayoshi Son tech", "Finance", [])
e("alibaba", "Alibaba", "Alibaba Chinese ecommerce tech Jack Ma Taobao cloud China", "Business", [])
e("tencent", "Tencent", "Tencent Chinese tech WeChat gaming Pony Ma Shenzhen", "Business", [])
e("tsmc", "TSMC", "TSMC Taiwan Semiconductor chip fabrication foundry advanced process", "Business", [])
e("asml", "ASML", "ASML Dutch semiconductor lithography EUV chip manufacturing equipment", "Business", [])
e("costco", "Costco", "Costco warehouse retail membership wholesale bulk shopping", "Business", [])
e("walmart", "Walmart", "Walmart retail store ecommerce Bentonville Arkansas biggest", "Business", [])
e("uber", "Uber", "Uber rideshare delivery transportation gig economy Dara Khosrowshahi", "Business", [])
e("airbnb", "Airbnb", "Airbnb vacation rental hosting travel accommodation platform sharing", "Business", [])
e("shein", "Shein & Fast Fashion", "Shein fast fashion Chinese online retailer cheap clothing ecommerce", "Business", ["fast fashion"])
e("temu", "Temu", "Temu Chinese shopping app ecommerce cheap products Pinduoduo", "Business", [])

# ============================================================
# GOLF (~10)
# ============================================================

e("golf", "Golf & PGA Tour", "golf PGA Tour professional club course Masters major tournament", "Golf", ["pga tour"])
e("tiger woods", "Tiger Woods", "Tiger Woods golf legend majors PGA Tour comeback Nike", "Golf", [])
e("rory mcilroy", "Rory McIlroy", "Rory McIlroy golf Northern Ireland PGA Tour majors world ranking", "Golf", [])
e("scottie scheffler", "Scottie Scheffler", "Scottie Scheffler golf world number one PGA Tour Masters winner", "Golf", [])
e("bryson dechambeau", "Bryson DeChambeau", "Bryson DeChambeau golf LIV Golf power distance YouTube", "Golf", [])
e("liv golf", "LIV Golf", "LIV Golf Saudi Arabia PIF breakaway tour professional controversy", "Golf", [])
e("jon rahm", "Jon Rahm", "Jon Rahm golf Spanish LIV Golf Masters major winner", "Golf", [])

# ============================================================
# MORE LIFESTYLE & CULTURE (~15)
# ============================================================

e("minimalism", "Minimalism & Decluttering", "minimalism decluttering simple living Marie Kondo less is more", "Lifestyle", [])
e("digital nomad", "Digital Nomad & Remote Work", "digital nomad remote work location independent freelance travel work", "Lifestyle", ["remote work"])
e("productivity", "Productivity & Time Management", "productivity time management focus habits GTD Pomodoro efficiency", "Lifestyle", [])
e("interior design", "Interior Design & Home Decor", "interior design home decor renovation architecture furniture modern", "Lifestyle", ["home decor"])
e("gardening", "Gardening & Plants", "gardening plants houseplants garden grow vegetables herbs flowers", "Lifestyle", ["houseplants"])
e("diy", "DIY & Crafts", "DIY do it yourself crafts maker woodworking projects tutorials", "Lifestyle", [])
e("parenting", "Parenting & Family", "parenting family children kids baby newborn toddler advice tips", "Lifestyle", [])
e("astrology", "Astrology & Horoscopes", "astrology horoscope zodiac signs planets retrograde birth chart", "Lifestyle", [])
e("tattoo", "Tattoo Art & Culture", "tattoo art body ink design culture piercing artist studio", "Lifestyle", [])
e("thrifting", "Thrifting & Vintage", "thrifting vintage secondhand fashion sustainability resale Depop", "Lifestyle", ["vintage", "secondhand"])


# ============================================================
# FOOD & RECIPES EXPANDED (+350)
# ============================================================

# Specific dishes & cuisines
e("chicken tikka masala", "Chicken Tikka Masala", "chicken tikka masala Indian curry creamy tomato spiced yogurt", "Food", ["tikka masala"])
e("butter chicken", "Butter Chicken & Naan", "butter chicken murgh makhani creamy Indian curry naan bread", "Food", ["murgh makhani"])
e("pad thai", "Pad Thai & Thai Noodles", "pad thai Thai noodles stir fry peanut tamarind street food", "Food", [])
e("pho", "Vietnamese Pho & Noodle Soup", "pho Vietnamese noodle soup broth beef herbs rice noodles", "Food", ["vietnamese pho"])
e("ramen recipes", "Ramen Recipes & Noodle Bowls", "ramen recipes noodle bowls tonkotsu miso shoyu Japanese soup", "Food", [])
e("tacos al pastor", "Tacos al Pastor", "tacos al pastor Mexican pork pineapple spit roasted street food", "Food", ["al pastor"])
e("birria tacos", "Birria Tacos & Consomme", "birria tacos Mexican braised beef consomme dipping crispy", "Food", ["birria"])
e("ceviche", "Ceviche & Fresh Seafood", "ceviche fresh seafood lime citrus Peruvian Latin American fish", "Food", [])
e("dim sum", "Dim Sum & Chinese Dumplings", "dim sum Chinese dumplings steamed buns har gow siu mai", "Food", ["dumplings"])
e("banh mi", "Banh Mi & Vietnamese Street Food", "banh mi Vietnamese sandwich baguette pickled vegetables pork", "Food", [])
e("shawarma", "Shawarma & Middle Eastern Wraps", "shawarma Middle Eastern wrap rotisserie meat tahini garlic", "Food", [])
e("falafel", "Falafel & Hummus", "falafel hummus chickpea Middle Eastern vegetarian pita wrap", "Food", [])
e("jollof rice", "Jollof Rice & West African Food", "jollof rice West African Nigerian Ghanaian tomato spiced one-pot", "Food", [])
e("empanadas", "Empanadas & Latin Pastries", "empanadas Latin American pastry filled baked fried Argentina Chile", "Food", [])
e("pupusas", "Pupusas & Salvadoran Food", "pupusas Salvadoran stuffed corn tortilla cheese beans curtido", "Food", [])
e("arepas", "Arepas & Venezuelan Food", "arepas Venezuelan Colombian corn flatbread stuffed cheese", "Food", [])
e("poke bowl", "Poke Bowls & Hawaiian Food", "poke bowl Hawaiian raw fish rice toppings soy sauce sesame", "Food", ["poke"])
e("acai bowl", "Acai Bowls & Smoothie Bowls", "acai bowl smoothie bowl superfood berries granola toppings", "Food", ["acai"])
e("avocado toast", "Avocado Toast & Brunch Ideas", "avocado toast brunch breakfast sourdough eggs poached healthy", "Food", [])
e("overnight oats", "Overnight Oats & Meal Prep", "overnight oats meal prep breakfast chia seeds yogurt easy", "Food", [])
e("banana bread", "Banana Bread & Easy Baking", "banana bread baking easy recipe moist loaf comfort homemade", "Food", [])
e("fried chicken", "Fried Chicken Recipes", "fried chicken crispy Southern buttermilk coating crunchy comfort food", "Food", [])
e("steak", "Perfect Steak & Grilling Tips", "steak grilling ribeye medium rare sear cast iron reverse", "Food", [])
e("burgers", "Gourmet Burgers & Sliders", "burgers gourmet smash patty bun cheese toppings homemade", "Food", ["smash burger"])
e("pizza recipes", "Homemade Pizza & Dough Recipes", "pizza homemade dough Neapolitan New York style oven toppings", "Food", [])
e("carbonara", "Pasta Carbonara & Roman Classics", "carbonara Italian pasta egg pecorino guanciale Roman classic", "Food", [])
e("risotto", "Risotto & Italian Rice Dishes", "risotto Italian rice arborio creamy mushroom saffron parmesan", "Food", [])
e("lasagna", "Lasagna & Baked Pasta", "lasagna baked pasta layers bolognese bechamel cheese Italian comfort", "Food", [])
e("tiramisu", "Tiramisu & Italian Desserts", "tiramisu Italian dessert mascarpone espresso ladyfingers cocoa", "Food", [])
e("cheesecake", "Cheesecake Recipes", "cheesecake baking New York style creamy crust dessert graham", "Food", [])
e("brownies", "Fudgy Brownies & Chocolate Treats", "brownies fudgy chocolate baking cocoa butter dessert rich", "Food", [])
e("cookies recipes", "Cookie Recipes & Baking Tips", "cookies baking chocolate chip sugar shortbread crispy chewy", "Food", [])
e("cinnamon rolls", "Cinnamon Rolls & Sweet Pastries", "cinnamon rolls pastry baking icing dough yeast sweet", "Food", [])
e("croissants", "Croissants & French Pastries", "croissants French pastry butter laminated flaky baking viennoiserie", "Food", [])
e("matcha", "Matcha & Japanese Green Tea", "matcha Japanese green tea latte powder ceremonial antioxidants", "Food", ["matcha latte"])
e("boba tea", "Boba Tea & Bubble Tea", "boba bubble tea tapioca pearls milk tea Taiwanese drink toppings", "Food", ["bubble tea"])
e("iced coffee", "Iced Coffee & Cold Brew", "iced coffee cold brew summer drinks caffeine refreshing recipe", "Food", ["cold brew"])
e("cocktails", "Cocktail Recipes & Mixology", "cocktails mixology drinks margarita martini mojito bartending", "Food", ["mixology"])
e("mocktails", "Mocktails & Non-Alcoholic Drinks", "mocktails non-alcoholic drinks virgin cocktail sober curious", "Food", [])
e("wine", "Wine & Sommelier Tips", "wine red white rose sommelier pairing tasting vineyard grapes", "Food", [])
e("craft beer", "Craft Beer & Brewing", "craft beer brewing IPA stout lager hops homebrew microbrewery", "Food", [])
e("kombucha", "Kombucha & Fermented Drinks", "kombucha fermented tea probiotic SCOBY gut health fizzy", "Food", [])
e("protein shake", "Protein Shakes & Post-Workout", "protein shake post-workout whey powder muscle recovery blend", "Food", [])
e("meal prep ideas", "Meal Prep Ideas & Batch Cooking", "meal prep batch cooking weekly planning containers healthy budget", "Food", [])
e("budget meals", "Budget Meals & Cheap Eats", "budget meals cheap eating affordable cooking frugal student", "Food", [])
e("one pot meals", "One-Pot Meals & Easy Dinners", "one-pot meals easy dinner simple cooking weeknight minimal dishes", "Food", [])
e("slow cooker", "Slow Cooker & Crockpot Recipes", "slow cooker crockpot recipes stew braised set-and-forget tender", "Food", ["crockpot"])
e("instant pot", "Instant Pot & Pressure Cooker", "Instant Pot pressure cooker fast meals rice beans tender", "Food", ["pressure cooker"])
e("wok cooking", "Wok Cooking & Stir Fry", "wok cooking stir fry high heat Asian technique fried rice", "Food", ["stir fry"])
e("sourdough starter", "Sourdough Starter & Artisan Bread", "sourdough starter artisan bread fermentation wild yeast levain", "Food", [])
e("gluten free", "Gluten-Free Recipes & Baking", "gluten-free recipes baking celiac alternative flour allergen-free", "Food", [])
e("dairy free", "Dairy-Free & Lactose-Free", "dairy-free lactose-free alternatives oat milk coconut cream vegan", "Food", [])
e("whole30", "Whole30 Diet & Clean Eating", "Whole30 diet clean eating elimination paleo reset nutrition", "Food", [])
e("carnivore diet", "Carnivore Diet & Meat-Based", "carnivore diet meat-based beef animal protein zero carb", "Food", [])
e("anti inflammatory", "Anti-Inflammatory Foods & Diet", "anti-inflammatory diet foods turmeric omega-3 berries leafy greens", "Food", [])
e("gut friendly food", "Gut-Friendly Foods & Probiotics", "gut-friendly foods probiotics fermented yogurt kefir sauerkraut", "Food", [])
e("turkish food", "Turkish Food & Kebabs", "Turkish food kebab baklava lahmacun pide doner Istanbul cuisine", "Food", ["kebab", "baklava"])
e("ethiopian food", "Ethiopian Food & Injera", "Ethiopian food injera wat berbere spices African cuisine communal", "Food", ["injera"])
e("thai food", "Thai Food & Curry", "Thai food curry green red Pad See Ew basil coconut spicy", "Food", ["thai curry"])
e("filipino food", "Filipino Food & Adobo", "Filipino food adobo sinigang lumpia lechon Filipino cuisine", "Food", ["adobo"])
e("greek food", "Greek Food & Mediterranean", "Greek food gyro souvlaki moussaka tzatziki olive oil Mediterranean", "Food", ["gyro"])
e("spanish tapas", "Spanish Tapas & Small Plates", "Spanish tapas small plates patatas bravas croquetas jamon olives", "Food", ["tapas"])
e("brazilian food", "Brazilian Food & Churrasco", "Brazilian food churrasco picanha feijoada pao de queijo acai", "Food", ["churrasco"])
e("peruvian food", "Peruvian Food & Ceviche", "Peruvian food ceviche lomo saltado causa aji anticuchos", "Food", [])
e("moroccan food", "Moroccan Food & Tagine", "Moroccan food tagine couscous harissa spices North African cuisine", "Food", ["tagine"])
e("lebanese food", "Lebanese Food & Mezze", "Lebanese food mezze hummus tabbouleh fattoush kibbeh pita", "Food", ["mezze"])
e("indonesian food", "Indonesian Food & Satay", "Indonesian food satay nasi goreng rendang sambal street food", "Food", ["nasi goreng", "satay"])
e("malay food", "Malaysian Food & Laksa", "Malaysian food laksa nasi lemak char kuey teow rendang", "Food", ["laksa"])
e("nigerian food", "Nigerian Food & Suya", "Nigerian food suya egusi pepper soup fufu West African", "Food", ["suya"])
e("caribbean food", "Caribbean Food & Jerk Chicken", "Caribbean food jerk chicken rice peas plantain rum punch", "Food", ["jerk chicken"])
e("cajun food", "Cajun & Creole Cooking", "Cajun Creole cooking gumbo jambalaya New Orleans Louisiana spicy", "Food", ["gumbo", "jambalaya"])
e("soul food", "Soul Food & Southern Cooking", "soul food Southern cooking mac cheese collard greens cornbread", "Food", ["southern cooking"])
e("chinese hotpot", "Chinese Hotpot & Fondue", "Chinese hotpot fondue Sichuan broth spicy communal dipping", "Food", ["hotpot"])
e("dumplings recipes", "Dumpling Recipes & Potstickers", "dumplings potstickers gyoza wonton filling wrapping steamed fried", "Food", ["gyoza", "potstickers"])
e("noodle dishes", "Noodle Dishes & Asian Bowls", "noodle dishes Asian bowls udon soba chow mein lo mein", "Food", [])
e("fried rice", "Fried Rice & Quick Asian Meals", "fried rice wok egg vegetables soy sauce quick Asian meal", "Food", [])
e("sushi making", "Sushi Making & Rolls at Home", "sushi making rolls home rice nori fish avocado technique", "Food", [])
e("bento box", "Bento Box & Japanese Lunch", "bento box Japanese lunch meal prep cute organized rice", "Food", ["bento"])
e("charcuterie", "Charcuterie Boards & Grazing", "charcuterie board grazing cheese meat crackers appetizer party", "Food", ["cheese board"])
e("ice cream", "Ice Cream & Frozen Treats", "ice cream frozen treats gelato sorbet homemade scoop sundae", "Food", ["gelato"])
e("pancakes waffles", "Pancakes & Waffles Brunch", "pancakes waffles brunch breakfast fluffy syrup berries stack", "Food", [])
e("egg recipes", "Egg Recipes & Breakfast Ideas", "egg recipes breakfast scrambled poached omelette frittata Benedict", "Food", [])
e("salad recipes", "Fresh Salads & Dressings", "salad recipes fresh greens dressings healthy toppings bowl", "Food", [])
e("soup recipes", "Soup Recipes & Comfort Bowls", "soup recipes comfort bowls warm hearty broth creamy chunky", "Food", [])
e("sandwich ideas", "Sandwiches & Lunch Ideas", "sandwich ideas lunch panini wrap sub club creative filling", "Food", [])
e("taco tuesday", "Taco Tuesday & Fillings", "taco Tuesday fillings seasoning fish chicken beef vegetarian shell", "Food", [])
e("wings recipes", "Chicken Wings & Game Day", "chicken wings recipes game day buffalo hot sauce crispy baked", "Food", ["buffalo wings"])
e("seafood recipes", "Seafood Recipes & Fish Dishes", "seafood recipes fish dishes salmon shrimp lobster grilled baked", "Food", [])
e("salmon recipes", "Salmon Recipes & Healthy Fish", "salmon recipes healthy fish omega-3 baked grilled glazed crispy", "Food", [])
e("shrimp dishes", "Shrimp Dishes & Prawn Recipes", "shrimp dishes prawn recipes garlic scampi grilled coconut curry", "Food", [])
e("tofu recipes", "Tofu Recipes & Plant Protein", "tofu recipes plant protein crispy baked stir fry marinated", "Food", [])
e("cauliflower", "Cauliflower & Veggie Substitutes", "cauliflower veggie substitute rice crust wings low carb healthy", "Food", [])
e("sweet potato", "Sweet Potato & Root Vegetables", "sweet potato root vegetable baked fries mash roasted healthy", "Food", [])
e("avocado recipes", "Avocado Recipes & Healthy Fats", "avocado recipes healthy fats guacamole toast salad creamy", "Food", [])
e("energy balls", "Energy Balls & Healthy Snacks", "energy balls healthy snacks no-bake protein oats dates portable", "Food", ["protein balls"])
e("granola", "Homemade Granola & Trail Mix", "granola homemade trail mix oats nuts seeds honey crunchy", "Food", [])
e("fermented foods", "Fermented Foods & Kimchi", "fermented foods kimchi sauerkraut miso kefir probiotic gut health", "Food", [])
e("cheese recipes", "Cheese Recipes & Fondue", "cheese recipes fondue grilled mac baked melty comfort", "Food", [])
e("bread baking", "Bread Baking & Homemade Loaves", "bread baking homemade loaves yeast flour kneading rise oven", "Food", [])
e("cake decorating", "Cake Decorating & Frosting", "cake decorating frosting buttercream fondant layers birthday party", "Food", [])
e("pie recipes", "Pie Recipes & Tarts", "pie recipes tarts crust filling fruit cream pecan pumpkin", "Food", [])
e("muffins", "Muffins & Quick Breads", "muffins quick bread blueberry banana chocolate chip bran easy", "Food", [])
e("donuts", "Donuts & Fried Dough", "donuts doughnuts fried glazed sprinkles filled cream jelly", "Food", [])
e("crepes", "Crepes & French Breakfast", "crepes French breakfast thin pancake Nutella strawberry savory", "Food", [])
e("churros", "Churros & Cinnamon Sugar", "churros cinnamon sugar fried dough Mexican Spanish chocolate dip", "Food", [])
e("mochi", "Mochi & Japanese Sweets", "mochi Japanese sweet rice cake daifuku ice cream chewy", "Food", [])
e("macarons", "Macarons & French Cookies", "macarons French cookies meringue almond filling delicate colorful", "Food", [])
e("protein meals", "High Protein Meals & Gains", "high protein meals muscle building chicken breast eggs lean meat", "Food", [])
e("low calorie meals", "Low Calorie Meals & Light Eating", "low calorie meals light eating diet weight loss portion healthy", "Food", [])
e("green juice", "Green Juice & Detox Drinks", "green juice detox drinks celery kale spinach cleanse wellness", "Food", ["detox"])
e("food photography", "Food Photography & Plating", "food photography plating styling Instagram visual presentation", "Food", [])
e("food trucks", "Food Trucks & Street Eats", "food trucks street food vendor outdoor festival mobile kitchen", "Food", [])
e("michelin", "Michelin Star & Fine Dining", "Michelin star fine dining restaurant chef tasting menu gourmet", "Food", ["fine dining"])
e("cooking tips", "Cooking Tips & Kitchen Hacks", "cooking tips kitchen hacks technique shortcuts efficiency flavor", "Food", [])
e("spice blends", "Spice Blends & Seasonings", "spice blends seasonings rub mix herbs flavor enhancement pantry", "Food", [])
e("fermentation", "Fermentation & Preserving", "fermentation preserving pickling canning kombucha sourdough lacto", "Food", [])


# ============================================================
# GAMING EXPANDED (+200)
# ============================================================

# Major current titles (2024-2026)
e("gta 6", "GTA 6 & Grand Theft Auto VI", "GTA 6 Grand Theft Auto VI Rockstar Games open world Vice City 2025", "Gaming", ["grand theft auto 6"])
e("starfield", "Starfield & Bethesda RPGs", "Starfield Bethesda RPG space exploration Xbox open world Shattered Space", "Gaming", [])
e("palworld", "Palworld", "Palworld Pokemon survival crafting monster catching multiplayer Pocketpair", "Gaming", [])
e("helldivers 2", "Helldivers 2", "Helldivers 2 cooperative shooter democracy bugs Arrowhead PS5 PC", "Gaming", [])
e("black myth wukong", "Black Myth: Wukong", "Black Myth Wukong action RPG Chinese mythology Game Science Journey to the West", "Gaming", ["wukong"])
e("final fantasy", "Final Fantasy Series", "Final Fantasy Square Enix JRPG RPG series XVI VII Rebirth crystals", "Gaming", ["final fantasy 7"])
e("dragon age", "Dragon Age: The Veilguard", "Dragon Age Veilguard BioWare RPG fantasy companions story choices", "Gaming", [])
e("monster hunter wilds", "Monster Hunter Wilds", "Monster Hunter Wilds Capcom action RPG creatures cooperative hunting", "Gaming", ["monster hunter"])
e("metaphor refantazio", "Metaphor: ReFantazio", "Metaphor ReFantazio Atlus JRPG fantasy Persona creators RPG", "Gaming", [])
e("kingdom hearts", "Kingdom Hearts", "Kingdom Hearts Square Enix Disney action RPG Sora Keyblade hearts", "Gaming", [])
e("persona", "Persona Series", "Persona Atlus JRPG social sim school supernatural RPG Joker", "Gaming", ["persona 5", "persona 6"])
e("zelda totk", "Zelda: Tears of the Kingdom", "Zelda Tears of the Kingdom Nintendo Switch Link Hyrule adventure", "Gaming", [])
e("mario", "Super Mario & Nintendo", "Super Mario Nintendo platformer Mushroom Kingdom odyssey wonder", "Gaming", ["super mario"])
e("cyberpunk 2077", "Cyberpunk 2077", "Cyberpunk 2077 CD Projekt Red Night City Phantom Liberty open world RPG", "Gaming", ["cyberpunk"])
e("the witcher 4", "The Witcher 4", "The Witcher 4 CD Projekt Red RPG fantasy Ciri new saga", "Gaming", ["witcher 4"])
e("overwatch 2", "Overwatch 2", "Overwatch 2 Blizzard hero shooter team-based competitive FPS", "Gaming", ["overwatch"])
e("apex legends", "Apex Legends", "Apex Legends Respawn battle royale FPS EA hero shooter legends", "Gaming", ["apex"])
e("destiny 2", "Destiny 2", "Destiny 2 Bungie looter shooter FPS MMO sci-fi raids Lightfall", "Gaming", [])
e("counter strike 2", "Counter-Strike 2", "Counter-Strike 2 CS2 Valve FPS competitive tactical shooter esports", "Gaming", ["cs2"])
e("rainbow six siege", "Rainbow Six Siege", "Rainbow Six Siege Ubisoft tactical FPS operators competitive breach", "Gaming", ["r6 siege"])
e("rocket league", "Rocket League", "Rocket League Psyonix car soccer aerial goals competitive", "Gaming", [])
e("fall guys", "Fall Guys", "Fall Guys Mediatonic battle royale party game obstacle bean", "Gaming", [])
e("among us", "Among Us", "Among Us social deduction impostor crewmate emergency meeting", "Gaming", [])
e("roblox", "Roblox", "Roblox gaming platform user-created experiences kids social metaverse", "Gaming", [])
e("stardew valley", "Stardew Valley", "Stardew Valley farming simulation indie pixel art relaxing ConcernedApe", "Gaming", [])
e("animal crossing", "Animal Crossing", "Animal Crossing Nintendo cozy village life simulation island villagers", "Gaming", [])
e("sims", "The Sims & Life Simulation", "Sims EA life simulation building families houses Sims 4 Sims 5", "Gaming", ["sims 4", "sims 5"])
e("fifa ea fc", "EA FC & Football Gaming", "EA FC FIFA football soccer gaming Ultimate Team career mode", "Gaming", ["ea fc", "fc 25"])
e("madden", "Madden NFL", "Madden NFL EA Sports football gaming franchise mode Ultimate Team", "Gaming", [])
e("nba 2k", "NBA 2K Basketball", "NBA 2K basketball gaming Take Two MyCareer online simulation", "Gaming", ["2k"])
e("gran turismo", "Gran Turismo", "Gran Turismo Polyphony Digital racing simulation PlayStation GT7", "Gaming", [])
e("forza", "Forza & Racing Games", "Forza Motorsport Horizon racing Xbox Turn 10 Playground Games", "Gaming", ["forza horizon"])
e("tekken", "Tekken 8 & Fighting Games", "Tekken 8 Bandai Namco fighting game competitive 3D fighters", "Gaming", ["tekken 8"])
e("street fighter", "Street Fighter 6", "Street Fighter 6 Capcom fighting game competitive Drive system FGC", "Gaming", ["sf6"])
e("mortal kombat", "Mortal Kombat", "Mortal Kombat NetherRealm fighting game fatality brutal competitive", "Gaming", ["mk1"])
e("smash bros", "Super Smash Bros", "Super Smash Bros Nintendo fighting crossover platform competitive", "Gaming", [])
e("dead by daylight", "Dead by Daylight", "Dead by Daylight horror survival multiplayer killer survivor asymmetric", "Gaming", ["dbd"])
e("hogwarts legacy 2", "Hogwarts Legacy & Harry Potter", "Hogwarts Legacy Harry Potter Wizarding World RPG open world magic sequel", "Gaming", [])
e("assassins creed", "Assassin's Creed Shadows", "Assassin's Creed Shadows Ubisoft Japan feudal samurai shinobi open world", "Gaming", ["ac shadows"])
e("god of war", "God of War", "God of War Santa Monica PlayStation Kratos Atreus Norse mythology", "Gaming", [])
e("spider man", "Spider-Man & Marvel Games", "Spider-Man Marvel PlayStation Insomniac open world superhero gaming", "Gaming", ["marvel spider-man"])
e("horizon", "Horizon Zero Dawn & Forbidden West", "Horizon Guerrilla PlayStation Aloy machines open world Forbidden West", "Gaming", [])
e("ghost of tsushima", "Ghost of Tsushima", "Ghost of Tsushima Sucker Punch samurai Japan open world PlayStation", "Gaming", [])
e("resident evil", "Resident Evil & Horror Games", "Resident Evil Capcom survival horror Biohazard zombies RE Village", "Gaming", [])
e("silent hill", "Silent Hill & Psychological Horror", "Silent Hill Konami horror psychological foggy town remake series", "Gaming", [])
e("alan wake", "Alan Wake & Remedy Games", "Alan Wake Remedy Games horror writer thriller atmospheric storytelling", "Gaming", [])
e("hollow knight", "Hollow Knight: Silksong", "Hollow Knight Silksong Team Cherry metroidvania indie bug kingdom", "Gaming", ["silksong"])
e("hades", "Hades & Roguelike Games", "Hades Supergiant roguelike mythology action dungeon Greek gods", "Gaming", [])
e("celeste", "Indie Games & Pixel Art", "indie games pixel art Celeste Undertale Shovel Knight artistic", "Gaming", ["indie games"])
e("dark souls", "Dark Souls & Soulslike Games", "Dark Souls FromSoftware soulslike challenging boss fights RPG bonfire", "Gaming", ["soulslike", "fromsoftware"])
e("world of warcraft", "World of Warcraft", "World of Warcraft WoW Blizzard MMORPG Azeroth raids expansion", "Gaming", ["wow"])
e("path of exile", "Path of Exile 2", "Path of Exile 2 Grinding Gear Games ARPG dark fantasy isometric", "Gaming", ["poe2"])
e("genshin impact", "Genshin Impact", "Genshin Impact miHoYo HoYoverse open world gacha anime action RPG", "Gaming", [])
e("honkai star rail", "Honkai: Star Rail", "Honkai Star Rail HoYoverse turn-based gacha sci-fi RPG anime", "Gaming", [])
e("zenless zone zero", "Zenless Zone Zero", "Zenless Zone Zero ZZZ HoYoverse action urban anime gacha", "Gaming", ["zzz"])
e("wuthering waves", "Wuthering Waves", "Wuthering Waves Kuro Games action RPG open world gacha anime", "Gaming", [])
e("mobile gaming", "Mobile Gaming & Phone Games", "mobile gaming phone games iOS Android casual hyper-casual gacha", "Gaming", [])
e("clash royale", "Clash Royale & Supercell", "Clash Royale Supercell mobile strategy card battle tower", "Gaming", ["clash of clans"])
e("pubg mobile", "PUBG Mobile", "PUBG Mobile battle royale mobile shooter Tencent competitive", "Gaming", [])
e("free fire", "Free Fire & Garena", "Free Fire Garena mobile battle royale shooter popular global", "Gaming", [])
e("gaming hardware", "Gaming Hardware & PCs", "gaming hardware PC build GPU graphics card monitor peripherals", "Gaming", ["gaming pc"])
e("gaming chairs", "Gaming Setup & Accessories", "gaming chairs setup accessories desk monitor keyboard mouse RGB", "Gaming", ["gaming setup"])
e("game trailers", "Game Trailers & Announcements", "game trailers announcements reveal gameplay showcase preview", "Gaming", [])
e("game awards", "The Game Awards", "Game Awards ceremony GOTY nominations winners Geoff Keighley", "Gaming", ["goty"])
e("e3 gaming", "Gaming Showcases & Events", "gaming showcases E3 Summer Game Fest gamescom events reveals", "Gaming", ["summer game fest", "gamescom"])
e("speedrunning", "Speedrunning & Records", "speedrunning world records any% glitchless SGDQ games fast", "Gaming", ["speedrun"])
e("game mods", "Game Mods & Community", "game mods modding community Nexus workshop custom content", "Gaming", ["modding"])
e("retro gaming", "Retro Gaming & Classics", "retro gaming classic games nostalgia SNES N64 PS1 arcade vintage", "Gaming", [])
e("vr gaming", "VR Gaming & Immersive", "VR gaming virtual reality headset immersive Quest PSVR Half-Life", "Gaming", [])
e("lol esports", "LoL Esports & Worlds", "League of Legends esports Worlds championship teams LCS LEC LCK", "Gaming", ["lol worlds"])
e("valorant esports", "Valorant Champions & Esports", "Valorant esports Champions Tour VCT Masters teams competitive", "Gaming", ["vct"])
e("cs2 esports", "CS2 Major & Esports", "Counter-Strike 2 Major esports tournament teams FPS competitive", "Gaming", ["cs major"])
e("dota 2", "Dota 2 & The International", "Dota 2 Valve MOBA esports The International Aegis competitive", "Gaming", ["dota", "the international"])
e("fighting game esports", "FGC & Fighting Game Events", "FGC fighting game community EVO tournaments Street Fighter Tekken", "Gaming", ["evo", "fgc"])
e("game streaming", "Game Streaming & Twitch", "game streaming Twitch YouTube Gaming Kick live content creators", "Gaming", ["twitch"])
e("game reviews", "Game Reviews & Ratings", "game reviews ratings metacritic IGN critic score analysis", "Gaming", [])
e("cozy games", "Cozy Games & Relaxing", "cozy games relaxing wholesome farming life sim gentle pace", "Gaming", [])
e("survival games", "Survival Games & Crafting", "survival games crafting building base resource gathering open world", "Gaming", [])
e("roguelike", "Roguelike & Roguelite Games", "roguelike roguelite procedural permadeath dungeon run-based action", "Gaming", ["roguelite"])
e("turn based rpg", "Turn-Based RPGs & Strategy", "turn-based RPG strategy tactical JRPG classic battle system", "Gaming", [])
e("open world games", "Open World & Exploration", "open world games exploration sandbox freedom map discover adventure", "Gaming", [])
e("multiplayer games", "Multiplayer & Co-op Games", "multiplayer co-op games online friends cooperative versus team", "Gaming", [])
e("horror games", "Horror Games & Jump Scares", "horror games scary jump scares atmosphere survival psychological", "Gaming", [])
e("simulation games", "Simulation & Management Games", "simulation management games city builder tycoon factory strategy", "Gaming", [])
e("nintendo switch 2", "Nintendo Switch 2", "Nintendo Switch 2 next-gen handheld console hybrid gaming", "Gaming", ["switch 2"])


# ============================================================
# HEALTH & FITNESS EXPANDED (+180)
# ============================================================

# Workouts & exercise
e("hiit workout", "HIIT & High Intensity Training", "HIIT high intensity interval training fat burn cardio workout", "Health", [])
e("strength training", "Strength Training & Lifting", "strength training weightlifting barbell dumbbell muscle compound lifts", "Health", ["weightlifting"])
e("running", "Running & Marathon Training", "running marathon training jogging 5K 10K distance endurance pace", "Health", ["marathon", "jogging"])
e("crossfit", "CrossFit & Functional Fitness", "CrossFit functional fitness WOD box gym Olympic lifts competition", "Health", [])
e("pilates", "Pilates & Core Strength", "Pilates core strength reformer mat exercise posture flexibility body", "Health", [])
e("home workout", "Home Workouts & No Equipment", "home workout no equipment bodyweight exercise living room fitness", "Health", [])
e("gym routine", "Gym Routine & Split Training", "gym routine split training push pull legs PPL workout plan", "Health", ["ppl"])
e("calisthenics", "Calisthenics & Bodyweight", "calisthenics bodyweight training pull-ups push-ups muscle-up bars", "Health", [])
e("cycling fitness", "Cycling & Indoor Biking", "cycling fitness indoor bike Peloton spin class endurance cardio", "Health", ["peloton", "spin class"])
e("swimming fitness", "Swimming & Water Fitness", "swimming laps pool water fitness stroke technique endurance", "Health", [])
e("boxing fitness", "Boxing Fitness & Heavy Bag", "boxing fitness heavy bag training footwork speed cardio combat", "Health", [])
e("stretching", "Stretching & Mobility Work", "stretching mobility work flexibility foam rolling warm-up recovery", "Health", ["mobility"])
e("abs workout", "Ab Workouts & Core Exercises", "abs workout core exercises six-pack plank crunch oblique strong", "Health", [])
e("glute workout", "Glute Workouts & Booty Gains", "glute workout hip thrust squat booty building activation bands", "Health", [])
e("arm workout", "Arm Workouts & Bicep Curls", "arm workout bicep curl tricep extension dumbbell toned strong", "Health", [])
e("leg day", "Leg Day & Squat Workouts", "leg day squats lunges leg press quad hamstring calf workout", "Health", [])
e("back workout", "Back Workouts & Pull Exercises", "back workout pull-up row deadlift lat pulldown posture", "Health", [])
e("chest workout", "Chest Workouts & Bench Press", "chest workout bench press push-up fly dumbbell press pectorals", "Health", [])
e("shoulder workout", "Shoulder Workouts & Press", "shoulder workout overhead press lateral raise deltoid military", "Health", [])
e("walking fitness", "Walking & Step Goals", "walking fitness step goals daily 10K steps health movement low impact", "Health", [])
e("martial arts", "Martial Arts & Self Defense", "martial arts self defense karate taekwondo jiu-jitsu training", "Health", [])
e("rock climbing", "Rock Climbing & Bouldering", "rock climbing bouldering indoor wall grip strength outdoor adventure", "Health", ["bouldering"])

# Diets & nutrition
e("calorie counting", "Calorie Counting & Macros", "calorie counting macros TDEE tracking nutrition weight management", "Health", ["macros"])
e("high protein diet", "High Protein Diet & Muscle", "high protein diet muscle building lean mass chicken fish eggs", "Health", [])
e("low carb diet", "Low Carb & Keto Lifestyle", "low carb keto diet ketosis fat adapted insulin weight loss", "Health", [])
e("paleo diet", "Paleo Diet & Ancestral Eating", "paleo diet ancestral eating whole foods grain-free primal", "Health", [])
e("plant based diet", "Plant-Based Diet & Whole Foods", "plant-based diet whole foods vegan health benefits fiber greens", "Health", [])
e("carnivore diet health", "Carnivore Diet & Animal Foods", "carnivore diet animal foods meat-only elimination autoimmune", "Health", [])
e("fasting benefits", "Fasting & Autophagy Benefits", "fasting autophagy benefits extended water fast cellular repair", "Health", ["autophagy"])
e("electrolytes", "Electrolytes & Hydration", "electrolytes hydration sodium potassium magnesium sports drinks", "Health", [])
e("meal replacement", "Meal Replacements & Shakes", "meal replacement shakes Huel complete nutrition convenient powder", "Health", [])

# Supplements
e("creatine", "Creatine & Muscle Performance", "creatine supplement muscle performance strength ATP monohydrate loading", "Health", [])
e("protein powder", "Protein Powder & Whey", "protein powder whey casein plant-based supplement recovery shake", "Health", ["whey protein"])
e("pre workout", "Pre-Workout & Energy Boost", "pre-workout supplement energy caffeine beta-alanine pump focus", "Health", [])
e("magnesium", "Magnesium & Mineral Health", "magnesium mineral supplement sleep muscle relaxation glycinate citrate", "Health", [])
e("vitamin d", "Vitamin D & Sun Health", "vitamin D sunshine supplement bone immune deficiency winter health", "Health", [])
e("omega 3", "Omega-3 & Fish Oil", "omega-3 fish oil supplement EPA DHA brain heart anti-inflammatory", "Health", ["fish oil"])
e("collagen", "Collagen & Skin Health", "collagen supplement skin health joints hair nails peptides powder", "Health", [])
e("ashwagandha", "Ashwagandha & Adaptogens", "ashwagandha adaptogen stress cortisol supplement Ayurvedic herb", "Health", ["adaptogens"])
e("probiotics supplement", "Probiotics & Gut Supplements", "probiotics gut supplement bacteria microbiome digestive capsules", "Health", [])
e("multivitamin", "Multivitamins & Daily Health", "multivitamin daily supplement essential nutrients minerals health", "Health", [])
e("turkesterone", "Turkesterone & Natural Anabolics", "turkesterone natural anabolic supplement ecdysteroid muscle growth", "Health", [])

# Conditions & medical topics
e("anxiety disorders", "Anxiety & Coping Strategies", "anxiety disorder coping strategies panic attack stress management CBT", "Health", [])
e("depression treatment", "Depression & Treatment Options", "depression treatment therapy SSRI mental health medication recovery", "Health", [])
e("adhd", "ADHD & Focus Strategies", "ADHD attention deficit hyperactivity disorder focus medication strategies", "Health", [])
e("back pain", "Back Pain & Spinal Health", "back pain spinal health posture disc herniated sciatica relief", "Health", ["sciatica"])
e("knee pain", "Knee Pain & Joint Health", "knee pain joint health ACL meniscus cartilage arthritis recovery", "Health", [])
e("thyroid", "Thyroid Health & Hormones", "thyroid health hormones hypothyroid hyperthyroid Hashimoto metabolism", "Health", [])
e("pcos", "PCOS & Hormonal Health", "PCOS polycystic ovary syndrome hormonal health insulin resistance", "Health", [])
e("skin conditions", "Skin Conditions & Dermatology", "skin conditions dermatology eczema psoriasis acne rosacea treatment", "Health", ["eczema", "psoriasis"])
e("allergies", "Allergies & Immune Response", "allergies immune response histamine pollen food seasonal treatment", "Health", [])
e("migraines", "Migraines & Headache Relief", "migraines headache relief chronic aura triggers treatment prevention", "Health", [])
e("blood pressure", "Blood Pressure & Heart Health", "blood pressure hypertension heart health cardiovascular monitoring diet", "Health", ["hypertension"])
e("cholesterol", "Cholesterol & Lipid Health", "cholesterol lipid health HDL LDL statins heart disease diet", "Health", [])
e("eye health", "Eye Health & Vision Care", "eye health vision care myopia screen time blue light glasses", "Health", [])
e("dental health", "Dental Health & Oral Care", "dental health oral care teeth whitening gums brushing flossing", "Health", [])
e("posture correction", "Posture & Ergonomics", "posture correction ergonomics desk setup spine alignment standing", "Health", [])

# Wellness & recovery
e("cold plunge", "Cold Plunge & Ice Baths", "cold plunge ice bath cold exposure Wim Hof recovery inflammation", "Health", ["ice bath"])
e("sauna", "Sauna & Heat Therapy", "sauna heat therapy infrared detox relaxation recovery Finnish", "Health", [])
e("foam rolling", "Foam Rolling & Self-Massage", "foam rolling self-massage myofascial release recovery trigger point", "Health", [])
e("breathwork", "Breathwork & Breathing Exercises", "breathwork breathing exercises Wim Hof box breathing pranayama calm", "Health", [])
e("biohacking", "Biohacking & Performance", "biohacking performance optimization supplements tracking data health", "Health", [])
e("circadian rhythm", "Circadian Rhythm & Sleep Hygiene", "circadian rhythm sleep hygiene melatonin light exposure cortisol", "Health", [])
e("morning routine", "Morning Routines & Wellness", "morning routine wellness habits sunrise journaling meditation healthy", "Health", [])
e("wearable health", "Health Wearables & Trackers", "health wearable fitness tracker Apple Watch Oura Ring Whoop data", "Health", ["fitness tracker"])
e("physical therapy", "Physical Therapy & Rehab", "physical therapy rehabilitation injury recovery exercises mobility", "Health", ["rehab"])
e("chiropractic", "Chiropractic & Spinal Care", "chiropractic spinal adjustment alignment crack back neck treatment", "Health", [])


# ============================================================
# FASHION & BEAUTY EXPANDED (+150)
# ============================================================

# Fashion brands & designers
e("nike", "Nike & Sportswear", "Nike sportswear sneakers Air Jordan Swoosh athletic Just Do It", "Fashion", ["air jordan"])
e("adidas", "Adidas & Three Stripes", "Adidas sportswear sneakers Yeezy three stripes Originals boost", "Fashion", [])
e("new balance", "New Balance & Dad Shoes", "New Balance sneakers 550 990 retro running dad shoes comfort", "Fashion", [])
e("jordan brand", "Jordan Brand & Sneaker Drops", "Jordan brand sneakers Air Jordan 1 retro drops Nike basketball", "Fashion", ["air jordan 1"])
e("yeezy", "Yeezy & Kanye Footwear", "Yeezy Kanye West sneakers footwear Boost 350 foam runner", "Fashion", [])
e("louis vuitton", "Louis Vuitton", "Louis Vuitton LV luxury fashion Pharrell designer bags monogram", "Fashion", ["lv"])
e("gucci", "Gucci & Italian Luxury", "Gucci Italian luxury fashion designer handbags Sabato De Sarno", "Fashion", [])
e("chanel", "Chanel & Haute Couture", "Chanel haute couture luxury French fashion tweed No 5 Coco", "Fashion", [])
e("prada", "Prada & Miu Miu", "Prada Miu Miu Italian luxury fashion designer minimalist elegant", "Fashion", ["miu miu"])
e("balenciaga", "Balenciaga & Avant-Garde", "Balenciaga avant-garde fashion Demna oversized streetwear luxury", "Fashion", [])
e("dior", "Dior & French Fashion", "Dior French fashion luxury couture Maria Grazia Chiuri Lady Dior", "Fashion", [])
e("zara", "Zara & Fast Fashion", "Zara Inditex fast fashion affordable trendy Spanish retail", "Fashion", [])
e("uniqlo", "Uniqlo & Basics", "Uniqlo Japanese basics wardrobe essentials affordable minimalist", "Fashion", [])
e("lululemon", "Lululemon & Athleisure", "Lululemon athleisure yoga leggings activewear premium workout", "Fashion", [])
e("north face", "The North Face & Outdoor", "North Face outdoor gear jackets puffer winter adventure hiking", "Fashion", [])
e("patagonia", "Patagonia & Sustainable Fashion", "Patagonia sustainable fashion outdoor gear fleece environmental", "Fashion", [])
e("off white", "Off-White & Streetwear Luxury", "Off-White streetwear luxury quotation marks diagonal stripes hype", "Fashion", [])
e("supreme", "Supreme & Hype Streetwear", "Supreme streetwear hype box logo drops limited edition skateboard", "Fashion", [])
e("birkenstock", "Birkenstock & Comfort Shoes", "Birkenstock comfort shoes sandals cork footbed Boston Arizona", "Fashion", [])
e("crocs", "Crocs & Casual Footwear", "Crocs casual footwear Jibbitz clogs comfortable lightweight polarizing", "Fashion", [])
e("asics", "ASICS & Running Shoes", "ASICS running shoes Gel-Kayano performance athletic comfort", "Fashion", [])
e("hoka", "HOKA & Cushioned Running", "HOKA cushioned running shoes Bondi Clifton maximalist comfort", "Fashion", [])

# Fashion trends & style
e("streetwear trends", "Streetwear Trends & Culture", "streetwear trends culture hype drops oversized urban fashion style", "Fashion", [])
e("quiet luxury", "Quiet Luxury & Old Money", "quiet luxury old money fashion understated minimal elegant stealth", "Fashion", ["old money style"])
e("y2k fashion", "Y2K Fashion & Retro Revival", "Y2K fashion retro 2000s low-rise crop butterfly nostalgic revival", "Fashion", [])
e("mens fashion", "Men's Fashion & Style Tips", "mens fashion style tips outfit grooming wardrobe essentials trend", "Fashion", [])
e("womens fashion", "Women's Fashion & Outfit Ideas", "womens fashion outfit ideas dress style accessories trendy looks", "Fashion", [])
e("work outfits", "Work Outfits & Office Style", "work outfits office style professional business casual wardrobe", "Fashion", [])
e("summer fashion", "Summer Fashion & Beach Style", "summer fashion beach style lightweight floral sandals sunglasses", "Fashion", [])
e("winter fashion", "Winter Fashion & Layering", "winter fashion layering coats boots knitwear cold weather style", "Fashion", [])
e("sustainable fashion", "Sustainable Fashion & Eco Style", "sustainable fashion eco-friendly ethical clothing recycled organic slow", "Fashion", ["ethical fashion"])
e("capsule wardrobe", "Capsule Wardrobe & Minimalist", "capsule wardrobe minimalist fashion essentials versatile pieces fewer", "Fashion", [])
e("plus size fashion", "Plus Size Fashion & Inclusive", "plus size fashion inclusive body positive curvy style representation", "Fashion", [])
e("sneaker releases", "Sneaker Releases & Drop Dates", "sneaker releases drop dates new colorways limited edition restock", "Fashion", ["sneaker drops"])
e("watch collecting", "Watch Collecting & Luxury Watches", "watch collecting luxury Rolex Omega Patek Philippe horology timepiece", "Fashion", ["rolex", "luxury watches"])
e("jewelry trends", "Jewelry Trends & Accessories", "jewelry trends accessories gold silver rings necklace bracelet", "Fashion", [])
e("sunglasses", "Sunglasses & Eyewear", "sunglasses eyewear frames designer Ray-Ban Oakley UV protection", "Fashion", [])
e("handbags", "Handbags & Designer Bags", "handbags designer bags luxury tote crossbody clutch iconic", "Fashion", [])
e("perfume cologne", "Perfumes & Fragrances", "perfume cologne fragrance scent designer niche Baccarat Rouge Tom Ford", "Fashion", ["fragrance"])

# Skincare & beauty
e("skincare routine", "Skincare Routine & Glow Up", "skincare routine glow up cleanse tone moisturize SPF steps", "Skincare", [])
e("retinol", "Retinol & Anti-Aging Skincare", "retinol anti-aging skincare wrinkles fine lines vitamin A serum", "Skincare", ["anti-aging"])
e("sunscreen", "Sunscreen & SPF Protection", "sunscreen SPF protection UV rays daily application skin cancer", "Skincare", ["spf"])
e("acne treatment", "Acne Treatment & Clear Skin", "acne treatment clear skin breakout salicylic acid benzoyl peroxide", "Skincare", [])
e("korean skincare", "Korean Skincare & Glass Skin", "Korean skincare K-beauty glass skin 10-step routine sheet mask", "Skincare", ["k-beauty"])
e("niacinamide", "Niacinamide & Skin Serums", "niacinamide serum pores skin brightening texture vitamin B3", "Skincare", [])
e("hyaluronic acid", "Hyaluronic Acid & Hydration", "hyaluronic acid hydration plumping moisture serum dewy skin", "Skincare", [])
e("vitamin c serum", "Vitamin C Serum & Brightness", "vitamin C serum brightening glow antioxidant dark spots radiance", "Skincare", [])
e("moisturizer", "Moisturizers & Skin Barrier", "moisturizer skin barrier ceramides hydration lotion cream repair", "Skincare", [])
e("lip care", "Lip Care & Lip Gloss", "lip care gloss balm lipstick hydrating plumping color beauty", "Skincare", [])

# Hair & makeup
e("hair care", "Hair Care & Healthy Hair", "hair care healthy shampoo conditioner treatment growth damage", "Beauty", [])
e("curly hair", "Curly Hair & Natural Texture", "curly hair natural texture coils waves products routine definition", "Beauty", ["natural hair"])
e("hair color", "Hair Color & Dye Trends", "hair color dye trends balayage highlights bleach tone fantasy", "Beauty", ["balayage"])
e("hair growth", "Hair Growth & Remedies", "hair growth remedies thinning loss biotin minoxidil scalp health", "Beauty", [])
e("makeup tutorials", "Makeup Tutorials & Looks", "makeup tutorials looks glam natural everyday eye lip technique", "Beauty", [])
e("contouring", "Contouring & Sculpting Makeup", "contouring sculpting makeup bronzer highlight cheekbones shape face", "Beauty", [])
e("foundation", "Foundation & Base Makeup", "foundation base makeup shade match coverage concealer primer flawless", "Beauty", [])
e("eyebrow shaping", "Eyebrow Shaping & Brow Trends", "eyebrow shaping brow trends lamination tinting fluffy defined", "Beauty", [])
e("nail art", "Nail Art & Manicure Trends", "nail art manicure gel polish acrylic designs creative nails", "Beauty", ["manicure"])
e("lash extensions", "Lash Extensions & Eye Beauty", "lash extensions eye beauty mascara false lashes volume curl", "Beauty", [])
e("clean beauty", "Clean Beauty & Natural Products", "clean beauty natural products non-toxic organic skincare cruelty-free", "Beauty", [])
e("body care", "Body Care & Self-Care Rituals", "body care self-care rituals lotion scrub bath oil pamper routine", "Beauty", [])
e("men grooming", "Men's Grooming & Self-Care", "mens grooming beard shaving skincare hair style products male", "Beauty", [])
e("fragrance layering", "Fragrance Layering & Scent Tips", "fragrance layering scent combination perfume body mist unique", "Beauty", [])
e("dermatologist tips", "Dermatologist Tips & Skin Science", "dermatologist tips skin science expert advice treatment prevention", "Beauty", [])


# ============================================================
# LIFESTYLE & TRAVEL EXPANDED (+100)
# ============================================================

# Travel destinations
e("japan travel", "Japan Travel & Cherry Blossoms", "Japan travel cherry blossoms Tokyo Kyoto temples anime food culture", "Travel", [])
e("bali travel", "Bali Travel & Island Life", "Bali Indonesia travel island temples rice terraces beaches surf", "Travel", [])
e("paris travel", "Paris Travel & City of Lights", "Paris travel Eiffel Tower Louvre Seine cafes French culture", "Travel", [])
e("new york travel", "New York City & Travel Guide", "New York City travel Manhattan Broadway Times Square Central Park", "Travel", ["nyc travel"])
e("london travel", "London Travel & British Culture", "London travel Big Ben Buckingham Palace West End British culture", "Travel", [])
e("dubai travel", "Dubai Travel & Luxury", "Dubai travel luxury Burj Khalifa desert mall beach skyscrapers", "Travel", [])
e("rome travel", "Rome Travel & Ancient History", "Rome travel Colosseum Vatican pasta ancient history ruins Italy", "Travel", [])
e("barcelona travel", "Barcelona Travel & Gaudi", "Barcelona travel Gaudi Sagrada Familia beach tapas Catalonia Spain", "Travel", [])
e("thailand travel", "Thailand Travel & Beaches", "Thailand travel Bangkok Phuket temples beaches street food culture", "Travel", [])
e("maldives", "Maldives & Tropical Paradise", "Maldives tropical paradise overwater villa crystal clear beach resort", "Travel", [])
e("greece travel", "Greece Travel & Islands", "Greece travel Santorini Mykonos Athens islands Mediterranean blue", "Travel", [])
e("iceland travel", "Iceland Travel & Northern Lights", "Iceland travel northern lights aurora glaciers geysers hot springs", "Travel", [])
e("mexico travel", "Mexico Travel & Beach Resorts", "Mexico travel Cancun Tulum cenotes ruins beach resort culture", "Travel", [])
e("portugal travel", "Portugal Travel & Lisbon", "Portugal travel Lisbon Porto Algarve tiles pasteis culture wine", "Travel", [])
e("korea travel", "South Korea Travel & Seoul", "South Korea travel Seoul K-pop culture palaces street food skincare", "Travel", [])
e("turkey travel", "Turkey Travel & Istanbul", "Turkey travel Istanbul Cappadocia bazaar mosque history kebab", "Travel", [])
e("australia travel", "Australia Travel & Outback", "Australia travel Sydney reef Outback kangaroo beach nature culture", "Travel", [])
e("switzerland travel", "Switzerland Travel & Alps", "Switzerland travel Alps mountains skiing Zurich Geneva chocolate scenic", "Travel", [])
e("croatia travel", "Croatia Travel & Adriatic", "Croatia travel Dubrovnik Split Adriatic coast islands old town", "Travel", [])
e("morocco travel", "Morocco Travel & Marrakech", "Morocco travel Marrakech medina Sahara desert tagine colorful souks", "Travel", [])

# Travel topics
e("solo travel", "Solo Travel & Adventure Tips", "solo travel adventure tips independent backpacking safety freedom", "Travel", [])
e("budget travel", "Budget Travel & Cheap Flights", "budget travel cheap flights hostel backpacking affordable tips hacks", "Travel", [])
e("luxury travel", "Luxury Travel & Resorts", "luxury travel resorts five-star hotel suites premium experiences VIP", "Travel", [])
e("road trips", "Road Trips & Scenic Drives", "road trips scenic drives highway cross-country adventure stops", "Travel", [])
e("backpacking", "Backpacking & Hostel Life", "backpacking hostel travel budget adventure gap year explore world", "Travel", [])
e("cruise travel", "Cruise Travel & Ocean Voyages", "cruise travel ocean voyage ship ports Caribbean Mediterranean luxury", "Travel", [])
e("camping", "Camping & Outdoor Adventures", "camping outdoor adventures tent nature hiking campfire national park", "Travel", [])
e("van life", "Van Life & Mobile Living", "van life mobile living conversion camper travel freedom nomad", "Travel", [])
e("travel photography", "Travel Photography & Tips", "travel photography tips landscape sunset golden hour city culture", "Travel", [])
e("travel hacks", "Travel Hacks & Packing Tips", "travel hacks packing tips carry-on luggage efficient smart airport", "Travel", [])
e("digital nomad life", "Digital Nomad & Work Abroad", "digital nomad work abroad remote laptop Bali Lisbon Chiang Mai", "Travel", [])
e("airline reviews", "Airline Reviews & Flight Deals", "airline reviews flight deals economy business first class comparison", "Travel", [])
e("hotel reviews", "Hotel Reviews & Best Stays", "hotel reviews best stays booking boutique luxury budget Airbnb", "Travel", [])
e("national parks", "National Parks & Nature Trails", "national parks nature trails hiking scenic outdoors wildlife preserve", "Travel", [])
e("hidden gems", "Hidden Gems & Off-Beat Travel", "hidden gems off-beat travel underrated destinations local secret spots", "Travel", [])

# Lifestyle topics
e("self improvement", "Self-Improvement & Growth", "self-improvement personal growth habits mindset goals motivation", "Lifestyle", [])
e("journaling", "Journaling & Self-Reflection", "journaling self-reflection writing diary gratitude prompts mindfulness", "Lifestyle", [])
e("book recommendations", "Book Recommendations & Reading", "book recommendations reading list bestseller fiction non-fiction club", "Lifestyle", ["booktok"])
e("podcasts", "Podcasts & Audio Content", "podcasts audio content listening episodes interview storytelling show", "Lifestyle", [])
e("morning routines", "Morning Routines & Habits", "morning routines habits wake up productive ritual healthy start day", "Lifestyle", [])
e("stoicism", "Stoicism & Philosophy", "stoicism philosophy Marcus Aurelius Seneca Epictetus mindset wisdom", "Lifestyle", [])
e("side hustle", "Side Hustles & Extra Income", "side hustle extra income gig freelance passive money opportunity", "Lifestyle", [])
e("personal finance", "Personal Finance & Budgeting", "personal finance budgeting saving investing money management frugal", "Lifestyle", [])
e("investing basics", "Investing Basics & Beginner Tips", "investing basics beginner stocks ETF index fund portfolio wealth", "Lifestyle", [])
e("crypto investing", "Crypto Investing & DeFi", "crypto investing DeFi yield staking portfolio altcoin Bitcoin beginner", "Lifestyle", [])
e("photography tips", "Photography & Camera Tips", "photography camera tips composition lighting portrait landscape DSLR", "Lifestyle", [])
e("home organization", "Home Organization & Decluttering", "home organization decluttering tidy storage bins systems Marie Kondo", "Lifestyle", [])
e("smart home", "Smart Home & IoT Devices", "smart home IoT Alexa Google Home automation lights security gadgets", "Lifestyle", [])
e("apartment living", "Apartment Living & Small Spaces", "apartment living small spaces studio decor solutions rental tips", "Lifestyle", [])
e("wedding planning", "Wedding Planning & Ideas", "wedding planning ideas venue dress flowers ceremony reception", "Lifestyle", [])
e("dating advice", "Dating Advice & Relationships", "dating advice relationships love communication compatibility tips", "Lifestyle", [])
e("pet dogs", "Dog Breeds & Puppy Care", "dog breeds puppy care training golden retriever walks health tips", "Lifestyle", ["dogs", "puppies"])
e("pet cats", "Cat Care & Feline Friends", "cat care kittens indoor breeds litter toys health feline behavior", "Lifestyle", ["cats", "kittens"])
e("plant care", "Plant Care & Indoor Gardening", "plant care indoor gardening houseplant watering soil light repotting", "Lifestyle", [])
e("sustainability", "Sustainability & Green Living", "sustainability green living eco-friendly zero waste reduce recycle", "Lifestyle", [])


# ============================================================
# COUNTRY-SPECIFIC ADDITIONS (+100)
# ============================================================

# Turkey
e("galatasaray basketball", "Galatasaray Basketball", "Galatasaray basketball Euroleague Turkish BSL Istanbul", "Basketball", [])
e("turkish lira", "Turkish Lira & Economy", "Turkish lira economy inflation central bank Erdogan monetary policy", "Finance", [])
e("turkish series", "Turkish TV Series & Dizi", "Turkish TV series dizi drama Netflix Turkish drama actors", "Entertainment", ["dizi"])
e("turkiye earthquakes", "Turkiye Earthquakes & Recovery", "Turkey Turkiye earthquake recovery building seismic disaster relief", "World Politics", [])

# India
e("bollywood", "Bollywood & Hindi Cinema", "Bollywood Hindi cinema Indian movies Shah Rukh Khan Aamir Khan", "Entertainment", [])
e("tollywood", "Tollywood & South Indian Cinema", "Tollywood South Indian cinema Telugu movies RRR Prabhas Allu Arjun", "Entertainment", [])
e("isro", "ISRO & Indian Space Program", "ISRO Indian Space Research Organisation Chandrayaan Mars Moon rocket", "Science", [])
e("upi", "UPI & Indian Digital Payments", "UPI digital payments India PhonePe Google Pay Paytm fintech", "AI & Tech", [])
e("iit", "IIT & Indian Education", "IIT Indian Institute of Technology education engineering JEE entrance", "Business", [])

# Brazil
e("samba", "Samba & Brazilian Culture", "samba Brazilian culture carnival dance music Rio de Janeiro", "Entertainment", [])
e("novelas", "Brazilian Novelas & TV", "Brazilian novelas telenovela TV Globo drama series Portuguese", "Entertainment", [])
e("capoeira", "Capoeira & Brazilian Martial Art", "capoeira Brazilian martial art dance acrobatic fight music", "Health", [])

# Japan
e("anime new season", "Anime New Releases & Seasons", "anime new season release schedule Winter Spring Summer Fall seasonal", "Entertainment", ["anime season"])
e("japanese whisky", "Japanese Whisky & Spirits", "Japanese whisky spirits Suntory Nikka Yamazaki Hibiki aged premium", "Food", [])
e("sumo", "Sumo Wrestling", "sumo wrestling Japanese traditional sport tournament basho yokozuna", "Sports Events", [])

# South Korea
e("kpop comeback", "K-Pop Comebacks & Debuts", "K-pop comeback debut album release music video Korean idol", "K-Pop & Music", [])
e("korean beauty", "Korean Beauty & K-Beauty", "Korean beauty K-beauty skincare products snail mucin cushion glass", "Skincare", [])
e("korean webtoon", "Korean Webtoons & Manhwa", "Korean webtoon manhwa digital comic Naver LINE Tower of God Solo Leveling", "Entertainment", ["manhwa", "webtoon"])

# Mexico
e("liga mx teams", "Liga MX Teams & Mexican Soccer", "Liga MX teams Mexican soccer Tigres Monterrey Cruz Azul Pumas", "Soccer", [])
e("day of the dead", "Day of the Dead & Mexican Culture", "Day of the Dead Dia de los Muertos Mexican culture tradition altar", "Lifestyle", [])
e("mexican music", "Mexican Music & Regional", "Mexican music regional corridos norteno banda grupera Latin", "Entertainment", [])

# Germany
e("bundesliga 2", "2. Bundesliga & German Football", "2 Bundesliga German football promotion relegation Hamburg Schalke", "Soccer", [])
e("german auto industry", "German Auto Industry & Innovation", "German auto industry BMW Mercedes VW electric innovation engineering", "Automotive", [])
e("oktoberfest", "Oktoberfest & German Beer", "Oktoberfest German beer festival Munich Bavaria lederhosen tradition", "Food", [])

# UK
e("england cricket", "England Cricket & ECB", "England cricket ECB test match Ashes Bazball county", "Cricket", [])
e("british royals", "British Royal Family", "British royal family King Charles William Kate Windsor Buckingham", "Entertainment", ["royal family"])
e("uk housing", "UK Housing Market & Property", "UK housing market property prices London mortgage stamp duty rent", "Business", [])

# France
e("tour de france cycling", "Tour de France & Pro Cycling", "Tour de France pro cycling yellow jersey Pogacar Vingegaard stage", "Sports Events", [])
e("french cuisine", "French Cuisine & Cooking", "French cuisine cooking bistro brasserie Michelin chef classic technique", "Food", [])
e("french politics", "French Politics & Elections", "French politics elections Macron parliament Assemblee Nationale EU", "World Politics", [])

# Egypt
e("egyptian league", "Egyptian Football League", "Egyptian Premier League football Al Ahly Zamalek Cairo derby", "Soccer", [])
e("egyptian tourism", "Egyptian Tourism & Pyramids", "Egyptian tourism pyramids Giza Luxor Nile pharaoh ancient civilization", "Travel", [])

# Saudi Arabia
e("saudi vision 2030", "Saudi Vision 2030", "Saudi Vision 2030 MBS diversification NEOM tourism entertainment reform", "Business", [])
e("saudi football", "Saudi Football & Stars", "Saudi football Pro League transfers European players Riyadh Season", "Soccer", [])

# Argentina
e("argentinian football", "Argentine Football & AFA", "Argentine football AFA Messi Boca River Plate Superliga passion", "Soccer", [])
e("argentine economy", "Argentine Economy & Milei", "Argentine economy Milei peso inflation dollarization reform austerity", "Finance", [])

# Nigeria
e("nollywood", "Nollywood & Nigerian Film", "Nollywood Nigerian film industry Africa movies entertainment Lagos", "Entertainment", [])
e("afrobeats", "Afrobeats & Nigerian Music", "Afrobeats Nigerian music Burna Boy Wizkid Davido amapiano Afro", "K-Pop & Music", [])

# Indonesia
e("indonesian league", "Indonesian Liga 1 & Football", "Indonesian Liga 1 football Persib Persija Arema Jakarta", "Soccer", [])
e("indonesian tech", "Indonesian Tech & Startups", "Indonesian tech startups GoTo Tokopedia Grab Jakarta digital economy", "AI & Tech", [])

# Pakistan
e("pakistan cricket", "Pakistan Cricket & PCB", "Pakistan cricket PCB green shirts Babar Shaheen Asia Cup", "Cricket", [])
e("pakistan economy", "Pakistan Economy & IMF", "Pakistan economy IMF rupee inflation energy crisis bailout reform", "Finance", [])

# Australia
e("afl", "AFL & Aussie Rules", "AFL Australian Football League Aussie rules footy Grand Final Melbourne", "Sports Events", ["aussie rules"])
e("nrl", "NRL & Rugby League", "NRL National Rugby League rugby league Australia Sydney Melbourne", "Sports Events", ["rugby league"])
e("australian cricket", "Australian Cricket & BBL", "Australian cricket BBL Big Bash Ashes Test Cummins baggy green", "Cricket", [])

# Philippines
e("pba basketball", "PBA & Philippine Basketball", "PBA Philippine Basketball Association Gilas Pilipinas basketball", "Basketball", [])
e("philippine music", "OPM & Filipino Music", "OPM Filipino music Original Pilipino SB19 pop ballad Manila", "Entertainment", [])

# Colombia
e("colombian football", "Colombian Football & Liga BetPlay", "Colombian football Liga BetPlay Atletico Nacional Millonarios Cali", "Soccer", [])
e("reggaeton", "Reggaeton & Latin Beats", "reggaeton Latin beats perreo Daddy Yankee Karol G urban dance", "Entertainment", [])

# Poland
e("ekstraklasa", "Ekstraklasa & Polish Football", "Ekstraklasa Polish football Legia Warsaw Lech Poznan league", "Soccer", [])
e("robert lewandowski club", "Lewandowski & Polish Sports", "Lewandowski Polish sports national team pride Barcelona legend", "Soccer", [])

# Canada
e("nhl hockey", "NHL Hockey & Ice Sports", "NHL hockey ice sports Stanley Cup Canadian teams Maple Leafs Canadiens", "Sports Events", ["hockey"])
e("canadian politics", "Canadian Politics & Parliament", "Canadian politics Parliament Ottawa Trudeau Poilievre Liberal Conservative", "World Politics", [])

# UAE
e("dubai lifestyle", "Dubai Lifestyle & Luxury", "Dubai lifestyle luxury cars skyscrapers shopping influencer wealth", "Lifestyle", [])
e("abu dhabi events", "Abu Dhabi Events & Culture", "Abu Dhabi events culture F1 Grand Prix Louvre museum UAE", "Sports Events", [])

# Iran
e("persian gulf league", "Persian Gulf Pro League", "Persian Gulf Pro League Iranian football Persepolis Esteghlal Tehran", "Soccer", [])
e("iranian cinema", "Iranian Cinema & Film", "Iranian cinema film Farhadi Kiarostami arthouse festival international", "Entertainment", [])

# South Africa
e("springboks", "Springboks & South African Rugby", "Springboks South African rugby World Cup champions Siya Kolisi", "Sports Events", ["south african rugby"])
e("psl south africa", "PSL & South African Football", "PSL Premier Soccer League South African football Kaizer Chiefs Pirates", "Soccer", [])


# ============================================================
# ENTERTAINMENT & TRUE CRIME EXPANDED (+70)
# ============================================================

# True crime
e("serial killers", "Serial Killers & Criminal Minds", "serial killers criminal minds psychology FBI profiling cold case", "Entertainment", [])
e("cold cases", "Cold Cases & Unsolved Mysteries", "cold cases unsolved mysteries investigation detective DNA breakthrough", "Entertainment", [])
e("crime documentaries", "Crime Documentaries & Netflix", "crime documentaries Netflix true crime series investigation compelling", "Entertainment", [])
e("missing persons", "Missing Persons & Disappearances", "missing persons disappearance search investigation amber alert family", "Entertainment", [])
e("forensic science", "Forensic Science & CSI", "forensic science CSI evidence DNA fingerprint autopsy crime scene", "Entertainment", [])
e("famous trials", "Famous Trials & Court Cases", "famous trials court cases verdict jury judge high-profile legal", "Entertainment", [])
e("organized crime", "Organized Crime & Mafia", "organized crime mafia cartel gang syndicate underworld criminal", "Entertainment", [])
e("scams frauds", "Scams & Fraud Exposed", "scams fraud exposed Ponzi scheme con artist deception investigation", "Entertainment", [])
e("heists", "Famous Heists & Robberies", "heists robberies bank vault museum diamond daring escape caught", "Entertainment", [])
e("cult stories", "Cult Stories & Manipulation", "cult stories manipulation leader followers brainwash escape survivor", "Entertainment", [])
e("crime podcasts", "True Crime Podcasts", "true crime podcasts serial investigation storytelling episodes weekly", "Entertainment", [])
e("cybercrime", "Cybercrime & Digital Fraud", "cybercrime digital fraud hacking identity theft phishing dark web", "Entertainment", [])

# More entertainment
e("reality tv", "Reality TV & Competition Shows", "reality TV competition shows Survivor Bachelor Love Island dating", "Entertainment", ["love island", "the bachelor"])
e("standup comedy", "Stand-Up Comedy & Specials", "stand-up comedy specials Netflix comedian jokes live show tour", "Entertainment", ["comedy specials"])
e("talk shows", "Talk Shows & Late Night", "talk shows late night host interview celebrity comedy Jimmy Fallon", "Entertainment", [])
e("award shows", "Award Shows & Red Carpet", "award shows red carpet ceremony fashion winners speeches Emmys", "Entertainment", ["emmys", "golden globes"])
e("broadway", "Broadway & Musical Theater", "Broadway musical theater shows NYC Tony Awards Hamilton Wicked", "Entertainment", ["musicals"])
e("book to screen", "Book-to-Screen Adaptations", "book adaptation movie TV series novel bestseller screen rights", "Entertainment", [])
e("film festivals", "Film Festivals & Indie Cinema", "film festivals indie cinema Cannes Venice Sundance premiere debut", "Entertainment", ["cannes", "sundance"])
e("horror movies", "Horror Movies & Thrillers", "horror movies thrillers scary slasher supernatural psychological tension", "Entertainment", [])
e("sci fi movies", "Sci-Fi Movies & Shows", "sci-fi science fiction movies shows space future dystopia aliens", "Entertainment", [])
e("romantic comedy", "Romantic Comedies & Rom-Coms", "romantic comedy rom-com love funny lighthearted couple movies", "Entertainment", ["rom-com"])
e("superhero movies", "Superhero Movies & Comics", "superhero movies comics MCU DC origin story powers universe", "Entertainment", [])
e("animated movies", "Animated Movies & Pixar", "animated movies Pixar Disney animation DreamWorks Studio Ghibli", "Entertainment", ["pixar"])
e("thriller series", "Thriller Series & Suspense", "thriller series suspense cliffhanger twist dark gripping binge", "Entertainment", [])
e("period dramas", "Period Dramas & Historical", "period drama historical show Victorian Regency medieval costume", "Entertainment", [])
e("food shows", "Food Shows & Cooking Competition", "food shows cooking competition MasterChef Gordon Ramsay Great British Bake", "Entertainment", [])
e("travel shows", "Travel Shows & Adventure TV", "travel shows adventure TV exploration culture food Anthony Bourdain", "Entertainment", [])
e("music festivals", "Music Festivals & Live Events", "music festivals Coachella Glastonbury Lollapalooza live concert", "Entertainment", ["coachella", "glastonbury"])
e("concert tours", "Concert Tours & Live Music", "concert tours live music arena stadium setlist tickets world tour", "Entertainment", [])
e("vinyl records", "Vinyl Records & Music Culture", "vinyl records music collecting turntable analog vintage record store", "Entertainment", [])
e("music production", "Music Production & Beats", "music production beats DAW FL Studio Ableton producer mixing mastering", "Entertainment", [])
e("fan theories", "Fan Theories & Easter Eggs", "fan theories easter eggs speculation hidden details movie TV analysis", "Entertainment", [])
e("celebrity gossip", "Celebrity Gossip & Pop Culture", "celebrity gossip pop culture TMZ drama relationship rumor trending", "Entertainment", [])
e("influencer culture", "Influencer Culture & Creators", "influencer culture content creators YouTube TikTok sponsor brand deal", "Entertainment", [])
e("memes", "Memes & Internet Culture", "memes internet culture viral funny trending social media humor", "Entertainment", [])
e("cosplay", "Cosplay & Comic Conventions", "cosplay comic convention costume character anime gaming handmade creative", "Entertainment", [])
e("asmr", "ASMR & Relaxation Content", "ASMR relaxation content tingles whisper triggers sleep calming sounds", "Entertainment", [])
e("mukbang", "Mukbang & Eating Shows", "mukbang eating show food ASMR Korean large portions satisfying", "Entertainment", [])
e("unboxing", "Unboxing & Product Reviews", "unboxing product review haul first impression tech gadget fashion", "Entertainment", [])


# ============================================================
# GENERATE EMBEDDINGS AND INSERT
# ============================================================

def main():
    from sentence_transformers import SentenceTransformer
    import numpy as np

    print(f"Loading MiniLM model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    print(f"Total entities to seed: {len(ENTITIES)}")

    # Generate all embeddings in batches
    seed_texts = [e[2] for e in ENTITIES]
    print(f"Generating embeddings for {len(seed_texts)} entities...")
    embeddings = model.encode(seed_texts, show_progress_bar=True, batch_size=64)

    print(f"Inserting into Supabase...")
    inserted = 0
    skipped = 0
    errors = 0

    # Insert in batches of 50
    batch_size = 50
    for i in range(0, len(ENTITIES), batch_size):
        batch_entities = ENTITIES[i:i+batch_size]
        batch_embeddings = embeddings[i:i+batch_size]

        rows = []
        for j, (name, title, seed, cat, aliases) in enumerate(batch_entities):
            emb = batch_embeddings[j].tolist()
            rows.append({
                'entity_name': name,
                'display_title': title,
                'seed_text': seed,
                'embedding': emb,
                'category': cat,
                'aliases': aliases if aliases else None,
                'popularity_score': 1,
            })

        try:
            result = supabase.table('concept_entities').upsert(
                rows,
                on_conflict='entity_name'
            ).execute()
            inserted += len(rows)
            print(f"  Inserted batch {i//batch_size + 1}: {len(rows)} entities (total: {inserted})")
        except Exception as e:
            # Fall back to one-by-one
            for row in rows:
                try:
                    supabase.table('concept_entities').upsert(
                        row,
                        on_conflict='entity_name'
                    ).execute()
                    inserted += 1
                except Exception as e2:
                    if 'duplicate' in str(e2).lower():
                        skipped += 1
                    else:
                        errors += 1
                        print(f"  Error inserting {row['entity_name']}: {e2}")

    print(f"\nDone! Inserted: {inserted}, Skipped: {skipped}, Errors: {errors}")


if __name__ == '__main__':
    main()
