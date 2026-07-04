"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Card, DeckCard, searchCards } from "@/lib/api";

type Props = {
  onAdd: (card: DeckCard) => void;
};

type CardCategory = "" | "pokemon" | "item" | "supporter" | "tool" | "stadium" | "energy";

type SearchableCard = Card & {
  category: CardCategory;
  categoryLabel: string;
};

const categoryFilters: { label: string; value: CardCategory }[] = [
  { label: "ポケモン", value: "pokemon" },
  { label: "グッズ", value: "item" },
  { label: "サポート", value: "supporter" },
  { label: "どうぐ", value: "tool" },
  { label: "スタジアム", value: "stadium" },
  { label: "エネルギー", value: "energy" },
];

function getCardCategory(card: Card): { value: CardCategory; label: string } {
  const type = String(card.cardType || "");
  const name = String(card.name || "");

  if (type.includes("ポケモン")) return { value: "pokemon", label: "ポケモン" };
  if (type.includes("エネルギー")) return { value: "energy", label: "エネルギー" };
  if (type.includes("ポケモンのどうぐ") || type.includes("どうぐ")) return { value: "tool", label: "どうぐ" };
  if (type.includes("サポート")) return { value: "supporter", label: "サポート" };
  if (type.includes("スタジアム")) return { value: "stadium", label: "スタジアム" };
  if (type.includes("グッズ")) return { value: "item", label: "グッズ" };
  if (type.includes("トレーナーズ")) return { value: "", label: "トレーナーズ" };
  if (name.includes("エネルギー")) return { value: "energy", label: "エネルギー" };
  return { value: "", label: type || "その他" };
}

export default function CardSearch({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchableCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CardCategory>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modalOpen || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const cards = await searchCards({ name: query.trim() });
        if (cancelled) return;
        setResults(cards.map((card) => {
          const category = getCardCategory(card);
          return {
            ...card,
            category: category.value,
            categoryLabel: category.label,
          };
        }));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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

  const filteredResults = useMemo(() => {
    return results.filter((card) => {
      if (categoryFilter && card.category !== categoryFilter) return false;
      return true;
    });
  }, [categoryFilter, results]);

  const handleSelect = (card: SearchableCard) => {
    onAdd({
      cardId: card.cardId,
      cardName: card.name,
      illustration: card.illustration,
      count: 1,
    });
  };

  const hasActiveFilter = Boolean(categoryFilter || query.trim());

  const modal = modalOpen ? (
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

        <div className="deck-search-modal__search">
          <label className="deck-search__label block text-sm font-bold text-slate-900 mb-1">
            カード名
          </label>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="deck-search__input w-full border rounded px-3 py-2 text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="例: ピカチュウ"
          />

          <div className="deck-search-modal__filters" aria-label="カード検索の絞り込み">
            <div className="deck-search-modal__stage-filter" role="group" aria-label="カード種別">
              {categoryFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategoryFilter((current) => (current === item.value ? "" : item.value))}
                  className={categoryFilter === item.value ? "deck-search-modal__stage-button deck-search-modal__stage-button--active" : "deck-search-modal__stage-button"}
                  aria-pressed={categoryFilter === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategoryFilter("");
                }}
                className="deck-search-modal__filter-clear"
              >
                解除
              </button>
            )}

            <span className="deck-search-modal__result-count">
              {query.trim() ? `${filteredResults.length} / ${results.length} 枚` : "未検索"}
            </span>
          </div>
        </div>

        <div className="deck-search-modal__body">
          {loading && (
            <p className="deck-search__loading text-sm font-bold text-slate-500">検索中...</p>
          )}
          {!query.trim() && !loading && (
            <div className="deck-search-modal__empty">
              カード名を入力すると検索結果が表示されます
            </div>
          )}
          {query.trim() && results.length === 0 && !loading && (
            <div className="deck-search-modal__empty">該当するカードが見つかりません</div>
          )}
          {query.trim() && results.length > 0 && filteredResults.length === 0 && !loading && (
            <div className="deck-search-modal__empty">条件に合うカードがありません</div>
          )}
          {filteredResults.length > 0 && (
            <ul className="deck-search-modal__grid">
              {filteredResults.map((card) => (
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
                          loading="lazy"
                        />
                      ) : (
                        <span className="deck-search-modal__no-image">NO IMAGE</span>
                      )}
                    </span>
                    <span className="deck-search-modal__card-name">{card.name}</span>
                    <span className="deck-search-modal__card-type">{card.categoryLabel}</span>
                    {card.regulation && (
                      <span className="deck-search-modal__card-meta">{card.regulation}</span>
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
  ) : null;

  return (
    <div className="deck-search">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="deck-search__open-button"
      >
        カードを追加
      </button>

      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </div>
  );
}
