CREATE TABLE IF NOT EXISTS decks (
    deck_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deck_cards (
    deck_id   UUID NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    card_id   TEXT NOT NULL,
    card_name TEXT NOT NULL DEFAULT '',
    illustration TEXT NOT NULL DEFAULT '',
    count     INT  NOT NULL CHECK (count >= 1),
    PRIMARY KEY (deck_id, card_id)
);

CREATE TABLE IF NOT EXISTS cards (
    card_id      TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    regulation   TEXT NOT NULL DEFAULT '',
    card_type    TEXT NOT NULL DEFAULT '',
    illustration TEXT NOT NULL DEFAULT ''
);
