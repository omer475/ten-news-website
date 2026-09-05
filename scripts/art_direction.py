"""
TODAY — art direction for the daily edition.

Twelve illustration traditions, drawn from contemporary editorial illustration
rather than print history. Each entry is a complete brief for the image model:
medium, reference, palette, mark-making, energy.

The editor model picks the tradition that suits the STORY and writes the
CONCEPT — the actual thing to draw, naming the actual companies, products,
places and objects involved. These briefs only say how it should be made.

Two rules matter more than any single brief:
  * be SPECIFIC — a story about Revolut has the Revolut card in it
  * be LOUD — unless the story is grave, the picture should be in colour and
    should be fun to look at
"""

SHARED = """
COLOUR — THIS IS NOT A QUIET PICTURE
- Commit to colour. Saturated, confident, printed-poster colour that survives
  being seen at arm's length on a phone. Two to five strong colours, chosen and
  meant, working against each other.
- Beige, grey-brown, muddy neutrals and washed-out sepia are wrong unless the
  brief below explicitly asks for them. If you find yourself making something
  tasteful and restrained, you have misread the assignment.
- The exception is grave news — deaths, war, disaster. There, hold the colour
  back to two tones and let it be severe. Nothing else gets that licence.

BE SPECIFIC — DRAW THE ACTUAL THING
- Named companies, products and logos belong IN the picture, drawn accurately
  and legibly: a Revolut card, an Airbus fuselage, a Tesco storefront, a
  ChatGPT interface, a Boeing tail fin, a euro coin, a specific national flag.
- Named places get their real recognisable form: the Sydney Opera House, a
  Kyiv apartment block, the Palace of Westminster, an Australian gum forest.
- Named animals, machines, plants and objects get drawn as themselves — the
  actual grey wolf, the actual oil tanker, the actual refinery.
- Real, named individuals CANNOT be drawn — the image model refuses likenesses.
  Use the office and its attributes instead, never the face: an empty podium
  with the presidential seal, a red tie on an empty suit, a hand signing an
  executive order, a motorcade, a vacated chair at a summit table. Any human
  figures are anonymous — cropped, from behind, generic, or symbolic.
- A generic picture is a failed picture. If the illustration could be swapped
  onto a different story without anyone noticing, start again.

FORMAT
- Tall portrait, designed as a full-bleed magazine cover illustration.
- THE LOWER THIRD MUST STAY QUIET. Large type is set across it. Give that band
  open ground, flat colour, empty sky, plain floor — somewhere the eye rests
  and lettering would read cleanly. Detail and incident belong above it. A
  beautiful drawing that fills the bottom third with busy detail is unusable.
- The poster crops roughly 15% from the left and right edges, so keep anything
  load-bearing away from the side margins. Bleed the background to the edges.
- Edge to edge artwork. No borders, no frames, no mockups, no drop shadows,
  no vignette, no rounded corners, no paper edges, no torn-photo effects.

ABSOLUTE CONSTRAINTS
- NO text, NO letters, NO numbers, NO words, NO captions, NO signatures,
  NO speech bubbles, NO UI labels. The ONLY lettering permitted anywhere is a
  brand's own logo where the story is about that brand. Everything else ruins
  the poster, because the edition sets its own type over the image.
- No likenesses of real people. No photorealistic depictions of news events —
  these must read unmistakably as drawn illustration, never as a photograph.
- No gore, no bodies, no weapons aimed at the viewer. Grave news is handled
  through metaphor and restraint, never spectacle.

CRAFT
- A paid editorial commission for a national title. One clear idea, read in two
  seconds, with a point of view. Deliberate composition, real craft, and — where
  the story allows it — wit.
- No corporate flat-vector cliches: no faceless purple blob-people, no isometric
  city with floating icons, no generic "innovation" swooshes.
"""

TRADITIONS = {
    # ---------------------------------------------------------------- loud
    "bold_symbol": {
        "label": "Bold symbol",
        "energy": "loud",
        "fits": "a company, a product, a launch, a single object that IS the story",
        "brief": """
MEDIUM — One giant graphic object filling the frame on a flat saturated ground,
silkscreen-poster energy.
- The subject — the card, the phone, the bottle, the machine, the logo — is
  drawn large, clean, confident and unmistakable, tilted or cropped for drama.
- Flat bold colour, hard edges, a strong rim light or glow, small energetic
  marks (sparks, lightning, motion ticks) around it.
- Small anonymous human figures at the base for scale and delight, reacting.
PALETTE — The brand's own colour against black or a single screaming
complementary. Three colours maximum, all of them loud.
""",
    },
    "maximalist_doodle": {
        "label": "Maximalist doodle",
        "energy": "loud",
        "fits": "abundance, excess, waste, sprawl, everything-everywhere stories, lists, markets",
        "brief": """
MEDIUM — Hundreds of small hand-drawn objects massing into one large shape,
in the manner of a dense contemporary newspaper-magazine cover illustration.
- Fine confident ink line, every small object individually drawn and readable,
  flat colour fills inside the line.
- The mass forms a recognisable silhouette — a figure, a wave, a mountain, a
  head — while staying legibly made of specific, nameable things drawn from
  the story itself.
- Playful, obsessive, generous. The reward is looking closer.
PALETTE — Bright, many-coloured, mostly cool with hot accents, on white.
""",
    },
    "flat_character": {
        "label": "Flat character",
        "energy": "loud",
        "fits": "people-shaped stories: health, work, courts, culture, everyday life, gentle comedy",
        "brief": """
MEDIUM — Modern flat character illustration, the contemporary magazine-cover
manner: clean geometric bodies, simple dot-and-line faces, no rendering.
- Characters are stacked, crowded, queued or piled to make the point — comic
  timing through arrangement rather than expression.
- Crisp vector-clean shapes, no outlines around everything, subtle grain.
- Generous empty ground around the group. Warm, funny, human.
PALETTE — Pastel base with three or four saturated accents: coral, mustard,
mint, cobalt. Cheerful and modern.
""",
    },
    "fractured_prism": {
        "label": "Fractured prism",
        "energy": "loud",
        "fits": "power, ambition, reinvention, a figure at the centre of a scene, culture and fashion",
        "brief": """
MEDIUM — Overlapping translucent colour planes and geometric shards built over
a central subject, in the manner of a contemporary weekly's cover portraiture.
- Bold angular facets of transparent colour multiply where they cross; brushy
  texture inside the planes; the subject reads clearly through the geometry.
- The subject is an object, a garment, a silhouette or an anonymous figure —
  never a real person's face.
- Layered ghost silhouettes behind, receding in flat colour.
PALETTE — High-chroma: cyan, magenta, yellow, violet, emerald, all at once,
against a light ground. Loud and glamorous.
""",
    },
    "marker_hand": {
        "language": "loose",
        "label": "Marker hand",
        "energy": "loud",
        "fits": "internet culture, consumer stories, anything that should feel handmade and cheerful",
        "brief": """
MEDIUM — Loose felt-tip and marker drawing, wonky and hand-made, the manner of
a hand-drawn zine or a hand-lettered poster.
- Deliberately imperfect line, visible marker streaks, shapes filled slightly
  outside their outlines, cheerful clumsiness.
- Flat hot colour blocked in behind the line. Hands, objects and props drawn
  large and close.
PALETTE — Hot yellow, hot pink, black line, one cool accent. Flat, unshaded,
joyful.
""",
    },
    "riso_poster": {
        "label": "Risograph poster",
        "energy": "loud",
        "fits": "politics, protest, housing, energy, technology, anything with a public argument",
        "brief": """
MEDIUM — Risograph print, two or three spot inks, no black plate.
- Flat shapes cut with a confident hand; forms simplified almost to symbol.
- Coarse paper grain, ink mottling, slight misregistration where layers overlap,
  colours multiplying into a third where they cross.
- Poster-scaled shapes, generous flat ground, dramatic scale contrast between a
  large subject and small anonymous figures.
PALETTE — Two or three riso inks at full strength: fluorescent pink and federal
blue; or yellow, red and blue. Never muted.
""",
    },
    "punk_cutout": {
        "label": "Punk cutout",
        "energy": "loud",
        "fits": "scandal, greed, institutions behaving badly, a story with a target",
        "brief": """
MEDIUM — One high-contrast black-and-white cutout subject slammed onto a flat
screaming colour field, with crude hand-scrawled marks — the manner of a
provocative European weekly's cover.
- The subject (an animal, a machine, an object) is a hard-edged silhouette-ish
  cutout with blown-out contrast, no mid-tones.
- Crude analogue marks — scrawls, arrows, crossings-out, torn edges — added by
  hand, deliberately rough.
- Confrontational, funny, mean. Maximum contrast, zero politeness.
PALETTE — One flat screaming ground (signal red, hazard orange, acid green)
plus black and white. Nothing else.
""",
    },
    "comic_absurd": {
        "label": "Comic absurd",
        "energy": "loud",
        "fits": "absurdity, mishaps, tech behaving oddly, sport, a story that is genuinely funny",
        "brief": """
MEDIUM — Exaggerated comic cartooning with full painted colour, the manner of a
classic American humour magazine.
- Wild exaggeration of scale and physics: objects enormous, bodies mid-tumble,
  everything at the edge of collapse. Anonymous or symbolic characters only.
- Motion is drawn: speed lines, impact bursts, flying debris, sweat drops.
- Rendered with real painterly craft, not a flat cartoon — modelled, glossy,
  saturated.
PALETTE — Full-spectrum saturated. Comedy needs colour.
""",
    },
    "decorative_flat": {
        "label": "Decorative flat",
        "energy": "loud",
        "fits": "nature, climate, land, agriculture, science, anything with pattern and scale",
        "brief": """
MEDIUM — Flat decorative illustration built from layered patterned shapes, the
manner of a broadsheet's Sunday review cover.
- The whole frame is filled with rhythmic repeated forms — trees, waves, roofs,
  crowds, crops — each a flat shape with a simple internal texture.
- One tiny human element hidden in the pattern gives the scale and the story.
- Calm, ornamental, absorbing. No perspective drama; layered depth instead.
PALETTE — A tight family of six or eight related colours — greens and teals, or
ochres and rusts — bright and clean, plus one contrasting accent.
""",
    },
    "newsprint_collage": {
        "label": "Newsprint collage",
        "energy": "loud",
        "fits": "media, archives, information, misinformation, culture, anything made of fragments",
        "brief": """
MEDIUM — Physical collage cut from printed newspaper, photographed flat.
- Every shape is scissored from newsprint — visible columns of type, halftone
  photo fragments, torn deckled edges, tiny cast shadows.
- Naive, charming construction: creatures and objects assembled from cut paper,
  arranged on a plain painted ground.
- Analogue and witty. The texture of type carries the whole picture.
PALETTE — Newsprint grey and cream against one flat painted colour — sky blue,
tomato, mustard.
""",
    },
    # ------------------------------------------------------------- restrained
    "silkscreen_grave": {
        "label": "Silkscreen",
        "energy": "quiet",
        "fits": "conflict, crackdowns, sudden ruptures, alarm — grave news that still needs force",
        "brief": """
MEDIUM — Hand-pulled silkscreen poster, two colours, printed fast.
- High-contrast source reduced to hard black shapes, mid-tones dropped entirely.
- Print artefacts are part of it: ink starving at the squeegee edge, screen
  speckle, one layer printed slightly off register.
- Urgent, graphic, severe. Reads at fifty metres.
PALETTE — Black plus ONE flat colour, held to those two. Signal red or hazard
orange for alarm; deep blue for grief.
""",
    },
    "engraved_grave": {
        "label": "Engraving",
        "energy": "quiet",
        "fits": "death, disaster, war's aftermath, slow irreversible change — the stories that need silence",
        "brief": """
MEDIUM — Wood engraving: white line cut into end-grain boxwood, printed
letterpress.
- Tone built ONLY from engraved line — parallel burin strokes, cross-hatching,
  stipple. No washes, no gradients.
- A deep near-black mass against open unworked white. Line direction follows
  form.
- Still, severe, wordless. This tradition exists for the days that deserve it —
  do not use it to make an ordinary story look important.
PALETTE — Warm black ink on cream. At most one muted accent.
""",
    },
}

ORDER = list(TRADITIONS.keys())
LOUD = [k for k, v in TRADITIONS.items() if v["energy"] == "loud"]


def brief_for(tradition, concept, palette_hint=""):
    """Full image-model prompt for one poster."""
    t = TRADITIONS.get(tradition) or TRADITIONS[ORDER[0]]
    note = f"\nART DIRECTION NOTE — {palette_hint}\n" if palette_hint else ""
    return (
        f"An original editorial illustration for the cover of a daily news brief.\n\n"
        f"SUBJECT — {concept}\n"
        f"{t['brief']}{note}{SHARED}"
    )


def tradition_menu():
    """The list handed to the editor model when it picks a look."""
    lines = []
    for key in ORDER:
        t = TRADITIONS[key]
        tag = "" if t["energy"] == "loud" else "  [GRAVE NEWS ONLY]"
        lines.append(f"  {key} — {t['label']}: {t['fits']}{tag}")
    return "\n".join(lines)
