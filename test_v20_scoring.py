#!/usr/bin/env python3
"""
Before/after test for the V20 scoring rewrite.
BEFORE = ai_final_score in the DB (production V19 + flash-lite + V18-biased refs).
AFTER  = re-score the SAME article with V20 + flash + no refs via score_article().
Run:  source load_env.sh && python3 test_v20_scoring.py
"""
import os, sys
from collections import defaultdict
from step10_article_scoring import score_article

API_KEY = os.getenv('GOOGLE_AI_KEY') or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
if not API_KEY:
    sys.exit("No Gemini key in env.")

# (category, before_score, title, [bullets]) — pulled from prod 2026-05-24
ARTS = [
    ("Business", 780, "Jaguar Land Rover profits cratered 99% amid cyberattacks and tariffs", ["The historic British brand saw profits nearly vanish.", "Chinese newcomers are shaking up the market while JLR struggles."]),
    ("Business", 760, "India's SolarSquare is raising $60M at a $500M valuation", ["They've already powered 50,000 homes with rooftop solar.", "This Series C funding round is a massive vote of confidence."]),
    ("Entertainment", 350, "Greg Lake wanted Emerson, Lake & Palmer remembered for their 1972 album", ["He felt the band's sound was best captured on that specific record.", "The album was a pivotal moment for the progressive rock trio."]),
    ("Entertainment", 300, "Why Don't We's Jack Avery claims ex-girlfriend hired a hitman", ["Avery shared alleged texts and voicemails detailing the plot.", "He stated the incident occurred after their breakup in late 2023."]),
    ("Fashion", 350, "Richard Mille's new Monaco showroom is 10x bigger", ["The new spot on 20 Avenue Princesse Alice is over 2,220 sq ft.", "Features include 12-foot ceilings and a sculptural staircase.", "Interior nods to the brand's hallmarks: architecture, culture, lifestyle."]),
    ("Fashion", 150, "Espadrille sandals are back for summer 2026", ["These braided-sole shoes are the 'It' footwear of the season.", "Options range from wedges and strappy heels to sneaker hybrids.", "Look for platform styles with ankle straps for comfort and security."]),
    ("Food", 580, "Japan's 1,200-year meat ban: Fish was the loophole", ["Emperor Tenmu banned beef, chicken, horse, dog, monkey in 675 A.D. for Buddhist reasons.", "Fish and seafood were excluded, fueling Japan's deep seafood culture.", "Wild game like deer and boar also remained common."]),
    ("Food", 450, "Why your favorite American snacks are MIA in Canada", ["Some US faves like Ragu pasta sauce vanished from Canadian shelves in 2020.", "Canadians often rely on snack exchanges to get their hands on US treats."]),
    ("Food", 150, "The chimichanga's origin story is a delicious mystery", ["Did Monica Flin accidentally invent it in 1922 at El Charro Cafe?", "Or was it a different Arizona owner who deep-fried a burrito first?", "The name is said to be a playful expletive turned 'thingamajig'."]),
    ("Food", 150, "Donut & cocktail pairings? Yes, it's a thing.", ["Think earthy matcha cocktail with a classic glazed donut.", "The grassy notes balance the donut's sweetness, trust me.", "Key is sourcing good matcha liqueur for that brunch vibe."]),
    ("Lifestyle", 350, "Save cash on your kitchen reno with frameless cabinets", ["They skip the extra frame, giving a sleeker, more modern look.", "Often called 'European-style,' they're cheaper than traditional framed cabinets."]),
    ("Politics", 780, "Western Premiers Meet as Alberta Eyes Confederation Exit", ["Premiers gather in Kananaskis to discuss trade, economy, energy security.", "Danielle Smith plans a referendum on Alberta's future in Canada.", "B.C. Premier David Eby noted the irony of the meeting's location."]),
    ("Politics", 680, "Suvendu Adhikari tells BJP workers: 'Don't break the law'", ["Adhikari urged restraint, saying the government will do 'sabka hisab'.", "The advice comes amid ongoing political tensions in West Bengal."]),
    ("Science", 810, "China launches Shenzhou-23 for year-long space mission", ["The mission aims to test long-duration spaceflight capabilities.", "This is part of China's ambitious space station program."]),
    ("Science", 650, "Unknown Antarctic island found where maps show 'danger zone'", ["Researchers spotted a small rocky island during an expedition in the Weddell Sea.", "The island was previously marked as an unexplored area on nautical charts."]),
    ("Science", 450, "Yellowstone's baby boom is here!", ["Bison calves are already hitting the fields.", "Keep an eye out for newborn elk and deer too."]),
    ("World", 830, "Ebola response in Congo hit by arson attacks", ["Facilities in two towns at the outbreak's epicenter were deliberately burned.", "Deep anger from years of violence, displacement, government failures fuels attacks.", "Insecurity forced medical staff to flee, leaving facilities 'catastrophic'."]),
    ("World", 750, "Italy's PM Meloni condemns Russia's latest attacks on Ukraine", ["She expressed solidarity with the Ukrainian people.", "'We will continue to work... to support a just and lasting peace.'"]),
    ("World", 720, "Turkiye condemns terror attack on Pakistan passenger train", ["The attack targeted a passenger train in Pakistan.", "Turkiye expressed solidarity with Pakistan and condemned the violence."]),
    ("World", 680, "Flooding hits Turkey's Boztepe and Akpinar villages", ["Heavy rainfall caused floods in Dulkadirli and Hashoyuk villages.", "Agricultural lands and parts of the main road are underwater.", "Damage assessment teams are currently on site."]),
]

print(f"\nRe-scoring {len(ARTS)} production articles with V20 (gemini-2.5-flash, no DB refs)...\n")
print(f"{'CATEGORY':<13}{'BEFORE':>7}{'AFTER':>7}{'Δ':>7}   TITLE")
print("-" * 104)
agg = defaultdict(lambda: [0, 0, 0])
for cat, before, title, bullets in ARTS:
    after = score_article(title, bullets, API_KEY).get('score', 0)
    agg[cat][0] += before; agg[cat][1] += after; agg[cat][2] += 1
    print(f"{cat:<13}{before:>7}{after:>7}{after-before:>+7}   {title[:60]}")

print("\n=== AVG SHIFT BY CATEGORY (before → after) ===")
for cat, (b, a, n) in sorted(agg.items()):
    print(f"  {cat:<14} {b//n:>4} → {a//n:>4}   ({n})")
