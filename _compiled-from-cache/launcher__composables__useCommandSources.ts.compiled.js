import { computed, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import {
  buildQuicklinkCommands,
  buildStaticCommands,
  buildSystemCommands,
  addPinyinAliases
} from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts";
import { findModule } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/modules.ts";
import {
  getAllCommands,
  commandsToEntries,
  initCommandRegistry
} from "/src/commands/CommandLoader.ts";
export function useCommandSources() {
  const pluginCommands = ref([]);
  const dynamicCommands = ref([]);
  const registryEntries = ref([]);
  const registryCommands = ref([]);
  const faviconPaths = ref(/* @__PURE__ */ new Map());
  const aliasEpoch = ref(0);
  const staticCommands = buildStaticCommands();
  async function loadRegistryCommands() {
    try {
      initCommandRegistry();
      const cmds = await getAllCommands();
      registryCommands.value = cmds;
      registryEntries.value = commandsToEntries(cmds);
    } catch (err) {
      console.warn("[Launcher] loadRegistryCommands failed:", err);
    }
  }
  async function loadDynamicCommands() {
    const parts = [];
    try {
      const ids = await window.api.sysCmd.ids();
      parts.push(...buildSystemCommands(ids));
    } catch {
    }
    try {
      const links = await window.api.launcher.quicklinksList();
      parts.push(...buildQuicklinkCommands(links));
      void Promise.allSettled(
        links.map(async (l) => {
          const path = await window.api.launcher.quicklinkFavicon(l.url);
          if (path) faviconPaths.value.set(l.url, path);
        })
      );
    } catch {
    }
    dynamicCommands.value = parts;
  }
  async function loadPluginCommands() {
    try {
      const plugins = await window.api.launcher.listPlugins();
      pluginCommands.value = plugins.filter((p) => p.enabled && Array.isArray(p.commands)).flatMap(
        (p) => p.commands.map((cmd) => ({
          key: `plugin:${p.id}:${cmd.code}`,
          icon: "plug-2",
          title: cmd.title,
          subtitle: `${p.name}${cmd.description ? " · " + cmd.description : ""}`,
          badge: "插件",
          action: { type: "plugin", pluginId: p.id, cmd: cmd.code }
        }))
      );
    } catch {
    }
  }
  async function enrichAliases() {
    const all = [...registryEntries.value, ...staticCommands, ...pluginCommands.value];
    await addPinyinAliases(all);
    try {
      const userAliases = await window.api.alias.getAll();
      for (const entry of all) {
        const custom = userAliases[entry.key];
        if (custom && custom.length > 0) {
          entry.aliases = [...entry.aliases ?? [], ...custom];
        }
      }
    } catch {
    }
    aliasEpoch.value++;
  }
  function faviconOf(entry) {
    if (entry.action.type !== "quicklink") return null;
    return faviconPaths.value.get(entry.action.url) ?? null;
  }
  function iconBg(entry) {
    const type = entry.action.type;
    const bgMap = {
      app: "#FF6B6B",
      system: "#4ECDC4",
      module: "#45B7D1",
      quicklink: "#96CEB4",
      file: "#FFEAA7",
      clipboardItem: "#DDA0DD",
      snippetItem: "#98D8C8",
      ai: "#BB8FCE",
      searchQuery: "#85C1E9",
      openUrl: "#6C9BD1"
    };
    return bgMap[type] ?? "#AAB7B8";
  }
  const entries = computed(() => {
    void aliasEpoch.value;
    return [
      ...registryEntries.value,
      // 阶段1.1：统一 Registry（应用 + 系统 + 第一方）
      ...staticCommands,
      // 保留：模块命令等尚未迁移的部分
      ...pluginCommands.value,
      ...dynamicCommands.value
    ];
  });
  return {
    pluginCommands,
    dynamicCommands,
    registryEntries,
    registryCommands,
    faviconPaths,
    staticCommands,
    loadRegistryCommands,
    loadDynamicCommands,
    loadPluginCommands,
    enrichAliases,
    faviconOf,
    iconBg,
    entries
  };
}
export function moduleToEntry(id) {
  const m = findModule(id);
  return m ? {
    key: `module:${m.id}`,
    icon: m.icon,
    title: m.label,
    subtitle: m.description,
    badge: "功能",
    action: { type: "module", moduleId: m.id, path: m.path }
  } : null;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUNvbW1hbmRTb3VyY2VzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDog7blm4rlkb3ku6TmupDogZrlkIjvvIjoh6ogTGF1bmNoZXJBcHAudnVlIOaKveWHuu+8iVxuICpcbiAqIOWbm+S4quadpea6kO+8mue7n+S4gCBSZWdpc3Ryee+8iOW6lOeUqCvns7vnu58r56ys5LiA5pa577yJLyDpnZnmgIHms6jlhozooaggLyDmj5Lku7blkb3ku6QgL1xuICog5Yqo5oCB5ZG95Luk77yI57O757uf5ZG95LukICsgUXVpY2tsaW5rc++8ieOAguWIq+WQje+8iOaLvOmfs+mmluWtl+avjSArIOeUqOaIt+iHquWumuS5ie+8ieWwsee7quWQjlxuICogYnVtcCBhbGlhc0Vwb2NoIOinpuWPkSBlbnRyaWVzIOmHjeeul+OAglxuICovXG5pbXBvcnQgeyBjb21wdXRlZCwgcmVmIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHtcbiAgYnVpbGRRdWlja2xpbmtDb21tYW5kcyxcbiAgYnVpbGRTdGF0aWNDb21tYW5kcyxcbiAgYnVpbGRTeXN0ZW1Db21tYW5kcyxcbiAgYWRkUGlueWluQWxpYXNlcyxcbiAgdHlwZSBDb21tYW5kRW50cnlcbn0gZnJvbSAnQHNoYXJlZC9jb21tYW5kcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZCB9IGZyb20gJ0BzaGFyZWQvY29tbWFuZFJlZ2lzdHJ5J1xuaW1wb3J0IHsgZmluZE1vZHVsZSwgdHlwZSBNb2R1bGVNZXRhIH0gZnJvbSAnQHNoYXJlZC9tb2R1bGVzJ1xuaW1wb3J0IHtcbiAgZ2V0QWxsQ29tbWFuZHMsXG4gIGNvbW1hbmRzVG9FbnRyaWVzLFxuICBpbml0Q29tbWFuZFJlZ2lzdHJ5XG59IGZyb20gJ0ByZW5kZXJlci9jb21tYW5kcy9Db21tYW5kTG9hZGVyJ1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlQ29tbWFuZFNvdXJjZXMoKSB7XG4gIC8qKiDmj5Lku7blkb3ku6TvvIjmr4/mrKHllKTotbfliLfmlrDvvIznrqHnkIbpobXoo4Uv5YGc5o+S5Lu25ZCO56uL5Y2z55Sf5pWI77yJICovXG4gIGNvbnN0IHBsdWdpbkNvbW1hbmRzID0gcmVmPENvbW1hbmRFbnRyeVtdPihbXSlcblxuICAvKiog57O757uf5ZG95LukIC8g56qX5Y+j566h55CGIC8gUXVpY2tsaW5rc++8iE0y77yM5oyJ5bmz5Y+w5LiO55So5oi36YWN572u5Yqo5oCB55Sf5oiQ77yJICovXG4gIGNvbnN0IGR5bmFtaWNDb21tYW5kcyA9IHJlZjxDb21tYW5kRW50cnlbXT4oW10pXG5cbiAgLyoqIOmYtuautTEuMe+8mue7n+S4gCBDb21tYW5kIFJlZ2lzdHJ5IOWRveS7pO+8iOW6lOeUqCArIOezu+e7nyArIOesrOS4gOaWue+8iSAqL1xuICBjb25zdCByZWdpc3RyeUVudHJpZXMgPSByZWY8Q29tbWFuZEVudHJ5W10+KFtdKVxuICAvKiog5Y6f5aeLIENvbW1hbmQg5a+56LGh77yI55So5LqO6I635Y+WIGRldGFpbO+8iSAqL1xuICBjb25zdCByZWdpc3RyeUNvbW1hbmRzID0gcmVmPENvbW1hbmRbXT4oW10pXG5cbiAgLyoqIHF1aWNrbGluayBVUkwg4oaSIGZhdmljb24g5pys5Zyw57yT5a2Y6Lev5b6E77yIaW1hZ2U6Ly8g5Yqg6L2977yb5peg5YiZ5Zue6YCAIGxpbmsg5Zu+5qCH77yJICovXG4gIGNvbnN0IGZhdmljb25QYXRocyA9IHJlZjxNYXA8c3RyaW5nLCBzdHJpbmc+PihuZXcgTWFwKCkpXG5cbiAgLyoqIOWIq+WQje+8iOaLvOmfs+mmluWtl+avje+8ieWwsee7quagh+iusO+8mmVucmljaCDlrozmiJDlkI4gYnVtcCDop6blj5Hnu5Pmnpzph43nrpfvvIhNMS4x77yJICovXG4gIGNvbnN0IGFsaWFzRXBvY2ggPSByZWYoMClcblxuICAvKiog6Z2Z5oCB5ZG95Luk77yI5qih5Z2XICsg57O757uf6aG1ICsg5Yqo5L2c77yJ5p2l6IeqIHNoYXJlZCDms6jlhozooaggKi9cbiAgY29uc3Qgc3RhdGljQ29tbWFuZHMgPSBidWlsZFN0YXRpY0NvbW1hbmRzKClcblxuICBhc3luYyBmdW5jdGlvbiBsb2FkUmVnaXN0cnlDb21tYW5kcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgaW5pdENvbW1hbmRSZWdpc3RyeSgpXG4gICAgICBjb25zdCBjbWRzID0gYXdhaXQgZ2V0QWxsQ29tbWFuZHMoKVxuICAgICAgcmVnaXN0cnlDb21tYW5kcy52YWx1ZSA9IGNtZHNcbiAgICAgIHJlZ2lzdHJ5RW50cmllcy52YWx1ZSA9IGNvbW1hbmRzVG9FbnRyaWVzKGNtZHMpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tMYXVuY2hlcl0gbG9hZFJlZ2lzdHJ5Q29tbWFuZHMgZmFpbGVkOicsIGVycilcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBsb2FkRHluYW1pY0NvbW1hbmRzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHBhcnRzOiBDb21tYW5kRW50cnlbXSA9IFtdXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGlkcyA9IGF3YWl0IHdpbmRvdy5hcGkuc3lzQ21kLmlkcygpXG4gICAgICBwYXJ0cy5wdXNoKC4uLmJ1aWxkU3lzdGVtQ29tbWFuZHMoaWRzKSlcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIOezu+e7n+WRveS7pOaemuS4vuWksei0peS4jemYu+WhnuWFtuS7luadpea6kCAqL1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgbGlua3MgPSBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLnF1aWNrbGlua3NMaXN0KClcbiAgICAgIHBhcnRzLnB1c2goLi4uYnVpbGRRdWlja2xpbmtDb21tYW5kcyhsaW5rcykpXG4gICAgICAvLyBmYXZpY29uIOW8guatpeihpem9kO+8muWFiOaYvuekuumAmueUqCBsaW5rIOWbvuagh++8jOWRveS4ree8k+WtmC/kuIvovb3lrozmiJDlkI7mm7/mjaJcbiAgICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgICBsaW5rcy5tYXAoYXN5bmMgKGwpID0+IHtcbiAgICAgICAgICBjb25zdCBwYXRoID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5xdWlja2xpbmtGYXZpY29uKGwudXJsKVxuICAgICAgICAgIGlmIChwYXRoKSBmYXZpY29uUGF0aHMudmFsdWUuc2V0KGwudXJsLCBwYXRoKVxuICAgICAgICB9KVxuICAgICAgKVxuICAgIH0gY2F0Y2gge1xuICAgICAgLyogUXVpY2tsaW5rcyDor7vlj5blpLHotKXkuI3pmLvloZ7lhbbku5bmnaXmupAgKi9cbiAgICB9XG4gICAgZHluYW1pY0NvbW1hbmRzLnZhbHVlID0gcGFydHNcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGxvYWRQbHVnaW5Db21tYW5kcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGx1Z2lucyA9IChhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLmxpc3RQbHVnaW5zKCkpIGFzIEFycmF5PHtcbiAgICAgICAgaWQ6IHN0cmluZ1xuICAgICAgICBuYW1lOiBzdHJpbmdcbiAgICAgICAgZW5hYmxlZDogYm9vbGVhblxuICAgICAgICBjb21tYW5kcz86IEFycmF5PHsgY29kZTogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyBkZXNjcmlwdGlvbj86IHN0cmluZyB9PlxuICAgICAgfT5cbiAgICAgIHBsdWdpbkNvbW1hbmRzLnZhbHVlID0gcGx1Z2luc1xuICAgICAgICAuZmlsdGVyKChwKSA9PiBwLmVuYWJsZWQgJiYgQXJyYXkuaXNBcnJheShwLmNvbW1hbmRzKSlcbiAgICAgICAgLmZsYXRNYXAoKHApID0+XG4gICAgICAgICAgcC5jb21tYW5kcyEubWFwKChjbWQpID0+ICh7XG4gICAgICAgICAgICBrZXk6IGBwbHVnaW46JHtwLmlkfToke2NtZC5jb2RlfWAsXG4gICAgICAgICAgICBpY29uOiAncGx1Zy0yJyxcbiAgICAgICAgICAgIHRpdGxlOiBjbWQudGl0bGUsXG4gICAgICAgICAgICBzdWJ0aXRsZTogYCR7cC5uYW1lfSR7Y21kLmRlc2NyaXB0aW9uID8gJyDCtyAnICsgY21kLmRlc2NyaXB0aW9uIDogJyd9YCxcbiAgICAgICAgICAgIGJhZGdlOiAn5o+S5Lu2JyxcbiAgICAgICAgICAgIGFjdGlvbjogeyB0eXBlOiAncGx1Z2luJyBhcyBjb25zdCwgcGx1Z2luSWQ6IHAuaWQsIGNtZDogY21kLmNvZGUgfVxuICAgICAgICAgIH0pKVxuICAgICAgICApXG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiDmj5Lku7bliJfooajor7vlj5blpLHotKXkuI3pmLvloZ7lhoXnva7mkJzntKIgKi9cbiAgICB9XG4gIH1cblxuICAvKiog5Yir5ZCN5oOw5oCn6KGl6b2Q77yITTEuMSArIFAyLTjvvInvvJrmi7zpn7PpppblrZfmr40gKyDnlKjmiLfoh6rlrprkuYnliKvlkI0gKi9cbiAgYXN5bmMgZnVuY3Rpb24gZW5yaWNoQWxpYXNlcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhbGwgPSBbLi4ucmVnaXN0cnlFbnRyaWVzLnZhbHVlLCAuLi5zdGF0aWNDb21tYW5kcywgLi4ucGx1Z2luQ29tbWFuZHMudmFsdWVdXG4gICAgYXdhaXQgYWRkUGlueWluQWxpYXNlcyhhbGwpXG4gICAgLy8gUDItOO+8muWQiOW5tueUqOaIt+iHquWumuS5ieWIq+WQje+8iGtleSA9IOWRveS7pCBrZXnvvIlcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlckFsaWFzZXMgPSAoYXdhaXQgd2luZG93LmFwaS5hbGlhcy5nZXRBbGwoKSkgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nW10+XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGFsbCkge1xuICAgICAgICBjb25zdCBjdXN0b20gPSB1c2VyQWxpYXNlc1tlbnRyeS5rZXldXG4gICAgICAgIGlmIChjdXN0b20gJiYgY3VzdG9tLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBlbnRyeS5hbGlhc2VzID0gWy4uLihlbnRyeS5hbGlhc2VzID8/IFtdKSwgLi4uY3VzdG9tXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiDliKvlkI3or7vlj5blpLHotKXkuI3lvbHlk43mi7zpn7PliKvlkI0gKi9cbiAgICB9XG4gICAgYWxpYXNFcG9jaC52YWx1ZSsrXG4gIH1cblxuICBmdW5jdGlvbiBmYXZpY29uT2YoZW50cnk6IENvbW1hbmRFbnRyeSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChlbnRyeS5hY3Rpb24udHlwZSAhPT0gJ3F1aWNrbGluaycpIHJldHVybiBudWxsXG4gICAgcmV0dXJuIGZhdmljb25QYXRocy52YWx1ZS5nZXQoZW50cnkuYWN0aW9uLnVybCkgPz8gbnVsbFxuICB9XG5cbiAgLyoqIFJheWNhc3Qg6aOO5qC877ya5oyJ5ZG95Luk57G75Z6L57uZ5Zu+5qCH5pa55b2i6IOM5pmv5LiK6ImyICovXG4gIGZ1bmN0aW9uIGljb25CZyhlbnRyeTogQ29tbWFuZEVudHJ5KTogc3RyaW5nIHtcbiAgICBjb25zdCB0eXBlID0gZW50cnkuYWN0aW9uLnR5cGVcbiAgICBjb25zdCBiZ01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIGFwcDogJyNGRjZCNkInLFxuICAgICAgc3lzdGVtOiAnIzRFQ0RDNCcsXG4gICAgICBtb2R1bGU6ICcjNDVCN0QxJyxcbiAgICAgIHF1aWNrbGluazogJyM5NkNFQjQnLFxuICAgICAgZmlsZTogJyNGRkVBQTcnLFxuICAgICAgY2xpcGJvYXJkSXRlbTogJyNEREEwREQnLFxuICAgICAgc25pcHBldEl0ZW06ICcjOThEOEM4JyxcbiAgICAgIGFpOiAnI0JCOEZDRScsXG4gICAgICBzZWFyY2hRdWVyeTogJyM4NUMxRTknLFxuICAgICAgb3BlblVybDogJyM2QzlCRDEnXG4gICAgfVxuICAgIHJldHVybiBiZ01hcFt0eXBlXSA/PyAnI0FBQjdCOCdcbiAgfVxuXG4gIGNvbnN0IGVudHJpZXMgPSBjb21wdXRlZDxDb21tYW5kRW50cnlbXT4oKCkgPT4ge1xuICAgIHZvaWQgYWxpYXNFcG9jaC52YWx1ZSAvLyDliKvlkI3lvILmraXlsLHnu6rlkI7ph43nrpdcbiAgICByZXR1cm4gW1xuICAgICAgLi4ucmVnaXN0cnlFbnRyaWVzLnZhbHVlLCAvLyDpmLbmrrUxLjHvvJrnu5/kuIAgUmVnaXN0cnnvvIjlupTnlKggKyDns7vnu58gKyDnrKzkuIDmlrnvvIlcbiAgICAgIC4uLnN0YXRpY0NvbW1hbmRzLCAvLyDkv53nlZnvvJrmqKHlnZflkb3ku6TnrYnlsJrmnKrov4Hnp7vnmoTpg6jliIZcbiAgICAgIC4uLnBsdWdpbkNvbW1hbmRzLnZhbHVlLFxuICAgICAgLi4uZHluYW1pY0NvbW1hbmRzLnZhbHVlXG4gICAgXVxuICB9KVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luQ29tbWFuZHMsXG4gICAgZHluYW1pY0NvbW1hbmRzLFxuICAgIHJlZ2lzdHJ5RW50cmllcyxcbiAgICByZWdpc3RyeUNvbW1hbmRzLFxuICAgIGZhdmljb25QYXRocyxcbiAgICBzdGF0aWNDb21tYW5kcyxcbiAgICBsb2FkUmVnaXN0cnlDb21tYW5kcyxcbiAgICBsb2FkRHluYW1pY0NvbW1hbmRzLFxuICAgIGxvYWRQbHVnaW5Db21tYW5kcyxcbiAgICBlbnJpY2hBbGlhc2VzLFxuICAgIGZhdmljb25PZixcbiAgICBpY29uQmcsXG4gICAgZW50cmllc1xuICB9XG59XG5cbi8qKiDmqKHlnZcg4oaSIOWRveS7pOadoeebru+8iOW7uuiuruWIl+ihqOeUqO+8ie+8m+aJvuS4jeWIsOaooeWdl+i/lOWbniBudWxsICovXG5leHBvcnQgZnVuY3Rpb24gbW9kdWxlVG9FbnRyeShpZDogc3RyaW5nKTogQ29tbWFuZEVudHJ5IHwgbnVsbCB7XG4gIGNvbnN0IG06IE1vZHVsZU1ldGEgfCB1bmRlZmluZWQgPSBmaW5kTW9kdWxlKGlkKVxuICByZXR1cm4gbVxuICAgID8ge1xuICAgICAgICBrZXk6IGBtb2R1bGU6JHttLmlkfWAsXG4gICAgICAgIGljb246IG0uaWNvbixcbiAgICAgICAgdGl0bGU6IG0ubGFiZWwsXG4gICAgICAgIHN1YnRpdGxlOiBtLmRlc2NyaXB0aW9uLFxuICAgICAgICBiYWRnZTogJ+WKn+iDvScsXG4gICAgICAgIGFjdGlvbjogeyB0eXBlOiAnbW9kdWxlJywgbW9kdWxlSWQ6IG0uaWQsIHBhdGg6IG0ucGF0aCB9XG4gICAgICB9XG4gICAgOiBudWxsXG59XG4iXSwibWFwcGluZ3MiOiJBQU9BLFNBQVMsVUFBVSxXQUFXO0FBQzlCO0FBQUEsRUFDRTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BRUs7QUFFUCxTQUFTLGtCQUFtQztBQUM1QztBQUFBLEVBQ0U7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BQ0s7QUFFQSxnQkFBUyxvQkFBb0I7QUFFbEMsUUFBTSxpQkFBaUIsSUFBb0IsQ0FBQyxDQUFDO0FBRzdDLFFBQU0sa0JBQWtCLElBQW9CLENBQUMsQ0FBQztBQUc5QyxRQUFNLGtCQUFrQixJQUFvQixDQUFDLENBQUM7QUFFOUMsUUFBTSxtQkFBbUIsSUFBZSxDQUFDLENBQUM7QUFHMUMsUUFBTSxlQUFlLElBQXlCLG9CQUFJLElBQUksQ0FBQztBQUd2RCxRQUFNLGFBQWEsSUFBSSxDQUFDO0FBR3hCLFFBQU0saUJBQWlCLG9CQUFvQjtBQUUzQyxpQkFBZSx1QkFBc0M7QUFDbkQsUUFBSTtBQUNGLDBCQUFvQjtBQUNwQixZQUFNLE9BQU8sTUFBTSxlQUFlO0FBQ2xDLHVCQUFpQixRQUFRO0FBQ3pCLHNCQUFnQixRQUFRLGtCQUFrQixJQUFJO0FBQUEsSUFDaEQsU0FBUyxLQUFLO0FBQ1osY0FBUSxLQUFLLDJDQUEyQyxHQUFHO0FBQUEsSUFDN0Q7QUFBQSxFQUNGO0FBRUEsaUJBQWUsc0JBQXFDO0FBQ2xELFVBQU0sUUFBd0IsQ0FBQztBQUMvQixRQUFJO0FBQ0YsWUFBTSxNQUFNLE1BQU0sT0FBTyxJQUFJLE9BQU8sSUFBSTtBQUN4QyxZQUFNLEtBQUssR0FBRyxvQkFBb0IsR0FBRyxDQUFDO0FBQUEsSUFDeEMsUUFBUTtBQUFBLElBRVI7QUFDQSxR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