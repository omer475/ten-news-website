"""Illustrated 'Today in History' — Gemini-generated art for each event.
ONE art style per day (deterministic), rotating through 20 distinct styles so
the module looks fresh daily but internally consistent. Images are square,
text-free, stored in the public `history-images` Supabase bucket."""
import os
import re
import base64
import requests
from datetime import date, datetime, timezone

# 16 distinct illustration styles, curated by a visual-QA panel that VIEWED a
# sample of each (cut 4 for being generic/juvenile/duplicative; 8 reworked for
# thumbnail legibility). Hero tier: Stained Glass, Woodblock, Art Deco,
# Mid-Century. One style is chosen per day, rotating evenly.
HISTORY_STYLES = [
    {"name": "Vintage Engraving",
     "prompt": "a detailed vintage pen-and-ink engraving with fine cross-hatching and sepia tones, antique encyclopedia illustration style, warm aged paper"},
    {"name": "Single-Line Art",
     "prompt": "bold minimalist single-color line art in ONE deep navy stroke on a warm cream background; thick confident continuous contour lines, the subject large and centered, elegant but high-contrast"},
    {"name": "Caricature",
     "prompt": "a witty hand-drawn ink-and-watercolor caricature with charmingly exaggerated proportions, expressive and funny; NO circular frame, the subject large and bold filling the frame, simplified clean linework"},
    {"name": "Watercolor",
     "prompt": "a soft watercolor painting with gentle washes and loose brushwork; a strong dark subject silhouette against a warm richly-coloured sky for contrast, no painted border, the subject large and central"},
    {"name": "Art Deco Poster",
     "prompt": "an elegant Art Deco poster in 1920s style, bold geometric shapes, gold teal and cream palette, symmetrical sleek composition, luxurious"},
    {"name": "Pop Art Comic",
     "prompt": "a bold pop-art comic illustration with Ben-Day halftone dots, thick black outlines and high-contrast period-credible colors; NO speech bubbles, NO onomatopoeia, dynamic and punchy"},
    {"name": "Paper Cut Collage",
     "prompt": "a layered paper-cut collage of bold simple stacked shapes casting soft drop shadows, tactile craft texture; a large high-contrast central subject, uncluttered composition"},
    {"name": "Flat Vector",
     "prompt": "a premium flat-vector illustration with subtle paper grain and soft depth, a confident modern palette with a warm gold or red accent against teal, a large clear central subject"},
    {"name": "Oil Painting",
     "prompt": "a dramatic classical oil painting with rich impasto brushstrokes, deep chiaroscuro lighting, museum old-master style, moody and grand"},
    {"name": "Risograph",
     "prompt": "a risograph print with two or three overprinted spot colors (pink, blue, yellow), grainy texture, slight misregistration, retro zine aesthetic"},
    {"name": "Stained Glass",
     "prompt": "a glowing stained-glass window illustration with black leaded outlines separating panes of luminous jewel-toned glass, radiant backlight"},
    {"name": "Charcoal Sketch",
     "prompt": "an expressive monochrome charcoal sketch with dark bold smudged strokes and a mid-gray ground wash for contrast, dramatic black-and-white, the subject strong and unmistakable"},
    {"name": "Isometric Diorama",
     "prompt": "a charming isometric miniature diorama, a tiny highly-detailed 3D scene on a small floating tilted base, soft clay-render look, cute and precise"},
    {"name": "Woodblock Print",
     "prompt": "a Japanese ukiyo-e woodblock print, flat areas of muted color with bold outlines, visible wood grain texture, elegant traditional composition"},
    {"name": "Cyanotype Blueprint",
     "prompt": "a cyanotype blueprint with BOLD thick crisp white line-work on a deep Prussian-blue background, a large clear central subject, high-contrast, no fine noisy detail"},
    {"name": "Mid-Century Poster",
     "prompt": "a mid-century-modern travel poster in flat matte gouache, retro 1950s palette of mustard teal and coral, simplified bold shapes, nostalgic"},
]

_IMG_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash-image:generateContent?key={key}")


def pick_daily_style(d: date = None):
    """Deterministic style for a given date — advances one per day, cycling
    through all 20 so each day differs and every style is used evenly."""
    d = d or datetime.now(timezone.utc).date()
    idx = d.toordinal() % len(HISTORY_STYLES)
    return idx, HISTORY_STYLES[idx]


def generate_history_image(event_text: str, style_prompt: str, api_key: str):
    """Generate one square, text-free illustration for a history event in the
    given style. Returns PNG bytes or None."""
    prompt = (
        f"A tasteful, respectful, non-graphic editorial illustration "
        f"commemorating this historical event: {event_text}. "
        f"Art style: {style_prompt}. "
        f"Depict it symbolically and evocatively — focus on iconic places, "
        f"objects, landmarks or symbols rather than violence or suffering. "
        f"Square 1:1 composition. The single main subject must be LARGE and "
        f"high-contrast, filling 60-70% of the frame and instantly readable "
        f"even as a small thumbnail — avoid thin faint lines, washed-out low "
        f"contrast, busy clutter, and decorative borders or frames that waste "
        f"space. "
        f"ABSOLUTELY NO text, no words, no letters, no numbers, no captions, "
        f"no signage, and no written labels anywhere in the image."
    )
    for attempt in range(2):
        try:
            r = requests.post(
                _IMG_URL.format(key=api_key),
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=120,
            )
            if r.status_code == 429:
                continue
            r.raise_for_status()
            cands = r.json().get('candidates') or []
            if not cands:
                print(f"   ⚠️ [history-img] no candidates (blocked?) attempt {attempt + 1}")
                continue
            content = cands[0].get('content')
            if not content:
                print(f"   ⚠️ [history-img] blocked ({cands[0].get('finishReason')}) attempt {attempt + 1}")
                continue
            for p in content.get('parts', []):
                if 'inlineData' in p:
                    return base64.b64decode(p['inlineData']['data'])
        except Exception as e:
            print(f"   ⚠️ [history-img] gen attempt {attempt + 1} failed: {e}")
    return None


def _supabase_base_url(supabase):
    """Resolve the Supabase project URL robustly. Cloud Run sets SUPABASE_URL
    (NOT NEXT_PUBLIC_SUPABASE_URL), so the old single-env lookup produced a
    RELATIVE, broken image URL in production. Try both envs, then the live
    client's own URL, then the known project URL as a last resort."""
    base = (os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
            or os.environ.get('SUPABASE_URL')
            or getattr(supabase, 'supabase_url', None)
            or getattr(supabase, 'rest_url', None)
            or 'https://sdhdylsfngiybvoltoks.supabase.co')
    base = str(base).rstrip('/')
    # strip a trailing /rest/v1 if the client url included it
    base = re.sub(r'/rest/v1$', '', base)
    return base


def upload_history_image(supabase, img_bytes: bytes, path: str):
    """Upload PNG to the public history-images bucket; return public URL."""
    try:
        supabase.storage.from_('history-images').upload(
            path, img_bytes,
            {"content-type": "image/png", "upsert": "true"})
        base = _supabase_base_url(supabase)
        return f"{base}/storage/v1/object/public/history-images/{path}"
    except Exception as e:
        print(f"   ⚠️ [history-img] upload failed for {path}: {e}")
        return None


def generate_history_images(supabase, history_rows, api_key, d: date = None):
    """For each [year, text] history row, generate an illustration in the day's
    style and return {style, style_name, rows:[[year, text, image_url], ...]}.
    Non-fatal: a failed image just yields a null url for that row."""
    d = d or datetime.now(timezone.utc).date()
    idx, style = pick_daily_style(d)
    date_key = d.isoformat()
    out_rows = []
    for i, row in enumerate(history_rows):
        year, text = row[0], row[1]
        url = None
        img = generate_history_image(f"In {year}: {text}", style['prompt'], api_key)
        if img:
            url = upload_history_image(supabase, img, f"{date_key}/{i}.png")
        out_rows.append([year, text, url])
    print(f"   🎨 [history-img] {style['name']} — "
          f"{sum(1 for r in out_rows if r[2])}/{len(out_rows)} images")
    return {"style": style['name'], "style_index": idx, "rows": out_rows}
