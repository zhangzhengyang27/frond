import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig(
  // references/：外部参考仓库（ueli / vicinae）自带代码，不属本仓库。
  // .gitignore 与 vitest 的 exclude 都已排除它，但这里此前漏了 —— 于是 `pnpm lint`
  // 会对第三方源码报 6 条错（5 条解析错 + 1 条 no-unused-expressions），
  // 而 CONTRIBUTING 又要求「提交前 pnpm lint 无 error」。
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      'scripts/**',
      'extension/**',
      'references/**'
    ]
  }, // extension/：浏览器扩展独立产物，chrome 全局/JS 运行时不适用应用 TS 规则集
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ],
      // 存量代码库严格度调整：降级为 warn，消除 lint error 阻塞，保留可见性
      // 后续增量代码建议遵循（新增文件可单独启用 error 级）
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  eslintConfigPrettier
)
