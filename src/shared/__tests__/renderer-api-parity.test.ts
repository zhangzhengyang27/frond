    let matchCount = 0

    for (const file of files) {
      const rel = file.slice(repoRoot.length + 1)
      const src = readFileSync(file, 'utf-8')
      const code = src
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !(t.startsWith('//') || t.startsWith('*'))
        })
        .join('\n')
      // 捕获 window.api 后的属性链（含单段：window.api.getApplications 等顶层方法）
      for (const m of code.matchAll(/window\.api\??\.(\w+(?:\.\w+)*)/g)) {
        matchCount++
        const chain = m[1]
        // 命中规则：完整链或其任意前缀在暴露面中（前缀用于「先取子对象再调方法」写法）
        const segs = chain.split('.')
        const ok = segs.some((_, i) => exposed.has(segs.slice(0, i + 1).join('.')))
        if (!ok) offenders.push(`${rel}: window.api.${chain} 不在 preload 暴露面中`)
      }
    }

    // 体量哨兵：防止扫描退化成空转（如 renderer 改为解构/别名访问导致 0 匹配时假绿）。
    // 当前基线约 420 处调用（含 43 处单段链）；显著低于基线说明扫描器或访问模式变了，需人工复核
    expect(matchCount).toBeGreaterThan(300)

    expect(offenders, `发现 ${offenders.length} 处幽灵 API 调用:\n${offenders.join('\n')}`).toEqual(
      []
    )
  })
})
