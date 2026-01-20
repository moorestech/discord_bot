# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

moorestech用のDiscordボット。TypeScriptとdiscord.jsで構築。Renderへのデプロイを想定し、keep-alive用のWebサーバーを内蔵。

## コマンド

```bash
# 依存関係のインストール
npm install

# 開発実行（tsxによるホットリロード）
npx tsx src/index.ts

# ビルド
npx tsc

# ビルド済みコードの実行
node dist/index.js

# 型チェックのみ
npx tsc --noEmit
```

## アーキテクチャ

```
src/
├── index.ts          # エントリーポイント: 起動オーケストレーション（Web → コマンド登録 → Bot）
├── config.ts         # 環境設定とバリデーション
├── bot/
│   ├── client.ts     # Discordクライアント設定とイベントハンドラ
│   ├── commands.ts   # スラッシュコマンド定義（SlashCommandBuilder）
│   └── register.ts   # Discord REST APIによるコマンド登録
└── web/
    └── server.ts     # ヘルスチェック用Expressサーバー（/, /healthz）
```

**起動フロー:** Webサーバー → スラッシュコマンド登録 → Discordボット起動

**主要パターン:**
- SIGTERM/SIGINTでのグレースフルシャットダウン
- 最小限のIntents（GatewayIntentBits.Guildsのみ）
- GUILD_ID環境変数によるギルド固有/グローバルコマンド登録の切り替え

## 環境変数

必須:
- `DISCORD_TOKEN` - ボットトークン
- `DISCORD_CLIENT_ID` - アプリケーションクライアントID

オプション:
- `GUILD_ID` - ギルド固有コマンド登録用（登録が高速）
- `PORT` - Webサーバーポート（デフォルト: 3000）
- `NODE_ENV` - 環境モード

ローカル開発用に`.env.example`を`.env`にコピーしてください。

## 技術スタック

- TypeScript 5.x（strictモード）
- discord.js 14.x
- Express 4.x（keep-aliveサーバー）
- Node.js >= 18

## Renderデプロイ

**本番URL:** https://moorestech-discord-bot.onrender.com/

**エンドポイント:**
- `/` - ルート（"OK"を返す）
- `/healthz` - ヘルスチェック用

**デプロイ設定（render.yaml）:**
- ランタイム: Node.js
- ビルドコマンド: `npm ci --include=dev && npm run build`
- 開始コマンド: `npm start`
- プラン: Starter

**Render環境変数（要設定）:**
- `DISCORD_TOKEN` - ボットトークン
- `DISCORD_CLIENT_ID` - アプリケーションクライアントID
- `GUILD_ID` - ギルドID（オプション）
- `NODE_ENV` - `production`

**デプロイ方法:**
1. GitHubにpushすると自動デプロイ（autoDeploy有効）
2. 手動デプロイ: Renderダッシュボードまたは`render deploys create`

**Render CLI:**
```bash
# サービス一覧
render services -o yaml

# ログ確認
render logs -r srv-d5nkspv5r7bs73dqnoug -o yaml

# 手動デプロイ
render deploys create -r srv-d5nkspv5r7bs73dqnoug
```

---

# AI-DLCとSpec駆動開発

AI-DLC（AI Development Life Cycle）上でのKiroスタイルSpec駆動開発の実装

## プロジェクトコンテキスト

### パス
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### SteeringとSpecificationの違い

**Steering** (`.kiro/steering/`) - プロジェクト全体のルールとコンテキストでAIをガイド
**Specs** (`.kiro/specs/`) - 個別機能の開発プロセスを形式化

### アクティブなSpecification
- `.kiro/specs/`でアクティブなspecificationを確認
- `/kiro:spec-status [feature-name]`で進捗を確認

## 開発ガイドライン
- 英語で思考し、日本語で応答を生成。プロジェクトファイルに書き込むMarkdownコンテンツ（requirements.md、design.md、tasks.md、research.md、検証レポートなど）は、specificationで設定された対象言語で記述すること（spec.json.language参照）。

## 最小ワークフロー
- Phase 0（オプション）: `/kiro:steering`, `/kiro:steering-custom`
- Phase 1（Specification）:
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}`（オプション: 既存コードベース用）
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}`（オプション: 設計レビュー）
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2（実装）: `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}`（オプション: 実装後）
- 進捗確認: `/kiro:spec-status {feature}`（いつでも使用可）

## 開発ルール
- 3フェーズ承認ワークフロー: Requirements → Design → Tasks → Implementation
- 各フェーズで人間のレビューが必要。意図的なファストトラックの場合のみ`-y`を使用
- steeringを最新に保ち、`/kiro:spec-status`でアラインメントを確認
- ユーザーの指示に正確に従い、そのスコープ内で自律的に行動: 必要なコンテキストを収集し、このランで要求された作業をエンドツーエンドで完了する。質問は必須情報が欠けている場合や指示が重大に曖昧な場合のみ行う。

## Steering設定
- `.kiro/steering/`全体をプロジェクトメモリとしてロード
- デフォルトファイル: `product.md`, `tech.md`, `structure.md`
- カスタムファイルをサポート（`/kiro:steering-custom`で管理）
