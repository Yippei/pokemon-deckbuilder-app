"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Deck, getDeck, getSavedDeckIds, removeDeckId } from "@/lib/api";

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecks = async () => {
      const ids = getSavedDeckIds();
      const results = await Promise.allSettled(ids.map((id) => getDeck(id)));
      const loaded: Deck[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          loaded.push(r.value);
        } else {
          removeDeckId(ids[i]);
        }
      });
      setDecks(loaded);
      setLoading(false);
    };
    fetchDecks();
  }, []);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">デッキ一覧</h1>
        <Link
          href="/decks/new"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          ＋ 新規作成
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : decks.length === 0 ? (
        <p className="text-gray-500">デッキがまだありません。新規作成してみましょう！</p>
      ) : (
        <ul className="space-y-3">
          {decks.map((deck) => (
            <li key={deck.deckId}>
              <Link
                href={`/decks/${deck.deckId}`}
                className="block border rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="font-semibold text-lg">{deck.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {deck.cards.reduce((sum, c) => sum + c.count, 0)} 枚
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
