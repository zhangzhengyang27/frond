    // 输出格式：button returned:确定, text returned:用户输入\n
    const match = stdout.match(/text returned:(.*)/)
    if (match) {
      // 只去掉末尾换行，保留用户输入的首尾空格
      return match[1].replace(/\n$/, '')
    }
    return ''
  } catch {
    // 用户取消时 osascript 返回非零退出码（error -128）
    return null
  }
}
