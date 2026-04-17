const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sdhdylsfngiybvoltoks.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const now = new Date();
  const h72 = new Date(now - 72 * 60 * 60 * 1000).toISOString();

  // Fetch all articles from last 72h
  let articles72h = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, category, published_at, interest_tags')
      .gte('published_at', h72)
      .range(from, from + pageSize - 1);
    if (error) { console.error('Error:', error); return; }
    if (!data || data.length === 0) break;
    articles72h = articles72h.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log('='.repeat(80));
  console.log('DEEP DIVE: Gaming tag false positives in 72h window');
  console.log('='.repeat(80));

  // The Gaming search showed 1598 matches but 1129 in Sports category
  // Let's check WHY — "esports" substring matching "sports"?

  const gamingTags = ['gaming', 'video games', 'esports', 'playstation', 'xbox', 'nintendo', 'steam'];

  // Count EXACT matches per tag
  const exactMatchCounts = {};
  const substringMatchCounts = {};

  for (const searchTag of gamingTags) {
    exactMatchCounts[searchTag] = 0;
    substringMatchCounts[searchTag] = 0;
  }

  for (const a of articles72h) {
    const artTags = a.interest_tags || [];
    const tagArray = Array.isArray(artTags) ? artTags : [];
    const lowerTags = tagArray.map(t => (t || '').toLowerCase());

    for (const searchTag of gamingTags) {
      // Exact match
      if (lowerTags.includes(searchTag)) {
        exactMatchCounts[searchTag]++;
      }
      // Substring match (what we used before)
      if (lowerTags.some(artTag => artTag.includes(searchTag) || searchTag.includes(artTag))) {
        substringMatchCounts[searchTag]++;
      }
    }
  }

  console.log('\nTag-by-tag breakdown (Gaming):');
  console.log('  Tag                    Exact    Substring');
  for (const tag of gamingTags) {
    console.log(`  ${tag.padEnd(25)} ${String(exactMatchCounts[tag]).padStart(5)}    ${String(substringMatchCounts[tag]).padStart(5)}`);
  }

  // Now show the REAL Gaming counts with exact matching only
  console.log('\n' + '='.repeat(80));
  console.log('CORRECTED ANALYSIS: Using EXACT tag matching (last 72h)');
  console.log('='.repeat(80));

  const personaTagSets = {
    'Soccer/Football (Marco)': ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'serie a', 'mls'],
    'Gaming (Devon)': ['gaming', 'video games', 'esports', 'playstation', 'xbox', 'nintendo', 'steam'],
    'Fashion (Camille/Zara)': ['fashion', 'clothing', 'designer', 'runway', 'vogue', 'streetwear', 'sneakers'],
    'Medical/Health (Jennifer)': ['medical', 'clinical trial', 'pharma', 'oncology', 'biotech', 'fda'],
    'Film/Entertainment (Sophie)': ['movies', 'film', 'cinema', 'box office', 'oscar', 'hollywood', 'netflix', 'streaming'],
    'Climate/Environment (Lars/Lena)': ['climate', 'environment', 'carbon', 'emissions', 'renewable'],
  };

  for (const [topic, tags] of Object.entries(personaTagSets)) {
    // EXACT matching only
    let exactCount = 0;
    let substrCount = 0;
    const exactMatches = [];

    for (const a of articles72h) {
      const artTags = a.interest_tags || [];
      const tagArray = Array.isArray(artTags) ? artTags : [];
      const lowerTags = tagArray.map(t => (t || '').toLowerCase());

      const hasExact = tags.some(st => lowerTags.includes(st));
      const hasSubstr = tags.some(st => lowerTags.some(at => at.includes(st) || st.includes(at)));

      if (hasExact) {
        exactCount++;
        exactMatches.push({ id: a.id, category: a.category, tags: tagArray });
      }
      if (hasSubstr) substrCount++;
    }

    const falsePosCount = substrCount - exactCount;
    const catBreakdown = {};
    for (const m of exactMatches) {
      catBreakdown[m.category || 'NULL'] = (catBreakdown[m.category || 'NULL'] || 0) + 1;
    }

    console.log(`\n${topic}:`);
    console.log(`  Exact matches: ${exactCount}   |   Substring matches: ${substrCount}   |   False positives: ${falsePosCount}`);
    if (Object.keys(catBreakdown).length > 0) {
      console.log(`  Category breakdown (exact):`);
      for (const [cat, cnt] of Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat.padEnd(25)} ${cnt}`);
      }
    }
  }

  // Check what "biotech" is actually tagging (suspected false positives for Medical)
  console.log('\n' + '='.repeat(80));
  console.log('DEEP DIVE: "biotech" tag — what articles is it actually on?');
  console.log('='.repeat(80));

  const biotechArticles = articles72h.filter(a => {
    const tagArray = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    return tagArray.map(t => (t||'').toLowerCase()).includes('biotech');
  });
  console.log(`\nArticles with exact "biotech" tag: ${biotechArticles.length}`);
  for (const a of biotechArticles.slice(0, 10)) {
    console.log(`  [${a.category}] id=${a.id} tags: ${(a.interest_tags||[]).join(', ')}`);
  }

  // Check what "football" catches that isn't soccer
  console.log('\n' + '='.repeat(80));
  console.log('DEEP DIVE: "football" tag — soccer vs american football');
  console.log('='.repeat(80));

  const footballArticles = articles72h.filter(a => {
    const tagArray = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    return tagArray.map(t => (t||'').toLowerCase()).some(t => t.includes('football'));
  });
  const footballVariants = {};
  for (const a of footballArticles) {
    const tagArray = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    for (const t of tagArray) {
      if ((t||'').toLowerCase().includes('football')) {
        footballVariants[t.toLowerCase()] = (footballVariants[t.toLowerCase()] || 0) + 1;
      }
    }
  }
  console.log(`\nFootball tag variants:`);
  for (const [v, c] of Object.entries(footballVariants).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${v.padEnd(35)} ${c}`);
  }

  // Check what Entertainment-categorized articles have for tags (to see if film/gaming content is there)
  console.log('\n' + '='.repeat(80));
  console.log('ENTERTAINMENT CATEGORY: Top 30 tags');
  console.log('='.repeat(80));

  const entArticles = articles72h.filter(a => a.category === 'Entertainment');
  const entTagFreq = {};
  for (const a of entArticles) {
    const tagArray = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    for (const t of tagArray) {
      const lt = (t||'').toLowerCase().trim();
      if (lt) entTagFreq[lt] = (entTagFreq[lt] || 0) + 1;
    }
  }
  for (const [tag, count] of Object.entries(entTagFreq).sort((a,b) => b[1]-a[1]).slice(0, 30)) {
    console.log(`  ${tag.padEnd(35)} ${count}`);
  }

  // The actual Gaming category articles
  console.log('\n' + '='.repeat(80));
  console.log('GAMING CATEGORY: All articles and their tags');
  console.log('='.repeat(80));

  const gamingCatArticles = articles72h.filter(a => a.category === 'Gaming');
  console.log(`Gaming category articles (72h): ${gamingCatArticles.length}`);
  for (const a of gamingCatArticles) {
    console.log(`  id=${a.id} tags: ${(a.interest_tags||[]).join(', ')}`);
  }

  // Fashion category
  console.log('\n' + '='.repeat(80));
  console.log('FASHION CATEGORY: All articles and their tags');
  console.log('='.repeat(80));

  const fashionCatArticles = articles72h.filter(a => a.category === 'Fashion');
  console.log(`Fashion category articles (72h): ${fashionCatArticles.length}`);
  for (const a of fashionCatArticles.slice(0, 15)) {
    console.log(`  id=${a.id} tags: ${(a.interest_tags||[]).join(', ')}`);
  }

  // Lifestyle category
  console.log('\n' + '='.repeat(80));
  console.log('LIFESTYLE CATEGORY: Top 30 tags');
  console.log('='.repeat(80));

  const lifeArticles = articles72h.filter(a => a.category === 'Lifestyle');
  const lifeTagFreq = {};
  for (const a of lifeArticles) {
    const tagArray = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    for (const t of tagArray) {
      const lt = (t||'').toLowerCase().trim();
      if (lt) lifeTagFreq[lt] = (lifeTagFreq[lt] || 0) + 1;
    }
  }
  for (const [tag, count] of Object.entries(lifeTagFreq).sort((a,b) => b[1]-a[1]).slice(0, 30)) {
    console.log(`  ${tag.padEnd(35)} ${count}`);
  }
}

main().catch(console.error);
