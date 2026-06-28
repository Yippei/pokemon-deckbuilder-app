# AWS backend preparation

> 注意: この文書はAWS移行前の下準備メモです。  
> 現在の本番系は別途 AWS サーバーレス構成で運用しています。

このリポジトリは、バックエンドをコンテナとしてAWSへ載せ替えられる状態にしていた時期の手順を残しています。  
この手順は下準備用で、AWSリソースの作成は含めません。

## 追加費用について

このリポジトリ内の変更だけでは月額費用は発生しない。
実際にAWSで以下を作成すると、無料枠を超えた場合に費用が発生する。

- App Runner / ECS / Elastic Beanstalk などの実行基盤
- ECR などのコンテナレジストリ
- RDS PostgreSQL
- Secrets Manager / Parameter Store
- ALB、NAT Gateway、CloudWatch Logs など

AWSへ作成する前に、利用するサービスと見積もりを確認すること。

## 推奨する最小構成

まだ構成が固まっていない段階では、次のどちらかが扱いやすい。

- App Runner + RDS PostgreSQL
- ECS Fargate + RDS PostgreSQL

App Runnerは構成が少なく済む。ECS Fargateは将来的な拡張やVPC設計の自由度が高い。

## バックエンド環境変数

AWS側では以下を環境変数またはシークレットとして設定する。

```text
PORT=8080
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
GROQ_API_KEY=...
ALLOWED_ORIGINS=https://frontend.example.com
```

`DATABASE_URL` と `GROQ_API_KEY` はソース管理に含めない。
AWSではSecrets ManagerかSSM Parameter Storeに置く。

## フロントエンド環境変数

バックエンドURLが決まったら、フロントエンドに設定する。

```text
NEXT_PUBLIC_API_URL=https://api.example.com
```

## ヘルスチェック

バックエンドは2種類のヘルスチェックを持つ。

- `/healthz`: プロセスが起動しているか確認する軽量チェック
- `/readyz`: DBへ疎通できるか確認する readiness チェック

AWSのコンテナヘルスチェックには `/healthz` を使う。
デプロイ後の接続確認や監視には `/readyz` を使う。

## ローカルでコンテナを確認

```bash
docker build -t pokemon-deckbuilder-api .
docker run --rm -p 8080:8080 \
  --env-file .env \
  pokemon-deckbuilder-api
```

別ターミナルで確認する。

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

## DB初期化

新しいPostgreSQLには `migrations/001_init.sql` を適用する。
既存DBでカード枚数制約や `illustration` カラムを合わせる場合は `migrations/002_relax_deck_card_count.sql` を適用する。
seed用の `cards` テーブルが未作成なら `migrations/003_create_cards.sql` も適用する。

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

既存DB向け:

```bash
psql "$DATABASE_URL" -f migrations/002_relax_deck_card_count.sql
psql "$DATABASE_URL" -f migrations/003_create_cards.sql
```

## AWSへ移すときの流れ

1. RDS PostgreSQLを作成する
2. `migrations/001_init.sql` を適用する
3. ECRへDockerイメージをpushする
4. App RunnerまたはECSでコンテナを起動する
5. `DATABASE_URL`、`GROQ_API_KEY`、`ALLOWED_ORIGINS` を設定する
6. `/healthz` と `/readyz` を確認する
7. フロントの `NEXT_PUBLIC_API_URL` をAWSバックエンドURLへ変更する

## 現時点で未実施のもの

- AWSリソース作成
- Terraform / CloudFormation / CDK の追加
- CI/CD
- 本番ドメイン、HTTPS証明書、WAFなどの設定

構成が決まった段階で、IaCとデプロイパイプラインを追加する。
