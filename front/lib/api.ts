import { getIdToken, login } from "@/lib/auth";
import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type Card = {
  cardId: string;
  name: string;
  regulation?: string;
  cardType?: string;
  illustration?: string;
};

export type CardDetail = {
  cardId: string;
  name?: string;
  cardKind?: string;
  subKind?: string;
  stage: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  stageOrder?: number;
  hp?: number | null;
};

export type DeckCard = {
  cardId: string;
  cardName?: string;
  illustration?: string;
  count: number;
};

export type Deck = {
  deckId: string;
  ownerId: string;
  name: string;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
};

export type GenerateDeckWarning = {
  type: string;
  message: string;
};

export type GenerateDeckResult = {
  cards: DeckCard[];
  warnings?: GenerateDeckWarning[];
};

export type GenerateDeckContext = {
  selectedType?: string;
  selectedPlan?: string;
  pokemonName?: string;
  supplementalTheme?: string;
};

type StaticCardDetail = {
  cardId: string;
  name?: string;
  cardKind?: string;
  subKind?: string;
  ruleText?: string;
  searchTokens?: string[];
  imageUrl?: string;
};

type StaticCardMaster = {
  cards?: Record<string, StaticCardDetail>;
};

const DeckCardSchema = z.object({
  cardId: z.string().min(1),
  cardName: z.string().optional(),
  illustration: z.string().optional(),
  count: z.number().int().min(1).max(60),
});

const GenerateDeckWarningSchema = z.object({
  type: z.string().min(1).default("validation"),
  message: z.string().min(1),
});

const GenerateDeckResultSchema = z.object({
  cards: z.array(DeckCardSchema).min(1),
  warnings: z.array(GenerateDeckWarningSchema).optional(),
});

const targetDeckCardCount = 60;
const stapleCards = [
  { name: "ハイパーボール", targetCount: 4 },
  { name: "ポケモンいれかえ", targetCount: 2 },
  { name: "ボスの指令", targetCount: 2 },
  { name: "夜のタンカ", targetCount: 1 },
  { name: "なかよしポフィン", targetCount: 2 },
];
const handResetCardNames = ["ナンジャモ", "ジャッジマン", "ツツジ", "マリィ", "リセットスタンプ"];
const basicEnergyByType: Record<string, string> = {
  grass: "基本草エネルギー",
  fire: "基本炎エネルギー",
  water: "基本水エネルギー",
  electric: "基本雷エネルギー",
  psychic: "基本超エネルギー",
  fighting: "基本闘エネルギー",
  dark: "基本悪エネルギー",
};
let cardMasterPromise: Promise<Record<string, StaticCardDetail>> | null = null;

export function isBasicEnergyName(name?: string): boolean {
  const normalized = (name || "").replace(/[ 　・\-－]/g, "").toLowerCase();
  return normalized.includes("基本") && normalized.includes("エネルギー");
}

export function maxCountForCard(card: Pick<DeckCard, "cardName">): number {
  return isBasicEnergyName(card.cardName) ? 60 : 4;
}

export function normalizeCardLimitName(name?: string): string {
  return (name || "").replace(/[ 　・\-－]/g, "").toLowerCase();
}

export function countCardsWithSameName(cards: DeckCard[], card: Pick<DeckCard, "cardName">): number {
  const targetName = normalizeCardLimitName(card.cardName);
  if (!targetName) return 0;
  return cards.reduce((sum, current) => {
    return normalizeCardLimitName(current.cardName) === targetName ? sum + current.count : sum;
  }, 0);
}

export function remainingCountForCardName(cards: DeckCard[], card: Pick<DeckCard, "cardName">): number {
  return Math.max(0, maxCountForCard(card) - countCardsWithSameName(cards, card));
}

// カード検索
export async function searchCards(params: { name?: string; pg?: number }): Promise<Card[]> {
  const query = new URLSearchParams();
  if (params.name) query.set("name", params.name);
  if (params.pg) query.set("pg", String(params.pg));

  const res = await authFetch(`${API_URL}/cards?${query}`);
  if (!res.ok) throw new Error("カードの取得に失敗しました");
  const data = await res.json();
  return data.items;
}

// カード詳細
export async function getCardDetail(cardId: string): Promise<CardDetail> {
  const res = await authFetch(`${API_URL}/cards/${encodeURIComponent(cardId)}`);
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "カード詳細の取得に失敗しました"));
  return res.json();
}

// 旧ローカル保存との互換用。一覧表示はAPIから取得する。
export function getSavedDeckIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("deckIds");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem("deckIds");
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    localStorage.removeItem("deckIds");
    return [];
  }
}

export function saveDeckId(deckId: string) {
  try {
    const ids = getSavedDeckIds();
    if (!ids.includes(deckId)) {
      localStorage.setItem("deckIds", JSON.stringify([...ids, deckId]));
    }
  } catch {
    // DBへの作成は完了しているので、ローカル保存の失敗で作成失敗扱いにしない。
  }
}

export function removeDeckId(deckId: string) {
  try {
    const ids = getSavedDeckIds().filter((id) => id !== deckId);
    localStorage.setItem("deckIds", JSON.stringify(ids));
  } catch {
    localStorage.removeItem("deckIds");
  }
}

// デッキ一覧
export async function listDecks(): Promise<Deck[]> {
  const res = await authFetch(`${API_URL}/decks`);
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキ一覧の取得に失敗しました"));
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

// デッキ取得
export async function getDeck(deckId: string): Promise<Deck> {
  const res = await authFetch(`${API_URL}/decks/${deckId}`);
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの取得に失敗しました"));
  return res.json();
}

// デッキ作成
export async function createDeck(body: { name: string; cards: DeckCard[] }): Promise<Deck> {
  const res = await authFetch(`${API_URL}/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの作成に失敗しました"));
  return res.json();
}

// デッキ更新
export async function updateDeck(deckId: string, body: { name?: string; cards?: DeckCard[] }): Promise<Deck> {
  const res = await authFetch(`${API_URL}/decks/${deckId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの更新に失敗しました"));
  return res.json();
}

// デッキ削除
export async function deleteDeck(deckId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/decks/${deckId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの削除に失敗しました"));
}

// デッキ自動生成
export async function generateDeck(body: {
  theme: string;
  existingDeck?: DeckCard[];
  generationContext?: GenerateDeckContext;
}): Promise<GenerateDeckResult> {
  try {
    const res = await authFetch(`${API_URL}/decks/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの生成に失敗しました"));
    const data = await res.json();
    const parsed = GenerateDeckResultSchema.safeParse(data);
    if (!parsed.success) {
      console.warn("Invalid generated deck response", parsed.error.flatten());
      throw new Error("AIの生成結果の形式が正しくありません。もう一度生成してください。");
    }
    return await normalizeGeneratedDeck(parsed.data, body.generationContext);
  } catch (error) {
    throw new Error(toJapaneseFetchError(error, "デッキの生成に失敗しました"));
  }
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getIdToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    await login();
  }
  return res;
}

async function getAPIErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
  }
  return fallback;
}

function toJapaneseFetchError(error: unknown, fallback: string): string {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "APIに接続できませんでした。ログイン状態または通信環境を確認してください。";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function normalizeGeneratedDeck(
  generated: GenerateDeckResult,
  context?: GenerateDeckContext
): Promise<GenerateDeckResult> {
  const warnings = [...(generated.warnings || [])];
  const cardMaster = await loadCardMaster();
  if (Object.keys(cardMaster).length === 0) {
    return {
      ...generated,
      warnings: [
        ...warnings,
        {
          type: "card_master",
          message: "カードマスターを取得できなかったため、実在カード照合をスキップしました。",
        },
      ],
    };
  }
  const cardsByName = buildCardsByName(cardMaster);
  const cards: DeckCard[] = [];
  const droppedNames: string[] = [];
  let cappedCardCount = 0;

  for (const card of generated.cards) {
    const masterCard = cardMaster[card.cardId];
    if (!masterCard) {
      droppedNames.push(card.cardName || card.cardId);
      continue;
    }
    const normalizedCard: DeckCard = {
      cardId: masterCard.cardId,
      cardName: masterCard.name || card.cardName || masterCard.cardId,
      illustration: masterCard.imageUrl || card.illustration,
      count: card.count,
    };
    cappedCardCount += addDeckCardWithLimits(cards, normalizedCard);
  }

  const themeLockedRemoval = removeIncompatibleThemeLockedCards(cards, cardMaster, context);

  const trimmedCardCount = trimDeckToCount(cards, targetDeckCardCount);
  if (droppedNames.length > 0) {
    warnings.push({
      type: "card_master",
      message: `カードマスターに存在しないカードを除外しました: ${droppedNames.slice(0, 5).join("、")}`,
    });
  }
  if (cappedCardCount > 0) {
    warnings.push({
      type: "card_limit",
      message: `同名カードの上限を超えた${cappedCardCount}枚を調整しました。`,
    });
  }
  if (themeLockedRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ方針に合わない専用カードを除外しました: ${themeLockedRemoval.removedNames.slice(0, 5).join("、")}`,
    });
  }
  if (trimmedCardCount > 0) {
    warnings.push({
      type: "deck_count",
      message: `60枚を超えた${trimmedCardCount}枚を調整しました。`,
    });
  }

  const appliedPolicyRules = applyDeckPolicyRules(cards, cardsByName);
  if (appliedPolicyRules.handResetAdded) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ方針により、手札リセット枠として${appliedPolicyRules.handResetAdded.cardName}を追加しました。`,
    });
  }

  const filledCardCount = fillDeckWithStaples(cards, cardsByName, context);
  if (filledCardCount > 0) {
    warnings.push({
      type: "staple_fill",
      message: `不足分${filledCardCount}枚を汎用カードまたは基本エネルギーで補いました。`,
    });
  }
  const total = countDeckCards(cards);
  if (total !== targetDeckCardCount) {
    warnings.push({
      type: "deck_count",
      message: `生成後の枚数が${total}枚です。保存前に60枚へ調整してください。`,
    });
  }

  return {
    cards: cards.filter((card) => card.count > 0),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

async function loadCardMaster(): Promise<Record<string, StaticCardDetail>> {
  if (!cardMasterPromise) {
    cardMasterPromise = fetch("/card-master-lite.json", { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error("card-master-lite.json を取得できませんでした");
        const data = (await res.json()) as StaticCardMaster;
        return data.cards || {};
      })
      .catch((error) => {
        console.warn("Card master validation skipped", error);
        return {};
      });
  }
  return cardMasterPromise;
}

function buildCardsByName(cardMaster: Record<string, StaticCardDetail>) {
  const cardsByName = new Map<string, StaticCardDetail>();
  for (const card of Object.values(cardMaster)) {
    if (!card.name) continue;
    cardsByName.set(normalizeCardLimitName(card.name), card);
  }
  return cardsByName;
}

function addDeckCardWithLimits(cards: DeckCard[], card: DeckCard): number {
  const addableCount = Math.min(card.count, remainingCountForCardName(cards, card));
  if (addableCount <= 0) return card.count;
  const existing = cards.find((current) => current.cardId === card.cardId);
  if (existing) {
    existing.count += addableCount;
  } else {
    cards.push({ ...card, count: addableCount });
  }
  return card.count - addableCount;
}

function trimDeckToCount(cards: DeckCard[], targetCount: number) {
  let overflow = countDeckCards(cards) - targetCount;
  const trimmed = Math.max(0, overflow);
  for (let index = cards.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const card = cards[index];
    const removeCount = Math.min(card.count, overflow);
    card.count -= removeCount;
    overflow -= removeCount;
  }
  return trimmed;
}

function removeIncompatibleThemeLockedCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const removedNames: string[] = [];
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || isThemeLockedCardCompatible(masterCard, cards, cardMaster, context)) continue;

    removedNames.push(card.cardName || masterCard.name || card.cardId);
    cards.splice(index, 1);
  }
  return {
    removedCount: removedNames.length,
    removedNames: removedNames.reverse(),
  };
}

function isThemeLockedCardCompatible(
  card: StaticCardDetail,
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const requiredPokemonGroups = getRequiredPokemonGroups(card);
  if (requiredPokemonGroups.length === 0) return true;

  return requiredPokemonGroups.some((groupName) => {
    const ownerPrefix = groupName.replace(/ポケモン$/, "");
    return hasThemePokemon(deckCards, cardMaster, ownerPrefix) || contextMatchesTheme(context, ownerPrefix);
  });
}

function getRequiredPokemonGroups(card: StaticCardDetail) {
  if (card.cardKind !== "trainer") return [];
  const text = [card.ruleText, ...(card.searchTokens || [])].filter(Boolean).join(" ");
  const matches = [...text.matchAll(/「([^」]+のポケモン)」/g)];
  return Array.from(new Set(matches.map((match) => match[1]).filter(isSpecificPokemonGroup)));
}

function isSpecificPokemonGroup(groupName: string) {
  return !["自分のポケモン", "相手のポケモン", "おたがいのポケモン"].includes(groupName);
}

function hasThemePokemon(
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  ownerPrefix: string
) {
  const normalizedPrefix = normalizeCardLimitName(ownerPrefix);
  return deckCards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    if (masterCard?.cardKind !== "pokemon") return false;
    return normalizeCardLimitName(masterCard.name).startsWith(normalizedPrefix);
  });
}

function contextMatchesTheme(context: GenerateDeckContext | undefined, ownerPrefix: string) {
  const normalizedPrefix = normalizeCardLimitName(ownerPrefix.replace(/の$/, ""));
  if (!normalizedPrefix) return false;
  const contextText = [
    context?.pokemonName,
    context?.supplementalTheme,
    context?.selectedPlan,
  ].filter(Boolean).join(" ");
  return normalizeCardLimitName(contextText).includes(normalizedPrefix);
}

function applyDeckPolicyRules(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>
): { handResetAdded?: DeckCard } {
  if (hasAnyCardName(cards, handResetCardNames)) return {};

  const handResetCard = findFirstAvailableCard(cardsByName, handResetCardNames);
  if (!handResetCard?.name) return {};

  makeRoomForRequiredCard(cards, 1, [handResetCard.name]);
  const requiredCard: DeckCard = {
    cardId: handResetCard.cardId,
    cardName: handResetCard.name,
    illustration: handResetCard.imageUrl,
    count: 1,
  };
  const rejected = addDeckCardWithLimits(cards, requiredCard);
  return rejected === 0 ? { handResetAdded: requiredCard } : {};
}

function hasAnyCardName(cards: DeckCard[], names: string[]) {
  const normalizedNames = new Set(names.map(normalizeCardLimitName));
  return cards.some((card) => normalizedNames.has(normalizeCardLimitName(card.cardName)));
}

function findFirstAvailableCard(cardsByName: Map<string, StaticCardDetail>, names: string[]) {
  for (const name of names) {
    const card = cardsByName.get(normalizeCardLimitName(name));
    if (card?.name) return card;
  }
  return undefined;
}

function makeRoomForRequiredCard(cards: DeckCard[], requiredCount: number, protectedNames: string[]) {
  while (countDeckCards(cards) + requiredCount > targetDeckCardCount) {
    const removableIndex = findRemovableCardIndex(cards, protectedNames);
    if (removableIndex < 0) break;
    cards[removableIndex].count -= 1;
  }
}

function findRemovableCardIndex(cards: DeckCard[], protectedNames: string[]) {
  const protectedNameSet = new Set(protectedNames.map(normalizeCardLimitName));
  const isProtected = (card: DeckCard) => protectedNameSet.has(normalizeCardLimitName(card.cardName));

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    if (card.count > 0 && isBasicEnergyName(card.cardName) && !isProtected(card)) return index;
  }
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    if (card.count > 0 && !isProtected(card)) return index;
  }
  return -1;
}

function fillDeckWithStaples(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  let filled = 0;
  for (const staple of stapleCards) {
    if (countDeckCards(cards) >= targetDeckCardCount) break;
    const card = cardsByName.get(normalizeCardLimitName(staple.name));
    if (!card?.name) continue;
    const currentCount = countCardsWithSameName(cards, { cardName: card.name });
    const wantedCount = Math.max(0, staple.targetCount - currentCount);
    if (wantedCount <= 0) continue;
    const before = countDeckCards(cards);
    addDeckCardWithLimits(cards, {
      cardId: card.cardId,
      cardName: card.name,
      illustration: card.imageUrl,
      count: Math.min(wantedCount, targetDeckCardCount - countDeckCards(cards)),
    });
    filled += countDeckCards(cards) - before;
  }

  const energyName = context?.selectedType ? basicEnergyByType[context.selectedType] : undefined;
  if (energyName) {
    const card = cardsByName.get(normalizeCardLimitName(energyName));
    if (card?.name) {
      while (countDeckCards(cards) < targetDeckCardCount) {
        const before = countDeckCards(cards);
        addDeckCardWithLimits(cards, {
          cardId: card.cardId,
          cardName: card.name,
          illustration: card.imageUrl,
          count: targetDeckCardCount - before,
        });
        filled += countDeckCards(cards) - before;
        if (countDeckCards(cards) === before) break;
      }
    }
  }

  return filled;
}

function countDeckCards(cards: DeckCard[]) {
  return cards.reduce((sum, card) => sum + card.count, 0);
}
