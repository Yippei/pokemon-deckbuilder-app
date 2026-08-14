export type SyncEntity = {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type SyncCollection =
  | "decks"
  | "favorites"
  | "searchHistory"
  | "appSettings"
  | "userPreferences"
  | "battleRooms"
  | "simulations"
  | "metadata";

export type SyncPriority = "high" | "medium" | "low";

export type SyncCollectionDefinition = {
  collection: SyncCollection;
  priority: SyncPriority;
  description: string;
};

export const syncCollections: SyncCollectionDefinition[] = [
  {
    collection: "decks",
    priority: "high",
    description: "ユーザーが作成・編集したデッキ",
  },
  {
    collection: "favorites",
    priority: "high",
    description: "お気に入りカードやデッキ",
  },
  {
    collection: "appSettings",
    priority: "high",
    description: "アプリ全体の永続設定",
  },
  {
    collection: "userPreferences",
    priority: "high",
    description: "表示・操作に関するユーザー設定",
  },
  {
    collection: "searchHistory",
    priority: "medium",
    description: "カード検索やデッキ検索の履歴",
  },
  {
    collection: "battleRooms",
    priority: "medium",
    description: "対戦・練習ルームの保存状態",
  },
  {
    collection: "simulations",
    priority: "medium",
    description: "一人回しやシミュレーションの保存状態",
  },
  {
    collection: "metadata",
    priority: "low",
    description: "同期やマイグレーションに使う補助情報",
  },
];

export function createSyncEntityFields(now = new Date()): SyncEntity {
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}
