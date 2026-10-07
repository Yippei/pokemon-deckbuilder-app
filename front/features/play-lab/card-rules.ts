import type { DeckCard } from "@/lib/api";
import type {
  EffectAction,
  EffectProfile,
  PracticeMode,
  RareCandyCandidate,
  SearchSelectionRequirement,
  SearchTarget,
  SoloAbility,
  SoloCard,
  SoloEnergyState,
  SoloPlacementType,
  SoloToolState,
  StaticCardDetail,
} from "./types";

export function normalizeStage(stage?: string) {
  return String(stage || "").trim().replace(/[ 　]/g, "");
}

export function normalizePokemonNameCore(name?: string) {
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

export function isRareCandyCard(card?: Pick<SoloCard, "cardName">) {
  return normalizePokemonNameCore(card?.cardName) === "ふしぎなアメ";
}

export function wasPokemonPutInPlayThisTurn(card: SoloCard | null | undefined, currentTurn: number) {
  if (!card) return false;
  return getCardPlacementType(card) === "pokemon" && card?.playedTurn === currentTurn;
}

export function createEmptySoloTools(): SoloToolState {
  return {
    active: null,
    bench: Array.from({ length: 5 }, () => null),
  };
}

export function createEmptySoloEnergies(): SoloEnergyState {
  return {
    active: [],
    bench: Array.from({ length: 5 }, () => []),
  };
}

export function getTrainerSubtype(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "cardName">) {
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

export function getEffectProfile(card?: SoloCard | null): EffectProfile | null {
  const fallbackProfile = getFallbackEffectProfile(card);
  const masterProfile = augmentEffectProfileFromRuleText(card, card?.effectProfile || null);
  const masterAction = masterProfile?.actions[0];

  if (!masterProfile) return fallbackProfile;
  if (fallbackProfile && shouldPreferFallbackEffectProfile(card)) return fallbackProfile;
  if (fallbackProfile && masterAction?.type === "resolve_effect") return fallbackProfile;
  return masterProfile;
}

export function getHandDiscardCostFromText(text?: string): EffectProfile["costs"] {
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

export function augmentEffectProfileFromRuleText(card?: SoloCard | null, profile?: EffectProfile | null): EffectProfile | null {
  if (!profile) return null;
  const firstAction = profile.actions[0];
  const ruleText = card?.ruleText || "";
  const returnsHandToDeck = /手札をすべて山札にもど/.test(ruleText);
  const normalizedProfile = firstAction?.type === "draw_cards" && returnsHandToDeck
    ? {
        ...profile,
        actions: [{
          ...firstAction,
          discardRemainingHand: false,
          shuffleRemainingHandIntoDeck: true,
        }, ...profile.actions.slice(1)],
      }
    : profile;
  const textCost = getHandDiscardCostFromText(card?.ruleText);
  if (!textCost?.length) return normalizedProfile;
  const currentCost = normalizedProfile.costs?.[0];
  if (currentCost?.type === "discard_from_hand") {
    return {
      ...normalizedProfile,
      costs: [{
        ...currentCost,
        target: currentCost.target || textCost[0].target,
        cardName: currentCost.cardName || textCost[0].cardName,
      }],
    };
  }
  return { ...normalizedProfile, costs: textCost };
}

export function shouldPreferFallbackEffectProfile(card?: SoloCard | null) {
  const name = normalizePokemonNameCore(card?.cardName);
  return name === "アカマツ" || name === "リーリエの決心" || name === "トウコ" || name === "ファイトゴング" || name === "むしとりセット" || name === "Nのポイントアップ";
}

export function getFallbackEffectProfile(card?: SoloCard | null): EffectProfile | null {
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

export function matchesSearchTarget(card: SoloCard, target: SearchTarget): boolean {
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

export function parseJapaneseCardCount(value?: string) {
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

export function getAbilityEffectProfile(card: SoloCard | null, ability?: SoloAbility | null): EffectProfile | null {
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

export function getPokemonTypes(card?: SoloCard | null) {
  return Array.isArray(card?.types) ? card.types.filter(Boolean) : [];
}

export function matchesAnyType(cardTypes: string[], requiredTypes?: string[]) {
  if (!requiredTypes || requiredTypes.length === 0) return true;
  return requiredTypes.some((type) => cardTypes.includes(type));
}

export function matchesSearchFilter(
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

export function matchesSearchActionTarget(card: SoloCard, action: Extract<EffectAction, { type: "search_deck" }>): boolean {
  if (action.selectionRequirements?.length) {
    return action.selectionRequirements.some((requirement) => matchesSearchFilter(card, requirement));
  }
  return matchesSearchFilter(card, action);
}

export function getSearchTargetLabel(target: SearchTarget): string {
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

export function getSearchRequirementLabel(requirement: SearchSelectionRequirement) {
  return `${getSearchTargetLabel(requirement.target)}${requirement.count}枚`;
}

export function getSearchRequirementSummary(action: Extract<EffectAction, { type: "search_deck" }>) {
  if (!action.selectionRequirements?.length) return "";
  return action.selectionRequirements.map(getSearchRequirementLabel).join("と");
}

export function getSearchActionLabel(action: Extract<EffectAction, { type: "search_deck" }>) {
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

export function getSearchActionInstruction(action: Extract<EffectAction, { type: "search_deck" }>) {
  const requirementSummary = getSearchRequirementSummary(action);
  if (requirementSummary) return `${requirementSummary}を選んでください。`;
  return `${getSearchActionLabel(action)}を${action.count}枚まで選んでください。`;
}

export function getRequirementSelectedCount(
  selectedCards: SoloCard[],
  requirement: SearchSelectionRequirement
) {
  return selectedCards.filter((card) => matchesSearchFilter(card, requirement)).length;
}

export function validateSearchSelectionRequirements(
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

export function canAddSearchSelection(
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

export function getBasicEnergyType(card?: SoloCard | null) {
  const name = String(card?.cardName || card?.name || "");
  const match = name.match(/^基本(.+)エネルギー$/);
  return match?.[1] || "";
}

export function getStageCategory(stage?: string, stageCategory?: string) {
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

export function getCardTypeLabel(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">) {
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

export function getCardPlacementType(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">): SoloPlacementType {
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

export function getStageOrder(card?: Pick<SoloCard, "cardKind" | "subKind" | "stage" | "stageCategory" | "stageOrder">) {
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

export function getRareCandyEvolutionNames(baseName?: string) {
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

export const knownPreEvolutionByName: Record<string, string> = {
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

export function uniqueNormalizedNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizePokemonNameCore(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getAllowedPreEvolutionNames(detail: StaticCardDetail | undefined, cardDetails: Record<string, StaticCardDetail>) {
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

export function uniqueByCardName(cards: RareCandyCandidate[]) {
  const seen = new Set<string>();
  return cards.filter(({ card }) => {
    const key = normalizePokemonNameCore(card.cardName) || card.cardId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getInitialMode(): PracticeMode {
  if (typeof window === "undefined") return "ai";
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "solo" ? "solo" : "ai";
}

export function buildCardDetailNameIndex(cardDetails: Record<string, StaticCardDetail>) {
  const index = new Map<string, StaticCardDetail>();
  Object.values(cardDetails).forEach((detail) => {
    const key = normalizePokemonNameCore(detail.name);
    if (key) {
      index.set(key, detail);
    }
  });
  return index;
}

export function getCardDetailForDeckCard(
  card: DeckCard,
  cardDetails: Record<string, StaticCardDetail>,
  nameIndex: Map<string, StaticCardDetail>
) {
  const exactDetail = cardDetails[card.cardId];
  if (exactDetail) return exactDetail;
  const nameKey = normalizePokemonNameCore(card.cardName);
  return nameKey ? nameIndex.get(nameKey) : undefined;
}

