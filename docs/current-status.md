# Current Status

更新日: 2026-06-27

このメモは、現時点のリポジトリ構成をそのまま整理したスナップショットです。  
現行の本番系は AWS サーバーレス構成です。退役した実装や移行記録は別保管に分離してあり、通常開発では読まない前提です。

## アーキテクチャ

### 現行の本番系

```text
Browser
  -> CloudFront
  -> S3（front/out の静的出力）
  -> Cognito Hosted UI / JWT
  -> API Gateway HTTP API
  -> Lambda (nodejs24.x)
  -> DynamoDB
  -> CloudWatch Logs / Metrics
  -> S3 ai-training/（生成ログ保存）
```

- フロントエンドは Next.js の静的出力です。
- 認証は Cognito Hosted UI + JWT です。
- API Gateway は JWT Authorizer で保護されています。
- Lambda は DynamoDB を直接読み書きします。
- 生成AIは Groq を第一候補、GEMINI をフォールバックとして呼びます。
- 生成デッキの記録は S3 の `ai-training/` プレフィックスへ保存します。
- フロントは Cognito JWT を付けて AWS API のみを呼びます。デッキ作成時に `ownerId` を送る前提はなくなりました。
- 公式カード情報の取り込み用に、カードマスターの S3 / DynamoDB 基盤を追加しました。更新は手動バッチで行います。
- カード詳細の判定は、まずカードマスターを見て、足りない場合だけ公式カードサイトへフォールバックします。

### 旧来の実装

```text
Browser
  -> Go HTTP server
  -> PostgreSQL
  -> Render / ローカル配信
```

- legacy の Go + PostgreSQL 実装は退役保管庫へ移しました。
- 旧 Render / AWS 移行前の整理ドキュメントも退役保管庫へ移しました。
- これらは履歴保管のみで、通常作業では参照しません。

### いま見えている構成上の分岐

- 現行の本番系は AWS 側。
- Go + PostgreSQL は legacy。
- 実装の読み先は AWS 本番系に一本化しています。
- 退役保管庫は読む必要がない領域です。

## ディレクトリ構成

### ルート

- `front/`  
  Next.js フロントエンド本体。
- `docs/`  
  運用メモと移行ドキュメント。
- 退役保管庫  
  以前の実装や移行記録をまとめた保管場所。通常開発では開かない前提です。

### `front/`

- `front/app/`  
  画面ルート。
- `front/components/`  
  UI コンポーネント。
- `front/lib/`  
  認証、API 呼び出しなどの共有処理。
- `front/public/`  
  静的アセット。
- `front/out/`  
  静的 export の成果物。現在の配信物として S3 に同期される前提。
- GitHub Actions  
  `main` への push を起点に、フロントを AWS へ自動同期する workflow を追加済みです。

### `aws-backend-terraform/`

- `lambda_src/`  
  Lambda 本体。デッキ生成、DB操作、学習ログ保存を担当。
- `main.tf`  
  API Gateway、Lambda、DynamoDB、S3、IAM の中心定義。
- `cognito.tf`  
  Cognito User Pool / Client / Domain / JWT Authorizer。
- `frontend.tf`  
  S3 + CloudFront の静的 frontend 配信。
- `monitoring.tf`  
  CloudWatch alarms。
- `variables.tf` / `locals.tf` / `outputs.tf`  
  変数・共通値・出力。

## DB構造

### 旧 PostgreSQL モデル

対象は退役保管庫にある legacy 実装です。通常開発では参照不要です。

テーブル:

- `decks`
  - `deck_id UUID PRIMARY KEY`
  - `owner_id TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `created_at TIMESTAMPTZ`
  - `updated_at TIMESTAMPTZ`
- `deck_cards`
  - `deck_id UUID REFERENCES decks(deck_id) ON DELETE CASCADE`
  - `card_id TEXT`
  - `card_name TEXT`
  - `illustration TEXT`
  - `count INT CHECK (count >= 1)`
  - `PRIMARY KEY (deck_id, card_id)`
- `cards`
  - `card_id TEXT PRIMARY KEY`
  - `name TEXT`
  - `regulation TEXT`
  - `card_type TEXT`
  - `illustration TEXT`

特徴:

- デッキとカードを正規化した関係モデルです。
- ただし現行本番系ではこの Postgres モデルは使っていません。

### 現行 AWS DynamoDB モデル

対象ファイル:
- [aws-backend-terraform/lambda_src/index.mjs](/Users/ippei/aws-backend-terraform/lambda_src/index.mjs)
- [aws-backend-terraform/main.tf](/Users/ippei/aws-backend-terraform/main.tf)

テーブル:

- `pokemon-deckbuilder-dev-app`
- キー:
  - `pk`
  - `sk`

デッキ item 例:

- `pk = USER#<cognito sub>`
- `sk = DECK#<deckId>`
- 属性:
  - `deckId`
  - `ownerId`
  - `name`
  - `cards`（JSON文字列）
  - `createdAt`
  - `updatedAt`

特徴:

- ユーザー単位で `pk` を切る単一テーブル運用です。
- 1デッキ=1 item ではなく、`cards` を JSON として持っています。
- カード辞書テーブルは持たず、カード検索は外部サイト `pokemon-card.com` に依存します。
- 生成ログは DynamoDB ではなく S3 の `ai-training/` に保存します。

### カードマスター用モデル

対象ファイル:
- [aws-backend-terraform/card_master.tf](/Users/ippei/aws-backend-terraform/card_master.tf)
- [aws-backend-terraform/scripts/card-master-sync.mjs](/Users/ippei/aws-backend-terraform/scripts/card-master-sync.mjs)

テーブル:

- `pokemon-deckbuilder-dev-card-master`
- キー:
  - `pk`
  - `sk`

代表属性:

- `cardId`
- `name`
- `nameNormalized`
- `cardKind`
- `subKind`
- `regulation`
- `stage`
- `stageCategory`
- `evolvesFrom`
- `familyId`
- `stageOrder`
- `hp`
- `types`
- `attacks`
- `searchTokens`
- `officialUrl`
- `imageUrl`
- `rawHtmlKey`
- `rawJsonKey`
- `normalizedKey`
- `historyKey`

特徴:

- 公式カード情報の原本と正規化後データを分離して保存します。
- 更新は `scripts/card-master-sync.mjs` を使う手動バッチです。
- S3 は `cards/runs/`, `cards/current/`, `cards/history/` に分けます。
- DynamoDB はカード検索・進化ライン復元・一人回しの判定用の正規化マスターです。
- 一人回しのカード判定はカードマスター優先です。未登録カードだけ公式カードサイトへフォールバックします。

## API一覧

### 現行 AWS 本番 API

対象ファイル:
- [aws-backend-terraform/lambda_src/index.mjs](/Users/ippei/aws-backend-terraform/lambda_src/index.mjs)
- [front/lib/api.ts](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/lib/api.ts)

| Method | Path | 概要 |
| --- | --- | --- |
| GET | `/health` | ヘルスチェック |
| GET | `/cards?name=&pg=` | カード検索 |
| GET | `/decks` | ログインユーザーのデッキ一覧 |
| POST | `/decks` | デッキ作成 |
| GET | `/decks/{deckId}` | デッキ取得 |
| PUT | `/decks/{deckId}` | デッキ更新 |
| DELETE | `/decks/{deckId}` | デッキ削除 |
| POST | `/decks/generate` | AIデッキ生成 |
| OPTIONS | `/{proxy+}` | CORS 用 |

認証:

- `ANY /{proxy+}` は Cognito JWT 必須です。
- `GET /health` と `OPTIONS /{proxy+}` は認証なしです。

### フロントエンドルート

対象ファイル:
- [front/app/page.tsx](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/app/page.tsx)
- [front/app/decks/new/page.tsx](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/app/decks/new/page.tsx)
- [front/app/decks/view/page.tsx](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/app/decks/view/page.tsx)
- [front/app/auth/callback/page.tsx](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/app/auth/callback/page.tsx)
- [front/app/ai-battle-room/page.tsx](/Users/ippei/Desktop/pokemon-deckbuilder-app/front/app/ai-battle-room/page.tsx)

| Route | 概要 |
| --- | --- |
| `/` | トップ |
| `/decks/new` | デッキ作成 |
| `/decks/view?id=...` | デッキ閲覧・編集 |
| `/auth/callback` | Cognito コールバック |
| `/ai-battle-room` | プレイラボ（AI対戦練習 / 一人回し） |

## 技術的負債

1. ドキュメントが古い
   - Render 前提のメモ、AWS 準備メモ、現行 AWS 実装が混在しています。
   - 同じ操作でも説明が食い違う箇所があります。

2. `front/out` が成果物として残っている
   - 静的 export を同期するために必要ですが、差分が大きくなりやすいです。
   - ビルド結果の追跡がコードレビューを汚しやすいです。

3. カード検索が外部サイト依存
   - `pokemon-card.com` の HTML / API 仕様変更で壊れやすいです。
   - レート制限や一時障害の影響を受けます。

4. デッキ生成ロジックがヒューリスティック中心
   - 候補カードプール、名前正規化、進化ライン補完などを個別ルールで補っています。
   - ルールが増えるほど挙動を追いにくくなります。

5. 候補カードの解決が脆い
   - ポケモン名の表記ゆれ、進化前後、メガ / ex / V 系の扱いで補正ロジックが多いです。
   - 以前の不具合もこの周辺で発生しています。

6. カードマスターの本体移行はまだ途中
   - 取り込み基盤は追加済みですが、既存の検索・判定ロジックはまだ外部サイト依存が残っています。
   - 次段階で runtime をカードマスター参照へ寄せる必要があります。

6. 監視が弱い
   - CloudWatch アラームはデフォルト無効です。
   - ログはあるが、継続監視の仕組みは薄いです。

7. 認証・環境変数の依存が強い
   - Cognito の callback/logout URL、API URL、CloudFront URL などを手で揃える必要があります。
   - 環境差分がそのまま不具合になりやすいです。

8. GitHub Actions の環境変数管理が必要
   - AWS 認証情報、S3 バケット名、CloudFront distribution id を GitHub Secrets で持つ必要があります。
   - secrets 未設定だと自動同期が失敗します。

9. プレイラボは拡張中
   - `/ai-battle-room` で AI対戦練習 と 一人回し を利用できます。
   - 対戦ロジックの本体化や記録機能は未実装です。
   - ポケカジム表示は未実装です。
   - 検索機能は未実装です。
   - 初心用ルールは未実装です。
   - 汎用ルールは未実装です。

## まとめ

- 現行本番は AWS サーバーレス構成です。
- 退役保管庫は完全に参照不要として切り離しています。
- データモデル、認証、配信経路は AWS 系に一本化しています。
