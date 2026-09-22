export const DEFAULT_FALLBACK_COMMANDS = [
  {
    id: "fallback:files",
    title: "搜索文件",
    subtitle: "在文件中查找「{query}」",
    icon: "folder-line",
    badge: "文件",
    action: { type: "searchFiles", query: "{query}" }
  },
  {
    id: "fallback:ai",
    title: "询问 AI",
    subtitle: "用 AI 回答「{query}」",
    icon: "sparkling-2-line",
    badge: "AI",
    action: { type: "firstParty", page: "ai", query: "{query}" }
  },
  {
    id: "fallback:dictionary",
    title: "词典查询",
    subtitle: "查询「{query}」的释义",
    icon: "book-2-line",
    badge: "工具",
    action: { type: "firstParty", page: "dictionary", query: "{query}" }
  },
  {
    id: "fallback:web",
    title: "网页搜索",
    subtitle: "在搜索引擎中查找「{query}」",
    icon: "global-line",
    badge: "网页",
    // 用 {encodedQuery}：搜索词含空格/& 时必须编码，否则会截断 URL 或注入额外查询参数
    action: { type: "openUrl", url: "https://www.google.com/search?q={encodedQuery}" }
  },
  {
    id: "fallback:clipboard",
    title: "剪贴板历史",
    subtitle: "在剪贴板历史中查找「{query}」",
    icon: "clipboard-line",
    badge: "剪贴板",
    action: { type: "firstParty", page: "clips", query: "{query}" }
  }
];
export function renderFallbackCommand(cmd, query) {
  const encoded = encodeURIComponent(query);
  const replace = (s) => s.replaceAll("{query}", query).replaceAll("{encodedQuery}", encoded);
  return {
    ...cmd,
    title: replace(cmd.title),
    subtitle: replace(cmd.subtitle),
    action: cmd.action.type === "openUrl" ? { ...cmd.action, url: replace(cmd.action.url) } : cmd.action.type === "searchFiles" ? { ...cmd.action, query: replace(cmd.action.query) } : cmd.action.type === "firstParty" ? { ...cmd.action, query: cmd.action.query ? replace(cmd.action.query) : void 0 } : cmd.action
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZhbGxiYWNrQ29tbWFuZHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMZWFmIMK3IEZhbGxiYWNrIENvbW1hbmRzIOWFnOW6leWRveS7pO+8iOWvueaghyBSYXljYXN0IEZhbGxiYWNrIENvbW1hbmRz77yJXG4gKlxuICog5b2T5qC55pCc57Si5peg5Yy56YWN57uT5p6c5pe277yM5pi+56S65LiA57uE5YWc5bqV5ZG95Luk77yM5bCGXCLml6Dnu5PmnpxcIui9rOWMluS4ulwi5paw5YWl5Y+jXCLjgIJcbiAqIOeUqOaIt+WPr+WcqOiuvue9ruS4reWQr+eUqC/npoHnlKjlkozmjpLluo/jgIJcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEZhbGxiYWNrQ29tbWFuZCB7XG4gIGlkOiBzdHJpbmdcbiAgdGl0bGU6IHN0cmluZ1xuICAvKiog5pSv5oyBIHtxdWVyeX0g5Y2g5L2N56ym77yM6L+Q6KGM5pe25pu/5o2i5Li65b2T5YmN5pCc57Si6K+NICovXG4gIHN1YnRpdGxlOiBzdHJpbmdcbiAgaWNvbjogc3RyaW5nXG4gIGJhZGdlPzogc3RyaW5nXG4gIC8qKiDmiafooYzliqjkvZznsbvlnosgKi9cbiAgYWN0aW9uOlxuICAgIHwgeyB0eXBlOiAnZmlyc3RQYXJ0eSc7IHBhZ2U6IHN0cmluZzsgcXVlcnk/OiBzdHJpbmcgfVxuICAgIHwgeyB0eXBlOiAnc2VhcmNoRmlsZXMnOyBxdWVyeTogc3RyaW5nIH1cbiAgICB8IHsgdHlwZTogJ29wZW5VcmwnOyB1cmw6IHN0cmluZyB9XG4gICAgfCB7IHR5cGU6ICdjb3B5VGV4dCc7IHRleHQ6IHN0cmluZyB9XG59XG5cbi8qKiDpu5jorqTlhZzlupXlkb3ku6TvvIjmjInmjqjojZDpobrluo/vvIkgKi9cbmV4cG9ydCBjb25zdCBERUZBVUxUX0ZBTExCQUNLX0NPTU1BTkRTOiBGYWxsYmFja0NvbW1hbmRbXSA9IFtcbiAge1xuICAgIGlkOiAnZmFsbGJhY2s6ZmlsZXMnLFxuICAgIHRpdGxlOiAn5pCc57Si5paH5Lu2JyxcbiAgICBzdWJ0aXRsZTogJ+WcqOaWh+S7tuS4reafpeaJvuOAjHtxdWVyeX3jgI0nLFxuICAgIGljb246ICdmb2xkZXItbGluZScsXG4gICAgYmFkZ2U6ICfmlofku7YnLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnc2VhcmNoRmlsZXMnLCBxdWVyeTogJ3txdWVyeX0nIH1cbiAgfSxcbiAge1xuICAgIGlkOiAnZmFsbGJhY2s6YWknLFxuICAgIHRpdGxlOiAn6K+i6ZeuIEFJJyxcbiAgICBzdWJ0aXRsZTogJ+eUqCBBSSDlm57nrZTjgIx7cXVlcnl944CNJyxcbiAgICBpY29uOiAnc3BhcmtsaW5nLTItbGluZScsXG4gICAgYmFkZ2U6ICdBSScsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2FpJywgcXVlcnk6ICd7cXVlcnl9JyB9XG4gIH0sXG4gIHtcbiAgICBpZDogJ2ZhbGxiYWNrOmRpY3Rpb25hcnknLFxuICAgIHRpdGxlOiAn6K+N5YW45p+l6K+iJyxcbiAgICBzdWJ0aXRsZTogJ+afpeivouOAjHtxdWVyeX3jgI3nmoTph4rkuYknLFxuICAgIGljb246ICdib29rLTItbGluZScsXG4gICAgYmFkZ2U6ICflt6XlhbcnLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdkaWN0aW9uYXJ5JywgcXVlcnk6ICd7cXVlcnl9JyB9XG4gIH0sXG4gIHtcbiAgICBpZDogJ2ZhbGxiYWNrOndlYicsXG4gICAgdGl0bGU6ICfnvZHpobXmkJzntKInLFxuICAgIHN1YnRpdGxlOiAn5Zyo5pCc57Si5byV5pOO5Lit5p+l5om+44CMe3F1ZXJ5feOAjScsXG4gICAgaWNvbjogJ2dsb2JhbC1saW5lJyxcbiAgICBiYWRnZTogJ+e9kemhtScsXG4gICAgLy8g55SoIHtlbmNvZGVkUXVlcnl977ya5pCc57Si6K+N5ZCr56m65qC8LyYg5pe25b+F6aG757yW56CB77yM5ZCm5YiZ5Lya5oiq5patIFVSTCDmiJbms6jlhaXpop3lpJbmn6Xor6Llj4LmlbBcbiAgICBhY3Rpb246IHsgdHlwZTogJ29wZW5VcmwnLCB1cmw6ICdodHRwczovL3d3dy5nb29nbGUuY29tL3NlYXJjaD9xPXtlbmNvZGVkUXVlcnl9JyB9XG4gIH0sXG4gIHtcbiAgICBpZDogJ2ZhbGxiYWNrOmNsaXBib2FyZCcsXG4gICAgdGl0bGU6ICfliarotLTmnb/ljoblj7InLFxuICAgIHN1YnRpdGxlOiAn5Zyo5Ymq6LS05p2/5Y6G5Y+y5Lit5p+l5om+44CMe3F1ZXJ5feOAjScsXG4gICAgaWNvbjogJ2NsaXBib2FyZC1saW5lJyxcbiAgICBiYWRnZTogJ+WJqui0tOadvycsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2NsaXBzJywgcXVlcnk6ICd7cXVlcnl9JyB9XG4gIH1cbl1cblxuLyoqIOa4suafk+aXtuabv+aNoiB7cXVlcnl9IOWNoOS9jeespiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZhbGxiYWNrQ29tbWFuZChjbWQ6IEZhbGxiYWNrQ29tbWFuZCwgcXVlcnk6IHN0cmluZyk6IEZhbGxiYWNrQ29tbWFuZCB7XG4gIGNvbnN0IGVuY29kZWQgPSBlbmNvZGVVUklDb21wb25lbnQocXVlcnkpXG4gIGNvbnN0IHJlcGxhY2UgPSAoczogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgcy5yZXBsYWNlQWxsKCd7cXVlcnl9JywgcXVlcnkpLnJlcGxhY2VBbGwoJ3tlbmNvZGVkUXVlcnl9JywgZW5jb2RlZClcbiAgcmV0dXJuIHtcbiAgICAuLi5jbWQsXG4gICAgdGl0bGU6IHJlcGxhY2UoY21kLnRpdGxlKSxcbiAgICBzdWJ0aXRsZTogcmVwbGFjZShjbWQuc3VidGl0bGUpLFxuICAgIGFjdGlvbjpcbiAgICAgIGNtZC5hY3Rpb24udHlwZSA9PT0gJ29wZW5VcmwnXG4gICAgICAgID8geyAuLi5jbWQuYWN0aW9uLCB1cmw6IHJlcGxhY2UoY21kLmFjdGlvbi51cmwpIH1cbiAgICAgICAgOiBjbWQuYWN0aW9uLnR5cGUgPT09ICdzZWFyY2hGaWxlcydcbiAgICAgICAgICA/IHsgLi4uY21kLmFjdGlvbiwgcXVlcnk6IHJlcGxhY2UoY21kLmFjdGlvbi5xdWVyeSkgfVxuICAgICAgICAgIDogY21kLmFjdGlvbi50eXBlID09PSAnZmlyc3RQYXJ0eSdcbiAgICAgICAgICAgID8geyAuLi5jbWQuYWN0aW9uLCBxdWVyeTogY21kLmFjdGlvbi5xdWVyeSA/IHJlcGxhY2UoY21kLmFjdGlvbi5xdWVyeSkgOiB1bmRlZmluZWQgfVxuICAgICAgICAgICAgOiBjbWQuYWN0aW9uXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBdUJPLGFBQU0sNEJBQStDO0FBQUEsRUFDMUQ7QUFBQSxJQUNFLElBQUk7QUFBQSxJQUNKLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFFBQVEsRUFBRSxNQUFNLGVBQWUsT0FBTyxVQUFVO0FBQUEsRUFDbEQ7QUFBQSxFQUNBO0FBQUEsSUFDRSxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxjQUFjLE1BQU0sTUFBTSxPQUFPLFVBQVU7QUFBQSxFQUM3RDtBQUFBLEVBQ0E7QUFBQSxJQUNFLElBQUk7QUFBQSxJQUNKLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFFBQVEsRUFBRSxNQUFNLGNBQWMsTUFBTSxjQUFjLE9BQU8sVUFBVTtBQUFBLEVBQ3JFO0FBQUEsRUFDQTtBQUFBLElBQ0UsSUFBSTtBQUFBLElBQ0osT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsSUFFUCxRQUFRLEVBQUUsTUFBTSxXQUFXLEtBQUssaURBQWlEO0FBQUEsRUFDbkY7QUFBQSxFQUNBO0FBQUEsSUFDRSxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxjQUFjLE1BQU0sU0FBUyxPQUFPLFVBQVU7QUFBQSxFQUNoRTtBQUNGO0FBR08sZ0JBQVMsc0JBQXNCLEtBQXNCLE9BQWdDO0FBQzFGLFFBQU0sVUFBVSxtQkFBbUIsS0FBSztBQUN4QyxRQUFNLFVBQVUsQ0FBQyxNQUNmLEVBQUUsV0FBVyxXQUFXLEtBQUssRUFBRSxXQUFXLGtCQUFrQixPQUFPO0FBQ3JFLFNBQU87QUFBQSxJQUNMLEdBQUc7QUFBQSxJQUNILE9BQU8sUUFBUSxJQUFJLEtBQUs7QUFBQSxJQUN4QixVQUFVLFFBQVEsSUFBSSxRQUFRO0FBQUEsSUFDOUIsUUFDRSxJQUFJLE9BQU8sU0FBUyxZQUNoQixFQUFFLEdBQUcsSUFBSSxRQUFRLEtBQUssUUFBUSxJQUFJLE9BQU8sR0FBRyxFQUFFLElBQzlDLElBQUksT0FBTyxTQUFTLGdCQUNsQixFQUFFLEdBQUcsSUFBSSxRQUFRLE9BQU8sUUFBUSxJQUFJLE9BQU8sS0FBSyxFQUFFLElBQ2xELElBQUksT0FBTyxTQUFTLGVBQ2xCLEVBQUUsR0FBRyxJQUFJLFFBQVEsT0FBTyxJQUFJLE9BQU8sUUFBUSxRQUFRLElBQUksT0FBTyxLQUFLLElBQUksT0FBVSxJQUNqRixJQUFJO0FBQUEsRUFDaEI7QUFDRjsiLCJuYW1lcyI6W119