      const recordingApi = window.api.recording
      let removed = false
      try {
        // 用户已确认删除：连同视频/缩略图文件一并删除，否则文件永久残留磁盘
        const res = await recordingApi.remove({ id: target.id, deleteFile: true })
        removed = !!res?.ok
      } catch {
        removed = false
      }
      if (!removed) {
        removed = await window.api.recordingHistory.deleteHistory(target.id)
      }
