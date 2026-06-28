# カードマスター設計

更新日: 2026-06-27

この文書は、公式カード情報を手動で取り込み、AWS上で再利用するための設計メモです。

## 方針

- 公式カード一覧に登録済みのカードは、原則として更新後に内容が変わらない前提で扱う
- 更新は定期実行ではなく、手動実行のバッチで行う
- 収集元の主導権は運用者側に置く
- 実行時のアプリケーションは、保存済みの正規化データを優先して参照する

## DynamoDB 項目定義

新規テーブル:

- テーブル名: `${project_name}-${environment}-card-master`
- キー:
  - `pk`
  - `sk`
- 課金方式:
  - `PAY_PER_REQUEST`

### 主な属性

- `pk`
  - 例: `CARD#sv1-001`
- `sk`
  - 例: `META`
- `cardId`
- `name`
- `nameNormalized`
- `cardKind`
  - `pokemon | trainer | energy`
- `subKind`
  - `ポケモン | グッズ | サポート | スタジアム | 基本エネルギー | 特殊エネルギー`
- `regulation`
  - 例: `H`, `I`, `J`
- `setCode`
- `setName`
- `stage`
- `stageCategory`
  - `basic | evolution | unknown`
- `evolvesFrom`
- `familyId`
  - 進化ラインを束ねる識別子
- `stageOrder`
  - たね: `0`, 1進化: `1`, 2進化: `2`
- `hp`
- `types`
- `attacks`
- `abilities`
- `ruleText`
- `retreatCost`
- `weaknesses`
- `resistances`
- `searchTokens`
- `officialUrl`
- `imageUrl`
- `sourceHash`
- `rawHtmlKey`
- `rawJsonKey`
- `normalizedKey`
- `historyKey`
- `fetchedAt`
- `updatedAt`

### GSI

- `name-index`
  - `hash_key = nameNormalized`
  - `range_key = cardId`
- `family-index`
  - `hash_key = familyId`
  - `range_key = stageOrder`

## S3 保存キー設計

新規バケット:

- `pokemon-deckbuilder-dev-card-master-<account-id>`

保存プレフィックス:

- `cards/`

### 実行単位

```text
cards/runs/<runId>/manifest.json
cards/runs/<runId>/raw/<cardId>.html
cards/runs/<runId>/raw/<cardId>.json
cards/runs/<runId>/normalized/<cardId>.json
```

### 現行参照

```text
cards/current/index.json
cards/current/<cardId>.json
```

### 履歴

```text
cards/history/<cardId>/<runId>.json
```

## 更新バッチの流れ

1. 公式カード情報を手動で取得する
2. 取得した内容を `cards` 配列として JSON にまとめる
3. `scripts/card-master-sync.mjs` を実行する
4. 原本 HTML/JSON を S3 に保存する
5. 正規化データを S3 と DynamoDB に保存する
6. `manifest.json` と `current/index.json` を更新する
7. アプリ本体は DynamoDB を優先して参照する

## 更新コマンド例

```sh
cd /Users/ippei/aws-backend-terraform
node scripts/card-master-sync.mjs \
  --input /path/to/card-master-export.json \
  --table-name pokemon-deckbuilder-dev-card-master \
  --bucket-name pokemon-deckbuilder-dev-card-master-<account-id> \
  --prefix cards
```

## 期待する効果

- デッキ生成の候補カードを安定して絞り込める
- 一人回しのたね/進化判定がカードマスター優先で安定する
- AI対戦の盤面推定が安定する
- 外部サイト依存を更新バッチに閉じ込められる
