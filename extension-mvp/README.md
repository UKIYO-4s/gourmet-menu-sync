# Chrome拡張 MVP

Hotpepperを最初の対象とした、入力補助に限定した Chrome 拡張のMVP。
**実装はまだ行わない**。本READMEは設計と作業範囲の宣言。

---

## 参照ドキュメント

- `docs/04_chrome-extension-design.md` — 拡張の全体設計
- `docs/05_mapping-json-design.md` — mapping JSON 仕様
- `docs/06_dom-diff-design.md` — DOM スナップショット / 差分
- `docs/07_sync-flow.md` — 同期フロー
- `docs/09_security-policy.md` — セキュリティポリシー
- `docs/10_development-roadmap.md` — フェーズ計画
- `experiments/phase1-dom-detection-plan.md` — Phase1 検証計画
- `experiments/phase1-dom-detection-checklist.md` — Phase1 検証チェックリスト
- `configs/mapping-samples/hotpepper-menu-edit.sample.json` — 初期 mapping
- `decisions/adr-003-no-auto-submit-in-mvp.md` — 自動保存禁止
- `decisions/adr-004-json-mapping-hot-update.md` — mapping JSON のホット更新方針

---

## 1. MVPの目的

- 1店舗・1サイト（Hotpepperメニュー編集画面）で **入力補助** が成立することを示す
- mapping JSON（API or ローカル直読み）からDOMフィールドを解決し、Common Menu Modelの値を入力欄に反映する
- 保存ボタン直前で停止し、人間が確認・保存する運用を成立させる
- DOM差分・match_score・identity check の安全機構が実機で機能することを確認する

---

## 2. MVPで作るもの

- Manifest V3 の最小構成
- popup または side panel: 組織 / 店舗の選択・対象サイト / mapping version の表示・入力結果サマリ
- content script:
  - scanner（DOM 構造の抽出。allowlist のみ）
  - matcher（mapping JSON との照合・match_score 算出）
  - executor（input / textarea / select に値を反映、change/input イベント発火）
  - identity-checker（店舗名・住所・電話・URL の4点照合）
  - reporter（field_hash / page_hash / match_score / 結果サマリのみ送信）
- background / service worker: API クライアント、mapping ローダ、状態管理
- core/sanitizer: 送信前に禁止情報を除去（allowlist 方式）
- core/logger: ローカル簡易ロガー（個人情報・value を含めない）
- 対象サイト: **Hotpepperのメニュー編集画面のみ**
- 対象フィールド: `name / price / category / description`（必要に応じて `status / sale_*`）

---

## 3. MVPで作らないもの

- 自動保存 / 自動公開（ADR-003）
- 食べログ・ぐるなび・Googleビジネスプロフィール対応（後フェーズ）
- 画像アップロード処理
- iframe / shadow DOM 横断対応
- ロールバックUI / 一括同期UI
- AIによるカテゴリ自動判断
- 認証情報の保存・自動ログイン
- ヘッドレスでの自動操作（Playwright は本番運用で使わない）
- 拡張内での DOM 全文ダンプ機能

---

## 4. Chrome拡張の最小構成

```txt
extension-mvp/
  manifest.json                # MV3, host_permissions は Hotpepper のみ
  src/
    popup/
      index.html
      popup.ts                 # 組織/店舗選択、状態表示
    sidepanel/                 # popup の代替案
      index.html
      sidepanel.ts
    background/
      service-worker.ts        # APIクライアント, mapping ロード, 状態
    content/
      index.ts                 # エントリ
      scanner.ts
      matcher.ts
      executor.ts
      identity-checker.ts
      reporter.ts
    core/
      api-client.ts
      mapping-loader.ts
      validation.ts
      sanitizer.ts
      logger.ts
      types.ts
```

manifest（要点）：

- `manifest_version: 3`
- `permissions`: `storage`, `activeTab`, `scripting`
- `host_permissions`: Hotpepper の管理画面ドメインのみ（all_urls にしない）
- `content_scripts.matches`: Hotpepper メニュー編集画面の URL パターンに限定

---

## 5. content script の責務

- 安全条件を **満たすときのみ** DOM操作を行う
- 観測（scanner）と適用（executor）を明確に分離する
- 入力対象は mapping JSON で定義されたフィールドのみ
- 保存・公開・削除に類するボタンには **一切触れない**
- フォーム送信を発火させない（Enter キー伝播も禁止）
- 反映後に軽い検証（後段の validation）を行い、結果を reporter へ
- ページ遷移検知時は状態をリセット
- 自身が判断停止した理由を必ず logger に残す

---

## 6. popup / side panel の責務

- ログイン（API トークンは `chrome.storage.session` に保持、長期保存しない）
- 組織 / 店舗の選択 UI
- **現在選択中の店舗名を大きく表示**（誤店舗誘発の対策）
- 現在開いているタブのサイト判定結果を表示
- 取得済み mapping JSON の `version` / `required_extension_version`
- 入力結果サマリ（成功フィールド / スキップ / 警告 / 中止理由）
- 「保存は手動で行ってください」の明示
- 設定: `auto_fill_enabled`（既定 true） / `auto_submit_enabled`（**UIから変更不可・常に false**）

---

## 7. mapping JSON 読み込み方針

- 一次：API から `site=hotpepper` `page=menu_edit` の `published` 最新版を取得
- 二次（フォールバック）：拡張に同梱した `configs/mapping-samples/hotpepper-menu-edit.sample.json`
- キャッシュは `chrome.storage.local` に短期で保持（version をキー）
- ロード時に validation を行う：
  - `required_extension_version` を満たすか
  - `submit.autoSubmit === false`
  - `safety.stopIfDomChanged === true`
  - `buttons.publish.autoClick === false` 等の danger ボタンが false
  - `required` フィールドが定義されているか
- 違反があれば mapping を **不採用** とし、入力を行わない
- ホット更新方針は ADR-004 に従う

---

## 8. DOMスキャン方針

`docs/06_dom-diff-design.md` / `experiments/phase1-dom-detection-plan.md` 5章を満たす。

取得：

```txt
tag, type, name, id, label, ariaLabel, placeholder, nearText,
selectorHint, fieldHash, required, maxLength, options(label only)
```

ページ単位：

```txt
url_pattern, page_title, form_count, detected_field_count,
button_candidates(text+role only), page_hash
```

取得しない：

- 入力済み value（password / text / textarea すべて）
- Cookie / Session / Token / Authorization
- hidden input の value
- 生DOM / outerHTML
- LocalStorage / IndexedDB
- 画像本体・画像URL

スキャンは observer を使わず、明示的なトリガで実行する。

---

## 9. field match 方針

- 解決順序：selector → name/id → label → aria-label → placeholder → nearby text → field type → DOM位置
- フィールド単位の `minMatchScore` を mapping JSON から取得
- ページ単位の `minPageMatchScore`（既定 0.75）
- 1位と2位のスコア差が **0.05 以下なら停止**（重要フィールドの曖昧解決を許さない）
- `required: true` のフィールドが解決できなければ **入力全体を中止**
- スコア未達の任意フィールドは個別にスキップしてよい

スコア重み付けの初期仮値は `experiments/phase1-dom-detection-plan.md` 9章。

---

## 10. store identity 照合方針

`docs/04_chrome-extension-design.md` 5.4 / Failure 1。

照合項目：

- 店舗名
- 住所
- 電話番号
- 管理画面URL
- 外部サイト内店舗ID（取得できれば）

要件：

- 不一致のときは **入力を一切行わない**
- 一致判定は閾値ベース（完全一致でなくても揺れを許容するが、重要項目は厳密）
- 一致 / 不一致は `audit_logs` 相当のイベントとして reporter に記録
- popup には現在の判定結果を明示

---

## 11. auto_fill の範囲

- スコープ：mapping JSON で定義された入力フィールドのみ
- 操作：`value` セット → `input` / `change` イベント発火 → 軽い反映検証
- フォーカス移動は最小限（visual confusion を避ける）
- 反映後、画面に **「未保存」を視認できる差分プレビュー** を出す
- ユーザーが popup から「適用解除」できる（DOM の元状態には戻さないが、適用済みフィールドの一覧は提示）

---

## 12. auto_submit 禁止（ADR-003）

- mapping JSON の `submit.autoSubmit` は **常に false**
- popup の `auto_submit_enabled` は **UIから変更不可** / 常に false
- save / publish / delete / submit に類するボタンに対する `click()` を **コードレベルで禁止**（ハードコード）
- フォーム要素の `submit()` 呼び出しを禁止
- Enter キーによる暗黙の送信が起きないよう、対象フォームでの keydown を必要に応じて抑制

---

## 13. prohibited_actions

`docs/09_security-policy.md` 準拠。

- 保存・公開・削除ボタンの自動クリック
- フォームの自動送信
- ログイン情報の保存
- Cookie / Session / Token の取得・保存・送信
- 生 DOM / outerHTML のダンプ
- input value の保存
- hidden value の保存
- LocalStorage / IndexedDB のエクスポート
- CAPTCHA 回避
- ユーザーから見えない状態での自動操作
- 短時間の連続アクセスによる Bot 判定誘発
- mapping JSON 検証をスキップした入力実行

---

## 14. ログ出力方針

- 開発用 console ログは値を含めない（field 名・hash・score のみ）
- reporter で API へ送るのは **構造情報・ハッシュ・スコア・判定理由** のみ
- `sync_job_logs` 相当のイベント：mapping ロード / scan / match / executor 適用判定 / critical|warning diff / 中止理由 / 完了
- `audit_logs` 相当のイベント：ログイン / 店舗選択 / identity 判定 / 設定変更 / critical diff 検知
- すべてのログに `extension_version` / `mapping_version` / `required_extension_version` を含める
- ログ送信前に sanitizer を必ず通す（allowlist 方式）

---

## 15. 検証時の操作手順

`experiments/phase1-dom-detection-checklist.md` を上から実行することを前提とした、拡張側の手順。

1. 検証用プロファイルで Hotpepper 管理画面にログイン
2. 拡張 popup を開き、組織 / 店舗を選択
3. popup に表示された対象店舗名・mapping version を目視確認
4. 検証用メニュー1件を Common Menu Model 形式で投入（API 経由 or ローカル fixture）
5. メニュー編集画面を開き、popup の「スキャン」を実行
6. scanner / matcher の結果を popup と DevTools で確認
7. critical diff が無いこと、match_score が閾値超えであることを確認
8. 「適用」を実行し、入力欄に値が反映されることを確認
9. **保存ボタンは押さない**。差分プレビューを目視確認
10. popup 経由で「適用解除」相当の表示を確認
11. ページを離脱して reporter のログ送信内容を確認（禁止情報が無いこと）
12. critical diff 再現（DevTools で DOM 改変）→ 入力中止判定が成立することを確認
13. identity 不一致を再現 → 入力中止判定が成立することを確認

---

## 16. 成功条件

- Hotpepperメニュー編集画面で `name / price / category / description` の入力欄が解決される
- mapping JSON のバリデーションをパスする
- フィールド単位 / ページ単位の match_score が閾値を超える
- store identity 一致時のみ入力に進む
- 入力後、保存ボタンが押されないまま停止する
- field_hash / page_hash / match_score / 判定理由が reporter で送信される
- 送信内容に禁止情報が含まれない
- critical diff 再現で停止判定、warning diff でアラート継続が成立
- ログ・スクリーンショットに認証情報・value・生DOMが含まれない
- `experiments/phase1-dom-detection-checklist.md` の全項目が GO 判定

---

## 17. 失敗条件

- 主要4フィールドのいずれかが安定して解決できない
- field_hash が同一画面再取得で揺れる
- page_hash が無関係な変化で大きく変動する
- 禁止情報の混入を防げない / sanitizer が漏らす
- identity 不一致時に入力が走る
- 保存ボタンが押される / フォーム送信が発火する
- mapping JSON のバリデーションが機能しない
- critical diff を検知しても入力が続行される
- 規約抵触のリスクが顕在化する

→ 1つでも該当：MVP 実装を中断し、設計（docs / ADR）に差し戻す。

---

## 18. 次フェーズへの移行条件

すべて満たして初めて Phase 5（API MVP）/ Phase 6（Admin Web MVP）に進む。

- 16章の成功条件を満たしている
- 1店舗1サイトで input 反映 → 人間が保存 → `sync_job_logs` 反映 まで E2E が成立
- mapping JSON のホット更新（ADR-004）が想定通り動く
- DOM 差分による停止 / 警告が `dom_diffs` に記録される設計が成立
- セキュリティポリシー（`docs/09_security-policy.md`）違反のログが0件
- ADR-003 の方針（自動保存禁止）が拡張の各層で多重に強制されている

---

## TODO

- [ ] Hotpepper 実画面で検証後、本READMEの 5〜10 章の細部を校正
- [ ] mapping JSON の validation 規約を `docs/05_mapping-json-design.md` 8章と一致させる
- [ ] popup と side panel の最終選択（UX 検討）
- [ ] sanitizer の allowlist を仕様化（`docs/09_security-policy.md` と整合）
- [x] `decisions/adr-004-json-mapping-hot-update.md` を起票
