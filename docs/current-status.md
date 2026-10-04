# Current Status

更新日: 2026-09-28

このメモは、現時点のリポジトリ構成と実装状況を整理したスナップショットです。
現行の本番系は AWS サーバーレス構成です。AWS バックエンドは別リポジトリ管理のため、この文書ではフロントエンドから確認できる接続仕様を中心に記載します。

## Git の状態

- 作業ブランチ: `機能開発`
- 更新前の最新コミット: `a8c09a4 Update Pokemon Card official news`
- 上記時点で `main` / `origin/main` と同一
- 公式ニュース JSON は GitHub Actions で日次更新

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

> このディレクトリは別管理の AWS バックエンドリポジトリにあり、本リポジトリには含まれません。

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
- `aws-backend-terraform/lambda_src/index.mjs`（別リポジトリ）
- `aws-backend-terraform/main.tf`（別リポジトリ）

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
- `aws-backend-terraform/card_master.tf`（別リポジトリ）
- `aws-backend-terraform/scripts/card-master-sync.mjs`（別リポジトリ）

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
- `aws-backend-terraform/lambda_src/index.mjs`（別リポジトリ）
- [`front/lib/api.ts`](../front/lib/api.ts)

| Method | Path | 概要 |
| --- | --- | --- |
| GET | `/health` | ヘルスチェック |
| GET | `/cards?name=&pg=` | カード検索 |
| GET | `/cards/{cardId}` | カード詳細取得 |
| GET | `/decks` | ログインユーザーのデッキ一覧 |
| POST | `/decks` | デッキ作成 |
| GET | `/decks/{deckId}` | デッキ取得 |
| PUT | `/decks/{deckId}` | デッキ更新 |
| DELETE | `/decks/{deckId}` | デッキ削除 |
| POST | `/decks/generate` | AIデッキ生成 |
| GET | `/decks/generate/{jobId}` | 非同期生成ジョブの状態取得 |
| OPTIONS | `/{proxy+}` | CORS 用 |

認証:

- `ANY /{proxy+}` は Cognito JWT 必須です。
- `GET /health` と `OPTIONS /{proxy+}` は認証なしです。

### フロントエンドルート

対象ファイル:
- [`front/app/page.tsx`](../front/app/page.tsx)
- [`front/app/decks/new/page.tsx`](../front/app/decks/new/page.tsx)
- [`front/app/decks/view/page.tsx`](../front/app/decks/view/page.tsx)
- [`front/app/auth/callback/page.tsx`](../front/app/auth/callback/page.tsx)
- [`front/app/ai-battle-room/page.tsx`](../front/app/ai-battle-room/page.tsx)

| Route | 概要 |
| --- | --- |
| `/` | トップ |
| `/decks/new` | デッキ作成 |
| `/decks/view?id=...` | デッキ閲覧・編集 |
| `/auth/callback` | Cognito コールバック |
| `/ai-battle-room?mode=solo` | 一人回し |
| `/ai-battle-room?mode=ai` | AI対戦練習 |
| `/mobile` | スマートフォン向け画面 |
| `/about` | アプリについて |
| `/feedback` | Google Forms へのフィードバック導線 |

## 2026-06-27 以降の主な進捗

- PWA / Capacitor iOS 対応とスマートフォン向け画面を追加しました。
- 一人回しのモバイル UI、Undo、ヒント、カード効果処理を拡充しました。
- AI 対戦の自動ターン、通常ドロー、攻撃、サイド取得、勝敗判定を追加しました。
- デッキ生成の進化ライン、エネルギー要件、ACE SPEC、カード役割の検証・補正を強化しました。
- デッキ生成 API の非同期ジョブに対応しました。
- ホーム画面を再設計し、公式ニュース、ポケカジム情報、About、フィードバック導線を追加しました。
- 公式ニュースの日次自動更新 workflow を追加しました。

## 主な残タスク・技術的負債

1. スマートフォン向け画面の編集・保存機能を拡充する。

2. 一人回しのカード効果対応範囲を広げ、ログの保存・再生を追加する。

3. AI 対戦の行動評価、行動理由、コンボ・勝ち筋判定を強化する。

4. デッキ診断、採用理由、入れ替え候補の提示を追加する。

5. カード検索の外部サイト依存を減らす
   - `pokemon-card.com` の HTML / API 仕様変更で壊れやすいです。
   - レート制限や一時障害の影響を受けます。

6. デッキ生成ロジックがヒューリスティック中心
   - 候補カードプール、名前正規化、進化ライン補完などを個別ルールで補っています。
   - ルールが増えるほど挙動を追いにくくなります。

7. 候補カードの解決が脆い
   - ポケモン名の表記ゆれ、進化前後、メガ / ex / V 系の扱いで補正ロジックが多いです。
   - 以前の不具合もこの周辺で発生しています。

8. カードマスターの本体移行はまだ途中
   - 取り込み基盤は追加済みですが、既存の検索・判定ロジックはまだ外部サイト依存が残っています。
   - 次段階で runtime をカードマスター参照へ寄せる必要があります。

9. 監視が弱い
   - CloudWatch アラームはデフォルト無効です。
   - ログはあるが、継続監視の仕組みは薄いです。

10. 認証・環境変数の依存が強い
   - Cognito の callback/logout URL、API URL、CloudFront URL などを手で揃える必要があります。
   - 環境差分がそのまま不具合になりやすいです。

11. GitHub Actions の環境変数管理が必要
   - AWS 認証情報、S3 バケット名、CloudFront distribution id を GitHub Secrets で持つ必要があります。
   - secrets 未設定だと自動同期が失敗します。

## まとめ

- 現行本番は AWS サーバーレス構成です。
- 退役保管庫は完全に参照不要として切り離しています。
- データモデル、認証、配信経路は AWS 系に一本化しています。
- フロントエンドではデッキ構築、一人回し、AI 対戦、PWA / iOS 対応を継続的に拡張しています。
