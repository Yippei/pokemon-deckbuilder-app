# Render integrated deploy

Renderの1つのWeb Serviceで、Go APIとフロントエンドを同じURLから配信します。

```text
https://pokemon-deckbuilder-app.onrender.com/
```

## 構成

- `/`、`/decks/new`、`/decks/view?id=...`: フロントエンド
- `/cards`: カード検索API
- `/decks`: デッキ作成API
- `/decks/generate`: AIデッキ生成API
- `/decks/{deckId}`: デッキ取得・更新・削除API
- `/healthz`: Renderヘルスチェック
- `/readyz`: DB疎通確認

フロントエンドはNext.jsの静的出力として `front/out` にビルドし、Goサーバーが配信します。
既存RenderサービスがGoランタイムのままでも動くように、`front/out` はリポジトリに含めます。

## RenderのBuild / Start設定

既存のRender Web Serviceで以下に変更します。

```text
Build Command:
go build -trimpath -o server .

Start Command:
./server
```

Dockerでデプロイする場合は、このリポジトリの `Dockerfile` がフロントビルドとGoビルドをまとめて実行します。

フロントエンドを変更した場合は、コミット前に以下を実行して `front/out` を更新してください。

```text
cd front && npm run build
```

## 環境変数

同一オリジンで動くため、フロント用の `NEXT_PUBLIC_API_URL` は不要です。

Render側では以下を設定してください。

```text
DATABASE_URL=...
GEMINI_API_KEY=...
```

`GROQ_API_KEY` を使う場合だけ追加します。

`ALLOWED_ORIGINS` は外部フロントを使わない限り必須ではありません。ローカル開発で使う場合は以下で十分です。

```text
ALLOWED_ORIGINS=http://localhost:3000
```

## 注意

- Render Free Planを使う範囲なら通常は無料です。
- 無料枠にはスリープ、起動待ち、利用量制限があります。
- 有料プランや独自ドメイン購入が必要になりそうな変更は、事前に確認してください。
