"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AuthStatus from "@/components/AuthStatus";
import { Deck, DeckCard, listDecks } from "@/lib/api";

type PracticeMode = "ai" | "solo";
type AiStyle = "speed" | "control" | "stability" | "random";
type SoloStartingPlayer = "first" | "second";
type SoloPlacementType = "pokemon" | "item" | "supporter" | "tool" | "stadium" | "energy" | "trainer" | "unknown";
type SoloCard = DeckCard & {
  soloInstanceId?: string;
  name?: string;
  cardKind?: string;
  subKind?: string;
  regulation?: string;
  setCode?: string;
  setName?: string;
  evolvesFrom?: string;
  familyId?: string;
  allowedPreEvolutionNames?: string[];
  types?: string[];
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
  hp?: number | null;
  attacks?: Array<{ name?: string; damage?: number | string; cost?: string[]; text?: string }>;
  abilities?: Array<{ name?: string; text?: string }>;
  ruleText?: string;
  searchTokens?: string[];
  effectProfile?: EffectProfile | null;
  playedTurn?: number;
};
type BattleAttack = NonNullable<SoloCard["attacks"]>[number];
type SoloStack = SoloCard[];
type SoloToolState = {
  active: SoloCard | null;
  bench: Array<SoloCard | null>;
};
type SoloEnergyState = {
  active: SoloCard[];
  bench: SoloCard[][];
};
type SoloBoardSelection = {
  location: "active" | "bench" | "stadium";
  benchIndex?: number;
};
type SoloBoardActionPrompt = {
  kind: "retreat";
  selectedBenchIndex: number | null;
  selectedEnergyIndexes: number[];
  noRetreatEnergy: boolean;
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
type SearchSelectionRequirement = {
  target: SearchTarget;
  count: number;
  pokemonStage?: "basic" | "evolution";
  pokemonTypes?: string[];
  basicEnergyTypes?: string[];
};
type EffectAction =
  | {
      type: "draw_cards";
      count: number;
      discardRemainingHand?: boolean;
      shuffleRemainingHandIntoDeck?: boolean;
      countWhenPrizeCount?: { prizeCount: number; count: number };
    }
  | {
      type: "search_deck";
      target: SearchTarget;
      count: number;
      destination: "hand" | "bench" | "stadium" | "attach_energy";
      splitDestination?: { hand?: number; attachEnergy?: number };
      distinctBasicEnergyTypes?: boolean;
      pokemonStage?: "basic" | "evolution";
      pokemonTypes?: string[];
      basicEnergyTypes?: string[];
      selectionRequirements?: SearchSelectionRequirement[];
      look?: { from: "top" | "bottom"; count: number; opponent?: boolean };
      remainingDestination?: "deck" | "discard";
    }
  | {
      type: "recover_from_trash";
      target: SearchTarget;
      count: number;
      destination: "hand" | "attach_energy";
      attachTarget?: { location: "bench"; cardNameIncludes?: string };
    }
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
  costs?: Array<{ type: "discard_from_hand"; count: number; target?: SearchTarget; cardName?: string }>;
  actions: EffectAction[];
};
type SoloAbility = { name?: string; text?: string };
type StaticCardDetail = {
  cardId: string;
  name?: string;
  cardKind?: string;
  subKind?: string;
  regulation?: string;
  setCode?: string;
  setName?: string;
  evolvesFrom?: string;
  familyId?: string;
  types?: string[];
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
  hp?: number | null;
  attacks?: Array<{ name?: string; damage?: number | string; cost?: string[]; text?: string }>;
  abilities?: Array<{ name?: string; text?: string }>;
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
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      nextAction: EffectAction;
      count: number;
      costTarget?: SearchTarget;
      costCardName?: string;
      abilityKeyToMark?: string;
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
    }
  | {
      kind: "attach_energy_target";
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "search_deck" }>;
      attachCards: SoloCard[];
      handCards: SoloCard[];
      restPile: SoloCard[];
      discardCards: SoloCard[];
      discardSourceIndexes?: number[];
      attachTarget?: { location: "bench"; cardNameIncludes?: string };
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
  boardSelection: SoloBoardSelection | null;
  boardActionPrompt: SoloBoardActionPrompt | null;
  notice: string;
  startingPlayer: SoloStartingPlayer;
  turn: number;
  started: boolean;
  supporterUsedTurn: number | null;
  energyAttachedTurn: number | null;
  manualDrawTurn: number | null;
  usedAbilityKeys: string[];
  openingRedrawCount: number;
  trashOpen: boolean;
  effectPrompt: SoloEffectPrompt | null;
  rareCandyMode: "idle" | "select_basic" | "select_evolution";
  rareCandyTarget: RareCandyTarget | null;
  rareCandyCandidates: RareCandyCandidate[];
};
type BattlePlayerId = "player" | "opponent";
type BattleSetupPhase = "idle" | "player_active" | "player_bench" | "ready";
type BattleResult = {
  outcome: "win" | "loss";
  reason: string;
  message: string;
};
type BattlePlayerState = {
  id: BattlePlayerId;
  label: string;
  pile: SoloCard[];
  hand: SoloCard[];
  discard: SoloCard[];
  prizes: SoloCard[];
  activeStack: SoloStack;
  benchStacks: SoloStack[];
  attachedTools: SoloToolState;
  attachedEnergies: SoloEnergyState;
  damage: {
    active: number;
    bench: number[];
  };
  selectedHandIndex: number | null;
  revealHand: boolean;
  manualDrawTurn: number | null;
  energyAttachedTurn: number | null;
  supporterUsedTurn: number | null;
  usedAbilityKeys: string[];
};
type BattleAttackPrompt = {
  playerId: BattlePlayerId;
  selectedAttackIndex: number | null;
  selectedCopiedAttackKey: string | null;
};
type BattlePrizePrompt = {
  playerId: BattlePlayerId;
  maxCount: number;
  selectedPrizeIndexes: number[];
  knockedOutSummaries: Array<{ cardName: string; prizeCount: number }>;
  pendingPromotionPlayerId: BattlePlayerId | null;
};
type BattleBoardSelection = {
  playerId: BattlePlayerId;
  location: "active" | "bench";
  benchIndex?: number;
};
type BattleAiSuggestion =
  | { id: string; label: string; detail: string; action: "draw" }
  | { id: string; label: string; detail: string; action: "place_active"; handIndex: number }
  | { id: string; label: string; detail: string; action: "place_bench"; handIndex: number; benchIndex: number }
  | { id: string; label: string; detail: string; action: "evolve_active"; handIndex: number }
  | { id: string; label: string; detail: string; action: "evolve_bench"; handIndex: number; benchIndex: number }
  | { id: string; label: string; detail: string; action: "attach_energy"; handIndex: number; target: "active" | "bench"; benchIndex?: number }
  | { id: string; label: string; detail: string; action: "use_trainer"; handIndex: number }
  | { id: string; label: string; detail: string; action: "attack"; attackIndex: number; copiedAttackKey: string | null }
  | { id: string; label: string; detail: string; action: "end_turn" };
type BattleEffectPrompt =
  | {
      kind: "discard_from_hand";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      nextAction: EffectAction;
      count: number;
      costTarget?: SearchTarget;
      costCardName?: string;
      abilityKeyToMark?: string;
      selectedHandIndexes: number[];
    }
  | {
      kind: "search_deck";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "search_deck" }>;
      selectedPileIndexes: number[];
      visiblePileIndexes?: number[];
    }
  | {
      kind: "recover_from_trash";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "recover_from_trash" }>;
      selectedDiscardIndexes: number[];
    }
  | {
      kind: "attach_energy_target";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "search_deck" | "recover_from_trash" }>;
      attachCards: SoloCard[];
      handCards: SoloCard[];
      restPile?: SoloCard[];
      discardCards?: SoloCard[];
      restDiscard?: SoloCard[];
      attachTarget?: { location: "bench"; cardNameIncludes?: string };
    }
  | {
      kind: "switch_active";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      selectedBenchIndex: number | null;
    }
  | {
      kind: "promote_active";
      playerId: BattlePlayerId;
      selectedBenchIndex: number | null;
    }
  | {
      kind: "select_board_pokemon";
      playerId: BattlePlayerId;
      sourceHandIndex: number | null;
      sourceCard: SoloCard;
      action: Extract<EffectAction, { type: "heal_pokemon" | "discard_tool" }>;
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
  const masterProfile = augmentEffectProfileFromRuleText(card, card?.effectProfile || null);
  const masterAction = masterProfile?.actions[0];

  if (!masterProfile) return fallbackProfile;
  if (fallbackProfile && shouldPreferFallbackEffectProfile(card)) return fallbackProfile;
  if (fallbackProfile && masterAction?.type === "resolve_effect") return fallbackProfile;
  return masterProfile;
}

function getHandDiscardCostFromText(text?: string): EffectProfile["costs"] {
  const source = text || "";
  const count =
    parseJapaneseCardCount(source.match(/手札を([0-9一二三四五六七八九十]+)枚トラッシュ/)?.[1]) ||
    parseJapaneseCardCount(source.match(/手札から(?:「基本\s*エネルギー」|エネルギー)を([0-9一二三四五六七八九十]+)枚トラッシュ/)?.[1]) ||
    parseJapaneseCardCount(source.match(/手札から「([^」]+)」を([0-9一二三四五六七八九十]+)枚トラッシュ/)?.[2]);
  if (!count) return undefined;

  const basicEnergyCost = /手札から「基本\s*エネルギー」を[0-9一二三四五六七八九十]+枚トラッシュ/.test(source);
  const energyCost = /手札からエネルギーを[0-9一二三四五六七八九十]+枚トラッシュ/.test(source);
  const quotedCostName = source.match(/手札から「([^」]+)」を[0-9一二三四五六七八九十]+枚トラッシュ/)?.[1];

  return [{
    type: "discard_from_hand",
    count,
    target: basicEnergyCost ? "basic_energy" : energyCost ? "energy" : undefined,
    cardName: quotedCostName && !quotedCostName.includes("基本") ? quotedCostName : undefined,
  }];
}

function augmentEffectProfileFromRuleText(card?: SoloCard | null, profile?: EffectProfile | null): EffectProfile | null {
  if (!profile) return null;
  const textCost = getHandDiscardCostFromText(card?.ruleText);
  if (!textCost?.length) return profile;
  const currentCost = profile.costs?.[0];
  if (currentCost?.type === "discard_from_hand") {
    return {
      ...profile,
      costs: [{
        ...currentCost,
        target: currentCost.target || textCost[0].target,
        cardName: currentCost.cardName || textCost[0].cardName,
      }],
    };
  }
  return { ...profile, costs: textCost };
}

function shouldPreferFallbackEffectProfile(card?: SoloCard | null) {
  const name = normalizePokemonNameCore(card?.cardName);
  return name === "アカマツ" || name === "リーリエの決心" || name === "トウコ" || name === "ファイトゴング" || name === "むしとりセット" || name === "Nのポイントアップ";
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
  if (name === "リーリエの決心") {
    return {
      label: "手札をすべて山札にもどして切る。その後、山札を6枚引く。サイドが6枚なら8枚引く。",
      actions: [
        {
          type: "draw_cards",
          count: 6,
          shuffleRemainingHandIntoDeck: true,
          countWhenPrizeCount: { prizeCount: 6, count: 8 },
        },
      ],
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
  if (name === "トウコ") {
    return {
      label: "山札からエネルギーを1枚と進化ポケモンを1枚手札に加える",
      actions: [
        {
          type: "search_deck",
          target: "any_card",
          count: 2,
          destination: "hand",
          selectionRequirements: [
            { target: "energy", count: 1 },
            { target: "evolution_pokemon", count: 1 },
          ],
        },
      ],
    };
  }
  if (name === "ファイトゴング") {
    return {
      label: "山札から闘タイプのたねポケモンまたは基本闘エネルギーを1枚手札に加える",
      actions: [
        {
          type: "search_deck",
          target: "pokemon_or_basic_energy",
          count: 1,
          destination: "hand",
          pokemonStage: "basic",
          pokemonTypes: ["闘"],
          basicEnergyTypes: ["闘"],
        },
      ],
    };
  }
  if (name === "むしとりセット") {
    return {
      label: "山札を上から7枚見て、草ポケモンと基本草エネルギーを合計2枚まで手札に加える",
      actions: [
        {
          type: "search_deck",
          target: "pokemon_or_basic_energy",
          count: 2,
          destination: "hand",
          pokemonTypes: ["草"],
          basicEnergyTypes: ["草"],
          look: { from: "top", count: 7 },
          remainingDestination: "deck",
        },
      ],
    };
  }
  if (name === "Nのポイントアップ") {
    return {
      label: "自分のトラッシュから基本エネルギーを1枚選び、ベンチのNのポケモンにつける",
      actions: [
        {
          type: "recover_from_trash",
          target: "basic_energy",
          count: 1,
          destination: "attach_energy",
          attachTarget: { location: "bench", cardNameIncludes: "Nの" },
        },
      ],
    };
  }
  if (name === "アカマツ") {
    return {
      label: "山札から違うタイプの基本エネルギーを2枚まで選び、1枚を手札に加え、残りを自分のポケモンにつける",
      actions: [
        {
          type: "search_deck",
          target: "basic_energy",
          count: 2,
          destination: "hand",
          splitDestination: { hand: 1, attachEnergy: 1 },
          distinctBasicEnergyTypes: true,
        },
      ],
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

function parseJapaneseCardCount(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return map[normalized] ?? null;
}

function getAbilityEffectProfile(card: SoloCard | null, ability?: SoloAbility | null): EffectProfile | null {
  const text = ability?.text || "";
  if (!card || !text) return null;
  const costs: EffectProfile["costs"] = [];
  const handDiscardCount =
    parseJapaneseCardCount(text.match(/手札を([0-9一二三四五六七八九十]+)枚トラッシュするなら/)?.[1]) ||
    parseJapaneseCardCount(text.match(/手札から「基本\s*エネルギー」を([0-9一二三四五六七八九十]+)枚トラッシュするなら/)?.[1]) ||
    parseJapaneseCardCount(text.match(/手札から「([^」]+)」を([0-9一二三四五六七八九十]+)枚トラッシュするなら/)?.[2]);
  const quotedCostName = text.match(/手札から「([^」]+)」を[0-9一二三四五六七八九十]+枚トラッシュするなら/)?.[1];
  if (handDiscardCount) {
    costs.push({
      type: "discard_from_hand",
      count: handDiscardCount,
      target: text.match(/手札から「基本\s*エネルギー」を[0-9一二三四五六七八九十]+枚トラッシュするなら/)
        ? "basic_energy"
        : undefined,
      cardName: quotedCostName && !quotedCostName.includes("基本") ? quotedCostName : undefined,
    });
  }

  const drawCount = parseJapaneseCardCount(text.match(/山札(?:を|から)?([0-9一二三四五六七八九十]+)枚引/)?.[1]);
  if (drawCount) {
    return {
      label: `${ability?.name || "特性"}: 山札を${drawCount}枚引く`,
      costs: costs.length ? costs : undefined,
      actions: [{ type: "draw_cards", count: drawCount }],
    };
  }

  const searchCount = parseJapaneseCardCount(text.match(/山札から[^。]*?([0-9一二三四五六七八九十]+)枚/)?.[1]) || 1;
  if (text.includes("山札から") && text.includes("スタジアム") && text.includes("手札に加える")) {
    return {
      label: `${ability?.name || "特性"}: 山札からスタジアムを手札に加える`,
      costs: costs.length ? costs : undefined,
      actions: [{ type: "search_deck", target: "stadium", count: searchCount, destination: "hand" }],
    };
  }
  if (text.includes("山札から") && text.includes("基本") && text.includes("エネルギー") && text.includes("つける")) {
    return {
      label: `${ability?.name || "特性"}: 山札から基本エネルギーをつける`,
      costs: costs.length ? costs : undefined,
      actions: [{ type: "search_deck", target: "basic_energy", count: searchCount, destination: "attach_energy" }],
    };
  }
  if (text.includes("山札から") && text.includes("ポケモン") && text.includes("手札に加える")) {
    return {
      label: `${ability?.name || "特性"}: 山札からポケモンを手札に加える`,
      costs: costs.length ? costs : undefined,
      actions: [{ type: "search_deck", target: "pokemon", count: searchCount, destination: "hand" }],
    };
  }
  if (text.includes("バトルポケモンと入れ替える")) {
    return {
      label: `${ability?.name || "特性"}: バトルポケモンと入れ替える`,
      costs: costs.length ? costs : undefined,
      actions: [{ type: "switch_active" }],
    };
  }
  return {
    label: `${ability?.name || "特性"}: ${text}`,
    costs: costs.length ? costs : undefined,
    actions: [{ type: "resolve_effect", note: text }],
  };
}

function getPokemonTypes(card?: SoloCard | null) {
  return Array.isArray(card?.types) ? card.types.filter(Boolean) : [];
}

function matchesAnyType(cardTypes: string[], requiredTypes?: string[]) {
  if (!requiredTypes || requiredTypes.length === 0) return true;
  return requiredTypes.some((type) => cardTypes.includes(type));
}

function matchesSearchFilter(
  card: SoloCard,
  filter: {
    target: SearchTarget;
    destination?: "hand" | "bench" | "stadium" | "attach_energy";
    pokemonStage?: "basic" | "evolution";
    pokemonTypes?: string[];
    basicEnergyTypes?: string[];
  }
): boolean {
  const placementType = getCardPlacementType(card);
  const stageOrder = getStageOrder(card);
  const name = String(card.cardName || "");

  if (filter.destination === "attach_energy") {
    if (placementType !== "energy" || !name.includes("基本")) return false;
  }

  if (filter.target === "pokemon_or_basic_energy") {
    if (placementType === "pokemon") {
      if (filter.destination === "attach_energy") return false;
      if (filter.pokemonStage === "basic" && stageOrder !== 0) return false;
      if (filter.pokemonStage === "evolution" && (stageOrder === null || stageOrder <= 0)) return false;
      return matchesAnyType(getPokemonTypes(card), filter.pokemonTypes);
    }
    if (placementType === "energy" && name.includes("基本")) {
      const energyType = getBasicEnergyType(card);
      return !filter.basicEnergyTypes?.length || filter.basicEnergyTypes.includes(energyType);
    }
    return false;
  }

  if (!matchesSearchTarget(card, filter.target)) return false;

  if (placementType === "pokemon") {
    if (filter.pokemonStage === "basic" && stageOrder !== 0) return false;
    if (filter.pokemonStage === "evolution" && (stageOrder === null || stageOrder <= 0)) return false;
    return matchesAnyType(getPokemonTypes(card), filter.pokemonTypes);
  }

  if (placementType === "energy" && name.includes("基本") && filter.basicEnergyTypes?.length) {
    return filter.basicEnergyTypes.includes(getBasicEnergyType(card));
  }

  return true;
}

function matchesSearchActionTarget(card: SoloCard, action: Extract<EffectAction, { type: "search_deck" }>): boolean {
  if (action.selectionRequirements?.length) {
    return action.selectionRequirements.some((requirement) => matchesSearchFilter(card, requirement));
  }
  return matchesSearchFilter(card, action);
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

function getSearchRequirementLabel(requirement: SearchSelectionRequirement) {
  return `${getSearchTargetLabel(requirement.target)}${requirement.count}枚`;
}

function getSearchRequirementSummary(action: Extract<EffectAction, { type: "search_deck" }>) {
  if (!action.selectionRequirements?.length) return "";
  return action.selectionRequirements.map(getSearchRequirementLabel).join("と");
}

function getSearchActionLabel(action: Extract<EffectAction, { type: "search_deck" }>) {
  const requirementSummary = getSearchRequirementSummary(action);
  if (requirementSummary) return requirementSummary;
  if (action.destination === "attach_energy") {
    return action.basicEnergyTypes?.length
      ? `基本${action.basicEnergyTypes.join("・")}エネルギー`
      : "基本エネルギー";
  }
  if (action.target === "pokemon_or_basic_energy") {
    const pokemonParts = [
      action.pokemonTypes?.length ? `${action.pokemonTypes.join("・")}タイプ` : "",
      action.pokemonStage === "basic" ? "たね" : action.pokemonStage === "evolution" ? "進化" : "",
      "ポケモン",
    ].filter(Boolean);
    const energyLabel = action.basicEnergyTypes?.length
      ? `基本${action.basicEnergyTypes.join("・")}エネルギー`
      : "基本エネルギー";
    return `${pokemonParts.join("")}または${energyLabel}`;
  }
  if (action.target === "basic_energy" && action.basicEnergyTypes?.length) {
    return `基本${action.basicEnergyTypes.join("・")}エネルギー`;
  }
  return getSearchTargetLabel(action.target);
}

function getSearchActionInstruction(action: Extract<EffectAction, { type: "search_deck" }>) {
  const requirementSummary = getSearchRequirementSummary(action);
  if (requirementSummary) return `${requirementSummary}を選んでください。`;
  return `${getSearchActionLabel(action)}を${action.count}枚まで選んでください。`;
}

function getRequirementSelectedCount(
  selectedCards: SoloCard[],
  requirement: SearchSelectionRequirement
) {
  return selectedCards.filter((card) => matchesSearchFilter(card, requirement)).length;
}

function validateSearchSelectionRequirements(
  selectedCards: SoloCard[],
  action: Extract<EffectAction, { type: "search_deck" }>
) {
  const requirements = action.selectionRequirements || [];
  for (const requirement of requirements) {
    const selectedCount = getRequirementSelectedCount(selectedCards, requirement);
    if (selectedCount !== requirement.count) {
      return `${getSearchRequirementLabel(requirement)}を選んでください。`;
    }
  }
  return "";
}

function canAddSearchSelection(
  selectedCards: SoloCard[],
  nextCard: SoloCard,
  action: Extract<EffectAction, { type: "search_deck" }>
) {
  const requirements = action.selectionRequirements || [];
  if (requirements.length === 0) return true;
  return requirements.some((requirement) => {
    if (!matchesSearchFilter(nextCard, requirement)) return false;
    return getRequirementSelectedCount(selectedCards, requirement) < requirement.count;
  });
}

function getBasicEnergyType(card?: SoloCard | null) {
  const name = String(card?.cardName || card?.name || "");
  const match = name.match(/^基本(.+)エネルギー$/);
  return match?.[1] || "";
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

const knownPreEvolutionByName: Record<string, string> = {
  シャワーズ: "イーブイ",
  サンダース: "イーブイ",
  ブースター: "イーブイ",
  エーフィ: "イーブイ",
  ブラッキー: "イーブイ",
  リーフィア: "イーブイ",
  グレイシア: "イーブイ",
  ニンフィア: "イーブイ",
  "Nのゾロアーク": "Nのゾロア",
  "Nのゾロアークex": "Nのゾロア",
  "Nのギギアル": "Nのギアル",
  "Nのギギギアル": "Nのギギアル",
  "Nのバニリッチ": "Nのバニプッチ",
  "Nのバイバニラ": "Nのバニリッチ",
};

function uniqueNormalizedNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizePokemonNameCore(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAllowedPreEvolutionNames(detail: StaticCardDetail | undefined, cardDetails: Record<string, StaticCardDetail>) {
  if (!detail || getCardTypeLabel(detail) !== "pokemon") return [];
  const evolutionOrder = getStageOrder(detail);
  if (evolutionOrder === null || evolutionOrder <= 0) return [];

  const names: string[] = [];
  if (detail.evolvesFrom) names.push(detail.evolvesFrom);

  const normalizedName = normalizePokemonNameCore(detail.name);
  const normalizedFamily = normalizePokemonNameCore(detail.familyId || detail.name);
  Object.entries(knownPreEvolutionByName).forEach(([evolutionName, preEvolutionName]) => {
    if (normalizePokemonNameCore(evolutionName) === normalizedName || normalizePokemonNameCore(evolutionName) === normalizedFamily) {
      names.push(preEvolutionName);
    }
  });

  const desiredStageOrder = evolutionOrder - 1;
  const targetId = Number(detail.cardId);
  const inferred = Object.values(cardDetails)
    .filter((candidate) => {
      const candidateId = Number(candidate.cardId);
      if (!Number.isFinite(targetId) || !Number.isFinite(candidateId) || candidateId >= targetId) return false;
      if (detail.setName && candidate.setName !== detail.setName) return false;
      if (getCardTypeLabel(candidate) !== "pokemon") return false;
      if (getStageOrder(candidate) !== desiredStageOrder) return false;
      return targetId - candidateId <= 180;
    })
    .sort((a, b) => {
      const distanceA = Math.abs(Number(detail.cardId) - Number(a.cardId));
      const distanceB = Math.abs(Number(detail.cardId) - Number(b.cardId));
      const nameA = normalizePokemonNameCore(a.name);
      const nameB = normalizePokemonNameCore(b.name);
      const target = normalizePokemonNameCore(detail.name);
      const family = normalizePokemonNameCore(detail.familyId);
      const scoreA = (target.startsWith(nameA) || family.startsWith(nameA) ? -1000 : 0) + distanceA;
      const scoreB = (target.startsWith(nameB) || family.startsWith(nameB) ? -1000 : 0) + distanceB;
      return scoreA - scoreB;
    })[0];
  if (inferred?.name) names.push(inferred.name);

  return uniqueNormalizedNames(names);
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
    Array.from({ length: card.count }, (_, copyIndex) => {
      const detail = getCardDetailForDeckCard(card, cardDetails, detailNameIndex);
      return {
      soloInstanceId: `${card.cardId}-${copyIndex}-${Math.random().toString(36).slice(2, 10)}`,
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
      evolvesFrom: detail?.evolvesFrom,
      familyId: detail?.familyId,
      allowedPreEvolutionNames: getAllowedPreEvolutionNames(detail, cardDetails),
      types: detail?.types || [],
      stage: detail?.stage || "",
      stageCategory: detail?.stageCategory || "unknown",
      stageOrder: detail?.stageOrder,
      hp: detail?.hp,
      attacks: detail?.attacks || [],
      abilities: detail?.abilities || [],
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

function hasBasicPokemon(cards: SoloCard[]) {
  return cards.some((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0);
}

function createEmptyBattleDamage() {
  return {
    active: 0,
    bench: Array.from({ length: 5 }, () => 0),
  };
}

function createEmptyBattlePlayer(id: BattlePlayerId, label: string): BattlePlayerState {
  return {
    id,
    label,
    pile: [],
    hand: [],
    discard: [],
    prizes: [],
    activeStack: [],
    benchStacks: Array.from({ length: 5 }, () => []),
    attachedTools: createEmptySoloTools(),
    attachedEnergies: createEmptySoloEnergies(),
    damage: createEmptyBattleDamage(),
    selectedHandIndex: null,
    revealHand: id === "player",
    manualDrawTurn: null,
    energyAttachedTurn: null,
    supporterUsedTurn: null,
    usedAbilityKeys: [],
  };
}

function applyBattleActiveKnockout(state: BattlePlayerState, activeDamage: number) {
  const activeCard = state.activeStack[state.activeStack.length - 1];
  const activeHp = Number(activeCard?.hp || 0);
  if (!activeCard || activeHp <= 0 || activeDamage < activeHp) {
    return {
      nextState: {
        ...state,
        damage: { ...state.damage, active: activeDamage },
      },
      knockedOutCards: [] as SoloCard[],
    };
  }

  const attachedCards = [
    ...(state.attachedTools.active ? [state.attachedTools.active] : []),
    ...state.attachedEnergies.active,
  ];
  const knockedOutCards = [...state.activeStack, ...attachedCards];

  return {
    nextState: {
      ...state,
      activeStack: [],
      attachedTools: { ...state.attachedTools, active: null },
      attachedEnergies: { ...state.attachedEnergies, active: [] },
      discard: [...state.discard, ...knockedOutCards],
      damage: { ...state.damage, active: 0 },
    },
    knockedOutCards,
  };
}

function applyBattleBenchKnockouts(state: BattlePlayerState, benchIndexes: number[]) {
  if (benchIndexes.length === 0) {
    return { nextState: state, knockedOutCards: [] as SoloCard[] };
  }
  const knockoutSet = new Set(benchIndexes);
  const knockedOutCards = state.benchStacks.flatMap((stack, index) => {
    if (!knockoutSet.has(index) || stack.length === 0) return [];
    return [
      ...stack,
      ...(state.attachedTools.bench[index] ? [state.attachedTools.bench[index] as SoloCard] : []),
      ...(state.attachedEnergies.bench[index] || []),
    ];
  });

  return {
    nextState: {
      ...state,
      benchStacks: state.benchStacks.map((stack, index) => (knockoutSet.has(index) ? [] : stack)),
      attachedTools: {
        ...state.attachedTools,
        bench: state.attachedTools.bench.map((tool, index) => (knockoutSet.has(index) ? null : tool)),
      },
      attachedEnergies: {
        ...state.attachedEnergies,
        bench: state.attachedEnergies.bench.map((energies, index) => (knockoutSet.has(index) ? [] : energies)),
      },
      discard: [...state.discard, ...knockedOutCards],
      damage: {
        ...state.damage,
        bench: state.damage.bench.map((damage, index) => (knockoutSet.has(index) ? 0 : damage)),
      },
    },
    knockedOutCards,
  };
}

function getBattlePrizeCountForKnockedOutPokemon(card?: SoloCard | null) {
  if (!card) return 0;
  const text = [card.cardName, card.name, card.ruleText, card.subKind, card.stage, ...(card.searchTokens || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isEx = text.includes("ex");
  if (isEx && (text.includes("メガ") || text.includes("mega") || text.includes("m進化"))) return 3;
  if (isEx) return 2;
  return 1;
}

function getBattlePrizeSummariesForKnockouts(cards: SoloCard[]) {
  return cards.map((card) => ({
    cardName: card.cardName || card.name || "ポケモン",
    prizeCount: getBattlePrizeCountForKnockedOutPokemon(card),
  }));
}

function promoteBattleBenchToActive(state: BattlePlayerState, benchIndex: number) {
  const benchStack = state.benchStacks[benchIndex] || [];
  if (state.activeStack.length > 0 || benchStack.length === 0) return state;

  return {
    ...state,
    activeStack: benchStack,
    benchStacks: state.benchStacks.map((stack, index) => (index === benchIndex ? [] : stack)),
    attachedTools: {
      active: state.attachedTools.bench[benchIndex] || null,
      bench: state.attachedTools.bench.map((tool, index) => (index === benchIndex ? null : tool)),
    },
    attachedEnergies: {
      active: state.attachedEnergies.bench[benchIndex] || [],
      bench: state.attachedEnergies.bench.map((energies, index) => (index === benchIndex ? [] : energies)),
    },
    damage: {
      active: state.damage.bench[benchIndex] || 0,
      bench: state.damage.bench.map((damage, index) => (index === benchIndex ? 0 : damage)),
    },
  };
}

function setupBattleAiPlayerWithOpeningRedraw(
  id: BattlePlayerId,
  label: string,
  deck: Deck,
  cardDetails: Record<string, StaticCardDetail>
) {
  let pile = expandDeck(deck.cards, cardDetails);
  let handDraw = takeRandomCards(pile, 7);
  let redrawCount = 0;
  const basicPokemonCount = pile.concat(handDraw.drawn).filter((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0).length;
  const maxRedrawCount = Math.max(0, pile.length + handDraw.drawn.length);

  while (!hasBasicPokemon(handDraw.drawn) && basicPokemonCount > 0 && redrawCount < maxRedrawCount) {
    redrawCount += 1;
    pile = [...handDraw.rest, ...handDraw.drawn];
    handDraw = takeRandomCards(pile, 7);
  }

  const prizeDraw = takeRandomCards(handDraw.rest, 6);
  return {
    player: {
      ...createEmptyBattlePlayer(id, label),
      hand: handDraw.drawn,
      pile: prizeDraw.rest,
      prizes: prizeDraw.drawn,
    },
    redrawCount,
  };
}

function getBasicPokemonHandIndexes(cards: SoloCard[]) {
  return cards
    .map((card, handIndex) => ({ card, handIndex }))
    .filter(({ card }) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0)
    .map(({ handIndex }) => handIndex);
}

function setupBattleOpponentOpeningBoard(state: BattlePlayerState): BattlePlayerState {
  const basicIndexes = getBasicPokemonHandIndexes(state.hand);
  const activeHandIndex = basicIndexes[0];
  if (activeHandIndex === undefined) return state;

  const activeCard = state.hand[activeHandIndex];
  const remainingHand = state.hand.filter((_, index) => index !== activeHandIndex);
  const nextBenchStacks = state.benchStacks.map((stack) => [...stack]);
  const benchBasics = remainingHand.filter((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0).slice(0, 5);
  const benchInstanceIds = new Set(benchBasics.map((card) => card.soloInstanceId || card.cardId));

  benchBasics.forEach((card, index) => {
    nextBenchStacks[index] = [{ ...card, playedTurn: 0 }];
  });

  return {
    ...state,
    hand: remainingHand.filter((card) => !benchInstanceIds.has(card.soloInstanceId || card.cardId)),
    activeStack: [{ ...activeCard, playedTurn: 0 }],
    benchStacks: nextBenchStacks,
    damage: createEmptyBattleDamage(),
    selectedHandIndex: null,
  };
}

function canEvolveBattleStack(stack: SoloStack, evolutionCard: SoloCard, currentTurn: number) {
  const targetTop = stack[stack.length - 1];
  if (!targetTop) return false;
  const evolutionOrder = getStageOrder(evolutionCard);
  const targetOrder = getStageOrder(targetTop);
  if (evolutionOrder === null || targetOrder === null) return false;
  if (wasPokemonPutInPlayThisTurn(targetTop, currentTurn)) return false;
  if (evolutionOrder !== targetOrder + 1) return false;

  const allowedNames = uniqueNormalizedNames([
    ...(evolutionCard.allowedPreEvolutionNames || []),
    ...(evolutionCard.evolvesFrom ? [evolutionCard.evolvesFrom] : []),
  ]).map((name) => normalizePokemonNameCore(name));
  if (allowedNames.length === 0) return false;

  const targetName = normalizePokemonNameCore(targetTop.cardName || targetTop.name);
  return allowedNames.includes(targetName);
}

function getAttackDamageValue(attack?: { damage?: number | string }) {
  if (!attack || attack.damage === undefined || attack.damage === null) return 0;
  if (typeof attack.damage === "number") return Math.max(0, attack.damage);
  const match = String(attack.damage).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

type BattleAttackCopyCandidate = {
  key: string;
  card: SoloCard;
  attack: BattleAttack;
  location: "bench" | "opponent_active";
  benchIndex?: number;
  attackIndex: number;
};

type ResolvedBattleAttack = {
  sourceAttack: BattleAttack;
  effectiveAttack: BattleAttack;
  copiedFromCard?: SoloCard;
  copiedFromAttack?: BattleAttack;
};

function isAttackCopyEffect(attack?: BattleAttack | null) {
  const text = String(attack?.text || "");
  return text.includes("持つワザを1つ選び") && text.includes("このワザとして使う");
}

function isNoNamedPokemon(card?: SoloCard | null) {
  return String(card?.cardName || card?.name || "").includes("Nの");
}

function isCopyableAttack(attack?: BattleAttack | null) {
  return Boolean(attack?.name) && !isAttackCopyEffect(attack);
}

function getBattleAttackCopyCandidates(attack: BattleAttack, attacker: BattlePlayerState, defender: BattlePlayerState): BattleAttackCopyCandidate[] {
  const text = String(attack.text || "");
  if (!isAttackCopyEffect(attack)) return [];

  if (text.includes("自分のベンチ") && text.includes("Nのポケモン")) {
    return attacker.benchStacks.flatMap((stack, benchIndex) => {
      const card = stack[stack.length - 1];
      if (!card || !isNoNamedPokemon(card)) return [];
      return (card.attacks || [])
        .map((candidateAttack, attackIndex) => ({ candidateAttack, attackIndex }))
        .filter(({ candidateAttack }) => isCopyableAttack(candidateAttack))
        .map(({ candidateAttack, attackIndex }) => ({
          key: `bench:${benchIndex}:${attackIndex}`,
          card,
          attack: candidateAttack,
          location: "bench" as const,
          benchIndex,
          attackIndex,
        }));
    });
  }

  if (text.includes("相手のバトルポケモン")) {
    const card = defender.activeStack[defender.activeStack.length - 1];
    if (!card) return [];
    return (card.attacks || [])
      .map((candidateAttack, attackIndex) => ({ candidateAttack, attackIndex }))
      .filter(({ candidateAttack }) => isCopyableAttack(candidateAttack))
      .map(({ candidateAttack, attackIndex }) => ({
        key: `opponent-active:${attackIndex}`,
        card,
        attack: candidateAttack,
        location: "opponent_active" as const,
        attackIndex,
      }));
  }

  return [];
}

function resolveBattleAttack(
  sourceAttack: BattleAttack,
  attacker: BattlePlayerState,
  defender: BattlePlayerState,
  selectedCopiedAttackKey?: string | null
): ResolvedBattleAttack | null {
  const copyCandidates = getBattleAttackCopyCandidates(sourceAttack, attacker, defender);
  if (copyCandidates.length === 0) return { sourceAttack, effectiveAttack: sourceAttack };
  const selectedCopy = copyCandidates.find((candidate) => candidate.key === selectedCopiedAttackKey);
  if (!selectedCopy) return null;
  return {
    sourceAttack,
    effectiveAttack: selectedCopy.attack,
    copiedFromCard: selectedCopy.card,
    copiedFromAttack: selectedCopy.attack,
  };
}

function countBattleBenchPokemon(state: BattlePlayerState) {
  return state.benchStacks.filter((stack) => stack.length > 0).length;
}

function countBattleRuleBoxPokemon(state: BattlePlayerState) {
  const boardCards = [
    state.activeStack[state.activeStack.length - 1],
    ...state.benchStacks.map((stack) => stack[stack.length - 1]),
  ].filter(Boolean) as SoloCard[];
  return boardCards.filter((card) => {
    const name = String(card.cardName || card.name || "");
    const rule = String(card.ruleText || "");
    return name.includes("ex") || name.includes("V") || rule.includes("ルールを持つ");
  }).length;
}

function countBasicEnergyCards(cards: SoloCard[]) {
  return cards.filter((card) => getCardPlacementType(card) === "energy" && String(card.cardName || card.name || "").includes("基本")).length;
}

function getBattleAttackDamageValue(attack: BattleAttack, attacker: BattlePlayerState, defender: BattlePlayerState) {
  const baseDamage = getAttackDamageValue(attack);
  const text = String(attack.text || "");
  const attackerDamageCounterMultiplier = Number(text.match(/このポケモンにのっているダメカンの数[×xX]([0-9]+)/)?.[1] || 0);
  if (attackerDamageCounterMultiplier > 0) return Math.floor(attacker.damage.active / 10) * attackerDamageCounterMultiplier;

  const opponentBasicEnergyTrashMultiplier = Number(text.match(/相手のトラッシュにある基本エネルギーの枚数[×xX]([0-9]+)/)?.[1] || 0);
  if (opponentBasicEnergyTrashMultiplier > 0) return countBasicEnergyCards(defender.discard) * opponentBasicEnergyTrashMultiplier;

  const opponentBenchMultiplier = Number(text.match(/相手のベンチポケモンの数[×xX]([0-9]+)/)?.[1] || 0);
  if (opponentBenchMultiplier > 0) return countBattleBenchPokemon(defender) * opponentBenchMultiplier;

  const ownBenchMultiplier = Number(text.match(/自分のベンチポケモンの数[×xX]([0-9]+)/)?.[1] || 0);
  if (ownBenchMultiplier > 0) return countBattleBenchPokemon(attacker) * ownBenchMultiplier;

  const opponentRuleBoxMultiplier = Number(text.match(/相手の場の「?ポケモンex・V」?の数[×xX]([0-9]+)/)?.[1] || 0);
  if (opponentRuleBoxMultiplier > 0) return countBattleRuleBoxPokemon(defender) * opponentRuleBoxMultiplier;

  const ownRuleBoxMultiplier = Number(text.match(/自分の場の「?ポケモンex・V」?の数[×xX]([0-9]+)/)?.[1] || 0);
  if (ownRuleBoxMultiplier > 0) return countBattleRuleBoxPokemon(attacker) * ownRuleBoxMultiplier;

  const plusDamage = Number(text.match(/[+＋]([0-9]+)ダメージ/)?.[1] || 0);
  if (baseDamage > 0 && plusDamage > 0 && !text.includes("なら") && !text.includes("コイン")) return baseDamage + plusDamage;

  return baseDamage;
}

function getBattleAttackBenchDamage(attack: BattleAttack) {
  const text = String(attack.text || "");
  return Number(text.match(/相手のベンチポケモン全員にも、それぞれ([0-9]+)ダメージ/)?.[1] || 0);
}

function shouldDiscardAllActiveEnergiesAfterAttack(attack: BattleAttack) {
  return String(attack.text || "").includes("このポケモンについているエネルギーをすべてトラッシュ");
}

function getManualBattleAttackEffectNote(attack: BattleAttack) {
  const text = String(attack.text || "");
  if (!text) return "";
  const automaticallyHandledPatterns = [
    /このポケモンにのっているダメカンの数[×xX][0-9]+/,
    /相手のトラッシュにある基本エネルギーの枚数[×xX][0-9]+/,
    /相手のベンチポケモンの数[×xX][0-9]+/,
    /自分のベンチポケモンの数[×xX][0-9]+/,
    /相手の場の「?ポケモンex・V」?の数[×xX][0-9]+/,
    /自分の場の「?ポケモンex・V」?の数[×xX][0-9]+/,
    /相手のベンチポケモン全員にも、それぞれ[0-9]+ダメージ/,
    /このポケモンについているエネルギーをすべてトラッシュ/,
  ];
  const remaining = automaticallyHandledPatterns.reduce((current, pattern) => current.replace(pattern, ""), text).trim();
  return remaining ? ` 未自動処理の効果: ${remaining}` : "";
}

function getAttackCostCount(attack?: { cost?: string[] }) {
  return Array.isArray(attack?.cost) ? attack.cost.filter(Boolean).length : 0;
}

const pokemonEnergyCostTypes = ["草", "炎", "水", "雷", "超", "闘", "悪", "鋼"] as const;
type PokemonEnergyCostType = (typeof pokemonEnergyCostTypes)[number];

function normalizeAttackEnergyCost(cost?: string) {
  const normalized = String(cost || "").replace(/[ 　・\-－]/g, "");
  if (!normalized) return "colorless";
  if (normalized.includes("無") || normalized.includes("無色") || normalized.toLowerCase().includes("colorless")) return "colorless";
  return pokemonEnergyCostTypes.find((type) => normalized.includes(type)) || "colorless";
}

function getAttachedEnergyType(card?: SoloCard | null) {
  const basicType = getBasicEnergyType(card);
  if (pokemonEnergyCostTypes.includes(basicType as PokemonEnergyCostType)) return basicType as PokemonEnergyCostType;
  const name = String(card?.cardName || card?.name || "");
  if (!name.includes("エネルギー")) return null;
  return pokemonEnergyCostTypes.find((type) => name.includes(type)) || null;
}

function getAttackEnergyRequirement(attack?: { cost?: string[] }) {
  const specific = new Map<PokemonEnergyCostType, number>();
  let colorless = 0;
  for (const cost of attack?.cost || []) {
    const type = normalizeAttackEnergyCost(cost);
    if (type === "colorless") {
      colorless += 1;
    } else {
      specific.set(type, (specific.get(type) || 0) + 1);
    }
  }
  return { specific, colorless, total: getAttackCostCount(attack) };
}

function getAttachedEnergyTypeCounts(attachedEnergies: SoloCard[]) {
  const counts = new Map<PokemonEnergyCostType, number>();
  for (const energy of attachedEnergies) {
    const type = getAttachedEnergyType(energy);
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return counts;
}

function getBattleAttackEnergyStatus(attack: { cost?: string[] }, attachedEnergies: SoloCard[]) {
  const requirement = getAttackEnergyRequirement(attack);
  const attachedCounts = getAttachedEnergyTypeCounts(attachedEnergies);
  const missingSpecific: string[] = [];
  let requiredSpecificCount = 0;

  requirement.specific.forEach((required, type) => {
    requiredSpecificCount += required;
    const attached = attachedCounts.get(type) || 0;
    if (attached < required) missingSpecific.push(`${type}${attached}/${required}`);
  });

  const remainingForColorless = Math.max(0, attachedEnergies.length - requiredSpecificCount);
  const missingColorless = Math.max(0, requirement.colorless - remainingForColorless);

  return {
    requirement,
    attachedCounts,
    missingSpecific,
    missingColorless,
    usable: missingSpecific.length === 0 && missingColorless === 0 && attachedEnergies.length >= requirement.total,
  };
}

function formatAttackEnergyRequirement(attack?: { cost?: string[] }) {
  const requirement = getAttackEnergyRequirement(attack);
  const parts = [
    ...pokemonEnergyCostTypes
      .map((type) => {
        const count = requirement.specific.get(type) || 0;
        return count > 0 ? `${type}${count}` : "";
      })
      .filter(Boolean),
    requirement.colorless > 0 ? `無${requirement.colorless}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "なし";
}

function formatAttachedEnergySummary(attachedEnergies: SoloCard[]) {
  if (attachedEnergies.length === 0) return "なし";
  const counts = getAttachedEnergyTypeCounts(attachedEnergies);
  const typedParts = pokemonEnergyCostTypes
    .map((type) => {
      const count = counts.get(type) || 0;
      return count > 0 ? `${type}${count}` : "";
    })
    .filter(Boolean);
  const typedTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const otherCount = Math.max(0, attachedEnergies.length - typedTotal);
  return [...typedParts, otherCount > 0 ? `他${otherCount}` : ""].filter(Boolean).join(" ");
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
  const [selectedAiDeckId, setSelectedAiDeckId] = useState("");
  const [aiStyle, setAiStyle] = useState<AiStyle>("speed");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleTurn, setBattleTurn] = useState(1);
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleSetupPhase, setBattleSetupPhase] = useState<BattleSetupPhase>("idle");
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [aiGoingFirst, setAiGoingFirst] = useState(false);
  const [autoBattleAiEnabled, setAutoBattleAiEnabled] = useState(true);
  const [battleCurrentPlayer, setBattleCurrentPlayer] = useState<BattlePlayerId>("player");
  const [battlePlayer, setBattlePlayer] = useState<BattlePlayerState>(() => createEmptyBattlePlayer("player", "自分"));
  const [battleOpponent, setBattleOpponent] = useState<BattlePlayerState>(() => createEmptyBattlePlayer("opponent", "相手"));
  const [battleBoardSelection, setBattleBoardSelection] = useState<BattleBoardSelection | null>(null);
  const [battleStadiumCard, setBattleStadiumCard] = useState<SoloCard | null>(null);
  const [battleNotice, setBattleNotice] = useState("");
  const [battleAiSuggestions, setBattleAiSuggestions] = useState<BattleAiSuggestion[]>([]);
  const [battleEffectPrompt, setBattleEffectPrompt] = useState<BattleEffectPrompt | null>(null);
  const [battleAttackPrompt, setBattleAttackPrompt] = useState<BattleAttackPrompt | null>(null);
  const [battlePrizePrompt, setBattlePrizePrompt] = useState<BattlePrizePrompt | null>(null);
  const [battleTrashPlayerId, setBattleTrashPlayerId] = useState<BattlePlayerId | null>(null);
  const runSemiAutoAiTurnRef = useRef<() => void>(() => {});

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
  const [soloBoardSelection, setSoloBoardSelection] = useState<SoloBoardSelection | null>(null);
  const [soloBoardActionPrompt, setSoloBoardActionPrompt] = useState<SoloBoardActionPrompt | null>(null);
  const [soloNotice, setSoloNotice] = useState("");
  const [soloMenuOpen, setSoloMenuOpen] = useState(false);
  const [soloHelpOpen, setSoloHelpOpen] = useState(false);
  const [soloHintsVisible, setSoloHintsVisible] = useState(false);
  const [soloStartingPlayer, setSoloStartingPlayer] = useState<SoloStartingPlayer>("first");
  const [soloTurn, setSoloTurn] = useState(1);
  const [soloStarted, setSoloStarted] = useState(false);
  const [soloSupporterUsedTurn, setSoloSupporterUsedTurn] = useState<number | null>(null);
  const [soloEnergyAttachedTurn, setSoloEnergyAttachedTurn] = useState<number | null>(null);
  const [soloManualDrawTurn, setSoloManualDrawTurn] = useState<number | null>(null);
  const [soloUsedAbilityKeys, setSoloUsedAbilityKeys] = useState<string[]>([]);
  const [soloTrashOpen, setSoloTrashOpen] = useState(false);
  const [soloOpeningRedrawCount, setSoloOpeningRedrawCount] = useState(0);
  const [soloEffectPrompt, setSoloEffectPrompt] = useState<SoloEffectPrompt | null>(null);
  const [soloRareCandyMode, setSoloRareCandyMode] = useState<"idle" | "select_basic" | "select_evolution">("idle");
  const [soloRareCandyTarget, setSoloRareCandyTarget] = useState<RareCandyTarget | null>(null);
  const [soloRareCandyCandidates, setSoloRareCandyCandidates] = useState<RareCandyCandidate[]>([]);
  const [soloHistory, setSoloHistory] = useState<SoloSnapshot[]>([]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.deckId === selectedDeckId) || null,
    [decks, selectedDeckId]
  );
  const selectedAiDeck = useMemo(
    () => decks.find((deck) => deck.deckId === selectedAiDeckId) || null,
    [decks, selectedAiDeckId]
  );
  const selectedSoloCard = soloSelectedHandIndex !== null ? soloHand[soloSelectedHandIndex] || null : null;
  const selectedSoloBoardCard =
    soloBoardSelection?.location === "active"
      ? soloActiveStack[soloActiveStack.length - 1] || null
      : soloBoardSelection?.location === "bench"
        ? soloBenchStacks[soloBoardSelection.benchIndex || 0]?.[soloBenchStacks[soloBoardSelection.benchIndex || 0].length - 1] || null
        : soloBoardSelection?.location === "stadium"
          ? soloStadiumCard
        : null;
  const selectedSoloBoardLabel =
    soloBoardSelection?.location === "active"
      ? "バトル場"
      : soloBoardSelection?.location === "bench"
        ? `ベンチ${(soloBoardSelection.benchIndex || 0) + 1}`
        : soloBoardSelection?.location === "stadium"
          ? "スタジアム"
        : "";
  const selectedSoloBoardPlacement = selectedSoloBoardCard ? getCardPlacementType(selectedSoloBoardCard) : "unknown";
  const selectedEffectProfile = getEffectProfile(selectedSoloCard);
  const isSoloFirstTurnSupporterLocked = soloStarted && soloStartingPlayer === "first" && soloTurn === 1;
  const canShuffleOpeningHand = soloStarted && soloActiveStack.length === 0;
  const canShowPostSetupSoloActions = soloStarted && soloActiveStack.length > 0;
  const canManualDrawSolo = soloStarted && soloManualDrawTurn !== soloTurn;
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
    boardSelection: soloBoardSelection,
    boardActionPrompt: soloBoardActionPrompt
      ? {
          ...soloBoardActionPrompt,
          selectedEnergyIndexes: [...soloBoardActionPrompt.selectedEnergyIndexes],
        }
      : null,
    notice: soloNotice,
    startingPlayer: soloStartingPlayer,
    turn: soloTurn,
    started: soloStarted,
    supporterUsedTurn: soloSupporterUsedTurn,
    energyAttachedTurn: soloEnergyAttachedTurn,
    manualDrawTurn: soloManualDrawTurn,
    usedAbilityKeys: [...soloUsedAbilityKeys],
    openingRedrawCount: soloOpeningRedrawCount,
    trashOpen: soloTrashOpen,
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
    setSoloBoardSelection(snapshot.boardSelection);
    setSoloBoardActionPrompt(snapshot.boardActionPrompt);
    setSoloNotice("1手戻しました。");
    setSoloStartingPlayer(snapshot.startingPlayer);
    setSoloTurn(snapshot.turn);
    setSoloStarted(snapshot.started);
    setSoloSupporterUsedTurn(snapshot.supporterUsedTurn);
    setSoloEnergyAttachedTurn(snapshot.energyAttachedTurn);
    setSoloManualDrawTurn(snapshot.manualDrawTurn);
    setSoloUsedAbilityKeys(snapshot.usedAbilityKeys || []);
    setSoloOpeningRedrawCount(snapshot.openingRedrawCount);
    setSoloTrashOpen(snapshot.trashOpen);
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
    if (decks.length === 0) return;
    if (!selectedAiDeckId || !decks.some((deck) => deck.deckId === selectedAiDeckId)) {
      setSelectedAiDeckId(decks[0].deckId);
    }
  }, [decks, selectedAiDeckId]);

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
      setSoloBoardSelection(null);
      setSoloBoardActionPrompt(null);
      setSoloNotice("");
      setSoloStartingPlayer("first");
      setSoloTurn(1);
      setSoloStarted(false);
      setSoloSupporterUsedTurn(null);
      setSoloEnergyAttachedTurn(null);
      setBattleLog([]);
      setBattleTurn(1);
      setBattleStarted(false);
      setBattleSetupPhase("idle");
      setBattleResult(null);
      setAiGoingFirst(false);
      setBattleCurrentPlayer("player");
      setBattlePlayer(createEmptyBattlePlayer("player", "自分"));
      setBattleOpponent(createEmptyBattlePlayer("opponent", "相手"));
      setBattleBoardSelection(null);
      setBattleStadiumCard(null);
      setBattleNotice("");
      setBattleAiSuggestions([]);
      setBattleEffectPrompt(null);
      setBattleAttackPrompt(null);
      setBattlePrizePrompt(null);
      setBattleTrashPlayerId(null);
      setSoloOpeningRedrawCount(0);
      setSoloManualDrawTurn(null);
      setSoloUsedAbilityKeys([]);
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

  const setBattleState = (playerId: BattlePlayerId, updater: (state: BattlePlayerState) => BattlePlayerState) => {
    if (playerId === "player") {
      setBattlePlayer(updater);
    } else {
      setBattleOpponent(updater);
    }
  };
  const getBattlePlayerLabel = (playerId: BattlePlayerId) => (playerId === "player" ? "自分" : "相手");
  const currentBattleLabel = getBattlePlayerLabel(battleCurrentPlayer);
  const isBattleFinished = Boolean(battleResult);
  const isBattleInProgress = battleStarted && !isBattleFinished;
  const isBattleSetupActive = isBattleInProgress && battleSetupPhase !== "ready";
  const battleStatusLabel = battleResult
    ? battleResult.outcome === "win"
      ? "勝利"
      : "敗北"
    : isBattleSetupActive
      ? "開始準備中"
      : battleStarted
        ? `${currentBattleLabel}の番`
        : "開始前";
  const canEndBattleTurn =
    isBattleInProgress && battleSetupPhase === "ready" && (battleCurrentPlayer !== "player" || battlePlayer.manualDrawTurn === battleTurn);
  const isBattleFirstTurnPlayer = (playerId: BattlePlayerId) =>
    isBattleInProgress && battleSetupPhase === "ready" && battleTurn === 1 && playerId === (aiGoingFirst ? "opponent" : "player");
  const hasBattleDrawnForTurn = (state: BattlePlayerState) =>
    !isBattleInProgress || isBattleSetupActive || battleSetupPhase !== "ready" || state.manualDrawTurn === battleTurn;
  const requireBattleDrawBeforeHandAction = (playerId: BattlePlayerId) => {
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    if (hasBattleDrawnForTurn(state)) return false;
    setBattleNotice("このターンのドローをしてから手札を操作してください。");
    return true;
  };

  const finishBattle = (outcome: BattleResult["outcome"], reason: string, prefixNotice?: string) => {
    const message = `${outcome === "win" ? "勝利" : "敗北"}: ${reason}`;
    setBattleResult({ outcome, reason, message });
    setBattleNotice(prefixNotice ? `${prefixNotice} ${message}` : message);
    setBattleAiSuggestions([]);
    setBattleEffectPrompt(null);
    setBattleAttackPrompt(null);
    setBattlePrizePrompt(null);
    setBattleBoardSelection(null);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${message}`]);
  };

  const startBattle = () => {
    if (!selectedDeck || !selectedAiDeck) return;
    const playerSetup = setupBattleAiPlayerWithOpeningRedraw("player", "自分", selectedDeck, cardMasterDetails);
    const nextPlayer = playerSetup.player;
    const aiSetup = setupBattleAiPlayerWithOpeningRedraw("opponent", "相手", selectedAiDeck, cardMasterDetails);
    const nextOpponent = setupBattleOpponentOpeningBoard(aiSetup.player);
    if (!hasBasicPokemon(nextPlayer.hand)) {
      setBattleNotice("自分のデッキに初手へ出せるたねポケモンが見つかりません。デッキ内容を確認してください。");
      return;
    }
    if (!nextOpponent.activeStack.length) {
      setBattleNotice("AIデッキに初手へ出せるたねポケモンが見つかりません。AIデッキを変更してください。");
      return;
    }
    const firstLine = aiGoingFirst ? "AIが先攻を取った想定で準備します。" : "自分が先攻を取った想定で準備します。";
    const playerRedrawLine =
      playerSetup.redrawCount > 0
        ? `自分の初手にたねポケモンがなかったため、${playerSetup.redrawCount}回引き直しました。`
        : null;
    const aiRedrawLine =
      aiSetup.redrawCount > 0
        ? `AI初手にたねポケモンがなかったため、${aiSetup.redrawCount}回引き直しました。`
        : null;
    setBattlePlayer(nextPlayer);
    setBattleOpponent(nextOpponent);
    setBattleResult(null);
    setBattleCurrentPlayer("player");
    setBattleBoardSelection(null);
    setBattleStadiumCard(null);
    setBattleNotice(
      `開始準備中です。最初の7枚からたねポケモンを選び、バトル場に出してください。${playerRedrawLine ? ` ${playerRedrawLine}` : ""}${aiRedrawLine ? ` ${aiRedrawLine}` : ""}`
    );
    setBattleAiSuggestions([]);
    setBattleEffectPrompt(null);
    setBattleAttackPrompt(null);
    setBattlePrizePrompt(null);
    setBattleTrashPlayerId(null);
    setBattleStarted(true);
    setBattleSetupPhase("player_active");
    setBattleTurn(0);
    setBattleLog([
      `開始準備: 自分 ${selectedDeck.name} / AI ${selectedAiDeck.name}`,
      firstLine,
      ...(playerRedrawLine ? [playerRedrawLine] : []),
      ...(aiRedrawLine ? [aiRedrawLine] : []),
      `AIは${nextOpponent.activeStack[0]?.cardName || "たねポケモン"}をバトル場に出しました。`,
    ]);
  };

  const canAutoRunBattleTrainer = (card: SoloCard | undefined, state: BattlePlayerState) => {
    if (!card) return false;
    const placement = getCardPlacementType(card);
    if (placement !== "item" && placement !== "supporter" && placement !== "trainer") return false;
    if (placement === "supporter" && (state.supporterUsedTurn === battleTurn || isBattleFirstTurnPlayer(state.id))) return false;
    const profile = getEffectProfile(card);
    const action = profile?.actions[0];
    if (!action) return true;
    if ((profile.costs || []).length > 0) return false;
    return action.type === "resolve_effect" || action.type === "draw_cards" || action.type === "draw_until_board_count";
  };

  const buildBattleAiSuggestions = (state: BattlePlayerState): BattleAiSuggestion[] => {
    const suggestions: BattleAiSuggestion[] = [];
    const defender = state.id === "player" ? battleOpponent : battlePlayer;
    const emptyBenchIndex = state.benchStacks.findIndex((stack) => stack.length === 0);
    const firstBoardPokemon =
      state.activeStack.length > 0
        ? { target: "active" as const }
        : state.benchStacks.findIndex((stack) => stack.length > 0) >= 0
          ? { target: "bench" as const, benchIndex: state.benchStacks.findIndex((stack) => stack.length > 0) }
          : null;
    const basicPokemonHandIndex = state.hand.findIndex((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0);
    const benchBasicPokemonHandIndex = state.hand.findIndex((card, index) =>
      index !== basicPokemonHandIndex && getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0
    );
    const energyHandIndex = state.hand.findIndex((card) => getCardPlacementType(card) === "energy");
    const trainerHandIndex = state.hand.findIndex((card) => {
      return canAutoRunBattleTrainer(card, state);
    });
    const activeEvolutionHandIndex = state.hand.findIndex((card) =>
      getCardPlacementType(card) === "pokemon" && canEvolveBattleStack(state.activeStack, card, battleTurn)
    );
    const activeBattlePokemon = state.activeStack[state.activeStack.length - 1];
    const playableAttack =
      !isBattleFirstTurnPlayer(state.id) && activeBattlePokemon && defender.activeStack.length > 0
        ? (activeBattlePokemon.attacks || [])
            .map((attack, attackIndex) => {
              const energyStatus = getBattleAttackEnergyStatus(attack, state.attachedEnergies.active);
              const copyCandidates = getBattleAttackCopyCandidates(attack, state, defender);
              const copiedAttackKey = copyCandidates.length > 0 ? copyCandidates[0].key : null;
              const resolvedAttack = resolveBattleAttack(attack, state, defender, copiedAttackKey);
              return { attack, attackIndex, energyStatus, copiedAttackKey, resolvedAttack };
            })
            .filter(({ energyStatus, resolvedAttack }) => energyStatus.usable && Boolean(resolvedAttack))
            .sort((a, b) => getBattleAttackDamageValue(b.resolvedAttack!.effectiveAttack, state, defender) - getBattleAttackDamageValue(a.resolvedAttack!.effectiveAttack, state, defender))[0]
        : null;
    const benchEvolutionCandidate = state.hand
      .map((card, handIndex) => ({ card, handIndex }))
      .flatMap(({ card, handIndex }) =>
        state.benchStacks.map((stack, benchIndex) => ({ card, handIndex, benchIndex, canEvolve: canEvolveBattleStack(stack, card, battleTurn) }))
      )
      .find((candidate) => getCardPlacementType(candidate.card) === "pokemon" && candidate.canEvolve);

    if (state.activeStack.length === 0 && basicPokemonHandIndex >= 0) {
      const card = state.hand[basicPokemonHandIndex];
      suggestions.push({
        id: `place-active-${card.soloInstanceId || card.cardId}-${basicPokemonHandIndex}`,
        label: `${card.cardName || "たねポケモン"}をバトル場へ`,
        detail: "バトル場が空いているため、まずバトル場を用意します。",
        action: "place_active",
        handIndex: basicPokemonHandIndex,
      });
    }

    if (emptyBenchIndex >= 0) {
      const handIndex = state.activeStack.length === 0 ? benchBasicPokemonHandIndex : basicPokemonHandIndex;
      const card = handIndex >= 0 ? state.hand[handIndex] : null;
      if (card) {
        suggestions.push({
          id: `place-bench-${card.soloInstanceId || card.cardId}-${handIndex}-${emptyBenchIndex}`,
          label: `${card.cardName || "たねポケモン"}をベンチ${emptyBenchIndex + 1}へ`,
          detail: "次の展開先を確保するため、空いているベンチにたねポケモンを出します。",
          action: "place_bench",
          handIndex,
          benchIndex: emptyBenchIndex,
        });
      }
    }

    if (activeEvolutionHandIndex >= 0) {
      const card = state.hand[activeEvolutionHandIndex];
      suggestions.push({
        id: `evolve-active-${card.soloInstanceId || card.cardId}-${activeEvolutionHandIndex}`,
        label: `${card.cardName || "進化ポケモン"}へ進化`,
        detail: "バトル場のポケモンに進化を重ねます。",
        action: "evolve_active",
        handIndex: activeEvolutionHandIndex,
      });
    }

    if (benchEvolutionCandidate) {
      suggestions.push({
        id: `evolve-bench-${benchEvolutionCandidate.card.soloInstanceId || benchEvolutionCandidate.card.cardId}-${benchEvolutionCandidate.handIndex}-${benchEvolutionCandidate.benchIndex}`,
        label: `${benchEvolutionCandidate.card.cardName || "進化ポケモン"}をベンチ${benchEvolutionCandidate.benchIndex + 1}で進化`,
        detail: "ベンチのポケモンに進化を重ねます。",
        action: "evolve_bench",
        handIndex: benchEvolutionCandidate.handIndex,
        benchIndex: benchEvolutionCandidate.benchIndex,
      });
    }

    if (energyHandIndex >= 0 && firstBoardPokemon && state.energyAttachedTurn !== battleTurn) {
      const card = state.hand[energyHandIndex];
      suggestions.push({
        id: `attach-energy-${card.soloInstanceId || card.cardId}-${energyHandIndex}`,
        label: `${card.cardName || "エネルギー"}をつける`,
        detail: firstBoardPokemon.target === "active" ? "攻撃準備を優先してバトル場につけます。" : `場のポケモンへエネルギーをつけます。`,
        action: "attach_energy",
        handIndex: energyHandIndex,
        target: firstBoardPokemon.target,
        benchIndex: firstBoardPokemon.benchIndex,
      });
    }

    if (trainerHandIndex >= 0) {
      const card = state.hand[trainerHandIndex];
      suggestions.push({
        id: `use-trainer-${card.soloInstanceId || card.cardId}-${trainerHandIndex}`,
        label: `${card.cardName || "トレーナーズ"}を使う`,
        detail: "手札を増やす、山札を探すなどの効果を優先して使います。",
        action: "use_trainer",
        handIndex: trainerHandIndex,
      });
    }

    if (playableAttack) {
      suggestions.push({
        id: `attack-${playableAttack.attack.name || "attack"}-${playableAttack.attackIndex}`,
        label: `「${playableAttack.attack.name || "ワザ"}」で攻撃`,
        detail: `${defender.label}のバトルポケモンにダメージを与えて番を終えます。`,
        action: "attack",
        attackIndex: playableAttack.attackIndex,
        copiedAttackKey: playableAttack.copiedAttackKey,
      });
    }

    if (state.pile.length > 0 && state.manualDrawTurn !== battleTurn) {
      suggestions.push({
        id: "draw-card",
        label: "1枚ドロー",
        detail: "手札を増やして次の選択肢を探します。",
        action: "draw",
      });
    }

    suggestions.push({
      id: "end-turn",
      label: "番を終わる",
      detail: "追加でできる行動が薄い場合はターンを返します。",
      action: "end_turn",
    });

    if (aiStyle === "speed") {
      return suggestions
        .sort((a, b) => {
          const order: Record<BattleAiSuggestion["action"], number> = {
            place_active: 0,
            evolve_active: 1,
            evolve_bench: 2,
            attach_energy: 3,
            use_trainer: 4,
            place_bench: 5,
            draw: 6,
            attack: 7,
            end_turn: 8,
          };
          return order[a.action] - order[b.action];
        })
        .slice(0, 3);
    }
    if (aiStyle === "stability") {
      return suggestions
        .sort((a, b) => {
          const order: Record<BattleAiSuggestion["action"], number> = {
            draw: 0,
            use_trainer: 1,
            place_active: 2,
            place_bench: 3,
            evolve_active: 4,
            evolve_bench: 5,
            attach_energy: 6,
            attack: 7,
            end_turn: 8,
          };
          return order[a.action] - order[b.action];
        })
        .slice(0, 3);
    }
    if (aiStyle === "random") {
      return [...suggestions].sort(() => Math.random() - 0.5).slice(0, 3);
    }
    return suggestions
      .sort((a, b) => {
        const order: Record<BattleAiSuggestion["action"], number> = {
          place_active: 0,
          evolve_active: 1,
          evolve_bench: 2,
          place_bench: 3,
          use_trainer: 4,
          draw: 5,
          attach_energy: 6,
          attack: 7,
          end_turn: 8,
        };
        return order[a.action] - order[b.action];
      })
      .slice(0, 3);
  };

  const askNextAiMove = () => {
    if (!selectedDeck || !selectedAiDeck) return;
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted) {
      startBattle();
      return;
    }
    if (battleSetupPhase !== "ready") {
      setBattleNotice("開始準備中です。自分のたねポケモンをバトル場に出してからゲームを開始してください。");
      setBattleAiSuggestions([]);
      return;
    }
    if (battleCurrentPlayer !== "opponent") {
      setBattleNotice("AI候補は相手の番に表示します。番終了で相手に渡してください。");
      setBattleAiSuggestions([]);
      return;
    }
    const suggestions = buildBattleAiSuggestions(battleOpponent);
    setBattleAiSuggestions(suggestions);
    setBattleNotice(suggestions.length > 0 ? "AI候補を生成しました。採用する行動を選んでください。" : "AI候補がありません。");
    setBattleLog((prev) => [
      ...prev,
      `T${battleTurn}: AI候補 ${suggestions.map((suggestion) => suggestion.label).join(" / ") || "なし"}`,
      `T${battleTurn}: ${buildAiAdvice(selectedAiDeck, aiStyle, battleTurn)}`,
    ]);
  };

  const runSemiAutoAiTurn = () => {
    if (!selectedDeck || !selectedAiDeck) return;
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted) {
      startBattle();
      return;
    }
    if (battleSetupPhase !== "ready") {
      setBattleNotice("開始準備中です。自分のたねポケモンをバトル場に出してからゲームを開始してください。");
      setBattleAiSuggestions([]);
      return;
    }
    if (battleCurrentPlayer !== "opponent") {
      setBattleNotice("半自動AIは相手の番に実行します。番終了で相手に渡してください。");
      setBattleAiSuggestions([]);
      return;
    }

    const [suggestion] = buildBattleAiSuggestions(battleOpponent);
    if (!suggestion) {
      setBattleNotice("AIが実行できる行動がありません。");
      return;
    }
    applyBattleAiSuggestion(suggestion);
  };

  const resetBattle = () => {
    setBattleStarted(false);
    setBattleTurn(1);
    setBattleSetupPhase("idle");
    setBattleResult(null);
    setBattleLog([]);
    setAiGoingFirst(false);
    setBattleCurrentPlayer("player");
    setBattlePlayer(createEmptyBattlePlayer("player", "自分"));
    setBattleOpponent(createEmptyBattlePlayer("opponent", "相手"));
    setBattleBoardSelection(null);
    setBattleStadiumCard(null);
    setBattleNotice("");
    setBattleAiSuggestions([]);
    setBattleEffectPrompt(null);
    setBattleAttackPrompt(null);
    setBattleTrashPlayerId(null);
  };

  const applyBattleAiSuggestion = (suggestion: BattleAiSuggestion) => {
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中はAI候補を採用できません。");
      return;
    }
    if (!battleStarted || battleCurrentPlayer !== "opponent") {
      setBattleNotice("AI候補は相手の番だけ採用できます。");
      return;
    }

    if (suggestion.action === "end_turn") {
      setBattleAiSuggestions([]);
      setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
      endBattleTurn();
      return;
    }

    if (suggestion.action === "use_trainer") {
      playSelectedBattleTrainerCard("opponent", suggestion.handIndex);
      setBattleAiSuggestions([]);
      setBattleBoardSelection(null);
      return;
    }

    if (suggestion.action === "attack") {
      executeBattleAttack("opponent", suggestion.attackIndex, suggestion.copiedAttackKey);
      return;
    }

    setBattleOpponent((state) => {
      if (suggestion.action === "draw") {
        if (state.pile.length === 0) {
          setBattleNotice("相手の山札がありません。");
          return state;
        }
        const draw = takeRandomCards(state.pile, 1);
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return { ...state, pile: draw.rest, hand: [...state.hand, ...draw.drawn], selectedHandIndex: null, manualDrawTurn: battleTurn };
      }

      const selected = state.hand[suggestion.handIndex];
      if (!selected) {
        setBattleNotice("候補のカードが見つかりません。候補を作り直してください。");
        return state;
      }
      const nextHand = state.hand.filter((_, index) => index !== suggestion.handIndex);

      if (suggestion.action === "place_active") {
        if (state.activeStack.length > 0 || getCardPlacementType(selected) !== "pokemon" || getStageOrder(selected) !== 0) {
          setBattleNotice("この候補は現在の盤面では採用できません。候補を作り直してください。");
          return state;
        }
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return { ...state, hand: nextHand, activeStack: [{ ...selected, playedTurn: battleTurn }], damage: { ...state.damage, active: 0 }, selectedHandIndex: null };
      }

      if (suggestion.action === "place_bench") {
        if (state.benchStacks[suggestion.benchIndex]?.length || getCardPlacementType(selected) !== "pokemon" || getStageOrder(selected) !== 0) {
          setBattleNotice("この候補は現在の盤面では採用できません。候補を作り直してください。");
          return state;
        }
        const nextBenchStacks = state.benchStacks.map((stack, index) =>
          index === suggestion.benchIndex ? [{ ...selected, playedTurn: battleTurn }] : stack
        );
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return {
          ...state,
          hand: nextHand,
          benchStacks: nextBenchStacks,
          damage: {
            ...state.damage,
            bench: state.damage.bench.map((damage, index) => (index === suggestion.benchIndex ? 0 : damage)),
          },
          selectedHandIndex: null,
        };
      }

      if (suggestion.action === "evolve_active") {
        if (!canEvolveBattleStack(state.activeStack, selected, battleTurn)) {
          setBattleNotice("この候補は現在の盤面では採用できません。候補を作り直してください。");
          return state;
        }
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return { ...state, hand: nextHand, activeStack: [...state.activeStack, { ...selected, playedTurn: battleTurn }], selectedHandIndex: null };
      }

      if (suggestion.action === "evolve_bench") {
        const targetStack = state.benchStacks[suggestion.benchIndex] || [];
        if (!canEvolveBattleStack(targetStack, selected, battleTurn)) {
          setBattleNotice("この候補は現在の盤面では採用できません。候補を作り直してください。");
          return state;
        }
        const nextBenchStacks = state.benchStacks.map((stack, index) =>
          index === suggestion.benchIndex ? [...stack, { ...selected, playedTurn: battleTurn }] : stack
        );
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return { ...state, hand: nextHand, benchStacks: nextBenchStacks, selectedHandIndex: null };
      }

      if (suggestion.action === "attach_energy") {
        if (getCardPlacementType(selected) !== "energy") {
          setBattleNotice("この候補は現在の盤面では採用できません。候補を作り直してください。");
          return state;
        }
        const hasTarget =
          suggestion.target === "active"
            ? state.activeStack.length > 0
            : Boolean(state.benchStacks[suggestion.benchIndex ?? 0]?.length);
        if (!hasTarget) {
          setBattleNotice("エネルギーをつけるポケモンがいません。候補を作り直してください。");
          return state;
        }
        const nextEnergies =
          suggestion.target === "active"
            ? { ...state.attachedEnergies, active: [...state.attachedEnergies.active, selected] }
            : {
                ...state.attachedEnergies,
                bench: state.attachedEnergies.bench.map((energies, index) =>
                  index === (suggestion.benchIndex ?? 0) ? [...energies, selected] : energies
                ),
              };
        setBattleNotice(`AI候補を採用: ${suggestion.label}`);
        setBattleLog((prev) => [...prev, `T${battleTurn}: AI候補を採用 - ${suggestion.label}`]);
        return { ...state, hand: nextHand, attachedEnergies: nextEnergies, selectedHandIndex: null, energyAttachedTurn: battleTurn };
      }

      return state;
    });
    setBattleAiSuggestions([]);
    setBattleBoardSelection(null);
  };

  useEffect(() => {
    runSemiAutoAiTurnRef.current = runSemiAutoAiTurn;
  });

  useEffect(() => {
    if (
      mode !== "ai" ||
      !autoBattleAiEnabled ||
      !isBattleInProgress ||
      battleSetupPhase !== "ready" ||
      battleCurrentPlayer !== "opponent" ||
      battleResult ||
      battleEffectPrompt ||
      battleAttackPrompt ||
      battlePrizePrompt
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      runSemiAutoAiTurnRef.current();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    autoBattleAiEnabled,
    battleAttackPrompt,
    battleCurrentPlayer,
    battleEffectPrompt,
    battleOpponent,
    battlePlayer,
    battlePrizePrompt,
    battleResult,
    battleSetupPhase,
    battleTurn,
    isBattleInProgress,
    mode,
  ]);

  const selectBattleHandCard = (playerId: BattlePlayerId, handIndex: number) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけ操作できます。");
      return;
    }
    if (requireBattleDrawBeforeHandAction(playerId)) return;
    setBattleAiSuggestions([]);
    setBattleState(playerId, (state) => ({
      ...state,
      selectedHandIndex: state.selectedHandIndex === handIndex ? null : handIndex,
    }));
    setBattleBoardSelection(null);
  };

  const getBattleBoardCard = (playerId: BattlePlayerId, selection: BattleBoardSelection | null) => {
    if (!selection || selection.playerId !== playerId) return null;
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    return selection.location === "active"
      ? state.activeStack[state.activeStack.length - 1] || null
      : state.benchStacks[selection.benchIndex || 0]?.[state.benchStacks[selection.benchIndex || 0].length - 1] || null;
  };

  const getBattleBoardStack = (playerId: BattlePlayerId, selection: BattleBoardSelection | null) => {
    if (!selection || selection.playerId !== playerId) return [];
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    return selection.location === "active" ? state.activeStack : state.benchStacks[selection.benchIndex || 0] || [];
  };

  const getBattleBoardAbilityKey = (playerId: BattlePlayerId, card: SoloCard, abilityIndex: number, abilityName?: string) => {
    const instanceKey = card.soloInstanceId || `${card.cardId}:${card.playedTurn ?? "unknown"}`;
    return `${battleTurn}:${playerId}:${instanceKey}:${abilityName || "特性"}:${abilityIndex}`;
  };

  const hasBattlePokemonNamedOnBoard = (playerId: BattlePlayerId, pokemonName: string) => {
    const normalized = normalizePokemonNameCore(pokemonName);
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    const boardCards = [
      state.activeStack[state.activeStack.length - 1],
      ...state.benchStacks.map((stack) => stack[stack.length - 1]),
    ].filter((card): card is SoloCard => Boolean(card));
    return boardCards.some((card) => normalizePokemonNameCore(card.cardName).includes(normalized));
  };

  const validateBattleAbilityConditions = (playerId: BattlePlayerId, ability: SoloAbility, card: SoloCard) => {
    const text = ability.text || "";
    const selection = battleBoardSelection;
    if (!selection || selection.playerId !== playerId) return "選択中のポケモンが見つかりませんでした。";
    if (text.includes("このカードを手札からベンチに出したとき")) {
      if (selection.location !== "bench" || card.playedTurn !== battleTurn) {
        return "この特性は、このカードを手札からベンチに出した番だけ使えます。";
      }
    }
    if (text.includes("このカードを手札から出して進化させたとき")) {
      if (getBattleBoardStack(playerId, selection).length < 2 || card.playedTurn !== battleTurn) {
        return "この特性は、このカードを手札から出して進化させた番だけ使えます。";
      }
    }
    const requiresActive =
      text.includes("このポケモンがバトル場にいるなら") ||
      text.includes("このポケモンがバトル場にいて");
    if (requiresActive && selection.location !== "active") {
      return "この特性は、このポケモンがバトル場にいるときだけ使えます。";
    }
    const requiredBoardPokemon = text.match(/自分の場に「([^」]+)」がいて/)?.[1];
    if (requiredBoardPokemon && !hasBattlePokemonNamedOnBoard(playerId, requiredBoardPokemon)) {
      return `この特性は、自分の場に「${requiredBoardPokemon}」がいるときだけ使えます。`;
    }
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    if (text.includes("この特性は別の") && state.usedAbilityKeys.some((key) => key.includes(`:${ability.name || "特性"}:`))) {
      return `この番は別の「${ability.name || "特性"}」をすでに使っています。`;
    }
    return "";
  };

  const activateBattleBoardAbility = (playerId: BattlePlayerId, abilityIndex: number) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけ特性を使えます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中は特性を使えません。");
      return;
    }
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    const boardCard = getBattleBoardCard(playerId, battleBoardSelection);
    const ability = boardCard?.abilities?.[abilityIndex];
    if (!boardCard || !ability) {
      setBattleNotice("使う特性が見つかりませんでした。");
      return;
    }
    const abilityKey = getBattleBoardAbilityKey(playerId, boardCard, abilityIndex, ability.name);
    if (state.usedAbilityKeys.includes(abilityKey)) {
      setBattleNotice(`${ability.name || "この特性"}はこのターンすでに使っています。`);
      return;
    }
    const conditionError = validateBattleAbilityConditions(playerId, ability, boardCard);
    if (conditionError) {
      setBattleNotice(conditionError);
      return;
    }
    const profile = getAbilityEffectProfile(boardCard, ability);
    const firstAction = profile?.actions[0];
    const firstCost = profile?.costs?.[0];
    if (!profile || !firstAction) {
      setBattleNotice(`${ability.name || "特性"}の効果を判定できませんでした。`);
      return;
    }
    if (firstCost?.type === "discard_from_hand" && requireBattleDrawBeforeHandAction(playerId)) return;
    const stateWithAbilityUsed: BattlePlayerState = state.usedAbilityKeys.includes(abilityKey)
      ? state
      : { ...state, usedAbilityKeys: [...state.usedAbilityKeys, abilityKey] };

    if (firstCost?.type === "discard_from_hand") {
      const availableCostCards = state.hand.filter((card) => matchesHandDiscardCost(card, firstCost.target, firstCost.cardName)).length;
      if (availableCostCards < firstCost.count) {
        setBattleNotice(`${ability.name || "この特性"}のコストが足りません。${getHandDiscardCostLabel(firstCost.target, firstCost.cardName)}`);
        return;
      }
      setBattleEffectPrompt({
        kind: "discard_from_hand",
        playerId,
        sourceHandIndex: null,
        sourceCard: boardCard,
        nextAction: firstAction,
        count: firstCost.count,
        costTarget: firstCost.target,
        costCardName: firstCost.cardName,
        abilityKeyToMark: abilityKey,
        selectedHandIndexes: [],
      });
      setBattleNotice(`${ability.name || "特性"}のコストとして手札を${firstCost.count}枚選んでください。`);
      return;
    }

    setBattleBoardSelection(null);
    if (firstAction.type === "draw_cards") {
      const { nextState, drawnCount } = applyBattleDrawCardsActionToState(stateWithAbilityUsed, null, boardCard, firstAction);
      setBattleState(playerId, () => nextState);
      const notice = `${boardCard.cardName || "ポケモン"}の特性「${ability.name || "特性"}」で${drawnCount}枚引きました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return;
    }
    if (
      firstAction.type === "search_deck" ||
      firstAction.type === "recover_from_trash" ||
      firstAction.type === "switch_active" ||
      firstAction.type === "draw_until_board_count" ||
      firstAction.type === "heal_pokemon" ||
      firstAction.type === "discard_tool" ||
      firstAction.type === "discard_stadium"
    ) {
      if (openBattleNextEffectPrompt(playerId, boardCard, firstAction, stateWithAbilityUsed)) {
        setBattleState(playerId, (current) => ({
          ...current,
          usedAbilityKeys: current.usedAbilityKeys.includes(abilityKey)
            ? current.usedAbilityKeys
            : [...current.usedAbilityKeys, abilityKey],
        }));
      }
      return;
    }
    setBattleState(playerId, () => stateWithAbilityUsed);
    const notice = `${boardCard.cardName || "ポケモン"}の特性「${ability.name || "特性"}」を使いました。手動で効果を解決してください。${ability.text || ""}`;
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
  };

  const clearBattleSelection = () => {
    setBattlePlayer((state) => ({ ...state, selectedHandIndex: null }));
    setBattleOpponent((state) => ({ ...state, selectedHandIndex: null }));
    setBattleBoardSelection(null);
    setBattleAiSuggestions([]);
    setBattleAttackPrompt(null);
  };

  const placeSelectedBattleOpeningBasic = (location: "active" | "bench", benchIndex?: number) => {
    if (!battleStarted || battleSetupPhase === "ready" || battleCurrentPlayer !== "player") return;
    setBattlePlayer((state) => {
      const handIndex = state.selectedHandIndex;
      const selected = handIndex !== null ? state.hand[handIndex] : null;
      if (!selected) {
        setBattleNotice("初手からたねポケモンを選んでください。");
        return state;
      }
      if (getCardPlacementType(selected) !== "pokemon" || getStageOrder(selected) !== 0) {
        setBattleNotice("ゲーム開始時に出せるのはたねポケモンだけです。");
        return state;
      }
      if (location === "active") {
        if (battleSetupPhase !== "player_active" || state.activeStack.length > 0) {
          setBattleNotice("バトル場のたねポケモンはすでに決まっています。");
          return state;
        }
        const nextHand = state.hand.filter((_, index) => index !== handIndex);
        setBattleSetupPhase("player_bench");
        setBattleNotice("必要ならベンチにたねポケモンを出してください。準備できたらゲーム開始を押してください。");
        setBattleLog((prev) => [...prev, `開始準備: 自分は${selected.cardName || "たねポケモン"}をバトル場に出しました。`]);
        return {
          ...state,
          hand: nextHand,
          activeStack: [{ ...selected, playedTurn: 0 }],
          damage: { ...state.damage, active: 0 },
          selectedHandIndex: null,
        };
      }

      if (battleSetupPhase !== "player_bench") {
        setBattleNotice("先にバトル場へたねポケモンを出してください。");
        return state;
      }
      const targetIndex = benchIndex ?? state.benchStacks.findIndex((stack) => stack.length === 0);
      if (targetIndex < 0 || targetIndex >= state.benchStacks.length || state.benchStacks[targetIndex]?.length) {
        setBattleNotice("空いているベンチを選んでください。");
        return state;
      }
      const nextHand = state.hand.filter((_, index) => index !== handIndex);
      setBattleNotice(`ベンチ${targetIndex + 1}に${selected.cardName || "たねポケモン"}を出しました。`);
      setBattleLog((prev) => [...prev, `開始準備: 自分は${selected.cardName || "たねポケモン"}をベンチ${targetIndex + 1}に出しました。`]);
      return {
        ...state,
        hand: nextHand,
        benchStacks: state.benchStacks.map((stack, index) => (index === targetIndex ? [{ ...selected, playedTurn: 0 }] : stack)),
        damage: {
          ...state.damage,
          bench: state.damage.bench.map((damage, index) => (index === targetIndex ? 0 : damage)),
        },
        selectedHandIndex: null,
      };
    });
    setBattleAiSuggestions([]);
    setBattleBoardSelection(null);
  };

  const finishBattleOpeningSetup = () => {
    if (!battleStarted || battleSetupPhase !== "player_bench") return;
    if (!battlePlayer.activeStack.length || !battleOpponent.activeStack.length) {
      setBattleNotice("両プレイヤーのバトル場にたねポケモンが出てからゲーム開始できます。");
      return;
    }
    const firstPlayer: BattlePlayerId = aiGoingFirst ? "opponent" : "player";
    setBattleSetupPhase("ready");
    setBattleTurn(1);
    setBattleCurrentPlayer(firstPlayer);
    setBattlePlayer((state) => ({ ...state, selectedHandIndex: null }));
    setBattleOpponent((state) => ({ ...state, selectedHandIndex: null }));
    setBattleNotice(`${getBattlePlayerLabel(firstPlayer)}の番です。ゲームを開始しました。`);
    setBattleLog((prev) => [
      ...prev,
      "開始準備完了: 両プレイヤーのバトルポケモンが出揃いました。",
      `T1: ${getBattlePlayerLabel(firstPlayer)}の番`,
      `T1: ${buildAiAdvice(firstPlayer === "opponent" ? selectedAiDeck : selectedDeck, aiStyle, 1)}`,
    ]);
  };

  const drawBattleCard = (playerId: BattlePlayerId) => {
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけドローできます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中は通常ドローできません。");
      return;
    }
    setBattleAiSuggestions([]);
    setBattleState(playerId, (state) => {
      if (state.manualDrawTurn === battleTurn) {
        setBattleNotice(`${state.label}はこのターンすでにドローしています。`);
        return state;
      }
      if (state.pile.length === 0) {
        setBattleNotice(`${state.label}の山札がありません。`);
        return state;
      }
      const draw = takeRandomCards(state.pile, 1);
      setBattleNotice(`${state.label}が1枚引きました。`);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${state.label}が1枚ドロー`]);
      return { ...state, pile: draw.rest, hand: [...state.hand, ...draw.drawn], manualDrawTurn: battleTurn };
    });
  };

  const moveSelectedBattleHandToDiscard = (playerId: BattlePlayerId) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) return;
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中は手札をトラッシュできません。");
      return;
    }
    if (requireBattleDrawBeforeHandAction(playerId)) return;
    setBattleAiSuggestions([]);
    setBattleState(playerId, (state) => {
      const selected = state.selectedHandIndex !== null ? state.hand[state.selectedHandIndex] : null;
      if (!selected) return state;
      setBattleNotice(`${state.label}の${selected.cardName || "カード"}をトラッシュしました。`);
      return {
        ...state,
        hand: state.hand.filter((_, index) => index !== state.selectedHandIndex),
        discard: [...state.discard, selected],
        selectedHandIndex: null,
      };
    });
  };

  const playSelectedBattleTrainerCard = (playerId: BattlePlayerId, forcedHandIndex?: number) => {
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけ使えます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中はトレーナーズを使えません。");
      return;
    }
    if (requireBattleDrawBeforeHandAction(playerId)) return;
    setBattleAiSuggestions([]);
    setBattleState(playerId, (state) => {
      const handIndex = forcedHandIndex ?? state.selectedHandIndex;
      const selected = handIndex !== null ? state.hand[handIndex] : null;
      if (!selected) {
        setBattleNotice("使うカードを選択してください。");
        return state;
      }
      const placementType = getCardPlacementType(selected);
      if (placementType !== "item" && placementType !== "supporter" && placementType !== "trainer") {
        setBattleNotice("グッズ・サポートなどのトレーナーズを選択してください。");
        return state;
      }
      if (placementType === "supporter" && state.supporterUsedTurn === battleTurn) {
        setBattleNotice(`${state.label}はこのターンすでにサポートを使っています。`);
        return state;
      }
      if (placementType === "supporter" && isBattleFirstTurnPlayer(playerId)) {
        setBattleNotice("先攻最初の番はサポートを使えません。");
        return state;
      }

      const profile = getEffectProfile(selected);
      const firstAction = profile?.actions[0];
      const markSupporterUsedState = {
        ...state,
        supporterUsedTurn: placementType === "supporter" ? battleTurn : state.supporterUsedTurn,
      };

      if (!profile || !firstAction) {
        const nextHand = state.hand.filter((_, index) => index !== handIndex);
        const notice = `${state.label}が${selected.cardName || "トレーナーズ"}を使ってトラッシュしました。効果は手動で解決してください。`;
        setBattleNotice(notice);
        setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
        return { ...markSupporterUsedState, hand: nextHand, discard: [...state.discard, selected], selectedHandIndex: null };
      }

      if (firstAction.type === "resolve_effect") {
        const nextHand = state.hand.filter((_, index) => index !== handIndex);
        const notice = `${state.label}が${selected.cardName || "トレーナーズ"}を使ってトラッシュしました。${firstAction.note}`;
        setBattleNotice(notice);
        setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
        return { ...markSupporterUsedState, hand: nextHand, discard: [...state.discard, selected], selectedHandIndex: null };
      }

      if (profile.costs?.[0]?.type === "discard_from_hand") {
        const firstCost = profile.costs[0];
        const availableCostCards = state.hand.filter((card, index) =>
          index !== handIndex && matchesHandDiscardCost(card, firstCost.target, firstCost.cardName)
        ).length;
        if (availableCostCards < firstCost.count) {
          setBattleNotice(`手札コストが足りません。${selected.cardName || "このカード"}以外に${firstCost.count}枚必要です。`);
          return state;
        }
        setBattleEffectPrompt({
          kind: "discard_from_hand",
          playerId,
          sourceHandIndex: handIndex,
          sourceCard: selected,
          nextAction: firstAction,
          count: firstCost.count,
          costTarget: firstCost.target,
          costCardName: firstCost.cardName,
          selectedHandIndexes: [],
        });
        setBattleNotice(`コストとして手札を${firstCost.count}枚選んでください。`);
        return markSupporterUsedState;
      }

      if (firstAction.type === "draw_cards") {
        const { nextState, drawnCount } = applyBattleDrawCardsActionToState(markSupporterUsedState, handIndex, selected, firstAction);
        const notice = `${state.label}が${selected.cardName || "トレーナーズ"}を使い、${drawnCount}枚引きました。`;
        setBattleNotice(notice);
        setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
        return nextState;
      }

      if (firstAction.type === "draw_until_board_count") {
        const { nextState, drawnCount } = applyBattleDrawUntilBoardCountToState(markSupporterUsedState, handIndex, selected);
        const notice = `${state.label}が${selected.cardName || "トレーナーズ"}を使い、場のポケモンの数に合わせて${drawnCount}枚引きました。`;
        setBattleNotice(notice);
        setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
        return nextState;
      }

      if (firstAction.type === "search_deck") {
        const look = firstAction.look;
        const visiblePileIndexes = look
          ? look.from === "bottom"
            ? state.pile.slice(-look.count).map((_, index) => state.pile.length - look.count + index).filter((index) => index >= 0)
            : state.pile.slice(0, look.count).map((_, index) => index)
          : undefined;
        setBattleEffectPrompt({
          kind: "search_deck",
          playerId,
          sourceHandIndex: handIndex,
          sourceCard: selected,
          action: firstAction,
          selectedPileIndexes: [],
          visiblePileIndexes,
        });
        setBattleNotice(`${selected.cardName || "トレーナーズ"}の効果で山札からカードを選んでください。`);
        return markSupporterUsedState;
      }

      if (firstAction.type === "recover_from_trash") {
        setBattleEffectPrompt({
          kind: "recover_from_trash",
          playerId,
          sourceHandIndex: handIndex,
          sourceCard: selected,
          action: firstAction,
          selectedDiscardIndexes: [],
        });
        setBattleNotice(`${selected.cardName || "トレーナーズ"}の効果でトラッシュからカードを選んでください。`);
        return markSupporterUsedState;
      }

      if (firstAction.type === "switch_active") {
        setBattleEffectPrompt({
          kind: "switch_active",
          playerId,
          sourceHandIndex: handIndex,
          sourceCard: selected,
          selectedBenchIndex: null,
        });
        setBattleNotice("入れ替え先のベンチポケモンを選んでください。");
        return markSupporterUsedState;
      }

      if (firstAction.type === "heal_pokemon" || firstAction.type === "discard_tool") {
        if (openBattleBoardPokemonPrompt(playerId, handIndex, selected, firstAction, markSupporterUsedState)) {
          return markSupporterUsedState;
        }
        return state;
      }

      if (firstAction.type === "discard_stadium") {
        return executeBattleDiscardStadiumAction(handIndex, selected, firstAction, markSupporterUsedState);
      }

      const nextHand = state.hand.filter((_, index) => index !== handIndex);
      const notice = `${state.label}が${selected.cardName || "トレーナーズ"}を使いました。効果「${profile.label}」は手動で解決してください。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return { ...markSupporterUsedState, hand: nextHand, discard: [...state.discard, selected], selectedHandIndex: null };
    });
  };

  const cancelBattleEffectPrompt = () => {
    setBattleEffectPrompt(null);
    setBattleNotice("");
  };

  const toggleBattleEffectHandSelection = (handIndex: number) => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "discard_from_hand" || handIndex === prompt.sourceHandIndex) return;
    if (requireBattleDrawBeforeHandAction(prompt.playerId)) return;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const nextCard = state.hand[handIndex];
    if (nextCard && !matchesHandDiscardCost(nextCard, prompt.costTarget, prompt.costCardName)) {
      setBattleNotice(getHandDiscardCostLabel(prompt.costTarget, prompt.costCardName));
      return;
    }
    setBattleEffectPrompt({
      ...prompt,
      selectedHandIndexes: prompt.selectedHandIndexes.includes(handIndex)
        ? prompt.selectedHandIndexes.filter((index) => index !== handIndex)
        : [...prompt.selectedHandIndexes, handIndex].slice(0, prompt.count),
    });
  };

  const getBattleDrawActionCount = (state: BattlePlayerState, action: Extract<EffectAction, { type: "draw_cards" }>) => {
    if (action.countWhenPrizeCount && state.prizes.length === action.countWhenPrizeCount.prizeCount) {
      return action.countWhenPrizeCount.count;
    }
    return action.count;
  };

  const countBattleBoardPokemonForState = (state: BattlePlayerState) => {
    return (state.activeStack.length > 0 ? 1 : 0) + state.benchStacks.filter((stack) => stack.length > 0).length;
  };

  const applyBattleDrawCardsActionToState = (
    state: BattlePlayerState,
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "draw_cards" }>
  ) => {
    const drawCount = getBattleDrawActionCount(state, action);
    const source = sourceHandIndex !== null ? state.hand[sourceHandIndex] || sourceCard : null;
    const remainingHand = sourceHandIndex !== null ? state.hand.filter((_, index) => index !== sourceHandIndex) : state.hand;
    let nextPile = state.pile;
    let nextHand = remainingHand;
    let nextDiscard = source ? [...state.discard, source] : state.discard;

    if (action.discardRemainingHand) {
      nextDiscard = [...nextDiscard, ...remainingHand];
      nextHand = [];
    }
    if (action.shuffleRemainingHandIntoDeck) {
      nextPile = [...nextPile, ...remainingHand].sort(() => Math.random() - 0.5);
      nextHand = [];
    }

    const draw = takeRandomCards(nextPile, drawCount);
    return {
      nextState: {
        ...state,
        pile: draw.rest,
        hand: [...nextHand, ...draw.drawn],
        discard: nextDiscard,
        selectedHandIndex: null,
      },
      drawnCount: draw.drawn.length,
    };
  };

  const applyBattleDrawUntilBoardCountToState = (
    state: BattlePlayerState,
    sourceHandIndex: number | null,
    sourceCard: SoloCard
  ) => {
    const source = sourceHandIndex !== null ? state.hand[sourceHandIndex] || sourceCard : null;
    const nextHandBase = sourceHandIndex !== null ? state.hand.filter((_, index) => index !== sourceHandIndex) : state.hand;
    const drawCount = Math.max(0, countBattleBoardPokemonForState(state) - nextHandBase.length);
    const draw = takeRandomCards(state.pile, drawCount);
    return {
      nextState: {
        ...state,
        pile: draw.rest,
        hand: [...nextHandBase, ...draw.drawn],
        discard: source ? [...state.discard, source] : state.discard,
        selectedHandIndex: null,
      },
      drawnCount: draw.drawn.length,
    };
  };

  const openBattleBoardPokemonPrompt = (
    playerId: BattlePlayerId,
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "heal_pokemon" | "discard_tool" }>,
    state: BattlePlayerState
  ) => {
    const hasPokemon = state.activeStack.length > 0 || state.benchStacks.some((stack) => stack.length > 0);
    if (!hasPokemon) {
      setBattleNotice("対象にできる自分のポケモンがいません。");
      return false;
    }
    if (action.type === "discard_tool") {
      const hasTool = Boolean(state.attachedTools.active) || state.attachedTools.bench.some(Boolean);
      if (!hasTool) {
        setBattleNotice("トラッシュできるポケモンのどうぐがありません。");
        return false;
      }
    }
    setBattleEffectPrompt({
      kind: "select_board_pokemon",
      playerId,
      sourceHandIndex,
      sourceCard,
      action,
    });
    setBattleNotice(action.type === "heal_pokemon" ? "回復するポケモンを選んでください。" : "どうぐをトラッシュするポケモンを選んでください。");
    return true;
  };

  const executeBattleDiscardStadiumAction = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "discard_stadium" }>,
    state: BattlePlayerState
  ) => {
    if (!battleStadiumCard) {
      setBattleNotice("トラッシュできるスタジアムがありません。");
      return state;
    }
    const source = sourceHandIndex !== null ? state.hand[sourceHandIndex] || sourceCard : null;
    const nextState = {
      ...state,
      hand: sourceHandIndex !== null ? state.hand.filter((_, index) => index !== sourceHandIndex) : state.hand,
      discard: [...state.discard, ...(source ? [source] : []), battleStadiumCard],
      selectedHandIndex: null,
    };
    setBattleStadiumCard(null);
    setBattleEffectPrompt(null);
    const notice = `${sourceCard.cardName || "トレーナーズ"}の効果でスタジアムをトラッシュしました。${action.note}`;
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
    return nextState;
  };

  const openBattleNextEffectPrompt = (
    playerId: BattlePlayerId,
    sourceCard: SoloCard,
    action: EffectAction,
    state: BattlePlayerState,
    nextPile?: SoloCard[],
    nextDiscard?: SoloCard[]
  ) => {
    if (action.type === "search_deck") {
      const pile = nextPile || state.pile;
      const look = action.look;
      const visiblePileIndexes = look
        ? look.from === "bottom"
          ? pile.slice(-look.count).map((_, index) => pile.length - look.count + index).filter((index) => index >= 0)
          : pile.slice(0, look.count).map((_, index) => index)
        : undefined;
      setBattleEffectPrompt({
        kind: "search_deck",
        playerId,
        sourceHandIndex: null,
        sourceCard,
        action,
        selectedPileIndexes: [],
        visiblePileIndexes,
      });
      setBattleNotice(`${sourceCard.cardName || "トレーナーズ"}の効果で山札からカードを選んでください。`);
      return true;
    }
    if (action.type === "recover_from_trash") {
      setBattleEffectPrompt({
        kind: "recover_from_trash",
        playerId,
        sourceHandIndex: null,
        sourceCard,
        action,
        selectedDiscardIndexes: [],
      });
      setBattleNotice(`${sourceCard.cardName || "トレーナーズ"}の効果でトラッシュからカードを選んでください。`);
      return true;
    }
    if (action.type === "switch_active") {
      setBattleEffectPrompt({
        kind: "switch_active",
        playerId,
        sourceHandIndex: null,
        sourceCard,
        selectedBenchIndex: null,
      });
      setBattleNotice("入れ替え先のベンチポケモンを選んでください。");
      return true;
    }
    if (action.type === "draw_cards") {
      const effectState = { ...state, pile: nextPile || state.pile, discard: nextDiscard || state.discard };
      const { nextState, drawnCount } = applyBattleDrawCardsActionToState(effectState, null, sourceCard, action);
      setBattleState(playerId, () => nextState);
      setBattleEffectPrompt(null);
      const notice = `${sourceCard.cardName || "トレーナーズ"}の効果で${drawnCount}枚引きました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return true;
    }
    if (action.type === "draw_until_board_count") {
      const { nextState, drawnCount } = applyBattleDrawUntilBoardCountToState(state, null, sourceCard);
      setBattleState(playerId, () => nextState);
      setBattleEffectPrompt(null);
      const notice = `${sourceCard.cardName || "トレーナーズ"}の効果で、場のポケモンの数に合わせて${drawnCount}枚引きました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return true;
    }
    if (action.type === "heal_pokemon" || action.type === "discard_tool") {
      return openBattleBoardPokemonPrompt(playerId, null, sourceCard, action, state);
    }
    if (action.type === "discard_stadium") {
      const nextState = executeBattleDiscardStadiumAction(null, sourceCard, action, state);
      setBattleState(playerId, () => nextState);
      return nextState !== state;
    }
    setBattleEffectPrompt(null);
    const notice = `${sourceCard.cardName || "トレーナーズ"}の効果を手動で解決してください。`;
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
    return false;
  };

  const confirmBattleEffectDiscardCost = () => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "discard_from_hand") return;
    if (requireBattleDrawBeforeHandAction(prompt.playerId)) return;
    if (prompt.selectedHandIndexes.length !== prompt.count) {
      setBattleNotice(`コストとして手札を${prompt.count}枚選んでください。`);
      return;
    }
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const invalidCostCard = prompt.selectedHandIndexes
      .map((index) => state.hand[index])
      .find((card) => card && !matchesHandDiscardCost(card, prompt.costTarget, prompt.costCardName));
    if (invalidCostCard) {
      setBattleNotice(getHandDiscardCostLabel(prompt.costTarget, prompt.costCardName));
      return;
    }
    const discardIndexes = new Set([
      ...(prompt.sourceHandIndex !== null ? [prompt.sourceHandIndex] : []),
      ...prompt.selectedHandIndexes,
    ]);
    const discardedCards = state.hand.filter((_, index) => discardIndexes.has(index));
    const nextUsedAbilityKeys = prompt.abilityKeyToMark && !state.usedAbilityKeys.includes(prompt.abilityKeyToMark)
      ? [...state.usedAbilityKeys, prompt.abilityKeyToMark]
      : state.usedAbilityKeys;
    const nextState = {
      ...state,
      hand: state.hand.filter((_, index) => !discardIndexes.has(index)),
      discard: [...state.discard, ...discardedCards],
      selectedHandIndex: null,
      usedAbilityKeys: nextUsedAbilityKeys,
    };
    setBattleState(prompt.playerId, () => nextState);
    openBattleNextEffectPrompt(prompt.playerId, prompt.sourceCard, prompt.nextAction, nextState, nextState.pile, nextState.discard);
  };

  const toggleBattleEffectPileSelection = (pileIndex: number) => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "search_deck") return;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const nextCard = state.pile[pileIndex];
    if (!nextCard) return;
    if (prompt.selectedPileIndexes.includes(pileIndex)) {
      setBattleEffectPrompt({ ...prompt, selectedPileIndexes: prompt.selectedPileIndexes.filter((index) => index !== pileIndex) });
      return;
    }
    const selectedCards = prompt.selectedPileIndexes.map((index) => state.pile[index]).filter((card): card is SoloCard => Boolean(card));
    if (!canAddSearchSelection(selectedCards, nextCard, prompt.action)) {
      setBattleNotice(`この効果では${getSearchActionLabel(prompt.action)}を選んでください。`);
      return;
    }
    setBattleEffectPrompt({ ...prompt, selectedPileIndexes: [...prompt.selectedPileIndexes, pileIndex].slice(0, prompt.action.count) });
  };

  const confirmBattleEffectSearchDeck = () => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "search_deck") return;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const visiblePileIndexes = prompt.visiblePileIndexes || state.pile.map((_, index) => index);
    const availableCandidateIndexes = visiblePileIndexes.filter((pileIndex) => {
      const card = state.pile[pileIndex];
      return Boolean(card && matchesSearchActionTarget(card, prompt.action));
    });
    if (prompt.selectedPileIndexes.length === 0 && availableCandidateIndexes.length > 0) {
      setBattleNotice("山札から加えるカードを選んでください。");
      return;
    }
    const selectedIndexes = new Set(prompt.selectedPileIndexes);
    const selectedCards = prompt.selectedPileIndexes.map((index) => state.pile[index]).filter((card): card is SoloCard => Boolean(card));
    if (selectedCards.length > 0) {
      const requirementError = validateSearchSelectionRequirements(selectedCards, prompt.action);
      if (requirementError) {
        setBattleNotice(requirementError);
        return;
      }
    }
    const visibleIndexes = new Set(visiblePileIndexes);
    const unselectedVisibleCards = state.pile.filter((_, index) => visibleIndexes.has(index) && !selectedIndexes.has(index));
    const restPile = state.pile
      .map((card, pileIndex) => ({ card, pileIndex }))
      .filter(({ pileIndex }) => !selectedIndexes.has(pileIndex))
      .filter(({ pileIndex }) => prompt.action.remainingDestination !== "discard" || !visibleIndexes.has(pileIndex))
      .map(({ card }) => card)
      .sort(() => Math.random() - 0.5);
    const discardCards = prompt.action.remainingDestination === "discard" ? unselectedVisibleCards : [];
    const nextDiscard = [...state.discard, ...discardCards];
    const sourceCard = prompt.sourceHandIndex !== null ? state.hand[prompt.sourceHandIndex] : null;

    let nextState: BattlePlayerState = {
      ...state,
      pile: restPile,
      discard: sourceCard ? [...nextDiscard, sourceCard] : nextDiscard,
      hand: prompt.sourceHandIndex !== null ? state.hand.filter((_, index) => index !== prompt.sourceHandIndex) : state.hand,
      selectedHandIndex: null,
    };

    if (selectedCards.length === 0) {
      setBattleState(prompt.playerId, () => nextState);
      setBattleEffectPrompt(null);
      const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}を使いましたが、対象カードはありませんでした。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return;
    }

    const splitHandCount = prompt.action.splitDestination?.hand || 0;
    const splitAttachCount = prompt.action.splitDestination?.attachEnergy || 0;
    if (prompt.action.splitDestination && splitAttachCount > 0) {
      const handCards = selectedCards.slice(0, splitHandCount);
      const attachCards = selectedCards.slice(splitHandCount, splitHandCount + splitAttachCount);
      nextState = { ...nextState, hand: [...nextState.hand, ...handCards] };
      setBattleState(prompt.playerId, () => nextState);
      setBattleEffectPrompt({
        kind: "attach_energy_target",
        playerId: prompt.playerId,
        sourceHandIndex: null,
        sourceCard: prompt.sourceCard,
        action: prompt.action,
        attachCards,
        handCards,
        restPile,
        discardCards,
        attachTarget: undefined,
      });
      setBattleNotice(`${attachCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。`);
      return;
    }

    if (prompt.action.destination === "bench") {
      const emptyBenchIndexes = nextState.benchStacks.map((stack, index) => ({ stack, index })).filter(({ stack }) => stack.length === 0).map(({ index }) => index);
      if (emptyBenchIndexes.length < selectedCards.length) {
        setBattleNotice("ベンチの空きが足りません。");
        return;
      }
      nextState = {
        ...nextState,
        benchStacks: nextState.benchStacks.map((stack, index) => {
          const selectedIndex = emptyBenchIndexes.indexOf(index);
          return selectedIndex >= 0 && selectedCards[selectedIndex] ? [{ ...selectedCards[selectedIndex], playedTurn: battleTurn }] : stack;
        }),
      };
    } else if (prompt.action.destination === "stadium") {
      const [stadiumCard] = selectedCards;
      if (stadiumCard) {
        if (battleStadiumCard) nextState = { ...nextState, discard: [...nextState.discard, battleStadiumCard] };
        setBattleStadiumCard(stadiumCard);
      }
    } else if (prompt.action.destination === "attach_energy") {
      setBattleState(prompt.playerId, () => nextState);
      setBattleEffectPrompt({
        kind: "attach_energy_target",
        playerId: prompt.playerId,
        sourceHandIndex: null,
        sourceCard: prompt.sourceCard,
        action: prompt.action,
        attachCards: selectedCards,
        handCards: [],
        restPile,
        discardCards,
        attachTarget: undefined,
      });
      setBattleNotice(`${selectedCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。`);
      return;
    } else {
      nextState = { ...nextState, hand: [...nextState.hand, ...selectedCards] };
    }

    setBattleState(prompt.playerId, () => nextState);
    setBattleEffectPrompt(null);
    const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚選び、山札をシャッフルしました。`;
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
  };

  const toggleBattleEffectDiscardSelection = (discardIndex: number) => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "recover_from_trash") return;
    setBattleEffectPrompt({
      ...prompt,
      selectedDiscardIndexes: prompt.selectedDiscardIndexes.includes(discardIndex)
        ? prompt.selectedDiscardIndexes.filter((index) => index !== discardIndex)
        : [...prompt.selectedDiscardIndexes, discardIndex].slice(0, prompt.action.count),
    });
  };

  const confirmBattleEffectRecoverTrash = () => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "recover_from_trash") return;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const availableCandidateIndexes = state.discard
      .map((card, discardIndex) => ({ card, discardIndex }))
      .filter(({ card }) => matchesSearchTarget(card, prompt.action.target))
      .map(({ discardIndex }) => discardIndex);
    if (prompt.selectedDiscardIndexes.length === 0 && availableCandidateIndexes.length > 0) {
      setBattleNotice("トラッシュから加えるカードを選んでください。");
      return;
    }
    const selectedIndexes = new Set(prompt.selectedDiscardIndexes);
    const selectedCards = prompt.selectedDiscardIndexes.map((index) => state.discard[index]).filter((card): card is SoloCard => Boolean(card));
    const sourceCard = prompt.sourceHandIndex !== null ? state.hand[prompt.sourceHandIndex] : null;
    const nextState = {
      ...state,
      hand: prompt.sourceHandIndex !== null ? state.hand.filter((_, index) => index !== prompt.sourceHandIndex) : state.hand,
      discard: [
        ...state.discard.filter((_, index) => !selectedIndexes.has(index)),
        ...(sourceCard ? [sourceCard] : []),
      ],
      selectedHandIndex: null,
    };
    if (selectedCards.length === 0) {
      setBattleState(prompt.playerId, () => nextState);
      setBattleEffectPrompt(null);
      const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}を使いましたが、トラッシュに対象カードはありませんでした。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return;
    }
    if (prompt.action.destination === "attach_energy") {
      setBattleState(prompt.playerId, () => nextState);
      setBattleEffectPrompt({
        kind: "attach_energy_target",
        playerId: prompt.playerId,
        sourceHandIndex: null,
        sourceCard: prompt.sourceCard,
        action: prompt.action,
        attachCards: selectedCards,
        handCards: [],
        restDiscard: nextState.discard,
        attachTarget: "attachTarget" in prompt.action ? prompt.action.attachTarget : undefined,
      });
      setBattleNotice(`${selectedCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。`);
      return;
    }
    setBattleState(prompt.playerId, () => ({ ...nextState, hand: [...nextState.hand, ...selectedCards] }));
    setBattleEffectPrompt(null);
    const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果でトラッシュから${selectedCards.length}枚手札に加えました。`;
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
  };

  const confirmBattleAttachEnergyTarget = (location: "active" | "bench", benchIndex?: number) => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "attach_energy_target") return;
    setBattleState(prompt.playerId, (state) => {
      const hasTarget = location === "active" ? state.activeStack.length > 0 : Boolean(state.benchStacks[benchIndex ?? 0]?.length);
      if (!hasTarget) {
        setBattleNotice("エネルギーをつけるポケモンがいません。");
        return state;
      }
      if (prompt.attachTarget?.location === "bench" && location !== "bench") {
        setBattleNotice("この効果ではベンチポケモンを選んでください。");
        return state;
      }
      if (location === "bench" && prompt.attachTarget?.cardNameIncludes) {
        const targetTop = state.benchStacks[benchIndex ?? 0]?.[state.benchStacks[benchIndex ?? 0].length - 1];
        if (!String(targetTop?.cardName || "").includes(prompt.attachTarget.cardNameIncludes)) {
          setBattleNotice(`この効果ではベンチの${prompt.attachTarget.cardNameIncludes}ポケモンを選んでください。`);
          return state;
        }
      }
      const nextEnergies =
        location === "active"
          ? { ...state.attachedEnergies, active: [...state.attachedEnergies.active, ...prompt.attachCards] }
          : {
              ...state.attachedEnergies,
              bench: state.attachedEnergies.bench.map((energies, index) =>
                index === (benchIndex ?? 0) ? [...energies, ...prompt.attachCards] : energies
              ),
            };
      const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果で${prompt.attachCards.length}枚のエネルギーをつけました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return { ...state, attachedEnergies: nextEnergies, selectedHandIndex: null };
    });
    setBattleEffectPrompt(null);
  };

  const confirmBattleSwitchActive = () => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "switch_active" || prompt.selectedBenchIndex === null) return;
    setBattleState(prompt.playerId, (state) => {
      const benchStack = state.benchStacks[prompt.selectedBenchIndex || 0] || [];
      if (state.activeStack.length === 0 || benchStack.length === 0) {
        setBattleNotice("入れ替え先のポケモンがいません。");
        return state;
      }
      const sourceCard = prompt.sourceHandIndex !== null ? state.hand[prompt.sourceHandIndex] : null;
      const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果でバトル場とベンチを入れ替えました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return {
        ...state,
        hand: prompt.sourceHandIndex !== null ? state.hand.filter((_, index) => index !== prompt.sourceHandIndex) : state.hand,
        discard: sourceCard ? [...state.discard, sourceCard] : state.discard,
        activeStack: benchStack,
        benchStacks: state.benchStacks.map((stack, index) => (index === prompt.selectedBenchIndex ? state.activeStack : stack)),
        damage: {
          active: state.damage.bench[prompt.selectedBenchIndex || 0] || 0,
          bench: state.damage.bench.map((damage, index) => (index === prompt.selectedBenchIndex ? state.damage.active : damage)),
        },
        selectedHandIndex: null,
      };
    });
    setBattleEffectPrompt(null);
  };

  const confirmBattlePromoteActive = () => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "promote_active" || prompt.selectedBenchIndex === null) return;
    setBattleState(prompt.playerId, (state) => {
      const benchStack = state.benchStacks[prompt.selectedBenchIndex || 0] || [];
      if (state.activeStack.length > 0 || benchStack.length === 0) {
        setBattleNotice("バトル場に出すベンチポケモンを選んでください。");
        return state;
      }
      const nextState = promoteBattleBenchToActive(state, prompt.selectedBenchIndex || 0);
      const promotedCard = nextState.activeStack[nextState.activeStack.length - 1];
      const notice = `${state.label}は${promotedCard?.cardName || "ベンチポケモン"}をバトル場に出しました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return { ...nextState, selectedHandIndex: null };
    });
    setBattleEffectPrompt(null);
  };

  const toggleBattlePrizeSelection = (prizeIndex: number) => {
    const prompt = battlePrizePrompt;
    if (!prompt) return;
    setBattlePrizePrompt({
      ...prompt,
      selectedPrizeIndexes: prompt.selectedPrizeIndexes.includes(prizeIndex)
        ? prompt.selectedPrizeIndexes.filter((index) => index !== prizeIndex)
        : prompt.selectedPrizeIndexes.length < prompt.maxCount
          ? [...prompt.selectedPrizeIndexes, prizeIndex]
          : prompt.selectedPrizeIndexes,
    });
  };

  const confirmBattlePrizeSelection = () => {
    const prompt = battlePrizePrompt;
    if (!prompt || prompt.selectedPrizeIndexes.length === 0) return;
    if (battleResult) return;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const selectedIndexSet = new Set(prompt.selectedPrizeIndexes);
    const selectedCards = state.prizes.filter((_, index) => selectedIndexSet.has(index));
    if (selectedCards.length === 0) return;
    const nextPrizes = state.prizes.filter((_, index) => !selectedIndexSet.has(index));
    const notice = `${state.label}はサイドを${selectedCards.length}枚取りました。`;
    setBattleState(prompt.playerId, () => ({
      ...state,
      prizes: nextPrizes,
      hand: [...state.hand, ...selectedCards],
      selectedHandIndex: null,
    }));
    setBattlePrizePrompt(null);
    setBattleNotice(notice);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
    if (nextPrizes.length === 0) {
      finishBattle(prompt.playerId === "player" ? "win" : "loss", prompt.playerId === "player" ? "自分のサイドを取り切りました。" : "AI側がサイドを取り切りました。", notice);
      return;
    }
    if (prompt.pendingPromotionPlayerId) {
      setBattleEffectPrompt({ kind: "promote_active", playerId: prompt.pendingPromotionPlayerId, selectedBenchIndex: null });
    }
  };

  const confirmBattleBoardPokemonEffect = (location: "active" | "bench", benchIndex?: number) => {
    const prompt = battleEffectPrompt;
    if (!prompt || prompt.kind !== "select_board_pokemon") return;
    setBattleState(prompt.playerId, (state) => {
      const targetStack = location === "active" ? state.activeStack : state.benchStacks[benchIndex ?? 0] || [];
      if (targetStack.length === 0) {
        setBattleNotice("対象にできるポケモンがいません。");
        return state;
      }
      const sourceCard = prompt.sourceHandIndex !== null ? state.hand[prompt.sourceHandIndex] : null;
      const targetLabel = location === "active" ? "バトル場" : `ベンチ${(benchIndex ?? 0) + 1}`;

      if (prompt.action.type === "discard_tool") {
        const attachedTool = location === "active" ? state.attachedTools.active : state.attachedTools.bench[benchIndex ?? 0];
        if (!attachedTool) {
          setBattleNotice("そのポケモンにトラッシュできるどうぐがありません。");
          return state;
        }
        const nextTools =
          location === "active"
            ? { ...state.attachedTools, active: null }
            : {
                ...state.attachedTools,
                bench: state.attachedTools.bench.map((tool, index) => (index === (benchIndex ?? 0) ? null : tool)),
              };
        const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果で${targetLabel}のどうぐをトラッシュしました。`;
        setBattleNotice(notice);
        setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
        return {
          ...state,
          hand: prompt.sourceHandIndex !== null ? state.hand.filter((_, index) => index !== prompt.sourceHandIndex) : state.hand,
          discard: [...state.discard, ...(sourceCard ? [sourceCard] : []), attachedTool],
          attachedTools: nextTools,
          selectedHandIndex: null,
        };
      }

      const notice = `${prompt.sourceCard.cardName || "トレーナーズ"}の効果で${targetLabel}の${targetStack[targetStack.length - 1]?.cardName || "ポケモン"}を回復しました。`;
      setBattleNotice(notice);
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      return {
        ...state,
        hand: prompt.sourceHandIndex !== null ? state.hand.filter((_, index) => index !== prompt.sourceHandIndex) : state.hand,
        discard: sourceCard ? [...state.discard, sourceCard] : state.discard,
        damage:
          location === "active"
            ? { ...state.damage, active: 0 }
            : { ...state.damage, bench: state.damage.bench.map((damage, index) => (index === (benchIndex ?? 0) ? 0 : damage)) },
        selectedHandIndex: null,
      };
    });
    setBattleEffectPrompt(null);
  };

  const toggleBattleRevealHand = (playerId: BattlePlayerId) => {
    setBattleState(playerId, (state) => ({ ...state, revealHand: !state.revealHand }));
  };

  const placeSelectedBattleHandCard = (playerId: BattlePlayerId, location: "active" | "bench", benchIndex?: number) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけ場に出せます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中は下の準備ボタンでたねポケモンだけ出してください。");
      return;
    }
    setBattleAiSuggestions([]);

    setBattleState(playerId, (state) => {
      const handIndex = state.selectedHandIndex;
      const selected = handIndex !== null ? state.hand[handIndex] : null;
      if (!selected) {
        setBattleBoardSelection({ playerId, location, benchIndex });
        return state;
      }
      if (!hasBattleDrawnForTurn(state)) {
        setBattleNotice("このターンのドローをしてから手札を操作してください。");
        return state;
      }

      const placementType = getCardPlacementType(selected);
      const stageOrder = getStageOrder(selected);
      const nextHand = state.hand.filter((_, index) => index !== handIndex);

      if (placementType === "energy") {
        if (state.energyAttachedTurn === battleTurn) {
          setBattleNotice(`${state.label}はこのターンすでにエネルギーをつけています。`);
          return state;
        }
        const targetIndex = benchIndex ?? 0;
        const hasTarget = location === "active" ? state.activeStack.length > 0 : Boolean(state.benchStacks[targetIndex]?.length);
        if (!hasTarget) {
          setBattleNotice("エネルギーをつけるポケモンがいません。");
          return state;
        }
        const nextEnergies =
          location === "active"
            ? { ...state.attachedEnergies, active: [...state.attachedEnergies.active, selected] }
            : {
                ...state.attachedEnergies,
                bench: state.attachedEnergies.bench.map((energies, index) =>
                  index === targetIndex ? [...energies, selected] : energies
                ),
              };
        const targetLabel = location === "active" ? "バトル場" : `ベンチ${targetIndex + 1}`;
        setBattleNotice(`${state.label}が${selected.cardName || "エネルギー"}を${targetLabel}のポケモンにつけました。`);
        return { ...state, hand: nextHand, attachedEnergies: nextEnergies, selectedHandIndex: null, energyAttachedTurn: battleTurn };
      }

      if (placementType === "stadium") {
        setBattleStadiumCard(selected);
        setBattleNotice(`${state.label}が${selected.cardName || "スタジアム"}をスタジアムに出しました。`);
        return { ...state, hand: nextHand, discard: battleStadiumCard ? [...state.discard, battleStadiumCard] : state.discard, selectedHandIndex: null };
      }

      if (location === "active") {
        if (placementType !== "pokemon" || stageOrder === null) {
          setBattleNotice("ポケモンカードだけがバトル場に置けます。");
          return state;
        }
        if (state.activeStack.length > 0) {
          if (!canEvolveBattleStack(state.activeStack, selected, battleTurn)) {
            setBattleNotice("そのポケモンにはこの進化カードを重ねられません。進化段階と同じターンに出していないかを確認してください。");
            return state;
          }
          setBattleNotice(`${state.label}が${selected.cardName || "ポケモン"}へ進化しました。`);
          return { ...state, hand: nextHand, activeStack: [...state.activeStack, { ...selected, playedTurn: battleTurn }], selectedHandIndex: null };
        }
        if (stageOrder !== 0) {
          setBattleNotice("バトル場の空枠にはたねポケモンだけ置けます。");
          return state;
        }
        setBattleNotice(`${state.label}が${selected.cardName || "ポケモン"}をバトル場に出しました。`);
        return { ...state, hand: nextHand, activeStack: [{ ...selected, playedTurn: battleTurn }], damage: { ...state.damage, active: 0 }, selectedHandIndex: null };
      }

      const targetIndex = benchIndex ?? 0;
      const targetStack = state.benchStacks[targetIndex] || [];
      if (placementType !== "pokemon" || stageOrder === null) {
        setBattleNotice("ポケモンカードだけがベンチに置けます。");
        return state;
      }
      if (targetStack.length > 0 && !canEvolveBattleStack(targetStack, selected, battleTurn)) {
        setBattleNotice("そのポケモンにはこの進化カードを重ねられません。進化段階と同じターンに出していないかを確認してください。");
        return state;
      }
      if (targetStack.length === 0 && stageOrder !== 0) {
        setBattleNotice("空いているベンチにはたねポケモンだけ置けます。");
        return state;
      }
      const nextBenchStacks = state.benchStacks.map((stack, index) =>
        index === targetIndex ? [...stack, { ...selected, playedTurn: battleTurn }] : stack
      );
      setBattleNotice(
        targetStack.length > 0
          ? `${state.label}がベンチ${targetIndex + 1}の${selected.cardName || "ポケモン"}へ進化しました。`
          : `${state.label}が${selected.cardName || "ポケモン"}をベンチ${targetIndex + 1}に出しました。`
      );
      return {
        ...state,
        hand: nextHand,
        benchStacks: nextBenchStacks,
        damage: targetStack.length > 0
          ? state.damage
          : { ...state.damage, bench: state.damage.bench.map((damage, index) => (index === targetIndex ? 0 : damage)) },
        selectedHandIndex: null,
      };
    });
    setBattleBoardSelection(null);
  };

  const attachSelectedBattleEnergy = (playerId: BattlePlayerId, location: "active" | "bench", benchIndex?: number) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) return;
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中はエネルギーをつけられません。");
      return;
    }
    if (requireBattleDrawBeforeHandAction(playerId)) return;
    setBattleAiSuggestions([]);
    setBattleState(playerId, (state) => {
      const handIndex = state.selectedHandIndex;
      const selected = handIndex !== null ? state.hand[handIndex] : null;
      if (!selected || getCardPlacementType(selected) !== "energy") {
        setBattleNotice("エネルギーを選択してください。");
        return state;
      }
      if (state.energyAttachedTurn === battleTurn) {
        setBattleNotice(`${state.label}はこのターンすでにエネルギーをつけています。`);
        return state;
      }
      const hasTarget = location === "active" ? state.activeStack.length > 0 : Boolean(state.benchStacks[benchIndex ?? 0]?.length);
      if (!hasTarget) {
        setBattleNotice("エネルギーをつけるポケモンがいません。");
        return state;
      }
      const nextHand = state.hand.filter((_, index) => index !== handIndex);
      const nextEnergies =
        location === "active"
          ? { ...state.attachedEnergies, active: [...state.attachedEnergies.active, selected] }
          : {
              ...state.attachedEnergies,
              bench: state.attachedEnergies.bench.map((energies, index) =>
                index === (benchIndex ?? 0) ? [...energies, selected] : energies
              ),
            };
      setBattleNotice(`${state.label}が${selected.cardName || "エネルギー"}をつけました。`);
      return { ...state, hand: nextHand, attachedEnergies: nextEnergies, selectedHandIndex: null, energyAttachedTurn: battleTurn };
    });
  };

  const openBattleAttackPrompt = (playerId: BattlePlayerId) => {
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけアタックできます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中はアタックできません。");
      return;
    }
    if (isBattleFirstTurnPlayer(playerId)) {
      setBattleNotice("先攻最初の番はアタックできません。");
      return;
    }
    if (playerId === "player" && battlePlayer.manualDrawTurn !== battleTurn) {
      setBattleNotice("アタックする前に1枚ドローしてください。");
      return;
    }
    const state = playerId === "player" ? battlePlayer : battleOpponent;
    const activeCard = state.activeStack[state.activeStack.length - 1];
    if (!activeCard) {
      setBattleNotice("バトル場にポケモンがいません。");
      return;
    }
    if (!activeCard.attacks?.length) {
      setBattleNotice(`${activeCard.cardName || "このポケモン"}に確認できるアタックがありません。`);
      return;
    }
    setBattleAiSuggestions([]);
    setBattleEffectPrompt(null);
    setBattleAttackPrompt({ playerId, selectedAttackIndex: null, selectedCopiedAttackKey: null });
  };

  const executeBattleAttack = (playerId: BattlePlayerId, selectedAttackIndex: number, selectedCopiedAttackKey: string | null) => {
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted || battleCurrentPlayer !== playerId) {
      setBattleNotice("現在の番のプレイヤーだけアタックできます。");
      return;
    }
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中はアタックできません。");
      return;
    }
    if (isBattleFirstTurnPlayer(playerId)) {
      setBattleNotice("先攻最初の番はアタックできません。");
      return;
    }
    if (playerId === "player" && battlePlayer.manualDrawTurn !== battleTurn) {
      setBattleNotice("アタックする前に1枚ドローしてください。");
      return;
    }
    const attacker = playerId === "player" ? battlePlayer : battleOpponent;
    const defenderId: BattlePlayerId = playerId === "player" ? "opponent" : "player";
    const defender = defenderId === "player" ? battlePlayer : battleOpponent;
    const attackingCard = attacker.activeStack[attacker.activeStack.length - 1];
    const defendingCard = defender.activeStack[defender.activeStack.length - 1];
    const attack = attackingCard?.attacks?.[selectedAttackIndex];

    if (!attackingCard || !attack) {
      setBattleNotice("使うアタックが見つかりません。");
      return;
    }
    if (!defendingCard) {
      setBattleNotice("相手のバトル場にポケモンがいません。");
      return;
    }
    const resolvedAttack = resolveBattleAttack(attack, attacker, defender, selectedCopiedAttackKey);
    if (!resolvedAttack) {
      setBattleNotice("このワザで使うコピー先のワザを選んでください。");
      return;
    }
    const energyStatus = getBattleAttackEnergyStatus(attack, attacker.attachedEnergies.active);
    if (!energyStatus.usable) {
      const missingParts = [
        ...energyStatus.missingSpecific,
        energyStatus.missingColorless > 0 ? `無${Math.max(0, energyStatus.requirement.colorless - energyStatus.missingColorless)}/${energyStatus.requirement.colorless}` : "",
      ].filter(Boolean);
      setBattleNotice(
        `必要エネルギーが足りません。必要: ${formatAttackEnergyRequirement(attack)} / 現在: ${formatAttachedEnergySummary(
          attacker.attachedEnergies.active
        )}${missingParts.length ? ` / 不足: ${missingParts.join("、")}` : ""}`
      );
      return;
    }

    const damage = getBattleAttackDamageValue(resolvedAttack.effectiveAttack, attacker, defender);
    const benchDamage = getBattleAttackBenchDamage(resolvedAttack.effectiveAttack);
    const discardedActiveEnergies = shouldDiscardAllActiveEnergiesAfterAttack(resolvedAttack.effectiveAttack) ? attacker.attachedEnergies.active : [];
    const nextDamage = defender.damage.active + damage;
    const defendingHp = Number(defendingCard.hp || 0);
    const isDefendingActiveKnockedOut = defendingHp > 0 && nextDamage >= defendingHp;
    const knockedOutBenchIndexes =
      benchDamage > 0
        ? defender.benchStacks
            .map((stack, index) => {
              const topCard = stack[stack.length - 1];
              const hp = Number(topCard?.hp || 0);
              const nextBenchDamage = (defender.damage.bench[index] || 0) + (stack.length > 0 ? benchDamage : 0);
              return topCard && hp > 0 && nextBenchDamage >= hp ? index : -1;
            })
            .filter((index) => index >= 0)
        : [];
    const knockedOutBenchSet = new Set(knockedOutBenchIndexes);
    const knockedOutBenchPokemon = knockedOutBenchIndexes
      .map((index) => defender.benchStacks[index]?.[defender.benchStacks[index].length - 1])
      .filter((card): card is SoloCard => Boolean(card));
    const knockedOutPokemon = [...(isDefendingActiveKnockedOut ? [defendingCard] : []), ...knockedOutBenchPokemon];
    const prizeSummaries = getBattlePrizeSummariesForKnockouts(knockedOutPokemon);
    const totalPrizeCount = prizeSummaries.reduce((sum, summary) => sum + summary.prizeCount, 0);
    const remainingDefenderBenchStacks = defender.benchStacks.map((stack, index) => (knockedOutBenchSet.has(index) ? [] : stack));
    const defenderPromotionBenchIndex = isDefendingActiveKnockedOut ? remainingDefenderBenchStacks.findIndex((stack) => stack.length > 0) : -1;
    const needsDefenderPromotion = defenderPromotionBenchIndex >= 0;
    const defenderHasNoPokemonAfterAttack = isDefendingActiveKnockedOut && remainingDefenderBenchStacks.every((stack) => stack.length === 0);
    const autoPromotedCard =
      defenderId === "opponent" && needsDefenderPromotion
        ? remainingDefenderBenchStacks[defenderPromotionBenchIndex]?.[remainingDefenderBenchStacks[defenderPromotionBenchIndex].length - 1]
        : null;
    const knockoutNote = isDefendingActiveKnockedOut
      ? ` ${defendingCard.cardName || "バトルポケモン"}はきぜつし、ついているカードごとトラッシュしました。`
      : "";
    const benchKnockoutNote =
      knockedOutBenchPokemon.length > 0
        ? ` ベンチの${knockedOutBenchPokemon.map((card) => card.cardName || "ポケモン").join("、")}もきぜつし、ついているカードごとトラッシュしました。`
        : "";
    const prizeNote = totalPrizeCount > 0 ? ` ${attacker.label}はサイドを${Math.min(totalPrizeCount, attacker.prizes.length)}枚まで取れます。` : "";
    const copiedNote =
      resolvedAttack.copiedFromCard && resolvedAttack.copiedFromAttack
        ? `で、${resolvedAttack.copiedFromCard.cardName || "コピー元"}の「${resolvedAttack.copiedFromAttack.name || "ワザ"}」をこのワザとして使い`
        : "を使い";
    const benchDamageNote = benchDamage > 0 ? ` 相手のベンチ全員にも${benchDamage}ダメージ。` : "";
    const discardEnergyNote = discardedActiveEnergies.length > 0 ? ` ${attacker.label}のバトルポケモンのエネルギーを${discardedActiveEnergies.length}枚トラッシュ。` : "";
    const promotionNote = isDefendingActiveKnockedOut
      ? needsDefenderPromotion
        ? defenderId === "opponent"
          ? ` ${defender.label}は${autoPromotedCard?.cardName || "ベンチポケモン"}をバトル場に出しました。`
          : ` ${defender.label}はベンチポケモンを1体バトル場に出してください。`
        : ` ${defender.label}のベンチに出せるポケモンがいません。`
      : "";
    const unresolvedTextNote = getManualBattleAttackEffectNote(resolvedAttack.effectiveAttack);
    const notice = `${attacker.label}の${attackingCard.cardName || "ポケモン"}が「${attack.name || "アタック"}」${copiedNote}、${defendingCard.cardName || "相手ポケモン"}に${damage}ダメージ。${knockoutNote}${benchKnockoutNote}${promotionNote}${benchDamageNote}${discardEnergyNote}${unresolvedTextNote}${prizeNote}`;
    const turnEndNotice = `${attacker.label}はアタック後に番を終了しました。`;
    const nextPlayer: BattlePlayerId = playerId === "player" ? "opponent" : "player";
    const nextTurn = battleTurn + 1;

    setBattleState(defenderId, (state) => {
      const damagedState = {
        ...state,
        damage: {
          ...state.damage,
          active: nextDamage,
          bench: benchDamage > 0 ? state.damage.bench.map((current, index) => (state.benchStacks[index]?.length ? current + benchDamage : current)) : state.damage.bench,
        },
      };
      const { nextState } = applyBattleActiveKnockout(damagedState, nextDamage);
      const { nextState: stateAfterBenchKnockouts } = applyBattleBenchKnockouts(nextState, knockedOutBenchIndexes);
      const promotedState =
        defenderId === "opponent" && needsDefenderPromotion
          ? promoteBattleBenchToActive(stateAfterBenchKnockouts, defenderPromotionBenchIndex)
          : stateAfterBenchKnockouts;
      return { ...promotedState, selectedHandIndex: null };
    });
    setBattleState(playerId, (state) => ({
      ...state,
      discard: discardedActiveEnergies.length > 0 ? [...state.discard, ...discardedActiveEnergies] : state.discard,
      attachedEnergies:
        discardedActiveEnergies.length > 0
          ? { ...state.attachedEnergies, active: [] }
          : state.attachedEnergies,
      selectedHandIndex: null,
    }));
    setBattleAttackPrompt(null);
    if (defenderHasNoPokemonAfterAttack) {
      setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`]);
      finishBattle(
        playerId === "player" ? "win" : "loss",
        defenderId === "opponent" ? "AI側のポケモンが全て倒されました。" : "ユーザー側のポケモンが全て倒されました。",
        notice
      );
      return;
    }
    const maxPrizeCount = Math.min(totalPrizeCount, attacker.prizes.length);
    const pendingPromotionPlayerId = defenderId === "player" && needsDefenderPromotion ? defenderId : null;
    setBattleEffectPrompt(maxPrizeCount === 0 && pendingPromotionPlayerId ? { kind: "promote_active", playerId: pendingPromotionPlayerId, selectedBenchIndex: null } : null);
    setBattlePrizePrompt(
      maxPrizeCount > 0
        ? {
            playerId,
            maxCount: maxPrizeCount,
            selectedPrizeIndexes: [],
            knockedOutSummaries: prizeSummaries,
            pendingPromotionPlayerId,
          }
        : null
    );
    setBattleBoardSelection(null);
    setBattleAiSuggestions([]);
    setBattleCurrentPlayer(nextPlayer);
    setBattleTurn(nextTurn);
    setBattleNotice(`${notice} ${turnEndNotice} ${getBattlePlayerLabel(nextPlayer)}の番です。`);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${notice}`, `T${battleTurn}: ${turnEndNotice}`, `T${nextTurn}: ${getBattlePlayerLabel(nextPlayer)}の番`]);
  };

  const confirmBattleAttack = () => {
    const prompt = battleAttackPrompt;
    if (!prompt || prompt.selectedAttackIndex === null) return;
    executeBattleAttack(prompt.playerId, prompt.selectedAttackIndex, prompt.selectedCopiedAttackKey);
  };

  const endBattleTurn = () => {
    if (battleResult) {
      setBattleNotice(battleResult.message);
      return;
    }
    if (!battleStarted) return;
    if (isBattleSetupActive) {
      setBattleNotice("開始準備中は番終了できません。自分のたねポケモンをバトル場に出してゲームを開始してください。");
      return;
    }
    if (battleCurrentPlayer === "player" && battlePlayer.manualDrawTurn !== battleTurn) {
      setBattleNotice("番終了する前に1枚ドローしてください。");
      return;
    }
    const nextPlayer: BattlePlayerId = battleCurrentPlayer === "player" ? "opponent" : "player";
    const nextTurn = battleTurn + 1;
    clearBattleSelection();
    setBattleAiSuggestions([]);
    setBattleCurrentPlayer(nextPlayer);
    setBattleTurn(nextTurn);
    setBattleNotice(`${getBattlePlayerLabel(nextPlayer)}の番です。`);
    setBattleLog((prev) => [...prev, `T${battleTurn}: ${currentBattleLabel}が番を終了`, `T${nextTurn}: ${getBattlePlayerLabel(nextPlayer)}の番`]);
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
    setSoloBoardSelection(null);
    setSoloBoardActionPrompt(null);
    setSoloNotice("");
    setSoloTurn(1);
    setSoloStarted(true);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
    setSoloManualDrawTurn(null);
    setSoloUsedAbilityKeys([]);
    setSoloTrashOpen(false);
    setSoloOpeningRedrawCount(0);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
  };

  const shuffleHandIntoDeckAndDraw = (redrawCount = soloHand.length) => {
    if (soloActiveStack.length > 0) {
      setSoloNotice("バトル場にポケモンを出した後は、手札の引き直しはできません。");
      return;
    }
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
    setSoloBoardSelection(null);
    setSoloBoardActionPrompt(null);
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
    setSoloBoardSelection(null);
    setSoloBoardActionPrompt(null);
    setSoloNotice("一人回しをリセットしました。");
    setSoloStartingPlayer("first");
    setSoloTurn(1);
    setSoloStarted(false);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
    setSoloTrashOpen(false);
    setSoloOpeningRedrawCount(0);
    setSoloManualDrawTurn(null);
    setSoloUsedAbilityKeys([]);
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

  const drawSoloForTurn = () => {
    if (soloManualDrawTurn === soloTurn) {
      setSoloNotice("このターンの通常ドローは完了しています。");
      return;
    }
    if (soloPile.length === 0) {
      setSoloNotice("山札から引けるカードがありません。");
      return;
    }
    drawSolo(1);
    setSoloManualDrawTurn(soloTurn);
  };

  const clearSoloBoardSelection = () => {
    setSoloBoardSelection(null);
    setSoloBoardActionPrompt(null);
  };

  const selectSoloHandCard = (index: number) => {
    if (index < 0 || index >= soloHand.length) return;
    const nextCard = soloHand[index];
    const isRareCandy = isRareCandyCard(nextCard);
    clearSoloBoardSelection();
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
      setSoloNotice("たねポケモンです。空いているバトル場かベンチを選んでください。");
    } else if (stageOrder > 0) {
      setSoloNotice(`${stageOrder}進化ポケモンです。1つ前の進化段階が置かれた枠を選んでください。`);
    } else {
      setSoloNotice("カード詳細を取得できませんでした。ポケモンのみ配置できます。");
    }
  };

  const cancelSoloCardSelection = () => {
    setSoloSelectedHandIndex(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloNotice("");
  };

  const selectSoloActivePokemon = () => {
    if (soloActiveStack.length === 0) {
      setSoloNotice("バトル場にポケモンがいません。");
      return;
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloBoardSelection({ location: "active" });
    setSoloBoardActionPrompt(null);
    setSoloNotice("");
  };

  const selectSoloBenchPokemon = (benchIndex: number) => {
    const stack = soloBenchStacks[benchIndex] || [];
    if (stack.length === 0) {
      setSoloNotice("そのベンチにポケモンがいません。");
      return;
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloBoardSelection({ location: "bench", benchIndex });
    setSoloBoardActionPrompt(null);
    setSoloNotice("");
  };

  const handleActiveZoneClick = () => {
    if (soloSelectedHandIndex !== null) {
      placeSelectedCard("active");
      return;
    }
    selectSoloActivePokemon();
  };

  const handleBenchZoneClick = (benchIndex: number) => {
    if (soloSelectedHandIndex !== null) {
      placeSelectedCard(benchIndex);
      return;
    }
    selectSoloBenchPokemon(benchIndex);
  };

  const handleStadiumZoneClick = () => {
    if (soloSelectedHandIndex !== null) {
      placeSelectedCard("stadium");
      return;
    }
    if (!soloStadiumCard) {
      setSoloNotice("スタジアムが場にありません。");
      return;
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloRareCandyMode("idle");
    setSoloRareCandyTarget(null);
    setSoloRareCandyCandidates([]);
    setSoloBoardSelection({ location: "stadium" });
    setSoloBoardActionPrompt(null);
    setSoloNotice("");
  };

  const getSelectedBoardAbilityKey = (abilityIndex: number, abilityName?: string) => {
    if (!selectedSoloBoardCard) return "";
    const instanceKey =
      selectedSoloBoardCard.soloInstanceId ||
      `${selectedSoloBoardCard.cardId}:${selectedSoloBoardCard.playedTurn ?? "unknown"}`;
    return `${soloTurn}:${instanceKey}:${abilityName || "特性"}:${abilityIndex}`;
  };

  const getSelectedStadiumEffectKey = () => {
    if (!soloStadiumCard) return "";
    const instanceKey = soloStadiumCard.soloInstanceId || soloStadiumCard.cardId;
    return `${soloTurn}:stadium:${instanceKey}:effect`;
  };

  const hasPokemonNamedOnBoard = (pokemonName: string) => {
    const normalized = normalizePokemonNameCore(pokemonName);
    const boardCards = [
      soloActiveStack[soloActiveStack.length - 1],
      ...soloBenchStacks.map((stack) => stack[stack.length - 1]),
    ].filter((card): card is SoloCard => Boolean(card));
    return boardCards.some((card) => normalizePokemonNameCore(card.cardName).includes(normalized));
  };

  const validateSelectedAbilityConditions = (ability: SoloAbility) => {
    const text = ability.text || "";
    const boardCard = selectedSoloBoardCard;
    if (!boardCard || !soloBoardSelection) return "選択中のポケモンが見つかりませんでした。";
    if (text.includes("このカードを手札からベンチに出したとき")) {
      if (soloBoardSelection.location !== "bench" || boardCard.playedTurn !== soloTurn) {
        return "この特性は、このカードを手札からベンチに出した番だけ使えます。";
      }
    }
    if (text.includes("このカードを手札から出して進化させたとき")) {
      const stack =
        soloBoardSelection.location === "active"
          ? soloActiveStack
          : soloBenchStacks[soloBoardSelection.benchIndex || 0] || [];
      if (stack.length < 2 || boardCard.playedTurn !== soloTurn) {
        return "この特性は、このカードを手札から出して進化させた番だけ使えます。";
      }
    }
    const requiresActive =
      text.includes("このポケモンがバトル場にいるなら") ||
      text.includes("このポケモンがバトル場にいて");
    if (requiresActive && soloBoardSelection.location !== "active") {
      return "この特性は、このポケモンがバトル場にいるときだけ使えます。";
    }
    const requiredBoardPokemon = text.match(/自分の場に「([^」]+)」がいて/)?.[1];
    if (requiredBoardPokemon && !hasPokemonNamedOnBoard(requiredBoardPokemon)) {
      return `この特性は、自分の場に「${requiredBoardPokemon}」がいるときだけ使えます。`;
    }
    if (text.includes("この特性は別の") && soloUsedAbilityKeys.some((key) => key.includes(`:${ability.name || "特性"}:`))) {
      return `この番は別の「${ability.name || "特性"}」をすでに使っています。`;
    }
    return "";
  };

  const activateSelectedBoardAbility = (abilityIndex: number) => {
    const boardCard = selectedSoloBoardCard;
    const abilities = boardCard?.abilities || [];
    if (abilities.length === 0) {
      setSoloNotice(`${boardCard?.cardName || "このポケモン"}に確認できる特性はありません。`);
      return;
    }
    const ability = abilities[abilityIndex];
    if (!ability) {
      setSoloNotice("使う特性が見つかりませんでした。");
      return;
    }
    const abilityKey = getSelectedBoardAbilityKey(abilityIndex, ability.name);
    if (abilityKey && soloUsedAbilityKeys.includes(abilityKey)) {
      setSoloNotice(`${ability.name || "この特性"}はこのターンすでに使っています。`);
      return;
    }
    if (!boardCard) {
      setSoloNotice("選択中のポケモンが見つかりませんでした。");
      return;
    }
    const conditionError = validateSelectedAbilityConditions(ability);
    if (conditionError) {
      setSoloNotice(conditionError);
      return;
    }
    const profile = getAbilityEffectProfile(boardCard, ability);
    const firstAction = profile?.actions[0];
    const firstCost = profile?.costs?.[0];
    if (!profile || !firstAction) {
      setSoloNotice(`${ability.name || "特性"}の効果を判定できませんでした。`);
      return;
    }

    const markAbilityUsed = () => {
      if (abilityKey) {
        setSoloUsedAbilityKeys((keys) => (keys.includes(abilityKey) ? keys : [...keys, abilityKey]));
      }
    };

    if (firstCost?.type === "discard_from_hand") {
      const availableCostCards = soloHand.filter((card) => matchesHandDiscardCost(card, firstCost.target, firstCost.cardName)).length;
      if (availableCostCards < firstCost.count) {
        setSoloNotice(
          `${ability.name || "この特性"}のコストが足りません。${getHandDiscardCostLabel(firstCost.target, firstCost.cardName)}`
        );
        return;
      }
      setSoloEffectPrompt({
        kind: "discard_from_hand",
        sourceHandIndex: null,
        sourceCard: boardCard,
        nextAction: firstAction,
        count: firstCost.count,
        costTarget: firstCost.target,
        costCardName: firstCost.cardName,
        abilityKeyToMark: abilityKey,
        selectedHandIndexes: [],
      });
      pushSoloHistory();
      setSoloBoardSelection(null);
      setSoloBoardActionPrompt(null);
      setSoloNotice(`${ability.name || "特性"}のコストとして手札を${firstCost.count}枚選んでください。`);
      return;
    }

    if (firstAction.type === "draw_cards") {
      pushSoloHistory();
      markAbilityUsed();
      executeDrawCardsAction(null, boardCard, firstAction);
      setSoloNotice(`${boardCard.cardName || "ポケモン"}の特性「${ability.name || "特性"}」で${getDrawActionCount(firstAction)}枚引きました。`);
      return;
    }

    if (firstAction.type === "search_deck") {
      if (openSearchDeckPrompt(null, boardCard, firstAction)) {
        pushSoloHistory();
        markAbilityUsed();
        setSoloBoardSelection(null);
        setSoloBoardActionPrompt(null);
      }
      return;
    }

    if (
      firstAction.type === "switch_active" &&
      soloBoardSelection?.location === "bench" &&
      soloBoardSelection.benchIndex !== undefined
    ) {
      pushSoloHistory();
      markAbilityUsed();
      switchActiveWithBench(soloBoardSelection.benchIndex, boardCard);
      setSoloNotice(`${boardCard.cardName || "ポケモン"}の特性「${ability.name || "特性"}」でバトル場と入れ替えました。`);
      return;
    }

    if (firstAction.type === "switch_active") {
      if (openSwitchActivePrompt(null, boardCard)) {
        pushSoloHistory();
        markAbilityUsed();
        setSoloBoardSelection(null);
        setSoloBoardActionPrompt(null);
      }
      return;
    }

    pushSoloHistory();
    markAbilityUsed();
    setSoloNotice(`${boardCard.cardName || "ポケモン"}の特性「${ability.name || "特性"}」を使いました。手動で効果を解決してください。${ability.text || ""}`);
  };

  const activateSelectedStadiumEffect = () => {
    if (!soloStadiumCard) {
      setSoloNotice("スタジアムが場にありません。");
      return;
    }
    const profile = getEffectProfile(soloStadiumCard);
    const firstAction = profile?.actions[0];
    const firstCost = profile?.costs?.[0];
    if (!profile || !firstAction) {
      setSoloNotice(`${soloStadiumCard.cardName || "スタジアム"}の効果を判定できませんでした。`);
      return;
    }

    const stadiumKey = getSelectedStadiumEffectKey();
    if (stadiumKey && soloUsedAbilityKeys.includes(stadiumKey)) {
      setSoloNotice(`${soloStadiumCard.cardName || "このスタジアム"}の効果はこのターンすでに使っています。`);
      return;
    }
    const markStadiumUsed = () => {
      if (stadiumKey) {
        setSoloUsedAbilityKeys((keys) => (keys.includes(stadiumKey) ? keys : [...keys, stadiumKey]));
      }
    };

    if (firstCost?.type === "discard_from_hand") {
      const availableCostCards = soloHand.filter((card) => matchesHandDiscardCost(card, firstCost.target, firstCost.cardName)).length;
      if (availableCostCards < firstCost.count) {
        setSoloNotice(`${soloStadiumCard.cardName || "このスタジアム"}のコストが足りません。${getHandDiscardCostLabel(firstCost.target, firstCost.cardName)}`);
        return;
      }
      setSoloEffectPrompt({
        kind: "discard_from_hand",
        sourceHandIndex: null,
        sourceCard: soloStadiumCard,
        nextAction: firstAction,
        count: firstCost.count,
        costTarget: firstCost.target,
        costCardName: firstCost.cardName,
        abilityKeyToMark: stadiumKey,
        selectedHandIndexes: [],
      });
      pushSoloHistory();
      setSoloBoardSelection(null);
      setSoloBoardActionPrompt(null);
      setSoloNotice(`${soloStadiumCard.cardName || "スタジアム"}のコストとして手札を${firstCost.count}枚選んでください。`);
      return;
    }

    if (firstAction.type === "draw_cards") {
      pushSoloHistory();
      markStadiumUsed();
      executeDrawCardsAction(null, soloStadiumCard, firstAction);
      setSoloNotice(`${soloStadiumCard.cardName || "スタジアム"}の効果で${getDrawActionCount(firstAction)}枚引きました。`);
      return;
    }

    if (firstAction.type === "draw_until_board_count") {
      pushSoloHistory();
      markStadiumUsed();
      const drawnCount = drawUntilBoardPokemonCount(soloHand);
      setSoloBoardSelection(null);
      setSoloNotice(`${soloStadiumCard.cardName || "スタジアム"}の効果で、場のポケモンの数に合わせて${drawnCount}枚引きました。`);
      return;
    }

    if (firstAction.type === "search_deck") {
      if (openSearchDeckPrompt(null, soloStadiumCard, firstAction)) {
        pushSoloHistory();
        markStadiumUsed();
        setSoloBoardSelection(null);
        setSoloBoardActionPrompt(null);
      }
      return;
    }

    if (firstAction.type === "recover_from_trash") {
      if (openRecoverTrashPrompt(null, soloStadiumCard, firstAction)) {
        pushSoloHistory();
        markStadiumUsed();
        setSoloBoardSelection(null);
        setSoloBoardActionPrompt(null);
      }
      return;
    }

    if (firstAction.type === "switch_active") {
      if (openSwitchActivePrompt(null, soloStadiumCard)) {
        pushSoloHistory();
        markStadiumUsed();
        setSoloBoardSelection(null);
        setSoloBoardActionPrompt(null);
      }
      return;
    }

    pushSoloHistory();
    markStadiumUsed();
    setSoloNotice(`${soloStadiumCard.cardName || "スタジアム"}の効果を確認しました。手動で効果を解決してください。${profile.label}`);
  };

  const showActiveAttacks = () => {
    const attacks = selectedSoloBoardCard?.attacks || [];
    if (attacks.length === 0) {
      setSoloNotice(`${selectedSoloBoardCard?.cardName || "このポケモン"}に確認できるワザはありません。`);
      return;
    }
    setSoloNotice(
      attacks
        .map((attack) => {
          const cost = attack.cost?.length ? `[${attack.cost.join("")}] ` : "";
          const damage = attack.damage ? ` ${attack.damage}` : "";
          return `${cost}${attack.name || "ワザ"}${damage}${attack.text ? `: ${attack.text}` : ""}`;
        })
        .join(" / ")
    );
  };

  const openRetreatPrompt = () => {
    if (soloActiveStack.length === 0) {
      setSoloNotice("バトル場にポケモンがいません。");
      return;
    }
    if (!soloBenchStacks.some((stack) => stack.length > 0)) {
      setSoloNotice("逃げ先のベンチポケモンがいません。");
      return;
    }
    setSoloBoardActionPrompt({
      kind: "retreat",
      selectedBenchIndex: null,
      selectedEnergyIndexes: [],
      noRetreatEnergy: false,
    });
    setSoloNotice("トラッシュするエネルギー、または逃げエネなしを選んでください。");
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
    setSoloSelectedHandIndex(null);
    setSoloNotice("");
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
      setSoloNotice("たねポケモンだけが空の枠に置けます。");
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

  const getDrawActionCount = (action: Extract<EffectAction, { type: "draw_cards" }>) => {
    if (action.countWhenPrizeCount && soloPrizes.length === action.countWhenPrizeCount.prizeCount) {
      return action.countWhenPrizeCount.count;
    }
    return action.count;
  };

  const executeDrawCardsAction = (
    sourceHandIndex: number | null,
    sourceCard: SoloCard,
    action: Extract<EffectAction, { type: "draw_cards" }>
  ) => {
    const drawCount = getDrawActionCount(action);
    const source = sourceHandIndex !== null ? soloHand[sourceHandIndex] || sourceCard : null;
    const remainingHand = sourceHandIndex !== null ? soloHand.filter((_, index) => index !== sourceHandIndex) : soloHand;

    if (action.shuffleRemainingHandIntoDeck) {
      const randomized = takeRandomCards([...soloPile, ...remainingHand], drawCount);
      setSoloPile(randomized.rest);
      setSoloHand(randomized.drawn);
      if (source) {
        setSoloDiscard((discard) => [...discard, source]);
      }
      setSoloSelectedHandIndex(null);
      setSoloNotice(
        `${sourceCard.cardName || "トレーナーズ"}の効果で手札を山札にもどして切り、${drawCount}枚引きました。`
      );
      return;
    }

    const randomized = takeRandomCards(soloPile, drawCount);
    setSoloPile(randomized.rest);
    setSoloHand(action.discardRemainingHand ? randomized.drawn : [...remainingHand, ...randomized.drawn]);
    setSoloDiscard((discard) => [
      ...discard,
      ...(source ? [source] : []),
      ...(action.discardRemainingHand ? remainingHand : []),
    ]);
    setSoloSelectedHandIndex(null);
    setSoloNotice(`${sourceCard.cardName || "トレーナーズ"}の効果で${drawCount}枚引きました。`);
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
      .filter((card) => matchesSearchActionTarget(card, action));
    const missingRequirement = action.selectionRequirements?.find((requirement) => (
      candidates.filter((card) => matchesSearchFilter(card, requirement)).length < requirement.count
    ));
    if (missingRequirement) {
      setSoloNotice(`山札に対象の${getSearchRequirementLabel(missingRequirement)}が足りません。`);
      return false;
    }
    if (candidates.length === 0) {
      const targetLabel = getSearchActionLabel(action);
      setSoloNotice(
        action.look
          ? `確認した${action.look.count}枚に対象の${targetLabel}が見つかりません。`
          : `山札に対象の${targetLabel}が見つかりません。`
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
    const targetLabel = getSearchActionLabel(action);
    setSoloNotice(
      action.look
        ? `${action.look.from === "bottom" ? "山札の下" : "山札の上"}から${action.look.count}枚を確認し、${getSearchActionInstruction(action)}`
        : action.splitDestination
          ? `山札から${targetLabel}を${action.count}枚まで選んでください。1枚目を手札に加え、2枚目を場のポケモンにつけます。`
          : `山札から${getSearchActionInstruction(action)}`
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
        costTarget: firstCost.target,
        costCardName: firstCost.cardName,
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
      executeDrawCardsAction(sourceHandIndex, sourceCard, firstAction);
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

  const matchesHandDiscardCost = (card: SoloCard, target?: SearchTarget, cardName?: string) => {
    if (cardName && !String(card.cardName || "").includes(cardName)) return false;
    if (target && !matchesSearchTarget(card, target)) return false;
    return true;
  };

  const getHandDiscardCostLabel = (target?: SearchTarget, cardName?: string) => {
    if (cardName) return `コストとして「${cardName}」を選んでください。`;
    if (target) return `コストとして${getSearchTargetLabel(target)}を選んでください。`;
    return "コストとして手札を選んでください。";
  };

  const toggleEffectHandSelection = (handIndex: number) => {
    setSoloEffectPrompt((prompt) => {
      if (!prompt || prompt.kind !== "discard_from_hand" || handIndex === prompt.sourceHandIndex) return prompt;
      const nextCard = soloHand[handIndex];
      if (nextCard && !matchesHandDiscardCost(nextCard, prompt.costTarget, prompt.costCardName)) {
        setSoloNotice(getHandDiscardCostLabel(prompt.costTarget, prompt.costCardName));
        return prompt;
      }
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
    const invalidCostCard = soloEffectPrompt.selectedHandIndexes
      .map((index) => soloHand[index])
      .find((card) => card && !matchesHandDiscardCost(card, soloEffectPrompt.costTarget, soloEffectPrompt.costCardName));
    if (invalidCostCard) {
      setSoloNotice(getHandDiscardCostLabel(soloEffectPrompt.costTarget, soloEffectPrompt.costCardName));
      return;
    }

    const discardIndexes = new Set([
      ...(soloEffectPrompt.sourceHandIndex !== null ? [soloEffectPrompt.sourceHandIndex] : []),
      ...soloEffectPrompt.selectedHandIndexes,
    ]);
    const discardedCards = soloHand.filter((_, index) => discardIndexes.has(index));
    setSoloHand((hand) => hand.filter((_, index) => !discardIndexes.has(index)));
    setSoloDiscard((discard) => [...discard, ...discardedCards]);
    setSoloSelectedHandIndex(null);
    if (soloEffectPrompt.abilityKeyToMark) {
      setSoloUsedAbilityKeys((keys) =>
        keys.includes(soloEffectPrompt.abilityKeyToMark || "") ? keys : [...keys, soloEffectPrompt.abilityKeyToMark || ""]
      );
    }

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
      const drawCount = getDrawActionCount(soloEffectPrompt.nextAction);
      drawCardsToHand(drawCount);
      setSoloEffectPrompt(null);
      setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${drawCount}枚引きました。`);
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
      if (prompt.selectedPileIndexes.includes(pileIndex)) {
        return {
          ...prompt,
          selectedPileIndexes: prompt.selectedPileIndexes.filter((index) => index !== pileIndex),
        };
      }

      if (prompt.action.distinctBasicEnergyTypes) {
        const nextCardType = getBasicEnergyType(soloPile[pileIndex]);
        const selectedTypes = prompt.selectedPileIndexes
          .map((index) => getBasicEnergyType(soloPile[index]))
          .filter(Boolean);
        if (nextCardType && selectedTypes.includes(nextCardType)) {
          setSoloNotice("アカマツでは、それぞれ違うタイプの基本エネルギーを選んでください。");
          return prompt;
        }
      }

      const selectedCards = prompt.selectedPileIndexes
        .map((index) => soloPile[index])
        .filter((card): card is SoloCard => Boolean(card));
      const nextCard = soloPile[pileIndex];
      if (nextCard && !canAddSearchSelection(selectedCards, nextCard, prompt.action)) {
        setSoloNotice(`この効果では${getSearchActionLabel(prompt.action)}を選んでください。`);
        return prompt;
      }

      const selected =
        [...prompt.selectedPileIndexes, pileIndex].slice(0, prompt.action.count);
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
    const selectedCards = soloEffectPrompt.selectedPileIndexes
      .map((index) => soloPile[index])
      .filter((card): card is SoloCard => Boolean(card));
    const requirementError = validateSearchSelectionRequirements(selectedCards, soloEffectPrompt.action);
    if (requirementError) {
      setSoloNotice(requirementError);
      return;
    }
    const visibleIndexes = new Set(soloEffectPrompt.visiblePileIndexes || soloPile.map((_, index) => index));
    const unselectedVisibleCards = soloPile.filter((_, index) => visibleIndexes.has(index) && !selectedIndexes.has(index));
    const restPile = soloPile
      .map((card, pileIndex) => ({ card, pileIndex }))
      .filter(({ pileIndex }) => !selectedIndexes.has(pileIndex))
      .filter(({ pileIndex }) => soloEffectPrompt.action.remainingDestination !== "discard" || !visibleIndexes.has(pileIndex))
      .map(({ card }) => card)
      .sort(() => Math.random() - 0.5);
    const discardCards = soloEffectPrompt.action.remainingDestination === "discard" ? unselectedVisibleCards : [];

    if (soloEffectPrompt.action.splitDestination) {
      const handCount = Math.max(0, soloEffectPrompt.action.splitDestination.hand || 0);
      const attachCount = Math.max(0, soloEffectPrompt.action.splitDestination.attachEnergy || 0);
      const handCards = selectedCards.slice(0, handCount);
      const attachCards = selectedCards.slice(handCount, handCount + attachCount);

      if (attachCards.length > 0) {
        if (soloActiveStack.length === 0 && !soloBenchStacks.some((stack) => stack.length > 0)) {
          setSoloNotice("エネルギーをつけるポケモンが場にいません。");
          return;
        }
        setSoloEffectPrompt({
          kind: "attach_energy_target",
          sourceHandIndex: soloEffectPrompt.sourceHandIndex,
          sourceCard: soloEffectPrompt.sourceCard,
          action: soloEffectPrompt.action,
          attachCards,
          handCards,
          restPile,
          discardCards,
        });
        setSoloNotice(`${attachCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。`);
        return;
      }

      if (handCards.length > 0) {
        setSoloHand((hand) => [...hand, ...handCards]);
      }
    } else if (soloEffectPrompt.action.destination === "bench") {
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
      if (soloActiveStack.length === 0 && !soloBenchStacks.some((stack) => stack.length > 0)) {
        setSoloNotice("エネルギーをつけるポケモンが場にいません。");
        return;
      }
      setSoloEffectPrompt({
        kind: "attach_energy_target",
        sourceHandIndex: soloEffectPrompt.sourceHandIndex,
        sourceCard: soloEffectPrompt.sourceCard,
        action: soloEffectPrompt.action,
        attachCards: selectedCards,
        handCards: [],
        restPile,
        discardCards,
      });
      setSoloNotice(`${selectedCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。`);
      return;
    } else {
      setSoloHand((hand) => [...hand, ...selectedCards]);
    }

    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      setSoloDiscard((discard) => [
        ...discard,
        source,
        ...discardCards,
      ]);
    } else if (discardCards.length > 0) {
      setSoloDiscard((discard) => [...discard, ...discardCards]);
    }
    setSoloPile(restPile);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(
      soloEffectPrompt.action.splitDestination
        ? `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚を選び、手札とエネルギー加速に分けて処理しました。`
        : soloEffectPrompt.action.destination === "attach_energy"
        ? `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚を場のポケモンにつけ、山札をシャッフルしました。`
        : `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${selectedCards.length}枚選び、山札をシャッフルしました。`
    );
  };

  const confirmAttachEnergyTarget = (location: "active" | "bench", benchIndex?: number) => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "attach_energy_target") return;
    if (soloEffectPrompt.attachTarget?.location === "bench" && location !== "bench") {
      setSoloNotice("この効果ではベンチポケモンを選んでください。");
      return;
    }
    if (location === "active" && soloActiveStack.length === 0) {
      setSoloNotice("バトル場にポケモンがいません。");
      return;
    }
    if (location === "bench" && (benchIndex === undefined || soloBenchStacks[benchIndex]?.length === 0)) {
      setSoloNotice("選んだベンチにポケモンがいません。");
      return;
    }
    if (location === "bench" && soloEffectPrompt.attachTarget?.cardNameIncludes) {
      const targetTop = soloBenchStacks[benchIndex || 0]?.[soloBenchStacks[benchIndex || 0].length - 1];
      if (!String(targetTop?.cardName || "").includes(soloEffectPrompt.attachTarget.cardNameIncludes)) {
        setSoloNotice(`この効果ではベンチの${soloEffectPrompt.attachTarget.cardNameIncludes}ポケモンを選んでください。`);
        return;
      }
    }

    if (location === "active") {
      setSoloAttachedEnergies((energies) => ({
        ...energies,
        active: [...energies.active, ...soloEffectPrompt.attachCards],
      }));
    } else {
      setSoloAttachedEnergies((energies) => ({
        ...energies,
        bench: energies.bench.map((attached, index) =>
          index === benchIndex ? [...attached, ...soloEffectPrompt.attachCards] : attached
        ),
      }));
    }

    setSoloHand((hand) => {
      const withoutSource =
        soloEffectPrompt.sourceHandIndex !== null
          ? hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex)
          : hand;
      return soloEffectPrompt.handCards.length > 0 ? [...withoutSource, ...soloEffectPrompt.handCards] : withoutSource;
    });
    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloDiscard((discard) => [
        ...discard,
        source,
        ...soloEffectPrompt.discardCards,
      ]);
    } else if (soloEffectPrompt.discardCards.length > 0) {
      setSoloDiscard((discard) => [...discard, ...soloEffectPrompt.discardCards]);
    }
    if (soloEffectPrompt.discardSourceIndexes?.length) {
      const discardSourceIndexes = new Set(soloEffectPrompt.discardSourceIndexes);
      setSoloDiscard((discard) => discard.filter((_, index) => !discardSourceIndexes.has(index)));
    }
    setSoloPile(soloEffectPrompt.restPile);
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    const targetName =
      location === "active"
        ? soloActiveStack[soloActiveStack.length - 1]?.cardName || "バトル場"
        : soloBenchStacks[benchIndex || 0]?.[soloBenchStacks[benchIndex || 0].length - 1]?.cardName || `ベンチ${(benchIndex || 0) + 1}`;
    setSoloNotice(
      `${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果で${soloEffectPrompt.attachCards.length}枚を${targetName}につけ、山札をシャッフルしました。`
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
    if (soloEffectPrompt.action.destination === "attach_energy") {
      const hasTargetBench = soloBenchStacks.some((stack) => {
        const top = stack[stack.length - 1];
        if (!top) return false;
        const requiredName = soloEffectPrompt.action.attachTarget?.cardNameIncludes;
        return !requiredName || String(top.cardName || "").includes(requiredName);
      });
      if (!hasTargetBench) {
        setSoloNotice(
          soloEffectPrompt.action.attachTarget?.cardNameIncludes
            ? `ベンチに${soloEffectPrompt.action.attachTarget.cardNameIncludes}ポケモンがいません。`
            : "エネルギーをつけるベンチポケモンがいません。"
        );
        return;
      }
      setSoloEffectPrompt({
        kind: "attach_energy_target",
        sourceHandIndex: soloEffectPrompt.sourceHandIndex,
        sourceCard: soloEffectPrompt.sourceCard,
        action: {
          type: "search_deck",
          target: soloEffectPrompt.action.target,
          count: soloEffectPrompt.action.count,
          destination: "attach_energy",
        },
        attachCards: selectedCards,
        handCards: [],
        restPile: soloPile,
        discardCards: [],
        discardSourceIndexes: soloEffectPrompt.selectedDiscardIndexes,
        attachTarget: soloEffectPrompt.action.attachTarget,
      });
      setSoloNotice(`${selectedCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるベンチポケモンを選んでください。`);
      return;
    }
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

  const switchActiveWithBench = (benchIndex: number, sourceCard?: SoloCard | null) => {
    const benchStack = soloBenchStacks[benchIndex];
    if (!benchStack || benchStack.length === 0 || soloActiveStack.length === 0) {
      setSoloNotice("入れ替え先が見つかりません。");
      return false;
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
    setSoloBoardSelection({ location: "active" });
    setSoloBoardActionPrompt(null);
    if (sourceCard) {
      setSoloNotice(`${sourceCard.cardName || "ポケモン"}の効果でバトル場とベンチ${benchIndex + 1}を入れ替えました。`);
    }
    return true;
  };

  const confirmEffectSwitchActive = (benchIndex: number) => {
    if (!soloEffectPrompt || soloEffectPrompt.kind !== "switch_active") return;
    if (!switchActiveWithBench(benchIndex)) {
      return;
    }

    if (soloEffectPrompt.sourceHandIndex !== null) {
      const source = soloHand[soloEffectPrompt.sourceHandIndex];
      setSoloHand((hand) => hand.filter((_, index) => index !== soloEffectPrompt.sourceHandIndex));
      setSoloDiscard((discard) => [...discard, source]);
    }
    setSoloSelectedHandIndex(null);
    setSoloEffectPrompt(null);
    setSoloNotice(`${soloEffectPrompt.sourceCard.cardName || "トレーナーズ"}の効果でバトル場とベンチ${benchIndex + 1}を入れ替えました。`);
  };

  const selectRetreatBench = (benchIndex: number) => {
    if (!soloBoardActionPrompt || soloBoardActionPrompt.kind !== "retreat") return;
    if (!soloBenchStacks[benchIndex]?.length) {
      setSoloNotice("逃げ先のベンチポケモンがいません。");
      return;
    }
    setSoloBoardActionPrompt((prompt) => (
      prompt?.kind === "retreat" ? { ...prompt, selectedBenchIndex: benchIndex } : prompt
    ));
  };

  const toggleRetreatEnergy = (energyIndex: number) => {
    if (!soloBoardActionPrompt || soloBoardActionPrompt.kind !== "retreat") return;
    setSoloBoardActionPrompt((prompt) => {
      if (!prompt || prompt.kind !== "retreat") return prompt;
      return {
        ...prompt,
        noRetreatEnergy: false,
        selectedBenchIndex: null,
        selectedEnergyIndexes: prompt.selectedEnergyIndexes.includes(energyIndex)
          ? prompt.selectedEnergyIndexes.filter((index) => index !== energyIndex)
          : [...prompt.selectedEnergyIndexes, energyIndex],
      };
    });
  };

  const selectNoRetreatEnergy = () => {
    if (!soloBoardActionPrompt || soloBoardActionPrompt.kind !== "retreat") return;
    setSoloBoardActionPrompt((prompt) => (
      prompt?.kind === "retreat"
        ? {
            ...prompt,
            noRetreatEnergy: !prompt.noRetreatEnergy,
            selectedBenchIndex: null,
            selectedEnergyIndexes: [],
          }
        : prompt
    ));
  };

  const confirmRetreat = () => {
    if (!soloBoardActionPrompt || soloBoardActionPrompt.kind !== "retreat") return;
    const hasRetreatEnergySelection =
      soloBoardActionPrompt.noRetreatEnergy || soloBoardActionPrompt.selectedEnergyIndexes.length > 0;
    if (!hasRetreatEnergySelection) {
      setSoloNotice("トラッシュするエネルギー、または逃げエネなしを選んでください。");
      return;
    }
    const benchIndex = soloBoardActionPrompt.selectedBenchIndex;
    if (benchIndex === null || benchIndex === undefined) {
      setSoloNotice("逃げ先のベンチポケモンを選んでください。");
      return;
    }
    const benchStack = soloBenchStacks[benchIndex];
    if (!benchStack?.length || soloActiveStack.length === 0) {
      setSoloNotice("逃げ先が見つかりません。");
      return;
    }

    const selectedEnergyIndexes = new Set(soloBoardActionPrompt.selectedEnergyIndexes);
    const discardedEnergies = soloAttachedEnergies.active.filter((_, index) => selectedEnergyIndexes.has(index));
    const remainingActiveEnergies = soloAttachedEnergies.active.filter((_, index) => !selectedEnergyIndexes.has(index));

    pushSoloHistory();
    setSoloBenchStacks((stacks) => stacks.map((stack, index) => (index === benchIndex ? soloActiveStack : stack)));
    setSoloActiveStack(benchStack);
    setSoloAttachedTools((tools) => {
      const nextBench = tools.bench.map((tool, index) => (index === benchIndex ? tools.active : tool));
      return { active: tools.bench[benchIndex], bench: nextBench };
    });
    setSoloAttachedEnergies((energies) => {
      const nextBench = energies.bench.map((attached, index) => (index === benchIndex ? remainingActiveEnergies : attached));
      return { active: energies.bench[benchIndex] || [], bench: nextBench };
    });
    if (discardedEnergies.length > 0) {
      setSoloDiscard((discard) => [...discard, ...discardedEnergies]);
    }
    setSoloBoardSelection(null);
    setSoloBoardActionPrompt(null);
    setSoloNotice(
      `${soloActiveStack[soloActiveStack.length - 1]?.cardName || "バトルポケモン"}が逃げました。${discardedEnergies.length}枚のエネルギーをトラッシュしました。`
    );
  };

  const cancelRetreat = () => {
    setSoloBoardActionPrompt(null);
    setSoloNotice("");
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
    setSoloSelectedHandIndex(null);
    setSoloNotice("");
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

  const openBattleTrash = (playerId: BattlePlayerId) => {
    setBattleTrashPlayerId(playerId);
  };

  const closeBattleTrash = () => {
    setBattleTrashPlayerId(null);
  };

  const nextSoloTurn = () => {
    pushSoloHistory();
    setSoloTurn((turn) => turn + 1);
    setSoloSupporterUsedTurn(null);
    setSoloEnergyAttachedTurn(null);
    setSoloManualDrawTurn(null);
    setSoloUsedAbilityKeys([]);
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

  const renderPokemonTextDetails = (card: SoloCard) => {
    const abilities = card.abilities || [];
    const attacks = card.attacks || [];
    const hasDetails = abilities.length > 0 || attacks.length > 0 || Boolean(card.ruleText);

    if (!hasDetails) {
      return (
        <div className="mt-3 rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-xs leading-5 text-emerald-50/75">
          確認できるカードテキストはありません。
        </div>
      );
    }

    return (
      <div className="mt-3 grid gap-2">
        {abilities.map((ability, abilityIndex) => (
          <div key={`${ability.name || "ability"}-${abilityIndex}`} className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
            <div className="text-[11px] font-black tracking-[0.12em] text-emerald-200">特性</div>
            <p className="mt-1 text-xs font-black text-emerald-50">{ability.name || "名称なし"}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-50/85">{ability.text || "テキストなし"}</p>
          </div>
        ))}
        {attacks.map((attack, attackIndex) => (
          <div key={`${attack.name || "attack"}-${attackIndex}`} className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black tracking-[0.12em] text-emerald-200">ワザ</div>
                <p className="mt-1 text-xs font-black text-emerald-50">{attack.name || "名称なし"}</p>
              </div>
              <div className="text-xs font-black text-emerald-50/90">
                {attack.damage ? `${attack.damage}ダメージ` : ""}
              </div>
            </div>
            {attack.cost?.length ? (
              <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">必要エネルギー: {attack.cost.join(" / ")}</p>
            ) : null}
            <p className="mt-1 text-xs leading-5 text-emerald-50/85">{attack.text || "テキストなし"}</p>
          </div>
        ))}
        {card.ruleText ? (
          <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
            <div className="text-[11px] font-black tracking-[0.12em] text-emerald-200">ルール</div>
            <p className="mt-1 text-xs leading-5 text-emerald-50/85">{card.ruleText}</p>
          </div>
        ) : null}
      </div>
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

  const renderBattleCardFace = (card: DeckCard, className = "h-[58px] w-[42px]") => {
    const cardLabel = card.cardName || card.cardId;
    if (card.illustration) {
      return (
        <span className={`block overflow-hidden rounded-md border border-slate-200 bg-white ${className}`}>
          <img src={card.illustration} alt={cardLabel} className="h-full w-full object-cover" />
        </span>
      );
    }
    return (
      <span className={`flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1 ${className}`}>
        <span className="line-clamp-3 text-center text-[9px] font-bold leading-tight text-slate-700">{cardLabel}</span>
      </span>
    );
  };

  const renderBattleCardBack = (className = "h-[64px] w-[46px]") => (
    <span className={`flex items-center justify-center rounded-md border border-slate-300 bg-slate-800 shadow-inner ${className}`}>
      <span className="h-8 w-6 rounded-sm border border-white/30 bg-slate-700" aria-hidden="true" />
    </span>
  );

  const renderBattleStack = (
    stack: SoloStack,
    attachedTool?: SoloCard | null,
    attachedEnergies: SoloCard[] = [],
    damage = 0,
    hidden = false
  ) => {
    const topCard = stack[stack.length - 1];
    if (!topCard) return null;
    const hp = Number(topCard.hp || 0);
    return (
      <div className="relative inline-flex">
        {hidden ? renderBattleCardBack() : renderBattleCardFace(topCard, "h-[64px] w-[46px]")}
        {!hidden && stack.length > 1 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-black text-white">+{stack.length - 1}</span>
        ) : null}
        {!hidden && attachedEnergies.length > 0 ? (
          <span className="absolute -bottom-1 -left-1 rounded-full bg-sky-700 px-1.5 py-0.5 text-[9px] font-black text-white">E{attachedEnergies.length}</span>
        ) : null}
        {!hidden && attachedTool ? (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white">道具</span>
        ) : null}
        {!hidden && damage > 0 ? (
          <span className="absolute left-1/2 top-1/2 min-w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-600 px-2 py-1 text-center text-[10px] font-black text-white shadow">
            {damage}
          </span>
        ) : null}
        {!hidden && hp > 0 ? (
          <span className="absolute -top-1 left-0 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-black text-slate-800 shadow-sm">
            HP{hp}
          </span>
        ) : null}
      </div>
    );
  };

  const renderBattlePlayerBoard = (state: BattlePlayerState, position: "top" | "bottom") => {
    const isCurrent = isBattleInProgress && battleCurrentPlayer === state.id;
    const selectedCard = state.selectedHandIndex !== null ? state.hand[state.selectedHandIndex] || null : null;
    const selectedBoardCard =
      battleBoardSelection?.playerId === state.id
        ? battleBoardSelection.location === "active"
          ? state.activeStack[state.activeStack.length - 1] || null
          : state.benchStacks[battleBoardSelection.benchIndex || 0]?.[state.benchStacks[battleBoardSelection.benchIndex || 0].length - 1] || null
        : null;
    const selectedBoardLabel =
      battleBoardSelection?.playerId === state.id
        ? battleBoardSelection.location === "active"
          ? "バトル場"
          : `ベンチ${(battleBoardSelection.benchIndex || 0) + 1}`
        : "";
    const selectedPlacement = selectedCard ? getCardPlacementType(selectedCard) : "unknown";
    const selectedBattleEffectProfile = selectedCard ? getEffectProfile(selectedCard) : null;
    const isSelectedBattleTrainer =
      selectedPlacement === "item" || selectedPlacement === "supporter" || selectedPlacement === "trainer";
    const canOperate = isCurrent;
    const canUseTurnActions = canOperate && !isBattleSetupActive;
    const canOperateHand = canOperate && hasBattleDrawnForTurn(state);
    const needsTurnDrawBeforeHand = canOperate && !isBattleSetupActive && !hasBattleDrawnForTurn(state);
    const isFirstTurnPlayer = isBattleFirstTurnPlayer(state.id);
    const isBattleSupporterLocked =
      selectedPlacement === "supporter" && (state.supporterUsedTurn === battleTurn || isFirstTurnPlayer);
    const selectedIsOpeningBasic = selectedPlacement === "pokemon" && getStageOrder(selectedCard || undefined) === 0;
    const firstEmptyOpeningBenchIndex = state.benchStacks.findIndex((stack) => stack.length === 0);
    const hideOpeningBoardCards = isBattleSetupActive && state.id === "opponent";
    const compactBoard = position === "top";
    const handVisible = state.revealHand;

    return (
      <div className={`min-h-0 rounded-[18px] border shadow-sm ${compactBoard ? "p-1.5" : "p-2"} ${isCurrent ? "border-sky-400 bg-sky-50/95" : "border-slate-200 bg-white/90"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isCurrent ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>
              {isCurrent ? "操作中" : "待機"}
            </span>
            <div>
              <div className="text-[9px] font-black tracking-[0.14em] text-slate-500">{position === "top" ? "OPPONENT" : "PLAYER"}</div>
              <h3 className="text-sm font-black leading-tight text-slate-950">{state.label}</h3>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => drawBattleCard(state.id)}
              disabled={!canUseTurnActions}
              className="inline-flex h-7 items-center justify-center rounded-full bg-slate-950 px-2.5 text-[10px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              ドロー
            </button>
            <button
              type="button"
              onClick={() => toggleBattleRevealHand(state.id)}
              className="inline-flex h-7 items-center justify-center rounded-full border border-slate-300 bg-white px-2.5 text-[10px] font-bold text-slate-800 transition hover:bg-slate-50"
            >
              手札{handVisible ? "閉" : "開"}
            </button>
          </div>
        </div>

        <div className={`grid min-h-0 lg:grid-cols-[86px_1fr_74px] ${compactBoard ? "mt-1.5 gap-1.5" : "mt-2 gap-2"}`}>
          <div className={`rounded-[14px] border border-slate-200 bg-white ${compactBoard ? "p-1.5" : "p-2"}`}>
            <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">サイド</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`${state.id}-battle-prize-${index}`}
                  className={`h-6 rounded border ${index < state.prizes.length ? "border-slate-300 bg-slate-800" : "border-slate-200 bg-slate-100"}`}
                />
              ))}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-600">残り {state.prizes.length}</div>
          </div>

          <div className={`grid min-h-0 lg:grid-cols-[130px_1fr] ${compactBoard ? "gap-1.5" : "gap-2"}`}>
            <button
              type="button"
              onClick={() => placeSelectedBattleHandCard(state.id, "active")}
              disabled={!canOperate}
              className={`${compactBoard ? "min-h-[78px] p-1.5" : "min-h-[94px] p-2"} rounded-[14px] border text-left transition ${
                battleBoardSelection?.playerId === state.id && battleBoardSelection.location === "active"
                  ? "border-sky-500 bg-sky-100"
                  : "border-slate-200 bg-white"
              } ${canOperate ? "hover:border-sky-300" : "cursor-not-allowed opacity-80"}`}
            >
              <div className="mb-1 text-[9px] font-black tracking-[0.12em] text-slate-500">バトル場</div>
              <div className={`${compactBoard ? "min-h-[58px]" : "min-h-[64px]"} flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50`}>
                {state.activeStack.length ? (
                  renderBattleStack(state.activeStack, state.attachedTools.active, state.attachedEnergies.active, state.damage.active, hideOpeningBoardCards)
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500">基本を置く</span>
                )}
              </div>
              {state.activeStack.length && canOperate ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openBattleAttackPrompt(state.id);
                  }}
                  disabled={isFirstTurnPlayer || isBattleSetupActive}
                  className="mt-1 inline-flex h-6 items-center justify-center rounded-full bg-rose-600 px-2 text-[10px] font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  アタック
                </button>
              ) : null}
              {!isBattleSetupActive && canOperateHand && selectedPlacement === "energy" && state.activeStack.length ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    attachSelectedBattleEnergy(state.id, "active");
                  }}
                  className="mt-1 inline-flex h-6 items-center justify-center rounded-full bg-sky-700 px-2 text-[10px] font-bold text-white"
                >
                  エネ
                </button>
              ) : null}
            </button>

            <div className={`rounded-[14px] border border-slate-200 bg-white ${compactBoard ? "p-1.5" : "p-2"}`}>
              <div className="mb-1 text-[9px] font-black tracking-[0.12em] text-slate-500">ベンチ</div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <button
                    key={`${state.id}-battle-bench-${index}`}
                    type="button"
                    onClick={() => placeSelectedBattleHandCard(state.id, "bench", index)}
                    disabled={!canOperate}
                    className={`${compactBoard ? "min-h-[58px]" : "min-h-[68px]"} rounded-xl border p-1 transition ${
                      battleBoardSelection?.playerId === state.id && battleBoardSelection.location === "bench" && battleBoardSelection.benchIndex === index
                        ? "border-sky-500 bg-sky-100"
                        : "border-slate-200 bg-slate-50"
                    } ${canOperate ? "hover:border-sky-300" : "cursor-not-allowed opacity-80"}`}
                  >
                    {state.benchStacks[index]?.length ? (
                      <div className="flex flex-col items-center gap-1">
                        {renderBattleStack(
                          state.benchStacks[index],
                          state.attachedTools.bench[index],
                          state.attachedEnergies.bench[index],
                          state.damage.bench[index] || 0,
                          hideOpeningBoardCards
                        )}
                        {!isBattleSetupActive && canOperateHand && selectedPlacement === "energy" ? (
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              attachSelectedBattleEnergy(state.id, "bench", index);
                            }}
                            className="inline-flex h-5 items-center justify-center rounded-full bg-sky-700 px-1.5 text-[9px] font-bold text-white"
                          >
                            エネ
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{index + 1}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`grid ${compactBoard ? "gap-1.5" : "gap-2"}`}>
            <div className={`rounded-[14px] border border-slate-200 bg-white ${compactBoard ? "p-1.5" : "p-2"}`}>
              <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">デッキ</div>
              <div className="text-xl font-black text-slate-950">{state.pile.length}</div>
            </div>
            <button
              type="button"
              onClick={() => openBattleTrash(state.id)}
              className={`rounded-[14px] border border-slate-200 bg-white text-left transition hover:border-sky-300 hover:bg-sky-50 ${compactBoard ? "p-1.5" : "p-2"}`}
              aria-label={`${state.label}のトラッシュを確認`}
            >
              <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">トラッシュ</div>
              <div className="text-xl font-black text-slate-950">{state.discard.length}</div>
            </button>
          </div>
        </div>

        <div className={`rounded-[14px] border border-slate-200 bg-white ${compactBoard ? "mt-1.5 p-1.5" : "mt-2 p-2"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">手札 {state.hand.length}枚</div>
            {selectedCard && isCurrent ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="max-w-[180px] truncate text-[10px] font-bold text-slate-700">{selectedCard.cardName || "カード"}</span>
                <button
                  type="button"
                  onClick={() => moveSelectedBattleHandToDiscard(state.id)}
                  disabled={isBattleSetupActive || !canOperateHand}
                  className="inline-flex h-6 items-center justify-center rounded-full border border-slate-300 px-2 text-[10px] font-bold text-slate-800"
                >
                  トラッシュ
                </button>
                <button
                  type="button"
                  onClick={clearBattleSelection}
                  className="inline-flex h-6 items-center justify-center rounded-full border border-slate-300 px-2 text-[10px] font-bold text-slate-800"
                >
                  キャンセル
                </button>
              </div>
            ) : null}
          </div>
          {isBattleSetupActive && state.id === "player" && isCurrent ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-black tracking-[0.12em] text-amber-700">開始準備</div>
                  <p className="mt-0.5 text-xs font-bold text-slate-800">
                    {battleSetupPhase === "player_active"
                      ? "初手からたねポケモンを選び、バトル場に出してください。"
                      : "必要ならベンチにたねポケモンを出し、準備できたらゲーム開始してください。"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {battleSetupPhase === "player_active" ? (
                    <button
                      type="button"
                      onClick={() => placeSelectedBattleOpeningBasic("active")}
                      disabled={!selectedIsOpeningBasic}
                      className="inline-flex h-8 items-center justify-center rounded-full bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      バトル場へ
                    </button>
                  ) : null}
                  {battleSetupPhase === "player_bench" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => placeSelectedBattleOpeningBasic("bench", firstEmptyOpeningBenchIndex)}
                        disabled={!selectedIsOpeningBasic || firstEmptyOpeningBenchIndex < 0}
                        className="inline-flex h-8 items-center justify-center rounded-full bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        ベンチへ
                      </button>
                      <button
                        type="button"
                        onClick={finishBattleOpeningSetup}
                        className="inline-flex h-8 items-center justify-center rounded-full bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-700"
                      >
                        ゲーム開始
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {needsTurnDrawBeforeHand ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              ドロー後に手札を操作できます。
            </div>
          ) : null}
          {selectedBoardCard && isCurrent && !isBattleSetupActive ? (
            <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-black tracking-[0.12em] text-violet-700">{selectedBoardLabel}</div>
                  <p className="mt-0.5 truncate text-xs font-black text-slate-950">{selectedBoardCard.cardName || "ポケモン"}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-600">
                    {(selectedBoardCard.abilities || []).length > 0 ? "特性を選んで使えます。" : "確認できる特性がありません。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearBattleSelection}
                  className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white px-2 text-[10px] font-bold text-slate-700"
                >
                  閉じる
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(selectedBoardCard.abilities || []).length > 0 ? (
                  (selectedBoardCard.abilities || []).map((ability, abilityIndex) => {
                    const abilityKey = getBattleBoardAbilityKey(state.id, selectedBoardCard, abilityIndex, ability.name);
                    const used = state.usedAbilityKeys.includes(abilityKey);
                    return (
                      <button
                        key={`${ability.name || "battle-ability"}-${abilityIndex}`}
                        type="button"
                        onClick={() => activateBattleBoardAbility(state.id, abilityIndex)}
                        disabled={used}
                        title={ability.text || "特性テキストなし"}
                        className="inline-flex h-8 items-center justify-center rounded-full bg-violet-700 px-3 text-xs font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {used ? "使用済み" : `${ability.name || "特性"}を使う`}
                      </button>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    onClick={() => setBattleNotice(`${selectedBoardCard.cardName || "このポケモン"}に確認できる特性はありません。`)}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-violet-200 bg-white px-3 text-xs font-bold text-slate-700"
                  >
                    特性
                  </button>
                )}
              </div>
            </div>
          ) : null}
          {selectedCard && isCurrent && !isBattleSetupActive && canOperateHand && isSelectedBattleTrainer ? (
            <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-black tracking-[0.12em] text-sky-700">効果使用</div>
                  <p className="mt-0.5 truncate text-xs font-black text-slate-950">{selectedCard.cardName || "トレーナーズ"}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-600">
                    {selectedBattleEffectProfile?.label || "未対応効果です。使った後、効果は手動で解決してください。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playSelectedBattleTrainerCard(state.id)}
                  disabled={isBattleSupporterLocked}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-sky-700 px-3 text-xs font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {selectedPlacement === "supporter" && isFirstTurnPlayer
                    ? "先攻不可"
                    : selectedPlacement === "supporter" && state.supporterUsedTurn === battleTurn
                      ? "使用済み"
                      : "使う"}
                </button>
              </div>
            </div>
          ) : null}
          <div className={`${compactBoard ? "min-h-[44px]" : "min-h-[60px]"} mt-1 flex gap-1.5 overflow-x-auto pb-1`}>
            {state.hand.length === 0 ? (
              <span className="text-sm text-slate-500">手札がありません。</span>
            ) : handVisible ? (
              state.hand.map((card, index) => (
                <button
                  key={`${state.id}-battle-hand-${card.soloInstanceId || card.cardId}-${index}`}
                  type="button"
                  onClick={() => selectBattleHandCard(state.id, index)}
                  disabled={!canOperateHand}
                  className={`shrink-0 rounded-md ${state.selectedHandIndex === index ? "outline outline-2 outline-offset-2 outline-amber-300" : ""} ${!canOperateHand ? "cursor-not-allowed opacity-55" : ""}`}
                >
                  {renderBattleCardFace(card, compactBoard ? "h-[46px] w-[33px]" : "h-[58px] w-[42px]")}
                </button>
              ))
            ) : (
              state.hand.map((card, index) => (
                <button
                  key={`${state.id}-battle-hidden-hand-${card.soloInstanceId || card.cardId}-${index}`}
                  type="button"
                  disabled
                  className={`${compactBoard ? "h-[46px] w-[33px]" : "h-[58px] w-[42px]"} shrink-0 rounded-md border border-slate-700 bg-slate-900 shadow-sm`}
                  aria-label="非公開の手札"
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const battleTrashState = battleTrashPlayerId === "player" ? battlePlayer : battleTrashPlayerId === "opponent" ? battleOpponent : null;

  const renderBattleEffectPrompt = () => {
    const prompt = battleEffectPrompt;
    if (!prompt) return null;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const effectPileCandidates =
      prompt.kind === "search_deck"
        ? (prompt.visiblePileIndexes || state.pile.map((_, index) => index))
            .map((pileIndex) => ({ card: state.pile[pileIndex], pileIndex }))
            .filter(({ card }) => Boolean(card))
            .filter(({ card }) => matchesSearchActionTarget(card, prompt.action))
        : [];
    const effectTrashCandidates =
      prompt.kind === "recover_from_trash"
        ? state.discard
            .map((card, discardIndex) => ({ card, discardIndex }))
            .filter(({ card }) => matchesSearchTarget(card, prompt.action.target))
        : [];

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
        <div className="max-h-[86dvh] w-full max-w-5xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-[0.16em] text-sky-700">
                {prompt.kind === "promote_active" ? "バトル場へ出す" : "効果処理"}
              </div>
              <h3 className="truncate text-base font-black text-slate-950">
                {prompt.kind === "promote_active" ? `${state.label}のベンチ` : prompt.sourceCard.cardName || "カード"}
              </h3>
            </div>
            {prompt.kind !== "promote_active" ? (
              <button
                type="button"
                onClick={cancelBattleEffectPrompt}
                className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                閉じる
              </button>
            ) : null}
          </div>

          <div className="max-h-[calc(86dvh-58px)] overflow-auto p-4">
            {prompt.kind === "discard_from_hand" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {prompt.costCardName
                    ? `コストとして「${prompt.costCardName}」を${prompt.count}枚選んでください。`
                    : prompt.costTarget
                      ? `コストとして${getSearchTargetLabel(prompt.costTarget)}を${prompt.count}枚選んでください。`
                      : `コストとして手札を${prompt.count}枚選んでください。`}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                  {state.hand.map((card, index) => {
                    const disabled = index === prompt.sourceHandIndex || !matchesHandDiscardCost(card, prompt.costTarget, prompt.costCardName);
                    const selected = prompt.selectedHandIndexes.includes(index);
                    return (
                      <button
                        key={`${card.soloInstanceId || card.cardId}-battle-cost-${index}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleBattleEffectHandSelection(index)}
                        className={`rounded-lg p-1 transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "bg-amber-200 outline outline-2 outline-amber-400" : "bg-slate-100 hover:bg-slate-200"}`}
                      >
                        {renderBattleCardFace(card, "h-[82px] w-[58px]")}
                        <span className="mt-1 block truncate text-[10px] font-bold text-slate-700">{card.cardName || "カード"}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={confirmBattleEffectDiscardCost}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  コストを確定
                </button>
              </div>
            ) : prompt.kind === "search_deck" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {getSearchActionInstruction(prompt.action)}
                  {prompt.action.splitDestination ? " 1枚目を手札に加え、2枚目を場のポケモンにつけます。" : ""}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                  {effectPileCandidates.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-600">候補がありません。</p>
                  ) : (
                    effectPileCandidates.map(({ card, pileIndex }) => {
                      const selected = prompt.selectedPileIndexes.includes(pileIndex);
                      return (
                        <button
                          key={`${card.cardId}-battle-search-${pileIndex}`}
                          type="button"
                          onClick={() => toggleBattleEffectPileSelection(pileIndex)}
                          className={`rounded-lg p-1 transition ${selected ? "bg-amber-200 outline outline-2 outline-amber-400" : "bg-slate-100 hover:bg-slate-200"}`}
                        >
                          {renderBattleCardFace(card, "h-[82px] w-[58px]")}
                          <span className="mt-1 block truncate text-[10px] font-bold text-slate-700">{card.cardName || "カード"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={confirmBattleEffectSearchDeck}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  {effectPileCandidates.length === 0 ? "効果を終了" : "選んだカードを処理"}
                </button>
              </div>
            ) : prompt.kind === "recover_from_trash" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  トラッシュから{getSearchTargetLabel(prompt.action.target)}を{prompt.action.count}枚まで選んでください。
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                  {effectTrashCandidates.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-600">候補がありません。</p>
                  ) : (
                    effectTrashCandidates.map(({ card, discardIndex }) => {
                      const selected = prompt.selectedDiscardIndexes.includes(discardIndex);
                      return (
                        <button
                          key={`${card.cardId}-battle-trash-${discardIndex}`}
                          type="button"
                          onClick={() => toggleBattleEffectDiscardSelection(discardIndex)}
                          className={`rounded-lg p-1 transition ${selected ? "bg-amber-200 outline outline-2 outline-amber-400" : "bg-slate-100 hover:bg-slate-200"}`}
                        >
                          {renderBattleCardFace(card, "h-[82px] w-[58px]")}
                          <span className="mt-1 block truncate text-[10px] font-bold text-slate-700">{card.cardName || "カード"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={confirmBattleEffectRecoverTrash}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  {effectTrashCandidates.length === 0 ? "効果を終了" : "選んだカードを処理"}
                </button>
              </div>
            ) : prompt.kind === "attach_energy_target" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {prompt.attachCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    disabled={state.activeStack.length === 0}
                    onClick={() => confirmBattleAttachEnergyTarget("active")}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <p className="text-xs font-black text-slate-500">バトル場</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{state.activeStack[state.activeStack.length - 1]?.cardName || "空き"}</p>
                  </button>
                  {state.benchStacks.map((stack, index) => (
                    <button
                      key={`battle-attach-bench-${index}`}
                      type="button"
                      disabled={stack.length === 0}
                      onClick={() => confirmBattleAttachEnergyTarget("bench", index)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <p className="text-xs font-black text-slate-500">ベンチ{index + 1}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{stack[stack.length - 1]?.cardName || "空き"}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : prompt.kind === "promote_active" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  バトル場のポケモンがきぜつしました。ベンチから1体を必ずバトル場に出してください。
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {state.benchStacks.map((stack, index) => (
                    <button
                      key={`battle-promote-bench-${index}`}
                      type="button"
                      disabled={stack.length === 0}
                      onClick={() => setBattleEffectPrompt({ ...prompt, selectedBenchIndex: index })}
                      className={`rounded-xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        prompt.selectedBenchIndex === index ? "border-amber-400 bg-amber-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-black text-slate-500">ベンチ{index + 1}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{stack[stack.length - 1]?.cardName || "空き"}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={confirmBattlePromoteActive}
                  disabled={prompt.selectedBenchIndex === null}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  バトル場に出す
                </button>
              </div>
            ) : prompt.kind === "switch_active" ? (
              <div>
                <p className="text-sm font-bold text-slate-800">入れ替え先のベンチポケモンを選んでください。</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {state.benchStacks.map((stack, index) => (
                    <button
                      key={`battle-switch-bench-${index}`}
                      type="button"
                      disabled={stack.length === 0}
                      onClick={() => setBattleEffectPrompt({ ...prompt, selectedBenchIndex: index })}
                      className={`rounded-xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        prompt.selectedBenchIndex === index ? "border-amber-400 bg-amber-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-black text-slate-500">ベンチ{index + 1}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{stack[stack.length - 1]?.cardName || "空き"}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={confirmBattleSwitchActive}
                  disabled={prompt.selectedBenchIndex === null}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  入れ替えを確定
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {prompt.action.type === "heal_pokemon" ? "回復するポケモンを選んでください。" : "どうぐをトラッシュするポケモンを選んでください。"}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    disabled={state.activeStack.length === 0 || (prompt.action.type === "discard_tool" && !state.attachedTools.active)}
                    onClick={() => confirmBattleBoardPokemonEffect("active")}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <p className="text-xs font-black text-slate-500">バトル場</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {state.activeStack[state.activeStack.length - 1]?.cardName || "空き"}
                      {prompt.action.type === "discard_tool" && state.attachedTools.active ? ` / ${state.attachedTools.active.cardName || "どうぐ"}` : ""}
                    </p>
                  </button>
                  {state.benchStacks.map((stack, index) => (
                    <button
                      key={`battle-board-effect-bench-${index}`}
                      type="button"
                      disabled={stack.length === 0 || (prompt.action.type === "discard_tool" && !state.attachedTools.bench[index])}
                      onClick={() => confirmBattleBoardPokemonEffect("bench", index)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <p className="text-xs font-black text-slate-500">ベンチ{index + 1}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {stack[stack.length - 1]?.cardName || "空き"}
                        {prompt.action.type === "discard_tool" && state.attachedTools.bench[index] ? ` / ${state.attachedTools.bench[index]?.cardName || "どうぐ"}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBattlePrizePrompt = () => {
    const prompt = battlePrizePrompt;
    if (!prompt) return null;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;

    return (
      <div className="fixed inset-0 z-[128] flex items-center justify-center bg-slate-950/55 p-4">
        <div className="max-h-[86dvh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-[10px] font-black tracking-[0.16em] text-amber-700">サイドを取る</div>
            <h3 className="mt-1 text-base font-black text-slate-950">{state.label}のサイド</h3>
            <p className="mt-1 text-xs font-bold text-slate-600">
              {prompt.knockedOutSummaries.map((summary) => `${summary.cardName}: ${summary.prizeCount}枚`).join(" / ")}
            </p>
          </div>
          <div className="max-h-[calc(86dvh-74px)] overflow-auto p-4">
            <p className="text-sm font-bold text-slate-800">
              サイドを{prompt.maxCount}枚まで選んでください。選択中 {prompt.selectedPrizeIndexes.length}/{prompt.maxCount}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
              {state.prizes.length === 0 ? (
                <p className="col-span-full text-sm text-slate-600">サイドがありません。</p>
              ) : (
                state.prizes.map((card, index) => {
                  const selected = prompt.selectedPrizeIndexes.includes(index);
                  const disabled = !selected && prompt.selectedPrizeIndexes.length >= prompt.maxCount;
                  return (
                    <button
                      key={`${card.soloInstanceId || card.cardId}-battle-prize-${index}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleBattlePrizeSelection(index)}
                      className={`rounded-lg p-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-amber-200 outline outline-2 outline-amber-400" : "bg-slate-100 hover:bg-slate-200"}`}
                    >
                      {renderBattleCardBack("h-[82px] w-[58px]")}
                      <span className="mt-1 block text-[10px] font-bold text-slate-700">サイド{index + 1}</span>
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={confirmBattlePrizeSelection}
              disabled={prompt.selectedPrizeIndexes.length === 0}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              選んだサイドを取る
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBattleAttackPrompt = () => {
    const prompt = battleAttackPrompt;
    if (!prompt) return null;
    const state = prompt.playerId === "player" ? battlePlayer : battleOpponent;
    const opponent = prompt.playerId === "player" ? battleOpponent : battlePlayer;
    const activeCard = state.activeStack[state.activeStack.length - 1];
    const opponentActive = opponent.activeStack[opponent.activeStack.length - 1];
    const attacks = activeCard?.attacks || [];
    const attackLocked = isBattleFirstTurnPlayer(prompt.playerId);
    const selectedSourceAttack = prompt.selectedAttackIndex === null ? null : attacks[prompt.selectedAttackIndex];
    const copyCandidates = selectedSourceAttack ? getBattleAttackCopyCandidates(selectedSourceAttack, state, opponent) : [];
    const needsCopiedAttack = copyCandidates.length > 0;

    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 p-4">
        <div className="max-h-[86dvh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-[0.16em] text-rose-700">アタック</div>
              <h3 className="truncate text-base font-black text-slate-950">{activeCard?.cardName || "バトルポケモン"}</h3>
              <p className="mt-1 text-xs font-bold text-slate-600">
                対象: {opponentActive?.cardName || "相手バトルポケモン"} / 現在ダメージ {opponent.damage.active}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBattleAttackPrompt(null)}
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>

          <div className="max-h-[calc(86dvh-70px)] overflow-auto p-4">
            {attacks.length === 0 ? (
              <p className="text-sm font-bold text-slate-700">確認できるアタックがありません。</p>
            ) : (
              <div className="grid gap-2">
                {attacks.map((attack, index) => {
                  const damage = getBattleAttackDamageValue(attack, state, opponent);
                  const energyStatus = getBattleAttackEnergyStatus(attack, state.attachedEnergies.active);
                  const usable = !attackLocked && energyStatus.usable;
                  const selected = prompt.selectedAttackIndex === index;
                  const attackCopyCandidates = getBattleAttackCopyCandidates(attack, state, opponent);
                  const missingParts = [
                    ...energyStatus.missingSpecific,
                    energyStatus.missingColorless > 0
                      ? `無${Math.max(0, energyStatus.requirement.colorless - energyStatus.missingColorless)}/${energyStatus.requirement.colorless}`
                      : "",
                  ].filter(Boolean);
                  return (
                    <button
                      key={`${activeCard?.soloInstanceId || activeCard?.cardId}-attack-${index}`}
                      type="button"
                      disabled={!usable || !opponentActive}
                      onClick={() => setBattleAttackPrompt({ ...prompt, selectedAttackIndex: index, selectedCopiedAttackKey: null })}
                      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        selected ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">{attack.name || "アタック"}</p>
                          {attack.text ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{attack.text}</p> : null}
                          {attackCopyCandidates.length > 0 ? (
                            <p className="mt-1 text-[11px] font-bold text-indigo-700">
                              コピー先ワザを選択: {attackCopyCandidates.length}件
                            </p>
                          ) : null}
                          {!usable && !attackLocked ? (
                            <p className="mt-1 text-[11px] font-bold text-rose-700">
                              不足: {missingParts.length ? missingParts.join("、") : "必要エネルギー"}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-black text-rose-700">{damage}</p>
                          <p className="text-[10px] font-bold text-slate-500">
                            必要 {formatAttackEnergyRequirement(attack)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500">
                            現在 {formatAttachedEnergySummary(state.attachedEnergies.active)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {needsCopiedAttack ? (
              <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-black tracking-[0.12em] text-indigo-700">コピー先ワザ</p>
                <div className="mt-2 grid gap-2">
                  {copyCandidates.map((candidate) => {
                    const selected = prompt.selectedCopiedAttackKey === candidate.key;
                    const damage = getBattleAttackDamageValue(candidate.attack, state, opponent);
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        onClick={() => setBattleAttackPrompt({ ...prompt, selectedCopiedAttackKey: candidate.key })}
                        className={`rounded-xl border p-3 text-left transition ${
                          selected ? "border-indigo-500 bg-white" : "border-indigo-100 bg-white/70 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">
                              {candidate.card.cardName || "ポケモン"} / {candidate.attack.name || "ワザ"}
                            </p>
                            {candidate.attack.text ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{candidate.attack.text}</p> : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black text-indigo-700">{damage}</p>
                            <p className="text-[10px] font-bold text-slate-500">元コストで使用</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={confirmBattleAttack}
              disabled={prompt.selectedAttackIndex === null || attackLocked || (needsCopiedAttack && !prompt.selectedCopiedAttackKey)}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              アタックして番終了
            </button>
          </div>
        </div>
      </div>
    );
  };

  const selectedModeCard = modeOptions.find((option) => option.value === mode);
  const selectedRareCandyTargetCard = soloRareCandyTarget ? soloRareCandyTarget.stack[soloRareCandyTarget.stack.length - 1] || null : null;
  const selectedSoloHandPlacement = selectedSoloCard ? getCardPlacementType(selectedSoloCard) : "unknown";
  const shouldShowSelectedSoloHandPanel = Boolean(
    selectedSoloCard &&
      !isRareCandyCard(selectedSoloCard) &&
      (selectedSoloHandPlacement === "item" ||
        selectedSoloHandPlacement === "supporter" ||
        selectedSoloHandPlacement === "trainer")
  );
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
          .filter(({ card }) => matchesSearchActionTarget(card, soloEffectPrompt.action))
      : [];
  const effectTrashCandidates =
    soloEffectPrompt?.kind === "recover_from_trash"
      ? soloDiscard
          .map((card, discardIndex) => ({ card, discardIndex }))
          .filter(({ card }) => matchesSearchTarget(card, soloEffectPrompt.action.target))
      : [];
  const isSoloSelectionPanelVisible = Boolean(
    shouldShowSelectedSoloHandPanel ||
      selectedSoloBoardCard ||
      soloRareCandyMode === "select_evolution" ||
      soloEffectPrompt
  );

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

        <div className={`play-lab-page mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 ${mode === "solo" || mode === "ai" ? "play-lab-page--solo-fullscreen" : ""}`}>
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
                <div className="grid h-[100dvh] min-h-0 gap-2 overflow-hidden bg-slate-950 p-2 text-slate-950 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-auto rounded-[18px] border border-white/10 bg-white/95 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black tracking-[0.16em] text-slate-500">AI BATTLE</div>
                        <h2 className="text-base font-black leading-tight text-slate-950">AI対戦練習</h2>
                      </div>
	                      <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">
	                        {battleResult ? battleStatusLabel : isBattleSetupActive ? "準備" : `T${battleTurn}`}
	                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">現在</div>
	                      <div className="mt-1 text-xs font-black text-sky-700">
	                        {battleStatusLabel}
	                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <label className="min-w-0">
                        <span className="mb-1 block text-[10px] font-black tracking-[0.12em] text-slate-500">自分デッキ</span>
                        <select
                          value={selectedDeckId}
                          onChange={(e) => setSelectedDeckId(e.target.value)}
                          disabled={battleStarted}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                          aria-label="AI対戦で自分が使うデッキ"
                        >
                          {decks.map((deck) => (
                            <option key={deck.deckId} value={deck.deckId}>
                              {deck.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-[10px] font-black tracking-[0.12em] text-slate-500">AIデッキ</span>
                        <select
                          value={selectedAiDeckId}
                          onChange={(e) => setSelectedAiDeckId(e.target.value)}
                          disabled={battleStarted}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                          aria-label="AI対戦でAIが使うデッキ"
                        >
                          {decks.map((deck) => (
                            <option key={deck.deckId} value={deck.deckId}>
                              {deck.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 text-[10px] font-black tracking-[0.12em] text-slate-500">AI方針</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {aiStyles.map((style) => (
                          <button
                            key={style.value}
                            type="button"
                            onClick={() => setAiStyle(style.value)}
                            className={`inline-flex h-8 items-center justify-center rounded-xl border px-2 text-[10px] font-black transition ${
                              aiStyle === style.value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {style.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={aiGoingFirst}
                        onChange={(e) => setAiGoingFirst(e.target.checked)}
                        disabled={battleStarted}
                        className="h-3.5 w-3.5 rounded border-slate-300 disabled:cursor-not-allowed"
                      />
                      相手先攻
                    </label>
                    <label className="mt-2 flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={autoBattleAiEnabled}
                        onChange={(e) => setAutoBattleAiEnabled(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-emerald-300"
                      />
                      AIの番に自動実行
                    </label>

                    <div className="mt-3 grid gap-1.5">
                      <button
                        type="button"
                        onClick={startBattle}
                        disabled={battleStarted}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        対戦開始
                      </button>
                      <button
                        type="button"
                        onClick={endBattleTurn}
                        disabled={!canEndBattleTurn}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        番終了
                      </button>
                      <button
                        type="button"
                        onClick={resetBattle}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        リセット
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMode("solo")}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        一人回し
                      </button>
                      <Link
                        href="/"
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        ホーム
                      </Link>
                    </div>
                  </div>

                  <div className="grid min-h-0 grid-rows-[minmax(0,0.78fr)_auto_minmax(0,1.22fr)] gap-2">
                    {renderBattlePlayerBoard(battleOpponent, "top")}

                    <div className="rounded-[16px] border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="grid gap-2 lg:grid-cols-[180px_180px_minmax(0,1fr)] lg:items-center">
                        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-2">
                          <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">共通スタジアム</div>
                          <div className="mt-1 flex min-h-[52px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
                            {battleStadiumCard ? (
                              <div className="flex min-w-0 items-center gap-2">
                                {renderBattleCardFace(battleStadiumCard, "h-[48px] w-[34px]")}
                                <span className="truncate text-xs font-bold text-slate-800">{battleStadiumCard.cardName || "スタジアム"}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-500">スタジアムなし</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-2 text-center">
                          <div className="text-[9px] font-black tracking-[0.14em] text-slate-500">TURN</div>
                          <div className="text-2xl font-black leading-tight text-slate-950">{isBattleSetupActive ? "-" : battleTurn}</div>
                          <div className="text-xs font-bold text-sky-700">{battleStatusLabel}</div>
                        </div>
                        <div className="grid min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-2">
                            <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">状態</div>
                            <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-4 text-slate-700">
                              {battleNotice || "対戦開始後、現在の操作内容がここに表示されます。"}
                            </p>
                          </div>
                          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[9px] font-black tracking-[0.12em] text-slate-500">LOG</div>
                              <button
                                type="button"
                                onClick={askNextAiMove}
                                disabled={!isBattleInProgress || battleCurrentPlayer !== "opponent"}
                                className="inline-flex h-6 items-center justify-center rounded-full border border-slate-300 bg-white px-2 text-[10px] font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                AI候補
                              </button>
                            </div>
                            <div className="mt-1 max-h-[58px] overflow-auto text-[10px] leading-4 text-slate-700">
                              {battleAiSuggestions.length > 0 ? (
                                <div className="grid gap-1">
                                  {battleAiSuggestions.map((suggestion) => (
                                    <div key={suggestion.id} className="flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white px-2 py-1">
                                      <div className="min-w-0">
                                        <p className="truncate font-black text-slate-900">{suggestion.label}</p>
                                        <p className="truncate text-slate-500">{suggestion.detail}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => applyBattleAiSuggestion(suggestion)}
                                        className="inline-flex h-6 shrink-0 items-center justify-center rounded-full bg-sky-600 px-2 text-[10px] font-bold text-white transition hover:bg-sky-700"
                                      >
                                        採用
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : battleLog.length === 0 ? (
                                <p>{isBattleSetupActive ? "開始準備の操作ログが表示されます。" : battleCurrentPlayer === "opponent" ? "AI候補を押すと候補が表示されます。" : "相手の番になるとAI候補を出せます。"}</p>
                              ) : (
                                battleLog.slice(-3).map((line, index) => (
                                  <p key={`${line}-${index}`} className="truncate">
                                    {line}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {renderBattlePlayerBoard(battlePlayer, "bottom")}
                  </div>
                  {renderBattleEffectPrompt()}
                  {renderBattlePrizePrompt()}
                  {renderBattleAttackPrompt()}
                  {battleTrashState ? (
                    <div
                      className="solo-trash-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label={`${battleTrashState.label}のトラッシュ一覧`}
                      onClick={closeBattleTrash}
                    >
                      <div className="solo-trash-modal__panel" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black text-slate-950">{battleTrashState.label}のトラッシュ</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              トラッシュにあるカードを新しい順で確認できます。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={closeBattleTrash}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
                          >
                            閉じる
                          </button>
                        </div>

                        <div className="mt-4 max-h-[65vh] overflow-auto pr-1">
                          {battleTrashState.discard.length === 0 ? (
                            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                              トラッシュにカードはありません。
                            </p>
                          ) : (
                            <div className="solo-trash-grid">
                              {battleTrashState.discard
                                .slice()
                                .reverse()
                                .map((card, index) => (
                                  <div key={`${battleTrashState.id}-trash-${card.soloInstanceId || card.cardId}-${index}`} className="solo-trash-item">
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
              ) : (
                <div className="solo-playmat-shell">
                  <button
                    type="button"
                    onClick={() => setSoloMenuOpen((open) => !open)}
                    className="solo-floating-menu-button"
                    aria-label="一人回しメニューを開く"
                    aria-expanded={soloMenuOpen}
                  >
                    ...
                  </button>

                  {soloMenuOpen ? (
                    <>
                      <button
                        type="button"
                        className="solo-floating-menu-backdrop"
                        aria-label="メニューを閉じる"
                        onClick={() => setSoloMenuOpen(false)}
                      />
                      <div className="solo-floating-menu" role="dialog" aria-label="一人回しメニュー">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-black tracking-[0.16em] text-emerald-700">SOLO MENU</div>
                            <h3 className="mt-1 text-lg font-black text-slate-950">一人回し設定</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSoloMenuOpen(false)}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            閉じる
                          </button>
                        </div>

                        <label className="mt-4 block">
                          <span className="mb-2 block text-xs font-black tracking-[0.12em] text-slate-500">利用デッキ</span>
                          <select
                            value={selectedDeckId}
                            onChange={(event) => setSelectedDeckId(event.target.value)}
                            disabled={soloStarted}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            {decks.map((deck) => (
                              <option key={deck.deckId} value={deck.deckId}>
                                {deck.name}
                              </option>
                            ))}
                          </select>
                          <span className="mt-2 block text-xs leading-5 text-slate-500">
                            開始後はリセットまで変更できません。
                          </span>
                        </label>

                        <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-black tracking-[0.14em] text-slate-500">先攻 / 後攻</div>
                              <p className="mt-1 text-xs font-semibold text-slate-600">{soloTurnLabel}</p>
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
                                  : "border border-slate-200 bg-white text-slate-700"
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
                                  : "border border-slate-200 bg-white text-slate-700"
                              } ${soloStarted ? "cursor-not-allowed opacity-50" : "hover:bg-slate-100"}`}
                            >
                              後攻
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[10px] font-black tracking-[0.12em] text-slate-500">枚数</div>
                            <div className="mt-1 text-lg font-black text-slate-950">{deckTotal}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[10px] font-black tracking-[0.12em] text-slate-500">採用</div>
                            <div className="mt-1 text-lg font-black text-slate-950">{selectedDeck?.cards.length || 0}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[10px] font-black tracking-[0.12em] text-slate-500">タイプ</div>
                            <div className="mt-1 text-lg font-black text-slate-950">{deckTypeLabel}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSoloHintsVisible((visible) => !visible)}
                          className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-full border px-4 text-sm font-bold transition ${
                            soloHintsVisible
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                          }`}
                          aria-pressed={soloHintsVisible}
                        >
                          操作ヒント {soloHintsVisible ? "ON" : "OFF"}
                        </button>

                        <div className="mt-4 grid gap-2">
                          <Link
                            href={selectedDeckEditHref}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                          >
                            デッキを整える
                          </Link>
                          <Link
                            href="/#deck-list"
                            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                          >
                            デッキ一覧へ
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setMode("ai");
                              setSoloMenuOpen(false);
                            }}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                          >
                            AI対戦へ切り替え
                          </button>
                          <Link
                            href="/"
                            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                          >
                            ホームへ戻る
                          </Link>
                        </div>
                      </div>
                    </>
                  ) : null}

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
                        onClick={() => setSoloHelpOpen(true)}
                        className="rounded-full border border-white/25 bg-white px-3 py-1 text-xs font-black text-emerald-950 shadow-sm transition hover:bg-emerald-50"
                      >
                        遊び方
                      </button>
                      <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-emerald-50">
                        {soloTurnLabel}
                      </span>
                    </div>
                  </div>

                  {soloHelpOpen && typeof document !== "undefined" ? createPortal((
                    <div
                      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
                      role="dialog"
                      aria-modal="true"
                      aria-label="一人回しの遊び方"
                      onClick={() => setSoloHelpOpen(false)}
                    >
                      <div
                        className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-black tracking-[0.16em] text-emerald-700">SOLO GUIDE</p>
                            <h3 className="mt-1 text-2xl font-black">一人回しの遊び方</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSoloHelpOpen(false)}
                            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                          >
                            閉じる
                          </button>
                        </div>

                        <div className="mt-5 grid gap-4 text-sm leading-6">
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="text-base font-black">基本の流れ</h4>
                            <ol className="mt-3 list-decimal space-y-2 pl-5 font-semibold text-slate-700">
                              <li>先攻・後攻をメニューから選びます。</li>
                              <li>「7枚引いて開始」で初期手札を引く</li>
                              <li>たねポケモンをバトル場に置き、必要ならベンチにもたねポケモンを5体まで置きます。</li>
                              <li>手札のカードを選び、「使う」「場へ出す」「つける」などの操作を選びます。</li>
                              <li>番が終わったら「番を終える」で次の番へ進めます。</li>
                            </ol>
                          </section>

                          <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-base font-black">操作の見方</h4>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="font-black text-slate-950">手札</div>
                                <p className="mt-1 font-semibold text-slate-600">カードを押すと選択されます。選択後、下の操作パネルから行動します。</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="font-black text-slate-950">場のカード</div>
                                <p className="mt-1 font-semibold text-slate-600">バトル場・ベンチ・スタジアムを押すと、その場所のカード操作に切り替わります。</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="font-black text-slate-950">山札検索</div>
                                <p className="mt-1 font-semibold text-slate-600">カード効果で山札を見る場合、候補から対象カードを選びます。</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="font-black text-slate-950">1手戻し</div>
                                <p className="mt-1 font-semibold text-slate-600">操作を間違えた時は、直前の状態へ戻せます。</p>
                              </div>
                            </div>
                          </section>

                          <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-base font-black">用語</h4>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                              {[
                                ["山札", "まだ引いていないカードの束です。"],
                                ["手札", "今使えるカードです。"],
                                ["バトル場", "攻撃する中心のポケモンを置く場所です。"],
                                ["ベンチ", "控えのポケモンを置く場所です。最大5体まで置けます。"],
                                ["サイド", "きぜつを取った時に取るカードです。"],
                                ["トラッシュ", "使い終わったカードや倒されたカードを置く場所です。"],
                                ["スタジアム", "場に1枚だけ出せる全体効果のカードです。"],
                                ["サポート", "基本的に自分の番に1枚だけ使えるトレーナーズです。"],
                                ["エネルギー", "基本的に自分の番に1枚、ポケモンにつけます。"],
                                ["進化", "場にいるポケモンの上に重ねます。出したばかりの番は進化できません。"],
                              ].map(([term, description]) => (
                                <div key={term} className="rounded-xl bg-slate-50 p-3">
                                  <dt className="font-black text-slate-950">{term}</dt>
                                  <dd className="mt-1 font-semibold text-slate-600">{description}</dd>
                                </div>
                              ))}
                            </dl>
                          </section>

                          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <h4 className="text-base font-black text-amber-950">注意</h4>
                            <p className="mt-2 font-semibold text-amber-900">
                              一人回しは練習用の操作補助です。細かい裁定や一部の特殊効果は、自分で確認しながら進めてください。
                            </p>
                          </section>
                        </div>
                      </div>
                    </div>
                  ), document.body) : null}

                  {soloHintsVisible ? (
                    <div className="mt-3 rounded-[18px] border border-white/15 bg-white/10 p-3 text-sm leading-6 text-emerald-50/90">
                      たねポケモンは空枠へ、進化は重ねます。グッズ・サポートは使う、どうぐはポケモンへ、スタジアムはスタジアム枠へ置きます。
                    </div>
                  ) : null}

                  <div className="solo-playmat mt-4">
                    <div className="solo-playmat__board">
                      <div className="solo-playmat__column solo-playmat__column--prize">
                        <button
                          type="button"
                          className={`solo-zone solo-zone--stadium solo-zone--clickable ${soloBoardSelection?.location === "stadium" ? "solo-card-chip--selected" : ""}`}
                          onClick={handleStadiumZoneClick}
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
                        <button
                          type="button"
                          className={`solo-zone solo-zone--active solo-zone--clickable ${soloBoardSelection?.location === "active" ? "solo-card-chip--selected" : ""}`}
                          onClick={handleActiveZoneClick}
                        >
                          <div className="solo-zone__label">バトル場</div>
                          <div className="solo-active-slot">
                            {soloActiveStack.length === 0 ? (
                              <>
                                <span className="solo-active-slot__title">バトル場</span>
                                <span className="solo-active-slot__text">たねポケモンを置く</span>
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
                                className={`solo-bench-slot solo-bench-slot--clickable ${
                                  soloBoardSelection?.location === "bench" && soloBoardSelection.benchIndex === index ? "solo-card-chip--selected" : ""
                                }`}
                                onClick={() => handleBenchZoneClick(index)}
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
                  {isSoloSelectionPanelVisible ? (
                  <div className={`solo-selection-panel mt-4 rounded-[22px] border border-emerald-900/20 bg-emerald-950/80 p-4 text-emerald-50 shadow-[0_20px_60px_rgba(15,23,42,0.18)] ${soloEffectPrompt ? "solo-selection-panel--effect-modal" : ""}`}>
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
                                ? "たねポケモン。空いているバトル場かベンチに置けます。"
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
                                  ? `効果: ${selectedEffectProfile.label}`
                                  : "未対応効果: 使った後は手動操作で処理します。"}
                              </p>
                            ) : null}
                            {getCardPlacementType(selectedSoloCard) === "pokemon" ? renderPokemonTextDetails(selectedSoloCard) : null}
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
                              <button
                                type="button"
                                onClick={cancelSoloCardSelection}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : selectedSoloBoardCard ? (
                        <div>
                          <div className="flex items-center gap-3">
                            {renderCardFace(selectedSoloBoardCard, "solo-card-face--preview")}
                            <div className="min-w-0">
                              <p className="text-base font-bold text-emerald-50">{selectedSoloBoardCard.cardName || selectedSoloBoardLabel}</p>
                              {selectedSoloBoardPlacement === "stadium" ? (
                                <>
                                  <p className="mt-1 text-sm leading-6 text-emerald-50/85">
                                    場に出ているスタジアムです。自分の番ごとに1回の効果を使えます。
                                  </p>
                                  <p className="mt-2 rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-xs leading-5 text-emerald-50/85">
                                    {getEffectProfile(selectedSoloBoardCard)?.label || selectedSoloBoardCard.ruleText || "効果テキストなし"}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={activateSelectedStadiumEffect}
                                      disabled={Boolean(getSelectedStadiumEffectKey() && soloUsedAbilityKeys.includes(getSelectedStadiumEffectKey()))}
                                      className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                      {getSelectedStadiumEffectKey() && soloUsedAbilityKeys.includes(getSelectedStadiumEffectKey()) ? "使用済み" : "効果を使う"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={clearSoloBoardSelection}
                                      className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                                    >
                                      キャンセル
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="mt-1 text-sm leading-6 text-emerald-50/85">
                                    {selectedSoloBoardLabel}のポケモンです。特性・アタックを確認できます。
                                  </p>
                                  {renderPokemonTextDetails(selectedSoloBoardCard)}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                {(selectedSoloBoardCard.abilities || []).length > 0 ? (
                                  (selectedSoloBoardCard.abilities || []).map((ability, abilityIndex) => {
                                    const abilityKey = getSelectedBoardAbilityKey(abilityIndex, ability.name);
                                    const used = Boolean(abilityKey && soloUsedAbilityKeys.includes(abilityKey));
                                    return (
                                      <button
                                        key={`${ability.name || "ability"}-${abilityIndex}`}
                                        type="button"
                                        onClick={() => activateSelectedBoardAbility(abilityIndex)}
                                        disabled={used}
                                        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                        title={ability.text || "特性テキストなし"}
                                      >
                                        {used ? "使用済み" : `${ability.name || "特性"}を使う`}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSoloNotice(`${selectedSoloBoardCard.cardName || "このポケモン"}に確認できる特性はありません。`)}
                                    className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                                  >
                                    特性
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={showActiveAttacks}
                                  className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                                >
                                  アタック
                                </button>
                                {soloBoardSelection?.location === "active" ? (
                                  <button
                                    type="button"
                                    onClick={openRetreatPrompt}
                                    className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                                  >
                                    逃げる
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={clearSoloBoardSelection}
                                  className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                                >
                                  キャンセル
                                </button>
                              </div>
                                </>
                              )}
                            </div>
                          </div>

                          {selectedSoloBoardPlacement !== "stadium" && soloBoardActionPrompt?.kind === "retreat" ? (
                            <div className="mt-3 rounded-[18px] border border-white/15 bg-white/8 p-3">
                              <p className="text-sm leading-6 text-emerald-50/90">
                                カードマスターに逃げエネ数がないため、トラッシュするエネルギーを手動で選ぶか、逃げエネなしを選んでください。
                              </p>
                              <div className="mt-3">
                                <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">トラッシュするエネルギー</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={selectNoRetreatEnergy}
                                    className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                                      soloBoardActionPrompt.noRetreatEnergy
                                        ? "border-yellow-300 bg-yellow-300/16 text-yellow-100"
                                        : "border-white/15 bg-transparent text-emerald-50 hover:bg-white/10"
                                    }`}
                                  >
                                    逃げエネなし
                                  </button>
                                  {soloAttachedEnergies.active.length === 0 ? (
                                    <p className="text-sm leading-6 text-emerald-50/80">バトル場についているエネルギーはありません。</p>
                                  ) : (
                                    soloAttachedEnergies.active.map((energy, index) => {
                                      const selected = soloBoardActionPrompt.selectedEnergyIndexes.includes(index);
                                      return (
                                      <button
                                        key={`${energy.cardId}-retreat-energy-${index}`}
                                        type="button"
                                        onClick={() => toggleRetreatEnergy(index)}
                                        className={`solo-card-chip ${selected ? "solo-card-chip--selected" : ""}`}
                                      >
                                        {renderCardFace(energy)}
                                      </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                              {soloBoardActionPrompt.noRetreatEnergy || soloBoardActionPrompt.selectedEnergyIndexes.length > 0 ? (
                              <div className="mt-3">
                                <div className="text-[11px] font-bold tracking-[0.14em] text-emerald-200">逃げ先</div>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {soloBenchStacks.map((stack, index) => {
                                    const selected = soloBoardActionPrompt.selectedBenchIndex === index;
                                    return (
                                        <button
                                          key={`retreat-bench-${index}`}
                                          type="button"
                                          disabled={stack.length === 0}
                                          onClick={() => selectRetreatBench(index)}
                                          className={`rounded-[16px] border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                            selected ? "border-yellow-300 bg-yellow-300/16" : "border-white/15 bg-emerald-900/60 hover:bg-emerald-900"
                                          }`}
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
                                    );
                                  })}
                                </div>
                              </div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {soloBoardActionPrompt.noRetreatEnergy || soloBoardActionPrompt.selectedEnergyIndexes.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={confirmRetreat}
                                  className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                                >
                                  逃げるを確定
                                </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={cancelRetreat}
                                  className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 text-xs font-bold text-emerald-50 transition hover:bg-white/10"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : null}
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

                    {soloEffectPrompt && typeof document !== "undefined" ? createPortal((
                      <div className="solo-effect-modal" role="dialog" aria-modal="true" aria-label="効果処理">
                        <div className="solo-effect-modal__panel">
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
                              {soloEffectPrompt.costCardName
                                ? `コストとして「${soloEffectPrompt.costCardName}」を${soloEffectPrompt.count}枚選んでください。`
                                : soloEffectPrompt.costTarget
                                  ? `コストとして${getSearchTargetLabel(soloEffectPrompt.costTarget)}を${soloEffectPrompt.count}枚選んでください。`
                                  : `コストとして手札を${soloEffectPrompt.count}枚選んでください。`}
                            </p>
                            <div className="solo-effect-modal__card-row mt-2">
                              {soloHand.map((card, index) => {
                                const disabled =
                                  index === soloEffectPrompt.sourceHandIndex ||
                                  !matchesHandDiscardCost(card, soloEffectPrompt.costTarget, soloEffectPrompt.costCardName);
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
                              {getSearchActionInstruction(soloEffectPrompt.action)}
                              {soloEffectPrompt.action.splitDestination ? " 1枚目を手札に加え、2枚目を場のポケモンにつけます。" : ""}
                              {soloEffectPrompt.action.distinctBasicEnergyTypes ? " 同じタイプの基本エネルギーは同時に選べません。" : ""}
                            </p>
                            <div className="solo-effect-modal__choice-grid mt-2">
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
                            <div className="solo-effect-modal__choice-grid mt-2">
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
                              {soloEffectPrompt.action.destination === "attach_energy" ? "選んだカードのつけ先を選ぶ" : "選んだカードを手札に加える"}
                            </button>
                          </div>
                        ) : soloEffectPrompt.kind === "switch_active" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">入れ替え先のベンチポケモンを選んでください。</p>
                            <div className="solo-effect-modal__choice-grid mt-2">
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
                        ) : soloEffectPrompt.kind === "attach_energy_target" ? (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              {soloEffectPrompt.attachCards.map((card) => card.cardName || "エネルギー").join("、")}をつけるポケモンを選んでください。
                            </p>
                            <div className="solo-effect-modal__choice-grid mt-2">
                              <button
                                type="button"
                                disabled={soloActiveStack.length === 0 || soloEffectPrompt.attachTarget?.location === "bench"}
                                onClick={() => confirmAttachEnergyTarget("active")}
                                className="rounded-[16px] border border-white/15 bg-emerald-900/60 p-2 text-left transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <div className="flex items-center gap-2">
                                  {soloActiveStack.length ? renderCardFace(soloActiveStack[soloActiveStack.length - 1], "solo-card-face--candidate") : null}
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-emerald-50">バトル場</p>
                                    <p className="mt-1 text-[11px] leading-5 text-emerald-100/80">
                                      {soloActiveStack[soloActiveStack.length - 1]?.cardName || "空き"}
                                    </p>
                                  </div>
                                </div>
                              </button>
                              {soloBenchStacks.map((stack, index) => {
                                const targetTop = stack[stack.length - 1];
                                const requiredName = soloEffectPrompt.attachTarget?.cardNameIncludes;
                                const disabled = stack.length === 0 || Boolean(requiredName && !String(targetTop?.cardName || "").includes(requiredName));
                                return (
                                  <button
                                    key={`attach-energy-bench-${index}`}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => confirmAttachEnergyTarget("bench", index)}
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
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <p className="text-sm leading-6 text-emerald-50/90">
                              {soloEffectPrompt.action.type === "heal_pokemon" ? "回復するポケモンを選んでください。" : "どうぐをトラッシュするポケモンを選んでください。"}
                            </p>
                            <div className="solo-effect-modal__choice-grid mt-2">
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
                      </div>
                    ), document.body) : null}

                    {soloNotice && <p className="mt-3 text-sm leading-6 text-emerald-100/90">{soloNotice}</p>}
                  </div>
                  ) : null}

                  {!isSoloSelectionPanelVisible && soloNotice ? (
                    <p className="mt-3 rounded-2xl border border-emerald-900/15 bg-emerald-950/70 px-4 py-3 text-sm leading-6 text-emerald-50 shadow-sm">
                      {soloNotice}
                    </p>
                  ) : null}
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
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={undoSoloAction}
                          disabled={soloHistory.length === 0}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-5 text-sm font-bold text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          1手戻し
                        </button>
                        {canShowPostSetupSoloActions && canManualDrawSolo ? (
                          <button
                            type="button"
                            onClick={drawSoloForTurn}
                            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                          >
                            1枚引く
                          </button>
                        ) : null}
                        {canShuffleOpeningHand ? (
                          <button
                            type="button"
                            onClick={shuffleSolo}
                            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                          >
                            手札を戻して引き直す
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={resetSolo}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                        >
                          リセット
                        </button>
                        <button
                          type="button"
                          onClick={nextSoloTurn}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                        >
                          ターン終了
                        </button>
                        {canShowPostSetupSoloActions ? (
                          <button
                            type="button"
                            onClick={takePrize}
                            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                          >
                            サイドを取る
                          </button>
                        ) : null}
                      </>
                    )}
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
