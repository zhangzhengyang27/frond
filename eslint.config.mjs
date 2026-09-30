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
    ignores: ['**/node_modules', '**/dist', '**/out', 'scripts/**', 'extension/**', 'references/**']
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
      // 批 2a（2026-09-30）三族升 error：prettier 存量已 autofix 清零、no-explicit-any
      // 实测命中 0、no-unused-vars 存量已清——升 error 锁住不再回潮。
      // explicit-function-return-type 留 warn：存量 20 个 composable 函数声明的返回类型
      // 注解归入批 2c（与 NUIA/EOPT 同波清账）；allowExpressions 豁免回调箭头降噪。
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  // 批 7b：main 域空 catch 已全量清账（85 处 → log.debug），此后 no-empty 守门——
  // 尽力而为的失败必须有观测点。renderer 域存量 214 处另行专项，暂不适用。
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }]
    }
  },
  // .js/.mjs（e2e 探针 / playwright spec / 配置件）写不了 TS 返回类型注解——直接关闭。
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
