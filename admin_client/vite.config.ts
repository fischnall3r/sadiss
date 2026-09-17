/// <reference types="vitest" />
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import svgLoader from "vite-svg-loader"

// https://vitejs.dev/config/
export default defineConfig({
  base: "/admin",
  plugins: [
    vue(),
    svgLoader({
      svgo: false,
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
})
