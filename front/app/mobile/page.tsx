"use client";

import { useEffect, useMemo, useState } from "react";
import type { Card, Deck, DeckCard } from "@/lib/api";
import { listDecks, searchCards } from "@/lib/api";
import { isAuthConfigured, isLoggedIn, login, logout, signup } from "@/lib/auth";

type MobileTab = "decks" | "search" | "status";

const deckTotalCount = 60;

function countDeckCards(cards: DeckCard[]) {
  return cards.reduce((sum, card) => sum + card.count, 0);
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCardInitial(name?: string) {
  return (name || "?").trim().slice(0, 1) || "?";
}

export default function MobilePage() {
  const [activeTab, setActiveTab] = useState<MobileTab>("decks");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [deckLoading, setDeckLoading] = useState(true);
  const [deckError, setDeckError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const updateAuthState = () => {
      setConfigured(isAuthConfigured());
      setLoggedIn(isLoggedIn());
    };
    updateAuthState();
    window.addEventListener("auth-changed", updateAuthState);
    window.addEventListener("storage", updateAuthState);
    return () => {
      window.removeEventListener("auth-changed", updateAuthState);
      window.removeEventListener("storage", updateAuthState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDecks = async () => {
      if (isAuthConfigured() && !isLoggedIn()) {
        setDecks([]);
        setSelectedDeckId("");
        setDeckLoading(false);
        return;
      }

      setDeckLoading(true);
      setDeckError("");
      try {
        const items = await listDecks();
        if (cancelled) return;
        setDecks(items);
        setSelectedDeckId((current) => current || items[0]?.deckId || "");
      } catch {
        if (!cancelled) {
          setDecks([]);
          setDeckError("デッキ一覧を取得できませんでした。");
        }
      } finally {
        if (!cancelled) setDeckLoading(false);
      }
    };
    loadDecks();
    return () => {
      cancelled = true;
    };
  }, [loggedIn, configured]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const items = await searchCards({ name: trimmedQuery });
        if (!controller.signal.aborted) {
          setSearchResults(items.slice(0, 30));
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSearchError("カード検索に失敗しました。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timerId);
    };
  }, [query]);

  const selectedDeck = useMemo(() => {
    return decks.find((deck) => deck.deckId === selectedDeckId) || decks[0] || null;
  }, [decks, selectedDeckId]);

  const selectedDeckCards = selectedDeck?.cards || [];
  const selectedDeckTotal = countDeckCards(selectedDeckCards);
  const pokemonCount = selectedDeckCards.filter((card) => /ポケモン|ex|V|GX/i.test(card.cardName || "")).length;
  const trainerCount = selectedDeckCards.filter((card) => /ボール|博士|指令|スタジアム|グッズ|サポート|どうぐ/.test(card.cardName || "")).length;
  const energyCount = selectedDeckCards.filter((card) => /エネルギー/.test(card.cardName || "")).length;

  const handleLogin = () => {
    void login("/mobile").catch((error) => {
      window.alert(error instanceof Error ? error.message : "ログインページを開けませんでした");
    });
  };

  const handleSignup = () => {
    void signup("/mobile").catch((error) => {
      window.alert(error instanceof Error ? error.message : "登録ページを開けませんでした");
    });
  };

  return (
    <main className="min-h-dvh bg-[#f7f8fb] text-slate-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#f7f8fb]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f7f8fb]/95 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase text-teal-700">PKS mobile</p>
              <h1 className="truncate text-2xl font-black tracking-normal">デッキビュー</h1>
            </div>
            {configured ? (
              loggedIn ? (
                <button
                  type="button"
                  onClick={logout}
                  className="h-10 shrink-0 rounded border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                >
                  退出
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSignup}
                    className="h-10 rounded border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                  >
                    登録
                  </button>
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="h-10 rounded bg-slate-950 px-4 text-sm font-black text-white"
                  >
                    ログイン
                  </button>
                </div>
              )
            ) : null}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4">
          {activeTab === "decks" ? (
            <div className="space-y-4">
              {configured && !loggedIn ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">ログインが必要です</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">保存済みデッキの閲覧にはログインしてください。</p>
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="mt-5 h-12 w-full rounded bg-slate-950 text-sm font-black text-white"
                  >
                    ログイン
                  </button>
                </section>
              ) : null}

              {deckError ? (
                <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{deckError}</p>
              ) : null}

              {deckLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
                  ))}
                </div>
              ) : null}

              {!deckLoading && decks.length > 0 ? (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {decks.map((deck) => {
                      const total = countDeckCards(deck.cards);
                      const selected = deck.deckId === selectedDeck?.deckId;
                      return (
                        <button
                          type="button"
                          key={deck.deckId}
                          onClick={() => setSelectedDeckId(deck.deckId)}
                          className={`min-w-[148px] rounded-lg border p-3 text-left shadow-sm ${
                            selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
                          }`}
                        >
                          <span className="block truncate text-sm font-black">{deck.name}</span>
                          <span className={`mt-2 block text-xs font-bold ${selected ? "text-slate-200" : "text-slate-500"}`}>
                            {total}/{deckTotalCount} 枚
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDeck ? (
                    <article className="space-y-4">
                      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-teal-700">選択中</p>
                            <h2 className="mt-1 truncate text-xl font-black">{selectedDeck.name}</h2>
                            <p className="mt-1 text-xs font-bold text-slate-500">更新 {formatDate(selectedDeck.updatedAt) || "-"}</p>
                          </div>
                          <div className="shrink-0 rounded bg-slate-100 px-3 py-2 text-right">
                            <span className="block text-xl font-black">{selectedDeckTotal}</span>
                            <span className="block text-[11px] font-black text-slate-500">枚</span>
                          </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded bg-slate-100">
                          <div
                            className="h-full rounded bg-teal-500"
                            style={{ width: `${Math.min(100, (selectedDeckTotal / deckTotalCount) * 100)}%` }}
                          />
                        </div>
                      </section>

                      <section className="grid grid-cols-3 gap-2">
                        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                          <span className="block text-[11px] font-black text-slate-500">候補P</span>
                          <strong className="mt-1 block text-lg font-black">{pokemonCount}</strong>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                          <span className="block text-[11px] font-black text-slate-500">候補T</span>
                          <strong className="mt-1 block text-lg font-black">{trainerCount}</strong>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                          <span className="block text-[11px] font-black text-slate-500">E</span>
                          <strong className="mt-1 block text-lg font-black">{energyCount}</strong>
                        </div>
                      </section>

                      <section className="space-y-2">
                        {selectedDeckCards.map((card) => (
                          <div key={card.cardId} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                            {card.illustration ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={card.illustration}
                                alt={card.cardName || "カード"}
                                className="h-16 w-11 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-slate-100 text-lg font-black text-slate-500">
                                {getCardInitial(card.cardName)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black">{card.cardName || "名称未設定"}</p>
                              <p className="mt-1 text-xs font-bold text-slate-500">ID {card.cardId}</p>
                            </div>
                            <strong className="flex h-9 min-w-9 items-center justify-center rounded bg-slate-950 px-2 text-sm font-black text-white">
                              x{card.count}
                            </strong>
                          </div>
                        ))}
                      </section>
                    </article>
                  ) : null}
                </>
              ) : null}

              {!deckLoading && (!configured || loggedIn) && decks.length === 0 ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <h2 className="text-lg font-black">デッキがありません</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">ブラウザ版で作成したデッキがここに表示されます。</p>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "search" ? (
            <div className="space-y-4">
              <div className="sticky top-[82px] z-10 bg-[#f7f8fb] pb-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-500">カード検索</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="カード名"
                    className="h-12 w-full rounded border border-slate-300 bg-white px-4 text-base font-bold outline-none focus:border-teal-500"
                  />
                </label>
              </div>
              {searchError ? (
                <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{searchError}</p>
              ) : null}
              {searchLoading ? <p className="text-sm font-bold text-slate-500">検索中...</p> : null}
              <section className="grid grid-cols-2 gap-3">
                {searchResults.map((card) => (
                  <div key={card.cardId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    {card.illustration ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.illustration} alt={card.name} className="aspect-[3/4] w-full rounded object-cover" />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center rounded bg-slate-100 text-3xl font-black text-slate-500">
                        {getCardInitial(card.name)}
                      </div>
                    )}
                    <h2 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5">{card.name}</h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">{card.cardType || card.regulation || `ID ${card.cardId}`}</p>
                  </div>
                ))}
              </section>
              {query.trim() && !searchLoading && searchResults.length === 0 && !searchError ? (
                <p className="text-sm font-bold text-slate-500">一致するカードがありません。</p>
              ) : null}
            </div>
          ) : null}

          {activeTab === "status" ? (
            <div className="space-y-3">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black">状態</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-slate-500">モード</dt>
                    <dd className="font-black">読み取り専用</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-slate-500">ログイン</dt>
                    <dd className="font-black">{configured ? (loggedIn ? "有効" : "未ログイン") : "未設定"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-slate-500">同期</dt>
                    <dd className="font-black">閲覧のみ</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-slate-500">デッキ数</dt>
                    <dd className="font-black">{decks.length}</dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : null}
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            <TabButton active={activeTab === "decks"} label="デッキ" mark="D" onClick={() => setActiveTab("decks")} />
            <TabButton active={activeTab === "search"} label="検索" mark="S" onClick={() => setActiveTab("search")} />
            <TabButton active={activeTab === "status"} label="状態" mark="I" onClick={() => setActiveTab("status")} />
          </div>
        </nav>
      </div>
    </main>
  );
}

function TabButton({
  active,
  label,
  mark,
  onClick,
}: {
  active: boolean;
  label: string;
  mark: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 items-center justify-center gap-2 rounded border text-sm font-black ${
        active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded text-xs ${active ? "bg-white text-slate-950" : "bg-white text-slate-500"}`}>
        {mark}
      </span>
      <span>{label}</span>
    </button>
  );
}
