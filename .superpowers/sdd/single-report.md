# Task 1 実装検証

## TDD RED
`npm test -- src/services/__tests__/hrContentService.test.ts` を既存実装で実行。
1 test failed: `expect(fetchSpy).not.toHaveBeenCalled()` に対し `Number of calls: 1`。
外部fetchが禁止された条件で現行実装が通信したため、狙い通りの失敗。
生ログには既存公開API URLが含まれるため版管理せず、関連する失敗のみ記録した。

## 実装
- CSV全96件を文字列・順序・重複を保持したままsrc/data/hr-contents.jsonへ保存。
- HrContentServiceは静的JSON importへ移行。fetch・周期タイマー・APIエラー文字列を除去。
- initialize/getRandomContent/stopの呼び出し互換と既存抽選式を維持。
- 空配列・配列以外・非文字列・空文字・空白だけの文字列はinitializeで明示throw。既存mainの起動失敗経路へ伝播する。
- help-ja/help-enはJSON編集とデプロイ後反映に訂正。未参照HrApiResponseを削除。
- scripts/verify-hr-contents.cjsはdistのサービスとJSONだけを隔離ディレクトリへコピーし、別cwdから初期化・抽選・stopを検証する。

## GREENと最終検証
実行時PATHは `/opt/homebrew/opt/node@22/bin:$PATH`、Node v22.23.2。
- `npm ci`: 成功（初回Node26で実施後、以下の最終検証はNode22）。
- `npm test`: 3 files / 31 tests passed。
- `npm run build`: 成功。
- `npx tsc --noEmit`: 成功。
- `node scripts/verify-hr-contents.cjs`: 96 entries equal, isolated cwd, fetch=0, timers=0。
- Python csv.readerで元CSVとsrc/dist JSONを直接比較: 配列完全一致96件。
- JSONを一時退避し `npx tsc --noEmit`: TS2307による失敗を確認、finallyで必ず復元。
- hr単体9件: 通信・タイマー非依存、不正データ6種拒否、空白/改行を含む原文保持、抽選両端、stop後再initialize。
- `git diff --check`: 成功。変更・追加コードは全ファイル200行未満。

## 全体テストで判明した既存不一致と対応
初回全テストは30 passed / 1 failed。scheduledMessageServiceの実装がsendへcontent/allowedMentionsオブジェクトを渡す一方、既存テストは旧文字列引数を期待していた。controller承認のもと、期待を現行実装へ合わせ、262行の既存テストを単体167行・統合99行へ分割した。実サービスは変更していない。
build後の再テストではdist配下のCommonJSテストもVitest4が収集して失敗した。package.jsonのtestを`vitest run src`にし、全ソーステストを対象として生成物の再収集を防いだ。

## 変更ファイル
- src/data/hr-contents.json
- src/services/hrContentService.ts
- src/services/__tests__/hrContentService.test.ts
- src/services/__tests__/scheduledMessageService.test.ts
- src/services/__tests__/scheduledMessageIntegration.test.ts
- src/bot/events/interactionCreate.ts
- src/types/api.ts（削除）
- package.json
- scripts/verify-hr-contents.cjs
- docs/superpowers/plans/2026-10-22-hr-local-json.md（チェックボックスは変更なし）
- .superpowers/sdd/single-report.md

## 自己レビューと懸念
messageCreate・Bot起動順・他サービス実装は変更なし。JSONは静的importのためtscがdistへ同梱し、相対importで実行cwdに依存しない。必須データの不正はフォールバックで隠さず起動失敗となる。独立レビュー・push・PR・merge・deploy・本番検証はTask2でcontrollerが行う。
npm ciの既存依存auditは19件（moderate 6 / high 11 / critical 2）。今回依存は変更しておらず、スコープ外としてcontrollerへ報告済み。

Task 1: done 57afc0f — 96件の静的JSON移行、Node22で31テスト・build・型・compiled smoke・元CSV完全一致の検証完了。
