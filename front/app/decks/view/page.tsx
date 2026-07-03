"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Deck,
  DeckCard,
  getDeck,
  updateDeck,
  deleteDeck,
  removeDeckId,
  generateDeck,
  maxCountForCard,
  countCardsWithSameName,
  remainingCountForCardName,
} from "@/lib/api";
import CardSearch from "@/components/CardSearch";
import AuthGate from "@/components/AuthGate";
import AuthStatus from "@/components/AuthStatus";

export default function DeckPage() {
  const router = useRouter();
  const backgroundBalls = [
    "great",
    "ultra",
    "master",
    "great",
    "master",
    "ultra",
    "great",
  ];
  const deckTypes = [
    { type: "normal", label: "無", color: "#9ca3af", light: "#d1d5db" },
    { type: "fire", label: "炎", color: "#ef4444", light: "#fb923c" },
    { type: "water", label: "水", color: "#2563eb", light: "#38bdf8" },
    { type: "grass", label: "草", color: "#16a34a", light: "#86efac" },
    { type: "fighting", label: "闘", color: "#c2410c", light: "#fb923c" },
    { type: "psychic", label: "超", color: "#db2777", light: "#f9a8d4" },
    { type: "dark", label: "悪", color: "#1f2937", light: "#64748b" },
    { type: "dragon", label: "ドラゴン", color: "#d97706", light: "#fde68a" },
    { type: "electric", label: "雷", color: "#facc15", light: "#fef08a" },
  ];

  const [id, setId] = useState("");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // AI改善
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);

  useEffect(() => {
    const deckId = new URLSearchParams(window.location.search).get("id");
    if (!deckId) {
      router.push("/");
      return;
    }

    setId(deckId);
    getDeck(deckId)
      .then((d) => {
        setDeck(d);
        setName(d.name);
        setCards(d.cards);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);

  const addCard = (card: DeckCard) => {
    setCards((prev) => {
      const existing = prev.find((c) => c.cardId === card.cardId);
      if (existing) {
        if (remainingCountForCardName(prev, card) <= 0) return prev;
        return prev.map((c) =>
          c.cardId === card.cardId ? { ...c, count: c.count + 1 } : c
        );
      }
      if (remainingCountForCardName(prev, card) <= 0) return prev;
      return [...prev, card];
    });
  };

  const changeCount = (id: string, delta: number) => {
    setCards((prev) =>
      prev
        .map((c) => {
          if (c.cardId !== id) return c;
          if (delta <= 0) return { ...c, count: Math.max(0, c.count + delta) };

          const sameNameTotal = countCardsWithSameName(prev, c);
          const maxForThisName = maxCountForCard(c);
          if (sameNameTotal >= maxForThisName) return c;
          return { ...c, count: c.count + delta };
        })
        .filter((c) => c.count > 0)
    );
  };

  const removeCard = (id: string) => setCards((prev) => prev.filter((c) => c.cardId !== id));

  const handleGenerate = async () => {
    setGenerateError("");
    setGenerateWarnings([]);
    setGenerating(true);
    try {
      const typeLabel = deckTypes.find((deckType) => deckType.type === selectedType)?.label;
      const generated = await generateDeck({
        theme: theme.trim() || [typeLabel, name].filter(Boolean).join(" ") || name,
        existingDeck: cards,
      });
      setCards(generated.cards);
      setGenerateWarnings((generated.warnings || []).map((warning) => warning.message));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setError("");
    if (!name.trim()) {
      setError("デッキ名を入力してください");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateDeck(id, { name: name.trim(), cards });
      setDeck(updated);
      setCards(updated.cards);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      await deleteDeck(id);
      removeDeckId(id);
      router.push("/");
    } catch {
      setError("削除に失敗しました");
    }
  };

  if (loading) return <p className="p-6 text-gray-500">読み込み中...</p>;
  if (!deck) return null;

  return (
    <AuthGate>
    <main className="deck-create-bg min-h-screen">
      <div className="pokeball-field" aria-hidden="true">
        {backgroundBalls.map((variant, index) => (
          <span key={`${variant}-${index}`} className={`ball-deco ball-deco-${variant}`} />
        ))}
      </div>
      <div className="deck-create-content mx-auto max-w-2xl px-4 py-6 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/" className="shrink-0 text-gray-500 hover:text-gray-700">← 戻る</Link>
        <h1 className="min-w-[180px] flex-1 break-words text-2xl font-bold text-slate-950">
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-1 text-xl text-slate-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            deck.name
          )}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <AuthStatus compact />
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              編集
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* AI改善提案（編集中のみ） */}
      {editing && (
        <div className="mb-6 border rounded-lg p-4 bg-blue-50">
          <h2 className="text-sm font-bold mb-2 text-blue-700">✨ AIでデッキを改善</h2>
          <p className="text-xs text-blue-600 mb-3">
            現在のデッキをAIが分析して60枚の最適な構成を提案します。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="min-w-0 flex-1 rounded border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={`改善の方向性（任意）例：もっと速いデッキにしたい`}
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded font-medium whitespace-nowrap"
            >
              {generating ? "生成中..." : "改善する"}
            </button>
          </div>
          {generateError && <p className="text-red-500 text-xs mt-2">{generateError}</p>}
          {generateWarnings.length > 0 && (
            <ul className="text-amber-600 text-xs mt-2 space-y-1">
              {generateWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {generating && (
            <p className="text-blue-500 text-xs mt-2 animate-pulse">
              AIがデッキを分析しています...しばらくお待ちください
            </p>
          )}
        </div>
      )}

      {/* タイプ選択（編集中のみ） */}
      {editing && (
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-900 mb-2">タイプ選択</label>
          <div className="flex flex-wrap gap-2">
            {deckTypes.map((deckType) => (
              <button
                key={deckType.type}
                type="button"
                onClick={() => setSelectedType(deckType.type)}
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* カード追加（編集中のみ） */}
      {editing && (
        <div className="mb-6">
          <CardSearch onAdd={addCard} />
        </div>
      )}

      {/* カード一覧 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-slate-950">カード一覧</span>
          <span className={`text-sm font-medium ${totalCount === 60 ? "text-green-600" : "text-slate-800"}`}>
            {totalCount} / 60 枚
          </span>
        </div>
        {cards.length === 0 ? (
          <p className="text-gray-400 text-sm">カードがありません</p>
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.cardId} className="flex items-center justify-between gap-3 rounded border bg-white px-3 py-2 text-slate-950">
                <div className="flex min-w-0 items-center gap-3">
                  {c.illustration && (
                    <img src={c.illustration} alt={c.cardName} className="relative h-11 w-8 shrink-0 object-contain transition-transform duration-200 hover:z-10 hover:scale-[4]" />
                  )}
                  <span className="truncate text-sm text-slate-950">{c.cardName || c.cardId}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={() => changeCount(c.cardId, -1)}
                        className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-lg leading-none"
                      >－</button>
                      <span className="w-6 text-center text-sm font-medium">{c.count}</span>
                      <button
                        onClick={() => changeCount(c.cardId, 1)}
                        disabled={countCardsWithSameName(cards, c) >= maxCountForCard(c)}
                        className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-lg leading-none"
                      >＋</button>
                      <button
                        onClick={() => removeCard(c.cardId)}
                        className="ml-1 text-red-400 hover:text-red-600 text-sm"
                      >削除</button>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-slate-950">×{c.count}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ボタン */}
      {editing ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 rounded font-medium"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            onClick={() => { setEditing(false); setCards(deck.cards); setName(deck.name); }}
            className="px-6 bg-gray-100 hover:bg-gray-200 text-slate-800 rounded font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="px-6 bg-red-50 hover:bg-red-100 text-red-600 rounded font-medium"
          >
            デッキ削除
          </button>
        </div>
      ) : null}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="delete-dialog-title" className="mb-3 text-lg font-bold text-slate-950">
              デッキを削除した場合、復元できません。本当に宜しいですか？
            </h2>
            <p className="mb-6 text-sm text-slate-600">
              この操作は取り消せません。削除するとデッキは完全に消えます。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 rounded border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded bg-red-500 px-4 py-3 font-medium text-white hover:bg-red-600"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
    </AuthGate>
  );
}
