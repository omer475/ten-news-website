// POST /api/user/onboarding/reveal  { profile: { name?, country, topics[], subtopics[], themes[] } }
// Returns { text } — a short, warm, AI-written personal note for the final
// onboarding screen (replaces the summary table). Live Gemini, per-user. Never
// throws; returns a templated fallback line if the LLM is slow/unavailable.

const GEMINI_MODEL = 'gemini-2.5-flash';

function fallback(p) {
  const lead = (p.subtopics || p.topics || []).slice(0, 3).join(', ');
  return lead
    ? `Got it — I'll lead with ${lead} and the stories that matter most to you. Your feed is ready.`
    : `Your personalized feed is ready.`;
}

function buildPrompt(p) {
  return `Write a SHORT, warm, personal note from a news app to a user it just got to know during signup. 3-4 sentences. First person ("I'll..."), use their name once at the start if provided. Lead with their MAIN interests, then say you'll also slip in the related/secondary things they like, and weave in one adjacent angle that follows naturally from their interests (a science, tech-hardware, or business angle). Confident and human, NOT salesy, NO emoji, NO lists — flowing sentences. End on a line that hands off to their feed.
USER: ${JSON.stringify(p).slice(0, 1200)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const p = (req.body && req.body.profile) || {};
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ text: fallback(p) });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(p) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }).finally(() => clearTimeout(timer));
    if (r.ok) {
      const d = await r.json();
      const t = (d?.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '').trim();
      if (t) return res.status(200).json({ text: t.slice(0, 600) });
    }
  } catch (_) {}
  return res.status(200).json({ text: fallback(p) });
}
