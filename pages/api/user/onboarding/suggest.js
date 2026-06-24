// POST /api/user/onboarding/suggest
//   single:  { topic, country }            → { groups: [...] }
//   BATCH:   { topics: [code,...], country } → { results: { <topic>: { groups:[...] }, ... } }
//
// Batch mode lets onboarding fetch the drill-down options for ALL chosen interests
// in ONE call (one loading state), then show them combined — instead of a separate
// spinner per interest. Options are AI-generated (live Gemini), country-tailored
// (angles + names + "All X news"), and cached in onboarding_suggestion_cache by
// (topic, country) so repeat combos are instant + cheap. Never throws.

import { createClient } from '@supabase/supabase-js';
import { TOPICS } from '../../../../lib/personalization';

const VALID_TOPICS = new Set(TOPICS.map((t) => t.code));
const GEMINI_MODEL = 'gemini-2.5-flash';
const CACHE_TTL_DAYS = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function buildPrompt(topic, country) {
  return `A user in ${country || 'their country'} follows "${topic}". Build the options they can tap to refine their news feed. Give a MIX of different KINDS of interest, not just specific names:
1) ANGLES / sub-themes people follow within this topic (e.g. for AI: "AI breakthroughs", "AI stocks & business", "AI in healthcare", "AI policy & safety"; for football: "Transfers & rumors", "Match results & standings").
2) SPECIFIC NAMES — the recognizable companies / people / teams / products / models, tailored to their country (include local + global).
3) ALWAYS include one broad catch-all item: "All ${topic} news".
Group them with short labels. Keep recognizable and tight.
Return ONLY valid JSON (no trailing commas): { "groups": [ { "label": "<short label>", "items": ["<name>", ...] } ] }
~4-5 groups, ~3-5 items each, ~18 total max. Respond in ENGLISH only (Latin script). Common short names people know.`;
}

function parseJson(t) {
  for (const c of [t, (t.match(/\{[\s\S]*\}/) || [])[0], (t || '').replace(/,\s*([\]}])/g, '$1')]) {
    if (!c) continue;
    try { return JSON.parse(c); } catch (_) {}
  }
  return null;
}

function clean(j) {
  if (!j || !Array.isArray(j.groups)) return { groups: [] };
  const groups = j.groups
    .filter((g) => g && g.label && Array.isArray(g.items))
    .slice(0, 6)
    .map((g) => ({
      label: String(g.label).slice(0, 40),
      items: [...new Set(g.items.map((i) => String(i).slice(0, 50)).filter(Boolean))].slice(0, 6),
    }))
    .filter((g) => g.items.length);
  return { groups };
}

async function geminiSuggest(topic, country) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { groups: [] };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(topic, country) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 4096 },
      }),
    }).finally(() => clearTimeout(timer));
    if (!r.ok) return { groups: [] };
    const d = await r.json();
    const t = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return clean(parseJson(t));
  } catch (_) { return { groups: [] }; }
}

// Resolve one topic's options: cache → Gemini → store. Returns {groups}.
async function getSuggestions(topic, country, supabase) {
  const ckey = country || '_';
  if (supabase) {
    try {
      const { data } = await supabase
        .from('onboarding_suggestion_cache')
        .select('payload, created_at')
        .eq('topic', topic).eq('country', ckey).maybeSingle();
      if (data && data.payload) {
        const ageDays = (Date.now() - new Date(data.created_at).getTime()) / 86400000;
        if (ageDays < CACHE_TTL_DAYS) return data.payload;
      }
    } catch (_) {}
  }
  const out = await geminiSuggest(topic, country);
  if (supabase && out.groups.length) {
    try {
      await supabase.from('onboarding_suggestion_cache')
        .upsert({ topic, country: ckey, payload: out, created_at: new Date().toISOString() }, { onConflict: 'topic,country' });
    } catch (_) {}
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const country = String(body.country || '').toLowerCase().trim();
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // BATCH mode — all chosen interests in one call (one loading state)
  if (Array.isArray(body.topics)) {
    const topics = [...new Set(body.topics.map((t) => String(t).toLowerCase().trim()))]
      .filter((t) => VALID_TOPICS.has(t)).slice(0, 12);
    const settled = await Promise.all(topics.map((t) => getSuggestions(t, country, supabase)));
    const results = {};
    topics.forEach((t, i) => { results[t] = settled[i] || { groups: [] }; });
    return res.status(200).json({ results });
  }

  // single-topic mode (back-compat)
  const topic = String(body.topic || '').toLowerCase().trim();
  if (!topic || !VALID_TOPICS.has(topic)) return res.status(200).json({ groups: [] });
  const out = await getSuggestions(topic, country, supabase);
  return res.status(200).json(out);
}
