"""
Deep comparison of 0.85 vs 0.88 thresholds.
Reads the full output and categorizes every multi-cluster.
"""

import re

text = open('/Users/omersogancioglu/.claude/projects/-Users-omersogancioglu-Ten-News-Website--claude-worktrees-awesome-merkle-TenNewsApp/58000032-bc4f-458e-82fe-67610329312f/tool-results/bfap59vko.txt').read()

def extract_section(t, start_label, end_label):
    s = t.find(start_label)
    e = t.find(end_label, s + len(start_label))
    if e == -1:
        e = len(t)
    return t[s:e]

section85 = extract_section(text, 'THRESHOLD: 0.85', 'THRESHOLD: 0.88')
section88 = extract_section(text, 'THRESHOLD: 0.88', 'SUMMARY COMPARISON')


def parse_clusters_from_section(section):
    """Parse all clusters from a threshold section's bad merges."""
    bad_start = section.find('BAD MERGES')
    if bad_start == -1:
        return []
    bad_section = section[bad_start:]

    clusters = []
    current = None
    for line in bad_section.split('\n'):
        m = re.match(r'\s*Bad merge \d+ \((\d+) articles\):', line)
        if m:
            if current:
                clusters.append(current)
            current = {'size': int(m.group(1)), 'titles': []}
        elif current and line.strip().startswith('- '):
            current['titles'].append(line.strip()[2:])
    if current:
        clusters.append(current)
    return clusters


def parse_all_clusters(section):
    """Parse ALL multi-article clusters from the top-5 and bad merges sections."""
    top_start = section.find('TOP 5 LARGEST CLUSTERS:')
    bad_start = section.find('BAD MERGES')

    clusters = []
    # Parse top 5
    if top_start >= 0:
        end = bad_start if bad_start > top_start else len(section)
        top_section = section[top_start:end]
        current = None
        for line in top_section.split('\n'):
            m = re.match(r'\s*Cluster \d+ \((\d+) articles\):', line)
            if m:
                if current:
                    clusters.append(current)
                current = {'size': int(m.group(1)), 'titles': [], 'type': 'top5'}
            elif current and '[Score:' in line:
                # Extract title after score
                tm = re.search(r'\[Score:\d+\]\s*(.*)', line)
                if tm:
                    current['titles'].append(tm.group(1).strip())
        if current:
            clusters.append(current)

    return clusters


# ─── Parse the mega-clusters at each threshold ────────────────────
print("=" * 100)
print("DEEP ANALYSIS: 0.85 vs 0.88 THRESHOLD COMPARISON")
print("=" * 100)

# ─── 1. Mega-cluster analysis ─────────────────────────────────────
print("\n" + "─" * 100)
print("1. THE IRAN MEGA-CLUSTER (Cluster 1 at each threshold)")
print("─" * 100)

for label, section in [("0.85", section85), ("0.88", section88)]:
    # Get cluster 1 titles
    c1_start = section.find('Cluster 1 (')
    c2_start = section.find('Cluster 2 (')
    if c1_start >= 0 and c2_start >= 0:
        c1_text = section[c1_start:c2_start]
    elif c1_start >= 0:
        c1_text = section[c1_start:c1_start+5000]
    else:
        continue

    titles = []
    for line in c1_text.split('\n'):
        if '[Score:' in line:
            tm = re.search(r'\[Score:(\d+)\]\s*(.*)', line)
            if tm:
                titles.append((int(tm.group(1)), tm.group(2).strip()))

    # Categorize titles in mega-cluster
    iran_direct = []      # Directly about Iran strikes/war
    iran_reaction = []    # Country reactions to Iran war
    ukraine = []          # Ukraine related
    oil_energy = []       # Oil/energy prices
    unrelated = []        # Clearly unrelated

    iran_keywords = {'iran', 'iranian', 'khamenei', 'tehran', 'hormuz', 'hezbollah', 'beirut', 'lebanon'}
    strike_keywords = {'strike', 'strikes', 'bomb', 'missile', 'drone', 'attack', 'attacks', 'war', 'military'}
    reaction_keywords = {'condemns', 'reacts', 'response', 'warns', 'urges', 'amid', 'faces', 'tensions', 'conflict'}
    ukraine_keywords = {'ukraine', 'ukrainian', 'zelensky', 'zelenskyy', 'selenskyj', 'kiev', 'kyiv', 'pows', 'prisoner'}
    oil_keywords = {'oil', 'fuel', 'energy', 'gas', 'prices', 'crude', 'opec'}

    for score, title in titles:
        t_lower = re.sub(r'\*\*([^*]+)\*\*', r'\1', title).lower()
        words = set(t_lower.split())

        has_iran = bool(words & iran_keywords)
        has_strike = bool(words & strike_keywords)
        has_reaction = bool(words & reaction_keywords)
        has_ukraine = bool(words & ukraine_keywords)
        has_oil = bool(words & oil_keywords)

        if has_ukraine and not has_iran:
            ukraine.append((score, title))
        elif has_iran and has_strike:
            iran_direct.append((score, title))
        elif has_iran and has_reaction:
            iran_reaction.append((score, title))
        elif has_iran:
            iran_reaction.append((score, title))
        elif has_oil:
            oil_energy.append((score, title))
        elif has_reaction and ('mideast' in t_lower or 'middle east' in t_lower or 'gulf' in t_lower):
            iran_reaction.append((score, title))
        else:
            unrelated.append((score, title))

    print(f"\n  THRESHOLD {label} - Mega-cluster has {len(titles)} articles:")
    print(f"    Iran direct (strikes/attacks/war):  {len(iran_direct)}")
    print(f"    Iran reactions (countries reacting): {len(iran_reaction)}")
    print(f"    Ukraine-related:                     {len(ukraine)}")
    print(f"    Oil/Energy prices:                   {len(oil_energy)}")
    print(f"    UNRELATED (shouldn't be here):       {len(unrelated)}")

    if unrelated:
        print(f"\n    UNRELATED articles incorrectly in mega-cluster:")
        for score, title in unrelated[:30]:
            print(f"      [{score}] {title[:90]}")


# ─── 2. Bad merges comparison ─────────────────────────────────────
print("\n" + "─" * 100)
print("2. BAD MERGES COMPARISON")
print("─" * 100)

for label, section in [("0.85", section85), ("0.88", section88)]:
    bad_clusters = parse_clusters_from_section(section)
    print(f"\n  THRESHOLD {label}: {len(bad_clusters)} bad merge groups")
    for i, c in enumerate(bad_clusters):
        # Skip the mega-cluster (already analyzed above)
        if c['size'] > 50:
            print(f"    Bad merge {i+1}: {c['size']} articles (mega-cluster, see above)")
            continue
        print(f"\n    Bad merge {i+1} ({c['size']} articles):")
        for t in c['titles'][:15]:
            print(f"      - {t[:90]}")
        if len(c['titles']) > 15:
            print(f"      ... and {len(c['titles'])-15} more")


# ─── 3. Good merges comparison (top 5 at each threshold) ──────────
print("\n" + "─" * 100)
print("3. GOOD MERGE EXAMPLES (Top 5 largest at each threshold)")
print("─" * 100)

for label, section in [("0.85", section85), ("0.88", section88)]:
    top5 = parse_all_clusters(section)
    print(f"\n  THRESHOLD {label}:")
    for c in top5:
        print(f"\n    [{c['size']} articles]:")
        for t in c['titles'][:8]:
            print(f"      - {t[:90]}")
        if len(c['titles']) > 8:
            print(f"      ... +{len(c['titles'])-8} more")


# ─── 4. What 0.85 merges that 0.88 doesn't ───────────────────────
print("\n" + "─" * 100)
print("4. ARTICLES MERGED AT 0.85 BUT NOT AT 0.88 (the delta)")
print("─" * 100)
print(f"  0.85 merges {1007} articles ({1007/1896*100:.1f}%)")
print(f"  0.88 merges {695} articles ({695/1896*100:.1f}%)")
print(f"  Delta: {1007-695} additional articles merged at 0.85")
print(f"  0.85 has {132} multi-clusters, 0.88 has {140} multi-clusters")
print(f"  0.85 good: 118, bad: 14")
print(f"  0.88 good: 124, bad: 16")
print(f"\n  Key insight: 0.88 actually has MORE multi-clusters (140 vs 132)")
print(f"  but FEWER articles in them (695 vs 1007).")
print(f"  This means 0.88 creates tighter, smaller clusters.")
print(f"  The 312 extra articles at 0.85 mostly go into the mega-cluster")
print(f"  (636 vs 267 = 369 article difference in cluster 1 alone).")
