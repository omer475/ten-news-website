#!/usr/bin/env python3
"""
Deep Analysis of 50-Persona Feed Test V6 Results
Generates comprehensive charts and insights
"""

import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
from collections import defaultdict
import os

# ─── Load data ───────────────────────────────────────────────────────────────
with open('test_50persona_results_v6.json', 'r') as f:
    data = json.load(f)

OUT_DIR = 'docs/analysis_v6'
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Color palette ───────────────────────────────────────────────────────────
COLORS = {
    'primary': '#6366f1',    # indigo
    'secondary': '#8b5cf6',  # violet
    'success': '#22c55e',    # green
    'warning': '#f59e0b',    # amber
    'danger': '#ef4444',     # red
    'info': '#06b6d4',       # cyan
    'muted': '#94a3b8',      # slate
    'bg': '#0f172a',         # dark bg
    'card': '#1e293b',       # card bg
    'text': '#e2e8f0',       # light text
    'grid': '#334155',       # grid lines
}
GEN_COLORS = {
    'Gen Z': '#f472b6',      # pink
    'Millennial': '#818cf8',  # indigo
    'Gen X+': '#34d399',      # emerald
}

plt.rcParams.update({
    'figure.facecolor': COLORS['bg'],
    'axes.facecolor': COLORS['card'],
    'axes.edgecolor': COLORS['grid'],
    'axes.labelcolor': COLORS['text'],
    'text.color': COLORS['text'],
    'xtick.color': COLORS['text'],
    'ytick.color': COLORS['text'],
    'grid.color': COLORS['grid'],
    'grid.alpha': 0.3,
    'font.family': 'sans-serif',
    'font.size': 11,
})

# ─── Parse into DataFrames ──────────────────────────────────────────────────

# Generation buckets
GEN_Z_NAMES = ['Jayden','Mina','Kai','Priya','Tyler','Aisha','Lucas','Emma','Yuki','Zoe','Omar','Ava','Marcus','Sofia','Ethan']
MILLENNIAL_NAMES = ['Lena','Marco','Elif','Ryan','Sophie','Camille','Diego','Amara','Antonio','Nkechi','ChenWei','Sarah','Hiroshi','Fatima','Carlos','Hannah','Viktor','Jasmine','Tariq','Ayse']
GENX_NAMES = ['Nadia','Mike','Robert','Henrik','Thomas','Jennifer','Patricia','Rashid','Margaret','George','Ingrid','Larry','Zara','Devon','Lars']

def get_gen(name):
    if name in GEN_Z_NAMES: return 'Gen Z'
    if name in MILLENNIAL_NAMES: return 'Millennial'
    return 'Gen X+'

rows = []
for p in data:
    name = p['persona']
    gen = get_gen(name)
    for s in p['sessions']:
        rows.append({
            'persona': name,
            'generation': gen,
            'homeCountry': p['homeCountry'],
            'session': s['sessionNum'],
            'exitType': s['exitType'],
            'satisfaction': s['finalSatisfaction'],
            'total': s['stats']['total'],
            'engaged': s['stats']['engaged'],
            'saved': s['stats']['saved'],
            'skipped': s['stats']['skipped'],
            'engRate': s['stats']['engRate'],
            'relevRate': s['stats'].get('relevantRate', 0),
            'deepReadRate': s['stats'].get('deepReadRate', 0),
            'avgDwell': s['stats']['avgDwell'],
            'totalDwell': s['stats']['totalDwell'],
        })
df = pd.DataFrame(rows)

# Interaction-level dataframe
int_rows = []
for p in data:
    name = p['persona']
    gen = get_gen(name)
    for s in p['sessions']:
        for i in s['interactions']:
            int_rows.append({
                'persona': name,
                'generation': gen,
                'session': s['sessionNum'],
                'category': i.get('category', 'Unknown'),
                'bucket': i.get('bucket', '-'),
                'action': i['action'],
                'signal': i['signal'],
                'dwell': i['dwell'],
                'mood': i['mood'],
                'matchedSubtopics': i.get('matchedSubtopics', []),
                'isRelevant': len(i.get('matchedSubtopics', [])) > 0,
                'score': i.get('score', 0),
                'title': i.get('title', ''),
                'source': i.get('source', ''),
            })
idf = pd.DataFrame(int_rows)

# Scores dataframe
score_rows = []
for p in data:
    name = p['persona']
    gen = get_gen(name)
    sc = p['scores']
    score_rows.append({
        'persona': name,
        'generation': gen,
        'homeCountry': p['homeCountry'],
        'subtopics': ', '.join(p['subtopics']),
        'numSubtopics': len(p['subtopics']),
        'relevance': sc['relevance'],
        'coverage': sc['coverage'],
        'diversity': sc['diversity'],
        'quality': sc['quality'],
        'wouldReturn': sc['wouldReturn'],
        'total': sc['total'],
        'pct': (sc['total'] / 25) * 100,
    })
sdf = pd.DataFrame(score_rows)

print(f"Loaded {len(data)} personas, {len(df)} session records, {len(idf)} interactions")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 1: Overall Score Distribution + Radar by Generation
# ═════════════════════════════════════════════════════════════════════════════

fig = plt.figure(figsize=(20, 8))
gs = gridspec.GridSpec(1, 2, width_ratios=[1.2, 1])

# 1a: Score histogram by generation
ax1 = fig.add_subplot(gs[0])
for gen, color in GEN_COLORS.items():
    subset = sdf[sdf['generation'] == gen]['pct']
    ax1.hist(subset, bins=np.arange(70, 105, 4), alpha=0.7, color=color, label=f'{gen} (n={len(subset)}, avg={subset.mean():.0f}%)', edgecolor='white', linewidth=0.5)
ax1.set_xlabel('Overall Score (%)', fontsize=13)
ax1.set_ylabel('Number of Personas', fontsize=13)
ax1.set_title('Score Distribution by Generation', fontsize=16, fontweight='bold', pad=15)
ax1.legend(fontsize=11, loc='upper left')
ax1.axvline(sdf['pct'].mean(), color=COLORS['warning'], linestyle='--', linewidth=2, label=f'Mean: {sdf["pct"].mean():.0f}%')
ax1.grid(axis='y', alpha=0.2)

# 1b: Radar chart by generation
ax2 = fig.add_subplot(gs[1], polar=True)
dims = ['relevance', 'coverage', 'diversity', 'quality', 'wouldReturn']
dim_labels = ['Relevance', 'Coverage', 'Diversity', 'Quality', 'Would Return']
angles = np.linspace(0, 2 * np.pi, len(dims), endpoint=False).tolist()
angles += angles[:1]

for gen, color in GEN_COLORS.items():
    subset = sdf[sdf['generation'] == gen]
    values = [subset[d].mean() for d in dims]
    values += values[:1]
    ax2.plot(angles, values, 'o-', linewidth=2.5, label=gen, color=color)
    ax2.fill(angles, values, alpha=0.15, color=color)

ax2.set_xticks(angles[:-1])
ax2.set_xticklabels(dim_labels, fontsize=11)
ax2.set_ylim(0, 5.5)
ax2.set_yticks([1, 2, 3, 4, 5])
ax2.set_yticklabels(['1', '2', '3', '4', '5'], fontsize=9, color=COLORS['muted'])
ax2.set_title('Avg Scores by Generation (1-5)', fontsize=16, fontweight='bold', pad=25)
ax2.legend(loc='lower right', fontsize=10, bbox_to_anchor=(1.15, -0.05))
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f'{OUT_DIR}/01_score_overview.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 1: Score overview saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 2: Session-over-Session Engagement Trends (THE KEY CHART)
# ═════════════════════════════════════════════════════════════════════════════

fig, axes = plt.subplots(2, 3, figsize=(22, 13))
fig.suptitle('Session-over-Session Trends: Does the Feed Learn?', fontsize=20, fontweight='bold', y=0.98)

metrics = [
    ('engRate', 'Engagement Rate', True, axes[0, 0]),
    ('relevRate', 'Relevance Rate', True, axes[0, 1]),
    ('avgDwell', 'Avg Dwell Time (s)', True, axes[0, 2]),
    ('deepReadRate', 'Deep Read Rate', True, axes[1, 0]),
    ('satisfaction', 'Satisfaction Score', True, axes[1, 1]),
]

for metric, title, higher_better, ax in metrics:
    for gen, color in GEN_COLORS.items():
        subset = df[df['generation'] == gen]
        means = subset.groupby('session')[metric].mean()
        sems = subset.groupby('session')[metric].sem()
        x = means.index
        ax.plot(x, means.values, 'o-', color=color, linewidth=2.5, markersize=8, label=gen)
        ax.fill_between(x, means.values - sems.values, means.values + sems.values, alpha=0.15, color=color)

    # Overall trend line
    overall = df.groupby('session')[metric].mean()
    ax.plot(overall.index, overall.values, 's--', color=COLORS['warning'], linewidth=3, markersize=10, label='Overall', zorder=5)

    # Trend arrow
    s1, s4 = overall.iloc[0], overall.iloc[-1]
    pct_change = ((s4 - s1) / s1 * 100) if s1 != 0 else 0
    arrow = '+' if pct_change > 0 else ''
    color_trend = COLORS['success'] if (higher_better and pct_change > 5) or (not higher_better and pct_change < -5) else COLORS['danger'] if (higher_better and pct_change < -5) or (not higher_better and pct_change > 5) else COLORS['muted']
    ax.text(0.98, 0.95, f'{arrow}{pct_change:.1f}%', transform=ax.transAxes, fontsize=14, fontweight='bold', color=color_trend, ha='right', va='top')

    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.set_xlabel('Session')
    ax.set_xticks([1, 2, 3, 4])
    ax.grid(True, alpha=0.2)
    ax.legend(fontsize=9)

# Skip rate (inverted — lower is better)
ax_skip = axes[1, 2]
for gen, color in GEN_COLORS.items():
    subset = df[df['generation'] == gen]
    skip_rate = subset.groupby('session').apply(lambda g: g['skipped'].sum() / g['total'].sum() if g['total'].sum() > 0 else 0)
    ax_skip.plot(skip_rate.index, skip_rate.values * 100, 'o-', color=color, linewidth=2.5, markersize=8, label=gen)
overall_skip = df.groupby('session').apply(lambda g: g['skipped'].sum() / g['total'].sum() if g['total'].sum() > 0 else 0)
ax_skip.plot(overall_skip.index, overall_skip.values * 100, 's--', color=COLORS['warning'], linewidth=3, markersize=10, label='Overall', zorder=5)
s1, s4 = overall_skip.iloc[0] * 100, overall_skip.iloc[-1] * 100
pct_change = ((s4 - s1) / s1 * 100) if s1 != 0 else 0
ax_skip.text(0.98, 0.95, f'+{pct_change:.0f}%', transform=ax_skip.transAxes, fontsize=14, fontweight='bold', color=COLORS['danger'], ha='right', va='top')
ax_skip.set_title('Skip Rate (lower = better)', fontsize=14, fontweight='bold')
ax_skip.set_xlabel('Session')
ax_skip.set_xticks([1, 2, 3, 4])
ax_skip.grid(True, alpha=0.2)
ax_skip.legend(fontsize=9)
ax_skip.set_ylabel('%')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig(f'{OUT_DIR}/02_session_trends.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 2: Session trends saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 3: Persona Scorecard Heatmap
# ═════════════════════════════════════════════════════════════════════════════

fig, ax = plt.subplots(figsize=(14, 22))
sorted_sdf = sdf.sort_values('total', ascending=True)
personas = sorted_sdf['persona'].values
dim_names = ['Relevance', 'Coverage', 'Diversity', 'Quality', 'Would Return']
matrix = sorted_sdf[dims].values

im = ax.imshow(matrix, aspect='auto', cmap='RdYlGn', vmin=1, vmax=5)
ax.set_yticks(range(len(personas)))
ax.set_yticklabels([f"{p} ({sorted_sdf.iloc[i]['generation'][:3]})" for i, p in enumerate(personas)], fontsize=9)
ax.set_xticks(range(len(dim_names)))
ax.set_xticklabels(dim_names, fontsize=12, rotation=0)

# Add text annotations
for i in range(len(personas)):
    for j in range(len(dims)):
        val = matrix[i, j]
        color = 'white' if val <= 2 else 'black'
        ax.text(j, i, f'{int(val)}', ha='center', va='center', fontsize=10, fontweight='bold', color=color)

# Add total score column
for i, (_, row) in enumerate(sorted_sdf.iterrows()):
    ax.text(len(dims) + 0.3, i, f'{row["pct"]:.0f}%', ha='left', va='center', fontsize=10,
            fontweight='bold', color=COLORS['success'] if row['pct'] >= 92 else COLORS['warning'] if row['pct'] >= 84 else COLORS['danger'])

ax.set_title('Persona Scorecard (1-5 per dimension)', fontsize=16, fontweight='bold', pad=15)
plt.colorbar(im, ax=ax, shrink=0.4, label='Score (1-5)')
plt.tight_layout()
plt.savefig(f'{OUT_DIR}/03_persona_heatmap.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 3: Persona heatmap saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 4: Category Performance Analysis
# ═════════════════════════════════════════════════════════════════════════════

if len(idf) > 0:
    fig, axes = plt.subplots(1, 3, figsize=(22, 8))
    fig.suptitle('Content Category Analysis', fontsize=18, fontweight='bold', y=1.02)

    # 4a: Article distribution by category
    cat_counts = idf['category'].value_counts().head(12)
    colors_bar = plt.cm.viridis(np.linspace(0.2, 0.9, len(cat_counts)))
    bars = axes[0].barh(cat_counts.index[::-1], cat_counts.values[::-1], color=colors_bar[::-1], edgecolor='white', linewidth=0.5)
    axes[0].set_title('Articles by Category', fontsize=14, fontweight='bold')
    axes[0].set_xlabel('Count')
    for bar, val in zip(bars, cat_counts.values[::-1]):
        axes[0].text(bar.get_width() + 5, bar.get_y() + bar.get_height()/2, str(val), va='center', fontsize=10, color=COLORS['text'])

    # 4b: Engagement rate by category
    cat_eng = idf.groupby('category').apply(lambda g: (g['signal'] == 'ENGAGE').mean()).sort_values(ascending=True)
    cat_eng_top = cat_eng.tail(12)
    colors_eng = [COLORS['success'] if v >= 0.8 else COLORS['warning'] if v >= 0.5 else COLORS['danger'] for v in cat_eng_top.values]
    axes[1].barh(cat_eng_top.index, cat_eng_top.values * 100, color=colors_eng, edgecolor='white', linewidth=0.5)
    axes[1].set_title('Engagement Rate by Category', fontsize=14, fontweight='bold')
    axes[1].set_xlabel('Engagement %')
    axes[1].axvline(80, color=COLORS['success'], linestyle='--', alpha=0.5)

    # 4c: Avg dwell by category
    cat_dwell = idf.groupby('category')['dwell'].mean().sort_values(ascending=True).tail(12)
    colors_dwell = plt.cm.plasma(np.linspace(0.2, 0.9, len(cat_dwell)))
    axes[2].barh(cat_dwell.index, cat_dwell.values, color=colors_dwell, edgecolor='white', linewidth=0.5)
    axes[2].set_title('Avg Dwell Time by Category', fontsize=14, fontweight='bold')
    axes[2].set_xlabel('Seconds')
    for i, (cat, val) in enumerate(cat_dwell.items()):
        axes[2].text(val + 0.2, i, f'{val:.1f}s', va='center', fontsize=10, color=COLORS['text'])

    plt.tight_layout()
    plt.savefig(f'{OUT_DIR}/04_category_analysis.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 4: Category analysis saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 5: Dwell Time Distribution + Action Breakdown
# ═════════════════════════════════════════════════════════════════════════════

if len(idf) > 0:
    fig, axes = plt.subplots(1, 3, figsize=(22, 7))
    fig.suptitle('User Behavior Deep Dive', fontsize=18, fontweight='bold', y=1.02)

    # 5a: Dwell time distribution
    bins = [0, 0.5, 1, 3, 8, 15, 30, 60]
    labels = ['<0.5s\nSkip', '0.5-1s\nQuick', '1-3s\nScan', '3-8s\nRead', '8-15s\nDeep', '15-30s\nAbsorbed', '30s+\nHooked']
    hist_vals = np.histogram(idf['dwell'].clip(upper=60), bins=bins)[0]
    colors_hist = [COLORS['danger'], '#f97316', COLORS['warning'], COLORS['info'], COLORS['primary'], COLORS['success'], '#22d3ee']
    bars = axes[0].bar(range(len(hist_vals)), hist_vals, color=colors_hist, edgecolor='white', linewidth=0.5)
    axes[0].set_xticks(range(len(labels)))
    axes[0].set_xticklabels(labels, fontsize=9)
    axes[0].set_title('Dwell Time Distribution', fontsize=14, fontweight='bold')
    axes[0].set_ylabel('Articles')
    for bar, val in zip(bars, hist_vals):
        pct = val / len(idf) * 100
        axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 10, f'{pct:.0f}%', ha='center', fontsize=10, fontweight='bold', color=COLORS['text'])

    # 5b: Action breakdown pie
    action_counts = idf['action'].value_counts()
    action_colors = {'DEEP_READ': COLORS['success'], 'ENGAGE': COLORS['primary'], 'GLANCE': COLORS['warning'], 'SCAN': '#f97316', 'SKIP': COLORS['danger']}
    pie_colors = [action_colors.get(a, COLORS['muted']) for a in action_counts.index]
    wedges, texts, autotexts = axes[1].pie(action_counts.values, labels=action_counts.index, colors=pie_colors,
                                            autopct='%1.1f%%', startangle=90, textprops={'fontsize': 11})
    for t in autotexts:
        t.set_fontweight('bold')
    axes[1].set_title('Action Breakdown', fontsize=14, fontweight='bold')

    # 5c: Dwell by generation over sessions
    for gen, color in GEN_COLORS.items():
        subset = idf[idf['generation'] == gen]
        means = subset.groupby('session')['dwell'].mean()
        axes[2].plot(means.index, means.values, 'o-', color=color, linewidth=2.5, markersize=8, label=gen)
    overall_dwell = idf.groupby('session')['dwell'].mean()
    axes[2].plot(overall_dwell.index, overall_dwell.values, 's--', color=COLORS['warning'], linewidth=3, markersize=10, label='Overall')
    axes[2].set_title('Avg Dwell Over Sessions', fontsize=14, fontweight='bold')
    axes[2].set_xlabel('Session')
    axes[2].set_ylabel('Seconds')
    axes[2].set_xticks([1, 2, 3, 4])
    axes[2].legend()
    axes[2].grid(True, alpha=0.2)

    plt.tight_layout()
    plt.savefig(f'{OUT_DIR}/05_behavior_deep_dive.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 5: Behavior deep dive saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 6: Subtopic Coverage Heatmap
# ═════════════════════════════════════════════════════════════════════════════

if len(idf) > 0:
    # Get all subtopics that were selected by any persona
    all_subtopics = set()
    for p in data:
        all_subtopics.update(p['subtopics'])
    all_subtopics = sorted(all_subtopics)

    # Count articles matching each subtopic
    st_counts = defaultdict(int)
    st_engaged = defaultdict(int)
    for _, row in idf.iterrows():
        for st in row['matchedSubtopics']:
            st_counts[st] += 1
            if row['signal'] == 'ENGAGE':
                st_engaged[st] += 1

    fig, ax = plt.subplots(figsize=(14, 16))
    subtopics_sorted = sorted(all_subtopics, key=lambda s: st_counts.get(s, 0), reverse=True)
    y = range(len(subtopics_sorted))
    counts = [st_counts.get(s, 0) for s in subtopics_sorted]
    engaged = [st_engaged.get(s, 0) for s in subtopics_sorted]

    # Number of personas selecting each subtopic
    persona_counts = defaultdict(int)
    for p in data:
        for st in p['subtopics']:
            persona_counts[st] += 1

    bars1 = ax.barh(y, counts, color=COLORS['primary'], alpha=0.6, label='Total Articles', edgecolor='white', linewidth=0.3)
    bars2 = ax.barh(y, engaged, color=COLORS['success'], alpha=0.8, label='Engaged', edgecolor='white', linewidth=0.3)

    ax.set_yticks(y)
    ax.set_yticklabels([f"{s} ({persona_counts[s]}p)" for s in subtopics_sorted], fontsize=9)
    ax.set_xlabel('Article Count')
    ax.set_title('Subtopic Coverage: Articles Seen vs Engaged', fontsize=16, fontweight='bold', pad=15)
    ax.legend(fontsize=12, loc='lower right')
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.2)

    # Add engagement rate annotations
    for i, (c, e) in enumerate(zip(counts, engaged)):
        if c > 0:
            rate = e / c * 100
            ax.text(c + 5, i, f'{rate:.0f}%', va='center', fontsize=9, color=COLORS['success'] if rate >= 90 else COLORS['warning'])

    plt.tight_layout()
    plt.savefig(f'{OUT_DIR}/06_subtopic_coverage.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 6: Subtopic coverage saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 7: Per-Persona Engagement Journey (Top 10 + Bottom 5)
# ═════════════════════════════════════════════════════════════════════════════

fig, axes = plt.subplots(1, 2, figsize=(20, 8))
fig.suptitle('Individual Persona Journeys: Best vs Worst', fontsize=18, fontweight='bold', y=1.02)

# Top 10 by overall score
top10 = sdf.nlargest(10, 'total')['persona'].values
ax = axes[0]
for name in top10:
    subset = df[df['persona'] == name]
    gen = get_gen(name)
    color = GEN_COLORS[gen]
    ax.plot(subset['session'], subset['engRate'] * 100, 'o-', color=color, linewidth=1.5, alpha=0.7, markersize=5)
    ax.text(4.1, subset[subset['session'] == 4]['engRate'].values[0] * 100, name, fontsize=8, va='center', color=color)
ax.set_title('Top 10 Personas — Engagement Rate', fontsize=14, fontweight='bold')
ax.set_xlabel('Session')
ax.set_ylabel('Engagement %')
ax.set_xticks([1, 2, 3, 4])
ax.set_xlim(0.8, 5)
ax.grid(True, alpha=0.2)

# Bottom 5
bottom5 = sdf.nsmallest(5, 'total')['persona'].values
ax = axes[1]
for name in bottom5:
    subset = df[df['persona'] == name]
    gen = get_gen(name)
    color = GEN_COLORS[gen]
    ax.plot(subset['session'], subset['engRate'] * 100, 'o-', color=color, linewidth=2, markersize=7)
    ax.text(4.1, subset[subset['session'] == 4]['engRate'].values[0] * 100, name, fontsize=10, va='center', color=color, fontweight='bold')
ax.set_title('Bottom 5 Personas — Engagement Rate', fontsize=14, fontweight='bold')
ax.set_xlabel('Session')
ax.set_ylabel('Engagement %')
ax.set_xticks([1, 2, 3, 4])
ax.set_xlim(0.8, 5)
ax.grid(True, alpha=0.2)

plt.tight_layout()
plt.savefig(f'{OUT_DIR}/07_persona_journeys.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 7: Persona journeys saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 8: Satisfaction Mood Heatmap (per persona per session)
# ═════════════════════════════════════════════════════════════════════════════

fig, ax = plt.subplots(figsize=(10, 22))
sorted_personas = sdf.sort_values('total', ascending=False)['persona'].values
matrix = np.zeros((len(sorted_personas), 4))
for i, name in enumerate(sorted_personas):
    for s in range(1, 5):
        val = df[(df['persona'] == name) & (df['session'] == s)]['satisfaction'].values
        matrix[i, s-1] = val[0] if len(val) > 0 else 50

im = ax.imshow(matrix, aspect='auto', cmap='RdYlGn', vmin=0, vmax=100)
ax.set_yticks(range(len(sorted_personas)))
ax.set_yticklabels([f"{p} ({sdf[sdf['persona']==p]['pct'].values[0]:.0f}%)" for p in sorted_personas], fontsize=9)
ax.set_xticks(range(4))
ax.set_xticklabels(['S1', 'S2', 'S3', 'S4'], fontsize=12)
ax.set_title('Satisfaction by Persona & Session', fontsize=16, fontweight='bold', pad=15)
plt.colorbar(im, ax=ax, shrink=0.4, label='Satisfaction (0-100)')

for i in range(len(sorted_personas)):
    for j in range(4):
        val = matrix[i, j]
        color = 'white' if val < 50 else 'black'
        ax.text(j, i, f'{int(val)}', ha='center', va='center', fontsize=8, color=color)

plt.tight_layout()
plt.savefig(f'{OUT_DIR}/08_satisfaction_heatmap.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 8: Satisfaction heatmap saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 9: Feed Bucket Analysis (personalized vs trending vs discovery)
# ═════════════════════════════════════════════════════════════════════════════

if len(idf) > 0 and 'bucket' in idf.columns:
    fig, axes = plt.subplots(1, 3, figsize=(22, 7))
    fig.suptitle('Feed Bucket Performance: Personalized vs Trending vs Discovery', fontsize=18, fontweight='bold', y=1.02)

    # 9a: Distribution of buckets
    bucket_counts = idf['bucket'].value_counts()
    bucket_colors_map = {'personal': COLORS['success'], 'trending': COLORS['warning'], 'discovery': COLORS['info'], 'filler': COLORS['muted'], '-': '#475569'}
    bc = [bucket_colors_map.get(b, COLORS['muted']) for b in bucket_counts.index]
    axes[0].pie(bucket_counts.values, labels=bucket_counts.index, colors=bc, autopct='%1.1f%%',
                startangle=90, textprops={'fontsize': 11, 'fontweight': 'bold'})
    axes[0].set_title('Article Source Mix', fontsize=14, fontweight='bold')

    # 9b: Engagement by bucket
    bucket_eng = idf.groupby('bucket').apply(lambda g: (g['signal'] == 'ENGAGE').mean()).sort_values()
    bc2 = [bucket_colors_map.get(b, COLORS['muted']) for b in bucket_eng.index]
    axes[1].barh(bucket_eng.index, bucket_eng.values * 100, color=bc2, edgecolor='white', linewidth=0.5)
    axes[1].set_xlabel('Engagement %')
    axes[1].set_title('Engagement Rate by Bucket', fontsize=14, fontweight='bold')
    axes[1].axvline(80, color=COLORS['success'], linestyle='--', alpha=0.3)
    for i, (b, v) in enumerate(bucket_eng.items()):
        axes[1].text(v * 100 + 1, i, f'{v*100:.0f}%', va='center', fontsize=11, fontweight='bold', color=COLORS['text'])

    # 9c: Dwell by bucket
    bucket_dwell = idf.groupby('bucket')['dwell'].mean().sort_values()
    bc3 = [bucket_colors_map.get(b, COLORS['muted']) for b in bucket_dwell.index]
    axes[2].barh(bucket_dwell.index, bucket_dwell.values, color=bc3, edgecolor='white', linewidth=0.5)
    axes[2].set_xlabel('Avg Dwell (seconds)')
    axes[2].set_title('Avg Dwell by Bucket', fontsize=14, fontweight='bold')
    for i, (b, v) in enumerate(bucket_dwell.items()):
        axes[2].text(v + 0.2, i, f'{v:.1f}s', va='center', fontsize=11, fontweight='bold', color=COLORS['text'])

    plt.tight_layout()
    plt.savefig(f'{OUT_DIR}/09_bucket_analysis.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 9: Bucket analysis saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 10: Geographic Performance + Country Heatmap
# ═════════════════════════════════════════════════════════════════════════════

fig, axes = plt.subplots(1, 2, figsize=(20, 8))
fig.suptitle('Geographic Analysis', fontsize=18, fontweight='bold', y=1.02)

# 10a: Score by country
country_scores = sdf.groupby('homeCountry')['pct'].mean().sort_values(ascending=True)
colors_country = [COLORS['success'] if v >= 92 else COLORS['warning'] if v >= 85 else COLORS['danger'] for v in country_scores.values]
axes[0].barh(country_scores.index, country_scores.values, color=colors_country, edgecolor='white', linewidth=0.5)
axes[0].set_xlabel('Average Score (%)')
axes[0].set_title('Avg Score by Home Country', fontsize=14, fontweight='bold')
axes[0].axvline(sdf['pct'].mean(), color=COLORS['warning'], linestyle='--', alpha=0.5, label=f'Mean: {sdf["pct"].mean():.0f}%')
axes[0].legend()
for i, (c, v) in enumerate(country_scores.items()):
    n = len(sdf[sdf['homeCountry'] == c])
    axes[0].text(v + 0.3, i, f'{v:.0f}% (n={n})', va='center', fontsize=10, color=COLORS['text'])

# 10b: Engagement trend by country (top 6 by persona count)
top_countries = sdf['homeCountry'].value_counts().head(6).index
cmap = plt.cm.tab10
for i, country in enumerate(top_countries):
    subset = df[df.apply(lambda r: sdf[sdf['persona'] == r['persona']]['homeCountry'].values[0] == country if len(sdf[sdf['persona'] == r['persona']]) > 0 else False, axis=1)]
    if len(subset) > 0:
        means = subset.groupby('session')['engRate'].mean()
        axes[1].plot(means.index, means.values * 100, 'o-', color=cmap(i), linewidth=2, markersize=7, label=f'{country} (n={len(sdf[sdf["homeCountry"]==country])})')

axes[1].set_title('Engagement Trend by Country', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Session')
axes[1].set_ylabel('Engagement %')
axes[1].set_xticks([1, 2, 3, 4])
axes[1].legend(fontsize=9)
axes[1].grid(True, alpha=0.2)

plt.tight_layout()
plt.savefig(f'{OUT_DIR}/10_geographic_analysis.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 10: Geographic analysis saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 11: Exit Type Analysis
# ═════════════════════════════════════════════════════════════════════════════

fig, axes = plt.subplots(1, 3, figsize=(22, 7))
fig.suptitle('Session Exit Analysis: Why Do Users Leave?', fontsize=18, fontweight='bold', y=1.02)

# 11a: Exit type distribution
exit_counts = df['exitType'].value_counts()
exit_colors = {'natural': COLORS['success'], 'bored': COLORS['warning'], 'frustrated': COLORS['danger']}
ec = [exit_colors.get(e, COLORS['muted']) for e in exit_counts.index]
wedges, texts, autotexts = axes[0].pie(exit_counts.values, labels=exit_counts.index, colors=ec,
                                        autopct='%1.1f%%', startangle=90, textprops={'fontsize': 12})
for t in autotexts:
    t.set_fontweight('bold')
axes[0].set_title('Exit Type Distribution', fontsize=14, fontweight='bold')

# 11b: Exit type by session
exit_by_session = pd.crosstab(df['session'], df['exitType'], normalize='index') * 100
exit_by_session.plot(kind='bar', stacked=True, ax=axes[1],
                     color=[exit_colors.get(c, COLORS['muted']) for c in exit_by_session.columns],
                     edgecolor='white', linewidth=0.5)
axes[1].set_title('Exit Type by Session', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Session')
axes[1].set_ylabel('%')
axes[1].legend(fontsize=10)
axes[1].set_xticklabels(['S1', 'S2', 'S3', 'S4'], rotation=0)

# 11c: Exit type by generation
exit_by_gen = pd.crosstab(df['generation'], df['exitType'], normalize='index') * 100
exit_by_gen.plot(kind='bar', stacked=True, ax=axes[2],
                 color=[exit_colors.get(c, COLORS['muted']) for c in exit_by_gen.columns],
                 edgecolor='white', linewidth=0.5)
axes[2].set_title('Exit Type by Generation', fontsize=14, fontweight='bold')
axes[2].set_xlabel('')
axes[2].set_ylabel('%')
axes[2].legend(fontsize=10)
axes[2].set_xticklabels(exit_by_gen.index, rotation=0)

plt.tight_layout()
plt.savefig(f'{OUT_DIR}/11_exit_analysis.png', dpi=150, bbox_inches='tight')
plt.close()
print("Chart 11: Exit analysis saved")

# ═════════════════════════════════════════════════════════════════════════════
# CHART 12: Mood/Satisfaction Curves — Average intra-session mood trajectory
# ═════════════════════════════════════════════════════════════════════════════

if len(idf) > 0:
    fig, axes = plt.subplots(1, 2, figsize=(20, 7))
    fig.suptitle('Intra-Session Mood Trajectories', fontsize=18, fontweight='bold', y=1.02)

    # 12a: Average mood by article position (within session)
    for gen, color in GEN_COLORS.items():
        subset = idf[idf['generation'] == gen]
        # Group by article position within session
        subset_with_pos = subset.copy()
        subset_with_pos['pos'] = subset_with_pos.groupby(['persona', 'session']).cumcount() + 1
        mood_by_pos = subset_with_pos.groupby('pos')['mood'].mean()
        mood_by_pos = mood_by_pos[mood_by_pos.index <= 30]  # limit to 30 articles
        axes[0].plot(mood_by_pos.index, mood_by_pos.values, '-', color=color, linewidth=2, alpha=0.8, label=gen)

    # Overall
    idf_pos = idf.copy()
    idf_pos['pos'] = idf_pos.groupby(['persona', 'session']).cumcount() + 1
    overall_mood = idf_pos.groupby('pos')['mood'].mean()
    overall_mood = overall_mood[overall_mood.index <= 30]
    axes[0].plot(overall_mood.index, overall_mood.values, 's--', color=COLORS['warning'], linewidth=3, markersize=6, label='Overall')
    axes[0].set_title('Mood by Article Position', fontsize=14, fontweight='bold')
    axes[0].set_xlabel('Article # in Session')
    axes[0].set_ylabel('Mood (0-100)')
    axes[0].legend()
    axes[0].grid(True, alpha=0.2)
    axes[0].axhline(50, color=COLORS['danger'], linestyle=':', alpha=0.5, label='Neutral')

    # 12b: Mood by session (boxplot style)
    session_moods = [df[df['session'] == s]['satisfaction'].values for s in [1, 2, 3, 4]]
    bp = axes[1].boxplot(session_moods, patch_artist=True, labels=['S1', 'S2', 'S3', 'S4'],
                          medianprops={'color': COLORS['warning'], 'linewidth': 2},
                          whiskerprops={'color': COLORS['text']},
                          capprops={'color': COLORS['text']},
                          flierprops={'markerfacecolor': COLORS['danger'], 'markersize': 5})
    colors_box = [COLORS['success'], COLORS['primary'], COLORS['secondary'], COLORS['danger']]
    for patch, color in zip(bp['boxes'], colors_box):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)
    axes[1].set_title('End-of-Session Satisfaction Distribution', fontsize=14, fontweight='bold')
    axes[1].set_ylabel('Satisfaction (0-100)')
    axes[1].grid(axis='y', alpha=0.2)

    plt.tight_layout()
    plt.savefig(f'{OUT_DIR}/12_mood_trajectories.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 12: Mood trajectories saved")

# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY STATS
# ═════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 80)
print("DEEP ANALYSIS SUMMARY")
print("=" * 80)
print(f"\nTotal personas: {len(data)}")
print(f"Total sessions: {len(df)}")
print(f"Total interactions: {len(idf)}")
print(f"Total dwell time: {idf['dwell'].sum() / 60:.0f} minutes")
print(f"Avg dwell per article: {idf['dwell'].mean():.1f}s")

print(f"\n--- OVERALL SCORES ---")
print(f"Mean score: {sdf['pct'].mean():.1f}%")
print(f"Median: {sdf['pct'].median():.0f}%")
print(f"Min: {sdf['pct'].min():.0f}% ({sdf.loc[sdf['pct'].idxmin(), 'persona']})")
print(f"Max: {sdf['pct'].max():.0f}% ({sdf.loc[sdf['pct'].idxmax(), 'persona']})")

print(f"\n--- BY GENERATION ---")
for gen in ['Gen Z', 'Millennial', 'Gen X+']:
    g = sdf[sdf['generation'] == gen]
    gs = df[df['generation'] == gen]
    print(f"  {gen}: avg score {g['pct'].mean():.0f}%, eng rate S1={gs[gs['session']==1]['engRate'].mean()*100:.0f}% → S4={gs[gs['session']==4]['engRate'].mean()*100:.0f}%, avg dwell {idf[idf['generation']==gen]['dwell'].mean():.1f}s")

print(f"\n--- SESSION TRENDS ---")
for s in [1, 2, 3, 4]:
    ss = df[df['session'] == s]
    print(f"  S{s}: eng={ss['engRate'].mean()*100:.1f}%, relev={ss['relevRate'].mean()*100:.1f}%, dwell={ss['avgDwell'].mean():.1f}s, sat={ss['satisfaction'].mean():.0f}, exits: {dict(ss['exitType'].value_counts())}")

print(f"\n--- TOP 5 CATEGORIES ---")
if len(idf) > 0:
    for cat in idf['category'].value_counts().head(5).index:
        cat_data = idf[idf['category'] == cat]
        eng = (cat_data['signal'] == 'ENGAGE').mean() * 100
        print(f"  {cat}: {len(cat_data)} articles, {eng:.0f}% engaged, {cat_data['dwell'].mean():.1f}s avg dwell")

print(f"\n--- KEY INSIGHTS ---")
s1_eng = df[df['session'] == 1]['engRate'].mean()
s4_eng = df[df['session'] == 4]['engRate'].mean()
print(f"  1. Initial personalization is STRONG: S1 engagement = {s1_eng*100:.0f}%")
print(f"  2. Feed does NOT learn: S4 engagement = {s4_eng*100:.0f}% ({(s4_eng-s1_eng)/s1_eng*100:+.0f}%)")
print(f"  3. Diversity is the weakest dimension: avg {sdf['diversity'].mean():.1f}/5")
print(f"  4. Coverage is perfect: avg {sdf['coverage'].mean():.1f}/5 — all subtopics get content")

frustrated = len(df[df['exitType'] == 'frustrated'])
bored = len(df[df['exitType'] == 'bored'])
natural = len(df[df['exitType'] == 'natural'])
print(f"  5. Exit types: {natural} natural ({natural/len(df)*100:.0f}%), {bored} bored ({bored/len(df)*100:.0f}%), {frustrated} frustrated ({frustrated/len(df)*100:.0f}%)")

gen_z_s4 = df[(df['generation'] == 'Gen Z') & (df['session'] == 4)]['engRate'].mean()
boomer_s4 = df[(df['generation'] == 'Gen X+') & (df['session'] == 4)]['engRate'].mean()
print(f"  6. Gen Z S4 engagement: {gen_z_s4*100:.0f}% vs Gen X+ S4: {boomer_s4*100:.0f}% — older users retain better")

print(f"\nAll charts saved to: {OUT_DIR}/")
print("=" * 80)
