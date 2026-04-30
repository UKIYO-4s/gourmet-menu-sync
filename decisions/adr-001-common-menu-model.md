# ADR-001: Common Menu Model を中継形式とする

- Status: Accepted
- Date: 2026-04-30
- 関連: `docs/00_master-spec.md` 第3.2章 / 第5.4章, `docs/01_system-overview.md`

---

## Context

メニュー情報の入出力元として、自社DB・CSV・自社サイト・食べログ・ホットペッパー・ぐるなび・Googleビジネスプロフィール等が存在する。
店舗ごとに「正本」がどこにあるかが異なる。

外部サイト同士を直接マッピングすると、サイト追加のたびに変換組み合わせが N×(N-1) で爆発する。

## Decision

すべてのデータは一度 **Common Menu Model** に変換してから他のサイトへ出力する。

```txt
外部サイト / CSV / 自社DB
        ↓
   Common Menu Model
        ↓
外部サイト / CSV / 自社DB
```

- 入力は `Source Adapter`（例: `tabelog_source_adapter`）
- 出力は `Target Adapter`（例: `hotpepper_target_adapter`）
- 共通化できない特殊フィールドは `raw_source_json` に保持

最低限の共通項目：

```txt
name, description, price, tax_type, category, status,
image_url, sale_start_date, sale_end_date, sort_order, raw_source_json
```

## Consequences

### Positive

- 新規サイト対応コストが O(N) で済む
- 価格・税区分・カテゴリの正規化ポイントが1箇所に集約される
- 履歴管理（`menu_item_versions`）が共通形式で行える

### Negative

- 共通化しきれない属性は `raw_source_json` に逃がす必要がある
- Adapter の保守コストが発生

## Alternatives Considered

- 外部サイト同士の直接マッピング → 組み合わせ爆発のため却下
