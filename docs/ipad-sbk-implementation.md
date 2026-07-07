# iPad / Web 版 .sbk 定跡対応 実装まとめ

ブランチ: `feature/ipad-sbk-file-api`  
コミット: `0e610477`

---

## 1. 実装の背景

Electron 版 ShogiHome はネイティブの定跡パネルで `.sbk` ファイルを読み込み・表示できる。  
iPad / Web 版（`?mobile` 付き URL）ではこの機能が存在せず、以下の問題があった。

- 定跡ファイルを開く導線がない（Menu 内に項目なし）
- 代わりに「開く（棋譜）」から `.sbk` を選ぶと「処理中です。お待ちください。」が解除されずに固まる
- 読み込めたとしても候補手を表示する UI がない

---

## 2. 変更ファイル一覧

### 共通層 (`src/common/`)

| ファイル                           | 変更種別               | 内容                                                    |
| ---------------------------------- | ---------------------- | ------------------------------------------------------- |
| `src/common/book/sbk_decode.ts`    | 新規作成               | Node.js 非依存の `.sbk` デコード関数（`decodeSbkBook`） |
| `src/common/book/sbk_move.ts`      | `background/` から移動 | 32bit ビットフィールドの指し手エンコード/デコード       |
| `src/common/book/proto/sbk.ts`     | `background/` から移動 | Protobuf 型定義（自動生成）                             |
| `src/common/book/proto/sbk.proto`  | `background/` から移動 | proto ファイル（CC0）                                   |
| `src/common/book/proto/README.md`  | `background/` から移動 | proto 説明                                              |
| `src/common/i18n/text_template.ts` | 修正                   | 新規 i18n キー 4 件追加                                 |
| `src/common/i18n/locales/ja.ts`    | 修正                   | 日本語文字列追加                                        |
| `src/common/i18n/locales/en.ts`    | 修正                   | 英語文字列追加                                          |
| `src/common/i18n/locales/zh_tw.ts` | 修正                   | 日本語プレースホルダー + `// TODO: Translate`           |
| `src/common/i18n/locales/vi.ts`    | 修正                   | 日本語プレースホルダー + `// TODO: Translate`           |

### バックグラウンド層 (`src/background/`)

| ファイル                     | 変更種別 | 内容                                                                        |
| ---------------------------- | -------- | --------------------------------------------------------------------------- |
| `src/background/book/sbk.ts` | 修正     | デコードコアを `common/` に切り出し。ファイル I/O・書き出しラッパーのみ残存 |

### レンダラー層 (`src/renderer/`)

| ファイル                                    | 変更種別 | 内容                                                                                                                                               |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/ipc/web.ts`                   | 修正     | `showOpenBookDialog` / `showOpenRecordDialog` に iOS Safari キャンセル検出を追加。`openBook` で `decodeSbkBook` を呼び出してインメモリストアに保存 |
| `src/renderer/store/book.ts`                | 修正     | `_isLoaded` フラグ追加。`openBookFile()` を try/catch/finally に変更しファイル選択後に `retain()` を移動                                           |
| `src/renderer/store/index.ts`               | 修正     | `openRecord()` 内で `.sbk` 拡張子を検出しエラーメッセージ表示（固まり防止）                                                                        |
| `src/renderer/view/main/MobileBookView.vue` | 新規作成 | モバイル向け定跡候補手表示コンポーネント                                                                                                           |
| `src/renderer/view/main/MobileLayout.vue`   | 修正     | `BottomUIType.BOOK` / `SideUIType.BOOK` を追加し「定跡」タブを両レイアウトに追加                                                                   |
| `src/renderer/view/menu/FileMenu.vue`       | 修正     | Web 版（`!isNative()`）に「定跡ファイルを開く」ボタンを追加                                                                                        |

### ドキュメント・スクリプト

| ファイル                          | 変更種別               | 内容                                               |
| --------------------------------- | ---------------------- | -------------------------------------------------- |
| `docs/ipad-sbk-investigation.md`  | 既存（調査メモ）       | 調査フェーズのまとめ                               |
| `docs/ipad-sbk-implementation.md` | 新規作成（本ファイル） | 実装完了後の最終まとめ                             |
| `scripts/gen-proto.mjs`           | 修正                   | proto 出力先を `background/` から `common/` に変更 |
| `scripts/sbk-dump.ts`             | 修正                   | import パスを `common/` に更新                     |

---

## 3. 追加された i18n キー

| キー                         | 日本語                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `openBookFile`               | 「定跡ファイルを開く」                                                            |
| `sbkFileIsBookNotRecord`     | 「.sbk は定跡ファイルです。メニューの「定跡ファイルを開く」から開いてください。」 |
| `noBookFileLoaded`           | 「定跡ファイルが読み込まれていません」                                            |
| `noBookMovesForThisPosition` | 「この局面に定跡候補はありません」                                                |

`zh_tw.ts` / `vi.ts` は `// TODO: Translate` を付けた日本語プレースホルダー。人間の翻訳者が対応するまでそのままにする。

---

## 4. iPad / Web 版で .sbk を開く手順

### 4.1 前提

- Safari（または対応ブラウザ）で ShogiHome の URL に `?mobile` パラメータを付けて開く  
  例: `https://example.com/index.html?mobile`

### 4.2 定跡ファイルを開く

1. 画面右下の **「Menu」** ボタンをタップ
2. メニュー内の **「定跡ファイルを開く」** をタップ
3. iOS のファイル選択画面が開く → `.sbk` ファイルを選択
4. 読み込み中に「処理中です。お待ちください。」が表示される
5. 完了後、自動的にメッセージが消える

### 4.3 定跡候補を表示する

- **縦持ち（Portrait）:** 盤面下部のタブセレクターに **「定跡」** タブが追加されている。タップすると現在局面の候補手一覧が表示される。
- **横持ち（Landscape）:** 盤面右側のタブセレクターに **「定跡」** タブが表示される。

### 4.4 候補手を指す

候補手の行をタップすると、その手が盤上に指される。  
対局中の場合は `humanPlayer.doMove()` 経由で指し手が送られる。

### 4.5 手を進めたときの動作

局面が変わるたびに `BookStore.onChangePosition()` が呼ばれ、`bookStore.moves` が自動更新される。  
「定跡」タブは Vue のリアクティブシステム経由でリアルタイムに再描画される。

---

## 5. Electron 版との違い

| 機能               | Electron 版                                            | iPad / Web 版                           |
| ------------------ | ------------------------------------------------------ | --------------------------------------- |
| 定跡ファイルを開く | ネイティブダイアログ経由（`showOpenBookDialog` → IPC） | `<input type="file">` の File API 経由  |
| 対応フォーマット   | `.sbk` / `.db`（yane2016）/ `.bin`（Apery）/ `.ybb`    | **`.sbk` のみ**（インメモリモードのみ） |
| On-the-fly モード  | 閾値超過時に自動切替                                   | 非対応（常にインメモリ）                |
| 定跡の保存         | 可能                                                   | **不可**（読み込み専用）                |
| 定跡手の編集・追加 | BookPanel の UI から操作可能                           | **不可**                                |
| 定跡手の並び替え   | 可能                                                   | **不可**                                |
| 候補手 UI          | 編集・削除・並び替えボタン付きの全機能テーブル         | 読み取り専用のシンプルリスト            |
| 定跡インポート     | 複数ファイル一括インポート機能あり                     | **不可**                                |

---

## 6. データフロー（Web 版）

```
ユーザーが .sbk を選択
        │
        ▼
showOpenBookDialog() [web.ts]
  └─ File API: file.arrayBuffer() → ArrayBuffer
  └─ fileCache に URI → ArrayBuffer で保存
        │
        ▼
openBook(session, uri) [web.ts]
  └─ fileCache から ArrayBuffer を取得
  └─ decodeSbkBook(new Uint8Array(buffer)) [common/book/sbk_decode.ts]
  └─ entries: Map<sfen, BookMove[]> を webBookStore に保存
        │
        ▼
bookStore._isLoaded = true
bookStore.reloadBookMoves()
  └─ searchBookMoves(session, sfen) [web.ts]
       └─ webBookStore.get(session)?.get(sfen) → BookMove[]
        │
        ▼
MobileBookView.vue がリアクティブに更新
```

---

## 7. 既知の制限

### 7.1 対応フォーマット

Web 版は `.sbk`（ShogiGUI 形式）のみ対応。  
やねうら王形式（`.db`）・Apery 形式（`.bin`）・YBB 形式（`.ybb`）は Web では未対応。  
これらは Electron 版固有のファイル I/O 処理に依存しているため、対応するには `common/` への追加移植が必要。

### 7.2 ファイルサイズ

Web 版は常にインメモリモードで読み込む。大容量の `.sbk` ファイル（数十 MB 以上）の場合、iPad のメモリ上限に達する可能性がある。

### 7.3 定跡の永続化

ページをリロードすると読み込んだ定跡データは消える。`localStorage` / `IndexedDB` への保存は未実装。

### 7.4 iOS Safari の `oncancel` 非発火

iOS Safari ではファイルピッカーをキャンセルしたときに `<input type="file">` の `oncancel` イベントが発火しないことがある。  
本実装では `window` の `focus` イベントを使ってキャンセルを検出する回避策を実装済み（`web.ts` の `settle` パターン）。ただし、500ms のタイムアウトを挟むため、即時キャンセル検出ではない。

### 7.5 候補手 UI の制限

`MobileBookView.vue` は読み取り専用の最小実装。  
以下は表示されない:

- score（評価値）
- depth（探索深さ）
- comment（コメント）
- 出現割合（%）

---

## 8. 盤面矢印オーバーレイ（定跡候補手）

コミット: `（次のコミット）`

### 8.1 実装概要

iPad/Web 版で「定跡」タブに表示されている候補手を、将棋盤上に矢印で視覚的に表示する機能を追加した。

### 8.2 変更ファイル

| ファイル                                    | 変更種別 | 内容                                                                                                                 |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/view/primitive/BoardView.vue` | 修正     | `CandidateMove` 型に `opacity?` / `weight?` を追加。`arrows` computed で高さと不透明度を適用                         |
| `src/renderer/store/book.ts`                | 修正     | `_bookArrowsVisible` / `_selectedBookMoveUsi` フィールド追加。`toggleBookArrows()` / `selectBookMove()` メソッド追加 |
| `src/renderer/view/main/BoardPane.vue`      | 修正     | `useBookStore` をインポート。`allCandidates` computed でエンジン候補手と定跡矢印をマージ                             |
| `src/renderer/view/main/MobileBookView.vue` | 修正     | 矢印 ON/OFF トグルボタン追加。行タップで選択（矢印ハイライト）、「指す」ボタンで着手                                 |
| `src/common/i18n/text_template.ts`          | 修正     | `showBookArrows` / `playBookMove` キー追加                                                                           |
| `src/common/i18n/locales/ja.ts`             | 修正     | 「矢印表示」「指す」追加                                                                                             |
| `src/common/i18n/locales/en.ts`             | 修正     | "Show Arrows" / "Play" 追加                                                                                          |
| `src/common/i18n/locales/zh_tw.ts`          | 修正     | 日本語プレースホルダー + `// TODO: Translate`                                                                        |
| `src/common/i18n/locales/vi.ts`             | 修正     | 日本語プレースホルダー + `// TODO: Translate`                                                                        |

### 8.3 UX フロー（案B実装）

**デフォルト（未選択）:**  
定跡が読み込まれ矢印がオンの場合、上位 3 手を薄い矢印で表示する。

| 順位 | 太さ倍率 | 不透明度 |
| ---- | -------- | -------- |
| 1位  | 1.0      | 0.70     |
| 2位  | 0.80     | 0.50     |
| 3位  | 0.65     | 0.35     |

**行タップ（選択）:**  
リストの行をタップすると選択状態になり、その1手のみが強調矢印（不透明度 0.85・太さ 1.1）で表示される。  
同じ行を再度タップするとデフォルト（上位3手薄表示）に戻る。

**「矢印表示」ボタン:**  
リスト上部のトグルボタンで矢印の表示/非表示を切り替える。非表示にすると選択状態もリセットされる。

**「指す」ボタン:**  
各行右端の「指す」ボタンをタップするとその手が盤上に指される（対局中は `humanPlayer.doMove()` 経由）。

**局面変化時:**  
`BookStore.onChangePosition()` が呼ばれると選択状態は自動リセットされ、新しい局面の候補手が矢印に反映される。

### 8.4 設計決定

- **`CandidateMove` 型の拡張**: `BoardView.vue` のローカル型に `opacity?` と `weight?` を追加し、既存の `score?` と同様にオプショナルにした。`store/index.ts` 側の型は変更不要（エンジン候補手には opacity/weight が不要）。
- **`BoardPane.vue` でマージ**: エンジン候補手（`store.candidates`）と定跡矢印を `allCandidates` computed でマージする設計にした。`isMobileWebApp()` チェックで Electron 版では定跡矢印が追加されないため、Electron の BookPanel との競合を回避できる。
- **矢印の高さスケーリング**: `arrowWidth * weight` で高さをスケールし、`y` 位置も中心に合わせて調整することで、太さが変わっても矢印が中央揃えになる。

### 8.5 Electron/PC 版への影響

- `BoardView.vue` の型拡張はオプショナルフィールドのみのため、既存コードへの影響ゼロ。
- `BoardPane.vue` の `allCandidates` は `isMobileWebApp()` が false（= Electron）のとき従来通り `store.candidates` をそのまま返す。
- `BookStore` に追加したメソッドは Electron 版の BookPanel からは呼ばれないが、存在しても問題ない（Electron のデスクトップ UI は引き続き BookPanel を使用）。

---

## 9. 今後の改善案

### 9.1 候補手 UI の拡充

`MobileBookView.vue` に score・depth・comment 列を追加する。  
横持ちなど画面幅に余裕がある場合はより多くの情報を表示する。

### 9.2 定跡の永続化

`IndexedDB`（例: idb-keyval）を使い、読み込んだ `.sbk` をブラウザに保存する。  
ページリロード後も再選択不要になる。

### 9.3 他フォーマットの Web 対応

やねうら王形式（`.db`）のデコードロジックを `common/` に切り出せば Web 版でも読み込める。  
`.sbk` と同様のアプローチで対応可能。

### 9.4 On-the-fly モードの検討

大容量ファイル向けに Web 版でも on-the-fly モードを実装する。  
デコード処理を `Worker` スレッドに移し、メインスレッドのブロックを回避する構成が現実的。

### 9.5 翻訳の完了

`zh_tw.ts` / `vi.ts` の `// TODO: Translate` エントリ（`showBookArrows` / `playBookMove` を含む）を各言語の担当翻訳者に対応依頼する。
