# 言語ロール一括付与（一時機能）設計

## 目的
既存の Discord ロール `🇯🇵japanese` と `🇬🇧english` を、サーバーの全メンバー（bot含む）に一括付与する。付与完了を確認したらコードを撤去する使い捨て機能。

## トリガー
bot 起動時の `ready` イベント内で自動実行。

## 配置
- 新規: `src/services/languageRoleAssignService.ts`
- 変更: `src/bot/events/ready.ts` から `languageRoleAssignService.run(client)` を呼び出す

## 動作
1. `client.guilds.cache` の各ギルドに対して順次処理
2. ロール名一致で `🇯🇵japanese` と `🇬🇧english` を解決。どちらか欠けていればそのギルドはスキップしエラーログ
3. `guild.members.fetch()` で全メンバーを取得
4. メンバーごとに、未保持のロールのみ `member.roles.add(missingRoleIds, "一括付与")`
5. 連続呼び出しを避けるため 200ms 待機を挟む
6. 50 件ごとに進行ログ、完了時に集計ログ

## ログフォーマット
- `[LanguageRoleAssign] 開始: guild=<name>(<id>) 対象=<n>人`
- `[LanguageRoleAssign] 進行: <i>/<n>`
- `[LanguageRoleAssign] 完了: guild=<name> 付与=<x> 既保持スキップ=<y> 失敗=<z>`
- `[LanguageRoleAssign] 失敗: <userTag> reason=<msg>`

## エラー方針
- ロール未解決：そのギルドは中断、他ギルドは続行
- メンバー個別失敗：その1人だけスキップして続行
- bot 自身の階層不足：個別失敗として記録される

## 検証
1回目デプロイ後、Lightsail で `sudo journalctl -u discord-bot -f | grep LanguageRoleAssign` を確認、または Discord 側で全員にロールが付いていることを確認。

## 撤去
ユーザー確認後、以下を削除する 2 回目のコミット：
- `src/services/languageRoleAssignService.ts` を削除
- `src/bot/events/ready.ts` の呼び出しを除去

## YAGNI として除外
- スラッシュコマンド（自動起動指定のため）
- 実行済みフラグ管理（撤去前提なので冪等で十分。再起動時もスキップ条件で実害なし）
- 個別ユーザー除外
- 設定ファイル化（一過性）
