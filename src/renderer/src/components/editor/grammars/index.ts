import { activateLanguage, addGrammar } from 'codemirror-textmate'
import { languages } from './languages'

export interface GrammarOption {
  grammar: () => Promise<{ default: unknown }>
  language: string
  priority: 'asap' | 'now' | 'defer'
}

export async function loadGrammars(): Promise<void> {
  const grammars: Record<string, GrammarOption> = {}

  languages
    .filter((i) => i.grammar)
    .forEach((i) => {
      if (!i.scopeName || !i.grammar) return

      grammars[i.scopeName] = {
        grammar: i.grammar,
        language: i.value,
        priority: 'defer'
      }
    })

  await Promise.all(
    Object.keys(grammars).map(async (scopeName) => {
      const { grammar, language, priority } = grammars[scopeName]
      const { default: grammarDoc } = await grammar()

      try {
        // JSON 动态导入的 default 类型在编译期未知，实际是 TextMate 语法 JSON
        addGrammar(scopeName, grammarDoc as Parameters<typeof addGrammar>[1])
        if (language) {
          const prom = activateLanguage(scopeName, language, priority)

          if (priority === 'now') {
            await prom
          }
        }
      } catch (err) {
        console.error('Failed to load grammar:', scopeName, err)
      }
    })
  )
}
