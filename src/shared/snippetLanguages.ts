/**
 * 片段语言清单——编辑器语言下拉与文件夹「默认语言」选择共用一份，
 * 两处口径漂移会让文件夹继承出编辑器不认识的语言。
 * 与 Editor getLanguageMode 支持的 CodeMirror 模式保持一致。
 */
export interface SnippetLanguageOption {
  value: string
  label: string
}

export const SNIPPET_LANGUAGES: SnippetLanguageOption[] = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'yaml', label: 'YAML' }
]
