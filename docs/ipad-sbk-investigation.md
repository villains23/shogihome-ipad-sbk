# iPad/.sbk 対応 調査報告

## 概要

このドキュメントは `.sbk` 定跡ファイルを iPad（Web/PWA）版で読み込む機能の実装を検討するにあたり、既存コードベースを調査した結果をまとめたものです。

---

## 1. 既存の `.sbk` 実装

### 1.1 実装ファイル一覧

| ファイル                                | 役割                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| `src/background/book/sbk.ts`            | 読み込み・書き出しのメイン実装                                  |
| `src/background/book/sbk_move.ts`       | 32bit ビットフィールドの指し手エンコード/デコード               |
| `src/background/book/packed_sfen.ts`    | Huffman 符号による 256bit Packed SFEN の変換                    |
| `src/background/book/proto/sbk.ts`      | `gen-proto.mjs` で自動生成した Protobuf 型定義                  |
| `src/background/book/proto/sbk.proto`   | BookConv から借用した proto ファイル（CC0）                     |
| `src/background/book/types.ts`          | `SbkBook`, `BookEntry`, `SbkEval` など内部型                    |
| `src/background/book/index.ts`          | セッション管理・ファイル I/O の統合エントリ                     |
| `src/common/book.ts`                    | `BookFormat`, `BookMove` など共有型（renderer/background 両用） |
| `src/tests/background/book/sbk.spec.ts` | ラウンドトリップ（in-memory・on-the-fly）テスト                 |

### 1.2 読み込みモード

#### In-memory モード（`loadSbkBook`）

```
loadSbkBook(path | Buffer | Uint8Array) → SbkBook
```

- `SBook.decode(data)` で全 State をメモリに展開。
- DFS で局面ツリーを探索し `Map<sfen, BookEntry>` を構築。
- ファイルサイズが閾値（デフォルト 16 MB: `sbkOnTheFlyThresholdMB`）以下のときに使用。

#### On-the-fly モード（`loadSbkBookOnTheFly`）

```
loadSbkBookOnTheFly(path) → SbkBook（rawData + SbkOnTheFlyLUT）
```

- ファイルを `Uint8Array` として保持し、protobuf を直接スキャン。
- `SbkOnTheFlyLUT`（Uint32Array テーブル）を構築して、Packed SFEN でバイナリサーチ。
- 局面検索時に `searchSbkBookEntryOnTheFly` で該当 State だけをデコード。

### 1.3 Node.js 依存のある箇所

`sbk.ts` が使う Node.js 固有 API:

| import        | 用途                                                          |
| ------------- | ------------------------------------------------------------- |
| `node:fs`     | `readFile`（ファイル読み込み）                                |
| `node:events` | `events.once(stream, 'drain'/'finish')`（バックプレッシャー） |
| `node:stream` | `Writable`（書き出しストリーム型）                            |

**パース（デコード）ロジック自体に Node.js 依存はない。**  
`sbk_move.ts`・`packed_sfen.ts`・`proto/sbk.ts` はいずれも Node.js API を使用していない。  
`@bufbuild/protobuf` は browser-compatible パッケージ。

---

## 2. Web/PWA（iPad）版の現状

### 2.1 IPC レイヤーの構成

```
src/renderer/ipc/bridge.ts   ← TypeScript インターフェース定義
src/renderer/ipc/preload.ts  ← Electron 実装（ipcRenderer 使用）
src/renderer/ipc/web.ts      ← Web/PWA スタブ（iPad がここを使用）
src/renderer/ipc/api.ts      ← 実行時セレクター
```

### 2.2 Web スタブの現状

`src/renderer/ipc/web.ts` の定跡関連メソッドは全て以下のいずれかを返す:

```typescript
throw new Error(t.thisFeatureNotAvailableOnWebApp); // ほぼ全操作
return "[]"; // searchBookMoves のみ空配列を返す
return "yane2016"; // getBookFormat のみ固定値を返す
```

**定跡機能は Web/PWA では現在使用不可。**

---

## 3. モジュール境界ルール（重要）

CLAUDE.md より:

- `renderer/` と `background/` は互いに import 不可
- `common/` のみ両方から import 可能
- 相対 import（`../`）は ESLint で禁止
- import は `@/` エイリアス（= `src/`）を使用

---

## 4. 実装方針の提案

### 4.1 基本方針：コアロジックを `common/` に移動

`.sbk` のデコードロジック（`Uint8Array` を受け取って `Map<sfen, BookEntry>` を返す部分）は Node.js 依存がないため、`src/common/` に移動できる。

```
src/common/book/sbk/
  decode.ts   ← loadSbkBookFromBytes(data: Uint8Array): SbkBook（Node.js 非依存）
  move.ts     ← sbk_move.ts のコピーまたは移動
  proto/      ← proto/sbk.ts の移動先（または background から参照継続）
```

`src/background/book/sbk.ts` はファイル I/O と書き出しのラッパーとして残し、`common/` の decode 関数を呼び出す形にする。

### 4.2 Web/iPad 側の読み込みフロー

1. ブラウザの File System Access API または `<input type="file">` で `.sbk` バイト列を取得
2. renderer 内で `Uint8Array` に変換
3. `common/book/sbk/decode.ts` の `loadSbkBookFromBytes` を呼び出してデコード
4. `Map<sfen, BookEntry>` を renderer のインメモリストアに保持
5. `searchBookMoves` はストアを参照するだけで IPC 不要

### 4.3 変更の影響範囲

| ファイル                          | 変更種別                                                               |
| --------------------------------- | ---------------------------------------------------------------------- |
| `src/background/book/sbk.ts`      | 変更（deocde 部分を common へ切り出し、ファイル I/O ラッパーのみ残す） |
| `src/background/book/sbk_move.ts` | 移動（`src/common/book/sbk/move.ts`）                                  |
| `src/common/book/sbk/decode.ts`   | 新規作成                                                               |
| `src/renderer/ipc/web.ts`         | 変更（openBook を File API ベースに実装）                              |
| `src/renderer/store/book.ts`      | 軽微な変更（web 向け分岐）                                             |

on-the-fly モードの `buildSbkOnTheFlyIndex`（`packed_sfen.ts` を使用するバイナリサーチ）も Node.js 非依存なので、必要であれば web 側でも使用可能。ただし、iPadでは大容量ファイルを扱うユースケースが少ないため、**当初はインメモリモードのみ対応**とするのが現実的。

### 4.4 書き出し（保存）について

Web/PWA では `saveBook` は引き続き「非対応」とするか、将来的に File System Access API の `showSaveFilePicker` で対応する。現フェーズでは **読み込み専用** を優先する。

---

## 5. まとめ

| 項目                         | 結論                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| 既存パーサーの再利用可否     | **可能**。`sbk.ts` のデコードロジックは Node.js 非依存                |
| 新規 `sbkParser.ts` の必要性 | **不要**。既存コードを `common/` に切り出すだけでよい                 |
| 対応すべき最小変更           | decode 関数を `src/common/` に移動 + web IPC にファイル読み込みを実装 |
| on-the-fly モードの web 対応 | 技術的には可能だが、初期実装ではインメモリのみで十分                  |
| 書き出し対応                 | 当面は不要（読み込み専用）                                            |
