#!/usr/bin/env python3
"""
Bigger before/after test for V20 scoring.
BEFORE = ai_final_score in DB (prod V19). AFTER = re-score with V20 + flash + no refs.
Fetches recent articles by id desc (PK order = fast), samples balanced across
categories, scores each, reports per-category shift + full distribution.
Run: source load_env.sh && python3 test_v20_bigsample.py
"""
import os, sys, time
from collections import defaultdict
from step10_article_scoring import score_article

API_KEY = os.getenv('GOOGLE_AI_KEY') or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
SB_URL  = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SB_KEY  = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
if not API_KEY: sys.exit("No Gemini key.")

from supabase import create_client
sb = create_client(SB_URL, SB_KEY)

PER_CAT = 6   # up to N articles per category
def bullets_of(row):
    out = []
    for x in (row.get('summary_bullets_news') or []):
        if isinstance(x, str): out.append(x)
        elif isinstance(x, dict): out.append(x.get('text') or x.get('bullet') or '')
    return [b for b in out if b][:6]

# Fast fetch: most recent ~700 articles by PK, then balance by category in Python.
r = (sb.table('published_articles')
       .select('id,title_news,summary_bullets_news,category,ai_final_score')
       .order('id', desc=True).limit(700).execute())
by_cat = defaultdict(list)
for row in (r.data or []):
    if row.get('ai_final_score') is None or not row.get('title_news'): continue
    c = row.get('category') or 'Other'
    if len(by_cat[c]) < PER_CAT:
        by_cat[c].append(row)

sample = [row for rows in by_cat.values() for row in rows]
print(f"\nSampled {len(sample)} articles across {len(by_cat)} categories. Scoring with V20...\n")

def band(s):
    return ('900+' if s>=900 else '750-899' if s>=750 else '600-749' if s>=600
            else '450-599' if s>=450 else '250-449' if s>=250 else '0-249')
BANDS = ['900+','750-899','600-749','450-599','250-449','0-249']

agg = defaultdict(lambda:[0,0,0])
dist_before = defaultdict(int); dist_after = defaultdict(int)
movers = []
fails = 0
for i,row in enumerate(sample):
    before = row['ai_final_score']
    res = score_article(row['title_news'], bullets_of(row), API_KEY)
    after = res.get('score',0)
    if after == 500 and 'score' not in str(res): fails += 1
    cat = row.get('category') or 'Other'
    agg[cat][0]+=before; agg[cat][1]+=after; agg[cat][2]+=1
    dist_before[band(before)]+=1; dist_after[band(after)]+=1
    movers.append((after-before, cat, before, after, row['title_news']))
    time.sleep(0.25)

print("=== AVG SHIFT BY CATEGORY (before -> after, n) ===")
for cat,(b,a,n) in sorted(agg.items(), key=lambda kv:-(kv[1][1]//max(kv[1][2],1))):
    print(f"  {cat:<14} {b//n:>4} -> {a//n:>4}   (n={n})")

print("\n=== SCORE DISTRIBUTION (count of articles per band) ===")
print(f"  {'band':<10}{'BEFORE':>8}{'AFTER':>8}")
for bd in BANDS:
    print(f"  {bd:<10}{dist_before[bd]:>8}{dist_after[bd]:>8}")

print("\n=== BIGGEST RISERS ===")
for d,cat,b,a,t in sorted(movers,reverse=True)[:8]:
    print(f"  {d:>+5} [{cat[:9]:<9}] {b}->{a}  {t[:58]}")
print("\n=== BIGGEST FALLERS ===")
for d,cat,b,a,t in sorted(movers)[:8]:
    print(f"  {d:>+5} [{cat[:9]:<9}] {b}->{a}  {t[:58]}")
print(f"\nparse-failures(score==default): {fails}/{len(sample)}")
