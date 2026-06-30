"""
edition_illustrations.py — §6.4 illustration asset pipeline.

For each NON-SERIOUS item the editor marked with an illustration scene, generate a
3:2 black-pen-and-ink editorial caricature: off-white paper (#FAF8F2), a SINGLE
warm gold accent (#BD8736), simple background, generous negative space. Upload to a
public Supabase 'illustrations' bucket and write {asset_url, prompt, seed} onto the
item.

Consistency: Gemini 2.5 Flash Image has no LoRA and does not honor an explicit seed
through this endpoint, so the house-style levers we DO have are:
  1. a LOCKED master prompt + negative guidance (every call, identical), and
  2. a FIXED style-reference image passed as image conditioning on every daily
     generation (anchors line weight / accent / paper across days).
The seed is still stored per asset for bookkeeping/reproducibility intent.

Fail-soft: if a generation or upload fails, the item keeps its illustration object
but with asset_url=None — the web renders it as a text/no-image card (per the
contract). Nothing here can break the edition build.
"""

import os
import base64
import requests

IMAGE_MODEL = os.getenv('EDITION_IMAGE_MODEL', 'gemini-2.5-flash-image')
BUCKET = 'illustrations'
STYLE_REF_PATH = '_style/reference.png'   # fixed cross-day style anchor

# §6.4 LOCKED master prompt. {SCENE} is the only variable.
MASTER_PROMPT = """\
Editorial caricature, black pen-and-ink line drawing. One consistent medium-weight \
ink line with slight hand-wobble; cross-hatching for shadow. Funny and exaggerated, \
warm and characterful — like a great newspaper op-ed illustration. Off-white paper \
background (#FAF8F2). The ONLY color is a single warm gold accent (#BD8736), used \
sparingly on one focal element. Simple background, generous negative space. 3:2 \
landscape.

Avoid: photo, photorealistic, 3d render, painting, watercolor, gradient, full color, \
neon, busy background, multiple accent colors, text watermark, blurry, low-contrast.

SCENE: {SCENE}"""


def build_prompt(scene):
    return MASTER_PROMPT.replace('{SCENE}', (scene or '').strip())


# ----------------------------------------------------------------------------
# Generation
# ----------------------------------------------------------------------------

def generate_illustration(api_key, scene, *, style_ref_b64=None, style_ref_mime='image/png',
                          timeout=120):
    """Return (base64_png, mime) for the scene, or (None, None) on failure.

    If a style-reference image is provided, it is passed as image conditioning so
    every day shares one house style.
    """
    parts = []
    if style_ref_b64:
        parts.append({'inlineData': {'mimeType': style_ref_mime, 'data': style_ref_b64}})
        parts.append({'text': 'Match the house style of the reference image exactly '
                              '(line weight, the single gold accent, off-white paper). '
                              'New scene below.'})
    parts.append({'text': build_prompt(scene)})

    try:
        resp = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{IMAGE_MODEL}:generateContent',
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            json={
                'contents': [{'parts': parts}],
                'generationConfig': {
                    'responseModalities': ['IMAGE'],
                    'imageConfig': {'aspectRatio': '3:2'},
                },
            },
            timeout=timeout,
        )
        if resp.status_code != 200:
            print(f"    ❌ illustration API error: {resp.status_code} - {resp.text[:200]}")
            return None, None
        data = resp.json()
        for part in data.get('candidates', [{}])[0].get('content', {}).get('parts', []):
            if 'inlineData' in part:
                return part['inlineData']['data'], part['inlineData'].get('mimeType', 'image/png')
        print("    ❌ no image in illustration response")
        return None, None
    except Exception as e:
        print(f"    ❌ illustration generation error: {e}")
        return None, None


# ----------------------------------------------------------------------------
# Storage
# ----------------------------------------------------------------------------

def _ensure_bucket(supabase):
    try:
        supabase.storage.create_bucket(id=BUCKET, options={'public': True})
    except Exception:
        pass  # already exists


def upload_illustration(supabase, b64, mime, storage_path):
    """Upload base64 image; return public URL or None."""
    try:
        _ensure_bucket(supabase)
        image_bytes = base64.b64decode(b64)
        try:
            supabase.storage.from_(BUCKET).remove([storage_path])
        except Exception:
            pass
        supabase.storage.from_(BUCKET).upload(
            path=storage_path, file=image_bytes, file_options={'content-type': mime})
        return supabase.storage.from_(BUCKET).get_public_url(storage_path)
    except Exception as e:
        print(f"    ❌ illustration upload error: {e}")
        return None


def load_style_reference(supabase):
    """Return (b64, mime) of the fixed style reference, or (None, None)."""
    try:
        raw = supabase.storage.from_(BUCKET).download(STYLE_REF_PATH)
        if raw:
            return base64.b64encode(raw).decode(), 'image/png'
    except Exception:
        pass
    return None, None


def promote_style_reference(supabase, b64):
    """Pin the given image as the cross-day style anchor (idempotent)."""
    url = upload_illustration(supabase, b64, 'image/png', STYLE_REF_PATH)
    if url:
        print(f"  📌 style reference pinned: {STYLE_REF_PATH}")
    return url


# ----------------------------------------------------------------------------
# Attach to an edition payload
# ----------------------------------------------------------------------------

def attach_illustrations(supabase, api_key, payload):
    """Generate + upload an asset for every item that has an illustration scene.

    Mutates payload in place and returns it. Fail-soft per item. The first
    successful illustration auto-pins as the style reference if none exists yet,
    so future days inherit the house style automatically.
    """
    date = payload.get('edition_date', 'edition')
    items = payload.get('items', [])
    targets = [(i, it) for i, it in enumerate(items)
               if isinstance(it.get('illustration'), dict)
               and it['illustration'].get('scene')
               and not it['illustration'].get('asset_url')]
    if not targets:
        print("  • no illustrations to generate")
        return payload

    style_b64, style_mime = load_style_reference(supabase)
    if style_b64:
        print("  • using pinned style reference")

    print(f"  🎨 generating {len(targets)} illustrations for {date}")
    ok = 0
    for i, it in targets:
        illo = it['illustration']
        scene = illo['scene']
        seed = illo.get('seed')
        b64, mime = generate_illustration(api_key, scene, style_ref_b64=style_b64,
                                          style_ref_mime=style_mime or 'image/png')
        if not b64:
            print(f"    ⚠️ item {i}: generation failed — text/no-image fallback")
            illo['asset_url'] = None
            continue

        ext = 'png' if 'png' in (mime or '') else 'jpg'
        url = upload_illustration(supabase, b64, mime, f"{date}/{i}-{seed}.{ext}")
        illo['asset_url'] = url
        illo['prompt'] = build_prompt(scene)
        if url:
            ok += 1
            # Auto-pin the first good illustration as the style anchor.
            if not style_b64:
                promote_style_reference(supabase, b64)
                style_b64, style_mime = b64, 'image/png'
        else:
            print(f"    ⚠️ item {i}: upload failed — text/no-image fallback")

    print(f"  ✅ {ok}/{len(targets)} illustrations attached")
    return payload


# ----------------------------------------------------------------------------
# Seed reference generation (run ONCE to lock the style before going daily)
# ----------------------------------------------------------------------------

SEED_SCENES = [
    'A tiny stock-market bull tangled in its own ticker tape, one gold arrow shooting up',
    'A scientist peering into a comically large telescope, a single gold star at the end',
    'A weary marathon runner crossing a finish line made of a single gold ribbon',
    'A chef balancing an absurd tower of plates, one gold cherry on top',
    'A small robot reading a giant newspaper, a gold lightbulb over its head',
    'A cat knocking a gold coin off a very tall, very serious-looking ledger',
]


def generate_seed_references(supabase, api_key, n=4, pin_index=0):
    """Generate n style-reference candidates into _style/seed-*.png and pin one.

    Run this ONCE (e.g. `python edition_illustrations.py --seed`) to lock the
    house style before the first daily edition. Returns the list of URLs.
    """
    _ensure_bucket(supabase)
    urls = []
    for idx in range(min(n, len(SEED_SCENES))):
        scene = SEED_SCENES[idx]
        print(f"  🎨 seed reference {idx}: {scene[:50]}…")
        b64, mime = generate_illustration(api_key, scene)  # no conditioning — define the style
        if not b64:
            urls.append(None)
            continue
        url = upload_illustration(supabase, b64, mime, f"_style/seed-{idx}.png")
        urls.append(url)
        if idx == pin_index:
            promote_style_reference(supabase, b64)
    print(f"  ✅ seed references: {[u for u in urls if u]}")
    return urls


if __name__ == '__main__':
    import argparse
    from edition_editor import get_supabase
    ap = argparse.ArgumentParser(description='Edition illustration pipeline')
    ap.add_argument('--seed', action='store_true', help='generate + pin style references, then exit')
    ap.add_argument('--n', type=int, default=4)
    args = ap.parse_args()

    sb = get_supabase()
    key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not key:
        raise SystemExit('GEMINI_API_KEY not set')
    if args.seed:
        generate_seed_references(sb, key, n=args.n)
    else:
        print('Nothing to do. Use --seed to lock the style, or call '
              'attach_illustrations() from the edition job.')
