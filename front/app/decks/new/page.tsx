"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DeckCard,
  createDeck,
  saveDeckId,
  generateDeck,
  maxCountForCard,
  countCardsWithSameName,
  remainingCountForCardName,
} from "@/lib/api";
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
  const deckStatusLabel = totalCount >= 60 ? "完成" : totalCount >= 40 ? "仕上げ中" : totalCount >= 20 ? "構築中" : "準備中";
  const selectedPlanLabel = quickThemeButtons.find((item) => item.value === selectedPlan)?.label ?? "未選択";

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
      <main className="deck-builder-page min-h-screen">
        <div className="deck-builder-shell mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <header className="deck-builder-topbar">
            <div className="deck-builder-topbar__left">
              <Link href="/" className="deck-builder-back-button" aria-label="トップへ戻る">
                ←
              </Link>
              <div>
                <p className="deck-builder-kicker">DECK BUILDER</p>
                <h1 className="deck-builder-title">デッキ作成</h1>
              </div>
            </div>
            <div className="deck-builder-topbar__right">
              <AuthStatus compact />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="deck-builder-save-button"
              >
                {submitting ? "保存中..." : "保存"}
              </button>
            </div>
          </header>

          {error && (
            <div className="deck-builder-alert deck-builder-alert--error">
              {error}
            </div>
          )}

          <section className="deck-builder-status">
            <div>
              <span className="deck-builder-status__label">STATUS</span>
              <strong>{deckStatusLabel}</strong>
            </div>
            <div>
              <span className="deck-builder-status__label">CARDS</span>
              <strong>{totalCount} / 60</strong>
            </div>
            <div>
              <span className="deck-builder-status__label">UNIQUE</span>
              <strong>{cards.length}</strong>
            </div>
            <div>
              <span className="deck-builder-status__label">TYPE</span>
              <strong>{selectedTypeLabel}</strong>
            </div>
            <div className="deck-builder-status__progress" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (totalCount / 60) * 100)}%` }} />
            </div>
          </section>

          <div className="deck-builder-layout">
            <aside className="deck-builder-rail">
              <section className="deck-builder-panel">
                <div className="deck-builder-panel__head">
                  <h2>設計</h2>
                  <span>{selectedPlanLabel}</span>
                </div>

                <label className="deck-builder-field">
                  <span>デッキ名</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: リザードンex 安定型"
                  />
                </label>

                <div className="deck-builder-block">
                  <span className="deck-builder-field-label">タイプ</span>
                  <div className="deck-builder-type-grid" role="group" aria-label="タイプ選択">
                    {deckTypes.map((deckType) => (
                      <button
                        key={deckType.type}
                        type="button"
                        onClick={() => setSelectedType(deckType.type)}
                        className={`deck-builder-type-button ${selectedType === deckType.type ? "deck-builder-type-button--active" : ""}`}
                        style={{
                          borderColor: selectedType === deckType.type ? deckType.color : undefined,
                          boxShadow: selectedType === deckType.type ? `0 0 0 3px ${deckType.light}` : undefined,
                        }}
                        aria-pressed={selectedType === deckType.type}
                      >
                        <span
                          aria-hidden="true"
                          style={{ background: `linear-gradient(135deg, ${deckType.light}, ${deckType.color})` }}
                        />
                        {deckType.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="deck-builder-block">
                  <span className="deck-builder-field-label">方針</span>
                  <div className="deck-builder-plan-grid" role="group" aria-label="方針選択">
                    {quickThemeButtons.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setSelectedPlan(item.value)}
                        className={selectedPlan === item.value ? "deck-builder-plan-button deck-builder-plan-button--active" : "deck-builder-plan-button"}
                        aria-pressed={selectedPlan === item.value}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="deck-builder-field">
                  <span>中心ポケモン</span>
                  <input
                    type="text"
                    value={pokemonName}
                    onChange={(e) => setPokemonName(e.target.value)}
                    placeholder="使いたいポケモン名"
                  />
                </label>

                <label className="deck-builder-field">
                  <span>補足</span>
                  <textarea
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="入れたいカード、避けたい構築、回し方など"
                    rows={4}
                  />
                </label>

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="deck-builder-generate-button"
                >
                  {generating ? "生成中..." : "AIで構築"}
                </button>

                {generateError && <p className="deck-builder-message deck-builder-message--error">{generateError}</p>}
                {generateWarnings.length > 0 && (
                  <ul className="deck-builder-warnings">
                    {generateWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                {generating && (
                  <p className="deck-builder-message deck-builder-message--loading">
                    生成しています。既存のカードがある場合は内容を踏まえて再構築します。
                  </p>
                )}
              </section>
            </aside>

            <section className="deck-builder-workspace">
              <div className="deck-builder-command-row">
                <div>
                  <h2>カード編集</h2>
                  <p>検索で追加し、枚数を調整して60枚に近づけます。</p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="deck-builder-command-save"
                >
                  {submitting ? "作成中..." : "デッキを作成"}
                </button>
              </div>

              <section className="deck-builder-search-panel">
                <CardSearch onAdd={addCard} />
              </section>

              <section className="deck-builder-list-panel">
                <div className="deck-builder-list-panel__head">
                  <div>
                    <h2>採用カード</h2>
                    <p>{Math.max(0, 60 - totalCount)}枚で60枚です。</p>
                  </div>
                  <span className={totalCount === 60 ? "deck-builder-count deck-builder-count--complete" : "deck-builder-count"}>
                    {totalCount} / 60
                  </span>
                </div>

                {cards.length === 0 ? (
                  <div className="deck-builder-empty">
                    <strong>カード未追加</strong>
                    <span>左の設計からAI生成するか、上の検索からカードを追加してください。</span>
                  </div>
                ) : (
                  <ul className="deck-builder-card-list">
                    {cards.map((c) => (
                      <li key={c.cardId} className="deck-builder-card-row deck-card-row">
                        <div className="deck-builder-card-main">
                          {c.illustration && (
                            <img
                              src={c.illustration}
                              alt={c.cardName}
                              className="deck-card-thumb deck-builder-card-thumb"
                            />
                          )}
                          <span>{c.cardName || c.cardId}</span>
                        </div>
                        <div className="deck-builder-card-actions deck-card-actions">
                          {(() => {
                            const sameNameTotal = countCardsWithSameName(cards, c);
                            const canIncrease = sameNameTotal < maxCountForCard(c);
                            return (
                              <>
                          <button
                            onClick={() => changeCount(c.cardId, -1)}
                            className="deck-builder-icon-button"
                            aria-label={`${c.cardName || c.cardId}を1枚減らす`}
                          >
                            −
                          </button>
                          <span className="deck-builder-card-count">{c.count}</span>
                          <button
                            onClick={() => changeCount(c.cardId, 1)}
                            disabled={!canIncrease}
                            className="deck-builder-icon-button"
                            aria-label={`${c.cardName || c.cardId}を1枚増やす`}
                          >
                            +
                          </button>
                              </>
                            );
                          })()}
                          <button
                            onClick={() => removeCard(c.cardId)}
                            className="deck-builder-remove-button"
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
