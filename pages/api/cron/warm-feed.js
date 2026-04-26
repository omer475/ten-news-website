// Vercel cron — keeps the heavy feed handler warm to eliminate cold-start
// timeouts. Runs every 5 minutes; cost is ~288 invocations/day.
//
// Without this, the feed function sits idle for >5 min between user
// sessions and Vercel evicts the lambda. Next user request triggers a
// 10-20s cold start on top of the normal 10-15s response = 25-30s total,
// hitting the iOS URLSession timeout and surfacing "Unable to load news".
//
// This is NOT a substitute for the proper Phase 11 fix (precomputed
// user feature snapshot). It's a $0 stopgap that fixes the symptom
// while we ship the structural change.
//
// TikTok / ByteDance keep their inference paths hot via internal traffic
// generators; production recommenders never sit cold. Same idea here.

export default async function handler(req, res) {
  // Vercel cron sends a Bearer token (CRON_SECRET) when invoking;
  // accept either that or no auth (public endpoint is also fine —
  // the work is read-only and the response is small).
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const start = Date.now();
  try {
    // Hit the feed endpoint with a synthetic request that mirrors what an
    // anonymous app open looks like. Forces the function to keep its
    // imports cached and (more importantly) keeps the Vercel lambda hot.
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.tennews.ai'}/api/feed/main?warmer=1&limit=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'TenNews-Warmer/1.0' } });
    const elapsed = Date.now() - start;
    return res.status(200).json({
      ok: true,
      elapsed_ms: elapsed,
      feed_status: r.status,
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      elapsed_ms: Date.now() - start,
      error: e?.message || String(e),
    });
  }
}
