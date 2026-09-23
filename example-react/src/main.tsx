import {
  start,
  List,
  ActionPanel,
  Action,
  Detail,
  Form,
  useNavigation,
  getPluginContext,
  closePlugin,
  showToast,
  getPreferenceValues,
  openExternalUrl,
  scheduleCommand,
  listScheduledCommands,
  cancelScheduledCommand
} from 'frond-plugin-sdk'
import type { ReactElement } from 'react'

/**
 * P-2.6 两个稳定态（不用计时器切换：瞬态断言在套跑里必偶发）
 * - list-loading：列表在加载，宿主显示自己的加载文案
 * - list-empty：没有条目且不再加载，宿主显示插件给的 emptyMessage
 */
function ListLoading(): ReactElement {
  return <List loading emptyMessage="加载完才会看到这句" />
}
function ListEmpty(): ReactElement {
  return <List emptyMessage="还没有数据，先同步一次" />
}

/** P-2.6：详情级动作（Detail.actions）——宿主降级后动作挂在占位条目上 */
function DetailWithActions(): ReactElement {
  const nav = useNavigation()
  return (
    <Detail markdown={'# 详情级动作\n\n这条详情带了一个动作，胶囊右侧照旧显示正文'}>
      <ActionPanel>
        <Action
          title="推一层详情"
          onAction={() => nav.push(<Detail markdown="来自详情动作的下一层" />)}
        />
      </ActionPanel>
    </Detail>
  )
}

const REPOS = [
  { name: 'frond/launcher', desc: '启动器主仓库', star: '1.2k' },
  { name: 'frond/plugin-sdk', desc: 'React 插件 SDK', star: '318' },
  { name: 'frond/docs', desc: '开发文档', star: '97' }
]

function FeedbackForm() {
  const nav = useNavigation()
  return (
    <Form
      title="反馈"
      submitLabel="发送反馈"
      onSubmit={(values) =>
        nav.push(
          <Detail markdown={`# 已收到反馈\n\n类型：${values.kind}\n内容：${values.content}`} />
        )
      }
    >
      <Form.Select id="kind" label="类型" options={['建议', '缺陷']} initial="建议" />
      <Form.TextField id="content" label="内容" placeholder="想说的话" />
    </Form>
  )
}

function App() {
  const nav = useNavigation()
  return (
    <List>
      {REPOS.map((r) => (
        <List.Item
          key={r.name}
          title={r.name}
          subtitle={r.desc}
          icon="git-repository-line"
          accessories={[r.star]}
          detail={`# ${r.name}\n\n${r.desc}`}
          detailFormat="markdown"
        >
          <ActionPanel>
            <Action
              title="查看详情"
              onAction={() =>
                nav.push(<Detail markdown={`# ${r.name}\n\n由回调推入的详情视图（React 组件）`} />)
              }
            />
            <Action title="提交反馈" onAction={() => nav.push(<FeedbackForm />)} />
            <Action title="复制名称" type="copy" payload={r.name} />
          </ActionPanel>
        </List.Item>
      ))}
    </List>
  )
}

void (async () => {
  // Action 命令（plugin.json 里 mode:'action'）：不渲染视图、跑完就收。
  // 宿主那边对应「视图创建了但不挂到胶囊窗」，所以用户不会看到插件界面。
  const ctx = await getPluginContext()
  if (ctx?.cmd === 'ping' || ctx?.cmd === 'ping-hold') {
    showToast({ title: 'React 示例', message: 'Action 命令已执行' })
    // ping-hold 故意不自关：用来验宿主 ACTION_COMMAND_TIMEOUT_MS 的兜底回收
    if (ctx.cmd === 'ping') await closePlugin()
    return
  }
  if (ctx?.cmd === 'list-loading') {
    start(<ListLoading />)
    return
  }
  if (ctx?.cmd === 'list-empty') {
    start(<ListEmpty />)
    return
  }
  if (ctx?.cmd === 'detail-actions') {
    start(<DetailWithActions />)
    return
  }
  /**
   * P-2.5 三格平台能力的探针。三条都是**不留副作用**的判据：
   * - who/theme 来自 manifest.preferences（走 plugapi:listPreferences，未设过取默认值）；
   * - open(url) 两道闸分开量：本清单**声明了 net**，所以
   *   `https:` 走到最后一道（e2e 把 `shell.openExternal` 换成记录器，不会真开浏览器）、
   *   `file:` 被协议白名单挡在门外。清单不声明 net 时两条都会是 false，
   *   那种断言分不清是权限门还是白名单在起作用——那正是这里要避开的假覆盖。
   * Alert 也不在这里：原生模态框自动化里没人点，装配逻辑由 pluginAlert 的单测钉。
   */
  /**
   * 两个文本参数 → 宿主应当在**搜索框内联槽**里收（P-1.6b），不是跳表单页。
   * 这里只负责把收到的 args 渲染出来，e2e 据此判断参数真的传到了插件。
   */
  if (ctx?.cmd === 'argsum') {
    const a = ctx.args?.a ?? '(无)'
    const b = ctx.args?.b ?? '(无)'
    start(<Detail markdown={`# 参数已收到\n\na=${a}\nb=${b}`} />)
    return
  }
  /**
   * P-2③ 排程探针：登记 → 列出，四道闸里能在插件侧撞到的三道各撞一次。
   * 幂等：先把自己旧任务撤干净再排，跑几遍结果都一样（e2e 允许重跑）。
   * 三条都是读界面就能判定的：收下的那条回 id，被拒的两条回宿主原话。
   */
  if (ctx?.cmd === 'schedule-selftest') {
    for (const old of await listScheduledCommands()) await cancelScheduledCommand(old.id)
    const okAdd = await scheduleCommand({ label: 'e2e 排程', cron: '*/15 * * * *', cmd: 'ping' })
    // 再排一条「下一分钟」的：e2e 要验的是**真到点跑起来**（引擎 + 三道闸 + detached 起插件），
    // 而不是只验「立刻跑一次」那个按钮。30s 一次心跳，最多等 100s 一定跨过一分钟。
    const next = new Date(Date.now() + 65_000)
    const soonCron = `${next.getMinutes()} ${next.getHours()} ${next.getDate()} ${next.getMonth() + 1} *`
    await scheduleCommand({ label: 'e2e 一分钟后排程', cron: soonCron, cmd: 'ping' })
    const tooDense = await scheduleCommand({ label: '太密', cron: '* * * * *', cmd: 'ping' })
    const notAction = await scheduleCommand({ label: '视图命令', cron: '0 9 * * *', cmd: 'repos' })
    const list = await listScheduledCommands()
    start(
      <Detail
        markdown={
          `# 排程探针\n\nadd=${okAdd.ok ? okAdd.id : okAdd.error}\n` +
          `dense=${tooDense.ok ? 'ACCEPTED' : tooDense.error}\n` +
          `view=${notAction.ok ? 'ACCEPTED' : notAction.error}\n` +
          `count=${list.length}\nlabels=${list.map((t) => t.label).sort().join(',')}`
        }
      />
    )
    return
  }

  if (ctx?.cmd === 'platform') {
    const prefs = await getPreferenceValues<Record<string, unknown>>()
    const file = await openExternalUrl('file:///etc/passwd')
    const https = await openExternalUrl('https://example.com/frond-e2e')
    start(
      <Detail
        markdown={`# 平台能力探针\n\nwho=${String(prefs.who ?? 'null')}\ntheme=${String(prefs.theme ?? 'null')}\nfile=${String(file)}\nhttps=${String(https)}`}
      />
    )
    return
  }
  start(<App />)
})()
