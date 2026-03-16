"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeckCard, createDeck, saveDeckId, generateDeck } from "@/lib/api";
import CardSearch from "@/components/CardSearch";

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI生成
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);

  const addCard = (card: DeckCard) => {
    setCards((prev) => {
      const existing = prev.find((c) => c.cardId === card.cardId);
      if (existing) {
        return prev.map((c) =>
          c.cardId === card.cardId ? { ...c, count: Math.min(4, c.count + 1) } : c
        );
      }
      return [...prev, card];
    });
  };

  const changeCount = (id: string, delta: number) => {
    setCards((prev) =>
      prev
        .map((c) => c.cardId === id ? { ...c, count: Math.min(4, Math.max(0, c.count + delta)) } : c)
        .filter((c) => c.count > 0)
    );
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.cardId !== id));
  };

  const handleGenerate = async () => {
    setGenerateError("");
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
      setCards(generated);
      if (!name.trim()) {
        setName(theme.trim() + "デッキ");
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
      router.push(`/decks/${deck.deckId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-gray-700">← 戻る</Link>
        <h1 className="text-2xl font-bold">デッキ作成</h1>
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
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
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
        {generating && (
          <p className="text-blue-500 text-xs mt-2 animate-pulse">
            AIがデッキを考えています...しばらくお待ちください
          </p>
        )}
      </div>

      {/* デッキ名 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">デッキ名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="例：れんげきウーラオスデッキ"
        />
      </div>

      {/* カード追加 */}
      <div className="mb-6">
        <CardSearch onAdd={addCard} />
      </div>

      {/* カード一覧 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">カード一覧</span>
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
                    <img src={c.illustration} alt={c.cardName} className="w-8 h-11 object-contain" />
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
                    disabled={c.count >= 4}
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
    </main>
  );
}
