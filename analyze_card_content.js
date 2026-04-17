const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sdhdylsfngiybvoltoks.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const COLUMNS = [
  'id', 'title_news', 'url', 'source', 'category', 'emoji',
  'created_at', 'ai_final_score', 'summary_bullets_news',
  'five_ws', 'timeline', 'graph', 'map', 'details',
  'components_order', 'components',
  'shelf_life_days', 'freshness_category',
  'num_sources', 'interest_tags'
].join(', ');

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function getBullets(article) {
  const bullets = safeJsonParse(article.summary_bullets_news, []);
  return Array.isArray(bullets) ? bullets : [];
}

function getDetails(article) {
  const parsed = safeJsonParse(article.details, []);
  return Array.isArray(parsed) ? parsed : [];
}

// Flatten a detail item into readable text
function detailToText(d) {
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && d !== null) {
    // Common formats: {label: "...", value: "..."} or {title: "...", content: "..."}
    if (d.label && d.value) return `${d.label}: ${d.value}`;
    if (d.title && d.content) return `${d.title}: ${d.content}`;
    if (d.title && d.value) return `${d.title}: ${d.value}`;
    if (d.key && d.value) return `${d.key}: ${d.value}`;
    // Fallback: join all string values
    const vals = Object.values(d).filter(v => typeof v === 'string');
    if (vals.length > 0) return vals.join(' | ');
    return JSON.stringify(d);
  }
  return String(d);
}

function getDetailTexts(article) {
  return getDetails(article).map(detailToText);
}

function getFiveWs(article) {
  return safeJsonParse(article.five_ws, null);
}

function fiveWsToText(fw) {
  if (!fw) return '';
  const parts = [];
  for (const [k, v] of Object.entries(fw)) {
    if (v && typeof v === 'string' && v.length > 0) parts.push(`${k}: ${v}`);
  }
  return parts.join(' | ');
}

function getComponents(article) {
  return article.components_order || safeJsonParse(article.components, null);
}

function hasTimeline(article) {
  const t = safeJsonParse(article.timeline, null);
  return t !== null && (Array.isArray(t) ? t.length > 0 : true);
}

function hasGraph(article) {
  const g = safeJsonParse(article.graph, null);
  return g !== null;
}

function hasMap(article) {
  const m = safeJsonParse(article.map, null);
  return m !== null && (Array.isArray(m) ? m.length > 0 : true);
}

// Calculate total text length of bullets
function bulletTextLength(article) {
  return getBullets(article).join(' ').replace(/\*\*/g, '').length;
}

// Calculate total text length of details
function detailTextLength(article) {
  return getDetailTexts(article).join(' ').length;
}

// Heuristics for "title-only" articles: the title itself conveys the full news
function isTitleOnlyCandidate(article) {
  const title = (article.title_news || '');
  const titleLower = title.toLowerCase();
  const category = (article.category || '').toLowerCase();
  const bulletLen = bulletTextLength(article);

  // Sports match results with scores
  if (/\d+\s*[-–]\s*\d+/.test(title) && (category === 'sports' || category === 'sport')) return 'Sports match result';

  // Stock/market movements with specific numbers
  if (/\b(stock|shares?|market|dow|nasdaq|s&p|ftse|index|plunge|surge|drop|rally)\b/i.test(title) && /\d+%|\$\d+|\d+\.\d+/.test(title)) return 'Stock/market movement';

  // Death announcements
  if (/\bdies?\b|\bdeath\b|\bpassed away\b|\bobituary\b/i.test(titleLower) && /\baged?\s*\d+\b|\bat\s*\d+\b|\b\d+\s*,?\s*(dies|dead)\b/i.test(title)) return 'Death announcement';

  // Simple personnel announcements
  if (/\b(appointed|named|hired|fired|resigned|steps down|quits|retires|sacked|leaves)\b/i.test(titleLower)) return 'Personnel change';

  // Award / simple win announcements
  if (/\bwins?\b.*\baward\b|\bawarded\b|\bclinches\b.*\btitle\b/i.test(titleLower)) return 'Award announcement';

  // Sports: specific match results without score format (e.g., "X beats Y")
  if (category === 'sports' && /\b(beats?|defeats?|edges?|downs?|tops?|routs?|blanks?|sweeps?|eliminates?)\b/i.test(titleLower) && /\d/.test(title)) return 'Sports result (verb form)';

  // Weather alerts (simple factual)
  if (/\b(weather alert|tornado warning|flood warning|storm warning)\b/i.test(titleLower)) return 'Weather alert';

  // Recall / product safety
  if (/\brecall(s|ed)?\b/i.test(titleLower) && bulletLen < 200) return 'Product recall';

  return null;
}

// Classify articles where bullets are self-sufficient (info box adds little)
function bulletsAreSelfSufficient(article) {
  const bullets = getBullets(article);
  const details = getDetails(article);
  const detailTexts = getDetailTexts(article);
  const bulletText = bullets.join(' ').toLowerCase().replace(/\*\*/g, '');

  if (details.length === 0) return 'No info box data';

  // Check if info box merely restates bullet info
  let overlapScore = 0;
  for (const dt of detailTexts) {
    const words = dt.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (words.length === 0) continue;
    const matchCount = words.filter(w => bulletText.includes(w)).length;
    overlapScore += matchCount / words.length;
  }
  const avgOverlap = detailTexts.length > 0 ? overlapScore / detailTexts.length : 0;
  if (avgOverlap > 0.65) return `High bullet-detail overlap (${(avgOverlap*100).toFixed(0)}%)`;

  // Short/thin details relative to bullets
  const bLen = bulletTextLength(article);
  const dLen = detailTextLength(article);
  if (dLen > 0 && dLen < bLen * 0.3) return `Very thin info box (${dLen} chars vs ${bLen} bullet chars)`;

  return null;
}

// Articles that benefit from the full layout
function benefitsFromFullLayout(article) {
  const details = getDetails(article);
  const fiveWs = getFiveWs(article);
  const hasTimelineData = hasTimeline(article);
  const hasGraphData = hasGraph(article);
  const hasMapData = hasMap(article);
  const components = getComponents(article);
  const detailLen = detailTextLength(article);
  const bulletLen = bulletTextLength(article);

  const reasons = [];

  if (hasTimelineData) reasons.push('Has timeline');
  if (hasGraphData) reasons.push('Has graph');
  if (hasMapData) reasons.push('Has map');
  if (details.length >= 3 && detailLen > 150) reasons.push('Rich info box');
  if (fiveWs) {
    const filledWs = Object.values(fiveWs).filter(v => v && typeof v === 'string' && v.length > 15).length;
    if (filledWs >= 4) reasons.push(`Detailed Five Ws (${filledWs}/5)`);
  }

  return reasons.length >= 2 ? reasons.join(', ') : null;
}

async function main() {
  console.log('Fetching last 1500 articles from published_articles...\n');

  let allArticles = [];
  const BATCH_SIZE = 500;

  for (let offset = 0; offset < 1500; offset += BATCH_SIZE) {
    const { data, error } = await supabase
      .from('published_articles')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error.message);
      break;
    }
    if (data) allArticles = allArticles.concat(data);
    if (!data || data.length < BATCH_SIZE) break;
    console.log(`  Fetched batch ${offset / BATCH_SIZE + 1}: ${data.length} articles`);
  }

  console.log(`Total articles fetched: ${allArticles.length}`);
  if (allArticles.length === 0) { console.log('No articles found!'); return; }

  const newest = allArticles[0]?.created_at;
  const oldest = allArticles[allArticles.length - 1]?.created_at;
  console.log(`Date range: ${oldest} to ${newest}\n`);

  // ─── INSPECT RAW DATA STRUCTURE ───
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RAW DATA STRUCTURE INSPECTION (first 3 articles)');
  console.log('═══════════════════════════════════════════════════════');

  for (let i = 0; i < Math.min(3, allArticles.length); i++) {
    const a = allArticles[i];
    console.log(`\n--- Article ${i+1} (id=${a.id}) ---`);
    console.log(`  title_news: ${a.title_news}`);
    console.log(`  category: ${a.category}`);
    console.log(`  score: ${a.ai_final_score}`);
    console.log(`  bullets (type=${typeof a.summary_bullets_news}, isArray=${Array.isArray(safeJsonParse(a.summary_bullets_news))}):`);
    const bullets = getBullets(a);
    bullets.forEach((b, j) => console.log(`    [${j}] ${b.substring(0, 150)}`));
    console.log(`  details (type=${typeof a.details}, isArray=${Array.isArray(safeJsonParse(a.details))}):`);
    const details = getDetails(a);
    details.forEach((d, j) => console.log(`    [${j}] ${JSON.stringify(d).substring(0, 200)}`));
    console.log(`  five_ws keys: ${getFiveWs(a) ? Object.keys(getFiveWs(a)).join(', ') : 'null'}`);
    const fw = getFiveWs(a);
    if (fw) {
      for (const [k, v] of Object.entries(fw)) {
        console.log(`    ${k}: ${String(v).substring(0, 100)}`);
      }
    }
    console.log(`  components_order: ${JSON.stringify(getComponents(a))}`);
    console.log(`  has timeline: ${hasTimeline(a)}, graph: ${hasGraph(a)}, map: ${hasMap(a)}`);
    console.log(`  shelf_life_days: ${a.shelf_life_days}, freshness: ${a.freshness_category}`);
  }

  // ─── Category distribution ───
  const categories = {};
  for (const a of allArticles) {
    const cat = a.category || 'UNKNOWN';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  CATEGORY DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════');
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat.padEnd(25)} ${String(count).padStart(4)}  (${(count / allArticles.length * 100).toFixed(1)}%)`);
  });

  // ─── Content structure stats ───
  const total = allArticles.length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CONTENT STRUCTURE OVERVIEW');
  console.log('═══════════════════════════════════════════════════════');

  let withBullets = 0, withDetails = 0, withFiveWs = 0;
  let withTimeline = 0, withGraph = 0, withMap = 0;
  let bulletCounts = [], detailCounts = [];
  let bulletLengths = [], detailLengths = [];

  for (const a of allArticles) {
    const b = getBullets(a);
    const d = getDetails(a);
    const f = getFiveWs(a);
    if (b.length > 0) { withBullets++; bulletCounts.push(b.length); bulletLengths.push(bulletTextLength(a)); }
    if (d.length > 0) { withDetails++; detailCounts.push(d.length); detailLengths.push(detailTextLength(a)); }
    if (f) withFiveWs++;
    if (hasTimeline(a)) withTimeline++;
    if (hasGraph(a)) withGraph++;
    if (hasMap(a)) withMap++;
  }

  console.log(`  Has bullets:         ${withBullets}/${total} (${(withBullets/total*100).toFixed(1)}%)`);
  console.log(`  Has details/infobox: ${withDetails}/${total} (${(withDetails/total*100).toFixed(1)}%)`);
  console.log(`  Has Five Ws:         ${withFiveWs}/${total} (${(withFiveWs/total*100).toFixed(1)}%)`);
  console.log(`  Has timeline:        ${withTimeline}/${total} (${(withTimeline/total*100).toFixed(1)}%)`);
  console.log(`  Has graph:           ${withGraph}/${total} (${(withGraph/total*100).toFixed(1)}%)`);
  console.log(`  Has map:             ${withMap}/${total} (${(withMap/total*100).toFixed(1)}%)`);

  if (bulletCounts.length > 0) {
    bulletCounts.sort((a, b) => a - b);
    bulletLengths.sort((a, b) => a - b);
    console.log(`\n  Bullet count: always ${bulletCounts[0]} (all articles identical)`);
    console.log(`  Bullet text length: min=${bulletLengths[0]}, max=${bulletLengths[bulletLengths.length-1]}, avg=${Math.round(bulletLengths.reduce((s,v)=>s+v,0)/bulletLengths.length)}, median=${bulletLengths[Math.floor(bulletLengths.length/2)]}`);
  }

  if (detailCounts.length > 0) {
    detailCounts.sort((a, b) => a - b);
    detailLengths.sort((a, b) => a - b);
    const detailHist = {};
    detailCounts.forEach(c => { detailHist[c] = (detailHist[c] || 0) + 1; });
    console.log(`\n  Detail item count distribution:`);
    Object.entries(detailHist).sort((a,b) => Number(a[0])-Number(b[0])).forEach(([c, f]) => {
      console.log(`    ${c} items: ${f} articles`);
    });
    console.log(`  Detail text length: min=${detailLengths[0]}, max=${detailLengths[detailLengths.length-1]}, avg=${Math.round(detailLengths.reduce((s,v)=>s+v,0)/detailLengths.length)}, median=${detailLengths[Math.floor(detailLengths.length/2)]}`);
  }

  // ─── FIVE WS structure ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  FIVE WS STRUCTURE');
  console.log('═══════════════════════════════════════════════════════');

  const wsKeys = {};
  let wsLengths = [];
  for (const a of allArticles) {
    const fw = getFiveWs(a);
    if (!fw) continue;
    for (const [k, v] of Object.entries(fw)) {
      wsKeys[k] = (wsKeys[k] || 0) + 1;
    }
    const totalLen = Object.values(fw).filter(v => typeof v === 'string').reduce((s, v) => s + v.length, 0);
    wsLengths.push(totalLen);
  }
  console.log('  Keys present:');
  Object.entries(wsKeys).sort((a,b) => b[1]-a[1]).forEach(([k, c]) => {
    console.log(`    ${k}: ${c} articles`);
  });
  if (wsLengths.length > 0) {
    wsLengths.sort((a,b) => a-b);
    console.log(`  Total text length: min=${wsLengths[0]}, max=${wsLengths[wsLengths.length-1]}, avg=${Math.round(wsLengths.reduce((s,v)=>s+v,0)/wsLengths.length)}, median=${wsLengths[Math.floor(wsLengths.length/2)]}`);
  }

  // ─── CLASSIFICATION ───
  const titleOnly = [];
  const noInfoBoxNeeded = [];
  const fullLayout = [];
  const emptyContent = [];
  const normalArticles = [];

  for (const a of allArticles) {
    const bullets = getBullets(a);
    const details = getDetails(a);

    // Empty content
    if (bullets.length === 0 && details.length === 0) {
      emptyContent.push({ article: a, reason: 'No bullets AND no details' });
      continue;
    }
    if (bullets.length === 0) {
      emptyContent.push({ article: a, reason: 'No bullets (has details)' });
      continue;
    }

    // Title-only
    const titleOnlyReason = isTitleOnlyCandidate(a);
    if (titleOnlyReason) {
      titleOnly.push({ article: a, reason: titleOnlyReason });
      continue;
    }

    // Full layout
    const fullReason = benefitsFromFullLayout(a);
    if (fullReason) {
      fullLayout.push({ article: a, reason: fullReason });
      // Also check if info box is redundant even for full-layout articles
      const selfSuf = bulletsAreSelfSufficient(a);
      if (selfSuf) {
        a._infoBoxNote = selfSuf;
      }
      continue;
    }

    // No info box needed
    const noInfoReason = bulletsAreSelfSufficient(a);
    if (noInfoReason) {
      noInfoBoxNeeded.push({ article: a, reason: noInfoReason });
      continue;
    }

    normalArticles.push(a);
  }

  // ─── REPORT ───
  function printExamples(items, maxExamples = 10) {
    const shown = items.slice(0, maxExamples);
    for (let i = 0; i < shown.length; i++) {
      const { article: a, reason } = shown[i];
      const title = a.title_news || '(no title)';
      const category = a.category || 'UNKNOWN';
      const bullets = getBullets(a);
      const detailTexts = getDetailTexts(a);
      console.log(`\n  ${i + 1}. [${category}] "${title}"`);
      console.log(`     Reason: ${reason}`);
      console.log(`     Bullets: ${bullets.length} (${bulletTextLength(a)} chars), Details: ${detailTexts.length} (${detailTextLength(a)} chars), Score: ${a.ai_final_score || 'N/A'}`);
      if (bullets.length > 0) {
        console.log(`     Bullet 1: "${bullets[0].substring(0, 140)}${bullets[0].length > 140 ? '...' : ''}"`);
      }
      if (detailTexts.length > 0) {
        console.log(`     Detail 1: "${detailTexts[0].substring(0, 140)}${detailTexts[0].length > 140 ? '...' : ''}"`);
      }
      if (a._infoBoxNote) {
        console.log(`     NOTE: ${a._infoBoxNote}`);
      }
    }
    if (items.length > maxExamples) {
      console.log(`\n  ... and ${items.length - maxExamples} more`);
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  GROUP 1: TITLE-ONLY SUFFICIENT (${titleOnly.length} articles, ${(titleOnly.length/total*100).toFixed(1)}%)`);
  console.log('  The title itself conveys the essential news');
  console.log('═══════════════════════════════════════════════════════════════');

  const titleOnlySubcats = {};
  for (const item of titleOnly) { titleOnlySubcats[item.reason] = (titleOnlySubcats[item.reason] || 0) + 1; }
  console.log('\n  Sub-categories:');
  Object.entries(titleOnlySubcats).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
    console.log(`    ${reason}: ${count}`);
  });
  printExamples(titleOnly, 10);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  GROUP 2: INFO BOX NOT NEEDED (${noInfoBoxNeeded.length} articles, ${(noInfoBoxNeeded.length/total*100).toFixed(1)}%)`);
  console.log('  Bullets alone tell the full story; info box is thin/redundant');
  console.log('═══════════════════════════════════════════════════════════════');

  const noInfoSubcats = {};
  for (const item of noInfoBoxNeeded) { noInfoSubcats[item.reason] = (noInfoSubcats[item.reason] || 0) + 1; }
  console.log('\n  Sub-categories:');
  Object.entries(noInfoSubcats).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
    console.log(`    ${reason}: ${count}`);
  });
  printExamples(noInfoBoxNeeded, 10);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  GROUP 3: FULL LAYOUT BENEFICIAL (${fullLayout.length} articles, ${(fullLayout.length/total*100).toFixed(1)}%)`);
  console.log('  Title + bullets + info box (+ timeline/graph/map)');
  console.log('═══════════════════════════════════════════════════════════════');

  const fullSubcats = {};
  let fullWithRedundantInfoBox = 0;
  for (const item of fullLayout) {
    const reasons = item.reason.split(', ');
    for (const r of reasons) { fullSubcats[r] = (fullSubcats[r] || 0) + 1; }
    if (item.article._infoBoxNote) fullWithRedundantInfoBox++;
  }
  console.log('\n  Feature distribution:');
  Object.entries(fullSubcats).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
    console.log(`    ${reason}: ${count}`);
  });
  if (fullWithRedundantInfoBox > 0) {
    console.log(`\n  NOTE: ${fullWithRedundantInfoBox} of these have potentially redundant info boxes`);
  }
  printExamples(fullLayout, 10);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  GROUP 4: EMPTY/NULL CONTENT (${emptyContent.length} articles, ${(emptyContent.length/total*100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════════════════════════════');

  const emptySubcats = {};
  for (const item of emptyContent) { emptySubcats[item.reason] = (emptySubcats[item.reason] || 0) + 1; }
  console.log('\n  Sub-categories:');
  Object.entries(emptySubcats).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
    console.log(`    ${reason}: ${count}`);
  });
  printExamples(emptyContent, 10);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  GROUP 5: STANDARD ARTICLES (${normalArticles.length} articles, ${(normalArticles.length/total*100).toFixed(1)}%)`);
  console.log('  Bullets + details, no special components, not title-only');
  console.log('═══════════════════════════════════════════════════════════════');

  const normalSample = normalArticles.slice(0, 10).map(a => ({
    article: a,
    reason: `${getBullets(a).length} bullets (${bulletTextLength(a)} chars), ${getDetails(a).length} details (${detailTextLength(a)} chars)`
  }));
  printExamples(normalSample, 10);

  // ─── Cross-analysis: content depth by category ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  CONTENT DEPTH BY CATEGORY');
  console.log('═══════════════════════════════════════════════════════════════');

  const catStats = {};
  for (const a of allArticles) {
    const cat = a.category || 'UNKNOWN';
    if (!catStats[cat]) catStats[cat] = { total: 0, hasDetails: 0, hasTimeline: 0, hasGraph: 0, hasMap: 0, bulletChars: [], detailChars: [], titleOnly: 0 };
    const s = catStats[cat];
    s.total++;
    if (getDetails(a).length > 0) s.hasDetails++;
    if (hasTimeline(a)) s.hasTimeline++;
    if (hasGraph(a)) s.hasGraph++;
    if (hasMap(a)) s.hasMap++;
    s.bulletChars.push(bulletTextLength(a));
    s.detailChars.push(detailTextLength(a));
    if (isTitleOnlyCandidate(a)) s.titleOnly++;
  }

  console.log(`\n  ${'Category'.padEnd(18)} ${'Total'.padStart(5)} ${'Details%'.padStart(8)} ${'Timeline%'.padStart(10)} ${'Graph%'.padStart(7)} ${'Map%'.padStart(6)} ${'AvgBullet'.padStart(10)} ${'AvgDetail'.padStart(10)} ${'TitleOnly'.padStart(10)}`);
  console.log('  ' + '─'.repeat(100));

  Object.entries(catStats).sort((a, b) => b[1].total - a[1].total).forEach(([cat, s]) => {
    const avgBullet = Math.round(s.bulletChars.reduce((sum, v) => sum + v, 0) / s.total);
    const avgDetail = Math.round(s.detailChars.reduce((sum, v) => sum + v, 0) / s.total);
    console.log(`  ${cat.padEnd(18)} ${String(s.total).padStart(5)} ${(s.hasDetails/s.total*100).toFixed(0).padStart(7)}% ${(s.hasTimeline/s.total*100).toFixed(0).padStart(9)}% ${(s.hasGraph/s.total*100).toFixed(0).padStart(6)}% ${(s.hasMap/s.total*100).toFixed(0).padStart(5)}% ${String(avgBullet).padStart(9)}c ${String(avgDetail).padStart(9)}c ${String(s.titleOnly).padStart(9)}`);
  });

  // ─── SUMMARY ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total analyzed: ${total}`);
  console.log(`  1. Title-only sufficient:     ${String(titleOnly.length).padStart(5)} (${(titleOnly.length/total*100).toFixed(1)}%)`);
  console.log(`  2. Info box not needed:        ${String(noInfoBoxNeeded.length).padStart(5)} (${(noInfoBoxNeeded.length/total*100).toFixed(1)}%)`);
  console.log(`  3. Full layout beneficial:    ${String(fullLayout.length).padStart(5)} (${(fullLayout.length/total*100).toFixed(1)}%)`);
  console.log(`  4. Empty/null content:        ${String(emptyContent.length).padStart(5)} (${(emptyContent.length/total*100).toFixed(1)}%)`);
  console.log(`  5. Standard (uncategorized):  ${String(normalArticles.length).padStart(5)} (${(normalArticles.length/total*100).toFixed(1)}%)`);

  // ─── Shelf life / freshness ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  SHELF LIFE & FRESHNESS DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════');

  const shelfLifeHist = {};
  const freshnessHist = {};
  let noShelfLife = 0, noFreshness = 0;

  for (const a of allArticles) {
    if (a.shelf_life_days != null) {
      shelfLifeHist[a.shelf_life_days] = (shelfLifeHist[a.shelf_life_days] || 0) + 1;
    } else noShelfLife++;
    if (a.freshness_category) {
      freshnessHist[a.freshness_category] = (freshnessHist[a.freshness_category] || 0) + 1;
    } else noFreshness++;
  }

  console.log('\n  Shelf life (days):');
  if (noShelfLife > 0) console.log(`    NULL: ${noShelfLife}`);
  Object.entries(shelfLifeHist).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([days, count]) => {
    console.log(`    ${days} days: ${count}`);
  });

  console.log('\n  Freshness category:');
  if (noFreshness > 0) console.log(`    NULL: ${noFreshness}`);
  Object.entries(freshnessHist).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`    ${cat}: ${count}`);
  });

  // ─── Components analysis ───
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  COMPONENTS ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  const componentFreq = {};
  let withComponents = 0;
  const componentCombos = {};

  for (const a of allArticles) {
    const comps = getComponents(a);
    if (comps && Array.isArray(comps) && comps.length > 0) {
      withComponents++;
      const names = [];
      for (const c of comps) {
        const name = typeof c === 'string' ? c : (c?.type || c?.name || JSON.stringify(c));
        componentFreq[name] = (componentFreq[name] || 0) + 1;
        names.push(name);
      }
      const combo = names.sort().join(' + ');
      componentCombos[combo] = (componentCombos[combo] || 0) + 1;
    }
  }

  console.log(`\n  Articles with components: ${withComponents}/${total} (${(withComponents/total*100).toFixed(1)}%)`);
  console.log('\n  Individual component frequency:');
  Object.entries(componentFreq).sort((a, b) => b[1] - a[1]).forEach(([comp, count]) => {
    console.log(`    ${comp}: ${count} (${(count/total*100).toFixed(1)}%)`);
  });
  console.log('\n  Component combinations (top 15):');
  Object.entries(componentCombos).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([combo, count]) => {
    console.log(`    ${combo}: ${count}`);
  });

  // ─── Deep dive: sample articles with NO details ───
  const noDetailArticles = allArticles.filter(a => getDetails(a).length === 0);
  if (noDetailArticles.length > 0) {
    console.log(`\n\n═══════════════════════════════════════════════════════════════`);
    console.log(`  ARTICLES WITH NO DETAILS/INFOBOX (${noDetailArticles.length} articles)`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    const noDetailCats = {};
    noDetailArticles.forEach(a => { const c = a.category || 'UNKNOWN'; noDetailCats[c] = (noDetailCats[c] || 0) + 1; });
    console.log('\n  By category:');
    Object.entries(noDetailCats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`);
    });

    console.log('\n  Sample articles:');
    noDetailArticles.slice(0, 10).forEach((a, i) => {
      const bullets = getBullets(a);
      console.log(`\n  ${i+1}. [${a.category}] "${a.title_news}"`);
      console.log(`     Score: ${a.ai_final_score}, Bullets: ${bullets.length} (${bulletTextLength(a)} chars)`);
      bullets.forEach((b, j) => console.log(`     Bullet ${j+1}: "${b.substring(0, 140)}${b.length > 140 ? '...' : ''}"`));
      console.log(`     Components: ${JSON.stringify(getComponents(a))}`);
    });
  }
}

main().catch(console.error);
