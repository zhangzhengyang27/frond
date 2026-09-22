/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { MODULES, PENDING_MODULES } from "/src/shared/modules.ts";
export const WINDOW_MODULES = /* @__PURE__ */ new Set(["snippets", "screenRecorder"]);
export function buildQuicklinkUrl(url, arg) {
  return url.replaceAll("{query}", encodeURIComponent(arg));
}
export function isValidQuicklinkUrl(url) {
  if (typeof url !== "string" || url.length === 0 || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
export const SYSTEM_PAGES = [
  {
    id: "settings",
    routeName: "settings",
    path: "/settings",
    label: "设置",
    description: "外观 / 更新 / 数据 / 日志",
    icon: "settings-3-line"
  },
  {
    id: "migration",
    routeName: "migration",
    path: "/migration",
    label: "数据迁移",
    description: "旧版本数据一键导入",
    icon: "database-2-line"
  },
  {
    id: "about",
    routeName: "about",
    path: "/about",
    label: "关于",
    description: "版本 / 开源信息",
    icon: "information-line"
  }
];
export const ACTION_COMMANDS = [
  {
    key: "action:screenshot",
    icon: "camera",
    title: "截图",
    subtitle: "立即开始屏幕截图",
    badge: "动作",
    action: { type: "action", action: "screenshot.start" }
  }
];
export const FIRST_PARTY_COMMANDS = [
  {
    key: "firstparty:focus",
    icon: "timer",
    title: "开始专注",
    subtitle: "胶囊内直接开始 / 暂停番茄钟",
    badge: "动作",
    action: { type: "firstParty", page: "focus" }
  },
  {
    key: "firstparty:snippets",
    icon: "file-code",
    title: "搜片段",
    subtitle: "搜索代码片段，回车即复制",
    badge: "动作",
    action: { type: "firstParty", page: "snippets" }
  },
  {
    key: "firstparty:shots",
    icon: "image-line",
    title: "截图历史",
    subtitle: "浏览最近截图，回车复制图片",
    badge: "动作",
    action: { type: "firstParty", page: "shots" }
  },
  {
    key: "firstparty:clips",
    icon: "clipboard-line",
    title: "剪贴板历史",
    subtitle: "最近复制的文本与图片，回车再复制",
    badge: "动作",
    action: { type: "firstParty", page: "clips" }
  },
  {
    key: "firstparty:focusStats",
    icon: "bar-chart-line",
    title: "专注统计",
    subtitle: "近 7 天专注速览",
    badge: "动作",
    action: { type: "firstParty", page: "focusStats" }
  },
  {
    key: "firstparty:files",
    icon: "folder-line",
    title: "文件搜索",
    subtitle: "Spotlight 即时搜索文件名（macOS）",
    badge: "动作",
    action: { type: "firstParty", page: "files" }
  },
  {
    key: "firstparty:qlform",
    icon: "add-line",
    title: "添加快捷链接",
    subtitle: "胶囊内表单填写，保存后即可搜索打开",
    badge: "动作",
    action: { type: "firstParty", page: "qlform" }
  },
  {
    key: "firstparty:settings",
    icon: "settings-line",
    title: "快捷设置",
    subtitle: "主题 / 文本扩展 / 剪贴板历史，胶囊内直达",
    badge: "动作",
    action: { type: "firstParty", page: "settings" }
  },
  {
    key: "firstparty:ai",
    icon: "sparkling-2-line",
    title: "AI 对话",
    subtitle: "胶囊内与 AI 对话（需配置 API Key）",
    badge: "AI",
    action: { type: "firstParty", page: "ai" }
  },
  {
    key: "firstparty:browserTabs",
    icon: "chrome-line",
    title: "浏览器标签",
    subtitle: "搜索 Chrome / Safari 标签并切换（macOS）",
    badge: "浏览器",
    action: { type: "firstParty", page: "browserTabs" }
  },
  {
    key: "firstparty:notes",
    icon: "file-text-line",
    title: "笔记",
    subtitle: "轻量 Markdown 笔记，本地存储",
    badge: "动作",
    action: { type: "firstParty", page: "notes" }
  },
  // AI 预设命令（P0-3 增强：翻译/总结/改写，选中文本后快速处理）
  {
    key: "ai:translate",
    icon: "translate-2",
    title: "翻译为中文",
    subtitle: "把剪贴板文本翻译为中文",
    badge: "AI",
    action: { type: "firstParty", page: "ai" }
  },
  {
    key: "ai:summarize",
    icon: "text-wrap",
    title: "总结文本",
    subtitle: "总结剪贴板文本的核心要点",
    badge: "AI",
    action: { type: "firstParty", page: "ai" }
  },
  {
    key: "ai:rewrite",
    icon: "edit-line",
    title: "润色改写",
    subtitle: "优化剪贴板文本的表达",
    badge: "AI",
    action: { type: "firstParty", page: "ai" }
  }
];
const SYSTEM_CMD_META = {
  "system.lock": { title: "锁定屏幕", subtitle: "立即锁屏", icon: "lock-line" },
  "system.sleep": { title: "睡眠", subtitle: "系统休眠", icon: "moon-line" },
  "system.screensaver": { title: "屏保", subtitle: "启动屏幕保护", icon: "tv-line" },
  "system.emptyTrash": { title: "清空废纸篓", subtitle: "清空系统废纸篓", icon: "delete-bin-line" },
  "system.muteToggle": { title: "静音切换", subtitle: "切换系统静音", icon: "volume-mute-line" },
  "system.showDesktop": { title: "显示桌面", subtitle: "最小化全部窗口", icon: "layout-line" }
};
const WINDOW_CMD_META = {
  "window.left": { title: "窗口左半屏", subtitle: "前台应用窗口靠左" },
  "window.right": { title: "窗口右半屏", subtitle: "前台应用窗口靠右" },
  "window.maximize": { title: "窗口最大化", subtitle: "前台应用窗口铺满屏幕" },
  "window.restore": { title: "窗口还原", subtitle: "切换前台窗口最大化状态" },
  "window.top": { title: "窗口 · 上半屏", subtitle: "前台应用窗口占上半屏" },
  "window.bottom": { title: "窗口 · 下半屏", subtitle: "前台应用窗口占下半屏" },
  "window.topLeft": { title: "窗口 · 左上", subtitle: "前台应用窗口占左上四分之一" },
  "window.topRight": { title: "窗口 · 右上", subtitle: "前台应用窗口占右上四分之一" },
  "window.bottomLeft": { title: "窗口 · 左下", subtitle: "前台应用窗口占左下四分之一" },
  "window.bottomRight": { title: "窗口 · 右下", subtitle: "前台应用窗口占右下四分之一" },
  "window.center": { title: "窗口 · 居中", subtitle: "前台应用窗口移到屏幕中央，尺寸不变" },
  "window.nextDisplay": {
    title: "窗口 · 下一显示器",
    subtitle: "前台应用窗口移到下一个显示器，尺寸与相对位置不变"
  }
};
export function buildSystemCommands(ids) {
  const system = ids.system.flatMap((id) => {
    const meta = SYSTEM_CMD_META[id];
    if (!meta) return [];
    return [
      {
        key: `syscmd:${id}`,
        icon: meta.icon,
        title: meta.title,
        subtitle: meta.subtitle,
        badge: "系统",
        action: { type: "system", cmdId: id }
      }
    ];
  });
  const window = ids.window.flatMap((id) => {
    const meta = WINDOW_CMD_META[id];
    if (!meta) return [];
    return [
      {
        key: `syscmd:${id}`,
        icon: "window-line",
        title: meta.title,
        subtitle: meta.subtitle,
        badge: "系统",
        action: { type: "system", cmdId: id }
      }
    ];
  });
  return [...system, ...window];
}
export function buildQuicklinkCommands(links) {
  return links.map((l) => ({
    key: `quicklink:${l.id}`,
    icon: "link",
    title: l.name,
    subtitle: l.url,
    badge: "链接",
    action: { type: "quicklink", id: l.id, url: l.url }
  }));
}
export function buildStaticCommands() {
  return [
    ...MODULES.map((m) => ({
      key: `module:${m.id}`,
      icon: m.icon,
      title: m.label,
      subtitle: m.description,
      badge: "功能",
      action: { type: "module", moduleId: m.id, path: m.path }
    })),
    ...PENDING_MODULES.map((p) => ({
      key: `module:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: "功能",
      action: { type: "module", moduleId: p.id, path: p.path }
    })),
    ...SYSTEM_PAGES.map((p) => ({
      key: `page:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: "页面",
      action: { type: "page", pageId: p.id, path: p.path }
    })),
    ...ACTION_COMMANDS,
    ...FIRST_PARTY_COMMANDS
  ];
}
export async function addPinyinAliases(entries) {
  const pending = entries.filter((e) => e.aliases === void 0 && /[\u4e00-\u9fa5]/.test(e.title));
  if (pending.length === 0) return;
  try {
    const { pinyin } = await import("/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/pinyin-pro.js?v=c8635d8b");
    for (const entry of pending) {
      const initials = pinyin(entry.title, {
        pattern: "first",
        toneType: "none",
        type: "array",
        nonZh: "consecutive"
      }).join("").replace(/[^a-z0-9]/gi, "").toLowerCase();
      entry.aliases = initials ? [initials] : [];
    }
  } catch {
  }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1hbmRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDlkb3ku6Tms6jlhozooajvvIhJQSB2MuOAjOe7n+S4gOWRveS7pOWxguOAje+8iVxuICpcbiAqIOWNleS4gOecn+eQhua6kO+8muWQr+WKqOWPsOiDtuWbiuOAgeKMmEsg5ZG95Luk6Z2i5p2/44CB5omY55uYIC8gRG9jayDoj5zljZXjgIHijJgxLTQg55qE5YWl5Y+jXG4gKiDlhajpg6jku47ov5nku73ms6jlhozooajlj5blkb3ku6TvvIzkv53or4HjgIzlkIzmoLfnmoTmkJzntKLvvIzliLDlpITkuIDkuKrmoLfjgI3jgIJcbiAqXG4gKiDkuInnsbvpnZnmgIHlkb3ku6TlnKjmraTmnoTlu7rvvJpcbiAqIC0gbW9kdWxlICDihpIg5Li756qX5Y+j5qih5Z2X6aG177yI5a625Lit55qE6aG16Z2i77yJXG4gKiAtIHBhZ2UgICAg4oaSIOezu+e7n+euoeeQhumhte+8iOiuvue9riAvIOaVsOaNrui/geenuyAvIOWFs+S6ju+8jOmdnuaooeWdl+S4jei/myBNT0RVTEVT77yJXG4gKiAtIGFjdGlvbiAg4oaSIOebtOaOpeaJp+ihjOeahOWKqOS9nO+8iOaIquWbvuetie+8jOaXoOmcgOaJk+W8gOmhtemdou+8iVxuICog5Lik57G75Yqo5oCB5ZG95Luk55Sx5raI6LS55pa56L+Q6KGM5pe26L+95Yqg77yI57G75Z6L5rK/55So5pys5paH5Lu277yJ77yaXG4gKiAtIHBsdWdpbiAg4oaSIOW3suWQr+eUqOaPkuS7tuWcqCBwbHVnaW4uanNvbiDlo7DmmI7nmoTlkb3ku6TvvIhsYXVuY2hlci5saXN0UGx1Z2luc++8iVxuICogLSBhcHAgICAgIOKGkiDmnKzmnLrlupTnlKjvvIhnZXRBcHBsaWNhdGlvbnPvvIlcbiAqXG4gKiDmiafooYzor63kuYnop4EgcmVuZGVyZXIgdXRpbHMvY29tbWFuZFJ1bm5lci50c++8m+WIhuW3peWlkee6puingSBkb2NzL0lBX1YyLm1k44CCXG4gKi9cblxuaW1wb3J0IHsgTU9EVUxFUywgUEVORElOR19NT0RVTEVTIH0gZnJvbSAnLi9tb2R1bGVzJ1xuXG4vKiog56ys5LiA5pa55YaF6IGU6aG1IGlk77yIUmF5Y2FzdCDlvI/vvJrlkb3ku6Tnu5Pmnpznm7TmjqXlkYjnjrDlnKjog7blm4rnqpflhoXvvIkgKi9cbmV4cG9ydCB0eXBlIEZpcnN0UGFydHlQYWdlID1cbiAgfCAnZm9jdXMnXG4gIHwgJ3NuaXBwZXRzJ1xuICB8ICdzaG90cydcbiAgfCAnY2xpcHMnXG4gIHwgJ2ZvY3VzU3RhdHMnXG4gIHwgJ2ZpbGVzJ1xuICB8ICdxbGZvcm0nXG4gIHwgJ3FsYXJnJ1xuICB8ICdzZXR0aW5ncydcbiAgfCAnYWknXG4gIHwgJ2Jyb3dzZXJUYWJzJ1xuICB8ICdzeXN0ZW1JbmZvJ1xuICB8ICd3aW5kb3dTd2l0Y2hlcidcbiAgfCAndHJhc2gnXG4gIHwgJ2RpY3Rpb25hcnknXG4gIHwgJ25vdGVzJ1xuICB8ICdyZW1pbmRlcnMnXG4gIHwgJ2NhbGVuZGFyJ1xuXG4vKipcbiAqIOmHjeWei+aooeWdl++8iOmYtuautUPjgIzkuLvnqpflj6PpmY3nuqfjgI3vvInvvJrku47lkK/liqjlj7AgLyDijJhLIOaJk+W8gOaXtui1sOeLrOeri+eql+WPo++8jFxuICog5LiN5oqi5Y2g5Li756qX5Y+j5b2T5YmN54q25oCB77yb5L6n6L655qCP5YaF55qE56qX5Y+j5YaF5a+86Iiq6KGM5Li65LiN5Y+Y44CCXG4gKi9cbmV4cG9ydCBjb25zdCBXSU5ET1dfTU9EVUxFUzogUmVhZG9ubHlTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoWydzbmlwcGV0cycsICdzY3JlZW5SZWNvcmRlciddKVxuXG4vKiog5ZG95Luk5Y+v5omn6KGM55qE5Yqo5L2cICovXG5leHBvcnQgdHlwZSBDb21tYW5kQWN0aW9uID1cbiAgfCB7IHR5cGU6ICdtb2R1bGUnOyBtb2R1bGVJZDogc3RyaW5nOyBwYXRoOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogJ3BhZ2UnOyBwYWdlSWQ6IHN0cmluZzsgcGF0aDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6ICdwbHVnaW4nOyBwbHVnaW5JZDogc3RyaW5nOyBjbWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiAnYXBwJzsgcGF0aDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6ICdhY3Rpb24nOyBhY3Rpb246ICdzY3JlZW5zaG90LnN0YXJ0JyB9XG4gIHwgeyB0eXBlOiAnZmlyc3RQYXJ0eSc7IHBhZ2U6IEZpcnN0UGFydHlQYWdlIH1cbiAgfCB7IHR5cGU6ICdjb3B5VGV4dCc7IHRleHQ6IHN0cmluZyB9XG4gIC8qKiDns7vnu5/lkb3ku6QgLyDnqpflj6PnrqHnkIbvvIhNMu+8ie+8jGlkIOW9ouWmgiBzeXN0ZW0ubG9jayAvIHdpbmRvdy5sZWZ0ICovXG4gIHwgeyB0eXBlOiAnc3lzdGVtJzsgY21kSWQ6IHN0cmluZyB9XG4gIC8qKiDnlKjmiLfoh6rlrprkuYnlv6vmjbfpk77mjqXvvIhNMi4z77yJICovXG4gIHwgeyB0eXBlOiAncXVpY2tsaW5rJzsgaWQ6IHN0cmluZzsgdXJsOiBzdHJpbmcgfVxuICAvKiog57uf5LiA5re35ZCI5pCc57Si77yIUDAtMe+8ie+8muagueaQnOe0ouebtOaOpeWRveS4reaWh+S7tu+8jOWbnui9pueUqOm7mOiupOeoi+W6j+aJk+W8gCAqL1xuICB8IHsgdHlwZTogJ2ZpbGUnOyBwYXRoOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9XG4gIC8qKiDnu5/kuIDmt7flkIjmkJzntKLvvJrmoLnmkJzntKLnm7TmjqXlkb3kuK3liarotLTmnb/ljoblj7LmnaHnm67vvIzlm57ovablho3lpI3liLYgKi9cbiAgfCB7IHR5cGU6ICdjbGlwYm9hcmRJdGVtJzsgaWQ6IHN0cmluZyB9XG4gIC8qKiDnu5/kuIDmt7flkIjmkJzntKLvvJrmoLnmkJzntKLnm7TmjqXlkb3kuK3ku6PnoIHniYfmrrXvvIzlm57ovablpI3liLblhoXlrrkgKi9cbiAgfCB7IHR5cGU6ICdzbmlwcGV0SXRlbSc7IGlkOiBzdHJpbmcgfVxuICAvKiog57uf5LiA5re35ZCI5pCc57Si77ya5qC55pCc57Si55u05o6l5ZG95Lit5oiq5Zu+5Y6G5Y+y77yM5Zue6L2m5aSN5Yi25Zu+54mHICovXG4gIHwgeyB0eXBlOiAnc2NyZWVuc2hvdEl0ZW0nOyBpZDogc3RyaW5nOyBmaWxlUGF0aDogc3RyaW5nIH1cbiAgLyoqIFAyLTnvvJrmnIDov5HmkJzntKLor43vvIzngrnlh7vlkI7loavlhaXmkJzntKLmoYbvvIjkuI3miafooYzlkb3ku6TvvIkgKi9cbiAgfCB7IHR5cGU6ICdzZWFyY2hRdWVyeSc7IHF1ZXJ5OiBzdHJpbmcgfVxuICAvKiog5rWu5Yqo56yU6K6w77ya5omT5byA5rWu5Yqo56yU6K6w56qX5Y+jICovXG4gIHwgeyB0eXBlOiAnZmxvYXRpbmdOb3RlJyB9XG5cbi8qKiDnlKjmiLfoh6rlrprkuYkgUXVpY2tsaW5r77yITTIuM++8jOWtmOWCqOWcqOS4u+i/m+eoiyBrdu+8ie+8m1VSTCDlj6/lkKsge3F1ZXJ5fSDljaDkvY3nrKbvvIjlj4LmlbDljJbpk77mjqXvvIkgKi9cbmV4cG9ydCBpbnRlcmZhY2UgUXVpY2tsaW5rIHtcbiAgaWQ6IHN0cmluZ1xuICBuYW1lOiBzdHJpbmdcbiAgdXJsOiBzdHJpbmdcbn1cblxuLyoqXG4gKiDlj4LmlbDljJYgUXVpY2tsaW5r77yI57u05bqmIDEg5Ymp5L2Z5beu6Led77ya5ZG95Luk5Y+C5pWw5YyW77yJ77yaXG4gKiBVUkwg5Lit5q+P5LiqIHtxdWVyeX0g5Y2g5L2N56ym5pu/5o2i5Li6IFVSTCDnvJbnoIHlkI7nmoTlj4LmlbDjgIJcbiAqIOS+i++8mmh0dHBzOi8vZ2l0aHViLmNvbS9zZWFyY2g/cT17cXVlcnl9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFF1aWNrbGlua1VybCh1cmw6IHN0cmluZywgYXJnOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdXJsLnJlcGxhY2VBbGwoJ3txdWVyeX0nLCBlbmNvZGVVUklDb21wb25lbnQoYXJnKSlcbn1cblxuLyoqXG4gKiBRdWlja2xpbmsgVVJMIOeZveWQjeWNle+8muWPquWFgeiuuCBodHRwKHMp44CCXG4gKiBRdWlja2xpbmsg5Lya57uPIHNoZWxsLm9wZW5FeHRlcm5hbCDmiZPlvIDvvIxmaWxlOi/oh6rlrprkuYnljY/orq4v5ZG95Luk5Liy5b+F6aG75oyh5ZyoXG4gKiDkv53lrZjkuI7liIblj5HkuKTnq6/vvJvmuLLmn5Pnq6/miZPlvIDotbAgc3lzdGVtOm9wZW5FeHRlcm5hbO+8iOWQjOS4gOeZveWQjeWNle+8ieOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFF1aWNrbGlua1VybCh1cmw6IHVua25vd24pOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC5sZW5ndGggPT09IDAgfHwgdXJsLmxlbmd0aCA+IDIwNDgpIHJldHVybiBmYWxzZVxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IG5ldyBVUkwodXJsKVxuICAgIHJldHVybiBwYXJzZWQucHJvdG9jb2wgPT09ICdodHRwOicgfHwgcGFyc2VkLnByb3RvY29sID09PSAnaHR0cHM6J1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG4vKiog5pCc57SiIC8g5ZG95Luk5YiX6KGo6YCa55So5p2h55uu77yI6IO25ZuK5LiOIOKMmEsg5YWx55So77yJICovXG5leHBvcnQgaW50ZXJmYWNlIENvbW1hbmRFbnRyeSB7XG4gIC8qKiDllK/kuIAga2V577yI57uT5p6c5YiX6KGoIHYtZm9yIC8g6YCJ5Lit5oCB5oGi5aSN55So77yJICovXG4gIGtleTogc3RyaW5nXG4gIC8qKiDnu5Pmnpznsbvlnovlm77moIflkI3vvIhyZW1peGljb27vvIzkuI3lkKsgcmktIOWJjee8gO+8iSAqL1xuICBpY29uOiBzdHJpbmdcbiAgLyoqIOS4u+agh+mimCAqL1xuICB0aXRsZTogc3RyaW5nXG4gIC8qKiDlia/moIfpopjvvIjmj4/ov7AgLyDot6/lvoTvvIkgKi9cbiAgc3VidGl0bGU6IHN0cmluZ1xuICAvKiog57uT5p6c6KGM5Y+z5L6n55qE57G75Z6L5b695qCH5paH5qGI77yI5bqU55SoIC8g5Yqf6IO9IC8g5o+S5Lu2IC8g6aG16Z2iIC8g5Yqo5L2c77yJICovXG4gIGJhZGdlOiBzdHJpbmdcbiAgLyoqIOWIq+WQje+8iOaLvOmfs+mmluWtl+avjeetie+8jE0xLjHvvIzmg7DmgKfnlJ/miJDvvIkgKi9cbiAgYWxpYXNlcz86IHN0cmluZ1tdXG4gIGFjdGlvbjogQ29tbWFuZEFjdGlvblxufVxuXG4vKiog57O757uf566h55CG6aG177yI5Li756qX5Y+j44CM57O757uf44CN57uE77yb6Z2e5qih5Z2X77yM5LiN6L+bIE1PRFVMRVMgLyDijJjmlbDlrZfvvIkgKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3lzdGVtUGFnZSB7XG4gIGlkOiBzdHJpbmdcbiAgcm91dGVOYW1lOiBzdHJpbmdcbiAgcGF0aDogc3RyaW5nXG4gIGxhYmVsOiBzdHJpbmdcbiAgZGVzY3JpcHRpb246IHN0cmluZ1xuICBpY29uOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QQUdFUzogU3lzdGVtUGFnZVtdID0gW1xuICB7XG4gICAgaWQ6ICdzZXR0aW5ncycsXG4gICAgcm91dGVOYW1lOiAnc2V0dGluZ3MnLFxuICAgIHBhdGg6ICcvc2V0dGluZ3MnLFxuICAgIGxhYmVsOiAn6K6+572uJyxcbiAgICBkZXNjcmlwdGlvbjogJ+WkluingiAvIOabtOaWsCAvIOaVsOaNriAvIOaXpeW/lycsXG4gICAgaWNvbjogJ3NldHRpbmdzLTMtbGluZSdcbiAgfSxcbiAge1xuICAgIGlkOiAnbWlncmF0aW9uJyxcbiAgICByb3V0ZU5hbWU6ICdtaWdyYXRpb24nLFxuICAgIHBhdGg6ICcvbWlncmF0aW9uJyxcbiAgICBsYWJlbDogJ+aVsOaNrui/geenuycsXG4gICAgZGVzY3JpcHRpb246ICfml6fniYjmnKzmlbDmja7kuIDplK7lr7zlhaUnLFxuICAgIGljb246ICdkYXRhYmFzZS0yLWxpbmUnXG4gIH0sXG4gIHtcbiAgICBpZDogJ2Fib3V0JyxcbiAgICByb3V0ZU5hbWU6ICdhYm91dCcsXG4gICAgcGF0aDogJy9hYm91dCcsXG4gICAgbGFiZWw6ICflhbPkuo4nLFxuICAgIGRlc2NyaXB0aW9uOiAn54mI5pysIC8g5byA5rqQ5L+h5oGvJyxcbiAgICBpY29uOiAnaW5mb3JtYXRpb24tbGluZSdcbiAgfVxuXVxuXG4vKiog55u05o6l5omn6KGM55qE5Yqo5L2c5ZG95Luk77yI5LiN5omT5byA6aG16Z2i77yM56uL5Y2z5YGa5LqL77yJICovXG5leHBvcnQgY29uc3QgQUNUSU9OX0NPTU1BTkRTOiBDb21tYW5kRW50cnlbXSA9IFtcbiAge1xuICAgIGtleTogJ2FjdGlvbjpzY3JlZW5zaG90JyxcbiAgICBpY29uOiAnY2FtZXJhJyxcbiAgICB0aXRsZTogJ+aIquWbvicsXG4gICAgc3VidGl0bGU6ICfnq4vljbPlvIDlp4vlsY/luZXmiKrlm74nLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2FjdGlvbicsIGFjdGlvbjogJ3NjcmVlbnNob3Quc3RhcnQnIH1cbiAgfVxuXVxuXG4vKipcbiAqIOesrOS4gOaWueWGheiBlOmhteWRveS7pO+8iFJheWNhc3Qg5byP77yJ77ya5Zue6L2m5ZCO6IO25ZuK56qX6Ieq6Lqr5Y+Y5b2i5Li66K+l6aG177yMXG4gKiDnu5PmnpzlnKjog7blm4rlhoXlkYjnjrDvvIzkuI3lho3ot7PovazkuLvnqpflj6PjgILpobXpnaLlrp7njrDop4FcbiAqIHJlbmRlcmVyL2xhdW5jaGVyL3BhZ2VzL++8iEZvY3VzUGFnZSAvIFNuaXBwZXRzUGFnZe+8ieOAglxuICovXG5leHBvcnQgY29uc3QgRklSU1RfUEFSVFlfQ09NTUFORFM6IENvbW1hbmRFbnRyeVtdID0gW1xuICB7XG4gICAga2V5OiAnZmlyc3RwYXJ0eTpmb2N1cycsXG4gICAgaWNvbjogJ3RpbWVyJyxcbiAgICB0aXRsZTogJ+W8gOWni+S4k+azqCcsXG4gICAgc3VidGl0bGU6ICfog7blm4rlhoXnm7TmjqXlvIDlp4sgLyDmmoLlgZznlarojITpkp8nLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnZm9jdXMnIH1cbiAgfSxcbiAge1xuICAgIGtleTogJ2ZpcnN0cGFydHk6c25pcHBldHMnLFxuICAgIGljb246ICdmaWxlLWNvZGUnLFxuICAgIHRpdGxlOiAn5pCc54mH5q61JyxcbiAgICBzdWJ0aXRsZTogJ+aQnOe0ouS7o+eggeeJh+aute+8jOWbnui9puWNs+WkjeWIticsXG4gICAgYmFkZ2U6ICfliqjkvZwnLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdzbmlwcGV0cycgfVxuICB9LFxuICB7XG4gICAga2V5OiAnZmlyc3RwYXJ0eTpzaG90cycsXG4gICAgaWNvbjogJ2ltYWdlLWxpbmUnLFxuICAgIHRpdGxlOiAn5oiq5Zu+5Y6G5Y+yJyxcbiAgICBzdWJ0aXRsZTogJ+a1j+iniOacgOi/keaIquWbvu+8jOWbnui9puWkjeWItuWbvueJhycsXG4gICAgYmFkZ2U6ICfliqjkvZwnLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdzaG90cycgfVxuICB9LFxuICB7XG4gICAga2V5OiAnZmlyc3RwYXJ0eTpjbGlwcycsXG4gICAgaWNvbjogJ2NsaXBib2FyZC1saW5lJyxcbiAgICB0aXRsZTogJ+WJqui0tOadv+WOhuWPsicsXG4gICAgc3VidGl0bGU6ICfmnIDov5HlpI3liLbnmoTmlofmnKzkuI7lm77niYfvvIzlm57ovablho3lpI3liLYnLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnY2xpcHMnIH1cbiAgfSxcbiAge1xuICAgIGtleTogJ2ZpcnN0cGFydHk6Zm9jdXNTdGF0cycsXG4gICAgaWNvbjogJ2Jhci1jaGFydC1saW5lJyxcbiAgICB0aXRsZTogJ+S4k+azqOe7n+iuoScsXG4gICAgc3VidGl0bGU6ICfov5EgNyDlpKnkuJPms6jpgJ/op4gnLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnZm9jdXNTdGF0cycgfVxuICB9LFxuICB7XG4gICAga2V5OiAnZmlyc3RwYXJ0eTpmaWxlcycsXG4gICAgaWNvbjogJ2ZvbGRlci1saW5lJyxcbiAgICB0aXRsZTogJ+aWh+S7tuaQnOe0oicsXG4gICAgc3VidGl0bGU6ICdTcG90bGlnaHQg5Y2z5pe25pCc57Si5paH5Lu25ZCN77yIbWFjT1PvvIknLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnZmlsZXMnIH1cbiAgfSxcbiAge1xuICAgIGtleTogJ2ZpcnN0cGFydHk6cWxmb3JtJyxcbiAgICBpY29uOiAnYWRkLWxpbmUnLFxuICAgIHRpdGxlOiAn5re75Yqg5b+r5o236ZO+5o6lJyxcbiAgICBzdWJ0aXRsZTogJ+iDtuWbiuWGheihqOWNleWhq+WGme+8jOS/neWtmOWQjuWNs+WPr+aQnOe0ouaJk+W8gCcsXG4gICAgYmFkZ2U6ICfliqjkvZwnLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdxbGZvcm0nIH1cbiAgfSxcbiAge1xuICAgIGtleTogJ2ZpcnN0cGFydHk6c2V0dGluZ3MnLFxuICAgIGljb246ICdzZXR0aW5ncy1saW5lJyxcbiAgICB0aXRsZTogJ+W/q+aNt+iuvue9ricsXG4gICAgc3VidGl0bGU6ICfkuLvpopggLyDmlofmnKzmianlsZUgLyDliarotLTmnb/ljoblj7LvvIzog7blm4rlhoXnm7Tovr4nLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnc2V0dGluZ3MnIH1cbiAgfSxcbiAge1xuICAgIGtleTogJ2ZpcnN0cGFydHk6YWknLFxuICAgIGljb246ICdzcGFya2xpbmctMi1saW5lJyxcbiAgICB0aXRsZTogJ0FJIOWvueivnScsXG4gICAgc3VidGl0bGU6ICfog7blm4rlhoXkuI4gQUkg5a+56K+d77yI6ZyA6YWN572uIEFQSSBLZXnvvIknLFxuICAgIGJhZGdlOiAnQUknLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdhaScgfVxuICB9LFxuICB7XG4gICAga2V5OiAnZmlyc3RwYXJ0eTpicm93c2VyVGFicycsXG4gICAgaWNvbjogJ2Nocm9tZS1saW5lJyxcbiAgICB0aXRsZTogJ+a1j+iniOWZqOagh+etvicsXG4gICAgc3VidGl0bGU6ICfmkJzntKIgQ2hyb21lIC8gU2FmYXJpIOagh+etvuW5tuWIh+aNou+8iG1hY09T77yJJyxcbiAgICBiYWRnZTogJ+a1j+iniOWZqCcsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2Jyb3dzZXJUYWJzJyB9XG4gIH0sXG4gIHtcbiAgICBrZXk6ICdmaXJzdHBhcnR5Om5vdGVzJyxcbiAgICBpY29uOiAnZmlsZS10ZXh0LWxpbmUnLFxuICAgIHRpdGxlOiAn56yU6K6wJyxcbiAgICBzdWJ0aXRsZTogJ+i9u+mHjyBNYXJrZG93biDnrJTorrDvvIzmnKzlnLDlrZjlgqgnLFxuICAgIGJhZGdlOiAn5Yqo5L2cJyxcbiAgICBhY3Rpb246IHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnbm90ZXMnIH1cbiAgfSxcbiAgLy8gQUkg6aKE6K6+5ZG95Luk77yIUDAtMyDlop7lvLrvvJrnv7vor5Ev5oC757uTL+aUueWGme+8jOmAieS4reaWh+acrOWQjuW/q+mAn+WkhOeQhu+8iVxuICB7XG4gICAga2V5OiAnYWk6dHJhbnNsYXRlJyxcbiAgICBpY29uOiAndHJhbnNsYXRlLTInLFxuICAgIHRpdGxlOiAn57+76K+R5Li65Lit5paHJyxcbiAgICBzdWJ0aXRsZTogJ+aKiuWJqui0tOadv+aWh+acrOe/u+ivkeS4uuS4reaWhycsXG4gICAgYmFkZ2U6ICdBSScsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2FpJyB9XG4gIH0sXG4gIHtcbiAgICBrZXk6ICdhaTpzdW1tYXJpemUnLFxuICAgIGljb246ICd0ZXh0LXdyYXAnLFxuICAgIHRpdGxlOiAn5oC757uT5paH5pysJyxcbiAgICBzdWJ0aXRsZTogJ+aAu+e7k+WJqui0tOadv+aWh+acrOeahOaguOW/g+imgeeCuScsXG4gICAgYmFkZ2U6ICdBSScsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2FpJyB9XG4gIH0sXG4gIHtcbiAgICBrZXk6ICdhaTpyZXdyaXRlJyxcbiAgICBpY29uOiAnZWRpdC1saW5lJyxcbiAgICB0aXRsZTogJ+a2puiJsuaUueWGmScsXG4gICAgc3VidGl0bGU6ICfkvJjljJbliarotLTmnb/mlofmnKznmoTooajovr4nLFxuICAgIGJhZGdlOiAnQUknLFxuICAgIGFjdGlvbjogeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdhaScgfVxuICB9XG5dXG5cbi8qKiDpnZnmgIHlkb3ku6QgPSDmqKHlnZcgKyBQRU5ESU5HIOaooeWdlyArIOezu+e7n+mhtSArIOWKqOS9nCArIOesrOS4gOaWueWGheiBlOmhte+8iOWKqOaAge+8muaPkuS7tiAvIOW6lOeUqOeUsea2iOi0ueaWuei/veWKoO+8iSAqL1xuLyoqIE0yLjEvTTIuMu+8muezu+e7n+WRveS7pOS4jueql+WPo+euoeeQhuWRveS7pOeahOWxleekuuWFg+aVsOaNru+8iOS4u+i/m+eoi+aMieW5s+WPsOi/lOWbnuWPr+eUqCBpZO+8iSAqL1xuY29uc3QgU1lTVEVNX0NNRF9NRVRBOiBSZWNvcmQ8c3RyaW5nLCB7IHRpdGxlOiBzdHJpbmc7IHN1YnRpdGxlOiBzdHJpbmc7IGljb246IHN0cmluZyB9PiA9IHtcbiAgJ3N5c3RlbS5sb2NrJzogeyB0aXRsZTogJ+mUgeWumuWxj+W5lScsIHN1YnRpdGxlOiAn56uL5Y2z6ZSB5bGPJywgaWNvbjogJ2xvY2stbGluZScgfSxcbiAgJ3N5c3RlbS5zbGVlcCc6IHsgdGl0bGU6ICfnnaHnnKAnLCBzdWJ0aXRsZTogJ+ezu+e7n+S8keecoCcsIGljb246ICdtb29uLWxpbmUnIH0sXG4gICdzeXN0ZW0uc2NyZWVuc2F2ZXInOiB7IHRpdGxlOiAn5bGP5L+dJywgc3VidGl0bGU6ICflkK/liqjlsY/luZXkv53miqQnLCBpY29uOiAndHYtbGluZScgfSxcbiAgJ3N5c3RlbS5lbXB0eVRyYXNoJzogeyB0aXRsZTogJ+a4heepuuW6n+e6uOevkycsIHN1YnRpdGxlOiAn5riF56m657O757uf5bqf57q456+TJywgaWNvbjogJ2RlbGV0ZS1iaW4tbGluZScgfSxcbiAgJ3N5c3RlbS5tdXRlVG9nZ2xlJzogeyB0aXRsZTogJ+mdmemfs+WIh+aNoicsIHN1YnRpdGxlOiAn5YiH5o2i57O757uf6Z2Z6Z+zJywgaWNvbjogJ3ZvbHVtZS1tdXRlLWxpbmUnIH0sXG4gICdzeXN0ZW0uc2hvd0Rlc2t0b3AnOiB7IHRpdGxlOiAn5pi+56S65qGM6Z2iJywgc3VidGl0bGU6ICfmnIDlsI/ljJblhajpg6jnqpflj6MnLCBpY29uOiAnbGF5b3V0LWxpbmUnIH1cbn1cblxuY29uc3QgV0lORE9XX0NNRF9NRVRBOiBSZWNvcmQ8c3RyaW5nLCB7IHRpdGxlOiBzdHJpbmc7IHN1YnRpdGxlOiBzdHJpbmcgfT4gPSB7XG4gICd3aW5kb3cubGVmdCc6IHsgdGl0bGU6ICfnqpflj6Plt6bljYrlsY8nLCBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+mdoOW3picgfSxcbiAgJ3dpbmRvdy5yaWdodCc6IHsgdGl0bGU6ICfnqpflj6Plj7PljYrlsY8nLCBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+mdoOWPsycgfSxcbiAgJ3dpbmRvdy5tYXhpbWl6ZSc6IHsgdGl0bGU6ICfnqpflj6PmnIDlpKfljJYnLCBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+mTuua7oeWxj+W5lScgfSxcbiAgJ3dpbmRvdy5yZXN0b3JlJzogeyB0aXRsZTogJ+eql+WPo+i/mOWOnycsIHN1YnRpdGxlOiAn5YiH5o2i5YmN5Y+w56qX5Y+j5pyA5aSn5YyW54q25oCBJyB9LFxuICAnd2luZG93LnRvcCc6IHsgdGl0bGU6ICfnqpflj6Mgwrcg5LiK5Y2K5bGPJywgc3VidGl0bGU6ICfliY3lj7DlupTnlKjnqpflj6PljaDkuIrljYrlsY8nIH0sXG4gICd3aW5kb3cuYm90dG9tJzogeyB0aXRsZTogJ+eql+WPoyDCtyDkuIvljYrlsY8nLCBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+WNoOS4i+WNiuWxjycgfSxcbiAgJ3dpbmRvdy50b3BMZWZ0JzogeyB0aXRsZTogJ+eql+WPoyDCtyDlt6bkuIonLCBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+WNoOW3puS4iuWbm+WIhuS5i+S4gCcgfSxcbiAgJ3dpbmRvdy50b3BSaWdodCc6IHsgdGl0bGU6ICfnqpflj6Mgwrcg5Y+z5LiKJywgc3VidGl0bGU6ICfliY3lj7DlupTnlKjnqpflj6PljaDlj7PkuIrlm5vliIbkuYvkuIAnIH0sXG4gICd3aW5kb3cuYm90dG9tTGVmdCc6IHsgdGl0bGU6ICfnqpflj6Mgwrcg5bem5LiLJywgc3VidGl0bGU6ICfliY3lj7DlupTnlKjnqpflj6PljaDlt6bkuIvlm5vliIbkuYvkuIAnIH0sXG4gICd3aW5kb3cuYm90dG9tUmlnaHQnOiB7IHRpdGxlOiAn56qX5Y+jIMK3IOWPs+S4iycsIHN1YnRpdGxlOiAn5YmN5Y+w5bqU55So56qX5Y+j5Y2g5Y+z5LiL5Zub5YiG5LmL5LiAJyB9LFxuICAnd2luZG93LmNlbnRlcic6IHsgdGl0bGU6ICfnqpflj6Mgwrcg5bGF5LitJywgc3VidGl0bGU6ICfliY3lj7DlupTnlKjnqpflj6Pnp7vliLDlsY/luZXkuK3lpK7vvIzlsLrlr7jkuI3lj5gnIH0sXG4gICd3aW5kb3cubmV4dERpc3BsYXknOiB7XG4gICAgdGl0bGU6ICfnqpflj6Mgwrcg5LiL5LiA5pi+56S65ZmoJyxcbiAgICBzdWJ0aXRsZTogJ+WJjeWPsOW6lOeUqOeql+WPo+enu+WIsOS4i+S4gOS4quaYvuekuuWZqO+8jOWwuuWvuOS4juebuOWvueS9jee9ruS4jeWPmCdcbiAgfVxufVxuXG4vKiog55Sx5Li76L+b56iL5LiK5oql55qE5Y+v55SoIGlkIOaehOW7uuWKqOaAgeezu+e7n+WRveS7pO+8iE0yLjEgLyBNMi4y77yJICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTeXN0ZW1Db21tYW5kcyhpZHM6IHsgc3lzdGVtOiBzdHJpbmdbXTsgd2luZG93OiBzdHJpbmdbXSB9KTogQ29tbWFuZEVudHJ5W10ge1xuICBjb25zdCBzeXN0ZW06IENvbW1hbmRFbnRyeVtdID0gaWRzLnN5c3RlbS5mbGF0TWFwKChpZCkgPT4ge1xuICAgIGNvbnN0IG1ldGEgPSBTWVNURU1fQ01EX01FVEFbaWRdXG4gICAgaWYgKCFtZXRhKSByZXR1cm4gW11cbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBrZXk6IGBzeXNjbWQ6JHtpZH1gLFxuICAgICAgICBpY29uOiBtZXRhLmljb24sXG4gICAgICAgIHRpdGxlOiBtZXRhLnRpdGxlLFxuICAgICAgICBzdWJ0aXRsZTogbWV0YS5zdWJ0aXRsZSxcbiAgICAgICAgYmFkZ2U6ICfns7vnu58nLFxuICAgICAgICBhY3Rpb246IHsgdHlwZTogJ3N5c3RlbScsIGNtZElkOiBpZCB9IHNhdGlzZmllcyBDb21tYW5kQWN0aW9uXG4gICAgICB9XG4gICAgXVxuICB9KVxuICBjb25zdCB3aW5kb3c6IENvbW1hbmRFbnRyeVtdID0gaWRzLndpbmRvdy5mbGF0TWFwKChpZCkgPT4ge1xuICAgIGNvbnN0IG1ldGEgPSBXSU5ET1dfQ01EX01FVEFbaWRdXG4gICAgaWYgKCFtZXRhKSByZXR1cm4gW11cbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBrZXk6IGBzeXNjbWQ6JHtpZH1gLFxuICAgICAgICBpY29uOiAnd2luZG93LWxpbmUnLFxuICAgICAgICB0aXRsZTogbWV0YS50aXRsZSxcbiAgICAgICAgc3VidGl0bGU6IG1ldGEuc3VidGl0bGUsXG4gICAgICAgIGJhZGdlOiAn57O757ufJyxcbiAgICAgICAgYWN0aW9uOiB7IHR5cGU6ICdzeXN0ZW0nLCBjbWRJZDogaWQgfSBzYXRpc2ZpZXMgQ29tbWFuZEFjdGlvblxuICAgICAgfVxuICAgIF1cbiAgfSlcbiAgcmV0dXJuIFsuLi5zeXN0ZW0sIC4uLndpbmRvd11cbn1cblxuLyoqIE0yLjPvvJrnlKjmiLcgUXVpY2tsaW5rcyDihpIg5ZG95Luk5p2h55uuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRRdWlja2xpbmtDb21tYW5kcyhsaW5rczogUXVpY2tsaW5rW10pOiBDb21tYW5kRW50cnlbXSB7XG4gIHJldHVybiBsaW5rcy5tYXAoKGwpID0+ICh7XG4gICAga2V5OiBgcXVpY2tsaW5rOiR7bC5pZH1gLFxuICAgIGljb246ICdsaW5rJyxcbiAgICB0aXRsZTogbC5uYW1lLFxuICAgIHN1YnRpdGxlOiBsLnVybCxcbiAgICBiYWRnZTogJ+mTvuaOpScsXG4gICAgYWN0aW9uOiB7IHR5cGU6ICdxdWlja2xpbmsnLCBpZDogbC5pZCwgdXJsOiBsLnVybCB9IHNhdGlzZmllcyBDb21tYW5kQWN0aW9uXG4gIH0pKVxufVxuXG4vKiog6Z2Z5oCB5ZG95LukID0g5qih5Z2XICsgUEVORElORyDmqKHlnZcgKyDns7vnu5/pobUgKyDliqjkvZwgKyDnrKzkuIDmlrnlhoXogZTpobXvvIjliqjmgIHvvJrmj5Lku7YgLyDlupTnlKggLyDns7vnu5/lkb3ku6QgLyBRdWlja2xpbmtzIOeUsea2iOi0ueaWuei/veWKoO+8iSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkU3RhdGljQ29tbWFuZHMoKTogQ29tbWFuZEVudHJ5W10ge1xuICByZXR1cm4gW1xuICAgIC4uLk1PRFVMRVMubWFwKChtKSA9PiAoe1xuICAgICAga2V5OiBgbW9kdWxlOiR7bS5pZH1gLFxuICAgICAgaWNvbjogbS5pY29uLFxuICAgICAgdGl0bGU6IG0ubGFiZWwsXG4gICAgICBzdWJ0aXRsZTogbS5kZXNjcmlwdGlvbixcbiAgICAgIGJhZGdlOiAn5Yqf6IO9JyxcbiAgICAgIGFjdGlvbjogeyB0eXBlOiAnbW9kdWxlJywgbW9kdWxlSWQ6IG0uaWQsIHBhdGg6IG0ucGF0aCB9IHNhdGlzZmllcyBDb21tYW5kQWN0aW9uXG4gICAgfSkpLFxuICAgIC4uLlBFTkRJTkdfTU9EVUxFUy5tYXAoKHApID0+ICh7XG4gICAgICBrZXk6IGBtb2R1bGU6JHtwLmlkfWAsXG4gICAgICBpY29uOiBwLmljb24sXG4gICAgICB0aXRsZTogcC5sYWJlbCxcbiAgICAgIHN1YnRpdGxlOiBwLmRlc2NyaXB0aW9uLFxuICAgICAgYmFkZ2U6ICflip/og70nLFxuICAgICAgYWN0aW9uOiB7IHR5cGU6ICdtb2R1bGUnLCBtb2R1bGVJZDogcC5pZCwgcGF0aDogcC5wYXRoIH0gc2F0aXNmaWVzIENvbW1hbmRBY3Rpb25cbiAgICB9KSksXG4gICAgLi4uU1lTVEVNX1BBR0VTLm1hcCgocCkgPT4gKHtcbiAgICAgIGtleTogYHBhZ2U6JHtwLmlkfWAsXG4gICAgICBpY29uOiBwLmljb24sXG4gICAgICB0aXRsZTogcC5sYWJlbCxcbiAgICAgIHN1YnRpdGxlOiBwLmRlc2NyaXB0aW9uLFxuICAgICAgYmFkZ2U6ICfpobXpnaInLFxuICAgICAgYWN0aW9uOiB7IHR5cGU6ICdwYWdlJywgcGFnZUlkOiBwLmlkLCBwYXRoOiBwLnBhdGggfSBzYXRpc2ZpZXMgQ29tbWFuZEFjdGlvblxuICAgIH0pKSxcbiAgICAuLi5BQ1RJT05fQ09NTUFORFMsXG4gICAgLi4uRklSU1RfUEFSVFlfQ09NTUFORFNcbiAgXVxufVxuXG4vKipcbiAqIOS4uuWQq+S4reaWh+agh+mimOeahOWRveS7pOaDsOaAp+eUn+aIkOaLvOmfs+mmluWtl+avjeWIq+WQje+8iOeVquiMhOmSnyDihpIgZnF677yJ44CCXG4gKiBwaW55aW4tcHJvIOivjeWFuOi+g+Wkp++8jOWKqOaAgSBpbXBvcnQg6YG/5YWN5ouW5oWi6IO25ZuK5YWl5Y+j5YyF77yb55Sf5oiQ5ZCO5Y6f5Zyw5YaZ5YWlIGFsaWFzZXPjgIJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZFBpbnlpbkFsaWFzZXMoZW50cmllczogQ29tbWFuZEVudHJ5W10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgcGVuZGluZyA9IGVudHJpZXMuZmlsdGVyKChlKSA9PiBlLmFsaWFzZXMgPT09IHVuZGVmaW5lZCAmJiAvW1xcdTRlMDAtXFx1OWZhNV0vLnRlc3QoZS50aXRsZSkpXG4gIGlmIChwZW5kaW5nLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBwaW55aW4gfSA9IGF3YWl0IGltcG9ydCgncGlueWluLXBybycpXG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBwZW5kaW5nKSB7XG4gICAgICBjb25zdCBpbml0aWFscyA9IHBpbnlpbihlbnRyeS50aXRsZSwge1xuICAgICAgICBwYXR0ZXJuOiAnZmlyc3QnLFxuICAgICAgICB0b25lVHlwZTogJ25vbmUnLFxuICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICBub25aaDogJ2NvbnNlY3V0aXZlJ1xuICAgICAgfSlcbiAgICAgICAgLmpvaW4oJycpXG4gICAgICAgIC5yZXBsYWNlKC9bXmEtejAtOV0vZ2ksICcnKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgZW50cnkuYWxpYXNlcyA9IGluaXRpYWxzID8gW2luaXRpYWxzXSA6IFtdXG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiDmi7zpn7PlupPliqDovb3lpLHotKXkuI3pmLvloZ7mkJzntKIgKi9cbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFpQkEsU0FBUyxTQUFTLHVCQUF1QjtBQTJCbEMsYUFBTSxpQkFBc0Msb0JBQUksSUFBSSxDQUFDLFlBQVksZ0JBQWdCLENBQUM7QUF3Q2xGLGdCQUFTLGtCQUFrQixLQUFhLEtBQXFCO0FBQ2xFLFNBQU8sSUFBSSxXQUFXLFdBQVcsbUJBQW1CLEdBQUcsQ0FBQztBQUMxRDtBQU9PLGdCQUFTLG9CQUFvQixLQUF1QjtBQUN6RCxNQUFJLE9BQU8sUUFBUSxZQUFZLElBQUksV0FBVyxLQUFLLElBQUksU0FBUyxLQUFNLFFBQU87QUFDN0UsTUFBSTtBQUNGLFVBQU0sU0FBUyxJQUFJLElBQUksR0FBRztBQUMxQixXQUFPLE9BQU8sYUFBYSxXQUFXLE9BQU8sYUFBYTtBQUFBLEVBQzVELFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBNkJPLGFBQU0sZUFBNkI7QUFBQSxFQUN4QztBQUFBLElBQ0UsSUFBSTtBQUFBLElBQ0osV0FBVztBQUFBLElBQ1gsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsYUFBYTtBQUFBLElBQ2IsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBO0FBQUEsSUFDRSxJQUFJO0FBQUEsSUFDSixXQUFXO0FBQUEsSUFDWCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0E7QUFBQSxJQUNFLElBQUk7QUFBQSxJQUNKLFdBQVc7QUFBQSxJQUNYLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLGFBQWE7QUFBQSxJQUNiLE1BQU07QUFBQSxFQUNSO0FBQ0Y7QUFHTyxhQUFNLGtCQUFrQztBQUFBLEVBQzdDO0FBQUEsSUFDRSxLQUFLO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxVQUFVLFFBQVEsbUJBQW1CO0FBQUEsRUFDdkQ7QUFDRjtBQU9PLGFBQU0sdUJBQXVDO0FBQUEsRUFDbEQ7QUFBQSxJQUNFLEtBQUs7QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE9BQU87QUFBQSxJQUNQLFFBQVEsRUFBRSxNQUFNLGNBQWMsTUFBTSxRQUFRO0FBQUEsRUFDOUM7QUFBQSxFQUNBO0FBQUEsSUFDRSxLQUFLO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxjQUFjLE1BQU0sV0FBVztBQUFBLEVBQ2pEO0FBQUEsRUFDQTtBQUFBLElBQ0UsS0FBSztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsT0FBTztBQUFBLElBQ1AsUUFBUSxFQUFFLE1BQU0sY0FBYyxNQUFNLFFBQVE7QUFBQSxFQUM5QztBQUFBLEVBQ0E7QUFBQSxJQUNFLEtBQUs7QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE9BQU87QUFBQSxJQUNQLFFBQVEsRUFBRSxNQUFNLGNBQWMsTUFBTSxRQUFRO0FBQUEsRUFDOUM7QUFBQSxFQUNBO0FBQUEsSUFDRSxLQUFLO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxjQUFjLE1BQU0sYUFBYTtBQUFBLEVBQ25EO0FBQUEsRUFDQTtBQUFBLElBQ0UsS0FBSztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsT0FBTztBQUFBLElBQ1AsUUFBUSxFQUFFLE1BQU0sY0FBYyxNQUFNLFFBQVE7QUFBQSxFQUM5QztBQUFBLEVBQ0E7QUFBQSxJQUNFLEtBQUs7QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE9BQU87QUFBQSxJQUNQLFFBQVEsRUFBRSxNQUFNLGNBQWMsTUFBTSxTQUFTO0FBQUEsRUFDL0M7QUFBQSxFQUNBO0FBQUEsSUFDRSxLQUFLO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxVQUFVO0FBQUEsSUFDVixPQUFPO0FBQUEsSUFDUCxRQUFRLEVBQUUsTUFBTSxjQUFjLE1BQU0sV0FBVztBQUFBLEVBQ2pEO0FBQUEsRUFDQTtBQUFBLElBQ0Us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