CREATE TABLE IF NOT EXISTS cards (
    card_id      TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    regulation   TEXT NOT NULL DEFAULT '',
    card_type    TEXT NOT NULL DEFAULT '',
    illustration TEXT NOT NULL DEFAULT ''
);
