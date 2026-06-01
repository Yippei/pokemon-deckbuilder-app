# Render frontend deploy

一般ユーザーが使うURLはフロントエンドの公開URLです。
バックエンドURLを直接開くと、疎通確認用のJSONだけが表示されます。

## 構成

- Frontend: Render Web Service `pokemon-deckbuilder-front`
- Backend API: 既存Render Web Service `https://pokemon-deckbuilder-app.onrender.com`

このリポジトリの `render.yaml` は、既存APIを作り直さずにフロントエンドだけをRenderへ追加する設定です。

## Renderで作成するサービス

Render Dashboardでこのリポジトリを選択し、BlueprintまたはWeb Serviceとしてフロントエンドを作成します。

- Runtime: Node
- Root Directory: `front`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start -- -H 0.0.0.0 -p $PORT`
- Plan: Free
- Environment Variable:
  - `NEXT_PUBLIC_API_URL=https://pokemon-deckbuilder-app.onrender.com`

## バックエンド側で必要な設定

フロント公開URLが決まったら、既存バックエンドの環境変数 `ALLOWED_ORIGINS` に追加します。

例:

```text
http://localhost:3000,https://pokemon-deckbuilder-front.onrender.com
```

Renderのサービス名を変更した場合は、実際に発行されたフロントURLへ置き換えてください。

## 注意

- Render Free Planは無料枠ですが、サービス停止や起動待ちなどの制限があります。
- 将来Renderの料金体系が変わる可能性があります。費用が発生しそうな変更をする前に確認してください。
