CREATE TABLE IF NOT EXISTS user_counters (
  user_id TEXT PRIMARY KEY,
  value DOUBLE PRECISION NOT NULL DEFAULT 0
);

INSERT INTO user_counters (user_id, value)
VALUES 
  ('ycD76wW4R2', 0),
  ('IoQSaxeVO5', 0),
  ('WndZWmGkO4', 0),
  ('ENzoNm7g4E', 0),
  ('dLKecN3ntd', 0),
  ('enVvyDlBul', 0),
  ('9ogaDuDNFx', 0),
  ('6z7dkeVLNm', 0),
  ('7VoEoJWEwn', 0)
ON CONFLICT (user_id) DO NOTHING;
