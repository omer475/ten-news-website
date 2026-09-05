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
THIS MUST NOT LOOK MACHINE-MADE — READ THIS TWICE
The single failure mode is a picture that looks generated: glossy, glowing,
over-rendered, every surface busy. That look comes from rendering language.
These are PRINTED AND DRAWN OBJECTS, not renders.

BANNED, without exception:
- Gradients of any kind. Colour is laid down FLAT and unmodulated. A shape is
  one colour across its whole area unless the medium below says otherwise.
- Glow, neon, bloom, rim light, lens flare, sparkles, light rays, glinting
  highlights, "energy" wisps.
- Drop shadows, soft shadows, bevels, embossing, ambient occlusion, any
  attempt at three-dimensional form-shading.
- Airbrush, "digital painting", glossy plastic surfaces, chrome, cinematic
  lighting, volumetric haze, depth of field, bokeh.
- Hyper-detail. Covering every surface in incident is a machine habit and the
  fastest way to look fake.
- Perfect symmetry, and the subject parked dead centre.
- The default candy-bright saturated palette that every generator reaches for.
  Choose your colours deliberately and name them to yourself.

SIMPLICITY IS THE CRAFT
- Fewer than ten distinct elements in the whole picture. Large, calm, confident
  shapes; big areas of one unbroken colour; real empty space.
- If something can be removed and the idea survives, remove it.
- One idea. Not a montage of five symbols hedging against each other.
- SIMPLIFY THE DRAWING, NEVER THE SUBJECT. Fewer elements means fewer things in
  the frame, not vaguer things. Reaching for a stock symbol — a cracked globe, a
  ticking clock, a chess piece, a lightbulb, scales of justice — because it is
  simpler to draw than the actual named subject is the failure this whole brief
  exists to prevent. Draw the specific building, the specific machine, the
  specific document, simply.

MAKE THE MEDIUM VISIBLE
- The physical process must show: paper grain and the texture of the stock,
  halftone dots, ink starving at the edge of a screen pull, slight
  misregistration between colour layers, brush drag and dry-brush skips, the
  ragged edge of torn paper, visible pencil under-drawing, a line that wobbles.
- Slight imperfection and hand-made irregularity ARE the style. Clean and
  perfect reads as fake.
- Limited ink counts are what make print look like print. Where the brief names
  a number of colours, that number is a hard limit, background included.

COLOUR
- Confident, printed colour — the colour of a poster, chosen and meant, working
  against itself. Not the generator's default rainbow, not muddy neutrals.
- The exception is grave news — death, war, disaster — where the palette drops
  to two tones and turns severe. Nothing else gets that licence.

BE SPECIFIC — DRAW THE ACTUAL THING
- Named companies, products and logos belong IN the picture, drawn accurately
  and legibly: a Revolut card, an Airbus fuselage, a ChatGPT interface, a Boeing
  tail fin, a specific national flag.
- Named places get their real recognisable form: the Sydney Opera House, a Kyiv
  apartment block, the Palace of Westminster.
- Named animals, machines and objects get drawn as themselves — the actual grey
  wolf, the actual oil tanker, the actual refinery.
- Real, named individuals CANNOT be drawn — the image model refuses likenesses.
  Use the office and its attributes instead, never the face: an empty podium
  with the seal, a red tie on an empty suit, a hand signing an order, a vacated
  chair at a summit table. Human figures are anonymous, cropped, or symbolic.
- If the illustration could be swapped onto a different story without anyone
  noticing, it has failed.

FORMAT
- Tall portrait, a full-bleed magazine cover illustration.
- THE LOWER THIRD MUST STAY QUIET — large type is set across it. Give that band
  open ground or flat unbroken colour. Detail belongs above it.
- The poster crops about 15% from the left and right edges, so keep anything
  load-bearing off the side margins. Bleed the background to the edges.
- No borders, no frames, no mockups, no vignette, no rounded corners, no
  photographed-paper effects, no shadow under a fake sheet of paper.

ABSOLUTE CONSTRAINTS
- NO text, letters, numbers, words, captions, signatures or speech bubbles. The
  only lettering permitted is a brand's own logo where the story is about that
  brand. The edition sets its own type over the image.
- No likenesses of real people. Nothing photorealistic — this must read
  unmistakably as a drawn, printed illustration.
- No gore, no bodies, no weapons aimed at the viewer. Grave news is carried by
  metaphor and restraint, never spectacle.
"""

TRADITIONS = {
    # ---------------------------------------------------------------- loud
    "bold_symbol": {
        "label": "Bold symbol",
        "energy": "loud",
        "fits": "a company, a product, a launch, a single object that IS the story",
        "brief": """
MEDIUM — Screenprinted poster. One object, printed in three flat inks.
- The subject is the ACTUAL named object from the story — that company's card,
  that aircraft, that document, that building — drawn large and simple, filling
  much of the frame, seen straight on or from one clean angle. Never a generic
  stand-in for it. No perspective drama.
- Every colour is a flat unmodulated area. Form is described by the SHAPE and
  by hard-edged blocks of a second ink, never by shading.
- Print artefacts carry the surface: halftone dots in one area, ink starving at
  an edge, one layer a millimetre off register, paper grain throughout.
- Ground is a single flat colour to the edges.
PALETTE — Three inks total including the background. The brand's own colour, one
opposing ink, and off-white stock.
""",
    },
    "maximalist_doodle": {
        "label": "Maximalist doodle",
        "energy": "loud",
        "fits": "abundance, excess, waste, sprawl, everything-everywhere stories, lists, markets",
        "brief": """
MEDIUM — Ink line drawing on white, flat colour filled inside the line.
- Many small objects drawn individually with a fine, even, slightly wobbly pen
  line, massing into one larger recognisable silhouette.
- Every object is a specific nameable thing taken from the story. Flat fills
  only, no shading inside any shape, plenty of objects left as line on white.
- White paper is the ground and stays visible between and around the mass.
- Obsessive but calm. The pleasure is recognising individual things.
PALETTE — Line in black; fills in six or seven flat, slightly chalky colours.
""",
    },
    "flat_character": {
        "label": "Flat character",
        "energy": "loud",
        "fits": "people-shaped stories: health, work, courts, culture, everyday life, gentle comedy",
        "brief": """
MEDIUM — Flat character illustration, gouache-textured shapes, no outlines.
- Simple geometric bodies, dot-and-line faces, no modelling, no shading, no
  outline around every form. Shapes meet each other directly.
- Comedy comes from ARRANGEMENT — stacking, queueing, crowding, piling — not
  from expression or motion effects.
- Fine paper grain across the whole image; edges very slightly soft, as if
  painted rather than vectored.
- Large areas of the ground left completely empty.
PALETTE — A warm off-white ground and five flat colours, chalky rather than
bright: clay, mustard, sage, dusty coral, ink blue.
""",
    },
    "fractured_prism": {
        "label": "Fractured prism",
        "energy": "loud",
        "fits": "power, ambition, reinvention, a figure at the centre of a scene, culture and fashion",
        "brief": """
MEDIUM — Cut and overlaid translucent colour planes, screenprint-style.
- Hard-edged angular planes of transparent ink laid over a simple central
  subject; where two planes cross they multiply into a third flat colour.
- The subject is an object, garment or silhouette, drawn in simple flat shapes
  beneath the geometry — never a real person's face.
- Every plane is flat. The transparency is a printing effect, not lighting.
- Visible screen texture and slight misregistration on at least one plane.
PALETTE — Four transparent inks that multiply well — cyan, magenta, yellow,
violet — over an off-white ground.
""",
    },
    "marker_hand": {
        "language": "loose",
        "label": "Marker hand",
        "energy": "loud",
        "fits": "internet culture, consumer stories, anything that should feel handmade and cheerful",
        "brief": """
MEDIUM — Felt-tip marker and ballpoint on cheap paper, scanned.
- Deliberately wonky line, visible marker streaks and overlap where strokes
  cross, colour blocked in slightly outside the outlines, corners not meeting.
- Objects drawn large, close and simply, the way someone draws quickly to
  explain something. Perspective is casual and a bit wrong.
- Paper texture and the faint bleed of marker through the sheet.
PALETTE — Three or four marker colours straight from the pack, flat and
unshaded, plus a black pen line, on white paper.
""",
    },
    "riso_poster": {
        "label": "Risograph poster",
        "energy": "loud",
        "fits": "politics, protest, housing, energy, technology, anything with a public argument",
        "brief": """
MEDIUM — Risograph print, two spot inks, no black plate.
- Flat shapes cut with a confident hand, forms simplified almost to symbol.
- The riso character is the point: coarse paper grain, mottled uneven ink lay,
  visible misregistration where the two layers overlap, the third colour that
  appears where they cross, white paper showing through.
- Big simple shapes, dramatic difference in scale between one large subject and
  small anonymous figures. Generous flat ground.
PALETTE — Exactly two riso inks on off-white — fluorescent pink and federal
blue, or yellow and bright red. No third ink, no black.
""",
    },
    "punk_cutout": {
        "label": "Punk cutout",
        "energy": "loud",
        "fits": "scandal, greed, institutions behaving badly, a story with a target",
        "brief": """
MEDIUM — Photocopied high-contrast cutout on a flat painted ground, with marks
made by hand in marker.
- The subject is reduced to hard black-and-white with all mid-tones gone, the
  copier's grain and blown-out blacks left in, edges cut with scissors.
- Crude hand marks over the top: a scrawl, an arrow, a crossing-out — drawn
  fast, wrong, and slightly off.
- Nothing else in the frame. Enormous areas of flat colour.
PALETTE — One flat screaming ground (signal red, hazard orange, acid green),
plus black and paper white. Three, no more.
""",
    },
    "comic_absurd": {
        "label": "Comic absurd",
        "energy": "loud",
        "fits": "absurdity, mishaps, tech behaving oddly, sport, a story that is genuinely funny",
        "brief": """
MEDIUM — Newspaper comic-strip cartooning: brush-inked line, flat colour, benday
dots for shading.
- Exaggerated scale and physics — objects too big, things mid-tumble — drawn
  with a brush line of varying weight. Motion shown by simple drawn marks:
  a few speed lines, a small burst, three drops.
- Colour is flat inside the line, with halftone dot fields where a darker value
  is needed. No painting, no modelling, no gloss.
- Anonymous or symbolic characters. Plenty of empty paper around the gag.
PALETTE — Four flat comic inks on newsprint cream, plus black line.
""",
    },
    "decorative_flat": {
        "label": "Decorative flat",
        "energy": "loud",
        "fits": "nature, climate, land, agriculture, science, anything with pattern and scale",
        "brief": """
MEDIUM — Flat decorative illustration: layered patterned shapes, screenprinted.
- The frame fills with rhythmic repeated forms — trees, waves, roofs, crops —
  each one a flat shape carrying a simple hand-drawn internal texture of dots,
  dashes or strokes.
- Depth comes from layering and overlap only. No perspective, no shading, no
  atmosphere.
- One tiny human element hidden in the pattern gives the scale and the story.
PALETTE — Six or eight related flat colours in one family, plus one contrasting
accent. Clean and slightly chalky.
""",
    },
    "newsprint_collage": {
        "label": "Newsprint collage",
        "energy": "loud",
        "fits": "media, archives, information, misinformation, culture, anything made of fragments",
        "brief": """
MEDIUM — Physical collage cut from real newspaper, laid on painted paper and
photographed flat under even light.
- Every shape scissored or torn from newsprint: columns of type, halftone photo
  fragments, deckled torn edges with visible paper fibre.
- Naive construction — creatures and objects assembled from a few simple cut
  pieces, arranged with obvious hand placement.
- The texture of printed type is what carries the picture. Almost no drawing.
PALETTE — Newsprint grey and cream against ONE flat painted colour.
""",
    },
    # ------------------------------------------------------------- restrained
    "silkscreen_grave": {
        "label": "Silkscreen",
        "energy": "quiet",
        "fits": "conflict, crackdowns, sudden ruptures, alarm — grave news that still needs force",
        "brief": """
MEDIUM — Hand-pulled silkscreen, two colours, printed fast.
- Source reduced to hard black shapes, mid-tones dropped entirely.
- Print artefacts left in: ink starving at the squeegee edge, screen speckle,
  one layer pulled slightly off register.
- Severe and graphic. Reads at fifty metres. Large empty areas.
PALETTE — Black plus ONE flat colour. Signal red for alarm, deep blue for grief.
Two, no more.
""",
    },
    "engraved_grave": {
        "label": "Engraving",
        "energy": "quiet",
        "fits": "death, disaster, war's aftermath, slow irreversible change — the stories that need silence",
        "brief": """
MEDIUM — Wood engraving: white line cut into end-grain boxwood, letterpressed.
- Tone built ONLY from engraved line — parallel burin strokes, cross-hatching,
  stipple. No washes, no gradients, no grey fills.
- A deep near-black mass against open unworked white. Line direction follows the
  form it describes.
- Still, severe, wordless. For the days that deserve it — never to dress an
  ordinary story up as important.
PALETTE — Warm black ink on cream paper. One muted accent at most.
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
