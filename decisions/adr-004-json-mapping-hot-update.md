# ADR-004: Mapping JSON によるホット更新

- Status: Accepted
- Date: 2026-04-30
- 関連 ADR: ADR-002（Chrome拡張一次化）, ADR-003（自動保存禁止）

---

## Context

- Chrome拡張本体のJavaScript更新は Chrome Web Store 審査が必要で、配信に時間がかかる
- 外部グルメサイトの管理画面DOMは予告なく変更される可能性が高い（selector / label / placeholder / 近接テキスト / ボタン文言 等）
- DOM変更すべてに拡張本体更新で対応すると、運用負荷と障害復旧の遅延が許容できない水準になる
- 一方、Mapping JSON が任意 JavaScript 実行の経路になると、拡張機能の信頼性とセキュリティが破綻する

---

## Decision

### 1. 役割分離

- **Mapping JSON で管理する（即時更新可）**:
  入力欄の検出ルール、selector hints、labels、placeholders、nearby_text、safety threshold 等の **宣言的な設定値**。
- **Chrome拡張本体に固定する（審査経由のみ）**:
  汎用 DOM スキャン、match_score 計算、安全停止、入力補助の実装。
  サイト固有のロジックを拡張本体に持ち込まない。

### 2. Mapping JSON の取得経路

- API もしくは静的配布エンドポイントから取得する
- 拡張に同梱したサンプル（`configs/mapping-samples/`）はフォールバック用途
- 取得時にスキーマバリデーションを通すこと

### 3. メタデータ

各 Mapping JSON は以下を必ず持つ：

```txt
mapping_version
required_extension_version
status            -- draft / published / deprecated / rollback
```

- 拡張は `required_extension_version` を満たさない場合 **実行停止**
- 拡張は `status: published` のみを採用する
- `mapping_version` / `extension_version` は `sync_jobs` / `audit_logs` に必ず記録

### 4. 任意コード実行の禁止

Mapping JSON は **宣言的な設定値のみ** を許す。

- JavaScript コード文字列の許可禁止
- `eval` / `Function` / 動的スクリプト生成の禁止
- 正規表現も拡張側でサポート対象を限定（catastrophic backtracking 対策）
- DOM操作の手順（イベント発火順序など）は拡張本体に固定する

### 5. 自動保存ポリシーは本ADRで扱わない

- `auto_submit_enabled = false` は ADR-003 により維持
- Mapping JSON から `submit.autoSubmit: true` を許容しない（拡張本体側で強制 false 上書き）

---

## JSONで即時更新できるもの

```txt
labels
placeholders
selector_hints
nearby_text
min_match_score
target_url_patterns
store_identity rules
safety thresholds
prohibited_actions
```

その他、`docs/05_mapping-json-design.md` に記載のフィールド構造（`fields`, `buttons`, `safety`）の **値**。

---

## 拡張本体更新が必要なもの

```txt
DOMスキャンアルゴリズムそのもの
match_score 計算ロジック
新しい入力タイプへの対応（例: shadow DOM, iframe 横断, カスタムウィジェット）
Chrome API 権限変更（manifest permissions / host_permissions）
UI 構造変更
セキュリティ処理の変更（sanitizer / allowlist / 認証取扱）
```

---

## Consequences

### Pros

- 外部サイトのDOM変更に対して **時間単位** で対応可能になる
- 拡張本体の更新頻度を下げられ、Chrome Web Store 審査ボトルネックを回避できる
- サイト固有の知識を JSON に集約でき、コードベースの肥大化を防げる
- mapping_version / required_extension_version により、配布と互換性管理を一元化できる
- Phase 1.5（Hotpepper 実画面検証）の校正結果を運用へ素早く反映できる

### Cons

- Mapping JSON のスキーマ管理・バージョン管理・配信基盤が必要になる
- 「拡張本体は古い / Mapping JSON は新しい」状態が常態化し、互換性チェックが必須
- Mapping JSON の品質低下が現場の誤入力に直結する
- ロールバック対象が二重化（拡張本体 / Mapping JSON）し、運用が複雑化

### Risks

1. 不正・破損した Mapping JSON が配信され、誤った入力欄に値が入る
2. Mapping JSON が改ざん経路になり、悪意ある selector が混入する
3. JSON に JavaScript 文字列を混ぜようとする圧力が生まれる
4. `required_extension_version` の運用ミスで古い拡張が新 JSON を読む
5. Mapping JSON 配信遅延 / キャッシュ不整合
6. サイトごとの細部差を「JSONで吸収する」名目で拡張本体ロジックの境界が曖昧化する

### Mitigations

1. 拡張側で Mapping JSON を **必ず** スキーマバリデーション（fields / buttons / safety / version の存在と型）
2. `required_extension_version` 未満なら実行停止
3. `submit.autoSubmit` / `buttons.*.autoClick` などの危険値は拡張側で **強制 false 上書き**（ADR-003）
4. JSON にコード文字列を含めない契約をスキーマで拒否
5. 取得経路は HTTPS のみ。可能ならハッシュまたは署名で完全性を検証
6. キャッシュは `mapping_version` をキーとし、TTL を明示
7. Mapping JSON のレビュー / 承認フローと監査ログ（誰が published に昇格させたか）
8. 定期的に拡張本体と Mapping JSON の互換性マトリクスを更新
9. 役割分離の境界（本ADR）を逸脱する変更は ADR の更新を必須とする

---

## Related Files

- `docs/04_chrome-extension-design.md`
- `docs/05_mapping-json-design.md`
- `docs/06_dom-diff-design.md`
- `docs/09_security-policy.md`
- `configs/mapping-samples/hotpepper-menu-edit.sample.json`
- `extension-mvp/README.md`

---

## Notes

- 自動保存・自動公開の解禁は本ADRの対象外。`auto_submit_enabled = false` は ADR-003 により維持する
- Mapping JSON から任意コードを実行できる設計にしない（宣言的設定のみ）
- 本方針を逸脱する必要が生じた場合、本 ADR を Superseded として更新する
