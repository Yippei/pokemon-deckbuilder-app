"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AuthStatus from "@/components/AuthStatus";
import { CardDetail, Deck, DeckCard, getCardDetail, listDecks } from "@/lib/api";

type PracticeMode = "ai" | "solo";
type AiStyle = "speed" | "control" | "stability" | "random";
type SoloStartingPlayer = "first" | "second";
type SoloPlacementType = "pokemon" | "trainer" | "stadium" | "energy" | "unknown";
type SoloCard = DeckCard & {
  name?: string;
  cardKind?: string;
  subKind?: string;
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
};
type SoloStack = SoloCard[];
type RareCandyTarget = {
  location: "active" | "bench";
  benchIndex?: number;
  label: string;
  stack: SoloStack;
};
type RareCandyCandidate = {
  handIndex: number;
  card: SoloCard;
};

const modeOptions: Array<{ value: PracticeMode; label: string; description: string }> = [
  { value: "ai", label: "AI対戦", description: "相手の動きを読みながら、次の一手を確認する" },
  { value: "solo", label: "一人回し", description: "自分の動きだけを整理して、再現性を詰める" },
];

const aiStyles: Array<{ value: AiStyle; label: string; description: string }> = [
  { value: "speed", label: "速攻", description: "初動と打点を優先" },
  { value: "control", label: "妨害", description: "相手の手札と盤面を崩す" },
  { value: "stability", label: "安定", description: "事故を減らして丁寧に進める" },
  { value: "random", label: "ランダム", description: "試行ごとに動きを変える" },
];

const typeHints = [
  { type: "all", label: "全て", keywords: [] },
  { type: "normal", label: "無", keywords: ["無", "無色", "ノーマル", "ダブルターボ"] },
  { type: "fire", label: "炎", keywords: ["炎", "ほのお", "リザードン", "ヒトカゲ"] },
  { type: "water", label: "水", keywords: ["水", "みず", "カイオーガ", "ゲッコウガ"] },
  { type: "grass", label: "草", keywords: ["草", "くさ", "フシギ", "ジュナイパー"] },
  { type: "fighting", label: "闘", keywords: ["闘", "とう", "ルカリオ", "ガチグマ"] },
  { type: "psychic", label: "超", keywords: ["超", "ちょう", "サーナイト", "ミュウ"] },
  { type: "dark", label: "悪", keywords: ["悪", "あく", "ブラッキー", "ゲッコウガ"] },
  { type: "dragon", label: "ドラゴン", keywords: ["ドラゴン", "竜"] },
  { type: "electric", label: "雷", keywords: ["雷", "かみなり", "ピカチュウ", "ミライドン"] },
];

const roomMarks: Array<{
  type: string;
  size: string;
  rotate: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  opacity: number;
}> = [
  { type: "electric", size: "108px", rotate: "12deg", top: "12%", left: "6%", opacity: 0.18 },
  { type: "water", size: "72px", rotate: "-18deg", top: "68%", right: "14%", opacity: 0.12 },
  { type: "fire", size: "84px", rotate: "22deg", top: "16%", right: "6%", opacity: 0.12 },
  { type: "grass", size: "64px", rotate: "-16deg", top: "48%", left: "10%", opacity: 0.1 },
];

function normalizeStage(stage?: string) {
  return String(stage || "").trim().replace(/[ 　]/g, "");
}

function normalizePokemonNameCore(name?: string) {
  return String(name || "")
    .trim()
    .replace(/[ 　]/g, "")
    .replace(/^メガ/, "")
    .replace(/ex$/i, "")
    .replace(/vmax$/i, "")
    .replace(/vstar$/i, "")
    .replace(/v$/i, "")
    .replace(/[xy]$/i, "");
}

function isRareCandyCard(card?: Pick<SoloCard, "cardName">) {
  return normalizePokemonNameCore(card?.cardName) === "ふしぎなアメ";
}

function getStageCategory(stage?: string, stageCategory?: string) {
  const normalizedCategory = String(stageCategory || "").trim();
  if (normalizedCategory === "basic" || normalizedCategory === "evolution") {
    return normalizedCategory;
  }
  const normalized = normalizeStage(stage);
  if (!normalized) return "unknown";
  if (normalized.includes("たね")) return "basic";
  if (normalized.includes("進化") || normalized === "VSTAR" || normalized === "VMAX" || normalized === "V-UNION" || normalized === "GX") {
    return "evolution";
  }
  return "unknown";
}

function getCardTypeLabel(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">) {
  const kind = String(card?.cardKind || "").trim().toLowerCase();
  const subKind = String(card?.subKind || "").trim();
  const stage = normalizeStage(card?.stage);

  if (kind.includes("energy") || subKind.includes("エネルギー") || stage.includes("エネルギー")) {
    return "energy";
  }
  if (
    kind.includes("trainer") ||
    kind.includes("support") ||
    kind.includes("item") ||
    subKind.includes("グッズ") ||
    subKind.includes("サポート") ||
    subKind.includes("スタジアム") ||
    subKind.includes("ポケモンのどうぐ") ||
    stage.includes("グッズ") ||
    stage.includes("サポート") ||
    stage.includes("スタジアム")
  ) {
    return "trainer";
  }
  if (kind.includes("pokemon") || subKind.includes("ポケモン") || stage.includes("たね") || stage.includes("進化")) {
    return "pokemon";
  }
  return "unknown";
}

function getCardPlacementType(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">): SoloPlacementType {
  const kind = String(card?.cardKind || "").trim().toLowerCase();
  const subKind = String(card?.subKind || "").trim();
  const stage = normalizeStage(card?.stage);

  if (kind.includes("energy") || subKind.includes("エネルギー") || stage.includes("エネルギー")) {
    return "energy";
  }
  if (subKind.includes("スタジアム") || stage.includes("スタジアム")) {
    return "stadium";
  }
  if (
    kind.includes("trainer") ||
    kind.includes("support") ||
    kind.includes("item") ||
    subKind.includes("グッズ") ||
    subKind.includes("サポート") ||
    subKind.includes("ポケモンのどうぐ") ||
    stage.includes("グッズ") ||
    stage.includes("サポート")
  ) {
    return "trainer";
  }
  if (kind.includes("pokemon") || subKind.includes("ポケモン") || stage.includes("たね") || stage.includes("進化")) {
    return "pokemon";
  }
  return "unknown";
}

function getStageOrder(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">) {
  if (getCardTypeLabel(card) !== "pokemon") {
    return null;
  }

  const explicit = Number(card?.stageOrder);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  const stageCategory = getStageCategory(card?.stage, card?.stageCategory);
  if (stageCategory === "basic") return 0;
  if (stageCategory === "evolution") {
    const normalized = normalizeStage(card?.stage);
    if (normalized.includes("2進化")) return 2;
    if (normalized.includes("1進化")) return 1;
    if (normalized.includes("VSTAR") || normalized.includes("VMAX") || normalized.includes("GX")) return 3;
    if (normalized.includes("V-UNION")) return 4;
    return 1;
  }
  const normalizedStage = normalizeStage(card?.stage);
  if (normalizedStage.includes("たね")) return 0;
  if (normalizedStage.includes("1進化")) return 1;
  if (normalizedStage.includes("2進化")) return 2;
  return null;
}

function getRareCandyEvolutionNames(baseName?: string) {
  const normalized = normalizePokemonNameCore(baseName);
  const lines = [
    { base: "ヒトカゲ", middle: "リザード", final: "リザードン", finalEx: "リザードンex" },
    { base: "ゼニガメ", middle: "カメール", final: "カメックス", finalEx: "カメックスex" },
    { base: "フシギダネ", middle: "フシギソウ", final: "フシギバナ", finalEx: "フシギバナex" },
    { base: "ポッポ", middle: "ピジョン", final: "ピジョット", finalEx: "ピジョットex" },
    { base: "ラルトス", middle: "キルリア", final: "サーナイト", finalEx: "サーナイトex" },
    { base: "メリープ", middle: "モココ", final: "デンリュウ", finalEx: "デンリュウex" },
    { base: "コリンク", middle: "ルクシオ", final: "レントラー", finalEx: "レントラーex" },
    { base: "ワンリキー", middle: "ゴーリキー", final: "カイリキー", finalEx: "カイリキーex" },
    { base: "ゴース", middle: "ゴースト", final: "ゲンガー", finalEx: "ゲンガーex" },
    { base: "ドラメシヤ", middle: "ドロンチ", final: "ドラパルト", finalEx: "ドラパルトex" },
  ];
  const found = lines.find((line) =>
    [line.base, line.middle, line.final, line.finalEx].some((name) => normalizePokemonNameCore(name) === normalized)
  );
  if (!found) return [];
  return [found.final, found.finalEx].filter(Boolean);
}

function uniqueByCardName(cards: RareCandyCandidate[]) {
  const seen = new Set<string>();
  return cards.filter(({ card }) => {
    const key = normalizePokemonNameCore(card.cardName) || card.cardId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getInitialMode(): PracticeMode {
  if (typeof window === "undefined") return "ai";
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "solo" ? "solo" : "ai";
}

function expandDeck(cards: DeckCard[], cardDetails: Record<string, CardDetail> = {}): SoloCard[] {
  return cards.flatMap((card) =>
      Array.from({ length: card.count }, () => ({
      cardId: card.cardId,
      cardName: card.cardName,
      illustration: card.illustration,
      count: 1,
      name: cardDetails[card.cardId]?.name || card.cardName,
      cardKind: cardDetails[card.cardId]?.cardKind || "unknown",
      subKind: cardDetails[card.cardId]?.subKind || "",
      stage: cardDetails[card.cardId]?.stage || "",
      stageCategory: cardDetails[card.cardId]?.stageCategory || "unknown",
      stageOrder: cardDetails[card.cardId]?.stageOrder,
    }))
  );
}

function takeRandomCards(pile: SoloCard[], count: number) {
  const nextPile = [...pile];
  const drawn: SoloCard[] = [];
  const drawCount = Math.max(0, Math.min(count, nextPile.length));

  for (let i = 0; i < drawCount; i += 1) {
    const index = Math.floor(Math.random() * nextPile.length);
    const [card] = nextPile.splice(index, 1);
    if (card) {
      drawn.push(card);
    }
  }

  return { drawn, rest: nextPile };
}

function inferType(deck?: Deck | null): string {
  if (!deck) return "all";
  const text = [deck.name, ...deck.cards.map((card) => card.cardName || "")].join(" ").toLowerCase();
  return typeHints.find((typeHint) =>
    typeHint.type !== "all" && typeHint.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  )?.type || "all";
}

function inferDeckLabel(deck?: Deck | null): string {
  const type = inferType(deck);
  return typeHints.find((typeHint) => typeHint.type === type)?.label || "全て";
}

function summarizeDeck(deck?: Deck | null): string {
  if (!deck) return "デッキを選択してください。";
  const totalCards = deck.cards.reduce((sum, card) => sum + card.count, 0);
  const pokemonCards = deck.cards.filter((card) => {
    const name = (card.cardName || "").toLowerCase();
    return !name.includes("エネルギー") && !name.includes("ボール") && !name.includes("サポート");
  }).length;
  return `${totalCards}枚構成 / ${pokemonCards}種のカードを採用 / ${inferDeckLabel(deck)}寄り`;
}

function buildAiAdvice(deck: Deck | null, style: AiStyle, turn: number): string {
  const deckText = deck ? [deck.name, ...deck.cards.map((card) => card.cardName || "")].join(" ") : "";
  const isFire = /炎|リザードン|ヒトカゲ/.test(deckText);
  const isWater = /水|みず|ゲッコウガ/.test(deckText);
  const isElectric = /雷|ピカチュウ|ミライドン/.test(deckText);
  const isControl = /ナンジャモ|ロスト|妨害|ジャミング|ハンデス/.test(deckText);

  if (style === "speed") {
    if (turn <= 1) {
      return isFire
        ? "初手はヒトカゲ系の展開を優先し、ドロー札を抱えながら次の進化を準備。"
        : isElectric
          ? "初手はたねポケモンを広げて、エネルギーとサーチを同時に整える。"
          : "初手はたねポケモン展開とサーチを優先し、次のターンの打点を作る。";
    }
    return "盤面が整っているので、攻撃を最優先してテンポを取りにいく。";
  }

  if (style === "control") {
    if (turn <= 1) {
      return isControl
        ? "手札干渉札を抱えつつ、相手の初動を崩す準備をする。"
        : "相手の行動を遅らせる札と、盤面維持のカードを優先する。";
    }
    return "相手のリソースを削りながら、自分の盤面を崩さずに進める。";
  }

  if (style === "stability") {
    if (turn <= 1) {
      return isWater
        ? "無理に攻めず、山札から必要札を揃えることを優先する。"
        : "事故を避けるため、たね・サーチ・ドローの順で整える。";
    }
    return "次のターンの余力を残しつつ、盤面の再現性を高める。";
  }

  return turn % 2 === 0
    ? "相手の動きを見てから、展開か妨害かを切り替える。"
    : "いまの情報で最大値を取りにいく。必要なら盤面の作り直しを優先する。";
}

export default function AIBattleRoomPage() {
  const [mode, setMode] = useState<PracticeMode>(getInitialMode);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [aiStyle, setAiStyle] = useState<AiStyle>("speed");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleTurn, setBattleTurn] = useState(1);
  const [battleStarted, setBattleStarted] = useState(false);
  const [aiGoingFirst, setAiGoingFirst] = useState(false);

  const [soloCardDetails, setSoloCardDetails] = useState<Record<string, CardDetail>>({});
  const [soloCardDetailsLoading, setSoloCardDetailsLoading] = useState(false);
  const [soloPile, setSoloPile] = useState<SoloCard[]>([]);
  const [soloHand, setSoloHand] = useState<SoloCard[]>([]);
  const [soloDiscard, setSoloDiscard] = useState<SoloCard[]>([]);
  const [soloPrizes, setSoloPrizes] = useState<SoloCard[]>([]);
  const [soloStadiumCard, setSoloStadiumCard] = useState<SoloCard | null>(null);
  const [soloActiveStack, setSoloActiveStack] = useState<SoloStack>([]);
  const [soloBenchStacks, setSoloBenchStacks] = useState<SoloStack[]>(() => Array.from({ length: 5 }, () => []));
  const [soloSelectedHandIndex, setSoloSelectedHandIndex] = useState<number | null>(null);
  const [soloNotice, setSoloNotice] = useState("");
  const [soloStartingPlayer, setSoloStartingPlayer] = useState<SoloStartingPlayer>("first");
  const [soloTurn, setSoloTurn] = useState(1);
  const [soloStarted, setSoloStarted] = useState(false);
  const [soloTrashOpen, setSoloTrashOpen] = useState(false);
  const [soloRareCandyMode, setSoloRareCandyMode] = useState<"idle" | "select_basic" | "select_evolution">("idle");
  const [soloRareCandyTarget, setSoloRareCandyTarget] = useState<RareCandyTarget | null>(null);
  const [soloRareCandyCandidates, setSoloRareCandyCandidates] = useState<RareCandyCandidate[]>([]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.deckId === selectedDeckId) || null,
    [decks, selectedDeckId]
  );
  const selectedSoloCard = soloSelectedHandIndex !== null ? soloHand[soloSelectedHandIndex] || null : null;

  useEffect(() => {
    const nextMode = getInitialMode();
    setMode(nextMode);
  }, []);

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        setDecks(await listDecks());
      } catch {
        setError("デッキ一覧を取得できませんでした。");
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    if (decks.length === 0) return;
    if (!selectedDeckId || !decks.some((deck) => deck.deckId === selectedDeckId)) {
      setSelectedDeckId(decks[0].deckId);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    let cancelled = false;
    const loadCardDetails = async () => {
      if (!selectedDeck) {
        setSoloCardDetails({});
        setSoloCardDetailsLoading(false);
        return;
      }

      setSoloCardDetailsLoading(true);
      try {
        const uniqueCardIds = [...new Set(selectedDeck.cards.map((card) => card.cardId).filter(Boolean))];
        const settled = await Promise.allSettled(
          uniqueCardIds.map(async (cardId) => {
            const detail = await getCardDetail(cardId);
            return [cardId, detail] as const;
          })
        );
        const entries = settled
          .filter((result): result is PromiseFulfilledResult<readonly [string, CardDetail]> => result.status === "fulfilled")
          .map((result) => result.value);
        if (!cancelled) {
          setSoloCardDetails(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setSoloCardDetails({});
          setSoloNotice("カード詳細の取得に失敗しました。配置判定は簡易判定で続行します。");
        }
      } finally {
        if (!cancelled) {
          setSoloCardDetailsLoading(false);
        }
      }
    };

    loadCardDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedDeck]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = mode === "solo" ? "/ai-battle-room?mode=solo" : "/ai-battle-room";
    window.history.replaceState(null, "", url);
  }, [mode]);

  useEffect(() => {
  const resetFromDeck = () => {
      if (!selectedDeck) return;
      const pile = expandDeck(selectedDeck.cards);
      setSoloPile(pile);
      setSoloHand([]);
      setSoloDiscard([]);
      setSoloPrizes([]);
      setSoloStadiumCard(null);
      setSoloActiveStack([]);
      setSoloBenchStacks(Array.from({ length: 5 }, () => []));
      setSoloSelectedHandIndex(null);
      setSoloNotice("");
      setSoloStartingPlayer("first");
      setSoloTurn(1);
      setSoloStarted(false);
      setBattleLog([]);
      setBattleTurn(1);
      setBattleStarted(false);
      setAiGoingFirst(false);
      setSoloRareCandyMode("idle");
      setSoloRareCandyTarget(null);
      setSoloRareCandyCandidates([]);
    };
    resetFromDeck();
  }, [selectedDeckId]);

  const deckSummary = summarizeDeck(selectedDeck);
  const deckTypeLabel = inferDeckLabel(selectedDeck);
  const deckTotal = selectedDeck ? selectedDeck.cards.reduce((sum, card) => sum + card.count, 0) : 0;

  const startBattle = () => {
    if (!selectedDeck) return;
    const firstLine = aiGoingFirst
      ? `AIが先攻を取った想定で開始。${buildAiAdvice(selectedDeck, aiStyle, 1)}`
      : `自分が先攻を取った想定で開始。${buildAiAdvice(selectedDeck, aiStyle, 1)}`;
    setBattleStarted(true);
    setBattleTurn(1);
    setBattleLog([`対戦開始: ${selectedDeck.name}`, firstLine]);
  };

  const askNextAiMove = () => {
    if (!selectedDeck) return;
    if (!battleStarted) {
      startBattle();
      return;
    }
    const nextTurn = battleTurn + 1;
    setBattleLog((prev) => [
      ...prev,
      `T${battleTurn}: ${buildAiAdvice(selectedDeck, aiStyle, battleTurn)}`,
      `T${nextTurn}: ${buildAiAdvice(selectedDeck, aiStyle, nextTurn)}`,
    ]);
    setBattleTurn(nextTurn);
  };

  const resetBattle = () => {
    setBattleStarted(false);
    setBattleTurn(1);
    setBattleLog([]);
    setAiGoingFirst(false);
  };

  const startSolo = () => {
    if (!selectedDeck) return;
    const pile = expandDeck(selectedDeck.cards, soloCardDetails);
    const handDraw = takeRandomCards(pile, 7);
    const prizeDraw = takeRandomCards(handDraw.rest, 6);
    setSoloHand(handDraw.drawn);
    setSoloDiscard([]);
    setSoloPile(prizeDraw.rest);
    setSoloPrizes(prizeDraw.drawn);
    setSoloStadiumCard(null);
    setSoloActiveStack([]);
    setSoloBenchStacks(Array.from({ length: 5 }, () => []));
    setSoloSelectedHandIndex(null);
    setSoloNotice("");
    setSoloTurn(1);
    setSoloStarted(true);
    setSoloTrashOpen(false);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const shuffleSolo = () => {
    if (!selectedDeck) return;
    const pile = expandDeck(selectedDeck.cards, soloCardDetails);
    setSoloPile([...pile].sort(() => Math.random() - 0.5));
    setSoloHand([]);
    setSoloDiscard([]);
    setSoloPrizes([]);
    setSoloStadiumCard(null);
    setSoloActiveStack([]);
    setSoloBenchStacks(Array.from({ length: 5 }, () => []));
    setSoloSelectedHandIndex(null);
    setSoloNotice("");
    setSoloStartingPlayer("first");
    setSoloTurn(1);
    setSoloStarted(false);
    setSoloTrashOpen(false);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const resetSolo = () => {
    if (!selectedDeck) return;
    const pile = expandDeck(selectedDeck.cards, soloCardDetails);
    setSoloPile(pile);
    setSoloHand([]);
    setSoloDiscard([]);
    setSoloPrizes([]);
    setSoloStadiumCard(null);
    setSoloActiveStack([]);
    setSoloBenchStacks(Array.from({ length: 5 }, () => []));
    setSoloSelectedHandIndex(null);
    setSoloNotice("一人回しをリセットしました。");
    setSoloStartingPlayer("first");
    setSoloTurn(1);
    setSoloStarted(false);
    setSoloTrashOpen(false);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const drawSolo = (count = 1) => {
    setSoloPile((pile) => {
      const randomized = takeRandomCards(pile, count);
      setSoloHand((hand) => [...hand, ...randomized.drawn]);
      return randomized.rest;
    });
  };

  const selectSoloHandCard = (index: number) => {
    if (index < 0 || index >= soloHand.length) return;
    const nextCard = soloHand[index];
    const isRareCandy = isRareCandyCard(nextCard);
    setSoloSelectedHandIndex((current) => (current === index ? null : index));
    if (!nextCard) {
      setSoloNotice("");
      return;
    }

    if (isRareCandy) {
      if (soloSelectedHandIndex === index) {
        cancelRareCandyFlow();
        setSoloNotice("");
        return;
      }
      setSoloRareCandyMode("select_basic");
      setSoloRareCandyTarget(null);
      setSoloRareCandyCandidates([]);
      setSoloNotice("進化するたねポケモンを選んでください。");
      return;
    }

    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);

    const cardTypeLabel = getCardTypeLabel(nextCard);
    const placementType = getCardPlacementType(nextCard);
    const stageOrder = getStageOrder(nextCard);
    if (placementType === "stadium") {
      setSoloNotice("スタジアムカードです。スタジアム枠を選んでください。");
      return;
    }
    if (stageOrder === null) {
      if (cardTypeLabel === "trainer") {
        setSoloNotice("グッズ・サポートなどのトレーナーズはバトル場やベンチに置けません。");
      } else if (cardTypeLabel === "energy") {
        setSoloNotice("エネルギーカードはバトル場やベンチに置けません。ポケモンにつけて使います。");
      } else {
        setSoloNotice("ポケモン以外のカードはバトル場やベンチに置けません。");
      }
      return;
    }
    if (stageOrder === 0) {
      setSoloNotice("基本ポケモンです。空いているバトル場かベンチを選んでください。");
    } else if (stageOrder > 0) {
      setSoloNotice(`${stageOrder}進化ポケモンです。1つ前の進化段階が置かれた枠を選んでください。`);
    } else {
      setSoloNotice("カード詳細を取得できませんでした。ポケモンのみ配置できます。");
    }
  };

  const getRareCandyTarget = (target: "active" | number) => {
    if (target === "active") {
      return {
        location: "active" as const,
        label: "バトル場",
        stack: soloActiveStack,
      };
    }

    return {
      location: "bench" as const,
      benchIndex: target,
      label: `ベンチ${target + 1}`,
      stack: soloBenchStacks[target] || [],
    };
  };

  const buildRareCandyCandidates = (targetCard: SoloCard) => {
    const allowedNames = new Set(getRareCandyEvolutionNames(targetCard.cardName));
    if (allowedNames.size === 0) return [];

    return uniqueByCardName(
      soloHand
        .map((card, handIndex) => ({ handIndex, card }))
        .filter(({ card }) => {
          const stageOrder = getStageOrder(card);
          const normalizedName = normalizePokemonNameCore(card.cardName);
          return stageOrder === 2 && allowedNames.has(normalizedName);
        })
    );
  };

  const enterRareCandyEvolutionChoice = (target: RareCandyTarget, candidates: RareCandyCandidate[]) => {
    if (candidates.length === 0) {
      setSoloNotice("進化先候補ポケモンが手札にありません。");
      return;
    }
    setSoloRareCandyMode("select_evolution");
    setSoloRareCandyTarget(target);
    setSoloRareCandyCandidates(candidates);
    setSoloNotice("進化先候補ポケモンを選んでください。");
  };

  const cancelRareCandyFlow = () => {
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloNotice("ふしぎなアメの使用をキャンセルしました。");
  };

  const applyRareCandyEvolution = (candidate: RareCandyCandidate) => {
    if (!soloRareCandyTarget) {
      setSoloNotice("進化対象が見つかりませんでした。");
      return;
    }

    const candyIndex = soloHand.findIndex((card) => isRareCandyCard(card));
    if (candyIndex === -1) {
      setSoloNotice("ふしぎなアメが手札にありません。");
      return;
    }

    const targetStack = soloRareCandyTarget.location === "active" ? soloActiveStack : soloBenchStacks[soloRareCandyTarget.benchIndex || 0];
    if (!targetStack.length) {
      setSoloNotice("進化先のたねポケモンが見つかりませんでした。");
      return;
    }

    const targetTop = targetStack[targetStack.length - 1];
    if (getStageOrder(targetTop) !== 0) {
      setSoloNotice("ふしぎなアメはたねポケモンにしか使えません。");
      return;
    }

    const nextHand = soloHand.filter((_, index) => index !== candyIndex && index !== candidate.handIndex);
    const evolvedCard: SoloCard = { ...candidate.card };

    if (soloRareCandyTarget.location === "active") {
      setSoloActiveStack((stack) => [...stack, evolvedCard]);
    } else {
      setSoloBenchStacks((stacks) =>
        stacks.map((stack, index) => (index === soloRareCandyTarget.benchIndex ? [...stack, evolvedCard] : stack))
      );
    }

    setSoloHand(nextHand);
    setSoloDiscard((discard) => [...discard, soloHand[candyIndex]]);
    setSoloSelectedHandIndex(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloNotice(`${targetTop.cardName || "たねポケモン"}をふしぎなアメで${candidate.card.cardName || "進化ポケモン"}に進化させました。`);
  };

  const placeSelectedCard = (target: "active" | "stadium" | number) => {
    if (soloSelectedHandIndex === null) {
      setSoloNotice("まず手札のカードを選んでください。");
      return;
    }

    const picked = soloHand[soloSelectedHandIndex];
    if (!picked) {
      setSoloSelectedHandIndex(null);
      setSoloNotice("選択中のカードが見つかりませんでした。");
      return;
    }

    if (isRareCandyCard(picked)) {
      if (soloRareCandyMode === "select_basic") {
        if (target === "stadium") {
          setSoloNotice("ふしぎなアメはスタジアム枠に使えません。");
          return;
        }
        const targetInfo = getRareCandyTarget(target);
        const targetTop = targetInfo.stack[targetInfo.stack.length - 1];
        if (!targetTop) {
          setSoloNotice("進化するたねポケモンを選んでください。");
          return;
        }
        if (getStageOrder(targetTop) !== 0) {
          setSoloNotice("ふしぎなアメはたねポケモンにしか使えません。");
          return;
        }
        const candidates = buildRareCandyCandidates(targetTop);
        if (candidates.length === 0) {
          setSoloNotice("進化先候補ポケモンが手札にありません。");
          return;
        }
        enterRareCandyEvolutionChoice(targetInfo, candidates);
        return;
      }
      if (soloRareCandyMode === "select_evolution") {
        setSoloNotice("進化先候補ポケモンを選んでください。");
        return;
      }
      setSoloRareCandyMode("select_basic");
      setSoloNotice("進化するたねポケモンを選んでください。");
      return;
    }

  const placementType = getCardPlacementType(picked);
  const stageOrder = getStageOrder(picked);
  const sourceLabel = target === "active" ? "バトル場" : target === "stadium" ? "スタジアム" : `ベンチ${target + 1}`;
    const targetStack = target === "active" ? soloActiveStack : target === "stadium" ? (soloStadiumCard ? [soloStadiumCard] : []) : soloBenchStacks[target];
  const isOccupied = targetStack.length > 0;
  const targetTop = targetStack[targetStack.length - 1];
  const targetTopOrder = targetTop ? getStageOrder(targetTop) : null;

  if (target === "stadium") {
      if (placementType !== "stadium") {
        setSoloNotice("スタジアムカードだけがこの枠に置けます。");
        return;
      }
    } else if (placementType !== "pokemon") {
      if (placementType === "energy") {
        setSoloNotice("エネルギーカードはポケモンにつけて使います。");
      } else {
        setSoloNotice("トレーナーズカードはバトル場やベンチに置けません。");
      }
      return;
    }

  if (stageOrder === null && target !== "stadium") {
      setSoloNotice("カードの段階を判定できませんでした。");
      return;
  }

  if (target !== "stadium" && !isOccupied && stageOrder !== 0) {
      setSoloNotice("基本ポケモンだけが空の枠に置けます。");
      return;
  }

  if (target !== "stadium" && isOccupied) {
      if (targetTopOrder === null) {
        setSoloNotice("その枠のカード詳細が取得できていないため、進化を置けません。");
        return;
      }
      if (stageOrder !== targetTopOrder + 1) {
        setSoloNotice(`${targetTopOrder + 1}段階目の進化だけがこの枠に重ねられます。`);
        return;
      }
    }

    const nextHand = soloHand.filter((_, index) => index !== soloSelectedHandIndex);
    const nextCard: SoloCard = { ...picked };
    if (target === "active") {
      setSoloActiveStack((stack) => (isOccupied ? [...stack, nextCard] : [nextCard]));
    } else if (target === "stadium") {
      setSoloStadiumCard(nextCard);
    } else {
      setSoloBenchStacks((stacks) =>
        stacks.map((stack, index) => (index === target ? (isOccupied ? [...stack, nextCard] : [nextCard]) : stack))
      );
    }

    setSoloHand(nextHand);
    setSoloSelectedHandIndex(null);
    setSoloNotice(`${picked.cardName || "カード"}を${sourceLabel}に配置しました。`);
  };

  const takePrize = () => {
    setSoloPrizes((prizes) => {
      if (prizes.length === 0) {
        setSoloNotice("サイドがありません。");
        return prizes;
      }
      const [drawn, ...rest] = prizes;
      setSoloHand((hand) => [...hand, drawn]);
      setSoloNotice(`${drawn.cardName || "カード"}をサイドから手札に加えました。`);
      return rest;
    });
  };

  const openSoloTrash = () => {
    setSoloTrashOpen(true);
  };

  const closeSoloTrash = () => {
    setSoloTrashOpen(false);
  };

  const nextSoloTurn = () => {
    setSoloTurn((turn) => turn + 1);
  };

  const soloTurnLabel = soloStarted
    ? `${soloStartingPlayer === "first" ? "先攻" : "後攻"} / T${soloTurn}`
    : `${soloStartingPlayer === "first" ? "先攻" : "後攻"} / 開始前`;

  const renderCardFace = (card: DeckCard, sizeClass = "solo-card-chip--image") => {
    const cardLabel = card.cardName || card.cardId;
    if (card.illustration) {
      return (
        <span className={`solo-card-face ${sizeClass}`}>
          <img src={card.illustration} alt={cardLabel} className="solo-card-face__image" />
        </span>
      );
    }
    return (
      <span className={`solo-card-face solo-card-face--text ${sizeClass}`}>
        <span className="solo-card-face__fallback">{cardLabel}</span>
      </span>
    );
  };

  const renderSoloStack = (stack: SoloStack) => {
    const topCard = stack[stack.length - 1];
    if (!topCard) {
      return null;
    }

    return (
      <div className="solo-board-stack">
        {renderCardFace(topCard, "solo-card-face--board")}
        {stack.length > 1 && <span className="solo-board-stack__count">+{stack.length - 1}</span>}
      </div>
    );
  };

  const selectedModeCard = modeOptions.find((option) => option.value === mode);
  const selectedRareCandyTargetCard = soloRareCandyTarget ? soloRareCandyTarget.stack[soloRareCandyTarget.stack.length - 1] || null : null;
  const selectedRareCandyMessage =
    soloRareCandyMode === "select_basic"
      ? "進化するたねポケモンを選んでください。"
      : soloRareCandyMode === "select_evolution"
        ? "進化先候補ポケモンを選んでください。"
        : "";

  return (
    <AuthGate>
      <main className="home-type-bg min-h-screen">
        <div className="type-mark-field" aria-hidden="true">
          {roomMarks.map((mark) => (
            <span
              key={mark.type}
              className={`type-mark type-mark-${mark.type}`}
              style={{
                "--type-size": mark.size,
                "--type-rotation": mark.rotate,
                opacity: mark.opacity,
                top: mark.top,
                right: mark.right,
                bottom: mark.bottom,
                left: mark.left,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white/78 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="home-kicker">PLAY LAB</div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">プレイラボ</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
                AI対戦と一人回しをまとめた練習スペースです。デッキを持ち込んで、回し方の確認や初動の反復を行えます。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AuthStatus compact />
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
              >
                ホームへ戻る
              </Link>
            </div>
          </header>

          <section className="mb-6 rounded-[24px] border border-slate-200/80 bg-white/78 p-4 shadow-sm backdrop-blur-xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-[20px] border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                    mode === option.value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="text-base font-black">{option.label}</div>
                  <div className={`mt-1 text-sm leading-6 ${mode === option.value ? "text-slate-200" : "text-slate-600"}`}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              現在の表示: <span className="font-bold text-slate-950">{selectedModeCard?.label}</span>
            </p>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">デッキ選択</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-700">練習に使うデッキを選んでください。</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {loading ? "..." : `${decks.length}件`}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {error && <p className="text-sm text-amber-600">{error}</p>}
                {!loading && decks.length === 0 && (
                  <p className="text-sm leading-6 text-slate-700">
                    デッキがありません。先にデッキを作成してください。
                  </p>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-900">利用デッキ</span>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    {decks.map((deck) => (
                      <option key={deck.deckId} value={deck.deckId}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold tracking-[0.16em] text-white">
                      {deckTypeLabel}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{selectedDeck?.name || "未選択"}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{deckSummary}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-[11px] font-bold tracking-[0.14em] text-slate-500">合計枚数</div>
                      <div className="mt-1 text-xl font-black text-slate-950">{deckTotal}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-[11px] font-bold tracking-[0.14em] text-slate-500">採用種数</div>
                      <div className="mt-1 text-xl font-black text-slate-950">{selectedDeck?.cards.length || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-[11px] font-bold tracking-[0.14em] text-slate-500">タイプ</div>
                      <div className="mt-1 text-xl font-black text-slate-950">{deckTypeLabel}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/decks/new"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    デッキを整える
                  </Link>
                  <Link
                    href="/#deck-list"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                  >
                    デッキ一覧へ
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
              {mode === "ai" ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">AI対戦練習</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        AIが次の一手を返す想定で、回し方を確認します。
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      TURN {battleTurn}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {aiStyles.map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setAiStyle(style.value)}
                        className={`rounded-[18px] border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                          aiStyle === style.value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <div className="text-sm font-black">{style.label}</div>
                        <div className={`mt-1 text-xs leading-5 ${aiStyle === style.value ? "text-slate-200" : "text-slate-600"}`}>
                          {style.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={aiGoingFirst}
                      onChange={(e) => setAiGoingFirst(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">AIが先攻を取る想定で開始する</span>
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startBattle}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                    >
                      対戦を始める
                    </button>
                    <button
                      type="button"
                      onClick={askNextAiMove}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                    >
                      次の手を聞く
                    </button>
                    <button
                      type="button"
                      onClick={resetBattle}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      リセット
                    </button>
                  </div>

                  <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black tracking-[0.14em] text-slate-500">BATTLE LOG</h3>
                      <span className="text-xs font-semibold text-slate-500">{battleStarted ? "進行中" : "待機中"}</span>
                    </div>
                    <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                      {battleLog.length === 0 ? (
                        <p className="text-sm leading-6 text-slate-600">
                          デッキを選んで対戦を開始すると、AIの行動指針が表示されます。
                        </p>
                      ) : (
                        battleLog.map((line, index) => (
                          <div key={`${line}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm">
                            {line}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="solo-playmat-shell">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-white">一人回し</h2>
                      <p className="mt-1 text-sm leading-6 text-emerald-50/90">
                        札の流れを手で回して、初動と終盤の再現性を詰めます。
                      </p>
                    </div>
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-emerald-50">
                      {soloTurnLabel}
                    </span>
                  </div>

                  <div className="solo-playmat mt-4">
                    <div className="solo-playmat__board">
                      <div className="solo-playmat__column solo-playmat__column--prize">
                        <button
                          type="button"
                          className="solo-zone solo-zone--stadium solo-zone--clickable"
                          onClick={() => placeSelectedCard("stadium")}
                        >
                          <div className="solo-zone__label">スタジアム</div>
                          <div className="solo-stadium-slot">
                            {soloStadiumCard ? (
                              <>
                                {renderCardFace(soloStadiumCard, "solo-card-face--stadium")}
                                <span className="solo-stadium-slot__name">{soloStadiumCard.cardName || "スタジアム"}</span>
                              </>
                            ) : (
                              <>
                                <span className="solo-stadium-slot__title">スタジアムを置く</span>
                                <span className="solo-stadium-slot__text">効果を持つ場のカード</span>
                              </>
                            )}
                          </div>
                        </button>

                        <div className="solo-zone solo-zone--prize">
                          <div className="solo-zone__label">サイド</div>
                          <div className="solo-prize-stack" aria-label="サイドカード">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <div
                                key={`prize-${index}`}
                                className={`solo-prize-card ${index < soloPrizes.length ? "solo-prize-card--active" : "solo-prize-card--used"}`}
                              />
                            ))}
                          </div>
                          <div className="solo-zone__hint">残り {soloPrizes.length} 枚</div>
                          <div className="mt-1 rounded-xl border border-white/12 bg-white/8 p-2">
                            <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">先攻 / 後攻</div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={soloStarted}
                                onClick={() => setSoloStartingPlayer("first")}
                                className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                                  soloStartingPlayer === "first"
                                    ? "bg-white text-emerald-950"
                                    : "border border-white/15 bg-transparent text-emerald-50"
                                } ${soloStarted ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                先攻
                              </button>
                              <button
                                type="button"
                                disabled={soloStarted}
                                onClick={() => setSoloStartingPlayer("second")}
                                className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                                  soloStartingPlayer === "second"
                                    ? "bg-white text-emerald-950"
                                    : "border border-white/15 bg-transparent text-emerald-50"
                                } ${soloStarted ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                後攻
                              </button>
                            </div>
                            <div className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-emerald-100/85">
                              現在: {soloStarted ? `T${soloTurn}` : "開始前"}
                            </div>
                            <div className="mt-1 text-[10px] font-medium tracking-[0.08em] text-emerald-100/70">
                              開始後はリセットまで変更不可
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="solo-playmat__column solo-playmat__column--center">
                        <button type="button" className="solo-zone solo-zone--active solo-zone--clickable" onClick={() => placeSelectedCard("active")}>
                          <div className="solo-zone__label">バトル場</div>
                          <div className="solo-active-slot">
                            {soloActiveStack.length === 0 ? (
                              <>
                                <span className="solo-active-slot__title">アクティブ</span>
                                <span className="solo-active-slot__text">基本ポケモンを置く</span>
                              </>
                            ) : (
                              renderSoloStack(soloActiveStack)
                            )}
                          </div>
                        </button>

                        <div className="solo-zone solo-zone--bench">
                          <div className="solo-zone__label">ベンチ</div>
                          <div className="solo-bench-row" aria-label="ベンチポケモンの置き場">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <button
                                key={`bench-${index}`}
                                type="button"
                                className="solo-bench-slot solo-bench-slot--clickable"
                                onClick={() => placeSelectedCard(index)}
                              >
                                {soloBenchStacks[index]?.length ? (
                                  <>
                                    {renderSoloStack(soloBenchStacks[index])}
                                    <span className="solo-bench-slot__index">{index + 1}</span>
                                  </>
                                ) : (
                                  <span className="solo-bench-slot__placeholder">{index + 1}</span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="solo-zone__hint">5体まで / 空枠はたね、重なりは進化</div>
                        </div>
                      </div>

                      <div className="solo-playmat__column solo-playmat__column--stack">
                        <div className="solo-zone solo-zone--deck">
                          <div className="solo-zone__label">デッキ</div>
                          <div className="solo-zone__value">{soloPile.length}</div>
                          <div className="solo-zone__hint">山札から引く</div>
                        </div>
                        <button
                          type="button"
                          className="solo-zone solo-zone--trash solo-zone--clickable"
                          onClick={openSoloTrash}
                          aria-haspopup="dialog"
                          aria-expanded={soloTrashOpen}
                        >
                          <div className="solo-zone__label">トラッシュ</div>
                          <div className="solo-zone__value">{soloDiscard.length}</div>
                          <div className="solo-zone__hint">押すと一覧を確認</div>
                        </button>
                      </div>
                    </div>

                    <div className="solo-playmat__hand-panel">
                      <div className="solo-zone solo-zone--hand">
                        <div className="solo-zone__label">手札</div>
                        <div className="solo-zone__chips">
                          {soloHand.length === 0 ? (
                            <span className="solo-zone__placeholder">まだ手札がありません。</span>
                          ) : (
                            soloHand.map((card, index) => (
                              <button
                                key={`${card.cardId}-${index}`}
                                type="button"
                                onClick={() => selectSoloHandCard(index)}
                                className={`solo-card-chip ${soloSelectedHandIndex === index ? "solo-card-chip--selected" : ""}`}
                                title="クリックで選択"
                              >
                                {renderCardFace(card)}
                              </button>
                            ))
                          )}
                        </div>
                        <div className="solo-zone__hint">カードを選んでから、バトル場またはベンチを押してください。</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-emerald-900/20 bg-emerald-950/80 p-4 text-emerald-50 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black tracking-[0.14em] text-emerald-200">選択中カード</h3>
                      <span className="text-xs font-semibold text-emerald-100/80">
                        {soloCardDetailsLoading ? "詳細読込中" : soloStarted ? "開始済み" : "未開始"}
                      </span>
                    </div>
                    <div className="mt-3 rounded-[18px] border border-white/15 bg-white/8 p-3">
                      {selectedSoloCard ? (
                        <div className="flex items-center gap-3">
                          {renderCardFace(selectedSoloCard, "solo-card-face--preview")}
                          <div className="min-w-0">
                            <p className="text-base font-bold text-emerald-50">{selectedSoloCard.cardName || "カード"}</p>
                            <p className="mt-1 text-sm leading-6 text-emerald-50/85">
                              {getCardPlacementType(selectedSoloCard) === "stadium"
                                ? "スタジアムカードです。スタジアム枠にだけ置けます。"
                                : getCardPlacementType(selectedSoloCard) === "trainer"
                                  ? "グッズ・サポートなどのトレーナーズです。配置はできません。"
                                  : getCardPlacementType(selectedSoloCard) === "energy"
                                  ? "エネルギーカードです。配置はできません。ポケモンにつけて使います。"
                                  : getStageOrder(selectedSoloCard) === 0
                                ? "基本ポケモン。空いているバトル場かベンチに置けます。"
                                : getStageOrder(selectedSoloCard) !== null
                                  ? `${getStageOrder(selectedSoloCard)}進化ポケモン。1つ前の進化段階が置かれた枠にだけ置けます。`
                                  : "詳細未取得。配置判定は保守的に扱います。"}
                            </p>
                          </div>
                        </div>
                      ) : soloRareCandyMode !== "idle" ? (
                        <p className="text-sm leading-6 text-emerald-50/80">{selectedRareCandyMessage}</p>
                      ) : (
                        <p className="text-sm leading-6 text-emerald-50/80">手札のカードをクリックして選択してください。</p>
                      )}
                    </div>

                    {selectedSoloCard && isRareCandyCard(selectedSoloCard) && soloRareCandyMode !== "idle" ? (
                      <div className="mt-3 rounded-[18px] border border-white/15 bg-white/8 p-3">
                        {soloRareCandyMode === "select_basic" ? (
                          <>
                            <p className="text-sm leading-6 text-emerald-50/90">進化するたねポケモンを選んでください。</p>
                            <button
                              type="button"
                              onClick={cancelRareCandyFlow}
                              className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">対象のたね</div>
                                <p className="mt-1 text-sm font-bold text-emerald-50">
                                  {selectedRareCandyTargetCard?.cardName || "未選択"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={cancelRareCandyFlow}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                              >
                                キャンセル
                              </button>
                            </div>
                            <div className="mt-3">
                              <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">進化先候補</div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {soloRareCandyCandidates.length === 0 ? (
                                  <p className="text-sm leading-6 text-emerald-50/80">候補がありません。</p>
                                ) : (
                                  soloRareCandyCandidates.map((candidate) => (
                                    <button
                                      key={`${candidate.card.cardId}-${candidate.handIndex}`}
                                      type="button"
                                      onClick={() => applyRareCandyEvolution(candidate)}
                                      className="rounded-[16px] border border-white/15 bg-emerald-900/60 p-2 text-left transition hover:bg-emerald-900"
                                    >
                                      <div className="flex items-center gap-2">
                                        {renderCardFace(candidate.card, "solo-card-face--candidate")}
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-emerald-50">{candidate.card.cardName || "進化ポケモン"}</p>
                                          <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">押すと進化します</p>
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {soloNotice && <p className="mt-3 text-sm leading-6 text-emerald-100/90">{soloNotice}</p>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!soloStarted ? (
                      <button
                        type="button"
                        onClick={startSolo}
                        disabled={soloCardDetailsLoading}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        7枚引いて開始
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => drawSolo(1)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                    >
                      1枚引く
                    </button>
                    <button
                      type="button"
                      onClick={shuffleSolo}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      シャッフル
                    </button>
                    {soloStarted ? (
                      <button
                        type="button"
                        onClick={resetSolo}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                      >
                        リセット
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={nextSoloTurn}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      ターン終了
                    </button>
                    <button
                      type="button"
                      onClick={takePrize}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      サイドを取る
                    </button>
                  </div>

                  <div className="mt-5 rounded-[22px] border border-emerald-900/20 bg-emerald-950/80 p-4 text-emerald-50 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-white/15 bg-white/8 p-3">
                        <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">トラッシュ</div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                          {soloDiscard.length === 0 ? "まだありません。" : `${soloDiscard.length}枚`}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-white/15 bg-white/8 p-3">
                        <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">操作ヒント</div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                          基本ポケモンは空枠へ、進化ポケモンは既に置いたポケモンの上へ配置します。
                        </p>
                      </div>
                    </div>
                  </div>

                  {soloTrashOpen ? (
                    <div
                      className="solo-trash-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label="トラッシュ一覧"
                      onClick={closeSoloTrash}
                    >
                      <div className="solo-trash-modal__panel" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black text-slate-950">トラッシュ一覧</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              捨てたカードを一覧で確認できます。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={closeSoloTrash}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
                          >
                            閉じる
                          </button>
                        </div>

                        <div className="mt-4 max-h-[65vh] overflow-auto pr-1">
                          {soloDiscard.length === 0 ? (
                            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                              トラッシュにカードはありません。
                            </p>
                          ) : (
                            <div className="solo-trash-grid">
                              {soloDiscard
                                .slice()
                                .reverse()
                                .map((card, index) => (
                                  <div key={`${card.cardId}-${index}`} className="solo-trash-item">
                                    {renderCardFace(card, "solo-card-face--trash")}
                                    <div className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">
                                      {card.cardName || "カード"}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
