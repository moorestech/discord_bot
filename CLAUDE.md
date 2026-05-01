# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

moorestech用のDiscordボット。TypeScriptとdiscord.jsで構築。AWS Lightsail Instanceへデプロイ。ヘルスチェック用のWebサーバーを内蔵。

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

## 機能追加時の注意

- 新しい機能を追加した際は、必ず `/help-ja` と `/help-en` コマンドの内容も更新してください
- ヘルプコマンドは `src/bot/events/interactionCreate.ts` で定義されています

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

## AWS Lightsailデプロイ

**インフラ:** Terraform管理（`terraform/`）
**サーバー:** Lightsail Instance（nano: 512MB RAM, 2 vCPU, ~$5/月）
**OS:** Amazon Linux 2023
**プロセス管理:** systemd（discord-bot.service）

**前提条件:**
- AWS CLI（`aws configure`済み）
- Terraform
- SSH鍵ペア

**初回セットアップ:**
```bash
# 1. SSH鍵ペアの生成
ssh-keygen -t ed25519 -f ~/.ssh/discord-bot-key -C "discord-bot"

# 2. Terraformの初期化
cd terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsにDiscord設定とSSH公開鍵を記入
terraform init

# 3. インフラ作成
terraform apply

# 4. 初回デプロイ（user_data完了まで2-3分待ってから）
cd ../scripts
./deploy.sh
```

**更新時（コード変更後）:**
```bash
cd scripts && ./deploy.sh
```

**運用コマンド:**
```bash
# インスタンス状態確認
aws lightsail get-instance --instance-name moorestech-discord-bot

# SSH接続
ssh -i ~/.ssh/discord-bot-key ec2-user@<INSTANCE_IP>

# ログ確認（SSH接続後）
sudo journalctl -u discord-bot -f

# サービス再起動
sudo systemctl restart discord-bot
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
