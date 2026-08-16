# PKS Studio

ポケモンカードのデッキ構築、カード検索、デッキ生成、一人回し練習をまとめたWebアプリケーションです。ブラウザ版を中心に、PWA/Capacitorによるスマートフォン向け画面も試験的に実装しています。

## Demo

- Web: https://d3cys6wuvgcwll.cloudfront.net/
- 一人回し: https://d3cys6wuvgcwll.cloudfront.net/ai-battle-room?mode=solo

## 主な機能

- デッキ作成、編集、保存
- カード名検索とカード候補表示
- デッキ生成補助
- 一人回し練習画面
- AI対戦画面
- 手札、山札、サイド、トラッシュ、バトル場、ベンチの操作
- カード効果の一部自動処理
- ポケモンの特性、ワザ、ルールテキスト確認
- たね/進化判定、サポート使用制限、エネルギー添付制限などの基本的な操作補助
- AI側のターン自動進行、通常ドロー、基本的な盤面展開、攻撃、サイド取得、勝敗判定
- スマートフォン向け読み取り専用画面
- PWA manifest、Capacitor iOSプロジェクト

## 技術スタック

- Frontend: Next.js, React, TypeScript
- Styling: Tailwind CSS
- Validation: Zod
- Mobile: PWA, Capacitor iOS
- Hosting: S3 static hosting + CloudFront
- Auth/API: Cognito, API Gateway, Lambda, DynamoDB
- CI/CD: GitHub Actions

このリポジトリには主にフロントエンドとドキュメントを置いています。AWSバックエンドは別管理のTerraform/Lambda構成を前提にしています。

## 実装で重視した点

- カードマスターJSONを使い、カード種別、進化段階、特性、ワザ、ルールテキストをUI操作に反映
- 公式ルールを完全再現するのではなく、一人回しで必要な操作補助に範囲を絞る
- ブラウザ版とスマホ版を分け、スマホ側は既存画面に影響しない専用画面として実装
- 将来的な同期を前提に、ローカル/クラウド保存の境界を意識した設計
- 生成物、署名情報、環境変数を公開リポジトリに含めない運用

## ディレクトリ構成

```text
.
├── front/
│   ├── app/                 # Next.js App Router
│   ├── components/          # UI components
│   ├── lib/                 # API/Auth/Sync helpers
│   ├── public/              # public assets and card master JSON
│   ├── scripts/             # card master/news update scripts
│   ├── ios/                 # Capacitor iOS project
│   └── capacitor.config.ts
├── docs/                    # design notes and operation docs
├── archive/                 # legacy implementation and old notes
└── .github/workflows/       # GitHub Actions
```

## ローカル起動

```bash
cd front
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## ビルド

```bash
cd front
npm run build:aws
```

静的出力は `front/out` に生成されます。`front/out` はビルド成果物のためGit管理対象外です。

## iOSアプリとして確認する場合

```bash
cd front
npm run cap:sync:ios
npm run cap:open:ios
```

Xcodeで `App` schemeを選び、接続したiPhoneを実行先にしてRunします。署名のTeam設定は各開発者のApple Accountで設定します。

## 環境変数

ブラウザに公開される値のみ `NEXT_PUBLIC_*` として使います。実際のシークレットはGitHub SecretsやAWS側で管理します。

主な変数:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`

## 今後の改善

- スマホ版の編集・保存機能
- カード効果処理の対応範囲拡大
- 一人回しログの保存と再生
- AI対戦の判断AI強化
  - 行動候補のスコアリング
  - 行動理由のログ表示
  - サーチ先、エネルギー添付先、攻撃対象の評価改善
  - コンボや勝ち筋を考慮した中長期判断
- デッキ診断、採用理由、入れ替え候補の提示
- README用のスクリーンショット追加

## Notes

このアプリは個人開発のポートフォリオです。ポケモンカードの著作権、商標、カード画像等の権利は各権利者に帰属します。
