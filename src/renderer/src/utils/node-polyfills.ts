/**
 * 浏览器环境里 `source-map-js` 的替身（vite alias 指过来）。
 *
 * 渲染层代码没有 import 它，纯粹是被打进来的某个依赖 require 了它。
 * 这里给的是**惰性空实现**（与 fs-polyfill.ts 同一口径）：不解析、不生成，
 * 调用方拿到空结果而不是崩在渲染路径上。真需要在浏览器里读 source map 的话，
 * 应该换成 npm 上的 browser 版而不是把这里补全。
 */

export class SourceMapGenerator {
  addMapping(): this {
    return this
  }
  setSourceContent(): this {
    return this
  }
  applySourceMap(): this {
    return this
  }
  toJSON(): object {
    return { version: 3, sources: [], names: [], mappings: '' }
  }
  toString(): string {
    return JSON.stringify(this.toJSON())
  }
}

export class SourceMapConsumer {
  version = 3 as const
  sources: string[] = []
  names: string[] = []
  rawSourceMap: unknown
  constructor(rawSourceMap?: unknown) {
    this.rawSourceMap = rawSourceMap
  }
  originalPositionFor(): { source: null; line: null; column: null; name: null } {
    return { source: null, line: null, column: null, name: null }
  }
  generatedPositionFor(): { line: null; column: null } {
    return { line: null, column: null }
  }
  eachMapping(cb: unknown): void {
    void cb // 惰性替身：不遍历
  }
  sourceContentFor(): null {
    return null
  }
  destroy(): void {
    this.rawSourceMap = null
  }
}

export class SourceNode {
  add(): this {
    return this
  }
  toString(): string {
    return ''
  }
  toStringWithSourceMap(): { code: string; map: SourceMapGenerator } {
    return { code: '', map: new SourceMapGenerator() }
  }
  walk(cb: unknown): void {
    void cb
  }
  walkSourceContents(cb: unknown): void {
    void cb
  }
  setSourceContent(): this {
    return this
  }
  join(): this {
    return this
  }
  replaceWith(): this {
    return this
  }
  prepend(): this {
    return this
  }
  clone(): this {
    return this
  }
  allLineMaps(): unknown[] {
    return []
  }
  sourceMapFromRoots(): SourceMapGenerator {
    return new SourceMapGenerator()
  }
  static fromStringWithMap(_code: string): SourceNode {
    return new SourceNode()
  }
}

export default { SourceMapGenerator, SourceMapConsumer, SourceNode }
