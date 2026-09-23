/**
 * Frond 插件组件集（#11 v1：List / Detail / ActionPanel / useNavigation）。
 * 组件是普通函数组件——返回宿主元素（type 为 'list' 等字符串），
 * 由 reconciler 序列化为视图 JSON，宿主原生渲染。
 * 插件作者用 JSX 书写（他们自己的构建工具 jsx=automatic 会调 React.createElement）。
 */
import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

// ─── List ───

export interface ListProps {
  /** 列表加载态（对标 Raycast isLoading）：宿主在空列表时显示加载行 */
  loading?: boolean
  /** 空列表时显示的文案（对标 Raycast emptyView，Frond 收字符串） */
  emptyMessage?: string
  children?: ReactNode
}

export interface ListItemProps {
  title: string
  subtitle?: string
  icon?: string
  accessories?: string[]
  keywords?: string[]
  /** 选中时右侧详情（markdown 或纯文本） */
  detail?: string
  detailFormat?: 'text' | 'markdown'
  children?: ReactNode
}

export interface SectionProps {
  title?: string
  children?: ReactNode
}

/** 列表根组件；Item / Section 作为静态属性挂载（供 JSX 命名空间使用） */
export function List(props: ListProps): ReactNode {
  return createElement('list', props)
}

/** 列表条目；children 为 <ActionPanel>（可选） */
export function ListItem(props: ListItemProps): ReactNode {
  return createElement('list-item', props)
}

/** 分组（v1 宿主拍平渲染） */
export function ListSection(props: SectionProps): ReactNode {
  return createElement('section', props)
}

// JSX 命名空间：<List.Item> / <List.Section>
interface ListComponent {
  (props: ListProps): ReactNode
  Item: (props: ListItemProps) => ReactNode
  Section: (props: SectionProps) => ReactNode
}
export const ListX = List as ListComponent
List.Item = ListItem as ListComponent['Item']
List.Section = ListSection as ListComponent['Section']

// ─── Detail ───

export interface DetailProps {
  /** markdown 正文（v1 推荐） */
  markdown?: string
  /** 纯文本正文 */
  text?: string
  /** P-2.6：详情级动作面板（children 放 <ActionPanel>），宿主挂到占位条目上 */
  children?: ReactNode
}

/** 详情视图（单独作为 render 的元素时整页呈现） */
export function Detail(props: DetailProps): ReactNode {
  return createElement('detail', props)
}

// ─── ActionPanel / Action ───

export interface ActionPanelProps {
  children?: ReactNode
}

export interface ActionProps {
  /** 动作标签 */
  title: string
  /** copy=复制 payload；open=打开 payload；callback（默认）= 触发 onAction */
  type?: 'copy' | 'open' | 'callback'
  payload?: string
  /** 回调：宿主交互时经 Callback 钩子回传 */
  onAction?: (args?: unknown) => void
  /** 快捷键提示（展示用） */
  shortcut?: string
}

/** 动作面板：作为 <List.Item> 的 children 使用 */
export function ActionPanel(props: ActionPanelProps): ReactNode {
  return createElement('action-panel', props)
}

/** 单个动作；type 缺省 'callback'（onAction → 回调 id） */
export function Action(props: ActionProps): ReactNode {
  // 协议字段是 label（作者写 title，Raycast 习惯）
  return createElement('action', { ...props, label: props.title, type: props.type ?? 'callback' })
}

// ─── Form（#11 M2）───

export interface FormProps {
  children?: ReactNode
  /** 提交回调：值为 Record<字段id, string | boolean> */
  onSubmit?: (values: Record<string, string | boolean>) => void
  /** 提交按钮文案（缺省「提交」） */
  submitLabel?: string
  /** 表单标题（展示用） */
  title?: string
}

export interface FormFieldProps {
  /** 字段 id = 提交值里的键 */
  id: string
  label?: string
  placeholder?: string
  /** checkbox 为 boolean，其余为字符串初值 */
  initial?: string | boolean
}

export interface FormSelectProps extends FormFieldProps {
  options: string[]
}

/** 表单根组件：children 为字段组件（Form.TextField 等） */
export function Form(props: FormProps): ReactNode {
  return createElement('form', props)
}
Form.TextField = (props: FormFieldProps): ReactNode => createElement('text-field', props)
Form.TextArea = (props: FormFieldProps): ReactNode => createElement('textarea-field', props)
Form.Select = (props: FormSelectProps): ReactNode => createElement('select-field', props)
Form.Checkbox = (props: FormFieldProps): ReactNode => createElement('checkbox-field', props)
Form.DateField = (props: FormFieldProps): ReactNode => createElement('date-field', props)
Form.PasswordField = (props: FormFieldProps): ReactNode => createElement('password-field', props)

// ─── Navigation ───

interface NavState {
  push: (element: ReactNode) => void
  pop: () => void
  /** 回到根视图；已在根视图时等同 pop（即通知宿主关闭插件），与 Raycast 一致 */
  popToRoot: () => void
}

const NavigationContext = createContext<NavState | null>(null)

/** 视图导航：push 替换当前渲染的视图，pop 返回上一层 */
export function useNavigation(): NavState {
  const nav = useContext(NavigationContext)
  if (!nav) {
    // 未在 render() 包裹的上下文中调用（如测试环境）
    return { push: () => {}, pop: () => {}, popToRoot: () => {} }
  }
  return nav
}

/** 内部：导航根（render()/start() 自动包裹，管理视图栈并注入 context） */
export function NavigationRoot(props: { initial: ReactNode }): ReactNode {
  const [stack, setStack] = useState<ReactNode[]>([props.initial])
  // start() 以新 initial 重入 → 重置视图栈（否则 useState 忽略新 initial，
  // 第二次 start 被 React bail out——审查 M8）
  useEffect(() => {
    setStack([props.initial])
  }, [props.initial])
  const nav: NavState = useMemo(
    () => ({
      push: (element: ReactNode): void => setStack((s) => [...s, element]),
      pop: (): void =>
        setStack((s) => {
          if (s.length <= 1) {
            // 根视图 pop = 通知宿主关闭插件（Raycast pop 行为：回到启动器）
            ;(globalThis as { launcherApi?: { close?: () => void } }).launcherApi?.close?.()
            return s
          }
          return s.slice(0, -1)
        }),
      popToRoot: (): void =>
        setStack((s) => {
          if (s.length <= 1) {
            ;(globalThis as { launcherApi?: { close?: () => void } }).launcherApi?.close?.()
            return s
          }
          return [s[0]]
        })
    }),
    []
  )
  return createElement(NavigationContext.Provider, { value: nav }, stack[stack.length - 1])
}
