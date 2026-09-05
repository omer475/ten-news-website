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
        "family": "printed",
        "density": "minimal",
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
        "family": "drawn",
        "density": "dense",
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
        "family": "drawn",
        "density": "medium",
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
        "family": "printed",
        "density": "medium",
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
        "label": "Marker hand",
        "energy": "loud",
        "family": "drawn",
        "density": "medium",
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
        "family": "printed",
        "density": "medium",
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
        "family": "collage",
        "density": "minimal",
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
        "family": "drawn",
        "density": "medium",
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
        "family": "printed",
        "density": "dense",
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
        "family": "collage",
        "density": "medium",
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
        "family": "printed",
        "density": "minimal",
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
        "family": "drawn",
        "density": "dense",
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
    "photo_still_life": {
        "label": "Object photograph",
        "energy": "loud",
        "family": "photographic",
        "density": "minimal",
        "fits": "money, documents, consumer goods, evidence, a story that turns on a physical thing",
        "brief": """
MEDIUM — A studio photograph of real objects on a seamless coloured paper
sweep, lit flat. NOT a drawing.
- Objects ONLY. No people, no hands, and no depiction of an event happening —
  this is a still life on a table and must read unmistakably as one.
- Two or three real things placed deliberately with space between them: a
  passport, a bank card, a sheaf of documents, a length of pipe, a hard hat.
- Even, soft, frontal light and one quiet natural shadow. No dramatic lighting,
  no glow, no gloss — a plain, honest product-photograph look.
- Enormous areas of the coloured paper left empty.
PALETTE — One flat seamless-paper colour and the true colours of the objects.
""",
    },
    "minimal_mark": {
        "label": "Minimal mark",
        "energy": "loud",
        "family": "graphic",
        "density": "minimal",
        "fits": "a single decision, a threshold crossed, an absence — a story that needs quiet",
        "brief": """
MEDIUM — Extreme graphic minimalism, in the manner of a Swiss or Japanese
poster. One mark, enormous space.
- ONE element only — a single object, silhouette or geometric form — small to
  medium in a vast empty field. Nothing else in the frame at all.
- The form is flat, precise and cleanly cut. No texture inside it, no shading.
- Off-centre. The emptiness is the design, not a mistake.
- Restraint is the entire brief. A second element ruins it.
PALETTE — One flat ground and ONE mark colour. Two, total.
""",
    },
    "data_graphic": {
        "label": "Drawn chart",
        "energy": "loud",
        "family": "graphic",
        "density": "medium",
        "fits": "markets, prices, counts, rates — anything where the number IS the story",
        "brief": """
MEDIUM — A hand-made statistical graphic treated as a picture: bars, a line, or
a grid of dots, drawn flat and large.
- The chart IS the illustration. Bold flat bars, or a heavy hand-drawn line
  climbing or falling across the frame, drawn slightly imperfectly by hand.
- One real object may sit in or on the chart to say what it counts — a barrel,
  a loaf, a house — drawn simply at the same flatness.
- Absolutely no labels, numerals, axis text or legends of any kind.
- Plenty of empty ground above or below the plot.
PALETTE — A flat ground, one colour for the data, one accent for the single bar
that matters. Three, total.
""",
    },
    "made_object": {
        "label": "Made object",
        "energy": "loud",
        "family": "made",
        "density": "medium",
        "fits": "warm human stories, food, home, craft — anything better for being handmade",
        "brief": """
MEDIUM — The subject BUILT physically from craft materials and photographed:
plasticine, felt, coloured card, pipe cleaners, modelling clay.
- Visible making: fingerprints in the clay, fuzzy felt edges, glue, wonky
  joins, the seam where two pieces meet.
- Set on a plain coloured surface, lit softly and evenly from the front,
  photographed straight down or straight on. Tabletop and shallow.
- Charmingly imperfect. The hand that made it should be obvious.
PALETTE — The bright flat colours of craft materials on one plain surface.
""",
    },
    "painted_gouache": {
        "label": "Gouache painting",
        "energy": "loud",
        "family": "painted",
        "density": "medium",
        "fits": "landscape, weather, cities, atmosphere — a scene that wants to be painted",
        "brief": """
MEDIUM — Gouache on paper. Opaque matte paint with the brush marks left in.
- Shapes blocked in with a loaded brush: streaky coverage, dry-brush skips,
  edges that do not quite meet, one colour scumbled over another.
- Form comes from flat planes of colour set beside each other, never from
  blending or shading. Paper texture shows through in places.
- Simplified, slightly naive drawing. A few big shapes, calmly arranged.
PALETTE — Six mixed, slightly muted colours that clearly came from a palette
rather than a screen. Chalky, never neon.
""",
    },
    "mosaic_cut": {
        "label": "Cut mosaic",
        "energy": "loud",
        "family": "collage",
        "density": "dense",
        "fits": "many parts making one whole: coalitions, migration, networks, cities, culture",
        "brief": """
MEDIUM — The image assembled from hundreds of small flat cut shapes, like a
paper mosaic or a stained-glass panel.
- Every area is built from small irregular tiles of flat colour, with thin gaps
  of the dark ground showing between them.
- The subject reads clearly at a distance and dissolves into tiles up close.
- No shading inside any tile; depth comes from tile colour alone.
PALETTE — Eight to ten flat colours in two families, over a dark ground.
""",
    },
}

ORDER = list(TRADITIONS.keys())
LOUD = [k for k, v in TRADITIONS.items() if v["energy"] == "loud"]
FAMILY = {k: v["family"] for k, v in TRADITIONS.items()}
DENSITY = {k: v["density"] for k, v in TRADITIONS.items()}


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
        lines.append(f"  {key} — {t['label']} [{t['family']}, {t['density']}]: "
                     f"{t['fits']}{tag}")
    return "\n".join(lines)
