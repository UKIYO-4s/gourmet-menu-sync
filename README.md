# Menu Sync System

飲食店のメニュー情報を一元管理し、食べログ・ホットペッパー・ぐるなび・自社サイトなどへ反映するためのメニュー同期支援システム。

## 目的

- 店舗ごとのメニュー正本を管理する
- メニュー更新履歴を残す
- Chrome拡張で外部サイト管理画面への入力を補助する
- DOM変更を検知する
- 店舗別カテゴリ・マッピングを学習する
- 初期は自動保存せず、人間確認を必須にする

## 設計思想

- source
- version
- route
- mapping
- log

## MVP方針

初期MVPでは、外部サイトへの自動保存は行わない。
Chrome拡張は入力補助までとし、保存・公開は人間が行う。

## 主要ドキュメント

- docs/00_master-spec.md
- docs/02_mvp-scope.md
- docs/03_database-design.md
- docs/04_chrome-extension-design.md
- docs/08_failure-and-countermeasures.md