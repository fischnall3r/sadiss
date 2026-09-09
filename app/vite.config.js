// defineConfig comes from vitest/config rather than vite so the test block below
// is typed. It is a superset of vite's and does not affect the production build.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'fs'

// Single source of truth for the app version: package.json. Exposed as
// VITE_APP_VERSION so the UI (`v{{ appVersionNumber }}`) always reflects it.
// It used to be set only in the gitignored .env, so emptying that file
// silently blanked the version — deriving it here prevents that recurring.
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Tests share this config so they resolve '@' and see VITE_APP_VERSION exactly
  // as the app does, rather than restating either in a second config file.
  test: {
    globals: true,
    include: ['tests/unit/**/*.spec.ts']
  }
})
