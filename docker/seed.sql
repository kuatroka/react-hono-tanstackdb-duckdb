CREATE TABLE IF NOT EXISTS "user" (
  "id" VARCHAR PRIMARY KEY,
  "name" VARCHAR NOT NULL,
  "partner" BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS "medium" (
  "id" VARCHAR PRIMARY KEY,
  "name" VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS "message" (
  "id" VARCHAR PRIMARY KEY,
  "sender_id" VARCHAR REFERENCES "user"(id),
  "medium_id" VARCHAR REFERENCES "medium"(id),
  "body" VARCHAR NOT NULL,
  "labels" VARCHAR[] NOT NULL,
  "timestamp" TIMESTAMP not null
);

INSERT INTO "user" (id, name, partner) VALUES 
  ('ycD76wW4R2', 'Aaron', true),
  ('IoQSaxeVO5', 'Matt', true),
  ('WndZWmGkO4', 'Cesar', true),
  ('ENzoNm7g4E', 'Erik', true),
  ('dLKecN3ntd', 'Greg', true),
  ('enVvyDlBul', 'Darick', true),
  ('9ogaDuDNFx', 'Alex', true),
  ('6z7dkeVLNm', 'Dax', false),
  ('7VoEoJWEwn', 'Nate', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "medium" (id, name) VALUES 
  ('G14bSFuNDq', 'Discord'),
  ('b7rqt_8w_H', 'Twitter DM'),
  ('0HzSMcee_H', 'Tweet reply to unrelated thread'),
  ('ttx7NCmyac', 'SMS')
ON CONFLICT (id) DO NOTHING;
