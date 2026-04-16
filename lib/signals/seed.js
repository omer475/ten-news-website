import { slugify } from './types';

export async function seedUserSignalsFromOnboarding(supabase, userId, {
  country,         // e.g. "turkiye"
  language,        // e.g. "tr"
  selectedTopics,  // array of narrow topic strings from onboarding picker
}) {
  const seeds = [];

  // Location: 5 synthetic positives = warm start without hard bias
  if (country) {
    const locSig = `loc:${slugify(country)}`;
    for (let i = 0; i < 5; i++) seeds.push(locSig);
  }

  // Language: 5 synthetic positives
  if (language) {
    const langSig = `lang:${slugify(language)}`;
    for (let i = 0; i < 5; i++) seeds.push(langSig);
  }

  // Narrow topics from onboarding: 3 synthetic positives each
  for (const topic of (selectedTopics || [])) {
    const topicSig = `topic:${slugify(topic)}`;
    for (let i = 0; i < 3; i++) seeds.push(topicSig);
  }

  if (seeds.length === 0) return;

  const { error } = await supabase.rpc('bulk_update_entity_signals', {
    p_user_id: userId,
    p_signals: seeds,
    p_is_positive: true,
  });

  if (error) {
    console.error('[seed] Failed to seed onboarding signals:', error);
  }
}
