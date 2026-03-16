const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Card = {
  cardId: string;
  name: string;
  regulation?: string;
  cardType?: string;
  illustration?: string;
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

// カード検索
export async function searchCards(params: { name?: string; pg?: number }): Promise<Card[]> {
  const query = new URLSearchParams();
  if (params.name) query.set("name", params.name);
  if (params.pg) query.set("pg", String(params.pg));

  const res = await fetch(`${API_URL}/cards?${query}`);
  if (!res.ok) throw new Error("カードの取得に失敗しました");
  const data = await res.json();
  return data.items;
}

// デッキ一覧はAPIにないので作成済みIDをlocalStorageで管理
export function getSavedDeckIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("deckIds");
  return raw ? JSON.parse(raw) : [];
}

export function saveDeckId(deckId: string) {
  const ids = getSavedDeckIds();
  if (!ids.includes(deckId)) {
    localStorage.setItem("deckIds", JSON.stringify([...ids, deckId]));
  }
}

export function removeDeckId(deckId: string) {
  const ids = getSavedDeckIds().filter((id) => id !== deckId);
  localStorage.setItem("deckIds", JSON.stringify(ids));
}

// デッキ取得
export async function getDeck(deckId: string): Promise<Deck> {
  const res = await fetch(`${API_URL}/decks/${deckId}`);
  if (!res.ok) throw new Error("デッキの取得に失敗しました");
  return res.json();
}

// デッキ作成
export async function createDeck(body: { ownerId: string; name: string; cards: DeckCard[] }): Promise<Deck> {
  const res = await fetch(`${API_URL}/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("デッキの作成に失敗しました");
  return res.json();
}

// デッキ更新
export async function updateDeck(deckId: string, body: { name?: string; cards?: DeckCard[] }): Promise<Deck> {
  const res = await fetch(`${API_URL}/decks/${deckId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("デッキの更新に失敗しました");
  return res.json();
}

// デッキ削除
export async function deleteDeck(deckId: string): Promise<void> {
  const res = await fetch(`${API_URL}/decks/${deckId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("デッキの削除に失敗しました");
}

// デッキ自動生成
export async function generateDeck(body: { theme: string; existingDeck?: DeckCard[] }): Promise<DeckCard[]> {
  const res = await fetch(`${API_URL}/decks/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("デッキの生成に失敗しました");
  const data = await res.json();
  return data.cards;
}
