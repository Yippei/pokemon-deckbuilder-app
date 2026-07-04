"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Card, DeckCard, searchCards } from "@/lib/api";

type Props = {
  onAdd: (card: DeckCard) => void;
};

type CardMasterEntry = {
  regulation?: string;
  rarity?: string;
  rare?: string;
  rarityCode?: string;
  stage?: string;
  stageOrder?: number;
};

type CardMasterPayload = {
  cards?: Record<string, CardMasterEntry>;
};

type StageFilter = "" | "basic" | "stage1" | "stage2";

type EnrichedCard = Card & {
  filterRegulation: string;
  filterRarity: string;
  filterStage: StageFilter;
  filterStageLabel: string;
};

function normalizeStageText(stage?: string) {
  return String(stage || "").replace(/[ 　]/g, "");
}

function getStageFilter(master?: CardMasterEntry): { value: StageFilter; label: string } {
  const order = Number(master?.stageOrder);
  const stage = normalizeStageText(master?.stage);
  if (order === 0 || stage.includes("たね")) return { value: "basic", label: "たね" };
  if (order === 1 || stage.includes("1進化")) return { value: "stage1", label: "1進化" };
  if (order === 2 || stage.includes("2進化")) return { value: "stage2", label: "2進化" };
  return { value: "", label: "" };
}

function getRarity(master?: CardMasterEntry) {
  return String(master?.rarity || master?.rare || master?.rarityCode || "").trim();
}

export default function CardSearch({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cardMaster, setCardMaster] = useState<Record<string, CardMasterEntry>>({});
  const [regulationFilter, setRegulationFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!modalOpen || Object.keys(cardMaster).length > 0) return;

    let cancelled = false;
    fetch("/card-master-lite.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: CardMasterPayload | null) => {
        if (!cancelled && payload?.cards) {
          setCardMaster(payload.cards);
        }
      })
      .catch(() => {
        if (!cancelled) setCardMaster({});
      });

    return () => {
      cancelled = true;
    };
  }, [cardMaster, modalOpen]);

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

  const enrichedResults = useMemo<EnrichedCard[]>(() => {
    return results.map((card) => {
      const master = cardMaster[card.cardId];
      const stage = getStageFilter(master);
      return {
        ...card,
        filterRegulation: String(master?.regulation || card.regulation || "").trim(),
        filterRarity: getRarity(master),
        filterStage: stage.value,
        filterStageLabel: stage.label,
      };
    });
  }, [cardMaster, results]);

  const regulationOptions = useMemo(() => {
    return Array.from(new Set(enrichedResults.map((card) => card.filterRegulation).filter(Boolean))).sort();
  }, [enrichedResults]);

  const rarityOptions = useMemo(() => {
    return Array.from(new Set(enrichedResults.map((card) => card.filterRarity).filter(Boolean))).sort();
  }, [enrichedResults]);

  const filteredResults = useMemo(() => {
    return enrichedResults.filter((card) => {
      if (regulationFilter && card.filterRegulation !== regulationFilter) return false;
      if (rarityFilter && card.filterRarity !== rarityFilter) return false;
      if (stageFilter && card.filterStage !== stageFilter) return false;
      return true;
    });
  }, [enrichedResults, rarityFilter, regulationFilter, stageFilter]);

  const hasActiveFilter = Boolean(regulationFilter || rarityFilter || stageFilter);

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
            <label className="deck-search-modal__filter-field">
              <span>レギュレーション</span>
              <select
                value={regulationFilter}
                onChange={(event) => setRegulationFilter(event.target.value)}
              >
                <option value="">すべて</option>
                {regulationOptions.map((regulation) => (
                  <option key={regulation} value={regulation}>
                    {regulation}
                  </option>
                ))}
              </select>
            </label>

            <label className="deck-search-modal__filter-field">
              <span>レアリティ</span>
              <select
                value={rarityFilter}
                onChange={(event) => setRarityFilter(event.target.value)}
                disabled={rarityOptions.length === 0}
              >
                <option value="">{rarityOptions.length === 0 ? "データなし" : "すべて"}</option>
                {rarityOptions.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>

            <div className="deck-search-modal__stage-filter" role="group" aria-label="進化段階">
              {[
                { label: "たね", value: "basic" as StageFilter },
                { label: "1進化", value: "stage1" as StageFilter },
                { label: "2進化", value: "stage2" as StageFilter },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStageFilter((current) => (current === item.value ? "" : item.value))}
                  className={stageFilter === item.value ? "deck-search-modal__stage-button deck-search-modal__stage-button--active" : "deck-search-modal__stage-button"}
                  aria-pressed={stageFilter === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setRegulationFilter("");
                  setRarityFilter("");
                  setStageFilter("");
                }}
                className="deck-search-modal__filter-clear"
              >
                解除
              </button>
            )}
          </div>
        </div>

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
          {query.trim() && results.length > 0 && filteredResults.length === 0 && !loading && (
            <div className="deck-search-modal__empty">
              絞り込み条件に合うカードがありません
            </div>
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
                        />
                      ) : (
                        <span className="deck-search-modal__no-image">NO IMAGE</span>
                      )}
                    </span>
                    <span className="deck-search-modal__card-name">{card.name}</span>
                    {card.cardType && (
                      <span className="deck-search-modal__card-type">{card.cardType}</span>
                    )}
                    {(card.filterRegulation || card.filterRarity || card.filterStageLabel) && (
                      <span className="deck-search-modal__card-meta">
                        {[card.filterRegulation, card.filterRarity, card.filterStageLabel].filter(Boolean).join(" / ")}
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
        onClick={() => setModalOpen(true)}
        className="deck-search__open-button"
      >
        カードを追加
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
