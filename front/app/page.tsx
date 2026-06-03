"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Deck, getDeck, getSavedDeckIds, removeDeckId } from "@/lib/api";

const deckTypes = [
  { type: "all", label: "全て", color: "#3b82f6", light: "#bfdbfe", keywords: [] },
  { type: "normal", label: "無", color: "#9ca3af", light: "#d1d5db", keywords: ["無", "無色", "ノーマル", "ダブルターボ"] },
  { type: "fire", label: "炎", color: "#ef4444", light: "#fb923c", keywords: ["炎", "ほのお", "基本炎エネルギー"] },
  { type: "water", label: "水", color: "#2563eb", light: "#38bdf8", keywords: ["水", "みず", "基本水エネルギー"] },
  { type: "grass", label: "草", color: "#16a34a", light: "#86efac", keywords: ["草", "くさ", "基本草エネルギー"] },
  { type: "fighting", label: "闘", color: "#c2410c", light: "#fb923c", keywords: ["闘", "とう", "基本闘エネルギー"] },
  { type: "psychic", label: "超", color: "#db2777", light: "#f9a8d4", keywords: ["超", "ちょう", "基本超エネルギー"] },
  { type: "dark", label: "悪", color: "#1f2937", light: "#64748b", keywords: ["悪", "あく", "基本悪エネルギー"] },
  { type: "dragon", label: "ドラゴン", color: "#d97706", light: "#fde68a", keywords: ["ドラゴン", "竜"] },
  { type: "electric", label: "雷", color: "#facc15", light: "#fef08a", keywords: ["雷", "かみなり", "基本雷エネルギー", "ピカチュウ"] },
];

const typeMarks = [
  { type: "normal", size: "72px", rotate: "-14deg", top: "7%", left: "5%" },
  { type: "fire", size: "90px", rotate: "18deg", top: "13%", right: "14%" },
  { type: "water", size: "58px", rotate: "-28deg", top: "30%", left: "18%" },
  { type: "grass", size: "64px", rotate: "31deg", top: "56%", right: "8%" },
  { type: "fighting", size: "54px", rotate: "15deg", top: "6%", left: "39%" },
  { type: "psychic", size: "54px", rotate: "9deg", top: "23%", right: "34%" },
  { type: "dark", size: "58px", rotate: "-25deg", top: "42%", left: "37%" },
  { type: "dragon", size: "96px", rotate: "22deg", bottom: "-24px", left: "43%" },
  { type: "electric", size: "104px", rotate: "8deg", top: "44%", left: "-26px" },
];

function getInitialSelectedType() {
  if (typeof window === "undefined") return "all";
  const type = new URLSearchParams(window.location.search).get("type");
  return type && deckTypes.some((deckType) => deckType.type === type) ? type : "all";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("デッキ取得がタイムアウトしました")), ms);
    }),
  ]);
}

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedType, setSelectedType] = useState(getInitialSelectedType);

  useEffect(() => {
    const fetchDecks = async () => {
      const ids = getSavedDeckIds();
      if (ids.length === 0) {
        setDecks([]);
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled(ids.map((id) => withTimeout(getDeck(id), 8000)));
      const loaded: Deck[] = [];
      let failedCount = 0;
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          loaded.push(r.value);
        } else {
          failedCount += 1;
          removeDeckId(ids[i]);
        }
      });
      setDecks(loaded);
      if (failedCount > 0) {
        setLoadError(`${failedCount}件のデッキを取得できませんでした。`);
      }
      setLoading(false);
    };
    fetchDecks();
  }, []);

  const inferDeckType = (deck: Deck) => {
    const text = [deck.name, ...deck.cards.map((card) => card.cardName || "")]
      .join(" ")
      .toLowerCase();
    return deckTypes.find((deckType) =>
      deckType.type !== "all" && deckType.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    )?.type;
  };

  const selectType = (type: string) => {
    setSelectedType(type);
    const url = type === "all" ? "/" : `/?type=${type}`;
    window.history.replaceState(null, "", url);
  };

  const visibleDecks = selectedType === "all"
    ? decks
    : decks.filter((deck) => inferDeckType(deck) === selectedType);
  const selectedTypeLabel = deckTypes.find((deckType) => deckType.type === selectedType)?.label || "全て";
  const listTitle = selectedType === "all" ? "作成した全てのデッキ" : `${selectedTypeLabel}タイプのデッキ`;
  const getTypeDeckCount = (type: string) => (
    type === "all" ? decks.length : decks.filter((deck) => inferDeckType(deck) === type).length
  );

  return (
    <main className="home-type-bg min-h-screen">
      <div className="type-mark-field" aria-hidden="true">
        {typeMarks.map((mark) => (
          <span
            key={mark.type}
            className={`type-mark type-mark-${mark.type}`}
            style={{
              "--type-size": mark.size,
              "--type-rotation": mark.rotate,
              top: mark.top,
              right: mark.right,
              bottom: mark.bottom,
              left: mark.left,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="home-content max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-950">デッキ一覧</h1>
          <Link
            href="/decks/new"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            ＋ 新規作成
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2" aria-label="タイプ別デッキ一覧">
          {deckTypes.map((deckType) => (
            <button
              key={deckType.type}
              type="button"
              onClick={() => selectType(deckType.type)}
              className={`type-action-button type-action-${deckType.type} flex h-10 w-[116px] shrink-0 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 ${
                selectedType === deckType.type ? "bg-white text-gray-950" : "bg-white/80 text-slate-700"
              } ${selectedType === deckType.type ? "type-filter-active" : ""}`}
              style={{
                borderColor: selectedType === deckType.type ? deckType.color : "rgba(148, 163, 184, 0.45)",
                boxShadow: selectedType === deckType.type ? `0 0 0 2px ${deckType.light}` : undefined,
              }}
            >
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${deckType.light}, ${deckType.color})`,
                  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.18)",
                }}
                aria-hidden="true"
              />
              <span>{deckType.label}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {loading ? "-" : getTypeDeckCount(deckType.type)}
              </span>
            </button>
          ))}
        </div>

        {loadError && <p className="mb-4 text-sm text-amber-600">{loadError}</p>}

        {!loading && decks.length > 0 && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">{listTitle}</h2>
            <span className="text-xs text-slate-500">{visibleDecks.length}件</span>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">読み込み中...</p>
        ) : decks.length === 0 ? (
          <p className="text-gray-500">デッキがまだありません。新規作成してみましょう！</p>
        ) : visibleDecks.length === 0 ? (
          <p className="text-slate-700">{selectedTypeLabel}タイプのデッキはまだありません。</p>
        ) : (
          <ul className="space-y-3">
            {visibleDecks.map((deck) => (
              <li key={deck.deckId}>
                <Link
                  href={`/decks/view?id=${encodeURIComponent(deck.deckId)}`}
                  className="block border rounded-lg bg-white p-4 text-slate-950 hover:bg-gray-50 transition"
                >
                  <div className="font-semibold text-lg text-slate-950">{deck.name}</div>
                  <div className="text-sm font-medium text-slate-700 mt-1">
                    {deck.cards.reduce((sum, c) => sum + c.count, 0)} 枚
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
