    }
  })
}

/** 激活指定标签（切换到对应窗口并选中标签） */
async function activateTab(tab: BrowserTab): Promise<boolean> {
  // 注入防御：windowId/tabIndex 来自 IPC（渲染端可能被攻陷），必须数值化为正整数
  // 后才允许进入 AppleScript 字符串（审查 C1；对照 WindowSwitcherService 同款范式）
  const wid = Number(tab.windowId)
  const tid = Number(tab.tabIndex)
  if (!Number.isInteger(wid) || wid <= 0 || !Number.isInteger(tid) || tid <= 0) {
    return false
  }
  const script =
    tab.browser === 'chrome'
      ? `
    tell application "Google Chrome"
      activate
      set index of window ${wid} to 1
      set active tab index of window ${wid} to ${tid}
    end tell
  `
      : `
    tell application "Safari"
      activate
      set index of window ${wid} to 1
      set current tab of window ${wid} to tab ${tid} of window ${wid}
    end tell
  `
  try {
    await runAppleScript(script)
    return true
  } catch {
    return false
  }
}

/**
 * 列出 Chrome / Safari 全部标签（供主进程内部调用，B4 Quicklinks 复用已有标签页）。
