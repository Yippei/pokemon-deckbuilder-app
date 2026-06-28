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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 検索（300msデバウンス）
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const cards = await searchCards({ name: query.trim() });
        setResults(cards);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (card: Card) => {
    onAdd({ cardId: card.cardId, cardName: card.name, illustration: card.illustration, count: 1 });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="deck-search relative">
      <label className="deck-search__label block text-sm font-bold text-slate-900 mb-1">カードを追加（カード名で検索）</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="deck-search__input w-full border rounded px-3 py-2 text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {loading && (
        <p className="deck-search__loading text-xs text-gray-400 mt-1">検索中...</p>
      )}
      {open && results.length === 0 && !loading && (
        <div className="deck-search__empty absolute z-10 w-full bg-white border rounded shadow mt-1 px-3 py-2 text-sm text-black">
          該当するカードが見つかりません
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="deck-search__results absolute z-10 w-full bg-white border rounded shadow mt-1 max-h-72 overflow-y-auto text-black">
          {results.map((card) => (
            <li key={card.cardId}>
              <button
                onClick={() => handleSelect(card)}
                className="deck-search__result-button w-full text-left px-3 py-2 text-black hover:bg-blue-50 flex items-center gap-3"
              >
                {card.illustration && (
                  <img
                    src={card.illustration}
                    alt={card.name}
                    className="deck-search__thumb w-10 h-14 object-contain flex-shrink-0"
                  />
                )}
                <div>
                  <div className="deck-search__result-name text-sm font-medium text-black">{card.name}</div>
                  {card.cardType && (
                    <div className="deck-search__result-type text-xs text-slate-700">{card.cardType}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
