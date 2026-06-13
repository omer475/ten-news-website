"""Retroactively apply the anti-fabrication gate to already-published
articles (live-feed window). Because the gate now grounds against
title+bullets — which ARE persisted — we can replay it on existing rows.
The only part we can't replay is the quote 6-word verbatim check (needs the
unsaved source body); we apply the quote attribution-verb check instead."""
import os, re

for line in open('.env.local'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v.strip().strip('"').strip("'"))

from supabase import create_client
from step13_feed_display import (_number_set, _grounded, _is_bare_year,
                                  _STAT_LABEL_BLOCKLIST, _SCORE_RESULT,
                                  _strip_tags, _num, _GEO_VENUE_TOKENS)

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                   os.environ.get('SUPABASE_SERVICE_KEY') or os.environ['SUPABASE_SERVICE_ROLE_KEY'])

rows = []
for off in range(0, 8000, 1000):
    page = sb.table('published_articles').select('id, title_news, summary_bullets_news, category, display') \
        .not_.is_('display', 'null').gte('published_at', '2026-06-10') \
        .order('published_at', desc=True).range(off, off + 999).execute().data
    if not page:
        break
    rows.extend(page)

drops = {'stats_entry': 0, 'stats_row': 0, 'big': 0, 'versus': 0, 'score': 0,
         'ranking': 0, 'quote': 0, 'geo_pin': 0, 'geo': 0}
changed = 0
for r in rows:
    d = r['display']
    if not isinstance(d, dict):
        continue
    title = _strip_tags(r.get('title_news') or '')
    bullets = r.get('summary_bullets_news') or []
    head = (title + ' ' + ' '.join(_strip_tags(b) for b in bullets)).lower().replace(',', '')
    title_l = title.lower()
    nh = _number_set(head)
    mut = False

    # big — grounded in head
    if isinstance(d.get('big'), list) and d['big'] and not _grounded(d['big'][0], nh):
        del d['big']; mut = True; drops['big'] += 1
    big_val = _num(d['big'][0]) if isinstance(d.get('big'), list) and d['big'] else None

    # versus — both sides grounded in head, not equal, comparable
    v = d.get('versus')
    if isinstance(v, dict) and 'a' in v and 'b' in v:
        av, bv = _num(v['a'].get('val')), _num(v['b'].get('val'))
        au, bu = v['a'].get('unit', ''), v['b'].get('unit', '')
        a_ctx = (str(v['a'].get('who', '')) + ' ' + str(au)).lower()
        b_ctx = (str(v['b'].get('who', '')) + ' ' + str(bu)).lower()
        rank_like = any(t in a_ctx or t in b_ctx for t in ('rank', '#', 'no.', 'nth', 'place', 'seed'))
        yl = lambda n, u: n is not None and not u and isinstance(n, int) and 1900 <= n <= 2100
        if (not _grounded(av, nh) or not _grounded(bv, nh) or av == bv
                or (au and bu and au != bu) or yl(av, au) or yl(bv, bu) or rank_like):
            del d['versus']; mut = True; drops['versus'] += 1
    vnums = set()
    if isinstance(d.get('versus'), dict):
        for s in ('a', 'b'):
            n = _num(d['versus'][s].get('val')); vnums.add(n) if n is not None else None

    # score — grounded + positive result verb in title
    sc = d.get('score')
    if isinstance(sc, dict):
        an, bn = _num(sc['a'].get('score')), _num(sc['b'].get('score'))
        if not (_grounded(an, nh) and _grounded(bn, nh)) or not _SCORE_RESULT.search(title_l):
            del d['score']; mut = True; drops['score'] += 1
    snums = set()
    if isinstance(d.get('score'), dict):
        for s in ('a', 'b'):
            n = _num(d['score'][s].get('score')); snums.add(n) if n is not None else None
    if big_val is not None and big_val in snums:
        d.pop('big', None); big_val = None; mut = True

    # stats — grounded in head, no bare year, no blocklist, no dup, no trivial<=2
    if isinstance(d.get('stats'), list) and d['stats']:
        dup = set(vnums | snums)
        if big_val is not None:
            dup.add(big_val)
        kept = []
        for s in d['stats']:
            if not (isinstance(s, list) and len(s) >= 4):
                continue
            label, value, prefix, unit = s[0], s[1], s[2], s[3]
            nv = _num(value)
            if not _grounded(value, nh): drops['stats_entry'] += 1; continue
            if _is_bare_year(value, prefix, unit): drops['stats_entry'] += 1; continue
            if _STAT_LABEL_BLOCKLIST.search(str(label).upper()): drops['stats_entry'] += 1; continue
            if nv in dup: drops['stats_entry'] += 1; continue
            if not prefix and not unit and isinstance(nv, (int, float)) and nv <= 2:
                drops['stats_entry'] += 1; continue
            kept.append(s)
        new = kept if len(kept) >= 2 else []
        if new != d['stats']:
            if not new:
                drops['stats_row'] += 1
            d['stats'] = new; mut = True

    # ranking — spread gate
    rk = d.get('ranking')
    if isinstance(rk, dict) and isinstance(rk.get('rows'), list):
        vals = [_num(x[1]) for x in rk['rows'] if isinstance(x, list) and len(x) >= 2 and _num(x[1]) is not None]
        if vals and max(vals) > 0 and (min(vals) / max(vals)) > 0.67:
            del d['ranking']; mut = True; drops['ranking'] += 1

    # quote — attribution verb inside the quotation
    q = d.get('quote')
    if isinstance(q, dict) and q.get('text'):
        if re.search(r'\b(said|says|according to|told|stated|added|noted)\b', _strip_tags(q['text']).lower()):
            del d['quote']; mut = True; drops['quote'] += 1

    # geo — pin label must be in head; venue/HQ on sports unless in title
    g = d.get('geo')
    if isinstance(g, dict) and isinstance(g.get('pins'), list):
        cat = (r.get('category') or '').lower()
        kept_pins = []
        for p in g['pins']:
            if not isinstance(p, dict) or 'label' not in p:
                continue
            lab = p['label'].lower()
            words = [w for w in re.sub(r'[^a-z0-9 ]', ' ', lab).split() if len(w) >= 4]
            grounded = any(w in head for w in words) or lab in head
            is_venue = any(tok in lab for tok in _GEO_VENUE_TOKENS)
            venue_ok = not (is_venue and cat == 'sports' and not any(w in title_l for w in words))
            if grounded and venue_ok:
                kept_pins.append(p)
            else:
                drops['geo_pin'] += 1
        if len(kept_pins) != len(g['pins']):
            mut = True
            if not kept_pins:
                d.pop('geo', None); drops['geo'] += 1
            else:
                kind = g.get('kind', 'site')
                if kind == 'route' and len(kept_pins) != 2: kind = 'site'
                if kind == 'multi' and len(kept_pins) < 3: kind = 'site'
                if kind == 'area' and (len(kept_pins) != 1 or 'radius_km' not in g): kind = 'site'
                g['kind'] = kind
                g['pins'] = kept_pins[:5 if kind == 'multi' else 2]
                if kind != 'area':
                    g.pop('radius_km', None)

    if mut:
        sb.table('published_articles').update({'display': d}).eq('id', r['id']).execute()
        changed += 1

print(f"scanned {len(rows)}, changed {changed}")
print("drops:", drops)
