---
name: discord-mcp-messaging
description: 'Discord MCP (mcp__discord__*) でテキストチャンネル・フォーラムスレッドへメッセージを送信する手順。チャンネルIDが未指定でも「カテゴリ名+チャンネル名」「フォーラム名+スレッド名」から解決して送信する。Use When: 「discordで〜と送って」「ja カテゴリの talk に送信」「tweet フォーラムの test1 スレッドに返信」「discord にメッセージ投げて」など、Discord へのメッセージ投稿を依頼されたとき。MCPセットアップ・ログインは対象外（既にログイン済み前提）。'
---

## 前提

- Discord MCP (`mcp-discord`) が設定済みかつ Bot がログイン済み。`discord_list_servers` がエラーなくサーバー一覧を返せる状態。未ログインなら本スキルの対象外。
- `mcp__discord__*` は deferred tool。**呼ぶ前に `ToolSearch` で schema をロードする**。していないと `InputValidationError` で失敗する。

## 手順

### Step 1. 必要なツールをロード

最初に呼びそうなものをまとめて 1 回でロードする（並列より 1 回でまとめた方が安い）。

```
ToolSearch({ query: "select:mcp__discord__discord_list_servers,mcp__discord__discord_get_server_info,mcp__discord__discord_send,mcp__discord__discord_list_forum_threads,mcp__discord__discord_reply_to_forum,mcp__discord__discord_create_forum_post", max_results: 10 })
```

追加で必要になったら都度 `select:...` で読み足す。

### Step 2. 送信先の解決

ユーザー指示の形式で分岐する。

| 指示の形式 | 解決方法 |
|---|---|
| `channelId` を直接渡された | そのまま使う。Step 3 へ |
| 「サーバー名 X の Y チャンネル」 | `discord_list_servers` → 該当 guild の id → `discord_get_server_info(guildId)` |
| 「カテゴリ A の B チャンネル」 | `discord_get_server_info` で `categories.details.text` から `name === "B" && categoryId === (categoryで name === "A" の id)` を 1 件選ぶ |
| 「フォーラム F の スレッド T」 | `discord_get_server_info` で forum id を特定 → `discord_list_forum_threads(forumChannelId)` で `name === "T"` の thread id |

**重要 (Gotcha):** 多言語サーバ等では同名チャンネルが複数カテゴリに存在する（例: `ja/talk`, `en/talk`, `zh-TW/talk`）。`name` だけで決め打ちせず、必ず `categoryId` で絞る。1 件に絞れない場合はユーザーに確認する。

サーバーが 1 つしかない場合は `discord_list_servers` をスキップして直接 guildId を使ってよい（ただし初回のみ確認しておくと安全）。

### Step 3. 送信

送信先の **チャンネル種別** で使うツールが異なる。

| 種別 | ツール | 必須引数 |
|---|---|---|
| テキストチャンネル (`GuildText`) | `discord_send` | `channelId`, `message` |
| フォーラムスレッド（既存スレッドへ返信） | `discord_reply_to_forum` | `threadId`, `message` |
| フォーラム（新規ポスト作成） | `discord_create_forum_post` | `forumChannelId`, `title`, `content` |

**やってはいけない:**
- フォーラムチャンネル ID を `discord_send` に渡す → 失敗する。フォーラムへの投稿は新規ポスト作成 (`discord_create_forum_post`) または既存スレッドへの返信 (`discord_reply_to_forum`) のいずれか。
- フォーラム内のスレッド ID を `discord_send` に渡すのも避ける（`discord_reply_to_forum` を使う）。

### Step 4. 結果確認

各ツールは成功時に message ID もしくは確認文字列を返す。失敗時はエラー文字列を返すので、エラーが返ったらユーザーに原因を伝えて止まる（リトライしない）。

特に `Discord client not logged in.` が返った場合はセットアップ問題。本スキルの範囲外なのでユーザーに報告する。

## Gotchas

- **同名チャンネル問題**: 多言語 Discord サーバでは `talk` などの同名 text channel がカテゴリごとに存在する。`categoryId` を必ず併用して一意化する。
- **フォーラム ≠ テキストチャンネル**: `GuildForum` 型のチャンネルに `discord_send` は通らない。スレッドを介して投稿する。
- **deferred tool**: `mcp__discord__*` は schema 未ロード状態では呼べない。Step 1 を飛ばして直接呼ぶと `InputValidationError`。
- **`discord_get_server_info` のレスポンスは大きい**: text/voice/category/forum 全列挙される。チャンネル数の多いサーバでは応答が長いので、結果を変数に取って必要箇所だけ参照する形でメモリにとどめる。
- **同じ会話内で繰り返し送る場合**: 一度解決した channelId / threadId は会話コンテキストに残しておき、再度の `discord_get_server_info` を避ける。
