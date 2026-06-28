"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeckCard, createDeck, saveDeckId, generateDeck, maxCountForCard } from "@/lib/api";
import CardSearch from "@/components/CardSearch";
import AuthGate from "@/components/AuthGate";
import AuthStatus from "@/components/AuthStatus";

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
  const quickThemeButtons = [
    { label: "安定型", value: "事故りにくい安定型デッキ" },
    { label: "手札干渉", value: "手札干渉を厚めに入れたデッキ" },
    { label: "LO", value: "LO寄りの勝ち筋を狙うデッキ" },
    { label: "速攻", value: "初動を重視した速攻デッキ" },
    { label: "耐久", value: "受け返しを意識した耐久デッキ" },
    { label: "コンボ", value: "コンボの再現性を重視したデッキ" },
  ];
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [pokemonName, setPokemonName] = useState("");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI生成
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
  const selectedTypeMeta = deckTypes.find((deckType) => deckType.type === selectedType);
  const selectedTypeLabel = selectedTypeMeta?.label ?? "未選択";
  const selectedTypeColor = selectedTypeMeta?.color ?? "#94a3b8";
  const selectedTypeLight = selectedTypeMeta?.light ?? "#d1d5db";
  const deckStatusLabel = totalCount >= 60 ? "完成" : totalCount >= 40 ? "仕上げ中" : totalCount >= 20 ? "構築中" : "準備中";
  const selectedPlanLabel = quickThemeButtons.find((item) => item.value === selectedPlan)?.label ?? "未選択";

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
    const generationParts = [
      selectedTypeMeta ? `タイプ: ${selectedTypeLabel}` : "",
      selectedPlan ? `方針: ${selectedPlan}` : "",
      pokemonName.trim() ? `中心ポケモン: ${pokemonName.trim()}` : "",
      theme.trim() ? `補足: ${theme.trim()}` : "",
    ].filter(Boolean);

    if (generationParts.length === 0) {
      setGenerateError("タイプ、方針、ポケモン名、補足のいずれかを入力してください");
      return;
    }
    setGenerating(true);
    try {
      const generated = await generateDeck({
        theme: generationParts.join(" / "),
        existingDeck: cards.length > 0 ? cards : undefined,
        generationContext: {
          selectedType,
          selectedPlan,
          pokemonName,
          supplementalTheme: theme,
        },
      });
      setCards(generated.cards);
      setGenerateWarnings((generated.warnings || []).map((warning) => warning.message));
      if (!name.trim()) {
        const titleParts = [selectedTypeLabel, selectedPlanLabel, pokemonName.trim(), theme.trim()].filter(Boolean);
        setName(`${titleParts.join(" ").slice(0, 40)}デッキ`);
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
      const deck = await createDeck({ name: name.trim(), cards });
      saveDeckId(deck.deckId);
      router.push(`/decks/view?id=${encodeURIComponent(deck.deckId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGate>
      <main className="deck-create-bg min-h-screen">
        <div className="pokeball-field" aria-hidden="true">
          {backgroundBalls.map((variant, index) => (
            <span key={`${variant}-${index}`} className={`ball-deco ball-deco-${variant}`} />
          ))}
        </div>

        <div className="deck-create-content mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              ← 戻る
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">デッキ作成</h1>
              <p className="text-sm text-slate-600">AI生成と手動編集を同じ画面で扱う作成スペース</p>
            </div>
            <div className="ml-auto">
              <AuthStatus compact />
            </div>
          </header>

          <section className="deck-studio-hero mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/78 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="deck-studio-hero__grid">
              <div className="deck-studio-hero__copy">
                <div className="home-kicker">DECK STUDIO</div>
                <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  事故りにくいデッキを、その場で組む
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
                  テーマを入れてAI生成、カードを見ながら微調整、最後にそのまま保存。編集と確認を一つの画面で完結させます。
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="home-metric">
                    <span className="home-metric__label">採用枚数</span>
                    <span className="home-metric__value">{totalCount}</span>
                  </div>
                  <div className="home-metric">
                    <span className="home-metric__label">残り</span>
                    <span className="home-metric__value">{Math.max(0, 60 - totalCount)}</span>
                  </div>
                  <div className="home-metric">
                    <span className="home-metric__label">カード数</span>
                    <span className="home-metric__value">{cards.length}</span>
                  </div>
                  <div className="home-metric">
                    <span className="home-metric__label">タイプ</span>
                    <span className="home-metric__value home-metric__value--type">
                      <span
                        className="deck-studio-summary-type"
                        style={{
                          borderColor: selectedTypeColor,
                          background: selectedTypeMeta
                            ? `linear-gradient(135deg, color-mix(in srgb, ${selectedTypeLight} 30%, white), rgba(255,255,255,0.95))`
                            : "rgba(255, 255, 255, 0.95)",
                        }}
                      >
                        <span
                          className="deck-studio-summary-type__dot"
                          style={{
                            background: selectedTypeMeta
                              ? `linear-gradient(135deg, ${selectedTypeLight}, ${selectedTypeColor})`
                              : "linear-gradient(135deg, #cbd5e1, #94a3b8)",
                          }}
                        />
                        <span className="deck-studio-summary-type__label">{selectedTypeLabel}</span>
                      </span>
                    </span>
                  </div>
                </div>

                <div className="deck-studio-hero__quick-themes" aria-label="テーマの例">
                  {quickThemeButtons.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setSelectedPlan(item.value);
                      }}
                      className={`deck-studio-hero__quick-theme ${
                        selectedPlan === item.value ? "deck-studio-hero__quick-theme--active" : ""
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="deck-studio-hero__visual">
                <div className="deck-studio-hero__panel">
                  <div className="deck-studio-hero__panel-top">
                    <span>LIVE BUILD</span>
                    <span>{deckStatusLabel}</span>
                  </div>
                  <div className="deck-studio-hero__deck-ring">
                    <div className="deck-studio-hero__deck-ring-inner" />
                  </div>
                  <div className="deck-studio-hero__panel-bottom deck-studio-hero__type-picker">
                    <span className="deck-studio-hero__type-label">TYPE</span>
                    <p className="deck-studio-hero__type-help">押すだけでデッキの軸を切り替えられます。</p>
                    <div className="deck-studio-hero__type-grid" role="group" aria-label="タイプ選択">
                      {deckTypes.map((deckType) => (
                        <button
                          key={deckType.type}
                          type="button"
                          onClick={() => setSelectedType(deckType.type)}
                          className={`deck-studio-hero__type-pill deck-studio-hero__type-pill--text type-action-button type-action-${deckType.type} w-fit ${
                            selectedType === deckType.type ? "type-filter-active deck-studio-hero__type-pill--active" : ""
                          }`}
                          style={{
                            borderColor: selectedType === deckType.type ? deckType.color : "rgba(148, 163, 184, 0.45)",
                            boxShadow: selectedType === deckType.type ? `0 0 0 2px ${deckType.light}` : undefined,
                          }}
                          aria-pressed={selectedType === deckType.type}
                          aria-label={`${deckType.label}タイプを選択`}
                        >
                          <span className={`type-filter-dot type-filter-${deckType.type}`} aria-hidden="true" />
                          <span>{deckType.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="deck-studio-hero__type-selected">
                      <span>選択中: {selectedTypeLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <section className="deck-panel rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">AIでデッキを自動生成</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      タイプ、方針、ポケモン名を分けて入れると、意図に沿って提案します。
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {selectedTypeLabel} / {selectedPlanLabel}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <input
                    type="text"
                    value={pokemonName}
                    onChange={(e) => setPokemonName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-sky-200"
                    placeholder="使いたいポケモン名を入力"
                  />
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-sky-200"
                    placeholder="補足テーマや回したい方針を入力"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {generating ? "生成中..." : "生成する"}
                  </button>
                </div>

                {generateError && <p className="mt-3 text-xs font-medium text-rose-600">{generateError}</p>}
                {generateWarnings.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs font-medium text-amber-700">
                    {generateWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                {generating && (
                  <p className="mt-3 text-xs font-semibold text-sky-600 animate-pulse">
                    AIがタイプ・方針・ポケモン名をまとめています...しばらくお待ちください
                  </p>
                )}
              </section>

              <section className="deck-panel rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
                <label className="block text-sm font-bold text-slate-900">デッキ名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-sky-200"
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? "作成中..." : "デッキを作成する"}
                </button>
              </section>
            </div>

            <div className="space-y-6">
              <section className="deck-panel rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">カード追加</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      検索して、必要なカードを追加します。
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    SEARCH
                  </div>
                </div>
                <div className="mt-4">
                  <CardSearch onAdd={addCard} />
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">カード一覧</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      枚数調整しながら、60枚に近づけます。
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${totalCount === 60 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {totalCount} / 60 枚
                  </span>
                </div>

                <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalCount / 60) * 100)}%` }}
                  />
                </div>

                {cards.length === 0 ? (
                  <p className="text-sm text-slate-500">カードが追加されていません</p>
                ) : (
                  <ul className="space-y-2">
                    {cards.map((c) => (
                      <li
                        key={c.cardId}
                        className="deck-card-row flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-black shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {c.illustration && (
                            <img
                              src={c.illustration}
                              alt={c.cardName}
                              className="deck-card-thumb relative h-11 w-8 shrink-0 object-contain transition-transform duration-200 hover:z-10 hover:scale-[4]"
                            />
                          )}
                          <span className="truncate text-sm font-medium text-slate-900">{c.cardName || c.cardId}</span>
                        </div>
                        <div className="deck-card-actions flex items-center gap-2">
                          <button
                            onClick={() => changeCount(c.cardId, -1)}
                            className="deck-action-button inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg leading-none text-slate-600 transition hover:bg-slate-50"
                          >
                            －
                          </button>
                          <span className="deck-card-count w-6 text-center text-sm font-bold text-slate-900">{c.count}</span>
                          <button
                            onClick={() => changeCount(c.cardId, 1)}
                            disabled={c.count >= maxCountForCard(c)}
                            className="deck-action-button inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg leading-none text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ＋
                          </button>
                          <button
                            onClick={() => removeCard(c.cardId)}
                            className="deck-remove-button ml-1 text-sm font-semibold text-rose-500 transition hover:text-rose-700"
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
