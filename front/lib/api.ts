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
  setCode?: string;
  setName?: string;
  stage?: string;
  stageCategory?: "basic" | "evolution" | "unknown";
  evolvesFrom?: string;
  familyId?: string;
  stageOrder?: number;
  hp?: number;
  types?: string[];
  abilities?: Array<{ name?: string; text?: string }>;
  ruleText?: string;
  searchTokens?: string[];
  imageUrl?: string;
};

type StaticCardMaster = {
  cards?: Record<string, StaticCardDetail>;
};

type CardRole =
  | "pokemon_search"
  | "ball_search"
  | "evolution_support"
  | "hand_refresh"
  | "hand_disruption"
  | "switch"
  | "gust"
  | "energy_search"
  | "energy_acceleration"
  | "recovery"
  | "main_pokemon_only";

type AbilityRole =
  | "ability_draw"
  | "ability_search"
  | "ability_energy"
  | "ability_stadium"
  | "ability_recovery"
  | "ability_switch"
  | "ability_protection"
  | "ability_damage_boost"
  | "ability_lock";

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
const minimumPokemonSearchCardKinds = 2;
const pokemonSearchSupportCardNames = [
  "ハイパーボール",
  "なかよしポフィン",
  "プレシャスキャリー",
  "ポケパッド",
  "カナリィ",
  "ヒカリ",
  "タケシのスカウト",
  "トウコ",
];
const evolutionSupportCardNames = ["ふしぎなアメ", "ハイパーアロマ", "ヒカリ", "トウコ", "タケシのスカウト"];
const aceSpecCardNames = [
  "プライムキャッチャー",
  "アンフェアスタンプ",
  "マキシマムベルト",
  "ヒーローマント",
  "ハイパーアロマ",
  "サバイブギプス",
  "レガシーエネルギー",
  "ポケモン回収サイクロン",
  "シークレットボックス",
  "ニュートラルセンター",
  "デラックスボム",
  "プレシャスキャリー",
  "偉大な大樹",
  "きらめく結晶",
  "パーフェクトミキサー",
  "エネルギー転送PRO",
  "メガシグナル",
];
const handRefreshTargetCount = 4;
const systemPokemonTargetCount = 1;
const selfPositiveHandRefreshCardNames = [
  "リーリエの決心",
  "ゼイユ",
  "タロ",
  "ドラセナ",
  "ハイダイ",
  "アイリスの闘志",
  "サーファー",
  "ピュール",
];
const disruptionHandRefreshCardNames = ["ナンジャモ", "ジャッジマン", "ツツジ", "マリィ", "リセットスタンプ", "ゴヨウ", "クラウン"];
const genericSupportRolePriority: CardRole[] = ["switch", "gust", "recovery", "energy_search"];
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
  if (isAceSpecName(card.cardName)) return 1;
  return isBasicEnergyName(card.cardName) ? 60 : 4;
}

export function normalizeCardLimitName(name?: string): string {
  return (name || "").replace(/[ 　・\-－]/g, "").toLowerCase();
}

export function isAceSpecName(name?: string): boolean {
  const normalizedName = normalizeCardLimitName(name);
  return aceSpecCardNames.some((aceSpecName) => normalizeCardLimitName(aceSpecName) === normalizedName);
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
  const pokemonSearchRemoval = removeIncompatiblePokemonSearchCards(cards, cardMaster);
  const situationalRemoval = removeIncompatibleSituationalCards(cards, cardMaster, context);
  const aceSpecRemoval = enforceAceSpecLimit(cards, cardMaster);

  const trimmedCardCount = trimDeckToCount(cards, targetDeckCardCount);
  const requestedCardFix = addRequestedContextCards(cards, cardMaster, context);
  const evolutionLineFix = addMissingEvolutionLineCards(cards, cardMaster);
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
  if (pokemonSearchRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `対象ポケモンが不足しているサーチカードを除外しました: ${pokemonSearchRemoval.removedNames.slice(0, 5).join("、")}`,
    });
  }
  if (situationalRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `条件が厳しく汎用採用しにくいカードを除外しました: ${situationalRemoval.removedNames.slice(0, 5).join("、")}`,
    });
  }
  if (aceSpecRemoval.removedCount > 0) {
    warnings.push({
      type: "card_limit",
      message: `ACE SPECはデッキに1枚までのため調整しました: ${aceSpecRemoval.removedNames.slice(0, 5).join("、")}`,
    });
  }
  if (trimmedCardCount > 0) {
    warnings.push({
      type: "deck_count",
      message: `60枚を超えた${trimmedCardCount}枚を調整しました。`,
    });
  }
  if (requestedCardFix.addedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `入力された補足・中心ポケモンから指定カードを採用しました: ${requestedCardFix.addedNames.join("、")}`,
    });
  }
  if (evolutionLineFix.addedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `進化ポケモンに必要な進化前を補いました: ${evolutionLineFix.addedNames.join("、")}`,
    });
  }

  const appliedPolicyRules = applyDeckPolicyRules(cards, cardsByName, cardMaster, context);
  if (appliedPolicyRules.handRefreshAddedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ方針により、手札リフレッシュ枠を${handRefreshTargetCount}枚まで補いました: ${appliedPolicyRules.handRefreshAddedNames.join("、")}`,
    });
  }
  if (appliedPolicyRules.pokemonSearchAddedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ方針により、ポケモンサーチを${minimumPokemonSearchCardKinds}種類以上に補いました: ${appliedPolicyRules.pokemonSearchAddedNames.join("、")}`,
    });
  }
  if (appliedPolicyRules.mainPokemonSupportAddedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `入力されたメインポケモンを補助するカードを追加しました: ${appliedPolicyRules.mainPokemonSupportAddedNames.join("、")}`,
    });
  }
  if (appliedPolicyRules.systemPokemonAddedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ進行を補助する特性持ちポケモンを追加しました: ${appliedPolicyRules.systemPokemonAddedNames.join("、")}`,
    });
  }

  const filledCardCount = fillDeckWithStaples(cards, cardsByName, cardMaster, context);
  if (filledCardCount > 0) {
    warnings.push({
      type: "staple_fill",
      message: `不足分${filledCardCount}枚を汎用カードまたは基本エネルギーで補いました。`,
    });
  }
  const finalRequestedCardFix = addRequestedContextCards(cards, cardMaster, context);
  if (finalRequestedCardFix.addedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `補正後に外れた指定カードを戻しました: ${finalRequestedCardFix.addedNames.join("、")}`,
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
  const addableCount = Math.min(card.count, remainingCountForCardName(cards, card), remainingAceSpecCount(cards, card));
  if (addableCount <= 0) return card.count;
  const existing = cards.find((current) => current.cardId === card.cardId);
  if (existing) {
    existing.count += addableCount;
  } else {
    cards.push({ ...card, count: addableCount });
  }
  return card.count - addableCount;
}

function remainingAceSpecCount(cards: DeckCard[], card: Pick<DeckCard, "cardName">) {
  if (!isAceSpecName(card.cardName)) return Number.MAX_SAFE_INTEGER;
  return countAceSpecCards(cards) > 0 ? 0 : 1;
}

function countAceSpecCards(cards: DeckCard[]) {
  return cards.reduce((sum, card) => {
    return isAceSpecName(card.cardName) ? sum + card.count : sum;
  }, 0);
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

function removeIncompatiblePokemonSearchCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  const removedNames: string[] = [];
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || canPokemonSearchCardFitDeck(masterCard, cards, cardMaster)) continue;

    removedNames.push(card.cardName || masterCard.name || card.cardId);
    cards.splice(index, 1);
  }
  return {
    removedCount: removedNames.length,
    removedNames: removedNames.reverse(),
  };
}

function removeIncompatibleSituationalCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const removedNames: string[] = [];
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || !isHighRiskSituationalSupport(masterCard) || contextMatchesTheme(context, masterCard.name || "")) {
      continue;
    }

    removedNames.push(card.cardName || masterCard.name || card.cardId);
    cards.splice(index, 1);
  }
  return {
    removedCount: removedNames.length,
    removedNames: removedNames.reverse(),
  };
}

function isHighRiskSituationalSupport(card: StaticCardDetail) {
  if (card.cardKind !== "trainer" || !String(card.subKind || "").includes("サポート")) return false;
  const text = normalizeRuleText(getCardSearchableText(card));
  return text.includes("このカードは、自分の手札がこのカード1枚だけのときにしか使えない") ||
    (/ルールを持つポケモン.*のぞく/.test(text) && text.includes("ダメージ"));
}

function enforceAceSpecLimit(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  const removedNames: string[] = [];
  let hasKeptAceSpec = false;

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!isAceSpecCard(masterCard, card)) continue;

    const cardName = card.cardName || masterCard?.name || card.cardId;
    if (!hasKeptAceSpec) {
      hasKeptAceSpec = true;
      if (card.count > 1) {
        removedNames.push(cardName);
        card.count = 1;
      }
      continue;
    }

    removedNames.push(cardName);
    card.count = 0;
  }

  return {
    removedCount: removedNames.length,
    removedNames,
  };
}

function isAceSpecCard(masterCard: StaticCardDetail | undefined, card: Pick<DeckCard, "cardName">) {
  const text = [
    masterCard?.name,
    masterCard?.ruleText,
    ...(masterCard?.searchTokens || []),
    card.cardName,
  ].filter(Boolean).join(" ");
  return /ACE\s*SPEC|エーススペック/i.test(text) || isAceSpecName(masterCard?.name || card.cardName);
}

function classifyCardRoles(card: StaticCardDetail): Set<CardRole> {
  const roles = new Set<CardRole>();
  if (card.cardKind !== "trainer") return roles;

  const text = getCardSearchableText(card);
  const normalizedText = normalizeRuleText(text);
  const normalizedName = normalizeCardLimitName(card.name);

  if (isPokemonSearchCard(card)) {
    roles.add("pokemon_search");
    if (/ボール|ポフィン|キャリー|アロマ/.test(card.name || "")) {
      roles.add("ball_search");
    }
  }
  if (
    normalizedName === normalizeCardLimitName("ふしぎなアメ") ||
    normalizedText.includes("進化") ||
    normalizedText.includes("たねポケモンから進化")
  ) {
    roles.add("evolution_support");
  }
  if (isSelfPositiveHandRefreshCard(card)) {
    roles.add("hand_refresh");
  }
  if (isHandDisruptionCard(card)) {
    roles.add("hand_disruption");
  }
  if (/バトルポケモン.*ベンチポケモン.*入れ替|ベンチポケモン.*バトルポケモン.*入れ替/.test(normalizedText)) {
    roles.add("switch");
  }
  if (/相手.*ベンチポケモン.*バトル場|相手.*ベンチ.*入れ替/.test(normalizedText)) {
    roles.add("gust");
  }
  if (/自分の山札.*エネルギー.*手札|山札.*基本エネルギー.*手札/.test(normalizedText)) {
    roles.add("energy_search");
  }
  if (/山札.*エネルギー.*つけ|トラッシュ.*エネルギー.*つけ|エネルギー.*加速/.test(normalizedText)) {
    roles.add("energy_acceleration");
  }
  if (/トラッシュ.*(手札|山札|ベンチ)|回収/.test(normalizedText)) {
    roles.add("recovery");
  }
  if (getRequiredPokemonGroups(card).length > 0) {
    roles.add("main_pokemon_only");
  }

  return roles;
}

function cardHasRole(card: StaticCardDetail, role: CardRole) {
  return classifyCardRoles(card).has(role);
}

function classifyAbilityRoles(card: StaticCardDetail): Set<AbilityRole> {
  const roles = new Set<AbilityRole>();
  if (card.cardKind !== "pokemon" || !card.abilities?.length) return roles;

  const abilityText = normalizeRuleText(getAbilitySearchableText(card));
  if (!abilityText) return roles;

  if (/山札.*引く|山札を[0-9０-９]+枚引く|カードを.*引く|手札が.*枚になるように.*引/.test(abilityText)) {
    roles.add("ability_draw");
  }
  if (/自分の山札.*選び.*手札|自分の山札.*選び.*ベンチ|自分の山札.*選び.*場|山札から.*選び/.test(abilityText)) {
    roles.add("ability_search");
  }
  if (/エネルギー.*つけ|エネルギー.*加速|エネルギー.*好きなようにつけ|エネルギー.*トラッシュ.*つけ/.test(abilityText)) {
    roles.add("ability_energy");
  }
  if (/山札.*スタジアム.*手札|スタジアム.*選び.*手札/.test(abilityText)) {
    roles.add("ability_stadium");
  }
  if (/トラッシュ.*(手札|山札|ベンチ)|回収|HPを.*回復|すべて回復/.test(abilityText)) {
    roles.add("ability_recovery");
  }
  if (/入れ替える|ベンチにもど|バトルポケモンと入れ替/.test(abilityText)) {
    roles.add("ability_switch");
  }
  if (/受けない|ダメージ.*-[0-9０-９]+|守る|効果を受けない|特性.*なくなる/.test(abilityText)) {
    roles.add("ability_protection");
  }
  if (/ダメージ.*\\+[0-9０-９]+|ワザのダメージ.*上が|ダメージは.*追加/.test(abilityText)) {
    roles.add("ability_damage_boost");
  }
  if (/相手.*特性.*なくなる|相手.*使えない|相手.*できない|相手.*手札|相手.*山札/.test(abilityText)) {
    roles.add("ability_lock");
  }

  return roles;
}

function getAbilitySearchableText(card: StaticCardDetail) {
  return (card.abilities || [])
    .map((ability) => [ability.name, ability.text].filter(Boolean).join(" "))
    .join(" ");
}

function getCardSearchableText(card: StaticCardDetail) {
  return [
    card.name,
    card.subKind,
    card.stage,
    card.ruleText,
    ...(card.searchTokens || []),
  ].filter(Boolean).join(" ");
}

function isSelfPositiveHandRefreshCard(card: StaticCardDetail) {
  const text = normalizeRuleText(getCardSearchableText(card));
  const name = normalizeCardLimitName(card.name);
  if (selfPositiveHandRefreshCardNames.some((cardName) => normalizeCardLimitName(cardName) === name)) return true;
  if (!/(引く|山札を引|カードを.*引)/.test(text)) return false;
  if (/相手の手札|おたがいのプレイヤー.*手札/.test(text)) return false;
  return /自分.*山札.*引|手札.*山札.*引|トラッシュ.*山札.*引|枚ぶん山札を引/.test(text);
}

function isHandDisruptionCard(card: StaticCardDetail) {
  const text = normalizeRuleText(getCardSearchableText(card));
  const name = normalizeCardLimitName(card.name);
  if (disruptionHandRefreshCardNames.some((cardName) => normalizeCardLimitName(cardName) === name)) return true;
  return /相手の手札|相手プレイヤーの手札|おたがいのプレイヤー.*手札.*山札|相手.*手札を.*山札|相手.*手札.*引き直|手札干渉/.test(text);
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

function canPokemonSearchCardFitDeck(
  card: StaticCardDetail,
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  const requirements = getPokemonSearchRequirements(card);
  if (requirements.length === 0) return true;

  return requirements.every((requirement) => {
    return requirement.some((condition) => hasPokemonMatchingCondition(deckCards, cardMaster, condition));
  });
}

type PokemonSearchCondition = {
  stage?: "basic" | "stage1" | "stage2" | "evolution";
  hpMax?: number;
  excludesRuleBox?: boolean;
  ownerPrefix?: string;
};

function getPokemonSearchRequirements(card: StaticCardDetail): PokemonSearchCondition[][] {
  if (card.cardKind !== "trainer") return [];
  const text = normalizeRuleText(card.ruleText);
  if (!text.includes("自分の山札") || !text.includes("ポケモン")) return [];
  if (text.includes("相手の山札")) return [];

  const baseCondition: PokemonSearchCondition = {
    hpMax: extractHpMax(text),
    excludesRuleBox: text.includes("ルールを持つポケモンをのぞく") || text.includes("ルールを持つポケモン」をのぞく"),
    ownerPrefix: extractOwnerPrefix(text),
  };
  const quotedStageRequirements = extractQuotedStageRequirements(text, baseCondition);
  if (quotedStageRequirements.length > 0) return quotedStageRequirements;

  const stageConditions = extractStageConditions(text, baseCondition);
  if (stageConditions.length > 0) return [stageConditions];
  return [[{ ...baseCondition }]];
}

function normalizeRuleText(text?: string) {
  return (text || "").replace(/[ 　]/g, "");
}

function extractHpMax(text: string) {
  const match = text.match(/HP(?:が)?「?([0-9０-９]+)」?以下/);
  if (!match) return undefined;
  return Number(match[1].replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)));
}

function extractOwnerPrefix(text: string) {
  const match = text.match(/「([^」]+のポケモン)」/);
  if (!match || !isSpecificPokemonGroup(match[1])) return undefined;
  return match[1].replace(/ポケモン$/, "");
}

function extractQuotedStageRequirements(text: string, baseCondition: PokemonSearchCondition) {
  const stageNames = [...text.matchAll(/「(たねポケモン|1進化ポケモン|2進化ポケモン)」/g)].map((match) => match[1]);
  const uniqueStageNames = Array.from(new Set(stageNames));
  return uniqueStageNames.map((stageName) => [{ ...baseCondition, stage: stageNameToCondition(stageName) }]);
}

function extractStageConditions(text: string, baseCondition: PokemonSearchCondition) {
  const conditions: PokemonSearchCondition[] = [];
  if (text.includes("たねポケモン")) conditions.push({ ...baseCondition, stage: "basic" });
  if (text.includes("1進化ポケモン")) conditions.push({ ...baseCondition, stage: "stage1" });
  if (text.includes("2進化ポケモン")) conditions.push({ ...baseCondition, stage: "stage2" });
  if (conditions.length === 0 && text.includes("進化ポケモン")) {
    conditions.push({ ...baseCondition, stage: "evolution" });
  }
  return conditions;
}

function stageNameToCondition(stageName: string): PokemonSearchCondition["stage"] {
  if (stageName === "たねポケモン") return "basic";
  if (stageName === "1進化ポケモン") return "stage1";
  if (stageName === "2進化ポケモン") return "stage2";
  return undefined;
}

function hasPokemonMatchingCondition(
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  condition: PokemonSearchCondition
) {
  return deckCards.some((deckCard) => {
    const pokemon = cardMaster[deckCard.cardId];
    if (!pokemon || pokemon.cardKind !== "pokemon") return false;
    return pokemonMatchesCondition(pokemon, condition);
  });
}

function pokemonMatchesCondition(pokemon: StaticCardDetail, condition: PokemonSearchCondition) {
  if (condition.stage && !pokemonMatchesStage(pokemon, condition.stage)) return false;
  if (condition.hpMax !== undefined && (pokemon.hp === undefined || pokemon.hp > condition.hpMax)) return false;
  if (condition.excludesRuleBox && isRuleBoxPokemon(pokemon)) return false;
  if (condition.ownerPrefix && !normalizeCardLimitName(pokemon.name).startsWith(normalizeCardLimitName(condition.ownerPrefix))) {
    return false;
  }
  return true;
}

function pokemonMatchesStage(pokemon: StaticCardDetail, stage: NonNullable<PokemonSearchCondition["stage"]>) {
  const normalizedStage = normalizeCardLimitName(pokemon.stage);
  if (stage === "basic") return pokemon.stageCategory === "basic" || normalizedStage.includes("たね");
  if (stage === "stage1") return normalizedStage.includes("1進化");
  if (stage === "stage2") return normalizedStage.includes("2進化");
  return pokemon.stageCategory === "evolution" || normalizedStage.includes("進化");
}

function isRuleBoxPokemon(pokemon: StaticCardDetail) {
  const text = `${pokemon.name || ""} ${pokemon.ruleText || ""}`;
  return /ポケモンex|メガシンカex|VSTAR|VMAX|V-UNION|ポケモンV/.test(text);
}

function addRequestedContextCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const requestedCards = getRequestedContextCards(cardMaster, context);
  const addedNames: string[] = [];
  const protectedNames = requestedCards.map((card) => card.name || "").filter(Boolean);

  for (const requested of requestedCards) {
    if (!requested.name) continue;
    if (countCardsWithSameName(cards, { cardName: requested.name }) > 0) continue;

    if (isAceSpecCard(requested, { cardName: requested.name })) {
      removeOtherAceSpecCards(cards, cardMaster, requested.name);
    }

    makeRoomForRequiredCard(cards, 1, protectedNames);
    const before = countCardsWithSameName(cards, { cardName: requested.name });
    addDeckCardWithLimits(cards, {
      cardId: requested.cardId,
      cardName: requested.name,
      illustration: requested.imageUrl,
      count: 1,
    });
    if (countCardsWithSameName(cards, { cardName: requested.name }) > before) {
      addedNames.push(requested.name);
    }
  }

  return {
    addedCount: addedNames.length,
    addedNames: uniqueNames(addedNames),
  };
}

function getRequestedContextCards(
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const contextText = [
    context?.pokemonName,
    context?.supplementalTheme,
  ].filter(Boolean).join(" ");
  const normalizedText = normalizeCardLimitName(contextText);
  if (!normalizedText) return [];

  const requestedCards: StaticCardDetail[] = [];
  const addRequestedCard = (card: StaticCardDetail | undefined) => {
    if (!card?.name) return;
    if (requestedCards.some((current) => normalizeCardLimitName(current.name) === normalizeCardLimitName(card.name))) return;
    requestedCards.push(card);
  };

  const cards = Object.values(cardMaster);
  const exactMatchesByName = new Map<string, StaticCardDetail>();
  for (const card of cards) {
    const normalizedName = normalizeCardLimitName(card.name);
    if (normalizedName.length < 3 || !normalizedText.includes(normalizedName)) continue;
    const current = exactMatchesByName.get(normalizedName);
    if (!current || compareRequestedCardPriority(card, current) < 0) {
      exactMatchesByName.set(normalizedName, card);
    }
  }
  [...exactMatchesByName.values()]
    .sort(compareRequestedCardPriority)
    .forEach(addRequestedCard);

  for (const term of getRequestedContextTerms(contextText)) {
    if (requestedCards.length >= 6) break;
    const candidate = cards
      .filter((card) => {
        const normalizedName = normalizeCardLimitName(card.name);
        return normalizedName.length >= 3 && normalizedName.includes(term);
      })
      .sort((a, b) => compareRequestedCardForTerm(a, b, term))[0];
    addRequestedCard(candidate);
  }

  return requestedCards.slice(0, 6);
}

function getRequestedContextTerms(contextText: string) {
  const noiseWords = [
    "デッキ",
    "カード",
    "ポケモン",
    "使いたい",
    "使用したい",
    "中心",
    "メイン",
    "主体",
    "採用",
    "入れる",
    "入れて",
    "構築",
    "補助",
    "相性",
    "軸",
    "型",
  ];
  const rawTerms = contextText.split(/[\s　,、。・/／＋+&＆()（）「」『』【】\[\]\n\r]+/);
  const terms = new Set<string>();

  for (const rawTerm of rawTerms) {
    for (const fragment of rawTerm.split(/[をがはにでへ]/)) {
      const normalized = normalizeCardLimitName(removeRequestNoiseWords(fragment, noiseWords));
      if (normalized.length < 3 || noiseWords.some((word) => normalizeCardLimitName(word) === normalized)) continue;
      terms.add(normalized);
    }
  }

  return [...terms];
}

function removeRequestNoiseWords(term: string, noiseWords: string[]) {
  return noiseWords.reduce((current, word) => current.replaceAll(word, ""), term);
}

function compareRequestedCardForTerm(a: StaticCardDetail, b: StaticCardDetail, term: string) {
  const normalizedA = normalizeCardLimitName(a.name);
  const normalizedB = normalizeCardLimitName(b.name);
  const aExact = normalizedA === term ? 0 : 1;
  const bExact = normalizedB === term ? 0 : 1;
  if (aExact !== bExact) return aExact - bExact;

  const aStartsWith = normalizedA.startsWith(term) ? 0 : 1;
  const bStartsWith = normalizedB.startsWith(term) ? 0 : 1;
  if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;

  const aPokemon = a.cardKind === "pokemon" ? 0 : 1;
  const bPokemon = b.cardKind === "pokemon" ? 0 : 1;
  if (aPokemon !== bPokemon) return aPokemon - bPokemon;

  return compareRequestedCardPriority(a, b);
}

function compareRequestedCardPriority(a: StaticCardDetail, b: StaticCardDetail) {
  const nameLengthDiff = normalizeCardLimitName(a.name).length - normalizeCardLimitName(b.name).length;
  if (nameLengthDiff !== 0) return nameLengthDiff;

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
}

function removeOtherAceSpecCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  requestedName: string
) {
  const normalizedRequestedName = normalizeCardLimitName(requestedName);
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!isAceSpecCard(masterCard, card)) continue;
    if (normalizeCardLimitName(card.cardName || masterCard?.name) === normalizedRequestedName) continue;
    cards.splice(index, 1);
  }
}

function addMissingEvolutionLineCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  const addedNames: string[] = [];
  const evolutionCards = cards
    .map((card) => ({ deckCard: card, masterCard: cardMaster[card.cardId] }))
    .filter(({ masterCard }) => masterCard?.cardKind === "pokemon" && Number(masterCard.stageOrder || 0) > 0);

  for (const { deckCard, masterCard } of evolutionCards) {
    if (!masterCard) continue;
    const chain = inferEvolutionLine(masterCard, cardMaster);
    const protectedLineNames = [masterCard.name || "", ...chain.map((card) => card.name || "")];
    for (const preEvolution of chain) {
      const wantedCount = getWantedPreEvolutionCount(masterCard, preEvolution, deckCard.count);
      const currentCount = countCardsWithSameName(cards, { cardName: preEvolution.name });
      const addCount = Math.max(0, wantedCount - currentCount);
      if (addCount <= 0) continue;

      makeRoomForRequiredCard(cards, addCount, protectedLineNames);
      const before = countCardsWithSameName(cards, { cardName: preEvolution.name });
      addDeckCardWithLimits(cards, {
        cardId: preEvolution.cardId,
        cardName: preEvolution.name,
        illustration: preEvolution.imageUrl,
        count: addCount,
      });
      if (countCardsWithSameName(cards, { cardName: preEvolution.name }) > before && preEvolution.name) {
        addedNames.push(preEvolution.name);
      }
    }
  }

  return {
    addedCount: addedNames.length,
    addedNames: uniqueNames(addedNames),
  };
}

function inferEvolutionLine(target: StaticCardDetail, cardMaster: Record<string, StaticCardDetail>) {
  const stageOrder = Number(target.stageOrder || 0);
  const chain: StaticCardDetail[] = [];
  if (stageOrder <= 0) return chain;

  let current = target;
  for (let desiredStage = stageOrder - 1; desiredStage >= 0; desiredStage -= 1) {
    const previous = findPreviousEvolutionStage(current, desiredStage, cardMaster);
    if (!previous) break;
    chain.unshift(previous);
    current = previous;
  }
  return chain;
}

function findPreviousEvolutionStage(
  target: StaticCardDetail,
  desiredStageOrder: number,
  cardMaster: Record<string, StaticCardDetail>
) {
  const targetId = Number(target.cardId);
  if (!Number.isFinite(targetId)) return undefined;

  const candidates = Object.values(cardMaster)
    .filter((card) => {
      const cardId = Number(card.cardId);
      if (!Number.isFinite(cardId) || cardId >= targetId) return false;
      if (target.setName && card.setName !== target.setName) return false;
      if (target.setCode && card.setCode !== target.setCode) return false;
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== desiredStageOrder) return false;
      return targetId - cardId <= 12;
    })
    .sort((a, b) => Number(b.cardId) - Number(a.cardId));

  return candidates[0];
}

function getWantedPreEvolutionCount(
  finalEvolution: StaticCardDetail,
  preEvolution: StaticCardDetail,
  finalCount: number
) {
  const finalStageOrder = Number(finalEvolution.stageOrder || 0);
  const preStageOrder = Number(preEvolution.stageOrder || 0);
  if (preStageOrder === 0) {
    return Math.min(4, Math.max(3, finalCount + 1));
  }
  if (finalStageOrder >= 2 && preStageOrder === 1) {
    return Math.min(3, Math.max(1, finalCount));
  }
  return Math.min(4, Math.max(2, finalCount));
}

function applyDeckPolicyRules(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
): {
  handRefreshAddedCount: number;
  handRefreshAddedNames: string[];
  pokemonSearchAddedCount: number;
  pokemonSearchAddedNames: string[];
  mainPokemonSupportAddedCount: number;
  mainPokemonSupportAddedNames: string[];
  systemPokemonAddedCount: number;
  systemPokemonAddedNames: string[];
} {
  const pokemonSearchAddedNames = addMissingPokemonSearchKinds(cards, cardsByName, cardMaster);
  const mainPokemonSupportAddedNames = addMainPokemonSupportCards(cards, cardsByName, cardMaster, context);
  const systemPokemonAddedNames = addSystemPokemonSupportCards(cards, cardMaster, context);
  const handRefreshNames = getHandRefreshPolicyNames(context, cardMaster);
  const currentCount = countCardsByNames(cards, handRefreshNames.all);
  let remainingCount = Math.max(0, handRefreshTargetCount - currentCount);
  if (remainingCount === 0) {
    return {
      handRefreshAddedCount: 0,
      handRefreshAddedNames: [],
      pokemonSearchAddedCount: pokemonSearchAddedNames.length,
      pokemonSearchAddedNames,
      mainPokemonSupportAddedCount: mainPokemonSupportAddedNames.length,
      mainPokemonSupportAddedNames,
      systemPokemonAddedCount: systemPokemonAddedNames.length,
      systemPokemonAddedNames,
    };
  }

  const addedNames: string[] = [];
  if (isHandDisruptionTheme(context)) {
    const disruptionCurrentCount = countCardsByNames(cards, handRefreshNames.disruption);
    const disruptionWantedCount = Math.max(0, Math.min(2, handRefreshTargetCount) - disruptionCurrentCount);
    const addedCount = addCardsFromPolicyCandidates(
      cards,
      cardsByName,
      handRefreshNames.disruption,
      disruptionWantedCount,
      addedNames
    );
    remainingCount -= addedCount;
  }

  addCardsFromPolicyCandidates(cards, cardsByName, handRefreshNames.selfPositive, remainingCount, addedNames);
  return {
    handRefreshAddedCount: addedNames.length,
    handRefreshAddedNames: addedNames,
    pokemonSearchAddedCount: pokemonSearchAddedNames.length,
    pokemonSearchAddedNames,
    mainPokemonSupportAddedCount: mainPokemonSupportAddedNames.length,
    mainPokemonSupportAddedNames,
    systemPokemonAddedCount: systemPokemonAddedNames.length,
    systemPokemonAddedNames,
  };
}

function countCardsByNames(cards: DeckCard[], names: string[]) {
  const normalizedNames = new Set(names.map(normalizeCardLimitName));
  return cards.reduce((sum, card) => {
    return normalizedNames.has(normalizeCardLimitName(card.cardName)) ? sum + card.count : sum;
  }, 0);
}

function addMissingPokemonSearchKinds(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  cardMaster: Record<string, StaticCardDetail>
) {
  const addedNames: string[] = [];
  const candidateNames = getPolicyCandidateNames(pokemonSearchSupportCardNames, cardMaster, "pokemon_search");
  while (countPokemonSearchCardKinds(cards, cardMaster) < minimumPokemonSearchCardKinds) {
    const existingSearchNames = getPokemonSearchCardNames(cards, cardMaster);
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, (card) => {
      return !existingSearchNames.has(normalizeCardLimitName(card.name)) &&
        cardHasRole(card, "pokemon_search") &&
        canPokemonSearchCardFitDeck(card, cards, cardMaster);
    });
    if (!candidate?.name) break;
    if (addSinglePolicyCard(cards, candidate, addedNames) === 0) break;
  }
  return addedNames;
}

function countPokemonSearchCardKinds(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  return getPokemonSearchCardNames(cards, cardMaster).size;
}

function getPokemonSearchCardNames(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  const names = new Set<string>();
  for (const card of cards) {
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || !isPokemonSearchCard(masterCard) || !canPokemonSearchCardFitDeck(masterCard, cards, cardMaster)) continue;
    names.add(normalizeCardLimitName(masterCard.name));
  }
  return names;
}

function isPokemonSearchCard(card: StaticCardDetail) {
  return getPokemonSearchRequirements(card).length > 0;
}

function addMainPokemonSupportCards(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (!context?.pokemonName?.trim()) return [];
  const addedNames: string[] = [];
  const candidateNames = getMainPokemonSupportCandidateNames(cards, cardMaster);
  addCardsFromPolicyCandidates(cards, cardsByName, candidateNames, 2, addedNames, (card) => {
    return canMainPokemonSupportCardFitDeck(card, cards, cardMaster);
  });
  return addedNames;
}

function getMainPokemonSupportCandidateNames(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  const hasStage2 = cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard?.cardKind === "pokemon" && pokemonMatchesStage(masterCard, "stage2");
  });
  const hasEvolution = cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard?.cardKind === "pokemon" && pokemonMatchesStage(masterCard, "evolution");
  });
  const evolutionNames = getPolicyCandidateNames(evolutionSupportCardNames, cardMaster, "evolution_support");
  const searchNames = getPolicyCandidateNames(pokemonSearchSupportCardNames, cardMaster, "pokemon_search");
  if (hasStage2) return uniqueNames([...evolutionNames, ...searchNames]);
  if (hasEvolution) return uniqueNames(evolutionNames.filter((name) => name !== "ふしぎなアメ").concat(searchNames));
  return searchNames;
}

function canMainPokemonSupportCardFitDeck(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  if (card.name === "ふしぎなアメ") return canRareCandyFitDeck(cards, cardMaster);
  if (isPokemonSearchCard(card)) return canPokemonSearchCardFitDeck(card, cards, cardMaster);
  return true;
}

function addSystemPokemonSupportCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const addedNames: string[] = [];
  if (countSystemPokemon(cards, cardMaster) >= systemPokemonTargetCount) return addedNames;

  const preferredRoles = getPreferredAbilityRoles(cards, cardMaster, context);
  const candidate = Object.values(cardMaster)
    .sort((a, b) => Number(b.cardId) - Number(a.cardId))
    .find((card) => {
      if (!canAddSystemPokemon(card, cards, cardMaster, context)) return false;
      const roles = classifyAbilityRoles(card);
      return preferredRoles.some((role) => roles.has(role));
    });
  if (!candidate?.name) return addedNames;

  addSinglePolicyCard(cards, candidate, addedNames);
  return addedNames;
}

function countSystemPokemon(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  return cards.reduce((sum, card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard && isSystemPokemonCandidate(masterCard) ? sum + card.count : sum;
  }, 0);
}

function canAddSystemPokemon(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (!isSystemPokemonCandidate(card)) return false;
  if (!card.name || countCardsWithSameName(cards, { cardName: card.name }) > 0) return false;
  if (contextMatchesTheme(context, card.name)) return true;
  if (hasConflictingDedicatedAbility(card, cards, cardMaster, context)) return false;
  return true;
}

function isSystemPokemonCandidate(card: StaticCardDetail) {
  if (card.cardKind !== "pokemon" || !card.abilities?.length) return false;
  if (!pokemonMatchesStage(card, "basic")) return false;
  if (isRuleBoxPokemon(card)) return false;
  const roles = classifyAbilityRoles(card);
  return roles.has("ability_draw") ||
    roles.has("ability_search") ||
    roles.has("ability_energy") ||
    roles.has("ability_stadium") ||
    roles.has("ability_recovery") ||
    roles.has("ability_switch");
}

function hasConflictingDedicatedAbility(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const abilityText = getAbilitySearchableText(card);
  const matches = [...abilityText.matchAll(/「([^」]+)」/g)].map((match) => match[1]);
  const dedicatedNames = matches.filter((name) => {
    return !["基本 エネルギー", "基本エネルギー"].includes(name) && !name.includes("ポケモンex");
  });
  if (dedicatedNames.length === 0) return false;
  return !dedicatedNames.some((name) => hasThemePokemon(cards, cardMaster, name) || contextMatchesTheme(context, name));
}

function getPreferredAbilityRoles(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
): AbilityRole[] {
  const roles: AbilityRole[] = [];
  if (isHandDisruptionTheme(context)) {
    roles.push("ability_lock");
  }
  if (deckUsesEvolution(cards, cardMaster)) {
    roles.push("ability_draw", "ability_search");
  }
  if (context?.selectedType) {
    roles.push("ability_energy");
  }
  roles.push("ability_draw", "ability_search", "ability_stadium", "ability_recovery", "ability_switch");
  return Array.from(new Set(roles));
}

function deckUsesEvolution(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  return cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard?.cardKind === "pokemon" && pokemonMatchesStage(masterCard, "evolution");
  });
}

function canRareCandyFitDeck(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>) {
  const hasBasic = cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard?.cardKind === "pokemon" && pokemonMatchesStage(masterCard, "basic");
  });
  const hasStage2 = cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return masterCard?.cardKind === "pokemon" && pokemonMatchesStage(masterCard, "stage2");
  });
  return hasBasic && hasStage2;
}

function getHandRefreshPolicyNames(context: GenerateDeckContext | undefined, cardMaster: Record<string, StaticCardDetail>) {
  const selfPositive = getPolicyCandidateNames(selfPositiveHandRefreshCardNames, cardMaster, "hand_refresh")
    .filter((name) => !disruptionHandRefreshCardNames.some((cardName) => normalizeCardLimitName(cardName) === normalizeCardLimitName(name)));
  const disruption = isHandDisruptionTheme(context)
    ? getPolicyCandidateNames(disruptionHandRefreshCardNames, cardMaster, "hand_disruption")
    : [];
  return {
    selfPositive,
    disruption,
    all: uniqueNames([...selfPositive, ...disruption]),
  };
}

function isHandDisruptionTheme(context?: GenerateDeckContext) {
  const contextText = [
    context?.selectedPlan,
    context?.pokemonName,
    context?.supplementalTheme,
  ].filter(Boolean).join(" ");
  return /手札干渉|ハンデス|妨害|相手の手札|手札破壊|ジャッジマン|ナンジャモ|ツツジ|マリィ/.test(contextText);
}

function addCardsFromPolicyCandidates(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  candidateNames: string[],
  wantedCount: number,
  addedNames: string[],
  canAddCard: (card: StaticCardDetail) => boolean = () => true
) {
  let addedCount = 0;
  while (addedCount < wantedCount) {
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, canAddCard);
    if (!candidate?.name) break;

    const didAdd = addSinglePolicyCard(cards, candidate, addedNames);
    if (didAdd === 0) break;
    addedCount += didAdd;
  }
  return addedCount;
}

function addSinglePolicyCard(cards: DeckCard[], candidate: StaticCardDetail, addedNames: string[]) {
  if (!candidate.name) return 0;
  makeRoomForRequiredCard(cards, 1, [candidate.name]);
  const before = countCardsWithSameName(cards, { cardName: candidate.name });
  const rejected = addDeckCardWithLimits(cards, {
    cardId: candidate.cardId,
    cardName: candidate.name,
    illustration: candidate.imageUrl,
    count: 1,
  });
  const didAdd = rejected === 0 && countCardsWithSameName(cards, { cardName: candidate.name }) > before;
  if (!didAdd) return 0;
  addedNames.push(candidate.name);
  return 1;
}

function findAddablePolicyCard(
  cards: DeckCard[],
  cardsByName: Map<string, StaticCardDetail>,
  candidateNames: string[],
  canAddCard: (card: StaticCardDetail) => boolean = () => true
) {
  for (const name of candidateNames) {
    const card = cardsByName.get(normalizeCardLimitName(name));
    if (card && isAceSpecCard(card, { cardName: card.name })) continue;
    if (card?.name && remainingCountForCardName(cards, { cardName: card.name }) > 0 && canAddCard(card)) return card;
  }
  return undefined;
}

function getPolicyCandidateNames(
  preferredNames: string[],
  cardMaster: Record<string, StaticCardDetail>,
  role: CardRole
) {
  const roleNames = Object.values(cardMaster)
    .filter((card) => card.name && cardHasRole(card, role))
    .map((card) => card.name as string);
  return uniqueNames([...preferredNames, ...roleNames]);
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = normalizeCardLimitName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
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
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  let filled = 0;
  for (const staple of stapleCards) {
    if (countDeckCards(cards) >= targetDeckCardCount) break;
    const card = cardsByName.get(normalizeCardLimitName(staple.name));
    if (!card?.name) continue;
    if (!canPokemonSearchCardFitDeck(card, cards, cardMaster)) continue;
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

  for (const role of genericSupportRolePriority) {
    if (countDeckCards(cards) >= targetDeckCardCount) break;
    const candidateNames = getPolicyCandidateNames([], cardMaster, role);
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, (card) => {
      if (!canPokemonSearchCardFitDeck(card, cards, cardMaster)) return false;
      if (!isThemeLockedCardCompatible(card, cards, cardMaster, context)) return false;
      return true;
    });
    if (!candidate?.name) continue;
    const before = countDeckCards(cards);
    addDeckCardWithLimits(cards, {
      cardId: candidate.cardId,
      cardName: candidate.name,
      illustration: candidate.imageUrl,
      count: 1,
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
