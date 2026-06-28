ALTER TABLE deck_cards
    ADD COLUMN IF NOT EXISTS illustration TEXT NOT NULL DEFAULT '';

ALTER TABLE deck_cards
    DROP CONSTRAINT IF EXISTS deck_cards_count_check;

ALTER TABLE deck_cards
    ADD CONSTRAINT deck_cards_count_check CHECK (count >= 1);
