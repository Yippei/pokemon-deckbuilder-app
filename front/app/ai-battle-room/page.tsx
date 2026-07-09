"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AuthStatus from "@/components/AuthStatus";
import { Deck, DeckCard, listDecks } from "@/lib/api";

type PracticeMode = "ai" | "solo";
type AiStyle = "speed" | "control" | "stability" | "random";
type SoloStartingPlayer = "first" | "second";
type SoloPlacementType = "pokemon" | "item" | "supporter" | "tool" | "stadium" | "energy" | "trainer" | "unknown";
type SoloCard = DeckCard & {
  name?: string;
  cardKind?: string;
  subKind?: string;
  regulation?: string;
  setCode?: string;
  setName?: string;
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
  hp?: number | null;
  ruleText?: string;
  searchTokens?: string[];
  effectProfile?: EffectProfile | null;
  playedTurn?: number;
};
type SoloStack = SoloCard[];
type SoloToolState = {
  active: SoloCard | null;
  bench: Array<SoloCard | null>;
};
type SoloEnergyState = {
  active: SoloCard[];
  bench: SoloCard[][];
};
type SearchTarget =
  | "any_card"
  | "pokemon"
  | "basic_pokemon"
  | "pokemon_hp_70_or_less"
  | "pokemon_or_basic_energy"
  | "rule_box_pokemon"
  | "marnie_pokemon"
  | "pokemon_ex"
  | "evolution_pokemon"
  | "item"
  | "supporter"
  | "tool"
  | "mega_evolution_pokemon"
  | "terastal_pokemon"
  | "energy"
  | "basic_energy"
  | "stadium";
type EffectAction =
  | { type: "draw_cards"; count: number; discardRemainingHand?: boolean }
  | {
      type: "search_deck";
      target: SearchTarget;
      count: number;
      destination: "hand" | "bench" | "stadium" | "attach_energy";
      look?: { from: "top" | "bottom"; count: number; opponent?: boolean };
      remainingDestination?: "deck" | "discard";
    }
  | { type: "recover_from_trash"; target: SearchTarget; count: number; destination: "hand" }
  | { type: "draw_until_board_count" }
  | { type: "topdeck_setup"; count: number }
  | { type: "continuous_effect"; note: string }
  | { type: "switch_active" }
  | { type: "heal_pokemon"; note: string }
  | { type: "discard_tool"; note: string }
  | { type: "discard_stadium"; note: string }
  | { type: "resolve_effect"; note: string };
type EffectProfile = {
  label: string;
  costs?: Array<{ type: "discard_from_hand"; count: number }>;
  actions: EffectAction[];
};
type StaticCardDetail = {
  cardId: string;
  name?: string;
  cardKind?: string;
  subKind?: string;
  regulation?: string;
  setCode?: string;
  setName?: string;
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
  hp?: number | null;
  ruleText?: string;
  searchTokens?: string[];
  effectProfile?: EffectProfile | null;
};
type StaticCardMaster = {
  generatedAt?: string;
  totalCards?: number;
  profiledCards?: number;
  cards?: Record<string, StaticCardDetail>;
};
type SoloEffectPrompt =
  | {
      kind: "discard_from_hand";
      sourceHandIndex: number;
      sourceCard: SoloCard;
      nextAction: EffectAction;
      count: number;
      selectedHandIndexes: number[];
    }
  | {
      kind: "search_deck";
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "search_deck" }>;
      selectedPileIndexes: number[];
      visiblePileIndexes?: number[];
    }
  | {
      kind: "recover_from_trash";
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "recover_from_trash" }>;
      selectedDiscardIndexes: number[];
    }
  | {
      kind: "switch_active";
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      selectedBenchIndex: number | null;
    }
  | {
      kind: "select_board_pokemon";
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "heal_pokemon" | "discard_tool" }>;
    };
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
type SoloSnapshot = {
  pile: SoloCard[];
  hand: SoloCard[];
  discard: SoloCard[];
  prizes: SoloCard[];
  stadiumCard: SoloCard | null;
  activeStack: SoloStack;
  benchStacks: SoloStack[];
  attachedTools: SoloToolState;
  attachedEnergies: SoloEnergyState;
  selectedHandIndex: number | null;
  notice: string;
  startingPlayer: SoloStartingPlayer;
  turn: number;
  started: boolean;
  supporterUsedTurn: number | null;
  energyAttachedTurn: number | null;
  openingRedrawCount: number;
  trashOpen: boolean;
  customShuffleOpen: boolean;
  customShuffleDrawCount: number;
  effectPrompt: SoloEffectPrompt | null;
  rareCandyMode: "idle" | "select_basic" | "select_evolution";
  rareCandyTarget: RareCandyTarget | null;
  rareCandyCandidates: RareCandyCandidate[];
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

function wasPokemonPutInPlayThisTurn(card: SoloCard | null | undefined, currentTurn: number) {
  if (!card) return false;
  return getCardPlacementType(card) === "pokemon" && card?.playedTurn === currentTurn;
}

function createEmptySoloTools(): SoloToolState {
  return {
    active: null,
    bench: Array.from({ length: 5 }, () => null),
  };
}

function createEmptySoloEnergies(): SoloEnergyState {
  return {
    active: [],
    bench: Array.from({ length: 5 }, () => []),
  };
}

function getTrainerSubtype(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "cardName">) {
  const kind = String(card?.cardKind || "").trim().toLowerCase();
  const subKind = String(card?.subKind || "").trim();
  const stage = normalizeStage(card?.stage);
  const name = normalizePokemonNameCore(card?.cardName);

  if (subKind.includes("ポケモンのどうぐ") || stage.includes("ポケモンのどうぐ") || subKind.includes("どうぐ")) {
    return "tool";
  }
  if (subKind.includes("スタジアム") || stage.includes("スタジアム")) {
    return "stadium";
  }
  if (kind.includes("support") || subKind.includes("サポート") || stage.includes("サポート")) {
    return "supporter";
  }
  if (kind.includes("item") || subKind.includes("グッズ") || stage.includes("グッズ") || name.includes("ボール")) {
    return "item";
  }
  if (kind.includes("trainer") || subKind || stage) {
    return "trainer";
  }
  return "unknown";
}

function getEffectProfile(card?: SoloCard | null): EffectProfile | null {
  const fallbackProfile = getFallbackEffectProfile(card);
  const masterProfile = card?.effectProfile || null;
  const masterAction = masterProfile?.actions[0];

  if (!masterProfile) return fallbackProfile;
  if (fallbackProfile && masterAction?.type === "resolve_effect") return fallbackProfile;
  return masterProfile;
}

function getFallbackEffectProfile(card?: SoloCard | null): EffectProfile | null {
  const name = normalizePokemonNameCore(card?.cardName);
  if (!name) return null;

  if (name === "博士の研究" || name.includes("博士の研究")) {
    return {
      label: "手札をすべてトラッシュし、山札を7枚引く",
      actions: [{ type: "draw_cards", count: 7, discardRemainingHand: true }],
    };
  }
  if (name === "ネストボール") {
    return {
      label: "山札からたねポケモンを1枚ベンチに出す",
      actions: [{ type: "search_deck", target: "basic_pokemon", count: 1, destination: "bench" }],
    };
  }
  if (name === "なかよしポフィン") {
    return {
      label: "山札からHP70以下のたねポケモンを2枚までベンチに出す",
      actions: [{ type: "search_deck", target: "pokemon_hp_70_or_less", count: 2, destination: "bench" }],
    };
  }
  if (name === "ハイパーボール") {
    return {
      label: "手札を2枚トラッシュし、山札からポケモンを1枚手札に加える",
      costs: [{ type: "discard_from_hand", count: 2 }],
      actions: [{ type: "search_deck", target: "pokemon", count: 1, destination: "hand" }],
    };
  }
  if (name === "大地の器") {
    return {
      label: "手札を1枚トラッシュし、山札から基本エネルギーを2枚まで手札に加える",
      costs: [{ type: "discard_from_hand", count: 1 }],
      actions: [{ type: "search_deck", target: "basic_energy", count: 2, destination: "hand" }],
    };
  }
  if (name === "エネルギー転送") {
    return {
      label: "山札から基本エネルギーを1枚手札に加える",
      actions: [{ type: "search_deck", target: "basic_energy", count: 1, destination: "hand" }],
    };
  }
  if (name === "ふしぎなアメ") {
    return {
      label: "たねポケモンを1進化を飛ばして2進化にする",
      actions: [{ type: "resolve_effect", note: "既存のふしぎなアメ操作を使います。" }],
    };
  }
  return null;
}

function matchesSearchTarget(card: SoloCard, target: SearchTarget): boolean {
  const placementType = getCardPlacementType(card);
  const stageOrder = getStageOrder(card);
  const name = String(card.cardName || "");
  const ruleText = String(card.ruleText || "");
  const searchText = [name, ruleText, ...(card.searchTokens || [])].join(" ");
  switch (target) {
    case "any_card":
      return true;
    case "pokemon":
      return placementType === "pokemon";
    case "basic_pokemon":
      return placementType === "pokemon" && stageOrder === 0;
    case "pokemon_hp_70_or_less":
      return placementType === "pokemon" && stageOrder === 0 && Number(card.hp || 0) <= 70;
    case "pokemon_or_basic_energy":
      return placementType === "pokemon" || (placementType === "energy" && name.includes("基本"));
    case "rule_box_pokemon":
      return placementType === "pokemon" && /ポケモンex|メガシンカex|VSTAR|VMAX|V-UNION|ポケモンV|ex\b/i.test(searchText);
    case "marnie_pokemon":
      return placementType === "pokemon" && searchText.includes("マリィ");
    case "pokemon_ex":
      return placementType === "pokemon" && /ポケモンex|ex\b/i.test(searchText);
    case "evolution_pokemon":
      return placementType === "pokemon" && stageOrder !== null && stageOrder > 0;
    case "item":
      return placementType === "item";
    case "supporter":
      return placementType === "supporter";
    case "tool":
      return placementType === "tool";
    case "mega_evolution_pokemon":
      return placementType === "pokemon" && (name.includes("メガ") || searchText.includes("メガシンカ"));
    case "terastal_pokemon":
      return placementType === "pokemon" && searchText.includes("テラスタル");
    case "energy":
      return placementType === "energy";
    case "basic_energy":
      return placementType === "energy" && name.includes("基本");
    case "stadium":
      return placementType === "stadium";
    default:
      return false;
  }
}

function getSearchTargetLabel(target: SearchTarget): string {
  const labels: Record<SearchTarget, string> = {
    any_card: "カード",
    pokemon: "ポケモン",
    basic_pokemon: "たねポケモン",
    pokemon_hp_70_or_less: "HP70以下のたねポケモン",
    pokemon_or_basic_energy: "ポケモンまたは基本エネルギー",
    rule_box_pokemon: "ルールを持つポケモン",
    marnie_pokemon: "マリィのポケモン",
    pokemon_ex: "ポケモンex",
    evolution_pokemon: "進化ポケモン",
    item: "グッズ",
    supporter: "サポート",
    tool: "ポケモンのどうぐ",
    mega_evolution_pokemon: "メガシンカex",
    terastal_pokemon: "テラスタルのポケモン",
    energy: "エネルギー",
    basic_energy: "基本エネルギー",
    stadium: "スタジアム",
  };
  return labels[target];
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
  const trainerSubtype = getTrainerSubtype(card);
  if (trainerSubtype === "stadium") {
    return "stadium";
  }
  if (trainerSubtype === "tool") {
    return "tool";
  }
  if (trainerSubtype === "supporter") {
    return "supporter";
  }
  if (trainerSubtype === "item") {
    return "item";
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

function buildCardDetailNameIndex(cardDetails: Record<string, StaticCardDetail>) {
  const index = new Map<string, StaticCardDetail>();
  Object.values(cardDetails).forEach((detail) => {
    const key = normalizePokemonNameCore(detail.name);
    if (key) {
      index.set(key, detail);
    }
  });
  return index;
}

function getCardDetailForDeckCard(
  card: DeckCard,
  cardDetails: Record<string, StaticCardDetail>,
  nameIndex: Map<string, StaticCardDetail>
) {
  const exactDetail = cardDetails[card.cardId];
  if (exactDetail) return exactDetail;
  const nameKey = normalizePokemonNameCore(card.cardName);
  return nameKey ? nameIndex.get(nameKey) : undefined;
}

function expandDeck(cards: DeckCard[], cardDetails: Record<string, StaticCardDetail> = {}): SoloCard[] {
  const detailNameIndex = buildCardDetailNameIndex(cardDetails);
  return cards.flatMap((card) =>
    Array.from({ length: card.count }, () => {
      const detail = getCardDetailForDeckCard(card, cardDetails, detailNameIndex);
      return {
      cardId: card.cardId,
      cardName: card.cardName,
      illustration: card.illustration,
      count: 1,
      name: detail?.name || card.cardName,
      cardKind: detail?.cardKind || "unknown",
      subKind: detail?.subKind || "",
      regulation: detail?.regulation,
      setCode: detail?.setCode,
      setName: detail?.setName,
      stage: detail?.stage || "",
      stageCategory: detail?.stageCategory || "unknown",
      stageOrder: detail?.stageOrder,
      hp: detail?.hp,
      ruleText: detail?.ruleText,
      searchTokens: detail?.searchTokens || [],
      effectProfile: detail?.effectProfile || null,
    };
    })
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

function getNoBasicOpeningProbability(totalCards: number, basicPokemonCount: number, handSize = 7) {
  if (totalCards <= 0 || basicPokemonCount <= 0 || handSize <= 0) return 1;
  if (basicPokemonCount >= totalCards) return 0;
  const drawCount = Math.min(handSize, totalCards);
  let probability = 1;
  for (let index = 0; index < drawCount; index += 1) {
    probability *= Math.max(0, totalCards - basicPokemonCount - index) / Math.max(1, totalCards - index);
  }
  return probability;
}

function formatProbability(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  const percent = Math.max(0, Math.min(100, value * 100));
  return `${percent.toFixed(percent < 1 && percent > 0 ? 2 : 1)}%`;
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

  const [cardMasterDetails, setCardMasterDetails] = useState<Record<string, StaticCardDetail>>({});
  const [cardMasterLoading, setCardMasterLoading] = useState(false);
  const [soloPile, setSoloPile] = useState<SoloCard[]>([]);
  const [soloHand, setSoloHand] = useState<SoloCard[]>([]);
  const [soloDiscard, setSoloDiscard] = useState<SoloCard[]>([]);
  const [soloPrizes, setSoloPrizes] = useState<SoloCard[]>([]);
  const [soloStadiumCard, setSoloStadiumCard] = useState<SoloCard | null>(null);
  const [soloActiveStack, setSoloActiveStack] = useState<SoloStack>([]);
  const [soloBenchStacks, setSoloBenchStacks] = useState<SoloStack[]>(() => Array.from({ length: 5 }, () => []));
  const [soloAttachedTools, setSoloAttachedTools] = useState<SoloToolState>(createEmptySoloTools);
  const [soloAttachedEnergies, setSoloAttachedEnergies] = useState<SoloEnergyState>(createEmptySoloEnergies);
  const [soloSelectedHandIndex, setSoloSelectedHandIndex] = useState<number | null>(null);
  const [soloNotice, setSoloNotice] = useState("");
  const [soloHintsVisible, setSoloHintsVisible] = useState(false);
  const [soloStartingPlayer, setSoloStartingPlayer] = useState<SoloStartingPlayer>("first");
  const [soloTurn, setSoloTurn] = useState(1);
  const [soloStarted, setSoloStarted] = useState(false);
  const [soloSupporterUsedTurn, setSoloSupporterUsedTurn] = useState<number | null>(null);
  const [soloEnergyAttachedTurn, setSoloEnergyAttachedTurn] = useState<number | null>(null);
  const [soloTrashOpen, setSoloTrashOpen] = useState(false);
  const [soloOpeningRedrawCount, setSoloOpeningRedrawCount] = useState(0);
  const [soloCustomShuffleOpen, setSoloCustomShuffleOpen] = useState(false);
  const [soloCustomShuffleDrawCount, setSoloCustomShuffleDrawCount] = useState(7);
  const [soloEffectPrompt, setSoloEffectPrompt] = useState<SoloEffectPrompt | null>(null);
  const [soloRareCandyMode, setSoloRareCandyMode] = useState<"idle" | "select_basic" | "select_evolution">("idle");
  const [soloRareCandyTarget, setSoloRareCandyTarget] = useState<RareCandyTarget | null>(null);
  const [soloRareCandyCandidates, setSoloRareCandyCandidates] = useState<RareCandyCandidate[]>([]);
  const [soloHistory, setSoloHistory] = useState<SoloSnapshot[]>([]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.deckId === selectedDeckId) || null,
    [decks, selectedDeckId]
  );
  const selectedSoloCard = soloSelectedHandIndex !== null ? soloHand[soloSelectedHandIndex] || null : null;
  const selectedEffectProfile = getEffectProfile(selectedSoloCard);
  const isSoloFirstTurnSupporterLocked = soloStarted && soloStartingPlayer === "first" && soloTurn === 1;
  const createSoloSnapshot = (): SoloSnapshot => ({
    pile: [...soloPile],
    hand: [...soloHand],
    discard: [...soloDiscard],
    prizes: [...soloPrizes],
    stadiumCard: soloStadiumCard,
    activeStack: [...soloActiveStack],
    benchStacks: soloBenchStacks.map((stack) => [...stack]),
    attachedTools: {
      active: soloAttachedTools.active,
      bench: [...soloAttachedTools.bench],
    },
    attachedEnergies: {
      active: [...soloAttachedEnergies.active],
      bench: soloAttachedEnergies.bench.map((energies) => [...energies]),
    },
    selectedHandIndex: soloSelectedHandIndex,
    notice: soloNotice,
    startingPlayer: soloStartingPlayer,
    turn: soloTurn,
    started: soloStarted,
    supporterUsedTurn: soloSupporterUsedTurn,
    energyAttachedTurn: soloEnergyAttachedTurn,
    openingRedrawCount: soloOpeningRedrawCount,
    trashOpen: soloTrashOpen,
    customShuffleOpen: soloCustomShuffleOpen,
    customShuffleDrawCount: soloCustomShuffleDrawCount,
    effectPrompt: soloEffectPrompt,
    rareCandyMode: soloRareCandyMode,
    rareCandyTarget: soloRareCandyTarget,
    rareCandyCandidates: [...soloRareCandyCandidates],
  });
  const pushSoloHistory = () => {
    const snapshot = createSoloSnapshot();
    setSoloHistory((history) => [...history.slice(-29), snapshot]);
  };
  const restoreSoloSnapshot = (snapshot: SoloSnapshot) => {
    setSoloPile(snapshot.pile);
    setSoloHand(snapshot.hand);
    setSoloDiscard(snapshot.discard);
    setSoloPrizes(snapshot.prizes);
    setSoloStadiumCard(snapshot.stadiumCard);
    setSoloActiveStack(snapshot.activeStack);
    setSoloBenchStacks(snapshot.benchStacks);
    setSoloAttachedTools(snapshot.attachedTools);
    setSoloAttachedEnergies(snapshot.attachedEnergies);
    setSoloSelectedHandIndex(snapshot.selectedHandIndex);
    setSoloNotice("1手戻しました。");
    setSoloStartingPlayer(snapshot.startingPlayer);
    setSoloTurn(snapshot.turn);
    setSoloStarted(snapshot.started);
    setSoloSupporterUsedTurn(snapshot.supporterUsedTurn);
    setSoloEnergyAttachedTurn(snapshot.energyAttachedTurn);
    setSoloOpeningRedrawCount(snapshot.openingRedrawCount);
    setSoloTrashOpen(snapshot.trashOpen);
    setSoloCustomShuffleOpen(snapshot.customShuffleOpen);
    setSoloCustomShuffleDrawCount(snapshot.customShuffleDrawCount);
    setSoloEffectPrompt(snapshot.effectPrompt);
    setSoloRareCandyMode(snapshot.rareCandyMode);
    setSoloRareCandyTarget(snapshot.rareCandyTarget);
    setSoloRareCandyCandidates(snapshot.rareCandyCandidates);
  };
  const undoSoloAction = () => {
    const snapshot = soloHistory[soloHistory.length - 1];
    if (!snapshot) {
      setSoloNotice("戻せる操作がありません。");
      return;
    }
    restoreSoloSnapshot(snapshot);
    setSoloHistory((history) => history.slice(0, -1));
  };
  const openingHandStats = useMemo(() => {
    if (!selectedDeck) {
      return {
        totalCards: 0,
        basicPokemonCount: 0,
        keepProbability: 0,
        redrawProbability: 0,
        currentRedrawSequenceProbability: 0,
      };
    }
    const fullDeck = expandDeck(selectedDeck.cards, cardMasterDetails);
    const totalCards = fullDeck.length;
    const basicPokemonCount = fullDeck.filter((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0).length;
    const redrawProbability = getNoBasicOpeningProbability(totalCards, basicPokemonCount, 7);
    const keepProbability = 1 - redrawProbability;
    return {
      totalCards,
      basicPokemonCount,
      keepProbability,
      redrawProbability,
      currentRedrawSequenceProbability: Math.pow(redrawProbability, soloOpeningRedrawCount) * keepProbability,
    };
  }, [selectedDeck, cardMasterDetails, soloOpeningRedrawCount]);

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
    const loadCardMaster = async () => {
      setCardMasterLoading(true);
      try {
        const res = await fetch("/card-master-lite.json", { cache: "force-cache" });
        if (!res.ok) throw new Error("card-master-lite.json を取得できませんでした");
        const data = (await res.json()) as StaticCardMaster;
        if (!cancelled) {
          setCardMasterDetails(data.cards || {});
        }
      } catch {
        if (!cancelled) {
          setCardMasterDetails({});
          setSoloNotice("静的カードマスターの取得に失敗しました。配置判定は簡易判定で続行します。");
        }
      } finally {
        if (!cancelled) {
          setCardMasterLoading(false);
        }
      }
    };

    loadCardMaster();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = mode === "solo" ? "/ai-battle-room?mode=solo" : "/ai-battle-room";
    window.history.replaceState(null, "", url);
  }, [mode]);

  useEffect(() => {
    const resetFromDeck = () => {
      if (!selectedDeck) return;
      const pile = expandDeck(selectedDeck.cards, cardMasterDetails);
      setSoloPile(pile);
      setSoloHand([]);
      setSoloDiscard([]);
      setSoloPrizes([]);
      setSoloStadiumCard(null);
      setSoloActiveStack([]);
      setSoloBenchStacks(Array.from({ length: 5 }, () => []));
      setSoloAttachedTools(createEmptySoloTools());
      setSoloAttachedEnergies(createEmptySoloEnergies());
      setSoloSelectedHandIndex(null);
      setSoloNotice("");
      setSoloStartingPlayer("first");
      setSoloTurn(1);
      setSoloStarted(false);
      setSoloSupporterUsedTurn(null);
      setSoloEnergyAttachedTurn(null);
      setBattleLog([]);
      setBattleTurn(1);
      setBattleStarted(false);
      setAiGoingFirst(false);
      setSoloOpeningRedrawCount(0);
      setSoloCustomShuffleOpen(false);
      setSoloCustomShuffleDrawCount(7);
      setSoloEffectPrompt(null);
      setSoloRareCandyMode("idle");
      setSoloRareCandyTarget(null);
      setSoloRareCandyCandidates([]);
      setSoloHistory([]);
    };
    resetFromDeck();
  }, [selectedDeck, cardMasterDetails]);

  const deckSummary = summarizeDeck(selectedDeck);
  const deckTypeLabel = inferDeckLabel(selectedDeck);
  const deckTotal = selectedDeck ? selectedDeck.cards.reduce((sum, card) => sum + card.count, 0) : 0;
  const selectedDeckEditHref = selectedDeck
    ? `/decks/view?id=${encodeURIComponent(selectedDeck.deckId)}`
    : "/decks/new";

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
    pushSoloHistory();
    const pile = expandDeck(selectedDeck.cards, cardMasterDetails);
    const handDraw = takeRandomCards(pile, 7);
    const prizeDraw = takeRandomCards(handDraw.rest, 6);
    setSoloHand(handDraw.drawn);
    setSoloDiscard([]);
    setSoloPile(prizeDraw.rest);
    setSoloPrizes(prizeDraw.drawn);
    setSoloStadiumCard(null);
    setSoloActiveStack([]);
    setSoloBenchStacks(Array.from({ length: 5 }, () => []));
    setSoloAttachedTools(createEmptySoloTools());
    setSoloAttachedEnergies(createEmptySoloEnergies());
    setSoloSelectedHandIndex(null);
    setSoloNotice("");
    setSoloTurn(1);
    setSoloStarted(true);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
    setSoloTrashOpen(false);
    setSoloOpeningRedrawCount(0);
    setSoloCustomShuffleOpen(false);
    setSoloCustomShuffleDrawCount(7);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const shuffleHandIntoDeckAndDraw = (redrawCount = soloHand.length) => {
    if (soloHand.length === 0) {
      setSoloNotice("戻す手札がありません。");
      return;
    }
    pushSoloHistory();
    const isOpeningSevenRedraw =
      soloStarted &&
      soloTurn === 1 &&
      soloHand.length === 7 &&
      soloPrizes.length === 6 &&
      soloDiscard.length === 0 &&
      soloActiveStack.length === 0 &&
      soloBenchStacks.every((stack) => stack.length === 0);
    const nextDeck = [...soloPile, ...soloHand].sort(() => Math.random() - 0.5);
    const draw = takeRandomCards(nextDeck, redrawCount);
    setSoloPile(draw.rest);
    setSoloHand(draw.drawn);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    if (isOpeningSevenRedraw) {
      setSoloOpeningRedrawCount((count) => count + 1);
    }
    setSoloNotice(
      isOpeningSevenRedraw
        ? `最初の7枚を山札に戻してシャッフルし、${draw.drawn.length}枚引き直しました。`
        : `手札${soloHand.length}枚を山札に戻してシャッフルし、${draw.drawn.length}枚引き直しました。`
    );
  };

  const shuffleSolo = () => {
    shuffleHandIntoDeckAndDraw();
  };

  const shuffleHandIntoDeckAndDrawCustom = () => {
    if (soloHand.length === 0) {
      setSoloNotice("戻す手札がありません。");
      return;
    }
    pushSoloHistory();
    const drawCount = Math.max(0, Math.floor(soloCustomShuffleDrawCount || 0));
    const nextDeck = [...soloPile, ...soloHand].sort(() => Math.random() - 0.5);
    const draw = takeRandomCards(nextDeck, drawCount);
    setSoloPile(draw.rest);
    setSoloHand(draw.drawn);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloNotice(`手札${soloHand.length}枚を山札に戻してシャッフルし、指定枚数として${draw.drawn.length}枚引きました。`);
  };

  const resetSolo = () => {
    if (!selectedDeck) return;
    pushSoloHistory();
    const pile = expandDeck(selectedDeck.cards, cardMasterDetails);
    setSoloPile(pile);
    setSoloHand([]);
    setSoloDiscard([]);
    setSoloPrizes([]);
    setSoloStadiumCard(null);
    setSoloActiveStack([]);
    setSoloBenchStacks(Array.from({ length: 5 }, () => []));
    setSoloAttachedTools(createEmptySoloTools());
    setSoloAttachedEnergies(createEmptySoloEnergies());
    setSoloSelectedHandIndex(null);
    setSoloNotice("一人回しをリセットしました。");
    setSoloStartingPlayer("first");
    setSoloTurn(1);
    setSoloStarted(false);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
    setSoloTrashOpen(false);
    setSoloOpeningRedrawCount(0);
    setSoloCustomShuffleOpen(false);
    setSoloCustomShuffleDrawCount(7);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const drawSolo = (count = 1) => {
    if (soloPile.length === 0 || count <= 0) {
      setSoloNotice("山札から引けるカードがありません。");
      return;
    }
    pushSoloHistory();
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
    if (placementType === "tool") {
      setSoloNotice("ポケモンのどうぐです。つけたいバトル場かベンチのポケモンを選んでください。");
      return;
    }
    if (placementType === "item" || placementType === "supporter" || placementType === "trainer") {
      setSoloNotice(
        placementType === "supporter"
          ? isSoloFirstTurnSupporterLocked
            ? "先攻の最初の番はサポートを使えません。"
            : "サポートです。このターンまだ使っていなければ「使う」でトラッシュします。"
          : "グッズなどのトレーナーズです。「使う」で効果処理後にトラッシュします。"
      );
      return;
    }
    if (stageOrder === null) {
      if (cardTypeLabel === "trainer") {
        setSoloNotice("グッズ・サポートなどのトレーナーズはバトル場やベンチに置けません。");
      } else if (cardTypeLabel === "energy") {
        setSoloNotice(
          soloEnergyAttachedTurn === soloTurn
            ? "このターンはすでにエネルギーを1枚つけています。"
            : "エネルギーカードです。つけたいバトル場かベンチのポケモンを選んでください。"
        );
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
    if (wasPokemonPutInPlayThisTurn(targetTop, soloTurn)) {
      setSoloNotice("このターンに出したポケモンは進化できません。");
      return;
    }

    pushSoloHistory();
    const nextHand = soloHand.filter((_, index) => index !== candyIndex && index !== candidate.handIndex);
    const evolvedCard: SoloCard = { ...candidate.card, playedTurn: soloTurn };

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
        if (wasPokemonPutInPlayThisTurn(targetTop, soloTurn)) {
          setSoloNotice("このターンに出したポケモンは進化できません。");
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
    } else if (placementType === "energy") {
      if (!isOccupied) {
        setSoloNotice("エネルギーは場のポケモンにだけつけられます。");
        return;
      }
      if (soloEnergyAttachedTurn === soloTurn) {
        setSoloNotice("このターンはすでにエネルギーを1枚つけています。");
        return;
      }

      pushSoloHistory();
      const nextHand = soloHand.filter((_, index) => index !== soloSelectedHandIndex);
      const nextEnergy: SoloCard = { ...picked };
      if (target === "active") {
        setSoloAttachedEnergies((energies) => ({ ...energies, active: [...energies.active, nextEnergy] }));
      } else {
        setSoloAttachedEnergies((energies) => ({
          ...energies,
          bench: energies.bench.map((attached, index) => (index === target ? [...attached, nextEnergy] : attached)),
        }));
      }
      setSoloHand(nextHand);
      setSoloSelectedHandIndex(null);
      setSoloEnergyAttachedTurn(soloTurn);
      setSoloNotice(`${picked.cardName || "エネルギー"}を${sourceLabel}のポケモンにつけました。`);
      return;
    } else if (placementType === "tool") {
      if (!isOccupied) {
        setSoloNotice("ポケモンのどうぐは場のポケモンにだけつけられます。");
        return;
      }
      const currentTool = target === "active" ? soloAttachedTools.active : soloAttachedTools.bench[target];
      if (currentTool) {
        setSoloNotice("そのポケモンにはすでにポケモンのどうぐがついています。");
        return;
      }

      pushSoloHistory();
      const nextHand = soloHand.filter((_, index) => index !== soloSelectedHandIndex);
      const nextTool: SoloCard = { ...picked };
      if (target === "active") {
        setSoloAttachedTools((tools) => ({ ...tools, active: nextTool }));
      } else {
        setSoloAttachedTools((tools) => ({
          ...tools,
          bench: tools.bench.map((tool, index) => (index === target ? nextTool : tool)),
        }));
      }
      setSoloHand(nextHand);
      setSoloSelectedHandIndex(null);
      const toolEffect = getEffectProfile(nextTool);
      setSoloNotice(`${picked.cardName || "ポケモンのどうぐ"}を${sourceLabel}のポケモンにつけました。${toolEffect ? ` 効果: ${toolEffect.label}` : ""}`);
      return;
    } else if (placementType !== "pokemon") {
      setSoloNotice("グッズ・サポートは「使う」、ポケモンのどうぐはポケモンにつけて使います。");
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
      if (wasPokemonPutInPlayThisTurn(targetTop, soloTurn)) {
        setSoloNotice("このターンに出したポケモンは進化できません。");
        return;
      }
      if (stageOrder !== targetTopOrder + 1) {
        setSoloNotice(`${targetTopOrder + 1}段階目の進化だけがこの枠に重ねられます。`);
        return;
      }
    }

    pushSoloHistory();
    const nextHand = soloHand.filter((_, index) => index !== soloSelectedHandIndex);
    const nextCard: SoloCard = { ...picked, playedTurn: target === "stadium" ? undefined : soloTurn };
    if (target === "active") {
      setSoloActiveStack((stack) => (isOccupied ? [...stack, nextCard] : [nextCard]));
    } else if (target === "stadium") {
      if (soloStadiumCard) {
        setSoloDiscard((discard) => [...discard, soloStadiumCard]);
      }
      setSoloStadiumCard(nextCard);
    } else {
      setSoloBenchStacks((stacks) =>
        stacks.map((stack, index) => (index === target ? (isOccupied ? [...stack, nextCard] : [nextCard]) : stack))
      );
    }

    setSoloHand(nextHand);
    setSoloSelectedHandIndex(null);
    const placementEffect = getEffectProfile(nextCard);
    setSoloNotice(`${picked.cardName || "カード"}を${sourceLabel}に配置しました。${placementEffect ? ` 効果: ${placementEffect.label}` : ""}`);
  };

  const discardSelectedHandCard = (message?: string, trackHistory = true) => {
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

    if (trackHistory) {
      pushSoloHistory();
    }
    setSoloHand((hand) => hand.filter((_, index) => index !== soloSelectedHandIndex));
    setSoloDiscard((discard) => [...discard, picked]);
    setSoloSelectedHandIndex(null);
    setSoloNotice(message || `${picked.cardName || "カード"}をトラッシュしました。`);
  };

  const drawCardsToHand = (count: number) => {
    setSoloPile((pile) => {
      const randomized = takeRandomCards(pile, count);
      setSoloHand((hand) => [...hand, ...randomized.drawn]);
      return randomized.rest;
    });
  };

  const countSoloBoardPokemon = () => {
    return (soloActiveStack.length > 0 ? 1 : 0) + soloBenchStacks.filter((stack) => stack.length > 0).length;
  };

  const drawUntilBoardPokemonCount = (nextHand: SoloCard[]) => {
    const drawCount = Math.max(0, countSoloBoardPokemon() - nextHand.length);
    if (drawCount > 0) {
      const randomized = takeRandomCards(soloPile, drawCount);
      setSoloPile(randomized.rest);
      setSoloHand([...nextHand, ...randomized.drawn]);
      return randomized.drawn.length;
    }
    setSoloHand(nextHand);
    return 0;
  };

  const getSearchVisiblePileIndexes = (pile: SoloCard[], action: Extract<EffectAction, { type: "search_deck" }>) => {
    if (!action.look || action.look.opponent) {
      return pile.map((_, index) => index);
    }
    const lookCount = Math.max(0, Math.min(action.look.count, pile.length));
    if (action.look.from === "bottom") {
      return Array.from({ length: lookCount }, (_, index) => pile.length - lookCount + index);
    }
    return Array.from({ length: lookCount }, (_, index) => index);
  };

  const openSearchDeckPrompt = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "search_deck" }>
  ) => {
    const visiblePileIndexes = getSearchVisiblePileIndexes(soloPile, action);
    const candidates = visiblePileIndexes
      .map((pileIndex) => soloPile[pileIndex])
      .filter((card): card is SoloCard => Boolean(card))
      .filter((card) => matchesSearchTarget(card, action.target));
    if (candidates.length === 0) {
      setSoloNotice(
        action.look
          ? `確認した${action.look.count}枚に対象の${getSearchTargetLabel(action.target)}が見つかりません。`
          : `山札に対象の${getSearchTargetLabel(action.target)}が見つかりません。`
      );
      return false;
    }
    setSoloEffectPrompt({
      kind: "search_deck",
      sourceHandIndex,
      sourceCard,
      action,
      selectedPileIndexes: [],
      visiblePileIndexes,
    });
    setSoloNotice(
      action.look
        ? `${action.look.from === "bottom" ? "山札の下" : "山札の上"}から${action.look.count}枚を確認し、${getSearchTargetLabel(action.target)}を${action.count}枚まで選んでください。`
        : `山札から${getSearchTargetLabel(action.target)}を${action.count}枚まで選んでください。`
    );
    return true;
  };

  const openRecoverTrashPrompt = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "recover_from_trash" }>
  ) => {
    const candidates = soloDiscard.filter((card) => matchesSearchTarget(card, action.target));
    if (candidates.length === 0) {
      setSoloNotice(`トラッシュに対象の${getSearchTargetLabel(action.target)}が見つかりません。`);
      return false;
    }
    setSoloEffectPrompt({
      kind: "recover_from_trash",
      sourceHandIndex,
      sourceCard,
      action,
      selectedDiscardIndexes: [],
    });
    setSoloNotice(`トラッシュから${getSearchTargetLabel(action.target)}を${action.count}枚まで選んでください。`);
    return true;
  };

  const openSwitchActivePrompt = (sourceHandIndex: number | null, sourceCard: SoloCard) => {
    if (soloActiveStack.length === 0) {
      setSoloNotice("バトル場にポケモンがいません。");
      return false;
    }
    if (!soloBenchStacks.some((stack) => stack.length > 0)) {
      setSoloNotice("入れ替え先のベンチポケモンがいません。");
      return false;
    }
    setSoloEffectPrompt({
      kind: "switch_active",
      sourceHandIndex,
      sourceCard,
      selectedBenchIndex: null,
    });
    setSoloNotice("入れ替え先のベンチポケモンを選んでください。");
    return true;
  };

  const openBoardPokemonPrompt = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "heal_pokemon" | "discard_tool" }>
  ) => {
    const hasPokemon = soloActiveStack.length > 0 || soloBenchStacks.some((stack) => stack.length > 0);
    if (!hasPokemon) {
      setSoloNotice("対象にできる自分のポケモンがいません。");
      return false;
    }
    if (action.type === "discard_tool") {
      const hasTool = Boolean(soloAttachedTools.active) || soloAttachedTools.bench.some(Boolean);
      if (!hasTool) {
        setSoloNotice("トラッシュできるポケモンのどうぐがありません。");
        return false;
      }
    }
    setSoloEffectPrompt({
      kind: "select_board_pokemon",
      sourceHandIndex,
      sourceCard,
      action,
    });
    setSoloNotice(action.type === "heal_pokemon" ? "回復するポケモンを選んでください。" : "どうぐをトラッシュするポケモンを選んでください。");
    return true;
  };

  const executeDiscardStadiumAction = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "discard_stadium" }>,
    trackHistory = true
  ) => {
    if (!soloStadiumCard) {
      setSoloNotice("トラッシュできるスタジアムがありません。");
      return false;
    }
    if (trackHistory) {
      pushSoloHistory();
    }
    if (sourceHandIndex !== null) {
      const source = soloHand[sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== sourceHandIndex));
      setSoloDiscard((discard) => [...discard, source, soloStadiumCard].filter(Boolean));
    } else {
      setSoloDiscard((discard) => [...discard, soloStadiumCard]);
    }
    setSoloStadiumCard(null);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(`${sourceCard.cardName || "トレーナーズ"}の効果でスタジアムをトラッシュしました。${action.note}`);
    return true;
  };

  const useSelectedTrainerCard = () => {
    if (!selectedSoloCard) {
      setSoloNotice("まず手札のカードを選んでください。");
      return;
    }

    const placementType = getCardPlacementType(selectedSoloCard);
    if (placementType === "stadium") {
      setSoloNotice("スタジアムはスタジアム枠を押して場に出してください。");
      return;
    }
    if (placementType === "tool") {
      setSoloNotice("ポケモンのどうぐは、つけたいバトル場かベンチのポケモンを押してください。");
      return;
    }
    if (placementType !== "item" && placementType !== "supporter" && placementType !== "trainer") {
      setSoloNotice("このカードはトレーナーズとして使えません。");
      return;
    }
    if (placementType === "supporter" && soloSupporterUsedTurn === soloTurn) {
      setSoloNotice("このターンはすでにサポートを使っています。");
      return;
    }
    if (placementType === "supporter" && isSoloFirstTurnSupporterLocked) {
      setSoloNotice("先攻の最初の番はサポートを使えません。");
      return;
    }
    if (soloSelectedHandIndex === null) {
      setSoloNotice("まず手札のカードを選んでください。");
      return;
    }

    const sourceHandIndex = soloSelectedHandIndex;
    const sourceCard = selectedSoloCard;
    const profile = getEffectProfile(sourceCard);
    const firstAction = profile?.actions[0];
    const firstCost = profile?.costs?.[0];
    const markSupporterUsed = () => {
      if (placementType === "supporter") {
        setSoloSupporterUsedTurn(soloTurn);
      }
    };

    if (!profile || !firstAction) {
      pushSoloHistory();
      markSupporterUsed();
      discardSelectedHandCard(`${sourceCard.cardName || "トレーナーズ"}を使ってトラッシュしました。効果を自動解決済みにしました。`, false);
      return;
    }

    if (firstAction.type === "resolve_effect") {
      pushSoloHistory();
      markSupporterUsed();
      discardSelectedHandCard(`${sourceCard.cardName || "トレーナーズ"}を使ってトラッシュしました。${firstAction.note}`, false);
      return;
    }

    if (firstCost?.type === "discard_from_hand") {
      const availableCostCards = soloHand.filter((_, index) => index !== sourceHandIndex).length;
      if (availableCostCards < firstCost.count) {
        setSoloNotice(`手札コストが足りません。${sourceCard.cardName || "このカード"}以外に${firstCost.count}枚必要です。`);
        return;
      }
      setSoloEffectPrompt({
        kind: "discard_from_hand",
        sourceHandIndex,
        sourceCard,
        nextAction: firstAction,
        count: firstCost.count,
        selectedHandIndexes: [],
      });
      pushSoloHistory();
      markSupporterUsed();
      setSoloNotice(`コストとして手札を${firstCost.count}枚選んでください。`);
      return;
    }

    if (firstAction.type === "draw_cards") {
      pushSoloHistory();
      markSupporterUsed();
      const source = soloHand[sourceHandIndex];
      const remainingHand = soloHand.filter((_, index) => index !== sourceHandIndex);
      setSoloHand(firstAction.discardRemainingHand ? [] : remainingHand);
      setSoloDiscard((discard) => [
        ...discard,
        source,
        ...(firstAction.discardRemainingHand ? remainingHand : []),
      ]);
      setSoloSelectedHandIndex(null);
      drawCardsToHand(firstAction.count);
      setSoloNotice(`${sourceCard.cardName || "トレーナーズ"}の効果で${firstAction.count}枚引きました。`);
      return;
    }

    if (firstAction.type === "draw_until_board_count") {
      pushSoloHistory();
      markSupporterUsed();
      const source = soloHand[sourceHandIndex];
      const nextHand = soloHand.filter((_, index) => index !== sourceHandIndex);
      const drawnCount = drawUntilBoardPokemonCount(nextHand);
      setSoloDiscard((discard) => [...discard, source]);
      setSoloSelectedHandIndex(null);
      setSoloNotice(`${sourceCard.cardName || "トレーナーズ"}の効果で、場のポケモンの数に合わせて${drawnCount}枚引きました。`);
      return;
    }

    if (firstAction.type === "search_deck") {
      if (openSearchDeckPrompt(sourceHandIndex, sourceCard, firstAction)) {
        pushSoloHistory();
        markSupporterUsed();
      }
      return;
    }

    if (firstAction.type === "recover_from_trash") {
      if (openRecoverTrashPrompt(sourceHandIndex, sourceCard, firstAction)) {
        pushSoloHistory();
        markSupporterUsed();
      }
      return;
    }

    if (firstAction.type === "switch_active") {
      if (openSwitchActivePrompt(sourceHandIndex, sourceCard)) {
        pushSoloHistory();
        markSupporterUsed();
      }
      return;
    }

    if (firstAction.type === "heal_pokemon" || firstAction.type === "discard_tool") {
      if (openBoardPokemonPrompt(sourceHandIndex, sourceCard, firstAction)) {
        pushSoloHistory();
        markSupporterUsed();
      }
      return;
    }

    if (firstAction.type === "discard_stadium") {
      if (executeDiscardStadiumAction(sourceHandIndex, sourceCard, firstAction)) {
        markSupporterUsed();
      }
    }
  };

  const toggleEffectHandSelection = (handIndex: number) => {
    setSoloEffectPrompt((prompt) => {
      if (!prompt || prompt.kind !== "discard_from_hand" || handIndex === prompt.sourceHandIndex) return prompt;
      const selected = prompt.selectedHandIndexes.includes(handIndex)
        ? prompt.selectedHandIndexes.filter((index) => index !== handIndex)
        : [...prompt.selectedHandIndexes, handIndex].slice(0, prompt.count);
      return { ...prompt, selectedHandIndexes: selected };
    });
  };

  const confirmEffectDiscardCost = () => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "discard_from_hand") return;
    if (soloEffectPrompt.selectedHandIndexes.length !== soloEffectPrompt.count) {
      setSoloNotice(`コストとして手札を${soloEffectPrompt.count}枚選んでください。`);
      return;
    }

    const discardIndexes = new Set([soloEffectPrompt.sourceHandIndex, ...soloEffectPrompt.selectedHandIndexes]);
    const discardedCards = soloHand.filter((_, index) => discardIndexes.has(index));
    setSoloHand((hand) => hand.filter((_, index) => !discardIndexes.has(index)));
    setSoloDiscard((discard) => [...discard, ...discardedCards]);
    setSoloSelectedHandIndex(null);

    if (soloEffectPrompt.nextAction.type === "search_deck") {
      openSearchDeckPrompt(null, soloEffectPrompt.sourceCard, soloEffectPrompt.nextAction);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "recover_from_trash") {
      openRecoverTrashPrompt(null, soloEffectPrompt.sourceCard, soloEffectPrompt.nextAction);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "switch_active") {
      openSwitchActivePrompt(null, soloEffectPrompt.sourceCard);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "heal_pokemon" || soloEffectPrompt.nextAction.type === "discard_tool") {
      openBoardPokemonPrompt(null, soloEffectPrompt.sourceCard, soloEffectPrompt.nextAction);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "discard_stadium") {
      executeDiscardStadiumAction(null, soloEffectPrompt.sourceCard, soloEffectPrompt.nextAction, false);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "resolve_effect") {
      setSoloEffectPrompt(null);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果を自動解決済みにしました。${soloEffectPrompt.nextAction.note}`);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "draw_cards") {
      drawCardsToHand(soloEffectPrompt.nextAction.count);
      setSoloEffectPrompt(null);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${soloEffectPrompt.nextAction.count}枚引きました。`);
      return;
    }
    if (soloEffectPrompt.nextAction.type === "draw_until_board_count") {
      const nextHand = soloHand.filter((_, index) => !discardIndexes.has(index));
      const drawnCount = drawUntilBoardPokemonCount(nextHand);
      setSoloEffectPrompt(null);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で、場のポケモンの数に合わせて${drawnCount}枚引きました。`);
    }
  };

  const toggleEffectPileSelection = (pileIndex: number) => {
    setSoloEffectPrompt((prompt) => {
      if (!prompt || prompt.kind !== "search_deck") return prompt;
      const selected = prompt.selectedPileIndexes.includes(pileIndex)
        ? prompt.selectedPileIndexes.filter((index) => index !== pileIndex)
        : [...prompt.selectedPileIndexes, pileIndex].slice(0, prompt.action.count);
      return { ...prompt, selectedPileIndexes: selected };
    });
  };

  const confirmEffectSearchDeck = () => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "search_deck") return;
    if (soloEffectPrompt.selectedPileIndexes.length === 0) {
      setSoloNotice("山札から加えるカードを選んでください。");
      return;
    }

    const selectedIndexes = new Set(soloEffectPrompt.selectedPileIndexes);
    const selectedCards = soloPile.filter((_, index) => selectedIndexes.has(index));
    const visibleIndexes = new Set(soloEffectPrompt.visiblePileIndexes || soloPile.map((_, index) => index));
    const unselectedVisibleCards = soloPile.filter((_, index) => visibleIndexes.has(index) && !selectedIndexes.has(index));
    const restPile = soloPile
      .map((card, pileIndex) => ({ card, pileIndex }))
      .filter(({ pileIndex }) => !selectedIndexes.has(pileIndex))
      .filter(({ pileIndex }) => soloEffectPrompt.action.remainingDestination !== "discard" || !visibleIndexes.has(pileIndex))
      .map(({ card }) => card)
      .sort(() => Math.random() - 0.5);

    if (soloEffectPrompt.action.destination === "bench") {
      const emptyBenchIndexes = soloBenchStacks
        .map((stack, index) => ({ stack, index }))
        .filter(({ stack }) => stack.length === 0)
        .map(({ index }) => index);
      if (emptyBenchIndexes.length < selectedCards.length) {
        setSoloNotice("ベンチの空きが足りません。");
        return;
      }
      setSoloBenchStacks((stacks) => {
        const nextStacks = stacks.map((stack) => [...stack]);
        selectedCards.forEach((card, selectedIndex) => {
          nextStacks[emptyBenchIndexes[selectedIndex]] = [{ ...card, playedTurn: soloTurn }];
        });
        return nextStacks;
      });
    } else if (soloEffectPrompt.action.destination === "stadium") {
      const [stadiumCard] = selectedCards;
      if (stadiumCard) {
        if (soloStadiumCard) {
          setSoloDiscard((discard) => [...discard, soloStadiumCard]);
        }
        setSoloStadiumCard(stadiumCard);
      }
    } else if (soloEffectPrompt.action.destination === "attach_energy") {
      if (soloActiveStack.length > 0) {
        setSoloAttachedEnergies((energies) => ({
          ...energies,
          active: [...energies.active, ...selectedCards],
        }));
      } else {
        const firstBenchIndex = soloBenchStacks.findIndex((stack) => stack.length > 0);
        if (firstBenchIndex === -1) {
          setSoloNotice("エネルギーをつけるポケモンが場にいません。");
          return;
        }
        setSoloAttachedEnergies((energies) => ({
          ...energies,
          bench: energies.bench.map((attached, index) =>
            index === firstBenchIndex ? [...attached, ...selectedCards] : attached
          ),
        }));
      }
    } else {
      setSoloHand((hand) => [...hand, ...selectedCards]);
    }

    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      setSoloDiscard((discard) => [
        ...discard,
        source,
        ...(soloEffectPrompt.action.remainingDestination === "discard" ? unselectedVisibleCards : []),
      ]);
    } else if (soloEffectPrompt.action.remainingDestination === "discard") {
      setSoloDiscard((discard) => [...discard, ...unselectedVisibleCards]);
    }
    setSoloPile(restPile);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(
      soloEffectPrompt.action.destination === "attach_energy"
        ? `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚を場のポケモンにつけ、山札をシャッフルしました。`
        : `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚選び、山札をシャッフルしました。`
    );
  };

  const toggleEffectDiscardSelection = (discardIndex: number) => {
    setSoloEffectPrompt((prompt) => {
      if (!prompt || prompt.kind !== "recover_from_trash") return prompt;
      const selected = prompt.selectedDiscardIndexes.includes(discardIndex)
        ? prompt.selectedDiscardIndexes.filter((index) => index !== discardIndex)
        : [...prompt.selectedDiscardIndexes, discardIndex].slice(0, prompt.action.count);
      return { ...prompt, selectedDiscardIndexes: selected };
    });
  };

  const confirmEffectRecoverTrash = () => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "recover_from_trash") return;
    if (soloEffectPrompt.selectedDiscardIndexes.length === 0) {
      setSoloNotice("トラッシュから回収するカードを選んでください。");
      return;
    }

    const selectedIndexes = new Set(soloEffectPrompt.selectedDiscardIndexes);
    const selectedCards = soloDiscard.filter((_, index) => selectedIndexes.has(index));
    setSoloDiscard((discard) => discard.filter((_, index) => !selectedIndexes.has(index)));
    setSoloHand((hand) => [...hand, ...selectedCards]);

    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      setSoloDiscard((discard) => [...discard, source]);
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚をトラッシュから手札に加えました。`);
  };

  const confirmEffectSwitchActive = (benchIndex: number) => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "switch_active") return;
    const benchStack = soloBenchStacks[benchIndex];
    if (!benchStack || benchStack.length === 0 || soloActiveStack.length === 0) {
      setSoloNotice("入れ替え先が見つかりません。");
      return;
    }

    setSoloBenchStacks((stacks) => stacks.map((stack, index) => (index === benchIndex ? soloActiveStack : stack)));
    setSoloActiveStack(benchStack);
    setSoloAttachedTools((tools) => {
      const nextBench = tools.bench.map((tool, index) => (index === benchIndex ? tools.active : tool));
      return { active: tools.bench[benchIndex], bench: nextBench };
    });
    setSoloAttachedEnergies((energies) => {
      const nextBench = energies.bench.map((attached, index) => (index === benchIndex ? energies.active : attached));
      return { active: energies.bench[benchIndex] || [], bench: nextBench };
    });

    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      setSoloDiscard((discard) => [...discard, source]);
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果でバトル場とベンチ${benchIndex + 1}を入れ替えました。`);
  };

  const confirmBoardPokemonAction = (location: "active" | "bench", benchIndex?: number) => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "select_board_pokemon") return;
    const targetStack = location === "active" ? soloActiveStack : soloBenchStacks[benchIndex || 0];
    if (!targetStack || targetStack.length === 0) {
      setSoloNotice("対象のポケモンが見つかりません。");
      return;
    }

    const targetLabel = location === "active" ? "バトル場" : `ベンチ${(benchIndex || 0) + 1}`;
    const topCard = targetStack[targetStack.length - 1];

    if (soloEffectPrompt.action.type === "discard_tool") {
      const tool = location === "active" ? soloAttachedTools.active : soloAttachedTools.bench[benchIndex || 0];
      if (!tool) {
        setSoloNotice("そのポケモンにはトラッシュできるどうぐがありません。");
        return;
      }
      const sourceCards: SoloCard[] = [];
      if (soloEffectPrompt.sourceHandIndex !== null) {
        const source = soloHand[soloEffectPrompt.sourceHandIndex];
        if (source) sourceCards.push(source);
        setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      }
      if (location === "active") {
        setSoloAttachedTools((tools) => ({ ...tools, active: null }));
      } else {
        setSoloAttachedTools((tools) => ({
          ...tools,
          bench: tools.bench.map((attachedTool, index) => (index === benchIndex ? null : attachedTool)),
        }));
      }
      setSoloDiscard((discard) => [...discard, ...sourceCards, tool]);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${targetLabel}のどうぐをトラッシュしました。`);
    } else {
      const sourceCards: SoloCard[] = [];
      if (soloEffectPrompt.sourceHandIndex !== null) {
        const source = soloHand[soloEffectPrompt.sourceHandIndex];
        if (source) sourceCards.push(source);
        setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      }
      setSoloDiscard((discard) => [...discard, ...sourceCards]);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${targetLabel}の${topCard?.cardName || "ポケモン"}を回復した扱いにしました。`);
    }

    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
  };

  const cancelEffectPrompt = () => {
    setSoloEffectPrompt(null);
    setSoloNotice("効果処理をキャンセルしました。");
  };

  const takePrize = () => {
    if (soloPrizes.length === 0) {
      setSoloNotice("サイドがありません。");
      return;
    }
    pushSoloHistory();
    setSoloPrizes((prizes) => {
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
    pushSoloHistory();
    setSoloTurn((turn) => turn + 1);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
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

  const renderSoloStack = (
    stack: SoloStack,
    attachedTool?: SoloCard | null,
    attachedEnergies: SoloCard[] = [],
    energyLayout: "active" | "bench" = "bench"
  ) => {
    const topCard = stack[stack.length - 1];
    if (!topCard) {
      return null;
    }
    const visibleEnergies = attachedEnergies.slice(-3);

    return (
      <div className={`solo-board-stack solo-board-stack--${energyLayout}`}>
        {visibleEnergies.length > 0 ? (
          <div className={`solo-board-energies solo-board-energies--${energyLayout}`} aria-label={`エネルギー${attachedEnergies.length}枚`}>
            {visibleEnergies.map((energy, index) => (
              <span
                key={`${energy.cardId}-attached-energy-${index}`}
                className="solo-board-energy-card"
                style={{ "--energy-index": index } as CSSProperties}
                title={energy.cardName || "エネルギー"}
              >
                {renderCardFace(energy, "solo-card-face--attached-energy")}
              </span>
            ))}
            {attachedEnergies.length > visibleEnergies.length ? (
              <span className={`solo-board-energy-count solo-board-energy-count--${energyLayout}`}>+{attachedEnergies.length - visibleEnergies.length}</span>
            ) : null}
          </div>
        ) : null}
        {renderCardFace(topCard, "solo-card-face--board")}
        {stack.length > 1 && <span className="solo-board-stack__count">+{stack.length - 1}</span>}
        {attachedTool ? <span className="solo-board-tool">{attachedTool.cardName || "どうぐ"}</span> : null}
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
  const effectSearchCandidates =
    soloEffectPrompt?.kind === "search_deck"
      ? (soloEffectPrompt.visiblePileIndexes || soloPile.map((_, index) => index))
          .map((pileIndex) => ({ card: soloPile[pileIndex], pileIndex }))
          .filter(({ card }) => Boolean(card))
          .filter(({ card }) => matchesSearchTarget(card, soloEffectPrompt.action.target))
      : [];
  const effectTrashCandidates =
    soloEffectPrompt?.kind === "recover_from_trash"
      ? soloDiscard
          .map((card, discardIndex) => ({ card, discardIndex }))
          .filter(({ card }) => matchesSearchTarget(card, soloEffectPrompt.action.target))
      : [];

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

        <div className="play-lab-page mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="play-lab-hero mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white/78 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
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

          <section className="play-lab-mode-switcher mb-6 rounded-[24px] border border-slate-200/80 bg-white/78 p-4 shadow-sm backdrop-blur-xl">
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
            <section className="play-lab-deck-section rounded-[28px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
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

                {mode === "solo" ? (
                  <div className="rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-black tracking-[0.14em] text-slate-500">先攻 / 後攻</div>
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          {soloStarted ? `開始済み T${soloTurn}` : "開始前に選んでください"}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                        {soloStartingPlayer === "first" ? "先攻" : "後攻"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={soloStarted}
                        onClick={() => setSoloStartingPlayer("first")}
                        className={`solo-turn-order-button rounded-full px-3 py-2 text-sm font-bold transition ${
                          soloStartingPlayer === "first"
                            ? "solo-turn-order-button--active bg-slate-950 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                        } ${soloStarted ? "cursor-not-allowed opacity-50" : "hover:bg-slate-100"}`}
                      >
                        先攻
                      </button>
                      <button
                        type="button"
                        disabled={soloStarted}
                        onClick={() => setSoloStartingPlayer("second")}
                        className={`solo-turn-order-button rounded-full px-3 py-2 text-sm font-bold transition ${
                          soloStartingPlayer === "second"
                            ? "solo-turn-order-button--active bg-slate-950 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                        } ${soloStarted ? "cursor-not-allowed opacity-50" : "hover:bg-slate-100"}`}
                      >
                        後攻
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">開始後はリセットまで変更できません。</p>
                  </div>
                ) : null}

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
                    href={selectedDeckEditHref}
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

            <section className="play-lab-practice-section rounded-[28px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
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
                  <div className="solo-playmat-shell__header flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-white">一人回し</h2>
                      <p className="solo-playmat-shell__description mt-1 text-sm leading-6 text-emerald-50/90">
                        札の流れを手で回して、初動と終盤の再現性を詰めます。
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSoloHintsVisible((visible) => !visible)}
                        className={`inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-bold transition ${
                          soloHintsVisible
                            ? "border-white bg-white text-emerald-950"
                            : "border-white/20 bg-white/12 text-emerald-50 hover:bg-white/18"
                        }`}
                        aria-pressed={soloHintsVisible}
                      >
                        ヒント {soloHintsVisible ? "ON" : "OFF"}
                      </button>
                      <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-emerald-50">
                        {soloTurnLabel}
                      </span>
                    </div>
                  </div>

                  {soloHintsVisible ? (
                    <div className="mt-3 rounded-[18px] border border-white/15 bg-white/10 p-3 text-sm leading-6 text-emerald-50/90">
                      基本ポケモンは空枠へ、進化は重ねます。グッズ・サポートは使う、どうぐはポケモンへ、スタジアムはスタジアム枠へ置きます。
                    </div>
                  ) : null}

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
                              renderSoloStack(soloActiveStack, soloAttachedTools.active, soloAttachedEnergies.active, "active")
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
                                    {renderSoloStack(soloBenchStacks[index], soloAttachedTools.bench[index], soloAttachedEnergies.bench[index], "bench")}
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
                        <div className="rounded-[18px] border border-white/15 bg-white/8 p-3 text-emerald-50">
                          <div className="text-[10px] font-black tracking-[0.14em] text-emerald-200">初手7枚</div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[10px] font-bold text-emerald-100/70">引き直し</div>
                              <div className="text-lg font-black">{soloOpeningRedrawCount}回</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-emerald-100/70">発生目安</div>
                              <div className="text-lg font-black">
                                {formatProbability(openingHandStats.currentRedrawSequenceProbability)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-emerald-100/75">
                            初手成立 {formatProbability(openingHandStats.keepProbability)} / たね {openingHandStats.basicPokemonCount}枚
                          </div>
                        </div>
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
                        <div className="solo-zone__hint">ポケモンは場へ、どうぐはポケモンへ、グッズ・サポートは選択中カードの「使う」を押してください。</div>
                      </div>
                    </div>
                  </div>

                  <div className="solo-selection-panel mt-4 rounded-[22px] border border-emerald-900/20 bg-emerald-950/80 p-4 text-emerald-50 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black tracking-[0.14em] text-emerald-200">選択中カード</h3>
                      <span className="text-xs font-semibold text-emerald-100/80">
                        {cardMasterLoading ? "マスター読込中" : soloStarted ? "開始済み" : "未開始"}
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
                                : getCardPlacementType(selectedSoloCard) === "tool"
                                  ? "ポケモンのどうぐです。バトル場かベンチのポケモンにつけられます。"
                                  : getCardPlacementType(selectedSoloCard) === "supporter"
                                    ? isSoloFirstTurnSupporterLocked
                                      ? "サポートです。先攻の最初の番は使えません。"
                                      : soloSupporterUsedTurn === soloTurn
                                      ? "サポートです。このターンはすでにサポートを使っています。"
                                      : "サポートです。「使う」で効果処理後にトラッシュします。"
                                    : getCardPlacementType(selectedSoloCard) === "item" || getCardPlacementType(selectedSoloCard) === "trainer"
                                      ? "グッズなどのトレーナーズです。「使う」で効果処理後にトラッシュします。"
                                  : getCardPlacementType(selectedSoloCard) === "energy"
                                  ? soloEnergyAttachedTurn === soloTurn
                                    ? "エネルギーカードです。このターンはすでに1枚つけています。"
                                    : "エネルギーカードです。バトル場かベンチのポケモンにつけられます。"
                                  : getStageOrder(selectedSoloCard) === 0
                                ? "基本ポケモン。空いているバトル場かベンチに置けます。"
                                : getStageOrder(selectedSoloCard) !== null
                                  ? `${getStageOrder(selectedSoloCard)}進化ポケモン。1つ前の進化段階が置かれた枠にだけ置けます。`
                                  : "詳細未取得。配置判定は保守的に扱います。"}
                            </p>
                            {(getCardPlacementType(selectedSoloCard) === "item" ||
                              getCardPlacementType(selectedSoloCard) === "supporter" ||
                              getCardPlacementType(selectedSoloCard) === "trainer" ||
                              getCardPlacementType(selectedSoloCard) === "tool" ||
                              getCardPlacementType(selectedSoloCard) === "stadium") ? (
                              <p className="mt-2 rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-xs leading-5 text-emerald-50/85">
                                {selectedEffectProfile
                                  ? `対応済み効果: ${selectedEffectProfile.label}`
                                  : "未対応効果: 使った後は手動操作で処理します。"}
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(getCardPlacementType(selectedSoloCard) === "item" ||
                                getCardPlacementType(selectedSoloCard) === "supporter" ||
                                getCardPlacementType(selectedSoloCard) === "trainer") ? (
                                <button
                                  type="button"
                                  onClick={useSelectedTrainerCard}
                                  disabled={getCardPlacementType(selectedSoloCard) === "supporter" && isSoloFirstTurnSupporterLocked}
                                  className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-emerald-950/60"
                                >
                                  使う
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => discardSelectedHandCard()}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                              >
                                手札からトラッシュ
                              </button>
                            </div>
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

                    {soloEffectPrompt ? (
                      <div
                        className={
                          soloEffectPrompt.kind === "search_deck" && soloEffectPrompt.action.look
                            ? "fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(960px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[22px] border border-white/15 bg-emerald-950 p-4 shadow-[0_28px_90px_rgba(2,6,23,0.55)]"
                            : "mt-3 rounded-[18px] border border-white/15 bg-white/8 p-3"
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">効果処理</div>
                            <p className="mt-1 text-sm font-bold text-emerald-50">
                              {soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={cancelEffectPrompt}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                          >
                            キャンセル
                          </button>
                        </div>

                        {soloEffectPrompt.kind === "discard_from_hand" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              コストとして手札を{soloEffectPrompt.count}枚選んでください。
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {soloHand.map((card, index) => {
                                const disabled = index === soloEffectPrompt.sourceHandIndex;
                                const selected = soloEffectPrompt.selectedHandIndexes.includes(index);
                                return (
                                  <button
                                    key={`${card.cardId}-cost-${index}`}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleEffectHandSelection(index)}
                                    className={`solo-card-chip ${selected ? "solo-card-chip--selected" : ""} ${disabled ? "opacity-35" : ""}`}
                                    title={disabled ? "使用するカード" : "コストにする"}
                                  >
                                    {renderCardFace(card)}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={confirmEffectDiscardCost}
                              className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                            >
                              コストをトラッシュして続ける
                            </button>
                          </div>
                        ) : soloEffectPrompt.kind === "search_deck" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              {soloEffectPrompt.action.look
                                ? `${soloEffectPrompt.action.look.from === "bottom" ? "山札の下" : "山札の上"}から${soloEffectPrompt.action.look.count}枚を確認しています。`
                                : "山札全体を確認しています。"}
                              {getSearchTargetLabel(soloEffectPrompt.action.target)}を{soloEffectPrompt.action.count}枚まで選んでください。
                            </p>
                            <div className="mt-2 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                              {effectSearchCandidates.length === 0 ? (
                                <p className="text-sm leading-6 text-emerald-50/80">候補がありません。</p>
                              ) : (
                                effectSearchCandidates.map(({ card, pileIndex }) => {
                                  const selected = soloEffectPrompt.selectedPileIndexes.includes(pileIndex);
                                  return (
                                    <button
                                      key={`${card.cardId}-search-${pileIndex}`}
                                      type="button"
                                      onClick={() => toggleEffectPileSelection(pileIndex)}
                                      className={`rounded-[16px] border p-2 text-left transition ${
                                        selected ? "border-yellow-300 bg-yellow-300/16" : "border-white/15 bg-emerald-900/60 hover:bg-emerald-900"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {renderCardFace(card, "solo-card-face--candidate")}
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-emerald-50">{card.cardName || "カード"}</p>
                                          <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                            {selected ? "選択中" : "押すと選択"}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={confirmEffectSearchDeck}
                              className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                            >
                              選んだカードを反映する
                            </button>
                          </div>
                        ) : soloEffectPrompt.kind === "recover_from_trash" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              トラッシュから{getSearchTargetLabel(soloEffectPrompt.action.target)}を{soloEffectPrompt.action.count}枚まで選んでください。
                            </p>
                            <div className="mt-2 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                              {effectTrashCandidates.length === 0 ? (
                                <p className="text-sm leading-6 text-emerald-50/80">候補がありません。</p>
                              ) : (
                                effectTrashCandidates.map(({ card, discardIndex }) => {
                                  const selected = soloEffectPrompt.selectedDiscardIndexes.includes(discardIndex);
                                  return (
                                    <button
                                      key={`${card.cardId}-recover-${discardIndex}`}
                                      type="button"
                                      onClick={() => toggleEffectDiscardSelection(discardIndex)}
                                      className={`rounded-[16px] border p-2 text-left transition ${
                                        selected ? "border-yellow-300 bg-yellow-300/16" : "border-white/15 bg-emerald-900/60 hover:bg-emerald-900"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {renderCardFace(card, "solo-card-face--candidate")}
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-emerald-50">{card.cardName || "カード"}</p>
                                          <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                            {selected ? "選択中" : "押すと選択"}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={confirmEffectRecoverTrash}
                              className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                            >
                              選んだカードを手札に加える
                            </button>
                          </div>
                        ) : soloEffectPrompt.kind === "switch_active" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">入れ替え先のベンチポケモンを選んでください。</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {soloBenchStacks.map((stack, index) => (
                                <button
                                  key={`switch-bench-${index}`}
                                  type="button"
                                  disabled={stack.length === 0}
                                  onClick={() => confirmEffectSwitchActive(index)}
                                  className="rounded-[16px] border border-white/15 bg-emerald-900/60 p-2 text-left transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <div className="flex items-center gap-2">
                                    {stack.length ? renderCardFace(stack[stack.length - 1], "solo-card-face--candidate") : null}
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-emerald-50">ベンチ{index + 1}</p>
                                      <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                        {stack[stack.length - 1]?.cardName || "空き"}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              {soloEffectPrompt.action.type === "heal_pokemon" ? "回復するポケモンを選んでください。" : "どうぐをトラッシュするポケモンを選んでください。"}
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              <button
                                type="button"
                                disabled={
                                  soloActiveStack.length === 0 ||
                                  (soloEffectPrompt.action.type === "discard_tool" && !soloAttachedTools.active)
                                }
                                onClick={() => confirmBoardPokemonAction("active")}
                                className="rounded-[16px] border border-white/15 bg-emerald-900/60 p-2 text-left transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <div className="flex items-center gap-2">
                                  {soloActiveStack.length ? renderCardFace(soloActiveStack[soloActiveStack.length - 1], "solo-card-face--candidate") : null}
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-emerald-50">バトル場</p>
                                    <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                      {soloActiveStack[soloActiveStack.length - 1]?.cardName || "空き"}
                                      {soloEffectPrompt.action.type === "discard_tool" && soloAttachedTools.active ? ` / ${soloAttachedTools.active.cardName || "どうぐ"}` : ""}
                                    </p>
                                  </div>
                                </div>
                              </button>
                              {soloBenchStacks.map((stack, index) => (
                                <button
                                  key={`board-action-bench-${index}`}
                                  type="button"
                                  disabled={
                                    stack.length === 0 ||
                                    (soloEffectPrompt.action.type === "discard_tool" && !soloAttachedTools.bench[index])
                                  }
                                  onClick={() => confirmBoardPokemonAction("bench", index)}
                                  className="rounded-[16px] border border-white/15 bg-emerald-900/60 p-2 text-left transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <div className="flex items-center gap-2">
                                    {stack.length ? renderCardFace(stack[stack.length - 1], "solo-card-face--candidate") : null}
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-emerald-50">ベンチ{index + 1}</p>
                                      <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                        {stack[stack.length - 1]?.cardName || "空き"}
                                        {soloEffectPrompt.action.type === "discard_tool" && soloAttachedTools.bench[index] ? ` / ${soloAttachedTools.bench[index]?.cardName || "どうぐ"}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {soloNotice && <p className="mt-3 text-sm leading-6 text-emerald-100/90">{soloNotice}</p>}
                  </div>

                  <div className="solo-action-bar mt-4 flex flex-wrap gap-3">
                    {!soloStarted ? (
                      <button
                        type="button"
                        onClick={startSolo}
                        disabled={cardMasterLoading}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        7枚引いて開始
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={undoSoloAction}
                      disabled={soloHistory.length === 0}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-5 text-sm font-bold text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      1手戻し
                    </button>
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
                      手札を戻して引き直す
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoloCustomShuffleOpen((open) => !open)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 text-sm font-bold text-emerald-800 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                    >
                      指定枚数でシャッフル
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

                  {soloCustomShuffleOpen ? (
                    <div className="mt-3 rounded-[18px] border border-emerald-900/20 bg-white p-3 text-slate-800 shadow-sm">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label htmlFor="solo-custom-shuffle-draw-count" className="block text-[11px] font-black tracking-[0.14em] text-emerald-700">
                            手札シャッフル
                          </label>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              id="solo-custom-shuffle-draw-count"
                              type="number"
                              min={0}
                              max={soloPile.length + soloHand.length}
                              value={soloCustomShuffleDrawCount}
                              onChange={(event) => setSoloCustomShuffleDrawCount(Number(event.target.value))}
                              className="h-10 w-24 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
                            />
                            <span className="text-sm font-semibold text-slate-600">枚引く</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[4, 5, 6, 7].map((count) => (
                            <button
                              key={`shuffle-count-${count}`}
                              type="button"
                              onClick={() => setSoloCustomShuffleDrawCount(count)}
                              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                            >
                              {count}枚
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={shuffleHandIntoDeckAndDrawCustom}
                          disabled={soloHand.length === 0}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          手札を戻して実行
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        ゲーム中のカード効果用です。初手7枚の引き直し回数には加算しません。
                      </p>
                    </div>
                  ) : null}

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
