export interface LanguageOption {
  name: string
  value: string
  /** TextMate 语法 JSON（结构由 codemirror-textmate 的 IRawGrammarSource 消费） */
  grammar?: () => Promise<{ default: unknown }>
  scopeName?: string
}

// 常用语言的 TextMate 语法映射
export const languages: LanguageOption[] = [
  {
    name: 'JavaScript',
    value: 'javascript',
    grammar: () => import('./textmate/javascript.tmLanguage.json'),
    scopeName: 'source.js'
  },
  {
    name: 'TypeScript',
    value: 'typescript',
    grammar: () => import('./textmate/typescript.tmLanguage.json'),
    scopeName: 'source.ts'
  },
  {
    name: 'Python',
    value: 'python',
    grammar: () => import('./textmate/python.tmLanguage.json'),
    scopeName: 'source.python'
  },
  {
    name: 'HTML',
    value: 'html',
    grammar: () => import('./textmate/html.tmLanguage.json'),
    scopeName: 'text.html.basic'
  },
  {
    name: 'CSS',
    value: 'css',
    grammar: () => import('./textmate/css.tmLanguage.json'),
    scopeName: 'source.css'
  },
  {
    name: 'JSON',
    value: 'json',
    grammar: () => import('./textmate/json.tmLanguage.json'),
    scopeName: 'source.json'
  },
  {
    name: 'Markdown',
    value: 'markdown',
    grammar: () => import('./textmate/markdown.tmLanguage.json'),
    scopeName: 'text.html.markdown'
  },
  {
    name: 'YAML',
    value: 'yaml',
    grammar: () => import('./textmate/yaml.tmLanguage.json'),
    scopeName: 'source.yaml'
  },
  {
    name: 'Shell',
    value: 'sh',
    grammar: () => import('./textmate/shell-unix-bash.tmLanguage.json'),
    scopeName: 'source.shell'
  },
  {
    name: 'SQL',
    value: 'sql',
    grammar: () => import('./textmate/sql.tmLanguage.json'),
    scopeName: 'source.sql'
  }
]
