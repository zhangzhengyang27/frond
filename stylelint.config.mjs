/**
 * Frond · stylelint 配置 —— 2026-09-24 重建件（原配置从未入库，随 2026-09-22 删除事故丢失）
 *
 * 为什么这文件重要：事故后 `pnpm lint:css` 一直在抛 ConfigurationError，被
 * package.json 的 `|| true` 吞掉 —— CSS 门禁三层（脚本、配置、错误处理）全断且无声。
 * 这与 B16「lint-css-changed 静默跳过已暂存文件」同类：静默跳过比失败更危险。
 *
 * 按可考的文档契约重建（行为细节是推断的，改前先读）：
 *   - ci.yml:36-39：存量 warnings 容忍（渐进清零）、增量零容忍 → 颜色规则定为
 *     warning 级，由 lint-css-changed 的 STRICT_CSS_LINT=1 负责增量拦停
 *   - CONTRIBUTING.md:26「新代码必须 0 hex」→ color-no-hex（颜色必须走 design token）
 *   - lint:css 的 glob 含 .vue → extends stylelint-config-html/vue 认 SFC
 *     （仓库当前没有 .less 文件，glob 里的 less 仅为兼容保留）
 *   - 未 extends stylelint-config-standard：现有存量 CSS 会产生大量 error，
 *     会让「触碰旧文件」的开发者被与本次改动无关的报错拦住 —— 等存量清账后再收紧
 */
export default {
  extends: ['stylelint-config-html/vue'],
  rules: {
    'color-no-hex': [true, { severity: 'warning' }]
  }
}
