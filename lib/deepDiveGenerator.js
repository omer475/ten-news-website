// "The Quiet Deep Dive" generator.
//
// Given an anchor story and every source article in its semantic cluster, write
// ONE deeply-researched, narrative long-form piece — the kind of feature people
// actually want to read, not a bulleted "what to watch" box. It synthesises
// across all the day's coverage of the story into context, background, the
// competing angles, and clear implications, in a flowing magazine voice.
//
// Model: Gemini 2.5 Pro (quality matters more than cost for a once/twice-daily
// signature piece). Output is structured JSON: headline, dek, ordered sections.

const GEMINI_MODEL = 'gemini-2.5-pro';

function stripMd(s) {
  return typeof s === 'string' ? s.replace(/\*\*/g, '').trim() : '';
}

function parseBullets(b) {
  if (Array.isArray(b)) return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return []; } }
  return [];
}

// Build the source corpus block from the cluster's articles.
function buildSourcesBlock(articles) {
  return articles.map((a, i) => {
    const bullets = parseBullets(a.summary_bullets_news).map(stripMd).filter(Boolean);
    const facts = parseBullets(a.details)
      .map((d) => (d && d.label ? `${stripMd(d.label)}: ${stripMd(d.value)}` : ''))
      .filter(Boolean);
    return [
      `### SOURCE ${i + 1}: ${stripMd(a.title_news || a.title || 'Untitled')}`,
      a.published_at || a.created_at ? `Date: ${(a.published_at || a.created_at)}` : '',
      a.category ? `Category: ${a.category}` : '',
      bullets.length ? `Key points:\n- ${bullets.join('\n- ')}` : '',
      facts.length ? `Facts:\n- ${facts.join('\n- ')}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function buildPrompt(anchor, sources) {
  const topic = stripMd(anchor.title_news || anchor.title || '');
  return `You are the lead feature writer for a premium news product. Your readers
get the rest of their news fast and light; this is the ONE story today that you
treat with exceptional depth. Write a deeply-researched, narrative long-form
piece about the story below, synthesising EVERYTHING in the provided sources.

THE STORY: ${topic}

Write it as a feature people genuinely want to read — flowing prose, a strong
narrative spine, concrete detail, and a clear human or strategic stakes. Do all
of the following, woven naturally into the narrative (do NOT label them as a
checklist or use a "what to watch" box):
- Open with a vivid, specific lede that earns the reader's attention.
- Give the full context and background a smart reader needs to understand why
  this matters now.
- Present the competing angles / perspectives fairly, including tensions and
  what's contested.
- Make the implications and what's genuinely at stake clear and concrete.
- Close with a resonant ending, not a summary.

Rules:
- Ground every claim in the SOURCES below. Do not invent facts, numbers, or
  quotes. If sources disagree, say so.
- CRITICAL: Do NOT invent concrete scenes, places, characters, dialogue, or
  sensory details (no "the mortar fire echoed across the glacier" unless the
  sources say so). Be vivid through sharp framing and real detail from the
  sources, never through fabricated scene-setting. A made-up specific is a
  factual error.
- No filler, no hedging clichés, no "in conclusion", no "only time will tell".
- British/American spelling either is fine; be consistent.
- Aim for 900–1500 words across 4–7 sections.

Return ONLY valid JSON (no markdown fence) matching exactly:
{
  "headline": "string — a sharp, specific headline (not clickbait)",
  "dek": "string — one-sentence standfirst that frames the piece",
  "sections": [ { "heading": "string — short section title", "body": "string — 1-4 paragraphs of prose, plain text" } ],
  "reading_time_min": number
}

SOURCES:
${sources}`;
}

// Call Gemini and return parsed JSON. Throws on hard failure.
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Gemini returned empty content');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // tolerate a stray code fence
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Gemini output not JSON');
    parsed = JSON.parse(m[0]);
  }
  return parsed;
}

function estimateReadingTime(sections) {
  const words = sections.reduce((n, s) => n + String(s.body || '').split(/\s+/).filter(Boolean).length, 0);
  return Math.max(2, Math.round(words / 200));
}

// Public: generate a deep dive from an anchor article + its cluster sources.
// Returns { headline, dek, sections, reading_time_min, model }.
export async function generateDeepDive(anchorArticle, clusterArticles) {
  const sources = buildSourcesBlock(clusterArticles?.length ? clusterArticles : [anchorArticle]);
  const prompt = buildPrompt(anchorArticle, sources);
  const out = await callGemini(prompt);

  const sections = Array.isArray(out.sections)
    ? out.sections
        .filter((s) => s && (s.body || s.heading))
        .map((s) => ({ heading: String(s.heading || '').trim(), body: String(s.body || '').trim() }))
    : [];
  if (!sections.length) throw new Error('generated deep dive had no sections');

  return {
    headline: String(out.headline || stripMd(anchorArticle.title_news) || 'Deep Dive').trim(),
    dek: String(out.dek || '').trim(),
    sections,
    reading_time_min: Number.isFinite(out.reading_time_min)
      ? Math.round(out.reading_time_min)
      : estimateReadingTime(sections),
    model: GEMINI_MODEL,
  };
}

export { GEMINI_MODEL };
