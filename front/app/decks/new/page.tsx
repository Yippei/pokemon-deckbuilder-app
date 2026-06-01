"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeckCard, createDeck, saveDeckId, generateDeck, maxCountForCard } from "@/lib/api";
import CardSearch from "@/components/CardSearch";

export default function NewDeckPage() {
  const router = useRouter();
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
  const backgroundBalls = [
    "great",
    "ultra",
    "master",
    "great",
    "master",
    "ultra",
    "great",
  ];
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI生成
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);

  const addCard = (card: DeckCard) => {
    setCards((prev) => {
      const existing = prev.find((c) => c.cardId === card.cardId);
      if (existing) {
        return prev.map((c) =>
          c.cardId === card.cardId ? { ...c, count: Math.min(maxCountForCard(c), c.count + 1) } : c
        );
      }
      return [...prev, card];
    });
  };

  const changeCount = (id: string, delta: number) => {
    setCards((prev) =>
      prev
        .map((c) => c.cardId === id ? { ...c, count: Math.min(maxCountForCard(c), Math.max(0, c.count + delta)) } : c)
        .filter((c) => c.count > 0)
    );
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.cardId !== id));
  };

  const handleGenerate = async () => {
    setGenerateError("");
    setGenerateWarnings([]);
    if (!theme.trim()) {
      setGenerateError("テーマを入力してください");
      return;
    }
    setGenerating(true);
    try {
      const generated = await generateDeck({
        theme: theme.trim(),
        existingDeck: cards.length > 0 ? cards : undefined,
      });
      setCards(generated.cards);
      setGenerateWarnings((generated.warnings || []).map((warning) => warning.message));
      if (!name.trim()) {
        const typeLabel = deckTypes.find((deckType) => deckType.type === selectedType)?.label;
        setName(`${typeLabel ? `${typeLabel} ` : ""}${theme.trim()}デッキ`);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("デッキ名を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const deck = await createDeck({ ownerId: "user1", name: name.trim(), cards });
      saveDeckId(deck.deckId);
      router.push(`/decks/view?id=${encodeURIComponent(deck.deckId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="deck-create-bg min-h-screen">
      <div className="pokeball-field" aria-hidden="true">
        {backgroundBalls.map((variant, index) => (
          <span key={`${variant}-${index}`} className={`ball-deco ball-deco-${variant}`} />
        ))}
      </div>
      <div className="deck-create-content max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-700">← 戻る</Link>
          <h1 className="text-2xl font-bold text-slate-950">デッキ作成</h1>
        </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* AI自動生成 */}
      <div className="mb-6 border rounded-lg p-4 bg-blue-50">
        <h2 className="text-sm font-bold mb-2 text-blue-700">✨ AIでデッキを自動生成</h2>
        <p className="text-xs text-blue-600 mb-3">
          テーマや使いたいポケモン名を入力するとAIが60枚デッキを提案します。
          {cards.length > 0 && "現在のカードリストを元に改善案を出すことも可能。"}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="例：ピカチュウex、れんげきウーラオス、炎デッキ"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded font-medium whitespace-nowrap"
          >
            {generating ? "生成中..." : "生成する"}
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
            AIがデッキを考えています...しばらくお待ちください
          </p>
        )}
      </div>

      {/* デッキ名 */}
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

      {/* デッキ名 */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-slate-900 mb-1">デッキ名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* カード追加 */}
      <div className="mb-6">
        <CardSearch onAdd={addCard} />
      </div>

      {/* カード一覧 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-slate-900">カード一覧</span>
          <span className={`text-sm ${totalCount === 60 ? "text-green-600 font-medium" : "text-gray-500"}`}>
            {totalCount} / 60 枚
          </span>
        </div>
        {cards.length === 0 ? (
          <p className="text-gray-400 text-sm">カードが追加されていません</p>
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.cardId} className="flex items-center justify-between border rounded px-3 py-2">
                <div className="flex items-center gap-3">
                  {c.illustration && (
                    <img src={c.illustration} alt={c.cardName} className="w-8 h-11 object-contain transition-transform duration-200 hover:scale-[4] hover:z-10 relative" />
                  )}
                  <span className="text-sm">{c.cardName || c.cardId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeCount(c.cardId, -1)}
                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-lg leading-none"
                  >－</button>
                  <span className="w-6 text-center text-sm font-medium">{c.count}</span>
                  <button
                    onClick={() => changeCount(c.cardId, 1)}
                    disabled={c.count >= maxCountForCard(c)}
                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-lg leading-none"
                  >＋</button>
                  <button
                    onClick={() => removeCard(c.cardId)}
                    className="ml-1 text-red-400 hover:text-red-600 text-sm"
                  >削除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 rounded font-medium"
      >
        {submitting ? "作成中..." : "デッキを作成する"}
      </button>
      </div>
    </main>
  );
}
