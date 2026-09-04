/**
 * Same-origin proxy for illustration files, so "Save poster" can composite the
 * artwork onto a canvas without tainting it.
 *
 * Only serves images from the configured Supabase Storage host.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export default async function handler(req, res) {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  if (!raw || !SUPABASE_URL) {
    res.status(400).json({ error: 'missing url' });
    return;
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ error: 'bad url' });
    return;
  }

  const allowed = new URL(SUPABASE_URL).host;
  if (target.protocol !== 'https:' || target.host !== allowed) {
    res.status(403).json({ error: 'host not allowed' });
    return;
  }

  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const type = upstream.headers.get('content-type') || 'image/png';
    if (!type.startsWith('image/')) {
      res.status(415).json({ error: 'not an image' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(buf);
  } catch {
    res.status(502).json({ error: 'upstream failed' });
  }
}
