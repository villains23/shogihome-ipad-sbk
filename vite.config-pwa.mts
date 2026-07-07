/// <reference types="vitest" />
import { defineConfig } from "vite";
import base from "./vite.config.mjs";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  ...base,
  plugins: [
    ...(base.plugins || []),
    VitePWA({
      // autoUpdate: 新しいSWが検出されたら自動でインストール（キャッシュ更新を自動化）
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "ShogiHome",
        short_name: "ShogiHome",
        description: "将棋の対局や棋譜の編集ができるアプリ",
        background_color: "#2f4f4f",
        theme_color: "#5f8f5f",
        display: "standalone",
        lang: "ja",
        // "./?mobile" はマニフェストURLからの相対パス。
        // Vercel (https://app.vercel.app/) でも GitHub Pages でも
        // ホーム画面からの起動時に必ずモバイルレイアウトで開く。
        start_url: "./?mobile",
        scope: "./",
        icons: [
          { sizes: "512x512", src: "favicon.png", type: "image/png" },
          { sizes: "512x512", src: "favicon.png", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // SW が管理するキャッシュ対象ファイル
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest,wasm}"],
        // 最大キャッシュファイルサイズ (デフォルト 2MB を将棋素材用に拡大)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
});
