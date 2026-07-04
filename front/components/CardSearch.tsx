"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { DeckCard } from "@/lib/api";

type Props = {
  onAdd: (card: DeckCard) => void;
};

type CardCategory = "" | "pokemon" | "item" | "supporter" | "tool" | "stadium" | "energy";

type CardMasterEntry = {
  cardId: string;
  name: string;
  cardKind?: string;
  subKind?: string;
  regulation?: string;
  setName?: string;
  stage?: string;
  imageUrl?: string;
  searchTokens?: string[];
};

type CardMasterPayload = {
  cards?: Record<string, CardMasterEntry>;
};

type SearchableCard = CardMasterEntry & {
  category: CardCategory;
  categoryLabel: string;
  searchText: string;
};

const categoryFilters: { label: string; value: CardCategory }[] = [
  { label: "ポケモン", value: "pokemon" },
  { label: "グッズ", value: "item" },
  { label: "サポート", value: "supporter" },
  { label: "どうぐ", value: "tool" },
  { label: "スタジアム", value: "stadium" },
  { label: "エネルギー", value: "energy" },
];

function normalizeSearchText(value?: string) {
  return String(value || "").replace(/[ 　・\-－]/g, "").toLowerCase();
}

function getCardCategory(card: CardMasterEntry): { value: CardCategory; label: string } {
  const kind = String(card.cardKind || "").toLowerCase();
  const subKind = String(card.subKind || "");
  const stage = String(card.stage || "");

  if (kind.includes("pokemon") || subKind.includes("ポケモン") || stage.includes("たね") || stage.includes("進化")) {
    return { value: "pokemon", label: "ポケモン" };
  }
  if (kind.includes("energy") || subKind.includes("エネルギー") || stage.includes("エネルギー")) {
    return { value: "energy", label: "エネルギー" };
  }
  if (subKind.includes("ポケモンのどうぐ") || subKind.includes("どうぐ") || stage.includes("ポケモンのどうぐ")) {
    return { value: "tool", label: "どうぐ" };
  }
  if (subKind.includes("サポート") || stage.includes("サポート")) {
    return { value: "supporter", label: "サポート" };
  }
  if (subKind.includes("スタジアム") || stage.includes("スタジアム")) {
    return { value: "stadium", label: "スタジアム" };
  }
  if (subKind.includes("グッズ") || stage.includes("グッズ") || kind.includes("trainer")) {
    return { value: "item", label: "グッズ" };
  }
  return { value: "", label: subKind || "その他" };
}

function toSearchableCard(card: CardMasterEntry): SearchableCard {
  const category = getCardCategory(card);
  return {
    ...card,
    category: category.value,
    categoryLabel: category.label,
    searchText: [
      card.name,
      card.subKind,
      card.stage,
      card.regulation,
      card.setName,
      ...(card.searchTokens || []),
    ].map(normalizeSearchText).join(" "),
  };
}

export default function CardSearch({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [allCards, setAllCards] = useState<SearchableCard[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CardCategory>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modalOpen || allCards.length > 0 || loading) return;

    let cancelled = false;
    fetch("/card-master-lite.json")
      .then((res) => {
        if (!res.ok) throw new Error("カードマスターの取得に失敗しました");
        return res.json();
      })
      .then((payload: CardMasterPayload) => {
        if (cancelled) return;
        const cards = Object.values(payload.cards || {})
          .map(toSearchableCard)
          .sort((a, b) => Number(a.cardId) - Number(b.cardId));
        setAllCards(cards);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "カードマスターの取得に失敗しました");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allCards.length, loading, modalOpen]);

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

  const filteredCards = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return allCards.filter((card) => {
      if (categoryFilter && card.category !== categoryFilter) return false;
      if (normalizedQuery && !card.searchText.includes(normalizedQuery)) return false;
      return true;
    });
  }, [allCards, categoryFilter, query]);

  const handleSelect = (card: SearchableCard) => {
    onAdd({
      cardId: card.cardId,
      cardName: card.name,
      illustration: card.imageUrl,
      count: 1,
    });
  };

  const openModal = () => {
    setModalOpen(true);
    if (allCards.length === 0) {
      setLoading(true);
      setLoadError("");
    }
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
            <p>全カードから検索・絞り込みして、採用したいカードを選択します。</p>
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
              {filteredCards.length} / {allCards.length} 枚
            </span>
          </div>
        </div>

        <div className="deck-search-modal__body">
          {loading && (
            <p className="deck-search__loading text-sm font-bold text-slate-500">カードを読み込み中...</p>
          )}
          {loadError && !loading && (
            <div className="deck-search-modal__empty">{loadError}</div>
          )}
          {!loadError && !loading && allCards.length === 0 && (
            <div className="deck-search-modal__empty">カードが見つかりません</div>
          )}
          {!loadError && !loading && allCards.length > 0 && filteredCards.length === 0 && (
            <div className="deck-search-modal__empty">条件に合うカードがありません</div>
          )}
          {filteredCards.length > 0 && (
            <ul className="deck-search-modal__grid">
              {filteredCards.map((card) => (
                <li key={card.cardId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(card)}
                    className="deck-search-modal__card"
                  >
                    <span className="deck-search-modal__image-wrap">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
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
                    {(card.regulation || card.stage || card.subKind) && (
                      <span className="deck-search-modal__card-meta">
                        {[card.regulation, card.stage, card.subKind].filter(Boolean).join(" / ")}
                      </span>
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
        onClick={openModal}
        className="deck-search__open-button"
      >
        カードを追加
      </button>

      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </div>
  );
}
