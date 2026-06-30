// lib/sampleEdition.js
//
// A hand-written, §13-compliant sample Edition. It exists so the WEB terminal can
// integrate GET /api/edition immediately, before the real pipeline runs. The API
// serves this whenever the requested date has no published row in the `editions`
// table.
//
// Shape is the LOCKED §13 contract (brief, not master-prompt):
//   - exactly 15 story items, paced heavy->light, ending on a light positive story
//   - never >3 must-know in a row
//   - illustrations on NON-SERIOUS items only (never war/death/arrests/tragedy)
//   - card type driven by presence of fields (stat/chart/quote/illustration)
//   - top-level modules: number_of_day, today_in_history, countdown   (NO quiz)
//
// Illustration asset_url points at a bundled placeholder SVG so the web can render
// the illustration card today; the real pipeline replaces these with generated art.

const ILLO = '/sample-illustrations/placeholder.svg';

const ITEMS = [
  // 1 — LEAD must-know (serious -> text, no illustration)
  {
    bucket: 'must',
    type: 'text',
    kicker: 'World',
    headline: 'Ceasefire holds for a third day along the border',
    accent_entity: null,
    dek: null,
    bullets: [
      'Both sides reported no overnight shelling, the first such lull in five weeks, according to Reuters.',
      'Mediators say a prisoner exchange is being negotiated but no timeline has been agreed.',
      'Aid convoys reached two cut-off towns for the first time since the fighting began.',
    ],
    lighter: false,
    sources: [
      { outlet: 'Reuters', url: 'https://www.reuters.com/world/sample-ceasefire' },
      { outlet: 'AP', url: 'https://apnews.com/article/sample-border' },
    ],
  },

  // 2 — must-know, one number is the story (stat)
  {
    bucket: 'must',
    type: 'stat',
    kicker: 'Money',
    headline: 'The central bank holds rates, surprising no one',
    accent_entity: null,
    dek: 'Policymakers left the benchmark unchanged for a fourth straight meeting as inflation cools.',
    bullets: [
      'The decision was unanimous, the bank said in a statement.',
      'Markets had priced in a hold; futures moved less than a basis point.',
    ],
    stat: { value: 4.25, prefix: '', suffix: '%', decimals: 2, label: 'benchmark rate, unchanged' },
    lighter: false,
    sources: [{ outlet: 'Bloomberg', url: 'https://www.bloomberg.com/sample-rates' }],
  },

  // 3 — must-know (serious -> text)
  {
    bucket: 'must',
    type: 'text',
    kicker: 'Politics',
    headline: 'Coalition talks collapse, sending the country back to polls',
    accent_entity: null,
    dek: null,
    bullets: [
      'Three parties failed to agree a budget framework after eleven days of negotiation.',
      'A snap election is now expected in the autumn, the president said.',
    ],
    lighter: false,
    sources: [{ outlet: 'The Guardian', url: 'https://www.theguardian.com/sample-coalition' }],
  },

  // 4 — LIGHT BEAT after 3 must (fun illustration)
  {
    bucket: 'fun',
    type: 'illustration',
    kicker: 'Science',
    headline: 'Octopuses appear to dream, new footage suggests',
    accent_entity: 'dream',
    dek: 'Color-changing skin during rest mirrors hunting patterns, researchers say.',
    bullets: [
      'In lab recordings, sleeping octopuses cycled through skin patterns linked to predation.',
      'Scientists caution it is suggestive, not proof of dreaming as humans know it.',
    ],
    illustration: {
      scene: 'A snoozing octopus in a nightcap, one tentacle twitching, a single gold thought-bubble above it',
      asset_url: ILLO,
      seed: 110735,
    },
    lighter: true,
    sources: [{ outlet: 'Nature', url: 'https://www.nature.com/sample-octopus' }],
  },

  // 5 — must-know, trend over time (chart)
  {
    bucket: 'must',
    type: 'chart',
    kicker: 'Markets',
    headline: 'Chipmaker shares climb to a six-month high',
    accent_entity: null,
    dek: 'Strong data-center demand lifted the stock for a fifth straight session.',
    bullets: [
      'Shares are up 18% since the start of the month.',
      'Analysts raised price targets after the latest earnings beat.',
    ],
    chart: {
      series: [301200, 305800, 299400, 312600, 318900, 323250],
      now_label: '323,250',
      source: '005930.KS · 6mo (KRW)',
      highlight_index: 5,
    },
    lighter: false,
    sources: [{ outlet: 'Financial Times', url: 'https://www.ft.com/sample-chip' }],
  },

  // 6 — must-know (serious -> text)
  {
    bucket: 'must',
    type: 'text',
    kicker: 'Climate',
    headline: 'Wildfire forces evacuation of two coastal towns',
    accent_entity: null,
    dek: null,
    bullets: [
      'Roughly 9,000 residents were ordered to leave as winds pushed the fire toward the coast.',
      'No casualties have been reported; firefighters expect the blaze to peak overnight.',
    ],
    lighter: false,
    sources: [{ outlet: 'AP', url: 'https://apnews.com/article/sample-wildfire' }],
  },

  // 7 — must-know, one number (stat)  [5,6,7 = 3 must in a row -> next is light]
  {
    bucket: 'must',
    type: 'stat',
    kicker: 'Health',
    headline: 'A long-awaited malaria vaccine clears final trials',
    accent_entity: null,
    dek: 'A second-generation shot showed strong protection in a multi-country study.',
    bullets: [
      'Regulators in three regions will review the data this quarter.',
      'The developer says it can produce 100 million doses a year if approved.',
    ],
    stat: { value: 77, prefix: '', suffix: '%', decimals: 0, label: 'reduction in severe cases' },
    lighter: false,
    sources: [{ outlet: 'WHO', url: 'https://www.who.int/sample-malaria' }],
  },

  // 8 — LIGHT BEAT (fun illustration)
  {
    bucket: 'fun',
    type: 'illustration',
    kicker: 'Space',
    headline: 'A rogue planet drifts alone, far from any star',
    accent_entity: 'alone',
    dek: 'The free-floating world was spotted by its faint infrared glow.',
    bullets: [
      'It has no sun to orbit and wanders the galaxy untethered.',
      'Astronomers think billions of such planets may roam the Milky Way.',
    ],
    illustration: {
      scene: 'A small lonely planet wearing a tiny backpack, walking a dotted path across empty space, one gold star far away',
      asset_url: ILLO,
      seed: 220841,
    },
    lighter: true,
    sources: [{ outlet: 'ESA', url: 'https://www.esa.int/sample-rogue-planet' }],
  },

  // 9 — must-know (serious -> text)
  {
    bucket: 'must',
    type: 'text',
    kicker: 'Tech',
    headline: 'Regulators open antitrust probe into app store fees',
    accent_entity: null,
    dek: null,
    bullets: [
      'The investigation will examine commission rates and developer terms.',
      'The company said it will cooperate and defends its current policies.',
    ],
    lighter: false,
    sources: [{ outlet: 'Reuters', url: 'https://www.reuters.com/sample-antitrust' }],
  },

  // 10 — fun, a single quote is the story (quote)
  {
    bucket: 'fun',
    type: 'quote',
    kicker: 'Sport',
    headline: 'A debut defender draws comparisons to the greats',
    accent_entity: null,
    dek: null,
    bullets: [
      'The 19-year-old made nine clearances and a goal-line block on debut.',
      'His manager urged calm, calling him "a kid who still has everything to learn".',
    ],
    quote: {
      text: 'He defends like a man who has read the next ten minutes of the game.',
      highlight: 'the next ten minutes',
      by: 'the opposing manager',
    },
    lighter: true,
    sources: [{ outlet: 'BBC Sport', url: 'https://www.bbc.co.uk/sport/sample-debut' }],
  },

  // 11 — fun illustration
  {
    bucket: 'fun',
    type: 'illustration',
    kicker: 'Culture',
    headline: 'A library fines bandit returns a book 60 years late',
    accent_entity: '60 years',
    dek: 'An anonymous note and a generous donation came with it.',
    bullets: [
      'The overdue novel was checked out in 1965, staff said.',
      'The donor asked that the waived fines be "passed on to a curious kid".',
    ],
    illustration: {
      scene: 'A very dusty library book tiptoeing back to a shelf at night, a single gold due-date card fluttering off it',
      asset_url: ILLO,
      seed: 330517,
    },
    lighter: true,
    sources: [{ outlet: 'Local Press', url: 'https://example.com/sample-library' }],
  },

  // 12 — must-know (serious -> text)
  {
    bucket: 'must',
    type: 'text',
    kicker: 'Economy',
    headline: 'Unemployment ticks up as hiring cools across sectors',
    accent_entity: null,
    dek: null,
    bullets: [
      'The jobless rate rose to 4.3%, the labor agency reported.',
      'Wage growth slowed but still outpaced inflation for the month.',
    ],
    lighter: false,
    sources: [{ outlet: 'Bloomberg', url: 'https://www.bloomberg.com/sample-jobs' }],
  },

  // 13 — fun illustration
  {
    bucket: 'fun',
    type: 'illustration',
    kicker: 'Nature',
    headline: 'A lost penguin walks into a seaside town, again',
    accent_entity: null,
    dek: 'The same wandering bird has now made the trip three years running.',
    bullets: [
      'Wildlife officers escorted it back to the colony, unharmed.',
      'Locals have unofficially named it and started a small fan club.',
    ],
    illustration: {
      scene: 'A determined penguin strolling down a quaint town street with a tiny gold suitcase, shopfronts behind',
      asset_url: ILLO,
      seed: 440263,
    },
    lighter: true,
    sources: [{ outlet: 'Local Press', url: 'https://example.com/sample-penguin' }],
  },

  // 14 — fun text
  {
    bucket: 'fun',
    type: 'text',
    kicker: 'Food',
    headline: 'A 200-year-old recipe wins a national baking prize',
    accent_entity: null,
    dek: null,
    bullets: [
      'The winning loaf used a starter passed down through five generations.',
      'Judges praised its "stubborn, old-fashioned crumb".',
    ],
    lighter: true,
    sources: [{ outlet: 'Local Press', url: 'https://example.com/sample-bread' }],
  },

  // 15 — LIGHT POSITIVE CLOSE (fun illustration) — the smile to end on
  {
    bucket: 'fun',
    type: 'illustration',
    kicker: 'Good news',
    headline: 'Volunteers replant a forest one bucket at a time',
    accent_entity: 'one bucket',
    dek: 'A decade of weekend planting has brought the birds back.',
    bullets: [
      'The group has put 1.2 million saplings into bare hillsides since 2016.',
      'Surveyors recorded 40 returning species this spring, the most yet.',
    ],
    illustration: {
      scene: 'A cheerful person tipping a watering can over a tiny sprout that is already taller than them, a single gold sun above',
      asset_url: ILLO,
      seed: 550199,
    },
    lighter: true,
    sources: [{ outlet: 'Local Press', url: 'https://example.com/sample-forest' }],
  },
];

const MODULES = {
  number_of_day: {
    value: 130000,
    unit: 'hectares',
    comparison: 'an area bigger than the city of Los Angeles',
  },
  today_in_history: {
    rows: [
      [1969, 'The crew of Apollo 11 began their journey home from the Moon.'],
      [1990, 'East and West Germany agreed the terms of monetary union.'],
      [2004, 'A search engine you have heard of filed to go public.'],
    ],
  },
  countdown: {
    name: 'Total solar eclipse over the Atlantic',
    datetime: '2026-08-12T17:46:00Z',
    context: 'The next total eclipse visible from parts of Europe; the path crosses Iceland and Spain.',
  },
};

// Returns a fresh §13 Edition object stamped with `date` (YYYY-MM-DD).
export function buildSampleEdition(date) {
  return {
    edition_date: date,
    is_sample: true,
    items: ITEMS,
    number_of_day: MODULES.number_of_day,
    today_in_history: MODULES.today_in_history,
    countdown: MODULES.countdown,
  };
}

export default buildSampleEdition;
