// dropdownPlacement.ts · UDropdown 视口边界翻转（纯函数，便于单测）
export interface RectLike {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface Placement {
  side: 'bottom' | 'top'
  align: 'start' | 'end'
}

export function computePlacement(
  trigger: RectLike,
  panel: RectLike,
  viewportW: number,
  viewportH: number,
  preferred: Placement
): Placement {
  let side = preferred.side
  const spaceBelow = viewportH - trigger.bottom
  const spaceAbove = trigger.top
  if (side === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) side = 'top'
  else if (side === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) side = 'bottom'

  let align = preferred.align
  if (align === 'start' && trigger.left + panel.width > viewportW) align = 'end'
  else if (align === 'end' && trigger.right - panel.width < 0) align = 'start'

  return { side, align }
}
