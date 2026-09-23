import { describe, it, expect } from 'vitest'
import { mergeCommandEntries } from '../mergeCommands'
import { buildStaticCommands, type CommandEntry } from '../commands'
import { createFirstPartyCommandProvider } from '../../renderer/src/commands/FirstPartyCommandProvider'
import { createSystemCommandProvider } from '../../renderer/src/commands/SystemCommandProvider'
import { commandsToEntries } from '../../renderer/src/commands/CommandLoader'

/**
 * 命令源合并（P-7②）。
 *
 * 分两层：合并规则本身（纯函数），以及**当下这套真数据合完不许有重复**——
 * 后者才是有价值的一半：`ai:translate` 等三条曾在静态清单与 Provider 里各写一份，
 * `firstparty:ai` 与 `ai:chat`、`module:screenRecorder` 与 `recording:start` 各是两个 id 一件事
 * ——2026-09-23 三处都清了（命令以 Provider 为准，模块行以 MODULES 为准），这条断言就是防止再长回来。
 */
const entry = (over: Partial<CommandEntry> & { key: string }): CommandEntry =>
  ({
    title: over.title ?? over.key,
    subtitle: '',
    icon: 'ri-pass-through-line',
    badge: '',
    action: { type: 'firstParty', page: 'ai' },
    ...over
  }) as CommandEntry

describe('mergeCommandEntries 的规则', () => {
  it('key 相同：先到先得，后者丢弃并上报', () => {
    const r = mergeCommandEntries([
      [entry({ key: 'a', title: '甲' })],
      [entry({ key: 'a', title: '甲改名了' })]
    ])
    expect(r.entries.map((e) => e.title)).toEqual(['甲'])
    expect(r.duplicateKeys).toEqual(['a'])
  })

  it('同标题同动作不同 key：判为同一件事，丢弃后来者并报出两边', () => {
    const r = mergeCommandEntries([
      [entry({ key: 'firstparty:ai', title: 'AI 对话' })],
      [entry({ key: 'ai:chat', title: 'AI 对话' })]
    ])
    expect(r.entries.map((e) => e.key)).toEqual(['firstparty:ai'])
    expect(r.duplicateTitles).toEqual(['ai:chat ≡ firstparty:ai'])
  })

  it('同动作但标题不同要留着（同一个页面入口的不同动作是合法的）', () => {
    const r = mergeCommandEntries([
      [entry({ key: 'ai:translate', title: '翻译为中文' })],
      [entry({ key: 'ai:summarize', title: '总结文本' })]
    ])
    expect(r.entries).toHaveLength(2)
    expect(r.duplicateTitles).toEqual([])
  })

  it('缺 key / 空源都不炸，也不产出 undefined 条目', () => {
    const r = mergeCommandEntries([
      [],
      [entry({ key: '' }), undefined as unknown as CommandEntry, null as unknown as CommandEntry],
      [entry({ key: 'ok' })]
    ])
    expect(r.entries.map((e) => e.key)).toEqual(['ok'])
  })
})

describe('真数据：两套命令源合完不许有重复', () => {
  it('静态清单 + 第一方 + 系统 Provider → key 与「同一件事两个 id」都为空', async () => {
    const firstParty = await createFirstPartyCommandProvider().getCommands()
    const system = await createSystemCommandProvider().getCommands()
    const staticList = buildStaticCommands()
    const r = mergeCommandEntries([
      commandsToEntries(firstParty), // Provider 是新的归属方，排在最前
      commandsToEntries(system),
      staticList
    ])
    expect(
      r.duplicateKeys,
      `这些命令在 Provider 与静态清单里各写了一份：${r.duplicateKeys.join(', ')}`
    ).toEqual([])
    expect(
      r.duplicateTitles,
      `同一件事有两个 id（界面上就是两行）：${r.duplicateTitles.join(', ')}`
    ).toEqual([])
    // 「合上了」要能被证明：原来写的是 `> firstParty.length + 20`，那个数假设了
    // 系统 Provider 也有条目 —— 而它没有 window.api 时按 fail-safe 返 0（正是该有的行为），
    // 阈值于是永远够不着。换成直接证「Provider 的每条命令都还在结果里」，与环境无关。
    const keys = new Set(r.entries.map((e) => e.key))
    const missing = firstParty
      .map((c) => `plugin:${c.id}`.replace(/^plugin:/, ''))
      .filter((id) => !keys.has(id) && ![...keys].some((k) => k.endsWith(`:${id}`)))
    expect(missing, `这些第一方命令在合并后消失了：${missing.join(', ')}`).toEqual([])
    expect(
      r.entries.length,
      '静态清单里比 Provider 多出来的那些条目不能被吃掉'
    ).toBeGreaterThanOrEqual(staticList.length)
  })
})
