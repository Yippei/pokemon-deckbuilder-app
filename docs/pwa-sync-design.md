# PKS Studio PWA / Sync Design

## Product Identity

- 内部名称: PKS Studio
- ホーム画面表示名: PKS
- 初期ルート: `/`
- 最初の対象端末: iPhone のホーム画面Webアプリ
- 配布方針: まずは自分用アプリ。初期段階ではストア公開しない
- iOS Bundle ID: `studio.pks.app`

## iOS App Shell

スマホではPWAではなく、CapacitorでiOSアプリ化する。ブラウザ版と同じNext.jsの静的出力を `WKWebView` 上で表示する。

```text
front/
  capacitor.config.ts
  ios/
```

基本操作:

```bash
npm run build
npx cap add ios
npm run cap:sync:ios
npm run cap:open:ios
```

## PWA Assets

PWA資産は `front/public` 配下で管理する。

```text
front/public/
  manifest.json
  icons/
    pks-icon.svg
    pks-icon-192.png
    pks-icon-512.png
    pks-icon-maskable-512.png
    apple-touch-icon.png
```

アイコンは中立的な暫定デザインにする。将来公開へ進める場合に備えて、公式ロゴ風、カード固有の意匠、保護されたモチーフは避ける。

## Sync Entity Contract

永続化するユーザーデータは、後からローカル保存からアカウント同期へ移せる形にそろえる。

```ts
type SyncEntity = {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};
```

ルール:

- すべての永続レコードは安定した `id` を持つ。
- すべての永続レコードは `createdAt` と `updatedAt` を持つ。
- すべての永続レコードは `schemaVersion` を持つ。
- 同期導入時は削除を `deletedAt` で表現できるようにする。
- ユーザー作成データと再生成できるキャッシュデータを混ぜない。

## Sync Collections

高優先度:

- `decks`
- `favorites`
- `appSettings`
- `userPreferences`

中優先度:

- `searchHistory`
- `battleRooms`
- `simulations`

低優先度:

- `metadata`

ローカル限定または再生成可能:

- カード画像キャッシュ
- 生成済み静的インデックス
- 一時的なUI状態
- スクロール位置
