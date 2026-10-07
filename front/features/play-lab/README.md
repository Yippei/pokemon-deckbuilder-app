# Play Lab modules

一人回し・AI対戦で共有するロジックを、画面コンポーネントから分離して管理します。

- `types.ts`: ゲーム状態、効果、選択プロンプトの型
- `card-rules.ts`: カード分類、進化、検索対象、効果プロファイルの判定
- `game-setup.ts`: デッキ展開、初手抽選、初手確率
- `battle-engine.ts`: 対戦初期化、進化、ワザ、ダメージ、きぜつ処理
- `deck-insights.ts`: デッキ概要とAI方針の表示文
- `ui-config.ts`: モード、AIスタイル、画面装飾の定義

各エンジン関数はReactのstateを直接変更せず、入力から結果を返す形を維持します。画面固有のstate更新とモーダル制御は `app/ai-battle-room/page.tsx` が担当します。
