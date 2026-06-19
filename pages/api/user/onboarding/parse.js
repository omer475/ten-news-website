// POST /api/user/onboarding/parse  { text }
// Turns a free-text "what do you want to keep up with?" answer into structured
// onboarding signals via Gemini. Used both live (debounced, for the "we heard: …"
// confirm-chips) and on final submit. The LLM is an EXTRACTOR, not a chatter —
// strict JSON, intersected against our canonical 34 topic codes (drop
// hallucinations). Always additive + best-effort; never blocks onboarding.

import { TOPICS } from '../../../../lib/personalization';

const VALID_TOPICS = TOPICS.map((t) => t.code);
const GEMINI_MODEL = 'gemini-2.5-flash';

function buildPrompt(text) {
  return `You extract structured news-personalization signals from a user's free-text answer to "What do you actually want to keep up with?". Return ONLY JSON.

VALID TOPIC CODES (use ONLY these, ranked by confidence): ${VALID_TOPICS.join(', ')}

USER TEXT:
"""${(text || '').slice(0, 600)}"""

Return JSON exactly:
{
  "topic_codes": [up to 8 codes from the VALID list that match their interests],
  "entities": [{"name": "...", "type": "person|org|team|place|product", "sentiment": "pos|neg"}],  // up to 10, specific things they named (a team, company, person, place)
  "interest_tags": [up to 8 short free-form tags capturing granularity the codes miss, lowercase],
  "avoid_topics": [codes from the VALID list OR short tags they say they DON'T want],
  "tone_prefs": {"depth": 1-5 or null, "seriousness": 1-5 or null},
  "summary_line": "one warm, specific sentence reflecting them back, e.g. 'Got it — you're into AI breakthroughs, F1, and Türkiye.'"
}
Only include topic_codes you are confident about. If the text is empty or meaningless, return empty arrays and a null summary_line.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return res.status(200).json({ topic_codes: [], entities: [], interest_tags: [], avoid_topics: [], tone_prefs: {}, summary_line: null });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ topic_codes: [], entities: [], interest_tags: [], avoid_topics: [], tone_prefs: {}, summary_line: null });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text) }] }],
        generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

    // guardrails: intersect topics with the valid 34, cap entities, sanitize
    const topic_codes = [...new Set((parsed.topic_codes || []).filter((c) => VALID_TOPICS.includes(c)))].slice(0, 8);
    const entities = (Array.isArray(parsed.entities) ? parsed.entities : [])
      .filter((e) => e && e.name).slice(0, 10)
      .map((e) => ({ name: String(e.name).slice(0, 60), type: e.type || 'org', sentiment: e.sentiment === 'neg' ? 'neg' : 'pos' }));
    const interest_tags = [...new Set((parsed.interest_tags || []).map((t) => String(t).toLowerCase().slice(0, 40)))].slice(0, 8);
    const avoid_topics = [...new Set((parsed.avoid_topics || []).map((t) => String(t).toLowerCase().slice(0, 40)))].slice(0, 8);
    const tone_prefs = (parsed.tone_prefs && typeof parsed.tone_prefs === 'object') ? parsed.tone_prefs : {};
    const summary_line = parsed.summary_line ? String(parsed.summary_line).slice(0, 160) : null;

    return res.status(200).json({ topic_codes, entities, interest_tags, avoid_topics, tone_prefs, summary_line });
  } catch (e) {
    // graceful: never block onboarding on a parse failure
    return res.status(200).json({ topic_codes: [], entities: [], interest_tags: [], avoid_topics: [], tone_prefs: {}, summary_line: null, _error: e?.message });
  }
}
