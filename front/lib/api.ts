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
    return parsed.data;
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
