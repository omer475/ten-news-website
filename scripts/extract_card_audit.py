"""Extract a stratified sample of published articles + their display objects
for the card-fit audit. Writes batch JSON files the workflow agents read."""
import os, json, math

for line in open('.env.local'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v.strip().strip('"').strip("'"))

from supabase import create_client
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                   os.environ.get('SUPABASE_SERVICE_KEY') or os.environ['SUPABASE_SERVICE_ROLE_KEY'])

COLS = 'id, title_news, summary_bullets_news, category, ai_final_score, num_sources, display'
seen, articles = set(), []

def add(rows):
    for r in rows or []:
        if r['id'] in seen or not r.get('display'):
            continue
        seen.add(r['id'])
        d = r['display']
        # compact: keep title/bullets/category/score + full display (the thing under audit)
        articles.append({
            'id': r['id'],
            'title': r.get('title_news'),
            'bullets': r.get('summary_bullets_news'),
            'category': r.get('category'),
            'score': r.get('ai_final_score'),
            'num_sources': r.get('num_sources'),
            'display': d,
        })

# 1) Broad recent sample
add(sb.table('published_articles').select(COLS)
    .not_.is_('display', 'null')
    .order('published_at', desc=True).limit(500).execute().data)

# 2) Guarantee coverage of every signal/card type (wider window, top up rares)
for sig in ['quote', 'versus', 'timeline', 'geo', 'trend', 'breakdown',
            'ranking', 'score', 'receipts', 'big', 'countdown']:
    add(sb.table('published_articles').select(COLS)
        .not_.is_('display', 'null')
        .filter('display', 'cs', json.dumps({sig: {}}) if False else None)  # placeholder
        .order('published_at', desc=True).limit(0).execute().data) if False else None

# rare signals: pull explicitly via raw filter (cs on jsonb key presence isn't
# available through the client cleanly, so use a wider recent pull and filter locally)
wide = sb.table('published_articles').select(COLS).not_.is_('display', 'null') \
    .order('published_at', desc=True).limit(1500).execute().data
def has(d, k): return isinstance(d, dict) and k in d
for sig in ['receipts', 'score', 'breakdown', 'ranking', 'trend', 'big']:
    cnt = 0
    for r in wide:
        if cnt >= 40: break
        if r['id'] in seen: continue
        if has(r.get('display'), sig):
            add([r]); cnt += 1
# geo non-site kinds + versus change/gap
for r in wide:
    if r['id'] in seen: continue
    d = r.get('display') or {}
    g = d.get('geo') or {}
    v = d.get('versus') or {}
    if g.get('kind') in ('route', 'area', 'multi') or v.get('kind') in ('change', 'gap'):
        add([r])

print(f"Total unique articles: {len(articles)}")

# Shard into batches of 20
BATCH = 20
out_dir = '/tmp/card-audit'
os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    os.remove(os.path.join(out_dir, f))
n_batches = math.ceil(len(articles) / BATCH)
for i in range(n_batches):
    chunk = articles[i*BATCH:(i+1)*BATCH]
    with open(f'{out_dir}/batch_{i:02d}.json', 'w') as fh:
        json.dump(chunk, fh, ensure_ascii=False)
print(f"Wrote {n_batches} batches to {out_dir}")

# signal distribution in the sample
from collections import Counter
sig_counts = Counter()
for a in articles:
    for k in a['display']:
        if k in ('quote','versus','timeline','geo','trend','breakdown','ranking',
                 'score','receipts','big','countdown','stats'):
            if k == 'stats' and a['display'].get('stats') in ([], None): continue
            sig_counts[k] += 1
print("Signal coverage in sample:", dict(sorted(sig_counts.items(), key=lambda x:-x[1])))
