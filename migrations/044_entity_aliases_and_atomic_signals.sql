-- Entity alias table for normalizing multi-spelling entities
CREATE TABLE IF NOT EXISTS entity_aliases (
  alias text PRIMARY KEY,
  canonical text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_canonical ON entity_aliases(canonical);

-- Seed with common variants
INSERT INTO entity_aliases (alias, canonical) VALUES
  ('turkiye', 'turkey'),
  ('türkiye', 'turkey'),
  ('turkish', 'turkey'),
  ('peking', 'beijing'),
  ('korean', 'korea'),
  ('south korean', 'south korea'),
  ('north korean', 'north korea'),
  ('ukrainian', 'ukraine'),
  ('russian', 'russia'),
  ('chinese', 'china'),
  ('american', 'united states'),
  ('us', 'united states'),
  ('usa', 'united states'),
  ('u.s.', 'united states'),
  ('uk', 'united kingdom'),
  ('british', 'united kingdom'),
  ('britain', 'united kingdom'),
  ('israeli', 'israel'),
  ('iranian', 'iran'),
  ('iraqi', 'iraq'),
  ('japanese', 'japan'),
  ('indian', 'india'),
  ('brazilian', 'brazil'),
  ('mexican', 'mexico'),
  ('canadian', 'canada'),
  ('australian', 'australia'),
  ('french', 'france'),
  ('german', 'germany'),
  ('italian', 'italy'),
  ('spanish', 'spain'),
  ('dutch', 'netherlands'),
  ('swiss', 'switzerland'),
  ('swedish', 'sweden'),
  ('norwegian', 'norway'),
  ('danish', 'denmark'),
  ('finnish', 'finland'),
  ('polish', 'poland'),
  ('greek', 'greece'),
  ('portuguese', 'portugal'),
  ('saudi', 'saudi arabia'),
  ('uae', 'united arab emirates'),
  ('emirati', 'united arab emirates'),
  ('south african', 'south africa'),
  ('nigerian', 'nigeria'),
  ('egyptian', 'egypt'),
  ('thai', 'thailand'),
  ('vietnamese', 'vietnam'),
  ('indonesian', 'indonesia'),
  ('malaysian', 'malaysia'),
  ('filipino', 'philippines'),
  ('philippine', 'philippines'),
  ('pakistani', 'pakistan'),
  ('afghan', 'afghanistan'),
  ('syrian', 'syria'),
  ('lebanese', 'lebanon'),
  ('jordanian', 'jordan'),
  ('elon musk', 'musk'),
  ('donald trump', 'trump'),
  ('joe biden', 'biden'),
  ('vladimir putin', 'putin'),
  ('xi jinping', 'china'),
  ('cryptocurrency', 'crypto'),
  ('cryptocurrencies', 'crypto'),
  ('bitcoin', 'btc'),
  ('btc', 'bitcoin'),
  ('artificial intelligence', 'ai'),
  ('machine learning', 'ai'),
  ('self-driving', 'autonomous vehicles'),
  ('self driving', 'autonomous vehicles'),
  ('electric vehicle', 'ev'),
  ('electric vehicles', 'ev')
ON CONFLICT (alias) DO NOTHING;

-- Atomic upsert for interest_count (fixes race condition)
CREATE OR REPLACE FUNCTION update_entity_signal_interest(
  p_user_id uuid,
  p_entity text,
  p_increment numeric
) RETURNS void AS $$
BEGIN
  INSERT INTO user_entity_signals (user_id, entity, interest_count, updated_at)
  VALUES (p_user_id, p_entity, p_increment, NOW())
  ON CONFLICT (user_id, entity)
  DO UPDATE SET
    interest_count = COALESCE(user_entity_signals.interest_count, 0) + p_increment,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Atomic upsert for tag_profile increments
CREATE OR REPLACE FUNCTION update_tag_profile_atomic(
  p_user_id uuid,
  p_tag text,
  p_increment numeric
) RETURNS void AS $$
DECLARE
  current_profile jsonb;
  current_val numeric;
BEGIN
  SELECT COALESCE(tag_profile, '{}'::jsonb) INTO current_profile
  FROM profiles WHERE id = p_user_id;

  current_val := COALESCE((current_profile ->> p_tag)::numeric, 0);

  UPDATE profiles
  SET tag_profile = COALESCE(tag_profile, '{}'::jsonb) || jsonb_build_object(p_tag, current_val + p_increment),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;
