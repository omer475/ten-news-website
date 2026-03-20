const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sdhdylsfngiybvoltoks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const now = new Date();
  const h72 = new Date(now - 72 * 60 * 60 * 1000).toISOString();
  const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  console.log('='.repeat(80));
  console.log('CONTENT INVENTORY ANALYSIS');
  console.log(`Run at: ${now.toISOString()}`);
  console.log(`72h window: since ${h72}`);
  console.log(`24h window: since ${h24}`);
  console.log('='.repeat(80));

  // ── 1. Total article count ──
  const { count: totalCount, error: e1 } = await supabase
    .from('published_articles')
    .select('*', { count: 'exact', head: true });
  if (e1) { console.error('Error getting total count:', e1); return; }
  console.log(`\nTotal articles in published_articles: ${totalCount}`);

  // ── 2. Articles per category (all time) ──
  console.log('\n' + '─'.repeat(60));
  console.log('ARTICLES PER CATEGORY (ALL TIME)');
  console.log('─'.repeat(60));

  // Supabase JS doesn't support GROUP BY natively, so we fetch categories
  // We'll use RPC or just fetch category column for all articles
  // For efficiency, let's fetch just id + category + published_at + interest_tags
  // But that could be huge. Let's paginate.

  let allArticles = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, category, published_at, interest_tags')
      .range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching articles:', error); return; }
    if (!data || data.length === 0) break;
    allArticles = allArticles.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Fetched ${allArticles.length} articles total`);

  // Category counts - all time
  const catCounts = {};
  for (const a of allArticles) {
    const cat = a.category || 'NULL';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    console.log(`  ${cat.padEnd(25)} ${String(count).padStart(6)}`);
  }

  // ── 3. Articles per category (last 72h) ──
  const articles72h = allArticles.filter(a => a.published_at && new Date(a.published_at) >= new Date(h72));
  console.log('\n' + '─'.repeat(60));
  console.log(`ARTICLES PER CATEGORY (LAST 72H) — ${articles72h.length} total`);
  console.log('─'.repeat(60));

  const catCounts72 = {};
  for (const a of articles72h) {
    const cat = a.category || 'NULL';
    catCounts72[cat] = (catCounts72[cat] || 0) + 1;
  }
  const sortedCats72 = Object.entries(catCounts72).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats72) {
    console.log(`  ${cat.padEnd(25)} ${String(count).padStart(6)}`);
  }

  // ── 4. Articles per category (last 24h) ──
  const articles24h = allArticles.filter(a => a.published_at && new Date(a.published_at) >= new Date(h24));
  console.log('\n' + '─'.repeat(60));
  console.log(`ARTICLES PER CATEGORY (LAST 24H) — ${articles24h.length} total`);
  console.log('─'.repeat(60));

  const catCounts24 = {};
  for (const a of articles24h) {
    const cat = a.category || 'NULL';
    catCounts24[cat] = (catCounts24[cat] || 0) + 1;
  }
  const sortedCats24 = Object.entries(catCounts24).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats24) {
    console.log(`  ${cat.padEnd(25)} ${String(count).padStart(6)}`);
  }

  // ── 5. Interest tag analysis for persona-relevant topics ──
  console.log('\n' + '='.repeat(80));
  console.log('PERSONA-RELEVANT INTEREST TAG ANALYSIS (LAST 72H)');
  console.log('='.repeat(80));

  const personaTagSets = {
    'Soccer/Football (Marco)': {
      tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'serie a', 'mls'],
      persona: 'Marco — Soccer enthusiast'
    },
    'Gaming (Devon)': {
      tags: ['gaming', 'video games', 'esports', 'playstation', 'xbox', 'nintendo', 'steam'],
      persona: 'Devon — Gaming enthusiast'
    },
    'Fashion (Camille/Zara)': {
      tags: ['fashion', 'clothing', 'designer', 'runway', 'vogue', 'streetwear', 'sneakers'],
      persona: 'Camille/Zara — Fashion enthusiasts'
    },
    'Medical/Health (Jennifer)': {
      tags: ['medical', 'clinical trial', 'pharma', 'oncology', 'biotech', 'fda'],
      persona: 'Jennifer — Medical/health enthusiast'
    },
    'Film/Entertainment (Sophie)': {
      tags: ['movies', 'film', 'cinema', 'box office', 'oscar', 'hollywood', 'netflix', 'streaming'],
      persona: 'Sophie — Film/entertainment enthusiast'
    },
    'Climate/Environment (Lars/Lena)': {
      tags: ['climate', 'environment', 'carbon', 'emissions', 'renewable'],
      persona: 'Lars/Lena — Climate/environment enthusiasts'
    },
  };

  for (const [topicName, { tags, persona }] of Object.entries(personaTagSets)) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${topicName}`);
    console.log(`Persona: ${persona}`);
    console.log(`Searching for tags: ${tags.join(', ')}`);
    console.log('─'.repeat(60));

    // Count articles in 72h window with matching interest_tags
    let matchCount72 = 0;
    let matchCount24 = 0;
    const matchingArticles72 = [];

    for (const a of articles72h) {
      const artTags = a.interest_tags || [];
      // interest_tags is a JSONB array of strings
      const tagArray = Array.isArray(artTags) ? artTags : (typeof artTags === 'string' ? JSON.parse(artTags) : []);
      const lowerTags = tagArray.map(t => (t || '').toLowerCase());

      const matched = tags.some(searchTag =>
        lowerTags.some(artTag => artTag.includes(searchTag) || searchTag.includes(artTag))
      );

      if (matched) {
        matchCount72++;
        const matchedTags = tags.filter(searchTag =>
          lowerTags.some(artTag => artTag.includes(searchTag) || searchTag.includes(artTag))
        );
        matchingArticles72.push({
          id: a.id,
          category: a.category,
          published_at: a.published_at,
          matchedTags,
          articleTags: tagArray
        });
      }
    }

    for (const a of articles24h) {
      const artTags = a.interest_tags || [];
      const tagArray = Array.isArray(artTags) ? artTags : (typeof artTags === 'string' ? JSON.parse(artTags) : []);
      const lowerTags = tagArray.map(t => (t || '').toLowerCase());

      const matched = tags.some(searchTag =>
        lowerTags.some(artTag => artTag.includes(searchTag) || searchTag.includes(artTag))
      );

      if (matched) matchCount24++;
    }

    console.log(`  Articles matching in last 72h: ${matchCount72}`);
    console.log(`  Articles matching in last 24h: ${matchCount24}`);

    // Show category breakdown of matches
    const matchByCat = {};
    for (const m of matchingArticles72) {
      matchByCat[m.category || 'NULL'] = (matchByCat[m.category || 'NULL'] || 0) + 1;
    }
    if (Object.keys(matchByCat).length > 0) {
      console.log(`  Category breakdown of matches (72h):`);
      for (const [cat, cnt] of Object.entries(matchByCat).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat.padEnd(25)} ${cnt}`);
      }
    }

    // Show a sample of matching articles
    if (matchingArticles72.length > 0) {
      console.log(`  Sample matching articles (up to 5):`);
      for (const m of matchingArticles72.slice(0, 5)) {
        console.log(`    [${m.category}] id=${m.id} | matched: ${m.matchedTags.join(', ')} | all tags: ${m.articleTags.join(', ')}`);
      }
    } else {
      console.log(`  *** NO MATCHING ARTICLES FOUND — CONTENT GAP! ***`);
    }
  }

  // ── 6. Overall interest_tags distribution (72h) ──
  console.log('\n' + '='.repeat(80));
  console.log('TOP 50 INTEREST TAGS IN LAST 72H');
  console.log('='.repeat(80));

  const tagFreq = {};
  for (const a of articles72h) {
    const artTags = a.interest_tags || [];
    const tagArray = Array.isArray(artTags) ? artTags : (typeof artTags === 'string' ? JSON.parse(artTags) : []);
    for (const t of tagArray) {
      const lt = (t || '').toLowerCase().trim();
      if (lt) tagFreq[lt] = (tagFreq[lt] || 0) + 1;
    }
  }
  const sortedTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags.slice(0, 50)) {
    console.log(`  ${tag.padEnd(35)} ${String(count).padStart(5)}`);
  }

  // ── 7. Articles with NULL or empty interest_tags ──
  console.log('\n' + '─'.repeat(60));
  console.log('ARTICLES WITH NULL/EMPTY INTEREST TAGS');
  console.log('─'.repeat(60));

  const nullTags72 = articles72h.filter(a => {
    const tags = a.interest_tags;
    return !tags || (Array.isArray(tags) && tags.length === 0);
  });
  const nullTagsAll = allArticles.filter(a => {
    const tags = a.interest_tags;
    return !tags || (Array.isArray(tags) && tags.length === 0);
  });

  console.log(`  All time: ${nullTagsAll.length} / ${allArticles.length} (${(100 * nullTagsAll.length / allArticles.length).toFixed(1)}%)`);
  console.log(`  Last 72h: ${nullTags72.length} / ${articles72h.length} (${articles72h.length > 0 ? (100 * nullTags72.length / articles72h.length).toFixed(1) : 'N/A'}%)`);

  // ── 8. Summary Verdict ──
  console.log('\n' + '='.repeat(80));
  console.log('VERDICT: CONTENT GAP vs ALGORITHM PROBLEM');
  console.log('='.repeat(80));

  const verdicts = [];
  for (const [topicName, { tags }] of Object.entries(personaTagSets)) {
    let matchCount = 0;
    for (const a of articles72h) {
      const artTags = a.interest_tags || [];
      const tagArray = Array.isArray(artTags) ? artTags : (typeof artTags === 'string' ? JSON.parse(artTags) : []);
      const lowerTags = tagArray.map(t => (t || '').toLowerCase());
      const matched = tags.some(searchTag =>
        lowerTags.some(artTag => artTag.includes(searchTag) || searchTag.includes(artTag))
      );
      if (matched) matchCount++;
    }

    let verdict;
    if (matchCount === 0) {
      verdict = 'CONTENT GAP — Zero articles. Need to add RSS sources.';
    } else if (matchCount <= 3) {
      verdict = `SEVERE CONTENT GAP — Only ${matchCount} articles. Needs more sources.`;
    } else if (matchCount <= 10) {
      verdict = `MODERATE CONTENT GAP — ${matchCount} articles. Algorithm should cope, but barely.`;
    } else {
      verdict = `CONTENT EXISTS (${matchCount} articles) — Problem is likely ALGORITHM.`;
    }

    console.log(`  ${topicName.padEnd(35)} ${verdict}`);
    verdicts.push({ topic: topicName, count: matchCount, verdict });
  }

  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
