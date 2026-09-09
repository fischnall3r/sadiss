import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import vitest from '@vitest/eslint-plugin'

const isProduction = process.env.NODE_ENV === 'production'

// defineConfigWithVueTs wires the Vue SFC parser to the TypeScript one, so that
// <script setup lang="ts"> blocks are type-aware.
export default defineConfigWithVueTs(
  {
    // tests/e2e is Vue CLI scaffolding that predates Cypress 10 and no longer
    // runs. Linting it would only report on code nobody executes.
    ignores: ['dist/**', 'android/**', 'ios/**', 'tests/e2e/**']
  },

  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-console': isProduction ? 'warn' : 'off',
      'no-debugger': isProduction ? 'warn' : 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  {
    // Vitest supplies describe/it/expect/vi as globals (test.globals in
    // vite.config.js), so the plugin declares them rather than a hand-written list.
    files: ['tests/unit/**/*.spec.ts'],
    plugins: { vitest },
    languageOptions: {
      globals: vitest.environments.env.globals
    },
    rules: vitest.configs.recommended.rules
  }
)
