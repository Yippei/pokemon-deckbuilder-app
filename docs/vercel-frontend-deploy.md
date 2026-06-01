# Vercel frontend deploy

一般ユーザーが使うURLはVercelのフロントエンドURLです。
RenderのバックエンドURLを直接開くと、APIレスポンスまたは404が表示されます。

## 構成

- Frontend: Vercel
- Backend API: Render `https://pokemon-deckbuilder-app.onrender.com`

## Vercel側の環境変数

Vercel DashboardでフロントエンドのProjectを開き、以下を設定します。

```text
NEXT_PUBLIC_API_URL=https://pokemon-deckbuilder-app.onrender.com
```

設定対象はProduction / Preview / Developmentのうち、少なくともProductionに入れてください。
環境変数を変更した後は、Vercelで再デプロイが必要です。

## Renderバックエンド側の環境変数

Vercelの公開URLが決まったら、Renderの既存バックエンドサービスで `ALLOWED_ORIGINS` に追加します。

例:

```text
http://localhost:3000,https://your-vercel-project.vercel.app
```

独自ドメインを使う場合は、そのドメインも追加します。

```text
http://localhost:3000,https://your-vercel-project.vercel.app,https://example.com
```

`ALLOWED_ORIGINS` を変更した後は、Renderのバックエンドを再デプロイまたは再起動してください。

## 確認方法

1. VercelのフロントURLを開く
2. カード検索またはデッキ一覧表示を試す
3. ブラウザのNetworkでAPIの接続先が `https://pokemon-deckbuilder-app.onrender.com` になっていることを確認する

## 注意

- Vercel HobbyプランとRender Freeプランを使う範囲なら通常は無料です。
- 無料枠にはスリープ、起動待ち、利用量制限があります。
- 有料プランや独自ドメイン購入が必要になりそうな変更は、事前に確認してください。
