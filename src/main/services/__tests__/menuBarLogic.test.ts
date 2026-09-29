import { describe, it, expect } from 'vitest'
import {
  parseMenuBarListing,
  buildClickScript,
  buildListScript,
  pathLabel,
  type MenuBarItem
} from '../menuBarLogic'

describe('menuBarLogic · 菜单栏项搜索（Raycast parity）', () => {
  describe('parseMenuBarListing（osascript 输出 → 扁平条目表）', () => {
    it('解析 tab 分层的路径行，app 名取首列', () => {
      const out = [
        'Safari\t文件\t新建窗口',
        'Safari\t文件\t导出为\tPDF…',
        'Safari\t帮助\tSafari 帮助'
      ].join('\n')
      const items = parseMenuBarListing(out)
      expect(items).toHaveLength(3)
      const pdf: MenuBarItem = items[1]
      // segments 只含路径段（不含条目名本身）
      expect(pdf.segments).toEqual(['文件', '导出为'])
      expect(pdf.title).toBe('PDF…')
      expect(pdf.pathLabel).toBe('文件 › 导出为')
    })

    it('跳过空行与无 item 列的行', () => {
      const out = ['', 'Safari\t文件', '  ', 'Safari\t编辑\t复制'].join('\n')
      const items = parseMenuBarListing(out)
      expect(items.map((i) => i.title)).toEqual(['复制'])
    })

    it('深层路径逐段进 segments，末列是 title', () => {
      const out = ['X\t文件\t导出为\tPDF…'].join('\n')
      const items = parseMenuBarListing(out)
      expect(items[0].segments).toEqual(['文件', '导出为'])
      expect(items[0].title).toBe('PDF…')
    })
  })

  describe('buildClickScript（构造点击 AppleScript，转义是安全面）', () => {
    it('顶级菜单项：menu bar item → menu 1 → menu item', () => {
      const script = buildClickScript(['文件'], '新建窗口')
      expect(script).toContain('click menu item "新建窗口" of menu 1 of menu bar item "文件"')
      expect(script).toContain('whose frontmost is true')
    })

    it('二级路径逐层展开 menu 1 of menu item 链', () => {
      const script = buildClickScript(['文件', '导出为'], 'PDF…')
      expect(script).toContain(
        'click menu item "PDF…" of menu 1 of menu item "导出为" of menu 1 of menu bar item "文件"'
      )
    })

    it('标题里的双引号与反斜杠转义，防脚本注入/断裂', () => {
      const script = buildClickScript(['Format'], 'Quote "Smart" \\ Test')
      expect(script).toContain('Quote \\"Smart\\" \\\\ Test')
    })

    it('带 targetPid 时按 unix id 定位（B36：胶囊聚焦时 frontmost 只能查到 Frond 自己）', () => {
      const script = buildClickScript(['文件'], '新建窗口', 4210)
      expect(script).toContain('first application process whose unix id is 4210')
      expect(script).not.toContain('frontmost')
    })

    it('targetPid 非整数时回退 frontmost（pid 只来自主进程校验后的缓存）', () => {
      const script = buildClickScript(['文件'], '新建窗口', Number.NaN)
      expect(script).toContain('whose frontmost is true')
    })
  })

  describe('buildListScript / pathLabel', () => {
    it('list 脚本含 frontmost 定位与 tab 输出', () => {
      const script = buildListScript(3)
      expect(script).toContain('whose frontmost is true')
      expect(script).toContain('menu bar items')
    })

    it('带 targetPid 时按 unix id 遍历目标应用（B36）', () => {
      const script = buildListScript(3, 4210)
      expect(script).toContain('first application process whose unix id is 4210')
      expect(script).not.toContain('frontmost')
      expect(script).toContain('menu bar items')
    })

    it('pathLabel 用 › 连接路径段', () => {
      expect(pathLabel(['文件', '导出为'])).toBe('文件 › 导出为')
      expect(pathLabel([])).toBe('')
    })
  })
})
