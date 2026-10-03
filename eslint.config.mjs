import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import tseslintCore from 'typescript-eslint'
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
  // ── 批 2c：type-aware 层（D2 收紧最后一段）──────────────────────────
  // recommendedTypeChecked 限 TS/Vue；js/mjs（e2e 探针等）经 disableTypeChecked 关闭
  // type-aware 规则（官方模式）。floating/misused-promises 升 error——未 await 的
  // 异步调用在 IPC 密集的 Electron 主进程里是真 bug 温床；unsafe-* 家族（better-sqlite3
  // 无类型行 × 11 Repository，B46）warn 过渡 + 数量棘轮测试钉「只减不增」。
  tseslintCore.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.{ts,tsx,vue}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn'
    }
  },
  {
    // 项目外文件（无 tsconfig 覆盖）：packages 自有工程、example 参考物、
    // e2e 探针、根级配置件、纯声明 d.ts——全部关闭 type-aware 规则
    files: [
      '**/*.{js,mjs,cjs}',
      '**/*.d.ts',
      '**/*.mts',
      'packages/**/*.{ts,tsx}',
      'example-plugin/**',
      'example-react/**',
      'vitest.global-setup.ts',
      'electron.vite.config.ts'
    ],
    ...tseslintCore.configs.disableTypeChecked
  },
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
