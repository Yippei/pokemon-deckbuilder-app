import type { DeckCard } from "@/lib/api";

export type PracticeMode = "ai" | "solo";
export type AiStyle = "speed" | "control" | "stability" | "random";
export type SoloStartingPlayer = "first" | "second";
export type SoloPlacementType = "pokemon" | "item" | "supporter" | "tool" | "stadium" | "energy" | "trainer" | "unknown";
export type SoloCard = DeckCard & {
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
export type BattleAttack = NonNullable<SoloCard["attacks"]>[number];
export type SoloStack = SoloCard[];
export type SoloToolState = {
  active: SoloCard | null;
  bench: Array<SoloCard | null>;
};
export type SoloEnergyState = {
  active: SoloCard[];
  bench: SoloCard[][];
};
export type SoloBoardSelection = {
  location: "active" | "bench" | "stadium";
  benchIndex?: number;
};
export type SoloBoardActionPrompt = {
  kind: "retreat";
  selectedBenchIndex: number | null;
  selectedEnergyIndexes: number[];
  noRetreatEnergy: boolean;
};
export type SearchTarget =
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
export type SearchSelectionRequirement = {
  target: SearchTarget;
  count: number;
  pokemonStage?: "basic" | "evolution";
  pokemonTypes?: string[];
  basicEnergyTypes?: string[];
};
export type EffectAction =
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
export type EffectProfile = {
  label: string;
  manualResolutionRequired?: boolean;
  costs?: Array<{ type: "discard_from_hand"; count: number; target?: SearchTarget; cardName?: string }>;
  actions: EffectAction[];
};
export type SoloAbility = { name?: string; text?: string };
export type StaticCardDetail = {
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
export type StaticCardMaster = {
  generatedAt?: string;
  totalCards?: number;
  profiledCards?: number;
  cards?: Record<string, StaticCardDetail>;
};
export type SoloEffectPrompt =
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
export type RareCandyTarget = {
  location: "active" | "bench";
  benchIndex?: number;
  label: string;
  stack: SoloStack;
};
export type RareCandyCandidate = {
  handIndex: number;
  card: SoloCard;
};
export type SoloSnapshot = {
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
export type BattlePlayerId = "player" | "opponent";
export type BattleSetupPhase = "idle" | "player_active" | "player_bench" | "ready";
export type BattleResult = {
  outcome: "win" | "loss";
  reason: string;
  message: string;
};
export type BattlePlayerState = {
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
export type BattleAttackPrompt = {
  playerId: BattlePlayerId;
  selectedAttackIndex: number | null;
  selectedCopiedAttackKey: string | null;
};
export type BattlePrizePrompt = {
  playerId: BattlePlayerId;
  maxCount: number;
  selectedPrizeIndexes: number[];
  knockedOutSummaries: Array<{ cardName: string; prizeCount: number }>;
  pendingPromotionPlayerId: BattlePlayerId | null;
};
export type BattleBoardSelection = {
  playerId: BattlePlayerId;
  location: "active" | "bench";
  benchIndex?: number;
};
export type BattleAiSuggestion =
  | { id: string; label: string; detail: string; action: "draw" }
  | { id: string; label: string; detail: string; action: "place_active"; handIndex: number }
  | { id: string; label: string; detail: string; action: "place_bench"; handIndex: number; benchIndex: number }
  | { id: string; label: string; detail: string; action: "evolve_active"; handIndex: number }
  | { id: string; label: string; detail: string; action: "evolve_bench"; handIndex: number; benchIndex: number }
  | { id: string; label: string; detail: string; action: "attach_energy"; handIndex: number; target: "active" | "bench"; benchIndex?: number }
  | { id: string; label: string; detail: string; action: "use_trainer"; handIndex: number }
  | { id: string; label: string; detail: string; action: "attack"; attackIndex: number; copiedAttackKey: string | null }
  | { id: string; label: string; detail: string; action: "end_turn" };
export type BattleEffectPrompt =
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

