"use client";

import { useState, useEffect, useRef } from "react";
import { Card, DeckCard, searchCards } from "@/lib/api";

type Props = {
  onAdd: (card: DeckCard) => void;
};

export default function CardSearch({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 検索（300msデバウンス）
  useEffect(() => {
    if (!modalOpen || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const cards = await searchCards({ name: query.trim() });
        setResults(cards);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [modalOpen, query]);

  useEffect(() => {
    if (!modalOpen) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const handleSelect = (card: Card) => {
    onAdd({ cardId: card.cardId, cardName: card.name, illustration: card.illustration, count: 1 });
  };

  return (
    <div className="deck-search">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="deck-search__open-button"
      >
        カードを追加
      </button>

      {modalOpen && (
        <div className="deck-search-modal" role="dialog" aria-modal="true" aria-label="カードを追加">
          <button
            type="button"
            className="deck-search-modal__backdrop"
            aria-label="カード検索を閉じる"
            onClick={() => setModalOpen(false)}
          />

          <div className="deck-search-modal__panel">
            <div className="deck-search-modal__head">
              <div>
                <h2>カードを追加</h2>
                <p>カード名で検索して、採用したいカードを選択します。</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="deck-search-modal__close"
              >
                閉じる
              </button>
            </div>

            <label className="deck-search__label block text-sm font-bold text-slate-900 mb-1">
              カード名
            </label>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="deck-search__input w-full border rounded px-3 py-2 text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="例: グラジオの決戦"
            />

            <div className="deck-search-modal__body">
              {loading && (
                <p className="deck-search__loading text-sm font-bold text-slate-500">検索中...</p>
              )}
              {!query.trim() && !loading && (
                <div className="deck-search-modal__empty">
                  追加したいカード名を入力してください
                </div>
              )}
              {query.trim() && results.length === 0 && !loading && (
                <div className="deck-search-modal__empty">
                  該当するカードが見つかりません
                </div>
              )}
              {results.length > 0 && (
                <ul className="deck-search-modal__grid">
                  {results.map((card) => (
                    <li key={card.cardId}>
                      <button
                        type="button"
                        onClick={() => handleSelect(card)}
                        className="deck-search-modal__card"
                      >
                        <span className="deck-search-modal__image-wrap">
                          {card.illustration ? (
                            <img
                              src={card.illustration}
                              alt={card.name}
                              className="deck-search-modal__image"
                            />
                          ) : (
                            <span className="deck-search-modal__no-image">NO IMAGE</span>
                          )}
                        </span>
                        <span className="deck-search-modal__card-name">{card.name}</span>
                        {card.cardType && (
                          <span className="deck-search-modal__card-type">{card.cardType}</span>
                        )}
                        <span className="deck-search-modal__add-label">追加</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
