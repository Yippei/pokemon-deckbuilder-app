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
  regenerationNonce?: string;
};

type StaticCardDetail = {
  cardId: string;
  name?: string;
  regulation?: string;
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
  attacks?: Array<{ name?: string; damage?: number | string; cost?: string[]; text?: string }>;
  abilities?: Array<{ name?: string; text?: string }>;
  ruleText?: string;
  searchTokens?: string[];
  imageUrl?: string;
  effectProfile?: unknown;
};

type StaticCardMaster = {
  cards?: Record<string, StaticCardDetail>;
};

type CardsByName = Map<string, StaticCardDetail[]>;

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
  | "deck_disruption"
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
  { name: "ポケパッド", targetCount: 2 },
  { name: "ボスの指令", targetCount: 2 },
  { name: "夜のタンカ", targetCount: 1 },
  { name: "なかよしポフィン", targetCount: 2 },
];
const minimumPokemonSearchCardKinds = 2;
const pokemonSearchGoodsTargetCount = 4;
const pokemonSearchSupportCardNames = [
  "ハイパーボール",
  "ポケパッド",
  "なかよしポフィン",
  "プレシャスキャリー",
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
  "ネオアッパーエネルギー",
  "リブートポッド",
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
const genericSupportRolePriority: CardRole[] = ["recovery"];
const humanCharacterNamePrefixes = [
  "アオキ",
  "アカギ",
  "アクロマ",
  "アセロラ",
  "アンズ",
  "ウォロ",
  "エリカ",
  "カイ",
  "カキ",
  "カスミ",
  "カツラ",
  "カナリィ",
  "キバナ",
  "グズマ",
  "クラベル",
  "グラジオ",
  "コルニ",
  "サカキ",
  "シロナ",
  "スグリ",
  "ゼイユ",
  "タケシ",
  "タロ",
  "ダンデ",
  "チリ",
  "ツツジ",
  "トウコ",
  "ナンジャモ",
  "ネモ",
  "ハイダイ",
  "ハウ",
  "ヒカリ",
  "ヒビキ",
  "ビワ",
  "フトゥー",
  "プルメリ",
  "ペパー",
  "ボタン",
  "マツバ",
  "マリィ",
  "ミモザ",
  "メロコ",
  "リーリエ",
];
const basicEnergyByType: Record<string, string> = {
  grass: "基本草エネルギー",
  fire: "基本炎エネルギー",
  water: "基本水エネルギー",
  electric: "基本雷エネルギー",
  psychic: "基本超エネルギー",
  fighting: "基本闘エネルギー",
  dark: "基本悪エネルギー",
};
const pokemonTypeByContextType: Record<string, string> = {
  grass: "草",
  fire: "炎",
  water: "水",
  electric: "雷",
  psychic: "超",
  fighting: "闘",
  dark: "悪",
};
const basicEnergyByPokemonType: Record<string, string> = {
  草: "基本草エネルギー",
  炎: "基本炎エネルギー",
  水: "基本水エネルギー",
  雷: "基本雷エネルギー",
  超: "基本超エネルギー",
  闘: "基本闘エネルギー",
  悪: "基本悪エネルギー",
  鋼: "基本鋼エネルギー",
};
const pokemonTypeByBasicEnergyName = Object.fromEntries(
  Object.entries(basicEnergyByPokemonType).map(([type, name]) => [normalizeCardLimitName(name), type])
);
const knownPreEvolutionByFamilyName: Record<string, string> = {
  シャワーズ: "イーブイ",
  サンダース: "イーブイ",
  ブースター: "イーブイ",
  エーフィ: "イーブイ",
  ブラッキー: "イーブイ",
  リーフィア: "イーブイ",
  グレイシア: "イーブイ",
  ニンフィア: "イーブイ",
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
  return (name || "")
    .replace(/[ぁ-ん]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(/[ 　・\-－]/g, "")
    .toLowerCase();
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
    const generationContext = {
      ...body.generationContext,
      regenerationNonce: body.generationContext?.regenerationNonce || crypto.randomUUID(),
    };
    const res = await authFetch(`${API_URL}/decks/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({
        theme: body.theme,
        generationContext,
      }),
    });
    if (!res.ok) throw new Error(await getAPIErrorMessage(res, "デッキの生成に失敗しました"));
    const data = await res.json();
    const parsed = GenerateDeckResultSchema.safeParse(data);
    if (!parsed.success) {
      console.warn("Invalid generated deck response", parsed.error.flatten());
      throw new Error("AIの生成結果の形式が正しくありません。もう一度生成してください。");
    }
    return await normalizeGeneratedDeck(parsed.data, generationContext);
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
  const offTypePokemonRemoval = removeIncompatibleOffTypePokemon(cards, cardMaster, context);
  const characterThemeRemoval = removeIncompatibleCharacterThemeCards(cards, cardMaster, context);
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
  if (offTypePokemonRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `選択タイプと噛み合わないポケモンを除外しました: ${offTypePokemonRemoval.removedNames.slice(0, 5).join("、")}`,
    });
  }
  if (characterThemeRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `キャラクター専用テーマカードを除外しました: ${characterThemeRemoval.removedNames.slice(0, 5).join("、")}`,
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
  if (evolutionLineFix.missingNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `進化前を推定できなかったカードがあります。手動で進化ラインを確認してください: ${evolutionLineFix.missingNames.slice(0, 5).join("、")}`,
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
      message: `デッキ方針により、ポケモンサーチを${minimumPokemonSearchCardKinds}種類以上、グッズは${pokemonSearchGoodsTargetCount}枚目安で補いました: ${appliedPolicyRules.pokemonSearchAddedNames.join("、")}`,
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

  const countAdjustment = adjustCardCountsByEffect(cards, cardMaster, context);
  if (countAdjustment.increasedNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `カード効果に合わせて採用枚数を増やしました: ${countAdjustment.increasedNames.slice(0, 5).join("、")}`,
    });
  }
  if (countAdjustment.reducedNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `条件が重いカードや補助カードの採用枚数を調整しました: ${countAdjustment.reducedNames.slice(0, 5).join("、")}`,
    });
  }

  const planBias = applySelectedPlanBias(cards, cardsByName, cardMaster, context);
  if (planBias.addedNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `選択方針を強めるカードを追加しました: ${planBias.addedNames.slice(0, 5).join("、")}`,
    });
  }

  const typeSpecificPolicy = applyTypeSpecificCardPolicy(cards, cardMaster, context);
  if (typeSpecificPolicy.addedNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `選択タイプに合う専用カードを追加しました: ${typeSpecificPolicy.addedNames.slice(0, 5).join("、")}`,
    });
  }

  const energyPolicy = applyEnergyRequirementPolicy(cards, cardsByName, cardMaster, context);
  if (energyPolicy.addedAccelerationNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `複数タイプのエネルギー要求に合わせて、エネ加速カードを追加しました: ${energyPolicy.addedAccelerationNames.slice(0, 5).join("、")}`,
    });
  }
  if (energyPolicy.addedBasicEnergyNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `ワザコストに合わせて基本エネルギーを補いました: ${energyPolicy.addedBasicEnergyNames.slice(0, 5).join("、")}`,
    });
  }
  if (energyPolicy.reducedSpecialEnergyNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `特殊エネルギーの採用を控えめに調整しました: ${energyPolicy.reducedSpecialEnergyNames.slice(0, 5).join("、")}`,
    });
  }

  const aceSpecChoice = applyOptimalAceSpecChoice(cards, cardsByName, cardMaster, context);
  if (aceSpecChoice.selectedName) {
    warnings.push({
      type: "deck_policy",
      message: `デッキ内容に合わせてACE SPECを選択しました: ${aceSpecChoice.selectedName}`,
    });
  }
  if (aceSpecChoice.removedNames.length > 0) {
    warnings.push({
      type: "card_limit",
      message: `選択したACE SPEC以外を除外しました: ${aceSpecChoice.removedNames.slice(0, 5).join("、")}`,
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
  const finalEvolutionLineFix = addMissingEvolutionLineCards(cards, cardMaster);
  if (finalEvolutionLineFix.addedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `最終補正で進化ポケモンに必要なたね・進化前を戻しました: ${finalEvolutionLineFix.addedNames.join("、")}`,
    });
  }
  if (finalEvolutionLineFix.missingNames.length > 0) {
    warnings.push({
      type: "deck_policy",
      message: `最終補正後も進化前を推定できないカードがあります。手動で進化ラインを確認してください: ${finalEvolutionLineFix.missingNames.slice(0, 5).join("、")}`,
    });
  }
  const finalCharacterThemeRemoval = removeIncompatibleCharacterThemeCards(cards, cardMaster, context);
  if (finalCharacterThemeRemoval.removedCount > 0) {
    warnings.push({
      type: "deck_policy",
      message: `最終補正で入り直したキャラクター専用テーマカードを除外しました: ${finalCharacterThemeRemoval.removedNames.slice(0, 5).join("、")}`,
    });
    const refilledCount = fillDeckWithStaples(cards, cardsByName, cardMaster, context);
    if (refilledCount > 0) {
      warnings.push({
        type: "staple_fill",
        message: `専用テーマカードを除外した不足分${refilledCount}枚を汎用カードまたは基本エネルギーで補いました。`,
      });
    }
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
  const cardsByName: CardsByName = new Map();
  for (const card of Object.values(cardMaster)) {
    if (!card.name) continue;
    const key = normalizeCardLimitName(card.name);
    const candidates = cardsByName.get(key) || [];
    candidates.push(card);
    cardsByName.set(key, candidates);
  }
  for (const candidates of cardsByName.values()) {
    candidates.sort(compareSameNameCardCandidatePriority);
  }
  return cardsByName;
}

function compareSameNameCardCandidatePriority(a: StaticCardDetail, b: StaticCardDetail) {
  const aHasEffectProfile = a.cardKind === "trainer" && Boolean(a.effectProfile) ? 0 : 1;
  const bHasEffectProfile = b.cardKind === "trainer" && Boolean(b.effectProfile) ? 0 : 1;
  if (aHasEffectProfile !== bHasEffectProfile) return aHasEffectProfile - bHasEffectProfile;

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
}

function addDeckCardWithLimits(cards: DeckCard[], card: DeckCard): number {
  const addableCount = Math.min(card.count, remainingCountForCardName(cards, card), remainingAceSpecCount(cards, card));
  if (addableCount <= 0) return card.count;
  const existing = cards.find((current) => normalizeCardLimitName(current.cardName) === normalizeCardLimitName(card.cardName));
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

function removeIncompatibleCharacterThemeCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const removedNames: string[] = [];
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || isCharacterThemeCardCompatible(masterCard, cards, cardMaster, context)) continue;

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

function removeIncompatibleOffTypePokemon(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const removedNames: string[] = [];
  if (!getSelectedPokemonType(context)) {
    return {
      removedCount: 0,
      removedNames,
    };
  }

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || isPokemonTypeCompatibleWithDeck(masterCard, cards, cardMaster, context)) continue;

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

type AceSpecChoiceResult = {
  selectedName?: string;
  removedNames: string[];
};

type DeckFeatureProfile = {
  plan: DeckPlan;
  pokemonCount: number;
  basicPokemonCount: number;
  evolutionPokemonCount: number;
  stage2PokemonCount: number;
  mainPokemonIsEvolution: boolean;
  mainPokemonIsStage2: boolean;
  ruleBoxPokemonCount: number;
  requiredEnergyTypeCount: number;
  maxAttackCost: number;
  pokemonSearchCount: number;
  handRefreshCount: number;
  switchCount: number;
  gustCount: number;
  recoveryCount: number;
};

function applyOptimalAceSpecChoice(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
): AceSpecChoiceResult {
  const explicitlyRequestedAceSpec = getRequestedContextCards(cardMaster, context)
    .find((card) => card.name && isAceSpecCard(card, { cardName: card.name }));
  if (explicitlyRequestedAceSpec?.name) {
    enforceSingleAceSpecByName(cards, cardMaster, explicitlyRequestedAceSpec.name);
    return { selectedName: undefined, removedNames: [] };
  }

  const bestAceSpec = selectOptimalAceSpecCard(cards, cardsByName, cardMaster, context);
  if (!bestAceSpec?.name) return { removedNames: [] };

  const removedNames = enforceSingleAceSpecByName(cards, cardMaster, bestAceSpec.name);
  const alreadyHasBest = countCardsWithSameName(cards, { cardName: bestAceSpec.name }) > 0;
  if (!alreadyHasBest) {
    const protectedNames = [
      bestAceSpec.name,
      ...getRequiredEvolutionLineNames(cards, cardMaster),
      ...getRequestedContextCards(cardMaster, context).map((card) => card.name || "").filter(Boolean),
    ];
    addSinglePolicyCard(cards, bestAceSpec, [], protectedNames);
  }

  return {
    selectedName: bestAceSpec.name,
    removedNames: uniqueNames(removedNames),
  };
}

function enforceSingleAceSpecByName(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  selectedName: string
) {
  const removedNames: string[] = [];
  const normalizedSelectedName = normalizeCardLimitName(selectedName);
  for (const card of cards) {
    const masterCard = cardMaster[card.cardId];
    if (!isAceSpecCard(masterCard, card)) continue;

    const cardName = card.cardName || masterCard?.name || card.cardId;
    if (normalizeCardLimitName(cardName) === normalizedSelectedName) {
      if (card.count > 1) {
        removedNames.push(cardName);
        card.count = 1;
      }
      continue;
    }

    if (card.count > 0) removedNames.push(cardName);
    card.count = 0;
  }
  return removedNames;
}

function selectOptimalAceSpecCard(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const featureProfile = buildDeckFeatureProfile(cards, cardMaster, context);
  const candidates = getAceSpecCandidates(cardsByName, cardMaster)
    .filter((card) => canUseAceSpecCandidate(card, cards, cardMaster, context))
    .sort((a, b) => {
      const scoreDiff = scoreAceSpecCandidate(b, featureProfile) - scoreAceSpecCandidate(a, featureProfile);
      if (scoreDiff !== 0) return scoreDiff;
      return compareSameNameCardCandidatePriority(a, b);
    });
  return candidates[0];
}

function getAceSpecCandidates(cardsByName: CardsByName, cardMaster: Record<string, StaticCardDetail>) {
  const names = uniqueNames([
    ...aceSpecCardNames,
    ...Object.values(cardMaster)
      .filter((card) => card.name && isAceSpecCard(card, { cardName: card.name }))
      .map((card) => card.name as string),
  ]);
  const candidates: StaticCardDetail[] = [];
  for (const name of names) {
    const card = findFirstCardCandidate(cardsByName, name, (candidate) => isAceSpecCard(candidate, { cardName: candidate.name }));
    if (card) candidates.push(card);
  }
  return candidates;
}

function canUseAceSpecCandidate(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (!card.name) return false;
  if (!isPolicyCandidateCompatible(card, cards, cardMaster, context)) return false;
  if (isPokemonSearchCard(card) && !canPokemonSearchCardFitDeck(card, cards, cardMaster)) return false;
  if (card.name === "ハイパーアロマ" && !deckUsesEvolution(cards, cardMaster)) return false;
  if (card.name === "偉大な大樹" && !deckUsesEvolution(cards, cardMaster)) return false;
  if (card.name === "ネオアッパーエネルギー" && countPokemonByStage(cards, cardMaster, "stage2") === 0) return false;
  return true;
}

function buildDeckFeatureProfile(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
): DeckFeatureProfile {
  const energyAnalysis = analyzeEnergyRequirements(cards, cardMaster, context);
  let pokemonCount = 0;
  let basicPokemonCount = 0;
  let evolutionPokemonCount = 0;
  let stage2PokemonCount = 0;
  let mainPokemonIsEvolution = false;
  let mainPokemonIsStage2 = false;
  let ruleBoxPokemonCount = 0;
  let maxAttackCost = 0;

  for (const deckCard of cards) {
    const masterCard = cardMaster[deckCard.cardId];
    if (!masterCard || masterCard.cardKind !== "pokemon") continue;
    pokemonCount += deckCard.count;
    if (pokemonMatchesStage(masterCard, "basic")) basicPokemonCount += deckCard.count;
    if (pokemonMatchesStage(masterCard, "evolution")) evolutionPokemonCount += deckCard.count;
    if (pokemonMatchesStage(masterCard, "stage2")) stage2PokemonCount += deckCard.count;
    if (isRuleBoxPokemon(masterCard)) ruleBoxPokemonCount += deckCard.count;
    if (isExactMainPokemon(masterCard, context)) {
      mainPokemonIsEvolution = pokemonMatchesStage(masterCard, "evolution");
      mainPokemonIsStage2 = pokemonMatchesStage(masterCard, "stage2");
    }
    for (const attack of masterCard.attacks || []) {
      maxAttackCost = Math.max(maxAttackCost, attack.cost?.length || 0);
    }
  }

  return {
    plan: getSelectedDeckPlan(context),
    pokemonCount,
    basicPokemonCount,
    evolutionPokemonCount,
    stage2PokemonCount,
    mainPokemonIsEvolution,
    mainPokemonIsStage2,
    ruleBoxPokemonCount,
    requiredEnergyTypeCount: energyAnalysis.requiredTypes.length,
    maxAttackCost,
    pokemonSearchCount: countCardsByRole(cards, cardMaster, "pokemon_search"),
    handRefreshCount: countCardsByRole(cards, cardMaster, "hand_refresh"),
    switchCount: countCardsByRole(cards, cardMaster, "switch"),
    gustCount: countCardsByRole(cards, cardMaster, "gust"),
    recoveryCount: countCardsByRole(cards, cardMaster, "recovery"),
  };
}

function scoreAceSpecCandidate(card: StaticCardDetail, profile: DeckFeatureProfile) {
  const name = normalizeCardLimitName(card.name);
  let score = 40;

  if (name === normalizeCardLimitName("プライムキャッチャー")) {
    score += 42;
    if (profile.gustCount <= 1) score += 14;
    if (profile.switchCount <= 1) score += 8;
    if (profile.plan === "disruption" || profile.plan === "speed") score += 8;
  } else if (name === normalizeCardLimitName("アンフェアスタンプ")) {
    score += 34;
    if (profile.plan === "disruption" || profile.plan === "lo") score += 30;
    if (profile.handRefreshCount <= 2) score += 8;
  } else if (name === normalizeCardLimitName("ハイパーアロマ")) {
    score += profile.evolutionPokemonCount * 6 + profile.stage2PokemonCount * 8;
    if (profile.mainPokemonIsEvolution) score += 24;
    if (profile.mainPokemonIsStage2) score += 16;
  } else if (name === normalizeCardLimitName("偉大な大樹")) {
    score += profile.evolutionPokemonCount * 5 + profile.stage2PokemonCount * 9;
    if (profile.mainPokemonIsStage2) score += 24;
    if (profile.plan === "combo" || profile.plan === "stable") score += 10;
  } else if (name === normalizeCardLimitName("ネオアッパーエネルギー")) {
    score += profile.stage2PokemonCount * 10;
    if (profile.mainPokemonIsStage2) score += 30;
    if (profile.requiredEnergyTypeCount >= 2) score += 16;
    if (profile.maxAttackCost >= 3) score += 12;
  } else if (name === normalizeCardLimitName("プレシャスキャリー")) {
    score += 28;
    if (profile.basicPokemonCount >= 8) score += 18;
    if (profile.plan === "speed" || profile.plan === "stable") score += 12;
    if (profile.stage2PokemonCount >= 3) score -= 8;
  } else if (name === normalizeCardLimitName("きらめく結晶")) {
    score += 20;
    if (profile.requiredEnergyTypeCount >= 2) score += 28;
    if (profile.maxAttackCost >= 3) score += 18;
    if (profile.plan === "speed") score += 8;
  } else if (name === normalizeCardLimitName("エネルギー転送PRO")) {
    score += 16;
    if (profile.requiredEnergyTypeCount >= 2) score += 26;
    if (profile.maxAttackCost >= 3) score += 10;
    if (profile.plan === "speed") score += 8;
  } else if (name === normalizeCardLimitName("ヒーローマント")) {
    score += 18;
    if (profile.plan === "tank") score += 36;
    if (profile.ruleBoxPokemonCount > 0) score += 12;
  } else if (name === normalizeCardLimitName("サバイブギプス")) {
    score += 12;
    if (profile.plan === "tank") score += 30;
    if (profile.plan === "lo") score += 10;
  } else if (name === normalizeCardLimitName("マキシマムベルト")) {
    score += 26;
    if (profile.plan === "speed") score += 18;
    if (profile.ruleBoxPokemonCount > 0) score += 8;
  } else if (name === normalizeCardLimitName("シークレットボックス")) {
    score += 22;
    if (profile.plan === "combo") score += 34;
    if (profile.handRefreshCount <= 2) score += 8;
  } else if (name === normalizeCardLimitName("パーフェクトミキサー")) {
    score += 16;
    if (profile.plan === "combo") score += 30;
    if (profile.recoveryCount >= 2) score += 8;
  } else if (name === normalizeCardLimitName("レガシーエネルギー")) {
    score += 14;
    if (profile.plan === "tank" || profile.plan === "lo") score += 12;
    if (profile.requiredEnergyTypeCount >= 2) score += 10;
  } else if (name === normalizeCardLimitName("ポケモン回収サイクロン")) {
    score += 14;
    if (profile.plan === "tank" || profile.plan === "combo") score += 14;
  } else if (name === normalizeCardLimitName("メガシグナル")) {
    score += 10;
    if (profile.mainPokemonIsEvolution) score += 18;
    if (profile.plan === "disruption") score += 8;
  } else if (name === normalizeCardLimitName("ニュートラルセンター")) {
    score += 8;
    if (profile.plan === "tank" || profile.plan === "lo") score += 20;
  } else if (name === normalizeCardLimitName("デラックスボム")) {
    score += 8;
    if (profile.plan === "disruption") score += 8;
  }

  return score;
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
  if (/相手.*山札.*トラッシュ|山札.*上.*トラッシュ|山札.*下.*トラッシュ|相手.*山札.*見る|相手.*山札.*戻す|LO/.test(normalizedText)) {
    roles.add("deck_disruption");
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
  if (requiresFuturePokemon(card)) {
    return hasFuturePokemon(deckCards, cardMaster) || contextMatchesTheme(context, "未来");
  }

  const requiredPokemonGroups = getRequiredPokemonGroups(card);
  if (requiredPokemonGroups.length === 0) return true;

  return requiredPokemonGroups.some((groupName) => {
    const ownerPrefix = groupName.replace(/ポケモン$/, "");
    return hasThemePokemon(deckCards, cardMaster, ownerPrefix) || contextMatchesTheme(context, ownerPrefix);
  });
}

function requiresFuturePokemon(card: StaticCardDetail) {
  const text = normalizeRuleText(getCardSearchableText(card));
  return /「未来」.*ポケモン|未来のポケモン/.test(text);
}

function hasFuturePokemon(
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  return deckCards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return isFuturePokemonCard(masterCard);
  });
}

function isFuturePokemonCard(card?: StaticCardDetail) {
  if (!card || card.cardKind !== "pokemon") return false;
  const name = normalizeCardLimitName(card.name);
  const text = normalizeCardLimitName(getCardSearchableText(card));
  return name.startsWith(normalizeCardLimitName("テツノ")) ||
    name.includes(normalizeCardLimitName("ミライドン")) ||
    text.includes(normalizeCardLimitName("未来"));
}

function isCharacterThemeCardCompatible(
  card: StaticCardDetail,
  deckCards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const ownerPrefix = getCharacterThemeOwnerPrefix(card);
  if (!ownerPrefix) return true;
  if (card.cardKind === "pokemon") return contextMatchesTheme(context, ownerPrefix);
  return hasThemePokemon(deckCards, cardMaster, ownerPrefix) || contextMatchesTheme(context, ownerPrefix);
}

function getCharacterThemeOwnerPrefix(card: StaticCardDetail) {
  const normalizedName = normalizeCardLimitName(card.name);
  if (!normalizedName) return "";

  if (card.cardKind === "pokemon") {
    return humanCharacterNamePrefixes.find((name) => normalizedName.startsWith(`${normalizeCardLimitName(name)}の`)) || "";
  }

  if (card.cardKind === "trainer") {
    const requiredGroups = getRequiredPokemonGroups(card);
    const requiredOwner = requiredGroups
      .map((groupName) => groupName.replace(/ポケモン$/, "").replace(/の$/, ""))
      .find((ownerName) => humanCharacterNamePrefixes.some((name) => normalizeCardLimitName(name) === normalizeCardLimitName(ownerName)));
    return requiredOwner || "";
  }

  return "";
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

function getSelectedPokemonType(context?: GenerateDeckContext) {
  return context?.selectedType ? pokemonTypeByContextType[context.selectedType] : undefined;
}

function pokemonMatchesSelectedType(pokemon: StaticCardDetail, context?: GenerateDeckContext) {
  const selectedType = getSelectedPokemonType(context);
  if (!selectedType) return true;
  return (pokemon.types || []).includes(selectedType);
}

function isPokemonTypeCompatibleWithDeck(
  pokemon: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (pokemon.cardKind !== "pokemon") return true;
  if (!getSelectedPokemonType(context)) return true;
  if (pokemonMatchesSelectedType(pokemon, context)) return true;
  if (contextMatchesTheme(context, pokemon.name || "")) return true;
  return isAllowedOffTypeSystemPokemon(pokemon, cards, cardMaster, context);
}

function isAllowedOffTypeSystemPokemon(
  pokemon: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (!isSystemPokemonCandidate(pokemon)) return false;
  if (isRuleBoxPokemon(pokemon)) return false;
  if (hasConflictingDedicatedAbility(pokemon, cards, cardMaster, context)) return false;

  const roles = classifyAbilityRoles(pokemon);
  if (roles.has("ability_energy") || roles.has("ability_damage_boost") || roles.has("ability_protection") || roles.has("ability_lock")) {
    return false;
  }

  return roles.has("ability_draw") ||
    roles.has("ability_search") ||
    roles.has("ability_stadium") ||
    roles.has("ability_recovery") ||
    roles.has("ability_switch");
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
    const targetCount = getRequestedContextCardTargetCount(requested, context);
    const currentCount = countCardsWithSameName(cards, { cardName: requested.name });
    if (currentCount >= targetCount) continue;

    if (isAceSpecCard(requested, { cardName: requested.name })) {
      removeOtherAceSpecCards(cards, cardMaster, requested.name);
    }

    const addCount = Math.max(0, targetCount - currentCount);
    makeRoomForRequiredCard(cards, addCount, protectedNames);
    const before = countCardsWithSameName(cards, { cardName: requested.name });
    addDeckCardWithLimits(cards, {
      cardId: requested.cardId,
      cardName: requested.name,
      illustration: requested.imageUrl,
      count: addCount,
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

function getRequestedContextCardTargetCount(card: StaticCardDetail, context?: GenerateDeckContext) {
  if (isExactMainPokemon(card, context)) {
    return Math.min(3, maxCountForCard({ cardName: card.name }));
  }
  return 1;
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
  const exactMainPokemon = findExactMainPokemonCard(cards, context);
  addRequestedCard(exactMainPokemon);

  const normalizedMainPokemon = normalizeCardLimitName(context?.pokemonName);
  const exactMatchesByName = new Map<string, StaticCardDetail>();
  for (const card of cards) {
    const normalizedName = normalizeCardLimitName(card.name);
    if (normalizedName.length < 3 || !normalizedText.includes(normalizedName)) continue;
    if (
      exactMainPokemon &&
      normalizedMainPokemon &&
      normalizedName !== normalizedMainPokemon &&
      normalizedMainPokemon.includes(normalizedName)
    ) {
      continue;
    }
    const current = exactMatchesByName.get(normalizedName);
    if (!current || compareRequestedCardPriority(card, current, context) < 0) {
      exactMatchesByName.set(normalizedName, card);
    }
  }
  [...exactMatchesByName.values()]
    .sort((a, b) => compareRequestedCardPriority(a, b, context))
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

function findExactMainPokemonCard(cards: StaticCardDetail[], context?: GenerateDeckContext) {
  const normalizedMainPokemon = normalizeCardLimitName(context?.pokemonName);
  if (!normalizedMainPokemon) return undefined;

  return cards
    .filter((card) => {
      if (card.cardKind !== "pokemon") return false;
      return normalizeCardLimitName(card.name) === normalizedMainPokemon;
    })
    .sort((a, b) => compareRequestedCardPriority(a, b, context))[0];
}

function isExactMainPokemon(card: StaticCardDetail, context?: GenerateDeckContext) {
  const normalizedMainPokemon = normalizeCardLimitName(context?.pokemonName);
  return Boolean(normalizedMainPokemon && card.cardKind === "pokemon" && normalizeCardLimitName(card.name) === normalizedMainPokemon);
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

function compareRequestedCardPriority(a: StaticCardDetail, b: StaticCardDetail, context?: GenerateDeckContext) {
  const nameLengthDiff = normalizeCardLimitName(a.name).length - normalizeCardLimitName(b.name).length;
  if (nameLengthDiff !== 0) return nameLengthDiff;

  if (a.cardKind === "pokemon" && b.cardKind === "pokemon") {
    const pokemonVariantScoreDiff = scorePokemonVariantCandidate(a, context) - scorePokemonVariantCandidate(b, context);
    if (pokemonVariantScoreDiff !== 0) return pokemonVariantScoreDiff;
  }

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
}

function scorePokemonVariantCandidate(card: StaticCardDetail, context?: GenerateDeckContext) {
  let score = 0;
  if (pokemonMatchesSelectedType(card, context)) score -= 120;
  if (isRuleBoxPokemon(card)) score -= isExactMainPokemon(card, context) ? 80 : 20;

  const abilityRoles = classifyAbilityRoles(card);
  if (abilityRoles.has("ability_draw")) score -= 90;
  if (abilityRoles.has("ability_search")) score -= 90;
  if (abilityRoles.has("ability_energy")) score -= 80;
  if (abilityRoles.has("ability_recovery")) score -= 45;
  if (abilityRoles.has("ability_switch")) score -= 35;
  if (abilityRoles.has("ability_damage_boost")) score -= 55;
  if (abilityRoles.has("ability_protection")) score -= 25;
  if (abilityRoles.has("ability_lock")) score -= isHandDisruptionTheme(context) ? 60 : 10;

  const attackScore = scorePokemonAttacks(card, context);
  score += attackScore;
  score -= Math.min(80, Math.max(0, Number(card.hp || 0)) / 4);

  if (hasConfusingOrLowImpactAttackOnly(card)) score += 35;
  return score;
}

function scorePokemonAttacks(card: StaticCardDetail, context?: GenerateDeckContext) {
  if (!card.attacks?.length) return 60;
  const selectedType = getSelectedPokemonType(context);
  let bestScore = 80;

  for (const attack of card.attacks) {
    let score = 0;
    const damage = normalizeAttackDamage(attack.damage);
    const costLength = attack.cost?.length || 0;
    const text = normalizeRuleText(attack.text);

    score -= Math.min(100, damage / 2);
    score += costLength * 12;
    if (selectedType && attack.cost?.includes(selectedType)) score -= 18;
    if (/山札.*選び|山札.*手札|山札.*ベンチ|エネルギー.*つけ|トラッシュ.*手札|入れ替/.test(text)) score -= 35;
    if (/コイン|ウラなら|このポケモンにも|自分のポケモンにも|次の自分の番/.test(text)) score += 20;

    bestScore = Math.min(bestScore, score);
  }

  return bestScore;
}

function normalizeAttackDamage(damage?: number | string) {
  if (typeof damage === "number") return damage;
  const match = String(damage || "").match(/[0-9０-９]+/);
  if (!match) return 0;
  return Number(match[0].replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)));
}

function hasConfusingOrLowImpactAttackOnly(card: StaticCardDetail) {
  if (!card.attacks?.length || card.abilities?.length) return false;
  return card.attacks.every((attack) => {
    const damage = normalizeAttackDamage(attack.damage);
    const text = normalizeRuleText(attack.text);
    return damage <= 30 && !/(山札|エネルギー|トラッシュ|ベンチ|手札|入れ替)/.test(text);
  });
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
  const missingNames: string[] = [];
  const evolutionCards = cards
    .map((card) => ({ deckCard: card, masterCard: cardMaster[card.cardId] }))
    .filter(({ masterCard }) => masterCard?.cardKind === "pokemon" && Number(masterCard.stageOrder || 0) > 0);

  for (const { deckCard, masterCard } of evolutionCards) {
    if (!masterCard) continue;
    const chain = ensureBasicEvolutionInChain(inferEvolutionLine(masterCard, cardMaster), masterCard, cardMaster);
    if (!chain.some((card) => Number(card.stageOrder || 0) === 0) && masterCard.name) {
      missingNames.push(masterCard.name);
    }
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
    missingNames: uniqueNames(missingNames),
  };
}

function ensureBasicEvolutionInChain(
  chain: StaticCardDetail[],
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>
) {
  if (Number(target.stageOrder || 0) <= 0) return chain;
  if (chain.some((card) => Number(card.stageOrder || 0) === 0)) return chain;

  const basic = findRequiredBasicEvolution(target, cardMaster);
  if (!basic) return chain;
  return [basic, ...chain.filter((card) => normalizeCardLimitName(card.name) !== normalizeCardLimitName(basic.name))];
}

function inferEvolutionLine(
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>,
  visited = new Set<string>()
): StaticCardDetail[] {
  const stageOrder = Number(target.stageOrder || 0);
  const chain: StaticCardDetail[] = [];
  if (stageOrder <= 0) return chain;
  if (visited.has(target.cardId)) return chain;
  visited.add(target.cardId);

  let current = target;
  for (let desiredStage = stageOrder - 1; desiredStage >= 0; desiredStage -= 1) {
    const previous = findPreviousEvolutionStage(current, desiredStage, cardMaster, visited);
    if (!previous) break;
    chain.unshift(previous);
    current = previous;
  }
  return chain;
}

function findPreviousEvolutionStage(
  target: StaticCardDetail,
  desiredStageOrder: number,
  cardMaster: Record<string, StaticCardDetail>,
  visited: Set<string>
): StaticCardDetail | undefined {
  const targetId = Number(target.cardId);
  const explicitPrevious = findExplicitPreviousEvolution(target, desiredStageOrder, cardMaster);
  if (explicitPrevious) return explicitPrevious;

  const knownPrevious = findKnownPreviousEvolution(target, desiredStageOrder, cardMaster);
  if (knownPrevious) return knownPrevious;

  const equivalentSource = findEquivalentEvolutionSource(target, cardMaster, visited);
  if (equivalentSource) {
    const previous = findPreviousEvolutionStage(equivalentSource, desiredStageOrder, cardMaster, visited);
    if (previous) return previous;
  }

  const candidates = Object.values(cardMaster)
    .filter((card) => {
      const cardId = Number(card.cardId);
      if (!Number.isFinite(targetId) || !Number.isFinite(cardId) || cardId >= targetId) return false;
      if (target.setName && card.setName !== target.setName) return false;
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== desiredStageOrder) return false;
      return targetId - cardId <= 24;
    })
    .sort((a, b) => scorePreviousEvolutionCandidate(a, target) - scorePreviousEvolutionCandidate(b, target));

  return candidates[0];
}

function findExplicitPreviousEvolution(
  target: StaticCardDetail,
  desiredStageOrder: number,
  cardMaster: Record<string, StaticCardDetail>
): StaticCardDetail | undefined {
  const evolvesFrom = normalizeCardLimitName(target.evolvesFrom);
  if (!evolvesFrom) return undefined;

  return Object.values(cardMaster)
    .filter((card) => {
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== desiredStageOrder) return false;
      return normalizeCardLimitName(card.name) === evolvesFrom;
    })
    .sort((a, b) => scorePreviousEvolutionCandidate(a, target) - scorePreviousEvolutionCandidate(b, target))[0];
}

function findKnownPreviousEvolution(
  target: StaticCardDetail,
  desiredStageOrder: number,
  cardMaster: Record<string, StaticCardDetail>
): StaticCardDetail | undefined {
  if (desiredStageOrder !== 0) return undefined;

  const familyName = normalizeFamilyName(target.familyId || target.name);
  const preEvolutionName = knownPreEvolutionByFamilyName[familyName];
  if (!preEvolutionName) return undefined;

  const normalizedPreEvolutionName = normalizeCardLimitName(preEvolutionName);
  return Object.values(cardMaster)
    .filter((card) => {
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== desiredStageOrder) return false;
      return normalizeCardLimitName(card.name) === normalizedPreEvolutionName;
    })
    .sort((a, b) => scorePreviousEvolutionCandidate(a, target) - scorePreviousEvolutionCandidate(b, target))[0];
}

function findRequiredBasicEvolution(
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>
): StaticCardDetail | undefined {
  const explicitBasic = findExplicitBasicEvolution(target, cardMaster);
  if (explicitBasic) return explicitBasic;

  const knownBasic = findKnownPreviousEvolution(target, 0, cardMaster);
  if (knownBasic) return knownBasic;

  const familyBasic = findFamilyBasicEvolution(target, cardMaster);
  if (familyBasic) return familyBasic;

  const targetId = Number(target.cardId);
  const candidates = Object.values(cardMaster)
    .filter((card) => {
      const cardId = Number(card.cardId);
      if (!Number.isFinite(targetId) || !Number.isFinite(cardId) || cardId >= targetId) return false;
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== 0) return false;
      if (target.setName && card.setName !== target.setName) return false;
      return targetId - cardId <= 36;
    })
    .sort((a, b) => scoreBasicEvolutionCandidate(a, target) - scoreBasicEvolutionCandidate(b, target));

  return candidates[0];
}

function findExplicitBasicEvolution(
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>
): StaticCardDetail | undefined {
  const directPrevious = findExplicitPreviousEvolution(target, Math.max(0, Number(target.stageOrder || 0) - 1), cardMaster);
  if (!directPrevious) return undefined;
  if (Number(directPrevious.stageOrder || 0) === 0) return directPrevious;
  return findRequiredBasicEvolution(directPrevious, cardMaster);
}

function findFamilyBasicEvolution(
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>
): StaticCardDetail | undefined {
  const familyName = normalizeFamilyName(target.familyId || target.name);
  if (!familyName) return undefined;

  return Object.values(cardMaster)
    .filter((card) => {
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== 0) return false;
      return normalizeFamilyName(card.familyId || card.name) === familyName;
    })
    .sort((a, b) => scoreBasicEvolutionCandidate(a, target) - scoreBasicEvolutionCandidate(b, target))[0];
}

function findEquivalentEvolutionSource(
  target: StaticCardDetail,
  cardMaster: Record<string, StaticCardDetail>,
  visited: Set<string>
): StaticCardDetail | undefined {
  const targetId = Number(target.cardId);
  const normalizedName = normalizeCardLimitName(target.name);
  if (!normalizedName || !Number.isFinite(targetId)) return undefined;

  return Object.values(cardMaster)
    .filter((card) => {
      const cardId = Number(card.cardId);
      if (!Number.isFinite(cardId) || cardId >= targetId || visited.has(card.cardId)) return false;
      if (card.cardKind !== "pokemon") return false;
      if (Number(card.stageOrder || 0) !== Number(target.stageOrder || 0)) return false;
      return normalizeCardLimitName(card.name) === normalizedName;
    })
    .sort((a, b) => scoreEquivalentEvolutionSource(a, target) - scoreEquivalentEvolutionSource(b, target))[0];
}

function scoreEquivalentEvolutionSource(candidate: StaticCardDetail, target: StaticCardDetail) {
  const candidateId = Number(candidate.cardId);
  const targetId = Number(target.cardId);
  let score = 0;
  if (candidate.setName !== target.setName) score += 5000;
  if (candidate.setCode !== target.setCode) score += 500;
  score += Number.isFinite(candidateId) && Number.isFinite(targetId) ? Math.abs(targetId - candidateId) : 10000;
  return score;
}

function scorePreviousEvolutionCandidate(candidate: StaticCardDetail, target: StaticCardDetail) {
  const candidateId = Number(candidate.cardId);
  const targetId = Number(target.cardId);
  const distance = Number.isFinite(candidateId) && Number.isFinite(targetId) ? Math.abs(targetId - candidateId) : 10000;
  let score = distance;

  if (candidate.setName !== target.setName) score += 5000;
  if (candidate.setCode !== target.setCode) score += 500;
  if (!pokemonTypesOverlap(candidate, target)) score += 100;

  return score;
}

function scoreBasicEvolutionCandidate(candidate: StaticCardDetail, target: StaticCardDetail) {
  let score = scorePreviousEvolutionCandidate(candidate, target);
  const knownBasicName = knownPreEvolutionByFamilyName[normalizeFamilyName(target.familyId || target.name)];
  if (knownBasicName && normalizeCardLimitName(candidate.name) === normalizeCardLimitName(knownBasicName)) score -= 10000;
  if (candidate.stageCategory !== "basic") score += 200;
  return score;
}

function pokemonTypesOverlap(a: StaticCardDetail, b: StaticCardDetail) {
  if (!a.types?.length || !b.types?.length) return true;
  return a.types.some((type) => b.types?.includes(type));
}

function normalizeFamilyName(name?: string) {
  return normalizeCardLimitName(name)
    .replace(/^メガ/, "")
    .replace(/ex$/, "");
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
  cardsByName: CardsByName,
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
  const evolutionLineNames = getRequiredEvolutionLineNames(cards, cardMaster);
  const pokemonSearchAddedNames = addMissingPokemonSearchKinds(cards, cardsByName, cardMaster, context, evolutionLineNames);
  const mainPokemonSupportAddedNames = addMainPokemonSupportCards(cards, cardsByName, cardMaster, context, evolutionLineNames);
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
      addedNames,
      (card) => isPolicyCandidateCompatible(card, cards, cardMaster, context),
      evolutionLineNames
    );
    remainingCount -= addedCount;
  }

  addCardsFromPolicyCandidates(
    cards,
    cardsByName,
    handRefreshNames.selfPositive,
    remainingCount,
    addedNames,
    (card) => isPolicyCandidateCompatible(card, cards, cardMaster, context),
    evolutionLineNames
  );
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

function adjustCardCountsByEffect(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const increasedNames: string[] = [];
  const reducedNames: string[] = [];
  const evolutionLineNames = getRequiredEvolutionLineNames(cards, cardMaster);
  const requestedTargets = getRequestedContextCards(cardMaster, context)
    .filter((card) => card.name)
    .map((card) => [normalizeCardLimitName(card.name), getRequestedContextCardTargetCount(card, context)] as const);
  const requestedTargetByName = new Map(requestedTargets);

  for (const card of cards) {
    const masterCard = cardMaster[card.cardId];
    if (!masterCard?.name) continue;
    const targetCount = getEffectBasedTargetCount(masterCard, cards, cardMaster, context);
    if (targetCount === undefined) continue;

    const requestedTarget = requestedTargetByName.get(normalizeCardLimitName(masterCard.name)) || 0;
    const protectedTarget = Math.max(targetCount, requestedTarget);
    if (card.count > protectedTarget) {
      card.count = protectedTarget;
      reducedNames.push(masterCard.name);
    }
  }

  const candidates = [...cards]
    .map((card) => cardMaster[card.cardId])
    .filter((card): card is StaticCardDetail => Boolean(card?.name))
    .sort(compareEffectCountCandidatePriority);

  for (const candidate of candidates) {
    const targetCount = getEffectBasedTargetCount(candidate, cards, cardMaster, context);
    if (targetCount === undefined || targetCount <= 0) continue;

    const requestedTarget = requestedTargetByName.get(normalizeCardLimitName(candidate.name)) || 0;
    const protectedTarget = Math.max(targetCount, requestedTarget);
    while (countCardsWithSameName(cards, { cardName: candidate.name }) < protectedTarget) {
      const addedCount = addSinglePolicyCard(cards, candidate, increasedNames, evolutionLineNames);
      if (addedCount === 0) break;
    }
  }

  return {
    increasedNames: uniqueNames(increasedNames),
    reducedNames: uniqueNames(reducedNames),
  };
}

function getRequiredEvolutionLineNames(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  const names = new Set<string>();
  for (const deckCard of cards) {
    const masterCard = cardMaster[deckCard.cardId];
    if (!masterCard || masterCard.cardKind !== "pokemon" || Number(masterCard.stageOrder || 0) <= 0) continue;
    if (masterCard.name) names.add(masterCard.name);
    for (const preEvolution of ensureBasicEvolutionInChain(inferEvolutionLine(masterCard, cardMaster), masterCard, cardMaster)) {
      if (preEvolution.name) names.add(preEvolution.name);
    }
  }
  return [...names];
}

function getEffectBasedTargetCount(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (!card.name || isBasicEnergyName(card.name)) return undefined;
  if (isAceSpecCard(card, { cardName: card.name })) return 1;

  if (card.cardKind === "pokemon") {
    if (isExactMainPokemon(card, context)) return Math.min(3, maxCountForCard({ cardName: card.name }));
    if (isSystemPokemonCandidate(card)) return Math.min(1, maxCountForCard({ cardName: card.name }));
    if (pokemonMatchesStage(card, "stage2")) return Math.min(2, maxCountForCard({ cardName: card.name }));
    if (pokemonMatchesStage(card, "stage1")) return Math.min(2, maxCountForCard({ cardName: card.name }));
    return undefined;
  }

  if (card.cardKind !== "trainer") return undefined;
  if (isHighRiskSituationalSupport(card)) return contextMatchesTheme(context, card.name) ? 1 : 0;

  const roles = classifyCardRoles(card);
  const normalizedName = normalizeCardLimitName(card.name);
  if (normalizedName === normalizeCardLimitName("ふしぎなアメ")) {
    if (!canRareCandyFitDeck(cards, cardMaster)) return 0;
    return countPokemonByStage(cards, cardMaster, "stage2") >= 2 ? 3 : 2;
  }
  if (isPokemonSearchGoodsCard(card) && canPokemonSearchCardFitDeck(card, cards, cardMaster)) return 4;
  if (roles.has("hand_disruption")) return shouldUseHandDisruptionSupport(context) ? 2 : 0;
  if (roles.has("hand_refresh")) return 3;
  if (roles.has("pokemon_search")) return 2;
  if (roles.has("evolution_support")) return deckUsesEvolution(cards, cardMaster) ? 2 : 0;
  if (roles.has("energy_acceleration")) return 2;
  if (roles.has("energy_search")) return shouldUseEnergySearchSupport(cards, cardMaster, context) ? 1 : undefined;
  if (roles.has("switch")) return 2;
  if (roles.has("gust")) {
    if (isCoinBasedGustCard(card) && hasCardNamed(cards, cardMaster, "ボスの指令")) return 0;
    return getSelectedDeckPlan(context) === "disruption" ? 2 : 1;
  }
  if (roles.has("recovery")) return 1;
  if (roles.has("main_pokemon_only")) return 1;
  return undefined;
}

function shouldUseHandDisruptionSupport(context?: GenerateDeckContext) {
  const plan = getSelectedDeckPlan(context);
  return plan === "disruption" || plan === "lo" || isHandDisruptionTheme(context);
}

function shouldUseEnergySearchSupport(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  if (getSelectedDeckPlan(context) === "speed") return true;
  return cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    if (masterCard?.cardKind !== "pokemon") return false;
    return (masterCard.attacks || []).some((attack) => (attack.cost?.length || 0) >= 3);
  });
}

function isCoinBasedGustCard(card: StaticCardDetail) {
  const normalizedName = normalizeCardLimitName(card.name);
  const text = normalizeRuleText(getCardSearchableText(card));
  return normalizedName === normalizeCardLimitName("ポケモンキャッチャー") || (text.includes("コイン") && cardHasRole(card, "gust"));
}

function hasCardNamed(cards: DeckCard[], cardMaster: Record<string, StaticCardDetail>, name: string) {
  const normalizedName = normalizeCardLimitName(name);
  return cards.some((card) => {
    const masterCard = cardMaster[card.cardId];
    return normalizeCardLimitName(card.cardName || masterCard?.name) === normalizedName && card.count > 0;
  });
}

function compareEffectCountCandidatePriority(a: StaticCardDetail, b: StaticCardDetail) {
  const aSearchGoods = isPokemonSearchGoodsCard(a) ? 0 : 1;
  const bSearchGoods = isPokemonSearchGoodsCard(b) ? 0 : 1;
  if (aSearchGoods !== bSearchGoods) return aSearchGoods - bSearchGoods;

  const aTrainer = a.cardKind === "trainer" ? 0 : 1;
  const bTrainer = b.cardKind === "trainer" ? 0 : 1;
  if (aTrainer !== bTrainer) return aTrainer - bTrainer;

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
}

function countPokemonByStage(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  stage: NonNullable<PokemonSearchCondition["stage"]>
) {
  return cards.reduce((sum, card) => {
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || masterCard.cardKind !== "pokemon" || !pokemonMatchesStage(masterCard, stage)) return sum;
    return sum + card.count;
  }, 0);
}

type DeckPlan = "stable" | "disruption" | "lo" | "speed" | "tank" | "combo" | "unknown";

function applySelectedPlanBias(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const plan = getSelectedDeckPlan(context);
  const addedNames: string[] = [];
  if (plan === "unknown") {
    return { addedNames };
  }

  const protectedNames = [
    ...getRequiredEvolutionLineNames(cards, cardMaster),
    ...getRequestedContextCards(cardMaster, context).map((card) => card.name || "").filter(Boolean),
  ];

  const addRole = (role: CardRole, targetCount: number) => {
    const addedCount = addCardsForRoleTarget(cards, cardsByName, cardMaster, role, targetCount, addedNames, context, protectedNames);
    return addedCount;
  };

  if (plan === "stable") {
    addRole("pokemon_search", 8);
    addRole("hand_refresh", 4);
    addRole("switch", 2);
    addRole("recovery", 2);
  } else if (plan === "disruption") {
    addRole("hand_disruption", 4);
    addRole("gust", 3);
    addRole("switch", 2);
  } else if (plan === "lo") {
    addRole("deck_disruption", 4);
    addRole("hand_disruption", 3);
    addRole("recovery", 3);
    addRole("switch", 2);
  } else if (plan === "speed") {
    addRole("pokemon_search", 9);
    addRole("energy_search", 3);
    addRole("energy_acceleration", 2);
    addRole("switch", 3);
  } else if (plan === "tank") {
    addRole("recovery", 4);
    addRole("switch", 2);
    addRole("hand_refresh", 3);
  } else if (plan === "combo") {
    addRole("pokemon_search", 8);
    addRole("hand_refresh", 5);
    addRole("recovery", 2);
    if (deckUsesEvolution(cards, cardMaster)) addRole("evolution_support", 4);
  }

  return {
    addedNames: uniqueNames(addedNames),
  };
}

function getSelectedDeckPlan(context?: GenerateDeckContext): DeckPlan {
  const text = normalizeCardLimitName(context?.selectedPlan);
  if (!text) return "unknown";
  if (/手札干渉|妨害|ハンデス/.test(text)) return "disruption";
  if (/lo|ライブラリアウト|山札切れ/.test(text)) return "lo";
  if (/速攻|初動|アグロ/.test(text)) return "speed";
  if (/耐久|受け|回復/.test(text)) return "tank";
  if (/コンボ|再現性/.test(text)) return "combo";
  if (/安定|事故/.test(text)) return "stable";
  return "unknown";
}

function applyTypeSpecificCardPolicy(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const selectedType = getSelectedPokemonType(context);
  const addedNames: string[] = [];
  if (!selectedType) return { addedNames };

  const protectedNames = [
    ...getRequiredEvolutionLineNames(cards, cardMaster),
    ...getRequestedContextCards(cardMaster, context).map((card) => card.name || "").filter(Boolean),
  ];
  const candidates = Object.values(cardMaster)
    .filter((card) => isTypeSpecificCardForType(card, selectedType))
    .filter((card) => isPolicyCandidateCompatible(card, cards, cardMaster, context))
    .sort((a, b) => scoreTypeSpecificCandidate(b, cards, cardMaster) - scoreTypeSpecificCandidate(a, cards, cardMaster));

  for (const candidate of candidates) {
    if (addedNames.length >= 2) break;
    if (!candidate.name || countCardsWithSameName(cards, { cardName: candidate.name }) > 0) continue;
    if (isAceSpecCard(candidate, { cardName: candidate.name })) continue;
    addSinglePolicyCard(cards, candidate, addedNames, protectedNames);
  }

  return {
    addedNames: uniqueNames(addedNames),
  };
}

function isTypeSpecificCardForType(card: StaticCardDetail, selectedType: string) {
  if (!card.name || card.cardKind === "pokemon") return false;
  if (isBasicEnergyName(card.name)) return false;

  const normalizedType = normalizeCardLimitName(selectedType);
  const normalizedName = normalizeCardLimitName(card.name);
  const normalizedRuleText = normalizeCardLimitName(card.ruleText);
  const typeEnergyText = `${normalizedType}エネルギー`;
  const typePokemonText = `${normalizedType}ポケモン`;
  const typeText = `${normalizedType}タイプ`;

  if (isSpecialEnergyCard(card) && normalizedName.includes(typeEnergyText)) return true;
  return normalizedRuleText.includes(typeEnergyText) ||
    normalizedRuleText.includes(typePokemonText) ||
    normalizedRuleText.includes(typeText);
}

function scoreTypeSpecificCandidate(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>
) {
  let score = 0;
  const roles = classifyCardRoles(card);
  if (roles.has("energy_acceleration")) score += 40;
  if (roles.has("energy_search")) score += 28;
  if (roles.has("pokemon_search")) score += 24;
  if (roles.has("hand_refresh")) score += 16;
  if (isSpecialEnergyCard(card)) score += 18;
  if (canPokemonSearchCardFitDeck(card, cards, cardMaster)) score += 10;
  score += Number(card.cardId || 0) / 100000;
  return score;
}

function addCardsForRoleTarget(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  role: CardRole,
  targetCount: number,
  addedNames: string[],
  context?: GenerateDeckContext,
  protectedNames: string[] = []
) {
  let addedCount = 0;
  while (countCardsByRole(cards, cardMaster, role) < targetCount) {
    const candidateNames = getPolicyCandidateNames([], cardMaster, role);
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, (card) => {
      if (!cardHasRole(card, role)) return false;
      if (!isPolicyCandidateCompatible(card, cards, cardMaster, context)) return false;
      if (!canPokemonSearchCardFitDeck(card, cards, cardMaster)) return false;
      if (role === "evolution_support" && !canMainPokemonSupportCardFitDeck(card, cards, cardMaster)) return false;
      if (role === "hand_disruption" && !shouldUseHandDisruptionSupport(context)) return false;
      if (role === "energy_search" && !shouldUseEnergySearchSupport(cards, cardMaster, context)) return false;
      if (role === "gust" && isCoinBasedGustCard(card) && hasCardNamed(cards, cardMaster, "ボスの指令")) return false;
      return true;
    });
    if (!candidate?.name) break;
    const didAdd = addSinglePolicyCard(cards, candidate, addedNames, protectedNames);
    if (didAdd === 0) break;
    addedCount += didAdd;
  }
  return addedCount;
}

function countCardsByRole(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  role: CardRole
) {
  return cards.reduce((sum, card) => {
    const masterCard = cardMaster[card.cardId];
    if (!masterCard || !cardHasRole(masterCard, role)) return sum;
    return sum + card.count;
  }, 0);
}

function addMissingPokemonSearchKinds(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext,
  protectedNames: string[] = []
) {
  const addedNames: string[] = [];
  const candidateNames = getPolicyCandidateNames(pokemonSearchSupportCardNames, cardMaster, "pokemon_search");
  while (countPokemonSearchCardKinds(cards, cardMaster) < minimumPokemonSearchCardKinds) {
    const existingSearchNames = getPokemonSearchCardNames(cards, cardMaster);
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, (card) => {
      return !existingSearchNames.has(normalizeCardLimitName(card.name)) &&
        cardHasRole(card, "pokemon_search") &&
        canPokemonSearchCardFitDeck(card, cards, cardMaster) &&
        isPolicyCandidateCompatible(card, cards, cardMaster, context);
    });
    if (!candidate?.name) break;
    if (addSinglePolicyCard(cards, candidate, addedNames, protectedNames) === 0) break;
  }
  addPokemonSearchGoodsToTargetCount(cards, cardMaster, addedNames, protectedNames);
  return addedNames;
}

function addPokemonSearchGoodsToTargetCount(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  addedNames: string[],
  protectedNames: string[] = []
) {
  const candidates = cards
    .map((card) => cardMaster[card.cardId])
    .filter((card): card is StaticCardDetail => {
      if (!card?.name || !isPokemonSearchGoodsCard(card)) return false;
      if (isAceSpecCard(card, { cardName: card.name })) return false;
      return canPokemonSearchCardFitDeck(card, cards, cardMaster);
    })
    .sort(comparePokemonSearchGoodsPriority);

  for (const candidate of candidates) {
    while (countCardsWithSameName(cards, { cardName: candidate.name }) < pokemonSearchGoodsTargetCount) {
      if (addSinglePolicyCard(cards, candidate, addedNames, protectedNames) === 0) break;
    }
  }
}

function isPokemonSearchGoodsCard(card: StaticCardDetail) {
  return card.cardKind === "trainer" &&
    String(card.subKind || "").includes("グッズ") &&
    isPokemonSearchCard(card);
}

function comparePokemonSearchGoodsPriority(a: StaticCardDetail, b: StaticCardDetail) {
  const aBall = cardHasRole(a, "ball_search") ? 0 : 1;
  const bBall = cardHasRole(b, "ball_search") ? 0 : 1;
  if (aBall !== bBall) return aBall - bBall;

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
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
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext,
  protectedNames: string[] = []
) {
  if (!context?.pokemonName?.trim()) return [];
  const addedNames: string[] = [];
  const candidateNames = getMainPokemonSupportCandidateNames(cards, cardMaster);
  addCardsFromPolicyCandidates(cards, cardsByName, candidateNames, 2, addedNames, (card) => {
    return canMainPokemonSupportCardFitDeck(card, cards, cardMaster) &&
      isPolicyCandidateCompatible(card, cards, cardMaster, context);
  }, protectedNames);
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
    .sort((a, b) => compareSystemPokemonCandidatePriority(a, b, context))
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
  if (!isPokemonTypeCompatibleWithDeck(card, cards, cardMaster, context)) return false;
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

function compareSystemPokemonCandidatePriority(
  a: StaticCardDetail,
  b: StaticCardDetail,
  context?: GenerateDeckContext
) {
  const aSameType = pokemonMatchesSelectedType(a, context) ? 0 : 1;
  const bSameType = pokemonMatchesSelectedType(b, context) ? 0 : 1;
  if (aSameType !== bSameType) return aSameType - bSameType;

  const cardIdDiff = Number(b.cardId) - Number(a.cardId);
  if (Number.isFinite(cardIdDiff) && cardIdDiff !== 0) return cardIdDiff;

  return String(b.cardId).localeCompare(String(a.cardId));
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
  cardsByName: CardsByName,
  candidateNames: string[],
  wantedCount: number,
  addedNames: string[],
  canAddCard: (card: StaticCardDetail) => boolean = () => true,
  protectedNames: string[] = []
) {
  let addedCount = 0;
  while (addedCount < wantedCount) {
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, canAddCard);
    if (!candidate?.name) break;

    const didAdd = addSinglePolicyCard(cards, candidate, addedNames, protectedNames);
    if (didAdd === 0) break;
    addedCount += didAdd;
  }
  return addedCount;
}

function addSinglePolicyCard(
  cards: DeckCard[],
  candidate: StaticCardDetail,
  addedNames: string[],
  additionalProtectedNames: string[] = []
) {
  if (!candidate.name) return 0;
  makeRoomForRequiredCard(cards, 1, [candidate.name, ...additionalProtectedNames]);
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
  cardsByName: CardsByName,
  candidateNames: string[],
  canAddCard: (card: StaticCardDetail) => boolean = () => true
) {
  for (const name of candidateNames) {
    const candidates = cardsByName.get(normalizeCardLimitName(name)) || [];
    for (const card of candidates) {
      if (card && isAceSpecCard(card, { cardName: card.name })) continue;
      if (card?.name && remainingCountForCardName(cards, { cardName: card.name }) > 0 && canAddCard(card)) return card;
    }
  }
  return undefined;
}

function findFirstCardCandidate(
  cardsByName: CardsByName,
  name: string,
  canUseCard: (card: StaticCardDetail) => boolean = () => true
) {
  const candidates = cardsByName.get(normalizeCardLimitName(name)) || [];
  return candidates.find((card) => card?.name && canUseCard(card));
}

function isPolicyCandidateCompatible(
  card: StaticCardDetail,
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  return isThemeLockedCardCompatible(card, cards, cardMaster, context) &&
    isCharacterThemeCardCompatible(card, cards, cardMaster, context);
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

type EnergyRequirementAnalysis = {
  requiredTypes: string[];
  weightsByType: Map<string, number>;
};

function applyEnergyRequirementPolicy(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  const analysis = analyzeEnergyRequirements(cards, cardMaster, context);
  const protectedNames = [
    ...getRequiredEvolutionLineNames(cards, cardMaster),
    ...getRequestedContextCards(cardMaster, context).map((card) => card.name || "").filter(Boolean),
  ];
  const addedAccelerationNames: string[] = [];
  const addedBasicEnergyNames: string[] = [];
  const reducedSpecialEnergyNames = reduceSpecialEnergyCards(cards, cardMaster, protectedNames);

  if (analysis.requiredTypes.length >= 2) {
    addCardsForRoleTarget(cards, cardsByName, cardMaster, "energy_acceleration", 2, addedAccelerationNames, context, protectedNames);
  }

  for (const type of analysis.requiredTypes) {
    const energyName = basicEnergyByPokemonType[type];
    if (!energyName) continue;
    const currentCount = countCardsWithSameName(cards, { cardName: energyName });
    const minimumCount = analysis.requiredTypes.length >= 2 ? 2 : 0;
    for (let count = currentCount; count < minimumCount; count += 1) {
      const candidate = findFirstCardCandidate(cardsByName, energyName);
      if (!candidate?.name) break;
      if (addSinglePolicyCard(cards, candidate, addedBasicEnergyNames, protectedNames) === 0) break;
    }
  }

  return {
    addedAccelerationNames: uniqueNames(addedAccelerationNames),
    addedBasicEnergyNames: uniqueNames(addedBasicEnergyNames),
    reducedSpecialEnergyNames: uniqueNames(reducedSpecialEnergyNames),
  };
}

function analyzeEnergyRequirements(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
): EnergyRequirementAnalysis {
  const weightsByType = new Map<string, number>();
  const selectedPokemonType = getSelectedPokemonType(context);
  for (const deckCard of cards) {
    const masterCard = cardMaster[deckCard.cardId];
    if (!masterCard || masterCard.cardKind !== "pokemon") continue;
    if (selectedPokemonType && !pokemonMatchesSelectedType(masterCard, context) && !isExactMainPokemon(masterCard, context)) {
      continue;
    }
    const pokemonWeight = Math.max(1, deckCard.count) * (isExactMainPokemon(masterCard, context) ? 2 : 1);
    for (const attack of masterCard.attacks || []) {
      for (const cost of attack.cost || []) {
        const type = normalizePokemonEnergyType(cost);
        if (!type || !basicEnergyByPokemonType[type]) continue;
        weightsByType.set(type, (weightsByType.get(type) || 0) + pokemonWeight);
      }
    }
  }

  if (weightsByType.size === 0) {
    const selectedType = context?.selectedType ? pokemonTypeByContextType[context.selectedType] : undefined;
    if (selectedType) weightsByType.set(selectedType, 1);
  }

  return {
    requiredTypes: [...weightsByType.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([type]) => type),
    weightsByType,
  };
}

function normalizePokemonEnergyType(cost?: string) {
  const normalized = String(cost || "").replace(/[ 　・\-－]/g, "");
  if (!normalized || normalized.includes("無") || normalized.includes("無色") || normalized.includes("Colorless")) return undefined;
  if (normalized.includes("草")) return "草";
  if (normalized.includes("炎")) return "炎";
  if (normalized.includes("水")) return "水";
  if (normalized.includes("雷")) return "雷";
  if (normalized.includes("超")) return "超";
  if (normalized.includes("闘")) return "闘";
  if (normalized.includes("悪")) return "悪";
  if (normalized.includes("鋼")) return "鋼";
  return undefined;
}

function reduceSpecialEnergyCards(
  cards: DeckCard[],
  cardMaster: Record<string, StaticCardDetail>,
  protectedNames: string[],
  maxSpecialEnergyCount = 1
) {
  const reducedNames: string[] = [];
  let specialEnergyCount = cards.reduce((sum, card) => {
    const masterCard = cardMaster[card.cardId];
    return isSpecialEnergyCard(masterCard) ? sum + card.count : sum;
  }, 0);
  if (specialEnergyCount <= maxSpecialEnergyCount) return reducedNames;

  const protectedNameSet = new Set(protectedNames.map(normalizeCardLimitName));
  for (let index = cards.length - 1; index >= 0 && specialEnergyCount > maxSpecialEnergyCount; index -= 1) {
    const card = cards[index];
    const masterCard = cardMaster[card.cardId];
    if (!isSpecialEnergyCard(masterCard)) continue;
    if (protectedNameSet.has(normalizeCardLimitName(card.cardName || masterCard?.name))) continue;
    const removeCount = Math.min(card.count, specialEnergyCount - maxSpecialEnergyCount);
    if (removeCount <= 0) continue;
    card.count -= removeCount;
    specialEnergyCount -= removeCount;
    reducedNames.push(card.cardName || masterCard?.name || card.cardId);
  }
  return reducedNames;
}

function isSpecialEnergyCard(card?: StaticCardDetail) {
  if (!card || card.cardKind !== "energy") return false;
  if (isBasicEnergyName(card.name)) return false;
  return String(card.subKind || "").includes("特殊") || normalizeRuleText(card.ruleText || "").includes("特殊エネルギー");
}

function fillDeckWithStaples(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  let filled = 0;
  for (const staple of stapleCards) {
    if (countDeckCards(cards) >= targetDeckCardCount) break;
    const card = findFirstCardCandidate(cardsByName, staple.name, (candidate) => canPokemonSearchCardFitDeck(candidate, cards, cardMaster));
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

  for (const role of genericSupportRolePriority) {
    if (countDeckCards(cards) >= targetDeckCardCount) break;
    const candidateNames = getPolicyCandidateNames([], cardMaster, role);
    const candidate = findAddablePolicyCard(cards, cardsByName, candidateNames, (card) => {
      if (!canPokemonSearchCardFitDeck(card, cards, cardMaster)) return false;
      if (!isThemeLockedCardCompatible(card, cards, cardMaster, context)) return false;
      if (!isCharacterThemeCardCompatible(card, cards, cardMaster, context)) return false;
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

  filled += fillRemainingSlotsWithBasicEnergy(cards, cardsByName, cardMaster, context);

  return filled;
}

function fillRemainingSlotsWithBasicEnergy(
  cards: DeckCard[],
  cardsByName: CardsByName,
  cardMaster: Record<string, StaticCardDetail>,
  context?: GenerateDeckContext
) {
  let filled = 0;
  const analysis = analyzeEnergyRequirements(cards, cardMaster, context);
  const selectedPokemonType = getSelectedPokemonType(context);
  const weightedTypes = analysis.requiredTypes.length > 0
    ? prioritizeSelectedEnergyType(analysis.requiredTypes, selectedPokemonType)
    : context?.selectedType && pokemonTypeByContextType[context.selectedType]
      ? [pokemonTypeByContextType[context.selectedType]]
      : [];
  if (weightedTypes.length === 0) return filled;

  while (countDeckCards(cards) < targetDeckCardCount) {
    const nextType = chooseNextBasicEnergyType(cards, analysis.weightsByType, weightedTypes);
    const energyName = basicEnergyByPokemonType[nextType] || basicEnergyByType[context?.selectedType || ""];
    if (!energyName) break;

    const card = findFirstCardCandidate(cardsByName, energyName);
    if (!card?.name) break;

    const before = countDeckCards(cards);
    addDeckCardWithLimits(cards, {
      cardId: card.cardId,
      cardName: card.name,
      illustration: card.imageUrl,
      count: 1,
    });
    filled += countDeckCards(cards) - before;
    if (countDeckCards(cards) === before) break;
  }

  return filled;
}

function prioritizeSelectedEnergyType(requiredTypes: string[], selectedPokemonType?: string) {
  if (!selectedPokemonType) return requiredTypes;
  if (requiredTypes.includes(selectedPokemonType)) return [
    selectedPokemonType,
    ...requiredTypes.filter((type) => type !== selectedPokemonType),
  ];
  return [selectedPokemonType, ...requiredTypes];
}

function chooseNextBasicEnergyType(
  cards: DeckCard[],
  weightsByType: Map<string, number>,
  types: string[]
) {
  return [...types].sort((a, b) => {
    const aWeight = Math.max(1, weightsByType.get(a) || 1);
    const bWeight = Math.max(1, weightsByType.get(b) || 1);
    const aCurrent = countBasicEnergyByPokemonType(cards, a);
    const bCurrent = countBasicEnergyByPokemonType(cards, b);
    return bWeight / (bCurrent + 1) - aWeight / (aCurrent + 1);
  })[0];
}

function countBasicEnergyByPokemonType(cards: DeckCard[], type: string) {
  return cards.reduce((sum, card) => {
    const energyType = pokemonTypeByBasicEnergyName[normalizeCardLimitName(card.cardName)];
    return energyType === type ? sum + card.count : sum;
  }, 0);
}

function countDeckCards(cards: DeckCard[]) {
  return cards.reduce((sum, card) => sum + card.count, 0);
}
