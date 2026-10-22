# hr Local JSON Implementation Plan

> **For the controller session (実装を担うsubagentはこのブロックを無視してよい):** subagent-driven-developmentで実行する。小規模単一実装モード。最終全ブランチレビュー・PR・本番検証を省略しない。

**Goal:** hrの区切り線をGoogleから切り離してコード同梱JSONから返す。
**Architecture:** 既存HrContentServiceのinitialize/getRandomContent/stopの呼び出し互換を維持し、fetchとタイマーを削除する。JSON静的importでtscのdistへ同梱する。区切り線取得→messageCreateの既存replyの一方向フローを保持する。
**Tech Stack:** TypeScript strict/CommonJS/resolveJsonModule、discord.js、Vitest、Node22。

## Requirements
- 取得済み公開CSV `/Users/sakastudio/hermes-agent/data/tmp/hr-json-migration/original.csv` 全96行を改変・並べ替え・重複除去せずstring[] JSONへ保存する。CSVとJSONの配列完全一致を実測する。
- hrの従来のランダム抽選と返信/入力削除等の挙動を維持する。外部fetch・周期更新・APIエラー文言を除去する。fetchがthrowする状態でも初期化・抽選成功するテストを通す。
- JSONをdistへ同梱し、srcを参照できない別cwdでcompiled serviceを実行して96件のいずれかを返すこと。
- 空配列/空文字/非文字列は起動時に明示失敗とし、欠落ファイルはビルドで失敗する。正常96件では既存起動が成立すること。
- help-ja/help-enの自由追加・スプシ・2〜3分反映案内をJSON編集とデプロイの説明に修正する。
- 全テスト・型チェック・build・独立全ブランチレビューを通し、commit/push/PR/merge、自動デプロイ成功と本番の実ファイル・サービス動作を検証する。
- 新たな永続DB・管理UI・権限変更・他機能の変更はしない。Botトークン/SSH鍵/Google認証値はログにも回答にも出さない。

## Global Constraints
- 最新origin/master 52b43ddから作ったfix/hr-local-json、作業場所は本planのあるworktree。
- 既存メソッドを再利用しAPI互換を維持。新依存不要。tsconfigのresolveJsonModuleは既にtrue。
- レビュー後コード変更した場合は全テストとcompiled smokeを再実行する。

## 配置と前例
- src/data/hr-contents.json: hr専用データ。既存同役割はHrContentService.contentsのみなので新設する。
- src/services/hrContentService.ts: 既存サービス責務を維持する。initialize/stop/getRandomContentに追加public APIは不要。JSON妥当性検査も本サービス内。
- src/services/__tests__/hrContentService.test.ts: 既存scheduledMessageService.test.tsと同じVitest配置。JSON mockで空/不正/境界とネットワーク非依存を検査。
- src/bot/events/interactionCreate.ts: 既存日英ヘルプの文面のみ変更。
- src/types/api.ts: HrApiResponseのみで全参照が消える場合は削除する。
- 駆動フロー: JSON→HrContentService（読み手）→messageCreate→Discord返信。新イベント/並行更新経路は導入しない。
- 置換比較: Google定期取得を維持してJSONをfallbackにするとスプシ依存が残るため要求に反する。定期取得削除はユーザー承認済み。

## 操作パリティ
- hr投稿→維持（同じmessageCreate/抽選API）。
- help-ja/help-en→維持（更新方法のみ訂正）。
- スプシ編集による自動反映→終了（ユーザー承認のJSON編集→デプロイへ変更）。
- 他Bot機能→無変更。

### Task 1: JSON移行とテスト
- [ ] Vitestでfetchをthrowするstub、タイマー監視を設定してinitialize→getRandomContent→stopを実行するテストを先に書き、現行のAPIエラー文言またはfetch呼び出しによりFAILを確認。
```ts
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
await hrContentService.initialize();
expect(fetchSpy).not.toHaveBeenCalled();
expect(contents).toContain(hrContentService.getRandomContent());
hrContentService.stop();
```
- [ ] CSVをPython csv.readerで解析し、そのままJSON配列としてsrc/data/hr-contents.jsonへ保存。
```python
import csv,json,pathlib
rows=list(csv.reader(open('/Users/sakastudio/hermes-agent/data/tmp/hr-json-migration/original.csv')))
assert len(rows)==96 and all(len(r)==1 and r[0].strip() for r in rows)
p=pathlib.Path('src/data/hr-contents.json');p.parent.mkdir(exist_ok=True)
p.write_text(json.dumps([r[0] for r in rows],ensure_ascii=False,indent=2)+'\n')
```
- [ ] サービスのfetch/タイマーを削除、importしたJSONを検査して既存contentsへ設定する。async initializeとstop呼び出し互換は維持。空配列・型不正・空白文字のみの項目はthrow Errorとしcatchで握り潰さない。抽選は従来のMath.floor(Math.random()*length)を維持。
- [ ] JSON mockで空/不正/空文字を拒否、Math.randomの0および1未満最大側で先頭末尾を返す、stop後の再initialize、fetch/setInterval非呼出しをテスト。
- [ ] 日英ヘルプからスプシURL/自動反映案内を除去し、リポジトリのsrc/data/hr-contents.json編集・デプロイを案内。未参照HrApiResponseを除去。
- [ ] `npm ci && npm test -- --run && npm run build && npx tsc --noEmit`を実行。実際のpackage scriptsを確認し相当するコマンドへ調整可能。
- [ ] srcへの暗黙参照を防ぐため別cwdからdist/services/hrContentService.jsをrequireしinitialize/抽選/stopを実行。fetchをthrowにしsetInterval呼び出し0、配列96件一致、dist/data/hr-contents.jsonの存在を検証。
- [ ] 実行結果を本planか検証レポートに保存してcommit。

### Task 2: 最終レビューと出荷
- [ ] 必ず最後にall-code-reviewスキル（Codexホストrunner手順）で全ブランチレビューを実行すること。自己レビューだけでは代替不可。全指摘を根拠確認し修正、修正後テスト/build/compiled smoke再実行。
- [ ] commit/pushしてPR作成し、ghでread-back。必要CIを通しmergeする。master pushは既存Lightsailデプロイworkflowを起動する。gh run watch等で完了を確認する。
- [ ] 既存デプロイ先をworkflow実行ログや既存ローカル運用設定から確認。鍵は標準名以外の場合があるため安全に発見する。新鍵作成/権限復旧はしない。
- [ ] SSHが利用できる場合、本番distのJSON配列96件・配布ファイルとcommitの整合、compiled serviceでのfetch不要抽選、systemd activeとヘルスチェック、デプロイ区間のログの警告/エラー有無を検証。二重Bot起動はしない。実Discord経路を安全な既存テストチャンネルで検証できるなら実行、できない場合は限界を明記して未検証事項をissue化する。
- [ ] 本番へアクセス不可なら推測で完了扱いにせず、workflowで確認できた内容と不足を明記してissue起票。最終報告にはPR URL、merge hash、deploy run URL、実行結果、未検証issue番号を記載する。

## Self-review
RequirementsはTask1（データ・サービス・ヘルプ・ローカル検証）/Task2（独立レビュー・本番）ですべて対応。必須データ不良の黙殺なし。外部仕様推測・共有UIキャッシュ・恒久的な操作失敗を新設しない。既存クラスと同責務の配置で構造違反なし。新規パターンは承認済みの静的JSONのみ。

## 判断記録（ADR）
- 出所: ユーザー裁定 2026-10-22 原文「なので、そもそもスプシにかくのやめてコードのjsonとかに配置するようになおしたい」。既存文言のJSON移行/外部取得削除/JSON編集→デプロイ方式を提案した返信への「Ok」。
- 出所: agent前提（既存コードの役割）。ランダム抽選の公開APIとメッセージ処理の互換維持、データだけを差し替える。
- 出所: agent前提（実測）。Google API URLはHTTP400/HTMLでJSONパース不可。元スプシの公開CSVは取得成功し96件であった。権限変更との直接因果は未検証。
- 出所: agent前提（軽量で可逆的な変更）。独立ADRは作らず本planに記録。Codex独立質問generate/filterの未回答0件を確認済み。
