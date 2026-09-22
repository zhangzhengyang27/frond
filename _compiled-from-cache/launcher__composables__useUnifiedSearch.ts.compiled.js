import { ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { evaluateExpression } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/calculator.ts";
import { convertUnit } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/unitConverter.ts";
import { searchEmoji } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/emoji.ts";
import { searchEntries } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/search.ts?t=1789709850689";
async function searchFilesAsEntries(q) {
  try {
    const resp = await window.api.fileSearch.query(q, 5, { mode: "name" });
    const hits = resp?.items ?? [];
    return hits.map((h) => ({
      entry: {
        key: `file:${h.path}`,
        icon: "file-3-line",
        title: h.name,
        subtitle: h.dir || h.path,
        badge: "文件",
        action: { type: "file", path: h.path, name: h.name }
      },
      highlight: null,
      score: 50
    }));
  } catch {
    return [];
  }
}
async function searchClipboardAsEntries(q) {
  try {
    const items = await window.api.clipHist.list();
    const lower = q.toLowerCase();
    const matched = items.filter((item) => {
      if (item.kind === "text" || item.kind === "link")
        return item.text?.toLowerCase().includes(lower);
      if (item.kind === "files") return item.paths?.some((p) => p.toLowerCase().includes(lower));
      return false;
    }).slice(0, 3);
    return matched.map((item) => ({
      entry: {
        key: `clip:${item.id}`,
        icon: item.kind === "image" ? "image-line" : "clipboard-line",
        title: item.kind === "files" ? item.paths?.[0]?.split("/").pop() ?? "文件" : (item.text ?? "").slice(0, 60),
        subtitle: item.kind === "link" ? "链接" : "剪贴板",
        badge: "剪贴板",
        action: { type: "clipboardItem", id: item.id }
      },
      highlight: null,
      score: 40
    }));
  } catch {
    return [];
  }
}
async function searchSnippetsAsEntries(q) {
  try {
    const snips = await window.api.snippet.getSnippets({ search: q });
    return snips.slice(0, 3).map((s) => ({
      entry: {
        key: `snip:${s.id}`,
        icon: "file-code-line",
        title: s.title ?? "未命名片段",
        subtitle: s.language ?? "片段",
        badge: "片段",
        action: { type: "snippetItem", id: s.id }
      },
      highlight: null,
      score: 45
    }));
  } catch {
    return [];
  }
}
export function useUnifiedSearch(options) {
  const results = ref([]);
  let unifiedSearchToken = 0;
  let unifiedSearchTimer = null;
  async function runUnifiedSearch(q) {
    const token = ++unifiedSearchToken;
    const trimmed = q.trim();
    if (!trimmed) {
      results.value = options.suggestions.value;
      return;
    }
    const cmdRows = searchEntries(options.entries(), trimmed, 8, options.usageBoost);
    const calc = evaluateExpression(trimmed);
    if (calc) {
      cmdRows.unshift({
        entry: {
          key: "calc:result",
          icon: "function-line",
          title: `= ${calc.formatted}`,
          subtitle: calc.expr,
          badge: "计算",
          action: { type: "copyText", text: calc.formatted }
        },
        highlight: null,
        score: Number.MAX_SAFE_INTEGER
      });
    }
    const conv = convertUnit(trimmed);
    if (conv) {
      const subtitleSuffix = conv.rateDate ? `（汇率基准 ${conv.rateDate}）` : "";
      cmdRows.unshift({
        entry: {
          key: "unit:result",
          icon: "exchange-line",
          title: conv.formatted,
          subtitle: `${conv.fromValue} ${conv.fromUnit} → ${conv.toUnit}${subtitleSuffix}`,
          badge: conv.category,
          action: { type: "copyText", text: String(conv.toValue) }
        },
        highlight: null,
        score: Number.MAX_SAFE_INTEGER
      });
    }
    if (trimmed.length >= 2) {
      const emojis = searchEmoji(trimmed, 3);
      for (const emoji of emojis) {
        cmdRows.push({
          entry: {
            key: `emoji:${emoji.emoji}`,
            icon: "emotion-line",
            title: `${emoji.emoji}  ${emoji.name}`,
            subtitle: emoji.keywords.join(" · "),
            badge: "Emoji",
            action: { type: "copyText", text: emoji.emoji }
          },
          highlight: null,
          score: 50
        });
      }
    }
    results.value = cmdRows;
    const [fileRows, clipRows, snipRows] = await Promise.all([
      searchFilesAsEntries(trimmed),
      searchClipboardAsEntries(trimmed),
      searchSnippetsAsEntries(trimmed)
    ]);
    if (token !== unifiedSearchToken) return;
    results.value = [...cmdRows, ...fileRows, ...clipRows, ...snipRows].slice(0, 20);
  }
  function scheduleForQuery(q) {
    if (unifiedSearchTimer) clearTimeout(unifiedSearchTimer);
    if (!q.trim()) {
      results.value = options.suggestions.value;
      return;
    }
    unifiedSearchTimer = setTimeout(() => void runUnifiedSearch(q), 150);
  }
  function resetToSuggestions() {
    results.value = options.suggestions.value;
  }
  return { results, runUnifiedSearch, scheduleForQuery, resetToSuggestions };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZVVuaWZpZWRTZWFyY2gudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMZWFmIMK3IFAwLTEg57uf5LiA5re35ZCI5pCc57Si77yI6IeqIExhdW5jaGVyQXBwLnZ1ZSDmir3lh7rvvIlcbiAqXG4gKiDmoLnmkJzntKLogZrlkIjvvJrlkb3ku6Qv5bqU55So77yI5ZCM5q2l77yMc2VhcmNoRW50cmllc++8iSsg6K6h566X5ZmoIC8g5Y2V5L2N5o2i566XIC8gRW1vamlcbiAqIO+8iOWQjOatpe+8iSsg5paH5Lu2IC8g5Ymq6LS05p2/IC8g54mH5q6177yI5byC5q2l5aKe6YeP5ZCI5bm277yJ44CCXG4gKiByZXN1bHRzIOeUqCByZWbvvJrlkIzmraXlkb3kuK3nq4vljbPlj6/op4HvvIzmhaLpgJ8gSU8g5Yiw6L6+5ZCO5aKe6YeP5ZCI5bm277yIdG9rZW4g6Ziy6L+H5pyf5Zue5YaZ77yJ44CCXG4gKi9cbmltcG9ydCB7IHJlZiwgdHlwZSBSZWYgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyBldmFsdWF0ZUV4cHJlc3Npb24gfSBmcm9tICdAc2hhcmVkL2NhbGN1bGF0b3InXG5pbXBvcnQgeyBjb252ZXJ0VW5pdCB9IGZyb20gJ0BzaGFyZWQvdW5pdENvbnZlcnRlcidcbmltcG9ydCB7IHNlYXJjaEVtb2ppIH0gZnJvbSAnQHNoYXJlZC9lbW9qaSdcbmltcG9ydCB0eXBlIHsgQ29tbWFuZEVudHJ5IH0gZnJvbSAnQHNoYXJlZC9jb21tYW5kcydcbmltcG9ydCB7IG5vcm1hbGl6ZVdpdGhNYXAsIHNlYXJjaEVudHJpZXMsIHR5cGUgU2NvcmVkRW50cnkgfSBmcm9tICdAc2hhcmVkL3NlYXJjaCdcbmltcG9ydCB0eXBlIHsgdXNlVXNhZ2VCb29zdCB9IGZyb20gJ0ByZW5kZXJlci9jb21wb3NhYmxlcy91c2VVc2FnZUJvb3N0J1xuXG50eXBlIFVzYWdlQm9vc3QgPSBSZXR1cm5UeXBlPHR5cGVvZiB1c2VVc2FnZUJvb3N0PlsnYm9vc3QnXVxuXG4vKiog5paH5Lu25pCc57SiIOKGkiBDb21tYW5kRW50cnnvvIjmnIDlpJogNSDmnaHvvIzpgb/lhY3mt7nmsqHlkb3ku6Tnu5PmnpzvvIkgKi9cbmFzeW5jIGZ1bmN0aW9uIHNlYXJjaEZpbGVzQXNFbnRyaWVzKHE6IHN0cmluZyk6IFByb21pc2U8U2NvcmVkRW50cnlbXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSAoYXdhaXQgd2luZG93LmFwaS5maWxlU2VhcmNoLnF1ZXJ5KHEsIDUsIHsgbW9kZTogJ25hbWUnIH0pKSBhcyB7XG4gICAgICBvaz86IGJvb2xlYW5cbiAgICAgIGl0ZW1zPzogQXJyYXk8eyBwYXRoOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgZGlyPzogc3RyaW5nIH0+XG4gICAgfVxuICAgIGNvbnN0IGhpdHMgPSByZXNwPy5pdGVtcyA/PyBbXVxuICAgIHJldHVybiBoaXRzLm1hcCgoaCkgPT4gKHtcbiAgICAgIGVudHJ5OiB7XG4gICAgICAgIGtleTogYGZpbGU6JHtoLnBhdGh9YCxcbiAgICAgICAgaWNvbjogJ2ZpbGUtMy1saW5lJyxcbiAgICAgICAgdGl0bGU6IGgubmFtZSxcbiAgICAgICAgc3VidGl0bGU6IGguZGlyIHx8IGgucGF0aCxcbiAgICAgICAgYmFkZ2U6ICfmlofku7YnLFxuICAgICAgICBhY3Rpb246IHsgdHlwZTogJ2ZpbGUnLCBwYXRoOiBoLnBhdGgsIG5hbWU6IGgubmFtZSB9XG4gICAgICB9LFxuICAgICAgaGlnaGxpZ2h0OiBudWxsLFxuICAgICAgc2NvcmU6IDUwXG4gICAgfSkpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBbXVxuICB9XG59XG5cbi8qKiDliarotLTmnb/ljoblj7Ig4oaSIENvbW1hbmRFbnRyee+8iOacgOWkmiAzIOadoe+8iSAqL1xuYXN5bmMgZnVuY3Rpb24gc2VhcmNoQ2xpcGJvYXJkQXNFbnRyaWVzKHE6IHN0cmluZyk6IFByb21pc2U8U2NvcmVkRW50cnlbXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGl0ZW1zID0gKGF3YWl0IHdpbmRvdy5hcGkuY2xpcEhpc3QubGlzdCgpKSBhcyBBcnJheTx7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICBraW5kOiAndGV4dCcgfCAnaW1hZ2UnIHwgJ2ZpbGVzJyB8ICdsaW5rJ1xuICAgICAgdGV4dD86IHN0cmluZ1xuICAgICAgcGF0aHM/OiBzdHJpbmdbXVxuICAgIH0+XG4gICAgY29uc3QgbG93ZXIgPSBxLnRvTG93ZXJDYXNlKClcbiAgICBjb25zdCBtYXRjaGVkID0gaXRlbXNcbiAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgaWYgKGl0ZW0ua2luZCA9PT0gJ3RleHQnIHx8IGl0ZW0ua2luZCA9PT0gJ2xpbmsnKVxuICAgICAgICAgIHJldHVybiBpdGVtLnRleHQ/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG4gICAgICAgIGlmIChpdGVtLmtpbmQgPT09ICdmaWxlcycpIHJldHVybiBpdGVtLnBhdGhzPy5zb21lKChwKSA9PiBwLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH0pXG4gICAgICAuc2xpY2UoMCwgMylcbiAgICByZXR1cm4gbWF0Y2hlZC5tYXAoKGl0ZW0pID0+ICh7XG4gICAgICBlbnRyeToge1xuICAgICAgICBrZXk6IGBjbGlwOiR7aXRlbS5pZH1gLFxuICAgICAgICBpY29uOiBpdGVtLmtpbmQgPT09ICdpbWFnZScgPyAnaW1hZ2UtbGluZScgOiAnY2xpcGJvYXJkLWxpbmUnLFxuICAgICAgICB0aXRsZTpcbiAgICAgICAgICBpdGVtLmtpbmQgPT09ICdmaWxlcydcbiAgICAgICAgICAgID8gKGl0ZW0ucGF0aHM/LlswXT8uc3BsaXQoJy8nKS5wb3AoKSA/PyAn5paH5Lu2JylcbiAgICAgICAgICAgIDogKGl0ZW0udGV4dCA/PyAnJykuc2xpY2UoMCwgNjApLFxuICAgICAgICBzdWJ0aXRsZTogaXRlbS5raW5kID09PSAnbGluaycgPyAn6ZO+5o6lJyA6ICfliarotLTmnb8nLFxuICAgICAgICBiYWRnZTogJ+WJqui0tOadvycsXG4gICAgICAgIGFjdGlvbjogeyB0eXBlOiAnY2xpcGJvYXJkSXRlbScsIGlkOiBpdGVtLmlkIH1cbiAgICAgIH0sXG4gICAgICBoaWdobGlnaHQ6IG51bGwsXG4gICAgICBzY29yZTogNDBcbiAgICB9KSlcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdXG4gIH1cbn1cblxuLyoqIOS7o+eggeeJh+autSDihpIgQ29tbWFuZEVudHJ577yI5pyA5aSaIDMg5p2h77yJICovXG5hc3luYyBmdW5jdGlvbiBzZWFyY2hTbmlwcGV0c0FzRW50cmllcyhxOiBzdHJpbmcpOiBQcm9taXNlPFNjb3JlZEVudHJ5W10+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzbmlwcyA9IChhd2FpdCB3aW5kb3cuYXBpLnNuaXBwZXQuZ2V0U25pcHBldHMoeyBzZWFyY2g6IHEgfSkpIGFzIEFycmF5PHtcbiAgICAgIGlkOiBzdHJpbmdcbiAgICAgIHRpdGxlPzogc3RyaW5nXG4gICAgICBjb250ZW50PzogeyB0ZXh0Pzogc3RyaW5nIH0gfCBzdHJpbmdcbiAgICAgIGxhbmd1YWdlPzogc3RyaW5nXG4gICAgfT5cbiAgICByZXR1cm4gc25pcHMuc2xpY2UoMCwgMykubWFwKChzKSA9PiAoe1xuICAgICAgZW50cnk6IHtcbiAgICAgICAga2V5OiBgc25pcDoke3MuaWR9YCxcbiAgICAgICAgaWNvbjogJ2ZpbGUtY29kZS1saW5lJyxcbiAgICAgICAgdGl0bGU6IHMudGl0bGUgPz8gJ+acquWRveWQjeeJh+autScsXG4gICAgICAgIHN1YnRpdGxlOiBzLmxhbmd1YWdlID8/ICfniYfmrrUnLFxuICAgICAgICBiYWRnZTogJ+eJh+autScsXG4gICAgICAgIGFjdGlvbjogeyB0eXBlOiAnc25pcHBldEl0ZW0nLCBpZDogcy5pZCB9XG4gICAgICB9LFxuICAgICAgaGlnaGxpZ2h0OiBudWxsLFxuICAgICAgc2NvcmU6IDQ1XG4gICAgfSkpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBbXVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VVbmlmaWVkU2VhcmNoKG9wdGlvbnM6IHtcbiAgLyoqIOiBmuWQiOWQjueahOWRveS7pOadoeebru+8iOWQq+WIq+WQje+8jOmajyBhbGlhc0Vwb2NoIOmHjeeul++8iSAqL1xuICBlbnRyaWVzOiAoKSA9PiBDb21tYW5kRW50cnlbXVxuICAvKiog5L2/55So57uf6K6h5o6S5bqP77yI6aKR5qyhIMOXIOaWsOi/kea3t+WQiOWKoOadg++8iSAqL1xuICB1c2FnZUJvb3N0OiBVc2FnZUJvb3N0XG4gIC8qKiDnqbrmn6Xor6LmgIHlsZXnpLrnmoTlu7rorq7liJfooaggKi9cbiAgc3VnZ2VzdGlvbnM6IFJlZjxTY29yZWRFbnRyeVtdPlxufSkge1xuICBjb25zdCByZXN1bHRzID0gcmVmPFNjb3JlZEVudHJ5W10+KFtdKVxuICBsZXQgdW5pZmllZFNlYXJjaFRva2VuID0gMFxuICBsZXQgdW5pZmllZFNlYXJjaFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsXG5cbiAgLyoqIOe7n+S4gOa3t+WQiOaQnOe0ouWFpeWPo++8muWRveS7pC/lupTnlKjlkIzmraUgKyDmlofku7Yv5Ymq6LS05p2/L+eJh+autSDlvILmraUgKi9cbiAgYXN5bmMgZnVuY3Rpb24gcnVuVW5pZmllZFNlYXJjaChxOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB0b2tlbiA9ICsrdW5pZmllZFNlYXJjaFRva2VuXG4gICAgY29uc3QgdHJpbW1lZCA9IHEudHJpbSgpXG4gICAgaWYgKCF0cmltbWVkKSB7XG4gICAgICByZXN1bHRzLnZhbHVlID0gb3B0aW9ucy5zdWdnZXN0aW9ucy52YWx1ZVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIOWQjOatpe+8muWRveS7pCArIOW6lOeUqO+8iOW3suaciSBzZWFyY2hFbnRyaWVz77yJXG4gICAgY29uc3QgY21kUm93cyA9IHNlYXJjaEVudHJpZXMob3B0aW9ucy5lbnRyaWVzKCksIHRyaW1tZWQsIDgsIG9wdGlvbnMudXNhZ2VCb29zdClcbiAgICBjb25zdCBjYWxjID0gZXZhbHVhdGVFeHByZXNzaW9uKHRyaW1tZWQpXG4gICAgaWYgKGNhbGMpIHtcbiAgICAgIGNtZFJvd3MudW5zaGlmdCh7XG4gICAgICAgIGVudHJ5OiB7XG4gICAgICAgICAga2V5OiAnY2FsYzpyZXN1bHQnLFxuICAgICAgICAgIGljb246ICdmdW5jdGlvbi1saW5lJyxcbiAgICAgICAgICB0aXRsZTogYD0gJHtjYWxjLmZvcm1hdHRlZH1gLFxuICAgICAgICAgIHN1YnRpdGxlOiBjYWxjLmV4cHIsXG4gICAgICAgICAgYmFkZ2U6ICforqHnrpcnLFxuICAgICAgICAgIGFjdGlvbjogeyB0eXBlOiAnY29weVRleHQnLCB0ZXh0OiBjYWxjLmZvcm1hdHRlZCB9XG4gICAgICAgIH0sXG4gICAgICAgIGhpZ2hsaWdodDogbnVsbCxcbiAgICAgICAgc2NvcmU6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSXG4gICAgICB9KVxuICAgIH1cbiAgICAvLyDljZXkvY3mjaLnrpfvvIgxMGtnIHRvIGxiIC8gMTAwdXNkIHRvIGNueSAvIDM3YyB0byBm77yJXG4gICAgY29uc3QgY29udiA9IGNvbnZlcnRVbml0KHRyaW1tZWQpXG4gICAgaWYgKGNvbnYpIHtcbiAgICAgIC8vIOi0p+W4geaNoueul+agh+azqOaxh+eOh+WfuuWHhuaXpeacn++8iOmdmeaAgeaxh+eOh++8jOmdnuWunuaXtu+8iVxuICAgICAgY29uc3Qgc3VidGl0bGVTdWZmaXggPSBjb252LnJhdGVEYXRlID8gYO+8iOaxh+eOh+WfuuWHhiAke2NvbnYucmF0ZURhdGV977yJYCA6ICcnXG4gICAgICBjbWRSb3dzLnVuc2hpZnQoe1xuICAgICAgICBlbnRyeToge1xuICAgICAgICAgIGtleTogJ3VuaXQ6cmVzdWx0JyxcbiAgICAgICAgICBpY29uOiAnZXhjaGFuZ2UtbGluZScsXG4gICAgICAgICAgdGl0bGU6IGNvbnYuZm9ybWF0dGVkLFxuICAgICAgICAgIHN1YnRpdGxlOiBgJHtjb252LmZyb21WYWx1ZX0gJHtjb252LmZyb21Vbml0fSDihpIgJHtjb252LnRvVW5pdH0ke3N1YnRpdGxlU3VmZml4fWAsXG4gICAgICAgICAgYmFkZ2U6IGNvbnYuY2F0ZWdvcnksXG4gICAgICAgICAgYWN0aW9uOiB7IHR5cGU6ICdjb3B5VGV4dCcsIHRleHQ6IFN0cmluZyhjb252LnRvVmFsdWUpIH1cbiAgICAgICAgfSxcbiAgICAgICAgaGlnaGxpZ2h0OiBudWxsLFxuICAgICAgICBzY29yZTogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJcbiAgICAgIH0pXG4gICAgfVxuICAgIC8vIEVtb2ppIOaQnOe0ou+8iOi+k+WFpeWFs+mUruivjeWMuemFjSBFbW9qae+8jOWbnui9puWkjeWItu+8iVxuICAgIGlmICh0cmltbWVkLmxlbmd0aCA+PSAyKSB7XG4gICAgICBjb25zdCBlbW9qaXMgPSBzZWFyY2hFbW9qaSh0cmltbWVkLCAzKVxuICAgICAgZm9yIChjb25zdCBlbW9qaSBvZiBlbW9qaXMpIHtcbiAgICAgICAgY21kUm93cy5wdXNoKHtcbiAgICAgICAgICBlbnRyeToge1xuICAgICAgICAgICAga2V5OiBgZW1vamk6JHtlbW9qaS5lbW9qaX1gLFxuICAgICAgICAgICAgaWNvbjogJ2Vtb3Rpb24tbGluZScsXG4gICAgICAgICAgICB0aXRsZTogYCR7ZW1vamkuZW1vaml9ICAke2Vtb2ppLm5hbWV9YCxcbiAgICAgICAgICAgIHN1YnRpdGxlOiBlbW9qaS5rZXl3b3Jkcy5qb2luKCcgwrcgJyksXG4gICAgICAgICAgICBiYWRnZTogJ0Vtb2ppJyxcbiAgICAgICAgICAgIGFjdGlvbjogeyB0eXBlOiAnY29weVRleHQnLCB0ZXh0OiBlbW9qaS5lbW9qaSB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBoaWdobGlnaHQ6IG51bGwsXG4gICAgICAgICAgc2NvcmU6IDUwXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICAgIC8vIOWFiOWxleekuuWQjOatpee7k+aenO+8iOeri+WNs+WPr+inge+8iVxuICAgIHJlc3VsdHMudmFsdWUgPSBjbWRSb3dzXG5cbiAgICAvLyDlvILmraXvvJrmlofku7YgLyDliarotLTmnb8gLyDniYfmrrUg5bm26KGMXG4gICAgY29uc3QgW2ZpbGVSb3dzLCBjbGlwUm93cywgc25pcFJvd3NdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgc2VhcmNoRmlsZXNBc0VudHJpZXModHJpbW1lZCksXG4gICAgICBzZWFyY2hDbGlwYm9hcmRBc0VudHJpZXModHJpbW1lZCksXG4gICAgICBzZWFyY2hTbmlwcGV0c0FzRW50cmllcyh0cmltbWVkKVxuICAgIF0pXG4gICAgLy8g6L+H5pyfIHRva2Vu77yI55So5oi35bey6L6T5YWl5paw5YaF5a6577yJ5YiZ5Lii5byDXG4gICAgaWYgKHRva2VuICE9PSB1bmlmaWVkU2VhcmNoVG9rZW4pIHJldHVyblxuICAgIHJlc3VsdHMudmFsdWUgPSBbLi4uY21kUm93cywgLi4uZmlsZVJvd3MsIC4uLmNsaXBSb3dzLCAuLi5zbmlwUm93c10uc2xpY2UoMCwgMjApXG4gIH1cblxuICAvKiogd2F0Y2gocXVlcnkpIOeahOaQnOe0ouS+p++8mmRlYm91bmNlIOinpuWPke+8m+epuuafpeivouWbnuWIsOW7uuiuruWIl+ihqCAqL1xuICBmdW5jdGlvbiBzY2hlZHVsZUZvclF1ZXJ5KHE6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh1bmlmaWVkU2VhcmNoVGltZXIpIGNsZWFyVGltZW91dCh1bmlmaWVkU2VhcmNoVGltZXIpXG4gICAgaWYgKCFxLnRyaW0oKSkge1xuICAgICAgcmVzdWx0cy52YWx1ZSA9IG9wdGlvbnMuc3VnZ2VzdGlvbnMudmFsdWVcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB1bmlmaWVkU2VhcmNoVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHZvaWQgcnVuVW5pZmllZFNlYXJjaChxKSwgMTUwKVxuICB9XG5cbiAgLyoqIOWbnuWIsOW7uuiuruWIl+ihqO+8iOWUpOi1tyAvIFBvcCB0byBSb290IC8g56m65p+l6K+i77yJICovXG4gIGZ1bmN0aW9uIHJlc2V0VG9TdWdnZXN0aW9ucygpOiB2b2lkIHtcbiAgICByZXN1bHRzLnZhbHVlID0gb3B0aW9ucy5zdWdnZXN0aW9ucy52YWx1ZVxuICB9XG5cbiAgcmV0dXJuIHsgcmVzdWx0cywgcnVuVW5pZmllZFNlYXJjaCwgc2NoZWR1bGVGb3JRdWVyeSwgcmVzZXRUb1N1Z2dlc3Rpb25zIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBT0EsU0FBUyxXQUFxQjtBQUM5QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQjtBQUU1QixTQUEyQixxQkFBdUM7QUFNbEUsZUFBZSxxQkFBcUIsR0FBbUM7QUFDckUsTUFBSTtBQUNGLFVBQU0sT0FBUSxNQUFNLE9BQU8sSUFBSSxXQUFXLE1BQU0sR0FBRyxHQUFHLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFJdEUsVUFBTSxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBQzdCLFdBQU8sS0FBSyxJQUFJLENBQUMsT0FBTztBQUFBLE1BQ3RCLE9BQU87QUFBQSxRQUNMLEtBQUssUUFBUSxFQUFFLElBQUk7QUFBQSxRQUNuQixNQUFNO0FBQUEsUUFDTixPQUFPLEVBQUU7QUFBQSxRQUNULFVBQVUsRUFBRSxPQUFPLEVBQUU7QUFBQSxRQUNyQixPQUFPO0FBQUEsUUFDUCxRQUFRLEVBQUUsTUFBTSxRQUFRLE1BQU0sRUFBRSxNQUFNLE1BQU0sRUFBRSxLQUFLO0FBQUEsTUFDckQ7QUFBQSxNQUNBLFdBQVc7QUFBQSxNQUNYLE9BQU87QUFBQSxJQUNULEVBQUU7QUFBQSxFQUNKLFFBQVE7QUFDTixXQUFPLENBQUM7QUFBQSxFQUNWO0FBQ0Y7QUFHQSxlQUFlLHlCQUF5QixHQUFtQztBQUN6RSxNQUFJO0FBQ0YsVUFBTSxRQUFTLE1BQU0sT0FBTyxJQUFJLFNBQVMsS0FBSztBQU05QyxVQUFNLFFBQVEsRUFBRSxZQUFZO0FBQzVCLFVBQU0sVUFBVSxNQUNi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