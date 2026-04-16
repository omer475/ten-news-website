// Typed entity prefixes. All signals in user_entity_signals use these.
export const SIGNAL_TYPES = {
  ORG: 'org',           // organizations: org:openai, org:fbi
  PERSON: 'person',     // people: person:jannik_sinner, person:sam_altman
  EVENT: 'event',       // events: event:world_cup_2026, event:artemis_ii
  PRODUCT: 'product',   // products: product:iphone_17, product:spider_man_3
  LOC: 'loc',           // locations: loc:turkiye, loc:istanbul, loc:usa
  LANG: 'lang',         // languages: lang:tr, lang:en
  TOPIC: 'topic',       // narrow concepts: topic:large_language_models
};

// Category words that must NEVER enter user_entity_signals.
// These live in the category diversity system, not the signal system.
export const CATEGORY_BLOCKLIST = new Set([
  'tech', 'technology', 'science', 'world', 'politics', 'sports',
  'entertainment', 'business', 'health', 'lifestyle', 'finance',
  'news', 'breaking', 'opinion', 'culture', 'education',
]);

export function slugify(str) {
  return str.toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function isValidTypedSignal(signal) {
  if (typeof signal !== 'string') return false;
  const parts = signal.split(':');
  if (parts.length !== 2) return false;
  const [type, value] = parts;
  if (!Object.values(SIGNAL_TYPES).includes(type)) return false;
  if (CATEGORY_BLOCKLIST.has(value)) return false;
  return value.length > 0 && value.length <= 64;
}
