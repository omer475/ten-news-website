// POST /api/user/onboarding/suggest  { topic, country }
// Returns AI-generated, country-tailored drill-down options for one topic — a MIX
// of angles/themes + specific names + an "All X news" catch-all, grouped. Live
// Gemini, but cached in onboarding_suggestion_cache by (topic, country) since the
// options depend only on the topic+country, not the individual — so the first
// "football + Türkiye" user triggers the AI and everyone after reuses it instantly.
// Never throws; returns { groups: [] } on any failure so onboarding never blocks.

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

// sanitize the LLM output into {groups:[{label, items:[...]}]}
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const topic = String((req.body && req.body.topic) || '').toLowerCase().trim();
  const country = String((req.body && req.body.country) || '').toLowerCase().trim();
  if (!topic || !VALID_TOPICS.has(topic)) return res.status(200).json({ groups: [] });

  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // 1) cache lookup (topic + country)
  if (supabase) {
    try {
      const { data } = await supabase
        .from('onboarding_suggestion_cache')
        .select('payload, created_at')
        .eq('topic', topic).eq('country', country || '_')
        .maybeSingle();
      if (data && data.payload) {
        const ageDays = (Date.now() - new Date(data.created_at).getTime()) / 86400000;
        if (ageDays < CACHE_TTL_DAYS) return res.status(200).json({ ...data.payload, _cached: true });
      }
    } catch (_) {}
  }

  // 2) live Gemini
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ groups: [] });
  let out = { groups: [] };
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
    if (r.ok) {
      const d = await r.json();
      const t = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      out = clean(parseJson(t));
    }
  } catch (_) { out = { groups: [] }; }

  // 3) store in cache (best-effort) only if we got real content
  if (supabase && out.groups.length) {
    try {
      await supabase.from('onboarding_suggestion_cache')
        .upsert({ topic, country: country || '_', payload: out, created_at: new Date().toISOString() }, { onConflict: 'topic,country' });
    } catch (_) {}
  }

  return res.status(200).json(out);
}
