"""
TODAY — art direction for the daily edition.

Ten illustration traditions, one per poster, so an edition reads like a magazine
rather than ten variations of the same drawing. Each entry is a complete brief
for the image model: medium, reference, palette, mark-making, composition.

The editor model picks the tradition that fits the story and writes the CONCEPT
(the actual thing to draw). These briefs only say how it should be made.
"""

# Every poster carries type over the lower third, so every brief protects it.
SHARED = """
FORMAT
- Tall portrait, designed as a full-bleed magazine cover illustration for a phone.
- THE LOWER THIRD MUST STAY QUIET. Large type is set across it. Give that band
  open ground, flat colour, empty sky, still water, plain wall — somewhere the
  eye rests and white or black lettering would read cleanly. Detail, texture and
  incident belong above it. This is the single most important rule of the layout:
  a beautiful drawing that fills the bottom third with busy detail is unusable.
- The subject sits in the upper two thirds, off centre, breathing.
- The poster crops roughly 15% from the left and right edges, so keep the subject
  and anything load-bearing away from the side margins. Bleed background to the
  edges; put nothing at the edges you would miss.
- Edge to edge artwork. No borders, no frames, no mockups, no drop shadows,
  no vignette, no rounded corners, no paper edges, no torn-photo effects.

ABSOLUTE CONSTRAINTS
- NO text, NO letters, NO numbers, NO words, NO captions, NO signatures,
  NO logos, NO watermarks, NO speech bubbles, NO UI, NO charts with labels.
  Any lettering ruins the poster.
- No collage of real photographs of identifiable living people. No real faces.
  Figures are drawn, anonymous, seen from behind, in shadow, or generalised.
- No gore, no bodies, no weapons pointed at the viewer, no distressing detail.
  Serious news is handled with restraint and metaphor, never spectacle.

CRAFT
- This is a paid editorial commission for a national title. It must look made by
  a human illustrator with a point of view — considered composition, deliberate
  negative space, confident drawing, real material texture.
- One clear idea, read in under two seconds. No busy montage of five symbols.
- Print-quality: clean separations, controlled palette, no muddy blending,
  no airbrushed 3D render look, no stock-illustration flat-vector cliches
  (no faceless purple people, no isometric city with floating icons).
"""

TRADITIONS = {
    "wood_engraving": {
        "label": "Wood engraving",
        "fits": "land, weather, disaster, infrastructure, slow physical change, history",
        "brief": """
MEDIUM — Nineteenth-century wood engraving, in the manner of the illustrated
weeklies: white line cut into end-grain boxwood, printed letterpress.
- Tone is built ONLY from engraved line: parallel burin strokes, cross-hatching,
  stipple and flicked white line. No grey washes, no soft gradients.
- Line direction follows form — furrows across a field, contour around a hull.
- Dramatic tonal structure: a deep near-black mass against open unworked white.
- Slight ink spread and plate texture, as if printed on damp rag paper.
PALETTE — Warm black ink on a cream, unbleached paper ground. At most one
additional muted colour (oxide red, ochre or slate blue) used sparingly.
""",
    },
    "risograph": {
        "label": "Risograph poster",
        "fits": "politics, protest, housing, energy, anything with a public argument in it",
        "brief": """
MEDIUM — Risograph print, two or three spot inks, no black plate.
- Flat shapes cut with a confident hand; forms simplified almost to symbol.
- Visible risograph character: coarse paper grain, ink mottling, slight
  misregistration where layers overlap, colours multiplying into a third colour.
- Bold, poster-scaled shapes. Generous flat ground. No outlines around everything.
PALETTE — Exactly two or three riso inks (for example fluorescent pink and
federal blue; or yellow, medium blue and bright red) on off-white stock.
""",
    },
    "gouache_midcentury": {
        "label": "Mid-century gouache",
        "fits": "business, markets, transport, industry, institutions, the built world",
        "brief": """
MEDIUM — Mid-century painted editorial illustration, gouache and cut paper,
in the lineage of 1950s business-magazine covers.
- Simplified, slightly abstracted forms. Architecture and machinery reduced to
  planes. Figures small, geometric, without facial detail.
- Visible brush drag, dry-brush edges, paint that does not quite fill its shape.
- Confident asymmetric composition with a strong diagonal or a single dominant mass.
PALETTE — Muted, chalky, period palette: ochre, teal, oxblood, putty, cream,
with one saturated accent. Nothing neon, nothing digital-bright.
""",
    },
    "ink_wash": {
        "label": "Pen and wash",
        "fits": "people, culture, courts, sport, human stories, gentle absurdity",
        "brief": """
MEDIUM — Loose dip-pen line with watercolour wash, in the manner of a broadsheet
op-ed illustrator.
- Fast, searching, imperfect line with real weight variation and open corners.
- Wash applied wet and left to pool and dry with hard edges; deliberate bleeding
  outside the line. Large areas left as bare paper.
- Wit rather than caricature. Figures anonymous — seen from behind, cropped,
  or with the simplest possible features. No recognisable public figures.
PALETTE — Sepia or blue-black ink with two or three transparent washes on white
watercolour paper.
""",
    },
    "constructivist": {
        "label": "Constructivist poster",
        "fits": "systems, labour, movements, big collective decisions, upheaval",
        "brief": """
MEDIUM — Constructivist / Bauhaus poster design.
- Built from hard geometry: bold diagonals, circles, wedges, rules and bars.
- Strong dynamic asymmetry. Photomontage-style silhouette shapes allowed, but as
  flat cut-outs, never as photographic detail.
- Machine-like precision, no hand wobble, generous flat ground.
PALETTE — Red, black and off-white, or blue, black and off-white. Three tones
maximum, no gradients, no shading.
""",
    },
    "paper_collage": {
        "label": "Cut-paper collage",
        "fits": "media, culture, scandal, archives, anything assembled from fragments",
        "brief": """
MEDIUM — Physical cut and torn paper collage, photographed under raking light.
- Real paper: torn deckled edges with visible fibre, scissor cuts, newsprint and
  sugar-paper texture, tiny cast shadows where a layer lifts off the ground.
- Overlapping planes build the image. Halftone dot texture on one or two pieces.
- No printed words on any scrap — use plain, blank, textured paper only.
PALETTE — Aged newsprint, kraft, black, off-white and one bright ink colour.
""",
    },
    "stipple_engraving": {
        "label": "Stipple portrait",
        "fits": "an individual at the centre of the story, a resignation, a verdict, an obituary",
        "brief": """
MEDIUM — Stipple and line engraving, the financial-press portrait tradition.
- Form built entirely from dots and short strokes, denser in shadow, opening to
  bare paper in the light. Absolute technical control.
- The figure is anonymous and generalised — a back, a silhouette, hands, a chair,
  a coat on a hook. Never a likeness of a real person.
- Strong single light source, deep shadow, plenty of empty ground.
PALETTE — Black ink on cream paper. Optionally one restrained accent tone.
""",
    },
    "blueprint_technical": {
        "label": "Technical drawing",
        "fits": "science, engineering, medicine, supply chains, how a thing actually works",
        "brief": """
MEDIUM — Draughtsman's technical illustration: exploded axonometric or cutaway
section, ruled with instruments.
- Precise, even line weights, section hatching, leader lines that point at nothing
  (no labels), construction geometry left visible.
- The mechanism is the picture: layered, sectioned, understandable at a glance.
- Cool, clinical, beautiful. No perspective drama, no lens effects.
PALETTE — Prussian blue or graphite line on pale blue or bone drafting paper,
with one warm accent picking out the single part that matters.
""",
    },
    "silkscreen_protest": {
        "label": "Silkscreen",
        "fits": "conflict, crackdowns, crowds, sudden ruptures, moments of alarm",
        "brief": """
MEDIUM — Hand-pulled silkscreen poster, two colours, printed fast.
- High-contrast photographic source reduced to hard black shapes; mid-tones
  dropped entirely.
- Print artefacts are part of it: ink starving at the squeegee edge, blocked
  screen speckle, a colour layer printed slightly off.
- Raw, urgent, graphic. Composition reads at fifty metres.
PALETTE — Black plus one loud flat colour (signal red, hazard orange, acid
yellow) on unbleached stock.
""",
    },
    "surreal_object": {
        "label": "Editorial surrealism",
        "fits": "law, money, privacy, technology, abstractions with no obvious picture",
        "brief": """
MEDIUM — Single-object editorial surrealism: one everyday object, altered by one
idea, lit like a still life.
- Exactly one subject on a plain sweep of ground. The whole meaning lives in a
  single alteration — a door with no wall, a key made of water, a chair growing roots.
- Rendered in soft matte paint or coloured pencil with quiet grain; gentle,
  directional light and one long soft shadow.
- Calm, precise, slightly unsettling. Never a pile of symbols.
PALETTE — Two or three desaturated tones and a single warm accent.
""",
    },
}

ORDER = list(TRADITIONS.keys())


def brief_for(tradition, concept, palette_hint=""):
    """Full image-model prompt for one poster."""
    t = TRADITIONS.get(tradition) or TRADITIONS[ORDER[0]]
    palette_line = f"\nART DIRECTION NOTE — {palette_hint}\n" if palette_hint else ""
    return (
        f"An original editorial illustration for the front of a daily news brief.\n\n"
        f"SUBJECT — {concept}\n"
        f"{t['brief']}{palette_line}{SHARED}"
    )


def tradition_menu():
    """The list handed to the editor model when it picks a look."""
    return "\n".join(
        f"  {key} — {TRADITIONS[key]['label']}: {TRADITIONS[key]['fits']}"
        for key in ORDER
    )
