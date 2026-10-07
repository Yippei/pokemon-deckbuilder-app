import {
  createEmptySoloEnergies,
  createEmptySoloTools,
  getBasicEnergyType,
  getCardPlacementType,
  getStageOrder,
  normalizePokemonNameCore,
  uniqueNormalizedNames,
  wasPokemonPutInPlayThisTurn,
} from "./card-rules";
import type { Deck } from "@/lib/api";
import { expandDeck, hasBasicPokemon, takeRandomCards } from "./game-setup";
import type { BattleAttack, BattlePlayerId, BattlePlayerState, SoloCard, SoloStack, StaticCardDetail } from "./types";

export function createEmptyBattleDamage() {
  return {
    active: 0,
    bench: Array.from({ length: 5 }, () => 0),
  };
}

export function createEmptyBattlePlayer(id: BattlePlayerId, label: string): BattlePlayerState {
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

export function applyBattleActiveKnockout(state: BattlePlayerState, activeDamage: number) {
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

export function applyBattleBenchKnockouts(state: BattlePlayerState, benchIndexes: number[]) {
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

export function getBattlePrizeCountForKnockedOutPokemon(card?: SoloCard | null) {
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

export function getBattlePrizeSummariesForKnockouts(cards: SoloCard[]) {
  return cards.map((card) => ({
    cardName: card.cardName || card.name || "ポケモン",
    prizeCount: getBattlePrizeCountForKnockedOutPokemon(card),
  }));
}

export function promoteBattleBenchToActive(state: BattlePlayerState, benchIndex: number) {
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

export function setupBattleAiPlayerWithOpeningRedraw(
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

export function getBasicPokemonHandIndexes(cards: SoloCard[]) {
  return cards
    .map((card, handIndex) => ({ card, handIndex }))
    .filter(({ card }) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0)
    .map(({ handIndex }) => handIndex);
}

export function setupBattleOpponentOpeningBoard(state: BattlePlayerState): BattlePlayerState {
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

export function canEvolveBattleStack(stack: SoloStack, evolutionCard: SoloCard, currentTurn: number) {
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

export function getAttackDamageValue(attack?: { damage?: number | string }) {
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

export function isAttackCopyEffect(attack?: BattleAttack | null) {
  const text = String(attack?.text || "");
  return text.includes("持つワザを1つ選び") && text.includes("このワザとして使う");
}

export function isNoNamedPokemon(card?: SoloCard | null) {
  return String(card?.cardName || card?.name || "").includes("Nの");
}

export function isCopyableAttack(attack?: BattleAttack | null) {
  return Boolean(attack?.name) && !isAttackCopyEffect(attack);
}

export function getBattleAttackCopyCandidates(attack: BattleAttack, attacker: BattlePlayerState, defender: BattlePlayerState): BattleAttackCopyCandidate[] {
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

export function resolveBattleAttack(
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

export function countBattleBenchPokemon(state: BattlePlayerState) {
  return state.benchStacks.filter((stack) => stack.length > 0).length;
}

export function countBattleRuleBoxPokemon(state: BattlePlayerState) {
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

export function countBasicEnergyCards(cards: SoloCard[]) {
  return cards.filter((card) => getCardPlacementType(card) === "energy" && String(card.cardName || card.name || "").includes("基本")).length;
}

export function getBattleAttackDamageValue(attack: BattleAttack, attacker: BattlePlayerState, defender: BattlePlayerState) {
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

export function getBattleAttackBenchDamage(attack: BattleAttack) {
  const text = String(attack.text || "");
  return Number(text.match(/相手のベンチポケモン全員にも、それぞれ([0-9]+)ダメージ/)?.[1] || 0);
}

export function shouldDiscardAllActiveEnergiesAfterAttack(attack: BattleAttack) {
  return String(attack.text || "").includes("このポケモンについているエネルギーをすべてトラッシュ");
}

export function getManualBattleAttackEffectNote(attack: BattleAttack) {
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

export function getAttackCostCount(attack?: { cost?: string[] }) {
  return Array.isArray(attack?.cost) ? attack.cost.filter(Boolean).length : 0;
}

export const pokemonEnergyCostTypes = ["草", "炎", "水", "雷", "超", "闘", "悪", "鋼"] as const;
type PokemonEnergyCostType = (typeof pokemonEnergyCostTypes)[number];

export function normalizeAttackEnergyCost(cost?: string) {
  const normalized = String(cost || "").replace(/[ 　・\-－]/g, "");
  if (!normalized) return "colorless";
  if (normalized.includes("無") || normalized.includes("無色") || normalized.toLowerCase().includes("colorless")) return "colorless";
  return pokemonEnergyCostTypes.find((type) => normalized.includes(type)) || "colorless";
}

export function getAttachedEnergyType(card?: SoloCard | null) {
  const basicType = getBasicEnergyType(card);
  if (pokemonEnergyCostTypes.includes(basicType as PokemonEnergyCostType)) return basicType as PokemonEnergyCostType;
  const name = String(card?.cardName || card?.name || "");
  if (!name.includes("エネルギー")) return null;
  return pokemonEnergyCostTypes.find((type) => name.includes(type)) || null;
}

export function getAttackEnergyRequirement(attack?: { cost?: string[] }) {
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

export function getAttachedEnergyTypeCounts(attachedEnergies: SoloCard[]) {
  const counts = new Map<PokemonEnergyCostType, number>();
  for (const energy of attachedEnergies) {
    const type = getAttachedEnergyType(energy);
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return counts;
}

export function getBattleAttackEnergyStatus(attack: { cost?: string[] }, attachedEnergies: SoloCard[]) {
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

export function formatAttackEnergyRequirement(attack?: { cost?: string[] }) {
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

export function formatAttachedEnergySummary(attachedEnergies: SoloCard[]) {
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
