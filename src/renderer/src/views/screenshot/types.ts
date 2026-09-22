export interface Point {
  x: number
  y: number
}

export type Position = Point

export enum HistoryItemType {
  Edit,
  Source
}

export interface HistoryItemEdit<E, S> {
  type: HistoryItemType.Edit
  data: E
  source: HistoryItemSource<S, E>
}

export interface HistoryItemSource<S, E> {
  name: string
  type: HistoryItemType.Source
  data: S
  isSelected?: boolean
  editHistory: HistoryItemEdit<E, S>[]
  draw: (ctx: CanvasRenderingContext2D, action: HistoryItemSource<S, E>) => void
  isHit?: (ctx: CanvasRenderingContext2D, action: HistoryItemSource<S, E>, point: Point) => boolean
}

export type HistoryItem<S, E> = HistoryItemEdit<E, S> | HistoryItemSource<S, E>

export interface History {
  index: number
  // 泛型占位 S / E 在具体 drawing op 里实例化，any 用于「通配 history」
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack: HistoryItem<any, any>[]
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export type EmiterListener = (
  // event bus callback 接受任意参数；约束 unknown 反而限制使用
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any
) => unknown

export type Emiter = Record<string, EmiterListener[]>

export interface Lang {
  magnifier_position_label: string
  operation_ok_title: string
  operation_cancel_title: string
  operation_save_title: string
  operation_redo_title: string
  operation_undo_title: string
  operation_mosaic_title: string
  operation_text_title: string
  operation_brush_title: string
  operation_arrow_title: string
  operation_ellipse_title: string
  operation_rectangle_title: string
}

export const zhCN: Lang = {
  magnifier_position_label: '坐标',
  operation_ok_title: '确定',
  operation_cancel_title: '取消',
  operation_save_title: '保存',
  operation_redo_title: '重做',
  operation_undo_title: '撤销',
  operation_mosaic_title: '马赛克',
  operation_text_title: '文本',
  operation_brush_title: '画笔',
  operation_arrow_title: '箭头',
  operation_ellipse_title: '椭圆',
  operation_rectangle_title: '矩形'
}
