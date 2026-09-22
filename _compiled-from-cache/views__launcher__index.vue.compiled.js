import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/launcher/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import AppIcon from "/src/components/AppIcon.vue";
import UBadge from "/src/components/ui/UBadge.vue";
import UButton from "/src/components/ui/UButton.vue";
import UEmpty from "/src/components/ui/UEmpty.vue";
import { useToast } from "/src/composables/useToast.ts";
import { buildStaticCommands } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    const toast = useToast();
    const plugins = ref([]);
    const importing = ref(false);
    function openPluginsDir() {
      window.api.launcher.openPluginsDir();
    }
    async function refresh() {
      try {
        plugins.value = await window.api.launcher.listPlugins();
      } catch {
        toast.error("读取插件列表失败");
      }
    }
    async function onImport() {
      importing.value = true;
      try {
        const picked = await window.api.launcher.selectPluginFolder();
        if (!picked.success || !picked.dirPath) return;
        const result = await window.api.launcher.installFromFolder(picked.dirPath);
        if (result.success) {
          toast.success(`已导入 ${result.plugin?.name ?? "插件"}`);
          await refresh();
        } else {
          toast.error("导入失败", { description: result.error });
        }
      } catch (error) {
        toast.error("导入失败", { description: error.message });
      } finally {
        importing.value = false;
      }
    }
    const market = ref([]);
    const marketLoading = ref(false);
    const installingId = ref(null);
    async function refreshMarket() {
      marketLoading.value = true;
      try {
        market.value = await window.api.launcher.marketList();
      } catch {
      } finally {
        marketLoading.value = false;
      }
    }
    async function onMarketInstall(entry) {
      installingId.value = entry.id;
      try {
        const result = await window.api.launcher.marketInstall(entry.id);
        if (result.success) {
          toast.success(`已安装 ${result.plugin?.name ?? entry.name}`);
          await Promise.all([refresh(), refreshMarket()]);
        } else {
          toast.error("安装失败", { description: result.error });
        }
      } catch (error) {
        toast.error("安装失败", { description: error.message });
      } finally {
        installingId.value = null;
      }
    }
    function devChannels() {
      const api = window.api.launcher;
      return typeof api.devPluginsList === "function" ? api : null;
    }
    async function onMarketUpdate(entry) {
      const api = devChannels();
      if (!api || typeof api.marketUpdate !== "function") {
        toast.error("更新通道未就绪", { description: "需要包含 marketUpdate 绑定的 preload" });
        return;
      }
      installingId.value = entry.id;
      try {
        const result = await api.marketUpdate(entry.id);
        if (result.success) {
          toast.success(
            `已更新 ${result.plugin?.name ?? entry.name}` + (result.plugin?.version ? ` → v${result.plugin.version}` : "")
          );
          await Promise.all([refresh(), refreshMarket()]);
        } else {
          toast.error("更新失败", { description: result.error });
        }
      } catch (error) {
        toast.error("更新失败", { description: error.message });
      } finally {
        installingId.value = null;
      }
    }
    const devPlugins = ref([]);
    const devAdding = ref(false);
    const devReloadingId = ref(null);
    let offDevChanged = null;
    async function refreshDevPlugins() {
      const api = devChannels();
      if (!api) return;
      try {
        devPlugins.value = await api.devPluginsList();
      } catch {
      }
    }
    async function onAddDevPlugin() {
      const api = devChannels();
      if (!api) {
        toast.error("开发者通道未就绪", { description: "需要包含 devPlugins 绑定的 preload" });
        return;
      }
      devAdding.value = true;
      try {
        const picked = await window.api.launcher.selectPluginFolder();
        if (!picked.success || !picked.dirPath) return;
        const result = await api.devPluginsAdd(picked.dirPath);
        if (result.ok) {
          toast.success(`已注册开发目录：${result.plugin?.name ?? result.plugin?.id ?? ""}`);
          await Promise.all([refresh(), refreshDevPlugins(), refreshMarket()]);
        } else {
          toast.error("注册失败", { description: result.error });
        }
      } catch (error) {
        toast.error("注册失败", { description: error.message });
      } finally {
        devAdding.value = false;
      }
    }
    async function onDevAutoReload(d, autoReload) {
      const api = devChannels();
      if (!api) return;
      const result = await api.devPluginsSetAutoReload(d.pluginId, autoReload);
      if (result.ok) {
        await refreshDevPlugins();
      } else {
        toast.error("设置失败", { description: result.error });
        await refreshDevPlugins();
      }
    }
    async function onDevReload(d) {
      const api = devChannels();
      if (!api) return;
      devReloadingId.value = d.pluginId;
      try {
        const result = await api.devPluginsReload(d.pluginId);
        if (result.ok) {
          toast.success(`已重载 ${result.plugin?.name ?? d.name ?? d.pluginId}`);
          await Promise.all([refresh(), refreshDevPlugins(), refreshMarket()]);
        } else {
          toast.error("重载失败", { description: result.error });
        }
      } catch (error) {
        toast.error("重载失败", { description: error.message });
      } finally {
        devReloadingId.value = null;
      }
    }
    async function onDevRemove(d) {
      const api = devChannels();
      if (!api) return;
      const result = await api.devPluginsRemove(d.pluginId);
      if (result.ok) {
        toast.success(`已移除开发跟踪：${d.name || d.pluginId}（插件保留已安装）`);
        await refreshDevPlugins();
      } else {
        toast.error("移除失败", { description: result.error });
      }
    }
    const prefsOpen = ref(null);
    const prefValues = ref({});
    const prefSaving = ref(false);
    async function togglePrefs(pluginId) {
      if (prefsOpen.value === pluginId) {
        prefsOpen.value = null;
        return;
      }
      const plugin = plugins.value.find((p) => p.id === pluginId);
      if (!plugin) return;
      for (const pref of plugin.preferences ?? []) {
        const key = pluginId + "." + pref.name;
        try {
          const result = await window.api.launcher.getPreference(pluginId, pref.name);
          prefValues.value[key] = result?.value ?? pref.default ?? "";
        } catch {
          prefValues.value[key] = pref.default ?? "";
        }
      }
      prefsOpen.value = pluginId;
    }
    async function savePrefs(pluginId) {
      prefSaving.value = true;
      try {
        const plugin = plugins.value.find((p) => p.id === pluginId);
        if (!plugin) return;
        for (const pref of plugin.preferences ?? []) {
          const key = pluginId + "." + pref.name;
          await window.api.launcher.setPreference(pluginId, pref.name, prefValues.value[key]);
        }
        toast.success("偏好已保存");
      } catch {
        toast.error("偏好保存失败");
      } finally {
        prefSaving.value = false;
      }
    }
    const hotkeyConfig = ref({
      main: "Alt+Space",
      commands: {}
    });
    const recording = ref(null);
    function specOfCommand(entry) {
      const a = entry.action;
      switch (a.type) {
        case "module":
          return { kind: "module", id: a.moduleId, path: a.path };
        case "page":
          return { kind: "module", id: a.pageId, path: a.path };
        case "action":
          return a.action === "screenshot.start" ? { kind: "screenshot" } : null;
        case "system":
          return { kind: "system", id: a.cmdId };
        case "quicklink":
          return { kind: "quicklink", url: a.url };
        case "firstParty":
          return { kind: "firstParty", id: a.page };
        default:
          return null;
      }
    }
    const hotkeyCommands = computed(() => {
      const specs = buildStaticCommands();
      return specs.map((entry) => {
        const spec = specOfCommand(entry);
        const bound = spec ? Object.entries(hotkeyConfig.value.commands).filter(([, s]) => JSON.stringify(s) === JSON.stringify(spec)).map(([accel]) => accel) : [];
        return { entry, spec, bound: bound.length > 0 ? bound : null };
      }).filter((row) => row.spec !== null);
    });
    async function refreshHotkeys() {
      try {
        hotkeyConfig.value = await window.api.launcher.hotkeysGetConfig();
      } catch {
      }
    }
    function chordLetterOf(entry) {
      const spec = specOfCommand(entry);
      if (!spec) return "";
      const found = Object.entries(hotkeyConfig.value.chords ?? {}).find(
        ([, s]) => JSON.stringify(s) === JSON.stringify(spec)
      );
      return found?.[0] ?? "";
    }
    async function setChordLetter(entry, letter) {
      const spec = specOfCommand(entry);
      if (!spec) return;
      const l = letter.trim().toLowerCase();
      if (l && !/^[a-z]$/.test(l)) {
        toast.error("两段式字母只能是 a-z");
        await refreshHotkeys();
        return;
      }
      try {
        await window.api.launcher.hotkeysSetChord(l, l ? spec : null);
        await refreshHotkeys();
      } catch {
        toast.error("两段式配置失败");
      }
    }
    const expansionEnabled = ref(false);
    const expansionTriggerCount = ref(0);
    const expansionHookOk = ref(true);
    const probing = ref(false);
    const probeFailed = ref(false);
    async function refreshExpansion() {
      try {
        const cfg = await window.api.launcher.expansionGetConfig();
        expansionEnabled.value = cfg.enabled;
        expansionTriggerCount.value = cfg.triggerCount;
        expansionHookOk.value = cfg.hookAvailable;
      } catch {
      }
    }
    watch(expansionEnabled, async (enabled) => {
      try {
        await window.api.launcher.expansionSetConfig({ enabled });
      } catch {
        toast.error("扩展开关保存失败");
      }
    });
    async function onProbePermission() {
      probing.value = true;
      toast.info?.("请在 4 秒内按下任意键（如空格）…");
      try {
        const result = await window.api.launcher.expansionProbe();
        if (result.received) {
          probeFailed.value = false;
          expansionHookOk.value = true;
          toast.success("全局按键监听正常，文本扩展可用");
        } else {
          probeFailed.value = true;
          expansionHookOk.value = false;
          toast.error("未捕获到按键：需要「辅助功能」授权", {
            description: "打开授权设置，把 Leaf 加入辅助功能列表后重试"
          });
        }
      } catch {
        toast.error("诊断失败");
      } finally {
        probing.value = false;
      }
    }
    function openA11ySettings() {
      if (/Mac/i.test(navigator.platform)) {
        void window.api.system.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        );
      }
    }
    function startRecording(type, key) {
      recording.value = { type, key };
    }
    function eventToAccelerator(e) {
      const MODIFIER_KEYS = ["Control", "Meta", "Alt", "Shift", "AltGraph", "CapsLock", "Dead"];
      if (MODIFIER_KEYS.includes(e.key)) return null;
      const parts = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.metaKey) parts.push("Command");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (parts.length === 0) return null;
      const keyMap = {
        " ": "Space",
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        Escape: "Esc"
      };
      const key = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      return [...parts, key].join("+");
    }
    async function onRecordingKeydown(e) {
      if (!recording.value) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        recording.value = null;
        return;
      }
      const accel = eventToAccelerator(e);
      if (!accel) return;
      try {
        if (recording.value.type === "main") {
          await window.api.launcher.hotkeysSetMain(accel);
          toast.success(`主热键已设为 ${accel}`);
        } else {
          const entry = hotkeyCommands.value.find((r) => r.entry.key === recording.value?.key);
          if (entry?.spec) {
            await window.api.launcher.hotkeysSetCommand(accel, entry.spec);
            toast.success(`${entry.entry.title} 已绑定 ${accel}`);
          }
        }
        await refreshHotkeys();
      } catch {
        toast.error("热键设置失败");
      } finally {
        recording.value = null;
      }
    }
    async function removeCommandHotkey(accel) {
      await window.api.launcher.hotkeysSetCommand(accel, null);
      await refreshHotkeys();
    }
    const quicklinks = ref([]);
    const qlSaving = ref(false);
    async function refreshQuicklinks() {
      try {
        quicklinks.value = await window.api.launcher.quicklinksList();
      } catch {
      }
    }
    function addQuicklink() {
      quicklinks.value.push({
        id: `ql-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: "",
        url: "https://"
      });
    }
    async function removeQuicklink(link) {
      quicklinks.value = quicklinks.value.filter((l) => l.id !== link.id);
      await saveQuicklinks();
    }
    async function saveQuicklinks() {
      qlSaving.value = true;
      try {
        const items = quicklinks.value.filter((l) => l.name.trim() && /^https?:\/\//.test(l.url.trim())).map((l) => ({ id: l.id, name: l.name.trim(), url: l.url.trim() }));
        await window.api.launcher.quicklinksSave(items);
        quicklinks.value = items;
        toast.success("快捷链接已保存");
      } catch {
        toast.error("保存失败");
      } finally {
        qlSaving.value = false;
      }
    }
    async function onToggle(p) {
      const result = await window.api.launcher.setPluginEnabled(p.id, !p.enabled);
      if (result.success) {
        await refresh();
      } else {
        toast.error("操作失败");
      }
    }
    async function onRemove(p) {
      if (!window.confirm(`确定卸载插件「${p.name}」？其数据目录将被删除。`)) return;
      const result = await window.api.launcher.removePlugin(p.id);
      if (result.success) {
        toast.success(`已卸载 ${p.name}`);
        await refresh();
      } else {
        toast.error("卸载失败", { description: result.error });
      }
    }
    function onTryRun(p) {
      const cmd = p.commands?.[0]?.code;
      window.api.launcher.openPlugin(p.id, cmd);
    }
    const syncForm = ref({ url: "", username: "", password: "", remoteDir: "/leaf-launcher" });
    const syncTesting = ref(false);
    const syncBacking = ref(false);
    const syncRestoring = ref(false);
    onMounted(async () => {
      void refresh();
      void refreshMarket();
      void refreshQuicklinks();
      void refreshHotkeys();
      void refreshExpansion();
      void refreshDevPlugins();
      window.addEventListener("keydown", onRecordingKeydown, true);
      const devApi = devChannels();
      if (devApi && typeof devApi.onDevPluginsChanged === "function") {
        offDevChanged = devApi.onDevPluginsChanged((payload) => {
          if (payload.kind === "reloaded") {
            toast.success(`已热重载 ${payload.name || payload.pluginId}`);
          } else if (payload.kind === "error") {
            toast.error(`热重载失败：${payload.name || payload.pluginId}`, {
              description: payload.error
            });
          }
          void refresh();
          void refreshDevPlugins();
          void refreshMarket();
        });
      }
      try {
        syncForm.value = await window.api.launcher.syncGetConfig();
      } catch {
      }
    });
    onBeforeUnmount(() => {
      window.removeEventListener("keydown", onRecordingKeydown, true);
      offDevChanged?.();
      offDevChanged = null;
    });
    async function onSyncSaveAndBackup() {
      syncBacking.value = true;
      try {
        await window.api.launcher.syncSetConfig({ ...syncForm.value });
        const result = await window.api.launcher.syncBackup();
        if (result.ok) {
          toast.success(`备份成功（${result.count ?? 0} 条数据）`);
        } else {
          toast.error("备份失败", { description: result.error });
        }
      } finally {
        syncBacking.value = false;
      }
    }
    async function onSyncTest() {
      syncTesting.value = true;
      try {
        const result = await window.api.launcher.syncTest({ ...syncForm.value });
        if (result.ok) {
          toast.success("连接成功");
        } else {
          toast.error("连接失败", { description: result.error });
        }
      } finally {
        syncTesting.value = false;
      }
    }
    async function onSyncRestore() {
      if (!window.confirm("恢复将用云端快照覆盖本地全部插件数据，确定继续？")) return;
      syncRestoring.value = true;
      try {
        const result = await window.api.launcher.syncRestore();
        if (result.ok) {
          toast.success(`恢复成功（${result.count ?? 0} 条数据）`);
        } else {
          toast.error("恢复失败", { description: result.error });
        }
      } finally {
        syncRestoring.value = false;
      }
    }
    const __returned__ = { toast, plugins, importing, openPluginsDir, refresh, onImport, market, marketLoading, installingId, refreshMarket, onMarketInstall, devChannels, onMarketUpdate, devPlugins, devAdding, devReloadingId, get offDevChanged() {
      return offDevChanged;
    }, set offDevChanged(v) {
      offDevChanged = v;
    }, refreshDevPlugins, onAddDevPlugin, onDevAutoReload, onDevReload, onDevRemove, prefsOpen, prefValues, prefSaving, togglePrefs, savePrefs, hotkeyConfig, recording, specOfCommand, hotkeyCommands, refreshHotkeys, chordLetterOf, setChordLetter, expansionEnabled, expansionTriggerCount, expansionHookOk, probing, probeFailed, refreshExpansion, onProbePermission, openA11ySettings, startRecording, eventToAccelerator, onRecordingKeydown, removeCommandHotkey, quicklinks, qlSaving, refreshQuicklinks, addQuicklink, removeQuicklink, saveQuicklinks, onToggle, onRemove, onTryRun, syncForm, syncTesting, syncBacking, syncRestoring, onSyncSaveAndBackup, onSyncTest, onSyncRestore, AppIcon, UBadge, UButton, UEmpty };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, createElementVNode as _createElementVNode, createTextVNode as _createTextVNode, withCtx as _withCtx, openBlock as _openBlock, createElementBlock as _createElementBlock, renderList as _renderList, Fragment as _Fragment, toDisplayString as _toDisplayString, createBlock as _createBlock, vModelSelect as _vModelSelect, withDirectives as _withDirectives, vModelCheckbox as _vModelCheckbox, vModelText as _vModelText, normalizeClass as _normalizeClass, createStaticVNode as _createStaticVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "mx-auto max-w-3xl px-6 py-8" };
const _hoisted_2 = { class: "mb-9" };
const _hoisted_3 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_4 = { class: "flex items-center gap-3 p-4" };
const _hoisted_5 = { class: "flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-fg-brand" };
const _hoisted_6 = { class: "min-w-0 flex-1" };
const _hoisted_7 = { class: "flex items-center gap-2" };
const _hoisted_8 = { class: "mb-9" };
const _hoisted_9 = { class: "mb-3 flex items-center justify-between" };
const _hoisted_10 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_11 = {
  key: 0,
  class: "p-8"
};
const _hoisted_12 = {
  key: 1,
  class: "divide-y divide-line-subtle"
};
const _hoisted_13 = { class: "flex items-center gap-3" };
const _hoisted_14 = { class: "flex size-9 shrink-0 items-center justify-center rounded-md border border-line-subtle bg-surface-2 text-fg-tertiary" };
const _hoisted_15 = { class: "min-w-0 flex-1" };
const _hoisted_16 = { class: "flex items-center gap-2" };
const _hoisted_17 = { class: "truncate text-sm font-medium text-fg-primary" };
const _hoisted_18 = { class: "shrink-0 text-xs text-fg-faint" };
const _hoisted_19 = { class: "mt-0.5 truncate text-xs text-fg-tertiary" };
const _hoisted_20 = { class: "flex shrink-0 items-center gap-1" };
const _hoisted_21 = {
  key: 0,
  class: "mt-3 space-y-2 rounded-md bg-surface-0 p-3"
};
const _hoisted_22 = { class: "w-28 shrink-0 text-xs text-fg-secondary" };
const _hoisted_23 = ["onUpdate:modelValue"];
const _hoisted_24 = ["value"];
const _hoisted_25 = {
  key: 1,
  class: "flex flex-1 items-center gap-2 text-xs text-fg-tertiary"
};
const _hoisted_26 = ["onUpdate:modelValue"];
const _hoisted_27 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_28 = { class: "flex justify-end pt-1" };
const _hoisted_29 = { class: "mb-9" };
const _hoisted_30 = { class: "mb-3 flex items-center justify-between" };
const _hoisted_31 = { class: "flex items-center gap-2" };
const _hoisted_32 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_33 = {
  key: 0,
  class: "p-6"
};
const _hoisted_34 = {
  key: 1,
  class: "divide-y divide-line-subtle"
};
const _hoisted_35 = { class: "flex size-9 shrink-0 items-center justify-center rounded-md border border-line-subtle bg-surface-2 text-fg-tertiary" };
const _hoisted_36 = { class: "min-w-0 flex-1" };
const _hoisted_37 = { class: "flex items-center gap-2" };
const _hoisted_38 = { class: "truncate text-sm font-medium text-fg-primary" };
const _hoisted_39 = { class: "shrink-0 text-xs text-fg-faint" };
const _hoisted_40 = { class: "mt-0.5 truncate text-xs text-fg-tertiary" };
const _hoisted_41 = { class: "mb-9" };
const _hoisted_42 = { class: "mb-3 flex items-center justify-between" };
const _hoisted_43 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_44 = {
  key: 0,
  class: "p-6"
};
const _hoisted_45 = {
  key: 1,
  class: "divide-y divide-line-subtle"
};
const _hoisted_46 = ["onUpdate:modelValue"];
const _hoisted_47 = ["onUpdate:modelValue"];
const _hoisted_48 = {
  key: 2,
  class: "flex justify-end border-t border-line-subtle p-3"
};
const _hoisted_49 = { class: "mb-9" };
const _hoisted_50 = { class: "mb-3 flex items-center justify-between" };
const _hoisted_51 = { class: "flex cursor-pointer items-center gap-2 text-xs text-fg-secondary" };
const _hoisted_52 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_53 = { class: "space-y-2 p-4" };
const _hoisted_54 = { class: "flex items-center justify-between pt-1" };
const _hoisted_55 = { class: "text-xs text-fg-faint" };
const _hoisted_56 = { class: "flex items-center gap-1" };
const _hoisted_57 = { class: "mb-9" };
const _hoisted_58 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_59 = { class: "flex items-center gap-3 border-b border-line-subtle p-4" };
const _hoisted_60 = { class: "flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-fg-brand" };
const _hoisted_61 = { class: "max-h-72 divide-y divide-line-subtle overflow-y-auto" };
const _hoisted_62 = { class: "min-w-0 flex-1" };
const _hoisted_63 = { class: "text-xs font-medium text-fg-primary" };
const _hoisted_64 = { class: "ml-2 text-[10px] text-fg-faint" };
const _hoisted_65 = ["onClick"];
const _hoisted_66 = ["value", "onChange"];
const _hoisted_67 = ["onClick"];
const _hoisted_68 = { class: "mb-9" };
const _hoisted_69 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_70 = { class: "space-y-2 p-4" };
const _hoisted_71 = { class: "grid grid-cols-1 gap-2 sm:grid-cols-2" };
const _hoisted_72 = { class: "flex items-center justify-between pt-1" };
const _hoisted_73 = { class: "flex items-center gap-1" };
const _hoisted_74 = { class: "mb-9" };
const _hoisted_75 = { class: "rounded-md border border-line-subtle bg-surface-1 shadow-sm" };
const _hoisted_76 = { class: "divide-y divide-line-subtle" };
const _hoisted_77 = { class: "flex items-center gap-3 p-4" };
const _hoisted_78 = {
  key: 0,
  class: "divide-y divide-line-subtle border-t border-line-subtle"
};
const _hoisted_79 = { class: "flex items-center gap-3" };
const _hoisted_80 = { class: "min-w-0 flex-1" };
const _hoisted_81 = { class: "flex items-center gap-2" };
const _hoisted_82 = { class: "truncate text-xs font-medium text-fg-primary" };
const _hoisted_83 = {
  key: 0,
  class: "shrink-0 text-[10px] text-fg-faint"
};
const _hoisted_84 = ["title"];
const _hoisted_85 = { class: "flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-fg-secondary" };
const _hoisted_86 = ["checked", "onChange"];
const _hoisted_87 = {
  key: 1,
  class: "border-t border-line-subtle px-4 py-3 text-xs text-fg-faint"
};
const _hoisted_88 = { class: "flex items-start gap-3 p-4" };
const _hoisted_89 = { class: "flex items-center gap-3 p-4" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" ═══ 页头 ═══ "),
    _createElementVNode("section", _hoisted_2, [
      _createElementVNode("div", _hoisted_3, [
        _createElementVNode("div", _hoisted_4, [
          _createElementVNode("div", _hoisted_5, [
            _createVNode($setup["AppIcon"], {
              icon: "search",
              size: 18
            })
          ]),
          _createElementVNode("div", _hoisted_6, [
            _createElementVNode("div", _hoisted_7, [
              _cache[8] || (_cache[8] = _createElementVNode(
                "span",
                { class: "text-sm font-medium text-fg-primary" },
                "启动器",
                -1
                /* CACHED */
              )),
              _createVNode($setup["UBadge"], { variant: "neutral" }, {
                default: _withCtx(() => [..._cache[7] || (_cache[7] = [
                  _createTextVNode(
                    "Alt + Space 唤起",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              })
            ]),
            _cache[9] || (_cache[9] = _createElementVNode(
              "div",
              { class: "mt-0.5 text-xs text-fg-tertiary" },
              " 胶囊搜索窗：搜索应用 / Leaf 功能 / 插件命令，ESC 关闭 ",
              -1
              /* CACHED */
            ))
          ])
        ])
      ])
    ]),
    _createCommentVNode(" ═══ 插件 ═══ "),
    _createElementVNode("section", _hoisted_8, [
      _createElementVNode("div", _hoisted_9, [
        _cache[11] || (_cache[11] = _createElementVNode(
          "h2",
          { class: "text-xs font-medium tracking-wider text-fg-muted uppercase" },
          "已安装插件",
          -1
          /* CACHED */
        )),
        _createVNode($setup["UButton"], {
          size: "sm",
          variant: "ghost",
          loading: $setup.importing,
          onClick: $setup.onImport
        }, {
          default: _withCtx(() => [..._cache[10] || (_cache[10] = [
            _createTextVNode(
              " 从文件夹导入 ",
              -1
              /* CACHED */
            )
          ])]),
          _: 1
          /* STABLE */
        }, 8, ["loading"])
      ]),
      _createElementVNode("div", _hoisted_10, [
        $setup.plugins.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_11, [
          _createVNode($setup["UEmpty"], {
            title: "还没有安装插件",
            description: "插件是包含 plugin.json 的本地目录包，选择目录即可导入"
          }, {
            action: _withCtx(() => [
              _createVNode($setup["UButton"], {
                size: "sm",
                loading: $setup.importing,
                onClick: $setup.onImport
              }, {
                default: _withCtx(() => [..._cache[12] || (_cache[12] = [
                  _createTextVNode(
                    "导入第一个插件",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"])
            ]),
            _: 1
            /* STABLE */
          })
        ])) : (_openBlock(), _createElementBlock("div", _hoisted_12, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.plugins, (p) => {
              return _openBlock(), _createElementBlock("div", {
                key: p.id,
                class: "px-4 py-3"
              }, [
                _createElementVNode("div", _hoisted_13, [
                  _createElementVNode("div", _hoisted_14, [
                    _createVNode($setup["AppIcon"], {
                      icon: "plug-2",
                      size: 17
                    })
                  ]),
                  _createElementVNode("div", _hoisted_15, [
                    _createElementVNode("div", _hoisted_16, [
                      _createElementVNode(
                        "span",
                        _hoisted_17,
                        _toDisplayString(p.name),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        _hoisted_18,
                        "v" + _toDisplayString(p.version ?? "—"),
                        1
                        /* TEXT */
                      ),
                      !p.enabled ? (_openBlock(), _createBlock($setup["UBadge"], {
                        key: 0,
                        variant: "neutral"
                      }, {
                        default: _withCtx(() => [..._cache[13] || (_cache[13] = [
                          _createTextVNode(
                            "已停用",
                            -1
                            /* CACHED */
                          )
                        ])]),
                        _: 1
                        /* STABLE */
                      })) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode(
                      "div",
                      _hoisted_19,
                      _toDisplayString(p.description || p.id),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", _hoisted_20, [
                    (p.preferences?.length ?? 0) > 0 ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 0,
                      size: "sm",
                      variant: "ghost",
                      onClick: ($event) => $setup.togglePrefs(p.id)
                    }, {
                      default: _withCtx(() => [..._cache[14] || (_cache[14] = [
                        _createTextVNode(
                          " 设置 ",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    }, 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _createVNode($setup["UButton"], {
                      size: "sm",
                      variant: "ghost",
                      onClick: ($event) => $setup.onToggle(p)
                    }, {
                      default: _withCtx(() => [
                        _createTextVNode(
                          _toDisplayString(p.enabled ? "停用" : "启用"),
                          1
                          /* TEXT */
                        )
                      ]),
                      _: 2
                      /* DYNAMIC */
                    }, 1032, ["onClick"]),
                    _createVNode($setup["UButton"], {
                      size: "sm",
                      variant: "ghost",
                      onClick: ($event) => $setup.onTryRun(p)
                    }, {
                      default: _withCtx(() => [..._cache[15] || (_cache[15] = [
                        _createTextVNode(
                          "运行",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    }, 8, ["onClick"]),
                    _createVNode($setup["UButton"], {
                      size: "sm",
                      variant: "danger",
                      onClick: ($event) => $setup.onRemove(p)
                    }, {
                      default: _withCtx(() => [..._cache[16] || (_cache[16] = [
                        _createTextVNode(
                          "卸载",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    }, 8, ["onClick"])
                  ])
                ]),
                _createCommentVNode(" M3.2 偏好表单（宿主按清单声明自动渲染） "),
                $setup.prefsOpen === p.id ? (_openBlock(), _createElementBlock("div", _hoisted_21, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(p.preferences ?? [], (pref) => {
                      return _openBlock(), _createElementBlock("div", {
                        key: pref.name,
                        class: "flex items-center gap-3"
                      }, [
                        _createElementVNode(
                          "span",
                          _hoisted_22,
                          _toDisplayString(pref.label),
                          1
                          /* TEXT */
                        ),
                        pref.type === "select" ? _withDirectives((_openBlock(), _createElementBlock("select", {
                          key: 0,
                          "onUpdate:modelValue": ($event) => $setup.prefValues[p.id + "." + pref.name] = $event,
                          class: "min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(pref.options ?? [], (opt) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: opt,
                                value: opt
                              }, _toDisplayString(opt), 9, _hoisted_24);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, _hoisted_23)), [
                          [_vModelSelect, $setup.prefValues[p.id + "." + pref.name]]
                        ]) : pref.type === "checkbox" ? (_openBlock(), _createElementBlock("label", _hoisted_25, [
                          _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": ($event) => $setup.prefValues[p.id + "." + pref.name] = $event,
                            type: "checkbox",
                            class: "accent-brand-500"
                          }, null, 8, _hoisted_26), [
                            [_vModelCheckbox, $setup.prefValues[p.id + "." + pref.name]]
                          ]),
                          _cache[17] || (_cache[17] = _createTextVNode(
                            " 启用 ",
                            -1
                            /* CACHED */
                          ))
                        ])) : _withDirectives((_openBlock(), _createElementBlock("input", {
                          key: 2,
                          "onUpdate:modelValue": ($event) => $setup.prefValues[p.id + "." + pref.name] = $event,
                          class: "min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40",
                          placeholder: String(pref.default ?? "")
                        }, null, 8, _hoisted_27)), [
                          [_vModelText, $setup.prefValues[p.id + "." + pref.name]]
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  _createElementVNode("div", _hoisted_28, [
                    _createVNode($setup["UButton"], {
                      size: "sm",
                      loading: $setup.prefSaving,
                      onClick: ($event) => $setup.savePrefs(p.id)
                    }, {
                      default: _withCtx(() => [..._cache[18] || (_cache[18] = [
                        _createTextVNode(
                          "保存偏好",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    }, 8, ["loading", "onClick"])
                  ])
                ])) : _createCommentVNode("v-if", true)
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ])
    ]),
    _createCommentVNode(" ═══ 插件市场（M3.5 静态市场 v0）═══ "),
    _createElementVNode("section", _hoisted_29, [
      _createElementVNode("div", _hoisted_30, [
        _cache[21] || (_cache[21] = _createElementVNode(
          "h2",
          { class: "text-xs font-medium tracking-wider text-fg-muted uppercase" },
          "插件市场",
          -1
          /* CACHED */
        )),
        _createElementVNode("div", _hoisted_31, [
          _cache[20] || (_cache[20] = _createElementVNode(
            "span",
            { class: "text-xs text-fg-faint" },
            "索引：仓库 plugins.json",
            -1
            /* CACHED */
          )),
          _createVNode($setup["UButton"], {
            size: "sm",
            variant: "ghost",
            loading: $setup.marketLoading,
            onClick: $setup.refreshMarket
          }, {
            default: _withCtx(() => [..._cache[19] || (_cache[19] = [
              _createTextVNode(
                " 刷新 ",
                -1
                /* CACHED */
              )
            ])]),
            _: 1
            /* STABLE */
          }, 8, ["loading"])
        ])
      ]),
      _createElementVNode("div", _hoisted_32, [
        $setup.market.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_33, [
          _createVNode($setup["UEmpty"], {
            title: "市场索引为空",
            description: "未找到 plugins.json 或索引中没有条目"
          })
        ])) : (_openBlock(), _createElementBlock("div", _hoisted_34, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.market, (entry) => {
              return _openBlock(), _createElementBlock("div", {
                key: entry.id,
                class: "flex items-center gap-3 p-4"
              }, [
                _createElementVNode("div", _hoisted_35, [
                  _createVNode($setup["AppIcon"], {
                    icon: "store-2-line",
                    size: 17
                  })
                ]),
                _createElementVNode("div", _hoisted_36, [
                  _createElementVNode("div", _hoisted_37, [
                    _createElementVNode(
                      "span",
                      _hoisted_38,
                      _toDisplayString(entry.name),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      _hoisted_39,
                      "v" + _toDisplayString(entry.version ?? "—"),
                      1
                      /* TEXT */
                    ),
                    entry.installed && entry.updatable ? (_openBlock(), _createBlock(
                      $setup["UBadge"],
                      {
                        key: 0,
                        variant: "warning"
                      },
                      {
                        default: _withCtx(() => [
                          _createTextVNode(
                            " 可更新 " + _toDisplayString(entry.installedVersion) + " → " + _toDisplayString(entry.version),
                            1
                            /* TEXT */
                          )
                        ]),
                        _: 2
                        /* DYNAMIC */
                      },
                      1024
                      /* DYNAMIC_SLOTS */
                    )) : entry.installed ? (_openBlock(), _createBlock($setup["UBadge"], {
                      key: 1,
                      variant: "neutral"
                    }, {
                      default: _withCtx(() => [..._cache[22] || (_cache[22] = [
                        _createTextVNode(
                          "已安装",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    })) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", _hoisted_40, [
                    _createTextVNode(
                      _toDisplayString(entry.description || entry.id) + " ",
                      1
                      /* TEXT */
                    ),
                    entry.author ? (_openBlock(), _createElementBlock(
                      _Fragment,
                      { key: 0 },
                      [
                        _createTextVNode(
                          " · " + _toDisplayString(entry.author),
                          1
                          /* TEXT */
                        )
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    )) : _createCommentVNode("v-if", true)
                  ])
                ]),
                entry.installed && entry.updatable ? (_openBlock(), _createBlock($setup["UButton"], {
                  key: 0,
                  size: "sm",
                  loading: $setup.installingId === entry.id,
                  onClick: ($event) => $setup.onMarketUpdate(entry)
                }, {
                  default: _withCtx(() => [..._cache[23] || (_cache[23] = [
                    _createTextVNode(
                      " 更新 ",
                      -1
                      /* CACHED */
                    )
                  ])]),
                  _: 1
                  /* STABLE */
                }, 8, ["loading", "onClick"])) : (_openBlock(), _createBlock($setup["UButton"], {
                  key: 1,
                  size: "sm",
                  variant: "ghost",
                  disabled: entry.installed,
                  loading: $setup.installingId === entry.id,
                  onClick: ($event) => $setup.onMarketInstall(entry)
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(
                      _toDisplayString(entry.installed ? "已安装" : "安装"),
                      1
                      /* TEXT */
                    )
                  ]),
                  _: 2
                  /* DYNAMIC */
                }, 1032, ["disabled", "loading", "onClick"]))
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ])
    ]),
    _createCommentVNode(" ═══ Quicklinks（M2.3）═══ "),
    _createElementVNode("section", _hoisted_41, [
      _createElementVNode("div", _hoisted_42, [
        _cache[25] || (_cache[25] = _createElementVNode(
          "h2",
          { class: "text-xs font-medium tracking-wider text-fg-muted uppercase" },
          "快捷链接",
          -1
          /* CACHED */
        )),
        _createVNode($setup["UButton"], {
          size: "sm",
          variant: "ghost",
          onClick: $setup.addQuicklink
        }, {
          default: _withCtx(() => [..._cache[24] || (_cache[24] = [
            _createTextVNode(
              "添加",
              -1
              /* CACHED */
            )
          ])]),
          _: 1
          /* STABLE */
        })
      ]),
      _createElementVNode("div", _hoisted_43, [
        $setup.quicklinks.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_44, [
          _createVNode($setup["UEmpty"], {
            title: "还没有快捷链接",
            description: "添加常用 URL（如 GitHub），在启动台里搜索即可一键打开"
          })
        ])) : (_openBlock(), _createElementBlock("div", _hoisted_45, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.quicklinks, (link) => {
              return _openBlock(), _createElementBlock("div", {
                key: link.id,
                class: "flex items-center gap-2 p-3"
              }, [
                _createVNode($setup["AppIcon"], {
                  icon: "link",
                  size: 15,
                  class: "shrink-0 text-fg-tertiary"
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => link.name = $event,
                  class: "w-40 shrink-0 rounded-md border border-line-subtle bg-surface-0 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40",
                  placeholder: "名称"
                }, null, 8, _hoisted_46), [
                  [_vModelText, link.name]
                ]),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => link.url = $event,
                  class: "min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-0 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40",
                  placeholder: "https://…（可含 {query} 占位符，如 github.com/search?q={query}）"
                }, null, 8, _hoisted_47), [
                  [_vModelText, link.url]
                ]),
                _createVNode($setup["UButton"], {
                  size: "sm",
                  variant: "ghost",
                  onClick: ($event) => $setup.removeQuicklink(link)
                }, {
                  default: _withCtx(() => [..._cache[26] || (_cache[26] = [
                    _createTextVNode(
                      "删除",
                      -1
                      /* CACHED */
                    )
                  ])]),
                  _: 1
                  /* STABLE */
                }, 8, ["onClick"])
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])),
        $setup.quicklinks.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_48, [
          _createVNode($setup["UButton"], {
            size: "sm",
            loading: $setup.qlSaving,
            onClick: $setup.saveQuicklinks
          }, {
            default: _withCtx(() => [..._cache[27] || (_cache[27] = [
              _createTextVNode(
                "保存",
                -1
                /* CACHED */
              )
            ])]),
            _: 1
            /* STABLE */
          }, 8, ["loading"])
        ])) : _createCommentVNode("v-if", true)
      ])
    ]),
    _createCommentVNode(" ═══ 片段文本扩展（M5.1）═══ "),
    _createElementVNode("section", _hoisted_49, [
      _createElementVNode("div", _hoisted_50, [
        _cache[28] || (_cache[28] = _createElementVNode(
          "h2",
          { class: "text-xs font-medium tracking-wider text-fg-muted uppercase" },
          "片段文本扩展",
          -1
          /* CACHED */
        )),
        _createElementVNode("label", _hoisted_51, [
          _withDirectives(_createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.expansionEnabled = $event),
              type: "checkbox",
              class: "accent-brand-500"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [_vModelCheckbox, $setup.expansionEnabled]
          ]),
          _createTextVNode(
            " " + _toDisplayString($setup.expansionEnabled ? "已开启" : "已关闭"),
            1
            /* TEXT */
          )
        ])
      ]),
      _createElementVNode("div", _hoisted_52, [
        _createElementVNode("div", _hoisted_53, [
          _cache[31] || (_cache[31] = _createElementVNode(
            "p",
            { class: "text-xs leading-relaxed text-fg-tertiary" },
            " 在任意应用中键入片段的「触发词」再按空格 / 回车，自动展开为片段内容。 触发词在片段编辑器顶部设置；macOS 需要「辅助功能」授权（监听与注入）。 ",
            -1
            /* CACHED */
          )),
          _createElementVNode("div", _hoisted_54, [
            _createElementVNode(
              "span",
              _hoisted_55,
              " 当前 " + _toDisplayString($setup.expansionTriggerCount) + " 个触发词 · 全局监听" + _toDisplayString($setup.expansionHookOk ? "正常" : "未就绪"),
              1
              /* TEXT */
            ),
            _createElementVNode("div", _hoisted_56, [
              _createVNode($setup["UButton"], {
                size: "sm",
                variant: "ghost",
                loading: $setup.probing,
                onClick: $setup.onProbePermission
              }, {
                default: _withCtx(() => [..._cache[29] || (_cache[29] = [
                  _createTextVNode(
                    " 权限诊断 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"]),
              $setup.probeFailed ? (_openBlock(), _createBlock($setup["UButton"], {
                key: 0,
                size: "sm",
                variant: "ghost",
                onClick: $setup.openA11ySettings
              }, {
                default: _withCtx(() => [..._cache[30] || (_cache[30] = [
                  _createTextVNode(
                    " 打开授权设置 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              })) : _createCommentVNode("v-if", true)
            ])
          ])
        ])
      ])
    ]),
    _createCommentVNode(" ═══ 快捷键（M4 + 两段式）═══ "),
    _createElementVNode("section", _hoisted_57, [
      _cache[33] || (_cache[33] = _createElementVNode(
        "div",
        { class: "mb-3 flex items-center justify-between" },
        [
          _createElementVNode("h2", { class: "text-xs font-medium tracking-wider text-fg-muted uppercase" }, "快捷键"),
          _createElementVNode("span", { class: "text-xs text-fg-faint" }, "录制组合键需含修饰键；字母框 = 两段式直达")
        ],
        -1
        /* CACHED */
      )),
      _createElementVNode("div", _hoisted_58, [
        _createCommentVNode(" 主热键 "),
        _createElementVNode("div", _hoisted_59, [
          _createElementVNode("div", _hoisted_60, [
            _createVNode($setup["AppIcon"], {
              icon: "hotkey-line",
              size: 17
            })
          ]),
          _cache[32] || (_cache[32] = _createElementVNode(
            "div",
            { class: "min-w-0 flex-1" },
            [
              _createElementVNode("div", { class: "text-sm font-medium text-fg-primary" }, "启动台主热键"),
              _createElementVNode("div", { class: "mt-0.5 text-xs text-fg-tertiary" }, "全局唤起 / 收起胶囊搜索窗")
            ],
            -1
            /* CACHED */
          )),
          _createElementVNode(
            "button",
            {
              type: "button",
              class: _normalizeClass([
                "shrink-0 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
                $setup.recording?.type === "main" ? "border-brand-500/40 bg-brand-500/10 text-fg-brand" : "border-line-subtle bg-surface-0 text-fg-secondary hover:border-brand-500/40"
              ]),
              onClick: _cache[1] || (_cache[1] = ($event) => $setup.startRecording("main"))
            },
            _toDisplayString($setup.recording?.type === "main" ? "按下组合键…" : $setup.hotkeyConfig.main),
            3
            /* TEXT, CLASS */
          )
        ]),
        _createCommentVNode(" 命令热键列表 "),
        _createElementVNode("div", _hoisted_61, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.hotkeyCommands, (entry) => {
              return _openBlock(), _createElementBlock("div", {
                key: entry.entry.key,
                class: "flex items-center gap-3 px-4 py-2.5"
              }, [
                _createVNode($setup["AppIcon"], {
                  icon: entry.entry.icon,
                  size: 15,
                  class: "shrink-0 text-fg-tertiary"
                }, null, 8, ["icon"]),
                _createElementVNode("div", _hoisted_62, [
                  _createElementVNode(
                    "span",
                    _hoisted_63,
                    _toDisplayString(entry.entry.title),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode(
                    "span",
                    _hoisted_64,
                    _toDisplayString(entry.entry.subtitle),
                    1
                    /* TEXT */
                  )
                ]),
                entry.bound ? (_openBlock(true), _createElementBlock(
                  _Fragment,
                  { key: 0 },
                  _renderList(entry.bound, (accel) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: accel,
                      type: "button",
                      class: "shrink-0 rounded border border-line-subtle bg-surface-0 px-2 py-0.5 font-mono text-[10px] text-fg-secondary hover:border-danger/40 hover:text-danger",
                      title: "点击删除该绑定",
                      onClick: ($event) => $setup.removeCommandHotkey(accel)
                    }, _toDisplayString(accel) + " × ", 9, _hoisted_65);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )) : _createCommentVNode("v-if", true),
                _createCommentVNode(" 两段式直达字母：主热键后按住修饰键再按字母直达命令 "),
                _createElementVNode("input", {
                  value: $setup.chordLetterOf(entry.entry),
                  class: "w-8 shrink-0 rounded border border-line-subtle bg-surface-0 px-1.5 py-0.5 text-center font-mono text-[10px] text-fg-secondary outline-none focus:border-brand-500/40",
                  maxlength: "1",
                  placeholder: "—",
                  title: "两段式：主热键后按住修饰键不放再按此字母直达（留空清除）",
                  onChange: (e) => $setup.setChordLetter(entry.entry, e.target.value)
                }, null, 40, _hoisted_66),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass([
                    "shrink-0 rounded-md border px-2.5 py-1 text-[10px] transition-colors",
                    $setup.recording?.type === "command" && $setup.recording.key === entry.entry.key ? "border-brand-500/40 bg-brand-500/10 text-fg-brand" : "border-line-subtle bg-surface-0 text-fg-tertiary hover:border-brand-500/40"
                  ]),
                  onClick: ($event) => $setup.startRecording("command", entry.entry.key)
                }, _toDisplayString($setup.recording?.type === "command" && $setup.recording.key === entry.entry.key ? "按下…" : "绑热键"), 11, _hoisted_67)
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ])
    ]),
    _createCommentVNode(" ═══ WebDAV 同步 ═══ "),
    _createElementVNode("section", _hoisted_68, [
      _cache[38] || (_cache[38] = _createElementVNode(
        "h2",
        { class: "mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase" },
        " WebDAV 同步（插件数据） ",
        -1
        /* CACHED */
      )),
      _createElementVNode("div", _hoisted_69, [
        _createElementVNode("div", _hoisted_70, [
          _withDirectives(_createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.syncForm.url = $event),
              class: "w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40",
              placeholder: "WebDAV 地址（如 https://dav.example.com/dav）"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [_vModelText, $setup.syncForm.url]
          ]),
          _createElementVNode("div", _hoisted_71, [
            _withDirectives(_createElementVNode(
              "input",
              {
                "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $setup.syncForm.username = $event),
                class: "w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40",
                placeholder: "用户名"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [_vModelText, $setup.syncForm.username]
            ]),
            _withDirectives(_createElementVNode(
              "input",
              {
                "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $setup.syncForm.password = $event),
                type: "password",
                class: "w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40",
                placeholder: "密码"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [_vModelText, $setup.syncForm.password]
            ])
          ]),
          _withDirectives(_createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $setup.syncForm.remoteDir = $event),
              class: "w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40",
              placeholder: "远端目录（默认 /leaf-launcher）"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [_vModelText, $setup.syncForm.remoteDir]
          ]),
          _createElementVNode("div", _hoisted_72, [
            _cache[37] || (_cache[37] = _createElementVNode(
              "span",
              { class: "text-xs text-fg-faint" },
              " 备份内容为插件数据快照；插件本体需在各设备重新导入 ",
              -1
              /* CACHED */
            )),
            _createElementVNode("div", _hoisted_73, [
              _createVNode($setup["UButton"], {
                size: "sm",
                variant: "ghost",
                loading: $setup.syncTesting,
                onClick: $setup.onSyncTest
              }, {
                default: _withCtx(() => [..._cache[34] || (_cache[34] = [
                  _createTextVNode(
                    " 测试连接 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"]),
              _createVNode($setup["UButton"], {
                size: "sm",
                variant: "ghost",
                loading: $setup.syncRestoring,
                onClick: $setup.onSyncRestore
              }, {
                default: _withCtx(() => [..._cache[35] || (_cache[35] = [
                  _createTextVNode(
                    " 恢复 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"]),
              _createVNode($setup["UButton"], {
                size: "sm",
                loading: $setup.syncBacking,
                onClick: $setup.onSyncSaveAndBackup
              }, {
                default: _withCtx(() => [..._cache[36] || (_cache[36] = [
                  _createTextVNode(
                    " 保存并备份 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"])
            ])
          ])
        ])
      ])
    ]),
    _createCommentVNode(" ═══ 开发 ═══ "),
    _createElementVNode("section", _hoisted_74, [
      _cache[50] || (_cache[50] = _createElementVNode(
        "h2",
        { class: "mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase" },
        "开发者",
        -1
        /* CACHED */
      )),
      _createElementVNode("div", _hoisted_75, [
        _createElementVNode("div", _hoisted_76, [
          _createCommentVNode(" 热重载开发模式（对标 ray develop） "),
          _createElementVNode("div", null, [
            _createElementVNode("div", _hoisted_77, [
              _createVNode($setup["AppIcon"], {
                icon: "flashlight-line",
                class: "mt-0.5 shrink-0 text-info",
                size: 16
              }),
              _cache[40] || (_cache[40] = _createElementVNode(
                "div",
                { class: "min-w-0 flex-1" },
                [
                  _createElementVNode("div", { class: "text-sm font-medium text-fg-primary" }, "热重载开发模式"),
                  _createElementVNode("div", { class: "mt-0.5 text-xs text-fg-tertiary" }, " 注册包含 plugin.json 的本地目录，保存文件自动重装并重载插件（300ms 防抖） ")
                ],
                -1
                /* CACHED */
              )),
              _createVNode($setup["UButton"], {
                size: "sm",
                loading: $setup.devAdding,
                onClick: $setup.onAddDevPlugin
              }, {
                default: _withCtx(() => [..._cache[39] || (_cache[39] = [
                  _createTextVNode(
                    " 添加开发目录 ",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["loading"])
            ]),
            $setup.devPlugins.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_78, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList($setup.devPlugins, (d) => {
                  return _openBlock(), _createElementBlock("div", {
                    key: d.pluginId,
                    class: "px-4 py-3"
                  }, [
                    _createElementVNode("div", _hoisted_79, [
                      _createElementVNode("div", _hoisted_80, [
                        _createElementVNode("div", _hoisted_81, [
                          _createElementVNode(
                            "span",
                            _hoisted_82,
                            _toDisplayString(d.name || d.pluginId),
                            1
                            /* TEXT */
                          ),
                          d.version ? (_openBlock(), _createElementBlock(
                            "span",
                            _hoisted_83,
                            " v" + _toDisplayString(d.version),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true),
                          !d.sourceExists ? (_openBlock(), _createBlock($setup["UBadge"], {
                            key: 1,
                            variant: "danger"
                          }, {
                            default: _withCtx(() => [..._cache[41] || (_cache[41] = [
                              _createTextVNode(
                                "目录缺失",
                                -1
                                /* CACHED */
                              )
                            ])]),
                            _: 1
                            /* STABLE */
                          })) : !d.manifestValid ? (_openBlock(), _createBlock($setup["UBadge"], {
                            key: 2,
                            variant: "warning"
                          }, {
                            default: _withCtx(() => [..._cache[42] || (_cache[42] = [
                              _createTextVNode(
                                " plugin.json 异常 ",
                                -1
                                /* CACHED */
                              )
                            ])]),
                            _: 1
                            /* STABLE */
                          })) : _createCommentVNode("v-if", true),
                          !d.installed ? (_openBlock(), _createBlock($setup["UBadge"], {
                            key: 3,
                            variant: "neutral"
                          }, {
                            default: _withCtx(() => [..._cache[43] || (_cache[43] = [
                              _createTextVNode(
                                "未安装",
                                -1
                                /* CACHED */
                              )
                            ])]),
                            _: 1
                            /* STABLE */
                          })) : _createCommentVNode("v-if", true)
                        ]),
                        _createElementVNode("div", {
                          class: "mt-0.5 truncate font-mono text-[10px] text-fg-tertiary",
                          title: d.sourceDir
                        }, _toDisplayString(d.sourceDir), 9, _hoisted_84)
                      ]),
                      _createElementVNode("label", _hoisted_85, [
                        _createElementVNode("input", {
                          type: "checkbox",
                          checked: d.autoReload,
                          class: "accent-brand-500",
                          onChange: ($event) => $setup.onDevAutoReload(d, $event.target.checked)
                        }, null, 40, _hoisted_86),
                        _cache[44] || (_cache[44] = _createTextVNode(
                          " 自动重载 ",
                          -1
                          /* CACHED */
                        ))
                      ]),
                      _createVNode($setup["UButton"], {
                        size: "sm",
                        variant: "ghost",
                        loading: $setup.devReloadingId === d.pluginId,
                        onClick: ($event) => $setup.onDevReload(d)
                      }, {
                        default: _withCtx(() => [..._cache[45] || (_cache[45] = [
                          _createTextVNode(
                            " 重载 ",
                            -1
                            /* CACHED */
                          )
                        ])]),
                        _: 1
                        /* STABLE */
                      }, 8, ["loading", "onClick"]),
                      _createVNode($setup["UButton"], {
                        size: "sm",
                        variant: "ghost",
                        onClick: ($event) => $setup.onDevRemove(d)
                      }, {
                        default: _withCtx(() => [..._cache[46] || (_cache[46] = [
                          _createTextVNode(
                            "移除",
                            -1
                            /* CACHED */
                          )
                        ])]),
                        _: 1
                        /* STABLE */
                      }, 8, ["onClick"])
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : (_openBlock(), _createElementBlock("div", _hoisted_87, " 还没有注册开发目录。选择仓库 example-plugin/ 试试：修改 index.html 保存后会自动重载。 "))
          ]),
          _createElementVNode("div", _hoisted_88, [
            _createVNode($setup["AppIcon"], {
              icon: "code-s-slash-line",
              class: "mt-0.5 shrink-0 text-info",
              size: 16
            }),
            _cache[47] || (_cache[47] = _createStaticVNode('<div class="min-w-0 flex-1 text-xs leading-relaxed text-fg-tertiary"> 插件 = 一个包含 <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary">plugin.json</code> 的目录（声明 id / 名称 / 入口页 / 命令），页面里通过 <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary">window.launcherApi</code> 调用受控 API（通知、剪贴板、副输入框、数据存储等）。参考仓库 <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary">example-plugin/</code> 与 <code class="rounded bg-surface-2 px-1 py-0.5">docs/modules/10-launcher.md</code>。 </div>', 1))
          ]),
          _createElementVNode("div", _hoisted_89, [
            _createVNode($setup["AppIcon"], {
              icon: "folder-2-line",
              class: "mt-0.5 shrink-0 text-info",
              size: 16
            }),
            _cache[49] || (_cache[49] = _createElementVNode(
              "div",
              { class: "min-w-0 flex-1" },
              [
                _createElementVNode("div", { class: "text-sm font-medium text-fg-primary" }, "插件数据目录"),
                _createElementVNode("div", { class: "mt-0.5 text-xs text-fg-tertiary" }, "已安装插件与索引的存放位置")
              ],
              -1
              /* CACHED */
            )),
            _createVNode($setup["UButton"], {
              size: "sm",
              variant: "ghost",
              onClick: _cache[6] || (_cache[6] = ($event) => $setup.openPluginsDir())
            }, {
              default: _withCtx(() => [..._cache[48] || (_cache[48] = [
                _createTextVNode(
                  "打开",
                  -1
                  /* CACHED */
                )
              ])]),
              _: 1
              /* STABLE */
            })
          ])
        ])
      ])
    ])
  ]);
}
_sfc_main.__hmrId = "46efcb59";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/launcher/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QTs7OztzQkFDQSxhQUF1RTtBQUFBLHdCQUE5RCxNQUFLO0FBQUEsd0JBQUssU0FBUTtBQUFBLHdCQUFTLFNBQUssWUFBRSxtQkFBWSxDQUFDO0FBQUE7MENBQUcsTUFBRTtBQUFBOzRCQUFGO0FBQUEsNEJBQUU7QUFBQTtBQUFBO0FBQUE7Ozs7Ozs7Ozs7aUNBSW5FLG9CQUVNLE9BRk4sYUFBZ0YsNkRBRWhGO0FBQUE7VUFFRixvQkFjTSxPQWROLGFBY007QUFBQSxZQWJKLGFBQWlGO0FBQUEsY0FBeEUsTUFBSztBQUFBLGNBQW9CLE9BQU07QUFBQSxjQUE2QixNQUFNO0FBQUE7OztVQWM3RSxvQkFPTSxPQVBOLGFBT007QUFBQSxZQU5KLGFBQTZFO0FBQUEsY0FBcEUsTUFBSztBQUFBLGNBQWdCLE9BQU07QUFBQSxjQUE2QixNQUFNO0FBQUE7d0NBQ3ZFO0FBQUEsY0FHTTtBQUFBLGdCQUhELE9BQU0saUJBQWdCO0FBQUE7QUFBQSxnQkFDekIsb0JBQTZELFNBQXhELE9BQU0sc0NBQXFDLEdBQUMsUUFBTTtBQUFBLGdCQUN2RCxvQkFBZ0UsU0FBM0QsT0FBTSxrQ0FBaUMsR0FBQyxlQUFhO0FBQUE7Ozs7WUFFNUQsYUFBeUU7QUFBQSxjQUFoRSxNQUFLO0FBQUEsY0FBSyxTQUFRO0FBQUEsY0FBUyxTQUFLLHNDQUFFLHNCQUFjO0FBQUE7Z0NBQUksTUFBRTtBQUFBO2tCQUFGO0FBQUEsa0JBQUU7QUFBQTtBQUFBO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImluZGV4LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJteC1hdXRvIG1heC13LTN4bCBweC02IHB5LThcIj5cbiAgICA8IS0tIOKVkOKVkOKVkCDpobXlpLQg4pWQ4pWQ4pWQIC0tPlxuICAgIDxzZWN0aW9uIGNsYXNzPVwibWItOVwiPlxuICAgICAgPGRpdiBjbGFzcz1cInJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTEgc2hhZG93LXNtXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBwLTRcIj5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz1cImZsZXggc2l6ZS05IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItYnJhbmQtNTAwLzIwIGJnLWJyYW5kLTUwMC8xMCB0ZXh0LWZnLWJyYW5kXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwic2VhcmNoXCIgOnNpemU9XCIxOFwiIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1pbi13LTAgZmxleC0xXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtZmctcHJpbWFyeVwiPuWQr+WKqOWZqDwvc3Bhbj5cbiAgICAgICAgICAgICAgPFVCYWRnZSB2YXJpYW50PVwibmV1dHJhbFwiPkFsdCArIFNwYWNlIOWUpOi1tzwvVUJhZGdlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibXQtMC41IHRleHQteHMgdGV4dC1mZy10ZXJ0aWFyeVwiPlxuICAgICAgICAgICAgICDog7blm4rmkJzntKLnqpfvvJrmkJzntKLlupTnlKggLyBMZWFmIOWKn+iDvSAvIOaPkuS7tuWRveS7pO+8jEVTQyDlhbPpl61cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvc2VjdGlvbj5cblxuICAgIDwhLS0g4pWQ4pWQ4pWQIOaPkuS7tiDilZDilZDilZAgLS0+XG4gICAgPHNlY3Rpb24gY2xhc3M9XCJtYi05XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibWItMyBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14cyBmb250LW1lZGl1bSB0cmFja2luZy13aWRlciB0ZXh0LWZnLW11dGVkIHVwcGVyY2FzZVwiPuW3suWuieijheaPkuS7tjwvaDI+XG4gICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIDpsb2FkaW5nPVwiaW1wb3J0aW5nXCIgQGNsaWNrPVwib25JbXBvcnRcIj5cbiAgICAgICAgICDku47mlofku7blpLnlr7zlhaVcbiAgICAgICAgPC9VQnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMSBzaGFkb3ctc21cIj5cbiAgICAgICAgPGRpdiB2LWlmPVwicGx1Z2lucy5sZW5ndGggPT09IDBcIiBjbGFzcz1cInAtOFwiPlxuICAgICAgICAgIDxVRW1wdHlcbiAgICAgICAgICAgIHRpdGxlPVwi6L+Y5rKh5pyJ5a6J6KOF5o+S5Lu2XCJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwi5o+S5Lu25piv5YyF5ZCrIHBsdWdpbi5qc29uIOeahOacrOWcsOebruW9leWMhe+8jOmAieaLqeebruW9leWNs+WPr+WvvOWFpVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHRlbXBsYXRlICNhY3Rpb24+XG4gICAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIDpsb2FkaW5nPVwiaW1wb3J0aW5nXCIgQGNsaWNrPVwib25JbXBvcnRcIj7lr7zlhaXnrKzkuIDkuKrmj5Lku7Y8L1VCdXR0b24+XG4gICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgIDwvVUVtcHR5PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJkaXZpZGUteSBkaXZpZGUtbGluZS1zdWJ0bGVcIj5cbiAgICAgICAgICA8ZGl2IHYtZm9yPVwicCBpbiBwbHVnaW5zXCIgOmtleT1cInAuaWRcIiBjbGFzcz1cInB4LTQgcHktM1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBjbGFzcz1cImZsZXggc2l6ZS05IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0yIHRleHQtZmctdGVydGlhcnlcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInBsdWctMlwiIDpzaXplPVwiMTdcIiAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1pbi13LTAgZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRydW5jYXRlIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1mZy1wcmltYXJ5XCI+e3sgcC5uYW1lIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzaHJpbmstMCB0ZXh0LXhzIHRleHQtZmctZmFpbnRcIj52e3sgcC52ZXJzaW9uID8/ICfigJQnIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgPFVCYWRnZSB2LWlmPVwiIXAuZW5hYmxlZFwiIHZhcmlhbnQ9XCJuZXV0cmFsXCI+5bey5YGc55SoPC9VQmFkZ2U+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0cnVuY2F0ZSB0ZXh0LXhzIHRleHQtZmctdGVydGlhcnlcIj5cbiAgICAgICAgICAgICAgICAgIHt7IHAuZGVzY3JpcHRpb24gfHwgcC5pZCB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGdhcC0xXCI+XG4gICAgICAgICAgICAgICAgPFVCdXR0b25cbiAgICAgICAgICAgICAgICAgIHYtaWY9XCIocC5wcmVmZXJlbmNlcz8ubGVuZ3RoID8/IDApID4gMFwiXG4gICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImdob3N0XCJcbiAgICAgICAgICAgICAgICAgIEBjbGljaz1cInRvZ2dsZVByZWZzKHAuaWQpXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICDorr7nva5cbiAgICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImdob3N0XCIgQGNsaWNrPVwib25Ub2dnbGUocClcIj5cbiAgICAgICAgICAgICAgICAgIHt7IHAuZW5hYmxlZCA/ICflgZznlKgnIDogJ+WQr+eUqCcgfX1cbiAgICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImdob3N0XCIgQGNsaWNrPVwib25UcnlSdW4ocClcIj7ov5DooYw8L1VCdXR0b24+XG4gICAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImRhbmdlclwiIEBjbGljaz1cIm9uUmVtb3ZlKHApXCI+5Y246L29PC9VQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPCEtLSBNMy4yIOWBj+WlveihqOWNle+8iOWuv+S4u+aMiea4heWNleWjsOaYjuiHquWKqOa4suafk++8iSAtLT5cbiAgICAgICAgICAgIDxkaXYgdi1pZj1cInByZWZzT3BlbiA9PT0gcC5pZFwiIGNsYXNzPVwibXQtMyBzcGFjZS15LTIgcm91bmRlZC1tZCBiZy1zdXJmYWNlLTAgcC0zXCI+XG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICB2LWZvcj1cInByZWYgaW4gcC5wcmVmZXJlbmNlcyA/PyBbXVwiXG4gICAgICAgICAgICAgICAgOmtleT1cInByZWYubmFtZVwiXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctMjggc2hyaW5rLTAgdGV4dC14cyB0ZXh0LWZnLXNlY29uZGFyeVwiPnt7IHByZWYubGFiZWwgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNlbGVjdFxuICAgICAgICAgICAgICAgICAgdi1pZj1cInByZWYudHlwZSA9PT0gJ3NlbGVjdCdcIlxuICAgICAgICAgICAgICAgICAgdi1tb2RlbD1cInByZWZWYWx1ZXNbcC5pZCArICcuJyArIHByZWYubmFtZV1cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMSByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0xIHB4LTIuNSBweS0xLjUgdGV4dC14cyB0ZXh0LWZnLXByaW1hcnkgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1icmFuZC01MDAvNDBcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxvcHRpb24gdi1mb3I9XCJvcHQgaW4gcHJlZi5vcHRpb25zID8/IFtdXCIgOmtleT1cIm9wdFwiIDp2YWx1ZT1cIm9wdFwiPlxuICAgICAgICAgICAgICAgICAgICB7eyBvcHQgfX1cbiAgICAgICAgICAgICAgICAgIDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgIDxsYWJlbFxuICAgICAgICAgICAgICAgICAgdi1lbHNlLWlmPVwicHJlZi50eXBlID09PSAnY2hlY2tib3gnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmxleCBmbGV4LTEgaXRlbXMtY2VudGVyIGdhcC0yIHRleHQteHMgdGV4dC1mZy10ZXJ0aWFyeVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgIHYtbW9kZWw9XCJwcmVmVmFsdWVzW3AuaWQgKyAnLicgKyBwcmVmLm5hbWVdXCJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhY2NlbnQtYnJhbmQtNTAwXCJcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICDlkK/nlKhcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgdi1lbHNlXG4gICAgICAgICAgICAgICAgICB2LW1vZGVsPVwicHJlZlZhbHVlc1twLmlkICsgJy4nICsgcHJlZi5uYW1lXVwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cIm1pbi13LTAgZmxleC0xIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTEgcHgtMi41IHB5LTEuNSB0ZXh0LXhzIHRleHQtZmctcHJpbWFyeSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJyYW5kLTUwMC80MFwiXG4gICAgICAgICAgICAgICAgICA6cGxhY2Vob2xkZXI9XCJTdHJpbmcocHJlZi5kZWZhdWx0ID8/ICcnKVwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktZW5kIHB0LTFcIj5cbiAgICAgICAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiA6bG9hZGluZz1cInByZWZTYXZpbmdcIiBAY2xpY2s9XCJzYXZlUHJlZnMocC5pZClcIj7kv53lrZjlgY/lpb08L1VCdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuXG4gICAgPCEtLSDilZDilZDilZAg5o+S5Lu25biC5Zy677yITTMuNSDpnZnmgIHluILlnLogdjDvvInilZDilZDilZAgLS0+XG4gICAgPHNlY3Rpb24gY2xhc3M9XCJtYi05XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibWItMyBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14cyBmb250LW1lZGl1bSB0cmFja2luZy13aWRlciB0ZXh0LWZnLW11dGVkIHVwcGVyY2FzZVwiPuaPkuS7tuW4guWcujwvaDI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC14cyB0ZXh0LWZnLWZhaW50XCI+57Si5byV77ya5LuT5bqTIHBsdWdpbnMuanNvbjwvc3Bhbj5cbiAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiB2YXJpYW50PVwiZ2hvc3RcIiA6bG9hZGluZz1cIm1hcmtldExvYWRpbmdcIiBAY2xpY2s9XCJyZWZyZXNoTWFya2V0XCI+XG4gICAgICAgICAgICDliLfmlrBcbiAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMSBzaGFkb3ctc21cIj5cbiAgICAgICAgPGRpdiB2LWlmPVwibWFya2V0Lmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwicC02XCI+XG4gICAgICAgICAgPFVFbXB0eSB0aXRsZT1cIuW4guWcuue0ouW8leS4uuepulwiIGRlc2NyaXB0aW9uPVwi5pyq5om+5YiwIHBsdWdpbnMuanNvbiDmiJbntKLlvJXkuK3msqHmnInmnaHnm65cIiAvPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJkaXZpZGUteSBkaXZpZGUtbGluZS1zdWJ0bGVcIj5cbiAgICAgICAgICA8ZGl2IHYtZm9yPVwiZW50cnkgaW4gbWFya2V0XCIgOmtleT1cImVudHJ5LmlkXCIgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBwLTRcIj5cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgY2xhc3M9XCJmbGV4IHNpemUtOSBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMiB0ZXh0LWZnLXRlcnRpYXJ5XCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInN0b3JlLTItbGluZVwiIDpzaXplPVwiMTdcIiAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cnVuY2F0ZSB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtZmctcHJpbWFyeVwiPnt7IGVudHJ5Lm5hbWUgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzaHJpbmstMCB0ZXh0LXhzIHRleHQtZmctZmFpbnRcIj52e3sgZW50cnkudmVyc2lvbiA/PyAn4oCUJyB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8VUJhZGdlIHYtaWY9XCJlbnRyeS5pbnN0YWxsZWQgJiYgZW50cnkudXBkYXRhYmxlXCIgdmFyaWFudD1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAgICAgIOWPr+abtOaWsCB7eyBlbnRyeS5pbnN0YWxsZWRWZXJzaW9uIH19IOKGkiB7eyBlbnRyeS52ZXJzaW9uIH19XG4gICAgICAgICAgICAgICAgPC9VQmFkZ2U+XG4gICAgICAgICAgICAgICAgPFVCYWRnZSB2LWVsc2UtaWY9XCJlbnRyeS5pbnN0YWxsZWRcIiB2YXJpYW50PVwibmV1dHJhbFwiPuW3suWuieijhTwvVUJhZGdlPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0cnVuY2F0ZSB0ZXh0LXhzIHRleHQtZmctdGVydGlhcnlcIj5cbiAgICAgICAgICAgICAgICB7eyBlbnRyeS5kZXNjcmlwdGlvbiB8fCBlbnRyeS5pZCB9fVxuICAgICAgICAgICAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwiZW50cnkuYXV0aG9yXCI+IMK3IHt7IGVudHJ5LmF1dGhvciB9fTwvdGVtcGxhdGU+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8VUJ1dHRvblxuICAgICAgICAgICAgICB2LWlmPVwiZW50cnkuaW5zdGFsbGVkICYmIGVudHJ5LnVwZGF0YWJsZVwiXG4gICAgICAgICAgICAgIHNpemU9XCJzbVwiXG4gICAgICAgICAgICAgIDpsb2FkaW5nPVwiaW5zdGFsbGluZ0lkID09PSBlbnRyeS5pZFwiXG4gICAgICAgICAgICAgIEBjbGljaz1cIm9uTWFya2V0VXBkYXRlKGVudHJ5KVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIOabtOaWsFxuICAgICAgICAgICAgPC9VQnV0dG9uPlxuICAgICAgICAgICAgPFVCdXR0b25cbiAgICAgICAgICAgICAgdi1lbHNlXG4gICAgICAgICAgICAgIHNpemU9XCJzbVwiXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJnaG9zdFwiXG4gICAgICAgICAgICAgIDpkaXNhYmxlZD1cImVudHJ5Lmluc3RhbGxlZFwiXG4gICAgICAgICAgICAgIDpsb2FkaW5nPVwiaW5zdGFsbGluZ0lkID09PSBlbnRyeS5pZFwiXG4gICAgICAgICAgICAgIEBjbGljaz1cIm9uTWFya2V0SW5zdGFsbChlbnRyeSlcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7eyBlbnRyeS5pbnN0YWxsZWQgPyAn5bey5a6J6KOFJyA6ICflronoo4UnIH19XG4gICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuXG4gICAgPCEtLSDilZDilZDilZAgUXVpY2tsaW5rc++8iE0yLjPvvInilZDilZDilZAgLS0+XG4gICAgPHNlY3Rpb24gY2xhc3M9XCJtYi05XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibWItMyBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14cyBmb250LW1lZGl1bSB0cmFja2luZy13aWRlciB0ZXh0LWZnLW11dGVkIHVwcGVyY2FzZVwiPuW/q+aNt+mTvuaOpTwvaDI+XG4gICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIEBjbGljaz1cImFkZFF1aWNrbGlua1wiPua3u+WKoDwvVUJ1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTEgc2hhZG93LXNtXCI+XG4gICAgICAgIDxkaXYgdi1pZj1cInF1aWNrbGlua3MubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJwLTZcIj5cbiAgICAgICAgICA8VUVtcHR5XG4gICAgICAgICAgICB0aXRsZT1cIui/mOayoeacieW/q+aNt+mTvuaOpVwiXG4gICAgICAgICAgICBkZXNjcmlwdGlvbj1cIua3u+WKoOW4uOeUqCBVUkzvvIjlpoIgR2l0SHVi77yJ77yM5Zyo5ZCv5Yqo5Y+w6YeM5pCc57Si5Y2z5Y+v5LiA6ZSu5omT5byAXCJcbiAgICAgICAgICAvPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJkaXZpZGUteSBkaXZpZGUtbGluZS1zdWJ0bGVcIj5cbiAgICAgICAgICA8ZGl2IHYtZm9yPVwibGluayBpbiBxdWlja2xpbmtzXCIgOmtleT1cImxpbmsuaWRcIiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHAtM1wiPlxuICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cImxpbmtcIiA6c2l6ZT1cIjE1XCIgY2xhc3M9XCJzaHJpbmstMCB0ZXh0LWZnLXRlcnRpYXJ5XCIgLz5cbiAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICB2LW1vZGVsPVwibGluay5uYW1lXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LTQwIHNocmluay0wIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTAgcHgtMi41IHB5LTEuNSB0ZXh0LXhzIHRleHQtZmctcHJpbWFyeSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJyYW5kLTUwMC80MFwiXG4gICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwi5ZCN56ewXCJcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgdi1tb2RlbD1cImxpbmsudXJsXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMSByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0wIHB4LTIuNSBweS0xLjUgdGV4dC14cyB0ZXh0LWZnLXByaW1hcnkgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1icmFuZC01MDAvNDBcIlxuICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cImh0dHBzOi8v4oCm77yI5Y+v5ZCrIHtxdWVyeX0g5Y2g5L2N56ym77yM5aaCIGdpdGh1Yi5jb20vc2VhcmNoP3E9e3F1ZXJ5fe+8iVwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImdob3N0XCIgQGNsaWNrPVwicmVtb3ZlUXVpY2tsaW5rKGxpbmspXCI+5Yig6ZmkPC9VQnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiB2LWlmPVwicXVpY2tsaW5rcy5sZW5ndGggPiAwXCIgY2xhc3M9XCJmbGV4IGp1c3RpZnktZW5kIGJvcmRlci10IGJvcmRlci1saW5lLXN1YnRsZSBwLTNcIj5cbiAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiA6bG9hZGluZz1cInFsU2F2aW5nXCIgQGNsaWNrPVwic2F2ZVF1aWNrbGlua3NcIj7kv53lrZg8L1VCdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuXG4gICAgPCEtLSDilZDilZDilZAg54mH5q615paH5pys5omp5bGV77yITTUuMe+8ieKVkOKVkOKVkCAtLT5cbiAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLTlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYi0zIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRyYWNraW5nLXdpZGVyIHRleHQtZmctbXV0ZWQgdXBwZXJjYXNlXCI+54mH5q615paH5pys5omp5bGVPC9oMj5cbiAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmxleCBjdXJzb3ItcG9pbnRlciBpdGVtcy1jZW50ZXIgZ2FwLTIgdGV4dC14cyB0ZXh0LWZnLXNlY29uZGFyeVwiPlxuICAgICAgICAgIDxpbnB1dCB2LW1vZGVsPVwiZXhwYW5zaW9uRW5hYmxlZFwiIHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwiYWNjZW50LWJyYW5kLTUwMFwiIC8+XG4gICAgICAgICAge3sgZXhwYW5zaW9uRW5hYmxlZCA/ICflt7LlvIDlkK8nIDogJ+W3suWFs+mXrScgfX1cbiAgICAgICAgPC9sYWJlbD5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTEgc2hhZG93LXNtXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTIgcC00XCI+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhzIGxlYWRpbmctcmVsYXhlZCB0ZXh0LWZnLXRlcnRpYXJ5XCI+XG4gICAgICAgICAgICDlnKjku7vmhI/lupTnlKjkuK3plK7lhaXniYfmrrXnmoTjgIzop6blj5Hor43jgI3lho3mjInnqbrmoLwgLyDlm57ovabvvIzoh6rliqjlsZXlvIDkuLrniYfmrrXlhoXlrrnjgIJcbiAgICAgICAgICAgIOinpuWPkeivjeWcqOeJh+autee8lui+keWZqOmhtumDqOiuvue9ru+8m21hY09TIOmcgOimgeOAjOi+heWKqeWKn+iDveOAjeaOiOadg++8iOebkeWQrOS4juazqOWFpe+8ieOAglxuICAgICAgICAgIDwvcD5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHB0LTFcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC14cyB0ZXh0LWZnLWZhaW50XCI+XG4gICAgICAgICAgICAgIOW9k+WJjSB7eyBleHBhbnNpb25UcmlnZ2VyQ291bnQgfX0g5Liq6Kem5Y+R6K+NIMK3IOWFqOWxgOebkeWQrHt7XG4gICAgICAgICAgICAgICAgZXhwYW5zaW9uSG9va09rID8gJ+ato+W4uCcgOiAn5pyq5bCx57uqJ1xuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI+XG4gICAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIDpsb2FkaW5nPVwicHJvYmluZ1wiIEBjbGljaz1cIm9uUHJvYmVQZXJtaXNzaW9uXCI+XG4gICAgICAgICAgICAgICAg5p2D6ZmQ6K+K5patXG4gICAgICAgICAgICAgIDwvVUJ1dHRvbj5cbiAgICAgICAgICAgICAgPFVCdXR0b24gdi1pZj1cInByb2JlRmFpbGVkXCIgc2l6ZT1cInNtXCIgdmFyaWFudD1cImdob3N0XCIgQGNsaWNrPVwib3BlbkExMXlTZXR0aW5nc1wiPlxuICAgICAgICAgICAgICAgIOaJk+W8gOaOiOadg+iuvue9rlxuICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L3NlY3Rpb24+XG5cbiAgICA8IS0tIOKVkOKVkOKVkCDlv6vmjbfplK7vvIhNNCArIOS4pOauteW8j++8ieKVkOKVkOKVkCAtLT5cbiAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLTlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYi0zIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRyYWNraW5nLXdpZGVyIHRleHQtZmctbXV0ZWQgdXBwZXJjYXNlXCI+5b+r5o236ZSuPC9oMj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXhzIHRleHQtZmctZmFpbnRcIj7lvZXliLbnu4TlkIjplK7pnIDlkKvkv67ppbDplK7vvJvlrZfmr43moYYgPSDkuKTmrrXlvI/nm7Tovr48L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0xIHNoYWRvdy1zbVwiPlxuICAgICAgICA8IS0tIOS4u+eDremUriAtLT5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIGJvcmRlci1iIGJvcmRlci1saW5lLXN1YnRsZSBwLTRcIj5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz1cImZsZXggc2l6ZS05IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItYnJhbmQtNTAwLzIwIGJnLWJyYW5kLTUwMC8xMCB0ZXh0LWZnLWJyYW5kXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwiaG90a2V5LWxpbmVcIiA6c2l6ZT1cIjE3XCIgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtZmctcHJpbWFyeVwiPuWQr+WKqOWPsOS4u+eDremUrjwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0ZXh0LXhzIHRleHQtZmctdGVydGlhcnlcIj7lhajlsYDllKTotbcgLyDmlLbotbfog7blm4rmkJzntKLnqpc8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgIGNsYXNzPVwic2hyaW5rLTAgcm91bmRlZC1tZCBib3JkZXIgcHgtMyBweS0xLjUgZm9udC1tb25vIHRleHQteHMgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgOmNsYXNzPVwiXG4gICAgICAgICAgICAgIHJlY29yZGluZz8udHlwZSA9PT0gJ21haW4nXG4gICAgICAgICAgICAgICAgPyAnYm9yZGVyLWJyYW5kLTUwMC80MCBiZy1icmFuZC01MDAvMTAgdGV4dC1mZy1icmFuZCdcbiAgICAgICAgICAgICAgICA6ICdib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0wIHRleHQtZmctc2Vjb25kYXJ5IGhvdmVyOmJvcmRlci1icmFuZC01MDAvNDAnXG4gICAgICAgICAgICBcIlxuICAgICAgICAgICAgQGNsaWNrPVwic3RhcnRSZWNvcmRpbmcoJ21haW4nKVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAge3sgcmVjb3JkaW5nPy50eXBlID09PSAnbWFpbicgPyAn5oyJ5LiL57uE5ZCI6ZSu4oCmJyA6IGhvdGtleUNvbmZpZy5tYWluIH19XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8IS0tIOWRveS7pOeDremUruWIl+ihqCAtLT5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1heC1oLTcyIGRpdmlkZS15IGRpdmlkZS1saW5lLXN1YnRsZSBvdmVyZmxvdy15LWF1dG9cIj5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICB2LWZvcj1cImVudHJ5IGluIGhvdGtleUNvbW1hbmRzXCJcbiAgICAgICAgICAgIDprZXk9XCJlbnRyeS5lbnRyeS5rZXlcIlxuICAgICAgICAgICAgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTIuNVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEFwcEljb24gOmljb249XCJlbnRyeS5lbnRyeS5pY29uXCIgOnNpemU9XCIxNVwiIGNsYXNzPVwic2hyaW5rLTAgdGV4dC1mZy10ZXJ0aWFyeVwiIC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtZmctcHJpbWFyeVwiPnt7IGVudHJ5LmVudHJ5LnRpdGxlIH19PC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1sLTIgdGV4dC1bMTBweF0gdGV4dC1mZy1mYWludFwiPnt7IGVudHJ5LmVudHJ5LnN1YnRpdGxlIH19PC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8dGVtcGxhdGUgdi1pZj1cImVudHJ5LmJvdW5kXCI+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICB2LWZvcj1cImFjY2VsIGluIGVudHJ5LmJvdW5kXCJcbiAgICAgICAgICAgICAgICA6a2V5PVwiYWNjZWxcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgIGNsYXNzPVwic2hyaW5rLTAgcm91bmRlZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMCBweC0yIHB5LTAuNSBmb250LW1vbm8gdGV4dC1bMTBweF0gdGV4dC1mZy1zZWNvbmRhcnkgaG92ZXI6Ym9yZGVyLWRhbmdlci80MCBob3Zlcjp0ZXh0LWRhbmdlclwiXG4gICAgICAgICAgICAgICAgOnRpdGxlPVwiJ+eCueWHu+WIoOmZpOivpee7keWumidcIlxuICAgICAgICAgICAgICAgIEBjbGljaz1cInJlbW92ZUNvbW1hbmRIb3RrZXkoYWNjZWwpXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHt7IGFjY2VsIH19IMOXXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICAgIDwhLS0g5Lik5q615byP55u06L6+5a2X5q+N77ya5Li754Ot6ZSu5ZCO5oyJ5L2P5L+u6aWw6ZSu5YaN5oyJ5a2X5q+N55u06L6+5ZG95LukIC0tPlxuICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgIDp2YWx1ZT1cImNob3JkTGV0dGVyT2YoZW50cnkuZW50cnkpXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LTggc2hyaW5rLTAgcm91bmRlZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMCBweC0xLjUgcHktMC41IHRleHQtY2VudGVyIGZvbnQtbW9ubyB0ZXh0LVsxMHB4XSB0ZXh0LWZnLXNlY29uZGFyeSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJyYW5kLTUwMC80MFwiXG4gICAgICAgICAgICAgIG1heGxlbmd0aD1cIjFcIlxuICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIuKAlFwiXG4gICAgICAgICAgICAgIHRpdGxlPVwi5Lik5q615byP77ya5Li754Ot6ZSu5ZCO5oyJ5L2P5L+u6aWw6ZSu5LiN5pS+5YaN5oyJ5q2k5a2X5q+N55u06L6+77yI55WZ56m65riF6Zmk77yJXCJcbiAgICAgICAgICAgICAgQGNoYW5nZT1cIihlKSA9PiBzZXRDaG9yZExldHRlcihlbnRyeS5lbnRyeSwgKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKVwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzaHJpbmstMCByb3VuZGVkLW1kIGJvcmRlciBweC0yLjUgcHktMSB0ZXh0LVsxMHB4XSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgIDpjbGFzcz1cIlxuICAgICAgICAgICAgICAgIHJlY29yZGluZz8udHlwZSA9PT0gJ2NvbW1hbmQnICYmIHJlY29yZGluZy5rZXkgPT09IGVudHJ5LmVudHJ5LmtleVxuICAgICAgICAgICAgICAgICAgPyAnYm9yZGVyLWJyYW5kLTUwMC80MCBiZy1icmFuZC01MDAvMTAgdGV4dC1mZy1icmFuZCdcbiAgICAgICAgICAgICAgICAgIDogJ2JvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTAgdGV4dC1mZy10ZXJ0aWFyeSBob3Zlcjpib3JkZXItYnJhbmQtNTAwLzQwJ1xuICAgICAgICAgICAgICBcIlxuICAgICAgICAgICAgICBAY2xpY2s9XCJzdGFydFJlY29yZGluZygnY29tbWFuZCcsIGVudHJ5LmVudHJ5LmtleSlcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7e1xuICAgICAgICAgICAgICAgIHJlY29yZGluZz8udHlwZSA9PT0gJ2NvbW1hbmQnICYmIHJlY29yZGluZy5rZXkgPT09IGVudHJ5LmVudHJ5LmtleVxuICAgICAgICAgICAgICAgICAgPyAn5oyJ5LiL4oCmJ1xuICAgICAgICAgICAgICAgICAgOiAn57uR54Ot6ZSuJ1xuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuXG4gICAgPCEtLSDilZDilZDilZAgV2ViREFWIOWQjOatpSDilZDilZDilZAgLS0+XG4gICAgPHNlY3Rpb24gY2xhc3M9XCJtYi05XCI+XG4gICAgICA8aDIgY2xhc3M9XCJtYi0zIHRleHQteHMgZm9udC1tZWRpdW0gdHJhY2tpbmctd2lkZXIgdGV4dC1mZy1tdXRlZCB1cHBlcmNhc2VcIj5cbiAgICAgICAgV2ViREFWIOWQjOatpe+8iOaPkuS7tuaVsOaNru+8iVxuICAgICAgPC9oMj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0xIHNoYWRvdy1zbVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS0yIHAtNFwiPlxuICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgdi1tb2RlbD1cInN5bmNGb3JtLnVybFwiXG4gICAgICAgICAgICBjbGFzcz1cInctZnVsbCByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0wIHB4LTMgcHktMiB0ZXh0LXhzIHRleHQtZmctcHJpbWFyeSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWJyYW5kLTUwMC80MFwiXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIldlYkRBViDlnLDlnYDvvIjlpoIgaHR0cHM6Ly9kYXYuZXhhbXBsZS5jb20vZGF277yJXCJcbiAgICAgICAgICAvPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtY29scy0xIGdhcC0yIHNtOmdyaWQtY29scy0yXCI+XG4gICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgdi1tb2RlbD1cInN5bmNGb3JtLnVzZXJuYW1lXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMCBweC0zIHB5LTIgdGV4dC14cyB0ZXh0LWZnLXByaW1hcnkgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1icmFuZC01MDAvNDBcIlxuICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIueUqOaIt+WQjVwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgIHYtbW9kZWw9XCJzeW5jRm9ybS5wYXNzd29yZFwiXG4gICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTAgcHgtMyBweS0yIHRleHQteHMgdGV4dC1mZy1wcmltYXJ5IG91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItYnJhbmQtNTAwLzQwXCJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCLlr4bnoIFcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgIHYtbW9kZWw9XCJzeW5jRm9ybS5yZW1vdGVEaXJcIlxuICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtMCBweC0zIHB5LTIgdGV4dC14cyB0ZXh0LWZnLXByaW1hcnkgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1icmFuZC01MDAvNDBcIlxuICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCLov5znq6/nm67lvZXvvIjpu5jorqQgL2xlYWYtbGF1bmNoZXLvvIlcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBwdC0xXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQteHMgdGV4dC1mZy1mYWludFwiPlxuICAgICAgICAgICAgICDlpIfku73lhoXlrrnkuLrmj5Lku7bmlbDmja7lv6vnhafvvJvmj5Lku7bmnKzkvZPpnIDlnKjlkITorr7lpIfph43mlrDlr7zlhaVcbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiPlxuICAgICAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiB2YXJpYW50PVwiZ2hvc3RcIiA6bG9hZGluZz1cInN5bmNUZXN0aW5nXCIgQGNsaWNrPVwib25TeW5jVGVzdFwiPlxuICAgICAgICAgICAgICAgIOa1i+ivlei/nuaOpVxuICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIDpsb2FkaW5nPVwic3luY1Jlc3RvcmluZ1wiIEBjbGljaz1cIm9uU3luY1Jlc3RvcmVcIj5cbiAgICAgICAgICAgICAgICDmgaLlpI1cbiAgICAgICAgICAgICAgPC9VQnV0dG9uPlxuICAgICAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiA6bG9hZGluZz1cInN5bmNCYWNraW5nXCIgQGNsaWNrPVwib25TeW5jU2F2ZUFuZEJhY2t1cFwiPlxuICAgICAgICAgICAgICAgIOS/neWtmOW5tuWkh+S7vVxuICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L3NlY3Rpb24+XG5cbiAgICA8IS0tIOKVkOKVkOKVkCDlvIDlj5Eg4pWQ4pWQ4pWQIC0tPlxuICAgIDxzZWN0aW9uIGNsYXNzPVwibWItOVwiPlxuICAgICAgPGgyIGNsYXNzPVwibWItMyB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRyYWNraW5nLXdpZGVyIHRleHQtZmctbXV0ZWQgdXBwZXJjYXNlXCI+5byA5Y+R6ICFPC9oMj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyb3VuZGVkLW1kIGJvcmRlciBib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0xIHNoYWRvdy1zbVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGl2aWRlLXkgZGl2aWRlLWxpbmUtc3VidGxlXCI+XG4gICAgICAgICAgPCEtLSDng63ph43ovb3lvIDlj5HmqKHlvI/vvIjlr7nmoIcgcmF5IGRldmVsb3DvvIkgLS0+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBwLTRcIj5cbiAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cImZsYXNobGlnaHQtbGluZVwiIGNsYXNzPVwibXQtMC41IHNocmluay0wIHRleHQtaW5mb1wiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWZnLXByaW1hcnlcIj7ng63ph43ovb3lvIDlj5HmqKHlvI88L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibXQtMC41IHRleHQteHMgdGV4dC1mZy10ZXJ0aWFyeVwiPlxuICAgICAgICAgICAgICAgICAg5rOo5YaM5YyF5ZCrIHBsdWdpbi5qc29uIOeahOacrOWcsOebruW9le+8jOS/neWtmOaWh+S7tuiHquWKqOmHjeijheW5tumHjei9veaPkuS7tu+8iDMwMG1zIOmYsuaKlu+8iVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgOmxvYWRpbmc9XCJkZXZBZGRpbmdcIiBAY2xpY2s9XCJvbkFkZERldlBsdWdpblwiPlxuICAgICAgICAgICAgICAgIOa3u+WKoOW8gOWPkeebruW9lVxuICAgICAgICAgICAgICA8L1VCdXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgdi1pZj1cImRldlBsdWdpbnMubGVuZ3RoID4gMFwiXG4gICAgICAgICAgICAgIGNsYXNzPVwiZGl2aWRlLXkgZGl2aWRlLWxpbmUtc3VidGxlIGJvcmRlci10IGJvcmRlci1saW5lLXN1YnRsZVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxkaXYgdi1mb3I9XCJkIGluIGRldlBsdWdpbnNcIiA6a2V5PVwiZC5wbHVnaW5JZFwiIGNsYXNzPVwicHgtNCBweS0zXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cnVuY2F0ZSB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtZmctcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge3sgZC5uYW1lIHx8IGQucGx1Z2luSWQgfX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gdi1pZj1cImQudmVyc2lvblwiIGNsYXNzPVwic2hyaW5rLTAgdGV4dC1bMTBweF0gdGV4dC1mZy1mYWludFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgdnt7IGQudmVyc2lvbiB9fVxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8VUJhZGdlIHYtaWY9XCIhZC5zb3VyY2VFeGlzdHNcIiB2YXJpYW50PVwiZGFuZ2VyXCI+55uu5b2V57y65aSxPC9VQmFkZ2U+XG4gICAgICAgICAgICAgICAgICAgICAgPFVCYWRnZSB2LWVsc2UtaWY9XCIhZC5tYW5pZmVzdFZhbGlkXCIgdmFyaWFudD1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbi5qc29uIOW8guW4uFxuICAgICAgICAgICAgICAgICAgICAgIDwvVUJhZGdlPlxuICAgICAgICAgICAgICAgICAgICAgIDxVQmFkZ2Ugdi1pZj1cIiFkLmluc3RhbGxlZFwiIHZhcmlhbnQ9XCJuZXV0cmFsXCI+5pyq5a6J6KOFPC9VQmFkZ2U+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJtdC0wLjUgdHJ1bmNhdGUgZm9udC1tb25vIHRleHQtWzEwcHhdIHRleHQtZmctdGVydGlhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgIDp0aXRsZT1cImQuc291cmNlRGlyXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIHt7IGQuc291cmNlRGlyIH19XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8bGFiZWxcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmbGV4IHNocmluay0wIGN1cnNvci1wb2ludGVyIGl0ZW1zLWNlbnRlciBnYXAtMS41IHRleHQteHMgdGV4dC1mZy1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICAgIDpjaGVja2VkPVwiZC5hdXRvUmVsb2FkXCJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImFjY2VudC1icmFuZC01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgIEBjaGFuZ2U9XCJvbkRldkF1dG9SZWxvYWQoZCwgKCRldmVudC50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZClcIlxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICDoh6rliqjph43ovb1cbiAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8VUJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgICAgICAgICAgICA6bG9hZGluZz1cImRldlJlbG9hZGluZ0lkID09PSBkLnBsdWdpbklkXCJcbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPVwib25EZXZSZWxvYWQoZClcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICDph43ovb1cbiAgICAgICAgICAgICAgICAgIDwvVUJ1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIEBjbGljaz1cIm9uRGV2UmVtb3ZlKGQpXCI+56e76ZmkPC9VQnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJib3JkZXItdCBib3JkZXItbGluZS1zdWJ0bGUgcHgtNCBweS0zIHRleHQteHMgdGV4dC1mZy1mYWludFwiPlxuICAgICAgICAgICAgICDov5jmsqHmnInms6jlhozlvIDlj5Hnm67lvZXjgILpgInmi6nku5PlupMgZXhhbXBsZS1wbHVnaW4vIOivleivle+8muS/ruaUuSBpbmRleC5odG1sIOS/neWtmOWQjuS8muiHquWKqOmHjei9veOAglxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtc3RhcnQgZ2FwLTMgcC00XCI+XG4gICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwiY29kZS1zLXNsYXNoLWxpbmVcIiBjbGFzcz1cIm10LTAuNSBzaHJpbmstMCB0ZXh0LWluZm9cIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMSB0ZXh0LXhzIGxlYWRpbmctcmVsYXhlZCB0ZXh0LWZnLXRlcnRpYXJ5XCI+XG4gICAgICAgICAgICAgIOaPkuS7tiA9IOS4gOS4quWMheWQq1xuICAgICAgICAgICAgICA8Y29kZSBjbGFzcz1cInJvdW5kZWQgYmctc3VyZmFjZS0yIHB4LTEgcHktMC41IHRleHQtZmctcHJpbWFyeVwiPnBsdWdpbi5qc29uPC9jb2RlPlxuICAgICAgICAgICAgICDnmoTnm67lvZXvvIjlo7DmmI4gaWQgLyDlkI3np7AgLyDlhaXlj6PpobUgLyDlkb3ku6TvvInvvIzpobXpnaLph4zpgJrov4dcbiAgICAgICAgICAgICAgPGNvZGUgY2xhc3M9XCJyb3VuZGVkIGJnLXN1cmZhY2UtMiBweC0xIHB5LTAuNSB0ZXh0LWZnLXByaW1hcnlcIlxuICAgICAgICAgICAgICAgID53aW5kb3cubGF1bmNoZXJBcGk8L2NvZGVcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICDosIPnlKjlj5fmjqcgQVBJ77yI6YCa55+l44CB5Ymq6LS05p2/44CB5Ymv6L6T5YWl5qGG44CB5pWw5o2u5a2Y5YKo562J77yJ44CC5Y+C6ICD5LuT5bqTXG4gICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwicm91bmRlZCBiZy1zdXJmYWNlLTIgcHgtMSBweS0wLjUgdGV4dC1mZy1wcmltYXJ5XCI+ZXhhbXBsZS1wbHVnaW4vPC9jb2RlPlxuICAgICAgICAgICAgICDkuI5cbiAgICAgICAgICAgICAgPGNvZGUgY2xhc3M9XCJyb3VuZGVkIGJnLXN1cmZhY2UtMiBweC0xIHB5LTAuNVwiPmRvY3MvbW9kdWxlcy8xMC1sYXVuY2hlci5tZDwvY29kZT7jgIJcbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBwLTRcIj5cbiAgICAgICAgICAgIDxBcHBJY29uIGljb249XCJmb2xkZXItMi1saW5lXCIgY2xhc3M9XCJtdC0wLjUgc2hyaW5rLTAgdGV4dC1pbmZvXCIgOnNpemU9XCIxNlwiIC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1mZy1wcmltYXJ5XCI+5o+S5Lu25pWw5o2u55uu5b2VPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtdC0wLjUgdGV4dC14cyB0ZXh0LWZnLXRlcnRpYXJ5XCI+5bey5a6J6KOF5o+S5Lu25LiO57Si5byV55qE5a2Y5pS+5L2N572uPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIEBjbGljaz1cIm9wZW5QbHVnaW5zRGlyKClcIj7miZPlvIA8L1VCdXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyBjb21wdXRlZCwgb25CZWZvcmVVbm1vdW50LCBvbk1vdW50ZWQsIHJlZiwgd2F0Y2ggfSBmcm9tICd2dWUnXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCBVQmFkZ2UgZnJvbSAnQGNvbXBvbmVudHMvdWkvVUJhZGdlLnZ1ZSdcbmltcG9ydCBVQnV0dG9uIGZyb20gJ0Bjb21wb25lbnRzL3VpL1VCdXR0b24udnVlJ1xuaW1wb3J0IFVFbXB0eSBmcm9tICdAY29tcG9uZW50cy91aS9VRW1wdHkudnVlJ1xuaW1wb3J0IHsgdXNlVG9hc3QgfSBmcm9tICdAY29tcG9zYWJsZXMvdXNlVG9hc3QnXG5pbXBvcnQgeyBidWlsZFN0YXRpY0NvbW1hbmRzIH0gZnJvbSAnQHNoYXJlZC9jb21tYW5kcydcblxuaW50ZXJmYWNlIExhdW5jaGVyUGx1Z2luIHtcbiAgaWQ6IHN0cmluZ1xuICBuYW1lOiBzdHJpbmdcbiAgdmVyc2lvbj86IHN0cmluZ1xuICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICBlbmFibGVkOiBib29sZWFuXG4gIGNvbW1hbmRzPzogQXJyYXk8eyBjb2RlOiBzdHJpbmc7IHRpdGxlOiBzdHJpbmc7IGRlc2NyaXB0aW9uPzogc3RyaW5nIH0+XG4gIHByZWZlcmVuY2VzPzogQXJyYXk8e1xuICAgIG5hbWU6IHN0cmluZ1xuICAgIGxhYmVsOiBzdHJpbmdcbiAgICB0eXBlOiAndGV4dCcgfCAnc2VsZWN0JyB8ICdjaGVja2JveCdcbiAgICBkZWZhdWx0Pzogc3RyaW5nIHwgYm9vbGVhblxuICAgIG9wdGlvbnM/OiBzdHJpbmdbXVxuICB9PlxufVxuXG5jb25zdCB0b2FzdCA9IHVzZVRvYXN0KClcbmNvbnN0IHBsdWdpbnMgPSByZWY8TGF1bmNoZXJQbHVnaW5bXT4oW10pXG5jb25zdCBpbXBvcnRpbmcgPSByZWYoZmFsc2UpXG5cbmZ1bmN0aW9uIG9wZW5QbHVnaW5zRGlyKCk6IHZvaWQge1xuICB3aW5kb3cuYXBpLmxhdW5jaGVyLm9wZW5QbHVnaW5zRGlyKClcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBwbHVnaW5zLnZhbHVlID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5saXN0UGx1Z2lucygpXG4gIH0gY2F0Y2gge1xuICAgIHRvYXN0LmVycm9yKCfor7vlj5bmj5Lku7bliJfooajlpLHotKUnKVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uSW1wb3J0KCk6IFByb21pc2U8dm9pZD4ge1xuICBpbXBvcnRpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgY29uc3QgcGlja2VkID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5zZWxlY3RQbHVnaW5Gb2xkZXIoKVxuICAgIGlmICghcGlja2VkLnN1Y2Nlc3MgfHwgIXBpY2tlZC5kaXJQYXRoKSByZXR1cm5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLmluc3RhbGxGcm9tRm9sZGVyKHBpY2tlZC5kaXJQYXRoKVxuICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdG9hc3Quc3VjY2Vzcyhg5bey5a+85YWlICR7cmVzdWx0LnBsdWdpbj8ubmFtZSA/PyAn5o+S5Lu2J31gKVxuICAgICAgYXdhaXQgcmVmcmVzaCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRvYXN0LmVycm9yKCflr7zlhaXlpLHotKUnLCB7IGRlc2NyaXB0aW9uOiByZXN1bHQuZXJyb3IgfSlcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdG9hc3QuZXJyb3IoJ+WvvOWFpeWksei0pScsIHsgZGVzY3JpcHRpb246IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9KVxuICB9IGZpbmFsbHkge1xuICAgIGltcG9ydGluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSAIOaPkuS7tuW4guWcuu+8iE0zLjUg6Z2Z5oCB5biC5Zy6IHYw77yJ4pSA4pSA4pSA4pSA4pSAXG5pbnRlcmZhY2UgTWFya2V0RW50cnkge1xuICBpZDogc3RyaW5nXG4gIG5hbWU6IHN0cmluZ1xuICB2ZXJzaW9uPzogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGF1dGhvcj86IHN0cmluZ1xuICBkb3dubG9hZDogc3RyaW5nXG4gIGluc3RhbGxlZDogYm9vbGVhblxuICBpbnN0YWxsZWRWZXJzaW9uPzogc3RyaW5nXG4gIHVwZGF0YWJsZTogYm9vbGVhblxufVxuXG5jb25zdCBtYXJrZXQgPSByZWY8TWFya2V0RW50cnlbXT4oW10pXG5jb25zdCBtYXJrZXRMb2FkaW5nID0gcmVmKGZhbHNlKVxuY29uc3QgaW5zdGFsbGluZ0lkID0gcmVmPHN0cmluZyB8IG51bGw+KG51bGwpXG5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hNYXJrZXQoKTogUHJvbWlzZTx2b2lkPiB7XG4gIG1hcmtldExvYWRpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgbWFya2V0LnZhbHVlID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5tYXJrZXRMaXN0KClcbiAgfSBjYXRjaCB7XG4gICAgLyog57Si5byV6K+75Y+W5aSx6LSl5L+d5oyB56m6ICovXG4gIH0gZmluYWxseSB7XG4gICAgbWFya2V0TG9hZGluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gb25NYXJrZXRJbnN0YWxsKGVudHJ5OiBNYXJrZXRFbnRyeSk6IFByb21pc2U8dm9pZD4ge1xuICBpbnN0YWxsaW5nSWQudmFsdWUgPSBlbnRyeS5pZFxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIubWFya2V0SW5zdGFsbChlbnRyeS5pZClcbiAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRvYXN0LnN1Y2Nlc3MoYOW3suWuieijhSAke3Jlc3VsdC5wbHVnaW4/Lm5hbWUgPz8gZW50cnkubmFtZX1gKVxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW3JlZnJlc2goKSwgcmVmcmVzaE1hcmtldCgpXSlcbiAgICB9IGVsc2Uge1xuICAgICAgdG9hc3QuZXJyb3IoJ+WuieijheWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0b2FzdC5lcnJvcign5a6J6KOF5aSx6LSlJywgeyBkZXNjcmlwdGlvbjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH0pXG4gIH0gZmluYWxseSB7XG4gICAgaW5zdGFsbGluZ0lkLnZhbHVlID0gbnVsbFxuICB9XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgCDlvIDlj5HogIXnlJ/mgIHpgJrpgZPvvIhsYXVuY2hlcjpkZXZQbHVnaW5zOiogLyBsYXVuY2hlcjptYXJrZXQ6dXBkYXRl77yJ4pSA4pSA4pSA4pSA4pSAXG4vLyDms6jmhI/vvJrov5nkupvmlrnms5XpnIDopoHphY3lpZfnmoQgcHJlbG9hZCDnu5HlrprvvIjmuIXljZXop4EgZG9jcy9QTFVHSU5fREVWRUxPUE1FTlQubWTjgIzlvIDlj5HmqKHlvI/jgI3vvInjgIJcbi8vIOe7keWumuWwsee7quWJjSB3aW5kb3cuYXBpLmxhdW5jaGVyIOS4iuS4jeWtmOWcqOWvueW6lOaWueazle+8jOi/memHjOe7n+S4gCBjYXN0ICsg5a2Y5Zyo5oCn5a6I5Y2r77yMXG4vLyDov5DooYzml7booYzkuLrkuI7ml6LmnIkgd2luZG93LmFwaS5sYXVuY2hlciDmlrnms5XlrozlhajkuIDoh7RcbmludGVyZmFjZSBNYXJrZXRVcGRhdGVSZXN1bHQge1xuICBzdWNjZXNzOiBib29sZWFuXG4gIGVycm9yPzogc3RyaW5nXG4gIHBsdWdpbj86IHsgaWQ6IHN0cmluZzsgbmFtZT86IHN0cmluZzsgdmVyc2lvbj86IHN0cmluZyB9XG59XG5cbmludGVyZmFjZSBEZXZQbHVnaW5Sb3cge1xuICBwbHVnaW5JZDogc3RyaW5nXG4gIHNvdXJjZURpcjogc3RyaW5nXG4gIGF1dG9SZWxvYWQ6IGJvb2xlYW5cbiAgbmFtZT86IHN0cmluZ1xuICB2ZXJzaW9uPzogc3RyaW5nXG4gIGluc3RhbGxlZDogYm9vbGVhblxuICBzb3VyY2VFeGlzdHM6IGJvb2xlYW5cbiAgbWFuaWZlc3RWYWxpZDogYm9vbGVhblxufVxuXG5pbnRlcmZhY2UgRGV2UGx1Z2luc0FwaSB7XG4gIGRldlBsdWdpbnNMaXN0OiAoKSA9PiBQcm9taXNlPERldlBsdWdpblJvd1tdPlxuICBkZXZQbHVnaW5zQWRkOiAoZGlyOiBzdHJpbmcpID0+IFByb21pc2U8e1xuICAgIG9rOiBib29sZWFuXG4gICAgZXJyb3I/OiBzdHJpbmdcbiAgICBwbHVnaW4/OiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgdmVyc2lvbj86IHN0cmluZyB9XG4gIH0+XG4gIGRldlBsdWdpbnNSZW1vdmU6IChwbHVnaW5JZDogc3RyaW5nKSA9PiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+XG4gIGRldlBsdWdpbnNTZXRBdXRvUmVsb2FkOiAoXG4gICAgcGx1Z2luSWQ6IHN0cmluZyxcbiAgICBhdXRvUmVsb2FkOiBib29sZWFuXG4gICkgPT4gUHJvbWlzZTx7IG9rOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PlxuICBkZXZQbHVnaW5zUmVsb2FkOiAocGx1Z2luSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx7XG4gICAgb2s6IGJvb2xlYW5cbiAgICBlcnJvcj86IHN0cmluZ1xuICAgIHBsdWdpbj86IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyB2ZXJzaW9uPzogc3RyaW5nIH1cbiAgfT5cbiAgbWFya2V0VXBkYXRlOiAoZW50cnlJZDogc3RyaW5nKSA9PiBQcm9taXNlPE1hcmtldFVwZGF0ZVJlc3VsdD5cbiAgLyoqIOS4u+i/m+eoi+aOqOmAge+8mndhdGNoZXIg6Ieq5Yqo6YeN6KOF57uT5p6c77yI5oiQ5YqfL+Wksei0pe+8ie+8jOeUqOS6jiB0b2FzdCDkuI7liJfooajliLfmlrAgKi9cbiAgb25EZXZQbHVnaW5zQ2hhbmdlZDogKFxuICAgIGNiOiAocGF5bG9hZDoge1xuICAgICAga2luZDogJ2FkZGVkJyB8ICdyZW1vdmVkJyB8ICdyZWxvYWRlZCcgfCAnZXJyb3InXG4gICAgICBwbHVnaW5JZDogc3RyaW5nXG4gICAgICBuYW1lPzogc3RyaW5nXG4gICAgICBlcnJvcj86IHN0cmluZ1xuICAgIH0pID0+IHZvaWRcbiAgKSA9PiAoKSA9PiB2b2lkXG59XG5cbi8qKiBkZXZQbHVnaW5zIOe7keWumuaYr+WQpuWPr+eUqO+8iOaXpyBwcmVsb2FkIOS4iuaWueazleS4jeWtmOWcqCDihpIg6L+U5ZueIG51bGzvvIznlYzpnaLpmY3nuqfkuLrkuI3lj6/nlKjvvIkgKi9cbmZ1bmN0aW9uIGRldkNoYW5uZWxzKCk6IERldlBsdWdpbnNBcGkgfCBudWxsIHtcbiAgY29uc3QgYXBpID0gd2luZG93LmFwaS5sYXVuY2hlciBhcyB1bmtub3duIGFzIFBhcnRpYWw8RGV2UGx1Z2luc0FwaT5cbiAgcmV0dXJuIHR5cGVvZiBhcGkuZGV2UGx1Z2luc0xpc3QgPT09ICdmdW5jdGlvbicgPyAoYXBpIGFzIERldlBsdWdpbnNBcGkpIDogbnVsbFxufVxuXG5hc3luYyBmdW5jdGlvbiBvbk1hcmtldFVwZGF0ZShlbnRyeTogTWFya2V0RW50cnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgYXBpID0gZGV2Q2hhbm5lbHMoKVxuICBpZiAoIWFwaSB8fCB0eXBlb2YgYXBpLm1hcmtldFVwZGF0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRvYXN0LmVycm9yKCfmm7TmlrDpgJrpgZPmnKrlsLHnu6onLCB7IGRlc2NyaXB0aW9uOiAn6ZyA6KaB5YyF5ZCrIG1hcmtldFVwZGF0ZSDnu5HlrprnmoQgcHJlbG9hZCcgfSlcbiAgICByZXR1cm5cbiAgfVxuICBpbnN0YWxsaW5nSWQudmFsdWUgPSBlbnRyeS5pZFxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwaS5tYXJrZXRVcGRhdGUoZW50cnkuaWQpXG4gICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICB0b2FzdC5zdWNjZXNzKFxuICAgICAgICBg5bey5pu05pawICR7cmVzdWx0LnBsdWdpbj8ubmFtZSA/PyBlbnRyeS5uYW1lfWAgK1xuICAgICAgICAgIChyZXN1bHQucGx1Z2luPy52ZXJzaW9uID8gYCDihpIgdiR7cmVzdWx0LnBsdWdpbi52ZXJzaW9ufWAgOiAnJylcbiAgICAgIClcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKFtyZWZyZXNoKCksIHJlZnJlc2hNYXJrZXQoKV0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRvYXN0LmVycm9yKCfmm7TmlrDlpLHotKUnLCB7IGRlc2NyaXB0aW9uOiByZXN1bHQuZXJyb3IgfSlcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdG9hc3QuZXJyb3IoJ+abtOaWsOWksei0pScsIHsgZGVzY3JpcHRpb246IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9KVxuICB9IGZpbmFsbHkge1xuICAgIGluc3RhbGxpbmdJZC52YWx1ZSA9IG51bGxcbiAgfVxufVxuXG5jb25zdCBkZXZQbHVnaW5zID0gcmVmPERldlBsdWdpblJvd1tdPihbXSlcbmNvbnN0IGRldkFkZGluZyA9IHJlZihmYWxzZSlcbmNvbnN0IGRldlJlbG9hZGluZ0lkID0gcmVmPHN0cmluZyB8IG51bGw+KG51bGwpXG5sZXQgb2ZmRGV2Q2hhbmdlZDogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGxcblxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaERldlBsdWdpbnMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGFwaSA9IGRldkNoYW5uZWxzKClcbiAgaWYgKCFhcGkpIHJldHVyblxuICB0cnkge1xuICAgIGRldlBsdWdpbnMudmFsdWUgPSBhd2FpdCBhcGkuZGV2UGx1Z2luc0xpc3QoKVxuICB9IGNhdGNoIHtcbiAgICAvKiDor7vlj5blpLHotKXkv53mjIHnqbogKi9cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBvbkFkZERldlBsdWdpbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgYXBpID0gZGV2Q2hhbm5lbHMoKVxuICBpZiAoIWFwaSkge1xuICAgIHRvYXN0LmVycm9yKCflvIDlj5HogIXpgJrpgZPmnKrlsLHnu6onLCB7IGRlc2NyaXB0aW9uOiAn6ZyA6KaB5YyF5ZCrIGRldlBsdWdpbnMg57uR5a6a55qEIHByZWxvYWQnIH0pXG4gICAgcmV0dXJuXG4gIH1cbiAgZGV2QWRkaW5nLnZhbHVlID0gdHJ1ZVxuICB0cnkge1xuICAgIC8vIOebruW9lemAieaLqeWkjeeUqOeuoeeQhumhteOAjOS7juaWh+S7tuWkueWvvOWFpeOAjeeahOaXouaciSBkaWFsb2cg6YCa6YGTXG4gICAgY29uc3QgcGlja2VkID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5zZWxlY3RQbHVnaW5Gb2xkZXIoKVxuICAgIGlmICghcGlja2VkLnN1Y2Nlc3MgfHwgIXBpY2tlZC5kaXJQYXRoKSByZXR1cm5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcGkuZGV2UGx1Z2luc0FkZChwaWNrZWQuZGlyUGF0aClcbiAgICBpZiAocmVzdWx0Lm9rKSB7XG4gICAgICB0b2FzdC5zdWNjZXNzKGDlt7Lms6jlhozlvIDlj5Hnm67lvZXvvJoke3Jlc3VsdC5wbHVnaW4/Lm5hbWUgPz8gcmVzdWx0LnBsdWdpbj8uaWQgPz8gJyd9YClcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKFtyZWZyZXNoKCksIHJlZnJlc2hEZXZQbHVnaW5zKCksIHJlZnJlc2hNYXJrZXQoKV0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRvYXN0LmVycm9yKCfms6jlhozlpLHotKUnLCB7IGRlc2NyaXB0aW9uOiByZXN1bHQuZXJyb3IgfSlcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdG9hc3QuZXJyb3IoJ+azqOWGjOWksei0pScsIHsgZGVzY3JpcHRpb246IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9KVxuICB9IGZpbmFsbHkge1xuICAgIGRldkFkZGluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gb25EZXZBdXRvUmVsb2FkKGQ6IERldlBsdWdpblJvdywgYXV0b1JlbG9hZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBhcGkgPSBkZXZDaGFubmVscygpXG4gIGlmICghYXBpKSByZXR1cm5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpLmRldlBsdWdpbnNTZXRBdXRvUmVsb2FkKGQucGx1Z2luSWQsIGF1dG9SZWxvYWQpXG4gIGlmIChyZXN1bHQub2spIHtcbiAgICBhd2FpdCByZWZyZXNoRGV2UGx1Z2lucygpXG4gIH0gZWxzZSB7XG4gICAgdG9hc3QuZXJyb3IoJ+iuvue9ruWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICAgIGF3YWl0IHJlZnJlc2hEZXZQbHVnaW5zKClcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBvbkRldlJlbG9hZChkOiBEZXZQbHVnaW5Sb3cpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgYXBpID0gZGV2Q2hhbm5lbHMoKVxuICBpZiAoIWFwaSkgcmV0dXJuXG4gIGRldlJlbG9hZGluZ0lkLnZhbHVlID0gZC5wbHVnaW5JZFxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwaS5kZXZQbHVnaW5zUmVsb2FkKGQucGx1Z2luSWQpXG4gICAgaWYgKHJlc3VsdC5vaykge1xuICAgICAgdG9hc3Quc3VjY2Vzcyhg5bey6YeN6L29ICR7cmVzdWx0LnBsdWdpbj8ubmFtZSA/PyBkLm5hbWUgPz8gZC5wbHVnaW5JZH1gKVxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW3JlZnJlc2goKSwgcmVmcmVzaERldlBsdWdpbnMoKSwgcmVmcmVzaE1hcmtldCgpXSlcbiAgICB9IGVsc2Uge1xuICAgICAgdG9hc3QuZXJyb3IoJ+mHjei9veWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0b2FzdC5lcnJvcign6YeN6L295aSx6LSlJywgeyBkZXNjcmlwdGlvbjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH0pXG4gIH0gZmluYWxseSB7XG4gICAgZGV2UmVsb2FkaW5nSWQudmFsdWUgPSBudWxsXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gb25EZXZSZW1vdmUoZDogRGV2UGx1Z2luUm93KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGFwaSA9IGRldkNoYW5uZWxzKClcbiAgaWYgKCFhcGkpIHJldHVyblxuICAvLyDor63kuYnvvJrnp7vpmaQgPSDop6PpmaTlvIDlj5Hot5/ouKrvvIjlgZwgd2F0Y2hlciArIOWIoOmFjee9ru+8ie+8jOaPkuS7tuacrOS9k+S/neeVmeW3suWuieijhe+8m1xuICAvLyDpnIDopoHljbjovb3ml7bnlKjjgIzlt7Llronoo4Xmj5Lku7bjgI3ljLrnmoTljbjovb3mjInpkq5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpLmRldlBsdWdpbnNSZW1vdmUoZC5wbHVnaW5JZClcbiAgaWYgKHJlc3VsdC5vaykge1xuICAgIHRvYXN0LnN1Y2Nlc3MoYOW3suenu+mZpOW8gOWPkei3n+i4qu+8miR7ZC5uYW1lIHx8IGQucGx1Z2luSWR977yI5o+S5Lu25L+d55WZ5bey5a6J6KOF77yJYClcbiAgICBhd2FpdCByZWZyZXNoRGV2UGx1Z2lucygpXG4gIH0gZWxzZSB7XG4gICAgdG9hc3QuZXJyb3IoJ+enu+mZpOWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICB9XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgCDmj5Lku7blgY/lpb3vvIhNMy4y77yJ4pSA4pSA4pSA4pSA4pSAXG5jb25zdCBwcmVmc09wZW4gPSByZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcbmNvbnN0IHByZWZWYWx1ZXMgPSByZWY8UmVjb3JkPHN0cmluZywgc3RyaW5nIHwgYm9vbGVhbj4+KHt9KVxuY29uc3QgcHJlZlNhdmluZyA9IHJlZihmYWxzZSlcblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlUHJlZnMocGx1Z2luSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAocHJlZnNPcGVuLnZhbHVlID09PSBwbHVnaW5JZCkge1xuICAgIHByZWZzT3Blbi52YWx1ZSA9IG51bGxcbiAgICByZXR1cm5cbiAgfVxuICBjb25zdCBwbHVnaW4gPSBwbHVnaW5zLnZhbHVlLmZpbmQoKHApID0+IHAuaWQgPT09IHBsdWdpbklkKVxuICBpZiAoIXBsdWdpbikgcmV0dXJuXG4gIC8vIOWxleW8gOaXtuaLieWPluW9k+WJjeWAvO+8iOm7mOiupOWAvOWFnOW6le+8iVxuICBmb3IgKGNvbnN0IHByZWYgb2YgcGx1Z2luLnByZWZlcmVuY2VzID8/IFtdKSB7XG4gICAgY29uc3Qga2V5ID0gcGx1Z2luSWQgKyAnLicgKyBwcmVmLm5hbWVcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5nZXRQcmVmZXJlbmNlKHBsdWdpbklkLCBwcmVmLm5hbWUpXG4gICAgICBwcmVmVmFsdWVzLnZhbHVlW2tleV0gPSAocmVzdWx0Py52YWx1ZSA/PyBwcmVmLmRlZmF1bHQgPz8gJycpIGFzIHN0cmluZyB8IGJvb2xlYW5cbiAgICB9IGNhdGNoIHtcbiAgICAgIHByZWZWYWx1ZXMudmFsdWVba2V5XSA9IChwcmVmLmRlZmF1bHQgPz8gJycpIGFzIHN0cmluZyB8IGJvb2xlYW5cbiAgICB9XG4gIH1cbiAgcHJlZnNPcGVuLnZhbHVlID0gcGx1Z2luSWRcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZVByZWZzKHBsdWdpbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcHJlZlNhdmluZy52YWx1ZSA9IHRydWVcbiAgdHJ5IHtcbiAgICBjb25zdCBwbHVnaW4gPSBwbHVnaW5zLnZhbHVlLmZpbmQoKHApID0+IHAuaWQgPT09IHBsdWdpbklkKVxuICAgIGlmICghcGx1Z2luKSByZXR1cm5cbiAgICBmb3IgKGNvbnN0IHByZWYgb2YgcGx1Z2luLnByZWZlcmVuY2VzID8/IFtdKSB7XG4gICAgICBjb25zdCBrZXkgPSBwbHVnaW5JZCArICcuJyArIHByZWYubmFtZVxuICAgICAgYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5zZXRQcmVmZXJlbmNlKHBsdWdpbklkLCBwcmVmLm5hbWUsIHByZWZWYWx1ZXMudmFsdWVba2V5XSlcbiAgICB9XG4gICAgdG9hc3Quc3VjY2Vzcygn5YGP5aW95bey5L+d5a2YJylcbiAgfSBjYXRjaCB7XG4gICAgdG9hc3QuZXJyb3IoJ+WBj+WlveS/neWtmOWksei0pScpXG4gIH0gZmluYWxseSB7XG4gICAgcHJlZlNhdmluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSAIOW/q+aNt+mUru+8iE0077yJ4pSA4pSA4pSA4pSA4pSAXG5pbnRlcmZhY2UgSG90a2V5U3BlYyB7XG4gIGtpbmQ6IHN0cmluZ1xuICBpZD86IHN0cmluZ1xuICBwYXRoPzogc3RyaW5nXG4gIHVybD86IHN0cmluZ1xufVxuXG5jb25zdCBob3RrZXlDb25maWcgPSByZWY8e1xuICBtYWluOiBzdHJpbmdcbiAgY29tbWFuZHM6IFJlY29yZDxzdHJpbmcsIEhvdGtleVNwZWM+XG4gIGNob3Jkcz86IFJlY29yZDxzdHJpbmcsIEhvdGtleVNwZWM+XG59Pih7XG4gIG1haW46ICdBbHQrU3BhY2UnLFxuICBjb21tYW5kczoge31cbn0pXG5jb25zdCByZWNvcmRpbmcgPSByZWY8eyB0eXBlOiAnbWFpbicgfCAnY29tbWFuZCc7IGtleT86IHN0cmluZyB9IHwgbnVsbD4obnVsbClcblxuLyoqIOWPr+e7keeDremUrueahOWRveS7pO+8iOmdmeaAgeWRveS7pOazqOWGjOihqCDihpIg54Ot6ZSuIHNwZWPvvIkgKi9cbmZ1bmN0aW9uIHNwZWNPZkNvbW1hbmQoZW50cnk6IENvbW1hbmRFbnRyeUxpa2UpOiBIb3RrZXlTcGVjIHwgbnVsbCB7XG4gIGNvbnN0IGEgPSBlbnRyeS5hY3Rpb25cbiAgc3dpdGNoIChhLnR5cGUpIHtcbiAgICBjYXNlICdtb2R1bGUnOlxuICAgICAgcmV0dXJuIHsga2luZDogJ21vZHVsZScsIGlkOiBhLm1vZHVsZUlkLCBwYXRoOiBhLnBhdGggfVxuICAgIGNhc2UgJ3BhZ2UnOlxuICAgICAgcmV0dXJuIHsga2luZDogJ21vZHVsZScsIGlkOiBhLnBhZ2VJZCwgcGF0aDogYS5wYXRoIH1cbiAgICBjYXNlICdhY3Rpb24nOlxuICAgICAgcmV0dXJuIGEuYWN0aW9uID09PSAnc2NyZWVuc2hvdC5zdGFydCcgPyB7IGtpbmQ6ICdzY3JlZW5zaG90JyB9IDogbnVsbFxuICAgIGNhc2UgJ3N5c3RlbSc6XG4gICAgICByZXR1cm4geyBraW5kOiAnc3lzdGVtJywgaWQ6IGEuY21kSWQgfVxuICAgIGNhc2UgJ3F1aWNrbGluayc6XG4gICAgICByZXR1cm4geyBraW5kOiAncXVpY2tsaW5rJywgdXJsOiBhLnVybCB9XG4gICAgY2FzZSAnZmlyc3RQYXJ0eSc6XG4gICAgICByZXR1cm4geyBraW5kOiAnZmlyc3RQYXJ0eScsIGlkOiBhLnBhZ2UgfVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmludGVyZmFjZSBDb21tYW5kRW50cnlMaWtlIHtcbiAga2V5OiBzdHJpbmdcbiAgaWNvbjogc3RyaW5nXG4gIHRpdGxlOiBzdHJpbmdcbiAgc3VidGl0bGU6IHN0cmluZ1xuICBhY3Rpb246IHtcbiAgICB0eXBlOiBzdHJpbmdcbiAgICBtb2R1bGVJZD86IHN0cmluZ1xuICAgIHBhdGg/OiBzdHJpbmdcbiAgICBwYWdlSWQ/OiBzdHJpbmdcbiAgICBjbWRJZD86IHN0cmluZ1xuICAgIHVybD86IHN0cmluZ1xuICAgIHBhZ2U/OiBzdHJpbmdcbiAgICBhY3Rpb24/OiBzdHJpbmdcbiAgfVxufVxuXG5jb25zdCBob3RrZXlDb21tYW5kcyA9IGNvbXB1dGVkKCgpID0+IHtcbiAgY29uc3Qgc3BlY3MgPSBidWlsZFN0YXRpY0NvbW1hbmRzKCkgYXMgdW5rbm93biBhcyBDb21tYW5kRW50cnlMaWtlW11cbiAgcmV0dXJuIHNwZWNzXG4gICAgLm1hcCgoZW50cnkpID0+IHtcbiAgICAgIGNvbnN0IHNwZWMgPSBzcGVjT2ZDb21tYW5kKGVudHJ5KVxuICAgICAgY29uc3QgYm91bmQgPSBzcGVjXG4gICAgICAgID8gT2JqZWN0LmVudHJpZXMoaG90a2V5Q29uZmlnLnZhbHVlLmNvbW1hbmRzKVxuICAgICAgICAgICAgLmZpbHRlcigoWywgc10pID0+IEpTT04uc3RyaW5naWZ5KHMpID09PSBKU09OLnN0cmluZ2lmeShzcGVjKSlcbiAgICAgICAgICAgIC5tYXAoKFthY2NlbF0pID0+IGFjY2VsKVxuICAgICAgICA6IFtdXG4gICAgICByZXR1cm4geyBlbnRyeSwgc3BlYywgYm91bmQ6IGJvdW5kLmxlbmd0aCA+IDAgPyBib3VuZCA6IG51bGwgfVxuICAgIH0pXG4gICAgLmZpbHRlcigocm93KSA9PiByb3cuc3BlYyAhPT0gbnVsbClcbn0pXG5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hIb3RrZXlzKCk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGhvdGtleUNvbmZpZy52YWx1ZSA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuaG90a2V5c0dldENvbmZpZygpXG4gIH0gY2F0Y2gge1xuICAgIC8qIOS/neaMgem7mOiupCAqL1xuICB9XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgCDkuKTmrrXlvI/nm7Tovr7vvIjkuLvng63plK7lkI7mjInkvY/kv67ppbDplK4gKyDlrZfmr43vvInilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIGNob3JkTGV0dGVyT2YoZW50cnk6IENvbW1hbmRFbnRyeUxpa2UpOiBzdHJpbmcge1xuICBjb25zdCBzcGVjID0gc3BlY09mQ29tbWFuZChlbnRyeSlcbiAgaWYgKCFzcGVjKSByZXR1cm4gJydcbiAgY29uc3QgZm91bmQgPSBPYmplY3QuZW50cmllcyhob3RrZXlDb25maWcudmFsdWUuY2hvcmRzID8/IHt9KS5maW5kKFxuICAgIChbLCBzXSkgPT4gSlNPTi5zdHJpbmdpZnkocykgPT09IEpTT04uc3RyaW5naWZ5KHNwZWMpXG4gIClcbiAgcmV0dXJuIGZvdW5kPy5bMF0gPz8gJydcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0Q2hvcmRMZXR0ZXIoZW50cnk6IENvbW1hbmRFbnRyeUxpa2UsIGxldHRlcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHNwZWMgPSBzcGVjT2ZDb21tYW5kKGVudHJ5KVxuICBpZiAoIXNwZWMpIHJldHVyblxuICBjb25zdCBsID0gbGV0dGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG4gIGlmIChsICYmICEvXlthLXpdJC8udGVzdChsKSkge1xuICAgIHRvYXN0LmVycm9yKCfkuKTmrrXlvI/lrZfmr43lj6rog73mmK8gYS16JylcbiAgICBhd2FpdCByZWZyZXNoSG90a2V5cygpXG4gICAgcmV0dXJuXG4gIH1cbiAgdHJ5IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLmhvdGtleXNTZXRDaG9yZChsLCBsID8gc3BlYyA6IG51bGwpXG4gICAgYXdhaXQgcmVmcmVzaEhvdGtleXMoKVxuICB9IGNhdGNoIHtcbiAgICB0b2FzdC5lcnJvcign5Lik5q615byP6YWN572u5aSx6LSlJylcbiAgfVxufVxuXG4vLyDilIDilIDilIDilIDilIAg54mH5q615paH5pys5omp5bGV77yITTUuMe+8ieKUgOKUgOKUgOKUgOKUgFxuY29uc3QgZXhwYW5zaW9uRW5hYmxlZCA9IHJlZihmYWxzZSlcbmNvbnN0IGV4cGFuc2lvblRyaWdnZXJDb3VudCA9IHJlZigwKVxuY29uc3QgZXhwYW5zaW9uSG9va09rID0gcmVmKHRydWUpXG5jb25zdCBwcm9iaW5nID0gcmVmKGZhbHNlKVxuY29uc3QgcHJvYmVGYWlsZWQgPSByZWYoZmFsc2UpXG5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hFeHBhbnNpb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY2ZnID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5leHBhbnNpb25HZXRDb25maWcoKVxuICAgIGV4cGFuc2lvbkVuYWJsZWQudmFsdWUgPSBjZmcuZW5hYmxlZFxuICAgIGV4cGFuc2lvblRyaWdnZXJDb3VudC52YWx1ZSA9IGNmZy50cmlnZ2VyQ291bnRcbiAgICBleHBhbnNpb25Ib29rT2sudmFsdWUgPSBjZmcuaG9va0F2YWlsYWJsZVxuICB9IGNhdGNoIHtcbiAgICAvKiDkv53mjIHpu5jorqQgKi9cbiAgfVxufVxuXG53YXRjaChleHBhbnNpb25FbmFibGVkLCBhc3luYyAoZW5hYmxlZCkgPT4ge1xuICB0cnkge1xuICAgIGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuZXhwYW5zaW9uU2V0Q29uZmlnKHsgZW5hYmxlZCB9KVxuICB9IGNhdGNoIHtcbiAgICB0b2FzdC5lcnJvcign5omp5bGV5byA5YWz5L+d5a2Y5aSx6LSlJylcbiAgfVxufSlcblxuYXN5bmMgZnVuY3Rpb24gb25Qcm9iZVBlcm1pc3Npb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gIHByb2JpbmcudmFsdWUgPSB0cnVlXG4gIHRvYXN0LmluZm8/Lign6K+35ZyoIDQg56eS5YaF5oyJ5LiL5Lu75oSP6ZSu77yI5aaC56m65qC877yJ4oCmJylcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLmV4cGFuc2lvblByb2JlKClcbiAgICBpZiAocmVzdWx0LnJlY2VpdmVkKSB7XG4gICAgICBwcm9iZUZhaWxlZC52YWx1ZSA9IGZhbHNlXG4gICAgICBleHBhbnNpb25Ib29rT2sudmFsdWUgPSB0cnVlXG4gICAgICB0b2FzdC5zdWNjZXNzKCflhajlsYDmjInplK7nm5HlkKzmraPluLjvvIzmlofmnKzmianlsZXlj6/nlKgnKVxuICAgIH0gZWxzZSB7XG4gICAgICBwcm9iZUZhaWxlZC52YWx1ZSA9IHRydWVcbiAgICAgIGV4cGFuc2lvbkhvb2tPay52YWx1ZSA9IGZhbHNlXG4gICAgICB0b2FzdC5lcnJvcign5pyq5o2V6I635Yiw5oyJ6ZSu77ya6ZyA6KaB44CM6L6F5Yqp5Yqf6IO944CN5o6I5p2DJywge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ+aJk+W8gOaOiOadg+iuvue9ru+8jOaKiiBMZWFmIOWKoOWFpei+heWKqeWKn+iDveWIl+ihqOWQjumHjeivlSdcbiAgICAgIH0pXG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICB0b2FzdC5lcnJvcign6K+K5pat5aSx6LSlJylcbiAgfSBmaW5hbGx5IHtcbiAgICBwcm9iaW5nLnZhbHVlID0gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBvcGVuQTExeVNldHRpbmdzKCk6IHZvaWQge1xuICBpZiAoL01hYy9pLnRlc3QobmF2aWdhdG9yLnBsYXRmb3JtKSkge1xuICAgIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlbkV4dGVybmFsKFxuICAgICAgJ3gtYXBwbGUuc3lzdGVtcHJlZmVyZW5jZXM6Y29tLmFwcGxlLnByZWZlcmVuY2Uuc2VjdXJpdHk/UHJpdmFjeV9BY2Nlc3NpYmlsaXR5J1xuICAgIClcbiAgfVxufVxuXG5mdW5jdGlvbiBzdGFydFJlY29yZGluZyh0eXBlOiAnbWFpbicgfCAnY29tbWFuZCcsIGtleT86IHN0cmluZyk6IHZvaWQge1xuICByZWNvcmRpbmcudmFsdWUgPSB7IHR5cGUsIGtleSB9XG59XG5cbi8qKiBrZXlkb3duIOKGkiBFbGVjdHJvbiBhY2NlbGVyYXRvcu+8iOS/rumlsOmUriArIOS4u+mUru+8iSAqL1xuZnVuY3Rpb24gZXZlbnRUb0FjY2VsZXJhdG9yKGU6IEtleWJvYXJkRXZlbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgTU9ESUZJRVJfS0VZUyA9IFsnQ29udHJvbCcsICdNZXRhJywgJ0FsdCcsICdTaGlmdCcsICdBbHRHcmFwaCcsICdDYXBzTG9jaycsICdEZWFkJ11cbiAgaWYgKE1PRElGSUVSX0tFWVMuaW5jbHVkZXMoZS5rZXkpKSByZXR1cm4gbnVsbFxuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXVxuICBpZiAoZS5jdHJsS2V5KSBwYXJ0cy5wdXNoKCdDb250cm9sJylcbiAgaWYgKGUubWV0YUtleSkgcGFydHMucHVzaCgnQ29tbWFuZCcpXG4gIGlmIChlLmFsdEtleSkgcGFydHMucHVzaCgnQWx0JylcbiAgaWYgKGUuc2hpZnRLZXkpIHBhcnRzLnB1c2goJ1NoaWZ0JylcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGwgLy8g5b+F6aG75ZCr5L+u6aWw6ZSu77yM6YG/5YWN5ZCe5o6J5pmu6YCa5oyJ6ZSuXG4gIGNvbnN0IGtleU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnICc6ICdTcGFjZScsXG4gICAgQXJyb3dVcDogJ1VwJyxcbiAgICBBcnJvd0Rvd246ICdEb3duJyxcbiAgICBBcnJvd0xlZnQ6ICdMZWZ0JyxcbiAgICBBcnJvd1JpZ2h0OiAnUmlnaHQnLFxuICAgIEVzY2FwZTogJ0VzYydcbiAgfVxuICBjb25zdCBrZXkgPSBrZXlNYXBbZS5rZXldID8/IChlLmtleS5sZW5ndGggPT09IDEgPyBlLmtleS50b1VwcGVyQ2FzZSgpIDogZS5rZXkpXG4gIHJldHVybiBbLi4ucGFydHMsIGtleV0uam9pbignKycpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uUmVjb3JkaW5nS2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghcmVjb3JkaW5nLnZhbHVlKSByZXR1cm5cbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgIHJlY29yZGluZy52YWx1ZSA9IG51bGxcbiAgICByZXR1cm5cbiAgfVxuICBjb25zdCBhY2NlbCA9IGV2ZW50VG9BY2NlbGVyYXRvcihlKVxuICBpZiAoIWFjY2VsKSByZXR1cm5cbiAgdHJ5IHtcbiAgICBpZiAocmVjb3JkaW5nLnZhbHVlLnR5cGUgPT09ICdtYWluJykge1xuICAgICAgYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5ob3RrZXlzU2V0TWFpbihhY2NlbClcbiAgICAgIHRvYXN0LnN1Y2Nlc3MoYOS4u+eDremUruW3suiuvuS4uiAke2FjY2VsfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gaG90a2V5Q29tbWFuZHMudmFsdWUuZmluZCgocikgPT4gci5lbnRyeS5rZXkgPT09IHJlY29yZGluZy52YWx1ZT8ua2V5KVxuICAgICAgaWYgKGVudHJ5Py5zcGVjKSB7XG4gICAgICAgIGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuaG90a2V5c1NldENvbW1hbmQoYWNjZWwsIGVudHJ5LnNwZWMpXG4gICAgICAgIHRvYXN0LnN1Y2Nlc3MoYCR7ZW50cnkuZW50cnkudGl0bGV9IOW3sue7keWumiAke2FjY2VsfWApXG4gICAgICB9XG4gICAgfVxuICAgIGF3YWl0IHJlZnJlc2hIb3RrZXlzKClcbiAgfSBjYXRjaCB7XG4gICAgdG9hc3QuZXJyb3IoJ+eDremUruiuvue9ruWksei0pScpXG4gIH0gZmluYWxseSB7XG4gICAgcmVjb3JkaW5nLnZhbHVlID0gbnVsbFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZUNvbW1hbmRIb3RrZXkoYWNjZWw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLmhvdGtleXNTZXRDb21tYW5kKGFjY2VsLCBudWxsKVxuICBhd2FpdCByZWZyZXNoSG90a2V5cygpXG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgCBRdWlja2xpbmtz77yITTIuM++8ieKUgOKUgOKUgOKUgOKUgFxuaW50ZXJmYWNlIFF1aWNrbGlua0l0ZW0ge1xuICBpZDogc3RyaW5nXG4gIG5hbWU6IHN0cmluZ1xuICB1cmw6IHN0cmluZ1xufVxuXG5jb25zdCBxdWlja2xpbmtzID0gcmVmPFF1aWNrbGlua0l0ZW1bXT4oW10pXG5jb25zdCBxbFNhdmluZyA9IHJlZihmYWxzZSlcblxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFF1aWNrbGlua3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgcXVpY2tsaW5rcy52YWx1ZSA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIucXVpY2tsaW5rc0xpc3QoKVxuICB9IGNhdGNoIHtcbiAgICAvKiDor7vlj5blpLHotKXkv53mjIHnqbogKi9cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRRdWlja2xpbmsoKTogdm9pZCB7XG4gIHF1aWNrbGlua3MudmFsdWUucHVzaCh7XG4gICAgaWQ6IGBxbC0ke0RhdGUubm93KCkudG9TdHJpbmcoMzYpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDYpfWAsXG4gICAgbmFtZTogJycsXG4gICAgdXJsOiAnaHR0cHM6Ly8nXG4gIH0pXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZVF1aWNrbGluayhsaW5rOiBRdWlja2xpbmtJdGVtKTogUHJvbWlzZTx2b2lkPiB7XG4gIHF1aWNrbGlua3MudmFsdWUgPSBxdWlja2xpbmtzLnZhbHVlLmZpbHRlcigobCkgPT4gbC5pZCAhPT0gbGluay5pZClcbiAgYXdhaXQgc2F2ZVF1aWNrbGlua3MoKVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlUXVpY2tsaW5rcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcWxTYXZpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgY29uc3QgaXRlbXMgPSBxdWlja2xpbmtzLnZhbHVlXG4gICAgICAuZmlsdGVyKChsKSA9PiBsLm5hbWUudHJpbSgpICYmIC9eaHR0cHM/OlxcL1xcLy8udGVzdChsLnVybC50cmltKCkpKVxuICAgICAgLm1hcCgobCkgPT4gKHsgaWQ6IGwuaWQsIG5hbWU6IGwubmFtZS50cmltKCksIHVybDogbC51cmwudHJpbSgpIH0pKVxuICAgIGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIucXVpY2tsaW5rc1NhdmUoaXRlbXMpXG4gICAgcXVpY2tsaW5rcy52YWx1ZSA9IGl0ZW1zXG4gICAgdG9hc3Quc3VjY2Vzcygn5b+r5o236ZO+5o6l5bey5L+d5a2YJylcbiAgfSBjYXRjaCB7XG4gICAgdG9hc3QuZXJyb3IoJ+S/neWtmOWksei0pScpXG4gIH0gZmluYWxseSB7XG4gICAgcWxTYXZpbmcudmFsdWUgPSBmYWxzZVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uVG9nZ2xlKHA6IExhdW5jaGVyUGx1Z2luKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuc2V0UGx1Z2luRW5hYmxlZChwLmlkLCAhcC5lbmFibGVkKVxuICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICBhd2FpdCByZWZyZXNoKClcbiAgfSBlbHNlIHtcbiAgICB0b2FzdC5lcnJvcign5pON5L2c5aSx6LSlJylcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBvblJlbW92ZShwOiBMYXVuY2hlclBsdWdpbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXdpbmRvdy5jb25maXJtKGDnoa7lrprljbjovb3mj5Lku7bjgIwke3AubmFtZX3jgI3vvJ/lhbbmlbDmja7nm67lvZXlsIbooqvliKDpmaTjgIJgKSkgcmV0dXJuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIucmVtb3ZlUGx1Z2luKHAuaWQpXG4gIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgIHRvYXN0LnN1Y2Nlc3MoYOW3suWNuOi9vSAke3AubmFtZX1gKVxuICAgIGF3YWl0IHJlZnJlc2goKVxuICB9IGVsc2Uge1xuICAgIHRvYXN0LmVycm9yKCfljbjovb3lpLHotKUnLCB7IGRlc2NyaXB0aW9uOiByZXN1bHQuZXJyb3IgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBvblRyeVJ1bihwOiBMYXVuY2hlclBsdWdpbik6IHZvaWQge1xuICBjb25zdCBjbWQgPSBwLmNvbW1hbmRzPy5bMF0/LmNvZGVcbiAgd2luZG93LmFwaS5sYXVuY2hlci5vcGVuUGx1Z2luKHAuaWQsIGNtZClcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSAIFdlYkRBViDlkIzmraUg4pSA4pSA4pSA4pSA4pSAXG5jb25zdCBzeW5jRm9ybSA9IHJlZih7IHVybDogJycsIHVzZXJuYW1lOiAnJywgcGFzc3dvcmQ6ICcnLCByZW1vdGVEaXI6ICcvbGVhZi1sYXVuY2hlcicgfSlcbmNvbnN0IHN5bmNUZXN0aW5nID0gcmVmKGZhbHNlKVxuY29uc3Qgc3luY0JhY2tpbmcgPSByZWYoZmFsc2UpXG5jb25zdCBzeW5jUmVzdG9yaW5nID0gcmVmKGZhbHNlKVxuXG5vbk1vdW50ZWQoYXN5bmMgKCkgPT4ge1xuICB2b2lkIHJlZnJlc2goKVxuICB2b2lkIHJlZnJlc2hNYXJrZXQoKVxuICB2b2lkIHJlZnJlc2hRdWlja2xpbmtzKClcbiAgdm9pZCByZWZyZXNoSG90a2V5cygpXG4gIHZvaWQgcmVmcmVzaEV4cGFuc2lvbigpXG4gIHZvaWQgcmVmcmVzaERldlBsdWdpbnMoKVxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uUmVjb3JkaW5nS2V5ZG93biwgdHJ1ZSlcbiAgLy8g5byA5Y+R54Ot6YeN6L295o6o6YCB77yId2F0Y2hlciDoh6rliqjph43oo4XmiJDlip8v5aSx6LSl77yJ4oaSIHRvYXN0ICsg5YiX6KGo5Yi35pawXG4gIGNvbnN0IGRldkFwaSA9IGRldkNoYW5uZWxzKClcbiAgaWYgKGRldkFwaSAmJiB0eXBlb2YgZGV2QXBpLm9uRGV2UGx1Z2luc0NoYW5nZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBvZmZEZXZDaGFuZ2VkID0gZGV2QXBpLm9uRGV2UGx1Z2luc0NoYW5nZWQoKHBheWxvYWQpID0+IHtcbiAgICAgIGlmIChwYXlsb2FkLmtpbmQgPT09ICdyZWxvYWRlZCcpIHtcbiAgICAgICAgdG9hc3Quc3VjY2Vzcyhg5bey54Ot6YeN6L29ICR7cGF5bG9hZC5uYW1lIHx8IHBheWxvYWQucGx1Z2luSWR9YClcbiAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC5raW5kID09PSAnZXJyb3InKSB7XG4gICAgICAgIHRvYXN0LmVycm9yKGDng63ph43ovb3lpLHotKXvvJoke3BheWxvYWQubmFtZSB8fCBwYXlsb2FkLnBsdWdpbklkfWAsIHtcbiAgICAgICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5lcnJvclxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgdm9pZCByZWZyZXNoKClcbiAgICAgIHZvaWQgcmVmcmVzaERldlBsdWdpbnMoKVxuICAgICAgdm9pZCByZWZyZXNoTWFya2V0KClcbiAgICB9KVxuICB9XG4gIHRyeSB7XG4gICAgc3luY0Zvcm0udmFsdWUgPSBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLnN5bmNHZXRDb25maWcoKVxuICB9IGNhdGNoIHtcbiAgICAvKiDphY3nva7or7vlj5blpLHotKXkv53mjIHpu5jorqQgKi9cbiAgfVxufSlcblxub25CZWZvcmVVbm1vdW50KCgpID0+IHtcbiAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvblJlY29yZGluZ0tleWRvd24sIHRydWUpXG4gIG9mZkRldkNoYW5nZWQ/LigpXG4gIG9mZkRldkNoYW5nZWQgPSBudWxsXG59KVxuXG5hc3luYyBmdW5jdGlvbiBvblN5bmNTYXZlQW5kQmFja3VwKCk6IFByb21pc2U8dm9pZD4ge1xuICBzeW5jQmFja2luZy52YWx1ZSA9IHRydWVcbiAgdHJ5IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLmxhdW5jaGVyLnN5bmNTZXRDb25maWcoeyAuLi5zeW5jRm9ybS52YWx1ZSB9KVxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuc3luY0JhY2t1cCgpXG4gICAgaWYgKHJlc3VsdC5vaykge1xuICAgICAgdG9hc3Quc3VjY2Vzcyhg5aSH5Lu95oiQ5Yqf77yIJHtyZXN1bHQuY291bnQgPz8gMH0g5p2h5pWw5o2u77yJYClcbiAgICB9IGVsc2Uge1xuICAgICAgdG9hc3QuZXJyb3IoJ+Wkh+S7veWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBzeW5jQmFja2luZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gb25TeW5jVGVzdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgc3luY1Rlc3RpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5zeW5jVGVzdCh7IC4uLnN5bmNGb3JtLnZhbHVlIH0pXG4gICAgaWYgKHJlc3VsdC5vaykge1xuICAgICAgdG9hc3Quc3VjY2Vzcygn6L+e5o6l5oiQ5YqfJylcbiAgICB9IGVsc2Uge1xuICAgICAgdG9hc3QuZXJyb3IoJ+i/nuaOpeWksei0pScsIHsgZGVzY3JpcHRpb246IHJlc3VsdC5lcnJvciB9KVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBzeW5jVGVzdGluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gb25TeW5jUmVzdG9yZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF3aW5kb3cuY29uZmlybSgn5oGi5aSN5bCG55So5LqR56uv5b+r54Wn6KaG55uW5pys5Zyw5YWo6YOo5o+S5Lu25pWw5o2u77yM56Gu5a6a57un57ut77yfJykpIHJldHVyblxuICBzeW5jUmVzdG9yaW5nLnZhbHVlID0gdHJ1ZVxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIuc3luY1Jlc3RvcmUoKVxuICAgIGlmIChyZXN1bHQub2spIHtcbiAgICAgIHRvYXN0LnN1Y2Nlc3MoYOaBouWkjeaIkOWKn++8iCR7cmVzdWx0LmNvdW50ID8/IDB9IOadoeaVsOaNru+8iWApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRvYXN0LmVycm9yKCfmgaLlpI3lpLHotKUnLCB7IGRlc2NyaXB0aW9uOiByZXN1bHQuZXJyb3IgfSlcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgc3luY1Jlc3RvcmluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cbjwvc2NyaXB0PlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy92aWV3cy9sYXVuY2hlci9pbmRleC52dWUifQ==