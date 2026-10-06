/**
 * Frond · 汇率转换（React SDK 标杆插件，spec 5.5）
 *
 * List 换算列表（常用货币 Top10 + 收藏对）+ nav.push 货币选择页 + Form 自定义金额 +
 * db 离线缓存 24h。验证 SDK 端到端：网络（api.fetch）+ 缓存（db）+ 多级导航（push/pop）+ 表单。
 *
 * ⚠ 结构契约（2026-10-06 白屏排查实证）：
 * 1. List.Item 的动作面板必须写成 **children**（<List.Item ...><ActionPanel>...</ActionPanel></List.Item>），
 *    不能作为 actions prop 传入——serializeList 只从 children 收集 action-panel，
 *    prop 形态的原始 ReactElement 会直通 IPC，structured clone 失败 → 静默白屏。
 * 2. 顶层启动入口用 function main() + main() 调用，不可裸 void/async IIFE
 *    （esbuild 会把 void 表达式判为无副作用整段摇掉，产物空壳）。
 */
import {
  start,
  List,
  Detail,
  ActionPanel,
  Action,
  Form,
  useNavigation,
  getPluginContext,
  showHud,
  copyToClipboard
} from 'frond-plugin-sdk'
import type { ReactElement } from 'react'
import { isCacheFresh, topCurrencies } from '../lib.js'

const API_BASE = 'https://open.er-api.com/v6/latest/'

/** 宿主 API 面（SDK 已封装之外的通道：fetch / db / preferences） */
interface HostBridge {
  fetch?: (url: string) => Promise<{ ok?: boolean; data?: string } | undefined>
  db?: {
    get?: (id: string) => Promise<{ data?: unknown } | null>
    put?: (id: string, data: unknown) => Promise<unknown>
  }
  preferences?: { get?: (name: string) => Promise<{ ok?: boolean; value?: unknown } | undefined> }
}

function bridge(): HostBridge {
  return ((globalThis as { launcherApi?: HostBridge }).launcherApi || {}) as HostBridge
}

interface RatesCache {
  base: string
  rates: Record<string, number>
  ts: number
}

const state = {
  from: 'CNY',
  to: 'USD',
  amount: 100,
  cache: null as RatesCache | null,
  offline: false,
  pairs: [] as Array<{ from: string; to: string }>
}

function convertWith(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  const rf = rates[from]
  const rt = rates[to]
  if (!rf || !rt) return null
  return Math.round(((amount / rf) * rt) * 10000) / 10000
}

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'currency' }).of(code) || code
  } catch {
    return code
  }
}

async function loadPrefs(): Promise<void> {
  try {
    const prefs = bridge().preferences
    if (!prefs || !prefs.get) return
    const g = await prefs.get('baseCurrency')
    const t = await prefs.get('targetCurrency')
    if (g && g.ok && typeof g.value === 'string') state.from = g.value
    if (t && t.ok && typeof t.value === 'string') state.to = t.value
  } catch {
    /* 偏好缺失用默认 */
  }
}

async function loadRates(): Promise<void> {
  const db = bridge().db
  let cached: RatesCache | null = null
  if (db && db.get) {
    const stored = await db.get('rates')
    const data = stored && stored.data
    if (data && typeof data === 'object' && 'rates' in data) cached = data as RatesCache
  }
  if (cached && cached.base === state.from && isCacheFresh(cached)) {
    state.cache = cached
    state.offline = false
    return
  }
  const fetcher = bridge().fetch
  if (!fetcher) throw new Error('fetch 不可用')
  try {
    const res = await fetcher(API_BASE + state.from)
    if (res && res.ok && res.data) {
      const body = JSON.parse(res.data) as { result?: string; rates?: Record<string, number> }
      if (body.result === 'success' && body.rates) {
        state.cache = { base: state.from, rates: body.rates, ts: Date.now() }
        state.offline = false
        if (db && db.put) await db.put('rates', state.cache)
        return
      }
    }
    throw new Error('bad response')
  } catch {
    if (cached) {
      state.cache = cached
      state.offline = true
      return
    }
    state.cache = null
    state.offline = false
  }
}

async function loadPairs(): Promise<void> {
  const db = bridge().db
  if (!db || !db.get) return
  const stored = await db.get('pairs')
  const list = stored && stored.data && (stored.data as { list?: Array<{ from: string; to: string }> }).list
  state.pairs = Array.isArray(list) ? list : []
}

async function savePairs(): Promise<void> {
  const db = bridge().db
  if (db && db.put) await db.put('pairs', { list: state.pairs })
}

function RateList(): ReactElement {
  const nav = useNavigation()
  const cache = state.cache

  if (!cache) {
    return (
      <List emptyMessage="没有可用汇率（首次拉取失败请重试）">
        <List.Item title="拉取汇率失败" subtitle={'无法连接 ' + API_BASE} icon="error-warning-line">
          <ActionPanel>
            <Action title="重试" onAction={() => void run()} />
          </ActionPanel>
        </List.Item>
      </List>
    )
  }

  const rates = cache.rates
  const main = convertWith(state.amount, state.from, state.to, rates)
  const cachedTag = state.offline
    ? '离线 · ' + Math.max(1, Math.floor((Date.now() - (cache.ts || 0)) / 3600e3)) + 'h 前'
    : new Date(cache.ts || 0).toLocaleTimeString('zh-CN', { hour12: false })

  return (
    <List>
      <List.Item
        key="main"
        title={main !== null ? `${fmt(state.amount)} ${state.from} = ${fmt(main)} ${state.to}` : `${state.from} → ${state.to} 不支持`}
        subtitle={main !== null ? `1 ${state.from} = ${fmt(rates[state.to])} ${state.to} · 数据 ${cachedTag}` : '该货币对暂无汇率'}
        icon="exchange-line"
        accessories={[state.offline ? '离线' : '实时']}
        detail={`# ${state.from} → ${state.to}\n\n- 金额：${fmt(state.amount)}\n- 汇率：1 ${state.from} = ${fmt(rates[state.to] || NaN)} ${state.to}\n- 数据源：open.er-api.com（每 10 分钟更新）`}
        detailFormat="markdown"
      >
        <ActionPanel>
          <Action
            title="复制结果"
            onAction={() =>
              void copyToClipboard(main !== null ? `${state.amount} ${state.from} = ${main} ${state.to}` : '')
                .then(() => showHud('已复制'))
                .catch(() => showHud('复制失败'))
            }
          />
          <Action
            title="换向（B→A）"
            onAction={() => {
              const f = state.from
              state.from = state.to
              state.to = f
              void run()
            }}
          />
          <Action
            title="收藏该货币对"
            onAction={() => {
              const dup = state.pairs.some((p) => p.from === state.from && p.to === state.to)
              if (!dup) state.pairs.push({ from: state.from, to: state.to })
              void savePairs()
              void run()
            }}
          />
          <Action title="换币种" onAction={() => nav.push(<CurrencyPicker picking="to" />)} />
          <Action title="自定义金额" onAction={() => nav.push(<AmountForm />)} />
        </ActionPanel>
      </List.Item>
      {state.pairs.length > 0 ? (
        <List.Section title="收藏货币对">
          {state.pairs.map((p, i) => {
            const v = convertWith(state.amount, p.from, p.to, rates)
            return (
              <List.Item
                key={'p' + i}
                title={v !== null ? `${fmt(state.amount)} ${p.from} = ${fmt(v)} ${p.to}` : `${p.from} → ${p.to}`}
                subtitle={p.from + ' → ' + p.to}
                icon="bookmark-line"
              >
                <ActionPanel>
                  <Action
                    title="换算"
                    onAction={() => {
                      state.from = p.from
                      state.to = p.to
                      void run()
                    }}
                  />
                  <Action
                    title="取消收藏"
                    onAction={() => {
                      state.pairs.splice(i, 1)
                      void savePairs()
                      void run()
                    }}
                  />
                </ActionPanel>
              </List.Item>
            )
          })}
        </List.Section>
      ) : null}
      <List.Section title="常用货币">
        {topCurrencies
          .filter((c) => c !== state.from && c !== state.to)
          .map((c) => {
            const v = convertWith(state.amount, state.from, c, rates)
            return (
              <List.Item
                key={c}
                title={v !== null ? `${fmt(state.amount)} ${state.from} = ${fmt(v)} ${c}` : `${c} 暂无汇率`}
                subtitle={currencyName(c)}
                icon="money-cny-box-line"
                accessories={[c]}
              >
                <ActionPanel>
                  <Action
                    title="换算到该货币"
                    onAction={() => {
                      state.to = c
                      void run()
                    }}
                  />
                  <Action
                    title="复制"
                    onAction={() =>
                      void copyToClipboard(v !== null ? String(v) : '')
                        .then(() => showHud('已复制'))
                        .catch(() => showHud('复制失败'))
                    }
                  />
                </ActionPanel>
              </List.Item>
            )
          })}
      </List.Section>
    </List>
  )
}

function CurrencyPicker(props: { picking: 'from' | 'to' }): ReactElement {
  const nav = useNavigation()
  const rates = state.cache ? state.cache.rates : {}
  const codes = Object.keys(rates).sort()
  return (
    <List emptyMessage="该基准下没有可用货币">
      {codes.map((c) => (
        <List.Item key={c} title={c} subtitle={currencyName(c)} icon="money-cny-box-line">
          <ActionPanel>
            <Action
              title="选择"
              onAction={() => {
                if (props.picking === 'from') state.from = c
                else state.to = c
                nav.pop()
                void run()
              }}
            />
          </ActionPanel>
        </List.Item>
      ))}
    </List>
  )
}

function AmountForm(): ReactElement {
  const nav = useNavigation()
  return (
    <Form
      title="自定义金额"
      submitLabel="换算"
      onSubmit={(values) => {
        const n = Number(values.amount)
        if (Number.isFinite(n) && n >= 0) state.amount = n
        nav.pop()
        void run()
      }}
    >
      <Form.TextField id="amount" label="金额" placeholder="如 100 或 12.5" />
    </Form>
  )
}

function ErrorDetail(props: { message: string }): ReactElement {
  return <Detail markdown={`# 出错了\n\n${props.message}`} />
}

async function run(): Promise<void> {
  await loadRates()
  start(<RateList />)
}

function main(): void {
  void (async () => {
    if ((globalThis as { __frondCurrencyBooted?: boolean }).__frondCurrencyBooted) return
    ;(globalThis as { __frondCurrencyBooted?: boolean }).__frondCurrencyBooted = true
    try {
      const ctx = await getPluginContext()
      const q = ctx && ctx.args && ctx.args.q
      if (q && typeof q === 'string') {
        const m = /^(\d+(?:\.\d+)?)/.exec(q)
        if (m) state.amount = Number(m[1])
      }
      await loadPrefs()
      await loadPairs()
      await run()
    } catch (e) {
      start(<ErrorDetail message={e instanceof Error ? e.message : String(e)} />)
    }
  })()
}

main()
