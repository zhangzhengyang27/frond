        body = message || '番茄钟已暂停'
        defaultSound = false
        defaultTimeout = 3000
        break
    }

    // options 展开放在最前：渲染端若显式传 { timeout: undefined }，
    // 也不能把下面算好的默认值覆盖成 undefined（否则通知挂 30 分钟兜底才清理）
    return this.show(NotificationType.POMODORO, title, body, {
      ...options,
      sound: options?.sound ?? defaultSound,
      timeout: options?.timeout ?? defaultTimeout
    })
  }

  /**
   * 显示屏幕录制通知
   */
