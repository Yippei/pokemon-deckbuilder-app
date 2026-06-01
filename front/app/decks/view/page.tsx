"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Deck, DeckCard, getDeck, updateDeck, deleteDeck, removeDeckId, generateDeck, maxCountForCard } from "@/lib/api";
import CardSearch from "@/components/CardSearch";

export default function DeckPage() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const removeCard = (id: string) => setCards((prev) => prev.filter((c) => c.cardId !== id));

  const handleGenerate = async () => {
    setGenerateError("");
    setGenerateWarnings([]);
    setGenerating(true);
    try {
      const generated = await generateDeck({
        theme: theme.trim() || name,
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
    if (!confirm("このデッキを削除しますか？")) return;
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
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-gray-700">← 戻る</Link>
        <h1 className="text-2xl font-bold flex-1">
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-1 text-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            deck.name
          )}
        </h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
          >
            編集
          </button>
        )}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* AI改善提案（編集中のみ） */}
      {editing && (
        <div className="mb-6 border rounded-lg p-4 bg-blue-50">
          <h2 className="text-sm font-bold mb-2 text-blue-700">✨ AIでデッキを改善</h2>
          <p className="text-xs text-blue-600 mb-3">
            現在のデッキをAIが分析して60枚の最適な構成を提案します。
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
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

      {/* カード追加（編集中のみ） */}
      {editing && (
        <div className="mb-6">
          <CardSearch onAdd={addCard} />
        </div>
      )}

      {/* カード一覧 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">カード一覧</span>
          <span className={`text-sm ${totalCount === 60 ? "text-green-600 font-medium" : "text-gray-500"}`}>
            {totalCount} / 60 枚
          </span>
        </div>
        {cards.length === 0 ? (
          <p className="text-gray-400 text-sm">カードがありません</p>
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
                  {editing ? (
                    <>
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
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">×{c.count}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ボタン */}
      {editing ? (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 rounded font-medium"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            onClick={() => { setEditing(false); setCards(deck.cards); setName(deck.name); }}
            className="px-6 bg-gray-100 hover:bg-gray-200 rounded font-medium"
          >
            キャンセル
          </button>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          className="w-full bg-red-50 hover:bg-red-100 text-red-500 py-3 rounded font-medium"
        >
          デッキを削除する
        </button>
      )}
    </main>
  );
}
