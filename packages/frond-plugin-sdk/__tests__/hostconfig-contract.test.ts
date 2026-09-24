import { describe, it, expect, beforeAll } from 'vitest'
import { createElement } from 'react'
import Reconciler from 'react-reconciler'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * react-reconciler **宿主配置契约**（P1-1 的升级守卫）
 *
 * 为什么单独一份：2026-09-22 出过一次真事故 —— SDK 的 `commitUpdate` 沿用了旧版
 * 形参顺序 `(instance, updatePayload, type, oldProps, newProps)`，而
 * react-reconciler 0.34 的实际调用是
 *
 *     commitUpdate(instance, type, prevProps, nextProps, internalHandle)   // 5 个实参
 *
 * 于是错位一位：第 4 位（本该是 nextProps）收到的是 `internalHandle`（React fiber），
 * 被赋进 `HostNode.props` → `resetAfterCommit` 序列化时递归 stateNode→props→…
 * **RangeError 爆栈；root 被打坏后此后所有视图提交静默消失**（表现为「表单间歇
 * 渲染失败」）。而当时单测、typecheck、构建**全是绿的**。
 *
 * 三条判据：
 *   1. 装到的 react-reconciler 必须**恰好**是钉住的版本（升版是显式动作）
 *   2. reconciler **实际传进来的实参个数与位置**必须与契约一致 —— 用宿主配置的
 *      「带探针副本」自建一个 reconciler 真跑 render+update 量出来（不读源码）
 *   3. 宿主配置自己声明的形参顺序必须对齐（把 0.34 的调用原样喂进去，看 props 落对没）
 *
 * 为什么探针要「自建 reconciler」而不是替换 SDK 那份：react-reconciler 在
 * `Reconciler(config)` 时就把宿主配置**解构**掉了，事后改 `hostConfig.commitUpdate`
 * 根本不会被调用（实测：探针抓到 0 次）。
 *
 * 实测值（0.34.0，2026-09-24）：
 *   createInstance(type, props, rootContainer, hostContext, fiber)      → 5
 *   appendChild(parent, child) / appendChildToContainer(container, c)   → 2
 *   insertBefore(parent, child, before)                                 → 3
 *   removeChild(parent, child, undefined, undefined, undefined)         → 5，尾部补 undefined
 *   commitUpdate(instance, type, prevProps, nextProps, fiber)           → 5
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_RECONCILER = join(__dirname, '..', 'dist', 'reconciler.js')

/** 与 package.json 的 peerDependencies / devDependencies 保持一致（改了要一起改） */
const PINNED_RECONCILER_VERSION = '0.34.0'

type AnyFn = (...args: unknown[]) => unknown

interface HostConfigLike {
  [key: string]: unknown
}

/** 实参形状摘要：'null' / 基础类型名 / `{key1,key2}` */
function shapeOf(a: unknown): string {
  if (a === null) return 'null'
  if (typeof a === 'object') {
    return `{${Object.keys(a as object)
      .slice(0, 5)
      .join(',')}}`
  }
  return typeof a
}

let hostConfig: HostConfigLike

beforeAll(async () => {
  // 自建 reconciler 也会走宿主配置的 resetAfterCommit → 提交视图，需要一个 launcherApi 桩
  ;(globalThis as unknown as { launcherApi: unknown }).launcherApi = {
    renderView: async () => ({ ok: true }),
    onCallback: () => {},
    close: () => {}
  }
  hostConfig = (await import(DIST_RECONCILER)).hostConfig as HostConfigLike
})

describe('react-reconciler 版本钉死', () => {
  it(`装到的版本必须恰好是 ${PINNED_RECONCILER_VERSION}（升版是显式动作，不是 install 的副作用）`, () => {
    const require = createRequire(import.meta.url)
    const installed = (require('react-reconciler/package.json') as { version: string }).version
    expect(
      installed,
      `react-reconciler 从 ${PINNED_RECONCILER_VERSION} 变成了 ${installed}。\n` +
        '宿主配置是按位置传参被调用的，小版本也可能改调用签名（0.34 就删掉了 updatePayload 这一位）。\n' +
        '升版前先跑本文件的「运行时实参」用例确认调用形状没变，再一起改这里的常量与 package.json。'
    ).toBe(PINNED_RECONCILER_VERSION)
  })

  it('SDK package.json 里 peer / dev 两处都钉的是精确版本（没有 ^ 或 ~）', () => {
    const require = createRequire(import.meta.url)
    const pkg = require('../package.json') as {
      peerDependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(pkg.peerDependencies['react-reconciler']).toBe(PINNED_RECONCILER_VERSION)
    expect(pkg.devDependencies['react-reconciler']).toBe(PINNED_RECONCILER_VERSION)
  })
})

const PROBED = [
  'createInstance',
  'appendChild',
  'appendChildToContainer',
  'insertBefore',
  'removeChild',
  'commitUpdate'
] as const

interface ProbeResult {
  arities: Record<string, number[]>
  shapes: Record<string, string[]>
}

/**
 * 用宿主配置的「带探针副本」自建一个 reconciler，真跑 render + update，
 * 把 reconciler 实际传进来的实参**量出来**。
 */
function measureCallArities(): ProbeResult {
  const arities: Record<string, number[]> = {}
  const shapes: Record<string, string[]> = {}
  const spyConfig: HostConfigLike = { ...hostConfig }

  for (const name of PROBED) {
    arities[name] = []
    const orig = hostConfig[name] as AnyFn
    spyConfig[name] = (...args: unknown[]): unknown => {
      arities[name].push(args.length)
      if (!shapes[name]) shapes[name] = args.map(shapeOf)
      return orig(...args)
    }
  }

  // 自建容器 + root（与 SDK 内部同形，但完全独立，不影响 SDK 那份 reconciler）
  const container = { type: 'list', props: {}, children: [] as unknown[] }
  const rec = Reconciler(spyConfig as never) as {
    createContainer: (...a: unknown[]) => unknown
    updateContainer: (...a: unknown[]) => void
  }
  const root = rec.createContainer(
    container,
    1,
    null,
    false,
    null,
    'contract-probe',
    () => {},
    () => {},
    () => {},
    null
  )

  const render = (titles: string[]): void => {
    rec.updateContainer(
      createElement(
        'list',
        null,
        ...titles.map((t, i) => createElement('list-item', { key: `${i}-${t}`, title: t }))
      ),
      root,
      null,
      () => {}
    )
  }

  render(['a', 'b']) // 首次挂载
  render(['a', 'b', 'c']) // 追加 → appendChild
  render(['a', 'c']) // 删除 b → removeChild
  render(['a2', 'c']) // 改 props → commitUpdate
  return { arities, shapes }
}

describe('运行时实参契约（reconciler 实际怎么调我们）', () => {
  it('commitUpdate 恰好 5 个实参，且第 4 位是新 props、第 5 位才是 internalHandle', () => {
    const { arities, shapes } = measureCallArities()

    // 体量哨兵：一条都没抓到说明探针没生效，本用例等于空转
    expect(
      arities.commitUpdate.length,
      '没抓到 commitUpdate 调用 —— 探针失效，本用例等于空转'
    ).toBeGreaterThan(0)

    const seen = [...new Set(arities.commitUpdate)]
    expect(
      seen,
      `commitUpdate 的实参个数是 ${seen.join('/')}。0.34 的契约是 5 个：\n` +
        '  (instance, type, prevProps, nextProps, internalHandle)\n' +
        '形参一错位就会把 internalHandle（React fiber）写进 HostNode.props，' +
        '序列化时递归爆栈、root 打坏后视图提交静默消失。'
    ).toEqual([5])

    // 位置也要对：第 2 位是 host type（字符串），第 3/4 位是 props 对象，第 5 位是 fiber
    const shape = shapes.commitUpdate
    expect(shape[0]).toContain('type') // instance（HostNode）
    expect(shape[1]).toBe('string') // type
    expect(shape[2]).toContain('title') // prevProps
    expect(shape[3]).toContain('title') // nextProps ← 事故里错位的就是这一位
    expect(shape[4]).toContain('stateNode') // internalHandle（fiber）
  })

  it('createInstance / appendChild / appendChildToContainer / insertBefore 的实参个数与契约一致', () => {
    const { arities, shapes } = measureCallArities()

    // createInstance(type, props, rootContainer, hostContext, internalHandle)
    expect(new Set(arities.createInstance)).toEqual(new Set([5]))
    expect(shapes.createInstance[0]).toBe('string')
    expect(shapes.createInstance[1]).toContain('title')

    // appendChild(parent, child) / appendChildToContainer(container, child)
    expect(new Set(arities.appendChild)).toEqual(new Set([2]))
    expect(new Set(arities.appendChildToContainer)).toEqual(new Set([2]))

    // insertBefore(parent, child, before)
    expect(new Set(arities.insertBefore)).toEqual(new Set([3]))
  })

  it('removeChild 前两位是 (parent, child)，尾部多出的实参必须是 undefined（0.34 的共享 helper 补位）', () => {
    const { arities, shapes } = measureCallArities()

    expect(arities.removeChild.length).toBeGreaterThan(0)
    const shape = shapes.removeChild
    expect(shape[0]).toContain('type') // parent（HostNode）
    expect(shape[1]).toContain('type') // child（HostNode）
    // 实测 0.34 传 5 个：后 3 个是 undefined。若哪天它们变成有意义的值，
    // 说明调用约定变了，必须回来看我们的 removeChild 是不是只吃前两位。
    expect(shape.slice(2).every((s) => s === 'undefined')).toBe(true)
    expect([...new Set(arities.removeChild)].every((n) => n >= 2)).toBe(true)
  })

  it('react-reconciler 在第 4 位传的是真 props、第 5 位才是 fiber（库侧对照）', () => {
    // 注意这条验的是**库侧**：探针读的是 reconciler 传进来的实参本身，
    // 所以它不随我们 handler 的形参写法变化 —— 库侧的「哪一位是 props」由它钉住，
    // 我们这侧的「有没有读对那一位」由下面「宿主配置自身的形参顺序」那两条钉住。
    const captured: Array<Record<string, unknown>> = []
    const spyConfig: HostConfigLike = { ...hostConfig }
    const orig = hostConfig.commitUpdate as AnyFn
    spyConfig.commitUpdate = (...args: unknown[]): unknown => {
      captured.push(args[3] as Record<string, unknown>)
      return orig(...args)
    }

    const container = { type: 'list', props: {}, children: [] as unknown[] }
    const rec = Reconciler(spyConfig as never) as {
      createContainer: (...a: unknown[]) => unknown
      updateContainer: (...a: unknown[]) => void
    }
    const root = rec.createContainer(
      container,
      1,
      null,
      false,
      null,
      'contract-probe',
      () => {},
      () => {},
      () => {},
      null
    )
    const render = (title: string): void => {
      rec.updateContainer(
        createElement('list', null, createElement('list-item', { title })),
        root,
        null,
        () => {}
      )
    }
    render('第一版')
    render('第二版')

    expect(captured.length).toBeGreaterThan(0)
    // 体量哨兵：至少要抓到一次带 title 的 list-item props，否则说明抓错了位
    expect(captured.some((p) => typeof p.title === 'string')).toBe(true)
    for (const props of captured) {
      expect(Object.keys(props)).not.toContain('stateNode')
      expect(Object.keys(props)).not.toContain('memoizedProps')
      expect(Object.keys(props)).not.toContain('return')
    }
  })
})

describe('宿主配置自身的形参顺序（把 0.34 的调用原样喂进去）', () => {
  it('commitUpdate 的第 4 个形参就是新 props；第 5 个 internalHandle 必须被忽略', () => {
    const instance = { type: 'list-item', props: { title: '旧' }, children: [] }
    // 第 5 位模拟 React fiber：带 stateNode 自引用（错位时会写进 props 并炸栈）
    const fiberLike: Record<string, unknown> = { tag: 5 }
    fiberLike.stateNode = { props: fiberLike }

    ;(hostConfig.commitUpdate as AnyFn)(
      instance,
      'list-item',
      { title: '旧' },
      { title: '新' },
      fiberLike
    )

    expect(instance.props).toEqual({ title: '新' })
    expect(instance.props).not.toBe(fiberLike)
    expect(Object.keys(instance.props)).not.toContain('stateNode')
  })

  it('第 4 位若收到 fiber（错位形态）会写出脏 props —— 记录事故特征，防止有人改回旧签名', () => {
    const instance = { type: 'list-item', props: { title: '旧' }, children: [] }
    const fiberLike = { tag: 5, stateNode: {} }
    // 把 fiber 放第 4 位 = 模拟错位后的实际后果
    ;(hostConfig.commitUpdate as AnyFn)(instance, 'list-item', { title: '旧' }, fiberLike, undefined)
    expect(Object.keys(instance.props)).toContain('stateNode')
  })
})
